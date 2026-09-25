/**
 * Suivi des commandes, côté client — Joliba (D-099, D-103)
 *
 * Deux onglets :
 *  - « Mes commandes » : ce que ce téléphone a envoyé, ou que le serveur a repris de son panier,
 *    ligne par ligne, avec l'état de chaque plat ;
 *  - « La table » : ce qui est déjà parti pour toute la tablée, marqué « Convive N », sans aucun
 *    montant. C'est ce qui évite de recommander deux fois la bouteille partagée.
 *
 * Aucune heure d'arrivée estimée : rien de mesuré ne permet de la calculer honnêtement. On dit
 * seulement depuis quand la commande est partie, et quand l'écran a été relu.
 */

import { Badge } from "~/components/ui/badge";
import { Item, ItemContent, ItemDescription, ItemGroup, ItemTitle } from "~/components/ui/item";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "~/components/ui/tabs";
import type { OrderText } from "~/lib/guest/order-text";
import type { Presence } from "~/lib/guest/table-api";

type GuestOrder = Presence["orders"][number];
type LineStatus = GuestOrder["items"][number]["status"];
type BadgeVariant = "default" | "secondary" | "outline" | "destructive";

export function lineStatus(status: LineStatus, o: OrderText): { label: string; variant: BadgeVariant } {
  switch (status) {
    case "ordered":
      return { label: o.lineOrdered, variant: "outline" };
    case "preparing":
      return { label: o.linePreparing, variant: "secondary" };
    case "ready":
      return { label: o.lineReady, variant: "default" };
    case "served":
      return { label: o.lineServed, variant: "secondary" };
    case "cancelled":
      return { label: o.lineCancelled, variant: "destructive" };
  }
}

/** L'état de la commande entière, seulement tant qu'elle n'est pas partie en cuisine. */
function orderLevelStatus(order: GuestOrder, o: OrderText): { label: string; detail: string | null; variant: BadgeVariant } | null {
  switch (order.status) {
    case "pending_acceptance":
      return { label: o.statusPending, detail: o.statusPendingText, variant: "outline" };
    case "rejected":
      return order.expired
        ? { label: o.statusExpired, detail: o.statusExpiredText, variant: "destructive" }
        : { label: o.statusRejected, detail: order.rejectedReason ? `${o.reason} : ${order.rejectedReason}` : null, variant: "destructive" };
    case "cancelled":
      return { label: o.statusCancelled, detail: null, variant: "destructive" };
    default:
      return null;
  }
}

function elapsed(now: number, at: number, o: OrderText): string {
  return o.duration(Math.max(1, Math.round((now - at) / 1000)));
}

function MyOrder({ order, now, o }: { order: GuestOrder; now: number; o: OrderText }) {
  const whole = orderLevelStatus(order, o);
  return (
    <Item role="listitem" variant="outline" className="flex-col items-stretch" data-reference={order.reference}>
      <ItemContent className="min-w-0">
        <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
          <ItemTitle className="text-base">{o.order(order.reference)}</ItemTitle>
          <span className="text-sm text-muted-foreground">{o.sentAgo(elapsed(now, order.submittedAt, o))}</span>
        </div>
        {order.takenByWaiter ? <ItemDescription>{o.takenByWaiter}</ItemDescription> : null}
        {whole ? (
          <>
            <div>
              <Badge variant={whole.variant}>{whole.label}</Badge>
            </div>
            {order.items.length > 0 ? <ItemDescription>{order.items.map((i) => `${i.quantity} × ${i.name}`).join(" · ")}</ItemDescription> : null}
            {whole.detail ? <p className="text-sm text-muted-foreground">{whole.detail}</p> : null}
          </>
        ) : (
          <ul className="flex flex-col gap-2 pt-1">
            {order.items.map((item, i) => {
              const s = lineStatus(item.status, o);
              return (
                <li key={i} className="flex flex-wrap items-center justify-between gap-2">
                  <span className="min-w-0">
                    <span className="tabular-nums">{item.quantity}</span> × {item.name}
                  </span>
                  <Badge variant={s.variant} className="max-w-full whitespace-normal text-left">
                    {s.label}
                  </Badge>
                </li>
              );
            })}
          </ul>
        )}
      </ItemContent>
    </Item>
  );
}

export function GuestOrders({ presence, now, updatedAt, o }: { presence: Presence | null; now: number; updatedAt: number | null; o: OrderText }) {
  const orders = presence?.orders ?? [];
  const table = presence?.table ?? [];
  const updated = updatedAt !== null ? <p className="text-sm text-muted-foreground">{o.updatedAgo(Math.max(0, Math.round((now - updatedAt) / 1000)))}</p> : null;

  return (
    <Tabs defaultValue="mine" className="gap-3">
      <TabsList className="w-full">
        <TabsTrigger value="mine">{o.tabMine}</TabsTrigger>
        <TabsTrigger value="table">{o.tabTable}</TabsTrigger>
      </TabsList>
      <TabsContent value="mine" className="flex flex-col gap-3">
        {updated}
        {orders.length === 0 ? (
          <p className="py-4 text-muted-foreground">{o.ordersEmpty}</p>
        ) : (
          <ItemGroup className="gap-2">
            {[...orders].reverse().map((order) => (
              <MyOrder key={order.reference} order={order} now={now} o={o} />
            ))}
          </ItemGroup>
        )}
      </TabsContent>
      <TabsContent value="table" className="flex flex-col gap-3">
        <div>
          <h3 className="font-medium">{o.tableTitle}</h3>
          <p className="text-sm text-muted-foreground">{o.tableNote}</p>
        </div>
        {updated}
        {table.length === 0 ? (
          <p className="py-4 text-muted-foreground">{o.tableEmpty}</p>
        ) : (
          <ul className="flex flex-col divide-y rounded-lg border" aria-label={o.tableTitle}>
            {[...table].reverse().map((line, i) => {
              const s = lineStatus(line.status, o);
              const who = line.mine ? o.you : line.guestNumber !== null ? o.guestN(line.guestNumber) : o.byWaiter;
              return (
                <li key={`${line.reference}-${i}`} className="flex flex-col gap-1 px-3 py-2.5">
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <span className="min-w-0">
                      <span className="tabular-nums">{line.quantity}</span> × {line.name}
                    </span>
                    <Badge variant={line.mine ? "default" : "outline"}>{who}</Badge>
                  </div>
                  <span className="text-sm text-muted-foreground">{s.label}</span>
                </li>
              );
            })}
          </ul>
        )}
      </TabsContent>
    </Tabs>
  );
}
