/**
 * L'addition — Joliba (tranche T3)
 *
 * Une table porte « le reste » (calculé : tout ce qui n'a pas été détaché ailleurs) et, si on
 * partage par articles, des additions détachées. Les montants ne sont jamais stockés ici : ils se
 * calculent dans `lib/billing.ts`. Les gestes :
 *  - demander l'addition (la table passe en « addition ») ;
 *  - partager par articles (y compris un plat partagé à deux) ;
 *  - défaire un partage tant que rien n'y est payé ;
 *  - offrir une ligne, faire une remise — compte seulement, motif obligatoire, journalisé.
 *
 * Partage égal et « chacun paie tant » ne sont pas des additions : ce sont des aides dans le
 * formulaire de paiement (plusieurs paiements sur la même addition).
 */

import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import type { Doc, Id } from "./_generated/dataModel";
import { writeAudit } from "./lib/audit";
import { assertNoOpenIntent } from "./lib/intents";
import { loadSessionBilling, takeShare, lineGross, type BillingCheck, type SessionBilling } from "./lib/billing";
import { getInVenue } from "./lib/catalogAccess";
import { conflict, invalid, notFound } from "./lib/errors";
import type { MutationCtx, ReadCtx } from "./lib/guards";
import { requireServiceActor, requireServiceMutation, type ServiceActor } from "./lib/serviceActor";
import { isOpenSession, memberName, settingsOf } from "./lib/service";
import { cashModeOf, memberOf, registerName, requireAmount, requireReason, resolveCashSession } from "./cash";

/** « TS-2026-000123-2 » : la session, puis le rang de l'addition dans la session. */
export async function nextCheckReference(ctx: ReadCtx, session: Doc<"tableSessions">): Promise<string> {
  const existing = await ctx.db
    .query("checks")
    .withIndex("by_session", (q) => q.eq("tableSessionId", session._id))
    .collect();
  return `${session.reference}-${existing.length + 1}`;
}

/** Le « reste de la table » matérialisé : il faut un identifiant pour y rattacher un paiement. */
/** `member` absent : matérialisé par un paiement en ligne, sans humain (D-118). */
export async function ensureRemainder(ctx: MutationCtx, session: Doc<"tableSessions">, member: Doc<"organizationMembers"> | null): Promise<Doc<"checks">> {
  const checks = await ctx.db
    .query("checks")
    .withIndex("by_session", (q) => q.eq("tableSessionId", session._id))
    .collect();
  const existing = checks.find((c) => c.kind === "remainder" && c.status === "open");
  if (existing) return existing;
  const id = await ctx.db.insert("checks", {
    venueId: session.venueId,
    tableSessionId: session._id,
    reference: `${session.reference}-${checks.length + 1}`,
    kind: "remainder",
    status: "open",
    currency: session.currency,
    ...(member ? { createdByMemberId: member._id } : {}),
    createdAt: Date.now(),
  });
  return (await ctx.db.get(id))!;
}

/** Une session où l'on peut encore agir sur l'addition. */
export function assertBillable(session: Doc<"tableSessions">) {
  if (!isOpenSession(session)) throw conflict("Cette table est clôturée.");
}

/** L'addition visée : par son identifiant, ou le reste de la table. */
function findCheck(billing: SessionBilling, checkId: Id<"checks"> | null): BillingCheck {
  const found = checkId === null ? billing.checks.find((c) => c.kind === "remainder") : billing.checks.find((c) => c.check?._id === checkId);
  if (!found) throw notFound("Cette addition");
  return found;
}

async function billsOf(ctx: ReadCtx, checkId: Id<"checks">) {
  return ctx.db
    .query("bills")
    .withIndex("by_check", (q) => q.eq("checkId", checkId))
    .collect();
}

const METHOD_LABEL: Record<Doc<"payments">["method"], string> = {
  cash: "Espèces",
  mobile_money: "Mobile Money",
  card: "Carte",
  external_terminal: "Terminal",
  transfer: "Virement",
  other: "Autre",
};

export function methodLabel(p: Pick<Doc<"payments">, "method" | "wallet">): string {
  return p.method === "mobile_money" && p.wallet ? p.wallet : METHOD_LABEL[p.method];
}

/**
 * L'addition d'une table, pour l'écran du serveur ou de la caisse : chaque addition, ses lignes,
 * ses ajustements, ses paiements, son solde — et ce que la personne peut y faire.
 */
async function refundedOf(ctx: ReadCtx, paymentId: Id<"payments">): Promise<number> {
  const rows = await ctx.db
    .query("refunds")
    .withIndex("by_payment", (q) => q.eq("paymentId", paymentId))
    .collect();
  return rows.filter((r) => r.status === "succeeded").reduce((s, r) => s + r.amount, 0);
}

export const forSession = query({
  args: { venueId: v.id("venues"), sessionId: v.id("tableSessions") },
  handler: async (ctx, args) => {
    const actor = await requireServiceActor(ctx, "payment.read", { venueId: args.venueId });
    const session = await getInVenue(ctx, args.sessionId, actor.venue._id, "Cette table");
    const settings = await settingsOf(ctx, actor.venue._id);
    const billing = await loadSessionBilling(ctx, session);
    const table = await ctx.db.get(session.tableId);
    const mode = cashModeOf(settings);
    const cash = actor.member ? await resolveCashSession(ctx, actor.venue._id, mode, actor.member) : null;
    const guests = await ctx.db
      .query("guestSessions")
      .withIndex("by_session", (q) => q.eq("tableSessionId", session._id))
      .collect();
    const numberOf = new Map(guests.map((g) => [g._id as string, g.guestNumber ?? null]));
    // Une ligne n'a de convive que s'il est UNIQUE : partagée ou saisie par le serveur, elle reste
    // sur le reste de la table.
    const guestOfItem = new Map<string, number | null>();
    for (const item of billing.items) {
      const [only, ...others] = item.assignedGuestSessionIds;
      guestOfItem.set(item._id, only && others.length === 0 ? (numberOf.get(only) ?? null) : null);
    }
    const checks = [];
    for (const c of billing.checks) {
      const payments = [];
      for (const p of c.payments.sort((a, b) => a.createdAt - b.createdAt)) {
        payments.push({
          _id: p._id,
          method: p.method,
          label: methodLabel(p),
          amount: p.amount,
          receivedAmount: p.receivedAmount ?? null,
          changeAmount: p.changeAmount ?? null,
          providerRef: p.providerRef ?? null,
          status: p.status,
          createdAt: p.createdAt,
          collectedBy: await memberName(ctx, p.collectedByMemberId),
          voidedReason: p.voidedReason ?? null,
          cashSessionOpen: p.cashRegisterSessionId ? (await ctx.db.get(p.cashRegisterSessionId))?.status === "open" : null,
          /** L'auteur n'annule pas son propre encaissement : le bouton ne s'offre pas. */
          mine: actor.member !== null && p.collectedByMemberId === actor.member._id,
          /** Ce qui reste remboursable : le montant proposé, et « rembourser » disparaît à zéro. */
          refundable: p.status === "voided" ? 0 : p.amount - (await refundedOf(ctx, p._id)),
        });
      }
      const adjustments = [];
      for (const a of c.adjustments) {
        adjustments.push({ _id: a._id, type: a.type, label: a.label, amount: a.amount, reason: a.reason ?? null, by: await memberName(ctx, a.appliedByMemberId) });
      }
      const bills = c.check ? await billsOf(ctx, c.check._id) : [];
      checks.push({
        _id: c.check?._id ?? null,
        reference: c.check?.reference ?? null,
        kind: c.kind,
        label: c.check?.label ?? (c.kind === "remainder" ? "Table" : null),
        // Le convive de chaque ligne (D-102) : « Articles du convive 2 » présélectionne le partage.
        lines: c.lines.map((l) => ({ ...l, guestNumber: guestOfItem.get(l.orderItemId) ?? null })),
        adjustments,
        payments,
        balance: c.balance,
        bills: bills.map((b) => ({ _id: b._id, reference: b.reference, kind: b.kind, issuedAt: b.issuedAt })),
      });
    }
    const unserved = billing.items.filter((i) => i.status !== "served").length;
    return {
      sessionId: session._id,
      sessionReference: session.reference,
      sessionStatus: session.status,
      tableNumber: table?.number ?? "?",
      currency: session.currency,
      total: billing.total,
      paid: billing.paid,
      due: billing.due,
      unserved,
      checks,
      settings: {
        cashMode: mode,
        wallets: settings.payments.mobileMoneyWallets ?? [],
        amountStep: settings.payments.amountStep ?? 1,
      },
      /** Où ira l'espèce encaissée par cette personne, s'il y en a une. */
      cash:
        cash === null
          ? null
          : cash.ok
            ? { status: "ready" as const, sessionId: cash.session._id, options: [] }
            : { status: cash.reason, sessionId: null, options: await Promise.all(cash.options.map(async (o) => ({ _id: o._id, name: await registerName(ctx, o) }))) },
      can: {
        collect: actor.permissions.has("payment.collect") && (isOpenSession(session) || (session.status === "closed_with_debt" && session.debtSettledAt === undefined)),
        manage: actor.permissions.has("check.manage") && isOpenSession(session),
        discount: actor.permissions.has("order.discount.apply") && isOpenSession(session),
        void: actor.permissions.has("payment.void"),
        refund: actor.permissions.has("payment.refund"),
        closeWithDebt: actor.permissions.has("table.session.close_with_debt") && isOpenSession(session),
        issueBill: actor.permissions.has("check.manage"),
      },
    };
  },
});

/** « L'addition ! » : la table passe en addition ; le reste de la table se matérialise. */
export const requestBill = mutation({
  args: { venueId: v.id("venues"), actingMemberId: v.optional(v.id("organizationMembers")), sessionId: v.id("tableSessions") },
  handler: async (ctx, args) => {
    const actor = await requireServiceMutation(ctx, "check.manage", { venueId: args.venueId, actingMemberId: args.actingMemberId });
    const member = memberOf(actor);
    const session = await getInVenue(ctx, args.sessionId, actor.venue._id, "Cette table");
    assertBillable(session);
    const check = await ensureRemainder(ctx, session, member);
    if (session.status === "open" || session.status === "ordering") {
      await ctx.db.patch(session._id, { status: "billing", lastActivityAt: Date.now() });
    }
    return check._id;
  },
});

/**
 * Partager par articles : détacher des lignes — ou une part d'une ligne — du reste de la table
 * vers une nouvelle addition. Refusé si le reste a déjà encaissé plus que ce qui lui resterait :
 * on ne détache pas ce qui est déjà payé.
 */
export const split = mutation({
  args: {
    venueId: v.id("venues"), actingMemberId: v.optional(v.id("organizationMembers")),
    sessionId: v.id("tableSessions"),
    label: v.optional(v.string()),
    lines: v.array(v.object({ orderItemId: v.id("orderItems"), quantity: v.number() })),
  },
  handler: async (ctx, args) => {
    const actor = await requireServiceMutation(ctx, "check.manage", { venueId: args.venueId, actingMemberId: args.actingMemberId });
    const member = memberOf(actor);
    const session = await getInVenue(ctx, args.sessionId, actor.venue._id, "Cette table");
    assertBillable(session);
    if (args.lines.length === 0) throw invalid("Choisissez au moins une ligne.");
    if (args.lines.length > 60) throw invalid("60 lignes au plus.");
    const label = args.label?.trim().slice(0, 40) || undefined;
    const billing = await loadSessionBilling(ctx, session);
    const rest = billing.checks.find((c) => c.kind === "remainder");
    if (!rest) throw conflict("Il ne reste rien à partager sur cette table.");
    // Détacher des lignes baisse le dû du reste : pas pendant qu'un client le paie en ligne (D-114).
    if (rest.check) await assertNoOpenIntent(ctx, session._id, rest.check._id);
    const restComped = new Set(rest.adjustments.filter((a) => a.type === "comp").map((a) => a.orderItemId));
    const shares: { item: Doc<"orderItems">; quantity: number; amount: number }[] = [];
    const seen = new Set<Id<"orderItems">>();
    for (const l of args.lines) {
      if (seen.has(l.orderItemId)) throw invalid("Une ligne apparaît deux fois.");
      seen.add(l.orderItemId);
      const item = billing.items.find((i) => i._id === l.orderItemId);
      if (!item) throw notFound("Cette ligne");
      if (restComped.has(item._id)) throw conflict(`${item.nameSnapshot} est offert : il reste sur l'addition de la table.`);
      const share = takeShare({ quantity: item.quantity, gross: lineGross(item) }, billing.taken.get(item._id) ?? [], l.quantity);
      if ("error" in share) throw invalid(`${item.nameSnapshot} : ${share.error}`);
      shares.push({ item, ...share });
    }
    const moved = shares.reduce((s, x) => s + x.amount, 0);
    if (rest.balance.due - moved < 0) {
      throw conflict("Une partie de ces lignes est déjà payée sur l'addition de la table : on ne la détache plus.");
    }
    const now = Date.now();
    const checkId = await ctx.db.insert("checks", {
      venueId: session.venueId,
      tableSessionId: session._id,
      reference: await nextCheckReference(ctx, session),
      ...(label ? { label } : {}),
      kind: "allocated",
      status: "open",
      currency: session.currency,
      createdByMemberId: member._id,
      createdAt: now,
    });
    for (const s of shares) {
      await ctx.db.insert("checkItems", {
        venueId: session.venueId,
        checkId,
        orderItemId: s.item._id,
        tableSessionId: session._id,
        quantityShare: s.quantity,
        amount: s.amount,
        addedAt: now,
      });
    }
    if (session.status === "open" || session.status === "ordering") await ctx.db.patch(session._id, { status: "billing", lastActivityAt: now });
    return checkId;
  },
});

/** Défaire un partage : tant que rien n'y est payé ni offert, ses lignes retournent au reste. */
export const unsplit = mutation({
  args: { venueId: v.id("venues"), actingMemberId: v.optional(v.id("organizationMembers")), checkId: v.id("checks") },
  handler: async (ctx, args) => {
    const actor = await requireServiceMutation(ctx, "check.manage", { venueId: args.venueId, actingMemberId: args.actingMemberId });
    const check = await getInVenue(ctx, args.checkId, actor.venue._id, "Cette addition");
    if (check.status === "voided") return;
    if (check.kind !== "allocated" || check.frozenAt !== undefined) throw conflict("Cette addition ne se défait pas.");
    const session = (await ctx.db.get(check.tableSessionId))!;
    assertBillable(session);
    await assertNoOpenIntent(ctx, session._id, check._id);
    const payments = await ctx.db
      .query("payments")
      .withIndex("by_check", (q) => q.eq("checkId", check._id))
      .collect();
    if (payments.some((p) => p.status !== "voided")) throw conflict("Un paiement est déjà enregistré sur cette addition.");
    const adjustments = await ctx.db
      .query("orderAdjustments")
      .withIndex("by_check", (q) => q.eq("checkId", check._id))
      .collect();
    if (adjustments.length > 0) throw conflict("Un offert ou une remise porte sur cette addition.");
    // Une part de la même ligne offerte sur le reste de la table : défaire le partage mêlerait une
    // part offerte et une part due sur une seule ligne, affichée « Offert » alors qu'elle reste due.
    const allocations = await ctx.db
      .query("checkItems")
      .withIndex("by_check", (q) => q.eq("checkId", check._id))
      .collect();
    const lines = new Set(allocations.map((a) => a.orderItemId));
    for (const other of await ctx.db
      .query("checks")
      .withIndex("by_session", (q) => q.eq("tableSessionId", session._id))
      .collect()) {
      if (other._id === check._id || other.status === "voided") continue;
      const comps = await ctx.db
        .query("orderAdjustments")
        .withIndex("by_check", (q) => q.eq("checkId", other._id))
        .collect();
      if (comps.some((a) => a.type === "comp" && a.orderItemId !== undefined && lines.has(a.orderItemId))) {
        throw conflict("Une part de ces lignes est offerte sur une autre addition : ce partage ne se défait plus.");
      }
    }
    await ctx.db.patch(check._id, { status: "voided" });
  },
});

async function adjustmentTarget(ctx: MutationCtx, actor: ServiceActor, sessionId: Id<"tableSessions">, checkId: Id<"checks"> | null) {
  const member = memberOf(actor);
  const session = await getInVenue(ctx, sessionId, actor.venue._id, "Cette table");
  assertBillable(session);
  let billing = await loadSessionBilling(ctx, session);
  let target = findCheck(billing, checkId);
  if (target.check) await assertNoOpenIntent(ctx, session._id, target.check._id);
  let check = target.check;
  if (!check) {
    check = await ensureRemainder(ctx, session, member);
    billing = await loadSessionBilling(ctx, session);
    target = findCheck(billing, check._id);
  }
  return { member, session, target, check };
}

/**
 * Offrir une ligne (un plat servi puis refusé, le geste de la maison). Sans ce geste, un plat servi
 * laissait un dû impossible à solder. Refusé au-delà du dû : ce qui est payé se rembourse.
 */
export const comp = mutation({
  args: {
    venueId: v.id("venues"), actingMemberId: v.optional(v.id("organizationMembers")),
    sessionId: v.id("tableSessions"),
    checkId: v.union(v.id("checks"), v.null()),
    orderItemId: v.id("orderItems"),
    reason: v.string(),
  },
  handler: async (ctx, args) => {
    const actor = await requireServiceMutation(ctx, "order.discount.apply", { venueId: args.venueId, actingMemberId: args.actingMemberId });
    const reason = requireReason(args.reason, "Le motif de l'offert");
    const { member, session, target, check } = await adjustmentTarget(ctx, actor, args.sessionId, args.checkId);
    const line = target.lines.find((l) => l.orderItemId === args.orderItemId);
    if (!line) throw notFound("Cette ligne");
    if (line.comped) return;
    if (line.amount > target.balance.due) throw conflict("Cette ligne est déjà payée : remboursez plutôt que d'offrir.");
    const item = (await ctx.db.get(args.orderItemId))!;
    const id = await ctx.db.insert("orderAdjustments", {
      venueId: session.venueId,
      tableSessionId: session._id,
      orderId: item.orderId,
      checkId: check._id,
      orderItemId: item._id,
      type: "comp",
      source: "manual",
      label: `Offert : ${item.nameSnapshot}`,
      amount: line.amount,
      appliedByMemberId: member._id,
      reason,
      createdAt: Date.now(),
    });
    await writeAudit(ctx, {
      organizationId: actor.organization._id,
      venueId: actor.venue._id,
      ...actor.audit,
      action: "order.comp",
      resourceType: "orderAdjustment",
      resourceId: id,
      after: { item: item.nameSnapshot, amount: line.amount, check: check.reference },
      reason,
    });
    return id;
  },
});

/** Une remise en montant sur une addition. Jamais au-delà du dû. */
export const discount = mutation({
  args: {
    venueId: v.id("venues"), actingMemberId: v.optional(v.id("organizationMembers")),
    sessionId: v.id("tableSessions"),
    checkId: v.union(v.id("checks"), v.null()),
    amount: v.number(),
    reason: v.string(),
  },
  handler: async (ctx, args) => {
    const actor = await requireServiceMutation(ctx, "order.discount.apply", { venueId: args.venueId, actingMemberId: args.actingMemberId });
    const reason = requireReason(args.reason, "Le motif de la remise");
    const amount = requireAmount(args.amount, "La remise");
    const { member, session, target, check } = await adjustmentTarget(ctx, actor, args.sessionId, args.checkId);
    if (amount > target.balance.due) throw conflict("La remise dépasse ce qui reste à payer.");
    const id = await ctx.db.insert("orderAdjustments", {
      venueId: session.venueId,
      tableSessionId: session._id,
      checkId: check._id,
      type: "discount",
      source: "manual",
      label: "Remise",
      amount,
      appliedByMemberId: member._id,
      reason,
      createdAt: Date.now(),
    });
    await writeAudit(ctx, {
      organizationId: actor.organization._id,
      venueId: actor.venue._id,
      ...actor.audit,
      action: "order.discount",
      resourceType: "orderAdjustment",
      resourceId: id,
      after: { amount, check: check.reference },
      reason,
    });
    return id;
  },
});
