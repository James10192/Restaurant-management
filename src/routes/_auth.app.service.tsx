import { createFileRoute, Outlet } from "@tanstack/react-router";
import { AccountService } from "~/components/service/account-service";

/**
 * La mise en page du service : UNE file d'envoi pour toutes ses pages. Recréée à chaque
 * navigation, elle oublierait depuis quand le réseau manque et relancerait un envoi en cours.
 */
export const Route = createFileRoute("/_auth/app/service")({
  component: () => (
    <AccountService permission="table.read">
      <Outlet />
    </AccountService>
  ),
});
