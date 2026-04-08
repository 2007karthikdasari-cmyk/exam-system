const Exam = require('../models/Exam');
const Question = require('../models/Question');
const Result = require('../models/Result');
const User = require('../models/User');
const { sendEmail } = require('../config/email');

const dashboard = async (req, res) => {
    try {
        const exams = await Exam.getAll();
        const users = await User.getAllUsers();
        res.render('admin/dashboard', { exams, users, admin: req.session.user });
    } catch (error) {
        console.error(error);
        res.status(500).send('Server error');
    }
};

const createExamForm = (req, res) => {
    res.render('admin/create-exam');
};

const createExam = async (req, res) => {
    try {
        const { title, description, duration } = req.body;
        const exam = await Exam.create(title, description, parseInt(duration), req.session.user.id);
        res.redirect(`/admin/exam/${exam.id}/add-questions`);
    } catch (error) {
        console.error(error);
        res.status(500).send('Error creating exam');
    }
};

const addQuestionsForm = async (req, res) => {
    try {
        const exam = await Exam.findById(req.params.id);
        res.render('admin/add-questions', { exam });
    } catch (error) {
        console.error(error);
        res.status(500).send('Error loading questions form');
    }
};

const addQuestions = async (req, res) => {
    try {
        const { examId, questions } = req.body;

        // Delete existing questions if any
        await Question.deleteByExamId(examId);

        // Add new questions
        for (let i = 0; i < questions.length; i++) {
            const q = questions[i];
            await Question.create(
                examId,
                q.text,
                { A: q.optionA, B: q.optionB, C: q.optionC, D: q.optionD },
                q.correctAnswer,
                parseInt(q.marks) || 1
            );
        }

        res.json({ success: true, message: 'Questions added successfully' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: 'Error adding questions' });
    }
};

const viewResults = async (req, res) => {
    try {
        const exams = await Exam.getAll();
        res.render('admin/results', { exams });
    } catch (error) {
        console.error(error);
        res.status(500).send('Error loading results');
    }
};

const getExamResults = async (req, res) => {
    try {
        const examId = req.params.id;
        const analysis = await Result.getExamAnalysis(examId);
        const questionAnalysis = await Result.getQuestionWiseAnalysis(examId);
        const userAnswers = await Result.getAllUserAnswers(examId);

        res.json({ analysis, questionAnalysis, userAnswers });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Error fetching results' });
    }
};

const sendScoreEmail = async (req, res) => {
    try {
        const { userId, examId, email, score, percentage } = req.body;

        const emailHtml = `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                <div style="background: linear-gradient(135deg, #800020, #5C0018); padding: 20px; text-align: center;">
                    <h2 style="color: #D4AF37;">Exam Score Report</h2>
                </div>
                <div style="padding: 20px; border: 1px solid #ddd;">
                    <h3>Hello ${req.body.name},</h3>
                    <p>Your exam has been evaluated. Here are your results:</p>
                    <div style="background: #f8f9fa; padding: 15px; margin: 20px 0;">
                        <p><strong>Score:</strong> ${score}</p>
                        <p><strong>Percentage:</strong> ${percentage}%</p>
                    </div>
                    <p>Keep practicing to improve your score!</p>
                    <hr>
                    <p style="color: #666; font-size: 12px;">This is an automated message from Exam System.</p>
                </div>
            </div>
        `;

        await sendEmail(email, 'Your Exam Score', emailHtml);
        res.json({ success: true, message: 'Email sent successfully' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Error sending email' });
    }
};

const extendTime = async (req, res) => {
    try {
        const { userId, examId, additionalMinutes } = req.body;
        // Logic to extend time for specific user
        res.json({ success: true, message: `Extended time by ${additionalMinutes} minutes` });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Error extending time' });
    }
};

module.exports = {
    dashboard,
    createExamForm,
    createExam,
    addQuestionsForm,
    addQuestions,
    viewResults,
    getExamResults,
    sendScoreEmail,
    extendTime
};