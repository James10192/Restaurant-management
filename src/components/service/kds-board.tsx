import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { useQuery } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import { CircleAlert, Flame, Lock, RotateCcw, TriangleAlert, Undo2, Volume2 } from "lucide-react";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { ALLERGENS } from "../../../convex/lib/allergens";
import { EmptyState, LoadingState } from "~/components/app/states";
import { Alert, AlertTitle } from "~/components/ui/alert";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { Card, CardAction, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "~/components/ui/card";
import { Item, ItemContent, ItemDescription, ItemGroup, ItemTitle } from "~/components/ui/item";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "~/components/ui/sheet";
import { cn } from "~/lib/utils";
import { useOutbox } from "./outbox-provider";
import { useServiceScope } from "./service-scope";
import { ServiceStatus } from "./service-status";
import { isTicketLate, ticketWait } from "../../../convex/lib/analytics";
import { elapsed, useMinuteClock } from "./time";

type Board = FunctionReturnType<typeof api.kitchen.board>;
type Ticket = Board["active"][number];

const allergenLabel = (key: string) => (ALLERGENS as Record<string, { fr: string } | undefined>)[key]?.fr ?? key;

/**
 * L'écran d'un poste de cuisine. Lisible à deux mètres, un seul geste par bon : « Commencer »,
 * puis « Prêt ». Le retard se calcule ici à partir de l'heure d'arrivée et des seuils du poste ;
 * le serveur ne pousse pas d'horloge.
 */
export function KdsBoard({ stationId }: { stationId: Id<"prepStations"> }) {
  const scope = useServiceScope();
  const board = useQuery(api.kitchen.board, { venueId: scope.venueId, stationId });
  const now = useMinuteClock(1_000);
  const [allDay, setAllDay] = useState(false);
  const sound = useArrivalSignals(board);

  if (board === undefined) return <LoadingState />;
  const late = board.active.filter((t) => isTicketLate(t, board.station, now)).length;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold tracking-tight">{board.station.name}</h1>
          <p className="text-sm text-muted-foreground">
            {board.active.length} bon{board.active.length > 1 ? "s" : ""} en cours
            {late > 0 ? ` · ${late} en retard` : ""} · objectif {board.station.targetPrepMinutes} min
          </p>
        </div>
        <div className="flex gap-2">
          {sound.blocked ? (
            <Button variant="outline" onClick={sound.enable}>
              <Volume2 />
              Activer le son
            </Button>
          ) : null}
          <Button variant="outline" onClick={() => setAllDay(true)}>
            À produire
          </Button>
          {scope.lock ? (
            <Button variant="outline" size="icon" aria-label="Verrouiller" onClick={scope.lock}>
              <Lock />
            </Button>
          ) : null}
        </div>
      </div>
      <ServiceStatus />
      {!board.station.isActive ? (
        <p className="text-sm text-destructive">Ce poste est archivé : plus rien n'y est routé.</p>
      ) : null}

      {board.active.length === 0 ? (
        <EmptyState title="Aucun bon en cours" description="Les commandes envoyées à ce poste apparaissent ici, les plus anciennes d'abord." />
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {board.active.map((t) => (
            <TicketCard key={t._id} ticket={t} board={board} now={now} />
          ))}
        </div>
      )}

      {board.ready.length > 0 ? (
        <section className="flex flex-col gap-2">
          <h2 className="text-sm font-medium text-muted-foreground">Prêts, en attente du serveur</h2>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-3">
            {board.ready.map((t) => (
              <ReadyCard key={t._id} ticket={t} canUpdate={board.canUpdate} now={now} />
            ))}
          </div>
        </section>
      ) : null}

      <Sheet open={allDay} onOpenChange={setAllDay}>
        <SheetContent>
          <SheetHeader>
            <SheetTitle>À produire</SheetTitle>
            <SheetDescription>Le total de chaque plat sur les bons en cours.</SheetDescription>
          </SheetHeader>
          <ItemGroup className="gap-1 px-4">
            {board.allDay.length === 0 ? <p className="text-sm text-muted-foreground">Rien en cours.</p> : null}
            {board.allDay.map((l) => (
              <Item key={l.name} size="sm" variant="outline">
                <ItemContent>
                  <ItemTitle>{l.name}</ItemTitle>
                </ItemContent>
                <span className="text-lg font-semibold tabular-nums">{l.quantity}</span>
              </Item>
            ))}
          </ItemGroup>
        </SheetContent>
      </Sheet>
    </div>
  );
}

/**
 * Ce qui arrive et ce qui disparaît se signale : un son quand un bon arrive (si le poste l'a
 * réglé), et un message quand un bon en cours est annulé — sinon il s'évanouit de l'écran
 * pendant que le cuisinier le prépare. Le navigateur n'accepte le son qu'après un premier geste.
 */
function useArrivalSignals(board: Board | undefined) {
  const seen = useRef<Map<string, string> | null>(null);
  const audio = useRef<AudioContext | null>(null);
  const [blocked, setBlocked] = useState(false);

  useEffect(() => {
    if (!board) return;
    const active = new Map(board.active.map((t) => [t._id as string, t.tableNumber]));
    const ready = new Set(board.ready.map((t) => t._id as string));
    const previous = seen.current;
    seen.current = active;
    if (!previous) return;
    const arrived = [...active.keys()].some((id) => !previous.has(id));
    for (const [id, table] of previous) {
      if (!active.has(id) && !ready.has(id)) toast.warning(`Table ${table} : bon annulé ou retiré.`);
    }
    if (arrived && board.station.soundEnabled) {
      try {
        audio.current ??= new AudioContext();
        if (audio.current.state === "suspended") {
          setBlocked(true);
          return;
        }
        const osc = audio.current.createOscillator();
        const gain = audio.current.createGain();
        osc.frequency.value = 880;
        gain.gain.value = 0.2;
        osc.connect(gain).connect(audio.current.destination);
        osc.start();
        osc.stop(audio.current.currentTime + 0.25);
      } catch {
        /* pas de son possible : l'écran reste la source */
      }
    }
  }, [board]);

  return {
    blocked,
    enable: () => {
      void audio.current?.resume().then(() => setBlocked(false));
    },
  };
}

/** Le geste d'un bon part par la file : une tablette de cuisine perd le réseau aussi (D-062). */
function useAdvance() {
  const scope = useServiceScope();
  const { entries, enqueue } = useOutbox();
  const pending = new Map(
    entries
      .filter((e) => e.mutation === "kitchen:advance" && (e.status === "pending" || e.status === "sending"))
      .map((e) => [String(e.args.ticketId), String(e.args.action)]),
  );
  return {
    pending,
    advance: (ticket: Pick<Ticket, "_id" | "tableNumber">, action: "start" | "ready" | "recall") =>
      void enqueue({
        mutation: "kitchen:advance",
        args: { venueId: scope.venueId, ticketId: ticket._id, action },
        label: `Table ${ticket.tableNumber} — ${action === "start" ? "commencé" : action === "ready" ? "prêt" : "rappelé"}`,
      }),
  };
}

function TicketCard({ ticket, board, now }: { ticket: Ticket; board: Board; now: number }) {
  const { pending, advance } = useAdvance();
  const waited = ticketWait(ticket, now);
  const isLate = isTicketLate(ticket, board.station, now);
  const isSlow = !isLate && waited > board.station.targetPrepMinutes * 60_000;
  const next = pending.get(ticket._id);
  const status = next === "start" ? "started" : next === "ready" ? "ready" : ticket.status;

  return (
    <Card className={cn("gap-3 py-4", isLate && "border-destructive", ticket.status === "recalled" && "border-primary")}>
      <CardHeader className="px-4">
        <CardTitle className="text-xl">Table {ticket.tableNumber}</CardTitle>
        <CardDescription>
          {ticket.reference} · service {ticket.courseNumber}
        </CardDescription>
        <CardAction className="flex flex-col items-end gap-1">
          <span className={cn("font-mono text-xl tabular-nums", isLate && "text-destructive", isSlow && "font-semibold")}>{elapsed(waited)}</span>
          {ticket.status === "recalled" ? <Badge>Rappelé</Badge> : isLate ? <Badge variant="destructive">En retard</Badge> : null}
        </CardAction>
      </CardHeader>
      <CardContent className="flex flex-col gap-2 px-4">
        {ticket.allergyFlags.length > 0 ? (
          <Alert variant="destructive">
            <TriangleAlert />
            <AlertTitle>Allergènes : {ticket.allergyFlags.map(allergenLabel).join(", ")}</AlertTitle>
          </Alert>
        ) : null}
        <ItemGroup className="gap-1">
          {ticket.lines.map((l, i) => (
            <Item key={i} size="sm" variant="muted" className={cn(l.cancelled && "line-through opacity-50")}>
              <ItemContent>
                <ItemTitle className="text-base">
                  <span className="tabular-nums">{l.quantity} ×</span> {l.name}
                  {l.variantName ? ` (${l.variantName})` : ""}
                  {l.cancelled ? <Badge variant="destructive">Annulé</Badge> : null}
                </ItemTitle>
                {l.modifiers.length > 0 || l.instructions || l.allergyNote ? (
                  <ItemDescription className="line-clamp-none">
                    {[...l.modifiers, l.instructions ? `« ${l.instructions} »` : null, l.allergyNote ? `Allergie : ${l.allergyNote}` : null]
                      .filter(Boolean)
                      .join(" · ")}
                  </ItemDescription>
                ) : null}
              </ItemContent>
            </Item>
          ))}
        </ItemGroup>
      </CardContent>
      {board.canUpdate ? (
        <CardFooter className="gap-2 px-4">
          {status === "queued" || status === "recalled" ? (
            <Button size="lg" variant="outline" className="h-14 flex-1 text-base" onClick={() => advance(ticket, "start")}>
              <Flame />
              Commencer
            </Button>
          ) : null}
          <Button size="lg" className="h-14 flex-1 text-base" disabled={status === "ready"} onClick={() => advance(ticket, "ready")}>
            {status === "ready" ? "Envoi…" : "Prêt"}
          </Button>
        </CardFooter>
      ) : null}
    </Card>
  );
}

function ReadyCard({ ticket, canUpdate, now }: { ticket: Board["ready"][number]; canUpdate: boolean; now: number }) {
  const { pending, advance } = useAdvance();
  const recalling = pending.get(ticket._id) === "recall";
  return (
    <Card className="gap-2 py-3 opacity-80">
      <CardHeader className="px-4">
        <CardTitle>Table {ticket.tableNumber}</CardTitle>
        <CardDescription className="truncate">
          {ticket.lines.filter((l) => !l.cancelled).map((l) => `${l.quantity} × ${l.name}`).join(" · ")}
        </CardDescription>
        <CardAction className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground tabular-nums">{ticket.readyAt ? elapsed(now - ticket.readyAt) : ""}</span>
          {canUpdate ? (
            <Button size="icon-sm" variant="ghost" aria-label={`Rappeler la table ${ticket.tableNumber}`} disabled={recalling} onClick={() => advance(ticket, "recall")}>
              {recalling ? <RotateCcw className="animate-spin" /> : <Undo2 />}
            </Button>
          ) : null}
        </CardAction>
      </CardHeader>
    </Card>
  );
}

/** Pour un compte connecté : choisir le poste à afficher (une tablette de cuisine, elle, est liée au sien). */
export function StationPicker({ stations, onPick }: { stations: { _id: Id<"prepStations">; name: string; isActive: boolean }[]; onPick: (id: Id<"prepStations">) => void }) {
  const active = stations.filter((s) => s.isActive);
  if (active.length === 0) {
    return <EmptyState icon={<CircleAlert />} title="Aucun poste" description="Un gérant crée les postes dans « Postes de préparation »." />;
  }
  return (
    <div className="flex flex-col gap-3">
      <h1 className="text-2xl font-semibold tracking-tight">Cuisine</h1>
      <p className="text-sm text-muted-foreground">Quel poste affiche cet écran ?</p>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        {active.map((s) => (
          <Button key={s._id} size="lg" variant="outline" className="h-16 text-lg" onClick={() => onPick(s._id)}>
            {s.name}
          </Button>
        ))}
      </div>
    </div>
  );
}
