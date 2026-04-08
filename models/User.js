const pool = require('../config/database');
const bcrypt = require('bcryptjs');

class User {
    static async create(name, email, password) {
        const hashedPassword = await bcrypt.hash(password, 10);
        const query = 'INSERT INTO users (name, email, password) VALUES ($1, $2, $3) RETURNING *';
        const values = [name, email, hashedPassword];
        const result = await pool.query(query, values);
        return result.rows[0];
    }

    static async findByEmail(email) {
        const query = 'SELECT * FROM users WHERE email = $1';
        const result = await pool.query(query, [email]);
        return result.rows[0];
    }

    static async findById(id) {
        const query = 'SELECT id, name, email, created_at, last_login FROM users WHERE id = $1';
        const result = await pool.query(query, [id]);
        return result.rows[0];
    }

    static async updatePassword(email, password) {
        const hashedPassword = await bcrypt.hash(password, 10);
        const query = 'UPDATE users SET password = $1 WHERE email = $2 RETURNING *';
        const result = await pool.query(query, [hashedPassword, email]);
        return result.rows[0];
    }

    static async updateLastLogin(id) {
        const query = 'UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE id = $1';
        await pool.query(query, [id]);
    }

    static async getAllUsers() {
        const query = 'SELECT id, name, email, is_active, created_at, last_login FROM users ORDER BY created_at DESC';
        const result = await pool.query(query);
        return result.rows;
    }

    static async verifyPassword(plainPassword, hashedPassword) {
        return await bcrypt.compare(plainPassword, hashedPassword);
    }
}

module.exports = User;