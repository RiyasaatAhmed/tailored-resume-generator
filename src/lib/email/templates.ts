import type { EmailMessage } from "./mailer";

/**
 * Email templates.
 *
 * Deliberately plain: mail clients strip modern CSS, ignore custom fonts, and
 * several render dark backgrounds unpredictably. So this uses a light layout
 * with inline styles and system fonts rather than the app's black canvas and
 * licensed-substitute typefaces — the design system governs the app, not the
 * inbox. Every message ships a text part; some clients show only that, and a
 * verification mail with no readable link is a dead end.
 */

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function layout(heading: string, bodyHtml: string): string {
  return `<!doctype html>
<html lang="en"><body style="margin:0;padding:24px;background:#f5f5f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#1a1a1a;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;margin:0 auto;background:#ffffff;border:1px solid #e4e4e4;">
    <tr><td style="padding:32px;">
      <p style="margin:0 0 24px;font-size:12px;letter-spacing:4px;text-transform:uppercase;color:#666;">Tailored</p>
      <h1 style="margin:0 0 16px;font-size:20px;font-weight:600;">${escapeHtml(heading)}</h1>
      ${bodyHtml}
    </td></tr>
  </table>
</body></html>`;
}

export function verificationEmail(input: {
  to: string;
  verifyUrl: string;
}): EmailMessage {
  const url = input.verifyUrl;

  const text = [
    "Confirm your email",
    "",
    "Open this link to confirm your email address:",
    url,
    "",
    "The link expires in 24 hours.",
    "If you didn't create an account, ignore this message.",
  ].join("\n");

  const html = layout(
    "Confirm your email",
    `<p style="margin:0 0 24px;font-size:15px;line-height:1.5;">
       Confirm your email address to start generating resumes.
     </p>
     <p style="margin:0 0 24px;">
       <a href="${escapeHtml(url)}" style="display:inline-block;padding:12px 24px;background:#1a1a1a;color:#ffffff;text-decoration:none;font-size:14px;">Confirm email</a>
     </p>
     <p style="margin:0 0 8px;font-size:13px;color:#666;line-height:1.5;">
       Or paste this into your browser:<br>
       <span style="word-break:break-all;">${escapeHtml(url)}</span>
     </p>
     <p style="margin:24px 0 0;font-size:13px;color:#666;">
       The link expires in 24 hours. If you didn't create an account, ignore this message.
     </p>`,
  );

  return { to: input.to, subject: "Confirm your email", text, html };
}
