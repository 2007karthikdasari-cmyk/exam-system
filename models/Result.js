const pool = require('../config/database');

class Result {
    static async create(userId, examId, startedAt) {
        const query = 'INSERT INTO results (user_id, exam_id, started_at, status) VALUES ($1, $2, $3, $4) RETURNING *';
        const values = [userId, examId, startedAt, 'in-progress'];
        const result = await pool.query(query, values);
        return result.rows[0];
    }

    static async saveAnswer(userId, examId, questionId, selectedAnswer, isCorrect) {
        const query = `INSERT INTO user_answers (user_id, exam_id, question_id, selected_answer, is_correct) 
                       VALUES ($1, $2, $3, $4, $5)`;
        const values = [userId, examId, questionId, selectedAnswer, isCorrect];
        await pool.query(query, values);
    }

    static async submitExam(userId, examId, score, totalMarks, percentage, status) {
        const query = `UPDATE results SET score = $1, total_marks = $2, percentage = $3, status = $4, submitted_at = CURRENT_TIMESTAMP 
                       WHERE user_id = $5 AND exam_id = $6 AND status = 'in-progress' RETURNING *`;
        const values = [score, totalMarks, percentage, status, userId, examId];
        const result = await pool.query(query, values);
        return result.rows[0];
    }

    static async getUserResult(userId, examId) {
        const query = `SELECT r.*, e.title, e.duration 
                       FROM results r 
                       JOIN exams e ON r.exam_id = e.id 
                       WHERE r.user_id = $1 AND r.exam_id = $2 
                       ORDER BY r.created_at DESC LIMIT 1`;
        const result = await pool.query(query, [userId, examId]);
        return result.rows[0];
    }

    static async getExamAnalysis(examId) {
        const query = `
            SELECT 
                COUNT(DISTINCT user_id) as total_students,
                COUNT(CASE WHEN status = 'completed' THEN 1 END) as completed,
                AVG(percentage) as avg_percentage,
                MAX(percentage) as highest_score,
                MIN(percentage) as lowest_score
            FROM results 
            WHERE exam_id = $1 AND status != 'in-progress'
        `;
        const result = await pool.query(query, [examId]);
        return result.rows[0];
    }

    static async getQuestionWiseAnalysis(examId) {
        const query = `
            SELECT 
                q.id,
                q.question_text,
                COUNT(ua.id) as total_attempts,
                SUM(CASE WHEN ua.is_correct THEN 1 ELSE 0 END) as correct_answers,
                ROUND(SUM(CASE WHEN ua.is_correct THEN 1 ELSE 0 END)::DECIMAL / COUNT(ua.id) * 100, 2) as correct_percentage
            FROM questions q
            LEFT JOIN user_answers ua ON q.id = ua.question_id
            WHERE q.exam_id = $1
            GROUP BY q.id
            ORDER BY q.id
        `;
        const result = await pool.query(query, [examId]);
        return result.rows;
    }

    static async getAllUserAnswers(examId) {
        const query = `
            SELECT u.name, u.email, ua.*, q.question_text, q.correct_answer
            FROM user_answers ua
            JOIN users u ON ua.user_id = u.id
            JOIN questions q ON ua.question_id = q.id
            WHERE ua.exam_id = $1
            ORDER BY u.name, ua.question_id
        `;
        const result = await pool.query(query, [examId]);
        return result.rows;
    }
}

module.exports = Result;