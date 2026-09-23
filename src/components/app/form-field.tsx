import { useId, type ReactElement, type ReactNode } from "react";
import { Slot } from "radix-ui";
import { Field, FieldDescription, FieldError, FieldLabel } from "~/components/ui/field";

/**
 * Libellé + contrôle + aide + erreur, assemblés avec le `Field` de shadcn/ui. Relie `htmlFor`,
 * `id`, `aria-describedby` et `aria-invalid` sans que l'appelant ait à gérer les identifiants.
 * On marque les champs facultatifs, jamais les obligatoires.
 */
export function FormField({
  label,
  controlId,
  description,
  error,
  optional = false,
  className,
  children,
}: {
  label: ReactNode;
  controlId?: string;
  description?: ReactNode;
  error?: ReactNode;
  optional?: boolean;
  className?: string;
  children: ReactElement;
}) {
  const generated = useId();
  const id = controlId ?? `${generated}-control`;
  const hasError = error !== undefined && error !== null && error !== false && error !== "";
  const describedBy = [hasError ? `${id}-error` : null, description ? `${id}-description` : null].filter(Boolean).join(" ") || undefined;
  return (
    <Field data-invalid={hasError || undefined} className={className}>
      <FieldLabel htmlFor={id}>
        {label}
        {optional ? <span className="font-normal text-muted-foreground"> (facultatif)</span> : null}
      </FieldLabel>
      <Slot.Root id={id} aria-describedby={describedBy} aria-invalid={hasError || undefined}>
        {children}
      </Slot.Root>
      {description ? <FieldDescription id={`${id}-description`}>{description}</FieldDescription> : null}
      <div aria-live="polite" className="empty:absolute">{hasError ? <FieldError id={`${id}-error`}>{error}</FieldError> : null}</div>
    </Field>
  );
}
