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

// Une garde en commentaire n'est pas une garde.
export const gardeCommentee = query({
  args: {},
  handler: async (ctx) => {
    // await requireUser(ctx);
    return ctx.db.query("x").first();
  },
});

// Le nom d'une garde dans une chaîne non plus.
export const gardeDansUneChaine = query({
  args: {},
  handler: async (ctx) => {
    const note = "requireUser(ctx) sera ajouté plus tard";
    return { note, first: await ctx.db.query("x").first() };
  },
});

// garde : une exemption hors du handler ne vaut rien.
export const exemptionMalPlacee = query({
  args: {},
  handler: async (ctx) => {
    return ctx.db.query("x").first();
  },
});
