/**
 * Demandes des clients, côté personnel — Joliba
 *
 * « Table 4 appelle un serveur », « Table 7 demande l'addition ». La file la plus ancienne
 * d'abord ; la prendre en charge dit aux collègues que quelqu'un y va, la clore la retire.
 */

import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { getInVenue } from "./lib/catalogAccess";
import { memberName, settingsOf } from "./lib/service";
import { requireServiceActor, requireServiceMutation } from "./lib/serviceActor";

export const open = query({
  args: { venueId: v.id("venues") },
  handler: async (ctx, args) => {
    const actor = await requireServiceActor(ctx, "service_request.read", { venueId: args.venueId });
    const settings = await settingsOf(ctx, actor.venue._id);
    const labels = new Map(settings.serviceRequestTypes.map((t) => [t.key, t.label]));
    const result = [];
    for (const status of ["open", "acknowledged"] as const) {
      const rows = await ctx.db
        .query("serviceRequests")
        .withIndex("by_venue_status_created", (q) => q.eq("venueId", actor.venue._id).eq("status", status))
        .collect();
      for (const r of rows) {
        const table = await ctx.db.get(r.tableId);
        const session = r.tableSessionId ? await ctx.db.get(r.tableSessionId) : null;
        result.push({
          _id: r._id,
          type: r.type,
          label: labels.get(r.type) ?? r.type,
          status: r.status,
          tableNumber: table?.number ?? "?",
          tableOpen: session !== null,
          createdAt: r.createdAt,
          acknowledgedBy: await memberName(ctx, r.acknowledgedByMemberId),
          isMine: actor.member !== null && session?.assignedWaiterMemberId === actor.member._id,
        });
      }
    }
    return {
      requests: result.sort((a, b) => a.createdAt - b.createdAt),
      canHandle: actor.permissions.has("service_request.handle"),
    };
  },
});

/** « J'y vais. » Rejoué ou pris par un collègue entre-temps : sans effet. */
export const acknowledge = mutation({
  args: { venueId: v.id("venues"), requestId: v.id("serviceRequests"), actingMemberId: v.optional(v.id("organizationMembers")), },
  handler: async (ctx, args) => {
    const actor = await requireServiceMutation(ctx, "service_request.handle", { venueId: args.venueId, actingMemberId: args.actingMemberId });
    const request = await getInVenue(ctx, args.requestId, actor.venue._id, "Cette demande");
    if (request.status !== "open") return;
    await ctx.db.patch(request._id, {
      status: "acknowledged",
      acknowledgedAt: Date.now(),
      ...(actor.member ? { acknowledgedByMemberId: actor.member._id } : {}),
    });
  },
});

export const resolve = mutation({
  args: { venueId: v.id("venues"), requestId: v.id("serviceRequests"), actingMemberId: v.optional(v.id("organizationMembers")), },
  handler: async (ctx, args) => {
    const actor = await requireServiceMutation(ctx, "service_request.handle", { venueId: args.venueId, actingMemberId: args.actingMemberId });
    const request = await getInVenue(ctx, args.requestId, actor.venue._id, "Cette demande");
    if (request.status === "resolved" || request.status === "cancelled") return;
    await ctx.db.patch(request._id, {
      status: "resolved",
      resolvedAt: Date.now(),
      ...(actor.member ? { resolvedByMemberId: actor.member._id } : {}),
    });
  },
});
