// Faux Wave pour les tests de bout en bout — Joliba (D-125). Écoute sur 127.0.0.1:4020.
//
// Il répond comme la documentation (https://docs.wave.com/checkout, /balance-api), et c'est le
// VRAI adaptateur de Joliba qui lui parle : le backend local le désigne par WAVE_API_URL, honorée
// seulement sur un backend local avec JOLIBA_FAKE_PAYMENTS=1 (scripts/e2e-env.sh).
//
// Il joue aussi l'application Wave du client : `wave_launch_url` mène à une page « Payer » qui,
// une fois touchée, marque la session payée, envoie le webhook SIGNÉ au format Wave à l'adresse
// que le test lui a donnée (comme le gérant la colle dans le portail Wave), puis renvoie le
// navigateur vers `success_url`. Routes de pilotage du test sous /__test/.
import { createHmac } from "node:crypto";
import { createServer } from "node:http";

const sessions = new Map();
const config = { webhookUrl: null, secret: null };
let lastBody = null;
let seq = 0;
let creates = 0;

const json = (res, status, body) => {
  res.writeHead(status, { "content-type": "application/json" });
  res.end(JSON.stringify(body));
};
const view = ({ completedDay: _d, refunded: _r, apiKey: _k, ...s }) => s;

async function sendWebhook(body, { secret = config.secret, at = Date.now(), signed = body } = {}) {
  if (!config.webhookUrl) return 0;
  const t = Math.floor(at / 1000);
  // `signed` : ce que la signature couvre. Différent de `body` = un corps altéré en route.
  const signature = createHmac("sha256", secret).update(`${t}${signed}`).digest("hex");
  const response = await fetch(config.webhookUrl, { method: "POST", headers: { "Content-Type": "application/json", "Wave-Signature": `t=${t},v1=${signature}` }, body });
  return response.status;
}

async function readBody(req) {
  let body = "";
  for await (const chunk of req) body += chunk;
  return body;
}

createServer(async (req, res) => {
  const url = new URL(req.url, "http://127.0.0.1:4020");
  const path = url.pathname;
  try {
    // ── Pilotage du test ──
    if (path === "/__test/config" && req.method === "POST") {
      Object.assign(config, JSON.parse(await readBody(req)));
      return json(res, 200, { ok: true });
    }
    if (path === "/__test/test-event" && req.method === "POST") {
      return json(res, 200, { status: await sendWebhook(JSON.stringify({ id: `EV_test_${++seq}`, type: "test.test_event" })) });
    }
    if (path === "/__test/replay" && req.method === "POST") {
      return json(res, 200, { status: lastBody ? await sendWebhook(lastBody) : 0 });
    }
    if (path === "/__test/forged" && req.method === "POST") {
      // Un corps altéré (montant réécrit) sous la signature du corps d'origine : Joliba doit refuser.
      const body = lastBody ?? "{}";
      return json(res, 200, { status: await sendWebhook(body.replace(/"amount":"\d+"/, '"amount":"1"'), { signed: body }) });
    }
    if (path === "/__test/state") {
      return json(res, 200, { sessions: [...sessions.values()].map(view), creates });
    }

    // ── La page de paiement Wave du client ──
    const page = /^\/checkout\/([^/]+)(\/pay)?$/.exec(path);
    if (page) {
      const s = sessions.get(page[1]);
      if (!s) return json(res, 404, { code: "not-found" });
      if (req.method === "GET") {
        res.writeHead(200, { "content-type": "text/html; charset=utf-8" });
        return res.end(`<!doctype html><html lang="fr"><title>Wave (faux)</title><body><h1>Wave (faux)</h1><p>Montant : ${s.amount} ${s.currency}</p>
<form method="post" action="/checkout/${s.id}/pay"><button>Payer</button></form><p><a href="${s.error_url}">Annuler</a></p></body></html>`);
      }
      if (s.checkout_status === "open") {
        s.checkout_status = "complete";
        s.payment_status = "succeeded";
        s.transaction_id = `TFAUX${++seq}`;
        s.when_completed = new Date().toISOString();
        s.completedDay = s.when_completed.slice(0, 10);
        lastBody = JSON.stringify({ id: `EV_${++seq}`, type: "checkout.session.completed", data: view(s) });
        await sendWebhook(lastBody);
      }
      res.writeHead(303, { location: s.success_url });
      return res.end();
    }

    // ── L'API Wave ──
    const auth = req.headers.authorization ?? "";
    if (!auth.startsWith("Bearer wave_")) return json(res, 401, { code: "invalid-auth", message: "…" });
    // Comme chez Wave, une clé ne voit que le portefeuille qui l'a émise.
    const apiKey = auth.slice("Bearer ".length);
    if (path === "/v1/balance") return json(res, 200, { amount: "100000", currency: "XOF" });
    if (path === "/v1/checkout/sessions" && req.method === "POST") {
      const body = JSON.parse(await readBody(req));
      if (!/^\d+$/.test(body.amount)) return json(res, 400, { code: "request-validation-error", message: "Decimal places are not allowed for XOF currency amounts" });
      creates += 1;
      const id = `cos-e2e${++seq}`;
      const s = {
        id,
        amount: body.amount,
        currency: body.currency,
        client_reference: body.client_reference ?? null,
        checkout_status: "open",
        payment_status: "processing",
        transaction_id: null,
        when_completed: null,
        when_expires: new Date(Date.now() + 30 * 60_000).toISOString(),
        wave_launch_url: `http://127.0.0.1:4020/checkout/${id}`,
        success_url: body.success_url,
        error_url: body.error_url,
        last_payment_error: null,
        apiKey,
      };
      sessions.set(id, s);
      return json(res, 200, view(s));
    }
    if (path === "/v1/checkout/sessions/search") {
      const ref = url.searchParams.get("client_reference");
      return json(res, 200, { result: [...sessions.values()].filter((s) => s.apiKey === apiKey && s.client_reference === ref).map(view) });
    }
    const one = /^\/v1\/checkout\/sessions\/([^/]+)(\/(expire|refund))?$/.exec(path);
    if (one) {
      const s = sessions.get(one[1]);
      if (!s || s.apiKey !== apiKey) return json(res, 404, { code: "not-found" });
      if (!one[3]) return json(res, 200, view(s));
      if (one[3] === "expire") {
        if (s.checkout_status !== "open") return json(res, 409, { code: "checkout-session-not-open" });
        s.checkout_status = "expired";
        return json(res, 200, {});
      }
      s.refunded = true;
      return json(res, 200, {});
    }
    if (path === "/v1/transactions") {
      const day = url.searchParams.get("date");
      const items = [...sessions.values()]
        .filter((s) => s.apiKey === apiKey && s.completedDay === day)
        .map((s) => ({
          timestamp: s.when_completed,
          transaction_id: s.transaction_id,
          transaction_type: "api_checkout",
          amount: s.amount,
          fee: String(Math.round(Number(s.amount) / 100)),
          currency: s.currency,
          is_reversal: false,
          checkout_api_session_id: s.id,
          client_reference: s.client_reference,
        }));
      return json(res, 200, { page_info: { start_cursor: null, end_cursor: null, has_next_page: false }, date: day, items });
    }
    return json(res, 404, { code: "not-found" });
  } catch (error) {
    json(res, 500, { code: "sink-error", message: String(error) });
  }
}).listen(4020, "127.0.0.1");
