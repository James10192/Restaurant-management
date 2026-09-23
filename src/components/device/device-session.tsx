import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { ConvexProvider, ConvexReactClient } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { convexUrl } from "~/lib/convex-client";
import { describeError } from "~/lib/errors";

/**
 * Un appareil enrôlé : tablette de salle partagée, téléphone personnel, écran de cuisine (D-060).
 *
 * Il a SON client Convex, distinct de celui des comptes : ce qu'il présente au serveur n'est pas
 * une session Better Auth mais un jeton d'opérateur de 10 minutes (ou, pour un écran de cuisine,
 * un jeton d'appareil). Le jeton d'appareil vit dans le stockage local ; le secret de
 * renouvellement d'une personne, lui, ne vit qu'en mémoire : recharger la page, c'est se
 * réidentifier.
 */

const TOKEN_KEY = "joliba.appareil";
/** On renouvelle le jeton une minute avant son échéance. */
const REFRESH_MARGIN_MS = 60_000;

export type Roster = FunctionReturnType<typeof api.operators.roster>;
type Operator = { memberId: Id<"organizationMembers">; name: string };

export type UnlockRefusal =
  | { ok: false; reason: "wrong_pin"; attemptsLeft: number }
  | { ok: false; reason: "locked" | "device_suspended"; retryAfter: number }
  | { ok: false; reason: "pin_unavailable" | "not_here" };

type DeviceContextValue = {
  client: ConvexReactClient;
  deviceToken: string | null;
  roster: Roster | null;
  /** Le jeton d'appareil a été refusé (appareil révoqué) : il faut enrôler de nouveau. */
  revoked: boolean;
  operator: Operator | null;
  /** Écran de cuisine : prêt dès que son jeton d'appareil est accepté. */
  kdsReady: boolean;
  enroll: (code: string) => Promise<{ ok: true } | { ok: false; message: string }>;
  unlock: (memberId: Id<"organizationMembers">, pin: string) => Promise<{ ok: true } | UnlockRefusal>;
  lock: () => void;
  forget: () => void;
};

const DeviceContext = createContext<DeviceContextValue | null>(null);

function readToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

export function DeviceProvider({ children }: { children: ReactNode }) {
  const [client] = useState(() => new ConvexReactClient(convexUrl(), { unsavedChangesWarning: false }));
  const [deviceToken, setDeviceToken] = useState<string | null>(readToken);
  const [roster, setRoster] = useState<Roster | null>(null);
  const [revoked, setRevoked] = useState(false);
  const [operator, setOperator] = useState<Operator | null>(null);
  const [kdsReady, setKdsReady] = useState(false);
  // Le jeton courant et le secret : en mémoire seulement, jamais dans le stockage.
  const auth = useRef<{ token: string; expiresAt: number; refreshSecret: string } | null>(null);

  // Le tableau de verrouillage : qui peut s'identifier ici. Refusé = appareil révoqué.
  useEffect(() => {
    if (!deviceToken) return;
    const watch = client.watchQuery(api.operators.roster, { deviceToken });
    const read = () => {
      try {
        const value = watch.localQueryResult();
        if (value) setRoster(value);
      } catch (error) {
        if (describeError(error).code === "UNAUTHENTICATED") setRevoked(true);
      }
    };
    read();
    return watch.onUpdate(read);
  }, [client, deviceToken]);

  const endAuth = useCallback(() => {
    auth.current = null;
    client.clearAuth();
    setOperator(null);
    setKdsReady(false);
  }, [client]);

  const startAuth = useCallback(
    (initial: { token: string; expiresAt: number; refreshSecret: string }, onReady: () => void) => {
      if (!deviceToken) return;
      auth.current = initial;
      client.setAuth(
        async ({ forceRefreshToken }) => {
          const current = auth.current;
          if (!current) return null;
          if (!forceRefreshToken && current.expiresAt - Date.now() > REFRESH_MARGIN_MS) return current.token;
          try {
            const next = await client.action(api.operators.refresh, { deviceToken, refreshSecret: current.refreshSecret });
            if (!next.ok) {
              // Session fermée (verrou, révocation, 12 h) : retour à l'écran de verrouillage.
              setTimeout(endAuth, 0);
              return null;
            }
            auth.current = { ...current, token: next.token, expiresAt: next.expiresAt };
            return next.token;
          } catch {
            // Pas de réseau : on garde le jeton courant, Convex réessaiera.
            return current.token;
          }
        },
        (isAuthenticated) => {
          if (isAuthenticated) onReady();
        },
      );
    },
    [client, deviceToken, endAuth],
  );

  // Écran de cuisine : aucune personne, l'appareil agit en son nom (jeton d'appareil).
  useEffect(() => {
    if (!deviceToken || roster?.deviceType !== "kds" || auth.current) return;
    let cancelled = false;
    void client.action(api.operators.refresh, { deviceToken, refreshSecret: "" }).then((result) => {
      if (cancelled || !result.ok) return;
      startAuth({ token: result.token, expiresAt: result.expiresAt, refreshSecret: "" }, () => setKdsReady(true));
    });
    return () => {
      cancelled = true;
    };
  }, [client, deviceToken, roster?.deviceType, startAuth]);

  const enroll = useCallback<DeviceContextValue["enroll"]>(
    async (code) => {
      try {
        const result = await client.mutation(api.devices.enroll, { code });
        if (!result.ok) {
          return {
            ok: false,
            message: result.reason === "rate_limited" ? "Trop d'essais. Patientez une minute." : "Ce code n'est pas valable : il a pu expirer (10 minutes) ou servir déjà.",
          };
        }
        try {
          localStorage.setItem(TOKEN_KEY, result.deviceToken);
        } catch {
          return { ok: false, message: "Cet appareil refuse le stockage local : il ne peut pas être enrôlé en navigation privée." };
        }
        setRevoked(false);
        setRoster(null);
        setDeviceToken(result.deviceToken);
        return { ok: true };
      } catch (error) {
        return { ok: false, message: describeError(error).message };
      }
    },
    [client],
  );

  const unlock = useCallback<DeviceContextValue["unlock"]>(
    async (memberId, pin) => {
      if (!deviceToken) return { ok: false, reason: "not_here" };
      const result = await client.action(api.operators.unlock, { deviceToken, memberId, pin });
      if (!result.ok) return result;
      const who = { memberId: result.memberId, name: result.name };
      startAuth({ token: result.token, expiresAt: result.expiresAt, refreshSecret: result.refreshSecret }, () => setOperator(who));
      return { ok: true };
    },
    [client, deviceToken, startAuth],
  );

  const lock = useCallback(() => {
    if (deviceToken) void client.mutation(api.operators.lock, { deviceToken }).catch(() => undefined);
    endAuth();
  }, [client, deviceToken, endAuth]);

  const forget = useCallback(() => {
    try {
      localStorage.removeItem(TOKEN_KEY);
    } catch {
      /* rien à oublier */
    }
    endAuth();
    setRoster(null);
    setRevoked(false);
    setDeviceToken(null);
  }, [endAuth]);

  // Appareil partagé : l'écran se reverrouille seul après une minute sans geste.
  const idleMs = roster?.idleLockMs ?? 60_000;
  useEffect(() => {
    if (!operator) return;
    let timer = setTimeout(lock, idleMs);
    const reset = () => {
      clearTimeout(timer);
      timer = setTimeout(lock, idleMs);
    };
    const events = ["pointerdown", "keydown", "touchstart", "scroll"] as const;
    for (const e of events) window.addEventListener(e, reset, { passive: true });
    return () => {
      clearTimeout(timer);
      for (const e of events) window.removeEventListener(e, reset);
    };
  }, [operator, idleMs, lock]);

  const value = useMemo<DeviceContextValue>(
    () => ({ client, deviceToken, roster, revoked, operator, kdsReady, enroll, unlock, lock, forget }),
    [client, deviceToken, roster, revoked, operator, kdsReady, enroll, unlock, lock, forget],
  );
  return (
    <DeviceContext.Provider value={value}>
      <ConvexProvider client={client}>{children}</ConvexProvider>
    </DeviceContext.Provider>
  );
}

export function useDevice(): DeviceContextValue {
  const value = useContext(DeviceContext);
  if (!value) throw new Error("useDevice hors d'un DeviceProvider");
  return value;
}
