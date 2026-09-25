import type { ReactNode } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import { ChevronLeft, ChevronRight, EyeOff } from "lucide-react";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import { shiftDay } from "../../convex/lib/analytics";
import { formatMoney, type CurrencyCode } from "../../convex/lib/money";
import { LoadingState, PermissionDeniedState } from "~/components/app/states";
import { useWorkspace } from "~/components/app/workspace";
import { Alert, AlertDescription, AlertTitle } from "~/components/ui/alert";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { ButtonGroup } from "~/components/ui/button-group";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "~/components/ui/card";
import { Input } from "~/components/ui/input";
import { Item, ItemActions, ItemContent, ItemDescription, ItemGroup, ItemTitle } from "~/components/ui/item";
import { Figure } from "~/components/analytics/figures";
import { DayComparison } from "~/components/analytics/day-comparison";

export const Route = createFileRoute("/_auth/app/rapport")({
  head: () => ({ meta: [{ title: "Fin de service — Joliba" }] }),
  // Le jour vit dans l'adresse : on peut envoyer à un associé l'écran exact qu'on regarde.
  validateSearch: (search: Record<string, unknown>): { jour?: string } =>
    typeof search.jour === "string" && /^\d{4}-\d{2}-\d{2}$/.test(search.jour) ? { jour: search.jour } : {},
  component: ReportPage,
});

type Report = FunctionReturnType<typeof api.reports.serviceDay>;

function ReportPage() {
  const w = useWorkspace();
  const venueId = w.venue?._id;
  if (!venueId || !w.canInVenue("report.service_day.read")) {
    return <PermissionDeniedState venue={w.venue?.name} permission="lire les chiffres de l'établissement" />;
  }
  return <ReportView key={venueId} venueId={venueId} />;
}

/**
 * La question du gérant, souvent absent de la salle : qu'est-ce qui est entré, par quel moyen,
 * encaissé par qui — et l'écart s'explique-t-il ? Un jour de service, lisible sur un téléphone.
 */
function ReportView({ venueId }: { venueId: Id<"venues"> }) {
  const w = useWorkspace();
  const { jour: day } = Route.useSearch();
  const navigate = Route.useNavigate();
  const setDay = (next: string) => void navigate({ search: { jour: next } });
  const report = useQuery(api.reports.serviceDay, { venueId, ...(day ? { day } : {}) });
  if (report === undefined) return <LoadingState />;
  const money = (amount: number) => formatMoney({ amount, currency: report.currency as CurrencyCode });
  const clock = new Intl.DateTimeFormat("fr-FR", { timeZone: report.timezone, hour: "2-digit", minute: "2-digit" });
  const date = new Intl.DateTimeFormat("fr-FR", { timeZone: "UTC", weekday: "long", day: "numeric", month: "long" }).format(new Date(`${report.day}T12:00:00Z`));

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-semibold tracking-tight">Fin de service</h1>
          <p className="text-muted-foreground first-letter:uppercase">
            {date}
            {report.day === report.today ? " · en cours" : ""}
          </p>
          {report.simulation ? <Badge variant="outline" className="self-start">Établissement de démonstration</Badge> : null}
        </div>
        <ButtonGroup aria-label="Jour de service">
          <Button variant="outline" size="icon" aria-label="Jour précédent" onClick={() => setDay(shiftDay(report.day, -1))}>
            <ChevronLeft />
          </Button>
          <Input type="date" aria-label="Jour" className="w-40" value={report.day} max={report.today} onChange={(e) => e.target.value && setDay(e.target.value)} />
          <Button variant="outline" size="icon" aria-label="Jour suivant" disabled={report.day >= report.today} onClick={() => setDay(shiftDay(report.day, 1))}>
            <ChevronRight />
          </Button>
        </ButtonGroup>
      </div>

      {w.canInVenue("analytics.read") ? <DayComparison venueId={venueId} day={report.day} /> : null}

      {report.totals === null ? (
        <Alert>
          <EyeOff />
          <AlertTitle>Comptage en cours : {report.blindCounting.join(", ")}</AlertTitle>
          <AlertDescription>Les sommes encaissées reviennent dès que le compté est saisi. Les montrer maintenant trahirait l'attendu à la personne qui compte.</AlertDescription>
        </Alert>
      ) : null}

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {report.totals ? (
          <>
            <Figure label="Encaissé" value={money(report.totals.net)} hint={`${report.totals.count} encaissement${report.totals.count > 1 ? "s" : ""}`} />
            <Figure label="Remboursé" value={money(report.totals.refunded)} />
          </>
        ) : null}
        <Figure label="Encore à encaisser" value={money(report.openTables.reduce((s, t) => s + t.due, 0))} hint={`${report.openTables.length} table${report.openTables.length > 1 ? "s" : ""} ouverte${report.openTables.length > 1 ? "s" : ""}`} />
      </div>

      {report.totals ? (
        <>
          <Section title="Par moyen" description="« Reçu » : ce que le téléphone ou le terminal doit afficher, monnaie rendue comprise." empty={report.byMethod.length === 0} emptyText="Aucun encaissement ce jour-là.">
            {report.byMethod.map((m) => (
              <Row
                key={m.label}
                title={m.label}
                description={`${m.count} encaissement${m.count > 1 ? "s" : ""}${m.received !== m.amount ? ` · reçu ${money(m.received)}` : ""}`}
                value={money(m.amount)}
              />
            ))}
          </Section>

          <Section title="Par personne" description="Qui a encaissé, et combien en espèces." empty={report.byCollector.length === 0} emptyText="Aucun encaissement ce jour-là.">
            {report.byCollector.map((c) => (
              <Row
                key={c.name}
                title={c.name}
                description={`${c.count} encaissement${c.count > 1 ? "s" : ""} · dont espèces ${money(c.cash)}${c.changeOnNonCash > 0 ? ` · monnaie rendue sur Mobile Money ou carte ${money(c.changeOnNonCash)}` : ""}`}
                value={money(c.amount)}
              />
            ))}
          </Section>
        </>
      ) : null}

      <Section title="Caisses" description="Par session : l'attendu est calculé, jamais saisi." empty={report.cashSessions.length === 0} emptyText="Aucune caisse ouverte ce jour-là.">
        {report.cashSessions.map((s) => (
          <CashRow key={s._id} session={s} money={money} clock={clock} />
        ))}
      </Section>

      <Section title="Tables encore ouvertes" empty={report.openTables.length === 0} emptyText="Toutes les tables sont clôturées.">
        {report.openTables.map((t) => (
          <Row key={t._id} title={`Table ${t.table}`} description={`${t.waiter ?? "Sans serveur"} · ouverte à ${clock.format(t.openedAt)}`} value={t.due > 0 ? `reste ${money(t.due)}` : "soldée"} />
        ))}
      </Section>

      <Section title="Impayés" empty={report.debts.length === 0} emptyText="Aucune table partie sans payer.">
        {report.debts.map((d) => (
          <Row
            key={d._id}
            title={`Table ${d.table} · ${d.reason ?? ""}`}
            description={`${d.by ?? "?"} à ${clock.format(d.at)}${d.recovered > 0 ? ` · recouvré depuis ${money(d.recovered)}` : ""}`}
            value={money(d.amount)}
            destructive={d.recovered < d.amount}
          />
        ))}
      </Section>

      <Section title="Offerts et remises" empty={report.adjustments.length === 0} emptyText="Aucun geste commercial.">
        {report.adjustments.map((a) => (
          <Row key={a._id} title={`Table ${a.table} · ${a.label}`} description={`${a.by ?? "?"} à ${clock.format(a.at)}${a.reason ? ` · ${a.reason}` : ""}`} value={`−${money(a.amount)}`} />
        ))}
      </Section>

      <Section title="Saisies annulées" empty={report.voids.length === 0} emptyText="Aucune saisie annulée.">
        {report.voids.map((v) => (
          <Row
            key={v._id}
            title={`Table ${v.table} · ${v.label} ${money(v.amount)}`}
            description={`Encaissé par ${v.collectedBy ?? "?"}, annulé par ${v.voidedBy ?? "?"} à ${clock.format(v.at)}${v.reason ? ` · ${v.reason}` : ""}`}
          />
        ))}
      </Section>

      <Section title="Remboursements" empty={report.refunds.length === 0} emptyText="Aucun remboursement.">
        {report.refunds.map((r) => (
          <Row key={r._id} title={`Table ${r.table} · ${r.method}`} description={`${r.by ?? "?"} à ${clock.format(r.at)} · ${r.reason}`} value={`−${money(r.amount)}`} />
        ))}
      </Section>

      <Section title="Pertes" description="Plats annulés après leur envoi en cuisine." empty={report.cancellations.length === 0} emptyText="Aucun plat perdu.">
        {report.cancellations.map((c) => (
          <Row
            key={c._id}
            title={`Table ${c.table} · ${c.quantity} × ${c.item}`}
            description={`${c.by ?? "?"} à ${clock.format(c.at)}${c.reason ? ` · ${c.reason}` : ""}`}
            {...(c.amount !== null ? { value: money(c.amount) } : {})}
          />
        ))}
      </Section>
    </div>
  );
}

function Section({ title, description, empty, emptyText, children }: { title: string; description?: string; empty: boolean; emptyText: string; children: ReactNode }) {
  return (
    <Card size="sm">
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        {description ? <CardDescription>{description}</CardDescription> : null}
      </CardHeader>
      <CardContent>{empty ? <p className="text-sm text-muted-foreground">{emptyText}</p> : <ItemGroup className="gap-1">{children}</ItemGroup>}</CardContent>
    </Card>
  );
}

function Row({ title, description, value, destructive }: { title: string; description?: string; value?: string; destructive?: boolean }) {
  return (
    <Item size="sm" className="py-1">
      <ItemContent className="min-w-0">
        <ItemTitle className="max-w-full">{title}</ItemTitle>
        {description ? <ItemDescription>{description}</ItemDescription> : null}
      </ItemContent>
      {value ? (
        <ItemActions>
          <span className={destructive ? "font-medium text-destructive tabular-nums" : "font-medium tabular-nums"}>{value}</span>
        </ItemActions>
      ) : null}
    </Item>
  );
}

function CashRow({ session: s, money, clock }: { session: Report["cashSessions"][number]; money: (n: number) => string; clock: Intl.DateTimeFormat }) {
  const facts = [
    `Ouverte à ${clock.format(s.openedAt)} par ${s.openedBy ?? "?"}, fonds ${money(s.openingFloat)}.`,
    s.counts.length > 0 ? `Compté ${s.counts.map((c) => `${money(c.amount)} par ${c.by}`).join(", puis ")}${s.selfCounted ? " — par la personne qui l'a ouverte" : ""}.` : null,
    s.initialDiscrepancy ? `Écart au premier comptage : ${money(s.initialDiscrepancy)}.` : null,
    s.closedAt ? `Close à ${clock.format(s.closedAt)} par ${s.closedBy ?? "?"}.` : null,
  ].filter(Boolean);
  return (
    <Item size="sm" variant="outline" className="flex-col items-stretch">
      <div className="flex items-center justify-between gap-2">
        <ItemTitle>{s.name}</ItemTitle>
        {s.discrepancy === null ? (
          <Badge variant="outline">{s.status === "open" ? "Ouverte" : "En comptage"}</Badge>
        ) : s.discrepancy === 0 ? (
          <Badge variant="secondary">Juste</Badge>
        ) : (
          <Badge variant="destructive">
            Écart {s.discrepancy > 0 ? "+" : ""}
            {money(s.discrepancy)}
          </Badge>
        )}
      </div>
      {s.expected !== null ? (
        <dl className="grid grid-cols-3 gap-2 text-sm">
          <div>
            <dt className="text-xs text-muted-foreground">Attendu</dt>
            <dd className="tabular-nums">{money(s.expected)}</dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">Compté</dt>
            <dd className="tabular-nums">{money(s.counted ?? 0)}</dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">Écart</dt>
            <dd className={s.discrepancy ? "font-medium text-destructive tabular-nums" : "tabular-nums"}>{money(s.discrepancy ?? 0)}</dd>
          </div>
        </dl>
      ) : null}
      <ItemDescription className="line-clamp-none">{facts.join(" ")}</ItemDescription>
      {s.movements.length > 0 ? (
        <ul className="flex flex-col gap-0.5 text-sm">
          {s.movements.map((m) => (
            <li key={m._id} className="flex justify-between gap-2">
              <span className="min-w-0">
                {m.type === "payout" ? "Sortie" : "Entrée"} · {m.reason} · {m.by} à {clock.format(m.at)}
              </span>
              <span className="shrink-0 tabular-nums">
                {m.type === "payout" ? "−" : "+"}
                {money(m.amount)}
              </span>
            </li>
          ))}
        </ul>
      ) : null}
      {s.closeReason ? <p className="text-sm">motif : {s.closeReason}</p> : null}
    </Item>
  );
}
