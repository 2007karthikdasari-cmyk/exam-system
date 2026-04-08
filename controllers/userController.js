const Exam = require('../models/Exam');
const Question = require('../models/Question');
const Result = require('../models/Result');
const { sendEmail } = require('../config/email');

const dashboard = async (req, res) => {
    try {
        const exams = await Exam.getActiveExams();
        res.render('user/dashboard', { exams, user: req.session.user });
    } catch (error) {
        console.error(error);
        res.status(500).send('Error loading dashboard');
    }
};

const startExam = async (req, res) => {
    try {
        const examId = req.params.id;
        const exam = await Exam.findById(examId);
        const questions = await Question.getRandomizedQuestions(examId);

        // Check if user already started this exam
        const existingResult = await Result.getUserResult(req.session.user.id, examId);

        if (existingResult && existingResult.status !== 'in-progress') {
            return res.redirect('/user/dashboard?error=Already completed this exam');
        }

        let result;
        if (!existingResult) {
            result = await Result.create(req.session.user.id, examId, new Date());
        } else {
            result = existingResult;
        }

        res.render('user/take-exam', {
            exam,
            questions,
            user: req.session.user,
            startTime: result.started_at
        });
    } catch (error) {
        console.error(error);
        res.status(500).send('Error starting exam');
    }
};

const submitExam = async (req, res) => {
    try {
        const { examId, answers, startTime } = req.body;
        const userId = req.session.user.id;

        const questions = await Question.getByExamId(examId);
        let score = 0;
        let totalMarks = 0;

        // Calculate score and save answers
        for (const question of questions) {
            totalMarks += question.marks;
            const userAnswer = answers[question.id];
            const isCorrect = userAnswer === question.correct_answer;

            if (isCorrect) {
                score += question.marks;
            }

            await Result.saveAnswer(userId, examId, question.id, userAnswer, isCorrect);
        }

        const percentage = (score / totalMarks) * 100;
        const result = await Result.submitExam(userId, examId, score, totalMarks, percentage, 'completed');

        // Send email notification
        const emailHtml = `
            <div style="font-family: Arial, sans-serif;">
                <h2>Exam Submitted Successfully</h2>
                <p>Dear ${req.session.user.name},</p>
                <p>Your exam has been submitted successfully. Your score will be emailed to you once evaluated.</p>
                <p>Thank you for participating!</p>
            </div>
        `;

        await sendEmail(req.session.user.email, 'Exam Submitted Successfully', emailHtml);

        res.json({ success: true, score, totalMarks, percentage });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Error submitting exam' });
    }
};

const autoSubmit = async (req, res) => {
    try {
        const { examId } = req.body;
        // Similar to submitExam but with auto-submit status
        res.json({ success: true, message: 'Exam auto-submitted' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Error auto-submitting exam' });
    }
};

module.exports = { dashboard, startExam, submitExam, autoSubmit };