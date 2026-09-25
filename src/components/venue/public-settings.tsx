import { useId, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { Check, CircleAlert, Copy, ExternalLink, X } from "lucide-react";
import { toast } from "sonner";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { indexabilityChecks } from "../../../convex/lib/indexability";
import { PendingButton } from "~/components/app/pending-button";
import { Alert, AlertDescription } from "~/components/ui/alert";
import { Badge } from "~/components/ui/badge";
import { Card, CardAction, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "~/components/ui/card";
import { Field, FieldContent, FieldLabel } from "~/components/ui/field";
import { Input } from "~/components/ui/input";
import { InputGroup, InputGroupAddon, InputGroupButton, InputGroupInput } from "~/components/ui/input-group";
import { Label } from "~/components/ui/label";
import { Separator } from "~/components/ui/separator";
import { Spinner } from "~/components/ui/spinner";
import { Switch } from "~/components/ui/switch";
import { describeError } from "~/lib/errors";

const DAYS = ["Dimanche", "Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi"];
const ORDER = [1, 2, 3, 4, 5, 6, 0];

type Hours = { dayOfWeek: number; opensAtMinute: number; closesAtMinute: number }[];

const toTime = (minute: number) => `${String(Math.floor(minute / 60) % 24).padStart(2, "0")}:${String(minute % 60).padStart(2, "0")}`;
const toMinute = (value: string) => {
  const [h, m] = value.split(":").map(Number);
  return (h ?? 0) * 60 + (m ?? 0);
};

/**
 * Horaires d'ouverture : une plage par jour, qui peut passer minuit (18 h – 2 h). Ils servent
 * à la carte publique (« Ouvert », données structurées) et à la porte de qualité.
 */
export function OpeningHoursCard({ venueId, hours }: { venueId: Id<"venues">; hours: Hours }) {
  const update = useMutation(api.venues.update);
  const idPrefix = useId();
  const initial = Object.fromEntries(
    ORDER.map((day) => {
      const h = hours.find((x) => x.dayOfWeek === day);
      return [day, h ? { open: true, from: toTime(h.opensAtMinute), to: toTime(h.closesAtMinute) } : { open: false, from: "11:00", to: "23:00" }];
    }),
  ) as Record<number, { open: boolean; from: string; to: string }>;
  const [days, setDays] = useState(initial);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function save() {
    setBusy(true);
    setError(null);
    try {
      const openingHours = ORDER.filter((d) => days[d]!.open).map((d) => {
        const closes = toMinute(days[d]!.to);
        return { dayOfWeek: d, opensAtMinute: toMinute(days[d]!.from), closesAtMinute: closes === 0 ? 1440 : closes };
      });
      await update({ venueId, openingHours });
      toast.success("Horaires enregistrés.");
    } catch (e) {
      setError(describeError(e).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Horaires d'ouverture</CardTitle>
        <CardDescription>Une fermeture après minuit se saisit telle quelle : de 18:00 à 02:00.</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col">
        {ORDER.map((day, index) => {
          const d = days[day]!;
          const set = (patch: Partial<typeof d>) => setDays({ ...days, [day]: { ...d, ...patch } });
          const switchId = `${idPrefix}-day-${day}`;
          return (
            <div key={day}>
              {index > 0 ? <Separator /> : null}
              <div className="flex min-h-12 flex-col gap-2 py-2.5 sm:flex-row sm:items-center sm:gap-4">
                <div className="flex items-center justify-between gap-3 sm:w-36">
                  <div className="flex items-center gap-3">
                    <Switch id={switchId} checked={d.open} onCheckedChange={(c) => set({ open: c })} />
                    <Label htmlFor={switchId}>{DAYS[day]}</Label>
                  </div>
                  {d.open ? null : <span className="text-sm text-muted-foreground sm:hidden">Fermé</span>}
                </div>
                {d.open ? (
                  <div className="flex items-center gap-2">
                    <Input
                      type="time"
                      aria-label={`${DAYS[day]}, ouverture`}
                      value={d.from}
                      onChange={(e) => set({ from: e.target.value })}
                      className="min-w-0 flex-1 tabular-nums sm:w-32 sm:flex-none"
                    />
                    <span aria-hidden="true" className="text-muted-foreground">
                      –
                    </span>
                    <Input
                      type="time"
                      aria-label={`${DAYS[day]}, fermeture`}
                      value={d.to}
                      onChange={(e) => set({ to: e.target.value })}
                      className="min-w-0 flex-1 tabular-nums sm:w-32 sm:flex-none"
                    />
                  </div>
                ) : (
                  <span className="hidden text-sm text-muted-foreground sm:inline">Fermé</span>
                )}
              </div>
            </div>
          );
        })}
        {error ? (
          <Alert variant="destructive" className="mt-3">
            <CircleAlert />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        ) : null}
      </CardContent>
      <CardFooter>
        <PendingButton variant="outline" onClick={() => void save()} pending={busy} pendingText="Enregistrement…">
          Enregistrer les horaires
        </PendingButton>
      </CardFooter>
    </Card>
  );
}

/**
 * La carte publique : un CONSENTEMENT, jamais un défaut. La liste dit ce qui manque pour que
 * la page soit proposée aux moteurs de recherche — une contrainte qui devient une liste de
 * choses à faire.
 */
export function PublicMenuCard({ venueId, enabled }: { venueId: Id<"venues">; enabled: boolean }) {
  const update = useMutation(api.venues.update);
  const readiness = useQuery(api.venues.publicMenuReadiness, { venueId });
  const switchId = useId();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [origin] = useState(() => (typeof window === "undefined" ? "" : window.location.origin));
  const checks = readiness ? indexabilityChecks(readiness.facts, Date.now()) : [];
  const indexable = checks.length > 0 && checks.every((c) => c.ok);
  const done = checks.filter((c) => c.ok).length;
  const url = readiness ? `${origin}/menu/${readiness.slug}` : "";

  async function toggle(next: boolean) {
    setBusy(true);
    setError(null);
    try {
      await update({ venueId, publicMenuEnabled: next });
    } catch (e) {
      setError(describeError(e).message);
    } finally {
      setBusy(false);
    }
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
      toast.success("Adresse copiée.");
    } catch {
      toast.error("Copie impossible : sélectionnez l'adresse à la main.");
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Carte publique</CardTitle>
        <CardDescription>
          Une page ouverte à tous, sans QR, que vous pouvez partager et que les moteurs de recherche peuvent trouver. Elle
          montre la carte publiée et vos coordonnées, rien d'autre.
        </CardDescription>
        <CardAction>
          <Badge variant={enabled ? "default" : "outline"}>{enabled ? "En ligne" : "Désactivée"}</Badge>
        </CardAction>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <Field orientation="horizontal" data-disabled={busy || undefined}>
          <FieldContent>
            <FieldLabel htmlFor={switchId}>Carte publique en ligne</FieldLabel>
          </FieldContent>
          {busy ? <Spinner aria-label="Un instant…" /> : null}
          <Switch id={switchId} checked={enabled} disabled={busy} onCheckedChange={(next) => void toggle(next)} />
        </Field>
        {enabled && readiness ? (
          <InputGroup>
            <InputGroupInput readOnly value={url} aria-label="Adresse de la carte publique" onFocus={(e) => e.currentTarget.select()} />
            <InputGroupAddon align="inline-end">
              <InputGroupButton size="icon-xs" aria-label="Copier l'adresse" onClick={() => void copy()}>
                <Copy aria-hidden="true" />
              </InputGroupButton>
              <InputGroupButton size="icon-xs" asChild>
                <a href={url} target="_blank" rel="noreferrer" aria-label="Ouvrir la carte publique">
                  <ExternalLink aria-hidden="true" />
                </a>
              </InputGroupButton>
            </InputGroupAddon>
          </InputGroup>
        ) : null}
        {error ? (
          <Alert variant="destructive">
            <CircleAlert />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        ) : null}
        {readiness ? (
          <div className="flex flex-col gap-3 rounded-lg bg-muted/50 p-3">
            <div className="flex items-center justify-between gap-3">
              <p className="text-sm font-medium">
                {indexable ? "Proposée aux moteurs de recherche." : "Pour être proposée aux moteurs de recherche :"}
              </p>
              <Badge variant="secondary" className="tabular-nums">
                {done}/{checks.length}
              </Badge>
            </div>
            <ul className="flex flex-col gap-2">
              {checks.map((c) => (
                <li key={c.key} className="flex items-start gap-2 text-sm">
                  {c.ok ? (
                    <Check aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-primary" />
                  ) : (
                    <X aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                  )}
                  <span className={c.ok ? "text-foreground" : "text-muted-foreground"}>
                    <span className="sr-only">{c.ok ? "Fait : " : "À faire : "}</span>
                    {c.label}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
