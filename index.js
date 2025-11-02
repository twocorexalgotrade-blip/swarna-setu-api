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
    rejectUnauthorized: false // Required for Render's PostgreSQL connections
  }
});

// --- TABLE CREATION ON STARTUP ---

// Function to create VENDORS table
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

// Function to create USERS table
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

// NEW: Function to create PRODUCTS table
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
      -- In a real multi-vendor app, you would add a vendor_id column:
      -- vendor_id INTEGER REFERENCES vendors(id)
    );
  `;
  try {
    await pool.query(queryText);
    console.log('"products" table is ready.');
  } catch (err) {
    console.error('Error creating products table', err.stack);
  }
};

// Middleware
app.use(cors());
app.use(express.json());

// --- MOCK DATABASE (FOR USER APP'S FEATURED PRODUCTS ONLY) ---
const featuredProducts = [
    {
        "id": "p1", "name": "Solitaire Sparkle Ring", "vendorName": "Aura Jewels",
        "price": 95500.0, "imageUrl": "https://placehold.co/300x300/png?text=Ring",
        "description": "A stunning ring.", "purity": "18K Gold", "weightInGrams": 4.5
    },
    {
        "id": "p2", "name": "Heritage Gold Necklace", "vendorName": "BlueStone",
        "price": 240000.0, "imageUrl": "https://placehold.co/300x300/png?text=Necklace",
        "description": "A heritage necklace.", "purity": "22K Gold", "weightInGrams": 20.0
    },
    {
        "id": "p3", "name": "Classic Pearl Studs", "vendorName": "CaratLane",
        "price": 45000.0, "imageUrl": "https://placehold.co/300x300/png?text=Earrings",
        "description": "Elegant pearl studs.", "purity": "14K Gold", "weightInGrams": 3.0
    }
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

// --- PRODUCT ROUTES ---

// GET featured products for User App
app.get('/api/products/featured', (req, res) => {
    console.log('GET /api/products/featured - Request received');
    res.status(200).json(featuredProducts);
});

// GET all products for a Vendor (READ from database)
app.get('/api/vendor/products', async (req, res) => {
    console.log('GET /api/vendor/products - Reading from database...');
    try {
        // We now select the specific columns our Flutter model expects
        const allProducts = await pool.query(
            "SELECT id::text, name, price::float, image_url AS \"imageUrl\", in_stock AS \"inStock\" FROM products ORDER BY created_at DESC"
        );
        res.status(200).json(allProducts.rows);
    } catch (err) {
        console.error(err.message);
        res.status(500).json({ message: "Server error fetching products." });
    }
});

// POST a new product for a Vendor (WRITE to database)
app.post('/api/vendor/products', async (req, res) => {
    const { name, description, price, weight, category, purity } = req.body;
    
    console.log('POST /api/vendor/products - Writing to database with data:', req.body);

    if (!name || !price) {
        return res.status(400).json({ message: "Product name and price are required." });
    }

    try {
        const newProduct = await pool.query(
            "INSERT INTO products (name, description, price, weight_grams, category, purity, image_url) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *",
            [name, description, price, weight, category, purity, 'https://placehold.co/100x100/png?text=New']
        );

        res.status(201).json({ message: 'Product created successfully', product: newProduct.rows[0] });
    } catch (err) {
        console.error(err.message);
        res.status(500).json({ message: "Server error creating product." });
    }
});


// Start the server
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
  // When the server starts, ensure ALL tables exist
  createVendorsTable();
  createUsersTable();
  createProductsTable();
  console.log('Registered routes:', JSON.stringify(listEndpoints(app), null, 2));
});