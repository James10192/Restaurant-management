import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { Check, X } from "lucide-react";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { indexabilityChecks } from "../../../convex/lib/indexability";
import { Button } from "~/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "~/components/ui/card";
import { Checkbox } from "~/components/ui/checkbox";
import { Input } from "~/components/ui/input";
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
  const initial = Object.fromEntries(
    ORDER.map((day) => {
      const h = hours.find((x) => x.dayOfWeek === day);
      return [day, h ? { open: true, from: toTime(h.opensAtMinute), to: toTime(h.closesAtMinute) } : { open: false, from: "11:00", to: "23:00" }];
    }),
  ) as Record<number, { open: boolean; from: string; to: string }>;
  const [days, setDays] = useState(initial);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  async function save() {
    setBusy(true);
    setMessage(null);
    try {
      const openingHours = ORDER.filter((d) => days[d]!.open).map((d) => {
        const closes = toMinute(days[d]!.to);
        return { dayOfWeek: d, opensAtMinute: toMinute(days[d]!.from), closesAtMinute: closes === 0 ? 1440 : closes };
      });
      await update({ venueId, openingHours });
      setMessage({ ok: true, text: "Horaires enregistrés." });
    } catch (e) {
      setMessage({ ok: false, text: describeError(e).message });
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
      <CardContent className="flex flex-col gap-2 pb-5">
        {ORDER.map((day) => {
          const d = days[day]!;
          const set = (patch: Partial<typeof d>) => setDays({ ...days, [day]: { ...d, ...patch } });
          return (
            <div key={day} className="grid grid-cols-[8rem_1fr] items-center gap-3 sm:grid-cols-[8rem_auto_1fr]">
              <label className="flex min-h-11 items-center gap-2 text-body text-ink">
                <Checkbox checked={d.open} onCheckedChange={(c) => set({ open: c === true })} />
                {DAYS[day]}
              </label>
              {d.open ? (
                <div className="flex items-center gap-2">
                  <Input type="time" aria-label={`${DAYS[day]}, ouverture`} value={d.from} onChange={(e) => set({ from: e.target.value })} className="w-32" />
                  <span aria-hidden="true" className="text-ink-3">
                    –
                  </span>
                  <Input type="time" aria-label={`${DAYS[day]}, fermeture`} value={d.to} onChange={(e) => set({ to: e.target.value })} className="w-32" />
                </div>
              ) : (
                <span className="text-body text-ink-3">Fermé</span>
              )}
            </div>
          );
        })}
        <div className="mt-2 flex flex-wrap items-center gap-3">
          <Button variant="secondary" onClick={() => void save()} loading={busy} loadingText="Enregistrement…">
            Enregistrer les horaires
          </Button>
          {message ? (
            <span role={message.ok ? "status" : "alert"} className={message.ok ? "text-label text-success-700" : "text-label text-danger-700"}>
              {message.text}
            </span>
          ) : null}
        </div>
      </CardContent>
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
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [origin] = useState(() => (typeof window === "undefined" ? "" : window.location.origin));
  const checks = readiness ? indexabilityChecks(readiness.facts, Date.now()) : [];
  const indexable = checks.length > 0 && checks.every((c) => c.ok);

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

  return (
    <Card>
      <CardHeader>
        <CardTitle>Carte publique</CardTitle>
        <CardDescription>
          Une page ouverte à tous, sans QR, que vous pouvez partager et que les moteurs de recherche peuvent trouver. Elle
          montre la carte publiée et vos coordonnées, rien d'autre.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4 pb-5">
        <div className="flex flex-wrap items-center gap-3">
          <Button variant={enabled ? "secondary" : "primary"} onClick={() => void toggle(!enabled)} loading={busy} loadingText="Un instant…">
            {enabled ? "Désactiver la carte publique" : "Activer la carte publique"}
          </Button>
          {enabled && readiness ? (
            <a href={`${origin}/menu/${readiness.slug}`} target="_blank" rel="noreferrer" className="text-label text-accent-700 underline underline-offset-4">
              {origin.replace(/^https?:\/\//, "")}/menu/{readiness.slug}
            </a>
          ) : null}
        </div>
        {error ? (
          <p role="alert" className="text-label text-danger-700">
            {error}
          </p>
        ) : null}
        {readiness ? (
          <div>
            <p className="mb-2 text-label text-ink">
              {indexable ? "Proposée aux moteurs de recherche." : "Pour être proposée aux moteurs de recherche :"}
            </p>
            <ul className="flex flex-col gap-1">
              {checks.map((c) => (
                <li key={c.key} className="flex items-start gap-2 text-body">
                  {c.ok ? (
                    <Check aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-success-600" />
                  ) : (
                    <X aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-ink-3" />
                  )}
                  <span className={c.ok ? "text-ink" : "text-ink-2"}>
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
