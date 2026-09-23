import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery } from "convex/react";
import { MoreHorizontal, UserPlus } from "lucide-react";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import { useWorkspace } from "~/components/app/workspace";
import { InviteDialog } from "~/components/team/invite-dialog";
import { MemberRolesDialog } from "~/components/team/member-roles-dialog";
import type { TeamScope } from "~/components/team/scope";
import { Alert, AlertDescription } from "~/components/ui/alert";
import { Avatar } from "~/components/ui/avatar";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { Card } from "~/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "~/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "~/components/ui/dropdown-menu";
import { EmptyState, LoadingState, PermissionDeniedState } from "~/components/ui/states";
import { describeError } from "~/lib/errors";

export const Route = createFileRoute("/app/team")({
  head: () => ({ meta: [{ title: "Équipe — Joliba" }] }),
  component: TeamPage,
});

type Member = NonNullable<ReturnType<typeof useMembers>>[number];

function useMembers(scope: TeamScope | null) {
  return useQuery(api.team.listMembers, scope ? { scope } : "skip");
}

function TeamPage() {
  const w = useWorkspace();
  const venueReadable = w.venue !== null && w.canInVenue("team.read");
  const orgReadable = w.canInOrganization("team.read");
  const [wholeOrganization, setWholeOrganization] = useState(!venueReadable && orgReadable);

  if (!w.organization || (!venueReadable && !orgReadable)) {
    return <PermissionDeniedState venue={w.venue?.name} />;
  }
  const useOrg = wholeOrganization || !venueReadable;
  const scope: TeamScope = useOrg ? { organizationId: w.organization._id } : { venueId: w.venue!._id };
  const scopeLabel = useOrg ? `toute l'organisation ${w.organization.name}` : w.venue!.name;
  const canManage = useOrg ? w.canInOrganization("team.manage") : w.canInVenue("team.manage");

  return (
    <TeamView
      key={JSON.stringify(scope)}
      scope={scope}
      scopeLabel={scopeLabel}
      canManage={canManage}
      organizationId={w.organization._id}
      scopeToggle={
        venueReadable && orgReadable ? (
          <div role="group" aria-label="Portée affichée" className="inline-flex rounded-sm border border-line-control p-0.5">
            <Button size="sm" variant={useOrg ? "quiet" : "secondary"} aria-pressed={!useOrg} onClick={() => setWholeOrganization(false)}>
              {w.venue!.name}
            </Button>
            <Button size="sm" variant={useOrg ? "secondary" : "quiet"} aria-pressed={useOrg} onClick={() => setWholeOrganization(true)}>
              Toute l'organisation
            </Button>
          </div>
        ) : null
      }
    />
  );
}

function TeamView({
  scope,
  scopeLabel,
  canManage,
  organizationId,
  scopeToggle,
}: {
  scope: TeamScope;
  scopeLabel: string;
  canManage: boolean;
  organizationId: Id<"organizations">;
  scopeToggle: React.ReactNode;
}) {
  const members = useMembers(scope);
  const invitations = useQuery(api.team.listInvitations, { scope });
  const revoke = useMutation(api.team.revokeInvitation);
  const setStatus = useMutation(api.team.setMemberStatus);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [editing, setEditing] = useState<Member | null>(null);
  const [removing, setRemoving] = useState<Member | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const scopedRoleIds = (m: Member) =>
    m.roles
      .filter((r) => ("venueId" in scope ? r.venueId === scope.venueId : r.scopeType === "organization"))
      .map((r) => r.roleId);

  async function changeStatus(member: Member, status: "active" | "suspended" | "removed") {
    setError(null);
    setBusy(true);
    try {
      await setStatus({ organizationId, memberId: member.memberId, status });
      setRemoving(null);
    } catch (e) {
      setError(describeError(e).message);
    } finally {
      setBusy(false);
    }
  }

  const others = members?.filter((m) => !m.isSelf) ?? [];

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-title-xl text-ink">Équipe</h1>
          <p className="text-body text-ink-2">Qui a accès à quoi, et où.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {scopeToggle}
          {canManage ? (
            <Button onClick={() => setInviteOpen(true)}>
              <UserPlus aria-hidden="true" className="size-4" />
              Inviter un membre
            </Button>
          ) : null}
        </div>
      </div>

      {error ? (
        <Alert variant="danger">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}

      {members === undefined ? (
        <LoadingState />
      ) : (
        <Card className="p-0">
          <ul className="divide-y divide-line">
            {members.map((m) => (
              <li key={m.memberId} className="flex flex-wrap items-center gap-3 px-(--pad-card) py-3">
                <Avatar name={m.name ?? m.email} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-body text-ink">
                    {m.name ?? m.email}
                    {m.isSelf ? <span className="text-ink-3"> (vous)</span> : null}
                  </p>
                  {m.name ? <p className="truncate text-label text-ink-3">{m.email}</p> : null}
                  <div className="mt-1 flex flex-wrap gap-1">
                    {m.isOwner ? <Badge variant="accent">Propriétaire</Badge> : null}
                    {m.status === "suspended" ? <Badge variant="warning">Suspendu</Badge> : null}
                    {m.roles.map((r) => (
                      <Badge key={r.assignmentId} glyph={false}>
                        {r.label} · {r.scopeType === "organization" ? "toute l'organisation" : r.venueName}
                      </Badge>
                    ))}
                  </div>
                </div>
                {m.isSelf ? (
                  <p className="text-label text-ink-3">Vous ne pouvez pas modifier vos propres droits.</p>
                ) : canManage && !m.isOwner ? (
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="quiet" size="icon" aria-label={`Actions pour ${m.name ?? m.email}`}>
                        <MoreHorizontal aria-hidden="true" className="size-5" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onSelect={() => setEditing(m)}>Modifier les rôles</DropdownMenuItem>
                      {m.canChangeStatus ? (
                        <>
                          {m.status === "suspended" ? (
                            <DropdownMenuItem onSelect={() => void changeStatus(m, "active")}>Réactiver</DropdownMenuItem>
                          ) : (
                            <DropdownMenuItem onSelect={() => void changeStatus(m, "suspended")}>Suspendre l'accès</DropdownMenuItem>
                          )}
                          <DropdownMenuSeparator />
                          <DropdownMenuItem className="text-danger-700" onSelect={() => setRemoving(m)}>
                            Retirer de l'équipe
                          </DropdownMenuItem>
                        </>
                      ) : (
                        // Désactivé avec la raison plutôt que masqué : sinon on croit à un bogue.
                        <DropdownMenuItem disabled>Suspendre ou retirer : réservé à qui gère tous ses rôles</DropdownMenuItem>
                      )}
                    </DropdownMenuContent>
                  </DropdownMenu>
                ) : null}
              </li>
            ))}
          </ul>
        </Card>
      )}

      {members !== undefined && others.length === 0 ? (
        <EmptyState
          titleAs="h2"
          title="Vous êtes seul pour l'instant"
          description={
            canManage
              ? "Commencez par un serveur : il n'aura accès qu'à cet établissement, et seulement à ce que son rôle permet."
              : "Les personnes invitées apparaîtront ici une fois leur invitation acceptée."
          }
        />
      ) : null}

      {invitations && invitations.length > 0 ? (
        <section aria-labelledby="pending-title" className="flex flex-col gap-3">
          <h2 id="pending-title" className="text-title-md text-ink">
            Invitations en attente
          </h2>
          <Card className="p-0">
            <ul className="divide-y divide-line">
              {invitations.map((inv) => (
                <li key={inv.invitationId} className="flex flex-wrap items-center gap-3 px-(--pad-card) py-3">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-body text-ink">{inv.email}</p>
                    <p className="text-label text-ink-3">
                      {inv.roleLabel} · {inv.isExpired ? "expirée" : `expire le ${new Date(inv.expiresAt).toLocaleDateString("fr-FR")}`}
                    </p>
                  </div>
                  {canManage ? (
                    <Button
                      variant="quiet"
                      size="sm"
                      onClick={async () => {
                        setError(null);
                        try {
                          await revoke({ organizationId, invitationId: inv.invitationId });
                        } catch (e) {
                          setError(describeError(e).message);
                        }
                      }}
                    >
                      Révoquer
                    </Button>
                  ) : null}
                </li>
              ))}
            </ul>
          </Card>
        </section>
      ) : null}

      <InviteDialog open={inviteOpen} onOpenChange={setInviteOpen} scope={scope} organizationId={organizationId} scopeLabel={scopeLabel} />
      <MemberRolesDialog
        member={editing ? { memberId: editing.memberId, displayName: editing.name ?? editing.email, roleIds: scopedRoleIds(editing) } : null}
        scope={scope}
        scopeLabel={scopeLabel}
        onClose={() => setEditing(null)}
      />
      <Dialog open={removing !== null} onOpenChange={(open) => { if (!open) { setRemoving(null); setError(null); } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Retirer {removing?.name ?? removing?.email} ?</DialogTitle>
            <DialogDescription>
              Tous ses rôles sont supprimés et son accès coupé immédiatement. Pour revenir, il lui faudra une nouvelle invitation.
              Son historique reste dans le journal.
            </DialogDescription>
          </DialogHeader>
          {/* L'erreur s'affiche DANS la modale : derrière elle, personne ne la verrait. */}
          {error ? (
            <Alert variant="danger" className="mt-4">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          ) : null}
          <DialogFooter className="mt-6">
            <Button variant="quiet" onClick={() => setRemoving(null)}>
              Annuler
            </Button>
            <Button variant="danger-solid" loading={busy} loadingText="Retrait…" onClick={() => removing && void changeStatus(removing, "removed")}>
              Retirer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
