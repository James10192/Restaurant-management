import type { ReactNode } from "react";
import { Field, FieldContent, FieldDescription, FieldLabel, FieldTitle } from "~/components/ui/field";
import { RadioGroupItem } from "~/components/ui/radio-group";

/** Le motif « Choice Card » de shadcn/ui : une option de `RadioGroup` avec titre et explication. */
export function RadioChoice({
  id,
  value,
  title,
  description,
  disabled,
}: {
  id: string;
  value: string;
  title: ReactNode;
  description: ReactNode;
  disabled?: boolean;
}) {
  return (
    <FieldLabel htmlFor={id}>
      <Field orientation="horizontal" data-disabled={disabled || undefined}>
        <FieldContent>
          <FieldTitle>{title}</FieldTitle>
          <FieldDescription>{description}</FieldDescription>
        </FieldContent>
        <RadioGroupItem id={id} value={value} disabled={disabled} />
      </Field>
    </FieldLabel>
  );
}
