import { useEffect, useMemo, useState, type FormEvent } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import { CalendarClock, CircleAlert, CircleCheck, Clock, Moon, Search, Sunrise, Trash2, Infinity as Forever, WifiOff } from "lucide-react";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import { serviceDayEnd } from "../../convex/lib/availability";
import { FormField } from "~/components/app/form-field";
import {
  ResponsiveDialog,
  ResponsiveDialogClose,
  ResponsiveDialogContent,
  ResponsiveDialogDescription,
  ResponsiveDialogFooter,
  ResponsiveDialogHeader,
  ResponsiveDialogTitle,
} from "~/components/app/responsive-dialog";
import { EmptyState, LoadingState, PermissionDeniedState } from "~/components/app/states";
import { useWorkspace } from "~/components/app/workspace";
import { PageHeader } from "~/components/menu/shared";
import { Alert, AlertDescription, AlertTitle } from "~/components/ui/alert";
import { Button } from "~/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "~/components/ui/card";
import { FieldLegend, FieldSet } from "~/components/ui/field";
import { Input } from "~/components/ui/input";
import { InputGroup, InputGroupAddon, InputGroupInput } from "~/components/ui/input-group";
import { Item, ItemActions, ItemContent, ItemDescription, ItemGroup, ItemMedia, ItemTitle } from "~/components/ui/item";
import { Label } from "~/components/ui/label";
import { NativeSelect, NativeSelectOption } from "~/components/ui/native-select";
import { Switch } from "~/components/ui/switch";
import { ToggleGroup, ToggleGroupItem } from "~/components/ui/toggle-group";
import { describeError } from "~/lib/errors";

export const Route = createFileRoute("/_auth/app/menu/availability")({
  head: () => ({ meta: [{ title: "Disponibilité — Joliba" }] }),
  component: AvailabilityPage,
});

type Board = FunctionReturnType<typeof api.availability.board>;
type Row = Board["products"][number];
type Until = "tonight" | "tomorrow" | "open";

const DAYS = ["Dim.", "Lun.", "Mar.", "Mer.", "Jeu.", "Ven.", "Sam."];
const DAY_NAMES = ["dimanche", "lundi", "mardi", "mercredi", "jeudi", "vendredi", "samedi"];

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
  const shown = board.products.filter(
    (p) => !needle || p.name.toLowerCase().includes(needle) || p.sectionName.toLowerCase().includes(needle),
  );
  const choice = choosing ? (board.products.find((p) => p._id === choosing) ?? null) : null;

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
        until === "tonight"
          ? serviceDayEnd(Date.now(), board.timezone)
          : until === "tomorrow"
            ? serviceDayEnd(Date.now(), board.timezone, 1)
            : undefined;
      await setProduct({ venueId, productId: product._id, isAvailable: available, ...(deadline !== undefined ? { until: deadline } : {}) });
      setConfirmed((c) => ({ ...c, [product._id]: Date.now() }));
    } catch (e) {
      setError(`${product.name} : ${describeError(e).message}`);
    } finally {
      setPending((p) => ({ ...p, [product._id]: false }));
    }
  }

  function renderRow(p: Row, list: string) {
    const unavailable = isOff(p);
    const waiting = pending[p._id] === true;
    const switchId = `${list}-${p._id}`;
    const status = waiting
      ? online
        ? "Envoi…"
        : "En attente de connexion — sera appliqué au retour du réseau"
      : unavailable
        ? p.unavailableUntil
          ? `Épuisé jusqu'à ${timeFormat.format(p.unavailableUntil)}`
          : "Épuisé jusqu'à nouvel ordre"
        : confirmed[p._id] && now - confirmed[p._id]! < 60_000
          ? "Visible par les clients"
          : p.sectionName;
    return (
      <div role="listitem" key={p._id}>
        {/* Toute la ligne est une cible au pouce : le libellé porte l'interrupteur. */}
        <Item asChild size="sm" className="cursor-pointer rounded-none px-4 hover:bg-muted/50 has-disabled:cursor-default">
          <label htmlFor={switchId}>
            <ItemContent className="min-w-0">
              <ItemTitle className={unavailable ? "w-full truncate text-muted-foreground line-through" : "w-full truncate"}>
                {p.name}
              </ItemTitle>
              <ItemDescription className={unavailable && !waiting ? "truncate text-destructive" : "truncate"}>{status}</ItemDescription>
            </ItemContent>
            <ItemActions>
              <Switch
                id={switchId}
                aria-label={`${p.name} disponible`}
                checked={!unavailable}
                disabled={waiting}
                onCheckedChange={() => (unavailable ? void set(p, true) : setChoosing(choosing === p._id ? null : p._id))}
              />
            </ItemActions>
          </label>
        </Item>
      </div>
    );
  }

  const options: { until: Until; label: string; hint: string; icon: typeof Moon }[] = [
    { until: "tonight", label: "Ce soir", hint: `jusqu'à ${timeFormat.format(serviceDayEnd(now, board.timezone))}`, icon: Moon },
    { until: "tomorrow", label: "Demain soir", hint: `jusqu'à ${timeFormat.format(serviceDayEnd(now, board.timezone, 1))}`, icon: Sunrise },
    { until: "open", label: "Jusqu'à nouvel ordre", hint: "vous le remettrez vous-même", icon: Forever },
  ];

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-4">
      <PageHeader title="Disponibilité" description="Ce que vous coupez ici disparaît aussitôt de la carte des clients à table." />
      {!online ? (
        <Alert role="status">
          <WifiOff />
          <AlertTitle>Hors ligne</AlertTitle>
          <AlertDescription>Vos changements sont gardés et partiront au retour du réseau.</AlertDescription>
        </Alert>
      ) : null}
      {error ? (
        <Alert variant="destructive">
          <CircleAlert />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}
      <div>
        <Label className="sr-only" htmlFor="availability-search">
          Rechercher un plat
        </Label>
        <InputGroup className="h-10">
          <InputGroupAddon>
            <Search />
          </InputGroupAddon>
          <InputGroupInput
            id="availability-search"
            type="search"
            placeholder="Rechercher un plat"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </InputGroup>
      </div>

      {off.length > 0 && !needle ? (
        <Card className="gap-0 pb-0">
          <CardHeader className="border-b">
            <CardTitle>
              <h2>Indisponibles ({off.length})</h2>
            </CardTitle>
            <CardDescription>Absents de la carte des clients.</CardDescription>
          </CardHeader>
          <ItemGroup className="gap-0 divide-y">{off.map((p) => renderRow(p, "off"))}</ItemGroup>
        </Card>
      ) : null}

      {board.products.length === 0 ? (
        <EmptyState className="border" title="Aucun produit" description="La carte est vide." />
      ) : off.length === 0 && !needle ? (
        <Alert role="status">
          <CircleCheck />
          <AlertTitle>Tous les produits sont disponibles.</AlertTitle>
        </Alert>
      ) : null}

      {board.products.length > 0 ? (
        <Card className="gap-0 pb-0">
          <CardHeader className="border-b">
            <CardTitle>
              <h2>{needle ? "Résultats" : "Tous les produits"}</h2>
            </CardTitle>
            <CardDescription>
              {shown.length} produit{shown.length > 1 ? "s" : ""}
            </CardDescription>
          </CardHeader>
          {shown.length > 0 ? (
            <ItemGroup className="gap-0 divide-y">{shown.map((p) => renderRow(p, "all"))}</ItemGroup>
          ) : (
            <p className="px-4 py-6 text-center text-sm text-muted-foreground">Aucun plat ne correspond à « {search.trim()} ».</p>
          )}
        </Card>
      ) : null}

      <Rules venueId={venueId} board={board} />

      {/* Sur téléphone, un tiroir qui monte du bas : trois gros choix sous le pouce. */}
      <ResponsiveDialog open={choice !== null} onOpenChange={(open) => !open && setChoosing(null)}>
        <ResponsiveDialogContent>
          <ResponsiveDialogHeader>
            <ResponsiveDialogTitle>Épuisé jusqu'à quand ?</ResponsiveDialogTitle>
            <ResponsiveDialogDescription>
              {choice ? `${choice.name} disparaît aussitôt de la carte des clients.` : null}
            </ResponsiveDialogDescription>
          </ResponsiveDialogHeader>
          {choice ? (
            <div role="group" aria-label={`Rendre ${choice.name} indisponible`} className="flex flex-col gap-2">
              {options.map((o) => (
                <Button
                  key={o.until}
                  variant="outline"
                  size="lg"
                  className="h-auto justify-start gap-3 py-2.5 text-left"
                  onClick={() => void set(choice, false, o.until)}
                >
                  <o.icon data-icon="inline-start" />
                  <span className="flex min-w-0 flex-col">
                    <span>{o.label}</span>
                    <span className="truncate text-xs font-normal text-muted-foreground">{o.hint}</span>
                  </span>
                </Button>
              ))}
            </div>
          ) : null}
          <ResponsiveDialogFooter>
            <ResponsiveDialogClose asChild>
              <Button variant="ghost">Annuler</Button>
            </ResponsiveDialogClose>
          </ResponsiveDialogFooter>
        </ResponsiveDialogContent>
      </ResponsiveDialog>
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
        <CardTitle>
          <h2>Plages horaires</h2>
        </CardTitle>
        <CardDescription>Un petit déjeuner, un plat du midi : servis seulement à certaines heures.</CardDescription>
      </CardHeader>
      <CardContent>
        {board.rules.length === 0 ? (
          <p className="text-sm text-muted-foreground">Aucune plage : tout est servi à toute heure d'ouverture.</p>
        ) : (
          <ItemGroup className="gap-2">
            {board.rules.map((r) => (
              <Item key={r._id} role="listitem" variant="outline" size="sm">
                <ItemMedia variant="icon">
                  <Clock aria-hidden="true" />
                </ItemMedia>
                <ItemContent className="min-w-0">
                  <ItemTitle className="line-clamp-none w-full">{describe(r)}</ItemTitle>
                </ItemContent>
                {board.canEditRules ? (
                  <ItemActions>
                    <Button
                      size="icon-sm"
                      variant="ghost"
                      aria-label="Supprimer cette plage"
                      onClick={() => void deleteRule({ venueId, ruleId: r._id })}
                    >
                      <Trash2 aria-hidden="true" />
                    </Button>
                  </ItemActions>
                ) : null}
              </Item>
            ))}
          </ItemGroup>
        )}
      </CardContent>
      {board.canEditRules && board.products.length > 0 ? (
        <CardFooter>
          <form onSubmit={submit} noValidate className="flex w-full flex-col gap-4">
            <p className="flex items-center gap-2 text-sm font-medium">
              <CalendarClock aria-hidden="true" className="size-4 text-muted-foreground" />
              Nouvelle plage — un petit déjeuner, un plat du midi…
            </p>
            <div className="grid gap-4 sm:grid-cols-2">
              <FormField label="Produit">
                <NativeSelect className="w-full" value={target} onChange={(e) => setTarget(e.target.value as Id<"products">)}>
                  {board.products.map((p) => (
                    <NativeSelectOption key={p._id} value={p._id}>
                      {p.name}
                    </NativeSelectOption>
                  ))}
                </NativeSelect>
              </FormField>
              <FormField label="Règle">
                <NativeSelect
                  className="w-full"
                  value={ruleType}
                  onChange={(e) => setRuleType(e.target.value as "available" | "unavailable")}
                >
                  <NativeSelectOption value="available">Servi seulement pendant la plage</NativeSelectOption>
                  <NativeSelectOption value="unavailable">Pas servi pendant la plage</NativeSelectOption>
                </NativeSelect>
              </FormField>
              <FormField label="De">
                <Input type="time" value={start} onChange={(e) => setStart(e.target.value)} />
              </FormField>
              <FormField label="À" description="Une plage peut passer minuit : 22 h à 2 h.">
                <Input type="time" value={end} onChange={(e) => setEnd(e.target.value)} />
              </FormField>
            </div>
            <FieldSet>
              <FieldLegend variant="label">Jours</FieldLegend>
              <ToggleGroup
                type="multiple"
                variant="outline"
                spacing={1}
                className="flex-wrap"
                value={days.map(String)}
                onValueChange={(values) => setDays(values.map(Number).sort((a, b) => a - b))}
              >
                {DAYS.map((label, day) => (
                  <ToggleGroupItem key={day} value={String(day)} aria-label={DAY_NAMES[day]} className="min-w-11">
                    {label}
                  </ToggleGroupItem>
                ))}
              </ToggleGroup>
            </FieldSet>
            {error ? (
              <Alert variant="destructive">
                <CircleAlert />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            ) : null}
            <div>
              <Button type="submit" variant="outline">
                Ajouter la plage
              </Button>
            </div>
          </form>
        </CardFooter>
      ) : null}
    </Card>
  );
}
