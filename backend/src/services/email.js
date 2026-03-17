import prisma from '../db/prisma.js';
import { Resend } from 'resend';

let resendClient = null;

function getResendClient() {
  if (resendClient) return resendClient;
  if (!process.env.RESEND_API_KEY) {
    throw new Error('Missing RESEND_API_KEY in backend environment');
  }
  resendClient = new Resend(process.env.RESEND_API_KEY);
  return resendClient;
}

    /**
     * Send an email using Resend
     */
    async function sendMail({ to, subject, html, text }) {
      try {
        const resend = getResendClient();
        const senderEmail = process.env.RESEND_SENDER_EMAIL;
        const senderName = process.env.RESEND_SENDER_NAME || 'AutoSpace';
        if (!senderEmail) {
          throw new Error('Missing RESEND_SENDER_EMAIL in backend environment');
        }

        await resend.emails.send({
          from: `${senderName} <${senderEmail}>`,
          to,
          subject,
          html,
          text,
        });
      } catch (err) {
        console.error(`[EMAIL] Failed to send email to ${to}:`, err);
        throw err;
      }
    }

// ─── HTML Email Templates ────────────────────────────────────────────

function baseTemplate(content) {
  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>AutoSpace</title>
</head>
<body style="margin:0;padding:0;background:#0A0F1D;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#0A0F1D;padding:40px 20px;">
    <tr>
      <td align="center">
        <table role="presentation" width="520" cellpadding="0" cellspacing="0" style="background:#111827;border-radius:16px;border:1px solid #1F2937;overflow:hidden;">
          <!-- Header -->
          <tr>
            <td style="padding:32px 40px 0;">
              <table role="presentation" cellpadding="0" cellspacing="0">
                <tr>
                  <td style="width:40px;height:40px;background:#F59E0B;border-radius:10px;text-align:center;vertical-align:middle;font-size:20px;">
                    &#9881;
                  </td>
                  <td style="padding-left:12px;font-size:20px;font-weight:800;color:#F3F4F6;letter-spacing:-0.5px;">
                    AutoSpace
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <!-- Content -->
          <tr>
            <td style="padding:32px 40px 40px;">
              ${content}
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="padding:20px 40px;border-top:1px solid #1F2937;">
              <p style="margin:0;font-size:12px;color:#6B7280;line-height:1.5;">
                This email was sent by AutoSpace. If you didn't request this, you can safely ignore it.
              </p>
              <p style="margin:8px 0 0;font-size:11px;color:#4B5563;">
                &copy; ${new Date().getFullYear()} AutoSpace &mdash; India's Auto Parts Platform
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

function otpEmailHtml(code) {
  return baseTemplate(`
    <h1 style="margin:0 0 8px;font-size:22px;font-weight:800;color:#F3F4F6;">
      Verify your email
    </h1>
    <p style="margin:0 0 28px;font-size:15px;color:#9CA3AF;line-height:1.6;">
      Enter this code to verify your email address and complete your registration.
    </p>
    <div style="background:#0A0F1D;border:2px solid #F59E0B;border-radius:12px;padding:20px;text-align:center;margin-bottom:28px;">
      <span style="font-size:36px;font-weight:800;letter-spacing:12px;color:#F59E0B;font-family:'Courier New',monospace;">
        ${code}
      </span>
    </div>
    <p style="margin:0 0 4px;font-size:13px;color:#6B7280;">
      This code expires in <strong style="color:#9CA3AF;">10 minutes</strong>.
    </p>
    <p style="margin:0;font-size:13px;color:#6B7280;">
      If you didn't create an account, ignore this email.
    </p>
  `);
}

function passwordResetHtml(resetUrl) {
  return baseTemplate(`
    <h1 style="margin:0 0 8px;font-size:22px;font-weight:800;color:#F3F4F6;">
      Reset your password
    </h1>
    <p style="margin:0 0 28px;font-size:15px;color:#9CA3AF;line-height:1.6;">
      We received a request to reset the password for your account. Click the button below to set a new password.
    </p>
    <div style="text-align:center;margin-bottom:28px;">
      <a href="${resetUrl}"
         style="display:inline-block;background:#F59E0B;color:#000;font-size:15px;font-weight:700;
                padding:14px 36px;border-radius:10px;text-decoration:none;letter-spacing:0.3px;">
        Reset Password
      </a>
    </div>
    <p style="margin:0 0 16px;font-size:13px;color:#6B7280;line-height:1.5;">
      Or copy and paste this link into your browser:
    </p>
    <div style="background:#0A0F1D;border-radius:8px;padding:12px 16px;margin-bottom:28px;word-break:break-all;">
      <a href="${resetUrl}" style="font-size:13px;color:#F59E0B;text-decoration:none;">
        ${resetUrl}
      </a>
    </div>
    <p style="margin:0 0 4px;font-size:13px;color:#6B7280;">
      This link expires in <strong style="color:#9CA3AF;">1 hour</strong>.
    </p>
    <p style="margin:0;font-size:13px;color:#6B7280;">
      If you didn't request a password reset, ignore this email. Your password won't change.
    </p>
  `);
}

function getFrontendAppUrl() {
  // Highest priority: dedicated reset route URL (can include path)
  if (process.env.RESET_PASSWORD_URL) {
    return process.env.RESET_PASSWORD_URL.trim().replace(/\/$/, '');
  }

  // Prefer explicit app URL for links sent over email.
  if (process.env.FRONTEND_APP_URL) {
    return process.env.FRONTEND_APP_URL.trim().replace(/\/$/, '');
  }

  // If FRONTEND_URL is a comma-separated allowlist (used for CORS), use the first one.
  const allowList = process.env.FRONTEND_URL || 'http://localhost:5173';
  const firstUrl = allowList.split(',').map((v) => v.trim()).filter(Boolean)[0] || 'http://localhost:5173';
  return firstUrl.replace(/\/$/, '');
}

function welcomeEmailHtml(name) {
  const displayName = name || 'there';
  return baseTemplate(`
    <h1 style="margin:0 0 8px;font-size:22px;font-weight:800;color:#F3F4F6;">
      Welcome to AutoSpace!
    </h1>
    <p style="margin:0 0 24px;font-size:15px;color:#9CA3AF;line-height:1.6;">
      Hey ${displayName}, your account is all set. Here's what you can do:
    </p>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:28px;">
      <tr>
        <td style="padding:12px 16px;background:#0A0F1D;border-radius:10px;margin-bottom:8px;">
          <p style="margin:0;font-size:14px;color:#F3F4F6;">
            <span style="color:#F59E0B;font-weight:700;">&#x1F50D; Browse Parts</span>
            &mdash; Find parts with guaranteed fitment for your vehicle
          </p>
        </td>
      </tr>
      <tr><td style="height:8px;"></td></tr>
      <tr>
        <td style="padding:12px 16px;background:#0A0F1D;border-radius:10px;">
          <p style="margin:0;font-size:14px;color:#F3F4F6;">
            <span style="color:#10B981;font-weight:700;">&#x1F3EA; Compare Shops</span>
            &mdash; Compare prices across local shops near you
          </p>
        </td>
      </tr>
      <tr><td style="height:8px;"></td></tr>
      <tr>
        <td style="padding:12px 16px;background:#0A0F1D;border-radius:10px;">
          <p style="margin:0;font-size:14px;color:#F3F4F6;">
            <span style="color:#38BDF8;font-weight:700;">&#x1F6D2; Order Online</span>
            &mdash; Get hyperlocal delivery from shops near you
          </p>
        </td>
      </tr>
    </table>
    <p style="margin:0;font-size:13px;color:#6B7280;">
      Need help? Just reply to this email.
    </p>
  `);
}

function passwordChangedHtml() {
  return baseTemplate(`
    <h1 style="margin:0 0 8px;font-size:22px;font-weight:800;color:#F3F4F6;">
      Password changed
    </h1>
    <p style="margin:0 0 24px;font-size:15px;color:#9CA3AF;line-height:1.6;">
      Your password was successfully changed. If you did this, no further action is needed.
    </p>
    <div style="background:#0A0F1D;border:1px solid #EF4444;border-radius:10px;padding:16px;margin-bottom:24px;">
      <p style="margin:0;font-size:14px;color:#EF4444;font-weight:600;">
        &#x26A0; Didn't change your password?
      </p>
      <p style="margin:8px 0 0;font-size:13px;color:#9CA3AF;line-height:1.5;">
        If you didn't make this change, your account may be compromised. Reset your password immediately and contact support.
      </p>
    </div>
  `);
}

// ─── Public API ──────────────────────────────────────────────────────

/**
 * Generate a 6-digit OTP, store in DB, and email it to the user.
 */
export async function sendEmailOtp(email) {
  const code = String(Math.floor(100000 + Math.random() * 900000));

  // Invalidate previous unused OTPs for this email
  await prisma.otpCode.updateMany({
    where: { email, type: 'EMAIL_VERIFY', used: false },
    data: { used: true },
  });

  await prisma.otpCode.create({
    data: {
      email,
      code,
      type: 'EMAIL_VERIFY',
      expiresAt: new Date(Date.now() + 10 * 60 * 1000), // 10 min
    },
  });

  await sendMail({
    to: email,
    subject: `${code} — Verify your AutoSpace email`,
    html: otpEmailHtml(code),
    text: `Your AutoSpace verification code is: ${code}\n\nThis code expires in 10 minutes. If you didn't request this, ignore this email.`,
  });

  return code;
}

/**
 * Verify an email OTP code.
 */
export async function verifyEmailOtp(email, code) {
  const otp = await prisma.otpCode.findFirst({
    where: {
      email,
      code,
      type: 'EMAIL_VERIFY',
      used: false,
      expiresAt: { gt: new Date() },
    },
    orderBy: { createdAt: 'desc' },
  });

  if (!otp) return { valid: false };

  await prisma.otpCode.update({
    where: { id: otp.id },
    data: { used: true },
  });

  return { valid: true };
}

/**
 * Send password reset email with a tokenized link.
 */
export async function sendPasswordResetEmail(email, token) {
  const frontendUrl = getFrontendAppUrl();
  const resetPath = frontendUrl.toLowerCase().includes('/reset-password')
    ? frontendUrl
    : `${frontendUrl}/reset-password`;
  const resetUrl = `${resetPath}?token=${token}`;

  await sendMail({
    to: email,
    subject: 'Reset your AutoSpace password',
    html: passwordResetHtml(resetUrl),
    text: `Reset your password by visiting: ${resetUrl}\n\nThis link expires in 1 hour. If you didn't request this, ignore this email.`,
  });
}

/**
 * Send welcome email after successful registration.
 */
export async function sendWelcomeEmail(email, name) {
  await sendMail({
    to: email,
    subject: `Welcome to AutoSpace${name ? `, ${name}` : ''}!`,
    html: welcomeEmailHtml(name),
    text: `Welcome to AutoSpace${name ? `, ${name}` : ''}! Your account is ready. Browse parts, compare shops, and order online.`,
  });
}

/**
 * Send notification when password is changed (security alert).
 */
export async function sendPasswordChangedEmail(email) {
  await sendMail({
    to: email,
    subject: 'Your AutoSpace password was changed',
    html: passwordChangedHtml(),
    text: `Your AutoSpace password was successfully changed. If you didn't do this, your account may be compromised. Reset your password immediately.`,
  });
}
