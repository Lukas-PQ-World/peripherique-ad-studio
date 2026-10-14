// Transaktions-Mails über die Resend-HTTP-API (resend.com). Ohne RESEND_API_KEY wird nur geloggt.
const APP = () => (process.env.APP_URL || '').replace(/\/$/, '');
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const layout = (title, body, cta, href) => `<!doctype html><html><body style="margin:0;background:#f4f3f8;font-family:Arial,sans-serif;color:#17161f">
<table width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:32px 16px">
<table width="520" cellpadding="0" cellspacing="0" style="max-width:520px;background:#ffffff;border-radius:14px"><tr><td style="padding:32px">
<p style="margin:0 0 20px;font-weight:bold;font-size:18px">Ad Studio</p>
<h1 style="margin:0 0 14px;font-size:22px">${esc(title)}</h1>
<p style="margin:0 0 24px;font-size:15px;line-height:1.5;color:#4a4858">${body}</p>
<a href="${href}" style="display:inline-block;background:#5b45f0;color:#ffffff;text-decoration:none;font-weight:bold;padding:12px 20px;border-radius:9px">${esc(cta)}</a>
<p style="margin:24px 0 0;font-size:12px;color:#8d8aa0">Falls der Button nicht funktioniert: ${esc(href)}</p>
</td></tr></table></td></tr></table></body></html>`;

export async function send(to, subject, html) {
  if (!process.env.RESEND_API_KEY) { console.log('[mail]', to, subject); return { logged: true }; }
  const r = await fetch('https://api.resend.com/emails', { method: 'POST', headers: { Authorization: 'Bearer ' + process.env.RESEND_API_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from: process.env.MAIL_FROM || 'Ad Studio <noreply@example.com>', to: [to], subject, html }) });
  if (!r.ok) throw new Error('Mail-Versand fehlgeschlagen: ' + (await r.text()));
  return r.json();
}
export const inviteMail = (to, orgName, inviter, role, token) => send(to, `Einladung zu ${orgName || 'Ad Studio'}`,
  layout('Du wurdest eingeladen', `${esc(inviter)} hat dich als <b>${esc(role)}</b> in das Team <b>${esc(orgName || 'Ad Studio')}</b> eingeladen.`, 'Einladung annehmen', `${APP()}?invite=${token}`));
export const resetMail = (to, token) => send(to, 'Passwort zurücksetzen',
  layout('Neues Passwort festlegen', 'Über den Button legst du ein neues Passwort fest. Der Link gilt eine Stunde. Wenn du das nicht angefordert hast, ignoriere diese Mail.', 'Passwort festlegen', `${APP()}?reset=${token}`));
