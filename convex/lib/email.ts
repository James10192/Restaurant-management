/**
 * Envoi d'e-mails transactionnels — Joliba
 *
 * Appel direct de l'API HTTP de Resend (https://resend.com/docs/api-reference/emails/send-email),
 * sans SDK : un `fetch` suffit et il n'ajoute aucune dépendance au runtime Convex.
 *
 * RÈGLE ABSOLUE : le contenu d'un e-mail n'est JAMAIS journalisé. Il contient un code de
 * connexion ou un lien d'invitation — les deux ouvrent un compte. En cas d'échec, on
 * journalise le statut HTTP et le destinataire masqué, rien d'autre.
 */

import { logEvent } from "./log";

export type EmailContent ={ subject: string; text: string; html: string };
export type OutgoingEmail = EmailContent & { to: string };

/** Durée de validité d'un code de connexion. Partagée avec la configuration Better Auth. */
export const OTP_TTL_SECONDS = 600;

export class EmailNotConfiguredError extends Error {
  constructor() {
    super("Envoi d'e-mails non configuré : RESEND_API_KEY et EMAIL_FROM sont requis.");
  }
}

export function isEmailConfigured(): boolean {
  return Boolean(process.env.RESEND_API_KEY && process.env.EMAIL_FROM);
}

/** `mariam.kone@exemple.ci` → `ma***@exemple.ci`. Pour les journaux, jamais pour l'envoi. */
export function maskEmail(email: string): string {
  const [local = "", domain = ""] = email.split("@");
  return `${local.slice(0, 2)}***@${domain}`;
}

export async function sendEmail(message: OutgoingEmail): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM;
  if (!apiKey || !from) throw new EmailNotConfiguredError();

  // `RESEND_API_URL` ne sert qu'aux tests de bout en bout (un faux serveur de courrier
  // local) : en production, la variable est absente et l'appel part chez Resend.
  const response = await fetch(process.env.RESEND_API_URL ?? "https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from, to: [message.to], subject: message.subject, text: message.text, html: message.html }),
  });
  if (!response.ok) {
    // Ni le destinataire, ni le contenu : le statut suffit à diagnostiquer.
    logEvent("error", "email.send_failed", { operation: "email.send", status: response.status });
    throw new Error(`Envoi d'e-mail refusé (HTTP ${response.status}).`);
  }
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** Gabarit sobre, lisible sans images, sans lien de suivi. */
function layout(title: string, bodyHtml: string): string {
  return `<!doctype html><html lang="fr"><body style="margin:0;padding:24px;background:#FAF8F5;font-family:system-ui,-apple-system,'Segoe UI',Roboto,sans-serif;color:#1B1714">
<div style="max-width:480px;margin:0 auto;background:#FFFFFF;border-radius:12px;padding:32px">
<p style="margin:0 0 24px;font-weight:700;font-size:18px;color:#0B6478">Joliba</p>
<h1 style="margin:0 0 16px;font-size:20px;line-height:1.3">${escapeHtml(title)}</h1>
${bodyHtml}
</div></body></html>`;
}

export function otpEmail(otp: string): EmailContent {
  const minutes = OTP_TTL_SECONDS / 60;
  return {
    subject: `Votre code de connexion Joliba : ${otp}`,
    text: `Votre code de connexion Joliba est ${otp}.\nIl est valable ${minutes} minutes.\n\nSi vous n'avez pas demandé ce code, ignorez ce message : personne ne peut se connecter sans lui.`,
    html: layout(
      "Votre code de connexion",
      `<p style="margin:0 0 16px">Saisissez ce code pour vous connecter. Il est valable ${minutes} minutes.</p>
<p style="margin:0 0 24px;font-size:32px;font-weight:700;letter-spacing:8px;font-variant-numeric:tabular-nums">${escapeHtml(otp)}</p>
<p style="margin:0;color:#4E4741;font-size:14px">Si vous n'avez pas demandé ce code, ignorez ce message : personne ne peut se connecter sans lui.</p>`,
    ),
  };
}

export function invitationEmail(args: {
  organizationName: string;
  inviterName: string;
  roleLabel: string;
  link: string;
}): EmailContent {
  const { organizationName, inviterName, roleLabel, link } = args;
  return {
    subject: `${inviterName} vous invite à rejoindre ${organizationName} sur Joliba`,
    text: `${inviterName} vous invite à rejoindre ${organizationName} sur Joliba, en tant que « ${roleLabel} ».\n\nAcceptez l'invitation : ${link}\n\nCe lien est personnel et expire dans 7 jours.`,
    html: layout(
      `Rejoindre ${organizationName}`,
      `<p style="margin:0 0 16px">${escapeHtml(inviterName)} vous invite à rejoindre <strong>${escapeHtml(organizationName)}</strong> en tant que « ${escapeHtml(roleLabel)} ».</p>
<p style="margin:0 0 24px"><a href="${escapeHtml(link)}" style="display:inline-block;background:#0B6478;color:#FFFFFF;text-decoration:none;padding:12px 20px;border-radius:8px;font-weight:600">Accepter l'invitation</a></p>
<p style="margin:0;color:#4E4741;font-size:14px">Ce lien est personnel et expire dans 7 jours.</p>`,
    ),
  };
}
