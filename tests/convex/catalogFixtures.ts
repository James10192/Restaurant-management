/**
 * Un restaurant avec une vraie carte — pour les tests de la tranche T1.
 *
 * « Maquis Awa » : deux établissements (Cocody, Plateau), une carte « Carte » à trois
 * sections à Cocody, quelques produits réalistes, et une équipe : un responsable de carte
 * SANS droit sur les prix (rôle personnalisé), un chef de rang et un serveur.
 */

import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import { inviteAndJoin, openOrganization, setup } from "./setup";

export async function restaurantWithMenu() {
  const t = setup();
  const org = await openOrganization(t, "awa@maquis.ci", "Maquis Awa", "Cocody");
  const cocody = org.venueId;
  const plateau = await org.owner.as.mutation(api.venues.create, {
    organizationId: org.organizationId,
    name: "Plateau",
    venueType: "maquis",
  });
  const owner = org.owner;
  const menuId = await owner.as.mutation(api.menus.create, { venueId: cocody, name: "Carte" });
  const [entrees, grillades, boissons] = (await owner.as.mutation(api.menus.createSections, {
    venueId: cocody,
    menuId,
    names: ["Entrées", "Grillades", "Boissons"],
  })) as [Id<"menuSections">, Id<"menuSections">, Id<"menuSections">];
  const create = (menuSectionId: Id<"menuSections">, name: string, basePrice: number, description?: string) =>
    owner.as.mutation(api.products.create, {
      venueId: cocody,
      menuSectionId,
      name,
      basePrice,
      ...(description ? { description } : {}),
    });
  const alloco = await create(entrees, "Alloco", 1000, "Bananes plantain frites");
  const poulet = await create(grillades, "Poulet braisé", 3500, "Riz, alloco, piment");
  const poisson = await create(grillades, "Poisson braisé", 5000);
  const bissap = await create(boissons, "Bissap", 500);

  const editorRoleId = await owner.as.mutation(api.roles.create, {
    organizationId: org.organizationId,
    label: "Rédacteur de carte",
    permissions: ["venue.read", "menu.read", "menu.edit"],
  });
  const editor = await inviteAndJoin(
    t,
    owner,
    { organizationId: org.organizationId, roleId: editorRoleId, venueIds: [cocody] },
    { email: "redaction@maquis.ci" },
  );
  const floor = await inviteAndJoin(
    t,
    owner,
    { organizationId: org.organizationId, roleId: org.roleId("floor_manager"), venueIds: [cocody] },
    { email: "rang@maquis.ci" },
  );
  const waiter = await inviteAndJoin(
    t,
    owner,
    { organizationId: org.organizationId, roleId: org.roleId("waiter"), venueIds: [cocody] },
    { email: "serveur@maquis.ci" },
  );
  return {
    t,
    ...org,
    cocody,
    plateau,
    menuId,
    sections: { entrees, grillades, boissons },
    products: { alloco, poulet, poisson, bissap },
    editor,
    floor,
    waiter,
  };
}

export type Restaurant = Awaited<ReturnType<typeof restaurantWithMenu>>;
