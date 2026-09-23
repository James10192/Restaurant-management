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
import type { Id } from "../../convex/_generated/dataModel";
import { expectCode, inviteAndJoin, modules, openOrganization, setup, type Session } from "./setup";

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
  const catalogA = await catalogFor(a.owner, a.venueId, "A");
  const catalogB = await catalogFor(b.owner, b.venueId, "B");
  const ruleB = await b.owner.as.mutation(api.availability.createRule, {
    venueId: b.venueId,
    targetType: "product",
    targetId: catalogB.productId,
    ruleType: "available",
    daysOfWeek: [1, 2, 3, 4, 5],
    startMinute: 420,
    endMinute: 660,
  });
  const floorA = await floorFor(a.owner, a.venueId);
  const floorB = await floorFor(b.owner, b.venueId);
  return { t, a, b, venueA2, waiterA, waiterB, pendingB, invitationB, catalogA, catalogB, ruleB, floorA, floorB };
}

/** Une zone et une table, avec son QR. */
async function floorFor(owner: Session, venueId: Id<"venues">) {
  const [areaId] = await owner.as.mutation(api.floor.createAreas, { venueId, names: ["Salle"] });
  const tableId = await owner.as.mutation(api.floor.createTable, {
    venueId,
    serviceAreaId: areaId!,
    number: "1",
    seats: 4,
    shape: "square",
  });
  const sheet = await owner.as.query(api.qr.sheet, { venueId });
  return { areaId: areaId!, tableId, token: sheet.areas[0]!.cards[0]!.token };
}

/** Une carte complète et publiée : section, produit, variante, groupe d'options. */
async function catalogFor(owner: Session, venueId: Id<"venues">, tag: string) {
  const menuId = await owner.as.mutation(api.menus.create, { venueId, name: `Carte ${tag}` });
  const [sectionId] = await owner.as.mutation(api.menus.createSections, { venueId, menuId, names: [`Plats ${tag}`] });
  const productId = await owner.as.mutation(api.products.create, {
    venueId,
    menuSectionId: sectionId!,
    name: `Plat ${tag}`,
    basePrice: 2000,
  });
  const variantId = await owner.as.mutation(api.products.addVariant, { venueId, productId, name: "Grand", price: 3000 });
  const groupId = await owner.as.mutation(api.modifiers.createGroup, {
    venueId,
    name: `Cuisson ${tag}`,
    selectionType: "single",
    minSelect: 0,
    maxSelect: 1,
    isRequired: false,
    options: [
      { name: "Saignant", priceDelta: 0 },
      { name: "À point", priceDelta: 0 },
    ],
  });
  await owner.as.mutation(api.products.setModifierGroups, { venueId, productId, modifierGroupIds: [groupId] });
  const optionId = (await owner.as.query(api.modifiers.list, { venueId }))[0]!.options[0]!._id;
  await owner.as.mutation(api.publications.publish, { venueId, menuId });
  const [publication] = await owner.as.query(api.publications.history, { venueId, menuId });
  return { menuId, sectionId: sectionId!, productId, variantId, groupId, optionId, publicationId: publication!._id };
}

/** Les deux formes de franchissement : l'établissement de B, puis le sien avec un objet de B. */
async function bothRefused(viaForeignVenue: Promise<unknown>, viaCrossedId: Promise<unknown>) {
  await expectCode(viaForeignVenue, "NOT_FOUND");
  await expectCode(viaCrossedId, "NOT_FOUND");
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
  /* ─── Carte ─── */
  "menus.list": async ({ a, b }) => {
    await expectCode(a.owner.as.query(api.menus.list, { venueId: b.venueId }), "NOT_FOUND");
  },
  "menus.editor": async ({ a, b, catalogB }) => {
    await bothRefused(
      a.owner.as.query(api.menus.editor, { venueId: b.venueId, menuId: catalogB.menuId }),
      a.owner.as.query(api.menus.editor, { venueId: a.venueId, menuId: catalogB.menuId }),
    );
  },
  "menus.sectionChoices": async ({ a, b }) => {
    await expectCode(a.owner.as.query(api.menus.sectionChoices, { venueId: b.venueId }), "NOT_FOUND");
  },
  "menus.create": async ({ a, b }) => {
    await expectCode(a.owner.as.mutation(api.menus.create, { venueId: b.venueId, name: "Intrus" }), "NOT_FOUND");
  },
  "menus.update": async ({ a, b, catalogB }) => {
    await bothRefused(
      a.owner.as.mutation(api.menus.update, { venueId: b.venueId, menuId: catalogB.menuId, name: "Piraté" }),
      a.owner.as.mutation(api.menus.update, { venueId: a.venueId, menuId: catalogB.menuId, name: "Piraté" }),
    );
  },
  "menus.archive": async ({ a, b, catalogB }) => {
    await bothRefused(
      a.owner.as.mutation(api.menus.archive, { venueId: b.venueId, menuId: catalogB.menuId }),
      a.owner.as.mutation(api.menus.archive, { venueId: a.venueId, menuId: catalogB.menuId }),
    );
  },
  "menus.reorder": async ({ a, b, catalogA, catalogB }) => {
    await bothRefused(
      a.owner.as.mutation(api.menus.reorder, { venueId: b.venueId, menuIds: [catalogB.menuId] }),
      a.owner.as.mutation(api.menus.reorder, { venueId: a.venueId, menuIds: [catalogA.menuId, catalogB.menuId] }),
    );
  },
  "menus.createSections": async ({ a, b, catalogB }) => {
    await bothRefused(
      a.owner.as.mutation(api.menus.createSections, { venueId: b.venueId, menuId: catalogB.menuId, names: ["X"] }),
      a.owner.as.mutation(api.menus.createSections, { venueId: a.venueId, menuId: catalogB.menuId, names: ["X"] }),
    );
  },
  "menus.updateSection": async ({ a, b, catalogB }) => {
    await bothRefused(
      a.owner.as.mutation(api.menus.updateSection, { venueId: b.venueId, sectionId: catalogB.sectionId, name: "X" }),
      a.owner.as.mutation(api.menus.updateSection, { venueId: a.venueId, sectionId: catalogB.sectionId, name: "X" }),
    );
  },
  "menus.reorderSections": async ({ a, b, catalogA, catalogB }) => {
    await bothRefused(
      a.owner.as.mutation(api.menus.reorderSections, { venueId: b.venueId, menuId: catalogB.menuId, sectionIds: [catalogB.sectionId] }),
      a.owner.as.mutation(api.menus.reorderSections, {
        venueId: a.venueId,
        menuId: catalogA.menuId,
        sectionIds: [catalogA.sectionId, catalogB.sectionId],
      }),
    );
  },
  "products.list": async ({ a, b }) => {
    await expectCode(a.owner.as.query(api.products.list, { venueId: b.venueId }), "NOT_FOUND");
    const mine = await a.owner.as.query(api.products.list, { venueId: a.venueId, search: "Plat" });
    expect(mine.map((p) => p.name)).toEqual(["Plat A"]);
  },
  "products.get": async ({ a, b, catalogB }) => {
    await bothRefused(
      a.owner.as.query(api.products.get, { venueId: b.venueId, productId: catalogB.productId }),
      a.owner.as.query(api.products.get, { venueId: a.venueId, productId: catalogB.productId }),
    );
  },
  "products.create": async ({ a, b, catalogB }) => {
    await bothRefused(
      a.owner.as.mutation(api.products.create, { venueId: b.venueId, menuSectionId: catalogB.sectionId, name: "X", basePrice: 1 }),
      a.owner.as.mutation(api.products.create, { venueId: a.venueId, menuSectionId: catalogB.sectionId, name: "X", basePrice: 1 }),
    );
  },
  "products.update": async ({ a, b, catalogA, catalogB }) => {
    await bothRefused(
      a.owner.as.mutation(api.products.update, { venueId: b.venueId, productId: catalogB.productId, name: "Piraté" }),
      a.owner.as.mutation(api.products.update, { venueId: a.venueId, productId: catalogB.productId, name: "Piraté" }),
    );
    // Son produit, rangé dans la section de B, ou lié à un produit de B.
    await expectCode(
      a.owner.as.mutation(api.products.update, { venueId: a.venueId, productId: catalogA.productId, menuSectionId: catalogB.sectionId }),
      "NOT_FOUND",
    );
    await expectCode(
      a.owner.as.mutation(api.products.update, { venueId: a.venueId, productId: catalogA.productId, relatedProductIds: [catalogB.productId] }),
      "NOT_FOUND",
    );
  },
  "products.setPrice": async ({ a, b, catalogB }) => {
    await bothRefused(
      a.owner.as.mutation(api.products.setPrice, { venueId: b.venueId, productId: catalogB.productId, basePrice: 1 }),
      a.owner.as.mutation(api.products.setPrice, { venueId: a.venueId, productId: catalogB.productId, basePrice: 1 }),
    );
  },
  "products.setActive": async ({ a, b, catalogB }) => {
    await bothRefused(
      a.owner.as.mutation(api.products.setActive, { venueId: b.venueId, productId: catalogB.productId, isActive: false }),
      a.owner.as.mutation(api.products.setActive, { venueId: a.venueId, productId: catalogB.productId, isActive: false }),
    );
  },
  "products.reorder": async ({ a, b, catalogA, catalogB }) => {
    await bothRefused(
      a.owner.as.mutation(api.products.reorder, { venueId: b.venueId, menuSectionId: catalogB.sectionId, productIds: [catalogB.productId] }),
      a.owner.as.mutation(api.products.reorder, {
        venueId: a.venueId,
        menuSectionId: catalogA.sectionId,
        productIds: [catalogA.productId, catalogB.productId],
      }),
    );
  },
  "products.duplicate": async ({ a, b, catalogB }) => {
    await bothRefused(
      a.owner.as.mutation(api.products.duplicate, { venueId: b.venueId, productId: catalogB.productId }),
      a.owner.as.mutation(api.products.duplicate, { venueId: a.venueId, productId: catalogB.productId }),
    );
  },
  "products.addVariant": async ({ a, b, catalogB }) => {
    await bothRefused(
      a.owner.as.mutation(api.products.addVariant, { venueId: b.venueId, productId: catalogB.productId, name: "X", price: 1 }),
      a.owner.as.mutation(api.products.addVariant, { venueId: a.venueId, productId: catalogB.productId, name: "X", price: 1 }),
    );
  },
  "products.updateVariant": async ({ a, b, catalogB }) => {
    await bothRefused(
      a.owner.as.mutation(api.products.updateVariant, { venueId: b.venueId, variantId: catalogB.variantId, name: "X" }),
      a.owner.as.mutation(api.products.updateVariant, { venueId: a.venueId, variantId: catalogB.variantId, name: "X" }),
    );
  },
  "products.setVariantPrice": async ({ a, b, catalogB }) => {
    await bothRefused(
      a.owner.as.mutation(api.products.setVariantPrice, { venueId: b.venueId, variantId: catalogB.variantId, price: 1 }),
      a.owner.as.mutation(api.products.setVariantPrice, { venueId: a.venueId, variantId: catalogB.variantId, price: 1 }),
    );
  },
  "products.removeVariant": async ({ a, b, catalogB }) => {
    await bothRefused(
      a.owner.as.mutation(api.products.removeVariant, { venueId: b.venueId, variantId: catalogB.variantId }),
      a.owner.as.mutation(api.products.removeVariant, { venueId: a.venueId, variantId: catalogB.variantId }),
    );
  },
  "products.reorderVariants": async ({ a, b, catalogB }) => {
    await bothRefused(
      a.owner.as.mutation(api.products.reorderVariants, { venueId: b.venueId, productId: catalogB.productId, variantIds: [catalogB.variantId] }),
      a.owner.as.mutation(api.products.reorderVariants, { venueId: a.venueId, productId: catalogB.productId, variantIds: [catalogB.variantId] }),
    );
  },
  "products.setModifierGroups": async ({ a, b, catalogA, catalogB }) => {
    await bothRefused(
      a.owner.as.mutation(api.products.setModifierGroups, { venueId: b.venueId, productId: catalogB.productId, modifierGroupIds: [] }),
      a.owner.as.mutation(api.products.setModifierGroups, {
        venueId: a.venueId,
        productId: catalogA.productId,
        modifierGroupIds: [catalogB.groupId],
      }),
    );
  },
  "products.generateUploadUrl": async ({ a, b }) => {
    await expectCode(a.owner.as.mutation(api.products.generateUploadUrl, { venueId: b.venueId }), "NOT_FOUND");
  },
  "products.addImage": async ({ t, a, b, catalogB }) => {
    const file = await t.run((ctx) => ctx.storage.store(new Blob([new Uint8Array([0xff, 0xd8, 0xff, 0])])));
    const args = { storageId: file, thumbStorageId: file, width: 800, height: 600 };
    await bothRefused(
      a.owner.as.action(api.products.addImage, { venueId: b.venueId, productId: catalogB.productId, ...args }),
      a.owner.as.action(api.products.addImage, { venueId: a.venueId, productId: catalogB.productId, ...args }),
    );
    // Refusé, rien n'a été effacé : la garde passe AVANT toute lecture de fichier.
    expect(await t.run((ctx) => ctx.db.system.get(file))).not.toBeNull();
  },
  "products.removeImage": async ({ t, a, b, catalogB }) => {
    const file = await t.run((ctx) => ctx.storage.store(new Blob(["x"])));
    await bothRefused(
      a.owner.as.mutation(api.products.removeImage, { venueId: b.venueId, productId: catalogB.productId, storageId: file }),
      a.owner.as.mutation(api.products.removeImage, { venueId: a.venueId, productId: catalogB.productId, storageId: file }),
    );
  },
  "modifiers.list": async ({ a, b }) => {
    await expectCode(a.owner.as.query(api.modifiers.list, { venueId: b.venueId }), "NOT_FOUND");
    const mine = await a.owner.as.query(api.modifiers.list, { venueId: a.venueId });
    expect(mine.map((g) => g.name)).toEqual(["Cuisson A"]);
  },
  "modifiers.createGroup": async ({ a, b }) => {
    await expectCode(
      a.owner.as.mutation(api.modifiers.createGroup, {
        venueId: b.venueId,
        name: "X",
        selectionType: "single",
        minSelect: 0,
        maxSelect: 1,
        isRequired: false,
        options: [],
      }),
      "NOT_FOUND",
    );
  },
  "modifiers.updateGroup": async ({ a, b, catalogB }) => {
    await bothRefused(
      a.owner.as.mutation(api.modifiers.updateGroup, { venueId: b.venueId, modifierGroupId: catalogB.groupId, name: "X" }),
      a.owner.as.mutation(api.modifiers.updateGroup, { venueId: a.venueId, modifierGroupId: catalogB.groupId, name: "X" }),
    );
  },
  "modifiers.deleteGroup": async ({ a, b, catalogB }) => {
    await bothRefused(
      a.owner.as.mutation(api.modifiers.deleteGroup, { venueId: b.venueId, modifierGroupId: catalogB.groupId }),
      a.owner.as.mutation(api.modifiers.deleteGroup, { venueId: a.venueId, modifierGroupId: catalogB.groupId }),
    );
  },
  "modifiers.addOption": async ({ a, b, catalogB }) => {
    await bothRefused(
      a.owner.as.mutation(api.modifiers.addOption, { venueId: b.venueId, modifierGroupId: catalogB.groupId, name: "X", priceDelta: 0 }),
      a.owner.as.mutation(api.modifiers.addOption, { venueId: a.venueId, modifierGroupId: catalogB.groupId, name: "X", priceDelta: 0 }),
    );
  },
  "modifiers.updateOption": async ({ a, b, catalogB }) => {
    await bothRefused(
      a.owner.as.mutation(api.modifiers.updateOption, { venueId: b.venueId, optionId: catalogB.optionId, name: "X" }),
      a.owner.as.mutation(api.modifiers.updateOption, { venueId: a.venueId, optionId: catalogB.optionId, name: "X" }),
    );
  },
  "modifiers.setOptionPrice": async ({ a, b, catalogB }) => {
    await bothRefused(
      a.owner.as.mutation(api.modifiers.setOptionPrice, { venueId: b.venueId, optionId: catalogB.optionId, priceDelta: 1 }),
      a.owner.as.mutation(api.modifiers.setOptionPrice, { venueId: a.venueId, optionId: catalogB.optionId, priceDelta: 1 }),
    );
  },
  "modifiers.removeOption": async ({ a, b, catalogB }) => {
    await bothRefused(
      a.owner.as.mutation(api.modifiers.removeOption, { venueId: b.venueId, optionId: catalogB.optionId }),
      a.owner.as.mutation(api.modifiers.removeOption, { venueId: a.venueId, optionId: catalogB.optionId }),
    );
  },
  "modifiers.reorderOptions": async ({ a, b, catalogB }) => {
    await bothRefused(
      a.owner.as.mutation(api.modifiers.reorderOptions, { venueId: b.venueId, modifierGroupId: catalogB.groupId, optionIds: [] }),
      a.owner.as.mutation(api.modifiers.reorderOptions, { venueId: a.venueId, modifierGroupId: catalogB.groupId, optionIds: [] }),
    );
  },
  "publications.pendingChanges": async ({ a, b, catalogB }) => {
    await bothRefused(
      a.owner.as.query(api.publications.pendingChanges, { venueId: b.venueId, menuId: catalogB.menuId }),
      a.owner.as.query(api.publications.pendingChanges, { venueId: a.venueId, menuId: catalogB.menuId }),
    );
  },
  "publications.publish": async ({ a, b, catalogB }) => {
    await bothRefused(
      a.owner.as.mutation(api.publications.publish, { venueId: b.venueId, menuId: catalogB.menuId }),
      a.owner.as.mutation(api.publications.publish, { venueId: a.venueId, menuId: catalogB.menuId }),
    );
  },
  "publications.history": async ({ a, b, catalogB }) => {
    await bothRefused(
      a.owner.as.query(api.publications.history, { venueId: b.venueId, menuId: catalogB.menuId }),
      a.owner.as.query(api.publications.history, { venueId: a.venueId, menuId: catalogB.menuId }),
    );
  },
  "publications.rollback": async ({ a, b, catalogA, catalogB }) => {
    await bothRefused(
      a.owner.as.mutation(api.publications.rollback, { venueId: b.venueId, menuId: catalogB.menuId, publicationId: catalogB.publicationId }),
      // Sa carte, la version de B : une publication étrangère ne se remet pas en ligne chez soi.
      a.owner.as.mutation(api.publications.rollback, { venueId: a.venueId, menuId: catalogA.menuId, publicationId: catalogB.publicationId }),
    );
  },
  "availability.board": async ({ a, b }) => {
    await expectCode(a.owner.as.query(api.availability.board, { venueId: b.venueId }), "NOT_FOUND");
  },
  "availability.setProduct": async ({ a, b, catalogB }) => {
    await bothRefused(
      a.owner.as.mutation(api.availability.setProduct, { venueId: b.venueId, productId: catalogB.productId, isAvailable: false }),
      a.owner.as.mutation(api.availability.setProduct, { venueId: a.venueId, productId: catalogB.productId, isAvailable: false }),
    );
  },
  "availability.setVariant": async ({ a, b, catalogB }) => {
    await bothRefused(
      a.owner.as.mutation(api.availability.setVariant, { venueId: b.venueId, variantId: catalogB.variantId, isAvailable: false }),
      a.owner.as.mutation(api.availability.setVariant, { venueId: a.venueId, variantId: catalogB.variantId, isAvailable: false }),
    );
  },
  "availability.setOption": async ({ a, b, catalogB }) => {
    await bothRefused(
      a.owner.as.mutation(api.availability.setOption, { venueId: b.venueId, optionId: catalogB.optionId, isAvailable: false }),
      a.owner.as.mutation(api.availability.setOption, { venueId: a.venueId, optionId: catalogB.optionId, isAvailable: false }),
    );
  },
  "availability.createRule": async ({ a, b, catalogB }) => {
    const rule = { targetType: "product" as const, ruleType: "unavailable" as const, daysOfWeek: [1], startMinute: 0, endMinute: 60 };
    await expectCode(
      a.owner.as.mutation(api.availability.createRule, { venueId: b.venueId, targetId: catalogB.productId, ...rule }),
      "NOT_FOUND",
    );
    // Sa portée, une cible de B : refusée comme cible inconnue, sans confirmer son existence.
    await expectCode(
      a.owner.as.mutation(api.availability.createRule, { venueId: a.venueId, targetId: catalogB.productId, ...rule }),
      "INVALID_ARGUMENT",
    );
  },
  "availability.deleteRule": async ({ a, b, ruleB }) => {
    await bothRefused(
      a.owner.as.mutation(api.availability.deleteRule, { venueId: b.venueId, ruleId: ruleB }),
      a.owner.as.mutation(api.availability.deleteRule, { venueId: a.venueId, ruleId: ruleB }),
    );
  },
  /* ─── Salle et QR ─── */
  "floor.overview": async ({ a, b }) => {
    await expectCode(a.owner.as.query(api.floor.overview, { venueId: b.venueId }), "NOT_FOUND");
  },
  "floor.createAreas": async ({ a, b }) => {
    await expectCode(a.owner.as.mutation(api.floor.createAreas, { venueId: b.venueId, names: ["X"] }), "NOT_FOUND");
  },
  "floor.updateArea": async ({ a, b, floorB }) => {
    await bothRefused(
      a.owner.as.mutation(api.floor.updateArea, { venueId: b.venueId, serviceAreaId: floorB.areaId, name: "X" }),
      a.owner.as.mutation(api.floor.updateArea, { venueId: a.venueId, serviceAreaId: floorB.areaId, name: "X" }),
    );
  },
  "floor.reorderAreas": async ({ a, b, floorA, floorB }) => {
    await bothRefused(
      a.owner.as.mutation(api.floor.reorderAreas, { venueId: b.venueId, serviceAreaIds: [floorB.areaId] }),
      a.owner.as.mutation(api.floor.reorderAreas, { venueId: a.venueId, serviceAreaIds: [floorA.areaId, floorB.areaId] }),
    );
  },
  "floor.deleteArea": async ({ a, b, floorB }) => {
    await bothRefused(
      a.owner.as.mutation(api.floor.deleteArea, { venueId: b.venueId, serviceAreaId: floorB.areaId }),
      a.owner.as.mutation(api.floor.deleteArea, { venueId: a.venueId, serviceAreaId: floorB.areaId }),
    );
  },
  "floor.createTable": async ({ a, b, floorB }) => {
    const table = { number: "99", seats: 2, shape: "round" as const };
    await bothRefused(
      a.owner.as.mutation(api.floor.createTable, { venueId: b.venueId, serviceAreaId: floorB.areaId, ...table }),
      a.owner.as.mutation(api.floor.createTable, { venueId: a.venueId, serviceAreaId: floorB.areaId, ...table }),
    );
  },
  "floor.createTableRange": async ({ a, b, floorB }) => {
    const range = { from: 10, to: 12, seats: 2, shape: "round" as const };
    await bothRefused(
      a.owner.as.mutation(api.floor.createTableRange, { venueId: b.venueId, serviceAreaId: floorB.areaId, ...range }),
      a.owner.as.mutation(api.floor.createTableRange, { venueId: a.venueId, serviceAreaId: floorB.areaId, ...range }),
    );
  },
  "floor.updateTable": async ({ a, b, floorA, floorB }) => {
    await bothRefused(
      a.owner.as.mutation(api.floor.updateTable, { venueId: b.venueId, tableId: floorB.tableId, inService: false }),
      a.owner.as.mutation(api.floor.updateTable, { venueId: a.venueId, tableId: floorB.tableId, inService: false }),
    );
    // Sa table, déplacée dans la zone de B.
    await expectCode(
      a.owner.as.mutation(api.floor.updateTable, { venueId: a.venueId, tableId: floorA.tableId, serviceAreaId: floorB.areaId }),
      "NOT_FOUND",
    );
  },
  "floor.saveLayout": async ({ a, b, floorA, floorB }) => {
    const at = { x: 10, y: 10, width: 80, height: 80, rotation: 0 };
    await bothRefused(
      a.owner.as.mutation(api.floor.saveLayout, { venueId: b.venueId, serviceAreaId: floorB.areaId, tables: [] }),
      a.owner.as.mutation(api.floor.saveLayout, {
        venueId: a.venueId,
        serviceAreaId: floorA.areaId,
        tables: [{ tableId: floorB.tableId, ...at }],
      }),
    );
  },
  "floor.removeTable": async ({ a, b, floorB }) => {
    await bothRefused(
      a.owner.as.mutation(api.floor.removeTable, { venueId: b.venueId, tableId: floorB.tableId }),
      a.owner.as.mutation(api.floor.removeTable, { venueId: a.venueId, tableId: floorB.tableId }),
    );
  },
  "qr.sheet": async ({ a, b, floorB }) => {
    await expectCode(a.owner.as.query(api.qr.sheet, { venueId: b.venueId }), "NOT_FOUND");
    // Sa portée, la zone de B : aucun jeton de B ne sort.
    await expectCode(a.owner.as.query(api.qr.sheet, { venueId: a.venueId, serviceAreaId: floorB.areaId }), "INVALID_ARGUMENT");
  },
  "qr.ensure": async ({ a, b }) => {
    await expectCode(a.owner.as.mutation(api.qr.ensure, { venueId: b.venueId }), "NOT_FOUND");
  },
  "qr.rotate": async ({ a, b, floorB }) => {
    await bothRefused(
      a.owner.as.mutation(api.qr.rotate, { venueId: b.venueId, tableId: floorB.tableId }),
      a.owner.as.mutation(api.qr.rotate, { venueId: a.venueId, tableId: floorB.tableId }),
    );
  },

  /* ─── Surface client ─── */
  "guest.exchange": async ({ t, floorA }) => {
    // Le jeton de A ouvre la table de A, et rien d'autre : le laissez-passer désigne A.
    const result = await t.mutation(api.guest.exchange, { token: floorA.token });
    expect(result).toMatchObject({ ok: true, venueSlug: "maquis-a-cocody" });
  },
  "guest.tableMenu": async ({ t, floorA }) => {
    const result = await t.mutation(api.guest.exchange, { token: floorA.token });
    if (!result.ok) throw new Error("scan refusé");
    // Présenté sous l'adresse de B, le laissez-passer de A ne donne rien.
    expect(await t.query(api.guest.tableMenu, { pass: result.pass, venueSlug: "lounge-b-plateau" })).toBeNull();
    const menu = await t.query(api.guest.tableMenu, { pass: result.pass, venueSlug: result.venueSlug });
    expect(menu?.menus.map((m) => m.menu.name)).toEqual(["Carte A"]);
  },
  "guest.publicMenu": async ({ t }) => {
    // B n'a pas consenti : rien, exactement comme pour un établissement inexistant.
    expect(await t.query(api.guest.publicMenu, { venueSlug: "lounge-b-plateau" })).toBeNull();
    expect(await t.query(api.guest.publicMenu, { venueSlug: "inexistant" })).toBeNull();
  },
  "guest.availability": async ({ t, b }) => {
    // Lecture publique voulue : des indicateurs, aucun nom, aucun prix.
    const live = await t.query(api.guest.availability, { venueId: b.venueId });
    expect(JSON.stringify(live)).not.toContain("Plat B");
    expect(JSON.stringify(live)).not.toContain("2000");
  },
  "venues.publicMenuReadiness": async ({ a, b }) => {
    await expectCode(a.owner.as.query(api.venues.publicMenuReadiness, { venueId: b.venueId }), "NOT_FOUND");
  },
  "guest.sitemap": async ({ t }) => {
    // Aucun des deux n'a consenti : le plan du site est vide.
    expect(await t.query(api.guest.sitemap, {})).toEqual([]);
  },
  /* ─── Import et duplication ─── */
  "menuImport.apply": async ({ a, b, catalogB }) => {
    const rows = [{ line: 2, section: "Intrus", name: "Intrus", price: 1, allergens: [], tags: [] }];
    await bothRefused(
      a.owner.as.mutation(api.menuImport.apply, { venueId: b.venueId, menuId: catalogB.menuId, rows }),
      a.owner.as.mutation(api.menuImport.apply, { venueId: a.venueId, menuId: catalogB.menuId, rows }),
    );
  },
  "menuImport.sources": async ({ a, b }) => {
    await expectCode(a.owner.as.query(api.menuImport.sources, { venueId: b.venueId }), "NOT_FOUND");
    // Depuis son second établissement, A ne voit que ses propres cartes.
    const sources = await a.owner.as.query(api.menuImport.sources, { venueId: a.venueId });
    expect(sources.map((s) => s.venueName)).toEqual([]);
  },
  "menuImport.duplicateFromVenue": async ({ a, b, venueA2, catalogB }) => {
    // Recopier la carte de B chez A : B est hors de portée, la carte est introuvable.
    await expectCode(
      a.owner.as.mutation(api.menuImport.duplicateFromVenue, { venueId: venueA2, sourceVenueId: b.venueId, sourceMenuId: catalogB.menuId }),
      "NOT_FOUND",
    );
    // Son établissement comme source, la carte de B comme menu : introuvable aussi.
    await expectCode(
      a.owner.as.mutation(api.menuImport.duplicateFromVenue, { venueId: venueA2, sourceVenueId: a.venueId, sourceMenuId: catalogB.menuId }),
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
      // Et la carte de B est intacte : produit, prix, disponibilité, version en ligne.
      const productB = await world.b.owner.as.query(api.products.get, { venueId: world.b.venueId, productId: world.catalogB.productId });
      expect([productB.name, productB.basePrice, productB.isActive, productB.isAvailable]).toEqual(["Plat B", 2000, true, true]);
      expect(productB.variants.map((x) => [x.name, x.price])).toEqual([["Grand", 3000]]);
      const groupsB = await world.b.owner.as.query(api.modifiers.list, { venueId: world.b.venueId });
      expect(groupsB.map((g) => [g.name, g.options.map((o) => [o.name, o.priceDelta, o.isAvailable])])).toEqual([
        ["Cuisson B", [["Saignant", 0, true], ["À point", 0, true]]],
      ]);
      const historyB = await world.b.owner.as.query(api.publications.history, { venueId: world.b.venueId, menuId: world.catalogB.menuId });
      expect(historyB.map((h) => [h.version, h.isCurrent])).toEqual([[1, true]]);
      const boardB = await world.b.owner.as.query(api.availability.board, { venueId: world.b.venueId });
      expect(boardB.rules).toHaveLength(1);
      const planB = await world.b.owner.as.query(api.floor.overview, { venueId: world.b.venueId });
      expect(planB.areas.map((a) => [a.name, a.tables.map((x) => [x.number, x.status, x.qr?.version])])).toEqual([
        ["Salle", [["1", "available", 1]]],
      ]);
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
