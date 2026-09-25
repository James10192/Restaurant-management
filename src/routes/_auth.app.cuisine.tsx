import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import { LoadingState } from "~/components/app/states";
import { useWorkspace } from "~/components/app/workspace";
import { AccountService } from "~/components/service/account-service";
import { KdsBoard, StationPicker } from "~/components/service/kds-board";
import { Button } from "~/components/ui/button";

export const Route = createFileRoute("/_auth/app/cuisine")({
  head: () => ({ meta: [{ title: "Cuisine — Joliba" }] }),
  component: () => (
    <AccountService permission="kitchen.read">
      <Kitchen />
    </AccountService>
  ),
});

const stationKey = (venueId: string) => `joliba.poste.${venueId}`;

function Kitchen() {
  const workspace = useWorkspace();
  const venueId = workspace.venue!._id;
  const stations = useQuery(api.stations.list, { venueId });
  const [stationId, setStationId] = useState<Id<"prepStations"> | null>(null);
  useEffect(() => {
    try {
      const saved = localStorage.getItem(stationKey(venueId));
      if (saved) setStationId(saved as Id<"prepStations">);
    } catch {
      /* pas de mémoire du poste : on le redemande */
    }
  }, [venueId]);

  if (stations === undefined) return <LoadingState />;
  const active = stations.filter((s) => s.isActive);
  // Un seul poste : rien à choisir.
  const current = active.find((s) => s._id === stationId) ?? (active.length === 1 ? active[0] : undefined);
  if (!current) {
    return (
      <StationPicker
        stations={stations}
        onPick={(id) => {
          setStationId(id);
          try {
            localStorage.setItem(stationKey(venueId), id);
          } catch {
            /* le choix vaut pour cette visite */
          }
        }}
      />
    );
  }
  return (
    <div className="flex flex-col gap-2">
      {active.length > 1 ? (
        <Button variant="link" className="w-fit px-0" onClick={() => setStationId(null)}>
          Changer de poste
        </Button>
      ) : null}
      <KdsBoard stationId={current._id} />
    </div>
  );
}
