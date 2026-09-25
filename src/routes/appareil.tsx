import { useCallback, useMemo } from "react";
import { createFileRoute, Outlet, useNavigate } from "@tanstack/react-router";
import type { Id } from "../../convex/_generated/dataModel";
import { LoadingState } from "~/components/app/states";
import { DeviceProvider, useDevice } from "~/components/device/device-session";
import { DeviceFrame, EnrollScreen, LockScreen } from "~/components/device/device-screens";
import { KdsBoard } from "~/components/service/kds-board";
import { OutboxProvider } from "~/components/service/outbox-provider";
import { ServiceScopeProvider, type ServiceNav } from "~/components/service/service-scope";
import { Toaster } from "~/components/ui/sonner";
import { TooltipProvider } from "~/components/ui/tooltip";
import { useHydrated } from "~/lib/use-hydrated";

/**
 * Un appareil de l'établissement : tablette de salle, téléphone d'un serveur, écran de cuisine.
 * Pas de compte : l'appareil est enrôlé une fois par un gérant, puis chacun s'y identifie par
 * son PIN (D-060). Tout se passe dans le navigateur — le jeton d'appareil vit sur l'appareil.
 */
export const Route = createFileRoute("/appareil")({
  head: () => ({ meta: [{ title: "Joliba — appareil" }, { name: "robots", content: "noindex, nofollow" }] }),
  component: DevicePage,
});

function DevicePage() {
  const hydrated = useHydrated();
  if (!hydrated) {
    return (
      <DeviceFrame>
        <LoadingState />
      </DeviceFrame>
    );
  }
  return (
    <TooltipProvider>
      <DeviceProvider>
        <DeviceGate />
      </DeviceProvider>
      <Toaster position="top-center" />
    </TooltipProvider>
  );
}

function DeviceGate() {
  const device = useDevice();
  const navigate = useNavigate();
  const board = useCallback(() => void navigate({ to: "/appareil" }), [navigate]);
  const table = useCallback((tableId: Id<"restaurantTables">) => void navigate({ to: "/appareil/table/$tableId", params: { tableId } }), [navigate]);
  const cash = useCallback(() => void navigate({ to: "/appareil/caisse" }), [navigate]);
  const nav = useMemo<ServiceNav>(() => ({ board, table, cash }), [board, table, cash]);
  const lock = useCallback(() => {
    device.lock();
    board();
  }, [device, board]);

  if (!device.deviceToken || device.revoked) return <EnrollScreen />;
  if (!device.roster) {
    return (
      <DeviceFrame>
        <LoadingState />
      </DeviceFrame>
    );
  }
  const venueId = device.roster.venueId;

  if (device.roster.deviceType === "kds") {
    if (!device.kdsReady || !device.roster.stationId) {
      return (
        <DeviceFrame>
          <LoadingState label="Connexion de l'écran de cuisine…" />
        </DeviceFrame>
      );
    }
    return (
      <ServiceScopeProvider venueId={venueId} nav={nav} fallback={<LoadingState />}>
        <OutboxProvider>
          <main className="min-h-dvh bg-background p-4">
            <KdsBoard stationId={device.roster.stationId} />
          </main>
        </OutboxProvider>
      </ServiceScopeProvider>
    );
  }

  if (!device.operator) return <LockScreen />;
  return (
    <ServiceScopeProvider venueId={venueId} nav={nav} lock={lock} fallback={<LoadingState />}>
      <OutboxProvider>
        <main className="mx-auto min-h-dvh w-full max-w-4xl bg-background p-4">
          <Outlet />
        </main>
      </OutboxProvider>
    </ServiceScopeProvider>
  );
}
