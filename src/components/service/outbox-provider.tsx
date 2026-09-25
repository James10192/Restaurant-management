import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useConvex } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { makeFunctionReference } from "convex/server";
import { ConvexError } from "convex/values";
import { describeError } from "~/lib/errors";
import {
  AUTO_SEND_MAX_MS,
  IndexedDbOutboxStore,
  MemoryOutboxStore,
  Outbox,
  needsAnnouncing,
  type OutboxEntry,
  type SendOutcome,
} from "~/lib/outbox";
import { useServiceScope } from "./service-scope";

/**
 * La file d'envoi des gestes de service, branchée sur le client Convex de l'écran (D-062).
 *
 * Une file PAR PERSONNE ET PAR ÉTABLISSEMENT : sur un appareil partagé, ce que Awa a saisi
 * hors ligne ne doit jamais partir sous le nom de Koffi, qui a déverrouillé après elle. Ses
 * gestes attendent qu'elle revienne ; ils restent visibles dans « À régulariser ».
 */

/** Au-delà, on considère que la requête ne partira pas : le client Convex garde en mémoire, sans jamais échouer. */
const SEND_TIMEOUT_MS = 15_000;
/** Une erreur qui n'est ni un refus métier ni une coupure : on retente, mais pas sans fin. */
const UNKNOWN_ERROR_ATTEMPTS = 5;
/** Les gestes datés : le serveur refuse ce qui a plus de 3 minutes sans décision humaine (D-062). */
const DATED = new Set(["orders:submit", "orders:fireCourse"]);
/**
 * Les gestes dont l'heure fait les délais : rejoués au retour du réseau, ils se reconnaissent à
 * leur heure (D-163). Datés seulement quand l'écart d'horloge est MESURÉ : sur une horloge non
 * recalée, chaque geste passerait pour un rejeu, ou aucun (D-164).
 */
const TIMED = new Set(["kitchen:advance", "orders:serveTicket"]);
/** Tant que l'écart n'est pas mesuré, on le redemande. */
const CLOCK_RETRY_MS = 30_000;

type OutboxContextValue = {
  entries: OutboxEntry[];
  /** Le réseau répond-il ? `null` tant qu'on ne sait pas. */
  online: boolean;
  /** Depuis quand le réseau manque (ms), ou 0. */
  offlineFor: number;
  enqueue: Outbox["enqueue"];
  resolve: Outbox["resolve"];
};

const OutboxContext = createContext<OutboxContextValue | null>(null);

function storeFor(key: string) {
  if (typeof indexedDB === "undefined") return new MemoryOutboxStore();
  return new IndexedDbOutboxStore(`joliba-outbox:${key}`);
}

/** Les coupures de cet appareil, gardées sur l'appareil : de quoi décider de la voie 2 sur des faits. */
const OUTAGES_KEY = "joliba.coupures";
function recordOutage(startedAt: number, endedAt: number) {
  try {
    const list = JSON.parse(localStorage.getItem(OUTAGES_KEY) ?? "[]") as [number, number][];
    list.push([startedAt, endedAt]);
    localStorage.setItem(OUTAGES_KEY, JSON.stringify(list.slice(-200)));
  } catch {
    /* sans stockage, la mesure est perdue ; le service, lui, continue */
  }
}

function isRefusal(result: unknown): result is { ok: false; problems: { message: string }[] } {
  return typeof result === "object" && result !== null && (result as { ok?: unknown }).ok === false && Array.isArray((result as { problems?: unknown }).problems);
}

function isLate(result: unknown): boolean {
  return typeof result === "object" && result !== null && (result as { late?: unknown }).late === true;
}

export function OutboxProvider({ children }: { children: ReactNode }) {
  const convex = useConvex();
  const scope = useServiceScope();
  const key = `${scope.venueId}:${scope.memberId ?? scope.via}`;
  const connectedRef = useRef(true);
  // Écart entre l'horloge de l'appareil et celle du serveur : les gestes sont datés à l'heure du
  // serveur, sinon une tablette en retard de dix minutes enverrait tout « à relire ».
  const offsetRef = useRef(0);
  const clockMeasuredRef = useRef(false);
  const clock = useCallback(() => Date.now() + offsetRef.current, []);

  // Créée dans un effet, pas dans un `useMemo` : l'effet qui l'arrête doit pouvoir la recréer
  // (React monte deux fois en développement ; une file arrêtée n'enverrait plus jamais rien).
  const [outbox, setOutbox] = useState<Outbox | null>(null);
  const outboxRef = useRef<Outbox | null>(null);
  useEffect(() => {
    const send = async (entry: OutboxEntry): Promise<SendOutcome> => {
      if (!connectedRef.current) return { kind: "network" };
      const ref = makeFunctionReference<"mutation">(entry.mutation);
      let timer: ReturnType<typeof setTimeout> | undefined;
      try {
        const result = await Promise.race([
          convex.mutation(ref, entry.args),
          new Promise<never>((_, reject) => {
            timer = setTimeout(() => reject(new Error("timeout")), SEND_TIMEOUT_MS);
          }),
        ]);
        if (isLate(result)) return { kind: "review" };
        // Une réponse « refusé ligne par ligne » (plat épuisé…) est un refus métier : il ne repart pas.
        if (isRefusal(result)) return { kind: "rejected", code: "CONFLICT", message: result.problems.map((p) => p.message).join(" ") };
        return { kind: "ok", result };
      } catch (error) {
        if (!(error instanceof ConvexError)) {
          // Délai dépassé ou coupure : la clé d'idempotence rend le renvoi sans danger.
          if (error instanceof Error && error.message === "timeout") return { kind: "network" };
          if (!connectedRef.current || entry.attempts + 1 < UNKNOWN_ERROR_ATTEMPTS) return { kind: "network" };
          return { kind: "rejected", code: "UNKNOWN", message: describeError(error).message };
        }
        const { code, message } = describeError(error);
        // Jeton d'opérateur expiré : ce n'est pas un refus du geste, il repartira une fois déverrouillé.
        if (code === "UNAUTHENTICATED") return { kind: "network" };
        return { kind: "rejected", code, message };
      } finally {
        clearTimeout(timer);
      }
    };
    const created = new Outbox(storeFor(key), send, clock);
    outboxRef.current = created;
    setOutbox(created);
    // Une file par personne : quand la personne change, l'ancienne file s'arrête net.
    return () => created.dispose();
  }, [convex, key, clock]);

  const [entries, setEntries] = useState<OutboxEntry[]>([]);
  const [connected, setConnected] = useState(true);
  const [offlineSince, setOfflineSince] = useState<number | null>(null);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!outbox) return;
    const unsubscribe = outbox.subscribe((list) => setEntries([...list].sort((a, b) => a.createdAt - b.createdAt)));
    void outbox.recover();
    return unsubscribe;
  }, [outbox]);

  useEffect(() => {
    let since: number | null = null;
    const apply = (isConnected: boolean) => {
      const was = connectedRef.current;
      connectedRef.current = isConnected;
      setConnected(isConnected);
      if (!isConnected && was) {
        since = Date.now();
        setOfflineSince(since);
      }
      if (isConnected && !was) {
        if (since !== null) recordOutage(since, Date.now());
        since = null;
        setOfflineSince(null);
        void outboxRef.current?.drain();
      }
    };
    // Deux signaux : la liaison Convex (lente à constater une coupure, battement de cœur) et le
    // navigateur (immédiat quand le téléphone perd le réseau). Tant que la première connexion
    // n'est pas établie, on ne crie pas à la coupure.
    let socket = true;
    const update = () => apply(socket && navigator.onLine);
    const initial = convex.connectionState();
    if (initial.hasEverConnected) socket = initial.isWebSocketConnected;
    update();
    const unsubscribe = convex.subscribeToConnectionState((state) => {
      if (!state.hasEverConnected) return;
      socket = state.isWebSocketConnected;
      update();
    });
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    return () => {
      unsubscribe();
      window.removeEventListener("online", update);
      window.removeEventListener("offline", update);
    };
  }, [convex]);

  // L'écart d'horloge se mesure à chaque retour du réseau — une tablette démarrée pendant une
  // coupure n'a rien pu mesurer —, et se redemande tant qu'il manque.
  useEffect(() => {
    if (!connected) return;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const measure = () => {
      const sentAt = Date.now();
      convex
        .mutation(api.operators.touch, { venueId: scope.venueId })
        .then(({ now }) => {
          if (cancelled) return;
          // L'heure du serveur, au milieu de l'aller-retour.
          offsetRef.current = now - (sentAt + (Date.now() - sentAt) / 2);
          clockMeasuredRef.current = true;
        })
        .catch(() => {
          if (!cancelled) timer = setTimeout(measure, CLOCK_RETRY_MS);
        });
    };
    measure();
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [convex, scope.venueId, connected]);

  // Une horloge lente : les messages « annoncez-la » et « service dégradé » dépendent du temps.
  const busy = offlineSince !== null || entries.some((e) => e.status === "pending" || e.status === "sending");
  useEffect(() => {
    if (!busy) return;
    const id = setInterval(() => {
      setNow(Date.now());
      // Un envoi tombé en délai dépassé ne se relance pas seul : on retente tant qu'il reste du travail.
      if (connectedRef.current) void outboxRef.current?.drain();
    }, 5_000);
    return () => clearInterval(id);
  }, [busy]);

  // Chaque geste porte la personne qui l'a fait, et les gestes de cuisine leur heure : c'est le
  // serveur qui refuse un geste parti sous un autre nom, ou trop tard pour partir seul.
  const memberId = scope.memberId;
  const enqueue = useCallback<Outbox["enqueue"]>(
    (input) => {
      if (!outbox) throw new Error("File d'envoi pas encore prête.");
      return outbox.enqueue({
        ...input,
        args: {
          ...input.args,
          ...(memberId ? { actingMemberId: memberId } : {}),
          ...(DATED.has(input.mutation) || (TIMED.has(input.mutation) && clockMeasuredRef.current) ? { clientCreatedAt: clock() } : {}),
        },
      });
    },
    [outbox, memberId, clock],
  );
  const resolve = useCallback<Outbox["resolve"]>(async (opId, decision) => outbox?.resolve(opId, decision), [outbox]);

  const value = useMemo<OutboxContextValue>(
    () => ({ entries, online: connected, offlineFor: offlineSince === null ? 0 : Math.max(0, now - offlineSince), enqueue, resolve }),
    [entries, connected, offlineSince, now, enqueue, resolve],
  );
  if (!outbox) return null;
  return <OutboxContext.Provider value={value}>{children}</OutboxContext.Provider>;
}

/** Hors d'un fournisseur (écran de réglages…), `null` : on suppose le réseau présent. */
export function useOptionalOutbox(): OutboxContextValue | null {
  return useContext(OutboxContext);
}

export function useOutbox(): OutboxContextValue {
  const value = useContext(OutboxContext);
  if (!value) throw new Error("useOutbox hors d'un OutboxProvider");
  return value;
}

/** Ce qui demande une décision humaine : refusé, ou trop vieux pour repartir seul. */
export function useToRegularize(): OutboxEntry[] {
  const { entries } = useOutbox();
  return entries.filter((e) => e.status === "rejected" || e.status === "needs_review");
}

/** Les commandes que la cuisine n'a pas reçues depuis 45 s : il faut les annoncer de vive voix. */
export function useUnannounced(): OutboxEntry[] {
  const { entries } = useOutbox();
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 5_000);
    return () => clearInterval(id);
  }, []);
  return entries.filter((e) => needsAnnouncing(e, now));
}

export { AUTO_SEND_MAX_MS };
