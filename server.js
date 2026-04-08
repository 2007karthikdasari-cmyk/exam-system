const express = require('express');
const path = require('path');
const session = require('express-session');
const bcrypt = require('bcryptjs');
const dotenv = require('dotenv');
const pool = require('./config/database');
const { sendEmail } = require('./config/email');

dotenv.config();

const app = express();

// Trust proxy for Render (important for HTTPS)
app.set('trust proxy', 1);

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

// Session configuration - SINGLE configuration for production
app.use(session({
    secret: process.env.SESSION_SECRET || 'your_secret_key',
    resave: false,
    saveUninitialized: false,
    cookie: {
        secure: process.env.NODE_ENV === 'production', // true for HTTPS on Render
        httpOnly: true,
        maxAge: 24 * 60 * 60 * 1000,
        sameSite: 'lax'
    }
}));

// Set view engine
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Make user available to all views
app.use((req, res, next) => {
    res.locals.user = req.session.user;
    next();
});

// ==================== HOME ROUTES ====================

app.get('/', (req, res) => {
    res.render('index', { user: req.session.user });
});

// ==================== AUTH ROUTES ====================

app.get('/user/login', (req, res) => {
    res.render('user-login', { error: null });
});

app.get('/admin/login', (req, res) => {
    res.render('admin-login', { error: null });
});

app.get('/register', (req, res) => {
    res.render('register', { error: null });
});

// User Registration
app.post('/register', async (req, res) => {
    try {
        const { name, email, password, confirmPassword } = req.body;

        if (!name || !email || !password) {
            return res.render('register', { error: 'All fields are required' });
        }

        if (password !== confirmPassword) {
            return res.render('register', { error: 'Passwords do not match' });
        }

        if (password.length < 6) {
            return res.render('register', { error: 'Password must be at least 6 characters' });
        }

        const existingUser = await pool.query('SELECT * FROM users WHERE email = $1', [email]);

        if (existingUser.rows.length > 0) {
            if (!existingUser.rows[0].password) {
                const hashedPassword = await bcrypt.hash(password, 10);
                await pool.query('UPDATE users SET password = $1 WHERE email = $2', [hashedPassword, email]);

                const updatedUser = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
                req.session.user = {
                    id: updatedUser.rows[0].id,
                    name: updatedUser.rows[0].name,
                    email: updatedUser.rows[0].email,
                    role: 'user'
                };

                // Send welcome email
                const welcomeHtml = `
                    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                        <div style="background: linear-gradient(135deg, #1B2F4F, #0F1E33); padding: 20px; text-align: center;">
                            <h2 style="color: #D4AF37;">Welcome to ExamSystem!</h2>
                        </div>
                        <div style="padding: 20px; background: #FFFDD0;">
                            <h3 style="color: #1B2F4F;">Hello ${name},</h3>
                            <p>Your account has been successfully created!</p>
                            <p>You can now take online exams and track your performance.</p>
                            <p>Good luck with your exams!</p>
                        </div>
                    </div>
                `;
                sendEmail(email, 'Welcome to ExamSystem', welcomeHtml).catch(console.error);

                return res.redirect('/user/dashboard');
            }
            return res.render('register', { error: 'Email already registered. Please login.' });
        }

        const hashedPassword = await bcrypt.hash(password, 10);
        const result = await pool.query(
            'INSERT INTO users (name, email, password, is_active) VALUES ($1, $2, $3, $4) RETURNING *',
            [name, email, hashedPassword, true]
        );

        req.session.user = {
            id: result.rows[0].id,
            name: result.rows[0].name,
            email: result.rows[0].email,
            role: 'user'
        };

        const welcomeHtml = `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                <div style="background: linear-gradient(135deg, #1B2F4F, #0F1E33); padding: 20px; text-align: center;">
                    <h2 style="color: #D4AF37;">Welcome to ExamSystem!</h2>
                </div>
                <div style="padding: 20px; background: #FFFDD0;">
                    <h3 style="color: #1B2F4F;">Hello ${name},</h3>
                    <p>Your account has been successfully created!</p>
                    <p>You can now take online exams and track your performance.</p>
                    <p>Good luck with your exams!</p>
                </div>
            </div>
        `;
        sendEmail(email, 'Welcome to ExamSystem', welcomeHtml).catch(console.error);

        res.redirect('/user/dashboard');
    } catch (error) {
        console.error(error);
        res.render('register', { error: 'Registration failed' });
    }
});

// User Login
app.post('/user/login', async (req, res) => {
    try {
        const { email, password } = req.body;

        const result = await pool.query('SELECT * FROM users WHERE email = $1', [email]);

        if (result.rows.length === 0) {
            return res.render('user-login', { error: 'Invalid email or password' });
        }

        const user = result.rows[0];

        if (!user.password) {
            return res.render('user-login', { error: 'Please register first' });
        }

        const isValid = await bcrypt.compare(password, user.password);

        if (!isValid) {
            return res.render('user-login', { error: 'Invalid email or password' });
        }

        req.session.user = {
            id: user.id,
            name: user.name,
            email: user.email,
            role: 'user'
        };

        await pool.query('UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE id = $1', [user.id]);

        res.redirect('/user/dashboard');
    } catch (error) {
        console.error(error);
        res.render('user-login', { error: 'Login failed' });
    }
});

// Admin Login
app.post('/admin/login', async (req, res) => {
    try {
        const { email, password } = req.body;

        const result = await pool.query('SELECT * FROM admins WHERE email = $1', [email]);

        if (result.rows.length === 0) {
            return res.render('admin-login', { error: 'Invalid admin credentials' });
        }

        const admin = result.rows[0];
        const isValid = await bcrypt.compare(password, admin.password);

        if (!isValid) {
            return res.render('admin-login', { error: 'Invalid admin credentials' });
        }

        req.session.user = {
            id: admin.id,
            name: admin.name,
            email: admin.email,
            role: 'admin'
        };

        await pool.query('UPDATE admins SET last_login = CURRENT_TIMESTAMP WHERE id = $1', [admin.id]);
        res.redirect('/admin/dashboard');
    } catch (error) {
        console.error(error);
        res.render('admin-login', { error: 'Login failed' });
    }
});

app.get('/logout', (req, res) => {
    req.session.destroy();
    res.redirect('/');
});

// ==================== USER ROUTES ====================

app.get('/user/dashboard', async (req, res) => {
    if (!req.session.user || req.session.user.role !== 'user') {
        return res.redirect('/user/login');
    }

    try {
        const exams = await pool.query(`
            SELECT
                e.*,
                COUNT(q.id) as question_count,
                COALESCE(
                    (SELECT COUNT(*) FROM results r WHERE r.exam_id = e.id AND r.user_id = $1 AND r.status = 'completed'),
                    0
                ) as attempts_made,
                e.attempt_limit
            FROM exams e
            LEFT JOIN questions q ON e.id = q.exam_id
            WHERE e.is_active = true
            GROUP BY e.id
            ORDER BY e.created_at DESC
        `, [req.session.user.id]);

        res.render('user/dashboard', {
            user: req.session.user,
            exams: exams.rows
        });
    } catch (error) {
        console.error(error);
        res.status(500).send('Error loading dashboard');
    }
});

app.get('/user/profile', async (req, res) => {
    if (!req.session.user || req.session.user.role !== 'user') {
        return res.redirect('/user/login');
    }

    res.render('user/profile', { user: req.session.user });
});

app.get('/user/exam/:id/start', async (req, res) => {
    if (!req.session.user || req.session.user.role !== 'user') {
        return res.redirect('/user/login');
    }

    try {
        const exam = await pool.query('SELECT * FROM exams WHERE id = $1 AND is_active = true', [req.params.id]);
        if (exam.rows.length === 0) {
            return res.status(404).send('Exam not found');
        }

        const attemptCount = await pool.query(
            'SELECT COUNT(*) as count FROM results WHERE exam_id = $1 AND user_id = $2 AND status = $3',
            [req.params.id, req.session.user.id, 'completed']
        );

        const attemptLimit = exam.rows[0].attempt_limit || 1;

        if (attemptCount.rows[0].count >= attemptLimit) {
            return res.render('user/error', {
                user: req.session.user,
                message: `You have already taken this exam. Maximum attempts allowed: ${attemptLimit}`,
                redirectUrl: '/user/dashboard'
            });
        }

        const questions = await pool.query('SELECT * FROM questions WHERE exam_id = $1', [req.params.id]);

        if (questions.rows.length === 0) {
            return res.status(404).send('No questions found for this exam');
        }

        const randomizedQuestions = [...questions.rows];
        for (let i = randomizedQuestions.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [randomizedQuestions[i], randomizedQuestions[j]] = [randomizedQuestions[j], randomizedQuestions[i]];
        }

        res.render('user/take-exam', {
            user: req.session.user,
            exam: exam.rows[0],
            questions: randomizedQuestions
        });
    } catch (error) {
        console.error(error);
        res.status(500).send('Error starting exam');
    }
});

app.post('/user/exam/submit', async (req, res) => {
    if (!req.session.user || req.session.user.role !== 'user') {
        return res.redirect('/user/login');
    }

    try {
        const { examId, answers } = req.body;
        const userId = req.session.user.id;
        const userName = req.session.user.name;
        const userEmail = req.session.user.email;

        const examInfo = await pool.query('SELECT title FROM exams WHERE id = $1', [examId]);
        const examTitle = examInfo.rows[0]?.title || 'Online Exam';

        const attemptCount = await pool.query(
            'SELECT COUNT(*) as count FROM results WHERE exam_id = $1 AND user_id = $2 AND status = $3',
            [examId, userId, 'completed']
        );

        const exam = await pool.query('SELECT attempt_limit FROM exams WHERE id = $1', [examId]);
        const attemptLimit = exam.rows[0]?.attempt_limit || 1;

        if (attemptCount.rows[0].count >= attemptLimit) {
            return res.status(403).send('You have exceeded the maximum attempts for this exam');
        }

        const questions = await pool.query('SELECT * FROM questions WHERE exam_id = $1', [examId]);

        let score = 0;
        let totalMarks = 0;

        for (const question of questions.rows) {
            totalMarks += question.marks;
            const userAnswer = answers ? answers[question.id] : null;
            const isCorrect = userAnswer === question.correct_answer;

            if (isCorrect) {
                score += question.marks;
            }

            await pool.query(
                'INSERT INTO user_answers (user_id, exam_id, question_id, selected_answer, is_correct) VALUES ($1, $2, $3, $4, $5)',
                [userId, examId, question.id, userAnswer, isCorrect]
            );
        }

        const percentage = (score / totalMarks) * 100;
        const attemptNumber = attemptCount.rows[0].count + 1;

        await pool.query(
            `INSERT INTO results (user_id, exam_id, score, total_marks, percentage, status, submitted_at, attempt_number)
             VALUES ($1, $2, $3, $4, $5, 'completed', CURRENT_TIMESTAMP, $6)`,
            [userId, examId, score, totalMarks, percentage, attemptNumber]
        );

        const studentEmailHtml = `
            <!DOCTYPE html>
            <html>
            <head>
                <style>
                    body { font-family: Arial, sans-serif; line-height: 1.6; }
                    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
                    .header { background: linear-gradient(135deg, #1B2F4F, #0F1E33); padding: 20px; text-align: center; border-radius: 10px 10px 0 0; }
                    .header h2 { color: #D4AF37; margin: 0; }
                    .content { background: #FFFDD0; padding: 30px; border-radius: 0 0 10px 10px; }
                    .score-box { background: white; padding: 20px; text-align: center; border-radius: 10px; margin: 20px 0; }
                    .score { font-size: 48px; font-weight: bold; color: #1B2F4F; }
                    .percentage { font-size: 24px; color: #D4AF37; }
                </style>
            </head>
            <body>
                <div class="container">
                    <div class="header">
                        <h2>📊 Exam Results</h2>
                    </div>
                    <div class="content">
                        <h3 style="color: #1B2F4F;">Dear ${userName},</h3>
                        <p>You have successfully completed the <strong>${examTitle}</strong> exam.</p>
                        <div class="score-box">
                            <div class="score">${score}/${totalMarks}</div>
                            <div class="percentage">${Math.round(percentage)}%</div>
                        </div>
                        <p>${percentage >= 80 ? '🎉 Excellent performance! Keep it up!' : percentage >= 60 ? '👍 Good job! You passed!' : '📚 Keep practicing to improve your score!'}</p>
                        <p>You can view detailed analysis in your dashboard.</p>
                    </div>
                </div>
            </body>
            </html>
        `;

        const emailSent = await sendEmail(userEmail, `Your Exam Results - ${examTitle}`, studentEmailHtml);

        res.render('user/result', {
            user: req.session.user,
            score: score,
            totalMarks: totalMarks,
            percentage: percentage,
            emailSent: emailSent
        });
    } catch (error) {
        console.error('Error submitting exam:', error);
        res.status(500).send('Error submitting exam');
    }
});

// ==================== USER API ROUTES ====================

app.get('/user/api/stats', async (req, res) => {
    if (!req.session.user || req.session.user.role !== 'user') {
        return res.status(401).json({ error: 'Unauthorized' });
    }

    try {
        const userId = req.session.user.id;

        const results = await pool.query(`
            SELECT percentage, score, total_marks
            FROM results
            WHERE user_id = $1 AND status = 'completed'
        `, [userId]);

        const totalExams = results.rows.length;
        let avgScore = 0;
        let bestScore = 0;

        if (totalExams > 0) {
            let total = 0;
            results.rows.forEach(r => {
                total += r.percentage;
                if (r.percentage > bestScore) bestScore = r.percentage;
            });
            avgScore = total / totalExams;
        }

        const rankResult = await pool.query(`
            SELECT COUNT(DISTINCT user_id) + 1 as rank
            FROM results
            WHERE percentage > (SELECT AVG(percentage) FROM results WHERE user_id = $1)
        `, [userId]);

        res.json({
            total_exams: totalExams,
            avg_score: avgScore,
            best_score: bestScore,
            rank: rankResult.rows[0]?.rank || 1
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Server error' });
    }
});

app.get('/user/api/profile', async (req, res) => {
    if (!req.session.user || req.session.user.role !== 'user') {
        return res.status(401).json({ error: 'Unauthorized' });
    }

    try {
        const userId = req.session.user.id;

        const userInfo = await pool.query(`
            SELECT created_at as member_since, last_login
            FROM users WHERE id = $1
        `, [userId]);

        const examHistory = await pool.query(`
            SELECT
                r.exam_id,
                e.title as exam_title,
                e.description as exam_description,
                e.duration,
                r.score,
                r.total_marks,
                r.percentage,
                r.submitted_at,
                r.attempt_number
            FROM results r
            JOIN exams e ON r.exam_id = e.id
            WHERE r.user_id = $1 AND r.status = 'completed'
            ORDER BY r.submitted_at DESC
        `, [userId]);

        let avgScore = 0;
        let bestScore = 0;
        let worstScore = 100;
        const scoresHistory = [];

        examHistory.rows.forEach(exam => {
            avgScore += exam.percentage;
            if (exam.percentage > bestScore) bestScore = exam.percentage;
            if (exam.percentage < worstScore) worstScore = exam.percentage;
            scoresHistory.push({
                exam_name: exam.exam_title,
                percentage: exam.percentage
            });
        });

        if (examHistory.rows.length > 0) {
            avgScore = avgScore / examHistory.rows.length;
        } else {
            worstScore = 0;
        }

        const rankResult = await pool.query(`
            WITH user_avg AS (
                SELECT user_id, AVG(percentage) as avg_score
                FROM results WHERE status = 'completed'
                GROUP BY user_id
            )
            SELECT COUNT(*) + 1 as rank
            FROM user_avg
            WHERE avg_score > (SELECT AVG(percentage) FROM results WHERE user_id = $1)
        `, [userId]);

        res.json({
            member_since: userInfo.rows[0]?.member_since ? new Date(userInfo.rows[0].member_since).toLocaleDateString() : 'N/A',
            last_login: userInfo.rows[0]?.last_login ? new Date(userInfo.rows[0].last_login).toLocaleString() : 'Never',
            total_exams: examHistory.rows.length,
            avg_score: avgScore,
            best_score: bestScore,
            worst_score: worstScore === 100 ? 0 : worstScore,
            rank: rankResult.rows[0]?.rank || 1,
            scores_history: scoresHistory.reverse(),
            exam_history: examHistory.rows
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Server error' });
    }
});

app.get('/user/api/exam-details/:examId', async (req, res) => {
    if (!req.session.user || req.session.user.role !== 'user') {
        return res.status(401).json({ error: 'Unauthorized' });
    }

    try {
        const userId = req.session.user.id;
        const examId = req.params.examId;

        const examInfo = await pool.query(`
            SELECT e.title, e.description, r.score, r.total_marks, r.percentage, r.submitted_at, r.attempt_number
            FROM results r
            JOIN exams e ON r.exam_id = e.id
            WHERE r.user_id = $1 AND r.exam_id = $2 AND r.status = 'completed'
            ORDER BY r.submitted_at DESC
            LIMIT 1
        `, [userId, examId]);

        if (examInfo.rows.length === 0) {
            return res.status(404).json({ error: 'Exam not found' });
        }

        const answers = await pool.query(`
            SELECT
                q.question_text,
                q.option_a, q.option_b, q.option_c, q.option_d,
                q.correct_answer,
                ua.selected_answer,
                ua.is_correct
            FROM user_answers ua
            JOIN questions q ON ua.question_id = q.id
            WHERE ua.user_id = $1 AND ua.exam_id = $2
            ORDER BY q.id
        `, [userId, examId]);

        res.json({
            exam_title: examInfo.rows[0].title,
            exam_description: examInfo.rows[0].description,
            score: examInfo.rows[0].score,
            total_marks: examInfo.rows[0].total_marks,
            percentage: examInfo.rows[0].percentage,
            submitted_at: examInfo.rows[0].submitted_at,
            attempt_number: examInfo.rows[0].attempt_number,
            answers: answers.rows
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Server error' });
    }
});

// ==================== ADMIN ROUTES ====================

app.get('/admin/dashboard', async (req, res) => {
    if (!req.session.user || req.session.user.role !== 'admin') {
        return res.redirect('/admin/login');
    }

    try {
        const exams = await pool.query(`
            SELECT e.*, COUNT(q.id) as question_count
            FROM exams e
            LEFT JOIN questions q ON e.id = q.exam_id
            GROUP BY e.id
            ORDER BY e.created_at DESC
        `);

        const users = await pool.query(`
            SELECT u.*, COUNT(r.id) as exams_taken
            FROM users u
            LEFT JOIN results r ON u.id = r.user_id
            GROUP BY u.id
            ORDER BY u.created_at DESC
        `);

        res.render('admin/dashboard', {
            user: req.session.user,
            exams: exams.rows,
            users: users.rows
        });
    } catch (error) {
        console.error(error);
        res.status(500).send('Error loading dashboard');
    }
});

app.get('/admin/create-exam', (req, res) => {
    if (!req.session.user || req.session.user.role !== 'admin') {
        return res.redirect('/admin/login');
    }
    res.render('admin/create-exam', { user: req.session.user });
});

app.post('/admin/create-exam', async (req, res) => {
    if (!req.session.user || req.session.user.role !== 'admin') {
        return res.redirect('/admin/login');
    }

    try {
        const { title, description, duration, attempt_limit } = req.body;
        const result = await pool.query(
            'INSERT INTO exams (title, description, duration, created_by, attempt_limit) VALUES ($1, $2, $3, $4, $5) RETURNING *',
            [title, description, parseInt(duration), req.session.user.id, parseInt(attempt_limit) || 1]
        );
        res.redirect(`/admin/exam/${result.rows[0].id}/add-questions`);
    } catch (error) {
        console.error(error);
        res.status(500).send('Error creating exam');
    }
});

app.get('/admin/exam/:id/add-questions', async (req, res) => {
    if (!req.session.user || req.session.user.role !== 'admin') {
        return res.redirect('/admin/login');
    }

    try {
        const exam = await pool.query('SELECT * FROM exams WHERE id = $1', [req.params.id]);
        if (exam.rows.length === 0) {
            return res.status(404).send('Exam not found');
        }
        res.render('admin/add-questions', { user: req.session.user, exam: exam.rows[0] });
    } catch (error) {
        console.error(error);
        res.status(500).send('Error loading questions form');
    }
});

app.post('/admin/add-questions', async (req, res) => {
    if (!req.session.user || req.session.user.role !== 'admin') {
        return res.status(403).json({ success: false, message: 'Unauthorized' });
    }

    try {
        const { examId, questions } = req.body;

        let questionsArray = questions;
        if (typeof questions === 'string') {
            questionsArray = JSON.parse(questions);
        }

        await pool.query('DELETE FROM questions WHERE exam_id = $1', [examId]);

        for (const q of questionsArray) {
            await pool.query(
                `INSERT INTO questions (exam_id, question_text, option_a, option_b, option_c, option_d, correct_answer, marks)
                 VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
                [examId, q.text, q.optionA, q.optionB, q.optionC, q.optionD, q.correctAnswer, parseInt(q.marks) || 1]
            );
        }

        await pool.query('UPDATE exams SET total_questions = $1 WHERE id = $2', [questionsArray.length, examId]);

        res.json({ success: true, message: 'Questions added successfully' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: 'Error adding questions' });
    }
});

app.get('/admin/exams', async (req, res) => {
    if (!req.session.user || req.session.user.role !== 'admin') {
        return res.redirect('/admin/login');
    }
    res.render('admin/exams', { user: req.session.user });
});

app.get('/admin/analysis/:examId', async (req, res) => {
    if (!req.session.user || req.session.user.role !== 'admin') {
        return res.redirect('/admin/login');
    }

    try {
        const exam = await pool.query('SELECT * FROM exams WHERE id = $1', [req.params.examId]);
        if (exam.rows.length === 0) {
            return res.status(404).send('Exam not found');
        }
        res.render('admin/analysis', { user: req.session.user, exam: exam.rows[0] });
    } catch (error) {
        console.error(error);
        res.status(500).send('Error loading analysis');
    }
});

app.get('/admin/send-scores/:examId', async (req, res) => {
    if (!req.session.user || req.session.user.role !== 'admin') {
        return res.redirect('/admin/login');
    }

    try {
        const exam = await pool.query('SELECT * FROM exams WHERE id = $1', [req.params.examId]);
        if (exam.rows.length === 0) {
            return res.status(404).send('Exam not found');
        }
        res.render('admin/send-scores', { user: req.session.user, exam: exam.rows[0] });
    } catch (error) {
        console.error(error);
        res.status(500).send('Error loading send scores page');
    }
});

app.get('/admin/exam/:id/edit', async (req, res) => {
    if (!req.session.user || req.session.user.role !== 'admin') {
        return res.redirect('/admin/login');
    }

    try {
        const exam = await pool.query('SELECT * FROM exams WHERE id = $1', [req.params.id]);
        if (exam.rows.length === 0) {
            return res.status(404).send('Exam not found');
        }
        res.render('admin/edit-exam', { user: req.session.user, exam: exam.rows[0] });
    } catch (error) {
        console.error(error);
        res.status(500).send('Error loading exam');
    }
});

app.post('/admin/exam/:id/edit', async (req, res) => {
    if (!req.session.user || req.session.user.role !== 'admin') {
        return res.redirect('/admin/login');
    }

    try {
        const { title, description, duration, is_active, attempt_limit } = req.body;
        await pool.query(
            'UPDATE exams SET title = $1, description = $2, duration = $3, is_active = $4, attempt_limit = $5 WHERE id = $6',
            [title, description, parseInt(duration), is_active === 'true', parseInt(attempt_limit) || 1, req.params.id]
        );
        res.redirect('/admin/exams');
    } catch (error) {
        console.error(error);
        res.status(500).send('Error updating exam');
    }
});

// ==================== ADMIN API ROUTES ====================

app.get('/admin/api/exams', async (req, res) => {
    if (!req.session.user || req.session.user.role !== 'admin') {
        return res.status(401).json({ error: 'Unauthorized' });
    }

    try {
        const exams = await pool.query(`
            SELECT
                e.*,
                COUNT(DISTINCT q.id) as question_count,
                COUNT(DISTINCT r.user_id) as students_attempted,
                ROUND(AVG(r.percentage)) as avg_score
            FROM exams e
            LEFT JOIN questions q ON e.id = q.exam_id
            LEFT JOIN results r ON e.id = r.exam_id AND r.status = 'completed'
            GROUP BY e.id
            ORDER BY e.created_at DESC
        `);
        res.json(exams.rows);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Server error' });
    }
});

app.get('/admin/api/users', async (req, res) => {
    if (!req.session.user || req.session.user.role !== 'admin') {
        return res.status(401).json({ error: 'Unauthorized' });
    }

    try {
        const users = await pool.query(`
            SELECT
                u.*,
                COUNT(DISTINCT r.exam_id) as exams_taken,
                ROUND(AVG(r.percentage)) as avg_score
            FROM users u
            LEFT JOIN results r ON u.id = r.user_id AND r.status = 'completed'
            GROUP BY u.id
            ORDER BY u.created_at DESC
        `);
        res.json(users.rows);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Server error' });
    }
});

app.get('/admin/api/analysis/:examId', async (req, res) => {
    if (!req.session.user || req.session.user.role !== 'admin') {
        return res.status(401).json({ error: 'Unauthorized' });
    }

    try {
        const examId = req.params.examId;

        const exam = await pool.query('SELECT title, attempt_limit FROM exams WHERE id = $1', [examId]);

        const stats = await pool.query(`
            SELECT
                COUNT(DISTINCT user_id) as total_students,
                COUNT(CASE WHEN status = 'completed' THEN 1 END) as completed_count,
                AVG(percentage) as avg_percentage,
                COUNT(CASE WHEN percentage >= 60 THEN 1 END) as passed_count
            FROM results
            WHERE exam_id = $1
        `, [examId]);

        const questionAnalysis = await pool.query(`
            SELECT
                q.id,
                q.question_text,
                COUNT(ua.id) as total_attempts,
                SUM(CASE WHEN ua.is_correct THEN 1 ELSE 0 END) as correct_count,
                ROUND(SUM(CASE WHEN ua.is_correct THEN 1 ELSE 0 END)::DECIMAL / NULLIF(COUNT(ua.id), 0) * 100, 2) as correct_percentage
            FROM questions q
            LEFT JOIN user_answers ua ON q.id = ua.question_id AND ua.exam_id = $1
            WHERE q.exam_id = $1
            GROUP BY q.id
            ORDER BY q.id
        `, [examId]);

        const students = await pool.query(`
            SELECT
                u.id as user_id,
                u.name,
                u.email,
                r.score,
                r.total_marks,
                ROUND(r.percentage) as percentage,
                r.status,
                r.attempt_number
            FROM results r
            JOIN users u ON r.user_id = u.id
            WHERE r.exam_id = $1 AND r.status = 'completed'
            ORDER BY r.percentage DESC
        `, [examId]);

        const distribution = [0, 0, 0, 0, 0];
        students.rows.forEach(s => {
            const p = s.percentage;
            if (p <= 20) distribution[0]++;
            else if (p <= 40) distribution[1]++;
            else if (p <= 60) distribution[2]++;
            else if (p <= 80) distribution[3]++;
            else distribution[4]++;
        });

        const passingRate = stats.rows[0]?.completed_count > 0
            ? (stats.rows[0].passed_count / stats.rows[0].completed_count * 100)
            : 0;

        res.json({
            exam_title: exam.rows[0]?.title || 'Unknown',
            attempt_limit: exam.rows[0]?.attempt_limit || 1,
            total_students: parseInt(stats.rows[0]?.total_students || 0),
            completed_count: parseInt(stats.rows[0]?.completed_count || 0),
            avg_percentage: parseFloat(stats.rows[0]?.avg_percentage || 0),
            passing_rate: passingRate,
            question_analysis: questionAnalysis.rows,
            students: students.rows,
            score_distribution: distribution
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Server error' });
    }
});

app.get('/admin/api/exam-students/:examId', async (req, res) => {
    if (!req.session.user || req.session.user.role !== 'admin') {
        return res.status(401).json({ error: 'Unauthorized' });
    }

    try {
        const examId = req.params.examId;
        const exam = await pool.query('SELECT title FROM exams WHERE id = $1', [examId]);
        const students = await pool.query(`
            SELECT
                u.id as user_id,
                u.name,
                u.email,
                r.score,
                r.total_marks,
                ROUND(r.percentage) as percentage,
                r.attempt_number
            FROM results r
            JOIN users u ON r.user_id = u.id
            WHERE r.exam_id = $1 AND r.status = 'completed'
            ORDER BY u.name
        `, [examId]);

        res.json({
            exam_title: exam.rows[0]?.title,
            students: students.rows
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Server error' });
    }
});

app.post('/admin/send-score-email', async (req, res) => {
    if (!req.session.user || req.session.user.role !== 'admin') {
        return res.status(401).json({ error: 'Unauthorized' });
    }

    try {
        const { email, name, score, percentage, examTitle } = req.body;

        const emailHtml = `
            <!DOCTYPE html>
            <html>
            <head>
                <style>
                    body { font-family: Arial, sans-serif; }
                    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
                    .header { background: linear-gradient(135deg, #1B2F4F, #0F1E33); padding: 20px; text-align: center; border-radius: 10px 10px 0 0; }
                    .header h2 { color: #D4AF37; margin: 0; }
                    .content { background: #FFFDD0; padding: 30px; border-radius: 0 0 10px 10px; }
                    .score-box { background: white; padding: 20px; text-align: center; border-radius: 10px; margin: 20px 0; }
                    .score { font-size: 36px; font-weight: bold; color: #1B2F4F; }
                </style>
            </head>
            <body>
                <div class="container">
                    <div class="header">
                        <h2>📊 Your Exam Results</h2>
                    </div>
                    <div class="content">
                        <h3 style="color: #1B2F4F;">Dear ${name},</h3>
                        <p>Your exam results for <strong>${examTitle}</strong> are ready!</p>
                        <div class="score-box">
                            <div class="score">${Math.round(percentage)}%</div>
                            <p>Score: ${score} out of ${Math.round(score * 100 / percentage)}</p>
                        </div>
                        <p>Login to your dashboard for detailed analysis.</p>
                        <p>Keep up the good work!</p>
                    </div>
                </div>
            </body>
            </html>
        `;

        const sent = await sendEmail(email, `Your Exam Results - ${examTitle}`, emailHtml);

        if (sent) {
            res.json({ success: true, message: 'Email sent successfully' });
        } else {
            res.json({ success: false, message: 'Failed to send email' });
        }
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Failed to send email' });
    }
});

app.post('/admin/send-all-scores', async (req, res) => {
    if (!req.session.user || req.session.user.role !== 'admin') {
        return res.status(401).json({ error: 'Unauthorized' });
    }

    try {
        const { examId, examTitle } = req.body;

        const students = await pool.query(`
            SELECT u.id, u.name, u.email, r.score, r.total_marks, r.percentage
            FROM results r
            JOIN users u ON r.user_id = u.id
            WHERE r.exam_id = $1 AND r.status = 'completed'
        `, [examId]);

        let sentCount = 0;

        for (const student of students.rows) {
            const emailHtml = `
                <div style="font-family: Arial, sans-serif;">
                    <div style="background: #1B2F4F; padding: 20px; text-align: center;">
                        <h2 style="color: #D4AF37;">Exam Score Report</h2>
                    </div>
                    <div style="padding: 20px; background: #FFFDD0;">
                        <h3 style="color: #1B2F4F;">Dear ${student.name},</h3>
                        <p>Your score for <strong>${examTitle}</strong> is:</p>
                        <h1 style="color: #1B2F4F;">${Math.round(student.percentage)}%</h1>
                        <p>Score: ${student.score}/${student.total_marks}</p>
                    </div>
                </div>
            `;

            const sent = await sendEmail(student.email, `Your Exam Score - ${examTitle}`, emailHtml);
            if (sent) sentCount++;

            await new Promise(resolve => setTimeout(resolve, 1000));
        }

        res.json({ success: true, sent_count: sentCount, total: students.rows.length });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Failed to send emails' });
    }
});

app.delete('/admin/api/exams/:id', async (req, res) => {
    if (!req.session.user || req.session.user.role !== 'admin') {
        return res.status(401).json({ error: 'Unauthorized' });
    }

    try {
        await pool.query('DELETE FROM exams WHERE id = $1', [req.params.id]);
        res.json({ success: true });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Server error' });
    }
});

// Error page route
app.get('/error', (req, res) => {
    res.render('user/error', {
        user: req.session.user,
        message: req.query.message || 'An error occurred',
        redirectUrl: req.query.redirectUrl || '/'
    });
});

// Get single student details
app.get('/admin/api/student/:userId', async (req, res) => {
    if (!req.session.user || req.session.user.role !== 'admin') {
        return res.status(401).json({ error: 'Unauthorized' });
    }

    try {
        const userId = req.params.userId;

        const student = await pool.query(`
            SELECT u.*, 
                   COUNT(DISTINCT r.exam_id) as exams_taken,
                   ROUND(AVG(r.percentage)) as avg_score,
                   MAX(r.percentage) as best_score
            FROM users u
            LEFT JOIN results r ON u.id = r.user_id AND r.status = 'completed'
            WHERE u.id = $1
            GROUP BY u.id
        `, [userId]);

        if (student.rows.length === 0) {
            return res.status(404).json({ error: 'Student not found' });
        }

        const rankResult = await pool.query(`
            WITH user_avg AS (
                SELECT user_id, AVG(percentage) as avg_score
                FROM results WHERE status = 'completed'
                GROUP BY user_id
            )
            SELECT COUNT(*) + 1 as rank
            FROM user_avg
            WHERE avg_score > (SELECT AVG(percentage) FROM results WHERE user_id = $1)
        `, [userId]);

        const studentData = student.rows[0];
        studentData.rank = rankResult.rows[0]?.rank || 1;

        res.json(studentData);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Server error' });
    }
});

// Get student exam history
app.get('/admin/api/student/:userId/exams', async (req, res) => {
    if (!req.session.user || req.session.user.role !== 'admin') {
        return res.status(401).json({ error: 'Unauthorized' });
    }

    try {
        const userId = req.params.userId;

        const exams = await pool.query(`
            SELECT
                e.title as exam_title,
                r.score,
                r.total_marks,
                r.percentage,
                r.submitted_at,
                r.attempt_number
            FROM results r
                     JOIN exams e ON r.exam_id = e.id
            WHERE r.user_id = $1 AND r.status = 'completed'
            ORDER BY r.submitted_at DESC
        `, [userId]);

        res.json(exams.rows);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Server error' });
    }
});

// Send custom email to student
app.post('/admin/send-custom-email', async (req, res) => {
    if (!req.session.user || req.session.user.role !== 'admin') {
        return res.status(401).json({ error: 'Unauthorized' });
    }

    try {
        const { email, subject, message } = req.body;

        const emailHtml = `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                <div style="background: linear-gradient(135deg, #0A1929, #051020); padding: 20px; text-align: center;">
                    <h2 style="color: #D4AF37;">ExamSystem Communication</h2>
                </div>
                <div style="padding: 30px; background: #F5F0E8;">
                    <div style="background: white; padding: 20px; border-radius: 10px;">
                        ${message.replace(/\n/g, '<br>')}
                    </div>
                    <hr style="margin: 20px 0;">
                    <p style="color: #666; font-size: 12px; text-align: center;">This is an automated message from ExamSystem.</p>
                </div>
            </div>
        `;

        const sent = await sendEmail(email, subject, emailHtml);

        if (sent) {
            res.json({ success: true, message: 'Email sent successfully' });
        } else {
            res.json({ success: false, message: 'Failed to send email' });
        }
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Failed to send email' });
    }
});

// One-time setup route - Remove after first use
app.get('/setup-admin', async (req, res) => {
    try {
        const bcrypt = require('bcryptjs');
        const hashedPassword = await bcrypt.hash('10KarthiK@eya112007', 10);

        // Check if admin exists
        const adminCheck = await pool.query('SELECT * FROM admins WHERE email = $1', ['2007karthikdasari@gmail.com']);

        if (adminCheck.rows.length === 0) {
            await pool.query(
                'INSERT INTO admins (name, email, password, is_active) VALUES ($1, $2, $3, $4)',
                ['Karthikeya', '2007karthikdasari@gmail.com', hashedPassword, true]
            );
            res.send('✅ Admin created successfully!');
        } else {
            await pool.query(
                'UPDATE admins SET password = $1 WHERE email = $2',
                [hashedPassword, '2007karthikdasari@gmail.com']
            );
            res.send('✅ Admin password updated successfully!');
        }
    } catch (error) {
        res.send('Error: ' + error.message);
    }
});

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`\n=================================`);
    console.log(`🚀 Exam System Running on http://localhost:${PORT}`);
    console.log(`=================================`);
    console.log(`\n🔑 ADMIN LOGIN:`);
    console.log(`   Email: 2007karthikdasari@gmail.com`);
    console.log(`   Password: 10KarthiK@eya112007`);
    console.log(`\n👥 USER LOGIN:`);
    console.log(`   Pre-registered students need to register first`);
    console.log(`   Then login with their email and chosen password`);
    console.log(`\n📧 EMAIL STATUS:`);
    console.log(`   Configured with: ${process.env.EMAIL_USER || 'Not set'}`);
    console.log(`\n=================================\n`);
});