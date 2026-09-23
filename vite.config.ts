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
      },
    }),
    viteReact(),
  ],
}));
