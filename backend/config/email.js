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

const sendWelcomeEmail = async (email, name) => {
  const html = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif; max-width: 600px; margin: auto; padding: 30px 24px; border: 1.5px solid #0f2b5c; border-radius: 12px; background-color: #ffffff; box-shadow: 0 4px 15px rgba(0,0,0,0.06);">
      <div style="text-align: center; border-bottom: 2px solid #0f2b5c; padding-bottom: 15px; margin-bottom: 20px;">
        <h1 style="color: #0f2b5c; margin: 0; font-size: 1.5rem; letter-spacing: 0.5px;">LEAD CITY UNIVERSITY</h1>
        <p style="color: #d4af37; font-weight: 700; margin: 4px 0 0 0; font-size: 0.85rem; text-transform: uppercase; letter-spacing: 1px;">Official Campus Lost &amp; Found Portal (LCU FindMe)</p>
      </div>

      <h2 style="color: #0f2b5c; text-align: center; margin-bottom: 15px; font-size: 1.35rem;">Welcome to LCU FindMe, ${name}! 🎉</h2>
      
      <p style="font-size: 0.95rem; color: #334155; line-height: 1.6;">
        Your student profile has been registered and verified on the official Lead City University item recovery network.
      </p>

      <!-- MANDATORY ACTIVATION NOTICE -->
      <div style="background: linear-gradient(135deg, #fef3c7 0%, #fffbeb 100%); border-left: 5px solid #d97706; border-radius: 8px; padding: 16px 18px; margin: 20px 0;">
        <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 6px;">
          <span style="font-size: 1.1rem;">🔒</span>
          <strong style="color: #92400e; font-size: 0.95rem; text-transform: uppercase; letter-spacing: 0.5px;">Action Required: One-Time Account Activation</strong>
        </div>
        <p style="margin: 0; font-size: 0.9rem; color: #78350f; line-height: 1.55;">
          To safeguard student identities, prevent false claims, and enable certified campus security passes, <strong>you must complete a one-time &#8358;3,000 security clearance fee via Interswitch / Quickteller</strong> before you can make or log item reports.
        </p>
      </div>

      <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 16px; margin: 20px 0;">
        <h4 style="margin: 0 0 10px 0; color: #0f2b5c; font-size: 0.92rem;">How to Activate Your Account:</h4>
        <ol style="margin: 0; padding-left: 20px; font-size: 0.88rem; color: #475569; line-height: 1.6;">
          <li>Log in to your dashboard at <a href="https://leadcitylostnfound.onrender.com" style="color: #1a56db; font-weight: 600;">leadcitylostnfound.onrender.com</a>.</li>
          <li>Click the <strong>"Pay &#8358;3,000 via Interswitch / Quickteller"</strong> button on your dashboard security gate.</li>
          <li>Complete your transaction using your Debit Card or Bank Transfer.</li>
          <li>Once paid, your account is <strong>permanently unlocked</strong> to log lost items, browse campus listings, and process recovery claims!</li>
        </ol>
      </div>

      <div style="text-align: center; margin: 25px 0;">
        <a href="https://leadcitylostnfound.onrender.com" style="display: inline-block; padding: 12px 32px; font-weight: 700; font-size: 0.95rem; color: #ffffff; background: #0f2b5c; text-decoration: none; border-radius: 8px; box-shadow: 0 4px 10px rgba(15, 43, 92, 0.25);">Login &amp; Activate Account</a>
      </div>

      <p style="font-size: 0.82rem; color: #64748b; line-height: 1.5; text-align: center;">
        Need assistance with payment or campus security clearance? Contact the Directorate of Campus Security or Student Affairs.
      </p>

      <hr style="border: 0; border-top: 1px solid #e2e8f0; margin: 25px 0 15px 0;">
      <p style="text-align: center; font-size: 0.78rem; color: #94a3b8; margin: 0;">
        &copy; 2026 Lead City University &bull; Directorate of Campus Security &amp; Information Systems
      </p>
    </div>
  `;

  const text = `LEAD CITY UNIVERSITY - LCU FindMe Portal\n\nWelcome to LCU FindMe, ${name}!\n\nYour student account has been successfully registered.\n\nACTION REQUIRED: ONE-TIME ACCOUNT ACTIVATION\nTo safeguard student identities, prevent false claims, and enable certified security passes, you must complete a one-time ₦3,000 security clearance fee via Interswitch / Quickteller before you can make or log reports.\n\nHOW TO ACTIVATE:\n1. Log in to your portal: https://leadcitylostnfound.onrender.com\n2. Complete the ₦3,000 clearance payment via Interswitch / Quickteller.\n3. Once confirmed, full access to report items and verify claims is permanently unlocked.\n\n© 2026 Lead City University Security Directorate`;

  await sendEmail({ to: email, subject: 'Welcome to LCU FindMe — Action Required: Account Activation', html, text });
};

const sendActivationEmail = async (email, otp, name = 'Student', refCode = '') => {
  const html = `
    <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 600px; margin: auto; padding: 25px; border: 1.5px solid #d4af37; border-radius: 12px; background: #ffffff; box-shadow: 0 4px 15px rgba(0, 33, 71, 0.08);">
      <div style="text-align: center; border-bottom: 2px solid #0f2b5c; padding-bottom: 15px; margin-bottom: 20px;">
        <h1 style="color: #0f2b5c; margin: 0; font-size: 1.6rem; letter-spacing: 0.5px;">LEAD CITY UNIVERSITY</h1>
        <p style="color: #d4af37; font-weight: 700; margin: 5px 0 0 0; font-size: 0.9rem; text-transform: uppercase; letter-spacing: 1.2px;">LCU FindMe Portal • Official Activation Key</p>
      </div>

      <p style="font-size: 1rem; color: #1e293b;">Hello <strong>${name}</strong>,</p>
      <p style="color: #334155; line-height: 1.6; font-size: 0.95rem;">
        Your payment for the <strong>LCU Student Portal Activation Key</strong> has been successfully authorized and recorded.
      </p>

      ${refCode ? `<div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; padding: 8px 14px; font-size: 0.85rem; color: #475569; margin: 15px 0;">
        <strong>Transaction Reference:</strong> <span style="font-family: monospace; color: #0f2b5c; font-weight: 700;">${refCode}</span>
      </div>` : ''}

      <div style="text-align: center; margin: 25px 0; background: linear-gradient(135deg, rgba(26, 86, 219, 0.06), rgba(212, 175, 55, 0.1)); padding: 20px; border-radius: 10px; border: 1.5px dashed #1a56db;">
        <div style="font-size: 0.82rem; font-weight: 700; color: #1a56db; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 8px;">Your 6-Digit Activation Code</div>
        <span style="font-size: 2.5rem; font-weight: 800; letter-spacing: 8px; color: #0f2b5c; font-family: 'Courier New', monospace; display: inline-block;">${otp}</span>
      </div>

      <div style="background: #eff6ff; border-left: 4px solid #1a56db; padding: 12px 16px; border-radius: 4px; margin: 20px 0;">
        <p style="margin: 0; font-size: 0.88rem; color: #1e40af; line-height: 1.5;">
          <strong>Next Step:</strong> Return to your LCU FindMe dashboard and enter this code in the activation OTP card to permanently unlock item reporting, claim processing, and security verification passes.
        </p>
      </div>

      <p style="color: #64748b; font-size: 0.82rem; margin-top: 20px;">
        ⏳ This activation code is valid for <strong>15 minutes</strong>. If you did not request this activation code, please notify the campus Security Office immediately.
      </p>

      <hr style="border: 0; border-top: 1px solid #e2e8f0; margin: 25px 0 15px 0;">
      <p style="text-align: center; font-size: 0.8rem; color: #94a3b8; margin: 0;">
        &copy; 2026 Lead City University • Security & Student Affairs Directorate
      </p>
    </div>
  `;

  const text = `LEAD CITY UNIVERSITY - LCU FindMe Activation Key\n\nHello ${name},\n\nYour one-time portal activation payment was received.\nYour Activation OTP Code is: ${otp}\n${refCode ? `Transaction Reference: ${refCode}\n` : ''}\nValid for 15 minutes. Enter this code on your dashboard to unlock all features.\n\n© 2026 Lead City University Security Directorate`;

  await sendEmail({ to: email, subject: 'Your LCU FindMe Account Activation Key', html, text });
};

const sendOfficialWelcomeEmail = async (email, name = 'Student') => {
  const html = `
    <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 600px; margin: auto; padding: 30px 25px; border: 1.5px solid #10b981; border-radius: 12px; background: #ffffff; box-shadow: 0 4px 15px rgba(0, 0, 0, 0.05);">
      <div style="text-align: center; margin-bottom: 20px;">
        <div style="font-size: 2.8rem; margin-bottom: 5px;">🎓</div>
        <h2 style="color: #0f2b5c; margin: 0 0 8px 0; font-size: 1.5rem;">Welcome to the official lost and found platform widely for Lead City University students!</h2>
        <span style="display: inline-block; background: #ecfdf5; color: #059669; font-weight: 700; font-size: 0.8rem; padding: 4px 12px; border-radius: 20px; border: 1px solid #a7f3d0; text-transform: uppercase; letter-spacing: 0.5px;">Account Fully Activated</span>
      </div>

      <p style="font-size: 1rem; color: #1e293b; line-height: 1.6;">Hello <strong>${name}</strong>,</p>
      <p style="font-size: 0.95rem; color: #334155; line-height: 1.6;">
        Congratulations! Your student account has been completely and successfully activated on the <strong>official Lead City University Lost &amp; Found Portal (LCU FindMe)</strong>.
      </p>

      <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 10px; padding: 18px; margin: 20px 0;">
        <h4 style="margin: 0 0 10px 0; color: #0f2b5c; font-size: 0.95rem;">You now have full access to:</h4>
        <ul style="margin: 0; padding-left: 20px; font-size: 0.9rem; color: #475569; line-height: 1.7;">
          <li><strong>Report Found or Lost Items:</strong> Instantly notify the campus community and security division.</li>
          <li><strong>Claim Verification:</strong> Request in-person claim verification at the Student Ambassador Unit.</li>
          <li><strong>Official Security Slips:</strong> Generate and print verified PDF security tags and QR passes.</li>
          <li><strong>Real-Time Notifications:</strong> Receive automated email alerts whenever a matching item is logged.</li>
        </ul>
      </div>

      <div style="text-align: center; margin: 30px 0;">
        <a href="https://leadcitylostnfound.onrender.com/dashboard.html" style="display: inline-block; padding: 12px 32px; font-weight: 700; font-size: 0.95rem; color: #ffffff; background: linear-gradient(135deg, #0f2b5c, #1a56db); text-decoration: none; border-radius: 8px; box-shadow: 0 4px 12px rgba(26, 86, 219, 0.3);">Go To Your Dashboard</a>
      </div>

      <p style="font-size: 0.85rem; color: #64748b; line-height: 1.5;">
        Remember to always carry your valid Student ID Card when collecting verified items at the Security Ambassador Unit.
      </p>

      <hr style="border: 0; border-top: 1px solid #e2e8f0; margin: 25px 0 15px 0;">
      <p style="text-align: center; font-size: 0.8rem; color: #94a3b8; margin: 0;">
        &copy; 2026 Lead City University • Security Directorate
      </p>
    </div>
  `;

  const text = `Welcome to the official lost and found platform widely for Lead City University students!\n\nHello ${name},\n\nYour account has been fully activated. You can now report items, verify claims, and access full portal services.\n\nAccess Dashboard: https://leadcitylostnfound.onrender.com/dashboard.html\n\n© 2026 Lead City University Security Directorate`;

  await sendEmail({ to: email, subject: 'Welcome to the Official LCU Lost & Found Platform!', html, text });
};

module.exports = { 
  sendVerificationEmail, 
  sendResetEmail, 
  sendWelcomeEmail, 
  sendActivationEmail, 
  sendOfficialWelcomeEmail 
};

