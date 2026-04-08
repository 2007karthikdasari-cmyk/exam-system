const bcrypt = require('bcryptjs');
const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
});

async function setAdminPassword() {
    try {
        const hashedPassword = await bcrypt.hash('10KarthiK@eya112007', 10);

        // Check if admin exists
        const checkAdmin = await pool.query('SELECT * FROM admins WHERE email = $1', ['2007karthikdasari@gmail.com']);

        if (checkAdmin.rows.length > 0) {
            // Update existing admin
            await pool.query(
                'UPDATE admins SET password = $1 WHERE email = $2',
                [hashedPassword, '2007karthikdasari@gmail.com']
            );
            console.log('✅ Admin password updated successfully!');
        } else {
            // Create new admin
            await pool.query(
                'INSERT INTO admins (name, email, password) VALUES ($1, $2, $3)',
                ['Karthikeya', '2007karthikdasari@gmail.com', hashedPassword]
            );
            console.log('✅ Admin created successfully!');
        }

        console.log('\n📝 Admin Credentials:');
        console.log('   Email: 2007karthikdasari@gmail.com');
        console.log('   Password: 10KarthiK@eya112007');

        process.exit(0);
    } catch (error) {
        console.error('Error:', error);
        process.exit(1);
    }
}

setAdminPassword();