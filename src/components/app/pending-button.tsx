import type { ComponentProps, ReactNode } from "react";
import { Button } from "~/components/ui/button";
import { Spinner } from "~/components/ui/spinner";

/**
 * Le motif « bouton en cours » de la documentation shadcn/ui : désactivé, un `Spinner` en tête
 * et un libellé qui dit ce qui se passe. Un second clic ne peut pas partir.
 */
export function PendingButton({
  pending = false,
  pendingText,
  disabled,
  children,
  ...props
}: ComponentProps<typeof Button> & { pending?: boolean; pendingText?: ReactNode }) {
  return (
    <Button disabled={pending || disabled} aria-busy={pending || undefined} {...props}>
      {pending ? (
        <>
          <Spinner data-icon="inline-start" />
          {pendingText ?? children}
        </>
      ) : (
        children
      )}
    </Button>
  );
}
