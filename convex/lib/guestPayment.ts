/**
 * Ce que le convive voit de SON paiement en ligne — Joliba (D-112, D-113, C11)
 *
 * Jusqu'à T4, le téléphone ne voyait aucun montant (D-099). Payer depuis sa table en montre
 * deux : le reste de la table et ses propres articles. Seulement à un convive ADMIS par le code :
 * une photo du QR ne révèle pas l'addition.
 */

import type { Doc } from "../_generated/dataModel";
import { activeAccountOf } from "../paymentAccounts";
import { loadSessionBilling } from "./billing";
import type { ReadCtx } from "./guards";
import { isOpenIntent, openIntentsOfCheck } from "./intents";
import { isOpenSession } from "./service";

export type GuestPaymentView = {
  currency: string;
  /** Le reste de la table, s'il est dû. */
  remainderDue: number | null;
  /** Les articles de ce seul convive encore sur le reste, ou son addition « Convive N » en cours. */
  myItemsDue: number | null;
  /** Un autre payeur est en train de régler le reste de la table. */
  remainderBusy: boolean;
  /** La dernière intention de ce convive sur cette tablée. */
  current: {
    status: Doc<"paymentIntents">["status"];
    target: Doc<"paymentIntents">["target"];
    amount: number;
    launchUrl: string | null;
    lastErrorCode: string | null;
    at: number;
  } | null;
};

export async function guestPaymentView(
  ctx: ReadCtx,
  venue: Doc<"venues">,
  session: Doc<"tableSessions"> | null,
  guest: Doc<"guestSessions"> | null,
): Promise<GuestPaymentView | null> {
  if (!session || !guest || guest.removedAt !== undefined || guest.admittedAt === undefined || session.isSimulation) return null;
  if (!(await activeAccountOf(ctx, venue._id))) return null;
  const mine = (
    await ctx.db
      .query("paymentIntents")
      .withIndex("by_guest_status", (q) => q.eq("guestSessionId", guest._id))
      .collect()
  ).filter((i) => i.tableSessionId === session._id);
  const latest = [...mine].sort((a, b) => b.createdAt - a.createdAt)[0] ?? null;
  const current = latest
    ? { status: latest.status, target: latest.target, amount: latest.amount, launchUrl: isOpenIntent(latest) ? (latest.launchUrl ?? null) : null, lastErrorCode: latest.lastErrorCode ?? null, at: latest.updatedAt }
    : null;
  if (!isOpenSession(session)) return { currency: session.currency, remainderDue: null, myItemsDue: null, remainderBusy: false, current };

  const billing = await loadSessionBilling(ctx, session);
  const rest = billing.checks.find((c) => c.kind === "remainder");
  const remainderDue = rest && rest.balance.due > 0 ? rest.balance.due : null;
  const restIntents = rest?.check ? await openIntentsOfCheck(ctx, rest.check._id) : [];
  const remainderBusy = restIntents.some((i) => i.guestSessionId !== guest._id);
  const comped = new Set((rest?.adjustments ?? []).filter((a) => a.type === "comp").map((a) => a.orderItemId));
  let myItems = 0;
  for (const line of rest?.lines ?? []) {
    if (comped.has(line.orderItemId) || line.amount <= 0) continue;
    const item = billing.items.find((i) => i._id === line.orderItemId);
    if (item && item.assignedGuestSessionIds.length === 1 && item.assignedGuestSessionIds[0] === guest._id) myItems += line.amount;
  }
  // Une addition « Convive N » déjà détachée pour lui et encore due.
  const open = mine.find((i) => isOpenIntent(i) && i.target === "my_items");
  if (open) myItems += billing.checks.find((c) => c.check?._id === open.checkId)?.balance.due ?? 0;
  return { currency: session.currency, remainderDue, myItemsDue: myItems > 0 ? myItems : null, remainderBusy, current };
}
