/**
 * Équipe — Joliba
 *
 * Inviter, accepter, attribuer des rôles, suspendre, retirer. Chaque écriture applique
 * les trois verrous (`lib/authority.ts`) et laisse une trace dans le journal d'audit.
 *
 * Une personne peut être « Responsable à Cocody ET Serveur au Plateau » : les
 * affectations sont PAR PORTÉE (organisation entière, ou un établissement), et une
 * modification ne touche jamais que la portée dans laquelle l'acteur agit.
 *
 * Invitations : le jeton est généré dans une action (aléa cryptographique), seul son
 * SHA-256 est écrit en base. Le lien part par e-mail si l'envoi est configuré ; il est
 * aussi rendu à la personne qui invite, pour qu'elle puisse le transmettre elle-même —
 * par WhatsApp, typiquement.
 */

import { v } from "convex/values";
import { action, internalMutation, mutation, query, type MutationCtx } from "./_generated/server";
import { internal } from "./_generated/api";
import type { Doc, Id } from "./_generated/dataModel";
import { writeAudit } from "./lib/audit";
import { assertCanHandleRoles, assertNotSelfOrOwner } from "./lib/authority";
import { invitationEmail, isEmailConfigured, maskEmail, sendEmail } from "./lib/email";
import { appError, conflict, forbidden, invalid, notFound } from "./lib/errors";
import {
  getCurrentUser,
  requireOrganizationMember,
  requirePermission,
  requireUser,
  resolvePermissions,
  type Actor,
  type OrganizationActor,
} from "./lib/guards";
import { logEvent } from "./lib/log";
import { rateLimiter } from "./lib/rateLimits";
import { generateToken, sha256Hex } from "./lib/tokens";

const INVITATION_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const scopeArg = v.union(
  v.object({ organizationId: v.id("organizations") }),
  v.object({ venueId: v.id("venues") }),
);

function normalizeEmail(value: string): string {
  const email = value.trim().toLowerCase();
  if (email.length > 254 || !EMAIL_PATTERN.test(email)) throw invalid("Cette adresse e-mail n'est pas valide.");
  return email;
}

async function loadOrgRole(ctx: MutationCtx, organizationId: Id<"organizations">, roleId: Id<"roles">) {
  const role = await ctx.db.get(roleId);
  if (!role || role.organizationId !== organizationId || role.archivedAt !== undefined) {
    throw notFound("Ce rôle");
  }
  return role;
}

/* ════════════════════════════════════════════════════════════════════════════
 * Lecture
 * ════════════════════════════════════════════════════════════════════════════ */

/**
 * Les membres visibles dans une portée. Au niveau d'un établissement : ceux qui y ont
 * une affectation, ou une affectation valable pour toute l'organisation — et on ne
 * montre QUE ces affectations-là, pas celles d'ailleurs.
 */
export const listMembers = query({
  args: { scope: scopeArg },
  handler: async (ctx, args) => {
    const actor: Actor =
      "venueId" in args.scope
        ? await requirePermission(ctx, "team.read", { venueId: args.scope.venueId })
        : await requirePermission(ctx, "team.read", { organizationId: args.scope.organizationId });
    const venueId = actor.venue?._id ?? null;

    const members = await ctx.db
      .query("organizationMembers")
      .withIndex("by_org_status", (q) => q.eq("organizationId", actor.organization._id))
      .collect();
    const venueNames = new Map<string, string>();
    const roleCache = new Map<string, Doc<"roles"> | null>();
    const result = [];
    for (const member of members) {
      if (member.status === "removed" || member.status === "invited") continue;
      const assignments = await ctx.db
        .query("memberRoleAssignments")
        .withIndex("by_member", (q) => q.eq("memberId", member._id))
        .collect();
      const visible = assignments.filter(
        (a) => a.scopeType === "organization" || venueId === null || a.venueId === venueId,
      );
      const isOwner = member.userId === actor.organization.ownerUserId;
      if (venueId !== null && visible.length === 0 && !isOwner) continue;
      const user = await ctx.db.get(member.userId);
      if (!user) continue;
      const roles = [];
      for (const a of visible) {
        if (!roleCache.has(a.roleId)) roleCache.set(a.roleId, await ctx.db.get(a.roleId));
        const role = roleCache.get(a.roleId);
        if (!role) continue;
        let venueName: string | null = null;
        if (a.venueId) {
          if (!venueNames.has(a.venueId)) venueNames.set(a.venueId, (await ctx.db.get(a.venueId))?.name ?? "");
          venueName = venueNames.get(a.venueId) ?? null;
        }
        roles.push({ assignmentId: a._id, roleId: role._id, label: role.label, scopeType: a.scopeType, venueId: a.venueId ?? null, venueName });
      }
      result.push({
        memberId: member._id,
        userId: user._id,
        name: user.name ?? null,
        email: user.email,
        status: member.status,
        isOwner,
        isSelf: member.userId === actor.user._id,
        joinedAt: member.joinedAt ?? null,
        roles,
      });
    }
    return result.sort((a, b) => (a.name ?? a.email).localeCompare(b.name ?? b.email, "fr"));
  },
});

export const listInvitations = query({
  args: { scope: scopeArg },
  handler: async (ctx, args) => {
    const actor: Actor =
      "venueId" in args.scope
        ? await requirePermission(ctx, "team.read", { venueId: args.scope.venueId })
        : await requirePermission(ctx, "team.read", { organizationId: args.scope.organizationId });
    const venueId = actor.venue?._id ?? null;
    const pending = await ctx.db
      .query("organizationInvitations")
      .withIndex("by_org_status", (q) => q.eq("organizationId", actor.organization._id).eq("status", "pending"))
      .collect();
    const now = Date.now();
    const result = [];
    for (const inv of pending) {
      if (venueId !== null && !inv.venueIds.includes(venueId)) continue;
      const role = await ctx.db.get(inv.roleId);
      result.push({
        invitationId: inv._id,
        email: inv.email,
        roleLabel: role?.label ?? "",
        venueIds: inv.venueIds,
        expiresAt: inv.expiresAt,
        isExpired: inv.expiresAt < now,
      });
    }
    return result;
  },
});

/* ════════════════════════════════════════════════════════════════════════════
 * Invitation
 * ════════════════════════════════════════════════════════════════════════════ */

/**
 * Vérifie que l'acteur peut proposer ce rôle dans ces portées, et renvoie son identité.
 * Vide = portée organisation. Sinon, `team.manage` ET verrou 1 dans CHAQUE établissement.
 */
async function authorizeGrant(
  ctx: MutationCtx,
  organizationId: Id<"organizations">,
  role: Doc<"roles">,
  venueIds: readonly Id<"venues">[],
): Promise<Actor> {
  if (venueIds.length === 0) {
    const actor = await requirePermission(ctx, "team.manage", { organizationId });
    assertCanHandleRoles(actor.permissions, [role], "organization");
    return actor;
  }
  let actor: Actor | null = null;
  for (const venueId of venueIds) {
    const venueActor = await requirePermission(ctx, "team.manage", { venueId });
    if (venueActor.organization._id !== organizationId) throw notFound("Cet établissement");
    assertCanHandleRoles(venueActor.permissions, [role], "venue");
    actor = venueActor;
  }
  return actor!;
}

export const createInvitation = internalMutation({
  args: {
    organizationId: v.id("organizations"),
    email: v.string(),
    roleId: v.id("roles"),
    venueIds: v.array(v.id("venues")),
    tokenHash: v.string(),
  },
  handler: async (ctx, args) => {
    // L'identité de l'appelant est celle de l'action publique `invite` : Convex la
    // transmet aux fonctions qu'une action appelle. Les gardes s'appliquent donc ici.
    const base = await requireOrganizationMember(ctx, args.organizationId);
    const email = normalizeEmail(args.email);
    const role = await loadOrgRole(ctx, base.organization._id, args.roleId);
    const venueIds = [...new Set(args.venueIds)];
    const actor = await authorizeGrant(ctx, base.organization._id, role, venueIds);

    const limit = await rateLimiter.limit(ctx, "invitation", { key: actor.user._id });
    if (!limit.ok) {
      throw appError("RATE_LIMITED", "Trop d'invitations envoyées. Réessayez dans une heure.");
    }

    const invitedUser = await ctx.db.query("users").withIndex("by_email", (q) => q.eq("email", email)).first();
    if (invitedUser) {
      const existing = await ctx.db
        .query("organizationMembers")
        .withIndex("by_org_user", (q) => q.eq("organizationId", base.organization._id).eq("userId", invitedUser._id))
        .unique();
      if (existing && existing.status === "active") {
        throw conflict("Cette personne fait déjà partie de l'équipe. Modifiez ses rôles depuis la liste des membres.");
      }
    }

    // Une nouvelle invitation pour la même adresse remplace la précédente : un seul lien
    // valide à la fois, celui qu'on vient d'envoyer.
    const previous = await ctx.db.query("organizationInvitations").withIndex("by_email", (q) => q.eq("email", email)).collect();
    for (const inv of previous) {
      if (inv.organizationId === base.organization._id && inv.status === "pending") {
        await ctx.db.patch(inv._id, { status: "revoked" });
      }
    }

    const invitationId = await ctx.db.insert("organizationInvitations", {
      organizationId: base.organization._id,
      email,
      roleId: role._id,
      venueIds,
      tokenHash: args.tokenHash,
      status: "pending",
      invitedByUserId: actor.user._id,
      expiresAt: Date.now() + INVITATION_TTL_MS,
    });
    await writeAudit(ctx, {
      organizationId: base.organization._id,
      ...(venueIds.length === 1 ? { venueId: venueIds[0] } : {}),
      actorUserId: actor.user._id,
      action: "team.invitation.create",
      resourceType: "invitation",
      resourceId: invitationId,
      after: { email: maskEmail(email), role: role.label, venueIds },
    });
    return {
      organizationName: base.organization.name,
      inviterName: actor.user.name ?? actor.user.email,
      roleLabel: role.label,
    };
  },
});

export const invite = action({
  args: {
    organizationId: v.id("organizations"),
    email: v.string(),
    roleId: v.id("roles"),
    venueIds: v.array(v.id("venues")),
  },
  handler: async (ctx, args): Promise<{ link: string; emailSent: boolean }> => {
    // garde : déléguée à `createInvitation`, qui s'exécute avec l'identité de l'appelant
    // et refuse avant toute écriture. Aucun envoi n'a lieu si elle lève.
    const token = generateToken();
    const details = await ctx.runMutation(internal.team.createInvitation, {
      ...args,
      tokenHash: await sha256Hex(token),
    });
    const siteUrl = process.env.SITE_URL ?? "http://localhost:3000";
    const link = `${siteUrl}/invitation/${token}`;
    let emailSent = false;
    if (isEmailConfigured()) {
      try {
        await sendEmail({ to: args.email.trim().toLowerCase(), ...invitationEmail({ ...details, link }) });
        emailSent = true;
      } catch {
        // L'invitation existe ; seul l'envoi a échoué. On le dit, et le lien reste
        // transmissible à la main.
        emailSent = false;
        logEvent("warn", "invitation.email_failed", { organizationId: args.organizationId, operation: "team.invite" });
      }
    }
    return { link, emailSent };
  },
});

/** Aperçu d'une invitation pour l'écran d'acceptation. Le jeton EST la portée. */
export const previewInvitation = query({
  args: { token: v.string() },
  handler: async (ctx, args) => {
    // garde : jeton — sans jeton valide, rien n'est renvoyé, pas même « expiré ».
    const tokenHash = await sha256Hex(args.token);
    const inv = await ctx.db
      .query("organizationInvitations")
      .withIndex("by_token", (q) => q.eq("tokenHash", tokenHash))
      .unique();
    if (!inv || inv.status !== "pending" || inv.expiresAt < Date.now()) return null;
    const organization = await ctx.db.get(inv.organizationId);
    const role = await ctx.db.get(inv.roleId);
    const inviter = await ctx.db.get(inv.invitedByUserId);
    if (!organization || organization.status !== "active" || !role) return null;
    const viewer = await getCurrentUser(ctx);
    return {
      organizationName: organization.name,
      roleLabel: role.label,
      inviterName: inviter?.name ?? null,
      maskedEmail: maskEmail(inv.email),
      viewerEmailMatches: viewer ? viewer.email === inv.email : null,
    };
  },
});

/** Mes invitations en attente — adressées à l'adresse de mon compte. */
export const myInvitations = query({
  args: {},
  handler: async (ctx) => {
    const user = await requireUser(ctx);
    // Adresse non prouvée : on ne montre pas les invitations qui lui sont adressées.
    if (user.emailVerifiedAt === undefined) return [];
    const invitations = await ctx.db
      .query("organizationInvitations")
      .withIndex("by_email", (q) => q.eq("email", user.email))
      .collect();
    const now = Date.now();
    const result = [];
    for (const inv of invitations) {
      if (inv.status !== "pending" || inv.expiresAt < now) continue;
      const organization = await ctx.db.get(inv.organizationId);
      const role = await ctx.db.get(inv.roleId);
      if (!organization || organization.status !== "active" || !role) continue;
      result.push({ invitationId: inv._id, organizationName: organization.name, roleLabel: role.label });
    }
    return result;
  },
});

/**
 * Accepte une invitation. Elle doit être adressée à l'adresse du compte connecté : Joliba
 * n'a pas de mot de passe, chaque compte a PROUVÉ son adresse (code reçu par e-mail, ou
 * Google vérifié). Un lien transféré à quelqu'un d'autre ne l'ouvre donc pas.
 */
async function acceptInvitationDoc(
  ctx: MutationCtx,
  user: Doc<"users">,
  inv: Doc<"organizationInvitations"> | null,
  via: "token" | "id",
): Promise<{ organizationId: Id<"organizations"> }> {
  // Par identifiant, une invitation adressée à quelqu'un d'autre est INTROUVABLE : on ne
  // confirme même pas son existence. Par jeton, la personne détient le lien — on peut
  // lui dire à quelle adresse il était destiné.
  if (!inv || inv.status !== "pending" || (via === "id" && inv.email !== user.email)) {
    throw notFound("Cette invitation");
  }
  // L'égalité d'adresse ne prouve rien si l'adresse du compte n'a pas été prouvée : un
  // compte Google peut porter une adresse que son titulaire ne contrôle pas.
  if (user.emailVerifiedAt === undefined) {
    throw forbidden(
      "Votre adresse e-mail n'est pas encore confirmée. Déconnectez-vous, puis reconnectez-vous avec un code reçu par e-mail.",
    );
  }
  if (inv.expiresAt < Date.now()) {
    throw appError("NOT_FOUND", "Cette invitation a expiré. Demandez-en une nouvelle à la personne qui vous a invité.");
  }
  if (inv.email !== user.email) {
    throw forbidden(`Cette invitation a été envoyée à ${maskEmail(inv.email)}. Connectez-vous avec cette adresse pour l'accepter.`);
  }
  const organization = await ctx.db.get(inv.organizationId);
  const role = await ctx.db.get(inv.roleId);
  if (!organization || organization.status !== "active") throw notFound("Cette organisation");
  if (!role || role.archivedAt !== undefined || role.organizationId !== organization._id) {
    throw appError("NOT_FOUND", "Le rôle proposé n'existe plus. Demandez une nouvelle invitation.");
  }
  const venueIds: Id<"venues">[] = [];
  for (const venueId of inv.venueIds) {
    const venue = await ctx.db.get(venueId);
    if (venue && venue.organizationId === organization._id && venue.status !== "archived") venueIds.push(venueId);
  }
  if (inv.venueIds.length > 0 && venueIds.length === 0) {
    throw appError("NOT_FOUND", "L'établissement concerné n'existe plus. Demandez une nouvelle invitation.");
  }

  const now = Date.now();
  let member = await ctx.db
    .query("organizationMembers")
    .withIndex("by_org_user", (q) => q.eq("organizationId", organization._id).eq("userId", user._id))
    .unique();
  if (!member) {
    const memberId = await ctx.db.insert("organizationMembers", {
      organizationId: organization._id,
      userId: user._id,
      status: "active",
      invitedByUserId: inv.invitedByUserId,
      joinedAt: now,
    });
    member = (await ctx.db.get(memberId))!;
  } else if (member.status !== "active") {
    await ctx.db.patch(member._id, { status: "active", joinedAt: now });
  }

  const existing = await ctx.db
    .query("memberRoleAssignments")
    .withIndex("by_member", (q) => q.eq("memberId", member._id))
    .collect();
  const scopes: (Id<"venues"> | null)[] = venueIds.length === 0 ? [null] : venueIds;
  for (const venueId of scopes) {
    const already = existing.some((a) => a.roleId === role._id && (a.venueId ?? null) === venueId);
    if (already) continue;
    await ctx.db.insert("memberRoleAssignments", {
      organizationId: organization._id,
      memberId: member._id,
      roleId: role._id,
      scopeType: venueId === null ? "organization" : "venue",
      ...(venueId !== null ? { venueId } : {}),
      grantedByUserId: inv.invitedByUserId,
      grantedAt: now,
    });
  }
  await ctx.db.patch(inv._id, { status: "accepted", acceptedByUserId: user._id, acceptedAt: now });
  await writeAudit(ctx, {
    organizationId: organization._id,
    actorUserId: user._id,
    action: "team.invitation.accept",
    resourceType: "invitation",
    resourceId: inv._id,
    after: { role: role.label, venueIds },
  });
  return { organizationId: organization._id };
}

export const acceptInvitation = mutation({
  args: { token: v.string() },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    const tokenHash = await sha256Hex(args.token);
    const inv = await ctx.db
      .query("organizationInvitations")
      .withIndex("by_token", (q) => q.eq("tokenHash", tokenHash))
      .unique();
    return acceptInvitationDoc(ctx, user, inv, "token");
  },
});

export const acceptInvitationById = mutation({
  args: { invitationId: v.id("organizationInvitations") },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    return acceptInvitationDoc(ctx, user, await ctx.db.get(args.invitationId), "id");
  },
});

export const revokeInvitation = mutation({
  args: { organizationId: v.id("organizations"), invitationId: v.id("organizationInvitations") },
  handler: async (ctx, args) => {
    const base = await requireOrganizationMember(ctx, args.organizationId);
    const inv = await ctx.db.get(args.invitationId);
    if (!inv || inv.organizationId !== base.organization._id || inv.status !== "pending") {
      throw notFound("Cette invitation");
    }
    const role = await ctx.db.get(inv.roleId);
    // Même autorité que pour l'envoyer : on ne révoque que ce qu'on aurait pu proposer.
    const actor = role
      ? await authorizeGrant(ctx, base.organization._id, role, inv.venueIds)
      : await requirePermission(ctx, "team.manage", { organizationId: base.organization._id });
    await ctx.db.patch(inv._id, { status: "revoked" });
    await writeAudit(ctx, {
      organizationId: base.organization._id,
      actorUserId: actor.user._id,
      action: "team.invitation.revoke",
      resourceType: "invitation",
      resourceId: inv._id,
    });
  },
});

/* ════════════════════════════════════════════════════════════════════════════
 * Affectations et statut
 * ════════════════════════════════════════════════════════════════════════════ */

/**
 * Remplace les rôles d'un membre DANS UNE PORTÉE, et seulement celle-là. Verrous :
 * `team.manage` dans la portée ; pas soi-même, pas le propriétaire ; l'acteur détient
 * chaque permission des rôles ajoutés ET retirés.
 */
export const setMemberRoles = mutation({
  args: { memberId: v.id("organizationMembers"), scope: scopeArg, roleIds: v.array(v.id("roles")) },
  handler: async (ctx, args) => {
    const actor: Actor =
      "venueId" in args.scope
        ? await requirePermission(ctx, "team.manage", { venueId: args.scope.venueId })
        : await requirePermission(ctx, "team.manage", { organizationId: args.scope.organizationId });
    const member = await ctx.db.get(args.memberId);
    if (!member || member.organizationId !== actor.organization._id || member.status === "removed") {
      throw notFound("Ce membre");
    }
    assertNotSelfOrOwner(actor, member);

    const scopeType = actor.venue ? "venue" : "organization";
    const venueId = actor.venue?._id;
    const assignments = await ctx.db
      .query("memberRoleAssignments")
      .withIndex("by_member", (q) => q.eq("memberId", member._id))
      .collect();
    const inScope = assignments.filter((a) =>
      scopeType === "organization" ? a.scopeType === "organization" : a.venueId === venueId,
    );

    const nextIds = [...new Set(args.roleIds)];
    const nextRoles = [];
    for (const id of nextIds) nextRoles.push(await loadOrgRole(ctx, actor.organization._id, id));
    const previousRoles = [];
    for (const a of inScope) {
      const role = await ctx.db.get(a.roleId);
      if (role) previousRoles.push(role);
    }
    assertCanHandleRoles(actor.permissions, [...previousRoles, ...nextRoles], scopeType);

    const now = Date.now();
    for (const a of inScope) {
      if (!nextIds.includes(a.roleId)) await ctx.db.delete(a._id);
    }
    for (const role of nextRoles) {
      if (inScope.some((a) => a.roleId === role._id)) continue;
      await ctx.db.insert("memberRoleAssignments", {
        organizationId: actor.organization._id,
        memberId: member._id,
        roleId: role._id,
        scopeType,
        ...(venueId ? { venueId } : {}),
        grantedByUserId: actor.user._id,
        grantedAt: now,
      });
    }
    await writeAudit(ctx, {
      organizationId: actor.organization._id,
      ...(venueId ? { venueId } : {}),
      actorUserId: actor.user._id,
      action: "team.member.roles.set",
      resourceType: "member",
      resourceId: member._id,
      before: previousRoles.map((r) => r.label),
      after: nextRoles.map((r) => r.label),
    });
  },
});

/**
 * L'acteur a-t-il autorité sur TOUTES les affectations de ce membre ? Pour suspendre ou
 * retirer quelqu'un, il faut pouvoir gérer chacun de ses rôles, là où il les tient.
 */
async function assertAuthorityOverMember(
  ctx: MutationCtx,
  base: OrganizationActor,
  member: Doc<"organizationMembers">,
): Promise<void> {
  const assignments = await ctx.db
    .query("memberRoleAssignments")
    .withIndex("by_member", (q) => q.eq("memberId", member._id))
    .collect();
  for (const a of assignments) {
    const role = await ctx.db.get(a.roleId);
    if (!role) continue;
    const venue = a.venueId ? await ctx.db.get(a.venueId) : null;
    const permissions = await resolvePermissions(ctx, base, venue);
    if (!permissions.has("team.manage")) throw forbidden("Cette personne a des rôles que vous ne gérez pas.");
    assertCanHandleRoles(permissions, [role], a.scopeType);
  }
  if (assignments.length === 0) {
    const permissions = await resolvePermissions(ctx, base, null);
    if (!permissions.has("team.manage")) throw forbidden();
  }
}

export const setMemberStatus = mutation({
  args: {
    organizationId: v.id("organizations"),
    memberId: v.id("organizationMembers"),
    status: v.union(v.literal("active"), v.literal("suspended"), v.literal("removed")),
  },
  handler: async (ctx, args) => {
    const base = await requireOrganizationMember(ctx, args.organizationId);
    const member = await ctx.db.get(args.memberId);
    if (!member || member.organizationId !== base.organization._id || member.status === "removed") {
      throw notFound("Ce membre");
    }
    assertNotSelfOrOwner(base, member);
    await assertAuthorityOverMember(ctx, base, member);
    if (member.status === args.status) return;

    const now = Date.now();
    if (args.status === "removed") {
      // Retirer, c'est rendre l'accès impossible à rétablir sans nouvelle invitation.
      const assignments = await ctx.db
        .query("memberRoleAssignments")
        .withIndex("by_member", (q) => q.eq("memberId", member._id))
        .collect();
      for (const a of assignments) await ctx.db.delete(a._id);
      await ctx.db.patch(member._id, { status: "removed", removedAt: now });
    } else {
      await ctx.db.patch(member._id, { status: args.status });
    }
    await writeAudit(ctx, {
      organizationId: base.organization._id,
      actorUserId: base.user._id,
      action: `team.member.${args.status === "active" ? "reactivate" : args.status === "suspended" ? "suspend" : "remove"}`,
      resourceType: "member",
      resourceId: member._id,
      before: { status: member.status },
      after: { status: args.status },
    });
  },
});
