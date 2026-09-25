import { createContext, useContext, useMemo, type ReactNode } from "react";
import { useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import type { Permission } from "../../../convex/lib/permissions";
import { formatMoney, type CurrencyCode } from "../../../convex/lib/money";

/**
 * Le cadre des écrans de service : dans quel établissement, au nom de qui, avec quels droits.
 *
 * Les mêmes écrans servent sur le téléphone d'un gérant connecté (`/app/service`) et sur un
 * appareil enrôlé où l'on s'identifie par son PIN (`/appareil`). Les droits viennent du serveur
 * (`operators.me`) : sous PIN, ils sont déjà plafonnés. L'écran s'en sert pour masquer, jamais
 * pour protéger.
 */
export type ServiceScope = {
  venueId: Id<"venues">;
  venueName: string;
  venueSlug: string;
  currency: string;
  timezone: string;
  via: "account" | "pin" | "device";
  memberId: Id<"organizationMembers"> | null;
  name: string | null;
  stationId: Id<"prepStations"> | null;
  can: (permission: Permission) => boolean;
  /**
   * Les arguments de toute mutation du service : l'établissement, et la personne qui fait le
   * geste. Sur une tablette partagée, un geste resté en attente ne repart jamais sous le nom de
   * celui qui a déverrouillé après (D-062) : le serveur compare.
   */
  acting: { venueId: Id<"venues">; actingMemberId?: Id<"organizationMembers"> };
  /** Aller d'un écran de service à l'autre, quelle que soit la route qui les héberge. */
  nav: ServiceNav;
  /** Sur un appareil partagé : rendre la main (écran de verrouillage). */
  lock?: () => void;
};

export type ServiceNav = {
  board: () => void;
  table: (tableId: Id<"restaurantTables">) => void;
  /** La caisse : ouvrir, sortir de l'argent, compter, clôturer (T3). */
  cash: () => void;
  /** Les disponibilités de la carte : absent sur une tablette partagée, qui n'a pas la carte. */
  availability?: () => void;
};

const ServiceScopeContext = createContext<ServiceScope | null>(null);

export function ServiceScopeProvider({
  venueId,
  nav,
  lock,
  children,
  fallback,
}: {
  venueId: Id<"venues">;
  nav: ServiceNav;
  lock?: () => void;
  children: ReactNode;
  fallback: ReactNode;
}) {
  const me = useQuery(api.operators.me, { venueId });
  const scope = useMemo<ServiceScope | null>(() => {
    if (!me) return null;
    const permissions = new Set<string>(me.permissions);
    return {
      venueId,
      venueName: me.venueName,
      venueSlug: me.venueSlug,
      currency: me.currency,
      timezone: me.timezone,
      via: me.via,
      memberId: me.memberId,
      name: me.name,
      stationId: me.stationId,
      can: (p) => permissions.has(p),
      acting: { venueId, ...(me.memberId ? { actingMemberId: me.memberId } : {}) },
      nav,
      ...(lock ? { lock } : {}),
    };
  }, [me, venueId, nav, lock]);
  if (!scope) return <>{fallback}</>;
  return <ServiceScopeContext.Provider value={scope}>{children}</ServiceScopeContext.Provider>;
}

export function useServiceScope(): ServiceScope {
  const scope = useContext(ServiceScopeContext);
  if (!scope) throw new Error("useServiceScope hors d'un ServiceScopeProvider");
  return scope;
}

/** Un montant dans la devise de l'établissement, par le seul formateur autorisé (D-004). */
export function useMoney(): (amount: number) => string {
  const { currency } = useServiceScope();
  return useMemo(() => (amount: number) => formatMoney({ amount, currency: currency as CurrencyCode }), [currency]);
}
