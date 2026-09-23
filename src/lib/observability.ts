/**
 * Signalement d'une erreur survenue dans le navigateur. Renvoie le `traceId` que l'écran
 * affiche : c'est lui que l'utilisateur lit au support, et lui qui relie son écran à la
 * ligne de journal (DEPLOYMENT.md §6). Le message est celui de l'erreur, pas les données
 * saisies.
 */
export function reportError(error: unknown, context: { operation?: string } = {}): string {
  const traceId = typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : String(Date.now());
  if (typeof window === "undefined") return traceId;
  const payload = JSON.stringify({
    traceId,
    route: window.location.pathname,
    operation: context.operation,
    message: error instanceof Error ? error.message : String(error),
  });
  try {
    const sent = navigator.sendBeacon?.("/api/client-errors", new Blob([payload], { type: "application/json" }));
    if (!sent) void fetch("/api/client-errors", { method: "POST", body: payload, keepalive: true });
  } catch {
    /* le signalement ne doit jamais provoquer une seconde erreur */
  }
  return traceId;
}
