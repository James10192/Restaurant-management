import { createRouter } from "@tanstack/react-router";
import { ConvexReactClient } from "convex/react";
import { routeTree } from "./routeTree.gen";

export type RouterContext = { convex: ConvexReactClient };

export function getRouter() {
  const convexUrl = import.meta.env.VITE_CONVEX_URL as string | undefined;
  if (!convexUrl) {
    // Échouer tôt et clairement plutôt que d'afficher une application muette.
    throw new Error("VITE_CONVEX_URL est manquant : lancez `pnpm exec convex dev` ou renseignez .env.local.");
  }
  const convex = new ConvexReactClient(convexUrl, { unsavedChangesWarning: false });
  return createRouter({
    routeTree,
    context: { convex } satisfies RouterContext,
    scrollRestoration: true,
    defaultPreload: "intent",
  });
}

declare module "@tanstack/react-router" {
  interface Register {
    router: ReturnType<typeof getRouter>;
  }
}
