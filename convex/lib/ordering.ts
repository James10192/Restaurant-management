/**
 * Règles de commande — Joliba
 *
 * PUR : aucun accès à la base, aucune horloge implicite. Tout ce qui décide d'un prix, d'une
 * validité ou d'un état est ici, testé sans Convex, et appelé par les mutations.
 *
 *  - Le PRIX qui fait foi est recalculé ici, depuis la carte PUBLIÉE et la disponibilité en
 *    direct (R14). Ce qu'envoie l'écran — y compris un prix — n'est jamais cru.
 *  - L'ÉTAT d'une commande n'est jamais saisi : il se DÉRIVE de ses lignes, elles-mêmes
 *    menées par les bons de production (R12).
 *  - Un bon ne change d'état que par une transition de la table ci-dessous. Toute autre
 *    demande est refusée — deux cuisiniers qui appuient en même temps ne créent pas d'état
 *    impossible.
 */

import { availabilityIndex } from "./availabilityIndex";
import type { GuestMenu, LiveAvailability } from "./guestMenu";
import type { SnapshotProduct } from "./menuSnapshot";

export const ORDER_LIMITS = {
  linesPerOrder: 60,
  quantity: 99,
  instructions: 140,
  note: 200,
  /** Service 1 à 4 : boissons, entrées, plats, desserts. Au-delà, personne ne s'y retrouve. */
  courses: 4,
} as const;

/* ────────────────────────────────────────────────────────────────────────────
 * Prix d'une ligne
 * ──────────────────────────────────────────────────────────────────────────── */

export type LineRequest = {
  productId: string;
  variantId?: string;
  optionIds: string[];
  quantity: number;
  instructions?: string;
  courseNumber: number;
};

export type PricedLine = {
  productId: string;
  variantId?: string;
  sectionId: string;
  nameSnapshot: string;
  variantNameSnapshot?: string;
  modifiers: { groupName: string; optionName: string; priceDelta: number }[];
  quantity: number;
  unitPrice: number;
  lineTotal: number;
  instructions?: string;
  courseNumber: number;
  /** Allergènes DÉCLARÉS du produit, remontés sur le bon de cuisine. */
  allergens: string[];
};

export type LineProblemCode =
  | "PRODUCT_NOT_FOUND"
  | "ITEM_UNAVAILABLE"
  | "VARIANT_REQUIRED"
  | "VARIANT_UNAVAILABLE"
  | "OPTIONS_INVALID"
  | "OPTION_UNAVAILABLE"
  | "QUANTITY_INVALID"
  | "INSTRUCTIONS_TOO_LONG"
  | "COURSE_INVALID";

export type LineProblem = { index: number; productName: string | null; code: LineProblemCode; message: string };

/** Le prix d'un produit sans variante : la promotion si elle court encore, sinon le prix de base. */
export function productBasePrice(product: Pick<SnapshotProduct, "basePrice" | "promoPrice" | "promoEndsAt">, now: number): number {
  const promoActive = product.promoPrice !== undefined && (product.promoEndsAt === undefined || product.promoEndsAt > now);
  return promoActive ? product.promoPrice! : product.basePrice;
}

type Located = { menu: GuestMenu; sectionId: string; product: GuestMenu["sections"][number]["products"][number] };

/** Toutes les occurrences publiées d'un produit, indexées par identifiant. */
export function indexPublishedProducts(menus: readonly GuestMenu[]): Map<string, Located> {
  const index = new Map<string, Located>();
  for (const menu of menus) {
    for (const section of menu.sections) {
      for (const product of section.products) {
        if (!index.has(product.id)) index.set(product.id, { menu, sectionId: section.id, product });
      }
    }
  }
  return index;
}

function problem(index: number, productName: string | null, code: LineProblemCode, message: string): LineProblem {
  return { index, productName, code, message };
}

/**
 * Valide et chiffre une ligne. `null` en problème : la ligne n'est pas envoyée, et l'écran
 * dit laquelle et pourquoi — « Poulet braisé : épuisé » vaut mieux qu'un refus global muet.
 */
export function priceLine(
  request: LineRequest,
  index: number,
  published: ReadonlyMap<string, Located>,
  live: LiveAvailability,
  now: number,
  timeZone: string,
): { line: PricedLine } | { problem: LineProblem } {
  const found = published.get(request.productId);
  if (!found) return { problem: problem(index, null, "PRODUCT_NOT_FOUND", "Ce plat n'est plus à la carte.") };
  const { menu, sectionId, product } = found;
  const name = product.name;

  if (!Number.isInteger(request.quantity) || request.quantity < 1 || request.quantity > ORDER_LIMITS.quantity) {
    return { problem: problem(index, name, "QUANTITY_INVALID", `${name} : quantité de 1 à ${ORDER_LIMITS.quantity}.`) };
  }
  if (!Number.isInteger(request.courseNumber) || request.courseNumber < 1 || request.courseNumber > ORDER_LIMITS.courses) {
    return { problem: problem(index, name, "COURSE_INVALID", `${name} : service de 1 à ${ORDER_LIMITS.courses}.`) };
  }
  const instructions = request.instructions?.trim() || undefined;
  if (instructions && instructions.length > ORDER_LIMITS.instructions) {
    return { problem: problem(index, name, "INSTRUCTIONS_TOO_LONG", `${name} : la précision tient en ${ORDER_LIMITS.instructions} caractères.`) };
  }

  const availability = availabilityIndex(live, now, timeZone);
  if (availability.product(menu, sectionId, product.id) !== null) {
    return { problem: problem(index, name, "ITEM_UNAVAILABLE", `${name} n'est pas disponible en ce moment.`) };
  }

  // Variante : obligatoire dès qu'il en existe ; une variante unique se choisit seule.
  let unitPrice: number;
  let variant: SnapshotProduct["variants"][number] | undefined;
  if (product.variants.length > 0) {
    variant =
      request.variantId !== undefined
        ? product.variants.find((v) => v.id === request.variantId)
        : product.variants.length === 1
          ? product.variants[0]
          : undefined;
    if (!variant) return { problem: problem(index, name, "VARIANT_REQUIRED", `${name} : choisissez une taille ou une variante.`) };
    if (!availability.variant(variant.id)) {
      return { problem: problem(index, name, "VARIANT_UNAVAILABLE", `${name} (${variant.name}) n'est pas disponible.`) };
    }
    unitPrice = variant.price;
  } else {
    if (request.variantId !== undefined) return { problem: problem(index, name, "VARIANT_REQUIRED", `${name} n'a pas de variante.`) };
    unitPrice = productBasePrice(product, now);
  }

  // Options : chacune appartient à un groupe du produit, une seule fois ; chaque groupe
  // respecte ses bornes. Un groupe obligatoire exige au moins un choix.
  if (new Set(request.optionIds).size !== request.optionIds.length) {
    return { problem: problem(index, name, "OPTIONS_INVALID", `${name} : une option est choisie deux fois.`) };
  }
  const chosenByGroup = new Map<string, string[]>();
  const modifiers: PricedLine["modifiers"] = [];
  for (const optionId of request.optionIds) {
    const group = product.modifierGroups.find((g) => g.options.some((o) => o.id === optionId));
    if (!group) return { problem: problem(index, name, "OPTIONS_INVALID", `${name} : une option ne correspond pas à ce plat.`) };
    const option = group.options.find((o) => o.id === optionId)!;
    if (!availability.option(option.id)) {
      return { problem: problem(index, name, "OPTION_UNAVAILABLE", `${name} : « ${option.name} » n'est pas disponible.`) };
    }
    chosenByGroup.set(group.id, [...(chosenByGroup.get(group.id) ?? []), optionId]);
    modifiers.push({ groupName: group.name, optionName: option.name, priceDelta: option.priceDelta });
    unitPrice += option.priceDelta;
  }
  for (const group of product.modifierGroups) {
    const count = chosenByGroup.get(group.id)?.length ?? 0;
    const min = group.isRequired ? Math.max(group.minSelect, 1) : group.minSelect;
    const max = group.selectionType === "single" ? 1 : group.maxSelect;
    if (count < min) return { problem: problem(index, name, "OPTIONS_INVALID", `${name} : « ${group.name} » est à choisir.`) };
    if (count > max) return { problem: problem(index, name, "OPTIONS_INVALID", `${name} : « ${group.name} » accepte ${max} choix au plus.`) };
  }
  if (unitPrice < 0) return { problem: problem(index, name, "OPTIONS_INVALID", `${name} : le prix ne peut pas être négatif.`) };

  return {
    line: {
      productId: product.id,
      ...(variant ? { variantId: variant.id, variantNameSnapshot: variant.name } : {}),
      sectionId,
      nameSnapshot: name,
      modifiers,
      quantity: request.quantity,
      unitPrice,
      lineTotal: unitPrice * request.quantity,
      ...(instructions ? { instructions } : {}),
      courseNumber: request.courseNumber,
      allergens: product.allergens,
    },
  };
}

/** Taxe d'une ligne, figée au jour de la commande (R6). Montants entiers, arrondis au plus proche. */
export function lineTax(
  lineTotal: number,
  rates: readonly { code: string; label: string; percent: number }[],
  pricesIncludeTax: boolean,
): { code: string; label: string; percent: number; amount: number }[] {
  return rates.map((r) => ({
    code: r.code,
    label: r.label,
    percent: r.percent,
    amount: pricesIncludeTax ? Math.round((lineTotal * r.percent) / (100 + r.percent)) : Math.round((lineTotal * r.percent) / 100),
  }));
}

export type OrderTotals = { subtotal: number; discounts: number; tax: number; serviceCharge: number; total: number };

/**
 * Totaux d'une commande. Taxe incluse : elle est DANS le sous-total, et le total ne bouge pas.
 * Remises et frais de service relèvent de l'addition (tranche T3) : zéro ici.
 */
export function orderTotals(lines: readonly { lineTotal: number; tax: readonly { amount: number }[] }[], pricesIncludeTax: boolean): OrderTotals {
  const subtotal = lines.reduce((s, l) => s + l.lineTotal, 0);
  const tax = lines.reduce((s, l) => s + l.tax.reduce((t, x) => t + x.amount, 0), 0);
  return { subtotal, discounts: 0, tax, serviceCharge: 0, total: pricesIncludeTax ? subtotal : subtotal + tax };
}

/* ────────────────────────────────────────────────────────────────────────────
 * Bons de production
 * ──────────────────────────────────────────────────────────────────────────── */

export type TicketStatus = "held" | "queued" | "started" | "ready" | "recalled" | "served" | "cancelled";
export type TicketAction = "fire" | "start" | "ready" | "recall" | "serve" | "cancel";

const TICKET_TRANSITIONS: Record<TicketStatus, Partial<Record<TicketAction, TicketStatus>>> = {
  held: { fire: "queued", cancel: "cancelled" },
  queued: { start: "started", ready: "ready", cancel: "cancelled" },
  started: { ready: "ready", cancel: "cancelled" },
  // Un plat rappelé repasse en cuisine : c'est une information de service, pas une faute
  // à effacer (R13). Il se reprend (`start`) ou se déclare prêt directement.
  recalled: { start: "started", ready: "ready", cancel: "cancelled" },
  ready: { recall: "recalled", serve: "served" },
  served: {},
  cancelled: {},
};

/** L'état suivant, ou `null` si la transition n'existe pas depuis cet état. */
export function nextTicketStatus(status: TicketStatus, action: TicketAction): TicketStatus | null {
  return TICKET_TRANSITIONS[status][action] ?? null;
}

/** Ce que l'écran de cuisine affiche : ni ce qui est servi, ni ce qui est annulé. */
export const KITCHEN_VISIBLE: readonly TicketStatus[] = ["held", "queued", "started", "recalled", "ready"];

/** L'état d'une ligne commandée, tel que l'impose l'état de son bon. */
export function itemStatusForTicket(ticket: TicketStatus): ItemStatus {
  switch (ticket) {
    case "held":
    case "queued":
      return "ordered";
    case "started":
    case "recalled":
      return "preparing";
    case "ready":
      return "ready";
    case "served":
      return "served";
    case "cancelled":
      return "cancelled";
  }
}

export function kitchenItemStatus(ticket: TicketStatus): "pending" | "started" | "ready" | "cancelled" {
  switch (ticket) {
    case "held":
    case "queued":
      return "pending";
    case "started":
    case "recalled":
      return "started";
    case "ready":
    case "served":
      return "ready";
    case "cancelled":
      return "cancelled";
  }
}

/* ────────────────────────────────────────────────────────────────────────────
 * État d'une commande, dérivé
 * ──────────────────────────────────────────────────────────────────────────── */

export type ItemStatus = "ordered" | "preparing" | "ready" | "served" | "cancelled";
export type OrderStatus =
  | "draft"
  | "submitted"
  | "pending_payment"
  | "pending_acceptance"
  | "accepted"
  | "in_preparation"
  | "partially_ready"
  | "ready"
  | "partially_served"
  | "served"
  | "closed"
  | "rejected"
  | "cancelled"
  | "partially_cancelled";

/** Tant qu'une commande n'est pas acceptée, ses lignes n'ont rien à dire de son état. */
const NOT_DERIVED: readonly OrderStatus[] = ["draft", "submitted", "pending_payment", "pending_acceptance", "rejected", "closed"];

/**
 * R12 — une seule source de vérité : les lignes. Les lignes annulées ne comptent pas ; une
 * commande dont TOUTES les lignes sont annulées est annulée.
 */
export function deriveOrderStatus(current: OrderStatus, items: readonly ItemStatus[]): OrderStatus {
  if (NOT_DERIVED.includes(current)) return current;
  const live = items.filter((s) => s !== "cancelled");
  if (live.length === 0) return "cancelled";
  const served = live.filter((s) => s === "served").length;
  const readyOrServed = live.filter((s) => s === "ready" || s === "served").length;
  if (served === live.length) return "served";
  if (served > 0) return "partially_served";
  if (readyOrServed === live.length) return "ready";
  if (readyOrServed > 0) return "partially_ready";
  if (live.some((s) => s === "preparing")) return "in_preparation";
  return "accepted";
}

/** Une commande encore « en cours » : elle empêche la clôture de la table. */
export const ACTIVE_ORDER: readonly OrderStatus[] = [
  "submitted",
  "pending_payment",
  "pending_acceptance",
  "accepted",
  "in_preparation",
  "partially_ready",
  "ready",
  "partially_served",
];

/* ────────────────────────────────────────────────────────────────────────────
 * Références dites à voix haute
 * ──────────────────────────────────────────────────────────────────────────── */

/** « A-042 » : court, sans ambiguïté à l'oral. Le compteur repart chaque jour de service. */
export function orderReference(sequence: number): string {
  return `A-${String(sequence).padStart(3, "0")}`;
}

/** « CUI », « BAR » : trois lettres, sans accent, pour le bon d'un poste. */
export function stationCode(name: string): string {
  const letters = name
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^A-Za-z]/g, "")
    .toUpperCase();
  return (letters || "POS").slice(0, 3);
}

/** Jour de service (il se termine à 4 h du matin, heure de l'établissement) : « 2026-09-23 ». */
export function serviceDayKey(now: number, timeZone: string): string {
  // Avant 4 h, on appartient encore à la veille.
  const shifted = now - 4 * 3_600_000;
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" })
      .formatToParts(new Date(shifted))
      .map((p) => [p.type, p.value]),
  );
  return `${parts.year}-${parts.month}-${parts.day}`;
}

/* ────────────────────────────────────────────────────────────────────────────
 * Rejeu après une coupure (D-062)
 * ──────────────────────────────────────────────────────────────────────────── */

/** Une référence d'appareil : un UUID (v4 ou v7), rien d'autre. */
export function isClientRef(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[47][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(value);
}

/** Au-delà, un geste rejoué est refusé : un gérant le relit et le ressaisit. */
export const OFFLINE_REPLAY_MAX_MS = 6 * 60 * 60_000;

/** Au-delà, l'appareil ne renvoie plus seul une commande en cuisine : elle passe « À régulariser ». */
export const OFFLINE_AUTO_SEND_MAX_MS = 3 * 60_000;
