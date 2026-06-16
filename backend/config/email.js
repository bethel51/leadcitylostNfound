const https = require('https');

/**
 * Send email via Brevo Transactional Email HTTP API (port 443 — never blocked).
 * Docs: https://developers.brevo.com/reference/sendtransacemail
 *
 * Spam-prevention best practices applied:
 *  - replyTo header set
 *  - Both htmlContent AND textContent provided (plain-text fallback)
 *  - Proper sender name to build trust
 */
const sendEmail = async ({ to, subject, html, text }) => {
  const senderEmail = process.env.SMTP_SENDER || '2bethel4u@gmail.com';
  const senderName = process.env.SMTP_FROM_NAME || 'LCU FindMe Portal';

  const payload = JSON.stringify({
    sender: {
      name: senderName,
      email: senderEmail
    },
    to: [{ email: to }],
    replyTo: {
      name: senderName,
      email: senderEmail
    },
    subject,
    htmlContent: html,
    textContent: text || html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim(),
    headers: {
      'X-Mailer': 'LCU-FindMe-Portal/1.0',
      'Precedence': 'bulk'
    }
  });

  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'api.brevo.com',
      path: '/v3/smtp/email',
      method: 'POST',
      headers: {
        'accept': 'application/json',
        'api-key': process.env.BREVO_API_KEY,
        'content-type': 'application/json',
        'content-length': Buffer.byteLength(payload)
      }
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          resolve(JSON.parse(data));
        } else {
          reject(new Error(`Brevo API error ${res.statusCode}: ${data}`));
        }
      });
    });

    req.on('error', reject);
    req.write(payload);
    req.end();
  });
};

const sendVerificationEmail = async (email, otp) => {
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 8px;">
      <h2 style="color: #2563eb; text-align: center;">LCU FindMe — Verify Your Account</h2>
      <p>Hello,</p>
      <p>Thank you for registering on the LCU Lost and Found Portal. Use the verification OTP code below to complete your registration:</p>
      <div style="text-align: center; margin: 30px 0;">
        <span style="font-size: 2.2rem; font-weight: 800; letter-spacing: 5px; color: #1e293b; background: #f1f5f9; padding: 10px 24px; border-radius: 4px; border: 1px solid #cbd5e1;">${otp}</span>
      </div>
      <p style="color: #64748b; font-size: 0.85rem;">This code is valid for 15 minutes. If you did not create this account, please ignore this email.</p>
      <hr style="border: 0; border-top: 1px solid #e2e8f0; margin-top: 30px;">
      <p style="text-align: center; font-size: 0.8rem; color: #94a3b8;">&copy; 2026 Lead City University Security Unit</p>
    </div>
  `;
  const text = `LCU FindMe — Verify Your Account\n\nHello,\n\nThank you for registering on the LCU Lost and Found Portal.\nYour verification code is: ${otp}\n\nThis code is valid for 15 minutes. If you did not create this account, please ignore this email.\n\n© 2026 Lead City University Security Unit`;

  await sendEmail({ to: email, subject: 'Verify your LCU FindMe Account', html, text });
};

const sendResetEmail = async (email, otp) => {
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 8px;">
      <h2 style="color: #2563eb; text-align: center;">LCU FindMe — Password Reset Request</h2>
      <p>Hello,</p>
      <p>We received a request to reset your password. Use the OTP code below to authorize this password reset:</p>
      <div style="text-align: center; margin: 30px 0;">
        <span style="font-size: 2.2rem; font-weight: 800; letter-spacing: 5px; color: #dc2626; background: #fef2f2; padding: 10px 24px; border-radius: 4px; border: 1px solid #fca5a5;">${otp}</span>
      </div>
      <p style="color: #64748b; font-size: 0.85rem;">This code is valid for 10 minutes. If you did not request this, please change your security settings immediately.</p>
      <hr style="border: 0; border-top: 1px solid #e2e8f0; margin-top: 30px;">
      <p style="text-align: center; font-size: 0.8rem; color: #94a3b8;">&copy; 2026 Lead City University Security Unit</p>
    </div>
  `;
  const text = `LCU FindMe — Password Reset Request\n\nHello,\n\nWe received a request to reset your password.\nYour password reset code is: ${otp}\n\nThis code is valid for 10 minutes. If you did not request this, please change your security settings immediately.\n\n© 2026 Lead City University Security Unit`;

  await sendEmail({ to: email, subject: 'Reset your LCU FindMe Password', html, text });
};

module.exports = { sendVerificationEmail, sendResetEmail };
