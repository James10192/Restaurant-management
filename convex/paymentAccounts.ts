/**
 * Le compte du restaurant chez son fournisseur de paiement en ligne — Joliba (D-116, D-117, D-128)
 *
 * Le restaurant colle sa clé d'API Wave et le secret de son webhook ; nous les chiffrons, et
 * aucune requête ne les rend jamais — l'écran n'en voit que les quatre derniers caractères.
 *
 * Un compte ne s'active qu'une fois PROUVÉ : la clé répond (`testConnection`), et Wave a joint
 * notre adresse avec un événement de test signé par le bon secret. Sans cette preuve, le premier
 * client qui paie découvrirait l'erreur de saisie à la place du gérant.
 *
 * Tout passe par `payment.provider.manage` : jamais sous PIN, journalisé (D-117).
 */

import { v } from "convex/values";
import { action, internalMutation, internalQuery, mutation, query } from "./_generated/server";
import { internal } from "./_generated/api";
import type { Doc, Id } from "./_generated/dataModel";
import { writeAudit } from "./lib/audit";
import { raiseAlert } from "./lib/intents";
import { conflict, invalid, notFound } from "./lib/errors";
import { requirePermission, type ReadCtx } from "./lib/guards";
import { logEvent } from "./lib/log";
import { createProvider, PROVIDER_LABEL } from "./lib/providers/registry";
import { ProviderError, type OnlinePaymentProvider } from "./lib/providers/types";
import { lastFour, openSecret, sealSecret, secretBoxConfigured, type SecretField } from "./lib/secretBox";
import { settingsOf } from "./lib/service";
import { generateToken } from "./lib/tokens";

/** Le seul pays où Wave Checkout est branché en T5 (D-109). */
const WAVE_COUNTRIES = ["CI"];

export async function accountOfVenue(ctx: ReadCtx, venueId: Id<"venues">): Promise<Doc<"paymentProviderAccounts"> | null> {
  return ctx.db
    .query("paymentProviderAccounts")
    .withIndex("by_venue", (q) => q.eq("venueId", venueId))
    .first();
}

/** Le compte actif d'un établissement, s'il accepte le paiement en ligne. */
export async function activeAccountOf(ctx: ReadCtx, venueId: Id<"venues">): Promise<Doc<"paymentProviderAccounts"> | null> {
  const account = await accountOfVenue(ctx, venueId);
  return account && account.status === "active" && account.secrets.apiKey && account.secrets.webhookSecret ? account : null;
}

function webhookUrl(account: Doc<"paymentProviderAccounts">): string | null {
  const site = process.env.CONVEX_SITE_URL;
  return site ? `${site.replace(/\/+$/, "")}/webhooks/wave/${account.webhookPathId}` : null;
}

/** Ce que l'écran de réglage voit. AUCUN secret : quatre caractères, des dates, des booléens. */
export const forVenue = query({
  args: { venueId: v.id("venues") },
  handler: async (ctx, args) => {
    const actor = await requirePermission(ctx, "payment.provider.manage", { venueId: args.venueId });
    const account = await accountOfVenue(ctx, actor.venue._id);
    const country = actor.venue.countryCode;
    const now = Date.now();
    return {
      provider: "wave_ci" as const,
      providerLabel: PROVIDER_LABEL.wave_ci,
      available: WAVE_COUNTRIES.includes(country) && actor.venue.currency === "XOF",
      encryptionReady: secretBoxConfigured(),
      account: account
        ? {
            status: account.status,
            apiKeyLast4: account.apiKeyLast4 ?? null,
            webhookSecretLast4: account.webhookSecretLast4 ?? null,
            hasPreviousWebhookSecret: account.secrets.webhookSecretPrevious !== undefined,
            hasRequestSigningSecret: account.secrets.requestSigningSecret !== undefined,
            balanceAccess: account.balanceAccess ?? null,
            lastConnectionTestAt: account.lastConnectionTestAt ?? null,
            lastConnectionOk: account.lastConnectionOk ?? null,
            lastTestEventAt: account.lastTestEventAt ?? null,
            recentSignatureFailures:
              account.signatureFailures && now - account.signatureFailures.windowStart < 60 * 60 * 1000 ? account.signatureFailures.count : 0,
            lastSignatureFailureAt: account.lastSignatureFailureAt ?? null,
            webhookUrl: webhookUrl(account),
            configuredAt: account.configuredAt,
          }
        : null,
    };
  },
});

/**
 * Enregistrer ou remplacer des secrets. Une ACTION : le chiffrement tire un IV aléatoire, et
 * l'aléa d'une mutation vient d'un générateur graine (voir `lib/secretBox.ts`). La garde est dans
 * `ensureAccount`, qui s'exécute avec l'identité de l'appelant et refuse avant tout chiffrement.
 */
export const saveSecrets = action({
  args: {
    venueId: v.id("venues"),
    apiKey: v.optional(v.string()),
    webhookSecret: v.optional(v.string()),
    requestSigningSecret: v.optional(v.string()),
  },
  handler: async (ctx, args): Promise<{ ok: true }> => {
    // garde : déléguée à `ensureAccount` puis `storeSecrets`, qui s'exécutent avec l'identité de
    // l'appelant et exigent `payment.provider.manage` avant tout chiffrement ni écriture.
    const fields: [SecretField, string][] = [];
    const clean = (value: string | undefined, what: string, pattern: RegExp) => {
      if (value === undefined) return undefined;
      const s = value.trim();
      if (!pattern.test(s)) throw invalid(`${what} n'a pas la forme attendue.`);
      return s;
    };
    const apiKey = clean(args.apiKey, "La clé d'API", /^wave_[A-Za-z0-9_-]{16,200}$/);
    const webhookSecret = clean(args.webhookSecret, "Le secret du webhook", /^wave_[A-Za-z0-9_-]{16,200}$/);
    const signing = clean(args.requestSigningSecret, "Le secret de signature", /^[A-Za-z0-9_-]{16,200}$/);
    if (apiKey) fields.push(["apiKey", apiKey]);
    if (webhookSecret) fields.push(["webhookSecret", webhookSecret]);
    if (signing) fields.push(["requestSigningSecret", signing]);
    if (fields.length === 0) throw invalid("Rien à enregistrer.");
    if (!secretBoxConfigured()) throw conflict("Le chiffrement des secrets n'est pas réglé sur ce déploiement (PAYMENT_SECRETS_KEY).");
    const accountId: Id<"paymentProviderAccounts"> = await ctx.runMutation(internal.paymentAccounts.ensureAccount, { venueId: args.venueId });
    const sealed: { field: SecretField; value: string; last4: string }[] = [];
    for (const [field, value] of fields) {
      sealed.push({ field, value: await sealSecret(value, { accountId, field }), last4: lastFour(value) });
    }
    await ctx.runMutation(internal.paymentAccounts.storeSecrets, { venueId: args.venueId, accountId, sealed });
    return { ok: true };
  },
});

export const ensureAccount = internalMutation({
  args: { venueId: v.id("venues") },
  handler: async (ctx, args): Promise<Id<"paymentProviderAccounts">> => {
    const actor = await requirePermission(ctx, "payment.provider.manage", { venueId: args.venueId });
    if (!WAVE_COUNTRIES.includes(actor.venue.countryCode) || actor.venue.currency !== "XOF") {
      throw conflict("Le paiement en ligne Wave n'est proposé qu'aux établissements de Côte d'Ivoire, en francs CFA.");
    }
    const existing = await accountOfVenue(ctx, actor.venue._id);
    if (existing) return existing._id;
    const now = Date.now();
    return ctx.db.insert("paymentProviderAccounts", {
      venueId: actor.venue._id,
      providerKey: "wave_ci",
      country: actor.venue.countryCode,
      status: "draft",
      webhookPathId: generateToken(32),
      secrets: {},
      configuredByMemberId: actor.member._id,
      configuredAt: now,
      updatedAt: now,
    });
  },
});

export const storeSecrets = internalMutation({
  args: {
    venueId: v.id("venues"),
    accountId: v.id("paymentProviderAccounts"),
    sealed: v.array(v.object({ field: v.union(v.literal("apiKey"), v.literal("webhookSecret"), v.literal("webhookSecretPrevious"), v.literal("requestSigningSecret")), value: v.string(), last4: v.string() })),
  },
  handler: async (ctx, args) => {
    const actor = await requirePermission(ctx, "payment.provider.manage", { venueId: args.venueId });
    const account = await ctx.db.get(args.accountId);
    if (!account || account.venueId !== actor.venue._id) throw notFound("Ce compte");
    const secrets = { ...account.secrets };
    const patch: Partial<Doc<"paymentProviderAccounts">> = {};
    const changed: string[] = [];
    for (const s of args.sealed) {
      if (s.field === "webhookSecret") {
        // Rotation : l'ancien secret reste accepté jusqu'à ce qu'on le retire (D-117).
        if (secrets.webhookSecret) secrets.webhookSecretPrevious = secrets.webhookSecret;
        secrets.webhookSecret = s.value;
        patch.webhookSecretLast4 = s.last4;
        // Un nouveau secret doit être prouvé de nouveau par un événement de test.
        patch.lastTestEventAt = undefined;
      } else if (s.field === "apiKey") {
        secrets.apiKey = s.value;
        patch.apiKeyLast4 = s.last4;
        patch.lastConnectionOk = undefined;
        patch.lastConnectionTestAt = undefined;
        patch.balanceAccess = undefined;
      } else if (s.field === "requestSigningSecret") {
        secrets.requestSigningSecret = s.value;
      }
      changed.push(s.field);
    }
    const now = Date.now();
    await ctx.db.patch(account._id, {
      ...patch,
      secrets,
      configuredByMemberId: actor.member._id,
      updatedAt: now,
      // Des secrets neufs ne sont pas prouvés : un compte actif repasse en brouillon.
      ...(account.status === "active" ? { status: "draft" as const } : {}),
    });
    await writeAudit(ctx, {
      organizationId: actor.organization._id,
      venueId: actor.venue._id,
      actorUserId: actor.user._id,
      actorMemberId: actor.member._id,
      action: "payment.provider.secrets",
      resourceType: "paymentProviderAccount",
      resourceId: account._id,
      // Les noms des champs changés, JAMAIS leur valeur, ni même leurs derniers caractères.
      after: { changed },
    });
  },
});

/** Les secrets chiffrés d'un compte, pour une action interne. Jamais exposé au client. */
export const sealedSecrets = internalQuery({
  args: { accountId: v.id("paymentProviderAccounts") },
  handler: async (ctx, args) => {
    const account = await ctx.db.get(args.accountId);
    if (!account) return null;
    return { accountId: account._id, venueId: account.venueId, providerKey: account.providerKey, status: account.status, secrets: account.secrets };
  },
});

/** Ouvre les secrets et construit l'adaptateur. Réservé aux actions (D-117). */
export async function providerFor(sealed: { accountId: Id<"paymentProviderAccounts">; providerKey: "wave_ci"; secrets: Doc<"paymentProviderAccounts">["secrets"] }): Promise<OnlinePaymentProvider> {
  if (!sealed.secrets.apiKey) throw new ProviderError("unauthorized", null, "no-api-key");
  const apiKey = await openSecret(sealed.secrets.apiKey, { accountId: sealed.accountId, field: "apiKey" });
  const requestSigningSecret = sealed.secrets.requestSigningSecret
    ? await openSecret(sealed.secrets.requestSigningSecret, { accountId: sealed.accountId, field: "requestSigningSecret" })
    : undefined;
  return createProvider(sealed.providerKey, { apiKey, ...(requestSigningSecret ? { requestSigningSecret } : {}) });
}

/** « Tester la connexion » : la clé répond-elle, a-t-elle le droit « Solde » ? */
export const testConnection = action({
  args: { venueId: v.id("venues") },
  handler: async (ctx, args): Promise<{ ok: boolean; balanceAccess: boolean | null; error: string | null }> => {
    // garde : déléguée à `ensureAccount`, qui exige `payment.provider.manage` avant tout appel à Wave.
    const accountId: Id<"paymentProviderAccounts"> = await ctx.runMutation(internal.paymentAccounts.ensureAccount, { venueId: args.venueId });
    const sealed = await ctx.runQuery(internal.paymentAccounts.sealedSecrets, { accountId });
    if (!sealed?.secrets.apiKey) throw conflict("Collez d'abord la clé d'API.");
    let result: { ok: boolean; balanceAccess: boolean | null; error: string | null };
    try {
      const provider = await providerFor(sealed);
      const { balanceAccess } = await provider.testConnection();
      result = { ok: true, balanceAccess, error: null };
    } catch (error) {
      const code = error instanceof ProviderError ? error.code : "unreachable";
      logEvent("warn", "payment.provider_test_failed", { operation: "payment.provider.test", status: error instanceof ProviderError ? (error.status ?? 0) : 0 });
      result = { ok: false, balanceAccess: null, error: code };
    }
    await ctx.runMutation(internal.paymentAccounts.recordConnectionTest, { venueId: args.venueId, accountId, ...result });
    return result;
  },
});

export const recordConnectionTest = internalMutation({
  args: { venueId: v.id("venues"), accountId: v.id("paymentProviderAccounts"), ok: v.boolean(), balanceAccess: v.union(v.boolean(), v.null()), error: v.union(v.string(), v.null()) },
  handler: async (ctx, args) => {
    const actor = await requirePermission(ctx, "payment.provider.manage", { venueId: args.venueId });
    const account = await ctx.db.get(args.accountId);
    if (!account || account.venueId !== actor.venue._id) throw notFound("Ce compte");
    await ctx.db.patch(account._id, {
      lastConnectionTestAt: Date.now(),
      lastConnectionOk: args.ok,
      ...(args.balanceAccess !== null ? { balanceAccess: args.balanceAccess } : {}),
      updatedAt: Date.now(),
    });
  },
});

/** Proposer le paiement en ligne aux clients. Seulement un compte PROUVÉ (D-128). */
export const activate = mutation({
  args: { venueId: v.id("venues") },
  handler: async (ctx, args) => {
    const actor = await requirePermission(ctx, "payment.provider.manage", { venueId: args.venueId });
    const account = await accountOfVenue(ctx, actor.venue._id);
    if (!account) throw conflict("Configurez d'abord le compte Wave.");
    if (!account.secrets.apiKey || !account.secrets.webhookSecret) throw conflict("Il manque la clé d'API ou le secret du webhook.");
    if (account.lastConnectionOk !== true) throw conflict("Testez d'abord la connexion : la clé doit répondre.");
    if (account.lastTestEventAt === undefined) {
      throw conflict("Envoyez l'événement de test depuis le portail Wave : il prouve que Wave joint Joliba avec le bon secret.");
    }
    const settings = await settingsOf(ctx, actor.venue._id);
    const others = settings.payments.onlineProviders.filter((p) => p.providerKey !== "wave_ci");
    await ctx.db.patch(settings._id, {
      payments: { ...settings.payments, onlineProviders: [...others, { providerKey: "wave_ci", isEnabled: true, accountId: account._id, sortOrder: 0 }] },
    });
    await ctx.db.patch(account._id, { status: "active", updatedAt: Date.now() });
    await writeAudit(ctx, {
      organizationId: actor.organization._id,
      venueId: actor.venue._id,
      actorUserId: actor.user._id,
      actorMemberId: actor.member._id,
      action: "payment.provider.activate",
      resourceType: "paymentProviderAccount",
      resourceId: account._id,
    });
  },
});

/** Couper le paiement en ligne. Les intentions déjà ouvertes vont à leur terme. */
export const disable = mutation({
  args: { venueId: v.id("venues") },
  handler: async (ctx, args) => {
    const actor = await requirePermission(ctx, "payment.provider.manage", { venueId: args.venueId });
    const account = await accountOfVenue(ctx, actor.venue._id);
    if (!account || account.status === "disabled") return;
    const settings = await settingsOf(ctx, actor.venue._id);
    await ctx.db.patch(settings._id, {
      payments: { ...settings.payments, onlineProviders: settings.payments.onlineProviders.map((p) => (p.providerKey === "wave_ci" ? { ...p, isEnabled: false } : p)) },
    });
    await ctx.db.patch(account._id, { status: "disabled", updatedAt: Date.now() });
    await writeAudit(ctx, {
      organizationId: actor.organization._id,
      venueId: actor.venue._id,
      actorUserId: actor.user._id,
      actorMemberId: actor.member._id,
      action: "payment.provider.disable",
      resourceType: "paymentProviderAccount",
      resourceId: account._id,
    });
  },
});

/** La rotation d'un secret de webhook se termine : l'ancien n'est plus accepté. */
export const dropPreviousWebhookSecret = mutation({
  args: { venueId: v.id("venues") },
  handler: async (ctx, args) => {
    const actor = await requirePermission(ctx, "payment.provider.manage", { venueId: args.venueId });
    const account = await accountOfVenue(ctx, actor.venue._id);
    if (!account?.secrets.webhookSecretPrevious) return;
    const { webhookSecretPrevious: _drop, ...secrets } = account.secrets;
    await ctx.db.patch(account._id, { secrets, updatedAt: Date.now() });
    await writeAudit(ctx, {
      organizationId: actor.organization._id,
      venueId: actor.venue._id,
      actorUserId: actor.user._id,
      actorMemberId: actor.member._id,
      action: "payment.provider.secrets",
      resourceType: "paymentProviderAccount",
      resourceId: account._id,
      after: { changed: ["webhookSecretPrevious:removed"] },
    });
  },
});

/** L'adresse du webhook a fuité : on en tire une autre, qu'il faut recoller chez Wave. */
export const rotateWebhookPath = mutation({
  args: { venueId: v.id("venues") },
  handler: async (ctx, args) => {
    const actor = await requirePermission(ctx, "payment.provider.manage", { venueId: args.venueId });
    const account = await accountOfVenue(ctx, actor.venue._id);
    if (!account) throw notFound("Ce compte");
    await ctx.db.patch(account._id, {
      webhookPathId: generateToken(32),
      lastTestEventAt: undefined,
      updatedAt: Date.now(),
      ...(account.status === "active" ? { status: "draft" as const } : {}),
    });
    await writeAudit(ctx, {
      organizationId: actor.organization._id,
      venueId: actor.venue._id,
      actorUserId: actor.user._id,
      actorMemberId: actor.member._id,
      action: "payment.provider.webhook_path",
      resourceType: "paymentProviderAccount",
      resourceId: account._id,
    });
  },
});

/* ────────────────────────────────────────────────────────────────────────────
 * Webhook : le compte désigné par l'adresse
 * ──────────────────────────────────────────────────────────────────────────── */

export const forWebhook = internalQuery({
  args: { webhookPathId: v.string() },
  handler: async (ctx, args) => {
    if (!/^[A-Za-z0-9_-]{40,64}$/.test(args.webhookPathId)) return null;
    const account = await ctx.db
      .query("paymentProviderAccounts")
      .withIndex("by_webhook_path", (q) => q.eq("webhookPathId", args.webhookPathId))
      .unique();
    if (!account || account.status === "disabled") return null;
    return { accountId: account._id, venueId: account.venueId, providerKey: account.providerKey, webhookSecret: account.secrets.webhookSecret ?? null, webhookSecretPrevious: account.secrets.webhookSecretPrevious ?? null };
  },
});

/** Au-delà de 5 échecs dans l'heure, le secret collé est probablement faux : l'écran le dit. */
export const noteSignatureFailure = internalMutation({
  args: { accountId: v.id("paymentProviderAccounts") },
  handler: async (ctx, args) => {
    const account = await ctx.db.get(args.accountId);
    if (!account) return;
    const now = Date.now();
    const window = account.signatureFailures && now - account.signatureFailures.windowStart < 60 * 60 * 1000 ? account.signatureFailures : { windowStart: now, count: 0 };
    const count = window.count + 1;
    await ctx.db.patch(account._id, { signatureFailures: { windowStart: window.windowStart, count }, lastSignatureFailureAt: now });
    if (count === 5) {
      await raiseAlert(ctx, {
        venueId: account.venueId,
        kind: "signature_failures",
        severity: "warning",
        message: "Des webhooks Wave arrivent avec une signature refusée : le secret collé dans Joliba n'est probablement pas celui du webhook.",
        dedupeKey: `signature:${account._id}:${window.windowStart}`,
      });
    }
  },
});
