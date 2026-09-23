import { clsx, type ClassValue } from "clsx";
import { extendTailwindMerge } from "tailwind-merge";

/*
 * tailwind-merge ne connaît que l'échelle Tailwind par défaut. Sans cette
 * extension, `text-title-xl` serait pris pour une couleur de texte (et écraserait
 * `text-ink`), et `shadow-e1` pour une couleur d'ombre. Les noms viennent du
 * bloc @theme de src/styles/app.css (DESIGN.md §2.4).
 */
const twMerge = extendTailwindMerge({
  extend: {
    theme: {
      text: ["display", "title-2xl", "title-xl", "title-lg", "title-md", "body", "label", "micro"],
      shadow: ["e1", "e2"],
      ease: ["out-soft", "in-out-soft"],
      animate: [
        "overlay-in",
        "overlay-out",
        "dialog-in",
        "dialog-out",
        "popover-in",
        "popover-out",
      ],
    },
  },
});

export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}
