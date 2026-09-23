import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import type { Permission } from "../../../convex/lib/permissions";

/**
 * Le contexte de travail : quelle organisation, quel établissement, et ce que l'utilisateur
 * y peut faire. Les permissions viennent du SERVEUR (`organizations.get`,
 * `organizations.venueAccess`) — l'écran s'en sert pour masquer, jamais pour protéger.
 *
 * Le choix est mémorisé sur l'appareil. Un choix mémorisé qui ne correspond plus à rien
 * (organisation quittée, établissement retiré) est ignoré au lieu de produire une erreur.
 */

type OrganizationSummary = { _id: Id<"organizations">; name: string; slug: string; isOwner: boolean };
type VenueSummary = { _id: Id<"venues">; name: string; slug: string; status: string };

export type Workspace = {
  status: "loading" | "no-organization" | "ready";
  organizations: OrganizationSummary[];
  organization: (OrganizationSummary & { venues: VenueSummary[] }) | null;
  venue: VenueSummary | null;
  /** Droit au niveau de l'organisation (créer un établissement, composer les rôles…). */
  canInOrganization: (permission: Permission) => boolean;
  /** Droit dans l'établissement courant. */
  canInVenue: (permission: Permission) => boolean;
  selectOrganization: (id: Id<"organizations">) => void;
  selectVenue: (id: Id<"venues">) => void;
};

const WorkspaceContext = createContext<Workspace | null>(null);

const ORG_KEY = "joliba.organisation";
const venueKey = (orgId: string) => `joliba.etablissement.${orgId}`;

function read(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}
function write(key: string, value: string) {
  try {
    localStorage.setItem(key, value);
  } catch {
    /* sans stockage, le choix ne survit simplement pas au rechargement */
  }
}

export function WorkspaceProvider({ children }: { children: ReactNode }) {
  const organizations = useQuery(api.organizations.listMine, {});
  const [preferredOrg, setPreferredOrg] = useState<string | null>(null);
  const [preferredVenue, setPreferredVenue] = useState<string | null>(null);

  useEffect(() => setPreferredOrg(read(ORG_KEY)), []);

  const organizationId = useMemo(() => {
    if (!organizations || organizations.length === 0) return null;
    return (organizations.find((o) => o._id === preferredOrg) ?? organizations[0]!)._id;
  }, [organizations, preferredOrg]);

  useEffect(() => {
    if (organizationId) setPreferredVenue(read(venueKey(organizationId)));
  }, [organizationId]);

  const organization = useQuery(api.organizations.get, organizationId ? { organizationId } : "skip");

  const venue = useMemo(() => {
    if (!organization || organization.venues.length === 0) return null;
    return organization.venues.find((v) => v._id === preferredVenue) ?? organization.venues[0]!;
  }, [organization, preferredVenue]);

  const venueAccess = useQuery(api.organizations.venueAccess, venue ? { venueId: venue._id } : "skip");

  const orgPermissions = useMemo(() => new Set(organization?.permissions ?? []), [organization]);
  const venuePermissions = useMemo(
    () => new Set(venueAccess && venue && venueAccess.venueId === venue._id ? venueAccess.permissions : []),
    [venueAccess, venue],
  );

  const selectOrganization = useCallback((id: Id<"organizations">) => {
    write(ORG_KEY, id);
    setPreferredOrg(id);
  }, []);
  const selectVenue = useCallback(
    (id: Id<"venues">) => {
      if (organizationId) write(venueKey(organizationId), id);
      setPreferredVenue(id);
    },
    [organizationId],
  );

  const status: Workspace["status"] =
    organizations === undefined
      ? "loading"
      : organizations.length === 0
        ? "no-organization"
        : organization === undefined || (venue !== null && venueAccess === undefined)
          ? "loading"
          : "ready";

  const value: Workspace = {
    status,
    organizations: organizations ?? [],
    organization: organization
      ? { _id: organization._id, name: organization.name, slug: organization.slug, isOwner: organization.isOwner, venues: organization.venues }
      : null,
    venue,
    canInOrganization: (p) => orgPermissions.has(p),
    canInVenue: (p) => venuePermissions.has(p),
    selectOrganization,
    selectVenue,
  };
  return <WorkspaceContext.Provider value={value}>{children}</WorkspaceContext.Provider>;
}

export function useWorkspace(): Workspace {
  const context = useContext(WorkspaceContext);
  if (!context) throw new Error("useWorkspace doit être utilisé sous WorkspaceProvider.");
  return context;
}
