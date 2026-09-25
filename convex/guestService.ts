/**
 * Le client à table — Joliba (T2, D-061)
 *
 * Par défaut (`staff_only`), le client compose un PANIER À MONTRER : rien ne part, l'écran le dit
 * en toutes lettres, et le serveur l'importe d'un geste dans sa propre saisie. Pas d'état en
 * attente, pas de commande qui dort. En `guest_with_approval` seulement, le client peut envoyer :
 * la commande attend alors la validation d'un serveur, sous trois garde-fous (message permanent,
 * alerte à tout le personnel à 90 secondes, expiration à 10 minutes).
 *
 * Appeler un serveur marche même avant l'ouverture de la table : c'est souvent le premier geste.
 * Délai anti-répétition par table et par type, plafond par QR.
 *
 * Chaque fonction est gardée par le laissez-passer (D-046), revérifié à chaque appel.
 */

import { v } from "convex/values";
import { internalMutation, mutation, query } from "./_generated/server";
import { internal } from "./_generated/api";
import type { Doc, Id } from "./_generated/dataModel";
import { CODE_FAILURES_BEFORE_ROTATION, drawTableCode, guestPresence, isAdmitted, isGuestKey, joinSession, resolveGuestTable } from "./lib/guestTable";
import { sha256Hex } from "./lib/tokens";
import type { ReadCtx } from "./lib/guards";
import { APPROVAL_EXPIRE_MS, CART_TTL_MS, type LineProblem, type LineRequest } from "./lib/ordering";
import { rateLimiter } from "./lib/rateLimits";
import { settingsOf, touchSession, writeOrderEvent } from "./lib/service";
import { createOrder, priceRequest } from "./orders";
import { guestPaymentView } from "./lib/guestPayment";
import { activeAccountOf } from "./paymentAccounts";

export const CART_MAX_LINES = 30;
/** Motif posé sur une commande que personne n'a validée à temps : le client la lit « expirée ». */
const EXPIRED_REASON = "Personne n'a pu la valider à temps. Appelez un serveur.";

const guestArgs = { pass: v.string(), venueSlug: v.string(), guestKey: v.string() };
const lineArg = v.object({
  productId: v.string(),
  variantId: v.optional(v.string()),
  optionIds: v.array(v.string()),
  quantity: v.number(),
  instructions: v.optional(v.string()),
  courseNumber: v.optional(v.number()),
});

const GUEST_STATUS: Partial<Record<Doc<"orders">["status"], string>> = {
  pending_acceptance: "Pas encore en cuisine — en attente du serveur",
  accepted: "Reçue, bientôt en préparation",
  in_preparation: "En préparation",
  partially_ready: "En partie prête",
  ready: "Prête",
  partially_served: "En partie servie",
  served: "Servie",
  rejected: "Refusée",
  cancelled: "Annulée",
};

async function activeCartOf(ctx: ReadCtx, guest: Doc<"guestSessions">): Promise<Doc<"carts"> | null> {
  const carts = await ctx.db
    .query("carts")
    .withIndex("by_guest", (q) => q.eq("guestSessionId", guest._id))
    .collect();
  const cart = carts.find((c) => c.status === "active") ?? null;
  return cart && Date.now() - cart.updatedAt <= CART_TTL_MS ? cart : null;
}

export function cartLineRequests(items: readonly Doc<"cartItems">[]): LineRequest[] {
  return items.map((i) => ({
    productId: i.productId,
    ...(i.variantId ? { variantId: i.variantId } : {}),
    optionIds: i.modifierSelections,
    quantity: i.quantity,
    ...(i.instructions ? { instructions: i.instructions } : {}),
    courseNumber: i.courseNumber ?? 1,
  }));
}

async function cartItemsOf(ctx: ReadCtx, cartId: Id<"carts">) {
  return ctx.db
    .query("cartItems")
    .withIndex("by_cart", (q) => q.eq("cartId", cartId))
    .collect();
}

/** Plafond de quantité par ligne d'un envoi du client (D-098). */
export const GUEST_MAX_QUANTITY_DEFAULT = 10;
/** L'avis se laisse dans les heures qui suivent la clôture (D-105). */
export const FEEDBACK_WINDOW_MS = 6 * 60 * 60 * 1000;
export const FEEDBACK_TOPICS = ["accueil", "attente", "plats", "boissons", "proprete", "prix"] as const;

/** L'état d'une ligne vu du client : celui de la cuisine, plus « retenue » (un service qui attend l'appel). */
type GuestLineState = Doc<"orderItems">["status"] | "held";

/** Le convive d'une ligne, par son numéro : « Convive 2 ». `null` : saisie du personnel. */
function guestNumberOf(item: Doc<"orderItems">, numbers: Map<string, number | null>): number | null {
  const id = item.assignedGuestSessionIds[0];
  return id ? (numbers.get(id) ?? null) : null;
}

async function tableGuests(ctx: ReadCtx, sessionId: Id<"tableSessions">) {
  return ctx.db
    .query("guestSessions")
    .withIndex("by_session", (q) => q.eq("tableSessionId", sessionId))
    .collect();
}

/**
 * La commande d'une clé d'envoi, si ELLE vient de ce téléphone (empreinte de sa clé d'invité).
 * `foreign` : la clé existe mais appartient à un autre convive. Lue AVANT toute autre règle : une
 * commande passée reste passée, même si le mode, la tablée ou l'admission ont changé depuis (D-100).
 */
async function ownedReplay(ctx: ReadCtx, venueId: Id<"venues">, idempotencyKey: string, guestKey: string) {
  if (!/^[A-Za-z0-9_-]{16,64}$/.test(idempotencyKey) || !isGuestKey(guestKey)) return null;
  const order = await ctx.db
    .query("orders")
    .withIndex("by_venue_idempotency", (q) => q.eq("venueId", venueId).eq("idempotencyKey", idempotencyKey))
    .unique();
  if (!order) return null;
  const owner = order.placedByGuestSessionId ? await ctx.db.get(order.placedByGuestSessionId) : null;
  if (!owner || owner.deviceFingerprintHash !== (await sha256Hex(guestKey))) return "foreign" as const;
  return { reference: order.reference };
}

/** Une commande qui compte pour la tablée : ni en attente, ni refusée, ni annulée (D-088). */
const COUNTED = (status: Doc<"orders">["status"]) => !["draft", "pending_payment", "pending_acceptance", "rejected", "cancelled"].includes(status);

/**
 * La dernière tablée close de cette table, si c'est la sienne et depuis moins de six heures :
 * le seul moment où l'on peut laisser un avis (D-105). La session close n'est plus « active » :
 * on la retrouve par la table, puis le convive par l'empreinte de sa clé.
 */
async function lastClosedVisit(ctx: ReadCtx, table: Doc<"restaurantTables">, guestKey: string) {
  if (!isGuestKey(guestKey)) return null;
  const now = Date.now();
  let latest: Doc<"tableSessions"> | null = null;
  for (const status of ["closed", "closed_with_debt"] as const) {
    const rows = await ctx.db
      .query("tableSessions")
      .withIndex("by_table_status", (q) => q.eq("tableId", table._id).eq("status", status))
      .order("desc")
      .take(5);
    for (const row of rows) if ((row.closedAt ?? 0) > (latest?.closedAt ?? 0)) latest = row;
  }
  if (!latest || now - (latest.closedAt ?? 0) > FEEDBACK_WINDOW_MS) return null;
  const hash = await sha256Hex(guestKey);
  const guest = (await tableGuests(ctx, latest._id)).find((g) => g.deviceFingerprintHash === hash);
  if (!guest) return null;
  // Avoir été admis par le code, ou avoir commandé de son téléphone : sans cette preuve de
  // présence, une photo du QR suffirait à déposer des dizaines de mauvaises notes (D-105).
  if (guest.removedAt !== undefined) return null;
  const orders = (
    await ctx.db
      .query("orders")
      .withIndex("by_session", (q) => q.eq("tableSessionId", latest._id))
      .collect()
  ).filter((o) => COUNTED(o.status));
  if (orders.length === 0) return null;
  let proven = guest.admittedAt !== undefined;
  for (const order of orders) {
    if (proven) break;
    const lines = await ctx.db
      .query("orderItems")
      .withIndex("by_order", (q) => q.eq("orderId", order._id))
      .collect();
    proven = lines.some((l) => l.status !== "cancelled" && l.assignedGuestSessionIds.includes(guest._id));
  }
  if (!proven) return null;
  const given = await ctx.db
    .query("feedback")
    .withIndex("by_guest_session", (q) => q.eq("guestSessionId", guest._id))
    .first();
  return { session: latest, guest, done: given !== null };
}

/**
 * Ce que voit le client à sa table : la table est-elle ouverte, son panier, ses commandes ligne
 * par ligne, ce que la tablée a commandé, et ce qu'il peut faire selon le mode de l'établissement.
 * `pendingKey` : la clé d'un envoi resté sans réponse ; si la commande existe, on la rend, et le
 * téléphone sait qu'il peut vider son panier (D-100).
 */
export const presence = query({
  args: { ...guestArgs, pendingKey: v.optional(v.string()) },
  handler: async (ctx, args) => {
    // garde : laissez-passer revérifié contre le QR, la table et l'établissement
    const resolved = await resolveGuestTable(ctx, args.pass, args.venueSlug);
    if (!resolved) return null;
    const settings = await settingsOf(ctx, resolved.venue._id);
    const mode = settings.service.orderingMode;
    const { session, guest } = await guestPresence(ctx, resolved.table, args.guestKey);
    const removed = guest?.removedAt !== undefined;
    const cart = guest && !removed ? await activeCartOf(ctx, guest) : null;
    const items = cart ? await cartItemsOf(ctx, cart._id) : [];
    const pendingReplay = args.pendingKey ? await ownedReplay(ctx, resolved.venue._id, args.pendingKey, args.guestKey) : null;

    type Line = { name: string; quantity: number; status: GuestLineState; guestNumber: number | null; mine: boolean };
    const orders: {
      reference: string;
      status: string;
      label: string;
      rejectedReason: string | null;
      expired: boolean;
      /** Reprise par le serveur depuis le panier montré (D-101). */
      takenByWaiter: boolean;
      submittedAt: number;
      items: { name: string; quantity: number; status: GuestLineState }[];
    }[] = [];
    const tableLines: (Line & { reference: string; submittedAt: number })[] = [];
    let cartOutcome: { status: "taken" | "dismissed" | "submitted" | "expired"; at: number } | null = null;

    if (guest && session) {
      const mine = await ctx.db
        .query("carts")
        .withIndex("by_guest", (q) => q.eq("guestSessionId", guest._id))
        .collect();
      // Ce qu'il est advenu du DERNIER panier de ce téléphone — celui qu'il a montré en dernier :
      // repris, ignoré, envoyé, ou oublié sans réponse (actif mais périmé). Un ancien panier repris
      // ne dit rien du panier montré ensuite.
      const last = [...mine].sort((a, b) => b.updatedAt - a.updatedAt)[0];
      if (last && last.status !== "active") {
        cartOutcome = {
          status: last.status === "dismissed" || last.status === "abandoned" ? "dismissed" : last.takenAt !== undefined ? "taken" : "submitted",
          at: last.updatedAt,
        };
      } else if (last && cart === null) {
        cartOutcome = { status: "expired", at: last.updatedAt };
      }
      const numbers = new Map((await tableGuests(ctx, session._id)).map((g) => [g._id as string, g.guestNumber ?? null]));
      const all = await ctx.db
        .query("orders")
        .withIndex("by_session", (q) => q.eq("tableSessionId", session._id))
        .collect();
      const tableRows: typeof tableLines = [];
      for (const order of all.sort((a, b) => a.submittedAt - b.submittedAt)) {
        const lines = await ctx.db
          .query("orderItems")
          .withIndex("by_order", (q) => q.eq("orderId", order._id))
          .collect();
        const held = new Set(
          (
            await ctx.db
              .query("kitchenTickets")
              .withIndex("by_order", (q) => q.eq("orderId", order._id))
              .collect()
          )
            .filter((t) => t.status === "held")
            .map((t) => t.courseNumber),
        );
        // Une ligne d'un service retenu n'est pas « en cuisine » : elle attend l'appel du serveur.
        const stateOf = (l: Doc<"orderItems">): GuestLineState => (l.status === "ordered" && held.has(l.courseNumber) ? "held" : l.status);
        const placedByMe = order.placedByGuestSessionId === guest._id;
        // Une saisie du serveur qui reprend plusieurs paniers : chacun n'y voit que SES plats.
        const myLines = lines.filter((l) => l.assignedGuestSessionIds.includes(guest._id));
        const shown = placedByMe ? lines : myLines;
        if (shown.length > 0 || placedByMe) {
          orders.push({
            reference: order.reference,
            status: order.status,
            label: GUEST_STATUS[order.status] ?? "Enregistrée",
            rejectedReason: order.rejectedReason ?? null,
            expired: order.status === "rejected" && order.rejectedReason === EXPIRED_REASON,
            takenByWaiter: order.channel === "staff",
            submittedAt: order.submittedAt,
            items: shown.map((l) => ({ name: l.nameSnapshot, quantity: l.quantity, status: stateOf(l) })),
          });
        }
        // « Ce que la table a commandé » : les commandes PARTIES, sans montants, pour ne pas
        // recommander la bouteille partagée (D-099). Rien de ce qui attend encore un serveur.
        if (!COUNTED(order.status)) continue;
        for (const l of lines) {
          if (l.status === "cancelled") continue;
          tableRows.push({
            reference: order.reference,
            submittedAt: order.submittedAt,
            name: l.nameSnapshot,
            quantity: l.quantity,
            status: stateOf(l),
            guestNumber: guestNumberOf(l, numbers),
            mine: l.assignedGuestSessionIds.includes(guest._id),
          });
        }
      }
      // La tablée ne se montre qu'à un convive qui a prouvé sa présence : admis par le code, ou qui
      // a commandé. Une photo du QR ne suffit pas à suivre la table en direct.
      if (!removed && (guest.admittedAt !== undefined || orders.length > 0)) tableLines.push(...tableRows);
    }

    const admitted = guest !== null && !removed && guest.admittedAt !== undefined;
    // L'avis se propose à un téléphone qui n'est pas (encore) de la tablée en cours : la table peut
    // avoir été rouverte pour d'autres clients cinq minutes après (D-105).
    const visit = !guest ? await lastClosedVisit(ctx, resolved.table, args.guestKey) : null;
    return {
      tableOpen: session !== null,
      joined: guest !== null,
      mode,
      guest: guest ? { number: guest.guestNumber ?? null, admitted, removed } : null,
      /** Le code de la tablée, à redonner à qui rejoint — seulement à un convive admis. */
      code: admitted && session ? (session.activationCode ?? null) : null,
      /** `guest_with_approval` : le client envoie, un serveur valide. */
      canSend: mode === "guest_with_approval" && !removed,
      /** `guest_direct` : le client envoie en cuisine — une fois admis par le code (D-095). */
      direct: mode === "guest_direct",
      canSendDirect: mode === "guest_direct" && admitted,
      maxQuantity: settings.service.guestMaxQuantityPerLine ?? GUEST_MAX_QUANTITY_DEFAULT,
      requestTypes: settings.serviceRequestTypes.filter((t) => t.enabled).map((t) => ({ key: t.key, label: t.label })),
      cart: cart
        ? {
            updatedAt: cart.updatedAt,
            expiresAt: cart.updatedAt + CART_TTL_MS,
            lines: items.map((i) => ({
              productId: i.productId,
              variantId: i.variantId ?? null,
              optionIds: i.modifierSelections,
              quantity: i.quantity,
              instructions: i.instructions ?? null,
              courseNumber: i.courseNumber ?? 1,
              estimatedUnitPrice: i.estimatedUnitPrice,
            })),
            estimatedTotal: items.reduce((s, i) => s + i.estimatedUnitPrice * i.quantity, 0),
          }
        : null,
      cartOutcome,
      /** L'envoi resté sans réponse est bien passé : sa référence. `null` : rien sous cette clé. */
      pending: pendingReplay && pendingReplay !== "foreign" ? pendingReplay : null,
      orders,
      table: tableLines,
      /** Après la clôture : laisser un avis, une fois (D-105). */
      feedback: visit ? { done: visit.done } : null,
      topics: FEEDBACK_TOPICS,
      /** Payer depuis la table (T5) : seulement un convive admis, sur un établissement qui l'a activé. */
      payment: guest && !removed ? await guestPaymentView(ctx, resolved.venue, session, guest) : null,
      /**
       * Le paiement en ligne est proposé à cette tablée : un téléphone pas encore admis voit
       * « Régler », qui lui demande d'abord le code de la table (D-112) — dans tous les modes.
       */
      paymentOffered: session !== null && !session.isSimulation && !removed && (await activeAccountOf(ctx, resolved.venue._id)) !== null,
    };
  },
});

/**
 * Enregistre le panier de ce téléphone (il REMPLACE le précédent). Les prix sont recalculés
 * ici pour l'affichage ; ils le seront de nouveau à l'import ou à l'envoi (R14).
 */
export const saveCart = mutation({
  args: { ...guestArgs, lines: v.array(lineArg) },
  handler: async (
    ctx,
    args,
  ): Promise<
    | { ok: true; problems: LineProblem[] }
    | { ok: false; reason: "invalid_pass" | "table_not_open" | "full" | "bad_key" | "too_many_lines" | "removed" }
    | { ok: false; reason: "rate_limited"; retryAfter: number }
  > => {
    // garde : laissez-passer revérifié ; la table doit avoir été ouverte par le personnel
    const resolved = await resolveGuestTable(ctx, args.pass, args.venueSlug);
    if (!resolved) return { ok: false, reason: "invalid_pass" };
    if (args.lines.length > CART_MAX_LINES) return { ok: false, reason: "too_many_lines" };
    const joined = await joinSession(ctx, resolved, args.guestKey);
    if ("error" in joined) return { ok: false, reason: joined.error };
    if (joined.guest.removedAt !== undefined) return { ok: false, reason: "removed" };
    // Par convive d'abord (D-098), par QR comme filet.
    for (const [name, key] of [["guestCartPerGuest", joined.guest._id], ["guestCart", resolved.code._id]] as const) {
      const limit = await rateLimiter.limit(ctx, name, { key });
      if (!limit.ok) return { ok: false, reason: "rate_limited", retryAfter: limit.retryAfter };
    }
    const now = Date.now();
    const requests: LineRequest[] = args.lines.map((l) => ({ ...l, courseNumber: l.courseNumber ?? 1 }));
    const priced = requests.length > 0 ? await priceRequest(ctx, resolved.venue, requests, now) : { lines: [], problems: [] };
    let cart = await activeCartOf(ctx, joined.guest);
    if (!cart) {
      const id = await ctx.db.insert("carts", {
        venueId: resolved.venue._id,
        tableSessionId: joined.session._id,
        guestSessionId: joined.guest._id,
        status: "active",
        updatedAt: now,
      });
      cart = (await ctx.db.get(id))!;
    }
    for (const item of await cartItemsOf(ctx, cart._id)) await ctx.db.delete(item._id);
    // On ne garde que les lignes valables ; les autres sont dites au client, ligne par ligne.
    // Les lignes chiffrées suivent l'ordre des demandes, moins celles en défaut.
    const failed = new Set(priced.problems.map((p) => p.index));
    const accepted = requests.filter((_, i) => !failed.has(i));
    for (const [i, line] of priced.lines.entries()) {
      await ctx.db.insert("cartItems", {
        venueId: resolved.venue._id,
        cartId: cart._id,
        productId: line.productId as Id<"products">,
        ...(line.variantId ? { variantId: line.variantId as Id<"productVariants"> } : {}),
        modifierSelections: accepted[i]!.optionIds.map((o) => o as Id<"modifierOptions">),
        quantity: line.quantity,
        ...(line.instructions ? { instructions: line.instructions } : {}),
        addedByGuestSessionId: joined.guest._id,
        courseNumber: line.courseNumber,
        estimatedUnitPrice: line.unitPrice,
      });
    }
    await ctx.db.patch(cart._id, { updatedAt: now, tableSessionId: joined.session._id });
    return { ok: true, problems: priced.problems };
  },
});

/**
 * Envoyer son panier pour validation — seulement en `guest_with_approval`. Aucun bon n'est créé
 * avant qu'un serveur accepte (R8) ; sans réponse, la commande expire à 10 minutes.
 */
export const submitCart = mutation({
  args: { ...guestArgs, idempotencyKey: v.string() },
  handler: async (ctx, args) => {
    // garde : laissez-passer revérifié, mode de l'établissement vérifié côté serveur
    const resolved = await resolveGuestTable(ctx, args.pass, args.venueSlug);
    if (!resolved) return { ok: false as const, reason: "invalid_pass" as const };
    const settings = await settingsOf(ctx, resolved.venue._id);
    if (settings.service.orderingMode !== "guest_with_approval") return { ok: false as const, reason: "not_allowed" as const };
    if (!/^[A-Za-z0-9_-]{16,64}$/.test(args.idempotencyKey)) return { ok: false as const, reason: "invalid_key" as const };
    const replay = await ctx.db
      .query("orders")
      .withIndex("by_venue_idempotency", (q) => q.eq("venueId", resolved.venue._id).eq("idempotencyKey", args.idempotencyKey))
      .unique();
    if (replay) return { ok: true as const, reference: replay.reference };
    const limit = await rateLimiter.limit(ctx, "guestOrder", { key: resolved.code._id });
    if (!limit.ok) return { ok: false as const, reason: "rate_limited" as const, retryAfter: limit.retryAfter };
    const joined = await joinSession(ctx, resolved, args.guestKey);
    if ("error" in joined) return { ok: false as const, reason: joined.error };
    if (joined.guest.removedAt !== undefined) return { ok: false as const, reason: "removed" as const };
    // Par convive d'abord (D-098) : un seul téléphone n'épuise plus la limite de toute la tablée.
    const perGuest = await rateLimiter.limit(ctx, "guestOrderPerGuest", { key: joined.guest._id });
    if (!perGuest.ok) return { ok: false as const, reason: "rate_limited" as const, retryAfter: perGuest.retryAfter };
    const cart = await activeCartOf(ctx, joined.guest);
    if (!cart) return { ok: false as const, reason: "empty" as const };
    const items = await cartItemsOf(ctx, cart._id);
    if (items.length === 0) return { ok: false as const, reason: "empty" as const };
    const now = Date.now();
    const priced = await priceRequest(ctx, resolved.venue, cartLineRequests(items), now);
    if (priced.problems.length > 0) return { ok: false as const, reason: "problems" as const, problems: priced.problems };
    const { orderId, reference } = await createOrder(ctx, {
      venue: resolved.venue,
      session: joined.session,
      lines: priced.lines,
      heldCourses: [],
      idempotencyKey: args.idempotencyKey,
      channel: "guest",
      placedByGuestSessionId: joined.guest._id,
      actor: { type: "guest" },
      accepted: false,
      now,
    });
    await ctx.db.patch(cart._id, { status: "submitted", orderId, updatedAt: now });
    await ctx.scheduler.runAfter(APPROVAL_EXPIRE_MS, internal.guestService.expirePending, { orderId });
    return { ok: true as const, reference };
  },
});

/**
 * Le code de la tablée (D-095, D-096). Juste : le convive est admis à envoyer lui-même. Faux :
 * compté, cinq essais faux par QR et par 10 minutes, et à dix sur la tablée le code se renouvelle
 * de lui-même et la salle le voit. Déjà admis : rien à refaire.
 */
export const enterCode = mutation({
  args: { ...guestArgs, code: v.string() },
  handler: async (ctx, args) => {
    // garde : laissez-passer revérifié ; la table doit avoir été ouverte par le personnel
    const resolved = await resolveGuestTable(ctx, args.pass, args.venueSlug);
    if (!resolved) return { ok: false as const, reason: "invalid_pass" as const };
    const code = args.code.replace(/\s/g, "");
    if (!/^\d{4}$/.test(code)) return { ok: false as const, reason: "wrong_code" as const };
    if (!isGuestKey(args.guestKey)) return { ok: false as const, reason: "bad_key" as const };
    // Lecture seule d'abord : un code faux ne crée AUCUN convive. Sinon quinze essais à clé neuve
    // rempliraient la tablée et fermeraient la porte aux vrais clients (D-096).
    const { session, guest } = await guestPresence(ctx, resolved.table, args.guestKey);
    if (!session) return { ok: false as const, reason: "table_not_open" as const };
    if (guest?.removedAt !== undefined) return { ok: false as const, reason: "removed" as const };
    if (guest?.admittedAt !== undefined) return { ok: true as const };
    // Épuisé : on ne compare même pas.
    const budget = await rateLimiter.check(ctx, "guestCode", { key: resolved.code._id });
    if (!budget.ok) return { ok: false as const, reason: "rate_limited" as const, retryAfter: budget.retryAfter };
    if (session.activationCode !== undefined && session.activationCode === code) {
      const joined = await joinSession(ctx, resolved, args.guestKey, { proven: true });
      if ("error" in joined) return { ok: false as const, reason: joined.error };
      await ctx.db.patch(joined.guest._id, { admittedAt: Date.now(), admittedBy: "code" });
      return { ok: true as const };
    }
    await rateLimiter.limit(ctx, "guestCode", { key: resolved.code._id });
    const failures = (session.codeFailures ?? 0) + 1;
    if (failures >= CODE_FAILURES_BEFORE_ROTATION) {
      await ctx.db.patch(session._id, { activationCode: drawTableCode(), codeFailures: 0, codeAlertAt: Date.now() });
    } else {
      await ctx.db.patch(session._id, { codeFailures: failures });
    }
    return { ok: false as const, reason: "wrong_code" as const };
  },
});

/**
 * Envoyer en cuisine, en `guest_direct` seulement, pour un convive ADMIS (D-095, D-100). Une seule
 * mutation qui chiffre et crée la commande : pas d'état intermédiaire côté serveur à rejouer.
 * La clé d'envoi, gardée par le téléphone jusqu'à la réponse, rend le rejeu sûr : même clé, même
 * commande. Quatre convives qui envoient ensemble se disputent la session et le compteur du jour :
 * Convex rejoue la mutation perdante, et l'idempotence couvre un échec final.
 */
export const submitLines = mutation({
  args: {
    ...guestArgs,
    idempotencyKey: v.string(),
    lines: v.array(lineArg),
    /** Le panier envoyé est celui que le téléphone a montré au serveur (D-101). */
    shown: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    // garde : laissez-passer revérifié, mode et admission vérifiés côté serveur
    const resolved = await resolveGuestTable(ctx, args.pass, args.venueSlug);
    if (!resolved) return { ok: false as const, reason: "invalid_pass" as const };
    if (!/^[A-Za-z0-9_-]{16,64}$/.test(args.idempotencyKey)) return { ok: false as const, reason: "invalid_key" as const };
    // Rejouée : la même commande, et seulement si elle vient de ce téléphone. AVANT le mode, la
    // tablée et l'admission : une commande passée reste passée même si tout cela a changé depuis.
    const replay = await ownedReplay(ctx, resolved.venue._id, args.idempotencyKey, args.guestKey);
    if (replay === "foreign") return { ok: false as const, reason: "invalid_key" as const };
    if (replay) return { ok: true as const, reference: replay.reference, replayed: true };
    const settings = await settingsOf(ctx, resolved.venue._id);
    if (settings.service.orderingMode !== "guest_direct") return { ok: false as const, reason: "not_allowed" as const };
    const joined = await joinSession(ctx, resolved, args.guestKey);
    if ("error" in joined) return { ok: false as const, reason: joined.error };
    const guest = joined.guest;
    if (guest.removedAt !== undefined) return { ok: false as const, reason: "removed" as const };
    // Le panier montré a déjà été repris par le serveur : l'envoyer aussi le commanderait deux fois
    // (le serveur reprend, admet, et le client envoie avant d'avoir relu la table).
    if (args.shown) {
      const carts = await ctx.db
        .query("carts")
        .withIndex("by_guest", (q) => q.eq("guestSessionId", guest._id))
        .collect();
      const last = carts.sort((a, b) => b.updatedAt - a.updatedAt)[0];
      if (last && last.status !== "active" && last.takenAt !== undefined) return { ok: false as const, reason: "taken_by_waiter" as const };
    }
    if (!isAdmitted(guest)) return { ok: false as const, reason: "code_required" as const };
    if (args.lines.length === 0) return { ok: false as const, reason: "empty" as const };
    if (args.lines.length > CART_MAX_LINES) return { ok: false as const, reason: "too_many_lines" as const };
    const max = settings.service.guestMaxQuantityPerLine ?? GUEST_MAX_QUANTITY_DEFAULT;
    if (args.lines.some((l) => l.quantity > max)) return { ok: false as const, reason: "too_many" as const, max };
    for (const [name, key] of [["guestOrderPerGuest", guest._id], ["guestOrder", resolved.code._id]] as const) {
      const limit = await rateLimiter.limit(ctx, name, { key });
      if (!limit.ok) return { ok: false as const, reason: "rate_limited" as const, retryAfter: limit.retryAfter };
    }
    const now = Date.now();
    const requests: LineRequest[] = args.lines.map((l) => ({ ...l, courseNumber: 1 }));
    const priced = await priceRequest(ctx, resolved.venue, requests, now);
    if (priced.problems.length > 0) return { ok: false as const, reason: "problems" as const, problems: priced.problems };
    const { orderId, reference } = await createOrder(ctx, {
      venue: resolved.venue,
      session: joined.session,
      lines: priced.lines,
      heldCourses: [],
      idempotencyKey: args.idempotencyKey,
      channel: "guest",
      placedByGuestSessionId: guest._id,
      actor: { type: "guest" },
      accepted: true,
      now,
    });
    // Un panier montré en même temps n'a plus lieu d'être : il est parti.
    const shown = await activeCartOf(ctx, guest);
    if (shown) await ctx.db.patch(shown._id, { status: "submitted", orderId, updatedAt: now });
    await touchSession(ctx, joined.session._id, now);
    return { ok: true as const, reference, replayed: false };
  },
});

/**
 * L'avis d'un convive, après la clôture (D-105) : une note, un commentaire facultatif, des thèmes
 * pris dans une liste fermée. Aucune coordonnée, et aucun renvoi vers un avis public selon la
 * note — solliciter sélectivement les bons avis est interdit par Google.
 */
export const submitFeedback = mutation({
  args: { ...guestArgs, rating: v.number(), comment: v.optional(v.string()), topics: v.array(v.string()) },
  handler: async (ctx, args) => {
    // garde : laissez-passer revérifié ; le convive doit avoir été à la dernière tablée close
    const resolved = await resolveGuestTable(ctx, args.pass, args.venueSlug);
    if (!resolved) return { ok: false as const, reason: "invalid_pass" as const };
    if (!Number.isInteger(args.rating) || args.rating < 1 || args.rating > 5) return { ok: false as const, reason: "invalid" as const };
    const comment = args.comment?.trim() || undefined;
    if (comment && comment.length > 500) return { ok: false as const, reason: "invalid" as const };
    const topics = [...new Set(args.topics)];
    if (topics.some((t) => !(FEEDBACK_TOPICS as readonly string[]).includes(t))) return { ok: false as const, reason: "invalid" as const };
    const visit = await lastClosedVisit(ctx, resolved.table, args.guestKey);
    if (!visit) return { ok: false as const, reason: "not_eligible" as const };
    if (visit.done) return { ok: true as const };
    await ctx.db.insert("feedback", {
      venueId: resolved.venue._id,
      tableSessionId: visit.session._id,
      guestSessionId: visit.guest._id,
      rating: args.rating,
      ...(comment ? { comment } : {}),
      topics,
      isPublicRedirect: false,
      status: "new",
      createdAt: Date.now(),
    });
    return { ok: true as const };
  },
});

/** Une commande du client que personne n'a validée en 10 minutes est refusée, et il le lit. */
export const expirePending = internalMutation({
  args: { orderId: v.id("orders") },
  handler: async (ctx, args) => {
    const order = await ctx.db.get(args.orderId);
    if (!order || order.status !== "pending_acceptance") return;
    const reason = EXPIRED_REASON;
    await ctx.db.patch(order._id, { status: "rejected", rejectedReason: reason });
    const items = await ctx.db
      .query("orderItems")
      .withIndex("by_order", (q) => q.eq("orderId", order._id))
      .collect();
    for (const item of items) await ctx.db.patch(item._id, { status: "cancelled", cancelledReason: reason });
    await writeOrderEvent(ctx, order, "expired", { type: "system" });
  },
});

/** Appeler un serveur, demander l'addition… Même avant l'ouverture de la table. */
export const requestService = mutation({
  args: { ...guestArgs, type: v.string() },
  handler: async (ctx, args) => {
    // garde : laissez-passer revérifié ; délai par table et par type, plafond par QR
    const resolved = await resolveGuestTable(ctx, args.pass, args.venueSlug);
    if (!resolved) return { ok: false as const, reason: "invalid_pass" as const };
    const settings = await settingsOf(ctx, resolved.venue._id);
    const type = settings.serviceRequestTypes.find((t) => t.key === args.type && t.enabled);
    if (!type) return { ok: false as const, reason: "unknown_type" as const };
    const now = Date.now();
    const recent = await ctx.db
      .query("serviceRequests")
      .withIndex("by_table_created", (q) => q.eq("tableId", resolved.table._id).gte("createdAt", now - type.cooldownSeconds * 1000))
      .collect();
    const pending = recent.find((r) => r.type === type.key && (r.status === "open" || r.status === "acknowledged"));
    if (pending) return { ok: true as const, already: true, retryAfter: pending.createdAt + type.cooldownSeconds * 1000 - now };
    const limit = await rateLimiter.limit(ctx, "guestRequest", { key: resolved.code._id });
    if (!limit.ok) return { ok: false as const, reason: "rate_limited" as const, retryAfter: limit.retryAfter };
    const { session, guest } = await guestPresence(ctx, resolved.table, args.guestKey);
    await ctx.db.insert("serviceRequests", {
      venueId: resolved.venue._id,
      tableId: resolved.table._id,
      ...(session ? { tableSessionId: session._id } : {}),
      ...(guest ? { guestSessionId: guest._id } : {}),
      type: type.key,
      status: "open",
      createdAt: now,
    });
    if (session) await touchSession(ctx, session._id, now);
    return { ok: true as const, already: false, retryAfter: type.cooldownSeconds * 1000 };
  },
});
