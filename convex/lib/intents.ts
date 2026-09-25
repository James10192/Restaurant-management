/**
 * Les intentions de paiement en ligne ouvertes — Joliba (D-114)
 *
 * Tant qu'une intention est ouverte (`initializing`, `processing`), le client peut encore payer
 * chez le fournisseur EXACTEMENT le montant figé à sa création. Tout geste qui ferait baisser le
 * dû de son addition — partager, offrir, remiser, annuler un plat, clôturer — est donc refusé :
 * sinon Wave encaisserait plus que ce qui est dû, et le trop-perçu naîtrait d'un geste du
 * personnel. Le message dit quoi faire : annuler le paiement en ligne d'abord.
 */

import { internal } from "../_generated/api";
import type { Doc, Id } from "../_generated/dataModel";
import { formatAmount } from "./billing";
import { conflict } from "./errors";
import type { MutationCtx, ReadCtx } from "./guards";

export const OPEN_INTENT: readonly Doc<"paymentIntents">["status"][] = ["initializing", "processing"];

export function isOpenIntent(intent: Pick<Doc<"paymentIntents">, "status">): boolean {
  return OPEN_INTENT.includes(intent.status);
}

export async function openIntentsOfSession(ctx: ReadCtx, sessionId: Id<"tableSessions">): Promise<Doc<"paymentIntents">[]> {
  const out: Doc<"paymentIntents">[] = [];
  for (const status of OPEN_INTENT) {
    out.push(
      ...(await ctx.db
        .query("paymentIntents")
        .withIndex("by_session_status", (q) => q.eq("tableSessionId", sessionId).eq("status", status))
        .collect()),
    );
  }
  return out;
}

export async function openIntentsOfCheck(ctx: ReadCtx, checkId: Id<"checks">): Promise<Doc<"paymentIntents">[]> {
  const out: Doc<"paymentIntents">[] = [];
  for (const status of OPEN_INTENT) {
    out.push(
      ...(await ctx.db
        .query("paymentIntents")
        .withIndex("by_check_status", (q) => q.eq("checkId", checkId).eq("status", status))
        .collect()),
    );
  }
  return out;
}

/**
 * Refuse le geste si un paiement en ligne est en cours sur l'addition visée — ou, sans addition
 * précisée, n'importe où sur la table (annuler un plat, clôturer).
 */
export async function assertNoOpenIntent(ctx: ReadCtx, sessionId: Id<"tableSessions">, checkId?: Id<"checks">): Promise<void> {
  const open = checkId === undefined ? await openIntentsOfSession(ctx, sessionId) : await openIntentsOfCheck(ctx, checkId);
  const first = open[0];
  if (!first) return;
  throw conflict(`Un paiement en ligne de ${formatAmount(first.amount, first.currency)} est en cours sur cette addition : annulez-le d'abord.`);
}

/**
 * Fermer chez le fournisseur les sessions encore ouvertes sur une addition : elle vient d'être
 * soldée autrement, ou le personnel annule. L'intention reste OUVERTE jusqu'à la réponse du
 * fournisseur — s'il répond « déjà payée », l'argent sera enregistré, pas perdu.
 */
export async function expireOpenIntentsOf(ctx: MutationCtx, checkId: Id<"checks">, reason: "settled_elsewhere" | "staff_cancel", memberId?: Id<"organizationMembers">): Promise<number> {
  const open = await openIntentsOfCheck(ctx, checkId);
  const now = Date.now();
  for (const intent of open) {
    if (intent.cancelRequestedAt !== undefined) continue;
    await ctx.db.patch(intent._id, {
      cancelRequestedAt: now,
      ...(memberId ? { cancelRequestedByMemberId: memberId } : {}),
      failureReason: reason,
      updatedAt: now,
    });
    await ctx.scheduler.runAfter(0, internal.onlinePayments.expireIntent, { intentId: intent._id });
  }
  return open.length;
}

/**
 * L'addition « Convive N » créée POUR une intention qui n'a pas abouti se défait, si rien n'y
 * est payé ni offert : ses lignes retournent au reste de la table (D-113).
 */
export async function undoCreatedCheck(ctx: MutationCtx, intent: Doc<"paymentIntents">): Promise<void> {
  if (!intent.createdCheck) return;
  const check = await ctx.db.get(intent.checkId);
  if (!check || check.status === "voided" || check.frozenAt !== undefined) return;
  const payments = await ctx.db
    .query("payments")
    .withIndex("by_check", (q) => q.eq("checkId", check._id))
    .collect();
  if (payments.some((p) => p.status !== "voided")) return;
  const adjustments = await ctx.db
    .query("orderAdjustments")
    .withIndex("by_check", (q) => q.eq("checkId", check._id))
    .collect();
  if (adjustments.length > 0) return;
  if ((await openIntentsOfCheck(ctx, check._id)).some((i) => i._id !== intent._id)) return;
  await ctx.db.patch(check._id, { status: "voided" });
}

/**
 * Un trop-perçu n'est traité que lorsqu'on a rendu AU MOINS ce trop-perçu (remboursements
 * confirmés sur l'addition depuis l'alerte). Un remboursement de 1 F ne referme pas une alerte de
 * 5 000 ; un remboursement en attente chez Wave non plus.
 */
export async function resolveOverpaidIfCovered(ctx: MutationCtx, payment: Doc<"payments">, memberId?: Id<"organizationMembers">): Promise<void> {
  const alert = await ctx.db
    .query("paymentAlerts")
    .withIndex("by_venue_dedupe", (q) => q.eq("venueId", payment.venueId).eq("dedupeKey", `overpaid:${payment._id}`))
    .first();
  if (!alert || alert.resolvedAt !== undefined) return;
  const payments = await ctx.db
    .query("payments")
    .withIndex("by_check", (q) => q.eq("checkId", payment.checkId))
    .collect();
  let refunded = 0;
  for (const p of payments) {
    for (const r of await ctx.db.query("refunds").withIndex("by_payment", (q) => q.eq("paymentId", p._id)).collect()) {
      if (r.status === "succeeded" && r.createdAt >= alert.createdAt) refunded += r.amount;
    }
  }
  if (refunded < (alert.amount ?? 0)) return;
  await ctx.db.patch(alert._id, { resolvedAt: Date.now(), ...(memberId ? { resolvedByMemberId: memberId } : {}), resolution: "refunded" });
}

/** Une alerte, dédoublonnée : la même cause ne crie qu'une fois tant qu'elle n'est pas traitée. */
export async function raiseAlert(
  ctx: MutationCtx,
  alert: Omit<Doc<"paymentAlerts">, "_id" | "_creationTime" | "createdAt" | "resolvedAt" | "resolvedByMemberId" | "resolution">,
): Promise<Id<"paymentAlerts">> {
  const existing = await ctx.db
    .query("paymentAlerts")
    .withIndex("by_venue_dedupe", (q) => q.eq("venueId", alert.venueId).eq("dedupeKey", alert.dedupeKey))
    .first();
  if (existing) return existing._id;
  return ctx.db.insert("paymentAlerts", { ...alert, createdAt: Date.now() });
}

/**
 * La règle exacte de D-114 pour un geste simulé : après lui, chaque addition portant un paiement
 * en ligne ouvert doit encore devoir AU MOINS ce montant. Une annulation d'une commande pas encore
 * acceptée, qui ne touche pas l'addition, passe donc.
 */
export async function assertIntentsStillCovered(
  ctx: ReadCtx,
  sessionId: Id<"tableSessions">,
  after: { checks: readonly { check: Doc<"checks"> | null; balance: { due: number } }[] },
): Promise<void> {
  const open = await openIntentsOfSession(ctx, sessionId);
  const byCheck = new Map<string, number>();
  for (const i of open) byCheck.set(i.checkId, (byCheck.get(i.checkId) ?? 0) + i.amount);
  for (const [checkId, amount] of byCheck) {
    const due = after.checks.find((c) => c.check?._id === checkId)?.balance.due ?? 0;
    if (due < amount) {
      const first = open.find((i) => i.checkId === checkId)!;
      throw conflict(`Un paiement en ligne de ${formatAmount(first.amount, first.currency)} est en cours sur cette addition : annulez-le d'abord.`);
    }
  }
}
