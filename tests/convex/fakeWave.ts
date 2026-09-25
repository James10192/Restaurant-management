/**
 * Le faux Wave — T5 (D-125).
 *
 * Wave n'a pas d'environnement de test documenté : sans faux serveur, rien n'est testable. Celui-ci
 * répond comme la documentation (https://docs.wave.com/checkout, /balance-api), et c'est le VRAI
 * adaptateur (`convex/lib/providers/wave.ts`) qui lui parle, par `fetch`. Il compte les appels,
 * pour prouver qu'un double appui ne crée qu'une session.
 *
 * Il sait aussi tricher comme le réseau : perdre la réponse d'une création réussie, être
 * injoignable, refuser un remboursement.
 */

import { vi } from "vitest";
import { signatureHeader } from "../../convex/lib/waveSignature";

type Session = {
  id: string;
  amount: string;
  currency: string;
  client_reference: string | null;
  checkout_status: "open" | "complete" | "expired";
  payment_status: "processing" | "cancelled" | "succeeded";
  transaction_id: string | null;
  when_completed: string | null;
  when_expires: string;
  wave_launch_url: string;
  last_payment_error: { code: string; message: string } | null;
  refunded: boolean;
};

export type FakeWave = ReturnType<typeof installFakeWave>;

export function installFakeWave(options: { apiKey?: string } = {}) {
  const sessions = new Map<string, Session>();
  const calls: { method: string; path: string }[] = [];
  const transactions: Record<string, unknown[]> = {};
  const behaviour = {
    apiKey: options.apiKey ?? "wave_ci_prod_cle_de_test_du_maquis_awa",
    balanceAccess: true,
    /** La prochaine création réussit chez Wave, mais la réponse se perd. */
    loseNextCreateResponse: false,
    unreachable: false,
    refundFails: false,
    /** Le montant que Wave dira avoir encaissé, s'il diffère (D-028). */
    chargeOverride: null as string | null,
  };
  let seq = 0;
  const original = globalThis.fetch;

  const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
  const view = (s: Session) => {
    const { refunded: _r, ...rest } = s;
    return rest;
  };

  async function handle(url: URL, init: RequestInit | undefined): Promise<Response> {
    const method = (init?.method ?? "GET").toUpperCase();
    calls.push({ method, path: url.pathname });
    if (behaviour.unreachable) throw new TypeError("fetch failed");
    const auth = new Headers(init?.headers).get("authorization");
    if (auth !== `Bearer ${behaviour.apiKey}`) return json({ code: "invalid-auth", message: "…" }, 401);
    const path = url.pathname;
    if (method === "GET" && path === "/v1/balance") {
      return behaviour.balanceAccess ? json({ amount: "10245", currency: "XOF" }) : json({ code: "missing-permission", message: "…" }, 403);
    }
    if (method === "POST" && path === "/v1/checkout/sessions") {
      const body = JSON.parse(String(init?.body)) as Record<string, string>;
      if (!/^\d+$/.test(body.amount ?? "")) return json({ code: "request-validation-error", message: "Decimal places are not allowed for XOF currency amounts" }, 400);
      const id = `cos-faux${++seq}`;
      const session: Session = {
        id,
        amount: behaviour.chargeOverride ?? body.amount!,
        currency: body.currency!,
        client_reference: body.client_reference ?? null,
        checkout_status: "open",
        payment_status: "processing",
        transaction_id: null,
        when_completed: null,
        when_expires: new Date(Date.now() + 30 * 60_000).toISOString(),
        wave_launch_url: `https://pay.wave.com/c/${id}`,
        last_payment_error: null,
        refunded: false,
      };
      sessions.set(id, session);
      if (behaviour.loseNextCreateResponse) {
        behaviour.loseNextCreateResponse = false;
        throw new TypeError("fetch failed");
      }
      return json(view(session));
    }
    if (method === "GET" && path === "/v1/checkout/sessions/search") {
      const ref = url.searchParams.get("client_reference");
      return json({ result: [...sessions.values()].filter((s) => s.client_reference === ref).map(view) });
    }
    const one = /^\/v1\/checkout\/sessions\/([^/]+)(\/(expire|refund))?$/.exec(path);
    if (one) {
      const session = sessions.get(decodeURIComponent(one[1]!));
      if (!session) return json({ code: "not-found", message: "…" }, 404);
      if (method === "GET" && !one[3]) return json(view(session));
      if (method === "POST" && one[3] === "expire") {
        if (session.checkout_status !== "open") return json({ code: "checkout-session-not-open", message: "…" }, 409);
        session.checkout_status = "expired";
        session.payment_status = "cancelled";
        return json({});
      }
      if (method === "POST" && one[3] === "refund") {
        if (behaviour.refundFails) return json({ code: "checkout-refund-failed", message: "insufficient balance" }, 400);
        session.refunded = true;
        return json({});
      }
    }
    if (method === "GET" && path === "/v1/transactions") {
      return json({ page_info: { start_cursor: null, end_cursor: null, has_next_page: false }, date: url.searchParams.get("date"), items: transactions[url.searchParams.get("date") ?? ""] ?? [] });
    }
    return json({ code: "not-found", message: "…" }, 404);
  }

  vi.stubGlobal("fetch", async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(typeof input === "string" ? input : input instanceof URL ? input.href : input.url);
    if (url.hostname === "api.wave.com") return handle(url, init);
    return original(input, init);
  });

  return {
    behaviour,
    sessions,
    calls,
    transactions,
    creates: () => calls.filter((c) => c.method === "POST" && c.path === "/v1/checkout/sessions").length,
    /** Le client paie chez Wave. */
    pay(id: string) {
      const s = sessions.get(id)!;
      s.checkout_status = "complete";
      s.payment_status = "succeeded";
      s.transaction_id = `TFAUX${id.slice(-3).toUpperCase()}${++seq}`;
      s.when_completed = new Date().toISOString();
      return s;
    },
    fail(id: string, code = "insufficient-funds") {
      const s = sessions.get(id)!;
      s.payment_status = "cancelled";
      s.last_payment_error = { code, message: "…" };
      return s;
    },
    expire(id: string) {
      const s = sessions.get(id)!;
      s.checkout_status = "expired";
      return s;
    },
    /** Le corps d'un événement, au format de la documentation. */
    event(id: string, type = "checkout.session.completed", eventId = `EV_${++seq}`) {
      return JSON.stringify({ id: eventId, type, data: view(sessions.get(id)!) });
    },
    /** Une transaction du relevé (`/v1/transactions`). */
    transaction(day: string, t: Record<string, unknown>) {
      (transactions[day] ??= []).push({ currency: "XOF", fee: "50", balance: "0", is_reversal: false, timestamp: `${day}T12:00:00Z`, ...t });
    },
    restore() {
      vi.unstubAllGlobals();
    },
  };
}

export async function signed(secret: string, body: string, at = Date.now()) {
  return { "Wave-Signature": await signatureHeader(secret, Math.floor(at / 1000), body), "Content-Type": "application/json" };
}
