import { useState, type ComponentProps } from "react";
import { PendingButton } from "~/components/app/pending-button";
import { useOptionalOutbox } from "./outbox-provider";

/**
 * Un bouton qui attend la fin de son geste : désactivé pendant l'appel, un second appui ne part
 * pas. Ces gestes-là ne passent PAS par la file (clôturer, annuler, valider, importer) : sans
 * réseau, le bouton est désactivé, sans quoi le client Convex les garderait en mémoire et les
 * appliquerait des minutes plus tard, à l'insu de tous (D-062 : aucune clôture hors ligne).
 */
export function ActionButton({
  onAction,
  disabled,
  ...props
}: Omit<ComponentProps<typeof PendingButton>, "onClick" | "pending"> & { onAction: () => Promise<unknown> }) {
  const [pending, setPending] = useState(false);
  const online = useOptionalOutbox()?.online ?? true;
  return (
    <PendingButton
      {...props}
      disabled={disabled || !online}
      title={online ? props.title : "Sans réseau : ce geste attend la connexion."}
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
