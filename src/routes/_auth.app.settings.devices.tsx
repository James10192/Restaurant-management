import { useEffect, useState } from "react";
import { createFileRoute, useLocation } from "@tanstack/react-router";
import { useMutation, useQuery } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import { CircleAlert, Monitor, Plus, Smartphone, Tablet, type LucideIcon } from "lucide-react";
import { toast } from "sonner";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import { PendingButton } from "~/components/app/pending-button";
import { EmptyState, LoadingState, PermissionDeniedState } from "~/components/app/states";
import { useWorkspace } from "~/components/app/workspace";
import { DEVICE_TYPES, DeviceEnrollmentDialog, type DeviceType } from "~/components/settings/device-enrollment-dialog";
import { OrderingModeCard, readOrderingMode } from "~/components/settings/ordering-mode-card";
import { Alert, AlertDescription } from "~/components/ui/alert";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "~/components/ui/alert-dialog";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "~/components/ui/card";
import { Item, ItemActions, ItemContent, ItemDescription, ItemFooter, ItemGroup, ItemMedia, ItemTitle } from "~/components/ui/item";
import { describeError } from "~/lib/errors";

export const Route = createFileRoute("/_auth/app/settings/devices")({
  head: () => ({ meta: [{ title: "Appareils — Joliba" }] }),
  component: DevicesPage,
});

type Device = FunctionReturnType<typeof api.devices.list>[number];

const ICONS: Record<DeviceType, LucideIcon> = { kds: Monitor, shared: Tablet, personal: Smartphone };
const timeFormat = new Intl.DateTimeFormat("fr-FR", { hour: "2-digit", minute: "2-digit" });
const dateFormat = new Intl.DateTimeFormat("fr-FR", { dateStyle: "medium" });
const relative = new Intl.RelativeTimeFormat("fr", { numeric: "auto" });

function ago(timestamp: number, now: number): string {
  const minutes = Math.round((now - timestamp) / 60_000);
  if (minutes < 1) return "à l'instant";
  if (minutes < 60) return relative.format(-minutes, "minute");
  const hours = Math.round(minutes / 60);
  if (hours < 24) return relative.format(-hours, "hour");
  return relative.format(-Math.round(hours / 24), "day");
}

/** Une horloge à la minute, pour que « il y a 3 minutes » vieillisse sans rechargement. */
function useNow(): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 60_000);
    return () => window.clearInterval(id);
  }, []);
  return now;
}

function DevicesPage() {
  const w = useWorkspace();
  const venueId = w.venue?._id;
  const canManageDevices = venueId !== undefined && w.canInVenue("device.manage");
  const canSetMode = venueId !== undefined && w.canInVenue("venue.settings.service");
  // Venu de la mise en service (« Comment vous travaillez ») : la section qu'on vient régler en tête.
  const modeFirst = useLocation().hash === MODE_ANCHOR;
  if (!venueId || (!canManageDevices && !canSetMode)) {
    return <PermissionDeniedState venue={w.venue?.name} permission="enrôler et révoquer un appareil" />;
  }
  const mode = canSetMode ? (
    <section id={MODE_ANCHOR} aria-label="Mode de commande" className="scroll-mt-20">
      <OrderingModeSection venueId={venueId} canReadVenue={w.canInVenue("venue.read")} />
    </section>
  ) : null;
  return (
    <div key={venueId} className="mx-auto flex max-w-3xl flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight">Appareils</h1>
        <p className="text-muted-foreground">Les écrans et téléphones de l'établissement, et ce que vos clients peuvent commander.</p>
      </div>
      {/* L'ordre du DOM, pas `order` : le clavier suit alors ce que l'œil voit. */}
      {modeFirst ? mode : null}
      {canManageDevices ? (
        <DevicesCard venueId={venueId} canReadStations={w.canInVenue("kitchen.read")} canReadTeam={w.canInVenue("team.read")} />
      ) : null}
      {modeFirst ? null : mode}
    </div>
  );
}

/** L'ancre qu'ouvre l'étape « Comment vous travaillez » de la mise en service. */
const MODE_ANCHOR = "mode-de-commande";

function OrderingModeSection({ venueId, canReadVenue }: { venueId: Id<"venues">; canReadVenue: boolean }) {
  const venue = useQuery(api.venues.get, canReadVenue ? { venueId } : "skip");
  if (canReadVenue && venue === undefined) return <LoadingState />;
  return (
    <OrderingModeCard
      venueId={venueId}
      current={venue ? readOrderingMode(venue) : null}
      maxQuantity={venue && "guestMaxQuantityPerLine" in venue ? venue.guestMaxQuantityPerLine : null}
    />
  );
}

function DevicesCard({ venueId, canReadStations, canReadTeam }: { venueId: Id<"venues">; canReadStations: boolean; canReadTeam: boolean }) {
  const devices = useQuery(api.devices.list, { venueId });
  const revoke = useMutation(api.devices.revoke);
  const [adding, setAdding] = useState(false);
  const [revoking, setRevoking] = useState<Device | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const now = useNow();

  async function confirmRevoke() {
    if (!revoking) return;
    setError(null);
    setBusy(true);
    try {
      const { pinsReset } = await revoke({ venueId, deviceId: revoking._id });
      toast.success(
        pinsReset > 0
          ? `« ${revoking.label} » révoqué. ${pinsReset > 1 ? `${pinsReset} personnes devront réactiver leur PIN` : "1 personne devra réactiver son PIN"}.`
          : `« ${revoking.label} » révoqué.`,
      );
      setRevoking(null);
    } catch (e) {
      setError(describeError(e).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Appareils enrôlés</CardTitle>
        <CardDescription>Un appareil enrôlé n'a pas de compte : il est rattaché à cet établissement, et à lui seul.</CardDescription>
        <CardAction>
          <Button size="sm" onClick={() => setAdding(true)}>
            <Plus data-icon="inline-start" aria-hidden="true" />
            Ajouter un appareil
          </Button>
        </CardAction>
      </CardHeader>
      <CardContent>
        {devices === undefined ? (
          <LoadingState />
        ) : devices.length === 0 ? (
          <EmptyState
            title={<h3>Aucun appareil pour l'instant</h3>}
            description="Enrôlez la tablette de salle pour que l'équipe s'y identifie avec son PIN, ou l'écran qui affichera les bons en cuisine."
          />
        ) : (
          <ItemGroup className="gap-3">
            {devices.map((device) => {
              const Icon = ICONS[device.deviceType];
              const suspended = device.pinSuspendedUntil !== null && device.pinSuspendedUntil > now;
              return (
                <Item key={device._id} variant="outline" role="listitem">
                  <ItemMedia variant="icon">
                    <Icon aria-hidden="true" />
                  </ItemMedia>
                  <ItemContent className="min-w-0">
                    <ItemTitle className="max-w-full truncate">{device.label}</ItemTitle>
                    <ItemDescription>
                      {DEVICE_TYPES[device.deviceType].label}
                      {device.station ? ` · poste ${device.station}` : device.owner ? ` · appartient à ${device.owner}` : ""}
                    </ItemDescription>
                  </ItemContent>
                  <ItemActions>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setError(null);
                        setRevoking(device);
                      }}
                    >
                      Révoquer
                    </Button>
                  </ItemActions>
                  <ItemFooter className="flex-wrap justify-start gap-1">
                    {suspended ? (
                      <Badge variant="destructive">Saisie des PIN suspendue jusqu'à {timeFormat.format(device.pinSuspendedUntil!)}</Badge>
                    ) : (
                      <Badge variant="secondary">Actif</Badge>
                    )}
                    <Badge variant="outline">
                      {device.lastSeenAt !== null ? `Vu ${ago(device.lastSeenAt, now)}` : "Jamais vu"}
                    </Badge>
                    <Badge variant="outline">Enrôlé le {dateFormat.format(device.enrolledAt)}</Badge>
                  </ItemFooter>
                </Item>
              );
            })}
          </ItemGroup>
        )}
      </CardContent>

      <DeviceEnrollmentDialog
        venueId={venueId}
        open={adding}
        onOpenChange={setAdding}
        canReadStations={canReadStations}
        canReadTeam={canReadTeam}
      />
      <AlertDialog
        open={revoking !== null}
        onOpenChange={(open) => {
          if (!open) {
            setRevoking(null);
            setError(null);
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Révoquer « {revoking?.label} » ?</AlertDialogTitle>
            <AlertDialogDescription>
              L'appareil perd l'accès immédiatement et les sessions ouvertes dessus sont fermées. Les personnes qui y ont saisi leur PIN
              depuis 12 heures devront le réactiver avec un nouveau code : l'appareil a pu être observé ou emporté. Pour le réutiliser,
              il faudra l'enrôler de nouveau.
            </AlertDialogDescription>
          </AlertDialogHeader>
          {error ? (
            <Alert variant="destructive">
              <CircleAlert />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          ) : null}
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <PendingButton variant="destructive" pending={busy} pendingText="Révocation…" onClick={() => void confirmRevoke()}>
              Révoquer
            </PendingButton>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}
