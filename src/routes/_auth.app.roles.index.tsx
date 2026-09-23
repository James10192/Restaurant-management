import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "convex/react";
import { ChevronRight, Plus } from "lucide-react";
import { api } from "../../convex/_generated/api";
import { LoadingState, PermissionDeniedState } from "~/components/app/states";
import { useWorkspace } from "~/components/app/workspace";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { Item, ItemActions, ItemContent, ItemDescription, ItemGroup, ItemSeparator, ItemTitle } from "~/components/ui/item";

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
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="flex max-w-prose flex-col gap-1">
          <h1 className="text-2xl font-semibold tracking-tight">Rôles</h1>
          <p className="text-muted-foreground">
            Un rôle est un ensemble de droits. Joliba ne demande jamais « est-ce un serveur ? », seulement « a-t-il ce droit
            ici ? » : composez les rôles qui ressemblent à votre maison.
          </p>
        </div>
        <Button asChild className="self-start sm:self-auto">
          <Link to="/app/roles/$roleId" params={{ roleId: "nouveau" }}>
            <Plus data-icon="inline-start" aria-hidden="true" />
            Créer un rôle
          </Link>
        </Button>
      </div>
      {roles === undefined ? (
        <LoadingState />
      ) : (
        <ItemGroup className="gap-0 overflow-hidden rounded-lg border">
          {roles.map((role, index) => (
            <div key={role._id} role="listitem">
              {index > 0 ? <ItemSeparator className="my-0" /> : null}
              <Item asChild className="rounded-none">
                <Link to="/app/roles/$roleId" params={{ roleId: role._id }}>
                  <ItemContent className="min-w-0">
                    <ItemTitle>{role.label}</ItemTitle>
                    <ItemDescription>
                      {role.permissions.length} droit{role.permissions.length > 1 ? "s" : ""} ·{" "}
                      {role.memberCount === 0
                        ? "attribué à personne"
                        : `attribué à ${role.memberCount} personne${role.memberCount > 1 ? "s" : ""}`}
                    </ItemDescription>
                  </ItemContent>
                  <ItemActions>
                    {role.isCustom ? <Badge>Personnalisé</Badge> : <Badge variant="outline">Modèle</Badge>}
                    <ChevronRight aria-hidden="true" className="size-4 text-muted-foreground" />
                  </ItemActions>
                </Link>
              </Item>
            </div>
          ))}
        </ItemGroup>
      )}
    </div>
  );
}
