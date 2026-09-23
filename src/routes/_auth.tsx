import { useState } from "react";
import { createFileRoute, Outlet } from "@tanstack/react-router";
import { ConvexProviders } from "~/components/app/convex-providers";
import { RouteError } from "~/components/app/route-error";
import { createConvexClient } from "~/lib/convex-client";

/**
 * Tout ce qui demande une session de PERSONNEL : connexion, code, invitation, application.
 *
 * Le fournisseur d'authentification vit ici et non à la racine : la carte du client, elle,
 * n'a pas de compte, et n'a pas à télécharger le client d'authentification — c'est une
 * vingtaine de kilo-octets sur une 4G bridée (budget de DESIGN.md §5). Mettre ces routes sous
 * une même mise en page garde UN seul fournisseur de la connexion à l'application : passer de
 * « /connexion » à « /app » ne le remonte pas.
 */
export const Route = createFileRoute("/_auth")({
  component: AuthLayout,
  errorComponent: ({ error, reset }) => (
    <main className="mx-auto flex min-h-dvh max-w-md items-center px-4">
      <RouteError error={error} reset={reset} />
    </main>
  ),
});

function AuthLayout() {
  const [convex] = useState(createConvexClient);
  return (
    <ConvexProviders client={convex}>
      <Outlet />
    </ConvexProviders>
  );
}
