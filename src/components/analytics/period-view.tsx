import { useState, type ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { useQuery } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import { Info } from "lucide-react";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { shiftDay, SLOT_MS } from "../../../convex/lib/analytics";
import { formatMoney, type CurrencyCode } from "../../../convex/lib/money";
import { LoadingState } from "~/components/app/states";
import { useMinuteClock } from "~/components/service/time";
import { Alert, AlertDescription } from "~/components/ui/alert";
import { Button } from "~/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "~/components/ui/card";
import { Input } from "~/components/ui/input";
import { Item, ItemActions, ItemContent, ItemDescription, ItemGroup, ItemTitle } from "~/components/ui/item";
import { ToggleGroup, ToggleGroupItem } from "~/components/ui/toggle-group";
import { Bars, delayText, Figure, formatDelay, versusUsual } from "./figures";

type Period = FunctionReturnType<typeof api.analytics.period>;

const WEEKDAY_SHORT = ["Dim.", "Lun.", "Mar.", "Mer.", "Jeu.", "Ven.", "Sam."];
const WEEKDAY_LONG = ["dimanche", "lundi", "mardi", "mercredi", "jeudi", "vendredi", "samedi"];

/** Trois périodes toutes faites ; les deux dernières se comparent à la précédente (D-142). */
const PRESETS = [
  { key: "1", label: "Aujourd'hui", days: 1 },
  { key: "7", label: "7 jours", days: 7 },
  { key: "28", label: "4 semaines", days: 28 },
] as const;

export function PeriodView(props: { venueId: Id<"venues">; from?: string; to?: string; onChange: (from: string, to: string) => void }) {
  // L'heure de l'écran, à la demi-heure : « aujourd'hui » avance sans recharger (D-048).
  const at = Math.floor(useMinuteClock(60_000) / SLOT_MS) * SLOT_MS;
  const data = useQuery(api.analytics.period, { venueId: props.venueId, at, ...(props.from ? { from: props.from } : {}), ...(props.to ? { to: props.to } : {}) });
  if (data === undefined) return <LoadingState />;
  const money = (amount: number) => formatMoney({ amount, currency: data.currency as CurrencyCode });
  const preset = PRESETS.find((p) => data.to === data.today && data.length === p.days)?.key ?? "";

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-6" data-analytics>
      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-semibold tracking-tight">Données</h1>
          <p className="text-muted-foreground">{periodLabel(data)}</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <ToggleGroup
            type="single"
            variant="outline"
            value={preset}
            onValueChange={(key) => {
              const p = PRESETS.find((x) => x.key === key);
              if (p) props.onChange(shiftDay(data.today, 1 - p.days), data.today);
            }}
            aria-label="Période"
          >
            {PRESETS.map((p) => (
              <ToggleGroupItem key={p.key} value={p.key}>
                {p.label}
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
          <div className="flex items-center gap-2">
            <Input type="date" aria-label="Du" className="w-40" value={data.from} max={data.to} onChange={(e) => e.target.value && props.onChange(e.target.value, data.to)} />
            <span className="text-muted-foreground">au</span>
            <Input type="date" aria-label="Au" className="w-40" value={data.to} min={data.from} max={data.today} onChange={(e) => e.target.value && props.onChange(data.from, e.target.value)} />
          </div>
        </div>
      </div>

      {data.missing > 0 ? (
        <Alert>
          <Info />
          <AlertDescription>
            {data.missing === 1 ? "Un jour de cette période n'a pas encore de chiffres" : `${data.missing} jours de cette période n'ont pas encore de chiffres`} : un jour se clôt une heure
            après sa fin, et les jours d'avant la mise en service ne sont pas calculés.
          </AlertDescription>
        </Alert>
      ) : null}

      {data.mixedVersions ? (
        <Alert>
          <Info />
          <AlertDescription>Une partie de cette période a été calculée avant une mise à jour de la façon de compter : des écarts de quelques unités sont possibles.</AlertDescription>
        </Alert>
      ) : null}

      <Summary data={data} money={money} />
      <Selling data={data} money={money} />
      <Busy data={data} />
      <Service data={data} />
      <Tables data={data} money={money} />
      {data.money ? <MoneyCheck data={data} m={data.money} money={money} /> : <MoneyHidden hidden={data.moneyHidden} />}
    </div>
  );
}

function periodLabel(data: Period): string {
  const date = (day: string, withYear = false) =>
    new Intl.DateTimeFormat("fr-FR", { timeZone: "UTC", weekday: "long", day: "numeric", month: "long", ...(withYear ? { year: "numeric" } : {}) }).format(new Date(`${day}T12:00:00Z`));
  if (data.length === 1) return `${date(data.from)}${data.from === data.today ? " · en cours" : ""}`;
  return `Du ${date(data.from)} au ${date(data.to, true)} · ${data.length} jours`;
}

function Section({ title, question, children }: { title: string; question: string; children: ReactNode }) {
  return (
    <Card size="sm">
      <CardHeader>
        <CardTitle>
          <h2>{title}</h2>
        </CardTitle>
        <CardDescription>{question}</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">{children}</CardContent>
    </Card>
  );
}

function Row({ title, description, value }: { title: string; description?: string; value?: string }) {
  return (
    <Item variant="outline" size="sm">
      <ItemContent>
        <ItemTitle>{title}</ItemTitle>
        {description ? <ItemDescription>{description}</ItemDescription> : null}
      </ItemContent>
      {value ? <ItemActions className="font-medium tabular-nums">{value}</ItemActions> : null}
    </Item>
  );
}

/* ─────────────────────────── En bref ─────────────────────────── */

function Summary({ data, money }: { data: Period; money: (n: number) => string }) {
  const prev = data.previous;
  const vs = (now: number, before: number | null | undefined) => (prev && before !== null && before !== undefined ? versusUsual(now, before, "la période précédente") : undefined);
  const inProgress = data.from <= data.today && data.today <= data.to;
  return (
    <div className="flex flex-col gap-2">
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      <Figure label="Commandes" value={String(data.orders.count)} hint={vs(data.orders.count, prev?.orders)} />
      {data.money ? (
        <>
          <Figure label="Ventes" value={money(data.money.sales)} hint={vs(data.money.sales, prev?.sales)} />
          <Figure label="Encaissé" value={money(data.money.collected.net)} hint={vs(data.money.collected.net, prev?.collected)} />
          <Figure label="Ticket moyen par table" value={data.money.averageTicket === null ? "—" : money(data.money.averageTicket)} hint={`sur ${data.tables.count} table${data.tables.count > 1 ? "s" : ""}`} />
        </>
      ) : (
        <Figure label="Tables servies" value={String(data.tables.count)} />
      )}
    </div>
      {/* Ce qui ne se compare pas le dit (D-142) : un jour entamé contre des jours pleins mentirait. */}
      {data.length === 1 ? (
        <p className="text-sm text-muted-foreground">
          Un jour se compare aux mêmes jours de la semaine :{" "}
          <Link to="/app/rapport" search={{ jour: data.from }} className="underline underline-offset-4">
            voir le rapport
          </Link>
          .
        </p>
      ) : inProgress ? (
        <p className="text-sm text-muted-foreground">La comparaison avec la période précédente viendra une fois la période terminée.</p>
      ) : null}
    </div>
  );
}

/* ─────────────────────────── Ce qui se vend ─────────────────────────── */

function Selling({ data, money }: { data: Period; money: (n: number) => string }) {
  const [all, setAll] = useState(false);
  const sold = data.products.filter((p) => p.quantity > 0);
  const shown = all ? sold : sold.slice(0, 10);
  const lost = data.products.filter((p) => p.lostQuantity > 0).sort((a, b) => b.lostQuantity - a.lostQuantity);
  return (
    <Section title="Ce qui se vend" question="Les plats les plus commandés, et ceux qu'on a dû jeter en cours de préparation.">
      {sold.length === 0 ? (
        <p className="text-sm text-muted-foreground">Aucune vente sur la période.</p>
      ) : (
        <ItemGroup className="gap-2" data-top-products>
          {shown.map((p, i) => (
            <Row key={`${i}-${p.name}`} title={`${i + 1}. ${p.name}`} description={`${p.quantity} vendu${p.quantity > 1 ? "s" : ""}`} value={p.amount !== null ? money(p.amount) : undefined} />
          ))}
        </ItemGroup>
      )}
      {sold.length > 10 ? (
        <Button variant="ghost" className="self-start" onClick={() => setAll(!all)}>
          {all ? "Les 10 premiers seulement" : `Voir les ${sold.length} plats`}
        </Button>
      ) : null}
      {lost.length > 0 ? (
        <div className="flex flex-col gap-2">
          <h3 className="text-sm font-medium">Annulés alors qu'ils étaient en cuisine</h3>
          <ItemGroup className="gap-2">
            {lost.slice(0, 5).map((p, i) => (
              <Row key={`${i}-${p.name}`} title={p.name} description={`${p.lostQuantity} perdu${p.lostQuantity > 1 ? "s" : ""}`} value={p.lostAmount !== null ? money(p.lostAmount) : undefined} />
            ))}
          </ItemGroup>
        </div>
      ) : null}
    </Section>
  );
}

/* ─────────────────────────── Quand suis-je chargé ─────────────────────────── */

function Busy({ data }: { data: Period }) {
  // Une moyenne sur un seul jour est du bruit : il en faut au moins deux (D-142).
  const open = data.weekdays.filter((w) => w.days >= 2 && w.averageOrders !== null);
  const [picked, setPicked] = useState<number | null>(null);
  const weekday = open.find((w) => w.weekday === picked) ?? [...open].sort((a, b) => b.days - a.days)[0];
  // Les créneaux partent du début du jour de service : 4 h, 4 h 30…
  const labels = Array.from({ length: 48 }, (_, i) => {
    const minutes = (data.startHour * 60 + i * 30) % 1440;
    return `${String(Math.floor(minutes / 60)).padStart(2, "0")} h ${String(minutes % 60).padStart(2, "0")}`;
  });
  return (
    <Section title="Quand êtes-vous chargé ?" question="Commandes moyennes par demi-heure, pour un jour de semaine.">
      {!weekday ? (
        <p className="text-sm text-muted-foreground">Il faut au moins deux mêmes jours de semaine clos, avec des commandes, pour dessiner une tendance.</p>
      ) : (
        <>
          <ToggleGroup type="single" variant="outline" size="sm" value={String(weekday.weekday)} onValueChange={(v) => v && setPicked(Number(v))} aria-label="Jour de la semaine" className="flex-wrap">
            {open.map((w) => (
              <ToggleGroupItem key={w.weekday} value={String(w.weekday)} aria-label={WEEKDAY_LONG[w.weekday]}>
                {WEEKDAY_SHORT[w.weekday]}
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
          {(() => {
            const values = weekday.averageOrders!;
            const first = values.findIndex((n) => n > 0);
            const last = values.length - 1 - [...values].reverse().findIndex((n) => n > 0);
            // On montre la plage où il se passe quelque chose, avec une demi-heure de marge.
            const from = Math.max(0, first - 1);
            const to = Math.min(values.length - 1, last + 1);
            const peak = values.indexOf(Math.max(...values));
            return (
              <>
                <Bars values={values.slice(from, to + 1)} labels={labels.slice(from, to + 1)} format={(n) => `${n.toFixed(1)} commande${n >= 2 ? "s" : ""}`} highlight={peak - from} />
                <div className="flex justify-between text-xs text-muted-foreground tabular-nums">
                  <span>{labels[from]}</span>
                  <span>
                    Pic vers {labels[peak]} · moyenne sur {weekday.days} {WEEKDAY_LONG[weekday.weekday]}
                    {weekday.days > 1 ? "s" : ""}
                  </span>
                  <span>{labels[to]}</span>
                </div>
              </>
            );
          })()}
        </>
      )}
    </Section>
  );
}

/* ─────────────────────────── Où le service coince ─────────────────────────── */

function Service({ data }: { data: Period }) {
  const d = data.delays;
  const unstartedShare = d.tickets > 0 ? Math.round((d.readyWithoutStart / d.tickets) * 100) : 0;
  return (
    <Section title="Où le service coince-t-il ?" question="Délais médians : la moitié des cas va plus vite, l'autre moitié plus lentement.">
      <ItemGroup className="gap-2" data-delays>
        <Row title="Commande du client → acceptée" description={delayText(d.acceptance, "commande")} />
        <Row title="Envoyé en cuisine → commencé" description={delayText(d.waitStart, "bon")} />
        <Row title="Commencé → prêt" description={delayText(d.prep, "bon")} />
        <Row title="Prêt → servi" description={delayText(d.pass, "bon")} />
        <Row title="Appel du client → pris en charge" description={delayText(d.request, "demande")} />
      </ItemGroup>
      {unstartedShare > 0 ? (
        <p className="text-sm text-muted-foreground">
          {unstartedShare} % des bons ont été marqués prêts sans avoir été commencés : ils ne comptent pas dans la préparation. Appuyer sur « Commencer » en cuisine rend ce délai juste.
        </p>
      ) : null}
      {data.stations.length > 1 ? (
        <div className="flex flex-col gap-2">
          <h3 className="text-sm font-medium">Par poste</h3>
          <ItemGroup className="gap-2">
            {data.stations.map((s) => (
              <Row key={s.name} title={s.name} description={`attente ${formatDelay(s.waitStart.median)} · préparation ${formatDelay(s.prep.median)} · ${s.prep.count} bon${s.prep.count > 1 ? "s" : ""}`} />
            ))}
          </ItemGroup>
        </div>
      ) : null}
    </Section>
  );
}

/* ─────────────────────────── Les tables ─────────────────────────── */

function Tables({ data, money }: { data: Period; money: (n: number) => string }) {
  const t = data.tables;
  return (
    <Section title="Vos tables tournent-elles ?" question="Combien de temps une table reste occupée, et ce qui n'a pas été payé.">
      <ItemGroup className="gap-2">
        <Row title="Durée d'une table" description={delayText(data.duration, "table")} />
        {t.withCovers > 0 ? <Row title="Couverts" description={`${t.covers} couverts saisis sur ${t.withCovers} table${t.withCovers > 1 ? "s" : ""} de ${t.count}`} /> : null}
        {t.abandoned > 0 ? <Row title="Tables ouvertes sans suite" description={`${t.abandoned} table${t.abandoned > 1 ? "s" : ""} ouverte${t.abandoned > 1 ? "s" : ""} puis abandonnée${t.abandoned > 1 ? "s" : ""}`} /> : null}
        <Row title="Clients partis sans finir de payer" description={`${t.debts} table${t.debts > 1 ? "s" : ""}`} value={data.money && t.debts > 0 ? money(data.money.debtAmount) : undefined} />
      </ItemGroup>
    </Section>
  );
}

/* ─────────────────────────── L'argent ─────────────────────────── */

function MoneyCheck({ data, m, money }: { data: Period; m: NonNullable<Period["money"]>; money: (n: number) => string }) {
  const e = m.exceptions;
  return (
    <Section title="L'argent tombe-t-il juste ?" question="Ce qui est entré, par quel moyen, et ce qui s'en est écarté.">
      <ItemGroup className="gap-2" data-money>
        {m.byMethod.map((x) => (
          <Row key={x.label} title={x.label} description={`${x.count} encaissement${x.count > 1 ? "s" : ""}`} value={money(x.amount)} />
        ))}
        {e.refunds > 0 ? <Row title="Remboursé" value={`− ${money(e.refunds)}`} /> : null}
      </ItemGroup>
      <ItemGroup className="gap-2">
        <Row title="Offerts" value={money(e.comps)} />
        <Row title="Remises" value={money(e.discounts)} />
        <Row title="Pertes (annulés en cuisine)" value={money(e.lostAmount)} />
        {e.cashDiscrepancies > 0 ? (
          <>
            {/* Au premier comptage : un recomptage fait une fois l'attendu connu ne l'efface pas. */}
            <Row title="Manquant en caisse" description={`${e.cashDiscrepancies} caisse${e.cashDiscrepancies > 1 ? "s" : ""} avec un écart au premier comptage`} value={money(e.cashShort)} />
            {e.cashOver > 0 ? <Row title="Excédent en caisse" value={money(e.cashOver)} /> : null}
          </>
        ) : (
          <Row title="Écarts de caisse" description="Aucune caisse avec un écart" />
        )}
        {e.voids > 0 ? <Row title="Encaissements annulés" description={`${e.voids} annulation${e.voids > 1 ? "s" : ""}`} /> : null}
      </ItemGroup>
      {data.length === 1 ? (
        <Button asChild variant="outline" className="self-start">
          <Link to="/app/rapport" search={{ jour: data.from }}>
            Le détail dans le rapport de fin de service
          </Link>
        </Button>
      ) : null}
    </Section>
  );
}

function MoneyHidden({ hidden }: { hidden: Period["moneyHidden"] }) {
  if (hidden === "blind") {
    return (
      <Alert>
        <Info />
        <AlertDescription>Une caisse est en cours de comptage : les montants reviennent dès que le compté est saisi.</AlertDescription>
      </Alert>
    );
  }
  return <p className="text-sm text-muted-foreground">Les montants demandent le droit « Voir les données financières ».</p>;
}
