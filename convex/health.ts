/**
 * Point de santé du backend (DEPLOYMENT.md §4 et §6). Interne : exposé seulement par la
 * route HTTP `/health`, qui ne renvoie ni donnée ni détail d'erreur.
 */

import { internalQuery } from "./_generated/server";

export const ping = internalQuery({
  args: {},
  handler: async (ctx) => {
    // Une lecture réelle, la plus légère possible : prouve que la base répond.
    await ctx.db.query("plans").first();
    return true;
  },
});
