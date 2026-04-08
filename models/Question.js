const pool = require('../config/database');

class Question {
    static async create(examId, questionText, options, correctAnswer, marks) {
        const query = `INSERT INTO questions (exam_id, question_text, option_a, option_b, option_c, option_d, correct_answer, marks) 
                       VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`;
        const values = [examId, questionText, options.A, options.B, options.C, options.D, correctAnswer, marks];
        const result = await pool.query(query, values);
        return result.rows[0];
    }

    static async getByExamId(examId) {
        const query = 'SELECT * FROM questions WHERE exam_id = $1 ORDER BY id';
        const result = await pool.query(query, [examId]);
        return result.rows;
    }

    static async getRandomizedQuestions(examId) {
        const query = 'SELECT * FROM questions WHERE exam_id = $1';
        const result = await pool.query(query, [examId]);
        // Fisher-Yates Shuffle Algorithm for randomization
        const questions = result.rows;
        for (let i = questions.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [questions[i], questions[j]] = [questions[j], questions[i]];
        }
        return questions;
    }

    static async deleteByExamId(examId) {
        const query = 'DELETE FROM questions WHERE exam_id = $1';
        await pool.query(query, [examId]);
    }
}

module.exports = Question;