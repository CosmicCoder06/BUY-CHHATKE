const express = require('express');
const router = express.Router();
const { sendOtp, verifyOtp, login, requestPasswordReset, resetPassword, getStatus } = require('../controllers/authController');

router.post('/auth/send-otp', sendOtp);
router.post('/auth/verify-otp', verifyOtp);
router.post('/auth/login', login);
router.post('/auth/request-password-reset', requestPasswordReset);
router.post('/auth/reset-password', resetPassword);
router.get('/auth/status', getStatus);

module.exports = router;
