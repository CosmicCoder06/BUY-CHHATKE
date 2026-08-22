const nodemailer = require('nodemailer');

let cachedTransporter = null;
let etherealAccount = null;

/**
 * Initializes or returns the cached Nodemailer transport.
 */
async function getTransporter() {
    if (cachedTransporter) return cachedTransporter;

    // Option 1: Gmail Service with App Password
    const gmailUser = process.env.GMAIL_USER || process.env.EMAIL_USER;
    const gmailPass = process.env.GMAIL_APP_PASSWORD || process.env.EMAIL_PASS;

    if (gmailUser && gmailPass) {
        console.log(`[EMAIL SERVICE] Configured Gmail SMTP for ${gmailUser}`);
        cachedTransporter = nodemailer.createTransport({
            service: 'gmail',
            auth: {
                user: gmailUser,
                pass: gmailPass
            }
        });
        return cachedTransporter;
    }

    // Option 2: Generic Custom SMTP (Brevo, SendGrid, Mailgun, AWS SES, etc.)
    if (process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS) {
        const port = parseInt(process.env.SMTP_PORT || '587', 10);
        console.log(`[EMAIL SERVICE] Configured Custom SMTP (${process.env.SMTP_HOST}:${port})`);
        cachedTransporter = nodemailer.createTransport({
            host: process.env.SMTP_HOST,
            port: port,
            secure: process.env.SMTP_SECURE === 'true' || port === 465,
            auth: {
                user: process.env.SMTP_USER,
                pass: process.env.SMTP_PASS
            }
        });
        return cachedTransporter;
    }

    // Option 3: Automated Ethereal Test Account fallback
    console.log('[EMAIL SERVICE] No SMTP credentials in .env. Initializing test SMTP account...');
    try {
        if (!etherealAccount) {
            etherealAccount = await nodemailer.createTestAccount();
        }
        cachedTransporter = nodemailer.createTransport({
            host: etherealAccount.smtp.host,
            port: etherealAccount.smtp.port,
            secure: etherealAccount.smtp.secure,
            auth: {
                user: etherealAccount.user,
                pass: etherealAccount.pass
            }
        });
        console.log(`[EMAIL SERVICE] Test SMTP ready. Account: ${etherealAccount.user}`);
        return cachedTransporter;
    } catch (err) {
        console.error('[EMAIL SERVICE] Failed to create test account:', err.message);
        throw err;
    }
}

/**
 * Sends a 6-digit OTP verification email to the user.
 * @param {Object} options
 * @param {string} options.to - Recipient email address
 * @param {string} options.name - Recipient user name
 * @param {string} options.otp - 6-digit OTP verification code
 */
async function sendOtpEmail({ to, name = 'Valued User', otp }) {
    const transporter = await getTransporter();
    const fromAddress = process.env.EMAIL_FROM || process.env.GMAIL_USER || process.env.SMTP_USER || '"Smart Buy Assistant" <no-reply@buychhatke.ai>';

    const htmlContent = `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Email Verification - Smart Buy Assistant</title>
      <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #0a0e17; color: #f8fafc; margin: 0; padding: 24px 12px; }
        .email-wrapper { max-width: 520px; margin: 0 auto; background: #0d1322; border: 1px solid rgba(255, 255, 255, 0.12); border-radius: 16px; overflow: hidden; box-shadow: 0 12px 36px rgba(0,0,0,0.5); }
        .email-header { background: linear-gradient(135deg, #1e1b4b, #0f172a); padding: 32px 24px; text-align: center; border-bottom: 1px solid rgba(255, 255, 255, 0.08); }
        .logo-title { font-size: 20px; font-weight: 800; color: #ffffff; letter-spacing: -0.02em; margin: 0; }
        .logo-accent { color: #06b6d4; }
        .email-body { padding: 32px 28px; background: #0d1322; }
        .greeting { font-size: 18px; font-weight: 700; color: #ffffff; margin-top: 0; margin-bottom: 12px; }
        .msg-text { font-size: 14px; line-height: 1.6; color: #94a3b8; margin-bottom: 24px; }
        .otp-container { background: #131b2e; border: 2px dashed rgba(6, 182, 212, 0.4); border-radius: 12px; padding: 20px; text-align: center; margin: 24px 0; }
        .otp-label { font-size: 11px; font-weight: 700; letter-spacing: 0.12em; color: #06b6d4; text-transform: uppercase; margin-bottom: 6px; }
        .otp-code { font-family: 'Courier New', Courier, monospace; font-size: 36px; font-weight: 900; letter-spacing: 8px; color: #ffffff; margin: 0; }
        .notice-box { background: rgba(245, 158, 11, 0.08); border: 1px solid rgba(245, 158, 11, 0.25); border-radius: 8px; padding: 12px 16px; font-size: 12px; color: #fcd34d; margin-top: 24px; }
        .email-footer { background: #080d17; padding: 20px 24px; text-align: center; border-top: 1px solid rgba(255, 255, 255, 0.06); font-size: 12px; color: #64748b; }
      </style>
    </head>
    <body>
      <div class="email-wrapper">
        <div class="email-header">
          <h1 class="logo-title">SMART BUY <span class="logo-accent">ASSISTANT</span></h1>
        </div>
        <div class="email-body">
          <p class="greeting">Hello ${name},</p>
          <p class="msg-text">Thank you for creating an account with Smart Buy Assistant. To complete your registration and activate automated price drop alerts, please use the 6-digit verification code below:</p>
          
          <div class="otp-container">
            <div class="otp-label">Verification Code</div>
            <div class="otp-code">${otp}</div>
          </div>

          <div class="notice-box">
            ⏱️ <strong>Note:</strong> This verification code is valid for <strong>10 minutes</strong>. If you did not initiate this request, please safely ignore this email.
          </div>
        </div>
        <div class="email-footer">
          &copy; ${new Date().getFullYear()} Smart Buy Assistant AI. Autonomous Price Tracking & Intelligence.
        </div>
      </div>
    </body>
    </html>
    `;

    const mailOptions = {
        from: fromAddress,
        to: to,
        subject: `${otp} is your Smart Buy Assistant Verification Code`,
        text: `Hello ${name},\n\nYour 6-digit verification code for Smart Buy Assistant is: ${otp}\n\nThis code will expire in 10 minutes.\n\nThank you,\nSmart Buy Assistant Team`,
        html: htmlContent
    };

    const info = await transporter.sendMail(mailOptions);
    console.log(`[EMAIL DISPATCH] Email sent to: ${to} | Message ID: ${info.messageId}`);

    let previewUrl = null;
    const isRealInbox = Boolean(process.env.GMAIL_USER || process.env.SMTP_USER);

    if (!isRealInbox && nodemailer.getTestMessageUrl(info)) {
        previewUrl = nodemailer.getTestMessageUrl(info);
        console.log(`[EMAIL PREVIEW] View dispatched test email here: ${previewUrl}`);
    }

    return {
        success: true,
        messageId: info.messageId,
        previewUrl,
        sentToRealInbox: isRealInbox
    };
}

module.exports = {
    sendOtpEmail,
    getTransporter
};
