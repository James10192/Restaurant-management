/**
 * Groupes d'options — Joliba
 *
 * « Cuisson : Saignant / À point / Bien cuit » se saisit une fois et se rattache à quinze
 * produits. Le corriger ici le corrige partout — d'où une table de groupes plutôt qu'une
 * copie par produit (DATA_MODEL.md §4).
 *
 * Un supplément payant (« + 500 F ») est un prix : le fixer exige `menu.price.edit`.
 */

import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import type { Doc, Id } from "./_generated/dataModel";
import { writeAudit } from "./lib/audit";
import { assertSamePermutation, getInVenue } from "./lib/catalogAccess";
import { LIMITS, assertPriceDelta, assertSelectionBounds, cleanI18n, cleanName } from "./lib/catalog";
import { conflict, forbidden, invalid } from "./lib/errors";
import { requirePermission, type ReadCtx } from "./lib/guards";

const MAX_GROUPS_PER_VENUE = 100;

const i18nArg = v.optional(
  v.record(v.string(), v.object({ name: v.optional(v.string()), description: v.optional(v.string()) })),
);
const selectionType = v.union(v.literal("single"), v.literal("multiple"));

async function optionsOf(ctx: ReadCtx, groupId: Id<"modifierGroups">) {
  return ctx.db
    .query("modifierOptions")
    .withIndex("by_group_sort", (q) => q.eq("modifierGroupId", groupId))
    .collect();
}

async function usersOf(ctx: ReadCtx, groupId: Id<"modifierGroups">) {
  return ctx.db
    .query("productModifierGroups")
    .withIndex("by_group", (q) => q.eq("modifierGroupId", groupId))
    .collect();
}

/** Les groupes, leurs options, et combien de produits les utilisent — avant d'en modifier un. */
export const list = query({
  args: { venueId: v.id("venues") },
  handler: async (ctx, args) => {
    const actor = await requirePermission(ctx, "menu.read", { venueId: args.venueId });
    const groups = await ctx.db
      .query("modifierGroups")
      .withIndex("by_venue", (q) => q.eq("venueId", actor.venue._id))
      .collect();
    const result = [];
    for (const group of groups) {
      const options = await optionsOf(ctx, group._id);
      result.push({
        _id: group._id,
        name: group.name,
        i18n: group.i18n ?? null,
        selectionType: group.selectionType,
        minSelect: group.minSelect,
        maxSelect: group.maxSelect,
        isRequired: group.isRequired,
        productCount: (await usersOf(ctx, group._id)).length,
        options: options.map((o) => ({
          _id: o._id,
          name: o.name,
          i18n: o.i18n ?? null,
          priceDelta: o.priceDelta,
          isAvailable: o.isAvailable,
        })),
      });
    }
    return result.sort((a, b) => a.name.localeCompare(b.name, "fr"));
  },
});

export const createGroup = mutation({
  args: {
    venueId: v.id("venues"),
    name: v.string(),
    selectionType,
    minSelect: v.number(),
    maxSelect: v.number(),
    isRequired: v.boolean(),
    options: v.array(v.object({ name: v.string(), priceDelta: v.number() })),
  },
  handler: async (ctx, args) => {
    const actor = await requirePermission(ctx, "menu.edit", { venueId: args.venueId });
    if (args.options.some((o) => o.priceDelta !== 0) && !actor.permissions.has("menu.price.edit")) {
      throw forbidden("Un supplément payant est un prix : il faut le droit de modifier les prix.");
    }
    if (args.options.length > LIMITS.options) throw invalid(`Pas plus de ${LIMITS.options} options par groupe.`);
    const count = (
      await ctx.db
        .query("modifierGroups")
        .withIndex("by_venue", (q) => q.eq("venueId", actor.venue._id))
        .collect()
    ).length;
    if (count >= MAX_GROUPS_PER_VENUE) throw invalid(`Pas plus de ${MAX_GROUPS_PER_VENUE} groupes d'options.`);
    const bounds = assertSelectionBounds(args);
    const groupId = await ctx.db.insert("modifierGroups", {
      venueId: actor.venue._id,
      name: cleanName(args.name, "Le nom du groupe"),
      selectionType: args.selectionType,
      isRequired: args.isRequired,
      ...bounds,
    });
    for (const [index, option] of args.options.entries()) {
      await ctx.db.insert("modifierOptions", {
        venueId: actor.venue._id,
        modifierGroupId: groupId,
        name: cleanName(option.name, "Le nom de l'option"),
        priceDelta: assertPriceDelta(option.priceDelta),
        isAvailable: true,
        sortOrder: index,
      });
    }
    return groupId;
  },
});

export const updateGroup = mutation({
  args: {
    venueId: v.id("venues"),
    modifierGroupId: v.id("modifierGroups"),
    name: v.optional(v.string()),
    i18n: i18nArg,
    selectionType: v.optional(selectionType),
    minSelect: v.optional(v.number()),
    maxSelect: v.optional(v.number()),
    isRequired: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const actor = await requirePermission(ctx, "menu.edit", { venueId: args.venueId });
    const group = await getInVenue(ctx, args.modifierGroupId, actor.venue._id, "Ce groupe d'options");
    const patch: Partial<Doc<"modifierGroups">> = {};
    if (args.name !== undefined) patch.name = cleanName(args.name, "Le nom du groupe");
    if (args.i18n !== undefined) patch.i18n = cleanI18n(args.i18n);
    const next = {
      selectionType: args.selectionType ?? group.selectionType,
      minSelect: args.minSelect ?? group.minSelect,
      maxSelect: args.maxSelect ?? group.maxSelect,
      isRequired: args.isRequired ?? group.isRequired,
    };
    Object.assign(patch, next, assertSelectionBounds(next));
    await ctx.db.patch(group._id, patch);
  },
});

/**
 * Supprimer un groupe encore utilisé est refusé, AVEC la liste des produits concernés :
 * un simple « impossible » laisserait chercher à la main lesquels.
 */
export const deleteGroup = mutation({
  args: { venueId: v.id("venues"), modifierGroupId: v.id("modifierGroups") },
  handler: async (ctx, args) => {
    const actor = await requirePermission(ctx, "menu.edit", { venueId: args.venueId });
    const group = await getInVenue(ctx, args.modifierGroupId, actor.venue._id, "Ce groupe d'options");
    const users = await usersOf(ctx, group._id);
    if (users.length > 0) {
      const names: string[] = [];
      for (const link of users.slice(0, 5)) {
        const product = await ctx.db.get(link.productId);
        if (product) names.push(product.name);
      }
      const more = users.length > names.length ? ` et ${users.length - names.length} autre(s)` : "";
      throw conflict(`Ce groupe est utilisé par : ${names.join(", ")}${more}. Retirez-le d'abord de ces produits.`);
    }
    for (const option of await optionsOf(ctx, group._id)) await ctx.db.delete(option._id);
    await ctx.db.delete(group._id);
    await writeAudit(ctx, {
      organizationId: actor.organization._id,
      venueId: actor.venue._id,
      actorUserId: actor.user._id,
      action: "modifier_group.delete",
      resourceType: "modifierGroup",
      resourceId: group._id,
      before: { name: group.name },
    });
  },
});

export const addOption = mutation({
  args: { venueId: v.id("venues"), modifierGroupId: v.id("modifierGroups"), name: v.string(), priceDelta: v.number() },
  handler: async (ctx, args) => {
    const actor = await requirePermission(ctx, "menu.edit", { venueId: args.venueId });
    if (args.priceDelta !== 0 && !actor.permissions.has("menu.price.edit")) {
      throw forbidden("Un supplément payant est un prix : il faut le droit de modifier les prix.");
    }
    const group = await getInVenue(ctx, args.modifierGroupId, actor.venue._id, "Ce groupe d'options");
    const options = await optionsOf(ctx, group._id);
    if (options.length >= LIMITS.options) throw invalid(`Pas plus de ${LIMITS.options} options par groupe.`);
    return ctx.db.insert("modifierOptions", {
      venueId: actor.venue._id,
      modifierGroupId: group._id,
      name: cleanName(args.name, "Le nom de l'option"),
      priceDelta: assertPriceDelta(args.priceDelta),
      isAvailable: true,
      sortOrder: options.reduce((max, o) => Math.max(max, o.sortOrder + 1), 0),
    });
  },
});

export const updateOption = mutation({
  args: { venueId: v.id("venues"), optionId: v.id("modifierOptions"), name: v.optional(v.string()), i18n: i18nArg },
  handler: async (ctx, args) => {
    const actor = await requirePermission(ctx, "menu.edit", { venueId: args.venueId });
    const option = await getInVenue(ctx, args.optionId, actor.venue._id, "Cette option");
    const patch: Partial<Doc<"modifierOptions">> = {};
    if (args.name !== undefined) patch.name = cleanName(args.name, "Le nom de l'option");
    if (args.i18n !== undefined) patch.i18n = cleanI18n(args.i18n);
    await ctx.db.patch(option._id, patch);
  },
});

export const setOptionPrice = mutation({
  args: { venueId: v.id("venues"), optionId: v.id("modifierOptions"), priceDelta: v.number() },
  handler: async (ctx, args) => {
    const actor = await requirePermission(ctx, "menu.price.edit", { venueId: args.venueId });
    const option = await getInVenue(ctx, args.optionId, actor.venue._id, "Cette option");
    const priceDelta = assertPriceDelta(args.priceDelta);
    await ctx.db.patch(option._id, { priceDelta });
    await writeAudit(ctx, {
      organizationId: actor.organization._id,
      venueId: actor.venue._id,
      actorUserId: actor.user._id,
      action: "modifier_option.price.update",
      resourceType: "modifierOption",
      resourceId: option._id,
      before: { priceDelta: option.priceDelta },
      after: { priceDelta },
    });
  },
});

export const removeOption = mutation({
  args: { venueId: v.id("venues"), optionId: v.id("modifierOptions") },
  handler: async (ctx, args) => {
    const actor = await requirePermission(ctx, "menu.edit", { venueId: args.venueId });
    const option = await getInVenue(ctx, args.optionId, actor.venue._id, "Cette option");
    const siblings = await optionsOf(ctx, option.modifierGroupId);
    const group = await ctx.db.get(option.modifierGroupId);
    if (group && siblings.length - 1 < group.minSelect) {
      throw invalid(`Ce groupe exige au moins ${group.minSelect} choix : il doit garder assez d'options.`);
    }
    await ctx.db.delete(option._id);
  },
});

export const reorderOptions = mutation({
  args: { venueId: v.id("venues"), modifierGroupId: v.id("modifierGroups"), optionIds: v.array(v.id("modifierOptions")) },
  handler: async (ctx, args) => {
    const actor = await requirePermission(ctx, "menu.edit", { venueId: args.venueId });
    const group = await getInVenue(ctx, args.modifierGroupId, actor.venue._id, "Ce groupe d'options");
    const options = await optionsOf(ctx, group._id);
    assertSamePermutation(
      options.map((o) => o._id),
      args.optionIds,
    );
    for (const [index, id] of args.optionIds.entries()) await ctx.db.patch(id, { sortOrder: index });
  },
});
