/**
 * Rôles — Joliba
 *
 * Un rôle est un sac de permissions nommé, qui APPARTIENT à l'organisation. Elle part
 * des modèles copiés à sa création et les compose librement. Aucun code ne teste un nom
 * de rôle : il teste une permission (PERMISSIONS.md §1).
 *
 * Toute écriture passe par les verrous 1 et 3 (`lib/authority.ts`) : on ne met pas dans
 * un rôle un droit qu'on n'a pas, et jamais un droit de la plateforme.
 */

import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import type { Doc } from "./_generated/dataModel";
import { writeAudit } from "./lib/audit";
import { effectivePermissionsInScope, missingPermissions, sanitizeRolePermissions } from "./lib/authority";
import { conflict, forbidden, invalid, notFound } from "./lib/errors";
import {
  accessibleVenues,
  requireOrganizationMember,
  requirePermission,
  requireUser,
  resolvePermissions,
  type Actor,
  type OrganizationActor,
  type ReadCtx,
} from "./lib/guards";
import { PERMISSIONS, type Permission } from "./lib/permissions";
import { slugify } from "./lib/slug";

/** Une modification de rôle change les droits de plusieurs personnes : motif exigé. */
const MIN_REASON_LENGTH = 10;

function requireReason(reason: string): string {
  const text = reason.trim();
  if (text.length < MIN_REASON_LENGTH) {
    throw invalid(`Indiquez le motif de la modification (au moins ${MIN_REASON_LENGTH} caractères).`);
  }
  return text.slice(0, 500);
}

function cleanLabel(value: string): string {
  const label = value.trim().replace(/\s+/g, " ");
  if (label.length < 2 || label.length > 60) {
    throw invalid("Le nom du rôle doit contenir entre 2 et 60 caractères.");
  }
  return label;
}

/**
 * L'appelant peut-il gérer l'équipe quelque part dans l'organisation ? Il a alors besoin
 * de voir les rôles pour inviter — mais pas forcément de les composer.
 */
async function canSeeRoles(ctx: ReadCtx, actor: OrganizationActor): Promise<boolean> {
  const orgPermissions = await resolvePermissions(ctx, actor, null);
  if (orgPermissions.has("permissions.manage") || orgPermissions.has("team.read")) return true;
  for (const venue of await accessibleVenues(ctx, actor)) {
    const perms = await resolvePermissions(ctx, actor, venue);
    if (perms.has("team.read") || perms.has("team.manage")) return true;
  }
  return false;
}

/** Le catalogue, pour l'écran de composition. Aucune permission `platform.*`. */
export const catalog = query({
  args: {},
  handler: async (ctx) => {
    await requireUser(ctx);
    return (Object.entries(PERMISSIONS) as [Permission, (typeof PERMISSIONS)[Permission]][]).map(
      ([key, meta]) => ({
        key,
        label: meta.label,
        group: meta.group,
        scope: meta.scope,
        sensitive: "sensitive" in meta && meta.sensitive === true,
      }),
    );
  },
});

export const list = query({
  args: { organizationId: v.id("organizations") },
  handler: async (ctx, args) => {
    const actor = await requireOrganizationMember(ctx, args.organizationId);
    if (!(await canSeeRoles(ctx, actor))) throw forbidden();
    const roles = await ctx.db
      .query("roles")
      .withIndex("by_org", (q) => q.eq("organizationId", actor.organization._id))
      .collect();
    const result = [];
    for (const role of roles) {
      if (role.archivedAt !== undefined) continue;
      const assignments = await ctx.db
        .query("memberRoleAssignments")
        .withIndex("by_role", (q) => q.eq("roleId", role._id))
        .collect();
      result.push({
        _id: role._id,
        key: role.key,
        label: role.label,
        description: role.description ?? null,
        permissions: role.permissions,
        isCustom: role.isCustom,
        memberCount: new Set(assignments.map((a) => a.memberId)).size,
      });
    }
    return result;
  },
});

/**
 * Les rôles de l'organisation, et pour chacun : l'appelant peut-il l'attribuer DANS CETTE
 * PORTÉE ? Les rôles non attribuables sont renvoyés aussi, avec la raison — l'écran les
 * montre désactivés plutôt que de les cacher (INFORMATION_ARCHITECTURE §4.14). Le calcul
 * est celui des mutations (`lib/authority.ts`) : l'écran ne peut pas promettre ce que le
 * serveur refusera.
 */
export const listForGrant = query({
  args: {
    scope: v.union(
      v.object({ organizationId: v.id("organizations") }),
      v.object({ venueId: v.id("venues") }),
    ),
  },
  handler: async (ctx, args) => {
    const actor: Actor =
      "venueId" in args.scope
        ? await requirePermission(ctx, "team.manage", { venueId: args.scope.venueId })
        : await requirePermission(ctx, "team.manage", { organizationId: args.scope.organizationId });
    const scopeType = actor.venue ? "venue" : "organization";
    const roles = await ctx.db
      .query("roles")
      .withIndex("by_org", (q) => q.eq("organizationId", actor.organization._id))
      .collect();
    return roles
      .filter((role) => role.archivedAt === undefined)
      .map((role) => {
        const missing = missingPermissions(actor.authority, effectivePermissionsInScope(role.permissions, scopeType));
        return {
          _id: role._id,
          label: role.label,
          description: role.description ?? null,
          grantable: missing.length === 0,
          missingCount: missing.length,
        };
      });
  },
});

async function loadOwnRole(actor: Actor, ctx: ReadCtx, roleId: Doc<"roles">["_id"]) {
  const role = await ctx.db.get(roleId);
  // Rôle d'une autre organisation, ou modèle système : introuvable pour l'appelant.
  if (!role || role.organizationId !== actor.organization._id || role.archivedAt !== undefined) {
    throw notFound("Ce rôle");
  }
  return role;
}

/** Verrou 1, mesuré sur l'AUTORITÉ de l'acteur (avant le plan tarifaire). */
function assertHolds(actor: Actor, permissions: readonly Permission[]): void {
  const missing = missingPermissions(actor.authority, permissions);
  if (missing.length > 0) {
    throw forbidden(
      "Ce rôle contiendrait des droits que vous n'avez pas vous-même. Retirez-les, ou demandez à une personne qui les détient.",
    );
  }
}

export const create = mutation({
  args: {
    organizationId: v.id("organizations"),
    label: v.string(),
    description: v.optional(v.string()),
    permissions: v.array(v.string()),
  },
  handler: async (ctx, args) => {
    const actor = await requirePermission(ctx, "permissions.manage", {
      organizationId: args.organizationId,
    });
    const label = cleanLabel(args.label);
    const permissions = sanitizeRolePermissions(args.permissions);
    assertHolds(actor, permissions);

    const base = `custom-${slugify(label)}`;
    let key = base;
    for (let i = 2; ; i++) {
      const taken = await ctx.db
        .query("roles")
        .withIndex("by_org_key", (q) => q.eq("organizationId", actor.organization._id).eq("key", key))
        .first();
      if (!taken) break;
      key = `${base}-${i}`;
    }
    const description = args.description?.trim().slice(0, 300);
    const roleId = await ctx.db.insert("roles", {
      organizationId: actor.organization._id,
      key,
      label,
      ...(description ? { description } : {}),
      permissions,
      isCustom: true,
    });
    await writeAudit(ctx, {
      organizationId: actor.organization._id,
      actorUserId: actor.user._id,
      action: "role.create",
      resourceType: "role",
      resourceId: roleId,
      after: { label, permissions },
    });
    return roleId;
  },
});

export const update = mutation({
  args: {
    organizationId: v.id("organizations"),
    roleId: v.id("roles"),
    label: v.optional(v.string()),
    description: v.optional(v.string()),
    permissions: v.optional(v.array(v.string())),
    reason: v.string(),
  },
  handler: async (ctx, args) => {
    const actor = await requirePermission(ctx, "permissions.manage", {
      organizationId: args.organizationId,
    });
    const role = await loadOwnRole(actor, ctx, args.roleId);
    const reason = requireReason(args.reason);
    const patch: Partial<Pick<Doc<"roles">, "label" | "description" | "permissions">> = {};
    if (args.label !== undefined) patch.label = cleanLabel(args.label);
    if (args.description !== undefined) patch.description = args.description.trim().slice(0, 300);
    if (args.permissions !== undefined) {
      const next = sanitizeRolePermissions(args.permissions);
      // Verrou 1 dans les deux sens : ni ajouter, ni retirer un droit qu'on ne détient pas
      // — sinon on pourrait affaiblir un rôle plus puissant que le sien.
      const current = role.permissions.filter((p): p is Permission => p in PERMISSIONS);
      assertHolds(actor, [...new Set([...current, ...next])]);
      patch.permissions = next;
    }
    if (Object.keys(patch).length === 0) return;
    await ctx.db.patch(role._id, patch);
    await writeAudit(ctx, {
      organizationId: actor.organization._id,
      actorUserId: actor.user._id,
      action: "role.update",
      resourceType: "role",
      resourceId: role._id,
      before: { label: role.label, permissions: role.permissions },
      after: patch,
      reason,
    });
  },
});

/** Un rôle ne se supprime pas : il s'archive, et seulement s'il n'est plus attribué. */
export const archive = mutation({
  args: { organizationId: v.id("organizations"), roleId: v.id("roles"), reason: v.string() },
  handler: async (ctx, args) => {
    const actor = await requirePermission(ctx, "permissions.manage", {
      organizationId: args.organizationId,
    });
    const role = await loadOwnRole(actor, ctx, args.roleId);
    const reason = requireReason(args.reason);
    const current = role.permissions.filter((p): p is Permission => p in PERMISSIONS);
    assertHolds(actor, current);
    const assigned = await ctx.db
      .query("memberRoleAssignments")
      .withIndex("by_role", (q) => q.eq("roleId", role._id))
      .first();
    if (assigned) throw conflict("Ce rôle est encore attribué. Retirez-le aux personnes concernées avant de l'archiver.");
    const pending = (
      await ctx.db
        .query("organizationInvitations")
        .withIndex("by_org_status", (q) => q.eq("organizationId", actor.organization._id).eq("status", "pending"))
        .collect()
    ).some((i) => i.roleId === role._id);
    if (pending) throw conflict("Une invitation en attente propose ce rôle. Révoquez-la d'abord.");
    await ctx.db.patch(role._id, { archivedAt: Date.now() });
    await writeAudit(ctx, {
      organizationId: actor.organization._id,
      actorUserId: actor.user._id,
      action: "role.archive",
      resourceType: "role",
      resourceId: role._id,
      before: { label: role.label },
      reason,
    });
  },
});
