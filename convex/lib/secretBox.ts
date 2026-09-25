/**
 * Les secrets des fournisseurs de paiement, chiffrés — Joliba (D-117)
 *
 * AES-256-GCM, un vecteur d'initialisation aléatoire par valeur, et des données associées qui
 * lient le chiffré à SON compte et à SON champ : on ne peut ni déplacer la clé d'API d'un
 * restaurant vers un autre, ni la faire passer pour un secret de webhook.
 *
 * La clé maîtresse est une variable d'environnement Convex (`PAYMENT_SECRETS_KEY`, 32 octets en
 * base64), numérotée par `PAYMENT_SECRETS_KEY_VERSION`. Pendant une rotation,
 * `PAYMENT_SECRETS_KEY_PREVIOUS` ouvre encore les chiffrés de la version précédente.
 *
 * On ne chiffre QUE dans une action : l'aléa des requêtes et mutations est tiré d'un générateur
 * graine (documenté par Convex), et un IV répété sous la même clé ruinerait GCM.
 *
 * Ce que cela ne protège pas, écrit plutôt que caché (SECURITY.md) : qui détient à la fois
 * l'administration du déploiement Convex et la base lit tout.
 */

export type SecretField = "apiKey" | "webhookSecret" | "webhookSecretPrevious" | "requestSigningSecret";

export class SecretBoxError extends Error {}

function b64uEncode(bytes: Uint8Array): string {
  let binary = "";
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function b64uDecode(text: string): Uint8Array<ArrayBuffer> {
  const normal = text.replace(/-/g, "+").replace(/_/g, "/");
  const binary = atob(normal + "=".repeat((4 - (normal.length % 4)) % 4));
  const out = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) out[i] = binary.charCodeAt(i);
  return out;
}

type MasterKey = { version: number; raw: Uint8Array<ArrayBuffer> };

function readKey(value: string | undefined, version: number): MasterKey | null {
  if (!value) return null;
  let raw: Uint8Array<ArrayBuffer>;
  try {
    raw = b64uDecode(value.trim());
  } catch {
    throw new SecretBoxError("Clé maîtresse des secrets illisible (base64 attendu).");
  }
  if (raw.length !== 32) throw new SecretBoxError("La clé maîtresse des secrets doit faire 32 octets.");
  return { version, raw };
}

function masterKeys(): { current: MasterKey | null; previous: MasterKey | null } {
  const version = Number(process.env.PAYMENT_SECRETS_KEY_VERSION ?? "1");
  if (!Number.isInteger(version) || version < 1) throw new SecretBoxError("PAYMENT_SECRETS_KEY_VERSION invalide.");
  return {
    current: readKey(process.env.PAYMENT_SECRETS_KEY, version),
    previous: readKey(process.env.PAYMENT_SECRETS_KEY_PREVIOUS, version - 1),
  };
}

/** Le déploiement sait-il chiffrer ? Sans clé, l'écran de réglage le dit au lieu d'échouer. */
/** La version de la clé maîtresse en cours, ou `null` si aucune n'est réglée. */
export function currentKeyVersion(): number | null {
  try {
    return masterKeys().current?.version ?? null;
  } catch {
    return null;
  }
}

export function secretBoxConfigured(): boolean {
  try {
    return masterKeys().current !== null;
  } catch {
    return false;
  }
}

async function importKey(key: MasterKey): Promise<CryptoKey> {
  return crypto.subtle.importKey("raw", key.raw, { name: "AES-GCM" }, false, ["encrypt", "decrypt"]);
}

function additionalData(accountId: string, field: SecretField, version: number): Uint8Array<ArrayBuffer> {
  return new TextEncoder().encode(`joliba:${accountId}:${field}:${version}`);
}

/** `s1.<version>.<iv>.<chiffré>` */
export async function sealSecret(plaintext: string, where: { accountId: string; field: SecretField }): Promise<string> {
  const { current } = masterKeys();
  if (!current) throw new SecretBoxError("PAYMENT_SECRETS_KEY n'est pas réglée sur ce déploiement.");
  const iv = new Uint8Array(12);
  crypto.getRandomValues(iv);
  const cipher = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv, additionalData: additionalData(where.accountId, where.field, current.version) },
    await importKey(current),
    new TextEncoder().encode(plaintext),
  );
  return `s1.${current.version}.${b64uEncode(iv)}.${b64uEncode(new Uint8Array(cipher))}`;
}

/** Ouvre un chiffré. Lève si la clé manque, si le chiffré a été altéré ou déplacé. */
export async function openSecret(sealed: string, where: { accountId: string; field: SecretField }): Promise<string> {
  const parts = sealed.split(".");
  if (parts.length !== 4 || parts[0] !== "s1") throw new SecretBoxError("Secret chiffré illisible.");
  const version = Number(parts[1]);
  const { current, previous } = masterKeys();
  const key = current?.version === version ? current : previous?.version === version ? previous : null;
  if (!key) throw new SecretBoxError("Ce secret a été chiffré avec une clé maîtresse qui n'est plus réglée.");
  try {
    const plain = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv: b64uDecode(parts[2]!), additionalData: additionalData(where.accountId, where.field, version) },
      await importKey(key),
      b64uDecode(parts[3]!),
    );
    return new TextDecoder().decode(plain);
  } catch {
    throw new SecretBoxError("Secret chiffré refusé : altéré, déplacé, ou clé maîtresse différente.");
  }
}

/** La version de clé d'un chiffré : la rotation ré-encode ceux qui ne sont pas à la version courante. */
export function sealedVersion(sealed: string): number | null {
  const parts = sealed.split(".");
  return parts.length === 4 && parts[0] === "s1" ? Number(parts[1]) : null;
}

/** Les quatre derniers caractères, seul morceau d'un secret qu'un écran affiche. */
export function lastFour(secret: string): string {
  return secret.slice(-4);
}
