import { useState, type ComponentProps } from "react";
import { PendingButton } from "~/components/app/pending-button";

/** Un bouton qui attend la fin de son geste : désactivé pendant l'appel, un second appui ne part pas. */
export function ActionButton({ onAction, ...props }: Omit<ComponentProps<typeof PendingButton>, "onClick" | "pending"> & { onAction: () => Promise<unknown> }) {
  const [pending, setPending] = useState(false);
  return (
    <PendingButton
      {...props}
      pending={pending}
      onClick={async () => {
        setPending(true);
        try {
          await onAction();
        } finally {
          setPending(false);
        }
      }}
    />
  );
}
