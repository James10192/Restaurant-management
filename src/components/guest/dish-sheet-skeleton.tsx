import { Skeleton } from "~/components/ui/skeleton";
import type { GuestText } from "~/lib/guest/i18n";

/**
 * Ce que voit le client entre son appui et l'arrivée de la fiche (vaul et le Dialog de Radix,
 * téléchargés à part) : la forme du tiroir, tout de suite. Sur une 4G lente, un appui sans effet
 * visible fait appuyer une deuxième fois (D-166). Rien d'interactif : il ne vit que quelques
 * centaines de millisecondes.
 */
export function DishSheetSkeleton({ t, photo }: { t: GuestText; photo: boolean }) {
  return (
    <>
      <div aria-hidden="true" className="fixed inset-0 z-50 bg-black/10" />
      <div role="status" aria-busy="true" className="fixed inset-x-0 bottom-0 z-50 mx-auto flex max-h-[80vh] max-w-2xl flex-col rounded-t-xl border-t bg-popover px-4 pb-6">
        <div className="mx-auto mt-4 h-1 w-[100px] shrink-0 rounded-full bg-muted" />
        <span className="sr-only">{t.loading}</span>
        {photo ? <Skeleton className="mt-4 aspect-[4/3] w-full rounded-lg" /> : null}
        <Skeleton className="mt-4 h-6 w-2/3" />
        <Skeleton className="mt-3 h-4 w-full" />
        <Skeleton className="mt-2 h-4 w-4/5" />
      </div>
    </>
  );
}
