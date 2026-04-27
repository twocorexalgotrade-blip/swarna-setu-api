// Downloads every image out of the partner ateliers' Drive folders,
// writes them into `public/web_assets/products/{vendor_id}/{product_id}/`
// so express.static serves them, and updates the products table so each
// row points at its newly-hosted image paths.
//
// After this runs, commit + push the new files in public/web_assets/
// so the deployed server (Render etc.) redeploys with the imagery.
//
// ── Prerequisites ──────────────────────────────────────────────────
//  • GOOGLE_API_KEY  in .env — Drive API v3 enabled, key restricted to it.
//  • Both partner Drive folders set to "Anyone with the link · Viewer".
//  • DATABASE_URL    in .env — same DB seed_catalog.js pointed at.
//
// ── Usage ──────────────────────────────────────────────────────────
//  npm run download:drive
//
// Idempotent: reruns overwrite files in place and update DB rows.

require('dotenv').config();
const fs = require('fs');
const path = require('path');
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

const ROOT = path.join(__dirname, 'public', 'web_assets', 'products');

// ─── Helpers ───────────────────────────────────────────────────────

const folderIdFromUrl = (url) => {
    const match = /\/folders\/([A-Za-z0-9_-]+)/.exec(url || '');
    return match ? match[1] : null;
};

const extFromMime = (mime) => {
    if (!mime) return '.jpg';
    if (mime.includes('png')) return '.png';
    if (mime.includes('webp')) return '.webp';
    if (mime.includes('heic')) return '.heic';
    return '.jpg';
};

const ensureDir = (dir) => fs.mkdirSync(dir, { recursive: true });

const listImagesInFolder = async (folderId) => {
    const q = `'${folderId}' in parents and mimeType contains 'image/'`;
    const url = 'https://www.googleapis.com/drive/v3/files';
    const params = {
        q,
        key: API_KEY,
        fields: 'files(id,name,mimeType,size)',
        pageSize: 100,
        orderBy: 'name',
    };
    const res = await axios.get(url, { params, timeout: 20000 });
    return res.data.files || [];
};

const downloadFile = async (fileId, outPath) => {
    // lh3.googleusercontent.com/d/{id}=s0 delivers the original bytes
    // without Drive's "Download anyway?" interstitial — ideal for
    // automated fetches of public images.
    const url = `https://lh3.googleusercontent.com/d/${fileId}=s0`;
    const res = await axios.get(url, {
        responseType: 'stream',
        timeout: 30000,
        maxRedirects: 5,
        validateStatus: (s) => s >= 200 && s < 400,
    });
    await new Promise((resolve, reject) => {
        const writer = fs.createWriteStream(outPath);
        res.data.pipe(writer);
        writer.on('finish', resolve);
        writer.on('error', reject);
    });
};

// ─── Main ──────────────────────────────────────────────────────────

const run = async () => {
    ensureDir(ROOT);

    const { rows } = await pool.query(
        `SELECT id, name, vendor_id, image_url, additional_images
         FROM products
         WHERE vendor_id IN ('VINJAIR', 'SHREERGHAN')
         ORDER BY vendor_id, id`,
    );
    console.log(`\nResolving imagery for ${rows.length} products.\n`);

    let resolved = 0;
    let skipped = 0;
    let failed = 0;

    for (const p of rows) {
        // We use `name` as the product_id proxy when the row has no SKU
        // field — seed_catalog.js didn't persist productId, so we derive
        // a slug from the row id + name for the directory name.
        const productSlug = `${p.id}`;
        const sources = [
            ...(p.additional_images || []),
            p.image_url,
        ].filter((u) => typeof u === 'string' && u.includes('drive.google.com'));
        const folderId = folderIdFromUrl(sources[0]);

        if (!folderId) {
            skipped += 1;
            console.log(`  – [${p.vendor_id}/${p.id}] ${p.name}: no Drive folder, skipping.`);
            continue;
        }

        const dir = path.join(ROOT, p.vendor_id, productSlug);
        ensureDir(dir);

        try {
            const files = await listImagesInFolder(folderId);
            if (files.length === 0) {
                console.log(`  – [${p.vendor_id}/${p.id}] ${p.name}: folder empty.`);
                skipped += 1;
                continue;
            }

            const hostedPaths = [];
            for (let i = 0; i < files.length; i++) {
                const f = files[i];
                const fname = `${String(i).padStart(2, '0')}${extFromMime(f.mimeType)}`;
                const outPath = path.join(dir, fname);
                try {
                    await downloadFile(f.id, outPath);
                    hostedPaths.push(`/web_assets/products/${p.vendor_id}/${productSlug}/${fname}`);
                } catch (err) {
                    console.error(`      · download failed for ${f.name}: ${err.message}`);
                }
            }

            if (hostedPaths.length === 0) {
                failed += 1;
                console.log(`  ✗ [${p.vendor_id}/${p.id}] ${p.name}: no files downloaded.`);
                continue;
            }

            const primary = hostedPaths[0];
            const extras = hostedPaths.slice(1);

            await pool.query(
                `UPDATE products
                 SET image_url = $1,
                     additional_images = $2
                 WHERE id = $3`,
                [primary, extras, p.id],
            );

            console.log(`  ✓ [${p.vendor_id}/${p.id}] ${p.name}: ${hostedPaths.length} image(s).`);
            resolved += 1;
        } catch (err) {
            failed += 1;
            const msg = err.response?.data?.error?.message || err.message;
            console.error(`  ✗ [${p.vendor_id}/${p.id}] ${p.name}: ${msg}`);
        }
    }

    console.log(
        `\nDone. Resolved ${resolved}, skipped ${skipped}, failed ${failed}.`,
    );
    console.log('Next: git add public/web_assets/products && git commit && git push');
};

run()
    .catch((err) => {
        console.error('Fatal:', err);
        process.exitCode = 1;
    })
    .finally(() => pool.end());
