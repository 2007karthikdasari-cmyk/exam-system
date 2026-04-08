const express = require('express');
const router = express.Router();
const adminController = require('../controllers/adminController');
const { isAuthenticated, isAdmin } = require('../middleware/auth');

router.use(isAuthenticated, isAdmin);

router.get('/dashboard', adminController.dashboard);
router.get('/create-exam', adminController.createExamForm);
router.post('/create-exam', adminController.createExam);
router.get('/exam/:id/add-questions', adminController.addQuestionsForm);
router.post('/exam/add-questions', adminController.addQuestions);
router.get('/results', adminController.viewResults);
router.get('/results/:id', adminController.getExamResults);
router.post('/send-score', adminController.sendScoreEmail);
router.post('/extend-time', adminController.extendTime);

module.exports = router;