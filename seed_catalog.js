// Seeds the two partner ateliers (Vinayak Jewelers + Shriram) and their
// full product catalogue into the SwarnaSetu PostgreSQL database.
//
// Mirrors the Flutter-side catalog at
// `swarna_setu_user/lib/data/seed/catalog_seed.dart`.
//
// Prices are derived from weight + the IBJA-pegged 22K rate, so if you
// want to re-price against a different rate pass GOLD_RATE_24K=8100
// (or similar) as an env var before running.
//
// Usage:  npm run seed:catalog
//         GOLD_RATE_24K=8200 node seed_catalog.js

require('dotenv').config();
const { Pool } = require('pg');

const isProduction = process.env.NODE_ENV === 'production' ||
    (process.env.DATABASE_URL || '').includes('render');

const pool = new Pool({
    connectionString: process.env.DATABASE_URL || 'postgres://localhost:5432/swarnasetu',
    ssl: isProduction ? { rejectUnauthorized: false } : false,
});

// ─── Pricing — pegged to the live 24K rate ─────────────────────────
const RATE_24K_PER_GRAM = Number(process.env.GOLD_RATE_24K || 6540); // IBJA fallback
const RATE_22K_PER_GRAM = RATE_24K_PER_GRAM * (22 / 24);
const MAKING_CHARGE_PCT = 0.12;
const LIST_DISCOUNT_PCT = 0.10;

const derivePrice = (weightGrams) => {
    const metalValue = weightGrams * RATE_22K_PER_GRAM;
    const making = metalValue * MAKING_CHARGE_PCT;
    const mrp = Math.round(metalValue + making);
    const price = Math.round(mrp * (1 - LIST_DISCOUNT_PCT));
    return { price, mrp };
};

// Image hosting — express.static('public') serves the imagery dropped
// in by the Drive ingest pipeline. We list every JPG present for a
// given product so the API can return all variants.
const fs = require('fs');
const path = require('path');
const PRODUCT_IMAGE_ROOT = path.join(__dirname, 'public', 'web_assets', 'products');

const imagesForProduct = (vendorId, productId) => {
    const dir = path.join(PRODUCT_IMAGE_ROOT, vendorId, productId);
    if (!fs.existsSync(dir)) return [];
    return fs
        .readdirSync(dir)
        .filter((f) => /\.(jpe?g|png|webp)$/i.test(f))
        .sort()
        .map((f) => `/web_assets/products/${vendorId}/${productId}/${f}`);
};

// ─── Vendors (shops) ────────────────────────────────────────────────
const vendors = [
    {
        vendor_id: 'VINJAIR',
        shop_name: 'Vinayak Jewelers',
        shop_address: 'Mumbai, Maharashtra, India',
        logo_url: '/web_assets/vendors/vinayak_logo.png',
        banner_url: '/web_assets/vendors/vinayak_banner.jpg',
    },
    {
        vendor_id: 'SHREERGHAN',
        shop_name: 'Shriram',
        shop_address: 'Mumbai, Maharashtra, India',
        logo_url: null, // pending real imagery — client falls back to seed asset
        banner_url: null,
    },
];

// ─── Products ──────────────────────────────────────────────────────
// (vendor_id, category, sub_category, drive_folder_url, weight_grams, name, description)
const rawProducts = [
    // ── Vinayak Jewelers — Bangles ──────────────────────────────
    ['VINJAIR-BANG-0001', 'VINJAIR', 'Hand Jewelery', 'Bangles',
        'https://drive.google.com/drive/folders/18HU4i_v-K4BDfmhVtJCE43tchjksn9Mi',
        34, 'Classic Gold-Tone Bangles Set 01',
        'Elegant bangles with a timeless finish, designed for versatile styling across occasions.'],
    ['VINJAIR-BANG-0002', 'VINJAIR', 'Hand Jewelery', 'Bangles',
        'https://drive.google.com/drive/folders/1M_yubwYUW_MX8tDtPQRvgarNzH4-noDL',
        36, 'Traditional Pattern Bangles 02',
        'Crafted with subtle texturing, offering a refined and graceful look.'],
    ['VINJAIR-BANG-0003', 'VINJAIR', 'Hand Jewelery', 'Bangles',
        'https://drive.google.com/drive/folders/1bTOpgv7YiACAz2z_jpXyRhcmc6PQFBJS',
        42, 'Festive Gold Bangles 03',
        'A rich-toned bangle set ideal for festive and celebratory wear.'],
    ['VINJAIR-BANG-0004', 'VINJAIR', 'Hand Jewelery', 'Bangles',
        'https://drive.google.com/drive/folders/1Taoq46yUH1yJcH4jMU4Y_LlgUgcTUU_P',
        33, 'Minimal Carved Bangles 04',
        'Clean design with delicate detailing, suitable for everyday elegance.'],
    ['VINJAIR-BANG-0005', 'VINJAIR', 'Hand Jewelery', 'Bangles',
        'https://drive.google.com/drive/folders/1gPayJ8ktNRNt66n8GpTcrBu29mKp-hLj',
        45, 'Premium Finish Bangles 05',
        'Smooth finish bangles with a balanced blend of simplicity and shine.'],
    ['VINJAIR-BANG-0006', 'VINJAIR', 'Hand Jewelery', 'Bangles',
        'https://drive.google.com/drive/folders/1Rbxyzc-mgBWFSig6G4Zn_Eg9ooKqlEhi',
        39, 'Heritage Style Bangles 06',
        'Inspired by traditional aesthetics with a modern polished touch.'],
    ['VINJAIR-BANG-0007', 'VINJAIR', 'Hand Jewelery', 'Bangles',
        'https://drive.google.com/drive/folders/1lOJjNvWwjN3C-RK1266PHCU9_Fx1v9_Y',
        31, 'Elegant Stack Bangles 07',
        'Lightweight and stackable design for a layered look.'],
    ['VINJAIR-BANG-0008', 'VINJAIR', 'Hand Jewelery', 'Bangles',
        'https://drive.google.com/drive/folders/1lBB8TT6oQ1FUeXhhr4GYMG4RIqj92zRC',
        48, 'Ornate Design Bangles 08',
        'Detailed surface work enhances the overall richness of the piece.'],
    ['VINJAIR-BANG-0009', 'VINJAIR', 'Hand Jewelery', 'Bangles',
        'https://drive.google.com/drive/folders/1x9v-5REP_X2N00_PCQT9UnYjXB-OzDoi',
        35, 'Subtle Shine Bangles 09',
        'Soft reflective finish for understated elegance.'],
    ['VINJAIR-BANG-0010', 'VINJAIR', 'Hand Jewelery', 'Bangles',
        'https://drive.google.com/drive/folders/1CKCPCf796dVd8nEuL26bbbGE5jnKlNzP',
        44, 'Classic Ethnic Bangles 10',
        'A staple piece designed for ethnic and occasion wear.'],
    ['VINJAIR-BANG-0011', 'VINJAIR', 'Hand Jewelery', 'Bangles',
        'https://drive.google.com/drive/folders/1XM7ghmrNBKS4lnkwQKWENnmIn7HvX-ew',
        32, 'Light Comfort Bangles 11',
        'Designed for comfort with a sleek and wearable finish.'],
    ['VINJAIR-BANG-0012', 'VINJAIR', 'Hand Jewelery', 'Bangles',
        'https://drive.google.com/drive/folders/18bB9XyBb4umO62uvZhcroNQqnmysRV_-',
        50, 'Royal Touch Bangles 12',
        'Bold presence with a refined gold-tone appeal.'],
    ['VINJAIR-BANG-0013', 'VINJAIR', 'Hand Jewelery', 'Bangles',
        'https://drive.google.com/drive/folders/1-3Ts465kqU6atm0zF3dyR5Bkc1JBZ-ow',
        37, 'Everyday Gold Bangles 13',
        'Versatile bangles suited for both casual and traditional looks.'],

    // ── Vinayak Jewelers — Bracelets ────────────────────────────
    ['VINJAIR-BRAC-0001', 'VINJAIR', 'Hand Jewelery', 'Bracelet',
        'https://drive.google.com/drive/folders/1DQMYJh7R1c9Sw76R-Th40TnxA9RzUsCW',
        18, 'Sleek Gold Bracelet 01',
        'A modern bracelet with a clean and minimal finish.'],
    ['VINJAIR-BRAC-0002', 'VINJAIR', 'Hand Jewelery', 'Bracelet',
        'https://drive.google.com/drive/folders/1uPeCnECU0qOQjUu9oIl6jBV3FnFZ7Fls',
        22, 'Textured Chain Bracelet 02',
        'Subtle detailing adds depth to this refined piece.'],
    ['VINJAIR-BANG-0014', 'VINJAIR', 'Hand Jewelery', 'Bangles',
        'https://drive.google.com/drive/folders/1uWTsBPXYLTWSGVUAAvnAsV2EUwFOTfNM',
        20, 'Classic Wrist Bracelet 03',
        'Designed for everyday wear with a polished aesthetic.'],
    ['VINJAIR-BRAC-0003', 'VINJAIR', 'Hand Jewelery', 'Bracelet',
        'https://drive.google.com/drive/folders/1XaVxAi8_OjQwZm6SKXapOQ-THlb8D3ZC',
        24, 'Premium Link Bracelet 04',
        'Structured design offering a bold yet elegant look.'],
    ['VINJAIR-BRAC-0004', 'VINJAIR', 'Hand Jewelery', 'Bracelet',
        'https://drive.google.com/drive/folders/1kBE_JSdD9afIQCCGP5TBx9e-CIygdFeY',
        19, 'Elegant Gold Bracelet 05',
        'Lightweight and versatile with a smooth finish.'],
    ['VINJAIR-BRAC-0005', 'VINJAIR', 'Hand Jewelery', 'Bracelet',
        'https://drive.google.com/drive/folders/1BLFdD7yWoFXg9eodohgkD-UFk6CTT3wC',
        12, 'Classic Gold Earrings 01',
        'Timeless design with a clean and elegant finish.'],

    // ── Vinayak Jewelers — Earrings ─────────────────────────────
    ['VINJAIR-EARR-0001', 'VINJAIR', 'Ear Jewelery', 'Earring',
        'https://drive.google.com/drive/folders/1JEqoenSczY4Q4D0SSiwuzEduD-slUnCO',
        14, 'Textured Drop Earrings 02',
        'Subtle detailing enhances the overall appearance.'],
    ['VINJAIR-EARR-0002', 'VINJAIR', 'Ear Jewelery', 'Earring',
        'https://drive.google.com/drive/folders/118efzgSb_LhZ1PeSbAJJ4wzX2elcP6UJ',
        11, 'Minimal Stud Earrings 03',
        'Simple and refined, suitable for everyday wear.'],
    ['VINJAIR-EARR-0003', 'VINJAIR', 'Ear Jewelery', 'Earring',
        'https://drive.google.com/drive/folders/1hVC2PcTEA84x8v0J1M7caYixdQ0lrgLR',
        16, 'Traditional Earrings 04',
        'Designed with a classic touch for ethnic styling.'],
    ['VINJAIR-EARR-0004', 'VINJAIR', 'Ear Jewelery', 'Earring',
        'https://drive.google.com/drive/folders/1v7MTad3RIqNJClC9bOZpNsm-w-L_o9QX',
        13, 'Elegant Hoop Earrings 05',
        'Smooth curves with a polished finish.'],
    ['VINJAIR-EARR-0005', 'VINJAIR', 'Ear Jewelery', 'Earring',
        'https://drive.google.com/drive/folders/1i_1Jb089iPpT9R-ncK_k7jAUpt4H2hqV',
        15, 'Statement Earrings 06',
        'A bold design with a balanced aesthetic.'],
    ['VINJAIR-EARR-0006', 'VINJAIR', 'Ear Jewelery', 'Earring',
        'https://drive.google.com/drive/folders/1oHUWVA13J5HjLA_RkMNZBhkkSx3Ke_DU',
        12, 'Modern Gold Earrings 07',
        'Contemporary styling with a sleek look.'],
    ['VINJAIR-EARR-0007', 'VINJAIR', 'Ear Jewelery', 'Earring',
        'https://drive.google.com/drive/folders/1DRZXxSkuZZPeBp9y_KON0uoy2cnF2L69',
        17, 'Detailed Finish Earrings 08',
        'Fine detailing adds depth and character.'],
    ['VINJAIR-EARR-0008', 'VINJAIR', 'Ear Jewelery', 'Earring',
        'https://drive.google.com/drive/folders/1kAo_UR7YBBywt_thKAPOgIflx8WdkRYU',
        14, 'Premium Look Earrings 09',
        'Designed for a rich and elegant appearance.'],
    ['VINJAIR-EARR-0009', 'VINJAIR', 'Ear Jewelery', 'Earring',
        'https://drive.google.com/drive/folders/1djU5cfj8v1wh-YnD4zACXU8kyovR8J6o',
        13, 'Lightweight Earrings 10',
        'Comfortable and stylish for regular wear.'],
    ['VINJAIR-EARR-0010', 'VINJAIR', 'Ear Jewelery', 'Earring',
        'https://drive.google.com/drive/folders/1YJmez8pAKZdV19PV84EM-lkH9iljsETO',
        16, 'Ethnic Style Earrings 11',
        'A traditional design with modern refinement.'],
    ['VINJAIR-EARR-0011', 'VINJAIR', 'Ear Jewelery', 'Earring',
        'https://drive.google.com/drive/folders/1U_JIcGc6KrsHF-ZzUhUOBzpKnIDa0pty',
        15, 'Gold-Tone Earrings 12',
        'Smooth finish with a subtle shine.'],
    ['VINJAIR-EARR-0012', 'VINJAIR', 'Ear Jewelery', 'Earring',
        'https://drive.google.com/drive/folders/12T7X7grOL4SpKHWTNwsDsIawCYmlE7ev',
        12, 'Daily Wear Earrings 13',
        'Minimal and versatile styling.'],
    ['VINJAIR-EARR-0013', 'VINJAIR', 'Ear Jewelery', 'Earring',
        'https://drive.google.com/drive/folders/1vOOAAy6JO9tMIMnouyBxFAClBLGcfP5K',
        18, 'Festive Earrings 14',
        'Ideal for special occasions with a standout design.'],
    ['VINJAIR-EARR-0014', 'VINJAIR', 'Ear Jewelery', 'Earring',
        'https://drive.google.com/drive/folders/1kuZZldx5Pl_wFFfwSbi7UAr2_7iHHro3',
        14, 'Classic Pattern Earrings 15',
        'Subtle patterns enhance visual appeal.'],
    ['VINJAIR-EARR-0015', 'VINJAIR', 'Ear Jewelery', 'Earring',
        'https://drive.google.com/drive/folders/11cv-_QQiIc4GL5PsAScDacw3AvXYT1nI',
        13, 'Elegant Curve Earrings 16',
        'Soft curves with a polished finish.'],
    ['VINJAIR-EARR-0016', 'VINJAIR', 'Ear Jewelery', 'Earring',
        'https://drive.google.com/drive/folders/1hAMjsY7DIZYOPwcQGCIBjp7M-El7UVRD',
        17, 'Premium Drop Earrings 17',
        'Balanced design with refined detailing.'],
    ['VINJAIR-EARR-0017', 'VINJAIR', 'Ear Jewelery', 'Earring',
        'https://drive.google.com/drive/folders/1jg83XN9vnPaejjW1D1a8_zktMLRuuJ2u',
        12, 'Simple Gold Earrings 18',
        'Clean and timeless aesthetic.'],
    ['VINJAIR-EARR-0018', 'VINJAIR', 'Ear Jewelery', 'Earring',
        'https://drive.google.com/drive/folders/1R63qjRvPb_yL9cYFhF_wI_C5R-Zpv2mA',
        15, 'Modern Ethnic Earrings 19',
        'Fusion design suitable for multiple looks.'],
    ['VINJAIR-EARR-0019', 'VINJAIR', 'Ear Jewelery', 'Earring',
        'https://drive.google.com/drive/folders/11JcjRQlAXu1-RhGJyy_Lq6jDHr-8kjrn',
        16, 'Signature Earrings 20',
        'A distinctive piece with a premium finish.'],
    ['VINJAIR-EARR-0020', 'VINJAIR', 'Ear Jewelery', 'Earring',
        'https://drive.google.com/drive/folders/1FoTwQfEWiH20hZ5SaWgSns4M-TD7OD9Q',
        16, 'Signature Earrings 21',
        'Subtle patterns enhance visual appeal.'],

    // ── Vinayak Jewelers — Necklaces ────────────────────────────
    ['VINJAIR-NECK-0001', 'VINJAIR', 'Neck Jewelery', 'Necklace',
        'https://drive.google.com/drive/folders/1p8IYSafVa2lZpa0AfgObuoyzqF7BNhBN',
        35, 'Classic Gold Necklace 01',
        'A refined necklace with a balanced and elegant design.'],
    ['VINJAIR-NECK-0002', 'VINJAIR', 'Neck Jewelery', 'Necklace',
        'https://drive.google.com/drive/folders/1ZxQdhiNfxTNXvU7ubWbELKeVFvOqiUOu',
        37, 'Traditional Necklace Set 02',
        'Designed for festive wear with a rich and detailed look.'],
    ['VINJAIR-NECK-0003', 'VINJAIR', 'Neck Jewelery', 'Necklace',
        'https://drive.google.com/drive/folders/1tDM8BlX4nQMirM5CElOVtDsK1smTr-pZ',
        40, 'Premium Finish Necklace 03',
        'Smooth finish with a luxurious and timeless appeal.'],

    // ── Shriram — Rings ─────────────────────────────────────────
    ['SHREERGHAN-RING-0001', 'SHREERGHAN', 'Hand Jewelery', 'Ring',
        'https://drive.google.com/drive/folders/16srIuIag_wgRVnAGhO2yi0x7xfGMo7VC',
        14, 'Classic Ring 01',
        'A refined piece with a clean and versatile finish suitable for multiple occasions.'],
    ['SHREERGHAN-RING-0002', 'SHREERGHAN', 'Hand Jewelery', 'Ring',
        'https://drive.google.com/drive/folders/1sS1Wc_s6bVW-h7Uh3RhUxTOkkroqlPYS',
        16, 'Premium Ring 02',
        'Designed with a balanced look that complements both casual and formal styles.'],
    ['SHREERGHAN-RING-0003', 'SHREERGHAN', 'Hand Jewelery', 'Ring',
        'https://drive.google.com/drive/folders/1kOhBY0FgmD5-x0NDe7uxRTyc_AAe_m8v',
        13, 'Minimal Ring 03',
        'A subtle design offering a sleek and modern appearance.'],
    ['SHREERGHAN-RING-0004', 'SHREERGHAN', 'Hand Jewelery', 'Ring',
        'https://drive.google.com/drive/folders/1V-LBSgelsGI5EV2mdW9rpxcBRaIqwvM-',
        18, 'Signature Ring 04',
        'A bold yet elegant piece with a polished overall finish.'],
    ['SHREERGHAN-RING-0005', 'SHREERGHAN', 'Hand Jewelery', 'Ring',
        'https://drive.google.com/drive/folders/1-7fHI4qW9ccPnTMiGAXcUSh2mB4uv4n2',
        15, 'Elegant Ring 05',
        'Lightweight and comfortable with a timeless aesthetic.'],

    // ── Shriram — Bracelets ─────────────────────────────────────
    ['SHREERGHAN-BRAC-0001', 'SHREERGHAN', 'Hand Jewelery', 'Bracelet',
        'https://drive.google.com/drive/folders/1QN3yRHUMsx_2ixr5e0vBId4bwaGHh_lX',
        21, 'Classic Bracelet 01',
        'A smooth and stylish piece crafted for everyday wear.'],
    ['SHREERGHAN-BRAC-0002', 'SHREERGHAN', 'Hand Jewelery', 'Bracelet',
        'https://drive.google.com/drive/folders/1g64uafCO2KA11Bj6e8co03yGNEethwet',
        24, 'Premium Bracelet 02',
        'A structured design with a refined and balanced look.'],
    ['SHREERGHAN-BRAC-0003', 'SHREERGHAN', 'Hand Jewelery', 'Bracelet',
        'https://drive.google.com/drive/folders/1QbEEZWfOMQ9YsgmG3PtTxNi14OMT7UC7',
        22, 'Modern Bracelet 03',
        'Contemporary styling with a clean finish.'],
    ['SHREERGHAN-BRAC-0004', 'SHREERGHAN', 'Hand Jewelery', 'Bracelet',
        'https://drive.google.com/drive/folders/1Cyzb0Oltl-fDDgtbqVeMTVsn61qCGsMy',
        26, 'Signature Bracelet 04',
        'A bold wrist accessory with a polished appeal.'],

    // ── Shriram — Men Chain ─────────────────────────────────────
    ['SHREERGHAN-CHAINM-0001', 'SHREERGHAN', 'Neck Jewelery', 'Men Chain',
        'https://drive.google.com/drive/folders/11z-h-iQ4KJmhOy6Mw4TPgVzc7tyn3_rV',
        28, 'Men Chain 01',
        'A versatile chain designed with a strong and classic presence.'],

    // ── Shriram — Necklaces ─────────────────────────────────────
    ['SHREERGHAN-NECK-0001', 'SHREERGHAN', 'Neck Jewelery', 'Necklace',
        'https://drive.google.com/drive/folders/1pdY7d4buHJUxb5ogs5uqaqhSuNXogwVK',
        52, 'Classic Necklace 01',
        'A refined necklace with a simple and elegant finish.'],
    ['SHREERGHAN-NECK-0002', 'SHREERGHAN', 'Neck Jewelery', 'Necklace',
        'https://drive.google.com/drive/folders/1kYOJR4tzJwusec8It4SsiQQ4uz5Uqa2b',
        55, 'Premium Necklace 02',
        'Designed for a balanced and graceful look.'],
    ['SHREERGHAN-NECK-0003', 'SHREERGHAN', 'Neck Jewelery', 'Necklace',
        'https://drive.google.com/drive/folders/1aMi_N45J7EQ2m6AOyF0vM0Oxqtpg82aY',
        58, 'Traditional Necklace 03',
        'A timeless piece suitable for various occasions.'],
    ['SHREERGHAN-NECK-0004', 'SHREERGHAN', 'Neck Jewelery', 'Necklace',
        'https://drive.google.com/drive/folders/1S43UBYqmwdb_nirA8y3-7Gkl9T8GV5OC',
        54, 'Modern Necklace 04',
        'A clean and polished design with subtle detailing.'],

    // ── Shriram — Necklace Sets ─────────────────────────────────
    ['SHREERGHAN-NECKS-0001', 'SHREERGHAN', 'Neck Jewelery', 'Necklace Set',
        'https://drive.google.com/drive/folders/1EZz5ep2rqdm1ckA_X1GNij81Cdo1O0QN',
        62, 'Necklace Set 01',
        'A coordinated set designed for a complete and elegant look.'],
    ['SHREERGHAN-NECKS-0002', 'SHREERGHAN', 'Neck Jewelery', 'Necklace Set',
        'https://drive.google.com/drive/folders/1h7toQGe01BCZCC6-1oAsvJqouyFbHYdT',
        65, 'Premium Necklace Set 02',
        'A well-balanced set suitable for festive and formal wear.'],

    // ── Shriram — Earrings ──────────────────────────────────────
    ['SHREERGHAN-EARR-0001', 'SHREERGHAN', 'Ear Jewelery', 'Earring',
        'https://drive.google.com/drive/folders/1ZzPnFf_SfxjcBx-ts2UhqXN6VWeEbtiw',
        12, 'Classic Earring 01',
        'A simple and elegant design suitable for everyday use.'],
    ['SHREERGHAN-EARR-0002', 'SHREERGHAN', 'Ear Jewelery', 'Earring',
        'https://drive.google.com/drive/folders/1j0-FxLBPLmfWobow2vZhxY5T7fyTrjvE',
        14, 'Premium Earring 02',
        'A refined piece with a clean and polished finish.'],
    ['SHREERGHAN-EARR-0003', 'SHREERGHAN', 'Ear Jewelery', 'Earring',
        'https://drive.google.com/drive/folders/1sSJAc9cSMPPaNpf9Vat73_WgxvrdN74c',
        13, 'Minimal Earring 03',
        'A lightweight and versatile accessory for regular wear.'],
    ['SHREERGHAN-EARR-0004', 'SHREERGHAN', 'Ear Jewelery', 'Earring',
        'https://drive.google.com/drive/folders/1zSpZHM3T7LzaTrpTPKgHtyqvJ4GU6Qpo',
        15, 'Modern Earring 04',
        'A contemporary style with a subtle aesthetic.'],
    ['SHREERGHAN-EARR-0005', 'SHREERGHAN', 'Ear Jewelery', 'Earring',
        'https://drive.google.com/drive/folders/1Hjys-fG3zrC2yYUnbkca3QnG9fSXzyem',
        16, 'Signature Earring 05',
        'A distinctive piece with a balanced and elegant look.'],
];

const seed = async () => {
    console.log('\n─── Seeding partner ateliers ──────────────────────────');
    console.log(`24K rate in use: ₹${RATE_24K_PER_GRAM}/g  (22K: ₹${RATE_22K_PER_GRAM.toFixed(0)}/g)`);

    // 1) Shops
    for (const v of vendors) {
        try {
            await pool.query(
                `INSERT INTO shops (vendor_id, shop_name, shop_address, logo_url, banner_url)
                 VALUES ($1, $2, $3, $4, $5)
                 ON CONFLICT (vendor_id) DO UPDATE SET
                     shop_name = EXCLUDED.shop_name,
                     shop_address = EXCLUDED.shop_address,
                     logo_url = EXCLUDED.logo_url,
                     banner_url = EXCLUDED.banner_url`,
                [v.vendor_id, v.shop_name, v.shop_address, v.logo_url, v.banner_url],
            );
            console.log(`  ✓ Shop upserted: ${v.shop_name} (${v.vendor_id})`);
        } catch (err) {
            console.error(`  ✗ Error upserting shop ${v.vendor_id}:`, err.message);
        }
    }

    // 2) Products — clear existing for these two vendors, then insert fresh
    const vendorIds = vendors.map((v) => v.vendor_id);
    try {
        const del = await pool.query(
            'DELETE FROM products WHERE vendor_id = ANY($1::varchar[])',
            [vendorIds],
        );
        console.log(`\n  Cleared ${del.rowCount} existing products for ${vendorIds.join(', ')}`);
    } catch (err) {
        console.error('  ✗ Error clearing existing products:', err.message);
    }

    let inserted = 0;
    for (const row of rawProducts) {
        const [productId, vendor_id, category, subCategory, driveFolder, weight, name, description] = row;
        const { price } = derivePrice(weight);

        const localImages = imagesForProduct(vendor_id, productId);
        const primary = localImages[0] || driveFolder; // graceful fallback
        const extras = localImages.length > 1 ? localImages.slice(1) : [];

        try {
            await pool.query(
                `INSERT INTO products (
                    name, description, price, weight_grams, category, purity,
                    image_url, vendor_id, in_stock, is_published, published_at,
                    additional_images
                 ) VALUES ($1, $2, $3, $4, $5, '22K', $6, $7, TRUE, TRUE, CURRENT_TIMESTAMP, $8)`,
                [
                    name,
                    description,
                    price,
                    weight,
                    subCategory,
                    primary,
                    vendor_id,
                    extras,
                ],
            );
            inserted += 1;
        } catch (err) {
            console.error(`  ✗ Error inserting "${name}":`, err.message);
        }
    }

    console.log(`\n  Inserted ${inserted} of ${rawProducts.length} products.`);
    console.log('─── Done ──────────────────────────────────────────────\n');
};

seed()
    .catch((err) => {
        console.error('Fatal error:', err);
        process.exitCode = 1;
    })
    .finally(() => pool.end());
