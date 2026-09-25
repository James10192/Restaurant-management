import type { ReactNode } from "react";
import { Card, CardDescription, CardHeader, CardTitle } from "~/components/ui/card";
import { cn } from "~/lib/utils";

/** Un chiffre, sa légende, et au besoin ce qu'il vaut d'habitude. */
export function Figure({ label, value, hint, children }: { label: string; value: string; hint?: string; children?: ReactNode }) {
  return (
    <Card size="sm">
      <CardHeader>
        <CardDescription>{label}</CardDescription>
        <CardTitle className="text-2xl tabular-nums">{value}</CardTitle>
        {hint ? <CardDescription>{hint}</CardDescription> : null}
        {children}
      </CardHeader>
    </Card>
  );
}

/** « 4 min », « moins d'une minute », « 1 h 05 » ; un tiret sans mesure. */
export function formatDelay(ms: number | null): string {
  if (ms === null) return "—";
  const minutes = Math.round(ms / 60_000);
  if (minutes < 1) return "moins d'une minute";
  return minutes < 60 ? `${minutes} min` : `${Math.floor(minutes / 60)} h ${String(minutes % 60).padStart(2, "0")}`;
}

/** Un délai se lit avec son effectif : « 6 min · sur 23 bons » (D-143). */
export function delayText(d: { median: number | null; count: number }, unit: string): string {
  if (d.count === 0) return "Pas encore mesuré";
  return `${formatDelay(d.median)} · sur ${d.count} ${unit}${d.count > 1 ? "s" : ""}`;
}

/**
 * L'écart à l'habitude, dit en mots, sans couleur criarde : « +12 % par rapport à d'habitude »,
 * ou à la période précédente (`against`).
 */
export function versusUsual(now: number, usual: number, against = "d'habitude"): string {
  if (usual === 0) return now === 0 ? `comme ${against}` : `${against} : rien`;
  const pct = Math.round(((now - usual) / usual) * 100);
  if (Math.abs(pct) < 5) return `comme ${against}`;
  return `${pct > 0 ? "+" : ""}${pct} % par rapport à ${against}`;
}

/**
 * Des barres en CSS : pas de bibliothèque de graphiques pour une rangée de rectangles (D-144).
 * Chaque barre porte sa valeur en texte accessible.
 */
export function Bars({ values, labels, format, highlight, className }: { values: readonly number[]; labels: readonly string[]; format: (n: number) => string; highlight?: number; className?: string }) {
  const max = Math.max(1, ...values);
  return (
    <ol className={cn("flex h-32 items-end gap-px", className)}>
      {values.map((v, i) => (
        <li key={labels[i] ?? i} className="flex h-full flex-1 flex-col justify-end" title={`${labels[i]} : ${format(v)}`}>
          <span className="sr-only">
            {labels[i]} : {format(v)}
          </span>
          <span
            aria-hidden="true"
            className={cn("block rounded-t-sm bg-primary/70", i === highlight && "bg-primary", v === 0 && "bg-muted")}
            style={{ height: `${Math.max(v > 0 ? 4 : 2, (v / max) * 100)}%` }}
          />
        </li>
      ))}
    </ol>
  );
}
