/**
 * L'adaptateur Wave Côte d'Ivoire (API Checkout) — Joliba (D-109, D-111)
 *
 * Sources : https://docs.wave.com/checkout · /webhook · /balance-api · /business.
 * Ce qui y est écrit et que ce fichier respecte :
 *  - le montant est une CHAÎNE, sans décimale en XOF ;
 *  - `success_url` et `error_url` sont obligatoires, en https ;
 *  - une session expire 30 min après sa création, sans réglage documenté ;
 *  - le remboursement est TOTAL, et idempotent chez Wave (un second appel ne crée rien) ;
 *  - la création d'une session n'a AUCUN en-tête d'idempotence : le doublon se prévient en amont
 *    (bail et recherche par référence, D-119) ;
 *  - le relevé se lit par jour UTC, par pages de 1 000.
 *
 * Aucun journal n'écrit la clé, les en-têtes, le corps envoyé ni la réponse (D-127).
 */

import { parseProviderAmount, isSupportedCurrency, toProviderAmount } from "../money";
import { signatureHeader } from "../waveSignature";
import { ProviderError, type OnlinePaymentProvider, type ProviderSecrets, type ProviderSession, type ProviderTransaction } from "./types";

const TIMEOUT_MS = 10_000;

type Json = Record<string, unknown>;

function str(v: unknown): string | null {
  return typeof v === "string" && v.length > 0 ? v : null;
}

function time(v: unknown): number | null {
  const s = str(v);
  if (!s) return null;
  const t = Date.parse(s);
  return Number.isFinite(t) ? t : null;
}

/** Une session telle que Wave la décrit, traduite. */
export function readWaveSession(raw: unknown): ProviderSession {
  const s = (raw ?? {}) as Json;
  const providerRef = str(s.id);
  const currency = str(s.currency) ?? "";
  if (!providerRef) throw new ProviderError("invalid_response");
  const checkout = str(s.checkout_status);
  const payment = str(s.payment_status);
  const status: ProviderSession["status"] =
    payment === "succeeded" ? "succeeded" : checkout === "expired" ? "expired" : payment === "cancelled" || payment === "failed" || checkout === "failed" ? "failed_attempt" : "pending";
  const lastError = s.last_payment_error as Json | null | undefined;
  return {
    providerRef,
    reference: str(s.client_reference),
    status,
    amount: isSupportedCurrency(currency) ? parseProviderAmount(s.amount, currency) : null,
    currency,
    launchUrl: str(s.wave_launch_url),
    transactionId: str(s.transaction_id),
    paidAt: time(s.when_completed),
    expiresAt: time(s.when_expires),
    lastErrorCode: lastError && typeof lastError === "object" ? (str(lastError.code)?.slice(0, 60) ?? null) : null,
  };
}

function readTransaction(raw: unknown): ProviderTransaction | null {
  const t = (raw ?? {}) as Json;
  const id = str(t.transaction_id);
  const currency = str(t.currency) ?? "";
  if (!id || !isSupportedCurrency(currency)) return null;
  const signed = (v: unknown): number | null => {
    const text = typeof v === "number" ? String(v) : typeof v === "string" ? v.trim() : "";
    const negative = text.startsWith("-");
    const value = parseProviderAmount(negative ? text.slice(1) : text, currency);
    return value === null ? null : negative ? -value : value;
  };
  const amount = signed(t.amount);
  if (amount === null) return null;
  const type = str(t.transaction_type);
  return {
    transactionId: id,
    kind: type === "api_checkout" ? (t.is_reversal === true ? "checkout_refund" : "checkout") : type === "api_checkout_refund" ? "checkout_refund" : "other",
    amount,
    fee: Math.abs(signed(t.fee) ?? 0),
    currency,
    providerRef: str(t.checkout_api_session_id),
    reference: str(t.client_reference),
    at: time(t.timestamp) ?? 0,
  };
}

function errorCodeOf(body: unknown): string | null {
  const b = (body ?? {}) as Json;
  const nested = b.error as Json | undefined;
  return (str(b.code) ?? (nested && typeof nested === "object" ? str(nested.code) : null))?.slice(0, 60) ?? null;
}

export function createWaveProvider(secrets: ProviderSecrets, baseUrl: string): OnlinePaymentProvider {
  async function call(method: "GET" | "POST", path: string, body?: Json): Promise<unknown> {
    const payload = body === undefined ? "" : JSON.stringify(body);
    const headers: Record<string, string> = { Authorization: `Bearer ${secrets.apiKey}`, Accept: "application/json" };
    if (body !== undefined) headers["Content-Type"] = "application/json";
    if (secrets.requestSigningSecret) {
      headers["Wave-Signature"] = await signatureHeader(secrets.requestSigningSecret, Math.floor(Date.now() / 1000), payload);
    }
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
    let response: Response;
    try {
      response = await fetch(`${baseUrl}${path}`, { method, headers, ...(body !== undefined ? { body: payload } : {}), signal: controller.signal });
    } catch {
      throw new ProviderError("unreachable");
    } finally {
      clearTimeout(timer);
    }
    let parsed: unknown = null;
    try {
      parsed = await response.json();
    } catch {
      parsed = null;
    }
    if (response.ok) return parsed;
    const code = errorCodeOf(parsed);
    if (response.status === 401 || response.status === 403) throw new ProviderError("unauthorized", response.status, code);
    if (response.status === 404) throw new ProviderError("not_found", 404, code);
    if (response.status === 409) throw new ProviderError("conflict", 409, code);
    if (response.status === 429) throw new ProviderError("rate_limited", 429, code);
    if (response.status >= 500) throw new ProviderError("unreachable", response.status, code);
    throw new ProviderError("rejected", response.status, code);
  }

  return {
    key: "wave_ci",
    capabilities: { partialRefund: false, sandbox: false, currencies: ["XOF"] },

    async initialize(input) {
      if (!isSupportedCurrency(input.currency) || input.currency !== "XOF") throw new ProviderError("rejected", null, "unsupported-currency");
      const session = readWaveSession(
        await call("POST", "/v1/checkout/sessions", {
          amount: toProviderAmount(input.amount, input.currency),
          currency: input.currency,
          client_reference: input.reference,
          success_url: input.successUrl,
          error_url: input.errorUrl,
        }),
      );
      return session;
    },

    async findByReference(reference) {
      const body = (await call("GET", `/v1/checkout/sessions/search?client_reference=${encodeURIComponent(reference)}`)) as Json | null;
      const rows = Array.isArray(body?.result) ? (body.result as unknown[]) : [];
      return rows.map(readWaveSession).filter((s) => s.reference === reference);
    },

    async verify(providerRef) {
      return readWaveSession(await call("GET", `/v1/checkout/sessions/${encodeURIComponent(providerRef)}`));
    },

    async expire(providerRef) {
      try {
        await call("POST", `/v1/checkout/sessions/${encodeURIComponent(providerRef)}/expire`);
        return "expired";
      } catch (error) {
        if (error instanceof ProviderError && error.code === "conflict") return "already_final";
        throw error;
      }
    },

    async refund(providerRef) {
      await call("POST", `/v1/checkout/sessions/${encodeURIComponent(providerRef)}/refund`);
    },

    async transactionsOfDay(dayUtc) {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(dayUtc)) throw new ProviderError("rejected", null, "bad-date");
      const out: ProviderTransaction[] = [];
      let after: string | null = null;
      for (let page = 0; page < 50; page++) {
        const query = `date=${dayUtc}${after ? `&after=${encodeURIComponent(after)}` : ""}`;
        const body = (await call("GET", `/v1/transactions?${query}`)) as Json | null;
        for (const item of Array.isArray(body?.items) ? (body.items as unknown[]) : []) {
          const t = readTransaction(item);
          if (t) out.push(t);
        }
        const info = (body?.page_info ?? {}) as Json;
        after = info.has_next_page === true ? str(info.end_cursor) : null;
        if (!after) return out;
      }
      throw new ProviderError("invalid_response", null, "too-many-pages");
    },

    async testConnection() {
      try {
        await call("GET", "/v1/balance");
        return { balanceAccess: true };
      } catch (error) {
        // Une clé sans le droit « Solde » répond 403 : elle reste utilisable pour encaisser.
        if (error instanceof ProviderError && error.code === "unauthorized" && error.status === 403) return { balanceAccess: false };
        throw error;
      }
    },
  };
}

export type WaveEvent = {
  eventId: string;
  type: string;
  /** `checkout.session.completed` · `checkout.session.payment_failed` · `test.test_event` · autre. */
  kind: "session_completed" | "payment_failed" | "test" | "other";
  session: ProviderSession | null;
};

/** Un événement Wave, relu APRÈS vérification de la signature. `null` : corps illisible. */
export function readWaveEvent(body: string): WaveEvent | null {
  let parsed: Json;
  try {
    parsed = JSON.parse(body) as Json;
  } catch {
    return null;
  }
  if (!parsed || typeof parsed !== "object") return null;
  const eventId = str(parsed.id);
  const type = str(parsed.type);
  if (!eventId || !type || eventId.length > 100 || type.length > 100) return null;
  const kind: WaveEvent["kind"] =
    type === "checkout.session.completed" ? "session_completed" : type === "checkout.session.payment_failed" ? "payment_failed" : type === "test.test_event" ? "test" : "other";
  let session: ProviderSession | null = null;
  if (kind === "session_completed" || kind === "payment_failed") {
    try {
      session = readWaveSession(parsed.data);
    } catch {
      return null;
    }
  }
  return { eventId, type, kind, session };
}
