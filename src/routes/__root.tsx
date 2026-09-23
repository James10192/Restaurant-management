import type { ReactNode } from "react";
import { HeadContent, Outlet, Scripts, createRootRouteWithContext } from "@tanstack/react-router";
import fontUrl from "@fontsource-variable/archivo/files/archivo-latin-wght-normal.woff2?url";
import appCss from "~/styles/app.css?url";
import { ConvexProviders } from "~/components/app/convex-providers";
import { RouteError } from "~/components/app/route-error";
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
  errorComponent: ({ error, reset }) => (
    <main className="mx-auto flex min-h-dvh max-w-md items-center px-4">
      <RouteError error={error} reset={reset} />
    </main>
  ),
});

function RootComponent() {
  const { convex } = Route.useRouteContext();
  return (
    <RootDocument>
      <ConvexProviders client={convex}>
        <Outlet />
      </ConvexProviders>
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
