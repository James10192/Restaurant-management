/**
 * Authentification — Joliba
 *
 * Better Auth détient l'IDENTITÉ : comptes, sessions, codes à usage unique, liaison
 * Google. Il ne sait rien des organisations, des établissements ni des rôles : la
 * souveraineté du tenant vit dans nos tables (D-016). Le seul pont entre les deux est
 * `users.authId`, posé par le déclencheur `onCreate` ci-dessous.
 *
 * Deux méthodes de connexion, et pas de mot de passe (PRODUCT.md, SECURITY.md) :
 *  - un code à 6 chiffres envoyé par e-mail. Stocké HACHÉ, valable 10 minutes, trois
 *    essais. Aucun code n'est jamais journalisé ;
 *  - Google, activé seulement si ses secrets sont posés.
 */

import { createClient, type AuthFunctions, type GenericCtx } from "@convex-dev/better-auth";
import { convex } from "@convex-dev/better-auth/plugins";
import { betterAuth } from "better-auth/minimal";
import { APIError } from "better-auth/api";
import { emailOTP } from "better-auth/plugins";
import { components, internal } from "./_generated/api";
import type { DataModel } from "./_generated/dataModel";
import authConfig from "./auth.config";
import { OTP_TTL_SECONDS, otpEmail, sendEmail } from "./lib/email";
import { rateLimiter } from "./lib/rateLimits";

const siteUrl = process.env.SITE_URL ?? "http://localhost:3000";

const authFunctions: AuthFunctions = internal.auth as AuthFunctions;

export const authComponent = createClient<DataModel>(components.betterAuth, {
  authFunctions,
  triggers: {
    user: {
      /**
       * Création du miroir métier. Idempotent : un second appel pour le même compte ne
       * crée pas de doublon. L'utilisateur n'appartient encore à AUCUNE organisation :
       * il en crée une, ou il accepte une invitation (l'acceptation reste explicite,
       * jamais déduite de l'adresse e-mail).
       */
      onCreate: async (ctx, authUser) => {
        const existing = await ctx.db
          .query("users")
          .withIndex("by_auth", (q) => q.eq("authId", authUser._id))
          .unique();
        if (existing) return;
        const name = authUser.name?.trim();
        await ctx.db.insert("users", {
          authId: authUser._id,
          email: authUser.email.toLowerCase(),
          ...(name ? { name } : {}),
          ...(authUser.emailVerified ? { emailVerifiedAt: Date.now() } : {}),
          locale: "fr",
          status: "active",
        });
      },
      onUpdate: async (ctx, newDoc) => {
        const user = await ctx.db
          .query("users")
          .withIndex("by_auth", (q) => q.eq("authId", newDoc._id))
          .unique();
        if (!user) return;
        const email = newDoc.email.toLowerCase();
        const name = newDoc.name?.trim();
        const patch: { email?: string; name?: string; emailVerifiedAt?: number } = {};
        if (email !== user.email) patch.email = email;
        // Une adresse vérifiée plus tard (connexion par code après un compte Google non
        // vérifié) devient vérifiée ici aussi. L'inverse n'arrive pas : on ne « dévérifie » pas.
        if (newDoc.emailVerified && user.emailVerifiedAt === undefined) patch.emailVerifiedAt = Date.now();
        // Un nom saisi dans Joliba n'est pas écrasé par un nom vide venu d'ailleurs.
        if (name && name !== user.name) patch.name = name;
        if (Object.keys(patch).length > 0) await ctx.db.patch(user._id, patch);
      },
    },
  },
});

export const { onCreate, onUpdate, onDelete } = authComponent.triggersApi();

function socialProviders() {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  if (!clientId || !clientSecret) return {};
  return { google: { clientId, clientSecret, prompt: "select_account" as const } };
}

export const createAuth = (ctx: GenericCtx<DataModel>) =>
  betterAuth({
    baseURL: siteUrl,
    database: authComponent.adapter(ctx),
    trustedOrigins: [siteUrl],
    socialProviders: socialProviders(),
    account: {
      // Une personne qui s'est connectée par code puis par Google, avec la MÊME adresse,
      // retrouve le même compte — SEULEMENT si Google atteste que l'adresse est vérifiée.
      // Surtout pas `trustedProviders: ["google"]` : Better Auth lierait alors le compte
      // même sur une adresse NON vérifiée, et quiconque crée un compte Google avec l'adresse
      // d'un gérant prendrait son accès (SECURITY.md M7).
      accountLinking: { enabled: true },
    },
    session: {
      expiresIn: 60 * 60 * 24 * 30,
      updateAge: 60 * 60 * 24,
    },
    // L'IP du client, pour la limite de débit. Sans elle, Better Auth retombe sur UN seul
    // compteur partagé par tous : trois demandes de code par minute bloqueraient toute la
    // plateforme. Vercel pose ces en-têtes et les écrase s'ils viennent du client ; le relais
    // `/api/auth/$` les transmet à Convex tels quels.
    advanced: {
      ipAddress: { ipAddressHeaders: ["x-vercel-forwarded-for", "x-real-ip", "x-forwarded-for"] },
    },
    // Stockage en base : un compteur en mémoire ne survit pas d'une requête à l'autre sur
    // un runtime sans serveur, il ne limiterait rien.
    rateLimit: {
      enabled: true,
      storage: "database",
      customRules: {
        "/email-otp/send-verification-otp": { window: 60, max: 3 },
        "/sign-in/email-otp": { window: 60, max: 10 },
      },
    },
    plugins: [
      emailOTP({
        otpLength: 6,
        expiresIn: OTP_TTL_SECONDS,
        allowedAttempts: 3,
        storeOTP: "hashed",
        // Pas d'inscription séparée : le premier code reçu crée le compte. Le message
        // affiché est le même que l'adresse soit connue ou non.
        disableSignUp: false,
        async sendVerificationOTP({ email, otp }) {
          // Les routes d'authentification s'exécutent dans une action HTTP : `runMutation`
          // y est disponible. Sans lui, pas d'envoi — mieux vaut refuser que ne rien limiter.
          if (!("runMutation" in ctx)) throw new APIError("INTERNAL_SERVER_ERROR");
          const limit = await rateLimiter.limit(ctx, "otpEmail", { key: email.toLowerCase() });
          if (!limit.ok) {
            throw new APIError("TOO_MANY_REQUESTS", {
              message: "Trop de codes demandés pour cette adresse. Réessayez dans quelques minutes.",
            });
          }
          await sendEmail({ to: email, ...otpEmail(otp) });
        },
      }),
      convex({ authConfig }),
    ],
  });
