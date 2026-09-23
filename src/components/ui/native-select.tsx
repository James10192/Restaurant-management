import type { ComponentProps } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "../../lib/cn";
import { fieldControlClasses } from "./input";

/*
 * Liste déroulante NATIVE. Sur téléphone, le sélecteur du système est plus rapide et plus
 * accessible que n'importe quel menu dessiné : on ne le remplace que si la liste exige une
 * recherche ou un regroupement que le natif ne sait pas faire.
 */
export function NativeSelect({ className, children, ...props }: ComponentProps<"select">) {
  return (
    <div className="relative w-full">
      <select
        className={cn(fieldControlClasses, "h-(--control-h) appearance-none pr-10 pl-(--pad-x)", className)}
        {...props}
      >
        {children}
      </select>
      <ChevronDown aria-hidden="true" className="pointer-events-none absolute top-1/2 right-3 size-5 -translate-y-1/2 text-ink-3" />
    </div>
  );
}
