import { useEffect, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "convex/react";
import { ArrowLeft, Printer } from "lucide-react";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import { useWorkspace } from "~/components/app/workspace";
import { QrCode } from "~/components/floor/qr-code";
import { Button } from "~/components/ui/button";
import { EmptyState, LoadingState, PermissionDeniedState } from "~/components/ui/states";

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

  return (
    <div>
      <style>{`@page { size: A4; margin: 10mm; }`}</style>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3 print:hidden">
        <Link to="/app/floor" className="inline-flex min-h-11 items-center gap-1 text-label text-ink-2 hover:text-ink">
          <ArrowLeft aria-hidden="true" className="size-4" />
          Plan de salle
        </Link>
        <Button onClick={() => window.print()} disabled={areas.length === 0}>
          <Printer aria-hidden="true" />
          Imprimer
        </Button>
      </div>
      {missing > 0 ? (
        <p className="mb-4 text-body text-warning-700 print:hidden">
          {missing} table{missing > 1 ? "s n'ont" : " n'a"} pas de QR actif : ouvrez le plan de salle pour les régénérer.
        </p>
      ) : null}
      {areas.length === 0 ? (
        <EmptyState title="Aucun QR à imprimer" description="Ajoutez des tables dans le plan de salle : chacune naît avec son QR." />
      ) : (
        areas.map((area) => (
          <section key={area._id} className="mb-8 break-after-page print:mb-0">
            <h2 className="mb-3 text-title-md text-ink print:hidden">{area.name}</h2>
            <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 print:grid-cols-2 print:gap-[6mm]">
              {area.cards.map((card) => (
                <li
                  key={card.tableId}
                  className="flex break-inside-avoid flex-col items-center gap-2 rounded-md border border-line bg-white p-5 text-center text-black print:h-[88mm] print:justify-center print:rounded-none print:border-dashed print:p-[4mm]"
                >
                  <p className="text-label">{sheet.venueName}</p>
                  <p className="text-[40px] leading-none font-semibold tabular-nums print:text-[44pt]">Table {card.number}</p>
                  <QrCode value={`${origin}/r/${sheet.venueSlug}/t/${card.token}`} size="44mm" title={`QR de la table ${card.number}`} />
                  <p className="text-body">Scannez pour voir la carte · Scan to see the menu</p>
                  <p className="text-[10px] text-neutral-500">
                    {area.name} · v{card.version}
                  </p>
                </li>
              ))}
            </ul>
          </section>
        ))
      )}
    </div>
  );
}
