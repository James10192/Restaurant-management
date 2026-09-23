import { useState, type ReactNode } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery } from "convex/react";
import { CircleAlert, KeyRound, MoreHorizontal, UserPlus } from "lucide-react";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import { PendingButton } from "~/components/app/pending-button";
import { EmptyState, LoadingState, PermissionDeniedState } from "~/components/app/states";
import { useWorkspace } from "~/components/app/workspace";
import { InviteDialog } from "~/components/team/invite-dialog";
import { MemberRolesDialog } from "~/components/team/member-roles-dialog";
import { ActivationCodeDialog, DisablePinDialog, PinMemberDialog, type PinTarget } from "~/components/team/pin-dialogs";
import type { TeamScope } from "~/components/team/scope";
import { Alert, AlertDescription } from "~/components/ui/alert";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "~/components/ui/alert-dialog";
import { Avatar, AvatarFallback } from "~/components/ui/avatar";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "~/components/ui/dropdown-menu";
import { Item, ItemActions, ItemContent, ItemDescription, ItemFooter, ItemGroup, ItemMedia, ItemTitle } from "~/components/ui/item";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "~/components/ui/table";
import { ToggleGroup, ToggleGroupItem } from "~/components/ui/toggle-group";
import { useIsMobile } from "~/hooks/use-mobile";
import { describeError } from "~/lib/errors";

export const Route = createFileRoute("/_auth/app/team")({
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
          <ToggleGroup
            type="single"
            variant="outline"
            size="sm"
            spacing={0}
            aria-label="Portée affichée"
            value={useOrg ? "organization" : "venue"}
            onValueChange={(value) => {
              // Un second clic sur la portée active ne doit pas la désélectionner.
              if (value) setWholeOrganization(value === "organization");
            }}
          >
            <ToggleGroupItem value="venue">{w.venue!.name}</ToggleGroupItem>
            <ToggleGroupItem value="organization">Toute l'organisation</ToggleGroupItem>
          </ToggleGroup>
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
  scopeToggle: ReactNode;
}) {
  const members = useMembers(scope);
  const invitations = useQuery(api.team.listInvitations, { scope });
  const revoke = useMutation(api.team.revokeInvitation);
  const setStatus = useMutation(api.team.setMemberStatus);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [pinMemberOpen, setPinMemberOpen] = useState(false);
  const [codeTarget, setCodeTarget] = useState<PinTarget | null>(null);
  const [disableTarget, setDisableTarget] = useState<PinTarget | null>(null);
  const [editing, setEditing] = useState<Member | null>(null);
  const [removing, setRemoving] = useState<Member | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const isMobile = useIsMobile();

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

  const pinTarget = (m: Member): PinTarget => ({ memberId: m.memberId, name: displayName(m), pin: m.pin, isSelf: m.isSelf });

  const actionsFor = (m: Member) =>
    m.isSelf ? (
      <div className="flex flex-col items-start gap-1 sm:items-end">
        <p className="text-sm text-muted-foreground">Vous ne pouvez pas modifier vos propres droits.</p>
        {/* Chacun peut se remettre un code à lui-même, pour la tablette partagée. */}
        <Button variant="ghost" size="sm" onClick={() => setCodeTarget(pinTarget(m))}>
          <KeyRound data-icon="inline-start" aria-hidden="true" />
          {m.pin === "active" ? "Changer mon PIN" : "Obtenir mon code PIN"}
        </Button>
      </div>
    ) : canManage && !m.isOwner ? (
      <MemberActions
        member={m}
        onEdit={() => setEditing(m)}
        onStatus={(status) => void changeStatus(m, status)}
        onRemove={() => setRemoving(m)}
        onIssueCode={() => setCodeTarget(pinTarget(m))}
        onDisablePin={() => setDisableTarget(pinTarget(m))}
      />
    ) : null;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-semibold tracking-tight">Équipe</h1>
          <p className="text-muted-foreground">Qui a accès à quoi, et où.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {scopeToggle}
          {canManage ? (
            <>
              <Button variant="outline" onClick={() => setPinMemberOpen(true)}>
                <KeyRound data-icon="inline-start" aria-hidden="true" />
                Ajouter un membre sans compte (PIN)
              </Button>
              <Button onClick={() => setInviteOpen(true)}>
                <UserPlus data-icon="inline-start" aria-hidden="true" />
                Inviter un membre
              </Button>
            </>
          ) : null}
        </div>
      </div>

      {error && removing === null ? (
        <Alert variant="destructive">
          <CircleAlert />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}

      {members === undefined ? (
        <LoadingState />
      ) : isMobile ? (
        <ItemGroup className="gap-3">
          {members.map((m) => (
            <Item key={m.memberId} variant="outline" role="listitem" className="items-start">
              <ItemMedia>
                <MemberAvatar name={m.name ?? m.email ?? "Membre"} />
              </ItemMedia>
              <ItemContent className="min-w-0">
                <MemberIdentity member={m} />
              </ItemContent>
              {!m.isSelf && canManage && !m.isOwner ? <ItemActions>{actionsFor(m)}</ItemActions> : null}
              <ItemFooter className="flex-wrap justify-start gap-1">
                <MemberBadges member={m} />
              </ItemFooter>
              {m.isSelf ? <ItemFooter>{actionsFor(m)}</ItemFooter> : null}
            </Item>
          ))}
        </ItemGroup>
      ) : (
        <div className="overflow-hidden rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Membre</TableHead>
                <TableHead>Rôles et portée</TableHead>
                <TableHead className="text-right">
                  <span className="sr-only">Actions</span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {members.map((m) => (
                <TableRow key={m.memberId}>
                  <TableCell>
                    <div className="flex min-w-0 items-center gap-3">
                      <MemberAvatar name={m.name ?? m.email ?? "Membre"} />
                      <div className="flex min-w-0 flex-col">
                        <MemberIdentity member={m} />
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="whitespace-normal">
                    <div className="flex flex-wrap gap-1">
                      <MemberBadges member={m} />
                    </div>
                  </TableCell>
                  <TableCell className="text-right whitespace-normal">{actionsFor(m)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {members !== undefined && others.length === 0 ? (
        <EmptyState
          className="border"
          title={<h2>Vous êtes seul pour l'instant</h2>}
          description={
            canManage
              ? "Commencez par un serveur : il n'aura accès qu'à cet établissement, et seulement à ce que son rôle permet."
              : "Les personnes invitées apparaîtront ici une fois leur invitation acceptée."
          }
        />
      ) : null}

      {invitations && invitations.length > 0 ? (
        <section aria-labelledby="pending-title" className="flex flex-col gap-3">
          <h2 id="pending-title" className="text-lg font-semibold tracking-tight">
            Invitations en attente
          </h2>
          <ItemGroup className="gap-3">
            {invitations.map((inv) => (
              <Item key={inv.invitationId} variant="outline" role="listitem">
                <ItemContent className="min-w-0">
                  <ItemTitle className="max-w-full truncate">{inv.email}</ItemTitle>
                  <ItemDescription>
                    {inv.roleLabel} · {inv.isExpired ? "expirée" : `expire le ${new Date(inv.expiresAt).toLocaleDateString("fr-FR")}`}
                  </ItemDescription>
                </ItemContent>
                {inv.isExpired ? <Badge variant="outline">Expirée</Badge> : null}
                {canManage ? (
                  <ItemActions>
                    <Button
                      variant="ghost"
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
                  </ItemActions>
                ) : null}
              </Item>
            ))}
          </ItemGroup>
        </section>
      ) : null}

      <InviteDialog open={inviteOpen} onOpenChange={setInviteOpen} scope={scope} organizationId={organizationId} scopeLabel={scopeLabel} />
      <PinMemberDialog open={pinMemberOpen} onOpenChange={setPinMemberOpen} scope={scope} organizationId={organizationId} scopeLabel={scopeLabel} />
      <ActivationCodeDialog target={codeTarget} organizationId={organizationId} onClose={() => setCodeTarget(null)} />
      <DisablePinDialog target={disableTarget} organizationId={organizationId} onClose={() => setDisableTarget(null)} />
      <MemberRolesDialog
        member={editing ? { memberId: editing.memberId, displayName: editing.name ?? editing.email ?? "Membre", roleIds: scopedRoleIds(editing) } : null}
        scope={scope}
        scopeLabel={scopeLabel}
        onClose={() => setEditing(null)}
      />
      <AlertDialog
        open={removing !== null}
        onOpenChange={(open) => {
          if (!open) {
            setRemoving(null);
            setError(null);
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Retirer {removing?.name ?? removing?.email} ?</AlertDialogTitle>
            <AlertDialogDescription>
              Tous ses rôles sont supprimés et son accès coupé immédiatement. Pour revenir, il lui faudra une nouvelle invitation.
              Son historique reste dans le journal.
            </AlertDialogDescription>
          </AlertDialogHeader>
          {/* L'erreur s'affiche DANS la modale : derrière elle, personne ne la verrait. */}
          {error ? (
            <Alert variant="destructive">
              <CircleAlert />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          ) : null}
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            {/* Pas d'`AlertDialogAction` : elle fermerait la fenêtre avant de savoir si le retrait a réussi. */}
            <PendingButton
              variant="destructive"
              pending={busy}
              pendingText="Retrait…"
              onClick={() => removing && void changeStatus(removing, "removed")}
            >
              Retirer
            </PendingButton>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function initials(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  const letter = (word: string | undefined) => (word ? (Array.from(word)[0] ?? "") : "");
  return (letter(words[0]) + (words.length > 1 ? letter(words[words.length - 1]) : "")).toLocaleUpperCase("fr") || "?";
}

function MemberAvatar({ name }: { name: string }) {
  return (
    <Avatar size="lg">
      <AvatarFallback aria-hidden="true">{initials(name)}</AvatarFallback>
    </Avatar>
  );
}

function MemberIdentity({ member: m }: { member: Member }) {
  return (
    <>
      <span className="truncate font-medium">
        {m.name ?? m.email ?? "Membre"}
        {m.isSelf ? <span className="font-normal text-muted-foreground"> (vous)</span> : null}
      </span>
      {m.name && m.email ? <span className="truncate text-sm text-muted-foreground">{m.email}</span> : null}
    </>
  );
}

function displayName(m: Member): string {
  return m.name ?? m.email ?? "Membre";
}

function PinBadge({ pin }: { pin: Member["pin"] }) {
  if (pin === "active") return <Badge variant="outline">PIN actif</Badge>;
  if (pin === "pending") return <Badge variant="outline">PIN à activer</Badge>;
  if (pin === "disabled") return <Badge variant="destructive">PIN désactivé</Badge>;
  return null;
}

function MemberBadges({ member: m }: { member: Member }) {
  return (
    <>
      {m.isOwner ? <Badge>Propriétaire</Badge> : null}
      {m.status === "suspended" ? <Badge variant="destructive">Suspendu</Badge> : null}
      {m.kind === "pin_only" ? <Badge variant="outline">Sans compte</Badge> : null}
      <PinBadge pin={m.pin} />
      {m.roles.map((r) => (
        <Badge key={r.assignmentId} variant="secondary">
          {r.label} · {r.scopeType === "organization" ? "toute l'organisation" : r.venueName}
        </Badge>
      ))}
    </>
  );
}

function MemberActions({
  member: m,
  onEdit,
  onStatus,
  onRemove,
  onIssueCode,
  onDisablePin,
}: {
  member: Member;
  onEdit: () => void;
  onStatus: (status: "active" | "suspended") => void;
  onRemove: () => void;
  onIssueCode: () => void;
  onDisablePin: () => void;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" aria-label={`Actions pour ${m.name ?? m.email ?? "Membre"}`}>
          <MoreHorizontal aria-hidden="true" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onSelect={onEdit}>Modifier les rôles</DropdownMenuItem>
        {m.canChangeStatus && m.status === "active" ? (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem onSelect={onIssueCode}>Émettre un code d'activation</DropdownMenuItem>
            {m.pin === "active" || m.pin === "pending" ? (
              <DropdownMenuItem variant="destructive" onSelect={onDisablePin}>
                Désactiver le PIN
              </DropdownMenuItem>
            ) : null}
            <DropdownMenuSeparator />
          </>
        ) : null}
        {m.canChangeStatus ? (
          <>
            {m.status === "suspended" ? (
              <DropdownMenuItem onSelect={() => onStatus("active")}>Réactiver</DropdownMenuItem>
            ) : (
              <DropdownMenuItem onSelect={() => onStatus("suspended")}>Suspendre l'accès</DropdownMenuItem>
            )}
            <DropdownMenuSeparator />
            <DropdownMenuItem variant="destructive" onSelect={onRemove}>
              Retirer de l'équipe
            </DropdownMenuItem>
          </>
        ) : (
          // Désactivé avec la raison plutôt que masqué : sinon on croit à un bogue.
          <DropdownMenuItem disabled>Suspendre ou retirer : réservé à qui gère tous ses rôles</DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
