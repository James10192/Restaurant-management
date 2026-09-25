/**
 * Ce que le convive voit de SON paiement en ligne — Joliba (D-112, D-113, C11)
 *
 * Jusqu'à T4, le téléphone ne voyait aucun montant (D-099). Payer depuis sa table en montre
 * deux : le reste de la table et ses propres articles. Seulement à un convive ADMIS par le code :
 * une photo du QR ne révèle pas l'addition.
 */

import type { Doc, Id } from "../_generated/dataModel";
import { activeAccountOf } from "../paymentAccounts";
import { lineGross, loadSessionBilling, takeShare, type Share } from "./billing";
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
  // Le même calcul que le serveur quand il détache « mes articles » : ce que l'écran propose, le
  // serveur l'accepte. Rien si le reste est déjà réglé en partie au-delà (D-076), ou si un autre
  // payeur règle le reste de la table.
  const { shares } = myRemainderShares(billing, guest._id);
  const moved = shares.reduce((sum, x) => sum + x.share.amount, 0);
  let myItems = remainderBusy || restIntents.length > 0 || !rest || rest.balance.due - moved < 0 ? 0 : moved;
  // Une addition « Convive N » déjà détachée pour lui et encore due.
  const open = mine.find((i) => isOpenIntent(i) && i.target === "my_items");
  if (open) myItems += billing.checks.find((c) => c.check?._id === open.checkId)?.balance.due ?? 0;
  return { currency: session.currency, remainderDue, myItemsDue: myItems > 0 ? myItems : null, remainderBusy, current };
}

/** Les lignes du reste de la table qui n'appartiennent qu'à ce convive, et encore dues. */
export function myRemainderShares(billing: Awaited<ReturnType<typeof loadSessionBilling>>, guestId: Id<"guestSessions">) {
  const rest = billing.checks.find((c) => c.kind === "remainder");
  if (!rest) return { rest: null, shares: [] as { item: Doc<"orderItems">; share: Share }[] };
  const comped = new Set(rest.adjustments.filter((a) => a.type === "comp").map((a) => a.orderItemId));
  const shares: { item: Doc<"orderItems">; share: Share }[] = [];
  for (const line of rest.lines) {
    if (comped.has(line.orderItemId) || line.amount <= 0 || line.quantity <= 0) continue;
    const item = billing.items.find((i) => i._id === line.orderItemId);
    if (!item || item.assignedGuestSessionIds.length !== 1 || item.assignedGuestSessionIds[0] !== guestId) continue;
    const share = takeShare({ quantity: item.quantity, gross: lineGross(item) }, billing.taken.get(item._id) ?? [], line.quantity);
    if ("error" in share) continue;
    shares.push({ item, share });
  }
  return { rest, shares };
}
