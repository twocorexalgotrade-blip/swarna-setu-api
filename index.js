const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const listEndpoints = require('express-list-endpoints');

const app = express();
const PORT = process.env.PORT || 3000;

// --- DATABASE CONNECTION ---
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: {
        rejectUnauthorized: false
    }
});

// --- TABLE CREATION FUNCTIONS ---
const createVendorsTable = async () => {
    const queryText = `
    CREATE TABLE IF NOT EXISTS vendors (
      id SERIAL PRIMARY KEY,
      email VARCHAR(255) UNIQUE NOT NULL,
      password VARCHAR(255) NOT NULL,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    );
  `;
    try { await pool.query(queryText); console.log('"vendors" table is ready.'); } catch (err) { console.error('Error creating vendors table', err.stack); }
};
const createUsersTable = async () => {
    const queryText = `
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      name VARCHAR(255) NOT NULL,
      email VARCHAR(255) UNIQUE NOT NULL,
      password VARCHAR(255) NOT NULL,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    );
  `;
    try { await pool.query(queryText); console.log('"users" table is ready.'); } catch (err) { console.error('Error creating users table', err.stack); }
};
const createProductsTable = async () => {
    const queryText = `
    CREATE TABLE IF NOT EXISTS products (
      id SERIAL PRIMARY KEY,
      name VARCHAR(255) NOT NULL,
      description TEXT,
      price NUMERIC(10, 2) NOT NULL,
      weight_grams NUMERIC(10, 2),
      category VARCHAR(100),
      purity VARCHAR(50),
      image_url VARCHAR(255),
      in_stock BOOLEAN DEFAULT TRUE,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    );
  `;
    try { await pool.query(queryText); console.log('"products" table is ready.'); } catch (err) { console.error('Error creating products table', err.stack); }
};
const createBagItemsTable = async () => {
    const queryText = `
    CREATE TABLE IF NOT EXISTS bag_items (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      product_id TEXT NOT NULL,
      product_name VARCHAR(255) NOT NULL,
      product_image_url VARCHAR(255),
      vendor_name VARCHAR(255),
      price NUMERIC(10, 2) NOT NULL,
      added_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    );
  `;
    try { await pool.query(queryText); console.log('"bag_items" table is ready.'); } catch (err) { console.error('Error creating bag_items table', err.stack); }
};
const createOrdersTable = async () => {
    const queryText = `
    CREATE TABLE IF NOT EXISTS orders (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      total_amount NUMERIC(10, 2) NOT NULL,
      status VARCHAR(50) NOT NULL, -- 'Pending', 'Confirmed', 'Delivered', 'Cancelled'
      fulfillment_method VARCHAR(50), -- 'Home Delivery', 'Store Pickup'
      payment_id VARCHAR(100),
      delivery_address TEXT,
      pickup_store TEXT,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    );
  `;
    try { await pool.query(queryText); console.log('"orders" table is ready.'); } catch (err) { console.error('Error creating orders table', err.stack); }
};
const createOrderItemsTable = async () => {
    const queryText = `
    CREATE TABLE IF NOT EXISTS order_items (
      id SERIAL PRIMARY KEY,
      order_id INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
      product_id TEXT NOT NULL,
      product_name VARCHAR(255) NOT NULL,
      vendor_name VARCHAR(255),
      product_image_url VARCHAR(255),
      price NUMERIC(10, 2) NOT NULL,
      quantity INTEGER DEFAULT 1
    );
  `;
    try { await pool.query(queryText); console.log('"order_items" table is ready.'); } catch (err) { console.error('Error creating order_items table', err.stack); }
};
const createAddressesTable = async () => {
    const queryText = `
    CREATE TABLE IF NOT EXISTS addresses (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      name VARCHAR(255) NOT NULL,
      line1 TEXT NOT NULL,
      line2 TEXT,
      city VARCHAR(100) NOT NULL,
      zip VARCHAR(20) NOT NULL,
      mobile VARCHAR(20) NOT NULL,
      is_default BOOLEAN DEFAULT FALSE,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    );
  `;
    try { await pool.query(queryText); console.log('"addresses" table is ready.'); } catch (err) { console.error('Error creating addresses table', err.stack); }
};

const createShopsTable = async () => {
    const queryText = `
    CREATE TABLE IF NOT EXISTS shops (
      id SERIAL PRIMARY KEY,
      shop_name VARCHAR(255) NOT NULL,
      shop_address TEXT NOT NULL,
      logo_url TEXT,
      banner_url TEXT,
      product_quantity_limit INTEGER DEFAULT 100,
      vendor_id VARCHAR(100) UNIQUE NOT NULL,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    );
  `;
    try { await pool.query(queryText); console.log('"shops" table is ready.'); } catch (err) { console.error('Error creating shops table', err.stack); }
};

const createVendorCredentialsTable = async () => {
    const queryText = `
    CREATE TABLE IF NOT EXISTS vendor_credentials (
      id SERIAL PRIMARY KEY,
      vendor_id VARCHAR(100) UNIQUE NOT NULL REFERENCES shops(vendor_id) ON DELETE CASCADE,
      password VARCHAR(255) NOT NULL,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    );
  `;
    try { await pool.query(queryText); console.log('"vendor_credentials" table is ready.'); } catch (err) { console.error('Error creating vendor_credentials table', err.stack); }
};

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('public')); // Serve static files from 'public' directory

// --- DATABASE MIGRATIONS ---
const performMigrations = async () => {
    try {
        // Add mobile_number column if not exists
        await pool.query(`
            DO $$ 
            BEGIN 
                IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name='mobile_number') THEN 
                    ALTER TABLE users ADD COLUMN mobile_number VARCHAR(15) UNIQUE; 
                END IF;
                IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name='first_name') THEN 
                    ALTER TABLE users ADD COLUMN first_name VARCHAR(255); 
                END IF;
                IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name='last_name') THEN 
                    ALTER TABLE users ADD COLUMN last_name VARCHAR(255); 
                END IF;
                IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name='title') THEN 
                    ALTER TABLE users ADD COLUMN title VARCHAR(50); 
                END IF;
                IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name='dob') THEN 
                    ALTER TABLE users ADD COLUMN dob VARCHAR(50); 
                END IF;
                IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name='gender') THEN 
                    ALTER TABLE users ADD COLUMN gender VARCHAR(50); 
                END IF;
            END $$;
        `);
        // Make email/password nullable if we are shifting to Mobile-first (Optional step, keeping simple for now)
        // For now, we will handle 'complete-profile' by updating or inserting.
        console.log("Database migrations checked/performed.");
    } catch (err) {
        console.error("Migration error:", err.message);
    }
};

// --- MOCK DATABASE (Using Local Asset Paths) ---
const liveGoldRate = { "metal": "Gold", "purity": "24K", "rate_per_gram": 6540.00, "timestamp": new Date().toISOString(), "source": "IBJA" };

const highQualityProducts = [
    { "id": "p1", "vendorName": "Tanishq", "name": "Teardrop Diamond Pendant", "price": 32000.0, "imageUrl": "assets/images/Teardrop Shaped Yellow Gold and Diamond Pendant1.1.jpg", "metal": "Diamond", "description": "Daily Wear Gold and Diamond Studded Pendant crafted in 18 Karat Yellow Gold.", "purity": "18K Gold", "weightInGrams": 1.138 },
    { "id": "p2", "vendorName": "BlueStone", "name": "Elegant Gold Leaf Pendant", "price": 18000.0, "imageUrl": "assets/images/Elegant Gold Leaf Pendant1.1.jpg", "metal": "Gold", "description": "This exquisite 22 Karat gold pendant is in the shape of a leaf.", "purity": "22K Gold", "weightInGrams": 0.846 },
    { "id": "p3", "vendorName": "Senco Gold", "name": "Starry Elegance Gold Anklet", "price": 29500.0, "imageUrl": "assets/images/Starry Elegance Gold Anklet1.1.jpg", "metal": "Gold", "description": "Shine bright with this 18 Karat yellow gold Anklet, adorned with star and leaf danglers.", "purity": "18K Gold", "weightInGrams": 2.1 },
    { "id": "p4", "vendorName": "CaratLane", "name": "Guardian Edge Diamond Pendant", "price": 85000.0, "imageUrl": "assets/images/Guardian Edge Diamond Pendant For Men1.jpg", "metal": "Diamond", "description": "Step into strength with this 18 Karat yellow gold shield Pendant for men.", "purity": "18K Gold", "weightInGrams": 4.568 },
    { "id": "p5", "vendorName": "Malabar Gold", "name": "Guiding Star Gold Pendant", "price": 58000.0, "imageUrl": "assets/images/Guiding Star Gold Pendant For Men1.jpg", "metal": "Gold", "description": "Bold compass-inspired Pendant in 22 Karat yellow gold.", "purity": "22K Gold", "weightInGrams": 5.404 },
    { "id": "p6", "vendorName": "Tanishq", "name": "Ethnic Gold Maang Tikka", "price": 92000.0, "imageUrl": "assets/images/Maang Tikka1.1.jpg", "metal": "Gold", "description": "Stand out from the crowd with this maang tikka crafted in 22 Karat Yellow Gold.", "purity": "22K Gold", "weightInGrams": 8.476 }
];

const topJewellers = [
    { "id": "store1", "name": "Shri Hari Jewels", "distance": "2.1 km", "rating": 4.8, "isVerified": true, "tags": ["Sponsored", "Gold Specialist"] },
    { "id": "store2", "name": "Tanishq - Vashi", "distance": "3.5 km", "rating": 4.9, "isVerified": true, "tags": ["Top Rated"] },
    { "id": "store3", "name": "CaratLane", "distance": "4.0 km", "rating": 4.7, "isVerified": true, "tags": [] }
];

// --- API ROUTES ---
app.get('/', (req, res) => res.send('Swarna Setu API is running!'));

// --- ADMIN ROUTES ---
app.get('/admin', (req, res) => {
    res.sendFile(__dirname + '/public/admin.html');
});

app.get('/api/admin/users', async (req, res) => {
    try {
        const result = await pool.query("SELECT id, name, email, mobile_number, first_name, last_name, title, dob, gender, created_at FROM users ORDER BY created_at DESC");
        res.json(result.rows);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Failed to fetch users' });
    }
});

app.delete('/api/admin/users/:id', async (req, res) => {
    try {
        const { id } = req.params;
        await pool.query("DELETE FROM users WHERE id = $1", [id]);
        res.json({ message: 'User deleted successfully' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Failed to delete user' });
    }
});

// --- AUTH: NUMBER CHECK ROUTES ---
app.post('/api/auth/check-mobile', async (req, res) => {
    const { mobileNumber } = req.body;
    if (!mobileNumber) return res.status(400).json({ message: "Mobile number is required" });

    try {
        const result = await pool.query("SELECT * FROM users WHERE mobile_number = $1", [mobileNumber]);
        if (result.rows.length > 0) {
            // User exists
            return res.json({ exists: true, user: result.rows[0] });
        } else {
            // User does not exist
            return res.json({ exists: false });
        }
    } catch (err) {
        console.error(err.message);
        res.status(500).json({ message: "Server error checking mobile" });
    }
});

app.post('/api/user/complete-profile', async (req, res) => {
    // This assumes we are creating a new user row or updating a partial one.
    // Inputs: mobileNumber, firstName, lastName, title, dob, gender
    const { mobileNumber, firstName, lastName, title, dob, gender } = req.body;

    if (!mobileNumber || !firstName || !lastName) {
        return res.status(400).json({ message: "Missing required fields" });
    }

    try {
        // Check if exists first (to avoid duplicate key error if called twice)
        const check = await pool.query("SELECT id FROM users WHERE mobile_number = $1", [mobileNumber]);

        let user;
        if (check.rows.length > 0) {
            // Update existing (maybe they backed out halfway?)
            const updateQuery = `
                UPDATE users 
                SET name = $1, first_name = $2, last_name = $3, title = $4, dob = $5, gender = $6, created_at = CURRENT_TIMESTAMP 
                WHERE mobile_number = $7 
                RETURNING *
            `;
            user = await pool.query(updateQuery, [`${firstName} ${lastName}`, firstName, lastName, title, dob, gender, mobileNumber]);
        } else {
            // Insert new
            // Note: Email/Password are NOT NULL in original schema. We might need to dummy them or make them nullable.
            // For now, let's insert a dummy email/password if they are required constraints.
            const dummyEmail = `${mobileNumber}@swarnasetu.com`; // Unique placeholder
            const dummyPass = await bcrypt.hash('otp-login', 10);

            const insertQuery = `
                INSERT INTO users (name, mobile_number, email, password, first_name, last_name, title, dob, gender) 
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) 
                RETURNING *
            `;
            user = await pool.query(insertQuery, [`${firstName} ${lastName}`, mobileNumber, dummyEmail, dummyPass, firstName, lastName, title, dob, gender]);
        }
        res.json({ success: true, user: user.rows[0] });
    } catch (err) {
        console.error(err.message);
        res.status(500).json({ message: "Server error saving profile" });
    }
});

// --- VENDOR AUTH ROUTES ---
app.post('/api/auth/vendor/register', async (req, res) => {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ message: 'Email and password are required.' });
    try {
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);
        const newUser = await pool.query("INSERT INTO vendors (email, password) VALUES ($1, $2) RETURNING id, email", [email, hashedPassword]);
        res.status(201).json({ message: 'Vendor registered successfully', user: newUser.rows[0] });
    } catch (err) {
        console.error(err.message);
        res.status(500).json({ message: 'Server error during registration' });
    }
});
app.post('/api/auth/vendor/login', async (req, res) => {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ message: 'Email and password are required.' });
    try {
        const userQuery = await pool.query("SELECT * FROM vendors WHERE email = $1", [email]);
        if (userQuery.rows.length === 0) return res.status(400).json({ message: 'Invalid credentials.' });
        const user = userQuery.rows[0];
        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) return res.status(400).json({ message: 'Invalid credentials.' });
        const payload = { user: { id: user.id } };
        const secretKey = process.env.JWT_SECRET || 'my-super-secret-key-for-now';
        jwt.sign(payload, secretKey, { expiresIn: '1h' }, (err, token) => {
            if (err) throw err;
            res.json({ token });
        });
    } catch (err) {
        console.error(err.message);
        res.status(500).json({ message: 'Server error during login' });
    }
});

// --- USER AUTH ROUTES ---
app.post('/api/auth/user/register', async (req, res) => {
    const { name, email, password } = req.body;
    if (!name || !email || !password) return res.status(400).json({ message: 'Name, email, and password are required.' });
    try {
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);
        const newUser = await pool.query("INSERT INTO users (name, email, password) VALUES ($1, $2, $3) RETURNING id, name, email", [name, email, hashedPassword]);
        res.status(201).json({ message: 'User registered successfully', user: newUser.rows[0] });
    } catch (err) {
        console.error(err.message);
        if (err.code === '23505') return res.status(400).json({ message: 'An account with this email already exists.' });
        res.status(500).json({ message: 'Server error during registration' });
    }
});
app.post('/api/auth/user/login', async (req, res) => {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ message: 'Email and password are required.' });
    try {
        const userQuery = await pool.query("SELECT * FROM users WHERE email = $1", [email]);
        if (userQuery.rows.length === 0) return res.status(400).json({ message: 'Invalid credentials.' });
        const user = userQuery.rows[0];
        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) return res.status(400).json({ message: 'Invalid credentials.' });
        const payload = { user: { id: user.id } };
        const secretKey = process.env.JWT_SECRET || 'my-super-secret-key-for-now';
        jwt.sign(payload, secretKey, { expiresIn: '7d' }, (err, token) => {
            if (err) throw err;
            res.json({ token, user: { id: user.id, name: user.name, email: user.email } });
        });
    } catch (err) {
        console.error(err.message);
        res.status(500).json({ message: 'Server error during login' });
    }
});

// --- VENDOR PRODUCT ROUTES ---
app.get('/api/vendor/products', async (req, res) => {
    console.log('GET /api/vendor/products - Reading from database...');
    try {
        const allProducts = await pool.query("SELECT id::text, name, price::float, image_url AS \"imageUrl\", in_stock AS \"inStock\" FROM products ORDER BY created_at DESC");
        res.status(200).json(allProducts.rows);
    } catch (err) {
        console.error(err.message);
        res.status(500).json({ message: "Server error fetching products." });
    }
});
app.post('/api/vendor/products', async (req, res) => {
    const { name, description, price, weight, category, purity } = req.body;
    const randomImage = highQualityProducts[Math.floor(Math.random() * highQualityProducts.length)].imageUrl;
    if (!name || !price) return res.status(400).json({ message: "Product name and price are required." });
    try {
        const newProduct = await pool.query("INSERT INTO products (name, description, price, weight_grams, category, purity, image_url, in_stock) VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *", [name, description, price, weight, category, purity, randomImage, true]);
        res.status(201).json({ message: 'Product created successfully', product: newProduct.rows[0] });
    } catch (err) {
        console.error(err.message);
        res.status(500).json({ message: "Server error creating product." });
    }
});
app.put('/api/vendor/products/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { name, description, price, weight, category, purity } = req.body;
        console.log(`PUT /api/vendor/products/${id} - Updating database with data:`, req.body);
        if (!name || !price) return res.status(400).json({ message: "Product name and price are required." });
        const updatedProduct = await pool.query("UPDATE products SET name = $1, description = $2, price = $3, weight_grams = $4, category = $5, purity = $6 WHERE id = $7 RETURNING *", [name, description, price, weight, category, purity, id]);
        if (updatedProduct.rows.length === 0) return res.status(404).json({ message: "Product not found." });
        res.status(200).json({ message: 'Product updated successfully', product: updatedProduct.rows[0] });
    } catch (err) {
        console.error(err.message);
        res.status(500).json({ message: "Server error updating product." });
    }
});

// --- USER APP ROUTES ---
const axios = require('axios'); // Add axios

app.get('/api/gold-rate', async (req, res) => {
    try {
        // Fetch from goldprice.org (Free public endpoint)
        const response = await axios.get('https://data-asg.goldprice.org/dbXRates/INR', {
            headers: { 'User-Agent': 'Mozilla/5.0' } // Fake UA to avoid block
        });

        if (response.data && response.data.items && response.data.items.length > 0) {
            const item = response.data.items[0];
            const xauPrice = item.xauPrice; // Current Live (PM Proxy)
            const xauClose = item.xauClose; // Previous Close (AM Proxy)

            const conversionFactor = 31.1035;

            // Indian Market Calibration
            // International Spot (~12448) vs Indian Retail 24k (~13440)
            // Difference is due to Import Duty (6-15%) + GST (3%) + Logistical Premiums
            // We apply a ~8% calibration to match market leaders like Jar/Groww
            const INDIAN_MARKET_CALIBRATION = 1.08;

            // Calculate Rates
            const pmRate = Math.round((xauPrice / conversionFactor) * INDIAN_MARKET_CALIBRATION);
            const amRate = Math.round((xauClose / conversionFactor) * INDIAN_MARKET_CALIBRATION);

            const liveRate = {
                "metal": "Gold",
                "purity": "24K",
                "rate_per_gram": pmRate,
                "am_rate": amRate,
                "pm_rate": pmRate,
                "timestamp": new Date().toISOString(),
                "source": "International Live Rate (+Duty)"
            };
            console.log(`Rates (Calibrated) -> AM: ₹${amRate}, PM: ₹${pmRate}`);
            return res.status(200).json(liveRate);
        } else {
            throw new Error("Invalid data format from API");
        }
    } catch (error) {
        console.error("Error fetching live gold rate:", error.message);
        // Fallback
        res.status(200).json({
            "metal": "Gold",
            "purity": "24K",
            "rate_per_gram": 6540.00,
            "timestamp": new Date().toISOString(),
            "source": "IBJA (Fallback/Mock)"
        });
    }
});
app.get('/api/trending', (req, res) => {
    const { metal } = req.query;
    if (!metal || metal.toLowerCase() === 'all') return res.status(200).json(highQualityProducts);
    const filteredProducts = highQualityProducts.filter(p => p.metal.toLowerCase() === metal.toLowerCase());
    res.status(200).json(filteredProducts);
});
app.get('/api/top-jewellers', (req, res) => {
    const { lat, lon, radius } = req.query;
    console.log(`GET /api/top-jewellers - Request received for lat: ${lat}, lon: ${lon}, radius: ${radius}km`);
    res.status(200).json(topJewellers);
});
app.get('/api/products/featured', (req, res) => {
    console.log('GET /api/products/featured - Request received');
    res.status(200).json(highQualityProducts);
});

// GET a single product by its ID
app.get('/api/products/:id', (req, res) => {
    const { id } = req.params;
    console.log(`GET /api/products/${id} - Request received`);
    const product = highQualityProducts.find(p => p.id === id);
    if (product) {
        res.status(200).json(product);
    } else {
        res.status(404).json({ message: "Product not found." });
    }
});

// --- ADDRESS ROUTES ---
app.get('/api/addresses/:userId', async (req, res) => {
    const { userId } = req.params;
    try {
        const result = await pool.query("SELECT * FROM addresses WHERE user_id = $1 ORDER BY is_default DESC, created_at DESC", [userId]);
        res.json(result.rows);
    } catch (err) {
        console.error(err.message);
        res.status(500).json({ message: "Server error fetching addresses." });
    }
});

app.post('/api/addresses', async (req, res) => {
    const { userId, name, line1, line2, city, zip, mobile, isDefault } = req.body;
    if (!userId || !name || !line1 || !city || !zip || !mobile) {
        return res.status(400).json({ message: "Missing required address fields." });
    }
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        // If set as default, unset others
        if (isDefault) {
            await client.query("UPDATE addresses SET is_default = FALSE WHERE user_id = $1", [userId]);
        }

        const insertQuery = `
            INSERT INTO addresses (user_id, name, line1, line2, city, zip, mobile, is_default)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
            RETURNING *
        `;
        const result = await client.query(insertQuery, [userId, name, line1, line2, city, zip, mobile, isDefault || false]);

        await client.query('COMMIT');
        res.status(201).json(result.rows[0]);
    } catch (err) {
        await client.query('ROLLBACK');
        console.error(err.message);
        res.status(500).json({ message: "Server error saving address." });
    } finally {
        client.release();
    }
});

app.delete('/api/addresses/:id', async (req, res) => {
    const { id } = req.params;
    try {
        await pool.query("DELETE FROM addresses WHERE id = $1", [id]);
        res.json({ message: "Address deleted successfully" });
    } catch (err) {
        console.error(err.message);
        res.status(500).json({ message: "Server error deleting address." });
    }
});

// --- BAG / CART ROUTES ---
app.get('/api/bag/:userId', async (req, res) => {
    const { userId } = req.params;
    console.log(`GET /api/bag for user: ${userId}`);
    try {
        const bagItems = await pool.query("SELECT * FROM bag_items WHERE user_id = $1 ORDER BY added_at DESC", [userId]);
        res.status(200).json(bagItems.rows);
    } catch (err) {
        console.error(err.message);
        res.status(500).json({ message: "Server error fetching bag items." });
    }
});
app.post('/api/bag', async (req, res) => {
    const { userId, productId, productName, productImageUrl, vendorName, price } = req.body;
    console.log('POST /api/bag - Adding product to bag:', req.body);
    if (!userId || !productId || !productName || !price) return res.status(400).json({ message: "User, product, name, and price are required." });
    try {
        const newItem = await pool.query("INSERT INTO bag_items (user_id, product_id, product_name, product_image_url, vendor_name, price) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *", [userId, productId, productName, productImageUrl, vendorName, price]);
        res.status(201).json(newItem.rows[0]);
    } catch (err) {
        console.error(err.message);
        res.status(500).json({ message: "Server error adding item to bag." });
    }
});
app.delete('/api/bag/:itemId', async (req, res) => {
    const { itemId } = req.params;
    console.log(`DELETE /api/bag/${itemId}`);
    try {
        const deleteOp = await pool.query("DELETE FROM bag_items WHERE id = $1 RETURNING *", [itemId]);
        if (deleteOp.rowCount === 0) return res.status(404).json({ message: "Item not found in bag." });
        res.status(200).json({ message: "Item removed successfully." });
    } catch (err) {
        console.error(err.message);
        res.status(500).json({ message: "Server error removing item from bag." });
    }
});

// --- ORDER ROUTES ---
app.post('/api/orders', async (req, res) => {
    const { userId, totalAmount, status, fulfillmentMethod, paymentId, deliveryAddress, pickupStore, items } = req.body;

    if (!userId || !totalAmount || !items || items.length === 0) {
        return res.status(400).json({ message: "Missing required order fields." });
    }

    const client = await pool.connect();

    try {
        await client.query('BEGIN');

        // 1. Create Order
        const orderQuery = `
            INSERT INTO orders (user_id, total_amount, status, fulfillment_method, delivery_address, pickup_store, payment_id)
            VALUES ($1, $2, $3, $4, $5, $6, $7)
            RETURNING *
        `;
        const orderValues = [userId, totalAmount, status || 'Confirmed', fulfillmentMethod, deliveryAddress, pickupStore, paymentId];
        const orderResult = await client.query(orderQuery, orderValues);
        const newOrder = orderResult.rows[0];

        // 2. Insert Order Items
        const itemQuery = `
            INSERT INTO order_items (order_id, product_id, product_name, vendor_name, product_image_url, price, quantity)
            VALUES ($1, $2, $3, $4, $5, $6, $7)
        `;
        for (const item of items) {
            await client.query(itemQuery, [
                newOrder.id,
                item.productId,
                item.productName,
                item.vendorName,
                item.imageUrl || item.productImageUrl,
                item.price,
                item.quantity || 1
            ]);
        }

        // 3. Clear User's Bag (Server-side handling)
        await client.query("DELETE FROM bag_items WHERE user_id = $1", [userId]);

        await client.query('COMMIT');

        // Return created order with items (could be optimized, but returning order details is fine)
        res.status(201).json({ success: true, order: newOrder, message: "Order placed successfully" });

    } catch (err) {
        await client.query('ROLLBACK');
        console.error('Order creation error:', err.message);
        res.status(500).json({ message: "Server error creating order." });
    } finally {
        client.release();
    }
});

app.get('/api/orders/user/:userId', async (req, res) => {
    const { userId } = req.params;
    try {
        // Fetch orders
        const ordersResult = await pool.query("SELECT * FROM orders WHERE user_id = $1 ORDER BY created_at DESC", [userId]);
        const orders = ordersResult.rows;

        // Fetch items for each order
        for (let order of orders) {
            const itemsResult = await pool.query("SELECT * FROM order_items WHERE order_id = $1", [order.id]);
            order.items = itemsResult.rows;
        }

        res.json(orders);
    } catch (err) {
        console.error(err.message);
        res.status(500).json({ message: "Server error fetching orders." });
    }
});

// Start the server
app.listen(PORT, async () => {

// ===== ADMIN SHOP MANAGEMENT APIS =====

// Create new shop
app.post('/api/admin/shops', async (req, res) => {
    try {
        const { shop_name, shop_address, logo_url, banner_url, product_quantity_limit, vendor_id, password } = req.body;
        
        // Hash the password
        const hashedPassword = await bcrypt.hash(password, 10);
        
        // Insert shop
        const shopResult = await pool.query(
            'INSERT INTO shops (shop_name, shop_address, logo_url, banner_url, product_quantity_limit, vendor_id) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *',
            [shop_name, shop_address, logo_url, banner_url, product_quantity_limit, vendor_id]
        );
        
        // Insert vendor credentials
        await pool.query(
            'INSERT INTO vendor_credentials (vendor_id, password) VALUES ($1, $2)',
            [vendor_id, hashedPassword]
        );
        
        res.status(201).json({ success: true, shop: shopResult.rows[0] });
    } catch (error) {
        console.error('Error creating shop:', error);
        res.status(500).json({ error: 'Failed to create shop', details: error.message });
    }
});

// Get all shops
app.get('/api/admin/shops', async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM shops ORDER BY created_at DESC');
        res.json({ success: true, shops: result.rows });
    } catch (error) {
        console.error('Error fetching shops:', error);
        res.status(500).json({ error: 'Failed to fetch shops' });
    }
});

// Get shop by ID
app.get('/api/admin/shops/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const result = await pool.query('SELECT * FROM shops WHERE id = $1', [id]);
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Shop not found' });
        }
        res.json({ success: true, shop: result.rows[0] });
    } catch (error) {
        console.error('Error fetching shop:', error);
        res.status(500).json({ error: 'Failed to fetch shop' });
    }
});

// ===== VENDOR AUTHENTICATION APIS =====

// Vendor login
app.post('/api/vendor/login', async (req, res) => {
    try {
        const { vendor_id, password } = req.body;
        
        // Get vendor credentials
        const credResult = await pool.query(
            'SELECT * FROM vendor_credentials WHERE vendor_id = $1',
            [vendor_id]
        );
        
        if (credResult.rows.length === 0) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }
        
        // Verify password
        const isValid = await bcrypt.compare(password, credResult.rows[0].password);
        if (!isValid) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }
        
        // Get shop details
        const shopResult = await pool.query(
            'SELECT * FROM shops WHERE vendor_id = $1',
            [vendor_id]
        );
        
        // Generate token (simple version, in production use proper JWT)
        const token = jwt.sign({ vendor_id, shop_id: shopResult.rows[0].id }, 'your-secret-key', { expiresIn: '7d' });
        
        res.json({ 
            success: true, 
            token,
            shop: shopResult.rows[0]
        });
    } catch (error) {
        console.error('Error during vendor login:', error);
        res.status(500).json({ error: 'Login failed' });
    }
});

// Get vendor shop details
app.get('/api/vendor/shop/:vendorId', async (req, res) => {
    try {
        const { vendorId } = req.params;
        const result = await pool.query('SELECT * FROM shops WHERE vendor_id = $1', [vendorId]);
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Shop not found' });
        }
        res.json({ success: true, shop: result.rows[0] });
    } catch (error) {
        console.error('Error fetching vendor shop:', error);
        res.status(500).json({ error: 'Failed to fetch shop' });
    }
});
    console.log(`Server is running on port ${PORT}`);
    await createVendorsTable();
    await createUsersTable();
    await createProductsTable();
    await createBagItemsTable();
    await createOrdersTable();
    await createOrderItemsTable();
    await createAddressesTable();
    await createShopsTable();
    await createVendorCredentialsTable();    await performMigrations(); // Run migrations specifically for mobile_number
    await createProductsTableForVendor();    console.log('Registered routes:', JSON.stringify(listEndpoints(app), null, 2));
});