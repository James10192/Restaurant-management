import type { ComponentProps } from "react";
import { Checkbox as CheckboxPrimitive } from "radix-ui";
import { Check, Minus } from "lucide-react";
import { cn } from "../../lib/cn";

/*
 * Case à cocher : la case visible fait 20 px, la zone active --tap (R-D4). La marge
 * négative garde l'alignement sur 20 px dans la mise en page.
 * Bordure `line-control` (3,82:1, WCAG 1.4.11) ; cochée, aplat accent-600.
 */
export function Checkbox({ className, ...props }: ComponentProps<typeof CheckboxPrimitive.Root>) {
  return (
    <CheckboxPrimitive.Root
      className={cn(
        "group relative inline-flex size-(--tap) shrink-0 items-center justify-center rounded-sm",
        "-m-[calc((var(--tap)-20px)/2)]",
        "focus-visible:shadow-none focus-visible:outline-none disabled:cursor-not-allowed",
        className,
      )}
      {...props}
    >
      <span
        aria-hidden="true"
        className={cn(
          "flex size-5 items-center justify-center rounded-xs border border-line-control bg-surface text-on-fill",
          "transition-colors duration-(--m-fast) ease-out-soft",
          "group-data-[state=checked]:border-accent-600 group-data-[state=checked]:bg-accent-600",
          "group-data-[state=indeterminate]:border-accent-600 group-data-[state=indeterminate]:bg-accent-600",
          "group-aria-invalid:border-danger-600 group-aria-invalid:shadow-[inset_0_0_0_1px_var(--color-danger-600)]",
          // Désactivée, même cochée : fond surface-2 et coche ink-disabled (§9.1).
          "group-disabled:border-line group-disabled:bg-surface-2 group-disabled:text-ink-disabled",
          "group-disabled:group-data-[state=checked]:border-line group-disabled:group-data-[state=checked]:bg-surface-2",
          "group-disabled:group-data-[state=indeterminate]:border-line group-disabled:group-data-[state=indeterminate]:bg-surface-2",
          "group-focus-visible:outline-2 group-focus-visible:outline-offset-2 group-focus-visible:outline-accent-600",
        )}
      >
        <CheckboxPrimitive.Indicator className="flex items-center justify-center">
          <Check strokeWidth={3} className="size-3.5 group-data-[state=indeterminate]:hidden" />
          <Minus strokeWidth={3} className="hidden size-3.5 group-data-[state=indeterminate]:block" />
        </CheckboxPrimitive.Indicator>
      </span>
    </CheckboxPrimitive.Root>
  );
}
