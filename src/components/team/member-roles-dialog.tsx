import { useEffect, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { Alert, AlertDescription } from "~/components/ui/alert";
import { Button } from "~/components/ui/button";
import { Checkbox } from "~/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "~/components/ui/dialog";
import { describeError } from "~/lib/errors";
import type { TeamScope } from "./scope";

/**
 * Les rôles d'un membre DANS la portée affichée, et seulement celle-là : ce qu'il détient
 * ailleurs n'est ni montré ni touché. Le serveur applique les mêmes verrous ; l'écran les
 * annonce pour qu'on ne découvre pas un refus au moment d'enregistrer.
 */
export function MemberRolesDialog({
  member,
  scope,
  scopeLabel,
  onClose,
}: {
  member: { memberId: Id<"organizationMembers">; displayName: string; roleIds: Id<"roles">[] } | null;
  scope: TeamScope;
  scopeLabel: string;
  onClose: () => void;
}) {
  const roles = useQuery(api.roles.listForGrant, member ? { scope } : "skip");
  const setRoles = useMutation(api.team.setMemberRoles);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setSelected(new Set(member?.roleIds ?? []));
    setError(null);
  }, [member]);

  const lockedHeld = roles?.filter((r) => !r.grantable && member?.roleIds.includes(r._id)) ?? [];

  async function save() {
    if (!member) return;
    setSaving(true);
    setError(null);
    try {
      await setRoles({ memberId: member.memberId, scope, roleIds: [...selected] as Id<"roles">[] });
      onClose();
    } catch (e) {
      setError(describeError(e).message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={member !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Rôles de {member?.displayName}</DialogTitle>
          <DialogDescription>Portée : {scopeLabel}. Les rôles détenus ailleurs ne changent pas.</DialogDescription>
        </DialogHeader>
        {lockedHeld.length > 0 ? (
          <Alert variant="warning" className="mt-4">
            <AlertDescription>
              Cette personne détient un rôle plus large que les vôtres ({lockedHeld.map((r) => r.label).join(", ")}). Seule
              une personne qui en détient tous les droits peut modifier ses rôles ici.
            </AlertDescription>
          </Alert>
        ) : null}
        <fieldset className="mt-4 flex flex-col gap-1" disabled={lockedHeld.length > 0}>
          <legend className="sr-only">Rôles</legend>
          {roles === undefined ? <p className="text-body text-ink-3">Chargement des rôles…</p> : null}
          {roles?.map((role) => {
            const checked = selected.has(role._id);
            return (
              <label key={role._id} className="flex min-h-(--tap) items-start gap-3 rounded-sm px-2 py-2 hover:bg-surface-2">
                <Checkbox
                  className="mt-0.5"
                  checked={checked}
                  disabled={!role.grantable}
                  onCheckedChange={(value) => {
                    const next = new Set(selected);
                    if (value === true) next.add(role._id);
                    else next.delete(role._id);
                    setSelected(next);
                  }}
                />
                <span className="flex flex-col">
                  <span className={role.grantable ? "text-body text-ink" : "text-body text-ink-disabled"}>{role.label}</span>
                  {!role.grantable ? (
                    <span className="text-label text-ink-3">Accorde des droits que vous n'avez pas.</span>
                  ) : role.description ? (
                    <span className="text-label text-ink-3">{role.description}</span>
                  ) : null}
                </span>
              </label>
            );
          })}
        </fieldset>
        {selected.size === 0 && roles !== undefined ? (
          <p className="mt-3 text-label text-ink-3">Sans rôle, cette personne n'aura plus accès à {scopeLabel}.</p>
        ) : null}
        {error ? (
          <Alert variant="danger" className="mt-4">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        ) : null}
        <DialogFooter className="mt-6">
          <Button variant="quiet" onClick={onClose}>
            Annuler
          </Button>
          <Button onClick={() => void save()} loading={saving} loadingText="Enregistrement…" disabled={lockedHeld.length > 0}>
            Enregistrer
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
