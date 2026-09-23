/**
 * S'identifier sur un appareil enrôlé — Joliba (D-060)
 *
 * Sur une tablette partagée : on touche son nom, on tape son PIN, on travaille ; l'écran se
 * reverrouille seul. Sur un téléphone personnel : seul son propriétaire. Sur un écran de
 * cuisine : personne — l'appareil agit en son nom propre, borné à son poste.
 *
 * Les échecs sont comptés dans la base et la mutation RENVOIE le refus au lieu de lever : une
 * erreur annulerait la transaction, et avec elle le compteur qui protège le PIN.
 *
 * Ce qui sort d'ici, c'est un jeton d'opérateur de 10 minutes signé par Convex
 * (convex/lib/operatorJwt.ts), et un secret de renouvellement que l'appareil garde. Le PIN
 * n'est jamais journalisé.
 */

import { v } from "convex/values";
import { action, internalMutation, mutation, query } from "./_generated/server";
import { internal } from "./_generated/api";
import type { Doc, Id } from "./_generated/dataModel";
import { writeAudit } from "./lib/audit";
import { requireDevice } from "./lib/devices";
import { memberCoversVenue, type MutationCtx, type ReadCtx } from "./lib/guards";
import { signOperatorJwt } from "./lib/operatorJwt";
import { deviceFailure, hashCode, hashPin, isWellFormedCode, memberFailure, pinProblem, sameDigest } from "./lib/pin";
import { rateLimiter } from "./lib/rateLimits";
import { isOperatorSessionExpired, OPERATOR_IDLE_MS, requireServiceActor } from "./lib/serviceActor";
import { generateToken, sha256Hex } from "./lib/tokens";

type Refusal =
  | { ok: false; reason: "wrong_pin"; attemptsLeft: number }
  | { ok: false; reason: "locked"; retryAfter: number }
  | { ok: false; reason: "device_suspended"; retryAfter: number }
  | { ok: false; reason: "pin_unavailable" }
  | { ok: false; reason: "not_here" };

async function memberDisplayName(ctx: ReadCtx, member: Doc<"organizationMembers">): Promise<string> {
  if (member.displayName) return member.displayName;
  const user = member.userId ? await ctx.db.get(member.userId) : null;
  return user?.name ?? user?.email.split("@")[0] ?? "Membre";
}

async function credentialOf(ctx: ReadCtx, memberId: Id<"organizationMembers">) {
  return ctx.db
    .query("staffCredentials")
    .withIndex("by_member", (q) => q.eq("memberId", memberId))
    .unique();
}

/** Ce membre peut-il s'identifier SUR CET appareil ? */
async function canWorkHere(
  ctx: ReadCtx,
  member: Doc<"organizationMembers"> | null,
  device: Doc<"trustedDevices">,
  venue: Doc<"venues">,
  organization: Doc<"organizations">,
): Promise<boolean> {
  if (!member || member.organizationId !== organization._id || member.status !== "active") return false;
  if (device.deviceType === "kds") return false;
  if (device.deviceType === "personal" && device.memberId !== member._id) return false;
  const isOwner = member.userId !== undefined && member.userId === organization.ownerUserId;
  return memberCoversVenue(ctx, member, venue, isOwner);
}

/**
 * Ce que l'écran de verrouillage affiche : l'établissement, la sorte d'appareil, et les noms
 * de ceux qui peuvent s'y identifier. Aucun droit, aucune donnée métier.
 */
export const roster = query({
  args: { deviceToken: v.string() },
  handler: async (ctx, args) => {
    const { device, venue, organization } = await requireDevice(ctx, args.deviceToken);
    const people = [];
    if (device.deviceType !== "kds") {
      const members = await ctx.db
        .query("organizationMembers")
        .withIndex("by_org_status", (q) => q.eq("organizationId", organization._id).eq("status", "active"))
        .collect();
      for (const member of members) {
        if (!(await canWorkHere(ctx, member, device, venue, organization))) continue;
        const credential = await credentialOf(ctx, member._id);
        if (!credential || credential.status !== "active") continue;
        people.push({ memberId: member._id, name: await memberDisplayName(ctx, member), locked: (credential.lockedUntil ?? 0) > Date.now() });
      }
    }
    people.sort((a, b) => a.name.localeCompare(b.name, "fr"));
    return {
      venueId: venue._id,
      venueName: venue.name,
      deviceId: device._id,
      deviceType: device.deviceType,
      label: device.label,
      stationId: device.stationId ?? null,
      idleLockMs: device.deviceType === "personal" ? OPERATOR_IDLE_MS.personal : 60_000,
      pinSuspendedUntil: (device.pinSuspendedUntil ?? 0) > Date.now() ? device.pinSuspendedUntil! : null,
      people,
    };
  },
});

/**
 * Choisir son PIN avec le code remis par un gérant, sur un appareil enrôlé. Le gérant ne connaît
 * jamais le PIN ; il ne connaît que le code, valable 24 heures et une seule fois.
 */
export const activate = mutation({
  args: { deviceToken: v.string(), code: v.string(), pin: v.string() },
  handler: async (ctx, args) => {
    const { device, venue, organization } = await requireDevice(ctx, args.deviceToken);
    const limit = await rateLimiter.limit(ctx, "pinActivation", { key: device._id });
    if (!limit.ok) return { ok: false as const, reason: "rate_limited" as const, retryAfter: limit.retryAfter };
    const weak = pinProblem(args.pin);
    if (weak) return { ok: false as const, reason: "weak_pin" as const, message: weak };
    const now = Date.now();
    const codeHash = isWellFormedCode(args.code) ? await hashCode("activate", args.code) : null;
    const activation = codeHash
      ? await ctx.db
          .query("activationCodes")
          .withIndex("by_code", (q) => q.eq("codeHash", codeHash))
          .unique()
      : null;
    const member = activation ? await ctx.db.get(activation.memberId) : null;
    const usable =
      activation !== null &&
      activation.usedAt === undefined &&
      activation.revokedAt === undefined &&
      activation.expiresAt > now &&
      activation.organizationId === organization._id &&
      (await canWorkHere(ctx, member, device, venue, organization));
    if (!usable || !member || !activation) {
      await ctx.db.patch(device._id, deviceFailure(device.recentPinFailures, now));
      return { ok: false as const, reason: "invalid_code" as const };
    }
    const credential = await credentialOf(ctx, member._id);
    const fields = {
      pinHash: await hashPin(member._id, args.pin),
      status: "active" as const,
      recentFailures: [],
      failuresSinceSuccess: 0,
      lockedUntil: undefined,
      pinSetAt: now,
    };
    if (credential) await ctx.db.patch(credential._id, fields);
    else await ctx.db.insert("staffCredentials", { organizationId: organization._id, memberId: member._id, ...fields });
    await ctx.db.patch(activation._id, { usedAt: now });
    await writeAudit(ctx, {
      organizationId: organization._id,
      venueId: venue._id,
      actorMemberId: member._id,
      actorDeviceId: device._id,
      action: "staff.pin.set",
      resourceType: "member",
      resourceId: member._id,
    });
    return { ok: true as const, memberId: member._id, name: await memberDisplayName(ctx, member) };
  },
});

type OpenResult =
  | Refusal
  | { ok: true; sessionId: Id<"operatorSessions">; secret: string; name: string; venueId: Id<"venues">; memberId: Id<"organizationMembers"> };

/** Vérifie le PIN et ouvre la session d'opérateur. Appelée par `unlock`, jamais directement. */
export const openSession = internalMutation({
  args: { deviceToken: v.string(), memberId: v.string(), pin: v.string() },
  handler: async (ctx, args): Promise<OpenResult> => {
    const { device, venue, organization } = await requireDevice(ctx, args.deviceToken);
    const now = Date.now();
    if ((device.pinSuspendedUntil ?? 0) > now) return { ok: false, reason: "device_suspended", retryAfter: device.pinSuspendedUntil! - now };
    const memberId = ctx.db.normalizeId("organizationMembers", args.memberId);
    const member = memberId ? await ctx.db.get(memberId) : null;
    const credential = member ? await credentialOf(ctx, member._id) : null;
    if (!member || !(await canWorkHere(ctx, member, device, venue, organization))) {
      await recordDeviceFailure(ctx, device, organization, venue, now);
      return { ok: false, reason: "not_here" };
    }
    if (!credential || credential.status !== "active" || !credential.pinHash) return { ok: false, reason: "pin_unavailable" };
    if ((credential.lockedUntil ?? 0) > now) return { ok: false, reason: "locked", retryAfter: credential.lockedUntil! - now };

    if (!sameDigest(await hashPin(member._id, args.pin), credential.pinHash)) {
      const outcome = memberFailure(credential, now);
      await ctx.db.patch(credential._id, {
        recentFailures: outcome.recentFailures,
        failuresSinceSuccess: outcome.failuresSinceSuccess,
        ...(outcome.lockedUntil ? { lockedUntil: outcome.lockedUntil } : {}),
        ...(outcome.disabled ? { status: "disabled" as const, pinHash: undefined } : {}),
      });
      await recordDeviceFailure(ctx, device, organization, venue, now);
      if (outcome.disabled) {
        await writeAudit(ctx, {
          organizationId: organization._id,
          venueId: venue._id,
          actorType: "device",
          actorDeviceId: device._id,
          action: "staff.pin.disabled_after_failures",
          resourceType: "member",
          resourceId: member._id,
        });
        return { ok: false, reason: "pin_unavailable" };
      }
      if (outcome.lockedUntil) return { ok: false, reason: "locked", retryAfter: outcome.lockedUntil - now };
      return { ok: false, reason: "wrong_pin", attemptsLeft: Math.max(0, 5 - outcome.recentFailures.length) };
    }

    await ctx.db.patch(credential._id, { recentFailures: [], failuresSinceSuccess: 0, lockedUntil: undefined, lastUnlockAt: now });
    // Une personne à la fois par appareil : l'identification suivante remplace la précédente.
    const open = await ctx.db
      .query("operatorSessions")
      .withIndex("by_device", (q) => q.eq("deviceId", device._id))
      .collect();
    for (const s of open) if (s.endedAt === undefined) await ctx.db.patch(s._id, { endedAt: now, endReason: "replaced" });
    const secret = generateToken(32);
    const sessionId = await ctx.db.insert("operatorSessions", {
      venueId: venue._id,
      deviceId: device._id,
      memberId: member._id,
      secretHash: await sha256Hex(secret),
      startedAt: now,
      lastActivityAt: now,
    });
    await ctx.db.patch(device._id, { lastSeenAt: now });
    return { ok: true, sessionId, secret, name: await memberDisplayName(ctx, member), venueId: venue._id, memberId: member._id };
  },
});

async function recordDeviceFailure(
  ctx: MutationCtx,
  device: Doc<"trustedDevices">,
  organization: Doc<"organizations">,
  venue: Doc<"venues">,
  now: number,
): Promise<void> {
  const outcome = deviceFailure(device.recentPinFailures, now);
  await ctx.db.patch(device._id, outcome);
  if (outcome.pinSuspendedUntil && (device.pinSuspendedUntil ?? 0) <= now) {
    // Quelqu'un essaie les codes de ses collègues : les gérants le verront au journal.
    await writeAudit(ctx, {
      organizationId: organization._id,
      venueId: venue._id,
      actorType: "device",
      actorDeviceId: device._id,
      action: "device.pin.suspended",
      resourceType: "device",
      resourceId: device._id,
      after: { failures: outcome.recentPinFailures.length },
    });
  }
}

type UnlockResult =
  | Refusal
  | {
      ok: true;
      token: string;
      expiresAt: number;
      refreshSecret: string;
      name: string;
      memberId: Id<"organizationMembers">;
      venueId: Id<"venues">;
    };

/** Taper son PIN : renvoie un jeton d'opérateur et un secret de renouvellement. */
export const unlock = action({
  args: { deviceToken: v.string(), memberId: v.string(), pin: v.string() },
  handler: async (ctx, args): Promise<UnlockResult> => {
    // garde : appareil et PIN vérifiés par `openSession`, qui compte les échecs
    const opened: OpenResult = await ctx.runMutation(internal.operators.openSession, args);
    if (!opened.ok) return opened;
    const { token, expiresAt } = await signOperatorJwt({ kind: "operator", id: opened.sessionId });
    return {
      ok: true as const,
      token,
      expiresAt,
      refreshSecret: opened.secret,
      name: opened.name,
      memberId: opened.memberId,
      venueId: opened.venueId,
    };
  },
});

/** La session tient-elle toujours ? Sans effet sur l'inactivité : renouveler n'est pas travailler. */
export const checkRefresh = internalMutation({
  args: { deviceToken: v.string(), refreshSecret: v.string() },
  handler: async (ctx, args): Promise<{ ok: true; subject: { kind: "operator" | "device"; id: string } } | { ok: false }> => {
    const { device } = await requireDevice(ctx, args.deviceToken);
    const now = Date.now();
    if (device.deviceType === "kds") {
      await ctx.db.patch(device._id, { lastSeenAt: now });
      return { ok: true, subject: { kind: "device", id: device._id } };
    }
    const secretHash = await sha256Hex(args.refreshSecret);
    const session = await ctx.db
      .query("operatorSessions")
      .withIndex("by_secret", (q) => q.eq("secretHash", secretHash))
      .unique();
    if (!session || session.deviceId !== device._id) return { ok: false };
    if (isOperatorSessionExpired(session, device.deviceType, now)) {
      if (session.endedAt === undefined) await ctx.db.patch(session._id, { endedAt: now, endReason: "expired" });
      return { ok: false };
    }
    return { ok: true, subject: { kind: "operator", id: session._id } };
  },
});

/**
 * Renouveler le jeton. Pour un écran de cuisine, le jeton d'appareil suffit (`refreshSecret`
 * vide) ; pour une personne, il faut le secret remis au déverrouillage.
 */
export const refresh = action({
  args: { deviceToken: v.string(), refreshSecret: v.string() },
  handler: async (ctx, args): Promise<{ ok: false } | { ok: true; token: string; expiresAt: number }> => {
    // garde : appareil et session vérifiés par `checkRefresh`
    const checked = await ctx.runMutation(internal.operators.checkRefresh, args);
    if (!checked.ok) return { ok: false as const };
    const { token, expiresAt } = await signOperatorJwt(checked.subject);
    return { ok: true as const, token, expiresAt };
  },
});

/** Verrouiller l'écran : la session de la personne se ferme, même si son jeton a déjà expiré. */
export const lock = mutation({
  args: { deviceToken: v.string() },
  handler: async (ctx, args) => {
    const { device } = await requireDevice(ctx, args.deviceToken);
    const now = Date.now();
    const sessions = await ctx.db
      .query("operatorSessions")
      .withIndex("by_device", (q) => q.eq("deviceId", device._id))
      .collect();
    for (const s of sessions) if (s.endedAt === undefined) await ctx.db.patch(s._id, { endedAt: now, endReason: "locked" });
  },
});

/**
 * Qui agit, et ce qu'il peut faire ici — la même réponse pour un compte, un PIN ou un écran de
 * cuisine. Les écrans de service s'en servent pour MASQUER ; la garde de chaque fonction reste
 * seule juge.
 */
export const me = query({
  args: { venueId: v.id("venues") },
  handler: async (ctx, args) => {
    const actor = await requireServiceActor(ctx, "venue.read", { venueId: args.venueId });
    return {
      via: actor.via,
      venueName: actor.venue.name,
      venueSlug: actor.venue.slug,
      currency: actor.venue.currency,
      timezone: actor.venue.timezone,
      memberId: actor.member?._id ?? null,
      name: actor.member ? await memberDisplayName(ctx, actor.member) : actor.device?.label ?? null,
      deviceType: actor.device?.deviceType ?? null,
      stationId: actor.device?.stationId ?? null,
      permissions: [...actor.permissions],
    };
  },
});
