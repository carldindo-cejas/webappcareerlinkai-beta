// Resend-backed transactional email sender.
// Uses fetch directly so we don't pull in the Resend SDK (smaller worker bundle).

type EmailEnv = {
  RESEND_API_KEY: string;
  RESEND_FROM_EMAIL: string;
  RESEND_FROM_NAME: string;
};

type SendArgs = {
  to: string;
  subject: string;
  html: string;
  text: string;
};

export type SendResult =
  | { ok: true }
  | { ok: false; testModeBlocked: boolean; status: number; error: string };

export async function sendEmail(env: EmailEnv, args: SendArgs): Promise<SendResult> {
  if (!env.RESEND_API_KEY) {
    console.warn('[email] RESEND_API_KEY not set — email not sent. Subject:', args.subject, '→', args.to);
    return { ok: false, testModeBlocked: false, status: 0, error: 'RESEND_API_KEY not configured' };
  }
  const from = env.RESEND_FROM_NAME
    ? `${env.RESEND_FROM_NAME} <${env.RESEND_FROM_EMAIL}>`
    : env.RESEND_FROM_EMAIL;

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${env.RESEND_API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      from,
      to: [args.to],
      subject: args.subject,
      html: args.html,
      text: args.text
    })
  });

  if (res.ok) return { ok: true };

  const detail = await res.text().catch(() => '');
  console.error('[email] Resend send failed', res.status, detail);
  // Resend rejects with 403 + "testing emails to your own email address" when using
  // onboarding@resend.dev to send to addresses other than the account owner's.
  const lower = detail.toLowerCase();
  const testModeBlocked =
    res.status === 403 &&
    (lower.includes('testing emails') ||
      lower.includes('verify a domain') ||
      lower.includes('only send'));
  return { ok: false, testModeBlocked, status: res.status, error: detail || `HTTP ${res.status}` };
}

// ---- Email templates ----

const BASE_STYLES = `
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif;
  color: #1F4D3F;
  line-height: 1.5;
`;

const BUTTON_STYLES = `
  display: inline-block;
  background: #1F4D3F;
  color: #FBF8F2 !important;
  padding: 12px 24px;
  border-radius: 999px;
  text-decoration: none;
  font-weight: 500;
  margin: 16px 0;
`;

export function passwordResetEmail({ name, resetUrl }: { name: string; resetUrl: string }): { subject: string; html: string; text: string } {
  const subject = 'Reset your CareerLinkAI password';
  const html = `
    <div style="${BASE_STYLES} max-width: 560px; margin: 0 auto; padding: 32px 24px;">
      <h1 style="font-size: 22px; margin: 0 0 16px;">Reset your password</h1>
      <p>Hi ${escapeHtml(name)},</p>
      <p>We received a request to reset your CareerLinkAI password. Click the button below to set a new one:</p>
      <p><a href="${resetUrl}" style="${BUTTON_STYLES}">Reset password</a></p>
      <p style="color: #6B665C; font-size: 14px;">This link expires in 1 hour. If you didn't ask for a password reset, you can safely ignore this email.</p>
      <p style="color: #6B665C; font-size: 13px; word-break: break-all;">If the button doesn't work, copy this URL into your browser:<br>${resetUrl}</p>
    </div>
  `;
  const text = [
    `Hi ${name},`,
    '',
    'We received a request to reset your CareerLinkAI password. Click the link below to set a new one:',
    '',
    resetUrl,
    '',
    'This link expires in 1 hour. If you didn\'t ask for a password reset, you can safely ignore this email.'
  ].join('\n');
  return { subject, html, text };
}

export function verificationEmail({ name, verifyUrl }: { name: string; verifyUrl: string }): { subject: string; html: string; text: string } {
  const subject = 'Verify your CareerLinkAI account';
  const html = `
    <div style="${BASE_STYLES} max-width: 560px; margin: 0 auto; padding: 32px 24px;">
      <h1 style="font-size: 22px; margin: 0 0 16px;">Welcome to CareerLinkAI</h1>
      <p>Hi ${escapeHtml(name)},</p>
      <p>Thanks for signing up. Please verify your email so we know it's really you:</p>
      <p><a href="${verifyUrl}" style="${BUTTON_STYLES}">Verify email</a></p>
      <p style="color: #6B665C; font-size: 14px;">This link expires in 24 hours.</p>
      <p style="color: #6B665C; font-size: 13px; word-break: break-all;">If the button doesn't work, copy this URL into your browser:<br>${verifyUrl}</p>
    </div>
  `;
  const text = [
    `Hi ${name},`,
    '',
    'Thanks for signing up to CareerLinkAI. Please verify your email by visiting the link below:',
    '',
    verifyUrl,
    '',
    'This link expires in 24 hours.'
  ].join('\n');
  return { subject, html, text };
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
