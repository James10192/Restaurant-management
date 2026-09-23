import { useId, type ComponentProps, type ReactElement, type ReactNode } from "react";
import { Slot } from "radix-ui";
import { cn } from "../../lib/cn";
import { Label } from "./label";

export type FieldProps = Omit<ComponentProps<"div">, "children"> & {
  /** Libellé visible, toujours au-dessus du contrôle (§6.6). */
  label: ReactNode;
  /** Identifiant du contrôle ; généré sinon. À passer ici, pas sur l'enfant. */
  controlId?: string;
  /** Aide affichée sous le champ, avant la saisie. */
  description?: ReactNode;
  /** Message d'erreur. Sa présence pose `aria-invalid` sur le contrôle. */
  error?: ReactNode;
  /**
   * Marque le champ « (facultatif) ». Ce sont les facultatifs qu'on marque, pas les
   * obligatoires (§6.6).
   */
  optional?: boolean;
  /** Un contrôle unique : Input, Textarea, OtpInput, select natif… */
  children: ReactElement;
};

/**
 * Libellé + contrôle + aide + erreur. Relie `htmlFor`, `id`, `aria-describedby` et
 * `aria-invalid` sans que l'appelant ait à gérer les identifiants.
 * La validation se déclenche à la sortie du champ, jamais à la frappe (§6.6) : c'est à
 * l'appelant de ne passer `error` qu'après `blur` ou soumission.
 */
export function Field({
  label,
  controlId,
  description,
  error,
  optional = false,
  className,
  children,
  ...props
}: FieldProps) {
  const generatedId = useId();
  const id = controlId ?? `${generatedId}-control`;
  const descriptionId = `${id}-description`;
  const errorId = `${id}-error`;
  const hasError = error !== undefined && error !== null && error !== false && error !== "";

  const describedBy =
    [hasError ? errorId : null, description ? descriptionId : null].filter(Boolean).join(" ") ||
    undefined;

  return (
    <div className={cn("flex w-full flex-col", className)} {...props}>
      <Label htmlFor={id} className="mb-1.5">
        {label}
        {optional ? <span className="font-normal text-ink-3"> (facultatif)</span> : null}
      </Label>

      <Slot.Root id={id} aria-describedby={describedBy} aria-invalid={hasError || undefined}>
        {children}
      </Slot.Root>

      {description ? (
        <p
          id={descriptionId}
          className="mt-1.5 text-label font-normal text-ink-4 in-data-[density=guest]:text-body"
        >
          {description}
        </p>
      ) : null}

      {/* Région vivante toujours présente, pour que l'apparition du message soit annoncée. */}
      <div aria-live="polite">
        {hasError ? (
          <p
            id={errorId}
            className="mt-1.5 text-label text-danger-700 in-data-[density=guest]:text-body"
          >
            {error}
          </p>
        ) : null}
      </div>
    </div>
  );
}
