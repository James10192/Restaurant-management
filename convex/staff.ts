/**
 * PIN de service, côté gérant — Joliba (D-060)
 *
 * Un gérant crée un membre SANS COMPTE (un serveur sans adresse e-mail consultée), ou remet un
 * code d'activation à n'importe quel membre. L'employé saisit ce code sur un appareil enrôlé et
 * choisit LUI-MÊME son PIN : le gérant ne le connaît jamais.
 *
 * Mêmes verrous que pour l'équipe : on ne crée pas un membre avec un rôle qu'on ne détient pas
 * soi-même (verrou 1), et remettre un code à quelqu'un exige d'avoir autorité sur tous ses rôles.
 * Seule exception : chacun peut se remettre un code à lui-même, pour la tablette partagée.
 */

import { v } from "convex/values";
import { mutation } from "./_generated/server";
import type { Doc, Id } from "./_generated/dataModel";
import { writeAudit } from "./lib/audit";
import { cleanName } from "./lib/catalog";
import { notFound } from "./lib/errors";
import { requireOrganizationMember, type MutationCtx, type OrganizationActor } from "./lib/guards";
import { ACTIVATION_CODE_TTL_MS, formatCode, generateCode, hashCode } from "./lib/pin";
import { assertAuthorityOverMember, authorizeGrant, loadOrgRole } from "./team";

async function credentialOf(ctx: MutationCtx, memberId: Id<"organizationMembers">) {
  return ctx.db
    .query("staffCredentials")
    .withIndex("by_member", (q) => q.eq("memberId", memberId))
    .unique();
}

/** Ferme toutes les sessions d'opérateur ouvertes d'un membre : son PIN ne vaut plus. */
export async function endMemberSessions(
  ctx: MutationCtx,
  memberId: Id<"organizationMembers">,
  reason: "revoked" | "replaced",
): Promise<void> {
  const sessions = await ctx.db
    .query("operatorSessions")
    .withIndex("by_member", (q) => q.eq("memberId", memberId))
    .collect();
  const now = Date.now();
  for (const s of sessions) {
    if (s.endedAt === undefined) await ctx.db.patch(s._id, { endedAt: now, endReason: reason });
  }
}

/**
 * Remet le PIN à « en attente » et émet un code d'activation. L'ancien PIN cesse de valoir
 * IMMÉDIATEMENT, et les anciens codes non utilisés sont révoqués.
 */
async function issueCode(
  ctx: MutationCtx,
  organizationId: Id<"organizations">,
  member: Doc<"organizationMembers">,
  createdBy: Id<"organizationMembers">,
): Promise<{ code: string; expiresAt: number }> {
  const now = Date.now();
  const previous = await ctx.db
    .query("activationCodes")
    .withIndex("by_member", (q) => q.eq("memberId", member._id))
    .collect();
  for (const c of previous) {
    if (c.usedAt === undefined && c.revokedAt === undefined) await ctx.db.patch(c._id, { revokedAt: now });
  }
  const credential = await credentialOf(ctx, member._id);
  if (credential) {
    await ctx.db.patch(credential._id, {
      status: "pending",
      pinHash: undefined,
      recentFailures: [],
      failuresSinceSuccess: 0,
      lockedUntil: undefined,
    });
  } else {
    await ctx.db.insert("staffCredentials", {
      organizationId,
      memberId: member._id,
      status: "pending",
      recentFailures: [],
      failuresSinceSuccess: 0,
    });
  }
  await endMemberSessions(ctx, member._id, "replaced");
  const code = generateCode();
  const expiresAt = now + ACTIVATION_CODE_TTL_MS;
  await ctx.db.insert("activationCodes", {
    organizationId,
    memberId: member._id,
    codeHash: await hashCode("activate", code),
    createdByMemberId: createdBy,
    expiresAt,
  });
  return { code: formatCode(code), expiresAt };
}

/**
 * Ajouter à l'équipe quelqu'un qui n'aura pas de compte : il travaillera avec son PIN, sur les
 * appareils enrôlés des établissements où il est affecté. Renvoie son premier code d'activation.
 */
export const createPinMember = mutation({
  args: {
    organizationId: v.id("organizations"),
    displayName: v.string(),
    roleId: v.id("roles"),
    /** Vide = rôle au niveau de l'organisation entière. */
    venueIds: v.array(v.id("venues")),
  },
  handler: async (ctx, args) => {
    const base = await requireOrganizationMember(ctx, args.organizationId);
    const role = await loadOrgRole(ctx, base.organization._id, args.roleId);
    const venueIds = [...new Set(args.venueIds)];
    const actor = await authorizeGrant(ctx, base.organization._id, role, venueIds);
    const displayName = cleanName(args.displayName, "Le nom");
    const now = Date.now();
    const memberId = await ctx.db.insert("organizationMembers", {
      organizationId: actor.organization._id,
      kind: "pin_only",
      displayName,
      createdByUserId: actor.user._id,
      status: "active",
      joinedAt: now,
    });
    const scopes = venueIds.length === 0 ? [undefined] : venueIds;
    for (const venueId of scopes) {
      await ctx.db.insert("memberRoleAssignments", {
        organizationId: actor.organization._id,
        memberId,
        roleId: role._id,
        scopeType: venueId ? "venue" : "organization",
        ...(venueId ? { venueId } : {}),
        grantedByUserId: actor.user._id,
        grantedAt: now,
      });
    }
    const member = (await ctx.db.get(memberId))!;
    const issued = await issueCode(ctx, actor.organization._id, member, actor.member._id);
    await writeAudit(ctx, {
      organizationId: actor.organization._id,
      actorUserId: actor.user._id,
      actorMemberId: actor.member._id,
      action: "team.member.create_pin_only",
      resourceType: "member",
      resourceId: memberId,
      after: { displayName, role: role.label, venues: venueIds.length },
    });
    return { memberId, ...issued };
  },
});

async function targetMember(ctx: MutationCtx, base: OrganizationActor, memberId: Id<"organizationMembers">) {
  const member = await ctx.db.get(memberId);
  if (!member || member.organizationId !== base.organization._id || member.status !== "active") throw notFound("Ce membre");
  const isSelf = member._id === base.member._id;
  if (!isSelf) await assertAuthorityOverMember(ctx, base, member);
  return { member, isSelf };
}

/** Un nouveau code d'activation : premier PIN, PIN oublié, PIN désactivé après trop d'échecs. */
export const issueActivationCode = mutation({
  args: { organizationId: v.id("organizations"), memberId: v.id("organizationMembers") },
  handler: async (ctx, args) => {
    const base = await requireOrganizationMember(ctx, args.organizationId);
    const { member } = await targetMember(ctx, base, args.memberId);
    const issued = await issueCode(ctx, base.organization._id, member, base.member._id);
    await writeAudit(ctx, {
      organizationId: base.organization._id,
      actorUserId: base.user._id,
      actorMemberId: base.member._id,
      action: "team.member.pin.reset",
      resourceType: "member",
      resourceId: member._id,
    });
    return issued;
  },
});

/** Retirer le PIN d'un membre : il ne peut plus s'identifier sur aucun appareil. */
export const disablePin = mutation({
  args: { organizationId: v.id("organizations"), memberId: v.id("organizationMembers") },
  handler: async (ctx, args) => {
    const base = await requireOrganizationMember(ctx, args.organizationId);
    const { member } = await targetMember(ctx, base, args.memberId);
    const credential = await credentialOf(ctx, member._id);
    if (!credential || credential.status === "disabled") return;
    await ctx.db.patch(credential._id, { status: "disabled", pinHash: undefined });
    await endMemberSessions(ctx, member._id, "revoked");
    await writeAudit(ctx, {
      organizationId: base.organization._id,
      actorUserId: base.user._id,
      actorMemberId: base.member._id,
      action: "team.member.pin.disable",
      resourceType: "member",
      resourceId: member._id,
    });
  },
});
