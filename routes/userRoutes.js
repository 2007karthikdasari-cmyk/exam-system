const express = require('express');
const router = express.Router();
const userController = require('../controllers/userController');
const { isAuthenticated, isUser } = require('../middleware/auth');

router.use(isAuthenticated, isUser);

router.get('/dashboard', userController.dashboard);
router.get('/exam/:id/start', userController.startExam);
router.post('/exam/submit', userController.submitExam);
router.post('/exam/auto-submit', userController.autoSubmit);

module.exports = router;