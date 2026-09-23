import type { ComponentProps } from "react";
import { TriangleAlert } from "lucide-react";
import { cn } from "../../lib/cn";

/*
 * Apparence commune des champs de saisie — DESIGN.md §9.2 et §6.6.
 * Bordure 1 px `line-control` (3,82:1). Au focus et en erreur, le second pixel de
 * bordure est une ombre intérieure : l'épaisseur passe à 2 px sans aucun décalage
 * de mise en page. L'anneau blanc de 4 px de la règle globale est conservé.
 * Sur iOS, un champ sous 16 px provoque un zoom à chaque focus : on y monte à 16 px.
 */
export const fieldControlClasses = cn(
  "block w-full min-w-0 rounded-sm border border-line-control bg-surface text-ink",
  "text-(length:--font-base) supports-[-webkit-touch-callout:none]:text-[16px] placeholder:text-ink-4",
  "transition-[border-color,box-shadow] duration-(--m-fast) ease-out-soft",
  "focus-visible:border-accent-600 focus-visible:shadow-[inset_0_0_0_1px_var(--color-accent-600),0_0_0_4px_var(--color-surface)]",
  "aria-invalid:border-danger-600 aria-invalid:shadow-[inset_0_0_0_1px_var(--color-danger-600)]",
  "aria-invalid:focus-visible:shadow-[inset_0_0_0_1px_var(--color-danger-600),0_0_0_4px_var(--color-surface)]",
  "disabled:cursor-not-allowed disabled:border-line disabled:bg-surface-2 disabled:text-ink-disabled",
);

export function isInvalid(value: ComponentProps<"input">["aria-invalid"]): boolean {
  return value === true || value === "true" || value === "grammar" || value === "spelling";
}

/** Glyphe d'erreur dans le champ : le deuxième des trois signaux d'erreur (R-D3, §6.6). */
export function FieldErrorGlyph({ className }: { className?: string }) {
  return (
    <TriangleAlert
      aria-hidden="true"
      strokeWidth={2}
      className={cn("pointer-events-none absolute right-3 size-5 text-danger-600", className)}
    />
  );
}

export type InputProps = ComponentProps<"input">;

export function Input({ className, type = "text", ...props }: InputProps) {
  const invalid = isInvalid(props["aria-invalid"]);
  return (
    <div className="relative w-full">
      <input
        type={type}
        className={cn(fieldControlClasses, "h-(--control-h) px-(--pad-x)", invalid && "pr-10", className)}
        {...props}
      />
      {invalid ? <FieldErrorGlyph className="top-1/2 -translate-y-1/2" /> : null}
    </div>
  );
}
