/**
 * Profil de l'utilisateur connecté — Joliba
 *
 * Aucune de ces fonctions ne touche une donnée d'organisation : elles ne portent que
 * sur la ligne `users` de l'appelant, résolue depuis son identité.
 */

import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { invalid } from "./lib/errors";
import { getCurrentUser, requireUser } from "./lib/guards";
import { locale } from "./lib/validators";

/** `null` quand personne n'est connecté : l'écran de connexion s'en sert. */
export const me = query({
  args: {},
  handler: async (ctx) => {
    const user = await getCurrentUser(ctx);
    if (!user) return null;
    return { _id: user._id, email: user.email, name: user.name ?? null, locale: user.locale };
  },
});

export const updateProfile = mutation({
  args: { name: v.optional(v.string()), locale: v.optional(locale) },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    const patch: { name?: string; locale?: "fr" | "en" } = {};
    if (args.name !== undefined) {
      const name = args.name.trim();
      if (name.length < 2 || name.length > 80) {
        throw invalid("Le nom doit contenir entre 2 et 80 caractères.");
      }
      patch.name = name;
    }
    if (args.locale !== undefined) patch.locale = args.locale;
    await ctx.db.patch(user._id, patch);
  },
});
