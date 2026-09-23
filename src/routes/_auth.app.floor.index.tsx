import { useEffect, useMemo, useRef, useState, type FormEvent, type KeyboardEvent, type PointerEvent } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import { Plus, Printer, RotateCw } from "lucide-react";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import { useWorkspace } from "~/components/app/workspace";
import { ConfirmDialog, PageHeader } from "~/components/menu/shared";
import { Alert, AlertDescription } from "~/components/ui/alert";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "~/components/ui/dialog";
import { Field } from "~/components/ui/field";
import { Input } from "~/components/ui/input";
import { NativeSelect } from "~/components/ui/native-select";
import { EmptyState, LoadingState, PermissionDeniedState } from "~/components/ui/states";
import { describeError } from "~/lib/errors";
import { cn } from "~/lib/cn";

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
      <>
        <PageHeader title="Plan de salle" />
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
              <Button variant="secondary" onClick={() => void addAreas(AREA_TEMPLATES)} disabled={!online}>
                Salle, Terrasse et VIP
              </Button>
            ) : undefined
          }
        />
        {error ? (
          <p role="alert" className="mt-4 text-center text-label text-danger-700">
            {error}
          </p>
        ) : null}
      </>
    );
  }

  return (
    <>
      <PageHeader
        title="Plan de salle"
        description={overview.canManage ? undefined : "Seul un responsable peut modifier le plan."}
        actions={
          <>
            {overview.areas.length > 1 ? (
              <NativeSelect aria-label="Zone" value={area._id} onChange={(e) => setAreaId(e.target.value)} className="w-auto">
                {overview.areas.map((a) => (
                  <option key={a._id} value={a._id}>
                    {a.name}
                  </option>
                ))}
              </NativeSelect>
            ) : null}
            {overview.canManageQr ? (
              <Button variant="secondary" asChild>
                <Link to="/app/floor/print" search={{ zone: area._id }}>
                  <Printer aria-hidden="true" />
                  Imprimer les QR
                </Link>
              </Button>
            ) : null}
          </>
        }
      />
      {!online && overview.canManage ? (
        <Alert variant="warning" className="mb-4">
          <AlertDescription>Hors ligne : le plan est en lecture seule jusqu'au retour du réseau.</AlertDescription>
        </Alert>
      ) : null}
      {error ? (
        <p role="alert" className="mb-4 text-label text-danger-700">
          {error}
        </p>
      ) : null}
      <AreaEditor key={area._id} venueId={venueId} area={area} areas={overview.areas} canManage={canManage} canManageQr={overview.canManageQr && online} onAddAreas={addAreas} />
    </>
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
    <div className="grid gap-6 lg:grid-cols-[1fr_20rem]">
      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center gap-2">
          {canManage ? (
            <Button onClick={() => setAdding(true)}>
              <Plus aria-hidden="true" />
              Ajouter une table
            </Button>
          ) : null}
          <span role="status" className="text-label text-ink-3">
            {savedAt ? `Enregistré à ${timeFormat.format(savedAt)}` : ""}
          </span>
        </div>
        {error ? (
          <p role="alert" className="text-label text-danger-700">
            {error}
          </p>
        ) : null}
        {area.tables.length === 0 ? (
          <EmptyState title="Aucune table ici" description="Ajoutez les tables de cette zone : une par une, ou une rangée d'un coup." />
        ) : (
          <>
            <Canvas area={area} box={box} selectedId={selectedId} canManage={canManage} onSelect={setSelectedId} onMove={move} />
            <ul className="divide-y divide-line rounded-md border border-line bg-surface md:hidden">
              {area.tables.map((t) => (
                <li key={t._id}>
                  <button type="button" onClick={() => setSelectedId(t._id)} className="flex min-h-12 w-full items-center justify-between px-4 text-left">
                    <span className="text-body text-ink">
                      Table {t.number}
                      {t.label ? ` · ${t.label}` : ""}
                    </span>
                    <span className="text-label text-ink-3">{t.seats} places</span>
                  </button>
                </li>
              ))}
            </ul>
          </>
        )}
      </div>
      <div className="flex flex-col gap-4">
        {selected ? (
          <TablePanel key={selected._id} venueId={venueId} table={selected} box={box(selected)} areas={areas} canManage={canManage} canManageQr={canManageQr} onMove={(b) => move(selected, b, 600)} onRemoved={() => setSelectedId(null)} />
        ) : (
          <p className="text-body text-ink-2">Choisissez une table pour voir son QR{canManage ? ", la renommer ou la déplacer" : ""}.</p>
        )}
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

  return (
    <div className="hidden overflow-auto rounded-md border border-line bg-surface md:block">
      <svg
        ref={svgRef}
        viewBox={`0 0 ${area.canvasWidth} ${area.canvasHeight}`}
        className="block w-full touch-none select-none"
        role="group"
        aria-label={`Plan de la zone ${area.name}${canManage ? ". Flèches pour déplacer une table, Maj + flèches pour un pixel." : ""}`}
      >
        <defs>
          <pattern id="floor-grid" width={GRID} height={GRID} patternUnits="userSpaceOnUse">
            <path d={`M ${GRID} 0 L 0 0 0 ${GRID}`} fill="none" stroke="var(--color-line)" strokeWidth={0.5} />
          </pattern>
        </defs>
        <rect width={area.canvasWidth} height={area.canvasHeight} fill="url(#floor-grid)" />
        {area.tables.map((t) => {
          const b = box(t);
          const active = t._id === selectedId;
          const out = t.status === "out_of_service";
          const cx = b.x + b.width / 2;
          const cy = b.y + b.height / 2;
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
              className={cn("outline-none focus-visible:[&>*:first-child]:stroke-accent-600", canManage ? "cursor-grab active:cursor-grabbing" : "cursor-pointer")}
            >
              {t.shape === "round" ? (
                <ellipse cx={cx} cy={cy} rx={b.width / 2} ry={b.height / 2} fill={out ? "var(--color-surface-2)" : "var(--color-surface)"} stroke={active ? "var(--color-accent-600)" : "var(--color-line-control)"} strokeWidth={active ? 3 : 1.5} strokeDasharray={out ? "6 4" : undefined} />
              ) : (
                <rect x={b.x} y={b.y} width={b.width} height={b.height} rx={6} fill={out ? "var(--color-surface-2)" : "var(--color-surface)"} stroke={active ? "var(--color-accent-600)" : "var(--color-line-control)"} strokeWidth={active ? 3 : 1.5} strokeDasharray={out ? "6 4" : undefined} />
              )}
              <text x={cx} y={cy} textAnchor="middle" dominantBaseline="central" fontSize={22} fontWeight={600} fill="var(--color-ink)">
                {t.number}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

function TablePanel({
  venueId,
  table,
  box,
  areas,
  canManage,
  canManageQr,
  onMove,
  onRemoved,
}: {
  venueId: Id<"venues">;
  table: Table;
  box: Box;
  areas: Area[];
  canManage: boolean;
  canManageQr: boolean;
  onMove: (b: Box) => void;
  onRemoved: () => void;
}) {
  const updateTable = useMutation(api.floor.updateTable);
  const removeTable = useMutation(api.floor.removeTable);
  const rotate = useMutation(api.qr.rotate);
  const [form, setForm] = useState({ number: table.number, label: table.label ?? "", seats: String(table.seats) });
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [confirm, setConfirm] = useState<"rotate" | "remove" | null>(null);

  async function run(action: () => Promise<unknown>) {
    setError(null);
    setSaved(false);
    try {
      await action();
      setSaved(true);
    } catch (e) {
      setError(describeError(e).message);
    }
  }

  function submit(event: FormEvent) {
    event.preventDefault();
    void run(() => updateTable({ venueId, tableId: table._id, number: form.number, label: form.label.trim() ? form.label : null, seats: Number(form.seats) }));
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-2">
        <CardTitle>Table {table.number}</CardTitle>
        {table.status === "out_of_service" ? <Badge>Hors service</Badge> : null}
      </CardHeader>
      <CardContent className="flex flex-col gap-4 pb-5">
        {canManage ? (
          <form onSubmit={submit} noValidate className="flex flex-col gap-3">
            <div className="grid grid-cols-2 gap-3">
              <Field label="Numéro" error={error}>
                <Input value={form.number} onChange={(e) => setForm({ ...form, number: e.target.value })} maxLength={12} />
              </Field>
              <Field label="Places">
                <Input type="number" inputMode="numeric" min={1} max={50} value={form.seats} onChange={(e) => setForm({ ...form, seats: e.target.value })} />
              </Field>
            </div>
            <Field label="Libellé" optional description="« Près de la fenêtre », « Banquette »…">
              <Input value={form.label} onChange={(e) => setForm({ ...form, label: e.target.value })} maxLength={80} />
            </Field>
            <Button type="submit" variant="secondary" className="self-start">
              Enregistrer
            </Button>
            {saved ? (
              <span role="status" className="text-label text-success-700">
                Enregistré.
              </span>
            ) : null}
            <div className="grid grid-cols-2 gap-3">
              <Field label="Forme">
                <NativeSelect value={table.shape} onChange={(e) => void run(() => updateTable({ venueId, tableId: table._id, shape: e.target.value as Table["shape"] }))}>
                  {Object.entries(SHAPES).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </NativeSelect>
              </Field>
              <Field label="Zone">
                <NativeSelect value={areas.find((a) => a.tables.some((t) => t._id === table._id))?._id} onChange={(e) => void run(() => updateTable({ venueId, tableId: table._id, serviceAreaId: e.target.value as Id<"serviceAreas"> }))}>
                  {areas.map((a) => (
                    <option key={a._id} value={a._id}>
                      {a.name}
                    </option>
                  ))}
                </NativeSelect>
              </Field>
              <Field label="Largeur">
                <Input type="number" inputMode="numeric" min={40} max={400} step={GRID} value={box.width} onChange={(e) => onMove({ ...box, width: Math.max(40, Math.min(400, Number(e.target.value) || 40)) })} />
              </Field>
              <Field label="Hauteur">
                <Input type="number" inputMode="numeric" min={40} max={400} step={GRID} value={box.height} onChange={(e) => onMove({ ...box, height: Math.max(40, Math.min(400, Number(e.target.value) || 40)) })} />
              </Field>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button type="button" variant="secondary" size="sm" onClick={() => onMove({ ...box, rotation: (box.rotation + 45) % 360 })}>
                <RotateCw aria-hidden="true" />
                Tourner
              </Button>
              <Button type="button" variant="secondary" size="sm" onClick={() => void run(() => updateTable({ venueId, tableId: table._id, inService: table.status === "out_of_service" }))}>
                {table.status === "out_of_service" ? "Remettre en service" : "Mettre hors service"}
              </Button>
              <Button type="button" variant="danger" size="sm" onClick={() => setConfirm("remove")}>
                Retirer la table
              </Button>
            </div>
          </form>
        ) : (
          <p className="text-body text-ink-2">
            {table.seats} places{table.label ? ` · ${table.label}` : ""}
          </p>
        )}

        <div className="border-t border-line pt-4">
          <p className="text-label text-ink">QR de la table</p>
          {table.qr ? (
            <p className="text-label text-ink-2">
              Version {table.qr.version} · créé le {dateFormat.format(table.qr.createdAt)} · {table.qr.scanCount} scan{table.qr.scanCount > 1 ? "s" : ""}
            </p>
          ) : (
            <p className="text-label text-warning-700">Pas de QR actif : cette table ne peut pas être scannée.</p>
          )}
          {canManageQr ? (
            <div className="mt-2 flex flex-wrap gap-2">
              <Button variant="secondary" size="sm" asChild>
                <Link to="/app/floor/print" search={{ table: table._id }}>
                  <Printer aria-hidden="true" />
                  Réimprimer
                </Link>
              </Button>
              <Button variant="danger" size="sm" onClick={() => setConfirm("rotate")}>
                Révoquer et régénérer
              </Button>
            </div>
          ) : null}
        </div>
      </CardContent>
      <ConfirmDialog
        open={confirm === "rotate"}
        onOpenChange={(o) => !o && setConfirm(null)}
        danger
        title={`Régénérer le QR de la table ${table.number} ?`}
        description="Les QR imprimés pour cette table ne fonctionneront plus. Faites-le si une photo du QR circule, puis imprimez le nouveau."
        confirmLabel="Révoquer et régénérer"
        onConfirm={async () => {
          await rotate({ venueId, tableId: table._id });
        }}
      />
      <ConfirmDialog
        open={confirm === "remove"}
        onOpenChange={(o) => !o && setConfirm(null)}
        danger
        title={`Retirer la table ${table.number} ?`}
        description="Elle quitte le plan et son QR cesse de fonctionner. Son historique est conservé."
        confirmLabel="Retirer"
        onConfirm={async () => {
          await removeTable({ venueId, tableId: table._id });
          onRemoved();
        }}
      />
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
      </CardHeader>
      <CardContent className="flex flex-col gap-3 pb-5">
        <Field label="Nom de cette zone" error={error}>
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
        </Field>
        <form
          noValidate
          className="flex items-end gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (!newArea.trim()) return;
            void onAddAreas([newArea]).then(() => setNewArea(""));
          }}
        >
          <Field label="Nouvelle zone">
            <Input value={newArea} onChange={(e) => setNewArea(e.target.value)} maxLength={80} placeholder="Terrasse" />
          </Field>
          <Button type="submit" variant="secondary" disabled={!newArea.trim()}>
            Créer
          </Button>
        </form>
        <Button variant="quiet" size="sm" className="self-start" onClick={() => setDeleting(true)}>
          Supprimer cette zone
        </Button>
      </CardContent>
      <ConfirmDialog
        open={deleting}
        onOpenChange={setDeleting}
        danger
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
    <Dialog open={open} onOpenChange={(o) => !busy && onOpenChange(o)}>
      <DialogContent>
        <form onSubmit={submit} noValidate>
          <DialogHeader>
            <DialogTitle>Ajouter des tables</DialogTitle>
            <DialogDescription>Chaque table naît avec son QR, prêt à imprimer. Un numéro est unique dans l'établissement.</DialogDescription>
          </DialogHeader>
          <div className="mt-4 flex flex-col gap-4">
            <div role="radiogroup" aria-label="Combien de tables" className="flex gap-2">
              {(
                [
                  ["one", "Une table"],
                  ["range", "Une rangée"],
                ] as const
              ).map(([value, label]) => (
                <Button key={value} type="button" role="radio" aria-checked={mode === value} variant={mode === value ? "primary" : "secondary"} size="sm" onClick={() => setMode(value)}>
                  {label}
                </Button>
              ))}
            </div>
            {mode === "one" ? (
              <Field label="Numéro">
                <Input value={number} onChange={(e) => setNumber(e.target.value)} maxLength={12} autoFocus />
              </Field>
            ) : (
              <div className="grid grid-cols-3 gap-3">
                <Field label="Préfixe" optional>
                  <Input value={prefix} onChange={(e) => setPrefix(e.target.value)} maxLength={4} placeholder="T" />
                </Field>
                <Field label="De">
                  <Input type="number" inputMode="numeric" value={from} onChange={(e) => setFrom(e.target.value)} />
                </Field>
                <Field label="À">
                  <Input type="number" inputMode="numeric" value={to} onChange={(e) => setTo(e.target.value)} />
                </Field>
              </div>
            )}
            <div className="grid grid-cols-2 gap-3">
              <Field label="Places">
                <Input type="number" inputMode="numeric" min={1} max={50} value={seats} onChange={(e) => setSeats(e.target.value)} />
              </Field>
              <Field label="Forme">
                <NativeSelect value={shape} onChange={(e) => setShape(e.target.value as Table["shape"])}>
                  {Object.entries(SHAPES).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </NativeSelect>
              </Field>
            </div>
            {error ? (
              <p role="alert" className="text-label text-danger-700">
                {error}
              </p>
            ) : null}
          </div>
          <DialogFooter>
            <Button type="button" variant="quiet" onClick={() => onOpenChange(false)} disabled={busy}>
              Annuler
            </Button>
            <Button type="submit" loading={busy} loadingText="Création…" disabled={mode === "one" ? !number.trim() : count < 1}>
              {mode === "one" ? "Ajouter la table" : `Ajouter ${count} table${count > 1 ? "s" : ""}`}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
