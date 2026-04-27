# Swarna Setu API - Backend Server

Node.js backend API for the Auramika jewelry e-commerce platform.

## Features
- Vendor management
- Product catalog
- User authentication
- Shopping cart
- Order management
- Custom orders
- Address management

## Tech Stack
- Node.js
- Express.js
- SQLite3
- dotenv

## Installation

```bash
npm install
```

## Environment Variables

Create a `.env` file:

```
PORT=3000
```

## Running the Server

```bash
node index.js
```

Server will run on `http://localhost:3000`

## API Endpoints

- `/api/vendor/products/:vendorId` - Get products by vendor
- `/api/products/:id` - Get product by ID
- Additional endpoints in `index.js`
