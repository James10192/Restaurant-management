import { useEffect, useMemo, useRef, useState, type FormEvent, type KeyboardEvent, type PointerEvent, type ReactNode } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import { ChevronRight, CircleAlert, Plus, Printer, QrCode, RotateCw, WifiOff } from "lucide-react";
import { toast } from "sonner";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import { FormField } from "~/components/app/form-field";
import { PendingButton } from "~/components/app/pending-button";
import {
  ResponsiveDialog,
  ResponsiveDialogContent,
  ResponsiveDialogDescription,
  ResponsiveDialogFooter,
  ResponsiveDialogHeader,
  ResponsiveDialogTitle,
} from "~/components/app/responsive-dialog";
import { EmptyState, LoadingState, PermissionDeniedState } from "~/components/app/states";
import { useWorkspace } from "~/components/app/workspace";
import { Alert, AlertDescription } from "~/components/ui/alert";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "~/components/ui/alert-dialog";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "~/components/ui/card";
import { Input } from "~/components/ui/input";
import { Item, ItemActions, ItemContent, ItemDescription, ItemGroup, ItemMedia, ItemTitle } from "~/components/ui/item";
import { NativeSelect, NativeSelectOption } from "~/components/ui/native-select";
import { Separator } from "~/components/ui/separator";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "~/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "~/components/ui/tabs";
import { ToggleGroup, ToggleGroupItem } from "~/components/ui/toggle-group";
import { useIsMobile } from "~/hooks/use-mobile";
import { describeError } from "~/lib/errors";
import { cn } from "~/lib/utils";

export const Route = createFileRoute("/_auth/app/floor/")({
  head: () => ({ meta: [{ title: "Plan de salle — Joliba" }] }),
  component: FloorPage,
});

type Overview = FunctionReturnType<typeof api.floor.overview>;
type Area = Overview["areas"][number];
type Table = Area["tables"][number];
type Box = { x: number; y: number; width: number; height: number; rotation: number };

const GRID = 20;
const AREA_TEMPLATES = ["Salle", "Terrasse", "VIP"];
const SHAPES = { square: "Carrée", round: "Ronde", rect: "Rectangulaire" } as const;
const timeFormat = new Intl.DateTimeFormat("fr-FR", { hour: "2-digit", minute: "2-digit" });
const dateFormat = new Intl.DateTimeFormat("fr-FR", { dateStyle: "medium" });

function useOnline() {
  const [online, setOnline] = useState(true);
  useEffect(() => {
    const update = () => setOnline(navigator.onLine);
    update();
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    return () => {
      window.removeEventListener("online", update);
      window.removeEventListener("offline", update);
    };
  }, []);
  return online;
}

function PageTitle({ description, actions }: { description?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-3">
      <div className="min-w-0">
        <h1 className="text-2xl font-semibold tracking-tight">Plan de salle</h1>
        {description ? <p className="text-muted-foreground">{description}</p> : null}
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
    </div>
  );
}

function ErrorAlert({ children }: { children: ReactNode }) {
  return (
    <Alert variant="destructive">
      <CircleAlert />
      <AlertDescription>{children}</AlertDescription>
    </Alert>
  );
}

/**
 * Le plan de salle (IA §4.5). On dessine à la souris sur grand écran ; au téléphone, la liste
 * des tables et leurs QR, en lecture. Hors ligne, l'édition est refusée : deux plans modifiés
 * chacun de son côté donnent un plan faux (cercle 3).
 */
function FloorPage() {
  const w = useWorkspace();
  const venueId = w.venue?._id;
  const allowed = venueId !== undefined && w.canInVenue("table.read");
  const overview = useQuery(api.floor.overview, allowed ? { venueId } : "skip");
  const createAreas = useMutation(api.floor.createAreas);
  const [areaId, setAreaId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const online = useOnline();

  if (!allowed) return <PermissionDeniedState venue={w.venue?.name} permission="Consulter le plan de salle" />;
  if (!overview || !venueId) return <LoadingState />;
  const canManage = overview.canManage && online;
  const area = overview.areas.find((a) => a._id === areaId) ?? overview.areas[0] ?? null;

  async function addAreas(names: string[]) {
    setError(null);
    try {
      const ids = await createAreas({ venueId: venueId!, names });
      if (ids[0]) setAreaId(ids[0]);
    } catch (e) {
      setError(describeError(e).message);
    }
  }

  if (!area) {
    return (
      <div className="flex flex-col gap-6">
        <PageTitle />
        <EmptyState
          title="Commencez par créer une zone"
          description="Salle, Terrasse, VIP… Chaque zone a son plan et sa planche de QR."
          action={
            overview.canManage ? (
              <Button onClick={() => void addAreas(["Salle"])} disabled={!online}>
                Créer la zone « Salle »
              </Button>
            ) : undefined
          }
          secondaryAction={
            overview.canManage ? (
              <Button variant="outline" onClick={() => void addAreas(AREA_TEMPLATES)} disabled={!online}>
                Salle, Terrasse et VIP
              </Button>
            ) : undefined
          }
        />
        {error ? <ErrorAlert>{error}</ErrorAlert> : null}
      </div>
    );
  }

  const editor = (
    <AreaEditor key={area._id} venueId={venueId} area={area} areas={overview.areas} canManage={canManage} canManageQr={overview.canManageQr && online} onAddAreas={addAreas} />
  );

  return (
    <div className="flex flex-col gap-6">
      <PageTitle
        description={overview.canManage ? undefined : "Seul un responsable peut modifier le plan."}
        actions={
          overview.canManageQr ? (
            <Button variant="outline" asChild>
              <Link to="/app/floor/print" search={{ zone: area._id }}>
                <Printer data-icon="inline-start" aria-hidden="true" />
                Imprimer les QR
              </Link>
            </Button>
          ) : null
        }
      />
      {!online && overview.canManage ? (
        <Alert role="status">
          <WifiOff />
          <AlertDescription>Hors ligne : le plan est en lecture seule jusqu'au retour du réseau.</AlertDescription>
        </Alert>
      ) : null}
      {error ? <ErrorAlert>{error}</ErrorAlert> : null}
      {overview.areas.length > 1 ? (
        <Tabs value={area._id} onValueChange={setAreaId}>
          {/* Beaucoup de zones sur un téléphone : la barre défile seule, jamais la page. */}
          <div className="max-w-full overflow-x-auto">
            <TabsList aria-label="Zones">
              {overview.areas.map((a) => (
                <TabsTrigger key={a._id} value={a._id}>
                  {a.name}
                  <Badge variant="secondary" className="tabular-nums">
                    {a.tables.length}
                  </Badge>
                </TabsTrigger>
              ))}
            </TabsList>
          </div>
          <TabsContent value={area._id} className="pt-2">
            {editor}
          </TabsContent>
        </Tabs>
      ) : (
        editor
      )}
    </div>
  );
}

function AreaEditor({
  venueId,
  area,
  areas,
  canManage,
  canManageQr,
  onAddAreas,
}: {
  venueId: Id<"venues">;
  area: Area;
  areas: Area[];
  canManage: boolean;
  canManageQr: boolean;
  onAddAreas: (names: string[]) => Promise<void>;
}) {
  const saveLayout = useMutation(api.floor.saveLayout);
  const isMobile = useIsMobile();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [local, setLocal] = useState<Record<string, Box>>({});
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const saveTimer = useRef<number | undefined>(undefined);
  const selected = area.tables.find((t) => t._id === selectedId) ?? null;

  const box = (t: Table): Box => local[t._id] ?? { x: t.x, y: t.y, width: t.width, height: t.height, rotation: t.rotation };

  // Les tables présentes DANS cette zone, à jour : une table déplacée vers une autre zone
  // entre-temps ne doit pas faire refuser tout le lot (le serveur refuse le lot entier).
  const areaTables = useRef(new Set<string>());
  areaTables.current = new Set(area.tables.map((t) => t._id));
  const pending = useRef<Record<string, Box>>({});

  async function flush() {
    window.clearTimeout(saveTimer.current);
    const batch = Object.entries(pending.current).filter(([id]) => areaTables.current.has(id));
    pending.current = {};
    if (batch.length === 0) return;
    const tables = batch.map(([tableId, b]) => ({ tableId: tableId as Id<"restaurantTables">, ...b }));
    try {
      await saveLayout({ venueId, serviceAreaId: area._id, tables });
      setSavedAt(Date.now());
      setError(null);
      // Le serveur fait foi une fois enregistré : on lâche la copie locale.
      setLocal((current) => {
        const rest = { ...current };
        for (const [id, b] of batch) if (rest[id] === b) delete rest[id];
        return rest;
      });
    } catch (e) {
      // Remis en attente : le prochain geste réessaie, sans ce qui a quitté la zone.
      pending.current = { ...Object.fromEntries(batch), ...pending.current };
      setError(describeError(e).message);
    }
  }

  function move(t: Table, b: Box, delay: number) {
    const clamped = {
      ...b,
      x: Math.max(0, Math.min(area.canvasWidth - b.width, b.x)),
      y: Math.max(0, Math.min(area.canvasHeight - b.height, b.y)),
    };
    setLocal((current) => ({ ...current, [t._id]: clamped }));
    pending.current = { ...pending.current, [t._id]: clamped };
    window.clearTimeout(saveTimer.current);
    saveTimer.current = window.setTimeout(() => void flush(), delay);
  }

  // Changer de zone ou quitter l'écran enregistre ce qui attendait, au lieu de le perdre.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => () => void flush(), []);

  return (
    <div className="grid min-w-0 gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
      <div className="flex min-w-0 flex-col gap-3">
        <div className="flex flex-wrap items-center gap-3">
          {canManage ? (
            <Button onClick={() => setAdding(true)}>
              <Plus data-icon="inline-start" aria-hidden="true" />
              Ajouter une table
            </Button>
          ) : null}
          <span role="status" className="text-sm text-muted-foreground">
            {savedAt ? `Enregistré à ${timeFormat.format(savedAt)}` : ""}
          </span>
        </div>
        {error ? <ErrorAlert>{error}</ErrorAlert> : null}
        {area.tables.length === 0 ? (
          <EmptyState
            className="border border-dashed"
            title="Aucune table ici"
            description="Ajoutez les tables de cette zone : une par une, ou une rangée d'un coup."
          />
        ) : (
          <>
            <Canvas area={area} box={box} selectedId={selectedId} canManage={canManage} onSelect={setSelectedId} onMove={move} />
            <ItemGroup className="gap-2 md:hidden">
              {area.tables.map((t) => (
                <div role="listitem" key={t._id}>
                  <Item variant="outline" asChild>
                    <button type="button" onClick={() => setSelectedId(t._id)} className="text-left">
                      <ItemContent className="min-w-0">
                        <ItemTitle>Table {t.number}</ItemTitle>
                        {t.label ? <ItemDescription className="truncate">{t.label}</ItemDescription> : null}
                      </ItemContent>
                      <ItemActions>
                        {t.status === "out_of_service" ? <Badge variant="outline">Hors service</Badge> : null}
                        <span className="text-sm text-muted-foreground tabular-nums">{t.seats} places</span>
                        <ChevronRight aria-hidden="true" className="size-4 text-muted-foreground" />
                      </ItemActions>
                    </button>
                  </Item>
                </div>
              ))}
            </ItemGroup>
          </>
        )}
      </div>
      <div className="flex min-w-0 flex-col gap-4">
        {selected ? (
          <TablePanel
            key={selected._id}
            mobile={isMobile}
            venueId={venueId}
            table={selected}
            box={box(selected)}
            areas={areas}
            canManage={canManage}
            canManageQr={canManageQr}
            onMove={(b) => move(selected, b, 600)}
            onRemoved={() => setSelectedId(null)}
            onClose={() => setSelectedId(null)}
          />
        ) : null}
        {!selected || isMobile ? (
          <Item variant="muted">
            <ItemMedia variant="icon">
              <QrCode aria-hidden="true" />
            </ItemMedia>
            <ItemContent>
              <ItemDescription className="line-clamp-none">Choisissez une table pour voir son QR{canManage ? ", la renommer ou la déplacer" : ""}.</ItemDescription>
            </ItemContent>
          </Item>
        ) : null}
        {canManage ? <AreaPanel venueId={venueId} area={area} onAddAreas={onAddAreas} /> : null}
      </div>
      <AddTableDialog open={adding} onOpenChange={setAdding} venueId={venueId} areaId={area._id} />
    </div>
  );
}

function Canvas({
  area,
  box,
  selectedId,
  canManage,
  onSelect,
  onMove,
}: {
  area: Area;
  box: (t: Table) => Box;
  selectedId: string | null;
  canManage: boolean;
  onSelect: (id: string) => void;
  onMove: (t: Table, b: Box, delay: number) => void;
}) {
  const svgRef = useRef<SVGSVGElement>(null);
  const drag = useRef<{ id: string; dx: number; dy: number } | null>(null);

  function toCanvas(event: PointerEvent) {
    const svg = svgRef.current;
    const matrix = svg?.getScreenCTM()?.inverse();
    if (!svg || !matrix) return null;
    const point = new DOMPoint(event.clientX, event.clientY).matrixTransform(matrix);
    return { x: point.x, y: point.y };
  }

  function onPointerDown(event: PointerEvent<SVGGElement>, t: Table) {
    onSelect(t._id);
    if (!canManage) return;
    const p = toCanvas(event);
    if (!p) return;
    const b = box(t);
    drag.current = { id: t._id, dx: p.x - b.x, dy: p.y - b.y };
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function onPointerMove(event: PointerEvent<SVGGElement>, t: Table) {
    if (drag.current?.id !== t._id) return;
    const p = toCanvas(event);
    if (!p) return;
    const b = box(t);
    const snap = (value: number) => Math.round(value / GRID) * GRID;
    // Enregistré une fois le geste fini : un plan se dessine, il ne s'écrit pas à chaque pixel.
    onMove(t, { ...b, x: snap(p.x - drag.current.dx), y: snap(p.y - drag.current.dy) }, 800);
  }

  function onKeyDown(event: KeyboardEvent<SVGGElement>, t: Table) {
    if (!canManage) return;
    const step = event.shiftKey ? 1 : GRID;
    const b = box(t);
    const delta: Record<string, [number, number]> = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] };
    const d = delta[event.key];
    if (!d) return;
    event.preventDefault();
    onMove(t, { ...b, x: b.x + d[0], y: b.y + d[1] }, 600);
  }

  // Le dessin du plan n'a pas d'équivalent dans la bibliothèque : il reste en SVG, mais toutes
  // ses couleurs viennent des jetons du thème (clair comme sombre).
  return (
    <Card className="hidden overflow-auto py-0 md:flex">
      <svg
        ref={svgRef}
        viewBox={`0 0 ${area.canvasWidth} ${area.canvasHeight}`}
        className="block w-full touch-none bg-muted/30 select-none"
        role="group"
        aria-label={`Plan de la zone ${area.name}${canManage ? ". Flèches pour déplacer une table, Maj + flèches pour un pixel." : ""}`}
      >
        <defs>
          <pattern id="floor-grid" width={GRID} height={GRID} patternUnits="userSpaceOnUse">
            <path d={`M ${GRID} 0 L 0 0 0 ${GRID}`} fill="none" className="stroke-border" strokeWidth={0.5} />
          </pattern>
        </defs>
        <rect width={area.canvasWidth} height={area.canvasHeight} fill="url(#floor-grid)" />
        {area.tables.map((t) => {
          const b = box(t);
          const active = t._id === selectedId;
          const out = t.status === "out_of_service";
          const cx = b.x + b.width / 2;
          const cy = b.y + b.height / 2;
          const shapeClass = cn(active ? "fill-primary stroke-primary" : out ? "fill-muted stroke-muted-foreground/60" : "fill-card stroke-muted-foreground/50");
          const shapeProps = { className: shapeClass, strokeWidth: active ? 3 : 1.5, strokeDasharray: out ? "6 4" : undefined };
          return (
            <g
              key={t._id}
              role="button"
              tabIndex={0}
              aria-pressed={active}
              aria-label={`Table ${t.number}, ${t.seats} places${out ? ", hors service" : ""}`}
              transform={`rotate(${b.rotation} ${cx} ${cy})`}
              onPointerDown={(e) => onPointerDown(e, t)}
              onPointerMove={(e) => onPointerMove(e, t)}
              onPointerUp={() => (drag.current = null)}
              onKeyDown={(e) => onKeyDown(e, t)}
              onFocus={() => onSelect(t._id)}
              className={cn("outline-none focus-visible:[&>*:first-child]:stroke-ring", canManage ? "cursor-grab active:cursor-grabbing" : "cursor-pointer")}
            >
              {t.shape === "round" ? (
                <ellipse cx={cx} cy={cy} rx={b.width / 2} ry={b.height / 2} {...shapeProps} />
              ) : (
                <rect x={b.x} y={b.y} width={b.width} height={b.height} rx={8} {...shapeProps} />
              )}
              <text
                x={cx}
                y={cy}
                textAnchor="middle"
                dominantBaseline="central"
                fontSize={22}
                fontWeight={600}
                className={cn("tabular-nums", active ? "fill-primary-foreground" : out ? "fill-muted-foreground" : "fill-foreground")}
              >
                {t.number}
              </text>
            </g>
          );
        })}
      </svg>
    </Card>
  );
}

/**
 * Une confirmation qui dit la conséquence, pas « Êtes-vous sûr ? » (DESIGN §9.3). Le bouton
 * reste occupé pendant l'envoi : un double clic ne fait pas deux fois la chose.
 */
function ConfirmAction({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: ReactNode;
  confirmLabel: string;
  onConfirm: () => Promise<void>;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  return (
    <AlertDialog
      open={open}
      onOpenChange={(next) => {
        if (busy) return;
        setError(null);
        onOpenChange(next);
      }}
    >
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
        </AlertDialogHeader>
        {error ? <ErrorAlert>{error}</ErrorAlert> : null}
        <AlertDialogFooter>
          <AlertDialogCancel disabled={busy}>Annuler</AlertDialogCancel>
          <PendingButton
            variant="destructive"
            pending={busy}
            pendingText="Un instant…"
            onClick={async () => {
              setBusy(true);
              setError(null);
              try {
                await onConfirm();
                onOpenChange(false);
              } catch (e) {
                setError(describeError(e).message);
              } finally {
                setBusy(false);
              }
            }}
          >
            {confirmLabel}
          </PendingButton>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

function TablePanel({
  mobile,
  venueId,
  table,
  box,
  areas,
  canManage,
  canManageQr,
  onMove,
  onRemoved,
  onClose,
}: {
  mobile: boolean;
  venueId: Id<"venues">;
  table: Table;
  box: Box;
  areas: Area[];
  canManage: boolean;
  canManageQr: boolean;
  onMove: (b: Box) => void;
  onRemoved: () => void;
  onClose: () => void;
}) {
  const updateTable = useMutation(api.floor.updateTable);
  const removeTable = useMutation(api.floor.removeTable);
  const rotate = useMutation(api.qr.rotate);
  const [form, setForm] = useState({ number: table.number, label: table.label ?? "", seats: String(table.seats) });
  const [error, setError] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<"rotate" | "remove" | null>(null);
  const outOfService = table.status === "out_of_service";

  async function run(action: () => Promise<unknown>) {
    setError(null);
    try {
      await action();
      toast.success("Enregistré.");
    } catch (e) {
      setError(describeError(e).message);
    }
  }

  function submit(event: FormEvent) {
    event.preventDefault();
    void run(() => updateTable({ venueId, tableId: table._id, number: form.number, label: form.label.trim() ? form.label : null, seats: Number(form.seats) }));
  }

  const summary = `${table.seats} places${table.label ? ` · ${table.label}` : ""}`;

  const body = (
    <div className="flex flex-col gap-5">
      {canManage ? (
        <form onSubmit={submit} noValidate className="flex flex-col gap-4">
          <div className="grid grid-cols-2 gap-3">
            <FormField label="Numéro" error={error}>
              <Input value={form.number} onChange={(e) => setForm({ ...form, number: e.target.value })} maxLength={12} />
            </FormField>
            <FormField label="Places">
              <Input type="number" inputMode="numeric" min={1} max={50} value={form.seats} onChange={(e) => setForm({ ...form, seats: e.target.value })} />
            </FormField>
          </div>
          <FormField label="Libellé" optional description="« Près de la fenêtre », « Banquette »…">
            <Input value={form.label} onChange={(e) => setForm({ ...form, label: e.target.value })} maxLength={80} />
          </FormField>
          <Button type="submit" variant="outline" className="self-start">
            Enregistrer
          </Button>
          <Separator />
          <div className="grid grid-cols-2 gap-3">
            <FormField label="Forme">
              <NativeSelect
                className="w-full"
                value={table.shape}
                onChange={(e) => void run(() => updateTable({ venueId, tableId: table._id, shape: e.target.value as Table["shape"] }))}
              >
                {Object.entries(SHAPES).map(([value, label]) => (
                  <NativeSelectOption key={value} value={value}>
                    {label}
                  </NativeSelectOption>
                ))}
              </NativeSelect>
            </FormField>
            <FormField label="Zone">
              <NativeSelect
                className="w-full"
                value={areas.find((a) => a.tables.some((t) => t._id === table._id))?._id}
                onChange={(e) => void run(() => updateTable({ venueId, tableId: table._id, serviceAreaId: e.target.value as Id<"serviceAreas"> }))}
              >
                {areas.map((a) => (
                  <NativeSelectOption key={a._id} value={a._id}>
                    {a.name}
                  </NativeSelectOption>
                ))}
              </NativeSelect>
            </FormField>
            <FormField label="Largeur">
              <Input
                type="number"
                inputMode="numeric"
                min={40}
                max={400}
                step={GRID}
                value={box.width}
                onChange={(e) => onMove({ ...box, width: Math.max(40, Math.min(400, Number(e.target.value) || 40)) })}
              />
            </FormField>
            <FormField label="Hauteur">
              <Input
                type="number"
                inputMode="numeric"
                min={40}
                max={400}
                step={GRID}
                value={box.height}
                onChange={(e) => onMove({ ...box, height: Math.max(40, Math.min(400, Number(e.target.value) || 40)) })}
              />
            </FormField>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="outline" size="sm" onClick={() => onMove({ ...box, rotation: (box.rotation + 45) % 360 })}>
              <RotateCw data-icon="inline-start" aria-hidden="true" />
              Tourner
            </Button>
            <Button type="button" variant="outline" size="sm" onClick={() => void run(() => updateTable({ venueId, tableId: table._id, inService: outOfService }))}>
              {outOfService ? "Remettre en service" : "Mettre hors service"}
            </Button>
            <Button type="button" variant="destructive" size="sm" onClick={() => setConfirm("remove")}>
              Retirer la table
            </Button>
          </div>
        </form>
      ) : null}

      <div className="flex flex-col gap-3 rounded-lg bg-muted/50 p-3">
        <div className="flex items-start gap-3">
          <QrCode aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-muted-foreground" />
          <div className="flex min-w-0 flex-col gap-0.5">
            <p className="text-sm font-medium">QR de la table</p>
            {table.qr ? (
              <p className="text-sm text-muted-foreground">
                Version {table.qr.version} · créé le {dateFormat.format(table.qr.createdAt)} · {table.qr.scanCount} scan{table.qr.scanCount > 1 ? "s" : ""}
              </p>
            ) : null}
          </div>
        </div>
        {table.qr ? null : (
          <Alert role="status">
            <CircleAlert />
            <AlertDescription>Pas de QR actif : cette table ne peut pas être scannée.</AlertDescription>
          </Alert>
        )}
        {canManageQr ? (
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" asChild>
              <Link to="/app/floor/print" search={{ table: table._id }}>
                <Printer data-icon="inline-start" aria-hidden="true" />
                Réimprimer
              </Link>
            </Button>
            <Button variant="destructive" size="sm" onClick={() => setConfirm("rotate")}>
              Révoquer et régénérer
            </Button>
          </div>
        ) : null}
      </div>
    </div>
  );

  const dialogs = (
    <>
      <ConfirmAction
        open={confirm === "rotate"}
        onOpenChange={(o) => !o && setConfirm(null)}
        title={`Régénérer le QR de la table ${table.number} ?`}
        description="Les QR imprimés pour cette table ne fonctionneront plus. Faites-le si une photo du QR circule, puis imprimez le nouveau."
        confirmLabel="Révoquer et régénérer"
        onConfirm={async () => {
          await rotate({ venueId, tableId: table._id });
        }}
      />
      <ConfirmAction
        open={confirm === "remove"}
        onOpenChange={(o) => !o && setConfirm(null)}
        title={`Retirer la table ${table.number} ?`}
        description="Elle quitte le plan et son QR cesse de fonctionner. Son historique est conservé."
        confirmLabel="Retirer"
        onConfirm={async () => {
          await removeTable({ venueId, tableId: table._id });
          onRemoved();
        }}
      />
    </>
  );

  // Au téléphone, le détail de la table monte dans un panneau du bas ; sur grand écran, il
  // reste à côté du plan.
  if (mobile) {
    return (
      <Sheet open onOpenChange={(o) => !o && onClose()}>
        <SheetContent side="bottom" className="max-h-[90dvh] overflow-y-auto">
          <SheetHeader className="pr-12">
            <SheetTitle className="flex items-center gap-2">
              Table {table.number}
              {outOfService ? <Badge variant="outline">Hors service</Badge> : null}
            </SheetTitle>
            <SheetDescription>{summary}</SheetDescription>
          </SheetHeader>
          <div className="px-4 pb-6">{body}</div>
          {dialogs}
        </SheetContent>
      </Sheet>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Table {table.number}</CardTitle>
        <CardDescription>{summary}</CardDescription>
        {outOfService ? (
          <CardAction>
            <Badge variant="outline">Hors service</Badge>
          </CardAction>
        ) : null}
      </CardHeader>
      <CardContent>{body}</CardContent>
      {dialogs}
    </Card>
  );
}

function AreaPanel({ venueId, area, onAddAreas }: { venueId: Id<"venues">; area: Area; onAddAreas: (names: string[]) => Promise<void> }) {
  const updateArea = useMutation(api.floor.updateArea);
  const deleteArea = useMutation(api.floor.deleteArea);
  const [name, setName] = useState(area.name);
  const [newArea, setNewArea] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Zones</CardTitle>
        <CardDescription>Chaque zone a son plan et sa planche de QR.</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <FormField label="Nom de cette zone" error={error}>
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            onBlur={async () => {
              if (!name.trim() || name === area.name) return;
              setError(null);
              try {
                await updateArea({ venueId, serviceAreaId: area._id, name });
              } catch (e) {
                setError(describeError(e).message);
              }
            }}
            maxLength={80}
          />
        </FormField>
        <form
          noValidate
          className="flex items-end gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (!newArea.trim()) return;
            void onAddAreas([newArea]).then(() => setNewArea(""));
          }}
        >
          <FormField label="Nouvelle zone" className="min-w-0 flex-1">
            <Input value={newArea} onChange={(e) => setNewArea(e.target.value)} maxLength={80} placeholder="Terrasse" />
          </FormField>
          <Button type="submit" variant="outline" disabled={!newArea.trim()}>
            Créer
          </Button>
        </form>
        <Separator />
        <Button variant="ghost" size="sm" className="self-start text-destructive" onClick={() => setDeleting(true)}>
          Supprimer cette zone
        </Button>
      </CardContent>
      <ConfirmAction
        open={deleting}
        onOpenChange={setDeleting}
        title={`Supprimer la zone « ${area.name} » ?`}
        description={area.tables.length > 0 ? "Elle contient encore des tables : déplacez-les ou retirez-les d'abord." : "Elle disparaît du plan."}
        confirmLabel="Supprimer"
        onConfirm={async () => {
          await deleteArea({ venueId, serviceAreaId: area._id });
        }}
      />
    </Card>
  );
}

function AddTableDialog({ open, onOpenChange, venueId, areaId }: { open: boolean; onOpenChange: (open: boolean) => void; venueId: Id<"venues">; areaId: Id<"serviceAreas"> }) {
  const createTable = useMutation(api.floor.createTable);
  const createRange = useMutation(api.floor.createTableRange);
  const [mode, setMode] = useState<"one" | "range">("one");
  const [number, setNumber] = useState("");
  const [from, setFrom] = useState("1");
  const [to, setTo] = useState("10");
  const [prefix, setPrefix] = useState("");
  const [seats, setSeats] = useState("4");
  const [shape, setShape] = useState<Table["shape"]>("square");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const count = useMemo(() => Math.max(0, Number(to) - Number(from) + 1), [from, to]);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      if (mode === "one") await createTable({ venueId, serviceAreaId: areaId, number, seats: Number(seats), shape });
      else await createRange({ venueId, serviceAreaId: areaId, from: Number(from), to: Number(to), seats: Number(seats), shape, ...(prefix.trim() ? { prefix: prefix.trim() } : {}) });
      setNumber("");
      onOpenChange(false);
    } catch (e) {
      setError(describeError(e).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <ResponsiveDialog open={open} onOpenChange={(o) => !busy && onOpenChange(o)}>
      <ResponsiveDialogContent>
        <form onSubmit={submit} noValidate className="flex flex-col gap-4">
          <ResponsiveDialogHeader>
            <ResponsiveDialogTitle>Ajouter des tables</ResponsiveDialogTitle>
            <ResponsiveDialogDescription>Chaque table naît avec son QR, prêt à imprimer. Un numéro est unique dans l'établissement.</ResponsiveDialogDescription>
          </ResponsiveDialogHeader>
          <ToggleGroup
            type="single"
            variant="outline"
            aria-label="Combien de tables"
            value={mode}
            onValueChange={(value) => {
              if (value === "one" || value === "range") setMode(value);
            }}
          >
            <ToggleGroupItem value="one">Une table</ToggleGroupItem>
            <ToggleGroupItem value="range">Une rangée</ToggleGroupItem>
          </ToggleGroup>
          {mode === "one" ? (
            <FormField label="Numéro">
              <Input value={number} onChange={(e) => setNumber(e.target.value)} maxLength={12} autoFocus />
            </FormField>
          ) : (
            <div className="grid grid-cols-3 gap-3">
              <FormField label="Préfixe" optional>
                <Input value={prefix} onChange={(e) => setPrefix(e.target.value)} maxLength={4} placeholder="T" />
              </FormField>
              <FormField label="De">
                <Input type="number" inputMode="numeric" value={from} onChange={(e) => setFrom(e.target.value)} />
              </FormField>
              <FormField label="À">
                <Input type="number" inputMode="numeric" value={to} onChange={(e) => setTo(e.target.value)} />
              </FormField>
            </div>
          )}
          <div className="grid grid-cols-2 gap-3">
            <FormField label="Places">
              <Input type="number" inputMode="numeric" min={1} max={50} value={seats} onChange={(e) => setSeats(e.target.value)} />
            </FormField>
            <FormField label="Forme">
              <NativeSelect className="w-full" value={shape} onChange={(e) => setShape(e.target.value as Table["shape"])}>
                {Object.entries(SHAPES).map(([value, label]) => (
                  <NativeSelectOption key={value} value={value}>
                    {label}
                  </NativeSelectOption>
                ))}
              </NativeSelect>
            </FormField>
          </div>
          {error ? <ErrorAlert>{error}</ErrorAlert> : null}
          <ResponsiveDialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)} disabled={busy}>
              Annuler
            </Button>
            <PendingButton type="submit" pending={busy} pendingText="Création…" disabled={mode === "one" ? !number.trim() : count < 1}>
              {mode === "one" ? "Ajouter la table" : `Ajouter ${count} table${count > 1 ? "s" : ""}`}
            </PendingButton>
          </ResponsiveDialogFooter>
        </form>
      </ResponsiveDialogContent>
    </ResponsiveDialog>
  );
}
