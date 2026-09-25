/**
 * PIN de service et codes à usage unique — Joliba (D-060)
 *
 * Règles pures, testées sans base : forme du PIN, codes interdits, fenêtres d'échec. Le hachage
 * est un HMAC-SHA256 sous `PIN_PEPPER`, secret de l'environnement Convex : sans lui, les 10 000
 * PIN possibles se testeraient en une fraction de seconde sur une base volée.
 */

export const PIN_LENGTH = 4;

/** Échecs par membre : 5 en 15 minutes verrouillent 15 minutes, sur tous les appareils. */
export const MEMBER_FAILURE_WINDOW_MS = 15 * 60_000;
export const MEMBER_FAILURES_BEFORE_LOCK = 5;
export const MEMBER_LOCK_MS = 15 * 60_000;
/** 10 échecs depuis la dernière réussite désactivent le PIN : un gérant doit le réinitialiser. */
export const MEMBER_FAILURES_BEFORE_DISABLE = 10;

/** Échecs par appareil, tous membres confondus : la signature de qui essaie les codes des autres. */
export const DEVICE_FAILURE_WINDOW_MS = 60 * 60_000;
export const DEVICE_FAILURES_BEFORE_SUSPEND = 15;
export const DEVICE_SUSPEND_MS = 30 * 60_000;

export const ENROLLMENT_CODE_TTL_MS = 10 * 60_000;
export const ACTIVATION_CODE_TTL_MS = 24 * 60 * 60_000;

/** Les codes les plus essayés : suites, répétitions, motifs du clavier, années. */
const COMMON = new Set(["1212", "2121", "1122", "2211", "1313", "2580", "0852", "1004", "4004", "6969", "1010", "0101", "7777", "1379", "1470", "0007"]);

/** `null` si le PIN est acceptable, sinon la raison, dite à l'employé. */
export function pinProblem(pin: string): string | null {
  if (!new RegExp(`^\\d{${PIN_LENGTH}}$`).test(pin)) return `Le PIN compte exactement ${PIN_LENGTH} chiffres.`;
  const digits = [...pin].map(Number);
  const allSame = digits.every((d) => d === digits[0]);
  const step = digits[1]! - digits[0]!;
  const sequence = Math.abs(step) === 1 && digits.every((d, i) => i === 0 || d - digits[i - 1]! === step);
  const year = /^(19|20)\d\d$/.test(pin);
  if (allSame || sequence || year || COMMON.has(pin)) return "Ce code est trop facile à deviner. Choisissez-en un autre.";
  return null;
}

function hex(buffer: ArrayBuffer): string {
  return Array.from(new Uint8Array(buffer), (b) => b.toString(16).padStart(2, "0")).join("");
}

function pepper(): string {
  const secret = process.env.PIN_PEPPER;
  if (!secret || secret.length < 16) throw new Error("PIN_PEPPER manquant : `pnpm exec convex env set PIN_PEPPER <secret aléatoire>`.");
  return secret;
}

export async function hmacHex(value: string): Promise<string> {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(pepper()), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return hex(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(value)));
}

/** Lié au membre : le même PIN chez deux personnes ne donne pas la même empreinte. */
export function hashPin(memberId: string, pin: string): Promise<string> {
  return hmacHex(`pin:${memberId}:${pin}`);
}

export function hashCode(kind: "enroll" | "activate", code: string): Promise<string> {
  return hmacHex(`${kind}:${normalizeCode(code)}`);
}

/** Comparaison en temps constant de deux empreintes de même longueur. */
export function sameDigest(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

/* ────────────────────────────────────────────────────────────────────────────
 * Codes à usage unique : 8 caractères, dictés ou recopiés
 * ──────────────────────────────────────────────────────────────────────────── */

/** 32 signes sans ambiguïté à l'écrit ni à l'oral : ni 0/O, ni 1/I. 8 signes = 40 bits. */
const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
export const CODE_LENGTH = 8;

export function generateCode(): string {
  const bytes = new Uint8Array(CODE_LENGTH);
  crypto.getRandomValues(bytes);
  // 256 est un multiple de 32 : le modulo ne biaise rien.
  return [...bytes].map((b) => CODE_ALPHABET[b % CODE_ALPHABET.length]).join("");
}

/** « ABCD-EFGH » pour l'affichage. */
export function formatCode(code: string): string {
  return `${code.slice(0, 4)}-${code.slice(4)}`;
}

/** Tolère espaces, tirets et minuscules ; ramène les confusions courantes (O→0 n'existe pas ici). */
export function normalizeCode(input: string): string {
  return input.toUpperCase().replace(/[^A-Z0-9]/g, "");
}

export function isWellFormedCode(input: string): boolean {
  const code = normalizeCode(input);
  return code.length === CODE_LENGTH && [...code].every((c) => CODE_ALPHABET.includes(c));
}

/* ────────────────────────────────────────────────────────────────────────────
 * Fenêtres d'échec
 * ──────────────────────────────────────────────────────────────────────────── */

/** Les échecs encore dans la fenêtre, plus celui-ci. */
export function withFailure(recent: readonly number[], now: number, windowMs: number): number[] {
  return [...recent.filter((t) => now - t < windowMs), now];
}

export type MemberFailureOutcome = {
  recentFailures: number[];
  failuresSinceSuccess: number;
  lockedUntil?: number;
  disabled: boolean;
};

export function memberFailure(
  credential: { recentFailures: readonly number[]; failuresSinceSuccess: number },
  now: number,
): MemberFailureOutcome {
  const recentFailures = withFailure(credential.recentFailures, now, MEMBER_FAILURE_WINDOW_MS);
  const failuresSinceSuccess = credential.failuresSinceSuccess + 1;
  return {
    recentFailures,
    failuresSinceSuccess,
    ...(recentFailures.length >= MEMBER_FAILURES_BEFORE_LOCK ? { lockedUntil: now + MEMBER_LOCK_MS } : {}),
    disabled: failuresSinceSuccess >= MEMBER_FAILURES_BEFORE_DISABLE,
  };
}

export function deviceFailure(recent: readonly number[], now: number): { recentPinFailures: number[]; pinSuspendedUntil?: number } {
  const recentPinFailures = withFailure(recent, now, DEVICE_FAILURE_WINDOW_MS);
  return {
    recentPinFailures,
    ...(recentPinFailures.length >= DEVICE_FAILURES_BEFORE_SUSPEND ? { pinSuspendedUntil: now + DEVICE_SUSPEND_MS } : {}),
  };
}
