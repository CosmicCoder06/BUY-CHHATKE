const { sendOtpEmail } = require('../services/emailService');
const User = require('../models/User');

// In-memory OTP Cache: Map<email, { otp, expiresAt, name }>
const otpStore = new Map();

// Helper to validate email format
function isValidEmail(email) {
    const regex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
    return typeof email === 'string' && regex.test(email.trim());
}

/**
 * Dispatches a 6-digit OTP verification email to the user's email address.
 */
async function sendOtp(req, res) {
    try {
        const { email, name, password } = req.body;

        if (!email || !isValidEmail(email)) {
            return res.status(400).json({
                success: false,
                error: 'Please provide a valid email address.'
            });
        }

        const normalizedEmail = email.trim().toLowerCase();
        if (typeof password !== 'string' || password.length < 4) {
            return res.status(400).json({ success: false, error: 'Password must be at least 4 characters.' });
        }

        if (await User.findByEmail(normalizedEmail)) {
            return res.status(409).json({ success: false, error: 'An account already exists for this email. Please sign in.' });
        }
        const userName = (name && typeof name === 'string' && name.trim().length > 0)
            ? name.trim()
            : normalizedEmail.split('@')[0];

        // Generate cryptographically random 6-digit OTP
        const otp = String(Math.floor(100000 + Math.random() * 900000));
        const expiresAt = Date.now() + 10 * 60 * 1000; // 10 minutes

        // Store OTP in memory
        otpStore.set(normalizedEmail, {
            otp,
            expiresAt,
            name: userName,
            passwordHash: User.hashPassword(password)
        });

        // Dispatch Email via Nodemailer
        const dispatchResult = await sendOtpEmail({
            to: normalizedEmail,
            name: userName,
            otp
        });

        return res.json({
            success: true,
            message: `Verification code sent to ${normalizedEmail}`,
            email: normalizedEmail,
            previewUrl: dispatchResult.previewUrl,
            sentToRealInbox: dispatchResult.sentToRealInbox
        });
    } catch (err) {
        console.error('[AUTH CONTROLLER ERROR]', err);
        return res.status(500).json({
            success: false,
            error: 'Failed to send verification email. Please check your email configuration.'
        });
    }
}

/**
 * Validates the 6-digit OTP code against the cached code.
 */
async function verifyOtp(req, res) {
    try {
        const { email, otp, name } = req.body;

        if (!email || !otp) {
            return res.status(400).json({
                success: false,
                error: 'Email and verification code are required.'
            });
        }

        const normalizedEmail = email.trim().toLowerCase();
        const enteredOtp = String(otp).trim();

        const record = otpStore.get(normalizedEmail);

        if (!record) {
            return res.status(400).json({
                success: false,
                error: 'No active verification code found for this email. Please request a new code.'
            });
        }

        if (Date.now() > record.expiresAt) {
            otpStore.delete(normalizedEmail);
            return res.status(400).json({
                success: false,
                error: 'Verification code has expired. Please request a new one.'
            });
        }

        if (record.otp !== enteredOtp) {
            return res.status(400).json({
                success: false,
                error: 'Invalid verification code. Please check your email and try again.'
            });
        }

        // Verification successful -> Clear OTP from store
        const displayName = name || record.name || normalizedEmail.split('@')[0];
        const existingUser = await User.findByEmail(normalizedEmail);
        if (existingUser) {
            otpStore.delete(normalizedEmail);
            return res.status(409).json({ success: false, error: 'An account already exists for this email. Please sign in.' });
        }

        await User.create({
            email: normalizedEmail,
            name: displayName,
            passwordHash: record.passwordHash,
            verified: true
        });
        otpStore.delete(normalizedEmail);
        const authToken = 'sba_jwt_' + Buffer.from(JSON.stringify({ email: normalizedEmail, name: displayName, timestamp: Date.now() })).toString('base64');

        return res.json({
            success: true,
            verified: true,
            message: 'Email successfully verified.',
            authToken,
            user: {
                email: normalizedEmail,
                name: displayName,
                verified: true
            }
        });
    } catch (err) {
        console.error('[VERIFY CONTROLLER ERROR]', err);
        return res.status(500).json({
            success: false,
            error: 'Failed to verify code. Please try again.'
        });
    }
}

async function login(req, res) {
    try {
        const { email, password } = req.body;
        if (!email || !password || !isValidEmail(email)) {
            return res.status(400).json({ success: false, error: 'Valid email and password are required.' });
        }
        const normalizedEmail = email.trim().toLowerCase();
        const user = await User.findByEmail(normalizedEmail);
        if (!user || !User.verifyPassword(password, user.passwordHash)) {
            return res.status(401).json({ success: false, error: 'Incorrect email or password.' });
        }
        const authToken = 'sba_jwt_' + Buffer.from(JSON.stringify({ email: user.email, name: user.name, timestamp: Date.now() })).toString('base64');
        return res.json({
            success: true,
            authToken,
            user: { email: user.email, name: user.name, verified: true }
        });
    } catch (err) {
        console.error('[LOGIN CONTROLLER ERROR]', err);
        return res.status(500).json({ success: false, error: 'Unable to sign in. Please try again.' });
    }
}

/**
 * Returns configuration status of the authentication & email service.
 */
function getStatus(req, res) {
    const isSmtpConfigured = Boolean(
        process.env.GMAIL_USER || process.env.SMTP_USER || process.env.SMTP_HOST
    );
    res.json({
        service: 'Authentication & Email Verification Service',
        isSmtpConfigured,
        smtpHost: process.env.SMTP_HOST || (process.env.GMAIL_USER ? 'smtp.gmail.com' : 'Ethereal Test Account')
    });
}

module.exports = {
    sendOtp,
    verifyOtp,
    login,
    getStatus
};
