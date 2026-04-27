// Downloads every image out of the partner ateliers' public Drive
// folders without any API key — by scraping Google's static
// `embeddedfolderview` endpoint, which lists files for any folder set
// to "Anyone with the link · Viewer".
//
// Files land in
//   public/web_assets/products/{vendor_id}/{product_id}/{NN}.{ext}
// and the corresponding products row gets its image_url +
// additional_images rewritten to those static paths.
//
// Usage:  npm run download:drive:anon
//
// Requires only DATABASE_URL (in .env). Idempotent; safe to rerun.

require('dotenv').config();
const fs = require('fs');
const path = require('path');
const axios = require('axios');
const { Pool } = require('pg');

const isProduction = process.env.NODE_ENV === 'production' ||
    (process.env.DATABASE_URL || '').includes('render');

const pool = new Pool({
    connectionString: process.env.DATABASE_URL || 'postgres://localhost:5432/swarnasetu',
    ssl: isProduction ? { rejectUnauthorized: false } : false,
});

const ROOT = path.join(__dirname, 'public', 'web_assets', 'products');

// ─── Helpers ───────────────────────────────────────────────────────

const folderIdFromUrl = (url) => {
    const m = /\/folders\/([A-Za-z0-9_-]+)/.exec(url || '');
    return m ? m[1] : null;
};

const ensureDir = (dir) => fs.mkdirSync(dir, { recursive: true });

const extFromName = (name) => {
    const ext = path.extname(name || '').toLowerCase();
    if (['.png', '.jpg', '.jpeg', '.webp', '.heic', '.gif'].includes(ext)) return ext;
    return '.jpg';
};

// Scrape the embeddedfolderview HTML for file id + display name.
const listImagesAnon = async (folderId) => {
    const url = `https://drive.google.com/embeddedfolderview?id=${folderId}`;
    const res = await axios.get(url, {
        timeout: 20000,
        responseType: 'text',
        headers: {
            'User-Agent':
                'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) ' +
                'AppleWebKit/537.36 (KHTML, like Gecko) ' +
                'Chrome/124.0 Safari/537.36',
        },
    });
    const html = res.data;

    // Each file lives inside <div class="flip-entry" id="entry-{FILE_ID}" ...>
    //   <div class="flip-entry-title">{FILENAME}</div>
    const entryRe =
        /<div class="flip-entry"[^>]*id="entry-([A-Za-z0-9_-]+)"[\s\S]*?<div class="flip-entry-title">([^<]+)<\/div>/g;
    const out = [];
    let m;
    while ((m = entryRe.exec(html)) !== null) {
        const id = m[1];
        const name = m[2].trim();
        // Skip nested folders (no extension or known folder marker)
        if (/folder/i.test(name)) continue;
        out.push({ id, name });
    }
    return out;
};

const downloadFile = async (fileId, outPath) => {
    const url = `https://lh3.googleusercontent.com/d/${fileId}=s0`;
    const res = await axios.get(url, {
        responseType: 'stream',
        timeout: 60000,
        maxRedirects: 5,
        validateStatus: (s) => s >= 200 && s < 400,
    });
    await new Promise((resolve, reject) => {
        const w = fs.createWriteStream(outPath);
        res.data.pipe(w);
        w.on('finish', resolve);
        w.on('error', reject);
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
        const productSlug = `${p.id}`;
        const sources = [
            ...(p.additional_images || []),
            p.image_url,
        ].filter((u) => typeof u === 'string' && u.includes('drive.google.com'));
        const folderId = folderIdFromUrl(sources[0]);
        const tag = `[${p.vendor_id}/${p.id}] ${p.name}`;

        if (!folderId) {
            skipped += 1;
            console.log(`  – ${tag}: no Drive folder, skipping.`);
            continue;
        }

        const dir = path.join(ROOT, p.vendor_id, productSlug);
        ensureDir(dir);

        try {
            const files = await listImagesAnon(folderId);
            if (files.length === 0) {
                console.log(`  – ${tag}: folder empty (or not public).`);
                skipped += 1;
                continue;
            }

            const hosted = [];
            for (let i = 0; i < files.length; i++) {
                const f = files[i];
                const fname = `${String(i).padStart(2, '0')}${extFromName(f.name)}`;
                const outPath = path.join(dir, fname);
                try {
                    await downloadFile(f.id, outPath);
                    hosted.push(`/web_assets/products/${p.vendor_id}/${productSlug}/${fname}`);
                } catch (err) {
                    console.error(`      · download failed for ${f.name}: ${err.message}`);
                }
            }

            if (hosted.length === 0) {
                failed += 1;
                console.log(`  ✗ ${tag}: no files downloaded.`);
                continue;
            }

            const primary = hosted[0];
            const extras = hosted.slice(1);

            await pool.query(
                `UPDATE products
                 SET image_url = $1,
                     additional_images = $2
                 WHERE id = $3`,
                [primary, extras, p.id],
            );

            console.log(`  ✓ ${tag}: ${hosted.length} image(s).`);
            resolved += 1;
        } catch (err) {
            failed += 1;
            console.error(`  ✗ ${tag}: ${err.message}`);
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
