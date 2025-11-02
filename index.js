const express = require('express');
const cors = require('cors');
const { Pool } = require('pg'); // PostgreSQL client
const bcrypt = require('bcryptjs'); // Password hashing
const jwt = require('jsonwebtoken'); // JSON Web Tokens

const app = express();
const PORT = process.env.PORT || 3000;

// --- DATABASE CONNECTION ---
// The connection string is read from the DATABASE_URL environment variable we set on Render.
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false // Required for Render's PostgreSQL connections
  }
});

// Function to create the users table if it doesn't exist
const createUsersTable = async () => {
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

// Middleware
app.use(cors());
app.use(express.json());


// --- (Keep your Mock Database for products for now) ---
let vendorProducts = [
    {"id": "v1", "name": "Classic 22K Gold Bangle", "price": 125000.0, "imageUrl": "https://placehold.co/100x100/png?text=Bangle", "inStock": true},
    // ... other mock products
];


// --- API ROUTES ---

app.get('/', (req, res) => res.send('Swarna Setu API is running!'));

// --- AUTH ROUTES ---

// POST /api/auth/register (For Vendor App)
app.post('/api/auth/register', async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ message: 'Email and password are required.' });
  }

  try {
    // Hash the password before saving it
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    const newUser = await pool.query(
      "INSERT INTO vendors (email, password) VALUES ($1, $2) RETURNING id, email",
      [email, hashedPassword]
    );

    res.status(201).json({ message: 'Vendor registered successfully', user: newUser.rows[0] });
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ message: 'Server error during registration' });
  }
});

// POST /api/auth/login (For Vendor App)
app.post('/api/auth/login', async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ message: 'Email and password are required.' });
  }

  try {
    const userQuery = await pool.query("SELECT * FROM vendors WHERE email = $1", [email]);

    if (userQuery.rows.length === 0) {
      return res.status(400).json({ message: 'Invalid credentials.' });
    }

    const user = userQuery.rows[0];

    const isMatch = await bcrypt.compare(password, user.password);

    if (!isMatch) {
      return res.status(400).json({ message: 'Invalid credentials.' });
    }

    // User is authenticated, create a JWT token
    const payload = { user: { id: user.id } };
    
    // In production, use a strong, secret key stored in environment variables
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


// --- VENDOR PRODUCT ROUTES --- (Keep these as they are)
app.get('/api/vendor/products', (req, res) => {
    res.status(200).json(vendorProducts);
});
app.post('/api/vendor/products', (req, res) => {
    const newProduct = req.body;
    const productToAdd = { id: `v${Math.random()}`, ...newProduct, inStock: true };
    vendorProducts.push(productToAdd);
    res.status(201).json({ message: 'Product created', product: productToAdd });
});


// Start the server
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
  // When the server starts, ensure the user table exists
  createUsersTable();
});