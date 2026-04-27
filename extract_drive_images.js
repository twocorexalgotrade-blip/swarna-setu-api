// Resolves Google Drive folder URLs in the seeded catalogue down to
// direct image URLs, then updates each product's image_url +
// additional_images in the DB.
//
// The Drive folders for both ateliers are "Anyone with the link can
// view", so a simple API key (Drive API v3) is sufficient — no OAuth
// dance required.
//
// ── Setup ──────────────────────────────────────────────────────────
//  1. Create an API key at https://console.cloud.google.com/apis/credentials
//  2. Enable the "Google Drive API" on the same project.
//  3. Restrict the key to the Drive API only.
//  4. Put the key in server .env as:  GOOGLE_API_KEY=...
//  5. npm run extract:drive
//
// The script is idempotent — rerun it whenever a vendor adds files.

require('dotenv').config();
const axios = require('axios');
const { Pool } = require('pg');

const API_KEY = process.env.GOOGLE_API_KEY;
if (!API_KEY) {
    console.error('✗ GOOGLE_API_KEY is not set. Add it to .env and retry.');
    process.exit(1);
}

const isProduction = process.env.NODE_ENV === 'production' ||
    (process.env.DATABASE_URL || '').includes('render');

const pool = new Pool({
    connectionString: process.env.DATABASE_URL || 'postgres://localhost:5432/swarnasetu',
    ssl: isProduction ? { rejectUnauthorized: false } : false,
});

// ─── Helpers ───────────────────────────────────────────────────────

const folderIdFromUrl = (url) => {
    const match = /\/folders\/([A-Za-z0-9_-]+)/.exec(url || '');
    return match ? match[1] : null;
};

// lh3.googleusercontent.com serves Drive image bytes directly at any
// size without a redirect dance. `=w1200` asks for a 1200-px wide copy.
const directImageUrlFor = (fileId, width = 1200) =>
    `https://lh3.googleusercontent.com/d/${fileId}=w${width}`;

const listImagesInFolder = async (folderId) => {
    // Drive API v3 — listing public folder contents.
    // Filter to image MIME types so we don't pick up README docs.
    const q = `'${folderId}' in parents and (mimeType contains 'image/' or mimeType = 'application/vnd.google-apps.folder')`;
    const url = 'https://www.googleapis.com/drive/v3/files';
    const params = {
        q,
        key: API_KEY,
        fields: 'files(id,name,mimeType)',
        pageSize: 100,
        orderBy: 'name',
    };
    const res = await axios.get(url, { params, timeout: 15000 });
    return (res.data.files || []).filter((f) =>
        (f.mimeType || '').startsWith('image/'),
    );
};

// ─── Main ──────────────────────────────────────────────────────────

const run = async () => {
    // Pull all products for our two seeded vendors.
    const { rows } = await pool.query(
        `SELECT id, name, vendor_id, image_url, additional_images
         FROM products
         WHERE vendor_id IN ('VINJAIR', 'SHREERGHAN')
         ORDER BY vendor_id, id`,
    );
    console.log(`Found ${rows.length} products to resolve.`);

    let updated = 0;
    let skipped = 0;
    let failed = 0;

    for (const p of rows) {
        // Prefer a Drive URL stashed in additional_images, fall back to image_url.
        const candidates = [
            ...(p.additional_images || []),
            p.image_url,
        ].filter((u) => typeof u === 'string' && u.includes('drive.google.com'));
        const driveUrl = candidates[0];
        const folderId = folderIdFromUrl(driveUrl);

        if (!folderId) {
            skipped += 1;
            console.log(`  – ${p.name}: no Drive folder link, skipping.`);
            continue;
        }

        try {
            const files = await listImagesInFolder(folderId);
            if (files.length === 0) {
                console.log(`  – ${p.name}: folder empty / no images.`);
                skipped += 1;
                continue;
            }

            const imageUrls = files.map((f) => directImageUrlFor(f.id));
            const primary = imageUrls[0];
            const extras = imageUrls.slice(1);

            await pool.query(
                `UPDATE products
                 SET image_url = $1,
                     additional_images = $2
                 WHERE id = $3`,
                [primary, extras, p.id],
            );

            console.log(`  ✓ ${p.name}: ${files.length} image(s) resolved.`);
            updated += 1;
        } catch (err) {
            failed += 1;
            const msg = err.response?.data?.error?.message || err.message;
            console.error(`  ✗ ${p.name}: ${msg}`);
        }
    }

    console.log(
        `\nDone. Updated ${updated}, skipped ${skipped}, failed ${failed}.`,
    );
};

run()
    .catch((err) => {
        console.error('Fatal:', err);
        process.exitCode = 1;
    })
    .finally(() => pool.end());
