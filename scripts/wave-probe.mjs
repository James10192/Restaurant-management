#!/usr/bin/env node
/**
 * L'essai réel Wave à 100 FCFA — Joliba (D-128)
 *
 * Wave n'a pas d'environnement de test : avant de proposer le paiement en ligne aux clients d'un
 * restaurant, son titulaire paie 100 FCFA avec SON téléphone, puis ce script les rembourse. Il
 * parle directement à l'API Wave, sans passer par Joliba, et note ce que Wave répond vraiment :
 * la forme des montants, l'état d'une session après paiement, la recherche par notre référence,
 * le remboursement, et ce que montre le relevé du jour.
 *
 * La clé se donne par l'environnement, jamais en argument (elle finirait dans l'historique du
 * terminal) ; elle n'est jamais affichée ni écrite.
 *
 *     WAVE_API_KEY=wave_ci_prod_… node scripts/wave-probe.mjs --retour https://joliba.example/merci
 *
 * Options :
 *   --retour <https://…>   adresse de retour après paiement (https, obligatoire chez Wave)
 *   --sans-remboursement   ne pas rembourser (pour lire un remboursement fait à la main)
 *   --rapport <fichier>    écrire les constats en JSON (sans aucun secret)
 *
 * Coût : 100 FCFA et la commission Wave, remboursés sauf la commission si Wave la garde — c'est
 * l'une des questions que l'essai tranche.
 */

import { writeFileSync } from "node:fs";
import { createInterface } from "node:readline/promises";
import { stdin, stdout } from "node:process";

const API = "https://api.wave.com";
const AMOUNT = "100";

const args = process.argv.slice(2);
const option = (name) => {
  const i = args.indexOf(name);
  return i === -1 ? null : (args[i + 1] ?? null);
};
const retour = option("--retour");
const rapport = option("--rapport");
const refundIt = !args.includes("--sans-remboursement");

const key = process.env.WAVE_API_KEY ?? "";
if (!/^wave_[a-z]{2}_(prod|test)_/.test(key)) {
  console.error("WAVE_API_KEY absente ou mal formée (attendue : wave_ci_prod_…). Elle se passe par l'environnement.");
  process.exit(1);
}
if (!retour || !/^https:\/\//.test(retour)) {
  console.error("--retour <https://…> est obligatoire : Wave refuse une adresse de retour qui n'est pas en https.");
  process.exit(1);
}

const findings = { startedAt: new Date().toISOString(), steps: [] };
const note = (step, data) => {
  findings.steps.push({ step, at: new Date().toISOString(), ...data });
  console.log(`\n— ${step}`);
  for (const [k, v] of Object.entries(data)) console.log(`  ${k} : ${typeof v === "string" ? v : JSON.stringify(v)}`);
};

/** La forme d'une réponse, sans ses valeurs : ce que l'adaptateur doit savoir lire. */
function shape(value) {
  if (Array.isArray(value)) return value.length ? [shape(value[0])] : [];
  if (value && typeof value === "object") return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, shape(v)]));
  return value === null ? "null" : typeof value;
}

async function wave(method, path, body) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15_000);
  try {
    const res = await fetch(`${API}${path}`, {
      method,
      headers: { Authorization: `Bearer ${key}`, ...(body ? { "Content-Type": "application/json" } : {}) },
      ...(body ? { body: JSON.stringify(body) } : {}),
      signal: controller.signal,
    });
    const text = await res.text();
    let json = null;
    try {
      json = text ? JSON.parse(text) : null;
    } catch {
      json = { nonJson: text.slice(0, 200) };
    }
    return { status: res.status, json };
  } finally {
    clearTimeout(timer);
  }
}

const rl = createInterface({ input: stdin, output: stdout });
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

try {
  // 1. La clé répond-elle, et a-t-elle le droit « Solde » (rapprochement) ?
  const balance = await wave("GET", "/v1/balance");
  note("Solde (droit « Balance & Reconciliation »)", { status: balance.status, forme: shape(balance.json) });
  if (balance.status === 401) throw new Error("Clé refusée par Wave.");

  // 2. Une session à 100 FCFA, avec une référence à nous.
  const reference = `jp_probe_${Date.now().toString(36)}`;
  const created = await wave("POST", "/v1/checkout/sessions", {
    amount: AMOUNT,
    currency: "XOF",
    client_reference: reference,
    success_url: `${retour}${retour.includes("?") ? "&" : "?"}paiement=retour`,
    error_url: `${retour}${retour.includes("?") ? "&" : "?"}paiement=erreur`,
  });
  note("Création de la session", { status: created.status, forme: shape(created.json), montant: created.json?.amount ?? null });
  if (created.status !== 200 || !created.json?.id) throw new Error(`Création refusée : ${JSON.stringify(created.json)}`);
  const id = created.json.id;

  console.log(`\nPayez ${AMOUNT} FCFA avec votre téléphone, depuis cette adresse :\n\n  ${created.json.wave_launch_url}\n`);
  console.log("Notez : dans quel navigateur le retour s'ouvre, et ce qui se passe si vous ouvrez l'adresse sur un AUTRE appareil.");
  await rl.question("Appuyez sur Entrée une fois le paiement fait (ou abandonné)… ");

  // 3. L'état de la session, jusqu'à ce qu'elle soit payée (10 min au plus).
  let session = null;
  for (let i = 0; i < 120; i++) {
    const read = await wave("GET", `/v1/checkout/sessions/${id}`);
    session = read.json;
    if (session?.payment_status === "succeeded" || session?.checkout_status !== "open") break;
    await wait(5_000);
  }
  note("Session après paiement", {
    checkout_status: session?.checkout_status ?? null,
    payment_status: session?.payment_status ?? null,
    montant: session?.amount ?? null,
    when_completed: session?.when_completed ?? null,
    last_payment_error: session?.last_payment_error ?? null,
    forme: shape(session),
  });

  // 4. Retrouver la session par notre référence (le filet de D-119).
  const search = await wave("GET", `/v1/checkout/sessions/search?client_reference=${encodeURIComponent(reference)}`);
  note("Recherche par notre référence", { status: search.status, trouvées: search.json?.result?.length ?? null, forme: shape(search.json) });

  // 5. Le remboursement, total.
  if (refundIt && session?.payment_status === "succeeded") {
    const refund = await wave("POST", `/v1/checkout/sessions/${id}/refund`);
    note("Remboursement", { status: refund.status, réponse: refund.json });
    const again = await wave("POST", `/v1/checkout/sessions/${id}/refund`);
    note("Remboursement demandé une seconde fois (idempotent ?)", { status: again.status, réponse: again.json });
  }

  // 6. Le relevé du jour : la transaction y est-elle, avec quelle commission, et le remboursement ?
  const day = new Date().toISOString().slice(0, 10);
  const transactions = await wave("GET", `/v1/transactions?date=${day}`);
  const mine = (transactions.json?.items ?? []).filter((t) => t.checkout_api_session_id === id || t.client_reference === reference);
  note("Relevé du jour (UTC)", {
    status: transactions.status,
    lignes_de_cet_essai: mine.map((t) => ({ type: t.transaction_type, montant: t.amount, commission: t.fee, reversal: t.is_reversal, heure: t.timestamp })),
    forme: shape(transactions.json),
  });
  if (mine.length === 0) console.log("  Rien encore au relevé : relancez dans une heure, puis demain, pour mesurer le délai d'apparition.");
} catch (error) {
  note("Arrêt", { erreur: error instanceof Error ? error.message : String(error) });
  process.exitCode = 1;
} finally {
  rl.close();
  if (rapport) {
    writeFileSync(rapport, JSON.stringify(findings, null, 2));
    console.log(`\nConstats écrits dans ${rapport} (aucun secret).`);
  }
}
