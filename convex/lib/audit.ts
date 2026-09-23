/**
 * Journal d'audit — Joliba
 *
 * Append-only. On y écrit QUI a fait QUOI, OÙ, sur QUOI, avant/après, et pourquoi quand
 * un motif est exigé. On n'y écrit JAMAIS de secret, de jeton, de code OTP ni de donnée
 * de paiement (SECURITY.md) : `before`/`after` ne reçoivent que des champs choisis.
 */

import type { Id } from "../_generated/dataModel";
import type { MutationCtx } from "./guards";

export type AuditEntry = {
  organizationId: Id<"organizations">;
  venueId?: Id<"venues">;
  /** Un compte ; absent quand le geste vient d'un PIN ou d'un appareil (D-060). */
  actorUserId?: Id<"users">;
  actorMemberId?: Id<"organizationMembers">;
  actorDeviceId?: Id<"trustedDevices">;
  actorType?: "staff" | "device";
  action: string;
  resourceType: string;
  resourceId?: string;
  before?: unknown;
  after?: unknown;
  reason?: string;
};

export async function writeAudit(ctx: MutationCtx, entry: AuditEntry): Promise<void> {
  await ctx.db.insert("auditLogs", {
    organizationId: entry.organizationId,
    ...(entry.venueId !== undefined ? { venueId: entry.venueId } : {}),
    actorType: entry.actorType ?? "staff",
    ...(entry.actorUserId !== undefined ? { actorUserId: entry.actorUserId } : {}),
    ...(entry.actorMemberId !== undefined ? { actorMemberId: entry.actorMemberId } : {}),
    ...(entry.actorDeviceId !== undefined ? { actorDeviceId: entry.actorDeviceId } : {}),
    action: entry.action,
    resourceType: entry.resourceType,
    ...(entry.resourceId !== undefined ? { resourceId: entry.resourceId } : {}),
    ...(entry.before !== undefined ? { before: entry.before } : {}),
    ...(entry.after !== undefined ? { after: entry.after } : {}),
    ...(entry.reason !== undefined ? { reason: entry.reason } : {}),
    source: "web",
    at: Date.now(),
  });
}
