/**
 * Gardes d'accès — Joliba
 *
 * Toute fonction Convex publique qui lit ou écrit une donnée métier commence par une de
 * ces gardes (PERMISSIONS.md §6). `scripts/check-guards.mjs` le vérifie à chaque CI.
 *
 * Ordre invariable : on résout la portée DEPUIS L'APPELANT (qui es-tu, de quelle
 * organisation es-tu membre, à quel établissement as-tu accès) AVANT de renvoyer quoi
 * que ce soit. Tout échec hors de la portée de l'appelant répond NOT_FOUND.
 *
 * Résolution des permissions :
 *   1. membre actif de l'organisation, sinon ∅ ;
 *   2. le PROPRIÉTAIRE de l'organisation (`organizations.ownerUserId`) détient tout le
 *      catalogue, partout dans l'organisation. Ce n'est pas un test de nom de rôle : c'est
 *      la propriété du compte, qui ne doit jamais pouvoir s'enfermer dehors en modifiant
 *      un rôle ;
 *   3. sinon, UNION des rôles affectés — au niveau organisation (valables partout) et,
 *      si un établissement est demandé, au niveau de cet établissement ;
 *   4. le plan tarifaire RETIRE ce qu'il ne couvre pas, jamais n'ajoute.
 *
 * Une permission de portée « organisation » (`venue.create`, `permissions.manage`…) ne
 * s'obtient QUE par une affectation au niveau organisation : être responsable d'un
 * établissement ne permet pas d'en créer un autre.
 */

import type { GenericMutationCtx, GenericQueryCtx } from "convex/server";
import type { DataModel, Doc, Id } from "../_generated/dataModel";
import { applyEntitlements } from "./entitlements";
import { forbidden, notFound, unauthenticated } from "./errors";
import {
  ALL_PERMISSIONS,
  isPermission,
  permissionMeta,
  type Permission,
  type PlatformPermission,
} from "./permissions";

export type QueryCtx = GenericQueryCtx<DataModel>;
export type MutationCtx = GenericMutationCtx<DataModel>;
/** Les gardes ne font que lire : elles servent aux requêtes comme aux mutations. */
export type ReadCtx = QueryCtx | MutationCtx;

/** La portée d'une question de permission. Jamais les deux à la fois. */
export type PermissionScope = { organizationId: Id<"organizations"> } | { venueId: Id<"venues"> };

export type OrganizationActor = {
  user: Doc<"users">;
  organization: Doc<"organizations">;
  member: Doc<"organizationMembers">;
  isOwner: boolean;
};

export type Actor = OrganizationActor & {
  /** Présent quand la question portait sur un établissement. */
  venue: Doc<"venues"> | null;
  permissions: ReadonlySet<Permission>;
};

/* ────────────────────────────────────────────────────────────────────────────
 * Identité
 * ──────────────────────────────────────────────────────────────────────────── */

/**
 * L'utilisateur courant, ou `null`. Pour les écrans qui s'affichent aussi déconnecté
 * (connexion, acceptation d'invitation). Toute autre lecture passe par `requireUser`.
 *
 * `identity.subject` est l'identifiant Better Auth ; `users.authId` en est le miroir,
 * posé par le déclencheur de création de compte (`convex/auth.ts`).
 */
export async function getCurrentUser(ctx: ReadCtx): Promise<Doc<"users"> | null> {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) return null;
  const user = await ctx.db
    .query("users")
    .withIndex("by_auth", (q) => q.eq("authId", identity.subject))
    .unique();
  if (!user || user.status !== "active") return null;
  return user;
}

export async function requireUser(ctx: ReadCtx): Promise<Doc<"users">> {
  const user = await getCurrentUser(ctx);
  if (!user) throw unauthenticated();
  return user;
}

/* ────────────────────────────────────────────────────────────────────────────
 * Organisation et établissement
 * ──────────────────────────────────────────────────────────────────────────── */

async function activeMembership(
  ctx: ReadCtx,
  organizationId: Id<"organizations">,
  userId: Id<"users">,
): Promise<Doc<"organizationMembers"> | null> {
  const member = await ctx.db
    .query("organizationMembers")
    .withIndex("by_org_user", (q) => q.eq("organizationId", organizationId).eq("userId", userId))
    .unique();
  return member && member.status === "active" ? member : null;
}

/**
 * L'appelant est-il membre ACTIF de cette organisation ? Sinon NOT_FOUND : on ne dit
 * pas à un inconnu qu'une organisation porte cet identifiant.
 */
export async function requireOrganizationMember(
  ctx: ReadCtx,
  organizationId: Id<"organizations">,
): Promise<OrganizationActor> {
  const user = await requireUser(ctx);
  // La lecture de l'organisation précède la vérification d'appartenance, mais rien n'en
  // sort tant que l'appartenance n'est pas établie.
  const organization = await ctx.db.get(organizationId);
  if (!organization || organization.status !== "active") throw notFound("Cette organisation");
  const member = await activeMembership(ctx, organizationId, user._id);
  if (!member) throw notFound("Cette organisation");
  return { user, organization, member, isOwner: organization.ownerUserId === user._id };
}

async function assignmentsOf(ctx: ReadCtx, memberId: Id<"organizationMembers">) {
  return ctx.db
    .query("memberRoleAssignments")
    .withIndex("by_member", (q) => q.eq("memberId", memberId))
    .collect();
}

/**
 * L'appelant a-t-il accès à cet établissement ? Il faut être membre actif de
 * l'organisation qui le possède ET avoir au moins une affectation qui le couvre
 * (organisation entière, ou cet établissement). Sinon NOT_FOUND.
 */
export async function requireVenueAccess(
  ctx: ReadCtx,
  venueId: Id<"venues">,
): Promise<OrganizationActor & { venue: Doc<"venues"> }> {
  const user = await requireUser(ctx);
  const venue = await ctx.db.get(venueId);
  if (!venue || venue.status === "archived") throw notFound("Cet établissement");
  const organization = await ctx.db.get(venue.organizationId);
  if (!organization || organization.status !== "active") throw notFound("Cet établissement");
  const member = await activeMembership(ctx, organization._id, user._id);
  if (!member) throw notFound("Cet établissement");
  const isOwner = organization.ownerUserId === user._id;
  if (!isOwner) {
    const assignments = await assignmentsOf(ctx, member._id);
    const covered = assignments.some(
      (a) => a.scopeType === "organization" || a.venueId === venue._id,
    );
    if (!covered) throw notFound("Cet établissement");
  }
  return { user, organization, member, isOwner, venue };
}

/* ────────────────────────────────────────────────────────────────────────────
 * Résolution des permissions
 * ──────────────────────────────────────────────────────────────────────────── */

async function effectiveEntitlements(
  ctx: ReadCtx,
  organizationId: Id<"organizations">,
): Promise<Record<string, boolean> | undefined> {
  const subscription = await ctx.db
    .query("subscriptions")
    .withIndex("by_org", (q) => q.eq("organizationId", organizationId))
    .order("desc")
    .first();
  if (!subscription) return undefined;
  // Les dérogations RÉTRÉCISSENT comme le plan : un `true` n'y rouvre rien.
  const effective: Record<string, boolean> = {};
  for (const [feature, value] of Object.entries(subscription.entitlements)) {
    if (value === false) effective[feature] = false;
  }
  for (const [feature, value] of Object.entries(subscription.overrides ?? {})) {
    if (value === false) effective[feature] = false;
  }
  return effective;
}

/**
 * Permissions effectives de l'acteur, dans une portée donnée.
 *
 * `venue` absent : seules les affectations au niveau organisation comptent.
 * `venue` présent : affectations organisation + affectations sur CET établissement.
 */
export async function resolvePermissions(
  ctx: ReadCtx,
  actor: OrganizationActor,
  venue: Doc<"venues"> | null,
): Promise<Set<Permission>> {
  let granted: Set<Permission>;
  if (actor.isOwner) {
    granted = new Set(ALL_PERMISSIONS);
  } else {
    granted = new Set();
    const assignments = await assignmentsOf(ctx, actor.member._id);
    for (const a of assignments) {
      const applies =
        a.scopeType === "organization" || (venue !== null && a.venueId === venue._id);
      if (!applies) continue;
      const role = await ctx.db.get(a.roleId);
      // Un rôle archivé ou d'une autre organisation ne confère rien, quoi qu'en dise
      // l'affectation : la ligne d'affectation n'est pas une source de vérité suffisante.
      if (!role || role.archivedAt !== undefined) continue;
      if (role.organizationId !== actor.organization._id) continue;
      for (const p of role.permissions) {
        if (isPermission(p)) granted.add(p);
      }
    }
  }
  return applyEntitlements(granted, await effectiveEntitlements(ctx, actor.organization._id));
}

/**
 * La garde à utiliser par défaut. Résout la portée, puis vérifie la permission.
 *
 * - Hors de la portée de l'appelant : NOT_FOUND.
 * - Dans sa portée mais sans le droit : FORBIDDEN (il sait déjà que l'objet existe).
 */
export type VenueActor = Actor & { venue: Doc<"venues"> };

export async function requirePermission(
  ctx: ReadCtx,
  permission: Permission,
  scope: { venueId: Id<"venues"> },
): Promise<VenueActor>;
export async function requirePermission(
  ctx: ReadCtx,
  permission: Permission,
  scope: { organizationId: Id<"organizations"> },
): Promise<Actor>;
export async function requirePermission(
  ctx: ReadCtx,
  permission: Permission,
  scope: PermissionScope,
): Promise<Actor> {
  if (permissionMeta(permission).scope === "organization" && "venueId" in scope) {
    // Erreur de programmation, pas d'utilisateur : une permission d'organisation ne
    // s'évalue jamais dans un établissement.
    throw new Error(`La permission ${permission} s'évalue au niveau de l'organisation.`);
  }
  const base =
    "venueId" in scope
      ? await requireVenueAccess(ctx, scope.venueId)
      : { ...(await requireOrganizationMember(ctx, scope.organizationId)), venue: null };
  const permissions = await resolvePermissions(ctx, base, base.venue);
  if (!permissions.has(permission)) throw forbidden();
  return { ...base, permissions };
}

/** Variante qui répond oui/non sans lever, pour composer des vues. */
export async function hasPermission(
  ctx: ReadCtx,
  actor: OrganizationActor,
  permission: Permission,
  venue: Doc<"venues"> | null,
): Promise<boolean> {
  return (await resolvePermissions(ctx, actor, venue)).has(permission);
}

/**
 * Établissements que l'acteur peut voir : tous ceux de l'organisation s'il a une
 * affectation au niveau organisation (ou s'il en est propriétaire), sinon ceux où il
 * est affecté.
 */
export async function accessibleVenues(
  ctx: ReadCtx,
  actor: OrganizationActor,
): Promise<Doc<"venues">[]> {
  const venues = (
    await ctx.db
      .query("venues")
      .withIndex("by_org", (q) => q.eq("organizationId", actor.organization._id))
      .collect()
  ).filter((v) => v.status !== "archived");
  if (actor.isOwner) return venues;
  const assignments = await assignmentsOf(ctx, actor.member._id);
  if (assignments.some((a) => a.scopeType === "organization")) return venues;
  const allowed = new Set(assignments.map((a) => a.venueId).filter((id) => id !== undefined));
  return venues.filter((v) => allowed.has(v._id));
}

/* ────────────────────────────────────────────────────────────────────────────
 * Plateforme — chemin totalement séparé
 * ──────────────────────────────────────────────────────────────────────────── */

/**
 * Un membre de l'équipe Joliba. Ses droits viennent de `platformAdmins`, jamais d'un rôle
 * d'organisation, et aucune organisation ne peut en attribuer (verrou 3).
 */
export async function requirePlatformAdmin(
  ctx: ReadCtx,
  permission: PlatformPermission,
): Promise<{ user: Doc<"users">; admin: Doc<"platformAdmins"> }> {
  const user = await requireUser(ctx);
  const admin = await ctx.db
    .query("platformAdmins")
    .withIndex("by_user", (q) => q.eq("userId", user._id))
    .unique();
  // NOT_FOUND et non FORBIDDEN : l'existence même de la console n'est pas annoncée.
  if (!admin || admin.status !== "active" || !admin.permissions.includes(permission)) {
    throw notFound();
  }
  return { user, admin };
}
