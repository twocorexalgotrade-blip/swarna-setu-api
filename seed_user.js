const { Pool } = require('pg');
const bcrypt = require('bcryptjs');

const pool = new Pool({
    connectionString: process.env.DATABASE_URL || 'postgres://localhost:5432/swarnasetu',
    ssl: false
});

const seedUser = async () => {
    const mobileNumber = '9876543210';
    const email = 'testuser@swarnasetu.com';
    const password = 'password123';
    const name = 'Test User';
    const firstName = 'Test';
    const lastName = 'User';
    const title = 'Mr';
    const gender = 'Male';
    const dob = '1990-01-01';

    try {
        // Check if user exists
        const check = await pool.query("SELECT * FROM users WHERE mobile_number = $1", [mobileNumber]);
        if (check.rows.length > 0) {
            console.log('User already exists:', check.rows[0]);
            process.exit(0);
        }

        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);

        const query = `
            INSERT INTO users (name, email, password, mobile_number, first_name, last_name, title, gender, dob)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
            RETURNING *
        `;
        const values = [name, email, hashedPassword, mobileNumber, firstName, lastName, title, gender, dob];

        const res = await pool.query(query, values);
        console.log('User seeded successfully:', res.rows[0]);
    } catch (err) {
        console.error('Error seeding user:', err);
    } finally {
        pool.end();
    }
};

seedUser();
