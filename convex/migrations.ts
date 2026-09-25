/**
 * Rattrapages de données après un déploiement — Joliba
 *
 * Les modèles de rôles sont COPIÉS dans chaque organisation à sa création (lib/permissions.ts) :
 * une permission ajoutée plus tard n'atteint pas les rôles déjà créés, sauf le propriétaire (qui
 * les a toutes à la lecture). Ce rattrapage l'ajoute aux rôles NON personnalisés dont le modèle la
 * contient aujourd'hui. À lancer une fois, au déploiement qui introduit la permission :
 *
 *     npx convex run migrations:grantTemplatePermission '{"permission":"feedback.read"}'
 *
 * Il ne retire rien et ne touche pas aux rôles personnalisés. Relancé plus tard, il rendrait la
 * permission à un rôle d'où l'organisation l'aurait ôtée : c'est pourquoi il n'est pas automatique.
 */

import { v } from "convex/values";
import { internalMutation } from "./_generated/server";
import { isPermission, ROLE_TEMPLATES } from "./lib/permissions";

export const grantTemplatePermission = internalMutation({
  args: { permission: v.string() },
  handler: async (ctx, args) => {
    if (!isPermission(args.permission)) throw new Error(`Permission inconnue : ${args.permission}`);
    const templates = Object.entries(ROLE_TEMPLATES)
      .filter(([, t]) => (t.permissions as readonly string[]).includes(args.permission))
      .map(([key]) => key);
    let updated = 0;
    for await (const role of ctx.db.query("roles")) {
      if (role.isCustom || role.archivedAt !== undefined || !templates.includes(role.key)) continue;
      if (role.permissions.includes(args.permission)) continue;
      await ctx.db.patch(role._id, { permissions: [...role.permissions, args.permission] });
      updated++;
    }
    return { updated, templates };
  },
});
