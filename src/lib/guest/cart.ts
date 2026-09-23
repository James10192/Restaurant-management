/**
 * Le panier du client, côté téléphone — Joliba (D-061, D-068)
 *
 * Le panier vit D'ABORD dans le téléphone (localStorage, un par établissement) : une 4G qui
 * tombe ne doit pas faire perdre ce que le client a composé. Il n'est confié au serveur qu'au
 * geste « Montrer au serveur » ou « Envoyer la commande ». Aucun prix n'est gardé ici : le prix
 * est recalculé à l'affichage depuis la carte, et de nouveau par Convex, qui seul fait foi (R14).
 *
 * La clé d'invité est tirée ici, au hasard, et ne quitte le téléphone que vers Convex, qui n'en
 * garde que le SHA-256. La perdre, c'est seulement repartir d'un panier vide.
 *
 * Module volontairement minuscule : il est chargé avec la carte.
 */

import { useSyncExternalStore } from "react";

export type CartLine = {
  /** Même plat, même variante, mêmes options, même précision : une seule ligne. */
  key: string;
  productId: string;
  variantId?: string;
  optionIds: string[];
  quantity: number;
  instructions?: string;
};

export type DishChoice = Omit<CartLine, "key">;

export type CartState = {
  lines: CartLine[];
  /** Le panier tel qu'il a été confié au serveur (empreinte), et quand. `null` : rien de confié. */
  shownSignature: string | null;
  shownAt: number | null;
  /** Nombre de commandes connues au moment où le panier a été montré : pour reconnaître l'import. */
  shownOrderCount: number | null;
  /** Clé d'idempotence d'un envoi en cours : rejouée telle quelle tant que l'envoi n'a pas abouti. */
  pendingSubmitKey: string | null;
};

const EMPTY: CartState = { lines: [], shownSignature: null, shownAt: null, shownOrderCount: null, pendingSubmitKey: null };
const MAX_QUANTITY = 99;
const MAX_LINES = 30;

let slug: string | null = null;
let state: CartState = EMPTY;
const listeners = new Set<() => void>();

const cartKey = (s: string) => `joliba.panier.${s}`;
const guestKeyKey = (s: string) => `joliba.invite.${s}`;

function lineKey(choice: DishChoice): string {
  return [choice.productId, choice.variantId ?? "", [...choice.optionIds].sort().join(","), (choice.instructions ?? "").trim()].join("|");
}

/** L'empreinte des lignes : un panier modifié après avoir été montré se reconnaît à elle. */
export function cartSignature(lines: readonly CartLine[]): string {
  return lines.map((l) => `${l.key}×${l.quantity}`).join(";");
}

function isLine(value: unknown): value is CartLine {
  const l = value as CartLine;
  return (
    typeof l === "object" &&
    l !== null &&
    typeof l.productId === "string" &&
    Array.isArray(l.optionIds) &&
    l.optionIds.every((o) => typeof o === "string") &&
    Number.isInteger(l.quantity) &&
    l.quantity >= 1 &&
    l.quantity <= MAX_QUANTITY
  );
}

function read(s: string): CartState {
  try {
    const raw = localStorage.getItem(cartKey(s));
    if (!raw) return EMPTY;
    const parsed = JSON.parse(raw) as Partial<CartState>;
    const lines = Array.isArray(parsed.lines) ? parsed.lines.filter(isLine).map((l) => ({ ...l, key: lineKey(l) })) : [];
    return {
      lines: lines.slice(0, MAX_LINES),
      shownSignature: typeof parsed.shownSignature === "string" ? parsed.shownSignature : null,
      shownAt: typeof parsed.shownAt === "number" ? parsed.shownAt : null,
      shownOrderCount: typeof parsed.shownOrderCount === "number" ? parsed.shownOrderCount : null,
      pendingSubmitKey: typeof parsed.pendingSubmitKey === "string" ? parsed.pendingSubmitKey : null,
    };
  } catch {
    return EMPTY;
  }
}

function write(next: CartState) {
  state = next;
  if (slug) {
    try {
      localStorage.setItem(cartKey(slug), JSON.stringify(next));
    } catch {
      /* stockage plein ou refusé : le panier reste en mémoire pour cette visite */
    }
  }
  listeners.forEach((l) => l());
}

/** Une clé aléatoire, 32 caractères base64url (192 bits). */
export function randomKey(bytes = 24): string {
  const data = new Uint8Array(bytes);
  crypto.getRandomValues(data);
  let binary = "";
  for (const b of data) binary += String.fromCharCode(b);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

/** La clé d'invité de ce téléphone pour cet établissement, tirée au premier besoin. */
export function guestKeyFor(s: string): string {
  try {
    const saved = localStorage.getItem(guestKeyKey(s));
    if (saved && /^[A-Za-z0-9_-]{22,64}$/.test(saved)) return saved;
    const fresh = randomKey();
    localStorage.setItem(guestKeyKey(s), fresh);
    return fresh;
  } catch {
    // Sans stockage : une clé pour la durée de la visite.
    return (memoryKey ??= randomKey());
  }
}
let memoryKey: string | undefined;

/** Relie le panier à l'établissement de la page ; relit le stockage si l'établissement change. */
export function bindCart(venueSlug: string) {
  if (slug === venueSlug) return;
  slug = venueSlug;
  state = read(venueSlug);
  listeners.forEach((l) => l());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  // Un autre onglet du même téléphone modifie le panier : on le suit.
  const onStorage = (e: StorageEvent) => {
    if (slug && e.key === cartKey(slug)) {
      state = read(slug);
      listeners.forEach((l) => l());
    }
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", onStorage);
  };
}

export function useCart(): CartState {
  return useSyncExternalStore(
    subscribe,
    () => state,
    () => EMPTY,
  );
}

export function getCart(): CartState {
  return state;
}

export const cart = {
  /** Ajoute un plat ; `false` si le panier est plein. */
  add(choice: DishChoice): boolean {
    const instructions = choice.instructions?.trim() || undefined;
    const normalized: DishChoice = {
      productId: choice.productId,
      ...(choice.variantId ? { variantId: choice.variantId } : {}),
      optionIds: [...choice.optionIds],
      quantity: choice.quantity,
      ...(instructions ? { instructions } : {}),
    };
    const key = lineKey(normalized);
    const existing = state.lines.find((l) => l.key === key);
    if (!existing && state.lines.length >= MAX_LINES) return false;
    const lines = existing
      ? state.lines.map((l) => (l.key === key ? { ...l, quantity: Math.min(MAX_QUANTITY, l.quantity + normalized.quantity) } : l))
      : [...state.lines, { ...normalized, key }];
    write({ ...state, lines });
    return true;
  },
  setQuantity(key: string, quantity: number) {
    const lines =
      quantity < 1 ? state.lines.filter((l) => l.key !== key) : state.lines.map((l) => (l.key === key ? { ...l, quantity: Math.min(MAX_QUANTITY, quantity) } : l));
    write({ ...state, lines });
  },
  remove(key: string) {
    write({ ...state, lines: state.lines.filter((l) => l.key !== key) });
  },
  /** Remplace les lignes (panier retrouvé sur le serveur, lignes refusées retirées). */
  replace(lines: DishChoice[]) {
    write({ ...state, lines: lines.map((l) => ({ ...l, key: lineKey(l) })) });
  },
  markShown(orderCount: number) {
    write({ ...state, shownSignature: cartSignature(state.lines), shownAt: Date.now(), shownOrderCount: orderCount });
  },
  forgetShown() {
    write({ ...state, shownSignature: null, shownAt: null, shownOrderCount: null });
  },
  beginSubmit(): string {
    const key = state.pendingSubmitKey ?? randomKey();
    if (key !== state.pendingSubmitKey) write({ ...state, pendingSubmitKey: key });
    return key;
  },
  /** La commande est partie (ou prise par le serveur) : le panier du téléphone repart vide. */
  clear() {
    write(EMPTY);
  },
  cancelSubmit() {
    write({ ...state, pendingSubmitKey: null });
  },
};

export const CART_LIMITS = { quantity: MAX_QUANTITY, lines: MAX_LINES };
