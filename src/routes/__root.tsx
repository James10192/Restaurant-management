import type { ReactNode } from "react";
import { HeadContent, Outlet, Scripts, createRootRouteWithContext } from "@tanstack/react-router";
import appCss from "~/styles/app.css?url";
import type { RouterContext } from "~/router";
import { buttonVariants } from "~/components/ui/button";

export const Route = createRootRouteWithContext<RouterContext>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1, viewport-fit=cover" },
      { title: "Joliba" },
      { name: "description", content: "Joliba, le système d'exploitation du restaurant." },
      { name: "theme-color", content: "#FFFFFF" },
      { name: "format-detection", content: "telephone=no" },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      { rel: "icon", type: "image/svg+xml", href: "/favicon.svg" },
      { rel: "apple-touch-icon", href: "/apple-touch-icon.png" },
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
      <p className="text-sm text-muted-foreground">Erreur 404</p>
      <h1 className="text-2xl font-semibold tracking-tight">Cette page n'existe pas</h1>
      <p className="text-muted-foreground">Le lien est peut-être incomplet, ou la page a été déplacée.</p>
      <a href="/" className="text-primary underline underline-offset-4">
        Revenir à l'accueil
      </a>
    </main>
  );
}

function RootError({ reset }: { reset: () => void }) {
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col items-center justify-center gap-3 px-4 text-center">
      <h1 className="text-2xl font-semibold tracking-tight">Le contenu n'a pas pu être chargé</h1>
      <p className="text-muted-foreground">Vérifiez la connexion, puis réessayez.</p>
      <button type="button" onClick={reset} className={buttonVariants()}>
        Réessayer
      </button>
    </main>
  );
}
