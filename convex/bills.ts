/**
 * Le ticket — Joliba (tranche T3)
 *
 * `bills`, jamais « reçu » ni « facture » : en Côte d'Ivoire ces deux mots désignent des pièces
 * CERTIFIÉES par la DGI (RNE, FNE). Un ticket Joliba porte « Document interne — ne vaut pas reçu
 * fiscal » et ne prétend rien d'autre (D-024, D-063). Aucune URL publique : rien qui ressemble à
 * une vérification officielle.
 *
 * Émis SUR DEMANDE, une fois l'addition soldée. Numéroté sans trou, par établissement, année et
 * sorte (vente, avoir). Émettre fige les lignes : la pièce ne change plus jamais, et ce qui est
 * commandé ensuite part sur une nouvelle addition. La note de table, AVANT paiement, n'est pas une
 * pièce : elle s'imprime depuis l'addition, sans numéro.
 */

import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import type { Doc, Id } from "./_generated/dataModel";
import { writeAudit } from "./lib/audit";
import { loadSessionBilling, type BillingCheck } from "./lib/billing";
import { getInVenue } from "./lib/catalogAccess";
import { conflict, forbidden } from "./lib/errors";
import type { MutationCtx, ReadCtx } from "./lib/guards";
import { requireServiceActor, requireServiceMutation, type ServiceActor } from "./lib/serviceActor";
import { memberName, nextCounter, settingsOf } from "./lib/service";
import { methodLabel } from "./checks";

export const BILL_NOTICE = "Document interne — ne vaut pas reçu fiscal";

function fiscalYearOf(now: number, timeZone: string): number {
  return Number(new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric" }).format(new Date(now)));
}

function formatAddress(venue: Doc<"venues">): string | undefined {
  const a = venue.address;
  if (!a) return undefined;
  return [a.line1, a.landmark, a.district, a.city].filter(Boolean).join(", ") || undefined;
}

async function seller(ctx: ReadCtx, venue: Doc<"venues">): Promise<Doc<"bills">["snapshot"]["seller"]> {
  const settings = await settingsOf(ctx, venue._id);
  const f = settings.fiscal;
  const address = f.legalAddress ?? formatAddress(venue);
  return {
    name: venue.name,
    ...(f.legalName ? { legalName: f.legalName } : {}),
    ...(f.taxId ? { taxId: f.taxId } : {}),
    ...(f.rccm ? { rccm: f.rccm } : {}),
    regime: f.regime,
    ...(address ? { address } : {}),
  };
}

async function nextBillNumber(ctx: MutationCtx, venue: Doc<"venues">, kind: Doc<"bills">["kind"], now: number) {
  const fiscalYear = fiscalYearOf(now, venue.timezone);
  const sequenceNumber = await nextCounter(ctx, venue._id, `bill:${kind}:${fiscalYear}`);
  const prefix = kind === "sale" ? "T" : "AV";
  return { fiscalYear, sequenceNumber, reference: `${prefix}-${fiscalYear}-${String(sequenceNumber).padStart(6, "0")}` };
}

function snapshotLines(c: BillingCheck, items: Map<Id<"orderItems">, Doc<"orderItems">>): Doc<"bills">["snapshot"]["lines"] {
  return c.lines.map((l) => {
    const item = items.get(l.orderItemId);
    const gross = l.amount;
    const taxes = (item?.taxSnapshot ?? []).map((t) => {
      const itemTax = item!.taxSnapshot.reduce((s, x) => s + x.amount, 0);
      const amount = itemTax === 0 ? 0 : Math.round((l.tax * t.amount) / itemTax);
      return { code: t.code, percent: t.percent, base: gross - l.tax, amount };
    });
    return {
      name: [l.name, l.variantName].filter(Boolean).join(" — "),
      quantity: l.quantity,
      unitPrice: l.unitPrice,
      lineTotal: gross,
      taxes,
    };
  });
}

/**
 * Émettre le ticket d'une addition soldée. Rejouer rend le même ticket. Sur le reste de la table,
 * l'émission fige ses lignes (elles deviennent des allocations) : une bière commandée ensuite ne
 * se glisse pas dans une pièce déjà remise.
 */
export const issue = mutation({
  args: { venueId: v.id("venues"), checkId: v.id("checks") },
  handler: async (ctx, args) => {
    const actor = await requireServiceMutation(ctx, "check.manage", { venueId: args.venueId });
    const check = await getInVenue(ctx, args.checkId, actor.venue._id, "Cette addition");
    const existing = (await ctx.db
      .query("bills")
      .withIndex("by_check", (q) => q.eq("checkId", check._id))
      .collect()).find((b) => b.kind === "sale");
    if (existing) return existing._id;
    const session = (await ctx.db.get(check.tableSessionId))!;
    const billing = await loadSessionBilling(ctx, session);
    const target = billing.checks.find((c) => c.check?._id === check._id);
    if (!target || target.lines.length === 0) throw conflict("Cette addition est vide.");
    if (target.balance.due !== 0) throw conflict("Le ticket se remet une fois l'addition soldée. Imprimez plutôt la note.");
    const now = Date.now();
    if (check.kind === "remainder") {
      for (const l of target.lines) {
        await ctx.db.insert("checkItems", {
          venueId: check.venueId,
          checkId: check._id,
          orderItemId: l.orderItemId,
          tableSessionId: session._id,
          quantityShare: l.quantity,
          amount: l.amount,
          addedAt: now,
        });
      }
      await ctx.db.patch(check._id, { kind: "allocated", frozenAt: now });
    }
    const items = new Map(billing.items.map((i) => [i._id, i]));
    const lines = snapshotLines(target, items);
    const payments = new Map<string, number>();
    for (const p of target.payments) if (p.status !== "voided") payments.set(methodLabel(p), (payments.get(methodLabel(p)) ?? 0) + p.amount);
    const number = await nextBillNumber(ctx, actor.venue, "sale", now);
    const billId = await ctx.db.insert("bills", {
      venueId: actor.venue._id,
      checkId: check._id,
      tableSessionId: session._id,
      kind: "sale",
      ...number,
      snapshot: {
        seller: await seller(ctx, actor.venue),
        lines,
        totals: {
          subtotal: target.balance.subtotal,
          discounts: target.balance.discounts,
          tax: lines.reduce((s, l) => s + l.taxes.reduce((t, x) => t + x.amount, 0), 0),
          serviceCharge: 0,
          total: target.balance.total,
        },
        payments: [...payments].map(([method, amount]) => ({ method, amount })),
        currency: session.currency,
        ...((await memberName(ctx, session.assignedWaiterMemberId)) ? { servedBy: (await memberName(ctx, session.assignedWaiterMemberId))! } : {}),
      },
      format: "thermal",
      fiscalType: "none",
      fiscalStatus: "none",
      issuedAt: now,
      deliveredVia: [],
    });
    await writeAudit(ctx, {
      organizationId: actor.organization._id,
      venueId: actor.venue._id,
      ...actor.audit,
      action: "bill.issue",
      resourceType: "bill",
      resourceId: billId,
      after: { reference: number.reference, total: target.balance.total },
    });
    return billId;
  },
});

/** Un avoir lié : il corrige le ticket sans le réécrire (D-063). Appelé par le remboursement. */
export async function issueCreditNote(ctx: MutationCtx, actor: ServiceActor, sale: Doc<"bills">, amount: number, reason: string): Promise<Id<"bills">> {
  const now = Date.now();
  const number = await nextBillNumber(ctx, actor.venue, "credit_note", now);
  return ctx.db.insert("bills", {
    venueId: sale.venueId,
    checkId: sale.checkId,
    tableSessionId: sale.tableSessionId,
    kind: "credit_note",
    correctsBillId: sale._id,
    ...number,
    snapshot: {
      seller: sale.snapshot.seller,
      lines: [{ name: `Remboursement — ${reason}`, quantity: 1, unitPrice: amount, lineTotal: amount, taxes: [] }],
      totals: { subtotal: amount, discounts: 0, tax: 0, serviceCharge: 0, total: amount },
      payments: [],
      currency: sale.snapshot.currency,
    },
    format: "thermal",
    fiscalType: "none",
    fiscalStatus: "none",
    issuedAt: now,
    deliveredVia: [],
  });
}

/** Une pièce, pour l'écran et l'impression. */
export const get = query({
  args: { venueId: v.id("venues"), billId: v.id("bills") },
  handler: async (ctx, args) => {
    const actor = await requireServiceActor(ctx, "payment.read", { venueId: args.venueId });
    const bill = await getInVenue(ctx, args.billId, actor.venue._id, "Ce ticket");
    const session = await ctx.db.get(bill.tableSessionId);
    const table = session ? await ctx.db.get(session.tableId) : null;
    const corrects = bill.correctsBillId ? await ctx.db.get(bill.correctsBillId) : null;
    return {
      _id: bill._id,
      kind: bill.kind,
      reference: bill.reference,
      issuedAt: bill.issuedAt,
      timezone: actor.venue.timezone,
      tableNumber: table?.number ?? null,
      snapshot: bill.snapshot,
      correctsReference: corrects?.reference ?? null,
      printed: bill.deliveredVia.includes("print"),
      notice: BILL_NOTICE,
    };
  },
});

/**
 * Imprimer. La première impression suit l'émission ; les suivantes sont des DUPLICATA, qui
 * demandent `bill.reissue` et laissent une trace — un ticket réimprimé sert parfois à rejouer
 * un encaissement.
 */
export const recordPrint = mutation({
  args: { venueId: v.id("venues"), billId: v.id("bills") },
  handler: async (ctx, args): Promise<{ duplicate: boolean }> => {
    const actor = await requireServiceMutation(ctx, "payment.read", { venueId: args.venueId });
    const bill = await getInVenue(ctx, args.billId, actor.venue._id, "Ce ticket");
    if (!bill.deliveredVia.includes("print")) {
      if (!actor.permissions.has("check.manage")) throw forbidden();
      await ctx.db.patch(bill._id, { deliveredVia: [...bill.deliveredVia, "print"] });
      return { duplicate: false };
    }
    if (!actor.permissions.has("bill.reissue")) throw forbidden("Réimprimer un ticket demande un droit que vous n'avez pas.");
    await writeAudit(ctx, {
      organizationId: actor.organization._id,
      venueId: actor.venue._id,
      ...actor.audit,
      action: "bill.reissue",
      resourceType: "bill",
      resourceId: bill._id,
      after: { reference: bill.reference },
    });
    return { duplicate: true };
  },
});
