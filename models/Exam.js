const pool = require('../config/database');

class Exam {
    static async create(title, description, duration, createdBy) {
        const query = 'INSERT INTO exams (title, description, duration, created_by) VALUES ($1, $2, $3, $4) RETURNING *';
        const values = [title, description, duration, createdBy];
        const result = await pool.query(query, values);
        return result.rows[0];
    }

    static async getAll() {
        const query = 'SELECT e.*, COUNT(q.id) as question_count FROM exams e LEFT JOIN questions q ON e.id = q.exam_id GROUP BY e.id ORDER BY e.created_at DESC';
        const result = await pool.query(query);
        return result.rows;
    }

    static async getActiveExams() {
        const query = 'SELECT e.*, COUNT(q.id) as question_count FROM exams e LEFT JOIN questions q ON e.id = q.exam_id WHERE e.is_active = true GROUP BY e.id HAVING COUNT(q.id) > 0 ORDER BY e.created_at DESC';
        const result = await pool.query(query);
        return result.rows;
    }

    static async findById(id) {
        const query = 'SELECT * FROM exams WHERE id = $1';
        const result = await pool.query(query, [id]);
        return result.rows[0];
    }

    static async updateStatus(id, isActive) {
        const query = 'UPDATE exams SET is_active = $1 WHERE id = $2';
        await pool.query(query, [isActive, id]);
    }
}

module.exports = Exam;