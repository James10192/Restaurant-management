/**
 * Appareils enrôlés — Joliba (D-060)
 *
 * Le gérant fait apparaître un code (8 caractères, 10 minutes) ; l'appareil le saisit et reçoit
 * son jeton, qu'il garde. Trois sortes d'appareils : l'écran de cuisine (aucun humain, rattaché à
 * un poste), la tablette partagée (chacun s'y identifie par son PIN), le téléphone personnel
 * (seul son propriétaire s'y identifie).
 *
 * Révoquer un appareil coupe tout, tout de suite : ses sessions d'opérateur tombent, et ceux qui
 * s'y sont identifiés depuis 12 heures doivent rechoisir leur PIN — l'appareil a pu être
 * observé ou emporté.
 */

import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import type { Id } from "./_generated/dataModel";
import { writeAudit } from "./lib/audit";
import { getInVenue } from "./lib/catalogAccess";
import { cleanName } from "./lib/catalog";
import { conflict, invalid, notFound } from "./lib/errors";
import { memberCoversVenue, requirePermission } from "./lib/guards";
import { ENROLLMENT_CODE_TTL_MS, formatCode, generateCode, hashCode, isWellFormedCode } from "./lib/pin";
import { rateLimiter } from "./lib/rateLimits";
import { generateToken, sha256Hex } from "./lib/tokens";
import { OPERATOR_SESSION_MAX_MS } from "./lib/serviceActor";

const deviceType = v.union(v.literal("kds"), v.literal("shared"), v.literal("personal"));

/** Au plus : au-delà, ce n'est plus un restaurant, c'est une erreur ou un abus. */
export const MAX_DEVICES_PER_VENUE = 40;

/** Faire apparaître un code d'enrôlement. */
export const createEnrollment = mutation({
  args: {
    venueId: v.id("venues"),
    label: v.string(),
    deviceType,
    stationId: v.optional(v.id("prepStations")),
    memberId: v.optional(v.id("organizationMembers")),
  },
  handler: async (ctx, args) => {
    const actor = await requirePermission(ctx, "device.manage", { venueId: args.venueId });
    const label = cleanName(args.label, "Le nom de l'appareil");
    if (args.deviceType === "kds") {
      if (!args.stationId) throw invalid("Un écran de cuisine est rattaché à un poste.");
      const station = await getInVenue(ctx, args.stationId, actor.venue._id, "Ce poste");
      if (!station.isActive) throw invalid("Ce poste est retiré.");
    } else if (args.stationId) {
      throw invalid("Seul un écran de cuisine se rattache à un poste.");
    }
    if (args.deviceType === "personal") {
      if (!args.memberId) throw invalid("Un téléphone personnel appartient à un membre de l'équipe.");
      const member = await ctx.db.get(args.memberId);
      const owner = member?.userId !== undefined && member.userId === actor.organization.ownerUserId;
      if (!member || member.organizationId !== actor.organization._id || member.status !== "active" || !(await memberCoversVenue(ctx, member, actor.venue, owner))) {
        throw notFound("Ce membre de l'équipe");
      }
    } else if (args.memberId) {
      throw invalid("Seul un téléphone personnel appartient à un membre.");
    }
    const active = (
      await ctx.db
        .query("trustedDevices")
        .withIndex("by_venue", (q) => q.eq("venueId", actor.venue._id))
        .collect()
    ).filter((d) => d.revokedAt === undefined);
    if (active.length >= MAX_DEVICES_PER_VENUE) throw conflict(`${MAX_DEVICES_PER_VENUE} appareils au plus par établissement.`);
    const code = generateCode();
    const expiresAt = Date.now() + ENROLLMENT_CODE_TTL_MS;
    await ctx.db.insert("deviceEnrollmentCodes", {
      venueId: actor.venue._id,
      codeHash: await hashCode("enroll", code),
      deviceType: args.deviceType,
      label,
      ...(args.stationId ? { stationId: args.stationId } : {}),
      ...(args.memberId ? { memberId: args.memberId } : {}),
      createdByMemberId: actor.member._id,
      expiresAt,
    });
    return { code: formatCode(code), expiresAt };
  },
});

/**
 * Appelé PAR L'APPAREIL, sans compte : le code est la portée. Refus muets et uniformes (un code
 * inconnu, expiré ou déjà servi se ressemblent), plafond global d'essais.
 */
export const enroll = mutation({
  args: { code: v.string() },
  handler: async (ctx, args) => {
    // garde : le code d'enrôlement (40 bits, 10 minutes, usage unique) est la portée
    const limit = await rateLimiter.limit(ctx, "deviceEnroll");
    if (!limit.ok) return { ok: false as const, reason: "rate_limited" as const, retryAfter: limit.retryAfter };
    if (!isWellFormedCode(args.code)) return { ok: false as const, reason: "invalid_code" as const };
    const codeHash = await hashCode("enroll", args.code);
    const enrollment = await ctx.db
      .query("deviceEnrollmentCodes")
      .withIndex("by_code", (q) => q.eq("codeHash", codeHash))
      .unique();
    const now = Date.now();
    if (!enrollment || enrollment.usedAt !== undefined || enrollment.expiresAt < now) {
      return { ok: false as const, reason: "invalid_code" as const };
    }
    const venue = await ctx.db.get(enrollment.venueId);
    if (!venue || venue.status === "archived") return { ok: false as const, reason: "invalid_code" as const };
    const deviceToken = generateToken(32);
    const deviceId = await ctx.db.insert("trustedDevices", {
      venueId: venue._id,
      label: enrollment.label,
      deviceType: enrollment.deviceType,
      tokenHash: await sha256Hex(deviceToken),
      ...(enrollment.stationId ? { stationId: enrollment.stationId } : {}),
      ...(enrollment.memberId ? { memberId: enrollment.memberId } : {}),
      enrolledByMemberId: enrollment.createdByMemberId,
      enrolledAt: now,
      lastSeenAt: now,
      recentPinFailures: [],
    });
    await ctx.db.patch(enrollment._id, { usedAt: now, deviceId });
    await writeAudit(ctx, {
      organizationId: venue.organizationId,
      venueId: venue._id,
      actorType: "device",
      actorDeviceId: deviceId,
      actorMemberId: enrollment.createdByMemberId,
      action: "device.enroll",
      resourceType: "device",
      resourceId: deviceId,
      after: { label: enrollment.label, type: enrollment.deviceType },
    });
    return {
      ok: true as const,
      deviceToken,
      deviceId,
      venueId: venue._id,
      venueName: venue.name,
      deviceType: enrollment.deviceType,
      label: enrollment.label,
      stationId: enrollment.stationId ?? null,
    };
  },
});

async function memberLabel(ctx: Parameters<typeof getInVenue>[0], id: Id<"organizationMembers"> | undefined) {
  if (!id) return null;
  const member = await ctx.db.get(id);
  if (!member) return null;
  if (member.displayName) return member.displayName;
  const user = member.userId ? await ctx.db.get(member.userId) : null;
  return user ? (user.name ?? user.email) : null;
}

export const list = query({
  args: { venueId: v.id("venues") },
  handler: async (ctx, args) => {
    const actor = await requirePermission(ctx, "device.manage", { venueId: args.venueId });
    const devices = await ctx.db
      .query("trustedDevices")
      .withIndex("by_venue", (q) => q.eq("venueId", actor.venue._id))
      .collect();
    const result = [];
    for (const d of devices.filter((x) => x.revokedAt === undefined).sort((a, b) => b.enrolledAt - a.enrolledAt)) {
      result.push({
        _id: d._id,
        label: d.label,
        deviceType: d.deviceType,
        station: d.stationId ? ((await ctx.db.get(d.stationId))?.name ?? null) : null,
        owner: await memberLabel(ctx, d.memberId),
        enrolledAt: d.enrolledAt,
        lastSeenAt: d.lastSeenAt ?? null,
        pinSuspendedUntil: d.pinSuspendedUntil ?? null,
      });
    }
    return result;
  },
});

export const revoke = mutation({
  args: { venueId: v.id("venues"), deviceId: v.id("trustedDevices") },
  handler: async (ctx, args) => {
    const actor = await requirePermission(ctx, "device.manage", { venueId: args.venueId });
    const device = await getInVenue(ctx, args.deviceId, actor.venue._id, "Cet appareil");
    if (device.revokedAt !== undefined) return { pinsReset: 0 };
    const now = Date.now();
    await ctx.db.patch(device._id, { revokedAt: now, revokedByMemberId: actor.member._id });
    const sessions = await ctx.db
      .query("operatorSessions")
      .withIndex("by_device", (q) => q.eq("deviceId", device._id))
      .collect();
    const exposed = new Set<Id<"organizationMembers">>();
    for (const s of sessions) {
      if (s.endedAt === undefined) await ctx.db.patch(s._id, { endedAt: now, endReason: "revoked" });
      if (now - s.startedAt < OPERATOR_SESSION_MAX_MS) exposed.add(s.memberId);
    }
    // Ceux qui ont tapé leur PIN sur cet appareil récemment le rechoisissent.
    for (const memberId of exposed) {
      const credential = await ctx.db
        .query("staffCredentials")
        .withIndex("by_member", (q) => q.eq("memberId", memberId))
        .unique();
      if (credential && credential.status === "active") await ctx.db.patch(credential._id, { status: "pending", pinHash: undefined });
    }
    await writeAudit(ctx, {
      organizationId: actor.organization._id,
      venueId: actor.venue._id,
      actorUserId: actor.user._id,
      actorMemberId: actor.member._id,
      action: "device.revoke",
      resourceType: "device",
      resourceId: device._id,
      before: { label: device.label, type: device.deviceType },
      after: { pinsReset: exposed.size },
    });
    return { pinsReset: exposed.size };
  },
});

