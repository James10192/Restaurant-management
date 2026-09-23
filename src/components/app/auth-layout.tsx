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

/** Marque provisoire, en attendant le logo : un carré aux couleurs du thème et le nom. */
export function JolibaMark({ className }: { className?: string }) {
  return (
    <div className={`flex items-center gap-2 font-medium ${className ?? ""}`}>
      <div className="flex size-7 items-center justify-center rounded-md bg-primary text-primary-foreground">
        <svg aria-hidden="true" viewBox="0 0 32 32" className="size-5">
          <path d="M6 19c3.5-4 6.5-4 10 0s6.5 4 10 0" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
          <path d="M6 12c3.5-4 6.5-4 10 0s6.5 4 10 0" fill="none" stroke="currentColor" strokeOpacity=".55" strokeWidth="3" strokeLinecap="round" />
        </svg>
      </div>
      Joliba
    </div>
  );
}
