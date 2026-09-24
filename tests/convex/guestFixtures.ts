import { api } from "../../convex/_generated/api";
import { restaurantWithMenu } from "./catalogFixtures";

/** Une table scannée : le laissez-passer du QR, et des téléphones qui s'en servent. */
export async function tableWithGuest() {
  const r = await restaurantWithMenu();
  const { owner, cocody } = r;
  await owner.as.mutation(api.publications.publish, { venueId: cocody, menuId: r.menuId });
  const [areaId] = await owner.as.mutation(api.floor.createAreas, { venueId: cocody, names: ["Salle"] });
  const tableId = await owner.as.mutation(api.floor.createTable, { venueId: cocody, serviceAreaId: areaId!, number: "1", seats: 4, shape: "square" });
  await owner.as.mutation(api.stations.create, { venueId: cocody, name: "Cuisine", type: "kitchen" });
  const sheet = await owner.as.query(api.qr.sheet, { venueId: cocody });
  const scanned = await r.t.mutation(api.guest.exchange, { token: sheet.areas[0]!.cards[0]!.token });
  if (!scanned.ok) throw new Error("scan refusé");
  const as = (guestKey: string) => ({ pass: scanned.pass, venueSlug: scanned.venueSlug, guestKey });
  return { ...r, tableId, as };
}

export type GuestTable = Awaited<ReturnType<typeof tableWithGuest>>;

export function line(productId: string, quantity = 1) {
  return { productId, optionIds: [], quantity };
}
