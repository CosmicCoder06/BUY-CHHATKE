const { sendOtpEmail } = require('../services/emailService');
const User = require('../models/User');
const crypto = require('crypto');

// In-memory OTP Cache: Map<email, { otp, expiresAt, name }>
const otpStore = new Map();
const otpRequestStore = new Map();
const OTP_TTL_MS = 10 * 60 * 1000;
const MAX_OTP_ATTEMPTS = 5;

function otpKey(purpose, email) {
    return `${purpose}:${email}`;
}

function createOtp() {
    return String(crypto.randomInt(100000, 1000000));
}

function hashOtp(otp) {
    return crypto.createHash('sha256').update(String(otp)).digest('hex');
}

function validOtp(record, enteredOtp) {
    const actual = Buffer.from(hashOtp(enteredOtp), 'hex');
    const expected = Buffer.from(record.otpHash, 'hex');
    return actual.length === expected.length && crypto.timingSafeEqual(actual, expected);
}

function canRequestOtp(purpose, email) {
    const key = otpKey(purpose, email);
    const now = Date.now();
    const requests = (otpRequestStore.get(key) || []).filter(time => now - time < OTP_TTL_MS);
    if (requests.length >= 3) return false;
    requests.push(now);
    otpRequestStore.set(key, requests);
    return true;
}

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
        if (!canRequestOtp('registration', normalizedEmail)) {
            return res.status(429).json({ success: false, error: 'Too many codes requested. Please wait 10 minutes.' });
        }
        const otp = createOtp();
        const expiresAt = Date.now() + OTP_TTL_MS;

        // Store OTP in memory
        otpStore.set(otpKey('registration', normalizedEmail), {
            otpHash: hashOtp(otp),
            expiresAt,
            attempts: 0,
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
        // Axios errors can include request configuration (including provider API
        // keys). Log only the diagnostic fields that are safe for Render logs.
        console.error('[AUTH CONTROLLER ERROR]', {
            message: err.message,
            code: err.code,
            status: err.response?.status,
            providerMessage: err.response?.data?.message || err.response?.data?.code
        });
        return res.status(err.code === 'EMAIL_NOT_CONFIGURED' ? 503 : 500).json({
            success: false,
            error: err.code === 'EMAIL_NOT_CONFIGURED'
                ? 'Account verification is temporarily unavailable. Please try again later.'
                : 'Failed to send verification email. Please check your email configuration.'
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

        const recordKey = otpKey('registration', normalizedEmail);
        const record = otpStore.get(recordKey);

        if (!record) {
            return res.status(400).json({
                success: false,
                error: 'No active verification code found for this email. Please request a new code.'
            });
        }

        if (Date.now() > record.expiresAt) {
            otpStore.delete(recordKey);
            return res.status(400).json({
                success: false,
                error: 'Verification code has expired. Please request a new one.'
            });
        }

        record.attempts += 1;
        if (record.attempts > MAX_OTP_ATTEMPTS) {
            otpStore.delete(recordKey);
            return res.status(429).json({ success: false, error: 'Too many invalid attempts. Please request a new code.' });
        }
        if (!validOtp(record, enteredOtp)) {
            return res.status(400).json({
                success: false,
                error: 'Invalid verification code. Please check your email and try again.'
            });
        }

        // Verification successful -> Clear OTP from store
        const displayName = name || record.name || normalizedEmail.split('@')[0];
        const existingUser = await User.findByEmail(normalizedEmail);
        if (existingUser) {
            otpStore.delete(recordKey);
            return res.status(409).json({ success: false, error: 'An account already exists for this email. Please sign in.' });
        }

        await User.create({
            email: normalizedEmail,
            name: displayName,
            passwordHash: record.passwordHash,
            verified: true
        });
        otpStore.delete(recordKey);
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

async function requestPasswordReset(req, res) {
    try {
        const normalizedEmail = String(req.body.email || '').trim().toLowerCase();
        // Same response for existing and unknown accounts prevents email enumeration.
        const message = 'If an account exists for this email, a reset code has been sent.';
        if (!isValidEmail(normalizedEmail) || !canRequestOtp('password-reset', normalizedEmail)) {
            return res.status(200).json({ success: true, message });
        }
        const user = await User.findByEmail(normalizedEmail);
        if (!user) return res.status(200).json({ success: true, message });

        const otp = createOtp();
        otpStore.set(otpKey('password-reset', normalizedEmail), {
            otpHash: hashOtp(otp), expiresAt: Date.now() + OTP_TTL_MS, attempts: 0
        });
        await sendOtpEmail({ to: normalizedEmail, name: user.name, otp, type: 'password-reset' });
        return res.status(200).json({ success: true, message });
    } catch (err) {
        console.error('[PASSWORD RESET REQUEST ERROR]', { message: err.message, code: err.code, status: err.response?.status });
        return res.status(503).json({ success: false, error: 'Password reset is temporarily unavailable. Please try again later.' });
    }
}

async function resetPassword(req, res) {
    try {
        const normalizedEmail = String(req.body.email || '').trim().toLowerCase();
        const otp = String(req.body.otp || '').trim();
        const password = req.body.password;
        if (!isValidEmail(normalizedEmail) || !/^\d{6}$/.test(otp) || typeof password !== 'string' || password.length < 8) {
            return res.status(400).json({ success: false, error: 'Enter the 6-digit code and a password of at least 8 characters.' });
        }
        const key = otpKey('password-reset', normalizedEmail);
        const record = otpStore.get(key);
        if (!record || Date.now() > record.expiresAt) {
            otpStore.delete(key);
            return res.status(400).json({ success: false, error: 'This reset code has expired. Request a new one.' });
        }
        record.attempts += 1;
        if (record.attempts > MAX_OTP_ATTEMPTS || !validOtp(record, otp)) {
            if (record.attempts > MAX_OTP_ATTEMPTS) otpStore.delete(key);
            return res.status(400).json({ success: false, error: 'Invalid reset code.' });
        }
        const updatedUser = await User.updatePassword(normalizedEmail, User.hashPassword(password));
        otpStore.delete(key);
        if (!updatedUser) return res.status(400).json({ success: false, error: 'Unable to reset this password.' });
        return res.json({ success: true, message: 'Password updated. You can now sign in.' });
    } catch (err) {
        console.error('[PASSWORD RESET ERROR]', { message: err.message });
        return res.status(500).json({ success: false, error: 'Unable to reset password. Please try again.' });
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
    requestPasswordReset,
    resetPassword,
    getStatus
};
