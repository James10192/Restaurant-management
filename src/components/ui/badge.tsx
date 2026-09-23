import type { ComponentProps } from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "../../lib/cn";

/*
 * Badge de statut — DESIGN.md §9.5 et R-D3 : couleur + forme + mot, jamais moins.
 * Fond -50, texte -700 (≥ 7:1). Hauteur 24 / 28 / 32 px selon la densité, et libellé
 * relevé au plancher de chaque densité (15 px Salle, 17 px KDS).
 */
export const badgeVariants = cva(
  [
    "inline-flex h-6 shrink-0 items-center gap-1.5 rounded-xs px-2 whitespace-nowrap text-label",
    "in-data-[density=guest]:h-7 in-data-[density=guest]:text-body",
    "in-data-[density=kds]:h-8 in-data-[density=kds]:text-title-md",
  ],
  {
    variants: {
      variant: {
        neutral: "bg-surface-2 text-ink",
        accent: "bg-accent-50 text-accent-700",
        success: "bg-success-50 text-success-700",
        warning: "bg-warning-50 text-warning-700",
        danger: "bg-danger-50 text-danger-700",
      },
    },
    defaultVariants: { variant: "neutral" },
  },
);

/** Glyphes dessinés de R-D3 : lisibles à 12 px sur une dalle médiocre, contrairement à une icône à trait fin. */
export type BadgeGlyph = "○" | "◐" | "●" | "▲" | "◆" | "✕";

const DEFAULT_GLYPH: Record<NonNullable<BadgeProps["variant"]>, BadgeGlyph> = {
  neutral: "○",
  accent: "◆",
  success: "●",
  warning: "◐",
  danger: "▲",
};

export type BadgeProps = ComponentProps<"span"> &
  VariantProps<typeof badgeVariants> & {
    /**
     * Glyphe de forme. Par défaut celui de la variante (○ ◆ ● ◐ ▲). `false` le retire :
     * réservé aux puces qui ne sont pas un statut (« Nouveau », §5.1).
     */
    glyph?: BadgeGlyph | false;
  };

export function Badge({ className, variant, glyph, children, ...props }: BadgeProps) {
  const shown = glyph === undefined ? DEFAULT_GLYPH[variant ?? "neutral"] : glyph;
  return (
    <span className={cn(badgeVariants({ variant }), className)} {...props}>
      {shown ? <GlyphShape glyph={shown} /> : null}
      {children}
    </span>
  );
}

/**
 * Les glyphes sont DESSINÉS, pas tapés : un caractère comme ◐ n'existe pas dans Archivo et
 * s'affiche différemment (ou pas du tout) selon la police de secours du téléphone. Un SVG
 * rend la même forme partout, à 12 px, dans la couleur du texte.
 */
export function GlyphShape({ glyph, className }: { glyph: BadgeGlyph; className?: string }) {
  const common = { "aria-hidden": true, viewBox: "0 0 12 12", className: cn("size-3 shrink-0", className) } as const;
  switch (glyph) {
    case "○":
      return (
        <svg {...common}>
          <circle cx="6" cy="6" r="4.5" fill="none" stroke="currentColor" strokeWidth="1.5" />
        </svg>
      );
    case "●":
      return (
        <svg {...common}>
          <circle cx="6" cy="6" r="5" fill="currentColor" />
        </svg>
      );
    case "◐":
      return (
        <svg {...common}>
          <circle cx="6" cy="6" r="4.5" fill="none" stroke="currentColor" strokeWidth="1.5" />
          <path d="M6 1.5a4.5 4.5 0 0 0 0 9z" fill="currentColor" />
        </svg>
      );
    case "▲":
      return (
        <svg {...common}>
          <path d="M6 1 11.2 10.5H.8z" fill="currentColor" />
        </svg>
      );
    case "◆":
      return (
        <svg {...common}>
          <path d="M6 .8 11.2 6 6 11.2.8 6z" fill="currentColor" />
        </svg>
      );
    case "✕":
      return (
        <svg {...common}>
          <path d="M2.5 2.5l7 7m0-7-7 7" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
        </svg>
      );
  }
}
