import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useConvex } from "convex/react";
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

export function OutboxProvider({ children }: { children: ReactNode }) {
  const convex = useConvex();
  const scope = useServiceScope();
  const key = `${scope.venueId}:${scope.memberId ?? scope.via}`;
  const connectedRef = useRef(true);

  const outbox = useMemo(() => {
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
        // Une réponse « refusé ligne par ligne » (plat épuisé…) est un refus métier : il ne repart pas.
        if (isRefusal(result)) return { kind: "rejected", code: "CONFLICT", message: result.problems.map((p) => p.message).join(" ") };
        return { kind: "ok", result };
      } catch (error) {
        if (!(error instanceof ConvexError)) {
          // Délai dépassé ou coupure : la clé d'idempotence rend le renvoi sans danger.
          if (error instanceof Error && error.message === "timeout") return { kind: "network" };
          if (!connectedRef.current) return { kind: "network" };
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
    return new Outbox(storeFor(key), send);
  }, [convex, key]);

  const [entries, setEntries] = useState<OutboxEntry[]>([]);
  const [connected, setConnected] = useState(true);
  const [offlineSince, setOfflineSince] = useState<number | null>(null);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
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
        void outbox.drain();
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
  }, [convex, outbox]);

  // Une horloge lente : les messages « annoncez-la » et « service dégradé » dépendent du temps.
  const busy = offlineSince !== null || entries.some((e) => e.status === "pending" || e.status === "sending");
  useEffect(() => {
    if (!busy) return;
    const id = setInterval(() => {
      setNow(Date.now());
      // Un envoi tombé en délai dépassé ne se relance pas seul : on retente tant qu'il reste du travail.
      if (connectedRef.current) void outbox.drain();
    }, 5_000);
    return () => clearInterval(id);
  }, [busy, outbox]);

  const enqueue = useCallback<Outbox["enqueue"]>((input) => outbox.enqueue(input), [outbox]);
  const resolve = useCallback<Outbox["resolve"]>((opId, decision) => outbox.resolve(opId, decision), [outbox]);

  const value = useMemo<OutboxContextValue>(
    () => ({ entries, online: connected, offlineFor: offlineSince === null ? 0 : Math.max(0, now - offlineSince), enqueue, resolve }),
    [entries, connected, offlineSince, now, enqueue, resolve],
  );
  return <OutboxContext.Provider value={value}>{children}</OutboxContext.Provider>;
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
