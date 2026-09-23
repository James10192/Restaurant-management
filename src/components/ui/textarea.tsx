import type { ComponentProps } from "react";
import { cn } from "../../lib/cn";
import { FieldErrorGlyph, fieldControlClasses, isInvalid } from "./input";

export type TextareaProps = ComponentProps<"textarea">;

/** Même apparence que `Input` (§9.2) ; trois lignes par défaut (§5.2, instruction libre). */
export function Textarea({ className, rows = 3, ...props }: TextareaProps) {
  const invalid = isInvalid(props["aria-invalid"]);
  return (
    <div className="relative w-full">
      <textarea
        rows={rows}
        className={cn(
          fieldControlClasses,
          "min-h-(--control-h) resize-y px-(--pad-x) py-2.5",
          invalid && "pr-10",
          className,
        )}
        {...props}
      />
      {invalid ? <FieldErrorGlyph className="top-3" /> : null}
    </div>
  );
}
