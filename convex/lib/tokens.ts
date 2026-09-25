/**
 * Jetons opaques — Joliba
 *
 * Un jeton d'invitation (ou d'appareil) est généré avec 32 octets d'aléa cryptographique,
 * encodé en base64url, et seul son SHA-256 est stocké. Qui lit la base ne peut pas
 * rejoindre une organisation ; qui détient le lien, si.
 */

export function generateToken(bytes = 32): string {
  const buf = new Uint8Array(bytes);
  crypto.getRandomValues(buf);
  let binary = "";
  for (const b of buf) binary += String.fromCharCode(b);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export async function sha256Hex(value: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0")).join("");
}
