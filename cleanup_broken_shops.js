// Removes legacy / orphaned shop rows so /api/shops/all returns clean
// data. Targets:
//   1. Shops whose logo_url or banner_url is base64-encoded image data
//      (the old Flutter admin app stuffed JPEG bytes into these fields
//      rather than a URL — those rows can't render anywhere).
//   2. Shops with auto-generated vendor_ids that have zero products.
//
// Dry-run by default. Pass --apply (or APPLY=1) to actually delete.
//
//   node cleanup_broken_shops.js              # show what would be removed
//   node cleanup_broken_shops.js --apply      # do it
//
// Foreign keys on products + vendor_credentials cascade, so deleting a
// shop tears down its dependents.

require('dotenv').config();
const { Pool } = require('pg');

const isProd = process.env.NODE_ENV === 'production' ||
    (process.env.DATABASE_URL || '').includes('render');
const pool = new Pool({
    connectionString: process.env.DATABASE_URL || 'postgres://localhost:5432/swarnasetu',
    ssl: isProd ? { rejectUnauthorized: false } : false,
});

const apply = process.argv.includes('--apply') || process.env.APPLY === '1';

const isProbablyBase64 = (v) => {
    if (typeof v !== 'string' || v.length === 0) return false;
    if (v.startsWith('http') || v.startsWith('/')) return false;
    if (v.length > 500) return true;            // way too long for a URL
    if (/^\/9j\/|^iVBORw0|^data:image/.test(v)) return true;
    return false;
};

const run = async () => {
    const shops = await pool.query(
        `SELECT s.id, s.vendor_id, s.shop_name,
                LENGTH(COALESCE(s.logo_url, '')) AS logo_len,
                LENGTH(COALESCE(s.banner_url, '')) AS banner_len,
                s.logo_url, s.banner_url,
                COALESCE(p.cnt, 0) AS product_count
         FROM shops s
         LEFT JOIN (
            SELECT vendor_id, COUNT(*) AS cnt FROM products GROUP BY vendor_id
         ) p ON p.vendor_id = s.vendor_id
         ORDER BY s.id`,
    );

    const targets = [];
    for (const r of shops.rows) {
        const reasons = [];
        if (isProbablyBase64(r.logo_url)) reasons.push('logo_url is base64/garbage');
        if (isProbablyBase64(r.banner_url)) reasons.push('banner_url is base64/garbage');
        if (
            r.product_count === '0' &&
            /^VEN-\d+/.test(r.vendor_id || '')
        ) {
            reasons.push('auto-generated vendor_id with no products');
        }
        if (reasons.length) targets.push({ ...r, reasons });
    }

    console.log(`\nFound ${shops.rowCount} total shops; ${targets.length} flagged.\n`);
    for (const t of targets) {
        console.log(
            `  • [id=${t.id}] ${t.vendor_id} "${t.shop_name}" — ${t.reasons.join('; ')}`,
        );
        console.log(
            `      logo_len=${t.logo_len}, banner_len=${t.banner_len}, products=${t.product_count}`,
        );
    }

    if (!targets.length) {
        console.log('Nothing to clean up.');
        return;
    }

    if (!apply) {
        console.log('\nDry run — pass --apply to actually delete.\n');
        return;
    }

    let deleted = 0;
    for (const t of targets) {
        try {
            await pool.query('DELETE FROM shops WHERE id = $1', [t.id]);
            deleted += 1;
        } catch (err) {
            console.error(`  ✗ Failed to delete ${t.vendor_id}: ${err.message}`);
        }
    }
    console.log(`\nDeleted ${deleted} shop(s).`);
};

run()
    .catch((err) => {
        console.error('Fatal:', err);
        process.exitCode = 1;
    })
    .finally(() => pool.end());
