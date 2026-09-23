import type { ComponentProps } from "react";
import { Avatar as AvatarPrimitive } from "radix-ui";
import { User } from "lucide-react";
import { cn } from "../../lib/cn";

const SIZES = {
  sm: "size-8 text-label",
  md: "size-10 text-body font-semibold",
  lg: "size-14 text-title-lg",
} as const;

/** Initiales du premier et du dernier mot : « Aïcha Koné » → « AK ». */
export function initialsOf(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  const first = words[0];
  if (first === undefined) return "";
  const last = words.length > 1 ? words[words.length - 1] : undefined;
  const letter = (word: string) => Array.from(word)[0] ?? "";
  return (letter(first) + (last ? letter(last) : "")).toLocaleUpperCase("fr");
}

export type AvatarProps = Omit<ComponentProps<typeof AvatarPrimitive.Root>, "children"> & {
  /** Nom complet : sert au texte alternatif et aux initiales de repli. */
  name: string;
  src?: string;
  size?: keyof typeof SIZES;
};

/*
 * Avatar rond (rayon full, §2.3). Repli : initiales en `ink` sur `surface-2` — une
 * forme, pas une couleur par personne (§5.6).
 */
export function Avatar({ name, src, size = "md", className, ...props }: AvatarProps) {
  const initials = initialsOf(name);
  return (
    <AvatarPrimitive.Root
      className={cn(
        "relative inline-flex shrink-0 overflow-hidden rounded-full bg-surface-2 text-ink",
        SIZES[size],
        className,
      )}
      {...props}
    >
      {src ? (
        <AvatarPrimitive.Image src={src} alt={name} className="size-full object-cover" />
      ) : null}
      <AvatarPrimitive.Fallback
        role="img"
        aria-label={name}
        delayMs={src ? 300 : undefined}
        className="flex size-full items-center justify-center leading-none"
      >
        {initials === "" ? (
          <User aria-hidden="true" className="size-1/2 text-ink-3" />
        ) : (
          <span aria-hidden="true">{initials}</span>
        )}
      </AvatarPrimitive.Fallback>
    </AvatarPrimitive.Root>
  );
}
