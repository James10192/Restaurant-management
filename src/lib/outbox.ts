/**
 * File d'écriture hors ligne — Joliba (D-062)
 *
 * Les gestes de service ne partent jamais directement : ils entrent dans une file PERSISTANTE
 * (IndexedDB), qui les envoie un par un, dans l'ordre, par appareil. La file de Convex, elle,
 * vit en mémoire : un onglet rechargé ou tué par Android la perdrait.
 *
 * Règles :
 *  - chaque geste a un `opId` (UUIDv7) qui EST sa clé d'idempotence : le renvoyer ne double rien ;
 *  - « Envoyé » ne s'affiche qu'après confirmation du serveur ;
 *  - un refus métier (le serveur a répondu non) n'est jamais renvoyé ; ce qui en dépend est refusé
 *    avec lui, et tout part dans « À régulariser » ;
 *  - au-delà de 3 minutes, une commande ne repart PAS seule en cuisine : elle a pu être faite sur
 *    papier. Elle attend qu'une personne choisisse (déjà préparée, envoyer, annuler) ;
 *  - au-delà de 6 heures, plus rien ne part : un gérant relit.
 *
 * Le cœur est pur et ne connaît ni Convex ni IndexedDB : il se teste en mémoire.
 */

export const AUTO_SEND_MAX_MS = 3 * 60_000;
export const REPLAY_MAX_MS = 6 * 60 * 60_000;

/**
 * Les gestes dont l'heure fait les délais du service (D-164) : ils partent avec leur ÂGE, mesuré
 * sur l'horloge de l'appareil entre le geste et l'envoi. Un âge ne demande aucune horloge calée
 * sur le serveur : il vaut dès le démarrage hors ligne, et un appareil à la mauvaise heure le
 * mesure juste. Le serveur y reconnaît un geste rejoué au retour du réseau.
 */
const AGED_MUTATIONS: ReadonlySet<string> = new Set(["kitchen:advance", "orders:serveTicket"]);

export type OutboxStatus = "pending" | "sending" | "confirmed" | "rejected" | "needs_review";

export type OutboxEntry = {
  opId: string;
  /** Heure du geste sur l'appareil, calée sur le serveur quand l'écart est connu. */
  createdAt: number;
  /** Heure du geste sur l'horloge BRUTE de l'appareil : l'écart peut changer avant l'envoi. */
  deviceAt?: number;
  /** Le nom de la mutation Convex, `module:fonction`. */
  mutation: string;
  args: Record<string, unknown>;
  /** Les `opId` des gestes dont celui-ci dépend (la table doit être ouverte avant d'y commander). */
  dependsOn: string[];
  /** Une commande que la cuisine doit recevoir : elle ne repart pas seule après 3 minutes. */
  goesToKitchen: boolean;
  /** Ce qu'on montre dans la liste : « Table 4 — 3 articles ». */
  label: string;
  status: OutboxStatus;
  attempts: number;
  error?: { code: string; message: string };
  result?: unknown;
  /** Quand le serveur a confirmé : c'est de là que court le délai d'affichage « envoyé ». */
  confirmedAt?: number;
};

export type SendOutcome =
  | { kind: "ok"; result: unknown }
  | { kind: "rejected"; code: string; message: string }
  | { kind: "network" }
  /** Le serveur l'a jugé trop vieux pour partir seul (plus de 3 min) : une personne décide. */
  | { kind: "review" };

/** UUIDv7 : horodaté, donc trié dans l'ordre des gestes, et unique sans coordination. */
export function uuidv7(now = Date.now(), random: (bytes: Uint8Array) => Uint8Array = (b) => crypto.getRandomValues(b)): string {
  const bytes = random(new Uint8Array(16));
  let ts = now;
  for (let i = 5; i >= 0; i--) {
    bytes[i] = ts % 256;
    ts = Math.floor(ts / 256);
  }
  bytes[6] = (bytes[6]! & 0x0f) | 0x70;
  bytes[8] = (bytes[8]! & 0x3f) | 0x80;
  const hex = [...bytes].map((b) => b.toString(16).padStart(2, "0")).join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

export type DrainStep = { action: "send"; entry: OutboxEntry } | { action: "review"; entry: OutboxEntry; why: "stale_kitchen" | "too_old" } | null;

/**
 * Le prochain pas. Le plus ancien geste en attente d'abord ; s'il dépend d'un geste qui n'est pas
 * confirmé, on attend (l'ordre compte : pas de commande avant l'ouverture de sa table).
 */
export function nextStep(entries: readonly OutboxEntry[], now: number): DrainStep {
  const ordered = [...entries].sort((a, b) => a.createdAt - b.createdAt || a.opId.localeCompare(b.opId));
  const confirmed = new Set(ordered.filter((e) => e.status === "confirmed").map((e) => e.opId));
  const present = new Set(ordered.map((e) => e.opId));
  // Une dépendance absente de la file est réglée : confirmée puis purgée, ou abandonnée à la
  // main (le serveur refusera alors ce qui en dépend). L'attendre bloquerait toute la file.
  const settled = (opId: string) => confirmed.has(opId) || !present.has(opId);
  for (const entry of ordered) {
    if (entry.status !== "pending") continue;
    const age = now - entry.createdAt;
    if (age > REPLAY_MAX_MS) return { action: "review", entry, why: "too_old" };
    if (entry.goesToKitchen && age > AUTO_SEND_MAX_MS) return { action: "review", entry, why: "stale_kitchen" };
    if (entry.dependsOn.every(settled)) return { action: "send", entry };
    // Une dépendance encore en attente passera avant ; une dépendance à relire bloque ce geste aussi.
    return null;
  }
  return null;
}

/** Un refus emporte tout ce qui en dépend, directement ou non. */
export function cascadeRejection(entries: readonly OutboxEntry[], opId: string, error: { code: string; message: string }): OutboxEntry[] {
  const rejected = new Set([opId]);
  let grew = true;
  while (grew) {
    grew = false;
    for (const e of entries) {
      if (!rejected.has(e.opId) && e.status !== "confirmed" && e.dependsOn.some((d) => rejected.has(d))) {
        rejected.add(e.opId);
        grew = true;
      }
    }
  }
  return entries.map((e) =>
    rejected.has(e.opId)
      ? { ...e, status: "rejected" as const, error: e.opId === opId ? error : { code: "DEPENDENCY_REJECTED", message: "Dépend d'un geste refusé." } }
      : e,
  );
}

/* ────────────────────────────────────────────────────────────────────────────
 * Stockage
 * ──────────────────────────────────────────────────────────────────────────── */

export interface OutboxStore {
  all(): Promise<OutboxEntry[]>;
  put(entry: OutboxEntry): Promise<void>;
  remove(opId: string): Promise<void>;
}

export class MemoryOutboxStore implements OutboxStore {
  private entries = new Map<string, OutboxEntry>();
  async all() {
    return [...this.entries.values()].map((e) => ({ ...e }));
  }
  async put(entry: OutboxEntry) {
    this.entries.set(entry.opId, { ...entry });
  }
  async remove(opId: string) {
    this.entries.delete(opId);
  }
}

/** IndexedDB, sans bibliothèque : une base, un magasin, la clé est `opId`. */
export class IndexedDbOutboxStore implements OutboxStore {
  constructor(private readonly name = "joliba-outbox") {}

  private open(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.name, 1);
      request.onupgradeneeded = () => request.result.createObjectStore("entries", { keyPath: "opId" });
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  private async run<T>(mode: IDBTransactionMode, body: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
    const db = await this.open();
    try {
      return await new Promise<T>((resolve, reject) => {
        const tx = db.transaction("entries", mode);
        const request = body(tx.objectStore("entries"));
        tx.oncomplete = () => resolve(request.result);
        tx.onerror = () => reject(tx.error);
        tx.onabort = () => reject(tx.error);
      });
    } finally {
      db.close();
    }
  }

  all() {
    return this.run("readonly", (s) => s.getAll() as IDBRequest<OutboxEntry[]>);
  }
  async put(entry: OutboxEntry) {
    await this.run("readwrite", (s) => s.put(entry));
  }
  async remove(opId: string) {
    await this.run("readwrite", (s) => s.delete(opId));
  }
}

/* ────────────────────────────────────────────────────────────────────────────
 * La file
 * ──────────────────────────────────────────────────────────────────────────── */

/** Ce qu'on garde des gestes confirmés : de quoi dire « envoyé » quelques instants, pas un historique. */
const CONFIRMED_KEPT_MS = 60_000;

export class Outbox {
  private running: Promise<void> | null = null;
  private again = false;
  private listeners = new Set<(entries: OutboxEntry[]) => void>();
  private disposed = false;

  constructor(
    private readonly store: OutboxStore,
    private readonly send: (entry: OutboxEntry) => Promise<SendOutcome>,
    private readonly clock: () => number = () => Date.now(),
    private readonly deviceClock: () => number = () => Date.now(),
  ) {}

  /**
   * Au démarrage : un geste resté « en cours d'envoi » a été interrompu (onglet fermé, téléphone
   * éteint). Il redevient « en attente » — le renvoyer est sans risque, il porte sa clé.
   */
  async recover(): Promise<void> {
    for (const e of await this.store.all()) {
      if (e.status === "sending") await this.store.put({ ...e, status: "pending" });
    }
    await this.notify();
    void this.drain();
  }

  /**
   * Arrête la file : plus aucun envoi ne part d'elle. Sur un appareil partagé, la file d'Awa
   * s'arrête quand Koffi déverrouille — sinon sa boucle, encore en cours, continuerait avec
   * l'identité de Koffi.
   */
  dispose(): void {
    this.disposed = true;
    this.listeners.clear();
  }

  subscribe(listener: (entries: OutboxEntry[]) => void): () => void {
    this.listeners.add(listener);
    void this.store.all().then(listener);
    return () => this.listeners.delete(listener);
  }

  private async notify() {
    const entries = await this.store.all();
    for (const l of this.listeners) l(entries);
  }

  /** Met un geste dans la file et tente l'envoi. Renvoie son `opId`. */
  async enqueue(input: Pick<OutboxEntry, "mutation" | "args" | "label"> & { dependsOn?: string[]; goesToKitchen?: boolean; opId?: string }): Promise<string> {
    const now = this.clock();
    const entry: OutboxEntry = {
      opId: input.opId ?? uuidv7(now),
      createdAt: now,
      deviceAt: this.deviceClock(),
      mutation: input.mutation,
      args: input.args,
      dependsOn: input.dependsOn ?? [],
      goesToKitchen: input.goesToKitchen ?? false,
      label: input.label,
      status: "pending",
      attempts: 0,
    };
    await this.store.put(entry);
    await this.notify();
    void this.drain();
    return entry.opId;
  }

  /**
   * Envoie ce qui peut l'être, un geste à la fois. Un appel pendant un envoi en cours attend ce
   * même envoi (et le relance une fois s'il reste du travail) ; une coupure l'arrête net.
   */
  drain(): Promise<void> {
    if (this.running) {
      this.again = true;
      return this.running;
    }
    this.running = (async () => {
      try {
        let blocked = false;
        do {
          this.again = false;
          blocked = await this.drainOnce();
        } while (this.again && !blocked);
      } finally {
        this.running = null;
      }
    })();
    return this.running;
  }

  /** Renvoie `true` si le réseau a manqué. */
  private async drainOnce(): Promise<boolean> {
    for (;;) {
      if (this.disposed) return true;
      const now = this.clock();
      const entries = await this.store.all();
      const needed = new Set(entries.filter((e) => e.status !== "confirmed").flatMap((e) => e.dependsOn));
      for (const e of entries) {
        if (e.status === "confirmed" && !needed.has(e.opId) && now - (e.confirmedAt ?? e.createdAt) > CONFIRMED_KEPT_MS) await this.store.remove(e.opId);
      }
      const step = nextStep(entries, now);
      if (!step) return false;
      if (step.action === "review") {
        await this.store.put({ ...step.entry, status: "needs_review" });
        await this.notify();
        continue;
      }
      await this.store.put({ ...step.entry, status: "sending", attempts: step.entry.attempts + 1 });
      await this.notify();
      const outcome = await this.send(step.entry);
      if (outcome.kind === "network") {
        await this.store.put({ ...step.entry, status: "pending", attempts: step.entry.attempts + 1 });
        await this.notify();
        return true;
      }
      if (outcome.kind === "review") {
        await this.store.put({ ...step.entry, status: "needs_review", attempts: step.entry.attempts + 1 });
      } else if (outcome.kind === "ok") {
        await this.store.put({ ...step.entry, status: "confirmed", attempts: step.entry.attempts + 1, result: outcome.result, confirmedAt: this.clock() });
      } else {
        const all = cascadeRejection(await this.store.all(), step.entry.opId, { code: outcome.code, message: outcome.message });
        for (const e of all) await this.store.put(e);
      }
      await this.notify();
    }
  }

  /**
   * Décider d'un geste à régulariser. `send` : il repart tel quel ; `send_as` : il repart avec
   * d'autres arguments (« déjà préparée ») ; `drop` : il est abandonné.
   */
  async resolve(opId: string, decision: { kind: "send" } | { kind: "send_as"; args: Record<string, unknown> } | { kind: "drop" }): Promise<void> {
    const entry = (await this.store.all()).find((e) => e.opId === opId);
    if (!entry || (entry.status !== "needs_review" && entry.status !== "rejected")) return;
    if (decision.kind === "drop") {
      await this.store.remove(opId);
    } else {
      // Décidé à l'instant par une personne : ce n'est plus un envoi automatique en retard.
      const args = decision.kind === "send_as" ? decision.args : entry.args;
      await this.store.put({ ...entry, args, status: "pending", goesToKitchen: false, error: undefined });
    }
    await this.notify();
    void this.drain();
  }
}

/** Une commande que la cuisine devrait avoir et n'a pas : « annoncez-la » (D-062). */
export const ANNOUNCE_AFTER_MS = 45_000;

export function needsAnnouncing(entry: OutboxEntry, now: number): boolean {
  return entry.goesToKitchen && (entry.status === "pending" || entry.status === "sending") && now - entry.createdAt > ANNOUNCE_AFTER_MS;
}

/**
 * Ce qui part au serveur : les arguments du geste, plus son âge pour les gestes de délai. Un geste
 * mis en file avant cette version (sans `deviceAt`) part sans âge : le serveur ne conclut à rien.
 */
export function argsForSend(entry: OutboxEntry, deviceNow: number): Record<string, unknown> {
  if (!AGED_MUTATIONS.has(entry.mutation) || entry.deviceAt === undefined) return entry.args;
  return { ...entry.args, ageMs: Math.max(0, deviceNow - entry.deviceAt) };
}
