const { Pool } = require('pg');

const isProduction = process.env.NODE_ENV === 'production' || process.env.DATABASE_URL.includes('render');

const pool = new Pool({
    connectionString: process.env.DATABASE_URL || 'postgres://localhost:5432/swarnasetu',
    ssl: isProduction ? { rejectUnauthorized: false } : false
});

const seedProducts = async () => {
    // Seed products for Store 1 (Sagar Gold)
    const vendorId = 'store1';

    // Seed Shop first
    try {
        await pool.query('INSERT INTO shops (vendor_id, shop_name, shop_address) VALUES ($1, $2, $3) ON CONFLICT (vendor_id) DO NOTHING',
            [vendorId, 'Sagar Gold', 'Mumbai, India']);
        console.log('Shop record ensured.');
    } catch (err) {
        console.error('Error seeding shop:', err);
    }

    const products = [
        {
            name: 'Imperial Polki Necklace',
            description: 'A masterpiece of unfinished diamonds set in 22K gold.',
            price: 250000,
            weight: 45.0,
            category: 'Necklaces',
            purity: '22K',
            image_url: '/web_assets/products/temple_jewelry.png'
        },
        {
            name: 'Gold Chain Collection',
            description: 'Exquisite handcrafted gold chains showing traditional artistry.',
            price: 45000,
            weight: 8.5,
            category: 'Necklaces',
            purity: '22K',
            image_url: '/web_assets/products/gold_chain.png'
        },
        {
            name: 'Royal Kundan Choker',
            description: 'Regal choker necklace capable of elevating any bridal look.',
            price: 180000,
            weight: 32.0,
            category: 'Necklaces',
            purity: '22K',
            image_url: '/web_assets/products/crystal_choker.png'
        },
        {
            name: 'Sleek Gold Bangles',
            description: 'Set of 4 daily wear gold bangles.',
            price: 68000,
            weight: 12.5,
            category: 'Bangles',
            purity: '22K',
            image_url: '/web_assets/products/gold_bangle.png'
        },
        {
            name: 'Diamond Solitaire Ring',
            description: 'A timeless symbol of love, featuring a 1ct solitaire.',
            price: 320000,
            weight: 4.5,
            category: 'Rings',
            purity: '18K',
            image_url: '/web_assets/products/diamond_solitaire.png'
        },
        {
            name: 'Sapphire & Diamond Ring',
            description: 'Deep blue sapphire surrounded by a halo of diamonds.',
            price: 85000,
            weight: 5.2,
            category: 'Rings',
            purity: '18K',
            image_url: '/web_assets/products/sapphire_ring.png'
        },
        {
            name: 'Thick Gold Chain',
            description: 'Heavy weight gold chain statement piece.',
            price: 110000,
            weight: 22.0,
            category: 'Necklaces',
            purity: '22K',
            image_url: '/web_assets/products/thick_gold_chain.png'
        },
        {
            name: 'Rose Gold Pendant',
            description: 'Delicate rose gold pendant for modern elegance.',
            price: 18000,
            weight: 3.5,
            category: 'Pendants',
            purity: '18K',
            image_url: '/web_assets/products/rose_gold_pendant.png'
        },
        {
            name: 'Diamond Tennis Bracelet',
            description: 'A continuous line of brilliant-cut diamonds.',
            price: 145000,
            weight: 10.0,
            category: 'Bracelets',
            purity: '18K',
            image_url: '/web_assets/products/diamond_tennis_bracelet.png'
        },
        {
            name: 'Antique Gold Chandbalis',
            description: 'Traditional earrings with intricate gold filigree work.',
            price: 55000,
            weight: 15.0,
            category: 'Earrings',
            purity: '22K',
            image_url: '/web_assets/products/gold_chandbalis.png'
        }
    ];

    try {
        console.log(`Seeding products for ${vendorId}...`);

        // Clear existing products for this vendor to avoid duplicates
        await pool.query('DELETE FROM products WHERE vendor_id = $1', [vendorId]);

        for (const p of products) {
            const query = `
                INSERT INTO products (name, description, price, weight_grams, category, purity, image_url, vendor_id, in_stock)
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8, true)
                RETURNING id, name
            `;
            const values = [p.name, p.description, p.price, p.weight, p.category, p.purity, p.image_url, vendorId];
            const res = await pool.query(query, values);
            console.log(`Inserted: ${res.rows[0].name}`);
        }

        console.log('✅ Seeding complete!');
    } catch (err) {
        console.error('Error seeding products:', err);
    } finally {
        pool.end();
    }
};

seedProducts();
