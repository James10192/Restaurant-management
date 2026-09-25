import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import { Bell, Check, ChefHat, Clock, Hand, LayoutGrid, Lock, Users, Wallet, X } from "lucide-react";
import { toast } from "sonner";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { APPROVAL_ESCALATE_MS } from "../../../convex/lib/ordering";
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
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "~/components/ui/card";
import { Input } from "~/components/ui/input";
import { Item, ItemActions, ItemContent, ItemDescription, ItemGroup, ItemTitle } from "~/components/ui/item";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "~/components/ui/tabs";
import { Textarea } from "~/components/ui/textarea";
import { ToggleGroup, ToggleGroupItem } from "~/components/ui/toggle-group";
import { describeError } from "~/lib/errors";
import { uuidv7 } from "~/lib/outbox";
import { cn } from "~/lib/utils";
import { ActionButton } from "./action-button";
import { useOrderMenu } from "./order-composer";
import { useOutbox } from "./outbox-provider";
import { useMoney, useServiceScope } from "./service-scope";
import { ServiceStatus } from "./service-status";
import { useMinuteClock, waitedLabel } from "./time";

type Floor = FunctionReturnType<typeof api.sessions.floor>;
type FloorTable = Floor["areas"][number]["tables"][number];

/**
 * L'écran du serveur : les tables, ce qui attend d'être porté, ce que demandent les clients.
 * On le regarde cinquante fois par service : ce qui réclame un geste se voit en premier.
 */
export function FloorBoard() {
  const scope = useServiceScope();
  const floor = useQuery(api.sessions.floor, { venueId: scope.venueId });
  const ready = useQuery(api.orders.readyToServe, scope.can("order.read") ? { venueId: scope.venueId } : "skip");
  const requests = useQuery(api.serviceRequests.open, scope.can("service_request.read") ? { venueId: scope.venueId } : "skip");
  const pending = useQuery(api.orders.pendingAcceptance, scope.can("order.accept") ? { venueId: scope.venueId } : "skip");
  const [tab, setTab] = useState("tables");
  useOrderMenu(); // la carte à commander reste à jour sur l'appareil, pour les coupures

  if (floor === undefined) return <LoadingState />;
  const readyCount = ready?.tickets.length ?? 0;
  const requestCount = requests?.requests.filter((r) => r.status === "open").length ?? 0;
  const pendingCount = pending?.length ?? 0;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold tracking-tight">Service</h1>
          <p className="text-sm text-muted-foreground">
            {scope.venueName}
            {scope.name ? ` · ${scope.name}` : ""}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {scope.can("payment.collect") || scope.can("cash_register.open") || scope.can("cash_register.close") ? (
            <Button variant="outline" onClick={scope.nav.cash}>
              <Wallet />
              Caisse
            </Button>
          ) : null}
          {scope.lock ? (
            <Button variant="outline" onClick={scope.lock}>
              <Lock />
              Verrouiller
            </Button>
          ) : null}
        </div>
      </div>
      <ServiceStatus />
      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="w-full sm:w-fit">
          <TabsTrigger value="tables">
            <LayoutGrid />
            Tables
          </TabsTrigger>
          <TabsTrigger value="ready">
            <ChefHat />
            À servir
            {readyCount > 0 ? <Badge>{readyCount}</Badge> : null}
          </TabsTrigger>
          <TabsTrigger value="requests">
            <Bell />
            Demandes
            {requestCount > 0 ? <Badge>{requestCount}</Badge> : null}
          </TabsTrigger>
          {scope.can("order.accept") ? (
            <TabsTrigger value="pending">
              <Hand />
              À valider
              {pendingCount > 0 ? <Badge variant="destructive">{pendingCount}</Badge> : null}
            </TabsTrigger>
          ) : null}
        </TabsList>
        <TabsContent value="tables">
          <TablesTab floor={floor} />
        </TabsContent>
        <TabsContent value="ready">
          <ReadyTab data={ready} />
        </TabsContent>
        <TabsContent value="requests">
          <RequestsTab data={requests} />
        </TabsContent>
        {scope.can("order.accept") ? (
          <TabsContent value="pending">
            <PendingTab data={pending} />
          </TabsContent>
        ) : null}
      </Tabs>
    </div>
  );
}

/* ─────────────────────────── Tables ─────────────────────────── */

function TablesTab({ floor }: { floor: Floor }) {
  const scope = useServiceScope();
  const { entries } = useOutbox();
  const [filter, setFilter] = useState<"all" | "mine">("all");
  const [opening, setOpening] = useState<FloorTable | null>(null);
  const openingOffline = useMemo(
    () => new Set(entries.filter((e) => e.mutation === "sessions:open" && e.status !== "rejected").map((e) => String(e.args.tableId))),
    [entries],
  );

  const areas = floor.areas
    .map((area) => ({ ...area, tables: filter === "mine" ? area.tables.filter((t) => t.session?.isMine) : area.tables }))
    .filter((area) => area.tables.length > 0);

  if (floor.areas.every((a) => a.tables.length === 0)) {
    return <EmptyState title="Aucune table" description="Le plan de salle est vide. Un gérant ajoute les tables dans « Salle »." />;
  }

  return (
    <div className="flex flex-col gap-4 pt-2">
      {floor.me ? (
        <ToggleGroup type="single" variant="outline" value={filter} onValueChange={(v) => v && setFilter(v as "all" | "mine")}>
          <ToggleGroupItem value="all">Toutes</ToggleGroupItem>
          <ToggleGroupItem value="mine">Mes tables</ToggleGroupItem>
        </ToggleGroup>
      ) : null}
      {areas.length === 0 ? <EmptyState title="Aucune table à votre nom" description="Ouvrez une table : elle devient la vôtre." /> : null}
      {areas.map((area) => (
        <section key={area._id} className="flex flex-col gap-2">
          <h2 className="text-sm font-medium text-muted-foreground">{area.name}</h2>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
            {area.tables.map((table) => (
              <TableCard
                key={table._id}
                table={table}
                openingOffline={openingOffline.has(table._id)}
                onOpen={() => {
                  if (table.session || openingOffline.has(table._id)) scope.nav.table(table._id);
                  else if (!table.outOfService && floor.can.open) setOpening(table);
                }}
              />
            ))}
          </div>
        </section>
      ))}
      <OpenTableDialog table={opening} onClose={() => setOpening(null)} />
    </div>
  );
}

/** Une pastille « Commande client » tient 5 minutes, « Code renouvelé » 30 (D-107). */
const GUEST_ORDER_BADGE_MS = 5 * 60_000;
const CODE_ALERT_MS = 30 * 60_000;

/** L'heure, relue chaque minute : les pastilles s'éteignent d'elles-mêmes, sans attendre une écriture. */
function useMinute(): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 60_000);
    return () => window.clearInterval(timer);
  }, []);
  return now;
}

function TableCard({ table, openingOffline, onOpen }: { table: FloorTable; openingOffline: boolean; onOpen: () => void }) {
  const s = table.session;
  const now = useMinute();
  const attention = (s?.readyCount ?? 0) + (s?.requestCount ?? 0) + (s?.pendingCount ?? 0) + table.waitingRequests;
  const state = table.outOfService ? "Hors service" : s ? (s.guestCount ? `${s.guestCount} couvert${s.guestCount > 1 ? "s" : ""}` : "Ouverte") : openingOffline ? "Ouverture en attente" : "Libre";
  return (
    <Card
      role="button"
      tabIndex={0}
      aria-label={`Table ${table.number}, ${state}`}
      onClick={onOpen}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onOpen();
        }
      }}
      className={cn(
        "cursor-pointer gap-2 py-3 transition-colors hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
        !s && !openingOffline && "border-dashed",
        table.outOfService && "cursor-not-allowed opacity-50",
        s?.isMine && "border-primary",
      )}
    >
      <CardHeader className="px-3">
        <CardTitle className="text-lg">Table {table.number}</CardTitle>
        <CardDescription className="truncate">{s?.waiterName ?? table.label ?? `${table.seats} places`}</CardDescription>
        {attention > 0 ? (
          <CardAction>
            <Badge variant="destructive">{attention}</Badge>
          </CardAction>
        ) : null}
      </CardHeader>
      <CardContent className="flex flex-wrap gap-1 px-3">
        <Badge variant={s ? "default" : "outline"}>{state}</Badge>
        {s && s.readyCount > 0 ? <Badge variant="secondary">{s.readyCount} prêt{s.readyCount > 1 ? "s" : ""}</Badge> : null}
        {(s?.requestCount ?? table.waitingRequests) > 0 ? <Badge variant="secondary">Appel</Badge> : null}
        {s && s.pendingCount > 0 ? <Badge variant="secondary">À valider</Badge> : null}
        {s?.lastGuestOrderAt && now - s.lastGuestOrderAt < GUEST_ORDER_BADGE_MS ? <Badge variant="secondary">Commande client</Badge> : null}
        {s?.codeAlertAt && now - s.codeAlertAt < CODE_ALERT_MS ? <Badge variant="destructive">Code renouvelé</Badge> : null}
      </CardContent>
    </Card>
  );
}

/** Ouvrir une table. Le geste passe par la file : il tient même sans réseau (D-062). */
function OpenTableDialog({ table, onClose }: { table: FloorTable | null; onClose: () => void }) {
  const scope = useServiceScope();
  const { enqueue } = useOutbox();
  const [guests, setGuests] = useState("");

  async function open() {
    if (!table) return;
    const count = guests.trim() === "" ? undefined : Number(guests);
    if (count !== undefined && (!Number.isInteger(count) || count < 1 || count > 40)) {
      toast.error("Le nombre de couverts va de 1 à 40.");
      return;
    }
    await enqueue({
      mutation: "sessions:open",
      args: { venueId: scope.venueId, tableId: table._id, clientRef: uuidv7(), ...(count !== undefined ? { guestCount: count } : {}) },
      label: `Ouvrir la table ${table.number}`,
    });
    setGuests("");
    onClose();
    scope.nav.table(table._id);
  }

  return (
    <ResponsiveDialog open={table !== null} onOpenChange={(o) => !o && onClose()}>
      <ResponsiveDialogContent>
        <ResponsiveDialogHeader>
          <ResponsiveDialogTitle>Ouvrir la table {table?.number}</ResponsiveDialogTitle>
          <ResponsiveDialogDescription>Elle sera à votre nom. Le nombre de couverts est facultatif.</ResponsiveDialogDescription>
        </ResponsiveDialogHeader>
        <form
          className="flex flex-col gap-4 px-4 md:px-0"
          onSubmit={(e) => {
            e.preventDefault();
            void open();
          }}
        >
          <FormField label="Couverts" optional>
            <Input inputMode="numeric" pattern="[0-9]*" placeholder={table ? String(table.seats) : ""} value={guests} onChange={(e) => setGuests(e.target.value)} />
          </FormField>
          <ResponsiveDialogFooter>
            <Button type="submit">
              <Users />
              Ouvrir
            </Button>
          </ResponsiveDialogFooter>
        </form>
      </ResponsiveDialogContent>
    </ResponsiveDialog>
  );
}

/* ─────────────────────────── À servir ─────────────────────────── */

function ReadyTab({ data }: { data: FunctionReturnType<typeof api.orders.readyToServe> | undefined }) {
  const scope = useServiceScope();
  const { entries, enqueue } = useOutbox();
  const now = useMinuteClock();
  if (data === undefined) return <LoadingState />;
  const sending = new Set(entries.filter((e) => e.mutation === "orders:serveTicket" && e.status !== "rejected").map((e) => String(e.args.ticketId)));
  const tickets = data.tickets.filter((t) => !sending.has(t._id));
  if (tickets.length === 0) return <EmptyState title="Rien à porter" description="Les plats prêts en cuisine apparaissent ici." />;
  return (
    <ItemGroup className="gap-2 pt-2">
      {tickets.map((t) => (
        <Item key={t._id} variant="outline" className={cn(t.isMine && "border-primary")}>
          <ItemContent>
            <ItemTitle>
              Table {t.tableNumber}
              <Badge variant="outline">{t.station}</Badge>
            </ItemTitle>
            <ItemDescription>
              {t.items.map((i) => `${i.quantity} × ${i.name}${i.variantName ? ` (${i.variantName})` : ""}`).join(" · ")}
            </ItemDescription>
            {t.readyAt ? (
              <p className="flex items-center gap-1 text-xs text-muted-foreground">
                <Clock className="size-3" />
                Prêt {waitedLabel(now - t.readyAt)}
              </p>
            ) : null}
          </ItemContent>
          {data.canServe ? (
            <ItemActions>
              <Button
                onClick={() =>
                  void enqueue({
                    mutation: "orders:serveTicket",
                    args: { venueId: scope.venueId, ticketId: t._id },
                    label: `Table ${t.tableNumber} — servi`,
                  })
                }
              >
                <Check />
                Servi
              </Button>
            </ItemActions>
          ) : null}
        </Item>
      ))}
    </ItemGroup>
  );
}

/* ─────────────────────────── Demandes ─────────────────────────── */

function RequestsTab({ data }: { data: FunctionReturnType<typeof api.serviceRequests.open> | undefined }) {
  const scope = useServiceScope();
  const { enqueue } = useOutbox();
  const now = useMinuteClock();
  if (data === undefined) return <LoadingState />;
  if (data.requests.length === 0) return <EmptyState title="Aucune demande" description="Quand un client appelle depuis sa table, c'est ici." />;
  return (
    <ItemGroup className="gap-2 pt-2">
      {data.requests.map((r) => (
        <Item key={r._id} variant="outline" className={cn(r.isMine && "border-primary")}>
          <ItemContent>
            <ItemTitle>
              Table {r.tableNumber} — {r.label}
              {!r.tableOpen ? <Badge variant="outline">Table pas encore ouverte</Badge> : null}
            </ItemTitle>
            <ItemDescription>
              Il y a {waitedLabel(now - r.createdAt, false)}
              {r.status === "acknowledged" && r.acknowledgedBy ? ` · ${r.acknowledgedBy} y va` : ""}
            </ItemDescription>
          </ItemContent>
          {data.canHandle ? (
            <ItemActions>
              {r.status === "open" ? (
                <Button
                  variant="outline"
                  onClick={() =>
                    void enqueue({ mutation: "serviceRequests:acknowledge", args: { venueId: scope.venueId, requestId: r._id }, label: `Table ${r.tableNumber} — j'y vais` })
                  }
                >
                  J'y vais
                </Button>
              ) : null}
              <Button
                onClick={() =>
                  void enqueue({ mutation: "serviceRequests:resolve", args: { venueId: scope.venueId, requestId: r._id }, label: `Table ${r.tableNumber} — demande traitée` })
                }
              >
                <Check />
                Fait
              </Button>
            </ItemActions>
          ) : null}
        </Item>
      ))}
    </ItemGroup>
  );
}

/* ─────────────────────────── À valider ─────────────────────────── */

function PendingTab({ data }: { data: FunctionReturnType<typeof api.orders.pendingAcceptance> | undefined }) {
  const scope = useServiceScope();
  // L'alerte à 90 s se calcule ici, à l'heure qui passe : le serveur ne recalcule pas une lecture
  // quand seul le temps avance (D-061).
  const now = useMinuteClock(5_000);
  const money = useMoney();
  const accept = useMutation(api.orders.accept);
  const [rejecting, setRejecting] = useState<Id<"orders"> | null>(null);
  if (data === undefined) return <LoadingState />;
  if (data.length === 0) return <EmptyState title="Rien à valider" description="Les commandes envoyées par les clients attendent ici votre accord." />;
  return (
    <ItemGroup className="gap-2 pt-2">
      {data.map((o) => (
        <Item key={o._id} variant="outline" className={cn(now - o.submittedAt > APPROVAL_ESCALATE_MS && "border-destructive")}>
          <ItemContent>
            <ItemTitle>
              Table {o.tableNumber} · {money(o.total)}
              {now - o.submittedAt > APPROVAL_ESCALATE_MS ? <Badge variant="destructive">En attente depuis {waitedLabel(now - o.submittedAt, false)}</Badge> : null}
            </ItemTitle>
            <ItemDescription className="line-clamp-none">
              {o.items.map((i) => `${i.quantity} × ${i.name}${i.variantName ? ` (${i.variantName})` : ""}${i.modifiers.length ? ` + ${i.modifiers.join(", ")}` : ""}`).join(" · ")}
              {o.notes ? ` — « ${o.notes} »` : ""}
            </ItemDescription>
          </ItemContent>
          <ItemActions>
            <Button variant="outline" onClick={() => setRejecting(o._id)}>
              <X />
              Refuser
            </Button>
            <ActionButton
              onAction={async () => {
                try {
                  await accept({ venueId: scope.venueId, orderId: o._id });
                  toast.success(`Table ${o.tableNumber} : commande envoyée en cuisine.`);
                } catch (error) {
                  toast.error(describeError(error).message);
                }
              }}
            >
              <Check />
              Accepter
            </ActionButton>
          </ItemActions>
        </Item>
      ))}
      <RejectDialog orderId={rejecting} onClose={() => setRejecting(null)} />
    </ItemGroup>
  );
}

function RejectDialog({ orderId, onClose }: { orderId: Id<"orders"> | null; onClose: () => void }) {
  const scope = useServiceScope();
  const reject = useMutation(api.orders.reject);
  const [reason, setReason] = useState("");
  return (
    <ResponsiveDialog open={orderId !== null} onOpenChange={(o) => !o && onClose()}>
      <ResponsiveDialogContent>
        <ResponsiveDialogHeader>
          <ResponsiveDialogTitle>Refuser la commande</ResponsiveDialogTitle>
          <ResponsiveDialogDescription>Le client verra le motif sur son téléphone.</ResponsiveDialogDescription>
        </ResponsiveDialogHeader>
        <div className="flex flex-col gap-4 px-4 md:px-0">
          <FormField label="Motif">
            <Textarea value={reason} maxLength={200} placeholder="Ex. : cuisine fermée, plat épuisé" onChange={(e) => setReason(e.target.value)} />
          </FormField>
          <ResponsiveDialogFooter>
            <ActionButton
              variant="destructive"
              onAction={async () => {
                if (!orderId) return;
                try {
                  await reject({ venueId: scope.venueId, orderId, reason });
                  setReason("");
                  onClose();
                } catch (error) {
                  toast.error(describeError(error).message);
                }
              }}
            >
              Refuser
            </ActionButton>
          </ResponsiveDialogFooter>
        </div>
      </ResponsiveDialogContent>
    </ResponsiveDialog>
  );
}
