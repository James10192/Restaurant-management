/**
 * Salle : zones et tables — Joliba
 *
 * La table est le meuble, durable. Son numéro est UNIQUE dans l'établissement : c'est ce
 * que le client lit sur la table et ce que le serveur annonce à voix haute.
 *
 * Ce module ne touche jamais `status = occupied / reserved` ni `activeSessionId` : ce sont
 * les sessions de table qui les écrivent (tranche T2). Ici, une table est seulement « en
 * service » ou « hors service ».
 */

import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import type { Doc, Id } from "./_generated/dataModel";
import { writeAudit } from "./lib/audit";
import { assertSamePermutation, getInVenue } from "./lib/catalogAccess";
import { cleanName } from "./lib/catalog";
import { conflict, invalid } from "./lib/errors";
import { requirePermission, type MutationCtx, type ReadCtx, type VenueActor } from "./lib/guards";
import { createQrCode, revokeQrCodes } from "./qr";

const MAX_AREAS = 12;
const MAX_TABLES = 300;
const DEFAULT_CANVAS = { width: 1000, height: 700 };
const DEFAULT_TABLE = { width: 80, height: 80 };
const GRID = 20;

const shape = v.union(v.literal("square"), v.literal("round"), v.literal("rect"));

/** « 12 », « T3 », « VIP-2 » : court, lisible à voix haute, sans ambiguïté de casse. */
export function cleanTableNumber(value: string): string {
  const number = value.trim().toUpperCase();
  if (!/^[0-9A-Z][0-9A-Z-]{0,7}$/.test(number)) {
    throw invalid("Le numéro de table : 1 à 8 caractères, chiffres, lettres ou tirets (12, T3, VIP-2).");
  }
  return number;
}

function assertSeats(seats: number) {
  if (!Number.isInteger(seats) || seats < 1 || seats > 40) throw invalid("Le nombre de places va de 1 à 40.");
}

/** Les zones en service. Une zone supprimée reste en base (l'historique s'y rattache) mais disparaît. */
async function areasOf(ctx: ReadCtx, venueId: Id<"venues">) {
  return (
    await ctx.db
      .query("serviceAreas")
      .withIndex("by_venue_sort", (q) => q.eq("venueId", venueId))
      .collect()
  ).filter((a) => a.isActive);
}

async function tablesOf(ctx: ReadCtx, areaId: Id<"serviceAreas">) {
  return ctx.db
    .query("restaurantTables")
    .withIndex("by_area", (q) => q.eq("serviceAreaId", areaId))
    .collect();
}

async function numberTaken(ctx: ReadCtx, venueId: Id<"venues">, number: string, except?: Id<"restaurantTables">) {
  const existing = await ctx.db
    .query("restaurantTables")
    .withIndex("by_venue_number", (q) => q.eq("venueId", venueId).eq("number", number))
    .collect();
  return existing.some((t) => t.isActive && t._id !== except);
}

async function activeTableCount(ctx: ReadCtx, venueId: Id<"venues">) {
  return (
    await ctx.db
      .query("restaurantTables")
      .withIndex("by_venue_status", (q) => q.eq("venueId", venueId))
      .collect()
  ).filter((t) => t.isActive).length;
}

/** Première place libre sur la grille, de gauche à droite puis de haut en bas. */
function nextSlot(area: Doc<"serviceAreas">, tables: readonly Doc<"restaurantTables">[]) {
  const step = DEFAULT_TABLE.width + GRID * 2;
  const perRow = Math.max(1, Math.floor((area.canvasWidth - GRID) / step));
  for (let i = 0; i < 400; i++) {
    const x = GRID + (i % perRow) * step;
    const y = GRID + Math.floor(i / perRow) * step;
    const free = tables.every((t) => !t.isActive || Math.abs(t.x - x) >= step / 2 || Math.abs(t.y - y) >= step / 2);
    if (free) return { x, y };
  }
  return { x: GRID, y: GRID };
}

/** Le plan de salle : zones, tables, et l'état de leur QR (le jeton n'est jamais renvoyé ici). */
export const overview = query({
  args: { venueId: v.id("venues") },
  handler: async (ctx, args) => {
    const actor = await requirePermission(ctx, "table.read", { venueId: args.venueId });
    const areas = await areasOf(ctx, actor.venue._id);
    const result = [];
    for (const area of areas) {
      const tables = (await tablesOf(ctx, area._id)).filter((t) => t.isActive);
      const rows = [];
      for (const table of tables) {
        const qr = await ctx.db
          .query("tableQrCodes")
          .withIndex("by_table", (q) => q.eq("tableId", table._id))
          .collect();
        const active = qr.find((code) => code.status === "active");
        rows.push({
          _id: table._id,
          number: table.number,
          label: table.label ?? null,
          seats: table.seats,
          shape: table.shape,
          x: table.x,
          y: table.y,
          width: table.width,
          height: table.height,
          rotation: table.rotation ?? 0,
          status: table.status,
          qr: active
            ? { version: active.version, scanCount: active.scanCount, lastScannedAt: active.lastScannedAt ?? null, createdAt: active._creationTime }
            : null,
        });
      }
      rows.sort((a, b) => a.number.localeCompare(b.number, "fr", { numeric: true }));
      result.push({
        _id: area._id,
        name: area.name,
        canvasWidth: area.canvasWidth,
        canvasHeight: area.canvasHeight,
        tables: rows,
      });
    }
    return {
      areas: result,
      canManage: actor.permissions.has("table.manage"),
      canManageQr: actor.permissions.has("table.qr.manage"),
    };
  },
});

/** Crée une ou plusieurs zones d'un coup (« Salle, Terrasse, VIP »). */
export const createAreas = mutation({
  args: { venueId: v.id("venues"), names: v.array(v.string()) },
  handler: async (ctx, args) => {
    const actor = await requirePermission(ctx, "table.manage", { venueId: args.venueId });
    const areas = await areasOf(ctx, actor.venue._id);
    if (args.names.length === 0 || areas.length + args.names.length > MAX_AREAS) {
      throw invalid(`Entre 1 et ${MAX_AREAS} zones par établissement.`);
    }
    let sortOrder = areas.reduce((max, a) => Math.max(max, a.sortOrder + 1), 0);
    const ids: Id<"serviceAreas">[] = [];
    for (const name of args.names) {
      ids.push(
        await ctx.db.insert("serviceAreas", {
          venueId: actor.venue._id,
          name: cleanName(name, "Le nom de la zone"),
          sortOrder: sortOrder++,
          canvasWidth: DEFAULT_CANVAS.width,
          canvasHeight: DEFAULT_CANVAS.height,
          isActive: true,
        }),
      );
    }
    return ids;
  },
});

export const updateArea = mutation({
  args: {
    venueId: v.id("venues"),
    serviceAreaId: v.id("serviceAreas"),
    name: v.optional(v.string()),
    canvasWidth: v.optional(v.number()),
    canvasHeight: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const actor = await requirePermission(ctx, "table.manage", { venueId: args.venueId });
    const area = await getInVenue(ctx, args.serviceAreaId, actor.venue._id, "Cette zone");
    const patch: Partial<Doc<"serviceAreas">> = {};
    if (args.name !== undefined) patch.name = cleanName(args.name, "Le nom de la zone");
    for (const key of ["canvasWidth", "canvasHeight"] as const) {
      const value = args[key];
      if (value === undefined) continue;
      if (!Number.isInteger(value) || value < 300 || value > 4000) throw invalid("Dimensions du plan invalides.");
      patch[key] = value;
    }
    await ctx.db.patch(area._id, patch);
  },
});

export const reorderAreas = mutation({
  args: { venueId: v.id("venues"), serviceAreaIds: v.array(v.id("serviceAreas")) },
  handler: async (ctx, args) => {
    const actor = await requirePermission(ctx, "table.manage", { venueId: args.venueId });
    const areas = await areasOf(ctx, actor.venue._id);
    assertSamePermutation(
      areas.map((a) => a._id),
      args.serviceAreaIds,
    );
    for (const [index, id] of args.serviceAreaIds.entries()) await ctx.db.patch(id, { sortOrder: index });
  },
});

/** Une zone qui porte encore des tables ne se supprime pas : on les déplace ou on les retire d'abord. */
export const deleteArea = mutation({
  args: { venueId: v.id("venues"), serviceAreaId: v.id("serviceAreas") },
  handler: async (ctx, args) => {
    const actor = await requirePermission(ctx, "table.manage", { venueId: args.venueId });
    const area = await getInVenue(ctx, args.serviceAreaId, actor.venue._id, "Cette zone");
    const tables = (await tablesOf(ctx, area._id)).filter((t) => t.isActive);
    if (tables.length > 0) {
      throw conflict(`Cette zone contient encore ${tables.length} table(s). Déplacez-les ou retirez-les d'abord.`);
    }
    // Les tables retirées gardent leur zone pour l'historique : on archive la zone.
    await ctx.db.patch(area._id, { isActive: false, name: `${area.name} (supprimée)`.slice(0, 80) });
  },
});

async function insertTable(
  ctx: MutationCtx,
  actor: VenueActor,
  area: Doc<"serviceAreas">,
  input: { number: string; seats: number; shape: "square" | "round" | "rect"; label?: string },
  existing: Doc<"restaurantTables">[],
) {
  const number = cleanTableNumber(input.number);
  if (await numberTaken(ctx, actor.venue._id, number)) throw conflict(`La table ${number} existe déjà dans cet établissement.`);
  assertSeats(input.seats);
  const slot = nextSlot(area, existing);
  const width = input.shape === "rect" ? DEFAULT_TABLE.width * 2 : DEFAULT_TABLE.width;
  const tableId = await ctx.db.insert("restaurantTables", {
    venueId: actor.venue._id,
    serviceAreaId: area._id,
    number,
    ...(input.label ? { label: cleanName(input.label, "Le libellé") } : {}),
    seats: input.seats,
    shape: input.shape,
    ...slot,
    width,
    height: DEFAULT_TABLE.height,
    status: "available",
    isActive: true,
  });
  // Avec le droit, la table naît avec son QR : elle est aussitôt imprimable.
  if (actor.permissions.has("table.qr.manage")) await createQrCode(ctx, actor.venue._id, tableId, actor.user._id, 1);
  return (await ctx.db.get(tableId))!;
}

export const createTable = mutation({
  args: {
    venueId: v.id("venues"),
    serviceAreaId: v.id("serviceAreas"),
    number: v.string(),
    seats: v.number(),
    shape,
    label: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const actor = await requirePermission(ctx, "table.manage", { venueId: args.venueId });
    const area = await getInVenue(ctx, args.serviceAreaId, actor.venue._id, "Cette zone");
    if (!area.isActive) throw invalid("Cette zone a été supprimée.");
    if ((await activeTableCount(ctx, actor.venue._id)) >= MAX_TABLES) throw invalid(`Pas plus de ${MAX_TABLES} tables.`);
    const table = await insertTable(ctx, actor, area, args, await tablesOf(ctx, area._id));
    return table._id;
  },
});

/**
 * Crée une rangée de tables numérotées (« de 1 à 12, quatre places »). Tout ou rien : si un
 * numéro est déjà pris, aucune table n'est créée et le message dit lequel.
 */
export const createTableRange = mutation({
  args: {
    venueId: v.id("venues"),
    serviceAreaId: v.id("serviceAreas"),
    from: v.number(),
    to: v.number(),
    prefix: v.optional(v.string()),
    seats: v.number(),
    shape,
  },
  handler: async (ctx, args) => {
    const actor = await requirePermission(ctx, "table.manage", { venueId: args.venueId });
    const area = await getInVenue(ctx, args.serviceAreaId, actor.venue._id, "Cette zone");
    if (!area.isActive) throw invalid("Cette zone a été supprimée.");
    if (!Number.isInteger(args.from) || !Number.isInteger(args.to) || args.from < 0 || args.to < args.from || args.to - args.from >= 50) {
      throw invalid("Une rangée compte de 1 à 50 tables, numérotées dans l'ordre.");
    }
    if ((await activeTableCount(ctx, actor.venue._id)) + (args.to - args.from + 1) > MAX_TABLES) {
      throw invalid(`Pas plus de ${MAX_TABLES} tables.`);
    }
    const existing = await tablesOf(ctx, area._id);
    const ids: Id<"restaurantTables">[] = [];
    for (let n = args.from; n <= args.to; n++) {
      // Une mutation qui lève annule toutes ses écritures : « tout ou rien » est gratuit ici.
      const table = await insertTable(ctx, actor, area, { number: `${args.prefix ?? ""}${n}`, seats: args.seats, shape: args.shape }, existing);
      existing.push(table);
      ids.push(table._id);
    }
    return ids;
  },
});

export const updateTable = mutation({
  args: {
    venueId: v.id("venues"),
    tableId: v.id("restaurantTables"),
    number: v.optional(v.string()),
    label: v.optional(v.union(v.string(), v.null())),
    seats: v.optional(v.number()),
    shape: v.optional(shape),
    serviceAreaId: v.optional(v.id("serviceAreas")),
    inService: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const actor = await requirePermission(ctx, "table.manage", { venueId: args.venueId });
    const table = await getInVenue(ctx, args.tableId, actor.venue._id, "Cette table");
    if (!table.isActive) throw invalid("Cette table a été retirée.");
    const patch: Partial<Doc<"restaurantTables">> = {};
    if (args.number !== undefined) {
      const number = cleanTableNumber(args.number);
      if (number !== table.number && (await numberTaken(ctx, actor.venue._id, number, table._id))) {
        throw conflict(`La table ${number} existe déjà dans cet établissement.`);
      }
      patch.number = number;
    }
    if (args.label !== undefined) patch.label = args.label === null || args.label.trim() === "" ? undefined : cleanName(args.label, "Le libellé");
    if (args.seats !== undefined) {
      assertSeats(args.seats);
      patch.seats = args.seats;
    }
    if (args.shape !== undefined) patch.shape = args.shape;
    if (args.serviceAreaId !== undefined && args.serviceAreaId !== table.serviceAreaId) {
      const area = await getInVenue(ctx, args.serviceAreaId, actor.venue._id, "Cette zone");
      if (!area.isActive) throw invalid("Cette zone a été supprimée.");
      patch.serviceAreaId = area._id;
      Object.assign(patch, nextSlot(area, await tablesOf(ctx, area._id)));
    }
    if (args.inService !== undefined) {
      if (table.status === "occupied" || table.status === "reserved") {
        throw conflict("Cette table est occupée : libérez-la avant de la mettre hors service.");
      }
      patch.status = args.inService ? "available" : "out_of_service";
    }
    await ctx.db.patch(table._id, patch);
  },
});

/**
 * Enregistre les positions après une séance de disposition. Une seule écriture pour tout
 * le plan : le plan se dessine, puis se sauvegarde, il ne s'écrit pas à chaque pixel.
 */
export const saveLayout = mutation({
  args: {
    venueId: v.id("venues"),
    serviceAreaId: v.id("serviceAreas"),
    tables: v.array(
      v.object({
        tableId: v.id("restaurantTables"),
        x: v.number(),
        y: v.number(),
        width: v.number(),
        height: v.number(),
        rotation: v.number(),
      }),
    ),
  },
  handler: async (ctx, args) => {
    const actor = await requirePermission(ctx, "table.manage", { venueId: args.venueId });
    const area = await getInVenue(ctx, args.serviceAreaId, actor.venue._id, "Cette zone");
    for (const t of args.tables) {
      const table = await getInVenue(ctx, t.tableId, actor.venue._id, "Une des tables");
      if (table.serviceAreaId !== area._id) throw invalid("Une des tables n'appartient pas à cette zone.");
      const ok =
        [t.x, t.y, t.width, t.height, t.rotation].every(Number.isFinite) &&
        t.width >= 40 &&
        t.height >= 40 &&
        t.width <= 400 &&
        t.height <= 400 &&
        t.x >= 0 &&
        t.y >= 0 &&
        t.x + t.width <= area.canvasWidth &&
        t.y + t.height <= area.canvasHeight;
      if (!ok) throw invalid(`La table ${table.number} sort du plan.`);
      await ctx.db.patch(table._id, {
        x: Math.round(t.x),
        y: Math.round(t.y),
        width: Math.round(t.width),
        height: Math.round(t.height),
        rotation: ((Math.round(t.rotation) % 360) + 360) % 360,
      });
    }
  },
});

/** Retire une table (jamais supprimée : l'historique des sessions s'y rattache). Ses QR cessent de fonctionner. */
export const removeTable = mutation({
  args: { venueId: v.id("venues"), tableId: v.id("restaurantTables") },
  handler: async (ctx, args) => {
    const actor = await requirePermission(ctx, "table.manage", { venueId: args.venueId });
    const table = await getInVenue(ctx, args.tableId, actor.venue._id, "Cette table");
    if (!table.isActive) return;
    if (table.status === "occupied" || table.status === "reserved") {
      throw conflict("Cette table est occupée : libérez-la avant de la retirer.");
    }
    await ctx.db.patch(table._id, { isActive: false, status: "out_of_service" });
    await revokeQrCodes(ctx, table._id);
    await writeAudit(ctx, {
      organizationId: actor.organization._id,
      venueId: actor.venue._id,
      actorUserId: actor.user._id,
      action: "table.remove",
      resourceType: "restaurantTable",
      resourceId: table._id,
      before: { number: table.number },
    });
  },
});
