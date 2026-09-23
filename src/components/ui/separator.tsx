import type { ComponentProps } from "react";
import { Separator as SeparatorPrimitive } from "radix-ui";
import { cn } from "../../lib/cn";

/** Séparateur `line` d'un pixel. Décoratif par défaut : il ne structure rien pour un lecteur d'écran. */
export function Separator({
  className,
  orientation = "horizontal",
  decorative = true,
  ...props
}: ComponentProps<typeof SeparatorPrimitive.Root>) {
  return (
    <SeparatorPrimitive.Root
      orientation={orientation}
      decorative={decorative}
      className={cn(
        "shrink-0 bg-line",
        orientation === "horizontal" ? "h-px w-full" : "h-full w-px",
        className,
      )}
      {...props}
    />
  );
}
