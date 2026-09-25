/**
 * La caisse — Joliba (tranche T3)
 *
 * Deux organisations réelles, un seul modèle (réglage `payments.cashMode`) :
 *  - `central` : un ou plusieurs TIROIRS ; l'espèce va dans le tiroir ouvert, quel que soit
 *    l'encaisseur (noté à part sur le paiement) ;
 *  - `per_waiter` : chaque serveur porte SA POCHETTE — « la caisse de Koffi » — et la remet en fin
 *    de service. Celui qui la compte ne peut pas être celui qui la porte : sinon l'écart n'existe
 *    jamais.
 *
 * Le comptage se fait À L'AVEUGLE : l'attendu n'est montré qu'après la saisie du compté. S'il
 * s'affichait avant, on saisirait l'attendu, et un écart ne se verrait plus. Un seul recomptage,
 * et les deux comptages sont conservés. Clôturer avec un écart est permis — c'est une donnée, pas
 * une faute — mais avec un motif, et le rapport le montre avec son auteur (ARCHITECTURE.md §8).
 */

import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import type { Doc, Id } from "./_generated/dataModel";
import { writeAudit } from "./lib/audit";
import { computeExpectedCash } from "./lib/billing";
import { getInVenue } from "./lib/catalogAccess";
import { conflict, forbidden, invalid } from "./lib/errors";
import { startHourOf } from "./lib/analytics";
import { initialDiscrepancyOf } from "./lib/cashCount";
import { requirePermission, type ReadCtx } from "./lib/guards";
import { requireServiceActor, requireServiceMutation, type ServiceActor } from "./lib/serviceActor";
import { memberName, settingsOf } from "./lib/service";
import { refreshClosedDay } from "./lib/serviceDay";

export type CashMode = "central" | "per_waiter";

export function cashModeOf(settings: Doc<"venueSettings">): CashMode {
  return settings.payments.cashMode ?? "central";
}

/** Les gestes d'argent nomment une personne. Un écran de cuisine n'en porte pas. */
export function memberOf(actor: ServiceActor): Doc<"organizationMembers"> {
  if (!actor.member) throw forbidden();
  return actor.member;
}

/** Un motif lisible : trois mots, pas une lettre. */
export function requireReason(reason: string | undefined, what = "Un motif"): string {
  const clean = (reason ?? "").trim();
  if (clean.length < 5) throw invalid(`${what} est obligatoire (5 caractères au moins).`);
  if (clean.length > 300) throw invalid(`${what} tient en 300 caractères.`);
  return clean;
}

export function requireAmount(amount: number, what: string, options: { allowZero?: boolean } = {}): number {
  if (!Number.isInteger(amount) || amount < 0 || (amount === 0 && !options.allowZero)) {
    throw invalid(`${what} doit être un montant entier${options.allowZero ? "" : " positif"}.`);
  }
  return amount;
}

async function openSessionsOf(ctx: ReadCtx, venueId: Id<"venues">, status: Doc<"cashRegisterSessions">["status"]) {
  return ctx.db
    .query("cashRegisterSessions")
    .withIndex("by_venue_status", (q) => q.eq("venueId", venueId).eq("status", status))
    .collect();
}

/**
 * Où va l'espèce encaissée par `member` : la pochette de celui qui encaisse, ou le tiroir ouvert.
 * Plusieurs tiroirs ouverts : l'appelant doit désigner le sien (`registerSessionId`).
 */
export async function resolveCashSession(
  ctx: ReadCtx,
  venueId: Id<"venues">,
  mode: CashMode,
  member: Doc<"organizationMembers">,
  registerSessionId?: Id<"cashRegisterSessions">,
): Promise<{ ok: true; session: Doc<"cashRegisterSessions"> } | { ok: false; reason: "no_cash_session" | "choose_register"; options: Doc<"cashRegisterSessions">[] }> {
  if (mode === "per_waiter") {
    const mine = await ctx.db
      .query("cashRegisterSessions")
      .withIndex("by_venue_holder_status", (q) => q.eq("venueId", venueId).eq("holderMemberId", member._id).eq("status", "open"))
      .first();
    return mine ? { ok: true, session: mine } : { ok: false, reason: "no_cash_session", options: [] };
  }
  const drawers = (await openSessionsOf(ctx, venueId, "open")).filter((s) => s.cashRegisterId !== undefined);
  if (registerSessionId) {
    const chosen = drawers.find((s) => s._id === registerSessionId);
    if (chosen) return { ok: true, session: chosen };
  }
  if (drawers.length === 1) return { ok: true, session: drawers[0]! };
  return { ok: false, reason: drawers.length === 0 ? "no_cash_session" : "choose_register", options: drawers };
}

export async function registerName(ctx: ReadCtx, session: Doc<"cashRegisterSessions">): Promise<string> {
  if (session.holderMemberId) return `Pochette de ${(await memberName(ctx, session.holderMemberId)) ?? "?"}`;
  const register = session.cashRegisterId ? await ctx.db.get(session.cashRegisterId) : null;
  return register?.name ?? "Caisse";
}

/** L'attendu n'est lisible qu'une fois le comptage saisi : c'est tout le principe du comptage à l'aveugle. */
function expectedVisible(session: Doc<"cashRegisterSessions">): boolean {
  return session.status === "balanced" || session.status === "discrepancy" || session.status === "closed";
}


async function summarize(ctx: ReadCtx, session: Doc<"cashRegisterSessions">) {
  const movements = await ctx.db
    .query("cashMovements")
    .withIndex("by_session", (q) => q.eq("registerSessionId", session._id))
    .collect();
  const payments = await ctx.db
    .query("payments")
    .withIndex("by_register_session", (q) => q.eq("cashRegisterSessionId", session._id))
    .collect();
  const counts = [];
  for (const c of session.counts) counts.push({ amount: c.amount, at: c.at, by: (await memberName(ctx, c.countedByMemberId)) ?? "?" });
  return {
    _id: session._id,
    name: await registerName(ctx, session),
    kind: session.holderMemberId ? ("pouch" as const) : ("drawer" as const),
    holderMemberId: session.holderMemberId ?? null,
    status: session.status,
    openedAt: session.openedAt,
    openedBy: (await memberName(ctx, session.openedByMemberId)) ?? "?",
    openingFloat: session.openingFloat,
    currency: session.currency,
    paymentCount: payments.filter((p) => p.status !== "voided").length,
    movements: await Promise.all(
      movements.map(async (m) => ({
        _id: m._id,
        type: m.type,
        amount: m.amount,
        reason: m.reason,
        at: m.createdAt,
        by: (await memberName(ctx, m.createdByMemberId)) ?? "?",
      })),
    ),
    counts,
    expectedAmount: expectedVisible(session) ? (session.expectedAmount ?? null) : null,
    countedAmount: session.countedAmount ?? null,
    discrepancy: expectedVisible(session) ? (session.discrepancy ?? null) : null,
    /** Recomptée : l'écart du PREMIER comptage, qui ne s'efface pas avec le second. */
    initialDiscrepancy: expectedVisible(session) ? initialDiscrepancyOf(session) : null,
    closeReason: session.closeReason ?? null,
    closedAt: session.closedAt ?? null,
    closedBy: await memberName(ctx, session.closedByMemberId),
  };
}

/** L'écran de caisse : les tiroirs, les pochettes, ce que chacun peut y faire. */
export const overview = query({
  args: { venueId: v.id("venues") },
  handler: async (ctx, args) => {
    const actor = await requireServiceActor(ctx, "payment.read", { venueId: args.venueId });
    const settings = await settingsOf(ctx, actor.venue._id);
    const mode = cashModeOf(settings);
    const registers = (await ctx.db
      .query("cashRegisters")
      .withIndex("by_venue", (q) => q.eq("venueId", actor.venue._id))
      .collect()).filter((r) => r.isActive);
    const live: Doc<"cashRegisterSessions">[] = [];
    for (const status of ["open", "counting", "balanced", "discrepancy"] as const) live.push(...(await openSessionsOf(ctx, actor.venue._id, status)));
    const recentClosed = (await ctx.db
      .query("cashRegisterSessions")
      .withIndex("by_venue_openedAt", (q) => q.eq("venueId", actor.venue._id).gte("openedAt", Date.now() - 36 * 3_600_000))
      .collect()).filter((s) => s.status === "closed");
    const me = actor.member;
    const canCount = actor.permissions.has("cash_register.close");
    const sessions = [];
    for (const s of live) {
      // Un serveur ne voit que SA pochette ; qui compte voit toutes les caisses.
      if (!canCount && s.holderMemberId !== undefined && s.holderMemberId !== me?._id) continue;
      sessions.push({ ...(await summarize(ctx, s)), isMine: me !== null && s.holderMemberId === me._id });
    }
    const closed = [];
    if (canCount) for (const s of recentClosed.sort((a, b) => (b.closedAt ?? 0) - (a.closedAt ?? 0)).slice(0, 20)) closed.push(await summarize(ctx, s));
    return {
      mode,
      currency: actor.venue.currency,
      memberId: me?._id ?? null,
      registers: registers.map((r) => ({
        _id: r._id,
        name: r.name,
        busy: live.some((s) => s.cashRegisterId === r._id),
        /** Ce qui restait dans ce tiroir au dernier comptage : le fonds proposé à l'ouverture. */
        lastCounted:
          recentClosed
            .filter((s) => s.cashRegisterId === r._id)
            .sort((a, b) => (b.closedAt ?? 0) - (a.closedAt ?? 0))[0]?.countedAmount ?? null,
      })),
      sessions,
      closed,
      can: {
        openDrawer: mode === "central" && actor.permissions.has("cash_register.open"),
        openOwnPouch: mode === "per_waiter" && me !== null && (actor.permissions.has("payment.collect") || actor.permissions.has("cash_register.open")),
        count: canCount,
        manageRegisters: actor.via === "account" && actor.permissions.has("venue.settings.service"),
        /** Sortir de l'argent : depuis un compte, ou sur la pochette d'un AUTRE (D-082). */
        payoutFromAccount: actor.via === "account",
      },
    };
  },
});

/** Ajouter un tiroir (bar, comptoir). Réglage de l'établissement, depuis un compte. */
export const createRegister = mutation({
  args: { venueId: v.id("venues"), name: v.string() },
  handler: async (ctx, args) => {
    const actor = await requirePermission(ctx, "venue.settings.service", { venueId: args.venueId });
    const name = args.name.trim();
    if (name.length < 2 || name.length > 40) throw invalid("Le nom d'une caisse tient entre 2 et 40 caractères.");
    return ctx.db.insert("cashRegisters", { venueId: actor.venue._id, name, isActive: true });
  },
});

/**
 * Ouvrir une caisse avec son fonds déclaré. Tiroir : `cash_register.open`. Pochette : la sienne,
 * sous `payment.collect` — celui qui encaisse doit pouvoir ouvrir de quoi ranger l'argent.
 */
export const open = mutation({
  args: { venueId: v.id("venues"), actingMemberId: v.optional(v.id("organizationMembers")), registerId: v.optional(v.id("cashRegisters")), openingFloat: v.number() },
  handler: async (ctx, args) => {
    const actor = await requireServiceMutation(ctx, "payment.read", { venueId: args.venueId, actingMemberId: args.actingMemberId });
    const member = memberOf(actor);
    const settings = await settingsOf(ctx, actor.venue._id);
    const mode = cashModeOf(settings);
    const openingFloat = requireAmount(args.openingFloat, "Le fonds de caisse", { allowZero: true });
    const base = {
      venueId: actor.venue._id,
      openedByMemberId: member._id,
      openedAt: Date.now(),
      openingFloat,
      currency: actor.venue.currency,
      status: "open" as const,
      counts: [],
      isSimulation: actor.venue.isSimulation,
    };
    let sessionId: Id<"cashRegisterSessions">;
    let label: string;
    if (mode === "per_waiter") {
      if (!actor.permissions.has("payment.collect") && !actor.permissions.has("cash_register.open")) throw forbidden();
      for (const status of ["open", "counting", "balanced", "discrepancy"] as const) {
        const existing = await ctx.db
          .query("cashRegisterSessions")
          .withIndex("by_venue_holder_status", (q) => q.eq("venueId", actor.venue._id).eq("holderMemberId", member._id).eq("status", status))
          .first();
        if (existing) throw conflict("Votre pochette est déjà ouverte : faites-la compter avant d'en rouvrir une.");
      }
      sessionId = await ctx.db.insert("cashRegisterSessions", { ...base, holderMemberId: member._id });
      label = "pochette";
    } else {
      if (!actor.permissions.has("cash_register.open")) throw forbidden();
      let registerId = args.registerId;
      if (registerId) {
        const register = await getInVenue(ctx, registerId, actor.venue._id, "Cette caisse");
        if (!register.isActive) throw conflict("Ce tiroir n'est plus utilisé.");
      } else {
        const registers = await ctx.db
          .query("cashRegisters")
          .withIndex("by_venue", (q) => q.eq("venueId", actor.venue._id))
          .collect();
        const active = registers.filter((r) => r.isActive);
        if (active.length > 1) throw invalid("Choisissez la caisse à ouvrir.");
        registerId = active[0]?._id ?? (await ctx.db.insert("cashRegisters", { venueId: actor.venue._id, name: "Caisse principale", isActive: true }));
      }
      for (const status of ["open", "counting", "balanced", "discrepancy"] as const) {
        const existing = await ctx.db
          .query("cashRegisterSessions")
          .withIndex("by_register_status", (q) => q.eq("cashRegisterId", registerId).eq("status", status))
          .first();
        if (existing) throw conflict("Cette caisse est déjà ouverte.");
      }
      sessionId = await ctx.db.insert("cashRegisterSessions", { ...base, cashRegisterId: registerId });
      label = "tiroir";
    }
    await writeAudit(ctx, {
      organizationId: actor.organization._id,
      venueId: actor.venue._id,
      ...actor.audit,
      action: "cash_register.open",
      resourceType: "cashRegisterSession",
      resourceId: sessionId,
      after: { kind: label, openingFloat },
    });
    return sessionId;
  },
});

async function loadCashSession(ctx: ReadCtx, actor: ServiceActor, sessionId: Id<"cashRegisterSessions">) {
  return getInVenue(ctx, sessionId, actor.venue._id, "Cette caisse");
}

/** Qui compte une pochette ne la porte pas. Un tiroir peut être compté par sa caissière. */
function assertNotHolder(session: Doc<"cashRegisterSessions">, member: Doc<"organizationMembers">) {
  if (session.holderMemberId === member._id) {
    throw forbidden("On ne compte pas sa propre pochette : faites-la compter par un responsable.");
  }
}

/** Début du comptage : plus aucun encaissement ne va dans cette caisse. */
export const startCount = mutation({
  args: { venueId: v.id("venues"), actingMemberId: v.optional(v.id("organizationMembers")), sessionId: v.id("cashRegisterSessions") },
  handler: async (ctx, args) => {
    const actor = await requireServiceMutation(ctx, "cash_register.close", { venueId: args.venueId, actingMemberId: args.actingMemberId });
    const member = memberOf(actor);
    const session = await loadCashSession(ctx, actor, args.sessionId);
    assertNotHolder(session, member);
    if (session.status === "counting") return;
    if (session.status !== "open") throw conflict("Cette caisse est déjà comptée.");
    await ctx.db.patch(session._id, { status: "counting", countingStartedAt: Date.now() });
  },
});

/**
 * Revenir sur un comptage commencé par erreur, tant que rien n'a été saisi : sinon, un appui de
 * trop en plein service bloque toute espèce dans cette caisse — et une pochette en comptage ne se
 * rouvre pas.
 */
export const cancelCount = mutation({
  args: { venueId: v.id("venues"), actingMemberId: v.optional(v.id("organizationMembers")), sessionId: v.id("cashRegisterSessions") },
  handler: async (ctx, args) => {
    const actor = await requireServiceMutation(ctx, "cash_register.close", { venueId: args.venueId, actingMemberId: args.actingMemberId });
    const member = memberOf(actor);
    const session = await loadCashSession(ctx, actor, args.sessionId);
    assertNotHolder(session, member);
    if (session.status === "open") return;
    if (session.status !== "counting" || session.counts.length > 0) throw conflict("Un compté a déjà été saisi : clôturez la caisse.");
    await ctx.db.patch(session._id, { status: "open", countingStartedAt: undefined });
    await writeAudit(ctx, {
      organizationId: actor.organization._id,
      venueId: actor.venue._id,
      ...actor.audit,
      action: "cash_register.count_cancel",
      resourceType: "cashRegisterSession",
      resourceId: session._id,
    });
  },
});

/**
 * Saisir le compté. L'attendu se calcule ICI, se fige, et n'est rendu qu'après. Un second appel
 * sur une caisse en écart est le recomptage — permis une fois, et le premier comptage reste.
 */
export const submitCount = mutation({
  args: { venueId: v.id("venues"), actingMemberId: v.optional(v.id("organizationMembers")), sessionId: v.id("cashRegisterSessions"), countedAmount: v.number() },
  handler: async (ctx, args) => {
    const actor = await requireServiceMutation(ctx, "cash_register.close", { venueId: args.venueId, actingMemberId: args.actingMemberId });
    const member = memberOf(actor);
    const session = await loadCashSession(ctx, actor, args.sessionId);
    assertNotHolder(session, member);
    const counted = requireAmount(args.countedAmount, "Le montant compté", { allowZero: true });
    const recount = session.status === "discrepancy" && session.counts.length === 1;
    if (session.status !== "counting" && !recount) {
      throw conflict(session.status === "discrepancy" ? "Un seul recomptage est permis : clôturez avec l'écart et son motif." : "Commencez le comptage d'abord.");
    }
    const expected = await computeExpectedCash(ctx, session);
    const discrepancy = counted - expected;
    const now = Date.now();
    await ctx.db.patch(session._id, {
      status: discrepancy === 0 ? "balanced" : "discrepancy",
      expectedAmount: expected,
      countedAmount: counted,
      discrepancy,
      counts: [...session.counts, { amount: counted, countedByMemberId: member._id, at: now }],
    });
    await refreshClosedDay(ctx, session.venueId, session.openedAt);
    await writeAudit(ctx, {
      organizationId: actor.organization._id,
      venueId: actor.venue._id,
      ...actor.audit,
      action: recount ? "cash_register.recount" : "cash_register.count",
      resourceType: "cashRegisterSession",
      resourceId: session._id,
      after: { expected, counted, discrepancy },
    });
    return { expected, counted, discrepancy };
  },
});

/** Clôturer. Avec un écart, le motif est obligatoire — et l'écart reste, visible, attribué. */
export const close = mutation({
  args: { venueId: v.id("venues"), actingMemberId: v.optional(v.id("organizationMembers")), sessionId: v.id("cashRegisterSessions"), reason: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const actor = await requireServiceMutation(ctx, "cash_register.close", { venueId: args.venueId, actingMemberId: args.actingMemberId });
    const member = memberOf(actor);
    const session = await loadCashSession(ctx, actor, args.sessionId);
    assertNotHolder(session, member);
    if (session.status === "closed") return;
    if (session.status !== "balanced" && session.status !== "discrepancy") throw conflict("Comptez la caisse avant de la clôturer.");
    const discrepancy = session.discrepancy ?? 0;
    const initial = initialDiscrepancyOf(session) ?? 0;
    const reason =
      discrepancy !== 0 || initial !== 0
        ? requireReason(args.reason, discrepancy !== 0 ? "Le motif de l'écart" : "Le motif du recomptage")
        : args.reason?.trim() || undefined;
    await ctx.db.patch(session._id, {
      status: "closed",
      closedAt: Date.now(),
      closedByMemberId: member._id,
      ...(reason ? { closeReason: reason } : {}),
    });
    await writeAudit(ctx, {
      organizationId: actor.organization._id,
      venueId: actor.venue._id,
      ...actor.audit,
      action: "cash_register.close",
      resourceType: "cashRegisterSession",
      resourceId: session._id,
      after: {
        holder: session.holderMemberId ?? null,
        expected: session.expectedAmount ?? null,
        counted: session.countedAmount ?? null,
        discrepancy,
        counts: session.counts.map((c) => c.amount),
      },
      ...(reason ? { reason } : {}),
    });
  },
});

/** Une sortie (achat de glace, de charbon) ou une entrée (apport de monnaie), avec son motif. */
export const addMovement = mutation({
  args: {
    venueId: v.id("venues"), actingMemberId: v.optional(v.id("organizationMembers")),
    sessionId: v.id("cashRegisterSessions"),
    type: v.union(v.literal("payout"), v.literal("deposit")),
    amount: v.number(),
    reason: v.string(),
  },
  handler: async (ctx, args) => {
    const actor = await requireServiceMutation(ctx, "payment.read", { venueId: args.venueId, actingMemberId: args.actingMemberId });
    const member = memberOf(actor);
    const session = await loadCashSession(ctx, actor, args.sessionId);
    // Une entrée de monnaie : le porteur de la pochette, ou qui ouvre les caisses. Une SORTIE fait
    // partir de l'argent : il faut ouvrir les caisses, et le faire depuis un compte — ou sur la
    // pochette d'un autre. Jamais sous PIN sur son propre argent (D-082).
    const isHolder = session.holderMemberId === member._id;
    const allowed =
      args.type === "deposit"
        ? isHolder ? actor.permissions.has("payment.collect") : actor.permissions.has("cash_register.open")
        : actor.permissions.has("cash_register.open") && (actor.via === "account" || (session.holderMemberId !== undefined && !isHolder));
    if (!allowed) throw forbidden(args.type === "payout" ? "Une sortie d'argent se fait depuis un compte, ou par un responsable sur la pochette d'un autre." : undefined);
    if (session.status !== "open") throw conflict("Cette caisse est en cours de comptage ou close.");
    const amount = requireAmount(args.amount, "Le montant");
    const reason = requireReason(args.reason);
    const id = await ctx.db.insert("cashMovements", {
      venueId: actor.venue._id,
      registerSessionId: session._id,
      type: args.type,
      amount,
      reason,
      createdByMemberId: member._id,
      createdAt: Date.now(),
    });
    await writeAudit(ctx, {
      organizationId: actor.organization._id,
      venueId: actor.venue._id,
      ...actor.audit,
      action: `cash_register.${args.type}`,
      resourceType: "cashMovement",
      resourceId: id,
      after: { amount },
      reason,
    });
    return id;
  },
});

/** Réglages d'encaissement : mode de caisse, portefeuilles, pas d'arrondi, début du jour de service. */
export const setPaymentSettings = mutation({
  args: {
    venueId: v.id("venues"),
    cashMode: v.union(v.literal("central"), v.literal("per_waiter")),
    mobileMoneyWallets: v.array(v.string()),
    amountStep: v.number(),
    serviceDayStartHour: v.number(),
  },
  handler: async (ctx, args) => {
    const actor = await requirePermission(ctx, "venue.settings.service", { venueId: args.venueId });
    const settings = await settingsOf(ctx, actor.venue._id);
    const wallets = [...new Set(args.mobileMoneyWallets.map((w) => w.trim()).filter((w) => w.length > 0))];
    if (wallets.some((w) => w.length > 30) || wallets.length > 10) throw invalid("Dix portefeuilles au plus, de 30 caractères chacun.");
    if (!Number.isInteger(args.amountStep) || args.amountStep < 1 || args.amountStep > 1000) throw invalid("Le pas d'arrondi est un entier entre 1 et 1 000.");
    if (!Number.isInteger(args.serviceDayStartHour) || args.serviceDayStartHour < 0 || args.serviceDayStartHour > 12) {
      throw invalid("Le jour de service commence entre minuit et midi.");
    }
    const currentMode = cashModeOf(settings);
    if (currentMode !== args.cashMode) {
      // Changer de mode avec des caisses ouvertes laisserait des espèces sans maison.
      for (const status of ["open", "counting", "balanced", "discrepancy"] as const) {
        if ((await openSessionsOf(ctx, actor.venue._id, status)).length > 0) {
          throw conflict("Clôturez toutes les caisses ouvertes avant de changer de mode.");
        }
      }
    }
    const before = {
      cashMode: currentMode,
      mobileMoneyWallets: settings.payments.mobileMoneyWallets ?? [],
      amountStep: settings.payments.amountStep ?? 1,
      serviceDayStartHour: startHourOf(settings),
    };
    await ctx.db.patch(settings._id, {
      payments: { ...settings.payments, cashMode: args.cashMode, mobileMoneyWallets: wallets, amountStep: args.amountStep },
      service: { ...settings.service, serviceDayStartHour: args.serviceDayStartHour },
    });
    await writeAudit(ctx, {
      organizationId: actor.organization._id,
      venueId: actor.venue._id,
      actorUserId: actor.user._id,
      actorMemberId: actor.member._id,
      action: "venue.settings.payments",
      resourceType: "venue",
      resourceId: actor.venue._id,
      before,
      after: { cashMode: args.cashMode, mobileMoneyWallets: wallets, amountStep: args.amountStep, serviceDayStartHour: args.serviceDayStartHour },
    });
  },
});

/** Les réglages d'encaissement, pour l'écran de réglages. */
export const paymentSettings = query({
  args: { venueId: v.id("venues") },
  handler: async (ctx, args) => {
    const actor = await requirePermission(ctx, "venue.settings.service", { venueId: args.venueId });
    const settings = await settingsOf(ctx, actor.venue._id);
    return {
      cashMode: cashModeOf(settings),
      mobileMoneyWallets: settings.payments.mobileMoneyWallets ?? [],
      amountStep: settings.payments.amountStep ?? 1,
      serviceDayStartHour: startHourOf(settings),
    };
  },
});

