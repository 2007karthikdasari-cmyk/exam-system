const pool = require('../config/database');
const bcrypt = require('bcryptjs');

class Admin {
    static async findByEmail(email) {
        const query = 'SELECT * FROM admins WHERE email = $1 AND is_active = true';
        const result = await pool.query(query, [email]);
        return result.rows[0];
    }

    static async findById(id) {
        const query = 'SELECT id, name, email, created_at, last_login FROM admins WHERE id = $1';
        const result = await pool.query(query, [id]);
        return result.rows[0];
    }

    static async updateLastLogin(id) {
        const query = 'UPDATE admins SET last_login = CURRENT_TIMESTAMP WHERE id = $1';
        await pool.query(query, [id]);
    }

    static async verifyPassword(plainPassword, hashedPassword) {
        return await bcrypt.compare(plainPassword, hashedPassword);
    }
}

module.exports = Admin;