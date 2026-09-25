// Fixture : une fonction correctement gardée et une exemption explicite, acceptées.
export const correcte = query({
  args: { venueId: v.id("venues") },
  handler: async (ctx, args) => {
    const actor = await requirePermission(ctx, "venue.read", { venueId: args.venueId });
    return ctx.db.get(actor.venue._id);
  },
});

export const exemptee = query({
  args: { token: v.string() },
  handler: async (ctx, args) => {
    // garde : jeton — le jeton est la portée.
    return ctx.db.query("x").first();
  },
});
