import type { ComponentProps } from "react";
import { Dialog as DialogPrimitive } from "radix-ui";
import { X } from "lucide-react";
import { cn } from "../../lib/cn";

/*
 * Modale — DESIGN.md §9.3. Réservée à une décision qui engage et ne peut pas attendre
 * (« une modale coûte une décision »). Consulter ou composer se fait dans un panneau
 * latéral ou un bottom sheet, pas ici.
 * Centrée à toutes les tailles, 480 px plafonnés à 90 vw, voile `--scrim`.
 * Fermeture par l'un des deux boutons du pied ou `Échap` : un clic sur le voile ne
 * ferme pas, pour qu'une décision ne se perde pas sur un tap maladroit.
 */
export const Dialog = DialogPrimitive.Root;
export const DialogTrigger = DialogPrimitive.Trigger;
export const DialogClose = DialogPrimitive.Close;
export const DialogPortal = DialogPrimitive.Portal;

export function DialogOverlay({
  className,
  ...props
}: ComponentProps<typeof DialogPrimitive.Overlay>) {
  return (
    <DialogPrimitive.Overlay
      className={cn(
        "fixed inset-0 z-(--z-scrim) bg-(--scrim)",
        "data-[state=open]:animate-overlay-in data-[state=closed]:animate-overlay-out",
        className,
      )}
      {...props}
    />
  );
}

export type DialogContentProps = ComponentProps<typeof DialogPrimitive.Content> & {
  /**
   * Ajoute un bouton « Fermer » (×, zone de --tap) en haut à droite. Désactivé par
   * défaut : une modale se quitte par son bouton de renoncement (§9.3).
   */
  showCloseButton?: boolean;
  /** Autorise la fermeture par un clic hors de la modale. Désactivé par défaut (§9.3). */
  closeOnOutsideClick?: boolean;
};

export function DialogContent({
  className,
  children,
  showCloseButton = false,
  closeOnOutsideClick = false,
  onInteractOutside,
  ...props
}: DialogContentProps) {
  return (
    <DialogPortal>
      <DialogOverlay />
      <DialogPrimitive.Content
        onInteractOutside={(event) => {
          onInteractOutside?.(event);
          if (!closeOnOutsideClick) event.preventDefault();
        }}
        className={cn(
          "fixed top-1/2 left-1/2 z-(--z-overlay) -translate-1/2",
          "flex max-h-[calc(100dvh-32px)] w-[min(480px,90vw)] flex-col overflow-y-auto",
          "rounded-md bg-surface p-(--pad-card) text-ink shadow-e2 in-data-[density=guest]:rounded-lg",
          // En sombre, l'ombre ne se voit plus : un liseré prend le relais pour tenir le bord.
          "dark:border dark:border-line",
          "data-[state=open]:animate-dialog-in data-[state=closed]:animate-dialog-out",
          showCloseButton && "pr-[calc(var(--tap)+8px)]",
          className,
        )}
        {...props}
      >
        {children}
        {showCloseButton ? (
          <DialogPrimitive.Close
            aria-label="Fermer"
            className={cn(
              "absolute top-1 right-1 inline-flex size-(--tap) items-center justify-center rounded-sm",
              "text-ink-2 transition-colors duration-(--m-fast) hover:bg-surface-2 hover:text-ink",
            )}
          >
            <X aria-hidden="true" className="size-5" />
          </DialogPrimitive.Close>
        ) : null}
      </DialogPrimitive.Content>
    </DialogPortal>
  );
}

export function DialogHeader({ className, ...props }: ComponentProps<"div">) {
  return <div className={cn("flex flex-col gap-2", className)} {...props} />;
}

/** Le titre est la question : « Annuler cette commande ? » (§9.3). */
export function DialogTitle({ className, ...props }: ComponentProps<typeof DialogPrimitive.Title>) {
  return (
    <DialogPrimitive.Title className={cn("text-title-lg text-ink", className)} {...props} />
  );
}

/** Le corps est la conséquence, en une phrase, avec les faits (§9.3). */
export function DialogDescription({
  className,
  ...props
}: ComponentProps<typeof DialogPrimitive.Description>) {
  return (
    <DialogPrimitive.Description className={cn("text-body text-ink-2", className)} {...props} />
  );
}

/**
 * Deux boutons : `quiet` à gauche pour renoncer, `primary` ou `danger-solid` à droite —
 * jamais deux boutons pleins (§9.3). L'ordre du DOM est l'ordre visuel.
 */
export function DialogFooter({ className, ...props }: ComponentProps<"div">) {
  return (
    <div
      className={cn("mt-6 flex flex-wrap items-center justify-end gap-2", className)}
      {...props}
    />
  );
}
