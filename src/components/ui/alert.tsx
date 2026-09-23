import type { ComponentProps } from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "../../lib/cn";
import { GlyphShape, type BadgeGlyph } from "./badge";

/*
 * Bandeau d'information dans le flux de la page. Fond -50, texte -700 (≥ 7:1, §2.1),
 * glyphe dessiné de R-D3 pour que le sens ne tienne pas à la seule couleur.
 */
export const alertVariants = cva(
  "flex w-full items-start gap-3 rounded-md border p-(--pad-card) text-body",
  {
    variants: {
      variant: {
        info: "border-accent-600/25 bg-accent-50 text-accent-700",
        success: "border-success-600/25 bg-success-50 text-success-700",
        warning: "border-warning-600/30 bg-warning-50 text-warning-700",
        danger: "border-danger-600/30 bg-danger-50 text-danger-700",
      },
    },
    defaultVariants: { variant: "info" },
  },
);

const GLYPH: Record<"info" | "success" | "warning" | "danger", { char: BadgeGlyph; className: string }> = {
  info: { char: "◆", className: "text-accent-600" },
  success: { char: "●", className: "text-success-600" },
  warning: { char: "◐", className: "text-warning-600" },
  danger: { char: "▲", className: "text-danger-600" },
} as const;

export type AlertProps = ComponentProps<"div"> & VariantProps<typeof alertVariants>;

export function Alert({ className, variant, role, children, ...props }: AlertProps) {
  const tone = variant ?? "info";
  const glyph = GLYPH[tone];
  return (
    <div
      // Seul le danger est annoncé d'autorité ; le reste l'est poliment (§12.1, ligne 23).
      role={role ?? (tone === "danger" ? "alert" : "status")}
      className={cn(alertVariants({ variant }), className)}
      {...props}
    >
      <span aria-hidden="true" className={cn("flex h-6 shrink-0 items-center", glyph.className)}>
        <GlyphShape glyph={glyph.char} className="size-3.5" />
      </span>
      <div className="flex min-w-0 flex-1 flex-col gap-1">{children}</div>
    </div>
  );
}

export function AlertTitle({ className, ...props }: ComponentProps<"p">) {
  return <p className={cn("font-semibold", className)} {...props} />;
}

export function AlertDescription({ className, ...props }: ComponentProps<"div">) {
  return <div className={cn("text-body", className)} {...props} />;
}
