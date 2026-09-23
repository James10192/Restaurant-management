/**
 * Jetons d'opérateur — Joliba (D-060)
 *
 * Un appareil enrôlé (écran de cuisine, tablette partagée) n'a pas de compte Better Auth : le
 * serveur qui s'y identifie par son PIN non plus. Convex les authentifie par un SECOND
 * fournisseur `customJwt`, à côté de Better Auth (`convex/auth.config.ts`) : c'est Convex lui-même
 * qui signe, en ES256, des jetons de 10 minutes dont le sujet désigne une session d'opérateur
 * (`op:<id>`) ou un appareil sans humain (`dev:<id>`).
 *
 * La clé privée ne vit que dans l'environnement Convex (`OPERATOR_JWT_PRIVATE_KEY`, JWK) ; la clé
 * publique est livrée à la configuration d'authentification en ligne (`OPERATOR_JWKS`), sans URL
 * à joindre. `node scripts/operator-keys.mjs` fabrique les deux.
 *
 * Toutes les gardes revérifient la session et l'appareil à chaque appel : le jeton ne prouve que
 * « c'était vrai il y a moins de 10 minutes ».
 */

export const OPERATOR_AUDIENCE = "joliba-operator";
export const OPERATOR_TOKEN_TTL_SECONDS = 600;

export function operatorIssuer(): string {
  const site = process.env.CONVEX_SITE_URL;
  if (!site) throw new Error("CONVEX_SITE_URL manquant.");
  return `${site}/operator`;
}

export function isOperatorIssuer(issuer: string): boolean {
  const site = process.env.CONVEX_SITE_URL;
  return site !== undefined && issuer === `${site}/operator`;
}

export type OperatorSubject = { kind: "operator"; id: string } | { kind: "device"; id: string };

export function operatorSubject(subject: OperatorSubject): string {
  return `${subject.kind === "operator" ? "op" : "dev"}:${subject.id}`;
}

/** Lit un sujet ; `null` pour tout ce qui n'est pas de notre émetteur ou mal formé. */
export function parseOperatorSubject(issuer: string, subject: string): OperatorSubject | null {
  if (!isOperatorIssuer(issuer)) return null;
  const match = /^(op|dev):([a-z0-9]+)$/.exec(subject);
  if (!match) return null;
  return { kind: match[1] === "op" ? "operator" : "device", id: match[2]! };
}

function base64url(bytes: Uint8Array | string): string {
  const data = typeof bytes === "string" ? new TextEncoder().encode(bytes) : bytes;
  let binary = "";
  for (const b of data) binary += String.fromCharCode(b);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

let cachedKey: { raw: string; key: CryptoKey; kid: string } | null = null;

async function signingKey(): Promise<{ key: CryptoKey; kid: string }> {
  const raw = process.env.OPERATOR_JWT_PRIVATE_KEY;
  if (!raw) throw new Error("OPERATOR_JWT_PRIVATE_KEY manquant : lancez `node scripts/operator-keys.mjs`.");
  if (cachedKey?.raw === raw) return cachedKey;
  const jwk = JSON.parse(raw) as JsonWebKey & { kid?: string };
  const key = await crypto.subtle.importKey("jwk", jwk, { name: "ECDSA", namedCurve: "P-256" }, false, ["sign"]);
  cachedKey = { raw, key, kid: jwk.kid ?? "operator" };
  return cachedKey;
}

/** Signe un jeton ES256 pour ce sujet. Réservé aux actions (horloge et crypto réelles). */
export async function signOperatorJwt(subject: OperatorSubject, now = Date.now()): Promise<{ token: string; expiresAt: number }> {
  const { key, kid } = await signingKey();
  const iat = Math.floor(now / 1000);
  const exp = iat + OPERATOR_TOKEN_TTL_SECONDS;
  const header = base64url(JSON.stringify({ alg: "ES256", typ: "JWT", kid }));
  const payload = base64url(
    JSON.stringify({ iss: operatorIssuer(), aud: OPERATOR_AUDIENCE, sub: operatorSubject(subject), iat, exp }),
  );
  const signature = await crypto.subtle.sign({ name: "ECDSA", hash: "SHA-256" }, key, new TextEncoder().encode(`${header}.${payload}`));
  return { token: `${header}.${payload}.${base64url(new Uint8Array(signature))}`, expiresAt: exp * 1000 };
}
