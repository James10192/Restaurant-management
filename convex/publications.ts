/**
 * Publication de la carte — Joliba
 *
 * Ce que le client voit, c'est une PUBLICATION : une version figée, datée, signée par son
 * auteur (R22). Une publication ne se modifie jamais. Revenir en arrière crée une NOUVELLE
 * version qui reprend le contenu d'une ancienne : l'historique reste la suite exacte de ce
 * qui a été montré, et on peut toujours répondre à « quel prix était affiché mardi ? ».
 */

import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import type { Doc, Id } from "./_generated/dataModel";
import { writeAudit } from "./lib/audit";
import { getInVenue } from "./lib/catalogAccess";
import { conflict, forbidden, invalid } from "./lib/errors";
import { requirePermission, type MutationCtx, type ReadCtx } from "./lib/guards";
import {
  MAX_SNAPSHOT_BYTES,
  buildDraftSnapshot,
  countProducts,
  diffSnapshots,
  pricedDifferently,
  snapshotSize,
  type MenuSnapshot,
} from "./lib/menuSnapshot";

async function versionsOf(ctx: ReadCtx, menuId: Id<"menus">) {
  return ctx.db
    .query("menuPublications")
    .withIndex("by_menu_version", (q) => q.eq("menuId", menuId))
    .collect();
}

async function currentPublication(ctx: ReadCtx, menuId: Id<"menus">): Promise<Doc<"menuPublications"> | null> {
  return (await versionsOf(ctx, menuId)).find((p) => p.isCurrent) ?? null;
}

/**
 * Enregistre une nouvelle version courante. Une seule version courante par carte : la
 * précédente cesse de l'être dans la MÊME transaction, le client ne voit jamais deux cartes.
 */
async function insertVersion(
  ctx: MutationCtx,
  menu: Doc<"menus">,
  snapshot: MenuSnapshot,
  userId: Id<"users">,
): Promise<{ publicationId: Id<"menuPublications">; version: number }> {
  if (countProducts(snapshot) === 0) {
    throw invalid("La carte est vide : ajoutez au moins un produit avant de la publier.");
  }
  if (snapshotSize(snapshot) > MAX_SNAPSHOT_BYTES) {
    throw invalid(
      "Cette carte est trop volumineuse pour être publiée d'un seul tenant. Scindez-la en plusieurs cartes (par exemple « Plats » et « Boissons »).",
    );
  }
  const versions = await versionsOf(ctx, menu._id);
  const version = versions.reduce((max, p) => Math.max(max, p.version), 0) + 1;
  for (const p of versions) if (p.isCurrent) await ctx.db.patch(p._id, { isCurrent: false });
  const publicationId = await ctx.db.insert("menuPublications", {
    venueId: menu.venueId,
    menuId: menu._id,
    version,
    snapshot,
    publishedByUserId: userId,
    publishedAt: Date.now(),
    isCurrent: true,
  });
  await ctx.db.patch(menu._id, { status: "published", publishedVersionId: publicationId });
  return { publicationId, version };
}

/** « 7 modifications non publiées », et lesquelles. */
export const pendingChanges = query({
  args: { venueId: v.id("venues"), menuId: v.id("menus") },
  handler: async (ctx, args) => {
    const actor = await requirePermission(ctx, "menu.read", { venueId: args.venueId });
    const menu = await getInVenue(ctx, args.menuId, actor.venue._id, "Cette carte");
    const current = await currentPublication(ctx, menu._id);
    const draft = await buildDraftSnapshot(ctx, menu, actor.venue.currency);
    const changes = diffSnapshots(current ? (current.snapshot as MenuSnapshot) : null, draft);
    return {
      isPublished: current !== null,
      version: current?.version ?? null,
      publishedAt: current?.publishedAt ?? null,
      changes,
      productCount: countProducts(draft),
      canPublish: actor.permissions.has("menu.publish"),
    };
  },
});

export const publish = mutation({
  args: { venueId: v.id("venues"), menuId: v.id("menus") },
  handler: async (ctx, args) => {
    const actor = await requirePermission(ctx, "menu.publish", { venueId: args.venueId });
    const menu = await getInVenue(ctx, args.menuId, actor.venue._id, "Cette carte");
    if (menu.status === "archived") throw invalid("Cette carte est archivée.");
    const draft = await buildDraftSnapshot(ctx, menu, actor.venue.currency);
    const current = await currentPublication(ctx, menu._id);
    if (current && diffSnapshots(current.snapshot as MenuSnapshot, draft).length === 0) {
      // Rien à publier : pas de version vide dans l'historique.
      return { version: current.version, changed: false };
    }
    const { publicationId, version } = await insertVersion(ctx, menu, draft, actor.user._id);
    await writeAudit(ctx, {
      organizationId: actor.organization._id,
      venueId: actor.venue._id,
      actorUserId: actor.user._id,
      action: "menu.publish",
      resourceType: "menuPublication",
      resourceId: publicationId,
      after: { menuId: menu._id, version, products: countProducts(draft) },
    });
    return { version, changed: true };
  },
});

/** L'historique des versions, de la plus récente à la plus ancienne. */
export const history = query({
  args: { venueId: v.id("venues"), menuId: v.id("menus") },
  handler: async (ctx, args) => {
    const actor = await requirePermission(ctx, "menu.read", { venueId: args.venueId });
    const menu = await getInVenue(ctx, args.menuId, actor.venue._id, "Cette carte");
    const versions = (await versionsOf(ctx, menu._id)).sort((a, b) => b.version - a.version);
    const names = new Map<string, string>();
    const rows = [];
    for (const p of versions) {
      if (!names.has(p.publishedByUserId)) {
        const user = await ctx.db.get(p.publishedByUserId);
        names.set(p.publishedByUserId, user?.name ?? user?.email ?? "");
      }
      rows.push({
        _id: p._id,
        version: p.version,
        publishedAt: p.publishedAt,
        publishedBy: names.get(p.publishedByUserId) ?? "",
        isCurrent: p.isCurrent,
        productCount: countProducts(p.snapshot as MenuSnapshot),
      });
    }
    return rows;
  },
});

/**
 * Remet en ligne le contenu d'une version passée, sous un NOUVEAU numéro. Le brouillon
 * n'est pas touché : l'écran d'écart montre alors ce qui le sépare de ce qui est en ligne.
 */
export const rollback = mutation({
  args: { venueId: v.id("venues"), menuId: v.id("menus"), publicationId: v.id("menuPublications") },
  handler: async (ctx, args) => {
    const actor = await requirePermission(ctx, "menu.publish", { venueId: args.venueId });
    const menu = await getInVenue(ctx, args.menuId, actor.venue._id, "Cette carte");
    const target = await getInVenue(ctx, args.publicationId, actor.venue._id, "Cette version");
    if (target.menuId !== menu._id) throw invalid("Cette version appartient à une autre carte.");
    if (target.isCurrent) throw conflict("Cette version est déjà en ligne.");
    if (menu.status === "archived") throw invalid("Cette carte est archivée.");
    const current = await currentPublication(ctx, menu._id);
    const repriced = pricedDifferently(current ? (current.snapshot as MenuSnapshot) : null, target.snapshot as MenuSnapshot);
    if (repriced.length > 0 && !actor.permissions.has("menu.price.edit")) {
      throw forbidden(
        `Cette version remettrait d'anciens prix en ligne (${repriced.slice(0, 3).join(", ")}${repriced.length > 3 ? "…" : ""}) : il faut aussi le droit de modifier les prix.`,
      );
    }
    const { publicationId, version } = await insertVersion(ctx, menu, target.snapshot as MenuSnapshot, actor.user._id);
    await writeAudit(ctx, {
      organizationId: actor.organization._id,
      venueId: actor.venue._id,
      actorUserId: actor.user._id,
      action: "menu.rollback",
      resourceType: "menuPublication",
      resourceId: publicationId,
      before: { version: target.version },
      after: { version },
    });
    return { version };
  },
});
