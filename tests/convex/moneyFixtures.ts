/**
 * Un restaurant prêt à encaisser — fixtures partagées par les tests de l'argent (T3) et des
 * chiffres (T6). « Maquis Awa », Cocody : deux tables, une cuisine, une caissière.
 */

import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import { restaurantWithMenu } from "./catalogFixtures";
import { inviteAndJoin } from "./setup";

export async function venue() {
  const r = await restaurantWithMenu();
  const { owner, cocody } = r;
  await owner.as.mutation(api.publications.publish, { venueId: cocody, menuId: r.menuId });
  const [areaId] = await owner.as.mutation(api.floor.createAreas, { venueId: cocody, names: ["Terrasse"] });
  const table = (number: string) =>
    owner.as.mutation(api.floor.createTable, { venueId: cocody, serviceAreaId: areaId!, number, seats: 4, shape: "square" });
  const tableId = await table("1");
  const table2 = await table("2");
  await owner.as.mutation(api.stations.create, { venueId: cocody, name: "Cuisine", type: "kitchen" });
  const cashier = await inviteAndJoin(
    r.t,
    owner,
    { organizationId: r.organizationId, roleId: r.roleId("cashier"), venueIds: [cocody] },
    { email: "caisse@maquis.ci" },
  );
  await owner.as.mutation(api.cash.setPaymentSettings, {
    venueId: cocody,
    cashMode: "central",
    mobileMoneyWallets: ["Wave", "Orange Money"],
    amountStep: 25,
    serviceDayStartHour: 4,
  });
  return { ...r, tableId, table2, cashier };
}

export type Venue = Awaited<ReturnType<typeof venue>>;

let keySeq = 0;
export const key = () => `test-argent-${String(++keySeq).padStart(8, "0")}`;

/** 2 poulets (7 000), 1 poisson (5 000), 3 bissap (1 500) : 13 500. */
export async function tableWithOrder(v: Venue, tableId = v.tableId) {
  const sessionId = await v.waiter.as.mutation(api.sessions.open, { venueId: v.cocody, tableId });
  const sent = await v.waiter.as.mutation(api.orders.submit, {
    venueId: v.cocody,
    sessionId,
    lines: [
      { productId: v.products.poulet, optionIds: [], quantity: 2, courseNumber: 1 },
      { productId: v.products.poisson, optionIds: [], quantity: 1, courseNumber: 1 },
      { productId: v.products.bissap, optionIds: [], quantity: 3, courseNumber: 1 },
    ],
    heldCourses: [],
    idempotencyKey: key(),
  });
  if (!sent.ok) throw new Error(JSON.stringify(sent));
  const items = await v.t.run((ctx) => ctx.db.query("orderItems").withIndex("by_order", (q) => q.eq("orderId", sent.orderId)).collect());
  const byName = (name: string) => items.find((i) => i.nameSnapshot === name)!._id;
  return { sessionId, orderId: sent.orderId, poulet: byName("Poulet braisé"), poisson: byName("Poisson braisé"), bissap: byName("Bissap") };
}

export async function serveAll(v: Venue, orderId: Id<"orders">) {
  const tickets = await v.t.run((ctx) => ctx.db.query("kitchenTickets").withIndex("by_order", (q) => q.eq("orderId", orderId)).collect());
  for (const t of tickets) {
    await v.owner.as.mutation(api.kitchen.advance, { venueId: v.cocody, ticketId: t._id, action: "ready" });
    await v.waiter.as.mutation(api.orders.serveTicket, { venueId: v.cocody, ticketId: t._id });
  }
}

export async function collect(
  v: Venue,
  sessionId: Id<"tableSessions">,
  input: { method: "cash" | "mobile_money" | "card"; amount: number; checkId?: Id<"checks"> | null; receivedAmount?: number; changeAmount?: number; wallet?: string },
  who = v.cashier,
) {
  const r = await who.as.mutation(api.payments.collect, { venueId: v.cocody, sessionId, checkId: input.checkId ?? null, idempotencyKey: key(), ...input });
  if (!r.ok) throw new Error(JSON.stringify(r));
  return r;
}
