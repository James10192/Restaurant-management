/**
 * Le paiement en ligne — Joliba (tranche T5, D-110 à D-127)
 *
 * Le chemin de l'argent, du téléphone du client au rapprochement du lendemain :
 *
 *  1. Le convive ADMIS touche « Payer » : `guestStart` réserve une intention (montant relu et
 *     FIGÉ ici, jamais reçu du client — R14), pose un bail de 60 s, puis crée la session Wave.
 *     Une intention ouverte est réutilisée : double appui, réseau coupé, rechargement ne créent
 *     jamais une seconde session payable (D-119).
 *  2. Le client paie chez Wave. La vérité vient de Wave, jamais de la redirection (R15) :
 *     par le webhook signé (`processWebhookEvent`), ou par le rattrapage (`sweep`) qui revérifie
 *     les intentions en attente, parce que Wave écrit lui-même qu'un webhook peut se perdre.
 *  3. `confirmIntent` écrit le paiement par le cœur commun (`insertPayment`) — TOUJOURS, même sur
 *     une table close ou au-delà du dû : l'argent est parti du téléphone du client (D-115). Il
 *     est idempotent par la session Wave : webhook rejoué, vérification concurrente, rapprochement
 *     tardif retombent tous sur le même paiement.
 *  4. Le lendemain, `reconcileAll` relit le relevé Wave et classe chaque transaction (D-121).
 *
 * Aucune donnée du payeur n'est demandée, envoyée ni gardée (D-127).
 */

import { v } from "convex/values";
import { action, internalAction, internalMutation, internalQuery, mutation, query, type ActionCtx } from "./_generated/server";
import { internal } from "./_generated/api";
import type { Doc, Id } from "./_generated/dataModel";
import { formatAmount, loadSessionBilling } from "./lib/billing";
import { myRemainderShares } from "./lib/guestPayment";
import { getInVenue } from "./lib/catalogAccess";
import { invalid } from "./lib/errors";
import type { MutationCtx, ReadCtx } from "./lib/guards";
import { guestPresence, resolveGuestTable } from "./lib/guestTable";
import { expireOpenIntentsOf, isOpenIntent, openIntentsOfCheck, raiseAlert, resolveOverpaidIfCovered, undoCreatedCheck } from "./lib/intents";
import { logEvent } from "./lib/log";
import { ProviderError, type ProviderSession, type ProviderTransaction } from "./lib/providers/types";
import { rateLimiter } from "./lib/rateLimits";
import { requireServiceActor, requireServiceMutation } from "./lib/serviceActor";
import { isOpenSession } from "./lib/service";
import { generateToken } from "./lib/tokens";
import { writeAudit } from "./lib/audit";
import { activeAccountOf, providerFor } from "./paymentAccounts";
import { ensureRemainder, methodLabel, nextCheckReference } from "./checks";
import { insertPayment } from "./payments";
import { issueCreditNote } from "./bills";
import { memberOf } from "./cash";

/** Wave fait expirer une session 30 min après sa création, sans réglage documenté. */
export const INTENT_TTL_MS = 30 * 60 * 1000;
/** Le bail d'une création de session : au-delà, une autre tentative peut reprendre. */
export const INIT_LEASE_MS = 60_000;
/** Espacement des revérifications (D-120) : 90 s, 2, 5, 15, puis 35 min. */
const CHECK_DELAYS_MS = [90_000, 2 * 60_000, 5 * 60_000, 15 * 60_000, 35 * 60_000];
/** Au-delà de l'expiration, sans réponse de Wave : quelqu'un doit regarder. */
const UNREACHABLE_ALERT_AFTER_MS = 15 * 60 * 1000;
/**
 * Une session Wave expirée depuis plus que cette marge ne peut plus être payée : l'intention se
 * ferme ici même si Wave ne répond pas, pour ne pas geler la table (D-130).
 */
const EXPIRED_MARGIN_MS = 5 * 60 * 1000;
/** Une annulation que Wave ne confirme pas dans ce délai se ferme ici (D-130). */
const CANCEL_UNCONFIRMED_MS = 2 * 60 * 1000;

const KEY = /^[A-Za-z0-9_-]{16,64}$/;
const target = v.union(v.literal("remainder"), v.literal("my_items"));
const guestArgs = { pass: v.string(), venueSlug: v.string(), guestKey: v.string() };

function nextDelay(attempts: number): number {
  return CHECK_DELAYS_MS[Math.min(attempts, CHECK_DELAYS_MS.length - 1)]!;
}

const sessionFields = v.object({
  providerRef: v.string(),
  reference: v.union(v.string(), v.null()),
  status: v.union(v.literal("pending"), v.literal("succeeded"), v.literal("expired"), v.literal("failed_attempt")),
  amount: v.union(v.number(), v.null()),
  currency: v.string(),
  launchUrl: v.union(v.string(), v.null()),
  transactionId: v.union(v.string(), v.null()),
  paidAt: v.union(v.number(), v.null()),
  expiresAt: v.union(v.number(), v.null()),
  lastErrorCode: v.union(v.string(), v.null()),
});

/* ────────────────────────────────────────────────────────────────────────────
 * Le convive paie
 * ──────────────────────────────────────────────────────────────────────────── */

export type GuestPayReason =
  | "invalid_pass"
  | "not_available"
  | "table_not_open"
  | "code_required"
  | "removed"
  | "simulation"
  | "nothing_due"
  | "in_progress_elsewhere"
  | "rate_limited"
  | "key_reused"
  | "provider_unavailable";

export type GuestPayResult =
  | { ok: true; status: "ready"; launchUrl: string; amount: number; currency: string }
  /** Une autre tentative est en train de créer la session : relire dans un instant. */
  | { ok: true; status: "pending" }
  | { ok: true; status: "paid" }
  | { ok: false; reason: GuestPayReason };

type Reserved =
  | { kind: "done"; result: GuestPayResult }
  | { kind: "init"; intentId: Id<"paymentIntents">; accountId: Id<"paymentProviderAccounts">; reference: string; amount: number; currency: string; venueSlug: string; searchFirst: boolean };

function describe(intent: Doc<"paymentIntents">): GuestPayResult {
  if (intent.status === "succeeded") return { ok: true, status: "paid" };
  if (intent.status === "processing" && intent.launchUrl) return { ok: true, status: "ready", launchUrl: intent.launchUrl, amount: intent.amount, currency: intent.currency };
  if (intent.status === "initializing") return { ok: true, status: "pending" };
  return { ok: false, reason: "provider_unavailable" };
}

export const reserveForGuest = internalMutation({
  args: { ...guestArgs, target, idempotencyKey: v.string() },
  handler: async (ctx, args): Promise<Reserved> => {
    const done = (result: GuestPayResult): Reserved => ({ kind: "done", result });
    // garde : laissez-passer revérifié contre le QR, la table et l'établissement (D-046)
    const resolved = await resolveGuestTable(ctx, args.pass, args.venueSlug);
    if (!resolved) return done({ ok: false, reason: "invalid_pass" });
    const account = await activeAccountOf(ctx, resolved.venue._id);
    if (!account) return done({ ok: false, reason: "not_available" });
    const { session, guest } = await guestPresence(ctx, resolved.table, args.guestKey);
    if (!session) return done({ ok: false, reason: "table_not_open" });
    if (!guest) return done({ ok: false, reason: "code_required" });
    if (guest.removedAt !== undefined) return done({ ok: false, reason: "removed" });
    // Seul un convive ADMIS voit et paie l'addition : une photo du QR ne suffit pas (D-112).
    if (guest.admittedAt === undefined) return done({ ok: false, reason: "code_required" });
    if (session.isSimulation) return done({ ok: false, reason: "simulation" });
    if (!KEY.test(args.idempotencyKey)) return done({ ok: false, reason: "key_reused" });

    const replay = await ctx.db
      .query("paymentIntents")
      .withIndex("by_venue_idempotency", (q) => q.eq("venueId", resolved.venue._id).eq("idempotencyKey", args.idempotencyKey))
      .unique();
    if (replay) {
      // Même clé, autre convive ou autre choix : ce n'est pas le même geste.
      if (replay.guestSessionId !== guest._id || replay.target !== args.target) return done({ ok: false, reason: "key_reused" });
      return reuse(ctx, replay, account._id, resolved.venue.slug);
    }

    // Une intention ouverte de CE convive sur cette tablée : la même, jamais une seconde (D-119).
    const mine = (
      await ctx.db
        .query("paymentIntents")
        .withIndex("by_guest_status", (q) => q.eq("guestSessionId", guest._id))
        .collect()
    ).filter((i) => isOpenIntent(i) && i.tableSessionId === session._id && i.target === args.target);
    if (mine[0]) return reuse(ctx, mine[0], account._id, resolved.venue.slug);

    if (!isOpenSession(session)) return done({ ok: false, reason: "table_not_open" });

    const billing = await loadSessionBilling(ctx, session);
    // Ce qui ne peut pas aboutir se dit AVANT de consommer une limite : trois appuis pendant qu'un
    // autre convive paie ne doivent pas bloquer ce téléphone dix minutes.
    const restNow = billing.checks.find((c) => c.kind === "remainder");
    if (!restNow || restNow.balance.due <= 0) return done({ ok: false, reason: "nothing_due" });
    if (restNow.check && (await openIntentsOfCheck(ctx, restNow.check._id)).length > 0) return done({ ok: false, reason: "in_progress_elsewhere" });
    // Chaque création appelle Wave : par convive, par QR, et par établissement (D-119).
    if (!(await rateLimiter.limit(ctx, "guestPayPerGuest", { key: guest._id })).ok) return done({ ok: false, reason: "rate_limited" });
    if (!(await rateLimiter.limit(ctx, "guestPay", { key: resolved.code._id })).ok) return done({ ok: false, reason: "rate_limited" });
    if (!(await rateLimiter.limit(ctx, "guestPayVenue", { key: resolved.venue._id })).ok) return done({ ok: false, reason: "rate_limited" });

    let check: Doc<"checks">;
    let amount: number;
    let createdCheck = false;
    const now = Date.now();
    if (args.target === "remainder") {
      const rest = billing.checks.find((c) => c.kind === "remainder");
      if (!rest || rest.balance.due <= 0) return done({ ok: false, reason: "nothing_due" });
      check = rest.check ?? (await ensureRemainder(ctx, session, null));
      amount = rest.balance.due;
    } else {
      const { rest, shares } = myRemainderShares(billing, guest._id);
      if (!rest || shares.length === 0) return done({ ok: false, reason: "nothing_due" });
      const moved = shares.reduce((s, x) => s + x.share.amount, 0);
      // Ce qui est déjà payé sur le reste de la table ne se détache plus (D-076).
      if (rest.balance.due - moved < 0 || moved <= 0) return done({ ok: false, reason: "nothing_due" });
      if (rest.check && (await openIntentsOfCheck(ctx, rest.check._id)).length > 0) return done({ ok: false, reason: "in_progress_elsewhere" });
      const checkId = await ctx.db.insert("checks", {
        venueId: session.venueId,
        tableSessionId: session._id,
        reference: await nextCheckReference(ctx, session),
        label: guest.guestNumber ? `Convive ${guest.guestNumber}` : "Convive",
        kind: "allocated",
        status: "open",
        currency: session.currency,
        createdAt: now,
      });
      for (const s of shares) {
        await ctx.db.insert("checkItems", {
          venueId: session.venueId,
          checkId,
          orderItemId: s.item._id,
          tableSessionId: session._id,
          quantityShare: s.share.quantity,
          amount: s.share.amount,
          addedAt: now,
        });
      }
      check = (await ctx.db.get(checkId))!;
      amount = moved;
      createdCheck = true;
    }
    // Deux payeurs sur la même addition : le second attendrait un paiement qui la solderait deux fois.
    if ((await openIntentsOfCheck(ctx, check._id)).length > 0) return done({ ok: false, reason: "in_progress_elsewhere" });

    const reference = `jp_${generateToken(18)}`;
    const intentId = await ctx.db.insert("paymentIntents", {
      venueId: session.venueId,
      checkId: check._id,
      tableSessionId: session._id,
      providerAccountId: account._id,
      provider: account.providerKey,
      reference,
      amount,
      currency: session.currency,
      status: "initializing",
      target: args.target,
      createdCheck,
      guestSessionId: guest._id,
      idempotencyKey: args.idempotencyKey,
      initLeaseUntil: now + INIT_LEASE_MS,
      expiresAt: now + INTENT_TTL_MS,
      // Si l'action meurt en route, le rattrapage retrouvera la session par notre référence.
      nextCheckAt: now + INIT_LEASE_MS + 30_000,
      checkAttempts: 0,
      isSimulation: false,
      createdAt: now,
      updatedAt: now,
    });
    await ctx.db.patch(session._id, { lastActivityAt: now });
    return { kind: "init", intentId, accountId: account._id, reference, amount, currency: session.currency, venueSlug: resolved.venue.slug, searchFirst: false };
  },
});

async function reuse(ctx: MutationCtx, intent: Doc<"paymentIntents">, accountId: Id<"paymentProviderAccounts">, venueSlug: string): Promise<Reserved> {
  const now = Date.now();
  // Un bail échu sans session : l'action précédente est morte en route. On reprend, en cherchant
  // d'abord chez Wave une session créée dont la réponse se serait perdue.
  if (intent.status === "initializing" && !intent.providerRef && (intent.initLeaseUntil ?? 0) <= now) {
    await ctx.db.patch(intent._id, { initLeaseUntil: now + INIT_LEASE_MS, nextCheckAt: now + INIT_LEASE_MS + 30_000, updatedAt: now });
    return { kind: "init", intentId: intent._id, accountId, reference: intent.reference, amount: intent.amount, currency: intent.currency, venueSlug, searchFirst: true };
  }
  return { kind: "done", result: describe(intent) };
}

function returnUrls(venueSlug: string) {
  const site = (process.env.SITE_URL ?? "http://localhost:3000").replace(/\/+$/, "");
  const base = `${site}/r/${encodeURIComponent(venueSlug)}/table`;
  return { successUrl: `${base}?paiement=retour`, errorUrl: `${base}?paiement=erreur` };
}

/** Créer (ou retrouver) la session chez le fournisseur, puis l'écrire. */
async function initialize(ctx: ActionCtx, r: Extract<Reserved, { kind: "init" }>): Promise<GuestPayResult> {
  const sealed = await ctx.runQuery(internal.paymentAccounts.sealedSecrets, { accountId: r.accountId });
  if (!sealed) return { ok: false, reason: "not_available" };
  try {
    const provider = await providerFor(sealed);
    let session: ProviderSession | null = null;
    if (r.searchFirst) {
      const found = await provider.findByReference(r.reference);
      session = found.find((s) => s.status === "succeeded") ?? found.find((s) => s.status !== "expired") ?? null;
    }
    session ??= await provider.initialize({ amount: r.amount, currency: r.currency, reference: r.reference, ...returnUrls(r.venueSlug) });
    const intent: Doc<"paymentIntents"> | null = await ctx.runMutation(internal.onlinePayments.recordSession, { intentId: r.intentId, session });
    return intent ? describe(intent) : { ok: false, reason: "provider_unavailable" };
  } catch (error) {
    const code = error instanceof ProviderError ? error.code : "unreachable";
    logEvent("warn", "payment.intent_init_failed", { operation: "payment.initialize", status: error instanceof ProviderError ? (error.status ?? 0) : 0 });
    // Réseau ou limite : le bail expirera, et le rattrapage cherchera par notre référence.
    if (code !== "unreachable" && code !== "rate_limited") {
      await ctx.runMutation(internal.onlinePayments.initFailed, { intentId: r.intentId, code: error instanceof ProviderError ? (error.providerCode ?? code) : code });
    }
    return { ok: false, reason: "provider_unavailable" };
  }
}

/** « Payer » : tout le reste de la table, ou mes articles. Le montant n'est JAMAIS un argument. */
export const guestStart = action({
  args: { ...guestArgs, target, idempotencyKey: v.string() },
  handler: async (ctx, args): Promise<GuestPayResult> => {
    // garde : `reserveForGuest` revérifie le laissez-passer, l'admission et la limite de débit.
    const reserved: Reserved = await ctx.runMutation(internal.onlinePayments.reserveForGuest, args);
    if (reserved.kind === "done") return reserved.result;
    return initialize(ctx, reserved);
  },
});

export const recordSession = internalMutation({
  args: { intentId: v.id("paymentIntents"), session: sessionFields },
  handler: async (ctx, args): Promise<Doc<"paymentIntents"> | null> => {
    const intent = await ctx.db.get(args.intentId);
    if (!intent) return null;
    const s = args.session;
    if (s.reference !== null && s.reference !== intent.reference) {
      logEvent("error", "payment.reference_mismatch", { operation: "payment.initialize" });
      return null;
    }
    const now = Date.now();
    if (intent.status === "initializing") {
      await ctx.db.patch(intent._id, {
        status: "processing",
        providerRef: s.providerRef,
        ...(s.launchUrl ? { launchUrl: s.launchUrl } : {}),
        ...(s.amount !== null && s.amount !== intent.amount ? { acceptedAmount: s.amount } : {}),
        expiresAt: s.expiresAt ?? intent.expiresAt,
        initLeaseUntil: undefined,
        nextCheckAt: now + nextDelay(0),
        updatedAt: now,
      });
    }
    const fresh = (await ctx.db.get(intent._id))!;
    // Retrouvée déjà payée ou expirée (reprise après une coupure) : on applique tout de suite.
    if (s.status === "succeeded" || s.status === "expired") await applySession(ctx, fresh, s);
    return (await ctx.db.get(intent._id))!;
  },
});

export const initFailed = internalMutation({
  args: { intentId: v.id("paymentIntents"), code: v.string() },
  handler: async (ctx, args) => {
    const intent = await ctx.db.get(args.intentId);
    if (!intent || intent.status !== "initializing") return;
    await ctx.db.patch(intent._id, { status: "failed", failureReason: args.code.slice(0, 60), initLeaseUntil: undefined, nextCheckAt: undefined, updatedAt: Date.now() });
    await undoCreatedCheck(ctx, intent);
  },
});

/** Au retour de Wave (ou quand le client relit) : revérifier SON intention, sans rien croire. */
export const guestCheck = action({
  args: guestArgs,
  handler: async (ctx, args): Promise<{ status: "none" | "pending" | "paid" | "closed" | "rate_limited" }> => {
    // garde : déléguée à `claimGuestCheck`, qui revérifie le laissez-passer et la limite de débit ;
    // sans intention de CE convive, rien n'est relu ni renvoyé.
    const claim: { kind: "none" } | { kind: "rate_limited" } | { kind: "intent"; intentId: Id<"paymentIntents"> } = await ctx.runMutation(
      internal.onlinePayments.claimGuestCheck,
      args,
    );
    // Trop de relectures : dit comme tel, sinon le téléphone croirait qu'il n'y a rien à vérifier.
    if (claim.kind !== "intent") return { status: claim.kind };
    await verifyOne(ctx, claim.intentId);
    const status = await ctx.runQuery(internal.onlinePayments.intentStatus, { intentId: claim.intentId });
    return { status: status === "succeeded" ? "paid" : status === "processing" || status === "initializing" ? "pending" : "closed" };
  },
});

export const claimGuestCheck = internalMutation({
  args: guestArgs,
  handler: async (ctx, args): Promise<{ kind: "none" } | { kind: "rate_limited" } | { kind: "intent"; intentId: Id<"paymentIntents"> }> => {
    const resolved = await resolveGuestTable(ctx, args.pass, args.venueSlug);
    if (!resolved) return { kind: "none" };
    const { guest } = await guestPresence(ctx, resolved.table, args.guestKey);
    if (!guest) return { kind: "none" };
    // La dernière intention OUVERTE de ce convive, création comprise : `verifyOne` sait attendre la
    // fin d'un bail, puis chercher chez Wave par notre référence.
    const latest = (
      await ctx.db
        .query("paymentIntents")
        .withIndex("by_guest_status", (q) => q.eq("guestSessionId", guest._id))
        .collect()
    )
      .filter((i) => isOpenIntent(i))
      .sort((a, b) => b.createdAt - a.createdAt)[0];
    if (!latest) return { kind: "none" };
    if (!(await rateLimiter.limit(ctx, "guestPayCheck", { key: guest._id })).ok) return { kind: "rate_limited" };
    if (!(await rateLimiter.limit(ctx, "guestPayCheckVenue", { key: resolved.venue._id })).ok) return { kind: "rate_limited" };
    return { kind: "intent", intentId: latest._id };
  },
});

export const intentStatus = internalQuery({
  args: { intentId: v.id("paymentIntents") },
  handler: async (ctx, args) => (await ctx.db.get(args.intentId))?.status ?? null,
});

/* ────────────────────────────────────────────────────────────────────────────
 * Confirmer : le seul endroit où un paiement en ligne devient de l'argent
 * ──────────────────────────────────────────────────────────────────────────── */

type Confirmed = { providerRef: string; amount: number | null; currency: string; transactionId: string | null; paidAt: number | null };

export async function confirmIntent(ctx: MutationCtx, intent: Doc<"paymentIntents">, c: Confirmed): Promise<Id<"payments"> | null> {
  const now = Date.now();
  // Idempotent par la session du fournisseur : un webhook rejoué, une vérification concurrente
  // ou un rapprochement tardif retombent sur le même paiement.
  const existing = (
    await ctx.db
      .query("payments")
      .withIndex("by_provider_ref", (q) => q.eq("provider", intent.provider).eq("providerRef", c.providerRef))
      .collect()
  ).find((p) => p.venueId === intent.venueId);
  if (existing) {
    if (intent.status !== "succeeded" || !intent.paymentId) {
      await ctx.db.patch(intent._id, { status: "succeeded", paymentId: intent.paymentId ?? existing._id, nextCheckAt: undefined, updatedAt: now });
    }
    return existing._id;
  }
  const session = (await ctx.db.get(intent.tableSessionId))!;
  const venue = (await ctx.db.get(intent.venueId))!;
  const table = await ctx.db.get(session.tableId);
  const where = `table ${table?.number ?? "?"}`;
  if (c.currency !== intent.currency) {
    // Le seul refus : un montant dans une autre devise ne s'additionne pas à une addition en XOF.
    await raiseAlert(ctx, {
      venueId: intent.venueId,
      kind: "currency_mismatch",
      severity: "critical",
      message: `Paiement Wave reçu en ${c.currency.slice(0, 5)} pour une addition en ${intent.currency} (${where}) : non imputé, à vérifier.`,
      intentId: intent._id,
      tableSessionId: session._id,
      dedupeKey: `currency:${c.providerRef}`,
    });
    // Terminal : sinon l'intention resterait ouverte, relue à chaque balayage, et la table ne se
    // clôturerait plus. L'alerte critique garde la trace ; l'argent se règle hors de Joliba.
    if (isOpenIntent(intent)) {
      await ctx.db.patch(intent._id, { status: "failed", failureReason: "currency_mismatch", nextCheckAt: undefined, initLeaseUntil: undefined, updatedAt: now });
      await undoCreatedCheck(ctx, intent);
    }
    return null;
  }
  const amount = c.amount ?? intent.amount;
  if (c.amount === null || c.amount !== intent.amount) {
    await raiseAlert(ctx, {
      venueId: intent.venueId,
      kind: "amount_mismatch",
      severity: "warning",
      message:
        c.amount === null
          ? `Wave a confirmé un paiement (${where}) sans montant lisible : enregistré à ${formatAmount(intent.amount, intent.currency)}, à vérifier au relevé.`
          : `Wave a encaissé ${formatAmount(c.amount, c.currency)} au lieu de ${formatAmount(intent.amount, intent.currency)} (${where}) : enregistré au montant reçu.`,
      amount,
      currency: intent.currency,
      intentId: intent._id,
      tableSessionId: session._id,
      dedupeKey: `amount:${c.providerRef}`,
    });
  }
  let check = await ctx.db.get(intent.checkId);
  if (!check || check.status === "voided") {
    // L'addition « Convive N » a été défaite entre-temps : l'argent va sur le reste de la table.
    check = await ensureRemainder(ctx, session, null);
  }
  const paymentId = await insertPayment(ctx, {
    session,
    check,
    method: "mobile_money",
    amount,
    provider: intent.provider,
    providerRef: c.providerRef,
    ...(c.transactionId ? { providerTransactionId: c.transactionId } : {}),
    idempotencyKey: `online:${c.providerRef}`.slice(0, 80),
    by: { kind: "online", organizationId: venue.organizationId, intentId: intent._id, ...(intent.guestSessionId ? { guestSessionId: intent.guestSessionId } : {}) },
  });
  await ctx.db.patch(intent._id, {
    status: "succeeded",
    ...(intent.paymentId ? {} : { paymentId }),
    ...(c.transactionId ? { providerTransactionId: c.transactionId } : {}),
    paidAt: c.paidAt ?? now,
    ...(c.amount !== null && c.amount !== intent.amount ? { acceptedAmount: c.amount } : {}),
    nextCheckAt: undefined,
    initLeaseUntil: undefined,
    updatedAt: now,
  });
  // Trop-perçu : visible, jamais absorbé (D-115).
  const billing = await loadSessionBilling(ctx, session);
  const due = billing.checks.find((x) => x.check?._id === check._id)?.balance.due ?? 0;
  if (due < 0) {
    const closed = !isOpenSession(session);
    await raiseAlert(ctx, {
      venueId: intent.venueId,
      kind: "overpaid_closed",
      severity: closed ? "critical" : "warning",
      message: closed
        ? `Paiement Wave arrivé après la clôture (${where}) : ${formatAmount(-due, intent.currency)} à rendre au client.`
        : `Trop-perçu de ${formatAmount(-due, intent.currency)} (${where}) : à rendre avant de clôturer.`,
      amount: -due,
      currency: intent.currency,
      intentId: intent._id,
      paymentId,
      tableSessionId: session._id,
      dedupeKey: `overpaid:${paymentId}`,
    });
  }
  if (due <= 0) await expireOpenIntentsOf(ctx, check._id, "settled_elsewhere");
  return paymentId;
}

/** Appliquer ce que le fournisseur dit d'une session. Un état ne recule jamais. */
async function applySession(ctx: MutationCtx, intent: Doc<"paymentIntents">, s: ProviderSession) {
  const now = Date.now();
  if (s.status === "succeeded") {
    await confirmIntent(ctx, intent, { providerRef: s.providerRef, amount: s.amount, currency: s.currency, transactionId: s.transactionId, paidAt: s.paidAt });
    return;
  }
  if (!isOpenIntent(intent)) return;
  if (s.status === "expired") {
    await ctx.db.patch(intent._id, {
      status: intent.cancelRequestedAt !== undefined ? "cancelled" : "expired",
      nextCheckAt: undefined,
      initLeaseUntil: undefined,
      updatedAt: now,
    });
    await undoCreatedCheck(ctx, intent);
    return;
  }
  await ctx.db.patch(intent._id, {
    ...(s.lastErrorCode ? { lastErrorCode: s.lastErrorCode } : {}),
    lastCheckedAt: now,
    checkAttempts: intent.checkAttempts + 1,
    nextCheckAt: now + nextDelay(intent.checkAttempts + 1),
    updatedAt: now,
  });
}

/* ────────────────────────────────────────────────────────────────────────────
 * Webhook (appelé par `http.ts`, signature déjà vérifiée)
 * ──────────────────────────────────────────────────────────────────────────── */

export const processWebhookEvent = internalMutation({
  args: {
    accountId: v.id("paymentProviderAccounts"),
    eventId: v.string(),
    eventType: v.string(),
    kind: v.union(v.literal("session_completed"), v.literal("payment_failed"), v.literal("test"), v.literal("other")),
    session: v.union(sessionFields, v.null()),
    bodyHash: v.string(),
    signedByCurrent: v.optional(v.boolean()),
  },
  handler: async (ctx, args): Promise<string> => {
    const account = await ctx.db.get(args.accountId);
    if (!account) return "no_account";
    const now = Date.now();
    const seen = await ctx.db
      .query("webhookEvents")
      .withIndex("by_account_event", (q) => q.eq("providerAccountId", account._id).eq("providerEventId", args.eventId))
      .unique();
    if (seen) {
      // Déjà traité : on répond 200 et ON NE FAIT RIEN (PAYMENTS §4).
      await ctx.db.patch(seen._id, { replayCount: seen.replayCount + 1, lastReplayAt: now });
      return "duplicate";
    }
    const s = args.session;
    let result = "ignored";
    let relatedIntentId: Id<"paymentIntents"> | undefined;
    if (args.kind === "test") {
      if (args.signedByCurrent !== false) {
        await ctx.db.patch(account._id, { lastTestEventAt: now, updatedAt: now });
        result = "test";
      } else {
        result = "test_previous_secret";
      }
    } else if (s && (args.kind === "session_completed" || args.kind === "payment_failed")) {
      // Notre référence d'abord (le webhook peut précéder l'enregistrement de la session), puis la
      // session — TOUJOURS dans ce compte : un secret d'un autre restaurant ne désigne rien ici.
      let intent: Doc<"paymentIntents"> | null = null;
      if (s.reference) {
        intent = await ctx.db
          .query("paymentIntents")
          .withIndex("by_account_reference", (q) => q.eq("providerAccountId", account._id).eq("reference", s.reference!))
          .unique();
      }
      intent ??= await ctx.db
        .query("paymentIntents")
        .withIndex("by_account_provider_ref", (q) => q.eq("providerAccountId", account._id).eq("providerRef", s.providerRef))
        .first();
      if (!intent) {
        result = "no_intent";
        if (args.kind === "session_completed" && s.reference?.startsWith("jp_")) {
          await raiseAlert(ctx, {
            venueId: account.venueId,
            kind: "foreign_event",
            severity: "critical",
            message: "Wave annonce un paiement Joliba que ce restaurant ne connaît pas : à vérifier au relevé.",
            dedupeKey: `foreign:${s.providerRef}`,
          });
        }
      } else {
        relatedIntentId = intent._id;
        if (!intent.providerRef && intent.status === "initializing") {
          await ctx.db.patch(intent._id, { providerRef: s.providerRef, status: "processing", initLeaseUntil: undefined, updatedAt: now });
          intent = (await ctx.db.get(intent._id))!;
        }
        if (args.kind === "session_completed") {
          const paymentId = await confirmIntent(ctx, intent, { providerRef: s.providerRef, amount: s.amount, currency: s.currency, transactionId: s.transactionId, paidAt: s.paidAt });
          result = paymentId ? "confirmed" : "not_imputed";
        } else {
          await applySession(ctx, intent, { ...s, status: s.status === "succeeded" ? "succeeded" : "failed_attempt" });
          result = "payment_failed";
        }
      }
    }
    await ctx.db.insert("webhookEvents", {
      providerAccountId: account._id,
      venueId: account.venueId,
      provider: account.providerKey,
      providerEventId: args.eventId,
      eventType: args.eventType.slice(0, 80),
      ...(s?.providerRef ? { providerRef: s.providerRef } : {}),
      ...(s?.reference ? { reference: s.reference.slice(0, 80) } : {}),
      ...(s?.amount !== undefined && s?.amount !== null ? { amount: s.amount } : {}),
      ...(s?.currency ? { currency: s.currency.slice(0, 5) } : {}),
      bodyHash: args.bodyHash,
      processingResult: result,
      ...(relatedIntentId ? { relatedIntentId } : {}),
      receivedAt: now,
      replayCount: 0,
    });
    return result;
  },
});

/* ────────────────────────────────────────────────────────────────────────────
 * Rattrapage (D-120) et annulation
 * ──────────────────────────────────────────────────────────────────────────── */

export const forVerification = internalQuery({
  args: { intentId: v.id("paymentIntents") },
  handler: async (ctx, args) => {
    const intent = await ctx.db.get(args.intentId);
    if (!intent) return null;
    return { status: intent.status, providerRef: intent.providerRef ?? null, reference: intent.reference, accountId: intent.providerAccountId, cancelRequested: intent.cancelRequestedAt !== undefined, leaseActive: (intent.initLeaseUntil ?? 0) > Date.now() };
  },
});

export const applyVerification = internalMutation({
  args: {
    intentId: v.id("paymentIntents"),
    outcome: v.union(
      v.object({ kind: v.literal("session"), session: sessionFields }),
      v.object({ kind: v.literal("not_found") }),
      v.object({ kind: v.literal("error"), code: v.string() }),
    ),
  },
  handler: async (ctx, args) => {
    const intent = await ctx.db.get(args.intentId);
    if (!intent) return;
    const now = Date.now();
    const o = args.outcome;
    if (o.kind === "session") {
      let current = intent;
      if (!current.providerRef && current.status === "initializing") {
        await ctx.db.patch(current._id, { providerRef: o.session.providerRef, status: "processing", initLeaseUntil: undefined, ...(o.session.launchUrl ? { launchUrl: o.session.launchUrl } : {}), updatedAt: now });
        current = (await ctx.db.get(current._id))!;
      }
      await applySession(ctx, current, o.session);
      return;
    }
    if (!isOpenIntent(intent)) return;
    if (o.kind === "not_found") {
      // Aucune session chez Wave sous notre référence, bail échu : rien n'a été créé, rien n'est dû.
      if (intent.status === "initializing" && (intent.initLeaseUntil ?? 0) <= now) {
        await ctx.db.patch(intent._id, { status: intent.cancelRequestedAt !== undefined ? "cancelled" : "failed", failureReason: "no_session", nextCheckAt: undefined, initLeaseUntil: undefined, updatedAt: now });
        await undoCreatedCheck(ctx, intent);
      }
      return;
    }
    // Wave ne répond pas. Une annulation qui traîne, ou une session forcément expirée chez Wave :
    // on ferme ici plutôt que de geler la table (D-130).
    const cancelStale = intent.cancelRequestedAt !== undefined && now - intent.cancelRequestedAt >= CANCEL_UNCONFIRMED_MS;
    if (cancelStale || now > intent.expiresAt + EXPIRED_MARGIN_MS) {
      await closeLocally(ctx, intent, "provider_unreachable");
      await raiseAlert(ctx, {
        venueId: intent.venueId,
        kind: "provider_unreachable",
        severity: "warning",
        message: `Wave ne répond pas : le paiement en ligne de ${formatAmount(intent.amount, intent.currency)} a été fermé ici. Si le client a payé quand même, le paiement sera enregistré et signalé.`,
        intentId: intent._id,
        tableSessionId: intent.tableSessionId,
        dedupeKey: `unreachable:${intent._id}`,
      });
      return;
    }
    await ctx.db.patch(intent._id, { lastCheckedAt: now, checkAttempts: intent.checkAttempts + 1, nextCheckAt: now + nextDelay(intent.checkAttempts + 1), updatedAt: now });
    if (now > intent.expiresAt + UNREACHABLE_ALERT_AFTER_MS) {
      await raiseAlert(ctx, {
        venueId: intent.venueId,
        kind: "provider_unreachable",
        severity: "warning",
        message: `Wave ne répond pas sur un paiement de ${formatAmount(intent.amount, intent.currency)} : son issue est inconnue. Il sera revérifié.`,
        intentId: intent._id,
        tableSessionId: intent.tableSessionId,
        dedupeKey: `unreachable:${intent._id}`,
      });
    }
  },
});

/**
 * Fermer une intention ICI, sans réponse du fournisseur (D-130). Sans risque pour l'argent : si le
 * client a quand même payé, le webhook ou le rapprochement enregistre le paiement (D-115), et le
 * trop-perçu éventuel est signalé. Ce qui est évité : une table qu'on ne peut plus clôturer parce
 * que Wave est en panne.
 */
async function closeLocally(ctx: MutationCtx, intent: Doc<"paymentIntents">, reason: string): Promise<void> {
  const now = Date.now();
  await ctx.db.patch(intent._id, {
    status: intent.cancelRequestedAt !== undefined ? "cancelled" : "expired",
    failureReason: reason,
    nextCheckAt: undefined,
    initLeaseUntil: undefined,
    updatedAt: now,
  });
  await undoCreatedCheck(ctx, intent);
}

/** Relire une intention chez le fournisseur et appliquer la réponse. Jamais d'exception. */
async function verifyOne(ctx: ActionCtx, intentId: Id<"paymentIntents">): Promise<void> {
  const info = await ctx.runQuery(internal.onlinePayments.forVerification, { intentId });
  if (!info) return;
  if (info.status === "initializing" && info.leaseActive) return;
  const sealed = await ctx.runQuery(internal.paymentAccounts.sealedSecrets, { accountId: info.accountId });
  if (!sealed) return;
  try {
    const provider = await providerFor(sealed);
    let session: ProviderSession | null;
    if (info.providerRef) {
      session = await provider.verify(info.providerRef);
    } else {
      const found = await provider.findByReference(info.reference);
      session = found.find((s) => s.status === "succeeded") ?? found.find((s) => s.status !== "expired") ?? found[0] ?? null;
    }
    // Annulation demandée et session encore ouverte : on la ferme chez le fournisseur, puis on relit.
    if (session && info.cancelRequested && (session.status === "pending" || session.status === "failed_attempt")) {
      await provider.expire(session.providerRef);
      session = await provider.verify(session.providerRef);
    }
    await ctx.runMutation(internal.onlinePayments.applyVerification, { intentId, outcome: session ? { kind: "session", session } : { kind: "not_found" } });
  } catch (error) {
    logEvent("warn", "payment.verify_failed", { operation: "payment.verify", status: error instanceof ProviderError ? (error.status ?? 0) : 0 });
    await ctx.runMutation(internal.onlinePayments.applyVerification, { intentId, outcome: { kind: "error", code: error instanceof ProviderError ? error.code : "unreachable" } });
  }
}

/** Programmé par `expireOpenIntentsOf` et par l'annulation : fermer chez Wave, puis relire. */
export const expireIntent = internalAction({
  args: { intentId: v.id("paymentIntents") },
  handler: async (ctx, args) => verifyOne(ctx, args.intentId),
});

/** Le personnel annule un paiement en ligne en cours (pour offrir, partager, clôturer). */
export const cancel = mutation({
  args: { venueId: v.id("venues"), actingMemberId: v.optional(v.id("organizationMembers")), intentId: v.id("paymentIntents") },
  handler: async (ctx, args) => {
    const actor = await requireServiceMutation(ctx, "payment.collect", { venueId: args.venueId, actingMemberId: args.actingMemberId });
    const member = memberOf(actor);
    const intent = await getInVenue(ctx, args.intentId, actor.venue._id, "Ce paiement en ligne");
    if (!isOpenIntent(intent)) return { status: intent.status };
    if (intent.cancelRequestedAt === undefined) {
      const now = Date.now();
      await ctx.db.patch(intent._id, { cancelRequestedAt: now, cancelRequestedByMemberId: member._id, failureReason: "staff_cancel", updatedAt: now });
      await writeAudit(ctx, {
        organizationId: actor.organization._id,
        venueId: actor.venue._id,
        ...actor.audit,
        action: "payment.online_cancel",
        resourceType: "paymentIntent",
        resourceId: intent._id,
        before: { amount: intent.amount, status: intent.status },
      });
      // Aucune session chez Wave (création échouée, bail échu) : le client n'a aucun lien pour payer.
      // On ferme ici, sans attendre un Wave peut-être injoignable (D-130).
      if (!intent.providerRef && (intent.initLeaseUntil ?? 0) <= now) {
        await closeLocally(ctx, (await ctx.db.get(intent._id))!, "staff_cancel");
        return { status: "cancelled" as const };
      }
      await ctx.scheduler.runAfter(0, internal.onlinePayments.expireIntent, { intentId: intent._id });
      // Si Wave ne confirme pas, on relit après le délai : l'annulation se ferme alors ici (D-130).
      await ctx.scheduler.runAfter(CANCEL_UNCONFIRMED_MS + 5_000, internal.onlinePayments.expireIntent, { intentId: intent._id });
    }
    return { status: "cancelling" as const };
  },
});

export const dueForSweep = internalQuery({
  args: { now: v.number() },
  handler: async (ctx, args) => {
    const intents: Id<"paymentIntents">[] = [];
    for (const status of ["processing", "initializing"] as const) {
      const rows = await ctx.db
        .query("paymentIntents")
        .withIndex("by_status_next_check", (q) => q.eq("status", status).lte("nextCheckAt", args.now))
        .take(25);
      intents.push(...rows.filter((r) => r.nextCheckAt !== undefined).map((r) => r._id));
    }
    const refunds = (
      await ctx.db
        .query("refunds")
        .withIndex("by_status_createdAt", (q) => q.eq("status", "pending").lte("createdAt", args.now - 60_000))
        .take(10)
    )
      .filter((r) => r.provider !== undefined)
      .map((r) => r._id);
    return { intents, refunds };
  },
});

/** Toutes les 2 minutes (crons.ts) : revérifier ce qui attend, rejouer les remboursements en suspens. */
export const sweep = internalAction({
  args: {},
  handler: async (ctx) => {
    const due = await ctx.runQuery(internal.onlinePayments.dueForSweep, { now: Date.now() });
    for (const intentId of due.intents) await verifyOne(ctx, intentId);
    for (const refundId of due.refunds) await executeRefundOne(ctx, refundId);
  },
});

/* ────────────────────────────────────────────────────────────────────────────
 * Remboursement en ligne (D-123)
 * ──────────────────────────────────────────────────────────────────────────── */

export const refundForExecution = internalQuery({
  args: { refundId: v.id("refunds") },
  handler: async (ctx, args) => {
    const refund = await ctx.db.get(args.refundId);
    if (!refund || refund.status !== "pending" || !refund.providerRef) return null;
    const payment = await ctx.db.get(refund.paymentId);
    const intent = payment?.paymentIntentId ? await ctx.db.get(payment.paymentIntentId) : null;
    if (!intent) return null;
    return { providerRef: refund.providerRef, accountId: intent.providerAccountId };
  },
});

async function executeRefundOne(ctx: ActionCtx, refundId: Id<"refunds">): Promise<void> {
  const info = await ctx.runQuery(internal.onlinePayments.refundForExecution, { refundId });
  if (!info) return;
  const sealed = await ctx.runQuery(internal.paymentAccounts.sealedSecrets, { accountId: info.accountId });
  if (!sealed) return;
  try {
    const provider = await providerFor(sealed);
    await provider.refund(info.providerRef);
    await ctx.runMutation(internal.onlinePayments.completeRefund, { refundId, ok: true });
  } catch (error) {
    const e = error instanceof ProviderError ? error : new ProviderError("unreachable");
    logEvent("warn", "payment.refund_failed", { operation: "payment.refund", status: e.status ?? 0 });
    // Réseau ou limite : le remboursement reste en attente, le rattrapage le rejoue (Wave le dit idempotent).
    if (e.code === "unreachable" || e.code === "rate_limited") return;
    await ctx.runMutation(internal.onlinePayments.completeRefund, { refundId, ok: false, code: e.providerCode ?? e.code });
  }
}

export const executeRefund = internalAction({
  args: { refundId: v.id("refunds") },
  handler: async (ctx, args) => executeRefundOne(ctx, args.refundId),
});

export const completeRefund = internalMutation({
  args: { refundId: v.id("refunds"), ok: v.boolean(), code: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const refund = await ctx.db.get(args.refundId);
    if (!refund || refund.status !== "pending") return;
    const payment = (await ctx.db.get(refund.paymentId))!;
    const venue = (await ctx.db.get(refund.venueId))!;
    const now = Date.now();
    if (!args.ok) {
      await ctx.db.patch(refund._id, { status: "failed", failureCode: (args.code ?? "rejected").slice(0, 60), completedAt: now });
      await raiseAlert(ctx, {
        venueId: refund.venueId,
        kind: "refund_failed",
        severity: "critical",
        message: `Wave a refusé le remboursement de ${formatAmount(refund.amount, payment.currency)} (${(args.code ?? "refus").slice(0, 40)}) : rendez l'argent autrement.`,
        amount: refund.amount,
        currency: payment.currency,
        paymentId: payment._id,
        refundId: refund._id,
        dedupeKey: `refund_failed:${refund._id}`,
      });
      return;
    }
    await ctx.db.patch(refund._id, { status: "succeeded", completedAt: now });
    const others = (await ctx.db.query("refunds").withIndex("by_payment", (q) => q.eq("paymentId", payment._id)).collect()).filter((r) => r.status === "succeeded");
    const total = others.reduce((s, r) => s + r.amount, 0);
    await ctx.db.patch(payment._id, { status: total >= payment.amount ? "refunded" : "partially_refunded" });
    const sale = (await ctx.db.query("bills").withIndex("by_check", (q) => q.eq("checkId", payment.checkId)).collect()).find((b) => b.kind === "sale");
    if (sale) await issueCreditNote(ctx, venue, sale, refund.amount, refund.reason);
    // Un trop-perçu rendu n'est plus à rendre — s'il l'est en entier.
    await resolveOverpaidIfCovered(ctx, payment);
    await writeAudit(ctx, {
      organizationId: venue.organizationId,
      venueId: venue._id,
      actorType: "system",
      source: "system",
      action: "payment.refund_confirmed",
      resourceType: "refund",
      resourceId: refund._id,
      after: { payment: payment._id, amount: refund.amount },
    });
  },
});

/* ────────────────────────────────────────────────────────────────────────────
 * Rapprochement quotidien (D-121, D-122)
 * ──────────────────────────────────────────────────────────────────────────── */

export function utcDay(at: number): string {
  return new Date(at).toISOString().slice(0, 10);
}

function dayWindow(day: string): { from: number; to: number } {
  const from = Date.parse(`${day}T00:00:00Z`);
  return { from, to: from + 24 * 60 * 60 * 1000 };
}

/** Jours qu'une lecture ratée (Wave injoignable) rattrape encore, au-delà de J-1 et J-2. */
const RECONCILE_RETRY_DAYS = 7;

/**
 * Tout compte qui a une clé, ACTIF OU NON : recoller un secret ou changer l'adresse du webhook
 * repasse le compte en brouillon, mais les paiements déjà faits doivent encore être rapprochés.
 * Avec, les jours récents dont la lecture a échoué, à rattraper.
 */
export const accountsToReconcile = internalQuery({
  args: { now: v.number() },
  handler: async (ctx, args) => {
    const since = utcDay(args.now - RECONCILE_RETRY_DAYS * 86_400_000);
    const out = [];
    for (const a of await ctx.db.query("paymentProviderAccounts").collect()) {
      if (!a.secrets.apiKey) continue;
      const failedDays = (
        await ctx.db
          .query("providerReconciliations")
          .withIndex("by_account_day", (q) => q.eq("providerAccountId", a._id).gte("dayUtc", since))
          .collect()
      )
        .filter((r) => r.status === "failed")
        .map((r) => r.dayUtc);
      out.push({ accountId: a._id, balanceAccess: a.balanceAccess === true, failedDays });
    }
    return out;
  },
});

/**
 * Chaque matin à 06:00 UTC : J-1 (première passe) PUIS J-2 (seconde passe). Cet ordre compte : un
 * paiement enregistré ici le jour J mais classé J+1 par Wave est retrouvé par la première passe de
 * J+1 avant que la seconde passe de J ne le déclare absent. Puis les jours récents restés en échec.
 */
export const reconcileAll = internalAction({
  args: { now: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const now = args.now ?? Date.now();
    const days = [utcDay(now - 86_400_000), utcDay(now - 2 * 86_400_000)];
    for (const { accountId, balanceAccess, failedDays } of await ctx.runQuery(internal.onlinePayments.accountsToReconcile, { now })) {
      for (const day of [...days, ...failedDays.filter((d) => !days.includes(d)).sort().reverse()]) {
        await reconcileOne(ctx, accountId, day, balanceAccess);
      }
    }
  },
});

export async function reconcileOne(ctx: ActionCtx, accountId: Id<"paymentProviderAccounts">, day: string, balanceAccess: boolean): Promise<void> {
  if (!balanceAccess) {
    await ctx.runMutation(internal.onlinePayments.applyReconciliation, { accountId, day, outcome: { kind: "unavailable" } });
    return;
  }
  const sealed = await ctx.runQuery(internal.paymentAccounts.sealedSecrets, { accountId });
  if (!sealed) return;
  try {
    const provider = await providerFor(sealed);
    const transactions = await provider.transactionsOfDay(day);
    await ctx.runMutation(internal.onlinePayments.applyReconciliation, { accountId, day, outcome: { kind: "done", transactions } });
  } catch (error) {
    logEvent("warn", "payment.reconcile_failed", { operation: "payment.reconcile", status: error instanceof ProviderError ? (error.status ?? 0) : 0 });
    const code = error instanceof ProviderError ? error.code : "unreachable";
    await ctx.runMutation(internal.onlinePayments.applyReconciliation, { accountId, day, outcome: code === "unauthorized" ? { kind: "unavailable" } : { kind: "failed", code } });
  }
}

const transactionFields = v.object({
  transactionId: v.string(),
  kind: v.union(v.literal("checkout"), v.literal("checkout_refund"), v.literal("other")),
  amount: v.number(),
  fee: v.number(),
  currency: v.string(),
  providerRef: v.union(v.string(), v.null()),
  reference: v.union(v.string(), v.null()),
  at: v.number(),
});

export const applyReconciliation = internalMutation({
  args: {
    accountId: v.id("paymentProviderAccounts"),
    day: v.string(),
    outcome: v.union(
      v.object({ kind: v.literal("done"), transactions: v.array(transactionFields) }),
      v.object({ kind: v.literal("unavailable") }),
      v.object({ kind: v.literal("failed"), code: v.string() }),
    ),
  },
  handler: async (ctx, args) => {
    const account = await ctx.db.get(args.accountId);
    if (!account) return;
    const now = Date.now();
    const existing = await ctx.db
      .query("providerReconciliations")
      .withIndex("by_account_day", (q) => q.eq("providerAccountId", account._id).eq("dayUtc", args.day))
      .unique();
    // Seule une lecture RÉUSSIE du relevé compte comme une passe : sinon une lecture ratée, puis
    // une réussie, suffiraient à déclarer absent un paiement pas encore classé.
    const passes = (existing?.passes ?? 0) + (args.outcome.kind === "done" ? 1 : 0);
    const base = { venueId: account.venueId, providerAccountId: account._id, dayUtc: args.day, passes, lastRunAt: now };
    const zero = { matched: 0, missingHere: 0, missingAtProvider: 0, amountMismatch: 0, fees: 0, checkoutTotal: 0 };
    if (args.outcome.kind !== "done" && existing?.status === "done") {
      // Une lecture ratée n'efface pas ce qu'une précédente a établi.
      await ctx.db.patch(existing._id, { lastRunAt: now });
      return;
    }
    if (args.outcome.kind !== "done") {
      const row = { ...base, ...zero, status: args.outcome.kind === "unavailable" ? ("unavailable" as const) : ("failed" as const), failureCode: args.outcome.kind === "failed" ? args.outcome.code.slice(0, 40) : "no_balance_access" };
      if (existing) await ctx.db.patch(existing._id, row);
      else await ctx.db.insert("providerReconciliations", row);
      return;
    }
    const reconciliationId = existing
      ? existing._id
      : await ctx.db.insert("providerReconciliations", { ...base, ...zero, status: "done" });
    for (const item of await ctx.db.query("reconciliationItems").withIndex("by_reconciliation", (q) => q.eq("reconciliationId", reconciliationId)).collect()) {
      await ctx.db.delete(item._id);
    }
    const counts = { ...zero };
    const item = (row: Omit<Doc<"reconciliationItems">, "_id" | "_creationTime" | "venueId" | "reconciliationId" | "at">) =>
      ctx.db.insert("reconciliationItems", { venueId: account.venueId, reconciliationId, at: now, ...row });
    const seenPayments = new Set<Id<"payments">>();

    for (const t of args.outcome.transactions) {
      if (t.kind === "other") continue;
      counts.fees += t.fee;
      const payment = t.providerRef
        ? (await ctx.db.query("payments").withIndex("by_provider_ref", (q) => q.eq("provider", account.providerKey).eq("providerRef", t.providerRef!)).collect()).find((p) => p.venueId === account.venueId) ?? null
        : null;
      if (t.kind === "checkout") {
        counts.checkoutTotal += t.amount;
        if (payment) {
          seenPayments.add(payment._id);
          if (!payment.providerTransactionId) await ctx.db.patch(payment._id, { providerTransactionId: t.transactionId });
          if (payment.amount === t.amount) {
            counts.matched++;
            await item({ kind: "matched", providerTransactionId: t.transactionId, providerRef: t.providerRef ?? undefined, providerAmount: t.amount, fee: t.fee, ourAmount: payment.amount, paymentId: payment._id });
          } else {
            counts.amountMismatch++;
            await item({ kind: "amount_mismatch", providerTransactionId: t.transactionId, providerRef: t.providerRef ?? undefined, providerAmount: t.amount, fee: t.fee, ourAmount: payment.amount, paymentId: payment._id });
            await raiseAlert(ctx, {
              venueId: account.venueId,
              kind: "amount_mismatch",
              severity: "warning",
              message: `Au relevé Wave du ${args.day}, un paiement vaut ${formatAmount(t.amount, t.currency)} ; Joliba a enregistré ${formatAmount(payment.amount, payment.currency)}.`,
              paymentId: payment._id,
              providerTransactionId: t.transactionId,
              dedupeKey: `recon_amount:${t.transactionId}`,
            });
          }
          continue;
        }
        // Chez Wave, pas chez nous : un webhook perdu et un rattrapage manqué. Le relevé, lu avec
        // la clé du restaurant, prouve l'encaissement : on confirme (D-121).
        const intent =
          t.reference !== null
            ? await ctx.db.query("paymentIntents").withIndex("by_account_reference", (q) => q.eq("providerAccountId", account._id).eq("reference", t.reference!)).unique()
            : null;
        if (intent && t.providerRef) {
          const paymentId = await confirmIntent(ctx, intent, { providerRef: t.providerRef, amount: t.amount, currency: t.currency, transactionId: t.transactionId, paidAt: t.at });
          counts.missingHere++;
          await item({ kind: "missing_here", providerTransactionId: t.transactionId, providerRef: t.providerRef, providerAmount: t.amount, fee: t.fee, ...(paymentId ? { paymentId } : {}) });
          if (paymentId) seenPayments.add(paymentId);
          await raiseAlert(ctx, {
            venueId: account.venueId,
            kind: "missing_here",
            severity: "warning",
            message: `Un paiement Wave de ${formatAmount(t.amount, t.currency)} du ${args.day} n'avait pas été vu : il vient d'être enregistré depuis le relevé.`,
            ...(paymentId ? { paymentId } : {}),
            providerTransactionId: t.transactionId,
            dedupeKey: `recon_missing:${t.transactionId}`,
          });
        } else if (t.reference?.startsWith("jp_")) {
          counts.missingHere++;
          await item({ kind: "missing_here", providerTransactionId: t.transactionId, ...(t.providerRef ? { providerRef: t.providerRef } : {}), providerAmount: t.amount, fee: t.fee });
          await raiseAlert(ctx, {
            venueId: account.venueId,
            kind: "missing_here",
            severity: "critical",
            message: `Le relevé Wave du ${args.day} montre un paiement Joliba de ${formatAmount(t.amount, t.currency)} qui n'existe pas ici.`,
            providerTransactionId: t.transactionId,
            dedupeKey: `recon_missing:${t.transactionId}`,
          });
        }
        // Une autre référence : un encaissement Wave fait hors de Joliba (autre outil, QR du comptoir).
        continue;
      }
      // Remboursement vu au relevé.
      if (payment) {
        const refunds = (await ctx.db.query("refunds").withIndex("by_payment", (q) => q.eq("paymentId", payment._id)).collect()).filter((r) => r.provider !== undefined);
        const pending = refunds.find((r) => r.status === "pending");
        if (pending) await ctx.scheduler.runAfter(0, internal.onlinePayments.completeRefund, { refundId: pending._id, ok: true });
        const known = refunds.find((r) => r.status === "succeeded") ?? pending;
        if (known) {
          counts.matched++;
          await item({ kind: "matched", providerTransactionId: t.transactionId, providerRef: t.providerRef ?? undefined, providerAmount: t.amount, fee: t.fee, paymentId: payment._id, refundId: known._id });
          continue;
        }
      }
      counts.missingHere++;
      await item({ kind: "missing_here", providerTransactionId: t.transactionId, ...(t.providerRef ? { providerRef: t.providerRef } : {}), providerAmount: t.amount, fee: t.fee, ...(payment ? { paymentId: payment._id } : {}) });
      await raiseAlert(ctx, {
        venueId: account.venueId,
        kind: "missing_here",
        severity: "warning",
        message: `Le relevé Wave du ${args.day} montre un remboursement de ${formatAmount(Math.abs(t.amount), t.currency)} fait hors de Joliba.`,
        providerTransactionId: t.transactionId,
        dedupeKey: `recon_refund:${t.transactionId}`,
      });
    }

    // Chez nous, pas chez Wave — seulement à la seconde passe : avant, le relevé peut être en retard.
    const { from, to } = dayWindow(args.day);
    const ours = (
      await ctx.db
        .query("payments")
        .withIndex("by_venue_createdAt", (q) => q.eq("venueId", account.venueId).gte("createdAt", from).lt("createdAt", to))
        .collect()
    ).filter((p) => p.provider === account.providerKey && p.status !== "voided" && !seenPayments.has(p._id));
    for (const p of ours) {
      const matchedElsewhere = (await ctx.db.query("reconciliationItems").withIndex("by_payment", (q) => q.eq("paymentId", p._id)).collect()).some(
        (i) => i.reconciliationId !== reconciliationId && (i.kind === "matched" || i.kind === "amount_mismatch" || i.kind === "missing_here"),
      );
      if (matchedElsewhere) continue;
      if (passes < 2) continue;
      counts.missingAtProvider++;
      await item({ kind: "missing_at_provider", ...(p.providerRef ? { providerRef: p.providerRef } : {}), ourAmount: p.amount, paymentId: p._id });
      await raiseAlert(ctx, {
        venueId: account.venueId,
        kind: "missing_at_provider",
        severity: "critical",
        message: `Un paiement en ligne de ${formatAmount(p.amount, p.currency)} enregistré le ${args.day} n'apparaît pas au relevé Wave après deux passes.`,
        paymentId: p._id,
        tableSessionId: p.tableSessionId,
        dedupeKey: `recon_absent:${p._id}`,
      });
    }
    await ctx.db.patch(reconciliationId, { ...base, ...counts, status: "done", failureCode: undefined });
  },
});

/** Versé · en attente · en retard, pour un paiement en ligne (D-122). */
export async function settlementOf(ctx: ReadCtx, payment: Doc<"payments">): Promise<"settled" | "pending" | "late" | null> {
  if (!payment.paymentIntentId || payment.status === "voided") return null;
  const items = await ctx.db
    .query("reconciliationItems")
    .withIndex("by_payment", (q) => q.eq("paymentId", payment._id))
    .collect();
  if (items.some((i) => i.kind === "matched" || i.kind === "amount_mismatch" || i.kind === "missing_here")) return "settled";
  if (items.some((i) => i.kind === "missing_at_provider")) return "late";
  return "pending";
}

/* ────────────────────────────────────────────────────────────────────────────
 * Ce que voit le personnel
 * ──────────────────────────────────────────────────────────────────────────── */

/** Les alertes non traitées : trop-perçus à rendre, écarts, refus. Visibles de la caisse. */
export const alerts = query({
  args: { venueId: v.id("venues") },
  handler: async (ctx, args) => {
    const actor = await requireServiceActor(ctx, "payment.read", { venueId: args.venueId });
    const rows = await ctx.db
      .query("paymentAlerts")
      .withIndex("by_venue_open", (q) => q.eq("venueId", actor.venue._id).eq("resolvedAt", undefined))
      .order("desc")
      .take(50);
    const out = [];
    for (const a of rows) {
      const session = a.tableSessionId ? await ctx.db.get(a.tableSessionId) : null;
      const table = session ? await ctx.db.get(session.tableId) : null;
      const payment = a.paymentId ? await ctx.db.get(a.paymentId) : null;
      const refunded = payment
        ? (await ctx.db.query("refunds").withIndex("by_payment", (q) => q.eq("paymentId", payment._id)).collect())
            .filter((r) => r.status === "succeeded" || r.status === "pending")
            .reduce((s, r) => s + r.amount, 0)
        : 0;
      out.push({
        _id: a._id,
        kind: a.kind,
        severity: a.severity,
        message: a.message,
        amount: a.amount ?? null,
        currency: a.currency ?? actor.venue.currency,
        createdAt: a.createdAt,
        sessionId: a.tableSessionId ?? null,
        tableNumber: table?.number ?? null,
        /** Le paiement à rendre, pour le rembourser d'ici — même sur une table close. */
        payment:
          payment && payment.status !== "voided" && payment.amount - refunded > 0
            ? { _id: payment._id, label: methodLabel(payment), amount: payment.amount, refundable: payment.amount - refunded, method: payment.method, online: payment.paymentIntentId !== undefined }
            : null,
      });
    }
    return { alerts: out, canResolve: actor.permissions.has("payment.refund") };
  },
});

/** Une alerte lue et traitée, avec un mot sur ce qui a été fait. Compte seulement. */
export const resolveAlert = mutation({
  args: { venueId: v.id("venues"), alertId: v.id("paymentAlerts"), resolution: v.string() },
  handler: async (ctx, args) => {
    const actor = await requireServiceMutation(ctx, "payment.refund", { venueId: args.venueId });
    const member = memberOf(actor);
    const alert = await getInVenue(ctx, args.alertId, actor.venue._id, "Cette alerte");
    if (alert.resolvedAt !== undefined) return;
    const resolution = args.resolution.trim();
    if (resolution.length < 5 || resolution.length > 300) throw invalid("Dites ce qui a été fait (5 à 300 caractères).");
    await ctx.db.patch(alert._id, { resolvedAt: Date.now(), resolvedByMemberId: member._id, resolution });
    await writeAudit(ctx, {
      organizationId: actor.organization._id,
      venueId: actor.venue._id,
      ...actor.audit,
      action: "payment.alert_resolve",
      resourceType: "paymentAlert",
      resourceId: alert._id,
      reason: resolution,
    });
  },
});

/** Les derniers rapprochements, pour l'écran de réglage et le rapport. */
export const reconciliations = query({
  args: { venueId: v.id("venues") },
  handler: async (ctx, args) => {
    const actor = await requireServiceActor(ctx, "payment.read", { venueId: args.venueId });
    const rows = await ctx.db
      .query("providerReconciliations")
      .withIndex("by_venue_day", (q) => q.eq("venueId", actor.venue._id))
      .order("desc")
      .take(14);
    return rows.map((r) => ({
      day: r.dayUtc,
      status: r.status,
      passes: r.passes,
      matched: r.matched,
      missingHere: r.missingHere,
      missingAtProvider: r.missingAtProvider,
      amountMismatch: r.amountMismatch,
      fees: r.fees,
      checkoutTotal: r.checkoutTotal,
      lastRunAt: r.lastRunAt,
    }));
  },
});
