/**
 * ISOLATION MULTI-TENANT — le test le plus important du produit (PERMISSIONS.md §9).
 *
 * Deux organisations réelles, A et B. Le propriétaire de A appelle CHAQUE fonction
 * publique du backend avec des identifiants appartenant à B — y compris en mélangeant
 * (son organisation + un rôle de B, son établissement + une invitation de B). Toutes
 * doivent répondre NOT_FOUND, ou ne rien renvoyer de B.
 *
 * Le dernier test fait la liste des fonctions publiques réellement exportées et échoue
 * si l'une d'elles n'a pas de cas ici : ajouter une fonction sans la tester contre la
 * fuite de tenant fait tomber la CI.
 */

import { describe, expect, test } from "vitest";
import { api } from "../../convex/_generated/api";
import { expectCode, inviteAndJoin, modules, openOrganization, setup } from "./setup";

async function twoTenants() {
  const t = setup();
  const a = await openOrganization(t, "awa@maquis-a.ci", "Maquis A", "Maquis A — Cocody");
  const b = await openOrganization(t, "bakary@lounge-b.ci", "Lounge B", "Lounge B — Plateau");
  const venueA2 = await a.owner.as.mutation(api.venues.create, {
    organizationId: a.organizationId,
    name: "Maquis A — Marcory",
    venueType: "maquis",
  });
  const waiterB = await inviteAndJoin(
    t,
    b.owner,
    { organizationId: b.organizationId, roleId: b.roleId("waiter"), venueIds: [b.venueId] },
    { email: "serveur@lounge-b.ci" },
  );
  const pendingB = await b.owner.as.action(api.team.invite, {
    organizationId: b.organizationId,
    email: "future@lounge-b.ci",
    roleId: b.roleId("cashier"),
    venueIds: [b.venueId],
  });
  const invitationB = await t.run(async (ctx) =>
    (await ctx.db.query("organizationInvitations").collect()).find((i) => i.email === "future@lounge-b.ci")!,
  );
  const waiterA = await inviteAndJoin(
    t,
    a.owner,
    { organizationId: a.organizationId, roleId: a.roleId("waiter"), venueIds: [a.venueId] },
    { email: "serveur@maquis-a.ci" },
  );
  return { t, a, b, venueA2, waiterA, waiterB, pendingB, invitationB };
}

/**
 * Un cas par fonction publique. La clé est `module.fonction` ; le test de couverture
 * compare ces clés à la liste réelle.
 */
const CASES: Record<string, (w: Awaited<ReturnType<typeof twoTenants>>) => Promise<void>> = {
  "users.me": async ({ a }) => {
    const me = await a.owner.as.query(api.users.me, {});
    expect(me?.email).toBe("awa@maquis-a.ci");
  },
  "users.updateProfile": async ({ t, a, b }) => {
    await a.owner.as.mutation(api.users.updateProfile, { name: "Awa Koné" });
    const other = await t.run((ctx) => ctx.db.get(b.owner.userId));
    expect(other?.name).toBe("Propriétaire Lounge B");
  },
  "organizations.listMine": async ({ a }) => {
    const mine = await a.owner.as.query(api.organizations.listMine, {});
    expect(mine.map((o) => o.name)).toEqual(["Maquis A"]);
  },
  "organizations.get": async ({ a, b }) => {
    await expectCode(a.owner.as.query(api.organizations.get, { organizationId: b.organizationId }), "NOT_FOUND");
  },
  "organizations.venueAccess": async ({ a, b }) => {
    await expectCode(a.owner.as.query(api.organizations.venueAccess, { venueId: b.venueId }), "NOT_FOUND");
  },
  "organizations.create": async ({ a }) => {
    // Créer n'expose rien d'autrui ; on vérifie que la nouvelle organisation est bien à A.
    const { organizationId } = await a.owner.as.mutation(api.organizations.create, {
      name: "Maquis A bis",
      countryCode: "SN",
      venue: { name: "Dakar", venueType: "restaurant" },
    });
    const org = await a.owner.as.query(api.organizations.get, { organizationId });
    expect(org.isOwner).toBe(true);
    expect(org.defaultCurrency).toBe("XOF");
  },
  "organizations.update": async ({ a, b }) => {
    await expectCode(
      a.owner.as.mutation(api.organizations.update, { organizationId: b.organizationId, name: "Piraté" }),
      "NOT_FOUND",
    );
  },
  "venues.listForOrganization": async ({ a, b }) => {
    await expectCode(a.owner.as.query(api.venues.listForOrganization, { organizationId: b.organizationId }), "NOT_FOUND");
  },
  "venues.get": async ({ a, b }) => {
    await expectCode(a.owner.as.query(api.venues.get, { venueId: b.venueId }), "NOT_FOUND");
  },
  "venues.create": async ({ a, b }) => {
    await expectCode(
      a.owner.as.mutation(api.venues.create, { organizationId: b.organizationId, name: "Intrus", venueType: "bar" }),
      "NOT_FOUND",
    );
  },
  "venues.update": async ({ a, b }) => {
    await expectCode(a.owner.as.mutation(api.venues.update, { venueId: b.venueId, name: "Piraté" }), "NOT_FOUND");
  },
  "roles.catalog": async ({ a }) => {
    const catalog = await a.owner.as.query(api.roles.catalog, {});
    expect(catalog.some((p) => p.key.startsWith("platform."))).toBe(false);
  },
  "roles.list": async ({ a, b }) => {
    await expectCode(a.owner.as.query(api.roles.list, { organizationId: b.organizationId }), "NOT_FOUND");
  },
  "roles.listForGrant": async ({ a, b }) => {
    await expectCode(a.owner.as.query(api.roles.listForGrant, { scope: { organizationId: b.organizationId } }), "NOT_FOUND");
    await expectCode(a.owner.as.query(api.roles.listForGrant, { scope: { venueId: b.venueId } }), "NOT_FOUND");
  },
  "roles.create": async ({ a, b }) => {
    await expectCode(
      a.owner.as.mutation(api.roles.create, { organizationId: b.organizationId, label: "Intrus", permissions: ["menu.read"] }),
      "NOT_FOUND",
    );
  },
  "roles.update": async ({ a, b }) => {
    // Clé étrangère croisée : SON organisation, le rôle de B.
    await expectCode(
      a.owner.as.mutation(api.roles.update, {
        organizationId: a.organizationId,
        roleId: b.roleId("waiter"),
        permissions: ["menu.read"],
        reason: "Tentative de franchissement",
      }),
      "NOT_FOUND",
    );
    await expectCode(
      a.owner.as.mutation(api.roles.update, {
        organizationId: b.organizationId,
        roleId: b.roleId("waiter"),
        label: "Piraté",
        reason: "Tentative de franchissement",
      }),
      "NOT_FOUND",
    );
  },
  "roles.archive": async ({ a, b }) => {
    await expectCode(
      a.owner.as.mutation(api.roles.archive, {
        organizationId: a.organizationId,
        roleId: b.roleId("analyst"),
        reason: "Tentative de franchissement",
      }),
      "NOT_FOUND",
    );
  },
  "team.listMembers": async ({ a, b }) => {
    await expectCode(a.owner.as.query(api.team.listMembers, { scope: { organizationId: b.organizationId } }), "NOT_FOUND");
    await expectCode(a.owner.as.query(api.team.listMembers, { scope: { venueId: b.venueId } }), "NOT_FOUND");
  },
  "team.listInvitations": async ({ a, b }) => {
    await expectCode(a.owner.as.query(api.team.listInvitations, { scope: { organizationId: b.organizationId } }), "NOT_FOUND");
    await expectCode(a.owner.as.query(api.team.listInvitations, { scope: { venueId: b.venueId } }), "NOT_FOUND");
  },
  "team.invite": async ({ a, b }) => {
    const base = { email: "intrus@exemple.ci" };
    await expectCode(
      a.owner.as.action(api.team.invite, { ...base, organizationId: b.organizationId, roleId: b.roleId("waiter"), venueIds: [] }),
      "NOT_FOUND",
    );
    // Son organisation + un rôle de B.
    await expectCode(
      a.owner.as.action(api.team.invite, { ...base, organizationId: a.organizationId, roleId: b.roleId("waiter"), venueIds: [] }),
      "NOT_FOUND",
    );
    // Son organisation + son rôle + un établissement de B.
    await expectCode(
      a.owner.as.action(api.team.invite, {
        ...base,
        organizationId: a.organizationId,
        roleId: a.roleId("waiter"),
        venueIds: [b.venueId],
      }),
      "NOT_FOUND",
    );
  },
  "team.previewInvitation": async ({ a, pendingB }) => {
    // Un jeton inventé ne renvoie rien. Le vrai lien de B, lui, montre l'aperçu à son
    // détenteur — c'est son rôle — mais signale que l'adresse ne correspond pas.
    expect(await a.owner.as.query(api.team.previewInvitation, { token: "inexistant" })).toBeNull();
    const token = pendingB.link.split("/invitation/")[1]!;
    const preview = await a.owner.as.query(api.team.previewInvitation, { token });
    expect(preview?.viewerEmailMatches).toBe(false);
    expect(preview?.maskedEmail).not.toContain("future@");
  },
  "team.myInvitations": async ({ a }) => {
    expect(await a.owner.as.query(api.team.myInvitations, {})).toEqual([]);
  },
  "team.acceptInvitation": async ({ a, pendingB }) => {
    const token = pendingB.link.split("/invitation/")[1]!;
    await expectCode(a.owner.as.mutation(api.team.acceptInvitation, { token }), "FORBIDDEN");
    await expectCode(a.owner.as.mutation(api.team.acceptInvitation, { token: "inexistant" }), "NOT_FOUND");
  },
  "team.acceptInvitationById": async ({ a, invitationB }) => {
    await expectCode(a.owner.as.mutation(api.team.acceptInvitationById, { invitationId: invitationB._id }), "NOT_FOUND");
  },
  "team.revokeInvitation": async ({ a, b, invitationB }) => {
    await expectCode(
      a.owner.as.mutation(api.team.revokeInvitation, { organizationId: a.organizationId, invitationId: invitationB._id }),
      "NOT_FOUND",
    );
    await expectCode(
      a.owner.as.mutation(api.team.revokeInvitation, { organizationId: b.organizationId, invitationId: invitationB._id }),
      "NOT_FOUND",
    );
  },
  "team.setMemberRoles": async ({ a, b, waiterA, waiterB }) => {
    await expectCode(
      a.owner.as.mutation(api.team.setMemberRoles, {
        memberId: waiterB.memberId,
        scope: { organizationId: a.organizationId },
        roleIds: [a.roleId("waiter")],
      }),
      "NOT_FOUND",
    );
    // Son propre membre, mais dans un établissement de B.
    await expectCode(
      a.owner.as.mutation(api.team.setMemberRoles, {
        memberId: waiterA.memberId,
        scope: { venueId: b.venueId },
        roleIds: [],
      }),
      "NOT_FOUND",
    );
  },
  "team.setMemberStatus": async ({ a, waiterB }) => {
    await expectCode(
      a.owner.as.mutation(api.team.setMemberStatus, {
        organizationId: a.organizationId,
        memberId: waiterB.memberId,
        status: "suspended",
      }),
      "NOT_FOUND",
    );
  },
};

describe("isolation multi-tenant : A ne voit ni ne touche rien de B", () => {
  for (const [name, run] of Object.entries(CASES)) {
    test(name, async () => {
      const world = await twoTenants();
      await run(world);
      // Et rien de B n'a bougé : même nom, même établissement, mêmes membres.
      const org = await world.b.owner.as.query(api.organizations.get, { organizationId: world.b.organizationId });
      expect(org.name).toBe("Lounge B");
      expect(org.venues.map((v) => v.name)).toEqual(["Lounge B — Plateau"]);
      const members = await world.b.owner.as.query(api.team.listMembers, { scope: { organizationId: world.b.organizationId } });
      expect(members.map((m) => m.email).sort()).toEqual(["bakary@lounge-b.ci", "serveur@lounge-b.ci"]);
      expect(members.find((m) => m.email === "serveur@lounge-b.ci")?.status).toBe("active");
    });
  }

  test("chaque fonction publique a un cas d'isolation", async () => {
    const exported: string[] = [];
    for (const [path, load] of Object.entries(modules)) {
      if (path.includes("/_generated/") || path.includes("/lib/")) continue;
      // Configuration, pas de fonctions : les charger n'apporte rien (et `convex.config`
      // tire la configuration de composants tiers, non chargeable hors déploiement).
      if (/\/(convex\.config|auth\.config|schema|http)\.ts$/.test(path)) continue;
      const moduleName = path.replace(/^.*\/convex\//, "").replace(/\.ts$/, "");
      const mod = (await load()) as Record<string, { isPublic?: boolean } | undefined>;
      for (const [name, fn] of Object.entries(mod)) {
        if (fn?.isPublic === true) exported.push(`${moduleName}.${name}`);
      }
    }
    expect(exported.length).toBeGreaterThan(20);
    expect(exported.filter((name) => !(name in CASES))).toEqual([]);
    expect(Object.keys(CASES).filter((name) => !exported.includes(name))).toEqual([]);
  });
});
