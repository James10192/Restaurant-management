import { useMemo } from "react";
import { ErrorState } from "~/components/ui/states";
import { describeError } from "~/lib/errors";
import { reportError } from "~/lib/observability";

/**
 * Écran d'erreur d'une route : signale l'erreur une fois, et affiche son `traceId`
 * copiable pour que le support retrouve la ligne de journal correspondante.
 */
export function RouteError({ error, reset }: { error: unknown; reset: () => void }) {
  const described = describeError(error);
  // Une erreur applicative attendue (introuvable, interdit) n'est pas un incident.
  const traceId = useMemo(() => (described.code === "UNKNOWN" ? reportError(error, { operation: "route.render" }) : undefined), [error, described.code]);
  return <ErrorState description={described.message} onRetry={reset} {...(traceId ? { traceId } : {})} />;
}
