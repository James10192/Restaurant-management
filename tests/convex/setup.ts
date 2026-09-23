/**
 * Banc d'essai Convex — Joliba
 *
 * `convex-test` exécute les VRAIES fonctions Convex du dépôt, en mémoire, avec le vrai
 * schéma. L'identité est simulée par `withIdentity({ subject })` : c'est exactement ce que
 * voit une fonction en production, où `subject` est l'identifiant Better Auth.
 *
 * Better Auth n'est pas enregistré : aucune des fonctions testées ne l'appelle, et la
 * création de la ligne `users` (normalement faite par son déclencheur) est reproduite
 * par `signUp`.
 */

/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import rateLimiter from "@convex-dev/rate-limiter/test";
import { expect } from "vitest";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import schema from "../../convex/schema";

export const modules = import.meta.glob("../../convex/**/*.ts");

export function setup() {
  const t = convexTest(schema, modules);
  rateLimiter.register(t);
  return t;
}

export type T = ReturnType<typeof setup>;

let counter = 0;

/** Crée un compte (comme le ferait le déclencheur Better Auth) et renvoie son client. */
export async function signUp(t: T, email: string, name?: string, options: { emailVerified?: boolean } = {}) {
  const authId = `auth_${++counter}_${email}`;
  const userId = await t.run((ctx) =>
    ctx.db.insert("users", {
      authId,
      email: email.toLowerCase(),
      ...(name ? { name } : {}),
      // Par défaut, adresse prouvée : c'est le cas de toute connexion par code.
      ...(options.emailVerified === false ? {} : { emailVerifiedAt: Date.now() }),
      locale: "fr",
      status: "active",
    }),
  );
  return { userId, email: email.toLowerCase(), as: t.withIdentity({ subject: authId, email }) };
}

export type Session = Awaited<ReturnType<typeof signUp>>;

/** Un propriétaire, son organisation, son premier établissement. */
export async function openOrganization(t: T, email: string, orgName: string, venueName: string) {
  const owner = await signUp(t, email, `Propriétaire ${orgName}`);
  const { organizationId, venueId } = await owner.as.mutation(api.organizations.create, {
    name: orgName,
    countryCode: "CI",
    venue: { name: venueName, venueType: "maquis", city: "Abidjan" },
  });
  const roles = await owner.as.query(api.roles.list, { organizationId });
  const roleId = (key: string): Id<"roles"> => {
    const role = roles.find((r) => r.key === key);
    if (!role) throw new Error(`Rôle introuvable : ${key}`);
    return role._id;
  };
  return { owner, organizationId, venueId, roleId };
}

/** Invite puis fait accepter : le chemin réel, jeton compris. */
export async function inviteAndJoin(
  t: T,
  inviter: Session,
  args: { organizationId: Id<"organizations">; roleId: Id<"roles">; venueIds: Id<"venues">[] },
  invitee: { email: string; name?: string },
) {
  const { link } = await inviter.as.action(api.team.invite, { ...args, email: invitee.email });
  const token = link.split("/invitation/")[1]!;
  const session = await signUp(t, invitee.email, invitee.name);
  await session.as.mutation(api.team.acceptInvitation, { token });
  const memberId = await t.run(async (ctx) => {
    const m = await ctx.db
      .query("organizationMembers")
      .withIndex("by_org_user", (q) => q.eq("organizationId", args.organizationId).eq("userId", session.userId))
      .unique();
    return m!._id;
  });
  return { ...session, memberId, token };
}

/** Vérifie le CODE de l'erreur applicative, pas seulement qu'une erreur a eu lieu. */
export async function expectCode(promise: Promise<unknown>, code: string): Promise<void> {
  let error: unknown = null;
  try {
    await promise;
  } catch (e) {
    error = e;
  }
  expect(error, `une erreur ${code} était attendue`).not.toBeNull();
  const data = (error as { data?: unknown }).data;
  const actual =
    typeof data === "string" ? (JSON.parse(data) as { code?: string }).code : (data as { code?: string } | undefined)?.code;
  expect(actual, String((error as Error).message)).toBe(code);
}
