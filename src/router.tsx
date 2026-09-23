import { createRouter } from "@tanstack/react-router";
import { routeTree } from "./routeTree.gen";

/** Rien dans le contexte du routeur : ce qu'il porte, chaque page le télécharge. */
export type RouterContext = Record<string, never>;

export function getRouter() {
  return createRouter({
    routeTree,
    context: {} satisfies RouterContext,
    scrollRestoration: true,
    defaultPreload: "intent",
  });
}

declare module "@tanstack/react-router" {
  interface Register {
    router: ReturnType<typeof getRouter>;
  }
}
