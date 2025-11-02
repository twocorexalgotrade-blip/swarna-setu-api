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

// Middleware
app.use(cors());
app.use(express.json());

// --- MOCK DATABASE ---
const featuredProducts = [
    {
        "id": "p1",
        "name": "Solitaire Sparkle Ring",
        "vendorName": "Aura Jewels",
        "price": 95500.0,
        "imageUrl": "https://placehold.co/300x300/png?text=Ring",
        "description": "A stunning ring crafted with a 1-carat brilliant-cut diamond, set in a classic 18K white gold band. A timeless piece for any special occasion.",
        "purity": "18K Gold",
        "weightInGrams": 4.5
    },
    {
        "id": "p2",
        "name": "Heritage Gold Necklace",
        "vendorName": "BlueStone",
        "price": 240000.0,
        "imageUrl": "https://placehold.co/300x300/png?text=Necklace",
        "description": "An exquisite heritage necklace inspired by temple architecture, handcrafted in 22K pure gold. Perfect for weddings and grand celebrations.",
        "purity": "22K Gold",
        "weightInGrams": 20.0
    },
    {
        "id": "p3",
        "name": "Classic Pearl Studs",
        "vendorName": "CaratLane",
        "price": 45000.0,
        "imageUrl": "https://placehold.co/300x300/png?text=Earrings",
        "description": "Elegant and versatile, these classic studs feature lustrous freshwater pearls set in 14K yellow gold. A must-have for every jewellery collection.",
        "purity": "14K Gold",
        "weightInGrams": 3.0
    }
];

let vendorProducts = [
    {"id": "v1", "name": "Classic 22K Gold Bangle", "price": 125000.0, "imageUrl": "https://placehold.co/100x100/png?text=Bangle", "inStock": true},
    {"id": "v2", "name": "Antique Temple Necklace Set", "price": 340000.0, "imageUrl": "https://placehold.co/100x100/png?text=Necklace", "inStock": true},
    {"id": "v3", "name": "Solitaire Diamond Studs (1 Carat)", "price": 210000.0, "imageUrl": "https://placehold.co/100x100/png?text=Studs", "inStock": false},
    {"id": "v4", "name": "Modern Platinum Bracelet", "price": 85000.0, "imageUrl": "https://placehold.co/100x100/png?text=Bracelet", "inStock": true}
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
app.get('/api/products/featured', (req, res) => {
    console.log('GET /api/products/featured - Request received');
    res.status(200).json(featuredProducts);
});

app.get('/api/vendor/products', (req, res) => {
    console.log('GET /api/vendor/products - Request received');
    res.status(200).json(vendorProducts);
});

app.post('/api/vendor/products', (req, res) => {
    const newProduct = req.body;
    console.log('POST /api/vendor/products - Request received with data:', newProduct);
    const productToAdd = { id: `v${Math.floor(Math.random() * 1000)}`, name: newProduct.name || 'Untitled', price: parseFloat(newProduct.price) || 0, imageUrl: 'https://placehold.co/100x100/png?text=New', inStock: true };
    vendorProducts.push(productToAdd);
    res.status(201).json({ message: 'Product created successfully', product: productToAdd });
});

// CANARY/TEST ROUTE
app.get('/api/test', (req, res) => {
    console.log('GET /api/test - Canary route was hit!');
    res.status(200).send('Test route is working!');
});

// Start the server
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
  createVendorsTable();
  createUsersTable();
  console.log('Registered routes:', JSON.stringify(listEndpoints(app), null, 2));
});