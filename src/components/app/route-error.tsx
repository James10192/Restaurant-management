import { useMemo } from "react";
import { Button } from "~/components/ui/button";
import { ErrorState } from "~/components/ui/states";
import { forgetWorkspaceSelection } from "~/components/app/workspace";
import { describeError } from "~/lib/errors";
import { reportError } from "~/lib/observability";

/**
 * Écran d'erreur d'une route : signale l'erreur une fois, et affiche son `traceId`
 * copiable pour que le support retrouve la ligne de journal correspondante.
 *
 * « Introuvable » et « interdit » ne se règlent pas en réessayant : la personne a pu être
 * retirée de l'organisation, ou son rôle changé, pendant qu'elle travaillait. On lui
 * propose de repartir de l'accueil, qui ne montre plus que ce qui lui reste accessible.
 */
export function RouteError({ error, reset }: { error: unknown; reset: () => void }) {
  const described = describeError(error);
  // Une erreur applicative attendue (introuvable, interdit) n'est pas un incident.
  const traceId = useMemo(() => (described.code === "UNKNOWN" ? reportError(error, { operation: "route.render" }) : undefined), [error, described.code]);
  if (described.code === "NOT_FOUND" || described.code === "FORBIDDEN") {
    return (
      <ErrorState
        title="Cet espace ne vous est plus accessible"
        description={`${described.message} Vos accès ont peut-être changé pendant votre session.`}
        action={
          <Button
            onClick={() => {
              forgetWorkspaceSelection();
              // Rechargement complet : les abonnements en cours portent encore l'ancien espace.
              window.location.assign("/app");
            }}
          >
            Revenir à l'accueil
          </Button>
        }
      />
    );
  }
  return <ErrorState description={described.message} onRetry={reset} {...(traceId ? { traceId } : {})} />;
}
