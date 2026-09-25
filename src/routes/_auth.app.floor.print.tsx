import { useEffect, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "convex/react";
import { ArrowLeft, CircleAlert, Printer } from "lucide-react";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import { useWorkspace } from "~/components/app/workspace";
import { QrCode } from "~/components/floor/qr-code";
import { EmptyState, LoadingState, PermissionDeniedState } from "~/components/app/states";
import { Alert, AlertDescription } from "~/components/ui/alert";
import { Button } from "~/components/ui/button";
import { Card, CardContent } from "~/components/ui/card";

type Search = { zone?: string; table?: string };

export const Route = createFileRoute("/_auth/app/floor/print")({
  head: () => ({ meta: [{ title: "QR des tables — Joliba" }] }),
  validateSearch: (search: Record<string, unknown>): Search => ({
    ...(typeof search.zone === "string" ? { zone: search.zone } : {}),
    ...(typeof search.table === "string" ? { table: search.table } : {}),
  }),
  component: PrintPage,
});

/**
 * La planche de QR à imprimer (IA §4.5) : A4, six QR par page, le numéro en grand — sur une
 * table, on lit le numéro avant le code. Le jeton ne sort de la base que sur cet écran, et
 * seulement avec le droit sur les QR.
 */
function PrintPage() {
  const { zone, table } = Route.useSearch();
  const w = useWorkspace();
  const venueId = w.venue?._id;
  const allowed = venueId !== undefined && w.canInVenue("table.qr.manage");
  const sheet = useQuery(api.qr.sheet, allowed ? { venueId, ...(zone ? { serviceAreaId: zone as Id<"serviceAreas"> } : {}) } : "skip");
  const [origin, setOrigin] = useState("");
  useEffect(() => setOrigin(window.location.origin), []);

  if (!allowed) return <PermissionDeniedState venue={w.venue?.name} permission="Imprimer les QR des tables" />;
  if (!sheet || !origin) return <LoadingState />;

  const areas = sheet.areas
    .map((a) => ({ ...a, cards: table ? a.cards.filter((c) => c.tableId === table) : a.cards }))
    .filter((a) => a.cards.length > 0);
  const missing = sheet.areas.reduce((n, a) => n + a.missing, 0);

  const total = areas.reduce((n, a) => n + a.cards.length, 0);

  return (
    <div className="flex flex-col gap-6 print:block">
      <style>{`@page { size: A4; margin: 10mm; }`}</style>
      <div className="flex flex-col gap-4 print:hidden">
        <Button variant="ghost" size="sm" className="self-start" asChild>
          <Link to="/app/floor">
            <ArrowLeft data-icon="inline-start" aria-hidden="true" />
            Plan de salle
          </Link>
        </Button>
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div className="min-w-0">
            <h1 className="text-2xl font-semibold tracking-tight">QR des tables</h1>
            <p className="text-muted-foreground">
              Planche A4, six QR par page.{total > 0 ? ` ${total} QR à imprimer.` : ""}
            </p>
          </div>
          <Button onClick={() => window.print()} disabled={areas.length === 0}>
            <Printer data-icon="inline-start" aria-hidden="true" />
            Imprimer
          </Button>
        </div>
      </div>
      {missing > 0 ? (
        <Alert className="print:hidden">
          <CircleAlert />
          <AlertDescription>
            {missing} table{missing > 1 ? "s n'ont" : " n'a"} pas de QR actif : ouvrez le plan de salle pour les régénérer.
          </AlertDescription>
        </Alert>
      ) : null}
      {areas.length === 0 ? (
        <EmptyState title="Aucun QR à imprimer" description="Ajoutez des tables dans le plan de salle : chacune naît avec son QR." />
      ) : (
        areas.map((area) => (
          <section key={area._id} aria-labelledby={`zone-${area._id}`} className="flex flex-col gap-3 break-after-page print:block">
            <h2 id={`zone-${area._id}`} className="text-lg font-semibold tracking-tight print:hidden">
              {area.name}
            </h2>
            <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 print:grid-cols-2 print:gap-[6mm]">
              {area.cards.map((card) => (
                <li key={card.tableId} className="break-inside-avoid">
                  <Card className="h-full print:h-[88mm] print:justify-center print:rounded-none print:border print:border-dashed print:py-[4mm] print:ring-0">
                    <CardContent className="flex flex-col items-center gap-2 text-center print:px-[4mm]">
                      <p className="text-sm text-muted-foreground">{sheet.venueName}</p>
                      <p className="text-[40px] leading-none font-semibold tracking-tight tabular-nums print:text-[44pt]">Table {card.number}</p>
                      <QrCode value={`${origin}/r/${sheet.venueSlug}/t/${card.token}`} size="44mm" title={`QR de la table ${card.number}`} />
                      <p className="text-sm">Scannez pour voir la carte · Scan to see the menu</p>
                      <p className="text-xs text-muted-foreground">
                        {area.name} · v{card.version}
                      </p>
                    </CardContent>
                  </Card>
                </li>
              ))}
            </ul>
          </section>
        ))
      )}
    </div>
  );
}
