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

// NEW: Function to create USERS table
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

// --- (Keep your Mock Database for products for now) ---
// ... (featuredProducts and vendorProducts arrays remain here) ...
let vendorProducts = [
    {"id": "v1", "name": "Classic 22K Gold Bangle", "price": 125000.0, "imageUrl": "https://placehold.co/100x100/png?text=Bangle", "inStock": true},
    //...
];
const featuredProducts = [
    {"id": "p1", "name": "Solitaire Sparkle Ring", "price": 95500.0, "imageUrl": "https://placehold.co/300x300/png?text=Ring"},
    //...
];


// --- API ROUTES ---
app.get('/', (req, res) => res.send('Swarna Setu API is running!'));

// --- VENDOR AUTH ROUTES ---
app.post('/api/auth/vendor/register', async (req, res) => { /* ... existing code ... */ });
app.post('/api/auth/vendor/login', async (req, res) => { /* ... existing code ... */ });

// --- NEW: USER AUTH ROUTES ---

// POST /api/auth/user/register
app.post('/api/auth/user/register', async (req, res) => {
  const { name, email, password } = req.body;

  if (!name || !email || !password) {
    return res.status(400).json({ message: 'Name, email, and password are required.' });
  }

  try {
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    const newUser = await pool.query(
      "INSERT INTO users (name, email, password) VALUES ($1, $2, $3) RETURNING id, name, email",
      [name, email, hashedPassword]
    );

    res.status(201).json({ message: 'User registered successfully', user: newUser.rows[0] });
  } catch (err) {
    console.error(err.message);
    if (err.code === '23505') { // Handle unique constraint violation (email already exists)
        return res.status(400).json({ message: 'An account with this email already exists.' });
    }
    res.status(500).json({ message: 'Server error during registration' });
  }
});

// POST /api/auth/user/login
app.post('/api/auth/user/login', async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ message: 'Email and password are required.' });
  }

  try {
    const userQuery = await pool.query("SELECT * FROM users WHERE email = $1", [email]);

    if (userQuery.rows.length === 0) {
      return res.status(400).json({ message: 'Invalid credentials.' });
    }

    const user = userQuery.rows[0];
    const isMatch = await bcrypt.compare(password, user.password);

    if (!isMatch) {
      return res.status(400).json({ message: 'Invalid credentials.' });
    }

    const payload = { user: { id: user.id } };
    const secretKey = process.env.JWT_SECRET || 'my-super-secret-key-for-now';

    jwt.sign(payload, secretKey, { expiresIn: '7d' }, (err, token) => { // Longer expiry for users
      if (err) throw err;
      res.json({ token, user: { id: user.id, name: user.name, email: user.email } });
    });

  } catch (err) {
    console.error(err.message);
    res.status(500).json({ message: 'Server error during login' });
  }
});


// --- PRODUCT ROUTES --- (Keep these as they are)
app.get('/api/products/featured', (req, res) => { res.status(200).json(featuredProducts); });
app.get('/api/vendor/products', (req, res) => { res.status(200).json(vendorProducts); });
app.post('/api/vendor/products', (req, res) => { /* ... existing code ... */ });

// Start the server
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
  // When the server starts, ensure BOTH tables exist
  createVendorsTable();
  createUsersTable();
  console.log('Registered routes:', JSON.stringify(listEndpoints(app), null, 2));
});