const express = require('express');
const router = express.Router();
const { sendOtp, verifyOtp, getStatus } = require('../controllers/authController');

router.post('/auth/send-otp', sendOtp);
router.post('/auth/verify-otp', verifyOtp);
router.get('/auth/status', getStatus);

module.exports = router;
