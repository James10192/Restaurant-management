/**
 * L'acteur du service — Joliba (D-060)
 *
 * Trois façons d'agir pendant le service, une seule garde :
 *
 *  - un COMPTE (Better Auth) : le gérant sur son téléphone, un serveur qui se connecte par code ;
 *    droits = ceux de ses rôles, exactement comme `requirePermission` ;
 *  - un PIN sur un appareil enrôlé : droits = ceux de ses rôles ∩ les permissions marquées
 *    `pin` dans le catalogue. Plafond, jamais octroi ;
 *  - un ÉCRAN DE CUISINE, sans humain : droits fixes (voir le bon, le faire avancer), limités à
 *    son établissement.
 *
 * À CHAQUE appel, tout est relu : l'appareil (non révoqué, du bon établissement), la session
 * d'opérateur (ouverte, pas trop ancienne, pas inactive), le membre (actif, toujours affecté
 * ici), son PIN (toujours actif). Le jeton ne prouve que « c'était vrai il y a moins de dix
 * minutes » : révoquer un appareil ou suspendre quelqu'un coupe l'accès immédiatement (D-038).
 *
 * Ce qui est écrit dans les journaux vient d'ici (`event`, `audit`) : qui, sur quel appareil,
 * dans quelle session.
 */

import type { Doc, Id } from "../_generated/dataModel";
import { applyEntitlements } from "./entitlements";
import { conflict, forbidden, notFound, unauthenticated } from "./errors";
import {
  effectiveEntitlements,
  loadActiveVenue,
  memberCoversVenue,
  requirePermission,
  resolvePermissionSets,
  type MutationCtx,
  type ReadCtx,
} from "./guards";
import { parseOperatorSubject } from "./operatorJwt";
import { PIN_PERMISSIONS, type Permission } from "./permissions";

/** Au-delà, un nouveau PIN est exigé, même en activité continue. */
export const OPERATOR_SESSION_MAX_MS = 12 * 60 * 60_000;

/**
 * Inactivité tolérée par le serveur. L'écran d'une tablette partagée se verrouille de lui-même
 * après 60 secondes ; le serveur, lui, refuse au-delà de 3 minutes sans geste — le temps
 * qu'un écran oublié ne serve pas à quelqu'un d'autre.
 */
export const OPERATOR_IDLE_MS: Record<"shared" | "personal", number> = {
  shared: 3 * 60_000,
  personal: 30 * 60_000,
};

/** Ce qu'un écran de cuisine peut faire, sans personne derrière. */
export const DEVICE_PERMISSIONS: ReadonlySet<Permission> = new Set<Permission>(["venue.read", "menu.read", "kitchen.read", "kitchen.ticket.update"]);

export type EventActor =
  | {
      type: "staff";
      memberId: Id<"organizationMembers">;
      deviceId?: Id<"trustedDevices">;
      operatorSessionId?: Id<"operatorSessions">;
    }
  | { type: "device"; deviceId: Id<"trustedDevices"> }
  | { type: "guest" }
  | { type: "system" };

export type AuditActor = {
  actorType: "staff" | "device";
  actorUserId?: Id<"users">;
  actorMemberId?: Id<"organizationMembers">;
  actorDeviceId?: Id<"trustedDevices">;
};

export type ServiceActor = {
  venue: Doc<"venues">;
  organization: Doc<"organizations">;
  permissions: ReadonlySet<Permission>;
  via: "account" | "pin" | "device";
  /** Absent pour un écran de cuisine. */
  member: Doc<"organizationMembers"> | null;
  /** Présent seulement pour un compte. */
  user: Doc<"users"> | null;
  device: Doc<"trustedDevices"> | null;
  operatorSession: Doc<"operatorSessions"> | null;
  event: EventActor;
  audit: AuditActor;
};

/** Le membre derrière un geste, ou `undefined` pour un écran de cuisine. */
export function actorMemberId(actor: ServiceActor): Id<"organizationMembers"> | undefined {
  return actor.member?._id;
}

export function isOperatorSessionExpired(
  session: Pick<Doc<"operatorSessions">, "startedAt" | "lastActivityAt" | "endedAt">,
  deviceType: Doc<"trustedDevices">["deviceType"],
  now: number,
): boolean {
  if (session.endedAt !== undefined) return true;
  if (now - session.startedAt > OPERATOR_SESSION_MAX_MS) return true;
  const idle = deviceType === "personal" ? OPERATOR_IDLE_MS.personal : OPERATOR_IDLE_MS.shared;
  return now - session.lastActivityAt > idle;
}

/**
 * La garde du service. Mêmes réponses que `requirePermission` : hors de portée NOT_FOUND,
 * dans la portée sans le droit FORBIDDEN ; un jeton d'appareil ou de PIN qui ne tient plus
 * (session close, appareil révoqué, membre suspendu) répond UNAUTHENTICATED — l'écran
 * redemande le PIN.
 */
export async function requireServiceActor(
  ctx: ReadCtx,
  permission: Permission,
  scope: { venueId: Id<"venues"> },
): Promise<ServiceActor> {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) throw unauthenticated();
  const subject = parseOperatorSubject(identity.issuer, identity.subject);

  if (subject === null) {
    const a = await requirePermission(ctx, permission, scope);
    return {
      venue: a.venue,
      organization: a.organization,
      permissions: a.permissions,
      via: "account",
      member: a.member,
      user: a.user,
      device: null,
      operatorSession: null,
      event: { type: "staff", memberId: a.member._id },
      audit: { actorType: "staff", actorUserId: a.user._id, actorMemberId: a.member._id },
    };
  }

  if (subject.kind === "device") {
    const deviceId = ctx.db.normalizeId("trustedDevices", subject.id);
    const device = deviceId ? await ctx.db.get(deviceId) : null;
    if (!device || device.revokedAt !== undefined || device.deviceType !== "kds") throw unauthenticated();
    if (device.venueId !== scope.venueId) throw notFound("Cet établissement");
    const { venue, organization } = await loadActiveVenue(ctx, scope.venueId);
    const permissions = applyEntitlements(new Set(DEVICE_PERMISSIONS), await effectiveEntitlements(ctx, organization._id));
    if (!permissions.has(permission)) throw forbidden();
    return {
      venue,
      organization,
      permissions,
      via: "device",
      member: null,
      user: null,
      device,
      operatorSession: null,
      event: { type: "device", deviceId: device._id },
      audit: { actorType: "device", actorDeviceId: device._id },
    };
  }

  const sessionId = ctx.db.normalizeId("operatorSessions", subject.id);
  const session = sessionId ? await ctx.db.get(sessionId) : null;
  if (!session) throw unauthenticated();
  const device = await ctx.db.get(session.deviceId);
  if (!device || device.revokedAt !== undefined || device.deviceType === "kds") throw unauthenticated();
  if (isOperatorSessionExpired(session, device.deviceType, Date.now())) throw unauthenticated();
  if (device.venueId !== scope.venueId) throw notFound("Cet établissement");
  const { venue, organization } = await loadActiveVenue(ctx, scope.venueId);
  const member = await ctx.db.get(session.memberId);
  if (!member || member.organizationId !== organization._id || member.status !== "active") throw unauthenticated();
  if (device.deviceType === "personal" && device.memberId !== member._id) throw unauthenticated();
  const credential = await ctx.db
    .query("staffCredentials")
    .withIndex("by_member", (q) => q.eq("memberId", member._id))
    .unique();
  if (!credential || credential.status !== "active") throw unauthenticated();
  const isOwner = member.userId !== undefined && member.userId === organization.ownerUserId;
  if (!(await memberCoversVenue(ctx, member, venue, isOwner))) throw unauthenticated();
  const { effective } = await resolvePermissionSets(ctx, { organization, member, isOwner }, venue);
  const permissions = new Set([...effective].filter((p) => PIN_PERMISSIONS.has(p)));
  if (!permissions.has(permission)) throw forbidden();
  return {
    venue,
    organization,
    permissions,
    via: "pin",
    member,
    user: null,
    device,
    operatorSession: session,
    event: { type: "staff", memberId: member._id, deviceId: device._id, operatorSessionId: session._id },
    audit: { actorType: "staff", actorMemberId: member._id, actorDeviceId: device._id },
  };
}

/** L'activité ne s'écrit pas à chaque geste : une fois par tranche de 15 secondes suffit. */
const ACTIVITY_WRITE_MS = 15_000;

/**
 * La garde des MUTATIONS du service : celle des lectures, plus l'horodatage d'activité de la
 * session d'opérateur — c'est lui que l'inactivité mesure.
 *
 * `actingMemberId` : la personne qui a fait le geste, telle que l'appareil l'a noté en le
 * mettant en file. Sur une tablette partagée, un geste d'Awa resté en file ne doit jamais
 * partir sous le nom de Koffi, qui a déverrouillé après elle — pas même si le client Convex
 * le renvoie de lui-même à la reconnexion (D-062). Refusé, il attend qu'Awa revienne.
 */
export async function requireServiceMutation(
  ctx: MutationCtx,
  permission: Permission,
  scope: { venueId: Id<"venues">; actingMemberId?: Id<"organizationMembers"> },
): Promise<ServiceActor> {
  const actor = await requireServiceActor(ctx, permission, scope);
  if (scope.actingMemberId !== undefined && actor.member?._id !== scope.actingMemberId) {
    throw conflict("Ce geste a été saisi par une autre personne : il partira quand elle s'identifiera de nouveau.");
  }
  const now = Date.now();
  if (actor.operatorSession && now - actor.operatorSession.lastActivityAt > ACTIVITY_WRITE_MS) {
    await ctx.db.patch(actor.operatorSession._id, { lastActivityAt: now });
  }
  if (actor.device && (actor.device.lastSeenAt === undefined || now - actor.device.lastSeenAt > ACTIVITY_WRITE_MS)) {
    await ctx.db.patch(actor.device._id, { lastSeenAt: now });
  }
  return actor;
}
