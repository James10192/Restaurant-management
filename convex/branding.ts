/**
 * Apparence de la carte client — Joliba (T7.a, D-149 à D-158)
 *
 * Une couleur et un logo. Enregistrer PUBLIE : il n'y a ni brouillon ni version (D-156), et
 * l'historique est le journal d'audit. Tout passe par `venue.manage` (D-158).
 *
 * La couleur n'est jamais refusée : `resolveBrandColor` la rend lisible (D-150) et l'écran
 * montre ce qui sera affiché. Le logo est un PNG ou un WebP réduit dans le navigateur ; le
 * serveur relit sa signature ET ses dimensions dans le fichier, sans croire le navigateur.
 */

import { v } from "convex/values";
import { action, internalMutation, internalQuery, mutation, query } from "./_generated/server";
import { internal } from "./_generated/api";
import type { Doc, Id } from "./_generated/dataModel";
import { writeAudit } from "./lib/audit";
import { HEX_PATTERN, hexToRgb, JOLIBA_BRAND, normalizeHex, resolveBrandColor, worstContrast, type BrandColor } from "./lib/brand";
import { invalid } from "./lib/errors";
import { requirePermission, type ReadCtx, type VenueActor } from "./lib/guards";
import { assertFreshUnusedFiles } from "./lib/uploads";

/** Le logo est réduit à 256 px et ≤ 20 Ko dans le navigateur (D-153) ; au-delà, il ne l'a pas été. */
export const MAX_LOGO_BYTES = 20 * 1024;
export const MAX_LOGO_EDGE = 256;
const MIN_LOGO_EDGE = 16;

async function settingsOf(ctx: ReadCtx, actor: VenueActor): Promise<Doc<"venueSettings">> {
  const settings = await ctx.db
    .query("venueSettings")
    .withIndex("by_venue", (q) => q.eq("venueId", actor.venue._id))
    .unique();
  if (!settings) throw invalid("Réglages introuvables.");
  return settings;
}

/** L'état de l'écran Apparence : la saisie, ce qui est affiché, et pourquoi. */
export const get = query({
  args: { venueId: v.id("venues") },
  handler: async (ctx, args) => {
    const actor = await requirePermission(ctx, "venue.manage", { venueId: args.venueId });
    const { branding } = await settingsOf(ctx, actor);
    // Ce qui est AFFICHÉ, tel qu'enregistré : pas recalculé, pour que l'écran dise la vérité même
    // si l'algorithme évolue un jour.
    const color: BrandColor | null =
      branding.primaryColor && branding.resolvedPrimary && HEX_PATTERN.test(branding.resolvedPrimary)
        ? {
            input: branding.primaryColor,
            primary: branding.resolvedPrimary,
            adjusted: branding.primaryColor !== branding.resolvedPrimary,
            contrast: Math.floor(worstContrast(hexToRgb(branding.resolvedPrimary)) * 100) / 100,
          }
        : null;
    return {
      slug: actor.venue.slug,
      name: actor.venue.name,
      publicMenuEnabled: actor.venue.publicMenuEnabled,
      jolibaColor: JOLIBA_BRAND,
      color,
      logo: branding.logo
        ? { url: await ctx.storage.getUrl(branding.logo.storageId), width: branding.logo.width, height: branding.logo.height }
        : null,
    };
  },
});

/** Choisit la couleur (ou revient à celle de Joliba avec `null`). Publie aussitôt. */
export const setColor = mutation({
  args: { venueId: v.id("venues"), color: v.union(v.string(), v.null()) },
  handler: async (ctx, args) => {
    const actor = await requirePermission(ctx, "venue.manage", { venueId: args.venueId });
    const settings = await settingsOf(ctx, actor);
    if (args.color !== null && !normalizeHex(args.color)) throw invalid("Choisissez une couleur au format #RRVVBB.");
    const resolved = args.color === null ? null : resolveBrandColor(args.color);
    const before = settings.branding.primaryColor ?? null;
    if (before === (resolved?.input ?? null) && (resolved === null || settings.branding.resolvedPrimary === resolved.primary)) {
      return resolved;
    }
    const { primaryColor: _p, resolvedPrimary: _r, ...rest } = settings.branding;
    await ctx.db.patch(settings._id, {
      branding: resolved ? { ...rest, primaryColor: resolved.input, resolvedPrimary: resolved.primary } : rest,
    });
    await writeAudit(ctx, {
      organizationId: actor.organization._id,
      venueId: actor.venue._id,
      actorUserId: actor.user._id,
      actorMemberId: actor.member._id,
      action: "venue.branding.color",
      resourceType: "venue",
      resourceId: actor.venue._id,
      before: { primaryColor: before },
      after: { primaryColor: resolved?.input ?? null, resolvedPrimary: resolved?.primary ?? null },
    });
    return resolved;
  },
});

/** URL d'envoi du logo. L'envoi se fait du navigateur vers le stockage. */
export const generateLogoUploadUrl = mutation({
  args: { venueId: v.id("venues") },
  handler: async (ctx, args) => {
    await requirePermission(ctx, "venue.manage", { venueId: args.venueId });
    return ctx.storage.generateUploadUrl();
  },
});

/**
 * Lit la signature ET les dimensions dans le fichier : un PNG ou un WebP, rien d'autre. Pas de
 * JPEG (il perd la transparence, D-153) et jamais de SVG (un SVG peut porter du script).
 */
export function logoInfo(bytes: Uint8Array): { width: number; height: number } | null {
  if (bytes.length < 30 || bytes.length > MAX_LOGO_BYTES) return null;
  const at = (i: number) => bytes[i] ?? 0;
  const ascii = (from: number, text: string) => [...text].every((c, i) => at(from + i) === c.charCodeAt(0));
  const be32 = (i: number) => ((at(i) << 24) | (at(i + 1) << 16) | (at(i + 2) << 8) | at(i + 3)) >>> 0;
  const le16 = (i: number) => at(i) | (at(i + 1) << 8);
  const le24 = (i: number) => at(i) | (at(i + 1) << 8) | (at(i + 2) << 16);
  let size: { width: number; height: number } | null = null;
  if (at(0) === 0x89 && ascii(1, "PNG\r\n") && ascii(12, "IHDR")) {
    size = { width: be32(16), height: be32(20) };
  } else if (ascii(0, "RIFF") && ascii(8, "WEBP")) {
    if (ascii(12, "VP8X")) size = { width: le24(24) + 1, height: le24(27) + 1 };
    else if (ascii(12, "VP8L") && at(20) === 0x2f) {
      const bits = at(21) | (at(22) << 8) | (at(23) << 16) | (at(24) << 24);
      size = { width: (bits & 0x3fff) + 1, height: ((bits >>> 14) & 0x3fff) + 1 };
    } else if (ascii(12, "VP8 ") && at(23) === 0x9d && at(24) === 0x01 && at(25) === 0x2a) {
      size = { width: le16(26) & 0x3fff, height: le16(28) & 0x3fff };
    }
  }
  if (!size) return null;
  const fits = (d: number) => Number.isInteger(d) && d >= MIN_LOGO_EDGE && d <= MAX_LOGO_EDGE;
  return fits(size.width) && fits(size.height) ? size : null;
}

/** La garde de l'envoi, rejouée par l'action AVANT qu'elle touche le fichier. */
export const assertCanSetLogo = internalQuery({
  args: { venueId: v.id("venues"), storageId: v.id("_storage") },
  handler: async (ctx, args) => {
    const actor = await requirePermission(ctx, "venue.manage", { venueId: args.venueId });
    await assertFreshUnusedFiles(ctx, actor, [args.storageId]);
  },
});

export const recordLogo = internalMutation({
  args: {
    venueId: v.id("venues"),
    storageId: v.id("_storage"),
    size: v.union(v.object({ width: v.number(), height: v.number() }), v.null()),
  },
  handler: async (ctx, args) => {
    const actor = await requirePermission(ctx, "venue.manage", { venueId: args.venueId });
    // Rejouée au moment d'écrire : entre la lecture et l'écriture, un autre envoi a pu le prendre.
    await assertFreshUnusedFiles(ctx, actor, [args.storageId]);
    if (!args.size) {
      // Un fichier refusé ne reste pas stocké : sinon l'envoi servirait à stocker n'importe quoi.
      if (await ctx.db.system.get(args.storageId)) await ctx.storage.delete(args.storageId);
      return;
    }
    const settings = await settingsOf(ctx, actor);
    const previous = settings.branding.logo?.storageId ?? null;
    await ctx.db.patch(settings._id, { branding: { ...settings.branding, logo: { storageId: args.storageId, ...args.size } } });
    // L'ancien logo n'est lu que par la carte en direct, jamais par une publication : il part.
    if (previous && (await ctx.db.system.get(previous))) await ctx.storage.delete(previous);
    await writeAudit(ctx, {
      organizationId: actor.organization._id,
      venueId: actor.venue._id,
      actorUserId: actor.user._id,
      actorMemberId: actor.member._id,
      action: "venue.branding.logo",
      resourceType: "venue",
      resourceId: actor.venue._id,
      before: { logo: previous },
      after: { logo: args.storageId, ...args.size },
    });
  },
});

/**
 * Pose le logo déjà envoyé. Un fichier refusé est EFFACÉ et le refus est RENVOYÉ, pas levé :
 * une écriture qui lève est annulée, l'effacement compris.
 */
export const setLogo = action({
  args: { venueId: v.id("venues"), storageId: v.id("_storage") },
  handler: async (ctx, args): Promise<{ ok: true } | { ok: false; message: string }> => {
    // garde : `assertCanSetLogo` s'exécute avec l'identité de l'appelant, AVANT toute lecture
    // de fichier ; `recordLogo` rejoue la même garde au moment d'écrire.
    await ctx.runQuery(internal.branding.assertCanSetLogo, args);
    const blob = await ctx.storage.get(args.storageId);
    const size = blob ? logoInfo(new Uint8Array(await blob.arrayBuffer())) : null;
    await ctx.runMutation(internal.branding.recordLogo, { ...args, size });
    return size
      ? { ok: true }
      : { ok: false, message: "Ce fichier n'est pas un logo accepté : PNG ou WebP, réduit avant l'envoi (256 px, 20 Ko au plus)." };
  },
});

/** Retire le logo : la carte montre le nom seul. Le fichier est effacé. */
export const removeLogo = mutation({
  args: { venueId: v.id("venues") },
  handler: async (ctx, args) => {
    const actor = await requirePermission(ctx, "venue.manage", { venueId: args.venueId });
    const settings = await settingsOf(ctx, actor);
    const previous: Id<"_storage"> | undefined = settings.branding.logo?.storageId;
    if (!previous) return;
    const { logo: _logo, ...rest } = settings.branding;
    await ctx.db.patch(settings._id, { branding: rest });
    if (await ctx.db.system.get(previous)) await ctx.storage.delete(previous);
    await writeAudit(ctx, {
      organizationId: actor.organization._id,
      venueId: actor.venue._id,
      actorUserId: actor.user._id,
      actorMemberId: actor.member._id,
      action: "venue.branding.logo",
      resourceType: "venue",
      resourceId: actor.venue._id,
      before: { logo: previous },
      after: { logo: null },
    });
  },
});
