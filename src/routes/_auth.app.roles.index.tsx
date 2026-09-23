import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "convex/react";
import { Plus } from "lucide-react";
import { api } from "../../convex/_generated/api";
import { useWorkspace } from "~/components/app/workspace";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { Card } from "~/components/ui/card";
import { LoadingState, PermissionDeniedState } from "~/components/ui/states";

export const Route = createFileRoute("/_auth/app/roles/")({
  head: () => ({ meta: [{ title: "Rôles — Joliba" }] }),
  component: RolesPage,
});

function RolesPage() {
  const w = useWorkspace();
  const allowed = w.canInOrganization("permissions.manage");
  const roles = useQuery(api.roles.list, allowed && w.organization ? { organizationId: w.organization._id } : "skip");

  if (!allowed) return <PermissionDeniedState permission="Gérer les rôles et les permissions" />;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-title-xl text-ink">Rôles</h1>
          <p className="max-w-[65ch] text-body text-ink-2">
            Un rôle est un ensemble de droits. Joliba ne demande jamais « est-ce un serveur ? », seulement « a-t-il ce droit
            ici ? » : composez les rôles qui ressemblent à votre maison.
          </p>
        </div>
        <Button asChild>
          <Link to="/app/roles/$roleId" params={{ roleId: "nouveau" }}>
            <Plus aria-hidden="true" className="size-4" />
            Créer un rôle
          </Link>
        </Button>
      </div>
      {roles === undefined ? (
        <LoadingState />
      ) : (
        <Card className="p-0">
          <ul className="divide-y divide-line">
            {roles.map((role) => (
              <li key={role._id}>
                <Link
                  to="/app/roles/$roleId"
                  params={{ roleId: role._id }}
                  className="flex flex-wrap items-center gap-3 px-(--pad-card) py-3 hover:bg-surface-2"
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-body text-ink">{role.label}</p>
                    <p className="text-label text-ink-3">
                      {role.permissions.length} droit{role.permissions.length > 1 ? "s" : ""} ·{" "}
                      {role.memberCount === 0
                        ? "attribué à personne"
                        : `attribué à ${role.memberCount} personne${role.memberCount > 1 ? "s" : ""}`}
                    </p>
                  </div>
                  {role.isCustom ? <Badge variant="accent">Personnalisé</Badge> : <Badge glyph={false}>Modèle</Badge>}
                </Link>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}
