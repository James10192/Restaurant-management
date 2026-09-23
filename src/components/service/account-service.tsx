import { useCallback, useMemo, type ReactNode } from "react";
import { useNavigate } from "@tanstack/react-router";
import type { Id } from "../../../convex/_generated/dataModel";
import { LoadingState, PermissionDeniedState } from "~/components/app/states";
import { useWorkspace } from "~/components/app/workspace";
import { OutboxProvider } from "./outbox-provider";
import { ServiceScopeProvider, type ServiceNav } from "./service-scope";

/**
 * Les écrans de service pour une personne connectée avec son compte (gérant, serveur qui a
 * son propre téléphone). Même écrans, même file, que sur un appareil partagé.
 */
export function AccountService({ permission, children }: { permission: "table.read" | "kitchen.read"; children: ReactNode }) {
  const workspace = useWorkspace();
  const navigate = useNavigate();
  const board = useCallback(() => void navigate({ to: "/app/service" }), [navigate]);
  const table = useCallback((tableId: Id<"restaurantTables">) => void navigate({ to: "/app/service/table/$tableId", params: { tableId } }), [navigate]);
  const cash = useCallback(() => void navigate({ to: "/app/service/caisse" }), [navigate]);
  const nav = useMemo<ServiceNav>(() => ({ board, table, cash }), [board, table, cash]);
  if (!workspace.venue) return <LoadingState />;
  if (!workspace.canInVenue(permission)) return <PermissionDeniedState />;
  return (
    <ServiceScopeProvider venueId={workspace.venue._id} nav={nav} fallback={<LoadingState />}>
      <OutboxProvider>{children}</OutboxProvider>
    </ServiceScopeProvider>
  );
}
