import type { ComponentProps } from "react";
import { DropdownMenu as DropdownMenuPrimitive } from "radix-ui";
import { cn } from "../../lib/cn";

/*
 * Menu — DESIGN.md §2.3 : `z-popover`, élévation e2 (et donc pas de bordure en clair).
 * Chaque entrée fait au moins --tap de haut (R-D4).
 */
export const DropdownMenu = DropdownMenuPrimitive.Root;
export const DropdownMenuTrigger = DropdownMenuPrimitive.Trigger;
export const DropdownMenuGroup = DropdownMenuPrimitive.Group;
export const DropdownMenuPortal = DropdownMenuPrimitive.Portal;

export function DropdownMenuContent({
  className,
  sideOffset = 4,
  collisionPadding = 16,
  ...props
}: ComponentProps<typeof DropdownMenuPrimitive.Content>) {
  return (
    <DropdownMenuPrimitive.Portal>
      <DropdownMenuPrimitive.Content
        sideOffset={sideOffset}
        collisionPadding={collisionPadding}
        className={cn(
          "z-(--z-popover) min-w-48 max-w-[min(20rem,calc(100vw-32px))] overflow-y-auto",
          "max-h-(--radix-dropdown-menu-content-available-height)",
          "rounded-md bg-surface p-1 text-ink shadow-e2",
          // En sombre, l'ombre ne se voit plus : un liseré prend le relais pour tenir le bord.
          "dark:border dark:border-line",
          "data-[state=open]:animate-popover-in data-[state=closed]:animate-popover-out",
          className,
        )}
        {...props}
      />
    </DropdownMenuPrimitive.Portal>
  );
}

type DropdownMenuItemProps = ComponentProps<typeof DropdownMenuPrimitive.Item> & {
  /** Action destructive : texte danger. Elle vit dans le menu, pas en bouton plein (R-D1). */
  variant?: "default" | "danger";
};

export function DropdownMenuItem({
  className,
  variant = "default",
  ...props
}: DropdownMenuItemProps) {
  return (
    <DropdownMenuPrimitive.Item
      className={cn(
        "relative flex min-h-(--tap) cursor-default items-center gap-2 rounded-sm px-3 select-none",
        "text-(length:--font-base) outline-none",
        "[&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-5",
        // L'élément actif doit se voir à 3:1 au moins (§12.1, ligne 2) : fond accent + anneau intérieur.
        "focus-visible:shadow-none data-highlighted:bg-accent-50 data-highlighted:text-accent-700",
        "data-highlighted:outline-2 data-highlighted:-outline-offset-2 data-highlighted:outline-accent-600",
        "data-disabled:pointer-events-none data-disabled:text-ink-disabled",
        variant === "danger"
          ? "text-danger-600 data-highlighted:bg-danger-50 data-highlighted:text-danger-700 data-highlighted:outline-danger-600"
          : "[&_svg]:text-ink-3 data-highlighted:[&_svg]:text-current",
        className,
      )}
      {...props}
    />
  );
}

export function DropdownMenuLabel({
  className,
  ...props
}: ComponentProps<typeof DropdownMenuPrimitive.Label>) {
  return (
    <DropdownMenuPrimitive.Label
      className={cn(
        "px-3 pt-2 pb-1 text-label text-ink-3 in-data-[density=guest]:text-body",
        className,
      )}
      {...props}
    />
  );
}

export function DropdownMenuSeparator({
  className,
  ...props
}: ComponentProps<typeof DropdownMenuPrimitive.Separator>) {
  return (
    <DropdownMenuPrimitive.Separator
      className={cn("-mx-1 my-1 h-px bg-line", className)}
      {...props}
    />
  );
}
