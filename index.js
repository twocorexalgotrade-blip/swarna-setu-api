const express = require('express');
const cors = require('cors');
const listEndpoints = require('express-list-endpoints'); // Dependency to list all routes

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors()); // Allow requests from any origin
app.use(express.json()); // Allow the server to parse JSON in request bodies

// --- MOCK DATABASE ---
// In a real app, this data would come from a database like PostgreSQL or MongoDB.
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

const vendorProducts = [
    {"id": "v1", "name": "Classic 22K Gold Bangle", "price": 125000.0, "imageUrl": "https://placehold.co/100x100/png?text=Bangle", "inStock": true},
    {"id": "v2", "name": "Antique Temple Necklace Set", "price": 340000.0, "imageUrl": "https://placehold.co/100x100/png?text=Necklace", "inStock": true},
    {"id": "v3", "name": "Solitaire Diamond Studs (1 Carat)", "price": 210000.0, "imageUrl": "https://placehold.co/100x100/png?text=Studs", "inStock": false},
    {"id": "v4", "name": "Modern Platinum Bracelet", "price": 85000.0, "imageUrl": "https://placehold.co/100x100/png?text=Bracelet", "inStock": true}
];

// --- API ROUTES ---

// Health check route
app.get('/', (req, res) => {
    res.send('Swarna Setu API is running!');
});

// USER APP ROUTES
// Route to get featured products for the user app home screen
app.get('/api/products/featured', (req, res) => {
    console.log('GET /api/products/featured - Request received');
    setTimeout(() => {
        res.status(200).json(featuredProducts);
    }, 500);
});

// VENDOR APP ROUTES
// Route to get all products for a specific vendor
app.get('/api/vendor/products', (req, res) => {
    console.log('GET /api/vendor/products - Request received');
    setTimeout(() => {
        res.status(200).json(vendorProducts);
    }, 500);
});

// CANARY/TEST ROUTE FOR DEBUGGING DEPLOYMENTS
app.get('/api/test', (req, res) => {
    console.log('GET /api/test - Canary route was hit!');
    res.status(200).send('Test route is working!');
});


// Start the server and print all registered routes
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
    // This will print a JSON array of all routes to the Render logs.
    console.log('Registered routes:', JSON.stringify(listEndpoints(app), null, 2));
});