import { useEffect, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import { ArrowLeft, Check, ChefHat, CircleSlash, Hand, Plus, Send, ShoppingBasket, UserRound, X } from "lucide-react";
import { toast } from "sonner";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { EmptyState, LoadingState } from "~/components/app/states";
import { FormField } from "~/components/app/form-field";
import {
  ResponsiveDialog,
  ResponsiveDialogContent,
  ResponsiveDialogDescription,
  ResponsiveDialogFooter,
  ResponsiveDialogHeader,
  ResponsiveDialogTitle,
} from "~/components/app/responsive-dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "~/components/ui/alert-dialog";
import { Alert, AlertDescription, AlertTitle } from "~/components/ui/alert";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "~/components/ui/card";
import { Item, ItemActions, ItemContent, ItemDescription, ItemGroup, ItemTitle } from "~/components/ui/item";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "~/components/ui/tabs";
import { Textarea } from "~/components/ui/textarea";
import { BillPanel } from "~/components/billing/bill-panel";
import { ReasonDialog } from "~/components/billing/reason-dialog";
import { describeError } from "~/lib/errors";
import { uuidv7 } from "~/lib/outbox";
import { cn } from "~/lib/utils";
import { ActionButton } from "./action-button";
import type { LineRequest } from "../../../convex/lib/ordering";
import { EMPTY_DRAFT, OrderComposer, type Draft } from "./order-composer";
import { useOutbox } from "./outbox-provider";
import { useMoney, useServiceScope } from "./service-scope";
import { ServiceStatus } from "./service-status";
import { TableCodePending, TableGuests } from "./table-guests";

type Detail = FunctionReturnType<typeof api.sessions.detail>;
type Order = Detail["orders"][number];

const ORDER_STATUS: Record<string, { label: string; variant: "default" | "secondary" | "outline" | "destructive" }> = {
  pending_acceptance: { label: "À valider", variant: "destructive" },
  submitted: { label: "Envoyée", variant: "secondary" },
  accepted: { label: "En cuisine", variant: "secondary" },
  in_preparation: { label: "En préparation", variant: "secondary" },
  partially_ready: { label: "En partie prêt", variant: "default" },
  ready: { label: "Prêt", variant: "default" },
  partially_served: { label: "En partie servi", variant: "outline" },
  served: { label: "Servi", variant: "outline" },
  rejected: { label: "Refusé", variant: "destructive" },
  cancelled: { label: "Annulé", variant: "outline" },
  partially_cancelled: { label: "En partie annulé", variant: "outline" },
  closed: { label: "Clôturé", variant: "outline" },
};
const ITEM_STATUS: Record<string, string> = {
  ordered: "Commandé",
  preparing: "En préparation",
  ready: "Prêt",
  served: "Servi",
  cancelled: "Annulé",
};
/** En préparation ou prêt : l'annuler coûte des denrées (droit distinct, motif obligatoire). */
const inProduction = (status: string) => status === "preparing" || status === "ready";
const time = new Intl.DateTimeFormat("fr-FR", { hour: "2-digit", minute: "2-digit" });

/** Le brouillon est à une personne : sur une tablette partagée, Koffi n'envoie pas celui d'Awa. */
const draftKey = (tableId: string, owner: string) => `joliba.saisie.${owner}.${tableId}`;
function loadDraft(key: string): Draft {
  try {
    const raw = sessionStorage.getItem(key);
    return raw ? (JSON.parse(raw) as Draft) : EMPTY_DRAFT;
  } catch {
    return EMPTY_DRAFT;
  }
}

/**
 * Une table : ce qui a été commandé, ce qui est prêt, ce qui attend l'appel, et le bouton
 * « Commander ». Adressée par la TABLE, pas par la session : ouverte hors ligne, la session
 * n'a pas encore d'identifiant, et le serveur peut déjà y saisir (D-062).
 */
export function TableView({ tableId }: { tableId: Id<"restaurantTables"> }) {
  const scope = useServiceScope();
  const money = useMoney();
  const floor = useQuery(api.sessions.floor, { venueId: scope.venueId });
  const { entries, enqueue } = useOutbox();
  const table = floor?.areas.flatMap((a) => a.tables).find((t) => t._id === tableId);
  const sessionId = table?.session?._id ?? null;
  const detail = useQuery(api.sessions.detail, sessionId ? { venueId: scope.venueId, sessionId } : "skip");
  const openEntry = entries.find((e) => e.mutation === "sessions:open" && e.args.tableId === tableId && e.status !== "rejected" && e.status !== "confirmed");
  const localOrders = entries.filter((e) => e.mutation === "orders:submit" && e.status !== "confirmed" && (e.args.sessionId === sessionId || (e.args.sessionRef as { tableId?: string } | undefined)?.tableId === tableId));

  const [composing, setComposing] = useState(false);
  const [draft, setDraft] = useState<Draft>(EMPTY_DRAFT);
  const key = draftKey(tableId, scope.memberId ?? scope.via);
  useEffect(() => setDraft(loadDraft(key)), [key]);
  useEffect(() => {
    try {
      sessionStorage.setItem(key, JSON.stringify(draft));
    } catch {
      /* brouillon non gardé ; la saisie en cours reste à l'écran */
    }
  }, [draft, key]);

  if (floor === undefined) return <LoadingState />;
  if (!table) return <EmptyState title="Table introuvable" description="Elle a peut-être été retirée du plan." action={<Button onClick={scope.nav.board}>Retour</Button>} />;

  const canOrder = scope.can("order.create") && (sessionId !== null || openEntry !== undefined);

  async function send(d: Draft) {
    if (!table) return;
    const opId = uuidv7();
    const target = sessionId
      ? { sessionId }
      : openEntry
        ? { sessionRef: { clientRef: String(openEntry.args.clientRef), tableId } }
        : null;
    if (!target) {
      toast.error("Ouvrez la table avant de commander.");
      return;
    }
    const count = d.lines.reduce((s, l) => s + l.request.quantity, 0);
    await enqueue({
      opId,
      mutation: "orders:submit",
      args: {
        venueId: scope.venueId,
        ...target,
        lines: d.lines.map((l) => (l.guestSessionId ? { ...l.request, guestSessionId: l.guestSessionId } : l.request)),
        ...(d.fromCartIds && d.fromCartIds.length > 0 ? { fromCartIds: d.fromCartIds } : {}),
        heldCourses: d.held,
        ...(d.notes.trim() ? { notes: d.notes.trim() } : {}),
        idempotencyKey: opId,
      },
      dependsOn: !sessionId && openEntry ? [openEntry.opId] : [],
      goesToKitchen: true,
      label: `Table ${table.number} — ${count} article${count > 1 ? "s" : ""}`,
    });
    setDraft(EMPTY_DRAFT);
    setComposing(false);
    toast.success(`Table ${table.number} : ${count} article${count > 1 ? "s" : ""} mis en envoi.`);
  }

  return (
    <div className="flex flex-col gap-4 pb-24">
      <div className="flex flex-wrap items-center gap-2">
        <Button variant="ghost" size="icon" aria-label="Retour aux tables" onClick={scope.nav.board}>
          <ArrowLeft />
        </Button>
        <div className="min-w-0 flex-1">
          <h1 className="text-2xl font-semibold tracking-tight">Table {table.number}</h1>
          <p className="truncate text-sm text-muted-foreground">
            {detail
              ? [
                  detail.waiterName ?? "Sans serveur",
                  detail.guestCount ? `${detail.guestCount} couverts` : null,
                  `ouverte à ${time.format(detail.openedAt)}`,
                  detail.runningTotal > 0 ? `en cours ${money(detail.runningTotal)}` : null,
                ]
                  .filter(Boolean)
                  .join(" · ")
              : openEntry
                ? "Ouverture en attente du réseau"
                : "Libre"}
          </p>
        </div>
        {detail ? <TableActions detail={detail} /> : null}
      </div>
      <ServiceStatus />

      {detail ? <TableGuests detail={detail} /> : !sessionId && openEntry && floor.orderingMode === "guest_direct" ? <TableCodePending /> : null}

      {!sessionId && !openEntry ? (
        <EmptyState
          title="Table libre"
          description="Ouvrez-la depuis la liste des tables pour y commander."
          action={<Button onClick={scope.nav.board}>Retour aux tables</Button>}
        />
      ) : null}

      <Tabs defaultValue="orders" className="gap-4">
        {sessionId && scope.can("payment.read") ? (
          <TabsList className="w-full sm:w-auto">
            <TabsTrigger value="orders">Commandes</TabsTrigger>
            <TabsTrigger value="bill">Addition</TabsTrigger>
          </TabsList>
        ) : null}
        <TabsContent value="orders" className="flex flex-col gap-4">
      {sessionId ? (
        <GuestCarts
          sessionId={sessionId}
          onTake={(taken) => {
            // Le panier du client rejoint la saisie du serveur : il relit, retire, retient un service.
            // Chaque ligne garde son convive, et la commande pointera vers le panier (D-101).
            setDraft((d) => ({
              ...d,
              lines: [
                ...d.lines,
                ...taken.lines.map((request) => ({ key: crypto.randomUUID(), request, ...(taken.guestSessionId ? { guestSessionId: taken.guestSessionId } : {}) })),
              ],
              fromCartIds: [...(d.fromCartIds ?? []), taken.cartId],
            }));
            setComposing(true);
          }}
        />
      ) : null}

      {localOrders.map((e) => (
        <Alert key={e.opId} variant={e.status === "rejected" ? "destructive" : "default"}>
          <Send />
          <AlertTitle>{e.label}</AlertTitle>
          <AlertDescription>
            {e.status === "rejected" ? `Refusée : ${e.error?.message ?? ""}` : e.status === "needs_review" ? "À régulariser : dites si elle a été préparée." : "En attente d'envoi — pas encore en cuisine."}
          </AlertDescription>
        </Alert>
      ))}

      {detail ? <HeldCourses detail={detail} /> : null}
      {detail === undefined && sessionId ? <LoadingState /> : null}
      {detail?.orders.length === 0 && localOrders.length === 0 ? <EmptyState title="Rien de commandé" description="Touchez « Commander » pour saisir." /> : null}
      {detail ? [...detail.orders].reverse().map((o) => <OrderCard key={o._id} order={o} detail={detail} />) : null}
        </TabsContent>
        {sessionId && scope.can("payment.read") ? (
          <TabsContent value="bill">
            <BillPanel sessionId={sessionId} />
          </TabsContent>
        ) : null}
      </Tabs>

      {canOrder ? (
        <div className="fixed inset-x-0 bottom-0 z-10 border-t bg-background p-3 md:static md:border-0 md:p-0">
          <Button size="lg" className="w-full md:w-auto" onClick={() => setComposing(true)}>
            <Plus />
            Commander{draft.lines.length > 0 ? ` (${draft.lines.reduce((s, l) => s + l.request.quantity, 0)} en cours)` : ""}
          </Button>
        </div>
      ) : null}
      <OrderComposer open={composing} onOpenChange={setComposing} tableNumber={table.number} draft={draft} onDraftChange={setDraft} onSend={send} />
    </div>
  );
}

/* ─────────────────────────── Actions de table ─────────────────────────── */

function TableActions({ detail }: { detail: Detail }) {
  const scope = useServiceScope();
  const { online } = useOutbox();
  const assign = useMutation(api.sessions.assignWaiter);
  const close = useMutation(api.sessions.close);
  const closeWithDebt = useMutation(api.sessions.closeWithDebt);
  const bill = useQuery(api.checks.forSession, scope.can("payment.read") ? { venueId: scope.venueId, sessionId: detail._id } : "skip");
  const money = useMoney();
  const [closing, setClosing] = useState(false);
  const [debt, setDebt] = useState(false);
  const due = bill?.due ?? 0;
  return (
    <div className="flex flex-wrap gap-2">
      {!detail.isMine && scope.memberId && scope.can("table.session.open") ? (
        <ActionButton
          variant="outline"
          onAction={async () => {
            try {
              await assign({ ...scope.acting, sessionId: detail._id });
              toast.success("La table est à votre nom.");
            } catch (error) {
              toast.error(describeError(error).message);
            }
          }}
        >
          <UserRound />
          Prendre la table
        </ActionButton>
      ) : null}
      {detail.can.close ? (
        <Button variant="outline" disabled={!online} title={online ? undefined : "Pas de clôture sans réseau."} onClick={() => setClosing(true)}>
          Clôturer
        </Button>
      ) : null}
      <AlertDialog open={closing} onOpenChange={setClosing}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Clôturer la table {detail.tableNumber} ?</AlertDialogTitle>
            <AlertDialogDescription>
              {due > 0
                ? `Il reste ${money(due)} à encaisser : la table ne se clôt pas tant que l'addition n'est pas réglée.`
                : "La table redevient libre. C'est refusé tant qu'une commande est en cours : servez ou annulez d'abord. La clôture ne se fait pas hors ligne."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            {due > 0 && bill?.can.closeWithDebt ? (
              <Button
                variant="destructive"
                onClick={() => {
                  setClosing(false);
                  setDebt(true);
                }}
              >
                Clôturer avec un impayé
              </Button>
            ) : null}
            <AlertDialogAction
              disabled={!online || due > 0}
              onClick={async (e) => {
                e.preventDefault();
                try {
                  await close({ ...scope.acting, sessionId: detail._id });
                  setClosing(false);
                  toast.success(`Table ${detail.tableNumber} clôturée.`);
                  scope.nav.board();
                } catch (error) {
                  toast.error(describeError(error).message);
                }
              }}
            >
              Clôturer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <ReasonDialog
        open={debt}
        onOpenChange={setDebt}
        title={`Table ${detail.tableNumber} : clôturer avec un impayé`}
        description={`${money(due)} ne seront pas encaissés. Le montant, votre nom et le motif figurent au rapport de fin de service.`}
        confirmLabel="Clôturer avec l'impayé"
        destructive
        onConfirm={async ({ reason }) => {
          await closeWithDebt({ ...scope.acting, sessionId: detail._id, reason });
          setDebt(false);
          toast.success(`Table ${detail.tableNumber} clôturée avec un impayé.`);
          scope.nav.board();
        }}
      />
    </div>
  );
}

/** Les services qui attendent « envoyez la suite ». */
function HeldCourses({ detail }: { detail: Detail }) {
  const scope = useServiceScope();
  const { entries, enqueue } = useOutbox();
  if (!detail.can.fire || detail.heldCourses.length === 0) return null;
  const firing = new Set(
    entries.filter((e) => e.mutation === "orders:fireCourse" && e.args.sessionId === detail._id && e.status !== "rejected" && e.status !== "confirmed").map((e) => Number(e.args.courseNumber)),
  );
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">En attente de l'appel</CardTitle>
        <CardDescription>Envoyez la suite quand la table est prête.</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-wrap gap-2">
        {detail.heldCourses.map((c) => (
          <Button
            key={c}
            disabled={firing.has(c)}
            onClick={() =>
              void enqueue({
                mutation: "orders:fireCourse",
                args: { venueId: scope.venueId, sessionId: detail._id, courseNumber: c },
                goesToKitchen: true,
                label: `Table ${detail.tableNumber} — envoyer le service ${c}`,
              })
            }
          >
            <ChefHat />
            {firing.has(c) ? `Service ${c} : envoi…` : `Envoyer le service ${c}`}
          </Button>
        ))}
      </CardContent>
    </Card>
  );
}

/* ─────────────────────────── Commandes ─────────────────────────── */

function OrderCard({ order, detail }: { order: Order; detail: Detail }) {
  const scope = useServiceScope();
  const money = useMoney();
  const { entries, enqueue } = useOutbox();
  const [cancelling, setCancelling] = useState<Order["items"][number] | null>(null);
  const status = ORDER_STATUS[order.status] ?? { label: order.status, variant: "outline" as const };
  const serving = new Set(entries.filter((e) => e.mutation === "orders:serveTicket" && e.status !== "rejected").map((e) => String(e.args.ticketId)));
  const ready = order.tickets.filter((t) => t.status === "ready" && !serving.has(t._id));

  return (
    <Card className={cn(order.status === "cancelled" || order.status === "rejected" ? "opacity-60" : "")}>
      <CardHeader>
        <CardTitle className="text-base">
          {order.reference} · {time.format(order.submittedAt)}
        </CardTitle>
        <CardDescription>
          {[order.channel === "guest" ? "Commande du client" : order.placedBy, money(order.total)].filter(Boolean).join(" · ")}
          {order.rejectedReason ? ` — ${order.rejectedReason}` : ""}
        </CardDescription>
        <CardAction>
          <Badge variant={status.variant}>{status.label}</Badge>
        </CardAction>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {order.notes ? <p className="text-sm text-muted-foreground">« {order.notes} »</p> : null}
        <ItemGroup className="gap-1">
          {order.items.map((i) => {
            const waiting = i.status === "ordered" && order.tickets.some((t) => t.status === "held" && t.courseNumber === i.courseNumber);
            const canCancel = i.status !== "cancelled" && i.status !== "served" && (inProduction(i.status) ? detail.can.modifyAfterFire : detail.can.modify);
            return (
              <Item key={i._id} size="sm" variant="muted" className={cn(i.status === "cancelled" && "line-through opacity-60")}>
                <ItemContent>
                  <ItemTitle>
                    {i.quantity} × {i.name}
                    {i.variantName ? ` (${i.variantName})` : ""}
                  </ItemTitle>
                  <ItemDescription>
                    {[`S${i.courseNumber}`, i.guestNumber !== null ? `Convive ${i.guestNumber}` : null, waiting ? "Attend l'appel" : (ITEM_STATUS[i.status] ?? i.status), ...i.modifiers, i.instructions ? `« ${i.instructions} »` : null, i.cancelledReason]
                      .filter(Boolean)
                      .join(" · ")}
                  </ItemDescription>
                </ItemContent>
                {canCancel ? (
                  <ItemActions>
                    <Button size="icon-sm" variant="ghost" aria-label={`Annuler ${i.name}`} onClick={() => setCancelling(i)}>
                      <CircleSlash />
                    </Button>
                  </ItemActions>
                ) : null}
              </Item>
            );
          })}
        </ItemGroup>
        {detail.can.serve && ready.length > 0 ? (
          <div className="flex flex-wrap gap-2">
            {ready.map((t) => (
              <Button
                key={t._id}
                onClick={() =>
                  void enqueue({ mutation: "orders:serveTicket", args: { venueId: scope.venueId, ticketId: t._id }, label: `Table ${detail.tableNumber} — servi (${t.station})` })
                }
              >
                <Check />
                Servi : {t.station} S{t.courseNumber}
              </Button>
            ))}
          </div>
        ) : null}
        {order.status === "pending_acceptance" && detail.can.accept ? <AcceptActions order={order} /> : null}
      </CardContent>
      <CancelItemDialog item={cancelling} afterFire={cancelling ? inProduction(cancelling.status) : false} onClose={() => setCancelling(null)} />
    </Card>
  );
}

function AcceptActions({ order }: { order: Order }) {
  const scope = useServiceScope();
  const accept = useMutation(api.orders.accept);
  const reject = useMutation(api.orders.reject);
  const [reason, setReason] = useState("");
  const [rejecting, setRejecting] = useState(false);
  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap gap-2">
        <ActionButton
          onAction={async () => {
            try {
              await accept({ venueId: scope.venueId, orderId: order._id });
            } catch (error) {
              toast.error(describeError(error).message);
            }
          }}
        >
          <Hand />
          Accepter
        </ActionButton>
        <Button variant="outline" onClick={() => setRejecting((r) => !r)}>
          <X />
          Refuser
        </Button>
      </div>
      {rejecting ? (
        <div className="flex flex-col gap-2">
          <FormField label="Motif, vu par le client">
            <Textarea value={reason} maxLength={200} onChange={(e) => setReason(e.target.value)} />
          </FormField>
          <ActionButton
            variant="destructive"
            className="w-fit"
            onAction={async () => {
              try {
                await reject({ venueId: scope.venueId, orderId: order._id, reason });
              } catch (error) {
                toast.error(describeError(error).message);
              }
            }}
          >
            Confirmer le refus
          </ActionButton>
        </div>
      ) : null}
    </div>
  );
}

/** Annuler une ligne. Une fois en cuisine, cela coûte des denrées : motif obligatoire. */
function CancelItemDialog({ item, afterFire, onClose }: { item: Order["items"][number] | null; afterFire: boolean; onClose: () => void }) {
  const scope = useServiceScope();
  const cancel = useMutation(api.orders.cancelItem);
  const [reason, setReason] = useState("");
  return (
    <ResponsiveDialog open={item !== null} onOpenChange={(o) => !o && onClose()}>
      <ResponsiveDialogContent>
        <ResponsiveDialogHeader>
          <ResponsiveDialogTitle>Annuler {item?.name}</ResponsiveDialogTitle>
          <ResponsiveDialogDescription>
            {afterFire ? "Ce plat est déjà en cuisine : le motif est obligatoire et l'annulation est tracée." : "Le plat n'est pas encore parti : c'est une simple correction."}
          </ResponsiveDialogDescription>
        </ResponsiveDialogHeader>
        <div className="flex flex-col gap-4 px-4 md:px-0">
          <FormField label="Motif" optional={!afterFire}>
            <Textarea value={reason} maxLength={200} placeholder="Ex. : erreur de saisie, client parti" onChange={(e) => setReason(e.target.value)} />
          </FormField>
          <ResponsiveDialogFooter>
            <ActionButton
              variant="destructive"
              onAction={async () => {
                if (!item) return;
                try {
                  await cancel({ venueId: scope.venueId, itemId: item._id, ...(reason.trim() ? { reason: reason.trim() } : {}) });
                  setReason("");
                  onClose();
                } catch (error) {
                  toast.error(describeError(error).message);
                }
              }}
            >
              Annuler la ligne
            </ActionButton>
          </ResponsiveDialogFooter>
        </div>
      </ResponsiveDialogContent>
    </ResponsiveDialog>
  );
}

/* ─────────────────────────── Paniers des clients ─────────────────────────── */

/**
 * « Panier préparé : 3 articles » — le client montre, le serveur le reprend dans SA saisie
 * (D-061) : il relit, retire, fait attendre le dessert, puis envoie comme d'habitude.
 */
function GuestCarts({ sessionId, onTake }: { sessionId: Id<"tableSessions">; onTake: (taken: { cartId: string; guestSessionId: string | null; lines: LineRequest[] }) => void }) {
  const scope = useServiceScope();
  const money = useMoney();
  const carts = useQuery(api.carts.forSession, scope.can("order.create") ? { venueId: scope.venueId, sessionId } : "skip");
  const take = useMutation(api.carts.takeCart);
  const dismiss = useMutation(api.carts.dismissCart);
  if (!carts || carts.length === 0) return null;
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <ShoppingBasket className="size-4" />
          Panier{carts.length > 1 ? "s" : ""} préparé{carts.length > 1 ? "s" : ""} par les clients
        </CardTitle>
        <CardDescription>Rien n'est commandé tant que vous ne l'envoyez pas.</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {carts.map((cart) => (
          <Item key={cart._id} variant="outline">
            <ItemContent>
              <ItemTitle>
                {cart.items.reduce((s, i) => s + i.quantity, 0)} articles · environ {money(cart.estimatedTotal)}
              </ItemTitle>
              <ItemDescription className="line-clamp-none">
                {cart.items.map((i) => `${i.quantity} × ${i.name}${i.variantName ? ` (${i.variantName})` : ""}${i.instructions ? ` « ${i.instructions} »` : ""}`).join(" · ")}
              </ItemDescription>
            </ItemContent>
            <ItemActions className="flex-wrap">
              <ActionButton
                variant="ghost"
                onAction={async () => {
                  try {
                    await dismiss({ venueId: scope.venueId, cartId: cart._id });
                  } catch (error) {
                    toast.error(describeError(error).message);
                  }
                }}
              >
                Ignorer
              </ActionButton>
              <ActionButton
                onAction={async () => {
                  try {
                    onTake(await take({ venueId: scope.venueId, cartId: cart._id, seenUpdatedAt: cart.updatedAt }));
                  } catch (error) {
                    toast.error(describeError(error).message);
                  }
                }}
              >
                <ShoppingBasket />
                Reprendre dans ma saisie
              </ActionButton>
            </ItemActions>
          </Item>
        ))}
      </CardContent>
    </Card>
  );
}
