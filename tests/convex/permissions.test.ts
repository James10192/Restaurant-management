/**
 * Permissions : portée par établissement, les trois verrous, le plan tarifaire, et le
 * parcours « le collègue ne voit rien d'autre » (PERMISSIONS.md §7 et §9).
 */

import { describe, expect, test } from "vitest";
import { api } from "../../convex/_generated/api";
import { applyEntitlements } from "../../convex/lib/entitlements";
import { ALL_PERMISSIONS, ROLE_TEMPLATES, type Permission } from "../../convex/lib/permissions";
import { expectCode, inviteAndJoin, openOrganization, setup } from "./setup";

async function restaurantWithTeam() {
  const t = setup();
  const org = await openOrganization(t, "awa@maquis.ci", "Maquis Awa", "Cocody");
  const plateau = await org.owner.as.mutation(api.venues.create, {
    organizationId: org.organizationId,
    name: "Plateau",
    venueType: "maquis",
  });
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
  return { t, ...org, cocody: org.venueId, plateau, manager, waiter };
}

describe("le collègue ne voit rien d'autre", () => {
  test("un serveur de Cocody ne voit que Cocody, et seulement ce que son rôle permet", async () => {
    const w = await restaurantWithTeam();
    const org = await w.waiter.as.query(api.organizations.get, { organizationId: w.organizationId });
    expect(org.venues.map((v) => v.name)).toEqual(["Cocody"]);
    // Aucune permission d'organisation : il n'a qu'une affectation d'établissement.
    expect(org.permissions).toEqual([]);

    const access = await w.waiter.as.query(api.organizations.venueAccess, { venueId: w.cocody });
    expect([...access.permissions].sort()).toEqual([...ROLE_TEMPLATES.waiter.permissions].sort());

    await expectCode(w.waiter.as.query(api.venues.get, { venueId: w.plateau }), "NOT_FOUND");
    await expectCode(w.waiter.as.query(api.organizations.venueAccess, { venueId: w.plateau }), "NOT_FOUND");
    // Dans sa portée, mais sans le droit : FORBIDDEN — la barrière est côté serveur.
    await expectCode(w.waiter.as.mutation(api.venues.update, { venueId: w.cocody, name: "Renommé" }), "FORBIDDEN");
    await expectCode(w.waiter.as.query(api.team.listMembers, { scope: { venueId: w.cocody } }), "FORBIDDEN");
    await expectCode(w.waiter.as.query(api.roles.list, { organizationId: w.organizationId }), "FORBIDDEN");
    await expectCode(
      w.waiter.as.mutation(api.venues.create, { organizationId: w.organizationId, name: "Nouveau", venueType: "bar" }),
      "FORBIDDEN",
    );
  });

  test("le responsable de Cocody est refusé au Plateau", async () => {
    const w = await restaurantWithTeam();
    await w.manager.as.mutation(api.venues.update, { venueId: w.cocody, phone: "+225 07 00 00 00 00" });
    await expectCode(w.manager.as.mutation(api.venues.update, { venueId: w.plateau, phone: "0" }), "NOT_FOUND");
    await expectCode(w.manager.as.query(api.team.listMembers, { scope: { venueId: w.plateau } }), "NOT_FOUND");
    // Responsable d'un établissement n'est pas responsable de l'organisation.
    await expectCode(
      w.manager.as.mutation(api.venues.create, { organizationId: w.organizationId, name: "Yopougon", venueType: "maquis" }),
      "FORBIDDEN",
    );
  });

  test("la liste d'équipe d'un établissement ne montre que ses affectations", async () => {
    const w = await restaurantWithTeam();
    await inviteAndJoin(
      w.t,
      w.owner,
      { organizationId: w.organizationId, roleId: w.roleId("cashier"), venueIds: [w.plateau] },
      { email: "caisse@maquis.ci" },
    );
    const cocody = await w.manager.as.query(api.team.listMembers, { scope: { venueId: w.cocody } });
    expect(cocody.map((m) => m.email).sort()).toEqual(["awa@maquis.ci", "manager@maquis.ci", "serveur@maquis.ci"]);
  });
});

describe("verrou 1 — on ne donne pas ce qu'on n'a pas", () => {
  test("un responsable ne peut pas attribuer un rôle plus large que le sien", async () => {
    const w = await restaurantWithTeam();
    const invite = (roleKey: string, venueIds: typeof w.cocody[]) =>
      w.manager.as.action(api.team.invite, {
        organizationId: w.organizationId,
        email: "nouveau@maquis.ci",
        roleId: w.roleId(roleKey),
        venueIds,
      });
    await invite("waiter", [w.cocody]); // permis
    await expectCode(invite("organization_admin", [w.cocody]), "FORBIDDEN");
    await expectCode(invite("waiter", []), "FORBIDDEN"); // portée organisation : pas la sienne
    await expectCode(invite("waiter", [w.plateau]), "NOT_FOUND");
  });

  test("l'écran annonce exactement ce que le serveur acceptera", async () => {
    const w = await restaurantWithTeam();
    const roles = await w.manager.as.query(api.roles.listForGrant, { scope: { venueId: w.cocody } });
    for (const role of roles) {
      const attempt = w.manager.as.action(api.team.invite, {
        organizationId: w.organizationId,
        email: `essai-${role._id}@maquis.ci`,
        roleId: role._id,
        venueIds: [w.cocody],
      });
      if (role.grantable) await attempt;
      else await expectCode(attempt, "FORBIDDEN");
    }
    expect(roles.some((r) => r.grantable)).toBe(true);
    expect(roles.some((r) => !r.grantable)).toBe(true);
  });

  test("on ne compose pas un rôle avec des droits qu'on n'a pas", async () => {
    const w = await restaurantWithTeam();
    // Donne à Koffi `permissions.manage` au niveau organisation, sans le reste.
    const roleId = await w.owner.as.mutation(api.roles.create, {
      organizationId: w.organizationId,
      label: "Gestion des rôles",
      permissions: ["permissions.manage", "menu.read"],
    });
    await w.owner.as.mutation(api.team.setMemberRoles, {
      memberId: w.manager.memberId,
      scope: { organizationId: w.organizationId },
      roleIds: [roleId],
    });
    await w.manager.as.mutation(api.roles.create, {
      organizationId: w.organizationId,
      label: "Lecteur de carte",
      permissions: ["menu.read"],
    });
    await expectCode(
      w.manager.as.mutation(api.roles.create, {
        organizationId: w.organizationId,
        label: "Rembourseur",
        permissions: ["payment.refund"],
      }),
      "FORBIDDEN",
    );
    // Ni affaiblir un rôle plus puissant que le sien.
    await expectCode(
      w.manager.as.mutation(api.roles.update, {
        organizationId: w.organizationId,
        roleId: w.roleId("organization_admin"),
        permissions: ["menu.read"],
        reason: "Réduction volontaire du rôle",
      }),
      "FORBIDDEN",
    );
  });
});

describe("verrou 2 — pas soi-même, pas le propriétaire", () => {
  test("un responsable ne modifie ni ses propres droits ni ceux du propriétaire", async () => {
    const w = await restaurantWithTeam();
    await expectCode(
      w.manager.as.mutation(api.team.setMemberRoles, {
        memberId: w.manager.memberId,
        scope: { venueId: w.cocody },
        roleIds: [w.roleId("venue_manager"), w.roleId("owner")],
      }),
      "FORBIDDEN",
    );
    const ownerMember = (await w.owner.as.query(api.team.listMembers, { scope: { organizationId: w.organizationId } })).find(
      (m) => m.isOwner,
    )!;
    await expectCode(
      w.manager.as.mutation(api.team.setMemberRoles, {
        memberId: ownerMember.memberId,
        scope: { venueId: w.cocody },
        roleIds: [],
      }),
      "FORBIDDEN",
    );
    await expectCode(
      w.manager.as.mutation(api.team.setMemberStatus, {
        organizationId: w.organizationId,
        memberId: ownerMember.memberId,
        status: "suspended",
      }),
      "FORBIDDEN",
    );
  });

  test("le propriétaire ne peut pas s'enfermer dehors en vidant son rôle", async () => {
    const w = await restaurantWithTeam();
    // Le rôle « Propriétaire » copié est modifiable, mais la propriété ne dépend pas de lui.
    await w.owner.as.mutation(api.roles.update, {
      organizationId: w.organizationId,
      roleId: w.roleId("owner"),
      permissions: ["menu.read"],
      reason: "Test de verrouillage du propriétaire",
    });
    const org = await w.owner.as.query(api.organizations.get, { organizationId: w.organizationId });
    expect(org.permissions.length).toBe(ALL_PERMISSIONS.length);
  });

  test("un responsable peut gérer un serveur de son établissement", async () => {
    const w = await restaurantWithTeam();
    await w.manager.as.mutation(api.team.setMemberRoles, {
      memberId: w.waiter.memberId,
      scope: { venueId: w.cocody },
      roleIds: [w.roleId("waiter"), w.roleId("cashier")],
    });
    const access = await w.waiter.as.query(api.organizations.venueAccess, { venueId: w.cocody });
    expect(access.permissions).toContain("payment.collect");
  });
});

describe("verrou 3 — aucune permission de la plateforme dans un rôle", () => {
  test("refusée à l'écriture, même par le propriétaire", async () => {
    const w = await restaurantWithTeam();
    await expectCode(
      w.owner.as.mutation(api.roles.create, {
        organizationId: w.organizationId,
        label: "Support maison",
        permissions: ["menu.read", "platform.impersonate"],
      }),
      "INVALID_ARGUMENT",
    );
    await expectCode(
      w.owner.as.mutation(api.roles.create, {
        organizationId: w.organizationId,
        label: "Faute de frappe",
        permissions: ["menu.raed"],
      }),
      "INVALID_ARGUMENT",
    );
  });
});

describe("suspension et retrait", () => {
  test("un membre suspendu perd l'accès immédiatement, le retrouve à la réactivation", async () => {
    const w = await restaurantWithTeam();
    const setStatus = (status: "active" | "suspended" | "removed") =>
      w.manager.as.mutation(api.team.setMemberStatus, { organizationId: w.organizationId, memberId: w.waiter.memberId, status });
    await setStatus("suspended");
    await expectCode(w.waiter.as.query(api.organizations.get, { organizationId: w.organizationId }), "NOT_FOUND");
    expect(await w.waiter.as.query(api.organizations.listMine, {})).toEqual([]);
    await setStatus("active");
    await w.waiter.as.query(api.organizations.get, { organizationId: w.organizationId });
    await setStatus("removed");
    await expectCode(w.waiter.as.query(api.organizations.venueAccess, { venueId: w.cocody }), "NOT_FOUND");
  });

  test("un serveur ne suspend personne", async () => {
    const w = await restaurantWithTeam();
    await expectCode(
      w.waiter.as.mutation(api.team.setMemberStatus, {
        organizationId: w.organizationId,
        memberId: w.manager.memberId,
        status: "suspended",
      }),
      "FORBIDDEN",
    );
  });
});

describe("invitations", () => {
  test("un lien transféré à une autre adresse n'ouvre rien", async () => {
    const w = await restaurantWithTeam();
    const { link } = await w.owner.as.action(api.team.invite, {
      organizationId: w.organizationId,
      email: "destinataire@maquis.ci",
      roleId: w.roleId("waiter"),
      venueIds: [w.cocody],
    });
    const token = link.split("/invitation/")[1]!;
    await expectCode(w.waiter.as.mutation(api.team.acceptInvitation, { token }), "FORBIDDEN");
  });

  test("un compte dont l'adresse n'est pas prouvée n'accepte rien, même avec la bonne adresse", async () => {
    // Le scénario : un compte Google créé avec l'adresse de l'invité, sans la vérifier.
    const w = await restaurantWithTeam();
    const { link } = await w.owner.as.action(api.team.invite, {
      organizationId: w.organizationId,
      email: "cible@maquis.ci",
      roleId: w.roleId("waiter"),
      venueIds: [w.cocody],
    });
    const token = link.split("/invitation/")[1]!;
    const impostor = await (await import("./setup")).signUp(w.t, "cible@maquis.ci", "Usurpateur", { emailVerified: false });
    await expectCode(impostor.as.mutation(api.team.acceptInvitation, { token }), "FORBIDDEN");
    expect(await impostor.as.query(api.team.myInvitations, {})).toEqual([]);
    const invitation = await w.t.run(async (ctx) =>
      (await ctx.db.query("organizationInvitations").collect()).find((i) => i.email === "cible@maquis.ci")!,
    );
    await expectCode(impostor.as.mutation(api.team.acceptInvitationById, { invitationId: invitation._id }), "FORBIDDEN");
    await expectCode(impostor.as.query(api.organizations.get, { organizationId: w.organizationId }), "NOT_FOUND");
  });

  test("seul le SHA-256 du jeton est stocké", async () => {
    const w = await restaurantWithTeam();
    const { link } = await w.owner.as.action(api.team.invite, {
      organizationId: w.organizationId,
      email: "hash@maquis.ci",
      roleId: w.roleId("waiter"),
      venueIds: [w.cocody],
    });
    const token = link.split("/invitation/")[1]!;
    const stored = await w.t.run((ctx) => ctx.db.query("organizationInvitations").collect());
    const serialized = JSON.stringify(stored);
    expect(token.length).toBeGreaterThanOrEqual(40);
    expect(serialized).not.toContain(token);
  });

  test("une invitation expirée ou révoquée ne s'accepte plus", async () => {
    const w = await restaurantWithTeam();
    const { link } = await w.owner.as.action(api.team.invite, {
      organizationId: w.organizationId,
      email: "tard@maquis.ci",
      roleId: w.roleId("waiter"),
      venueIds: [w.cocody],
    });
    const token = link.split("/invitation/")[1]!;
    const invitation = await w.t.run(async (ctx) =>
      (await ctx.db.query("organizationInvitations").collect()).find((i) => i.email === "tard@maquis.ci")!,
    );
    await w.t.run((ctx) => ctx.db.patch(invitation._id, { expiresAt: Date.now() - 1 }));
    const late = await (await import("./setup")).signUp(w.t, "tard@maquis.ci");
    await expectCode(late.as.mutation(api.team.acceptInvitation, { token }), "NOT_FOUND");
    expect(await late.as.query(api.team.previewInvitation, { token })).toBeNull();
  });

  test("une nouvelle invitation remplace la précédente pour la même adresse", async () => {
    const w = await restaurantWithTeam();
    const invite = () =>
      w.owner.as.action(api.team.invite, {
        organizationId: w.organizationId,
        email: "double@maquis.ci",
        roleId: w.roleId("waiter"),
        venueIds: [w.cocody],
      });
    const first = await invite();
    await invite();
    const pending = await w.owner.as.query(api.team.listInvitations, { scope: { organizationId: w.organizationId } });
    expect(pending.filter((i) => i.email === "double@maquis.ci")).toHaveLength(1);
    const late = await (await import("./setup")).signUp(w.t, "double@maquis.ci");
    await expectCode(
      late.as.mutation(api.team.acceptInvitation, { token: first.link.split("/invitation/")[1]! }),
      "NOT_FOUND",
    );
  });

  test("inviter une personne déjà membre est refusé", async () => {
    const w = await restaurantWithTeam();
    await expectCode(
      w.owner.as.action(api.team.invite, {
        organizationId: w.organizationId,
        email: "serveur@maquis.ci",
        roleId: w.roleId("cashier"),
        venueIds: [w.cocody],
      }),
      "CONFLICT",
    );
  });

  test("un rôle attribué ne s'archive pas", async () => {
    const w = await restaurantWithTeam();
    await expectCode(
      w.owner.as.mutation(api.roles.archive, {
        organizationId: w.organizationId,
        roleId: w.roleId("waiter"),
        reason: "Nettoyage des rôles inutiles",
      }),
      "CONFLICT",
    );
    await w.owner.as.mutation(api.roles.archive, {
      organizationId: w.organizationId,
      roleId: w.roleId("analyst"),
      reason: "Nettoyage des rôles inutiles",
    });
  });

  test("une modification de rôle exige un motif", async () => {
    const w = await restaurantWithTeam();
    await expectCode(
      w.owner.as.mutation(api.roles.update, {
        organizationId: w.organizationId,
        roleId: w.roleId("waiter"),
        label: "Serveuse",
        reason: "court",
      }),
      "INVALID_ARGUMENT",
    );
  });
});

describe("le plan tarifaire retire, il n'ajoute jamais", () => {
  test("fonction pure : aucun élément ne peut apparaître", () => {
    const base = new Set<Permission>(["menu.read", "ai.use"]);
    const out = applyEntitlements(base, { ai: false, inventory: true, data_export: true, loyalty: true });
    expect([...out]).toEqual(["menu.read"]);
    const everything = applyEntitlements(new Set<Permission>(["menu.read"]), { ai: true, inventory: true });
    expect([...everything]).toEqual(["menu.read"]);
  });

  test("un abonnement sans l'IA la retire, une dérogation `true` ne la rouvre pas", async () => {
    const w = await restaurantWithTeam();
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
        overrides: { ai: true },
      }),
    );
    const access = await w.manager.as.query(api.organizations.venueAccess, { venueId: w.cocody });
    expect(access.permissions).not.toContain("ai.use");
    expect(access.permissions).toContain("menu.edit");
    const owner = await w.owner.as.query(api.organizations.venueAccess, { venueId: w.cocody });
    expect(owner.permissions).not.toContain("ai.actions.approve");
  });
});

describe("création d'organisation", () => {
  test("copie tous les modèles de rôles et fait de l'appelant le propriétaire", async () => {
    const t = setup();
    const org = await openOrganization(t, "fatou@exemple.ci", "Chez Fatou", "Treichville");
    const roles = await org.owner.as.query(api.roles.list, { organizationId: org.organizationId });
    expect(roles.map((r) => r.key).sort()).toEqual(Object.keys(ROLE_TEMPLATES).sort());
    const venue = await org.owner.as.query(api.venues.get, { venueId: org.venueId });
    expect(venue.currency).toBe("XOF");
    expect(venue.timezone).toBe("Africa/Abidjan");
    expect(venue.slug).toBe("treichville");
  });

  test("un pays non pris en charge est refusé", async () => {
    const t = setup();
    const u = await (await import("./setup")).signUp(t, "x@exemple.fr");
    await expectCode(
      u.as.mutation(api.organizations.create, {
        name: "Bistrot",
        countryCode: "FR",
        venue: { name: "Paris", venueType: "restaurant" },
      }),
      "INVALID_ARGUMENT",
    );
  });

  test("sans session, tout est refusé", async () => {
    const t = setup();
    await expectCode(t.query(api.organizations.listMine, {}), "UNAUTHENTICATED");
    expect(await t.query(api.users.me, {})).toBeNull();
  });
});
