/**
 * L'addition et la caisse — Joliba (tranche T3)
 *
 * Une seule source de vérité pour l'argent d'une table : les LIGNES (`orderItems`), les
 * AJUSTEMENTS (`orderAdjustments` : offert, remise) et les PAIEMENTS. Aucun total n'est stocké sur
 * une addition ; tout se recalcule ici, par des fonctions pures que les tests exercent sans base.
 * Seul le ticket (`bills.snapshot`) fige des totaux, parce qu'une pièce remise ne change plus.
 *
 * Deux invariants tiennent tout (PAYMENTS.md §5, R17) :
 *  - aucun franc ne disparaît : la somme des parts d'une ligne est son montant, le reste d'une
 *    division reste sur « le reste de la table » ;
 *  - le dû d'une addition n'est jamais négatif : on n'encaisse pas au-delà, on n'annule ni
 *    n'offre ce qui est déjà payé — on rembourse.
 */

import type { Doc, Id } from "../_generated/dataModel";
import type { ReadCtx } from "./guards";
import { formatMoney, isSupportedCurrency } from "./money";

/** Un montant dans un message d'erreur, formaté comme partout ailleurs (jamais « 5000 XOF » brut). */
export function formatAmount(amount: number, currency: string): string {
  return isSupportedCurrency(currency) ? formatMoney({ amount, currency }) : `${amount} ${currency}`;
}

/* ────────────────────────────────────────────────────────────────────────────
 * Fonctions pures
 * ──────────────────────────────────────────────────────────────────────────── */

/** Tolérance sur les quantités fractionnaires (un plat partagé à trois). Jamais sur un montant. */
const EPSILON = 1e-9;

/**
 * Ce que la ligne coûte au client : son total, plus la taxe si les prix étaient hors taxe au
 * moment de la commande. Une ligne TTC porte sa taxe « dedans » : on ne l'ajoute pas deux fois.
 */
export function lineGross(item: Pick<Doc<"orderItems">, "lineTotal" | "taxSnapshot" | "taxIncluded">): number {
  if (item.taxIncluded === false) return item.lineTotal + item.taxSnapshot.reduce((s, t) => s + t.amount, 0);
  return item.lineTotal;
}

/** La taxe comprise dans une part de ligne, au prorata. */
export function lineTaxShare(item: Pick<Doc<"orderItems">, "lineTotal" | "taxSnapshot" | "taxIncluded">, amount: number): number {
  const gross = lineGross(item);
  const tax = item.taxSnapshot.reduce((s, t) => s + t.amount, 0);
  if (gross === 0) return 0;
  return Math.round((tax * amount) / gross);
}

export type Share = { quantity: number; amount: number };

/**
 * Détacher une part d'une ligne. `quantity` peut être fractionnaire (½ bouteille). Le montant de
 * la part est arrondi à l'unité INFÉRIEURE ; ce qui reste appartient au reste de la table, et
 * celui qui prend le dernier morceau prend exactement ce qui reste. Aucun franc ne se perd.
 */
export function takeShare(
  line: { quantity: number; gross: number },
  alreadyTaken: readonly Share[],
  requested: number,
): Share | { error: string } {
  if (!(requested > 0)) return { error: "La part doit être positive." };
  const takenQty = alreadyTaken.reduce((s, a) => s + a.quantity, 0);
  const takenAmount = alreadyTaken.reduce((s, a) => s + a.amount, 0);
  const leftQty = line.quantity - takenQty;
  if (requested > leftQty + EPSILON) return { error: "Cette part dépasse ce qui reste de la ligne." };
  if (Math.abs(requested - leftQty) < EPSILON) return { quantity: leftQty, amount: line.gross - takenAmount };
  return { quantity: requested, amount: Math.floor((line.gross * requested) / line.quantity) };
}

export type Balance = {
  /** Somme des lignes. */
  subtotal: number;
  /** Offerts et remises. */
  discounts: number;
  total: number;
  /** Encaissé et non annulé. Un remboursement ne rouvre pas le dû : il réduit la recette. */
  paid: number;
  due: number;
};

export function checkBalance(input: {
  lines: readonly { amount: number }[];
  adjustments: readonly { amount: number }[];
  payments: readonly { amount: number; status: Doc<"payments">["status"] }[];
}): Balance {
  const subtotal = input.lines.reduce((s, l) => s + l.amount, 0);
  const discounts = input.adjustments.reduce((s, a) => s + a.amount, 0);
  const total = subtotal - discounts;
  const paid = input.payments.filter((p) => p.status !== "voided").reduce((s, p) => s + p.amount, 0);
  return { subtotal, discounts, total, paid, due: total - paid };
}

/**
 * Parts égales suggérées (« on partage en 3 »). Rien n'est stocké : c'est une aide à la saisie.
 * Chaque part est arrondie au pas de l'établissement (pièces de 25, 50…) ; le reste va sur la
 * PREMIÈRE part, jamais perdu.
 */
export function evenSplit(due: number, parts: number, step = 1): number[] {
  if (!Number.isInteger(parts) || parts < 1) throw new Error("Nombre de parts invalide.");
  const unit = Math.max(1, Math.floor(step));
  const base = Math.floor(due / parts / unit) * unit;
  const first = due - base * (parts - 1);
  return [first, ...Array.from({ length: parts - 1 }, () => base)];
}

/**
 * Ce que la caisse DOIT contenir. Calculé, jamais saisi (PAYMENTS.md §6) :
 * fonds + espèces encaissées − monnaie rendue en billets sur un paiement non espèces
 * − remboursements en espèces − sorties + entrées.
 *
 * Pour un paiement EN espèces, seul le montant imputé compte : la monnaie rendue est déjà hors
 * du montant. Si le serveur a gardé la monnaie (« pas de monnaie »), elle ressort en écart
 * positif — visible, pas absorbée.
 */
export function expectedCash(input: {
  openingFloat: number;
  payments: readonly Pick<Doc<"payments">, "method" | "amount" | "changeAmount" | "status">[];
  cashRefunds: readonly { amount: number }[];
  movements: readonly Pick<Doc<"cashMovements">, "type" | "amount">[];
}): number {
  let expected = input.openingFloat;
  for (const p of input.payments) {
    if (p.status === "voided") continue;
    if (p.method === "cash") expected += p.amount;
    else expected -= p.changeAmount ?? 0;
  }
  for (const r of input.cashRefunds) expected -= r.amount;
  for (const m of input.movements) expected += m.type === "deposit" ? m.amount : -m.amount;
  return expected;
}

/* ────────────────────────────────────────────────────────────────────────────
 * Chargement d'une table
 * ──────────────────────────────────────────────────────────────────────────── */

export type BillingLine = {
  orderItemId: Id<"orderItems">;
  name: string;
  variantName: string | null;
  modifiers: string[];
  /** La part de la ligne sur CETTE addition (fractionnaire pour un plat partagé). */
  quantity: number;
  unitPrice: number;
  amount: number;
  tax: number;
  itemStatus: Doc<"orderItems">["status"];
  /** Offert sur cette addition. */
  comped: boolean;
};

export type BillingCheck = {
  /** `null` : le reste de la table, pas encore matérialisé (aucun paiement ni ajustement). */
  check: Doc<"checks"> | null;
  kind: Doc<"checks">["kind"];
  lines: BillingLine[];
  adjustments: Doc<"orderAdjustments">[];
  payments: Doc<"payments">[];
  balance: Balance;
};

export type SessionBilling = {
  checks: BillingCheck[];
  /** Les lignes vivantes de la session, et ce qui en a été détaché. */
  items: Doc<"orderItems">[];
  taken: Map<Id<"orderItems">, Share[]>;
  due: number;
  total: number;
  paid: number;
};

async function liveItemsOf(ctx: ReadCtx, sessionId: Id<"tableSessions">) {
  const items = await ctx.db
    .query("orderItems")
    .withIndex("by_session_status", (q) => q.eq("tableSessionId", sessionId))
    .collect();
  return items.filter((i) => i.status !== "cancelled");
}

/**
 * Toute l'addition d'une table, calculée. `excludeItems` simule une annulation : c'est ce qui
 * permet de refuser d'annuler un plat déjà payé AVANT d'écrire quoi que ce soit.
 */
export async function loadSessionBilling(
  ctx: ReadCtx,
  session: Doc<"tableSessions">,
  options: { excludeItems?: ReadonlySet<Id<"orderItems">> } = {},
): Promise<SessionBilling> {
  const items = (await liveItemsOf(ctx, session._id)).filter((i) => !options.excludeItems?.has(i._id));
  const byId = new Map(items.map((i) => [i._id, i]));
  const checks = (await ctx.db
    .query("checks")
    .withIndex("by_session", (q) => q.eq("tableSessionId", session._id))
    .collect()).filter((c) => c.status !== "voided");
  const adjustments = await ctx.db
    .query("orderAdjustments")
    .withIndex("by_session", (q) => q.eq("tableSessionId", session._id))
    .collect();
  // Un offert sur une ligne annulée ne compte plus : sinon il creuserait un dû négatif.
  const liveAdjustments = adjustments.filter((a) => a.orderItemId === undefined || byId.has(a.orderItemId));

  const taken = new Map<Id<"orderItems">, Share[]>();
  const result: BillingCheck[] = [];
  let remainder: Doc<"checks"> | null = null;

  const toLine = (item: Doc<"orderItems">, share: Share, checkId: Id<"checks"> | null): BillingLine => ({
    orderItemId: item._id,
    name: item.nameSnapshot,
    variantName: item.variantNameSnapshot ?? null,
    modifiers: item.modifiers.map((m) => m.optionName),
    quantity: share.quantity,
    unitPrice: item.unitPrice,
    amount: share.amount,
    tax: lineTaxShare(item, share.amount),
    itemStatus: item.status,
    comped: checkId !== null && liveAdjustments.some((a) => a.type === "comp" && a.checkId === checkId && a.orderItemId === item._id),
  });

  const paymentsOf = (checkId: Id<"checks">) =>
    ctx.db
      .query("payments")
      .withIndex("by_check", (q) => q.eq("checkId", checkId))
      .collect();

  for (const check of checks) {
    if (check.kind === "remainder") {
      remainder = check;
      continue;
    }
    const allocations = await ctx.db
      .query("checkItems")
      .withIndex("by_check", (q) => q.eq("checkId", check._id))
      .collect();
    const lines: BillingLine[] = [];
    for (const a of allocations) {
      const item = byId.get(a.orderItemId);
      if (!item) continue;
      const share = { quantity: a.quantityShare, amount: a.amount };
      taken.set(item._id, [...(taken.get(item._id) ?? []), share]);
      lines.push(toLine(item, share, check._id));
    }
    const adj = liveAdjustments.filter((x) => x.checkId === check._id);
    const payments = await paymentsOf(check._id);
    result.push({ check, kind: "allocated", lines, adjustments: adj, payments, balance: checkBalance({ lines, adjustments: adj, payments }) });
  }

  // Le reste : tout ce qui n'a pas été détaché ailleurs.
  const restLines: BillingLine[] = [];
  for (const item of items) {
    const shares = taken.get(item._id) ?? [];
    const quantity = item.quantity - shares.reduce((s, x) => s + x.quantity, 0);
    const amount = lineGross(item) - shares.reduce((s, x) => s + x.amount, 0);
    if (quantity > EPSILON || amount !== 0) restLines.push(toLine(item, { quantity, amount }, remainder?._id ?? null));
  }
  const restAdjustments = remainder ? liveAdjustments.filter((x) => x.checkId === remainder!._id) : [];
  const restPayments = remainder ? await paymentsOf(remainder._id) : [];
  if (remainder || restLines.length > 0) {
    result.unshift({
      check: remainder,
      kind: "remainder",
      lines: restLines,
      adjustments: restAdjustments,
      payments: restPayments,
      balance: checkBalance({ lines: restLines, adjustments: restAdjustments, payments: restPayments }),
    });
  }

  return {
    checks: result,
    items,
    taken,
    due: result.reduce((s, c) => s + c.balance.due, 0),
    total: result.reduce((s, c) => s + c.balance.total, 0),
    paid: result.reduce((s, c) => s + c.balance.paid, 0),
  };
}

/** La première addition dont le dû deviendrait négatif, ou `null`. */
export function negativeCheck(billing: SessionBilling): BillingCheck | null {
  return billing.checks.find((c) => c.balance.due < 0) ?? null;
}

/* ────────────────────────────────────────────────────────────────────────────
 * Caisse
 * ──────────────────────────────────────────────────────────────────────────── */

export const OPEN_CASH: readonly Doc<"cashRegisterSessions">["status"][] = ["open", "counting", "balanced", "discrepancy"];

export async function computeExpectedCash(ctx: ReadCtx, session: Doc<"cashRegisterSessions">): Promise<number> {
  const payments = await ctx.db
    .query("payments")
    .withIndex("by_register_session", (q) => q.eq("cashRegisterSessionId", session._id))
    .collect();
  const refunds = await ctx.db
    .query("refunds")
    .withIndex("by_register_session", (q) => q.eq("cashRegisterSessionId", session._id))
    .collect();
  const movements = await ctx.db
    .query("cashMovements")
    .withIndex("by_session", (q) => q.eq("registerSessionId", session._id))
    .collect();
  return expectedCash({
    openingFloat: session.openingFloat,
    payments,
    cashRefunds: refunds.filter((r) => r.method === "cash" && r.status === "succeeded"),
    movements,
  });
}

/* ────────────────────────────────────────────────────────────────────────────
 * Jour de service
 * ──────────────────────────────────────────────────────────────────────────── */

export const DEFAULT_SERVICE_DAY_START_HOUR = 4;

/** Décalage du fuseau à un instant donné, en millisecondes (UTC+1 → 3 600 000). */
function zoneOffsetMs(at: number, timeZone: string): number {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-US", {
      timeZone,
      hourCycle: "h23",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    })
      .formatToParts(new Date(at))
      .map((p) => [p.type, p.value]),
  );
  const asUtc = Date.UTC(Number(parts.year), Number(parts.month) - 1, Number(parts.day), Number(parts.hour), Number(parts.minute), Number(parts.second));
  return asUtc - Math.floor(at / 1000) * 1000;
}

/**
 * La fenêtre d'un jour de service « 2026-09-23 », en instants UTC : de l'heure de début (locale)
 * ce jour-là à la même heure le lendemain. Le report d'un jour lit cette fenêtre, rien d'autre.
 */
export function serviceDayWindow(day: string, timeZone: string, startHour: number): { from: number; to: number } {
  const [y, m, d] = day.split("-").map(Number) as [number, number, number];
  const localStart = Date.UTC(y, m - 1, d, startHour);
  const localEnd = Date.UTC(y, m - 1, d + 1, startHour);
  // Deux passes : le décalage lu à l'instant approché, puis à l'instant corrigé (changement d'heure).
  const from1 = localStart - zoneOffsetMs(localStart, timeZone);
  const from = localStart - zoneOffsetMs(from1, timeZone);
  const to1 = localEnd - zoneOffsetMs(localEnd, timeZone);
  const to = localEnd - zoneOffsetMs(to1, timeZone);
  return { from, to };
}
