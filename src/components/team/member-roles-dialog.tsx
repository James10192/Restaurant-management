import { useEffect, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { CircleAlert, TriangleAlert } from "lucide-react";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { PendingButton } from "~/components/app/pending-button";
import {
  ResponsiveDialog,
  ResponsiveDialogContent,
  ResponsiveDialogDescription,
  ResponsiveDialogFooter,
  ResponsiveDialogHeader,
  ResponsiveDialogTitle,
} from "~/components/app/responsive-dialog";
import { Alert, AlertDescription } from "~/components/ui/alert";
import { Button } from "~/components/ui/button";
import { Checkbox } from "~/components/ui/checkbox";
import { Field, FieldContent, FieldDescription, FieldLabel, FieldLegend, FieldSet } from "~/components/ui/field";
import { Spinner } from "~/components/ui/spinner";
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
    <ResponsiveDialog open={member !== null} onOpenChange={(open) => !open && onClose()}>
      <ResponsiveDialogContent>
        <div className="grid gap-4">
          <ResponsiveDialogHeader>
            <ResponsiveDialogTitle>Rôles de {member?.displayName}</ResponsiveDialogTitle>
            <ResponsiveDialogDescription>Portée : {scopeLabel}. Les rôles détenus ailleurs ne changent pas.</ResponsiveDialogDescription>
          </ResponsiveDialogHeader>
          {lockedHeld.length > 0 ? (
            <Alert>
              <TriangleAlert />
              <AlertDescription>
                Cette personne détient un rôle plus large que les vôtres ({lockedHeld.map((r) => r.label).join(", ")}). Seule
                une personne qui en détient tous les droits peut modifier ses rôles ici.
              </AlertDescription>
            </Alert>
          ) : null}
          <FieldSet disabled={lockedHeld.length > 0} className="gap-3">
            <FieldLegend className="sr-only">Rôles</FieldLegend>
            {roles === undefined ? (
              <p className="flex items-center gap-2 text-sm text-muted-foreground">
                <Spinner />
                Chargement des rôles…
              </p>
            ) : null}
            {roles?.map((role) => {
              const checked = selected.has(role._id);
              const id = `member-role-${role._id}`;
              return (
                <Field key={role._id} orientation="horizontal" data-disabled={!role.grantable}>
                  <Checkbox
                    id={id}
                    checked={checked}
                    disabled={!role.grantable}
                    onCheckedChange={(value) => {
                      const next = new Set(selected);
                      if (value === true) next.add(role._id);
                      else next.delete(role._id);
                      setSelected(next);
                    }}
                  />
                  <FieldContent>
                    <FieldLabel htmlFor={id} className="font-normal">
                      {role.label}
                    </FieldLabel>
                    {!role.grantable ? (
                      <FieldDescription>Accorde des droits que vous n'avez pas.</FieldDescription>
                    ) : role.description ? (
                      <FieldDescription>{role.description}</FieldDescription>
                    ) : null}
                  </FieldContent>
                </Field>
              );
            })}
          </FieldSet>
          {selected.size === 0 && roles !== undefined ? (
            <p className="text-sm text-muted-foreground">Sans rôle, cette personne n'aura plus accès à {scopeLabel}.</p>
          ) : null}
          {error ? (
            <Alert variant="destructive">
              <CircleAlert />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          ) : null}
          <ResponsiveDialogFooter>
            <Button variant="ghost" onClick={onClose}>
              Annuler
            </Button>
            <PendingButton onClick={() => void save()} pending={saving} pendingText="Enregistrement…" disabled={lockedHeld.length > 0}>
              Enregistrer
            </PendingButton>
          </ResponsiveDialogFooter>
        </div>
      </ResponsiveDialogContent>
    </ResponsiveDialog>
  );
}
