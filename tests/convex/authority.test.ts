/**
 * Autorité, invitations et portée — les cas relevés par la revue adverse de T0.
 *
 * Chaque test reproduit un scénario d'attaque ou de régression précis. Ils complètent
 * `permissions.test.ts`, qui décrit le comportement nominal.
 */

import { describe, expect, test } from "vitest";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import { sha256Hex } from "../../convex/lib/tokens";
import { expectCode, inviteAndJoin, openOrganization, setup, signUp, type Session, type T } from "./setup";

async function restaurantWithTeam() {
  const t = setup();
  const org = await openOrganization(t, "awa@maquis.ci", "Maquis Awa", "Cocody");
  const manager = await inviteAndJoin(
    t,
    org.owner,
    { organizationId: org.organizationId, roleId: org.roleId("venue_manager"), venueIds: [org.venueId] },
    { email: "manager@maquis.ci", name: "Koffi" },
  );
  const waiter = await inviteAndJoin(
    t,
    org.owner,
    { organizationId: org.organizationId, roleId: org.roleId("waiter"), venueIds: [org.venueId] },
    { email: "serveur@maquis.ci", name: "Mariam" },
  );
  return { t, ...org, cocody: org.venueId, manager, waiter };
}

/** Une invitation posée directement en base, pour un scénario que l'écran interdit en amont. */
async function plantInvitation(
  t: T,
  args: { organizationId: Id<"organizations">; email: string; roleId: Id<"roles">; venueIds: Id<"venues">[]; by: Session },
) {
  const token = `jeton-${args.email}-${Math.random()}`;
  const tokenHash = await sha256Hex(token);
  await t.run((ctx) =>
    ctx.db.insert("organizationInvitations", {
      organizationId: args.organizationId,
      email: args.email,
      roleId: args.roleId,
      venueIds: args.venueIds,
      tokenHash,
      status: "pending",
      invitedByUserId: args.by.userId,
      expiresAt: Date.now() + 86_400_000,
    }),
  );
  return token;
}

describe("une invitation ne réactive jamais un membre suspendu", () => {
  test("inviter un membre suspendu est refusé", async () => {
    const w = await restaurantWithTeam();
    await w.owner.as.mutation(api.team.setMemberStatus, {
      organizationId: w.organizationId,
      memberId: w.waiter.memberId,
      status: "suspended",
    });
    await expectCode(
      w.owner.as.action(api.team.invite, {
        organizationId: w.organizationId,
        email: w.waiter.email,
        roleId: w.roleId("waiter"),
        venueIds: [w.cocody],
      }),
      "CONFLICT",
    );
  });

  test("une invitation encore en attente ne rouvre pas l'accès d'un membre suspendu", async () => {
    const w = await restaurantWithTeam();
    await w.owner.as.mutation(api.team.setMemberStatus, {
      organizationId: w.organizationId,
      memberId: w.waiter.memberId,
      status: "suspended",
    });
    const token = await plantInvitation(w.t, {
      organizationId: w.organizationId,
      email: w.waiter.email,
      roleId: w.roleId("waiter"),
      venueIds: [w.cocody],
      by: w.owner,
    });
    await expectCode(w.waiter.as.mutation(api.team.acceptInvitation, { token }), "FORBIDDEN");
    await expectCode(w.waiter.as.query(api.organizations.get, { organizationId: w.organizationId }), "NOT_FOUND");
  });

  test("un membre retiré qui revient n'a que la nouvelle affectation, et n'est plus marqué retiré", async () => {
    const w = await restaurantWithTeam();
    await w.owner.as.mutation(api.team.setMemberStatus, {
      organizationId: w.organizationId,
      memberId: w.waiter.memberId,
      status: "removed",
    });
    const { link } = await w.owner.as.action(api.team.invite, {
      organizationId: w.organizationId,
      email: w.waiter.email,
      roleId: w.roleId("cashier"),
      venueIds: [w.cocody],
    });
    await w.waiter.as.mutation(api.team.acceptInvitation, { token: link.split("/invitation/")[1]! });
    const state = await w.t.run(async (ctx) => {
      const member = await ctx.db.get(w.waiter.memberId);
      const assignments = await ctx.db
        .query("memberRoleAssignments")
        .withIndex("by_member", (q) => q.eq("memberId", w.waiter.memberId))
        .collect();
      return { member, roleIds: assignments.map((a) => a.roleId) };
    });
    expect(state.member?.status).toBe("active");
    expect(state.member?.removedAt).toBeUndefined();
    expect(state.roleIds).toEqual([w.roleId("cashier")]);
  });
});

describe("une invitation vaut ce que vaut encore son auteur", () => {
  async function managerInvites(w: Awaited<ReturnType<typeof restaurantWithTeam>>) {
    const { link } = await w.manager.as.action(api.team.invite, {
      organizationId: w.organizationId,
      email: "nouveau@maquis.ci",
      roleId: w.roleId("waiter"),
      venueIds: [w.cocody],
    });
    return link.split("/invitation/")[1]!;
  }

  test("suspendre l'auteur révoque ses invitations en attente", async () => {
    const w = await restaurantWithTeam();
    const token = await managerInvites(w);
    await w.owner.as.mutation(api.team.setMemberStatus, {
      organizationId: w.organizationId,
      memberId: w.manager.memberId,
      status: "suspended",
    });
    expect(await w.t.query(api.team.previewInvitation, { token })).toBeNull();
    const invitee = await signUp(w.t, "nouveau@maquis.ci");
    expect(await invitee.as.query(api.team.myInvitations, {})).toEqual([]);
    await expectCode(invitee.as.mutation(api.team.acceptInvitation, { token }), "NOT_FOUND");
  });

  test("retirer l'auteur rend ses invitations inopérantes", async () => {
    const w = await restaurantWithTeam();
    const token = await managerInvites(w);
    await w.owner.as.mutation(api.team.setMemberStatus, {
      organizationId: w.organizationId,
      memberId: w.manager.memberId,
      status: "removed",
    });
    const invitee = await signUp(w.t, "nouveau@maquis.ci");
    await expectCode(invitee.as.mutation(api.team.acceptInvitation, { token }), "NOT_FOUND");
  });

  test("rétrograder l'auteur rend ses invitations inopérantes, sans les révoquer", async () => {
    const w = await restaurantWithTeam();
    const token = await managerInvites(w);
    // Le responsable redevient simple serveur : il n'a plus le droit de gérer l'équipe.
    await w.owner.as.mutation(api.team.setMemberRoles, {
      memberId: w.manager.memberId,
      scope: { venueId: w.cocody },
      roleIds: [w.roleId("waiter")],
    });
    expect(await w.t.query(api.team.previewInvitation, { token })).toBeNull();
    const invitee = await signUp(w.t, "nouveau@maquis.ci");
    expect(await invitee.as.query(api.team.myInvitations, {})).toEqual([]);
    await expectCode(invitee.as.mutation(api.team.acceptInvitation, { token }), "NOT_FOUND");
    await expectCode(invitee.as.query(api.organizations.get, { organizationId: w.organizationId }), "NOT_FOUND");
  });
});

describe("les verrous se mesurent sur l'autorité, pas sur le plan", () => {
  async function withoutAi(w: Awaited<ReturnType<typeof restaurantWithTeam>>) {
    const planId = await w.t.run((ctx) =>
      ctx.db.insert("plans", {
        key: "essentiel",
        label: "Essentiel",
        prices: [],
        entitlements: { ai: false },
        limits: { venues: 1, staffSeats: 5 },
        isPublic: true,
        sortOrder: 1,
      }),
    );
    await w.t.run((ctx) =>
      ctx.db.insert("subscriptions", {
        organizationId: w.organizationId,
        planId,
        status: "active",
        currentPeriodEnd: Date.now() + 86_400_000,
        entitlements: { ai: false },
      }),
    );
  }

  test("sans l'IA au plan, un responsable peut encore nommer un autre responsable", async () => {
    const w = await restaurantWithTeam();
    await withoutAi(w);
    // Le rôle contient des droits d'IA que le plan retire à tous : les verrous ne doivent
    // pas en conclure que le responsable « ne les a pas ».
    const second = await inviteAndJoin(
      w.t,
      w.manager,
      { organizationId: w.organizationId, roleId: w.roleId("venue_manager"), venueIds: [w.cocody] },
      { email: "second@maquis.ci" },
    );
    const access = await second.as.query(api.organizations.venueAccess, { venueId: w.cocody });
    expect(access.permissions).toContain("team.manage");
    expect(access.permissions).not.toContain("ai.use");
  });

  test("sans l'IA au plan, un responsable gère encore les rôles de son équipe", async () => {
    const w = await restaurantWithTeam();
    await withoutAi(w);
    await w.manager.as.mutation(api.team.setMemberRoles, {
      memberId: w.waiter.memberId,
      scope: { venueId: w.cocody },
      roleIds: [w.roleId("floor_manager")],
    });
  });
});

describe("un droit d'organisation attribué sur un établissement ne vaut rien", () => {
  test("« créer un établissement » donné au niveau d'un établissement n'est pas accordé", async () => {
    const w = await restaurantWithTeam();
    const roleId = await w.owner.as.mutation(api.roles.create, {
      organizationId: w.organizationId,
      label: "Ouvreur",
      permissions: ["venue.read", "venue.create"],
    });
    const opener = await inviteAndJoin(
      w.t,
      w.owner,
      { organizationId: w.organizationId, roleId, venueIds: [w.cocody] },
      { email: "ouvreur@maquis.ci" },
    );
    const access = await opener.as.query(api.organizations.venueAccess, { venueId: w.cocody });
    expect(access.permissions).toEqual(["venue.read"]);
    const org = await opener.as.query(api.organizations.get, { organizationId: w.organizationId });
    expect(org.permissions).toEqual([]);
    await expectCode(
      opener.as.mutation(api.venues.create, { organizationId: w.organizationId, name: "Yopougon", venueType: "maquis" }),
      "FORBIDDEN",
    );
  });
});

describe("mes invitations", () => {
  test("je vois exactement celles qui me sont adressées, d'où qu'elles viennent", async () => {
    const t = setup();
    const a = await openOrganization(t, "a@maquis.ci", "Maquis A", "Treichville");
    const b = await openOrganization(t, "b@resto.ci", "Resto B", "Marcory");
    const other = await signUp(t, "tiers@exemple.ci");
    await b.owner.as.action(api.team.invite, {
      organizationId: b.organizationId,
      email: "a@maquis.ci",
      roleId: b.roleId("waiter"),
      venueIds: [b.venueId],
    });
    await b.owner.as.action(api.team.invite, {
      organizationId: b.organizationId,
      email: "quelquun@ailleurs.ci",
      roleId: b.roleId("waiter"),
      venueIds: [b.venueId],
    });
    const mine = await a.owner.as.query(api.team.myInvitations, {});
    expect(mine.map((i) => [i.organizationName, i.roleLabel])).toEqual([["Resto B", "Serveur"]]);
    expect(await other.as.query(api.team.myInvitations, {})).toEqual([]);
    // Accepter par identifiant l'invitation d'un autre : introuvable.
    await expectCode(other.as.mutation(api.team.acceptInvitationById, { invitationId: mine[0]!.invitationId }), "NOT_FOUND");
  });

  test("un compte à l'adresse non prouvée voit l'aperçu, sans pouvoir accepter", async () => {
    const w = await restaurantWithTeam();
    const { link } = await w.owner.as.action(api.team.invite, {
      organizationId: w.organizationId,
      email: "douteux@maquis.ci",
      roleId: w.roleId("waiter"),
      venueIds: [w.cocody],
    });
    const token = link.split("/invitation/")[1]!;
    const viewer = await signUp(w.t, "douteux@maquis.ci", undefined, { emailVerified: false });
    const preview = await viewer.as.query(api.team.previewInvitation, { token });
    expect(preview?.viewerEmailMatches).toBe(true);
    expect(preview?.viewerEmailVerified).toBe(false);
    expect(await viewer.as.query(api.team.myInvitations, {})).toEqual([]);
  });
});
