/**
 * Encaisser — Joliba (tranche T3)
 *
 * Saisie au comptoir, par une personne nommée : espèces (remis, monnaie RÉELLEMENT rendue),
 * Mobile Money reçu sur un téléphone de l'établissement (le portefeuille est obligatoire : c'est
 * lui que le gérant rapproche), carte sur un terminal, virement. Un paiement mixte, ce sont
 * simplement plusieurs paiements sur la même addition.
 *
 * Jamais hors ligne (A4) : l'écran désactive ces gestes sans réseau ; au retour, l'espèce reçue
 * pendant la coupure se saisit dans la caisse ouverte à ce moment.
 *
 * Tout passe par `applyPayment`, dans UNE transaction : relire l'addition et ses paiements puis
 * écrire. Deux encaisseurs sur la même addition en même temps : Convex rejoue le second, qui
 * relit le dû et se voit refusé s'il le dépasse. Le paiement en ligne (T5) appellera la même
 * fonction depuis son webhook.
 */

import { v } from "convex/values";
import { mutation } from "./_generated/server";
import type { Doc, Id } from "./_generated/dataModel";
import { writeAudit } from "./lib/audit";
import { loadSessionBilling } from "./lib/billing";
import { getInVenue } from "./lib/catalogAccess";
import { conflict, invalid, notFound } from "./lib/errors";
import type { MutationCtx } from "./lib/guards";
import { requireServiceMutation, type ServiceActor } from "./lib/serviceActor";
import { settingsOf } from "./lib/service";
import { cashModeOf, memberOf, requireAmount, requireReason, resolveCashSession } from "./cash";
import { assertBillable, ensureRemainder } from "./checks";
import { issueCreditNote } from "./bills";

const paymentMethod = v.union(
  v.literal("cash"),
  v.literal("mobile_money"),
  v.literal("card"),
  v.literal("external_terminal"),
  v.literal("transfer"),
  v.literal("other"),
);

function validKey(key: string) {
  if (key.length < 8 || key.length > 80) throw invalid("Clé d'idempotence invalide.");
}

type PaymentInput = {
  checkId: Id<"checks"> | null;
  method: Doc<"payments">["method"];
  amount: number;
  receivedAmount?: number;
  changeAmount?: number;
  wallet?: string;
  providerRef?: string;
  registerSessionId?: Id<"cashRegisterSessions">;
  idempotencyKey: string;
};

type PaymentResult =
  | { ok: true; paymentId: Id<"payments">; due: number; changeAmount: number }
  | { ok: false; reason: "no_cash_session" | "choose_register" };

/** Le cœur : un paiement imputé sur une addition, dans la transaction qui relit son dû. */
export async function applyPayment(ctx: MutationCtx, actor: ServiceActor, session: Doc<"tableSessions">, input: PaymentInput): Promise<PaymentResult> {
  const member = memberOf(actor);
  validKey(input.idempotencyKey);
  // Même clé : même geste, même réponse. Même clé pour un AUTRE geste : refusé, jamais avalé.
  const replay = await ctx.db
    .query("payments")
    .withIndex("by_venue_idempotency", (q) => q.eq("venueId", session.venueId).eq("idempotencyKey", input.idempotencyKey))
    .unique();
  if (replay) {
    // Tout ce que la personne a saisi doit coïncider : un autre montant remis, une autre monnaie
    // ou un autre portefeuille sous la même clé, c'est un autre geste.
    const same =
      replay.tableSessionId === session._id &&
      replay.method === input.method &&
      replay.amount === input.amount &&
      (input.checkId === null || replay.checkId === input.checkId) &&
      (input.wallet === undefined || replay.wallet === input.wallet.trim()) &&
      (input.receivedAmount === undefined || replay.receivedAmount === input.receivedAmount) &&
      (input.changeAmount === undefined || (replay.changeAmount ?? 0) === input.changeAmount);
    if (!same) throw conflict("Cette clé a déjà servi à un autre paiement.");
    const after = await loadSessionBilling(ctx, session);
    return { ok: true, paymentId: replay._id, due: after.checks.find((c) => c.check?._id === replay.checkId)?.balance.due ?? 0, changeAmount: replay.changeAmount ?? 0 };
  }
  assertBillable(session);
  const settings = await settingsOf(ctx, session.venueId);
  const amount = requireAmount(input.amount, "Le montant");

  const billing = await loadSessionBilling(ctx, session);
  const target = input.checkId === null ? billing.checks.find((c) => c.kind === "remainder") : billing.checks.find((c) => c.check?._id === input.checkId);
  if (!target) throw notFound("Cette addition");
  if (target.balance.due <= 0) throw conflict("Cette addition est déjà soldée.");
  if (amount > target.balance.due) throw conflict(`Le montant dépasse ce qui reste à payer sur cette addition.`);

  // Espèces : remis ≥ montant ; monnaie rendue ≤ ce qui est dû au client. Sans monnaie rendue
  // saisie, on rend tout. Si le serveur la garde, elle ressortira en écart positif.
  let receivedAmount: number | undefined;
  let changeAmount = 0;
  if (input.method === "cash") {
    receivedAmount = input.receivedAmount === undefined ? amount : requireAmount(input.receivedAmount, "Le montant remis");
    if (receivedAmount < amount) throw invalid("Le client a remis moins que le montant encaissé.");
    changeAmount = input.changeAmount === undefined ? receivedAmount - amount : requireAmount(input.changeAmount, "La monnaie rendue", { allowZero: true });
    if (changeAmount > receivedAmount - amount) throw invalid("La monnaie rendue dépasse ce que le client a remis en trop.");
  } else if (input.changeAmount !== undefined && input.changeAmount > 0) {
    // 10 000 par Wave pour 9 500 : 500 rendus en billets. L'argent sort du tiroir.
    changeAmount = requireAmount(input.changeAmount, "La monnaie rendue");
    // Borné : « Wave 500, 25 000 rendus » ferait sortir du tiroir un argent que seul le relevé du
    // téléphone permettrait de retrouver. Au-delà, deux saisies : un paiement, puis une sortie.
    if (changeAmount >= amount) throw invalid("La monnaie rendue sur un paiement qui n'est pas en espèces doit rester inférieure au montant encaissé.");
    receivedAmount = amount + changeAmount;
  }

  let wallet: string | undefined;
  if (input.method === "mobile_money") {
    const wallets = settings.payments.mobileMoneyWallets ?? [];
    if (wallets.length === 0) throw conflict("Aucun portefeuille Mobile Money n'est réglé pour cet établissement.");
    wallet = wallets.find((w) => w === input.wallet?.trim());
    if (!wallet) throw invalid("Choisissez le portefeuille qui a reçu l'argent.");
  }
  const providerRef = input.providerRef?.trim().slice(0, 60) || undefined;

  let cashRegisterSessionId: Id<"cashRegisterSessions"> | undefined;
  if (input.method === "cash" || changeAmount > 0) {
    const cash = await resolveCashSession(ctx, session.venueId, cashModeOf(settings), member, input.registerSessionId);
    // Une espèce sans caisse ouverte n'a pas d'attendu où se ranger : l'écart deviendrait
    // inexplicable. On refuse, et l'écran propose d'ouvrir la caisse d'un geste.
    if (!cash.ok) return { ok: false, reason: cash.reason };
    cashRegisterSessionId = cash.session._id;
  }

  const check = target.check ?? (await ensureRemainder(ctx, session, member));
  const now = Date.now();
  const paymentId = await ctx.db.insert("payments", {
    venueId: session.venueId,
    checkId: check._id,
    tableSessionId: session._id,
    method: input.method,
    ...(wallet ? { wallet } : {}),
    ...(providerRef ? { providerRef } : {}),
    amount,
    tipAmount: 0,
    currency: session.currency,
    status: "succeeded",
    collectedByMemberId: member._id,
    ...(actor.device ? { deviceId: actor.device._id } : {}),
    ...(cashRegisterSessionId ? { cashRegisterSessionId } : {}),
    ...(receivedAmount !== undefined ? { receivedAmount } : {}),
    ...(changeAmount > 0 ? { changeAmount } : {}),
    idempotencyKey: input.idempotencyKey,
    isSimulation: session.isSimulation,
    createdAt: now,
  });
  await ctx.db.patch(session._id, {
    lastActivityAt: now,
    ...(session.status === "settling" ? {} : { status: "settling" as const }),
  });
  await writeAudit(ctx, {
    organizationId: actor.organization._id,
    venueId: actor.venue._id,
    ...actor.audit,
    action: "payment.collect",
    resourceType: "payment",
    resourceId: paymentId,
    after: { method: input.method, wallet: wallet ?? null, amount, check: check.reference },
  });
  return { ok: true, paymentId, due: target.balance.due - amount, changeAmount };
}

/** Encaisser. `checkId: null` = le reste de la table. */
export const collect = mutation({
  args: {
    venueId: v.id("venues"), actingMemberId: v.optional(v.id("organizationMembers")),
    sessionId: v.id("tableSessions"),
    checkId: v.union(v.id("checks"), v.null()),
    method: paymentMethod,
    amount: v.number(),
    receivedAmount: v.optional(v.number()),
    changeAmount: v.optional(v.number()),
    wallet: v.optional(v.string()),
    providerRef: v.optional(v.string()),
    registerSessionId: v.optional(v.id("cashRegisterSessions")),
    idempotencyKey: v.string(),
  },
  handler: async (ctx, args): Promise<PaymentResult> => {
    const actor = await requireServiceMutation(ctx, "payment.collect", { venueId: args.venueId, actingMemberId: args.actingMemberId });
    const session = await getInVenue(ctx, args.sessionId, actor.venue._id, "Cette table");
    if (args.checkId !== null) {
      const check = await getInVenue(ctx, args.checkId, actor.venue._id, "Cette addition");
      if (check.tableSessionId !== session._id) throw notFound("Cette addition");
    }
    const { venueId: _v, sessionId: _s, actingMemberId: _a, ...input } = args;
    return applyPayment(ctx, actor, session, input);
  },
});

async function saleBillFor(ctx: MutationCtx, checkId: Id<"checks">) {
  const bills = await ctx.db
    .query("bills")
    .withIndex("by_check", (q) => q.eq("checkId", checkId))
    .collect();
  return bills.find((b) => b.kind === "sale") ?? null;
}

/**
 * Annuler une saisie erronée (mauvais montant, mauvais moyen) — seulement tant que rien ne l'a
 * scellée : caisse encore ouverte, aucun ticket, table encore ouverte. Sinon, c'est un
 * remboursement : annuler réécrirait l'attendu d'une caisse déjà comptée. Compte seulement, motif
 * obligatoire. L'auteur d'un encaissement ne l'annule pas lui-même.
 */
export const voidPayment = mutation({
  args: { venueId: v.id("venues"), actingMemberId: v.optional(v.id("organizationMembers")), paymentId: v.id("payments"), reason: v.string() },
  handler: async (ctx, args) => {
    const actor = await requireServiceMutation(ctx, "payment.void", { venueId: args.venueId, actingMemberId: args.actingMemberId });
    const member = memberOf(actor);
    const reason = requireReason(args.reason, "Le motif de l'annulation");
    const payment = await getInVenue(ctx, args.paymentId, actor.venue._id, "Ce paiement");
    if (payment.status === "voided") return;
    if (payment.status !== "succeeded") throw conflict("Ce paiement a déjà été remboursé : il ne s'annule plus.");
    if (payment.collectedByMemberId === member._id) {
      throw conflict("On n'annule pas son propre encaissement : demandez à un responsable.");
    }
    const session = (await ctx.db.get(payment.tableSessionId))!;
    if (session.status === "closed" || session.status === "closed_with_debt" || session.status === "abandoned") {
      throw conflict("La table est clôturée : remboursez plutôt qu'annuler.");
    }
    if (await saleBillFor(ctx, payment.checkId)) throw conflict("Un ticket a été remis pour cette addition : remboursez plutôt qu'annuler.");
    if (payment.cashRegisterSessionId) {
      const cash = await ctx.db.get(payment.cashRegisterSessionId);
      if (cash && cash.status !== "open") throw conflict("La caisse de ce paiement est comptée ou close : remboursez plutôt qu'annuler.");
    }
    await ctx.db.patch(payment._id, { status: "voided", voidedReason: reason, voidedByMemberId: member._id, voidedAt: Date.now() });
    await writeAudit(ctx, {
      organizationId: actor.organization._id,
      venueId: actor.venue._id,
      ...actor.audit,
      action: "payment.void",
      resourceType: "payment",
      resourceId: payment._id,
      before: { method: payment.method, amount: payment.amount, collectedBy: payment.collectedByMemberId ?? null },
      reason,
    });
  },
});

/**
 * Rendre de l'argent. Jamais au-delà de l'encaissé (R19). En espèces, l'argent sort d'une caisse
 * CHOISIE : c'est le tiroir qui paie, pas le gérant. Un ticket existait : un avoir le corrige.
 * Le dû ne se rouvre pas : un remboursement réduit la recette, il ne crée pas de dette.
 */
export const refund = mutation({
  args: {
    venueId: v.id("venues"), actingMemberId: v.optional(v.id("organizationMembers")),
    paymentId: v.id("payments"),
    amount: v.number(),
    reason: v.string(),
    method: v.union(v.literal("cash"), v.literal("original")),
    registerSessionId: v.optional(v.id("cashRegisterSessions")),
    idempotencyKey: v.string(),
  },
  handler: async (ctx, args) => {
    const actor = await requireServiceMutation(ctx, "payment.refund", { venueId: args.venueId, actingMemberId: args.actingMemberId });
    const member = memberOf(actor);
    validKey(args.idempotencyKey);
    const replay = await ctx.db
      .query("refunds")
      .withIndex("by_venue_idempotency", (q) => q.eq("venueId", actor.venue._id).eq("idempotencyKey", args.idempotencyKey))
      .unique();
    if (replay) {
      if (replay.paymentId !== args.paymentId || replay.amount !== args.amount) throw conflict("Cette clé a déjà servi à un autre remboursement.");
      return replay._id;
    }
    const reason = requireReason(args.reason, "Le motif du remboursement");
    const amount = requireAmount(args.amount, "Le montant remboursé");
    const payment = await getInVenue(ctx, args.paymentId, actor.venue._id, "Ce paiement");
    if (payment.status === "voided") throw conflict("Ce paiement est annulé : il n'y a rien à rembourser.");
    const previous = (await ctx.db
      .query("refunds")
      .withIndex("by_payment", (q) => q.eq("paymentId", payment._id))
      .collect()).filter((r) => r.status === "succeeded");
    const already = previous.reduce((s, r) => s + r.amount, 0);
    if (amount > payment.amount - already) throw conflict("On ne rembourse pas plus que ce qui a été encaissé.");
    // Un paiement en espèces se rend en espèces, « par le même moyen » compris : il faut la caisse.
    const method = args.method === "cash" ? "cash" : payment.method;
    let cashRegisterSessionId: Id<"cashRegisterSessions"> | undefined;
    if (method === "cash") {
      if (!args.registerSessionId) throw invalid("Choisissez la caisse d'où sort l'argent.");
      const cash = await getInVenue(ctx, args.registerSessionId, actor.venue._id, "Cette caisse");
      if (cash.status !== "open") throw conflict("Cette caisse est en cours de comptage ou close.");
      cashRegisterSessionId = cash._id;
    }
    const session = await ctx.db.get(payment.tableSessionId);
    const now = Date.now();
    const refundId = await ctx.db.insert("refunds", {
      venueId: actor.venue._id,
      paymentId: payment._id,
      checkId: payment.checkId,
      amount,
      method,
      ...(cashRegisterSessionId ? { cashRegisterSessionId } : {}),
      reason,
      status: "succeeded",
      requestedByMemberId: member._id,
      idempotencyKey: args.idempotencyKey,
      isSimulation: session?.isSimulation ?? false,
      createdAt: now,
    });
    await ctx.db.patch(payment._id, { status: already + amount === payment.amount ? "refunded" : "partially_refunded" });
    const sale = await saleBillFor(ctx, payment.checkId);
    if (sale) await issueCreditNote(ctx, actor, sale, amount, reason);
    await writeAudit(ctx, {
      organizationId: actor.organization._id,
      venueId: actor.venue._id,
      ...actor.audit,
      action: "payment.refund",
      resourceType: "refund",
      resourceId: refundId,
      after: { payment: payment._id, amount, method },
      reason,
    });
    return refundId;
  },
});
