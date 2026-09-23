import { readFileSync } from "node:fs";

/** Lit le dernier e-mail reçu par le faux serveur de courrier pour une adresse. */
export async function lastEmailTo(address: string, since: number): Promise<{ subject: string; text: string }> {
  const file = process.env.MAIL_SINK;
  if (!file) throw new Error("MAIL_SINK doit désigner le fichier du faux serveur de courrier.");
  for (let attempt = 0; attempt < 40; attempt++) {
    const lines = readFileSync(file, "utf8").split("\n").filter(Boolean).slice(since);
    const match = lines
      .map((line) => JSON.parse(line) as { to?: string[]; subject: string; text: string })
      .filter((mail) => mail.to?.includes(address))
      .at(-1);
    if (match) return match;
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error(`Aucun e-mail reçu pour ${address}.`);
}

export function mailCount(): number {
  const file = process.env.MAIL_SINK;
  if (!file) return 0;
  return readFileSync(file, "utf8").split("\n").filter(Boolean).length;
}

/**
 * Une IP distincte par client simulé (plage réservée à la documentation, RFC 5737). La
 * limite de débit de Better Auth est PAR IP : sans cet en-tête, tous les tests partageraient
 * un seul compteur et déborderaient au hasard.
 */
export function clientHeaders(): Record<string, string> {
  return { "x-forwarded-for": `203.0.113.${1 + Math.floor(Math.random() * 254)}` };
}
