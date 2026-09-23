import { defineConfig } from "vitest/config";

/**
 * Configuration de test SÉPARÉE de `vite.config.ts` : les tests Convex n'ont besoin ni
 * du plugin TanStack Start ni de Nitro. `convex-test` exécute les fonctions Convex en
 * mémoire, dans le runtime edge qui imite celui de Convex.
 */
export default defineConfig({
  test: {
    include: ["tests/**/*.test.ts"],
    environment: "edge-runtime",
    server: { deps: { inline: ["convex-test"] } },
  },
});
