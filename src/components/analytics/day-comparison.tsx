import { useQuery } from "convex/react";
import { TriangleAlert } from "lucide-react";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { SLOT_MS, weekdayOf } from "../../../convex/lib/analytics";
import { formatMoney, type CurrencyCode } from "../../../convex/lib/money";
import { useMinuteClock } from "~/components/service/time";
import { Alert, AlertDescription, AlertTitle } from "~/components/ui/alert";
import { Skeleton } from "~/components/ui/skeleton";
import { Figure, versusUsual } from "./figures";

const WEEKDAYS = ["dimanches", "lundis", "mardis", "mercredis", "jeudis", "vendredis", "samedis"];

/**
 * Le jour, comparé à ses semblables (D-142) : la médiane des derniers mêmes jours de semaine
 * ouverts, à la même heure si le jour est en cours. En tête du rapport, jamais pendant le service :
 * un chiffre sous la moyenne des mardis n'appelle aucun geste au coup de feu (IA §4.2).
 */
export function DayComparison({ venueId, day }: { venueId: Id<"venues">; day: string }) {
  // L'heure de l'écran, à la demi-heure : « à la même heure » avance sans recharger (D-048).
  const at = Math.floor(useMinuteClock(60_000) / SLOT_MS) * SLOT_MS;
  const data = useQuery(api.analytics.day, { venueId, day, at });
  // Réserve la place pendant le chargement : le rapport ne saute pas quand le bloc arrive.
  if (data === undefined) return <Skeleton className="h-40 w-full" data-day-comparison-loading />;
  // Un jour à venir (adresse tapée à la main) : rien à comparer, et rien à casser.
  if (data === null) return null;
  const money = (amount: number) => formatMoney({ amount, currency: data.currency as CurrencyCode });
  const weekdays = WEEKDAYS[weekdayOf(data.day)]!;
  const cmp = data.comparison;
  const usual = (now: number, ref: { usual: number } | null, format: (n: number) => string) =>
    ref ? `${versusUsual(now, ref.usual)} (${format(ref.usual)} les ${weekdays} habituels)` : undefined;

  return (
    <section aria-labelledby="jour-titre" className="flex flex-col gap-3" data-day-comparison>
      <h2 id="jour-titre" className="text-lg font-semibold tracking-tight">
        La journée
      </h2>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <Figure
          label="Commandes"
          value={String(data.orders.count)}
          // En cours de journée, on compare jusqu'à la dernière demi-heure écoulée : on dit ce compte-là.
          hint={
            data.inProgress && cmp.orders
              ? `${versusUsual(cmp.orders.now, cmp.orders.usual)} : ${cmp.orders.now} à la dernière demi-heure écoulée, contre ${cmp.orders.usual} les ${weekdays} habituels`
              : usual(cmp.orders?.now ?? data.orders.count, cmp.orders, String)
          }
        />
        {data.money ? (
          <>
            <Figure label="Ventes" value={money(data.money.sales)} hint={data.inProgress ? "comparées une fois la journée finie" : usual(cmp.sales?.now ?? data.money.sales, cmp.sales, money)} />
            <Figure
              label="Ticket moyen par table"
              value={data.money.averageTicket === null ? "—" : money(data.money.averageTicket)}
              hint={`${data.tables.count} table${data.tables.count > 1 ? "s" : ""} servie${data.tables.count > 1 ? "s" : ""}`}
            />
          </>
        ) : (
          <Figure label="Tables servies" value={String(data.tables.count)} />
        )}
        {data.tables.withCovers > 0 ? (
          <Figure label="Couverts" value={String(data.tables.covers)} hint={`saisis sur ${data.tables.withCovers} table${data.tables.withCovers > 1 ? "s" : ""} de ${data.tables.count}`} />
        ) : null}
      </div>
      {cmp.orders === null ? (
        <p className="text-sm text-muted-foreground">
          Pas encore de comparaison : elle commence avec trois {weekdays} ouverts ({cmp.days} pour l'instant).
        </p>
      ) : null}
      {data.moneyHidden === "blind" ? (
        <p className="text-sm text-muted-foreground">Comptage à l'aveugle en cours ({data.countingDrawers.join(", ")}) : les montants reviennent dès que le compté est saisi.</p>
      ) : null}
      {data.moneyHidden === "permission" ? (
        <p className="text-sm text-muted-foreground">Les montants demandent le droit « Voir les données financières ».</p>
      ) : null}
      {cmp.exceptionsAlert ? (
        <Alert>
          <TriangleAlert />
          <AlertTitle>Beaucoup d'annulations en cuisine, d'offerts et de remises</AlertTitle>
          <AlertDescription>
            {Math.round(cmp.exceptionsAlert.share * 100)} % des ventes, contre {Math.round(cmp.exceptionsAlert.usual * 100)} % les {weekdays} habituels. Le détail est plus bas.
          </AlertDescription>
        </Alert>
      ) : null}
    </section>
  );
}
