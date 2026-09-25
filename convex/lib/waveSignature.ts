/**
 * La signature Wave — Joliba (D-118)
 *
 * Wave signe chaque webhook dans l'en-tête `Wave-Signature: t=<horodatage>,v1=<hmac>[,v1=…]` :
 * HMAC-SHA256, en hexadécimal minuscule, de l'horodatage collé au CORPS BRUT, sans séparateur
 * (https://docs.wave.com/webhook, vecteur de test officiel repris dans les tests). Pendant une
 * rotation de secret, plusieurs `v1` arrivent : un seul valable suffit.
 *
 * Le corps n'est jamais ré-encodé : un JSON relu puis réécrit n'a plus la même signature.
 */

/** Wave rejette au-delà de 5 minutes ; nous aussi, dans les deux sens. */
export const WAVE_SIGNATURE_TOLERANCE_MS = 5 * 60 * 1000;

export function parseSignatureHeader(header: string | null | undefined): { timestamp: number; signatures: string[] } | null {
  if (!header || header.length > 2000) return null;
  let timestamp: number | null = null;
  const signatures: string[] = [];
  for (const part of header.split(",")) {
    const eq = part.indexOf("=");
    if (eq < 0) continue;
    const key = part.slice(0, eq).trim();
    const value = part.slice(eq + 1).trim();
    if (key === "t" && /^\d{1,12}$/.test(value)) timestamp = Number(value);
    else if (key === "v1" && /^[0-9a-f]{64}$/.test(value)) signatures.push(value);
  }
  return timestamp !== null && signatures.length > 0 ? { timestamp, signatures } : null;
}

function hexToBytes(hex: string): Uint8Array<ArrayBuffer> {
  const out = new Uint8Array(hex.length / 2);
  for (let i = 0; i < out.length; i++) out[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  return out;
}

async function hmacKey(secret: string, usage: "sign" | "verify"): Promise<CryptoKey> {
  return crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, [usage]);
}

/** La signature hexadécimale de `horodatage + corps`. Sert au faux serveur Wave et à la signature des requêtes. */
export async function waveSignature(secret: string, timestamp: number, body: string): Promise<string> {
  const mac = await crypto.subtle.sign("HMAC", await hmacKey(secret, "sign"), new TextEncoder().encode(`${timestamp}${body}`));
  return Array.from(new Uint8Array(mac), (b) => b.toString(16).padStart(2, "0")).join("");
}

export async function signatureHeader(secret: string, timestamp: number, body: string): Promise<string> {
  return `t=${timestamp},v1=${await waveSignature(secret, timestamp, body)}`;
}

/** `secretIndex` : lequel des secrets a signé (0 = le secret en cours, 1 = l'ancien, en rotation). */
export type SignatureCheck = { ok: true; secretIndex: number } | { ok: false; reason: "missing_signature" | "bad_signature" | "stale" };

/**
 * Vérifie un webhook. La comparaison passe par `subtle.verify` : temps constant, sans la réécrire
 * à la main. `secrets` : le secret actuel, et le précédent pendant une rotation.
 */
export async function verifyWaveSignature(input: { header: string | null | undefined; body: string; secrets: readonly string[]; now: number }): Promise<SignatureCheck> {
  const parsed = parseSignatureHeader(input.header);
  if (!parsed) return { ok: false, reason: "missing_signature" };
  if (Math.abs(input.now - parsed.timestamp * 1000) > WAVE_SIGNATURE_TOLERANCE_MS) return { ok: false, reason: "stale" };
  const data = new TextEncoder().encode(`${parsed.timestamp}${input.body}`);
  for (const [secretIndex, secret] of input.secrets.entries()) {
    if (!secret) continue;
    const key = await hmacKey(secret, "verify");
    for (const signature of parsed.signatures) {
      if (await crypto.subtle.verify("HMAC", key, hexToBytes(signature), data)) return { ok: true, secretIndex };
    }
  }
  return { ok: false, reason: "bad_signature" };
}
