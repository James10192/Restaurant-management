// Fixture du test de `scripts/check-guards.mjs` : deux fonctions FAUTIVES, que le
// contrôle doit refuser. Ce fichier n'est ni compilé ni déployé.
export const lectureLibre = query({
  args: { venueId: v.id("venues") },
  handler: async (ctx, args) => {
    return ctx.db.get(args.venueId);
  },
});

export const lirePuisVerifier = mutation({
  args: { orderId: v.id("orders") },
  handler: async (ctx, args) => {
    const order = await ctx.db.get(args.orderId);
    await requirePermission(ctx, "order.read", { venueId: order.venueId });
  },
});
