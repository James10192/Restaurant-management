import { describe, expect, test } from "vitest";
import { cascadeRejection, MemoryOutboxStore, nextStep, Outbox, uuidv7, type OutboxEntry, type SendOutcome } from "../../src/lib/outbox";

const T0 = 1_790_000_000_000;

function entry(opId: string, createdAt: number, extra: Partial<OutboxEntry> = {}): OutboxEntry {
  return { opId, createdAt, mutation: "orders:submit", args: {}, dependsOn: [], goesToKitchen: false, label: opId, status: "pending", attempts: 0, ...extra };
}

describe("UUIDv7", () => {
  test("version 7, variante RFC, trié dans l'ordre des gestes", () => {
    const a = uuidv7(T0);
    const b = uuidv7(T0 + 1);
    expect(a).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
    expect(a < b).toBe(true);
  });
});

describe("le prochain pas", () => {
  test("le plus ancien d'abord, et jamais avant sa dépendance", () => {
    const open = entry("open", T0, { mutation: "sessions:open" });
    const order = entry("order", T0 + 1000, { dependsOn: ["open"], goesToKitchen: true });
    expect(nextStep([order, open], T0 + 2000)).toMatchObject({ action: "send", entry: { opId: "open" } });
    expect(nextStep([order, { ...open, status: "sending" }], T0 + 2000)).toBeNull();
    expect(nextStep([order, { ...open, status: "confirmed" }], T0 + 2000)).toMatchObject({ action: "send", entry: { opId: "order" } });
  });

  test("une commande de plus de 3 minutes ne repart pas seule en cuisine", () => {
    const order = entry("order", T0, { goesToKitchen: true });
    expect(nextStep([order], T0 + 3 * 60_000 + 1)).toMatchObject({ action: "review", why: "stale_kitchen" });
    // Un geste sans cuisine (servir, ouvrir) repart, lui.
    expect(nextStep([entry("serve", T0)], T0 + 10 * 60_000)).toMatchObject({ action: "send" });
  });

  test("au-delà de 6 heures, plus rien ne part", () => {
    expect(nextStep([entry("serve", T0)], T0 + 6 * 60 * 60_000 + 1)).toMatchObject({ action: "review", why: "too_old" });
  });
});

describe("un refus emporte ce qui en dépend", () => {
  test("directement et en cascade, mais pas ce qui est déjà confirmé", () => {
    const entries = [
      entry("open", T0),
      entry("order", T0 + 1, { dependsOn: ["open"] }),
      entry("fire", T0 + 2, { dependsOn: ["order"] }),
      entry("other", T0 + 3),
    ];
    const out = cascadeRejection(entries, "open", { code: "CONFLICT", message: "Table hors service." });
    expect(out.map((e) => [e.opId, e.status, e.error?.code])).toEqual([
      ["open", "rejected", "CONFLICT"],
      ["order", "rejected", "DEPENDENCY_REJECTED"],
      ["fire", "rejected", "DEPENDENCY_REJECTED"],
      ["other", "pending", undefined],
    ]);
  });
});

describe("la file", () => {
  function harness(responses: SendOutcome[]) {
    let now = T0;
    const sent: string[] = [];
    const store = new MemoryOutboxStore();
    const outbox = new Outbox(
      store,
      async (e) => {
        sent.push(e.opId);
        return responses.shift() ?? { kind: "ok", result: null };
      },
      () => now,
    );
    return { outbox, store, sent, advance: (ms: number) => (now += ms) };
  }

  test("envoie dans l'ordre, un par un, et persiste l'état", async () => {
    const h = harness([]);
    const open = await h.outbox.enqueue({ mutation: "sessions:open", args: {}, label: "Table 4", opId: "a" });
    await h.outbox.enqueue({ mutation: "orders:submit", args: {}, label: "Table 4 — 2 articles", dependsOn: [open], goesToKitchen: true, opId: "b" });
    await h.outbox.drain();
    expect(h.sent).toEqual(["a", "b"]);
    expect((await h.store.all()).map((e) => e.status)).toEqual(["confirmed", "confirmed"]);
  });

  test("une coupure laisse le geste en attente, sans rien perdre ; il repart au retour", async () => {
    const h = harness([{ kind: "network" }]);
    await h.outbox.enqueue({ mutation: "orders:serveTicket", args: {}, label: "Servir", opId: "a" });
    await h.outbox.drain();
    expect((await h.store.all())[0]).toMatchObject({ status: "pending", attempts: 1 });
    await h.outbox.drain();
    expect((await h.store.all())[0]).toMatchObject({ status: "confirmed", attempts: 2 });
  });

  test("après 3 minutes, la commande attend une décision ; « déjà préparée » la renvoie autrement", async () => {
    const h = harness([{ kind: "network" }]);
    await h.outbox.enqueue({ mutation: "orders:submit", args: { recordOnly: false }, label: "Table 4", goesToKitchen: true, opId: "a" });
    await h.outbox.drain(); // coupure : rien n'est parti
    h.advance(4 * 60_000);
    await h.outbox.drain();
    expect((await h.store.all())[0]!.status).toBe("needs_review");
    await h.outbox.resolve("a", { kind: "send_as", args: { recordOnly: true } });
    await h.outbox.drain();
    expect((await h.store.all())[0]).toMatchObject({ status: "confirmed", args: { recordOnly: true } });
  });

  test("un refus métier n'est jamais renvoyé ; « abandonner » le retire", async () => {
    const h = harness([{ kind: "rejected", code: "CONFLICT", message: "Table clôturée." }]);
    await h.outbox.enqueue({ mutation: "orders:submit", args: {}, label: "Table 4", opId: "a" });
    await h.outbox.drain();
    await h.outbox.drain();
    expect(h.sent).toEqual(["a"]);
    expect((await h.store.all())[0]).toMatchObject({ status: "rejected", error: { code: "CONFLICT" } });
    await h.outbox.resolve("a", { kind: "drop" });
    expect(await h.store.all()).toEqual([]);
  });

  test("une dépendance confirmée puis purgée ne bloque pas la file", async () => {
    const h = harness([]);
    await h.outbox.enqueue({ mutation: "sessions:open", args: {}, label: "Table 2", opId: "a" });
    await h.outbox.drain();
    // La commande qui en dépend attend une décision ; entre-temps, la minute passe.
    await h.store.put({ ...entry("b", T0, { status: "needs_review" }), dependsOn: ["a"], goesToKitchen: true });
    h.advance(2 * 60_000);
    await h.outbox.drain();
    expect((await h.store.all()).map((e) => e.opId)).toContain("a"); // gardée : on en dépend encore
    await h.store.remove("a"); // même purgée…
    await h.outbox.resolve("b", { kind: "send_as", args: { lateConfirmed: true } });
    await h.outbox.enqueue({ mutation: "orders:serveTicket", args: {}, label: "Servir", opId: "c" });
    await h.outbox.drain();
    // …la commande part, et le geste suivant aussi.
    expect(h.sent).toEqual(["a", "b", "c"]);
  });

  test("un geste jugé trop vieux par le serveur attend une décision, sans rien emporter", async () => {
    const h = harness([{ kind: "review" }]);
    await h.outbox.enqueue({ mutation: "orders:submit", args: {}, label: "Table 4", goesToKitchen: true, opId: "a" });
    await h.outbox.drain();
    expect((await h.store.all())[0]!.status).toBe("needs_review");
  });

  test("une file arrêtée n'envoie plus rien", async () => {
    const h = harness([]);
    h.outbox.dispose();
    await h.outbox.enqueue({ mutation: "orders:serveTicket", args: {}, label: "Servir", opId: "a" });
    await h.outbox.drain();
    expect(h.sent).toEqual([]);
  });

  test("au redémarrage, un geste interrompu en plein envoi repart", async () => {
    const store = new MemoryOutboxStore();
    await store.put(entry("a", T0, { status: "sending", attempts: 1 }));
    const sent: string[] = [];
    const outbox = new Outbox(store, async (e) => (sent.push(e.opId), { kind: "ok", result: null }), () => T0 + 1000);
    await outbox.recover();
    await outbox.drain();
    expect(sent).toEqual(["a"]);
    expect((await store.all())[0]!.status).toBe("confirmed");
  });
});
