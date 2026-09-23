import type { ReactNode } from "react";
import { HeadContent, Outlet, Scripts, createRootRouteWithContext } from "@tanstack/react-router";
import fontUrl from "@fontsource-variable/archivo/files/archivo-latin-wght-normal.woff2?url";
import appCss from "~/styles/app.css?url";
import type { RouterContext } from "~/router";

export const Route = createRootRouteWithContext<RouterContext>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1, viewport-fit=cover" },
      { title: "Joliba" },
      { name: "description", content: "Joliba, le système d'exploitation du restaurant." },
      { name: "theme-color", content: "#FAF8F5" },
      { name: "format-detection", content: "telephone=no" },
    ],
    links: [
      // Une seule fonte, préchargée : elle conditionne le premier affichage (DESIGN.md §2.2).
      { rel: "preload", href: fontUrl, as: "font", type: "font/woff2", crossOrigin: "anonymous" },
      { rel: "stylesheet", href: appCss },
      { rel: "icon", type: "image/svg+xml", href: "/favicon.svg" },
    ],
  }),
  component: RootComponent,
  notFoundComponent: NotFound,
  // Volontairement nu : tout ce que la racine importe est téléchargé par CHAQUE page, carte du
  // client comprise. Les écrans d'erreur riches vivent dans les mises en page qui s'en servent.
  errorComponent: RootError,
});

function RootComponent() {
  return (
    <RootDocument>
      <Outlet />
    </RootDocument>
  );
}

function RootDocument({ children }: { children: ReactNode }) {
  return (
    <html lang="fr">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function NotFound() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col items-center justify-center gap-3 px-4 text-center">
      <p className="text-label text-ink-3">Erreur 404</p>
      <h1 className="text-title-xl text-ink">Cette page n'existe pas</h1>
      <p className="text-body text-ink-2">Le lien est peut-être incomplet, ou la page a été déplacée.</p>
      <a href="/" className="text-body text-accent-700 underline underline-offset-4">
        Revenir à l'accueil
      </a>
    </main>
  );
}

function RootError({ reset }: { reset: () => void }) {
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col items-center justify-center gap-3 px-4 text-center">
      <h1 className="text-title-xl text-ink">Le contenu n'a pas pu être chargé</h1>
      <p className="text-body text-ink-2">Vérifiez la connexion, puis réessayez.</p>
      <button type="button" onClick={reset} className="h-11 rounded-sm bg-accent-600 px-5 text-label text-on-fill">
        Réessayer
      </button>
    </main>
  );
}
