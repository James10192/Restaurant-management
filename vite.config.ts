import { defineConfig } from "vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import viteReact from "@vitejs/plugin-react";
import { nitro } from "nitro/vite";
import viteTsConfigPaths from "vite-tsconfig-paths";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig(({ command }) => ({
  server: { port: 3000 },
  // Une seule copie de React au rendu serveur : sans cela, les bibliothèques Convex et
  // Better Auth, externalisées, résolvent une seconde instance (« more than one copy »).
  resolve: { dedupe: ["react", "react-dom"] },
  build: {
    rollupOptions: {
      treeshake: {
        // `convex/_generated/api.js` n'a pas d'effet de bord, mais Rollup ne peut pas le savoir
        // (il appelle une fabrique de Proxy). Sans cette indication, un simple import devenu
        // inutile après le découpage des routes suffit à embarquer ~9 Ko dans CHAQUE page.
        moduleSideEffects: (id) => !id.endsWith("/convex/_generated/api.js"),
      },
    },
  },
  ssr: {
    noExternal: [
      "convex",
      "@convex-dev/better-auth",
      "@tanstack/react-router",
      "@tanstack/react-start",
      "better-auth",
      "lucide-react",
      "radix-ui",
    ],
  },
  plugins: [
    viteTsConfigPaths({ projects: ["./tsconfig.json"] }),
    tailwindcss(),
    tanstackStart(),
    nitro({
      // Le préréglage Vercel ne concerne que le paquet de production.
      ...(command === "build" ? { preset: process.env.NITRO_PRESET ?? "vercel" } : {}),
      // Fichiers statiques précompressés (gzip, brotli) : un serveur Node les sert tels quels.
      // Vercel compresse de lui-même ; ailleurs, sans cela, le JavaScript part non compressé.
      compressPublicAssets: { gzip: true, brotli: true },
      // En-têtes de sécurité sur toutes les réponses (SECURITY.md). La CSP stricte viendra
      // avec la liste définitive des origines (Convex, PostHog, fournisseurs de paiement).
      routeRules: {
        "/**": {
          headers: {
            "X-Content-Type-Options": "nosniff",
            "X-Frame-Options": "DENY",
            "Referrer-Policy": "strict-origin-when-cross-origin",
            "Permissions-Policy": "camera=(self), microphone=(), geolocation=()",
            "Strict-Transport-Security": "max-age=31536000; includeSubDomains",
          },
        },
        // La surface client à table : jamais indexée, jamais mise en cache par un intermédiaire,
        // jamais de référent (IA §3.0, D-023, D-030). Doublé par la balise `robots` de la page.
        "/r/**": {
          headers: {
            "X-Robots-Tag": "noindex, nofollow, noarchive, nosnippet",
            "Cache-Control": "no-store",
            "Referrer-Policy": "no-referrer",
          },
        },
        // La carte publique : courte durée en cache partagé, la disponibilité arrive en direct.
        "/menu/**": { headers: { "Cache-Control": "public, max-age=0, s-maxage=60, stale-while-revalidate=300" } },
        // Le service worker doit être relu à chaque visite, sinon une correction n'arrive jamais.
        "/sw.js": { headers: { "Cache-Control": "no-cache" } },
        "/assets/**": { headers: { "Cache-Control": "public, max-age=31536000, immutable" } },
      },
    }),
    viteReact(),
  ],
}));
