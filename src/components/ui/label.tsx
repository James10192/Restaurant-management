import type { ComponentProps } from "react";
import { Label as LabelPrimitive } from "radix-ui";
import { cn } from "../../lib/cn";

/*
 * Libellé toujours au-dessus du contrôle (§6.6). 13 px en Exploitation ;
 * relevé au plancher de chaque densité : 15 px en Salle, 17 px sur le KDS (§2.2).
 */
export function Label({ className, ...props }: ComponentProps<typeof LabelPrimitive.Root>) {
  return (
    <LabelPrimitive.Root
      className={cn(
        "text-label text-ink in-data-[density=guest]:text-body in-data-[density=kds]:text-title-md",
        "select-none peer-disabled:cursor-not-allowed peer-disabled:text-ink-disabled",
        className,
      )}
      {...props}
    />
  );
}
