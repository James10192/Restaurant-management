import type { ReactNode } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "~/components/ui/card";

/**
 * Gabarit des écrans non authentifiés (connexion, code, invitation), sur le modèle des blocs
 * « login » de shadcn/ui : la marque au-dessus, une carte centrée, rien d'autre à l'écran.
 */
export function AuthLayout({ title, description, children }: { title: string; description?: ReactNode; children: ReactNode }) {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-6 bg-muted p-6 md:p-10">
      <div className="flex w-full max-w-sm flex-col gap-6">
        <JolibaMark className="self-center" />
        <Card>
          <CardHeader>
            <CardTitle className="text-xl">
              <h1>{title}</h1>
            </CardTitle>
            {description ? <CardDescription>{description}</CardDescription> : null}
          </CardHeader>
          <CardContent>{children}</CardContent>
        </Card>
      </div>
    </main>
  );
}

/** Le logo Joliba (`public/brand/joliba-logo.svg`, vectorisé depuis `docs/brand/source/`). */
export function JolibaMark({ className }: { className?: string }) {
  return <img src="/brand/joliba-logo.svg" alt="Joliba" width={155} height={32} className={`h-8 w-auto ${className ?? ""}`} />;
}
