import { useEffect, useMemo, useState, type FormEvent } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import { Trash2 } from "lucide-react";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import { serviceDayEnd } from "../../convex/lib/availability";
import { useWorkspace } from "~/components/app/workspace";
import { PageHeader } from "~/components/menu/shared";
import { Alert, AlertDescription } from "~/components/ui/alert";
import { Button } from "~/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { Checkbox } from "~/components/ui/checkbox";
import { Field } from "~/components/ui/field";
import { Input } from "~/components/ui/input";
import { NativeSelect } from "~/components/ui/native-select";
import { EmptyState, LoadingState, PermissionDeniedState } from "~/components/ui/states";
import { describeError } from "~/lib/errors";
import { cn } from "~/lib/utils";

export const Route = createFileRoute("/_auth/app/menu/availability")({
  head: () => ({ meta: [{ title: "Disponibilité — Joliba" }] }),
  component: AvailabilityPage,
});

type Board = FunctionReturnType<typeof api.availability.board>;
type Row = Board["products"][number];
type Until = "tonight" | "tomorrow" | "open";

const DAYS = ["Dim.", "Lun.", "Mar.", "Mer.", "Jeu.", "Ven.", "Sam."];

function useNow(intervalMs = 30_000) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), intervalMs);
    return () => window.clearInterval(id);
  }, [intervalMs]);
  return now;
}

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
 * L'écran de service (IA §4.11) : « ce qui est épuisé ce soir doit disparaître de la carte,
 * maintenant ». Une bascule POSE un état (elle n'inverse pas) : rejouée par le client Convex
 * au retour du réseau, elle ne fait rien de plus. D'où « en attente » sur la ligne, hors ligne,
 * au lieu d'un refus.
 */
function AvailabilityPage() {
  const w = useWorkspace();
  const venueId = w.venue?._id;
  const allowed = venueId !== undefined && w.canInVenue("menu.availability.toggle");
  const board = useQuery(api.availability.board, allowed ? { venueId } : "skip");
  if (!allowed) return <PermissionDeniedState venue={w.venue?.name} permission="Changer la disponibilité des plats" />;
  if (!board || !venueId) return <LoadingState />;
  return <AvailabilityBoard venueId={venueId} board={board} />;
}

function AvailabilityBoard({ venueId, board }: { venueId: Id<"venues">; board: Board }) {
  const setProduct = useMutation(api.availability.setProduct);
  const now = useNow();
  const online = useOnline();
  const [search, setSearch] = useState("");
  const [pending, setPending] = useState<Record<string, boolean>>({});
  const [confirmed, setConfirmed] = useState<Record<string, number>>({});
  const [choosing, setChoosing] = useState<Id<"products"> | null>(null);
  const [error, setError] = useState<string | null>(null);

  const isOff = (p: Row) => !p.isAvailable && (p.unavailableUntil === null || p.unavailableUntil > now);
  const off = board.products.filter(isOff);
  const needle = search.trim().toLowerCase();
  const shown = board.products.filter((p) => !needle || p.name.toLowerCase().includes(needle) || p.sectionName.toLowerCase().includes(needle));

  const timeFormat = useMemo(
    () => new Intl.DateTimeFormat("fr-FR", { timeZone: board.timezone, weekday: "long", hour: "2-digit", minute: "2-digit" }),
    [board.timezone],
  );

  async function set(product: Row, available: boolean, until?: Until) {
    setError(null);
    setChoosing(null);
    setPending((p) => ({ ...p, [product._id]: true }));
    try {
      const deadline =
        until === "tonight" ? serviceDayEnd(Date.now(), board.timezone) : until === "tomorrow" ? serviceDayEnd(Date.now(), board.timezone, 1) : undefined;
      await setProduct({ venueId, productId: product._id, isAvailable: available, ...(deadline !== undefined ? { until: deadline } : {}) });
      setConfirmed((c) => ({ ...c, [product._id]: Date.now() }));
    } catch (e) {
      setError(`${product.name} : ${describeError(e).message}`);
    } finally {
      setPending((p) => ({ ...p, [product._id]: false }));
    }
  }

  function renderRow(p: Row) {
    const unavailable = isOff(p);
    const waiting = pending[p._id] === true;
    return (
      <li key={p._id} className="px-4 py-3">
        <div className="flex items-center gap-3">
          <span className="min-w-0 flex-1">
            <span className={cn("block truncate text-body", unavailable ? "text-ink-3" : "text-ink")}>{p.name}</span>
            <span className="block truncate text-label text-ink-3">
              {waiting
                ? online
                  ? "Envoi…"
                  : "En attente de connexion — sera appliqué au retour du réseau"
                : unavailable
                  ? p.unavailableUntil
                    ? `Épuisé jusqu'à ${timeFormat.format(p.unavailableUntil)}`
                    : "Épuisé jusqu'à nouvel ordre"
                  : confirmed[p._id] && now - confirmed[p._id]! < 60_000
                    ? "Visible par les clients"
                    : p.sectionName}
            </span>
          </span>
          <button
            type="button"
            role="switch"
            aria-checked={!unavailable}
            aria-label={`${p.name} disponible`}
            disabled={waiting}
            onClick={() => (unavailable ? void set(p, true) : setChoosing(choosing === p._id ? null : p._id))}
            className={cn(
              "relative inline-flex h-8 w-14 shrink-0 items-center rounded-full border-2 transition-colors disabled:opacity-60",
              unavailable ? "border-line-control bg-surface-2" : "border-success-600 bg-success-600",
            )}
          >
            <span
              aria-hidden="true"
              className={cn("inline-block size-6 rounded-full bg-surface shadow-e1 transition-transform", unavailable ? "translate-x-0.5" : "translate-x-6")}
            />
          </button>
        </div>
        {choosing === p._id ? (
          <div role="group" aria-label={`Rendre ${p.name} indisponible`} className="mt-3 flex flex-wrap gap-2">
            <span className="w-full text-label text-ink-2">Épuisé jusqu'à quand ?</span>
            <Button size="sm" variant="secondary" onClick={() => void set(p, false, "tonight")}>
              Ce soir
            </Button>
            <Button size="sm" variant="secondary" onClick={() => void set(p, false, "tomorrow")}>
              Demain soir
            </Button>
            <Button size="sm" variant="secondary" onClick={() => void set(p, false, "open")}>
              Jusqu'à nouvel ordre
            </Button>
            <Button size="sm" variant="quiet" onClick={() => setChoosing(null)}>
              Annuler
            </Button>
          </div>
        ) : null}
      </li>
    );
  }

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-5">
      <PageHeader title="Disponibilité" description="Ce que vous coupez ici disparaît aussitôt de la carte des clients à table." />
      {!online ? (
        <Alert variant="warning">
          <AlertDescription>Hors ligne. Vos changements sont gardés et partiront au retour du réseau.</AlertDescription>
        </Alert>
      ) : null}
      {error ? (
        <Alert variant="danger">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}
      <div>
        <label className="sr-only" htmlFor="availability-search">
          Rechercher un plat
        </label>
        <Input id="availability-search" type="search" placeholder="Rechercher un plat" value={search} onChange={(e) => setSearch(e.target.value)} />
      </div>

      {off.length > 0 && !needle ? (
        <Card>
          <CardHeader>
            <CardTitle>Indisponibles ({off.length})</CardTitle>
          </CardHeader>
          <ul className="divide-y divide-line border-t border-line">{off.map(renderRow)}</ul>
        </Card>
      ) : null}

      {board.products.length === 0 ? (
        <EmptyState title="Aucun produit" description="La carte est vide." />
      ) : off.length === 0 && !needle ? (
        <p className="text-body text-success-700">Tous les produits sont disponibles.</p>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>{needle ? "Résultats" : "Tous les produits"}</CardTitle>
        </CardHeader>
        <ul className="divide-y divide-line border-t border-line">{shown.map(renderRow)}</ul>
      </Card>

      <Rules venueId={venueId} board={board} />
    </div>
  );
}

function minuteLabel(minute: number): string {
  return `${String(Math.floor(minute / 60) % 24).padStart(2, "0")} h ${String(minute % 60).padStart(2, "0")}`;
}

function Rules({ venueId, board }: { venueId: Id<"venues">; board: Board }) {
  const deleteRule = useMutation(api.availability.deleteRule);
  const createRule = useMutation(api.availability.createRule);
  const productNames = new Map(board.products.map((p) => [p._id as string, p.name]));
  const sectionNames = new Map(board.products.map((p) => [p.sectionId as string, p.sectionName]));
  const [target, setTarget] = useState(board.products[0]?._id ?? "");
  const [ruleType, setRuleType] = useState<"available" | "unavailable">("available");
  const [days, setDays] = useState<number[]>([0, 1, 2, 3, 4, 5, 6]);
  const [start, setStart] = useState("07:00");
  const [end, setEnd] = useState("11:00");
  const [error, setError] = useState<string | null>(null);

  const describe = (r: Board["rules"][number]) => {
    const what =
      r.targetType === "product"
        ? (productNames.get(r.targetId) ?? "Un produit")
        : r.targetType === "section"
          ? `Section ${sectionNames.get(r.targetId) ?? ""}`.trim()
          : "Une carte";
    const daysLabel = r.daysOfWeek.length === 7 ? "tous les jours" : r.daysOfWeek.map((d) => DAYS[d]).join(" ");
    const verb = r.ruleType === "available" ? "servi seulement" : "pas servi";
    return `${what} : ${verb} de ${minuteLabel(r.startMinute)} à ${minuteLabel(r.endMinute)}, ${daysLabel}`;
  };

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    const toMinute = (v: string) => {
      const [h, m] = v.split(":").map(Number);
      return (h ?? 0) * 60 + (m ?? 0);
    };
    try {
      await createRule({
        venueId,
        targetType: "product",
        targetId: target,
        ruleType,
        daysOfWeek: days,
        startMinute: toMinute(start),
        endMinute: toMinute(end) === 0 ? 1440 : toMinute(end),
      });
    } catch (e) {
      setError(describeError(e).message);
    }
  }

  if (board.rules.length === 0 && !board.canEditRules) return null;
  return (
    <Card>
      <CardHeader>
        <CardTitle>Plages horaires</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4 pb-5">
        {board.rules.length === 0 ? (
          <p className="text-body text-ink-2">Aucune plage : tout est servi à toute heure d'ouverture.</p>
        ) : (
          <ul className="divide-y divide-line">
            {board.rules.map((r) => (
              <li key={r._id} className="flex items-center justify-between gap-3 py-2 text-body text-ink">
                {describe(r)}
                {board.canEditRules ? (
                  <Button size="icon" variant="quiet" aria-label="Supprimer cette plage" onClick={() => void deleteRule({ venueId, ruleId: r._id })}>
                    <Trash2 aria-hidden="true" />
                  </Button>
                ) : null}
              </li>
            ))}
          </ul>
        )}
        {board.canEditRules && board.products.length > 0 ? (
          <form onSubmit={submit} noValidate className="flex flex-col gap-3 rounded-sm border border-line p-4">
            <p className="text-label text-ink">Nouvelle plage — un petit déjeuner, un plat du midi…</p>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Produit">
                <NativeSelect value={target} onChange={(e) => setTarget(e.target.value as Id<"products">)}>
                  {board.products.map((p) => (
                    <option key={p._id} value={p._id}>
                      {p.name}
                    </option>
                  ))}
                </NativeSelect>
              </Field>
              <Field label="Règle">
                <NativeSelect value={ruleType} onChange={(e) => setRuleType(e.target.value as "available" | "unavailable")}>
                  <option value="available">Servi seulement pendant la plage</option>
                  <option value="unavailable">Pas servi pendant la plage</option>
                </NativeSelect>
              </Field>
              <Field label="De">
                <Input type="time" value={start} onChange={(e) => setStart(e.target.value)} />
              </Field>
              <Field label="À" description="Une plage peut passer minuit : 22 h à 2 h.">
                <Input type="time" value={end} onChange={(e) => setEnd(e.target.value)} />
              </Field>
            </div>
            <fieldset>
              <legend className="mb-1 text-label text-ink">Jours</legend>
              <div className="flex flex-wrap gap-x-4">
                {DAYS.map((label, day) => (
                  <label key={day} className="flex min-h-11 items-center gap-2 text-body text-ink">
                    <Checkbox checked={days.includes(day)} onCheckedChange={(c) => setDays(c === true ? [...days, day] : days.filter((d) => d !== day))} />
                    {label}
                  </label>
                ))}
              </div>
            </fieldset>
            {error ? (
              <p role="alert" className="text-label text-danger-700">
                {error}
              </p>
            ) : null}
            <Button type="submit" variant="secondary" className="self-start">
              Ajouter la plage
            </Button>
          </form>
        ) : null}
      </CardContent>
    </Card>
  );
}
