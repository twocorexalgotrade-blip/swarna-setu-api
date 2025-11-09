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
  try {
    await pool.query(queryText);
    console.log('"vendors" table is ready.');
  } catch (err) {
    console.error('Error creating vendors table', err.stack);
  }
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
  try {
    await pool.query(queryText);
    console.log('"users" table is ready.');
  } catch (err) {
    console.error('Error creating users table', err.stack);
  }
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
  try {
    await pool.query(queryText);
    console.log('"products" table is ready.');
  } catch (err) {
    console.error('Error creating products table', err.stack);
  }
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
  try {
    await pool.query(queryText);
    console.log('"bag_items" table is ready.');
  } catch (err) {
    console.error('Error creating bag_items table', err.stack);
  }
};

// Middleware
app.use(cors());
app.use(express.json());

// --- MOCK DATABASE (UPDATED WITH VERIFIED STOCK PHOTOS) ---

const liveGoldRate = { "metal": "Gold", "purity": "24K", "rate_per_gram": 6540.00, "timestamp": new Date().toISOString(), "source": "IBJA" };

const highQualityProducts = [
    { 
        "id": "p1", "vendorName": "Tanishq", "name": "Elegant Diamond Solitaire", "price": 115500.0, 
        "imageUrl": "https://images.pexels.com/photos/1458869/pexels-photo-1458869.jpeg?auto=compress&cs=tinysrgb&w=800", 
        "metal": "Diamond", "description": "A classic 1-carat solitaire diamond ring set in a timeless platinum band.", 
        "purity": "Platinum 950", "weightInGrams": 5.2 
    },
    { 
        "id": "p2", "vendorName": "BlueStone", "name": "Royal Antique Necklace", "price": 280000.0, 
        "imageUrl": "https://images.pexels.com/photos/10983777/pexels-photo-10983777.jpeg?auto=compress&cs=tinysrgb&w=800", 
        "metal": "Gold", "description": "An intricate heritage necklace handcrafted in 22K pure gold, inspired by temple architecture.", 
        "purity": "22K Gold", "weightInGrams": 25.0 
    },
    { 
        "id": "p3", "vendorName": "Senco Gold", "name": "Traditional Gold Jhumkas", "price": 62000.0, 
        "imageUrl": "https://images.pexels.com/photos/14133418/pexels-photo-14133418.jpeg?auto=compress&cs=tinysrgb&w=800", 
        "metal": "Gold", "description": "Beautifully handcrafted 22K gold jhumka earrings with delicate filigree work.", 
        "purity": "22K Gold", "weightInGrams": 8.5 
    },
    { 
        "id": "p4", "vendorName": "Giva", "name": "Minimalist Silver Bracelet", "price": 7500.0, 
        "imageUrl": "https://images.pexels.com/photos/965990/pexels-photo-965990.jpeg?auto=compress&cs=tinysrgb&w=800", 
        "metal": "Silver", "description": "A sleek and modern sterling silver bracelet, perfect for everyday wear.", 
        "purity": "925 Silver", "weightInGrams": 12.0 
    },
    { 
        "id": "p5", "vendorName": "CaratLane", "name": "Geometric Platinum Band", "price": 71000.0, 
        "imageUrl": "https://images.pexels.com/photos/265906/pexels-photo-265906.jpeg?auto=compress&cs=tinysrgb&w=800", 
        "metal": "Platinum", "description": "A contemporary platinum band with a unique geometric design.", 
        "purity": "Pt 950", "weightInGrams": 9.0 
    }
];

const topJewellers = [
    { "id": "store1", "name": "Shri Hari Jewels", "distance": "2.1 km", "rating": 4.8, "isVerified": true, "tags": ["Sponsored", "Gold Specialist"] },
    { "id": "store2", "name": "Tanishq - Vashi", "distance": "3.5 km", "rating": 4.9, "isVerified": true, "tags": ["Top Rated"] },
    { "id": "store3", "name": "Giva Silver", "distance": "4.0 km", "rating": 4.5, "isVerified": false, "tags": ["Silver Only"] }
];


// --- API ROUTES ---
app.get('/', (req, res) => res.send('Swarna Setu API is running!'));

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

// --- USER APP HOME PAGE ROUTES ---
app.get('/api/gold-rate', (req, res) => { res.status(200).json(liveGoldRate); });
app.get('/api/trending', (req, res) => {
    const { metal } = req.query;
    if (!metal || metal.toLowerCase() === 'all') {
        return res.status(200).json(highQualityProducts);
    }
    const filteredProducts = highQualityProducts.filter(p => p.metal.toLowerCase() === metal.toLowerCase());
    res.status(200).json(filteredProducts);
});
app.get('/api/top-jewellers', (req, res) => { res.status(200).json(topJewellers); });
app.get('/api/products/featured', (req, res) => {
    console.log('GET /api/products/featured - Request received');
    res.status(200).json(highQualityProducts);
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
        const newItem = await pool.query(
            "INSERT INTO bag_items (user_id, product_id, product_name, product_image_url, vendor_name, price) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *",
            [userId, productId, productName, productImageUrl, vendorName, price]
        );
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

// Start the server
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
  createVendorsTable();
  createUsersTable();
  createProductsTable();
  createBagItemsTable();
  console.log('Registered routes:', JSON.stringify(listEndpoints(app), null, 2));
});