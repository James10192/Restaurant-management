import type { ReactNode } from "react";

/**
 * Gabarit des écrans non authentifiés (connexion, code, invitation).
 * Mobile : plein écran, une cible à la fois. Bureau : carte centrée de 380 px, rien
 * d'autre à l'écran (INFORMATION_ARCHITECTURE §Connexion).
 */
export function AuthLayout({ title, description, children }: { title: string; description?: ReactNode; children: ReactNode }) {
  return (
    <main className="flex min-h-dvh flex-col bg-bg px-4 py-8 sm:items-center sm:justify-center">
      <div className="w-full sm:max-w-[380px] sm:rounded-md sm:bg-surface sm:p-8 sm:shadow-e1">
        <JolibaMark />
        <h1 className="mt-6 text-title-xl text-ink">{title}</h1>
        {description ? <div className="mt-2 text-body text-ink-2">{description}</div> : null}
        <div className="mt-6">{children}</div>
      </div>
    </main>
  );
}

export function JolibaMark() {
  return (
    <div className="flex items-center gap-2">
      <svg aria-hidden="true" viewBox="0 0 32 32" className="size-8">
        <rect width="32" height="32" rx="8" className="fill-accent-600" />
        <path d="M6 19c3.5-4 6.5-4 10 0s6.5 4 10 0" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" />
        <path d="M6 12c3.5-4 6.5-4 10 0s6.5 4 10 0" fill="none" stroke="white" strokeOpacity=".55" strokeWidth="3" strokeLinecap="round" />
      </svg>
      <span className="text-title-md text-ink">Joliba</span>
    </div>
  );
}
