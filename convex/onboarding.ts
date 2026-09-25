/**
 * Mise en service — Joliba (INFORMATION_ARCHITECTURE §5.1, D-176, D-177)
 *
 * La progression se DÉRIVE : chaque étape se lit sur la donnée qui la prouve (un produit actif,
 * une carte publiée, une table, un QR déjà scanné, un collègue). Dépublier la carte fait repasser
 * l'étape « à faire » sans que personne ait à le dire. Ne se stockent que la confirmation des
 * modes de service et les étapes sautées (`venues.onboarding`).
 *
 * `funnel` mesure la porte de sortie de T7 — « un restaurant s'installe seul » — sur les seules
 * données en base. Les aides données par WhatsApp n'y sont pas : elles se tiennent à la main.
 */

import { v } from "convex/values";
import { internalQuery, mutation, query } from "./_generated/server";
import type { Doc, Id } from "./_generated/dataModel";
import { writeAudit } from "./lib/audit";
import { invalid } from "./lib/errors";
import {
  memberCoversVenue,
  requirePermission,
  requireVenueAccess,
  resolvePermissions,
  resolvePermissionSets,
  type ReadCtx,
} from "./lib/guards";
import {
  CONFIRMABLE_STEPS,
  ONBOARDING_STEPS,
  onboardingStep,
  SKIPPABLE_STEPS,
  STEP_META,
  type OnboardingStep,
} from "./lib/onboarding";
import type { Permission } from "./lib/permissions";

/** Sans premier paiement, l'entonnoir ne lit les actes du support que sur cette fenêtre. */
const SUPPORT_WINDOW_MS = 30 * 24 * 60 * 60 * 1000;

/** Le nombre de noms montrés sous une étape grisée : au-delà, « … et 2 autres ». */
const MAX_HOLDERS = 3;

/** Ce que les données prouvent, étape par étape. */
async function derivedDone(ctx: ReadCtx, venue: Doc<"venues">): Promise<Record<OnboardingStep, boolean>> {
  const venueId = venue._id;
  const product = await ctx.db
    .query("products")
    .withIndex("by_venue_active", (q) => q.eq("venueId", venueId).eq("isActive", true))
    .first();
  const publication = await ctx.db
    .query("menuPublications")
    .withIndex("by_venue_current", (q) => q.eq("venueId", venueId).eq("isCurrent", true))
    .first();
  let table = false;
  for await (const t of ctx.db.query("restaurantTables").withIndex("by_venue_number", (q) => q.eq("venueId", venueId))) {
    if (t.isActive) {
      table = true;
      break;
    }
  }
  // L'impression d'un QR ne laisse aucune trace (`window.print()`) : le premier scan, lui, prouve
  // que le QR est collé et qu'il marche.
  let scanned = false;
  for await (const code of ctx.db.query("tableQrCodes").withIndex("by_venue_status", (q) => q.eq("venueId", venueId))) {
    if (code.lastScannedAt !== undefined) {
      scanned = true;
      break;
    }
  }
  return {
    identity: true,
    service: venue.onboarding?.confirmed.includes("service") ?? false,
    menu: product !== null,
    publish: publication !== null,
    tables: table,
    qr: scanned,
    team: await hasColleague(ctx, venue),
  };
}

/**
 * Un collègue DANS CET ÉTABLISSEMENT : une invitation en cours qui le couvre (liste vide = toute
 * l'organisation), ou deux membres actifs qui y travaillent. Un collègue parti rouvre l'étape —
 * c'est pourquoi une invitation acceptée ne compte pas : le membre qu'elle a créé compte à sa place.
 * Une invitation dont l'échéance est passée ne compte plus, même si rien ne l'a marquée `expired`.
 */
async function hasColleague(ctx: ReadCtx, venue: Doc<"venues">): Promise<boolean> {
  const organizationId = venue.organizationId;
  const now = Date.now();
  for await (const invitation of ctx.db
    .query("organizationInvitations")
    .withIndex("by_org_status", (q) => q.eq("organizationId", organizationId).eq("status", "pending"))) {
    const covers = invitation.venueIds.length === 0 || invitation.venueIds.includes(venue._id);
    if (covers && invitation.expiresAt > now) return true;
  }
  const organization = await ctx.db.get(organizationId);
  let working = 0;
  for await (const member of ctx.db
    .query("organizationMembers")
    .withIndex("by_org_status", (q) => q.eq("organizationId", organizationId).eq("status", "active"))) {
    const isOwner = member.userId !== undefined && organization?.ownerUserId === member.userId;
    if (await memberCoversVenue(ctx, member, venue, isOwner)) working++;
    if (working >= 2) return true;
  }
  return false;
}

/**
 * Qui, dans l'établissement, détient chacune de ces permissions : les noms à montrer sous une
 * étape grisée. Un restaurant compte quelques membres ; la résolution se fait une fois par membre.
 */
async function holdersOf(
  ctx: ReadCtx,
  venue: Doc<"venues">,
  organization: Doc<"organizations">,
  permissions: readonly Permission[],
): Promise<Map<Permission, string[]>> {
  const holders = new Map<Permission, string[]>(permissions.map((p) => [p, []]));
  if (permissions.length === 0) return holders;
  for await (const member of ctx.db
    .query("organizationMembers")
    .withIndex("by_org_status", (q) => q.eq("organizationId", organization._id).eq("status", "active"))) {
    // Un employé sous PIN seul n'a pas de compte : il ne configure rien (D-060).
    if (member.userId === undefined) continue;
    const isOwner = organization.ownerUserId === member.userId;
    // Sans affectation qui couvre l'établissement, les droits résolus sont vides : pas de filtre à part.
    const { effective } = await resolvePermissionSets(ctx, { organization, member, isOwner }, venue);
    if (!permissions.some((p) => effective.has(p))) continue;
    const user = await ctx.db.get(member.userId);
    // Le nom seul : l'e-mail d'un responsable ne se montre pas à qui n'a pas `team.read`.
    const name = user?.name ?? "Un membre";
    for (const p of permissions) if (effective.has(p)) holders.get(p)!.push(name);
  }
  return holders;
}

export type StepState = "done" | "skipped" | "todo";

export const progress = query({
  args: { venueId: v.id("venues") },
  handler: async (ctx, args) => {
    // Pas `venue.read` : l'accueil de tout membre s'y abonne, et un rôle personnalisé peut ne pas
    // l'avoir. Qui ne peut faire aucune étape reçoit `null`, jamais une erreur.
    const actor = await requireVenueAccess(ctx, args.venueId);
    const { venue } = actor;
    const permissions = await resolvePermissions(ctx, actor, venue);
    const allowed = (s: OnboardingStep) => permissions.has(STEP_META[s].permission);
    if (!ONBOARDING_STEPS.some(allowed)) return null;

    const done = await derivedDone(ctx, venue);
    const skipped = new Set(venue.onboarding?.skipped ?? []);
    const denied = ONBOARDING_STEPS.filter((s) => !allowed(s) && !done[s]).map((s) => STEP_META[s].permission);
    const holders = await holdersOf(ctx, venue, actor.organization, [...new Set(denied)]);

    const steps = ONBOARDING_STEPS.map((key) => {
      const state: StepState = done[key] ? "done" : skipped.has(key) ? "skipped" : "todo";
      const names = allowed(key) ? [] : (holders.get(STEP_META[key].permission) ?? []);
      return {
        key,
        state,
        allowed: allowed(key),
        whoCan: names.slice(0, MAX_HOLDERS),
        othersCount: Math.max(0, names.length - MAX_HOLDERS),
      };
    });
    const next = steps.find((s) => s.state === "todo" && s.allowed)?.key ?? null;
    return {
      venueName: venue.name,
      doneCount: steps.filter((s) => s.state === "done").length,
      total: steps.length,
      // « Terminé » : plus rien à faire. Une étape sautée l'est, elle ne compte pas comme faite.
      complete: steps.every((s) => s.state !== "todo"),
      next,
      steps,
    };
  },
});

/** Confirmer une étape qu'aucune donnée ne prouve : aujourd'hui, les modes de service. */
export const confirmStep = mutation({
  args: { venueId: v.id("venues"), step: onboardingStep },
  handler: async (ctx, args) => {
    if (!CONFIRMABLE_STEPS.includes(args.step)) throw invalid("Cette étape se coche d'elle-même quand elle est faite.");
    const actor = await requirePermission(ctx, STEP_META[args.step].permission, { venueId: args.venueId });
    const current = actor.venue.onboarding ?? { confirmed: [], skipped: [] };
    if (current.confirmed.includes(args.step)) return;
    await ctx.db.patch(actor.venue._id, {
      onboarding: { confirmed: [...current.confirmed, args.step], skipped: current.skipped.filter((s) => s !== args.step) },
    });
    await auditStep(ctx, actor, "venue.onboarding.confirm", args.step);
  },
});

/** Sauter une étape, ou la reprendre. Rien n'est bloquant (§5.1) ; sauter se défait. */
export const skipStep = mutation({
  args: { venueId: v.id("venues"), step: onboardingStep, skipped: v.boolean() },
  handler: async (ctx, args) => {
    if (!SKIPPABLE_STEPS.includes(args.step)) throw invalid("Cette étape ne se saute pas.");
    const actor = await requirePermission(ctx, STEP_META[args.step].permission, { venueId: args.venueId });
    const current = actor.venue.onboarding ?? { confirmed: [], skipped: [] };
    if (current.skipped.includes(args.step) === args.skipped) return;
    const skipped = args.skipped ? [...current.skipped, args.step] : current.skipped.filter((s) => s !== args.step);
    await ctx.db.patch(actor.venue._id, { onboarding: { confirmed: current.confirmed, skipped } });
    await auditStep(ctx, actor, args.skipped ? "venue.onboarding.skip" : "venue.onboarding.resume", args.step);
  },
});

/**
 * Le restaurateur a demandé de l'aide. Tracé seulement : c'est la moitié mesurable de « sans
 * assistance » (D-177). L'autre moitié — les conversations WhatsApp — se tient à la main.
 */
export const requestHelp = mutation({
  args: { venueId: v.id("venues") },
  handler: async (ctx, args) => {
    const actor = await requirePermission(ctx, "venue.read", { venueId: args.venueId });
    await auditStep(ctx, actor, "onboarding.help_requested", null);
  },
});

async function auditStep(
  ctx: Parameters<typeof writeAudit>[0],
  actor: { organization: Doc<"organizations">; venue: Doc<"venues">; user: Doc<"users">; member: Doc<"organizationMembers"> },
  action: string,
  step: OnboardingStep | null,
) {
  await writeAudit(ctx, {
    organizationId: actor.organization._id,
    venueId: actor.venue._id,
    actorUserId: actor.user._id,
    actorMemberId: actor.member._id,
    action,
    resourceType: "venueOnboarding",
    resourceId: actor.venue._id,
    ...(step ? { after: { step } } : {}),
  });
}

/* ────────────────────────────────────────────────────────────────────────────
 * Mesure de la porte de sortie de T7 (D-177)
 * ──────────────────────────────────────────────────────────────────────────── */

/**
 * Pour chaque établissement réel : l'heure de chaque jalon, le premier paiement réel encaissé —
 * la définition opérationnelle de « installé » — et ce qui s'est passé AVANT lui : demandes
 * d'aide, interventions du support (`auditLogs.source = "support"`).
 *
 *     npx convex run onboarding:funnel
 *
 * Lecture interne, jamais exposée. Elle parcourt toutes les organisations : un outil de pilotage,
 * pas un écran.
 */
export const funnel = internalQuery({
  args: { cursor: v.optional(v.union(v.string(), v.null())) },
  handler: async (ctx, args) => {
    // Par pages de dix organisations : `npx convex run onboarding:funnel '{"cursor":"…"}'` pour la suite.
    const page = await ctx.db.query("organizations").paginate({ numItems: 10, cursor: args.cursor ?? null });
    const rows = [];
    for (const organization of page.page) {
      const venues = await ctx.db
        .query("venues")
        .withIndex("by_org", (q) => q.eq("organizationId", organization._id))
        .collect();
      for (const venue of venues) {
        if (venue.isSimulation || venue.status === "archived") continue;
        rows.push(await funnelRow(ctx, organization, venue));
      }
    }
    return { rows, continueCursor: page.continueCursor, isDone: page.isDone };
  },
});

async function funnelRow(ctx: ReadCtx, organization: Doc<"organizations">, venue: Doc<"venues">) {
  const venueId = venue._id;
  // Premier produit créé, actif ou non : mesuré comme les tables.
  const firstProducts = await Promise.all(
    [true, false].map((isActive) =>
      ctx.db
        .query("products")
        .withIndex("by_venue_active", (q) => q.eq("venueId", venueId).eq("isActive", isActive))
        .first(),
    ),
  );
  const publications = await ctx.db
    .query("menuPublications")
    .withIndex("by_venue_current", (q) => q.eq("venueId", venueId))
    .collect();
  const tables = await ctx.db
    .query("restaurantTables")
    .withIndex("by_venue_number", (q) => q.eq("venueId", venueId))
    .collect();
  const firstSession = await ctx.db
    .query("tableSessions")
    .withIndex("by_venue_openedAt", (q) => q.eq("venueId", venueId))
    .filter((q) => q.eq(q.field("isSimulation"), false))
    .first();
  const firstPayment = await ctx.db
    .query("payments")
    .withIndex("by_venue_createdAt", (q) => q.eq("venueId", venueId))
    .filter((q) => q.and(q.eq(q.field("status"), "succeeded"), q.neq(q.field("isSimulation"), true)))
    .first();
  // Avant le premier paiement ; sans paiement, sur les trente premiers jours seulement : un
  // restaurant qui n'encaisse pas dans Joliba ne fait pas relire tout son journal.
  const until = firstPayment?.createdAt ?? venue._creationTime + SUPPORT_WINDOW_MS;
  const help = await ctx.db
    .query("auditLogs")
    .withIndex("by_resource", (q) => q.eq("resourceType", "venueOnboarding").eq("resourceId", venueId))
    .filter((q) => q.and(q.eq(q.field("action"), "onboarding.help_requested"), q.lte(q.field("at"), until)))
    .collect();
  const support = await ctx.db
    .query("auditLogs")
    .withIndex("by_org_at", (q) => q.eq("organizationId", organization._id).lte("at", until))
    .filter((q) => q.eq(q.field("source"), "support"))
    .collect();
  const firstOf = (times: number[]) => (times.length > 0 ? Math.min(...times) : null);
  return {
    organization: organization.name,
    venue: venue.name,
    createdAt: venue._creationTime,
    firstProductAt: firstOf(firstProducts.flatMap((p) => (p ? [p._creationTime] : []))),
    firstPublishedAt: firstOf(publications.map((p) => p.publishedAt)),
    firstTableAt: firstOf(tables.map((t) => t._creationTime)),
    firstSessionAt: firstSession?.openedAt ?? null,
    firstPaymentAt: firstPayment?.createdAt ?? null,
    helpRequestsBeforePayment: help.length,
    supportActionsBeforePayment: support.length,
    // « Sans assistance » selon la base seule : à croiser avec la liste des aides WhatsApp.
    unassistedInData: firstPayment !== null && help.length === 0 && support.length === 0,
  };
}
