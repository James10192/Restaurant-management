import type { ComponentProps } from "react";
import { Slot } from "radix-ui";
import { cn } from "../../lib/cn";

/*
 * Conteneur de travail (DESIGN.md §2.3) : fond + bordure d'un pixel, rayon md, aucune
 * ombre — une section ordinaire n'a pas d'ombre, et jamais bordure + ombre ensemble.
 * Le rembourrage suit la densité (--pad-card).
 */
export function Card({ className, ...props }: ComponentProps<"div">) {
  return (
    <div
      className={cn("rounded-md border border-line bg-surface text-ink", className)}
      {...props}
    />
  );
}

export function CardHeader({ className, ...props }: ComponentProps<"div">) {
  return <div className={cn("flex flex-col gap-1 p-(--pad-card)", className)} {...props} />;
}

type CardTitleProps = ComponentProps<"h3"> & {
  /** Rend l'enfant unique à la place du `h3`, pour choisir le niveau de titre. */
  asChild?: boolean;
};

export function CardTitle({ className, asChild = false, ...props }: CardTitleProps) {
  const Comp = asChild ? Slot.Root : "h3";
  return <Comp className={cn("text-title-md text-ink", className)} {...props} />;
}

export function CardDescription({ className, ...props }: ComponentProps<"p">) {
  return <p className={cn("text-body text-ink-2", className)} {...props} />;
}

export function CardContent({ className, ...props }: ComponentProps<"div">) {
  return <div className={cn("px-(--pad-card) pb-(--pad-card)", className)} {...props} />;
}

export function CardFooter({ className, ...props }: ComponentProps<"div">) {
  return (
    <div
      className={cn("flex flex-wrap items-center gap-2 px-(--pad-card) pb-(--pad-card)", className)}
      {...props}
    />
  );
}
