import { useState, type FormEvent } from "react";
import { useMutation, useQuery } from "convex/react";
import { CircleAlert } from "lucide-react";
import { toast } from "sonner";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { LIMITS } from "../../../convex/lib/catalog";
import { FormField } from "~/components/app/form-field";
import { PendingButton } from "~/components/app/pending-button";
import {
  ResponsiveDialog,
  ResponsiveDialogContent,
  ResponsiveDialogDescription,
  ResponsiveDialogFooter,
  ResponsiveDialogHeader,
  ResponsiveDialogTitle,
} from "~/components/app/responsive-dialog";
import { OneTimeCode } from "~/components/settings/one-time-code";
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
import { Button } from "~/components/ui/button";
import { FieldGroup } from "~/components/ui/field";
import { Input } from "~/components/ui/input";
import { NativeSelect, NativeSelectOptGroup, NativeSelectOption } from "~/components/ui/native-select";
import { describeError } from "~/lib/errors";
import type { TeamScope } from "./scope";

export type PinStatus = "pending" | "active" | "disabled" | null;

type Issued = { code: string; expiresAt: number };

const ACTIVATION_INSTRUCTION = (
  <>
    Sur un appareil de l'établissement, touchez votre nom puis « Activer mon PIN » et saisissez ce code. Le PIN est choisi par
    la personne elle-même : vous ne le connaîtrez jamais.
  </>
);

function ErrorAlert({ error }: { error: string | null }) {
  return error ? (
    <Alert variant="destructive">
      <CircleAlert />
      <AlertDescription>{error}</AlertDescription>
    </Alert>
  ) : null;
}

function IssuedCode({ issued }: { issued: Issued }) {
  return (
    <OneTimeCode
      code={issued.code}
      expiresAt={issued.expiresAt}
      validity="24 heures"
      label="Code d'activation"
      instruction={ACTIVATION_INSTRUCTION}
    />
  );
}

/**
 * Un membre sans compte : un nom et un rôle, pas d'adresse e-mail. Il travaillera avec son PIN
 * sur les appareils enrôlés. Le premier code d'activation revient avec la création.
 */
export function PinMemberDialog({
  open,
  onOpenChange,
  scope,
  organizationId,
  scopeLabel,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  scope: TeamScope;
  organizationId: Id<"organizations">;
  scopeLabel: string;
}) {
  const roles = useQuery(api.roles.listForGrant, open ? { scope } : "skip");
  const createPinMember = useMutation(api.staff.createPinMember);
  const [name, setName] = useState("");
  const [roleId, setRoleId] = useState("");
  const [nameError, setNameError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [result, setResult] = useState<(Issued & { name: string }) | null>(null);

  function reset() {
    setName("");
    setRoleId("");
    setNameError(null);
    setError(null);
    setResult(null);
  }

  function change(next: boolean) {
    if (!next) reset();
    onOpenChange(next);
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!name.trim()) {
      setNameError("Saisissez le nom sous lequel l'équipe le reconnaîtra.");
      return;
    }
    if (!roleId) {
      setNameError(null);
      setError("Choisissez un rôle.");
      return;
    }
    setNameError(null);
    setError(null);
    setSaving(true);
    try {
      const issued = await createPinMember({
        organizationId,
        displayName: name.trim(),
        roleId: roleId as Id<"roles">,
        venueIds: "venueId" in scope ? [scope.venueId] : [],
      });
      setResult({ code: issued.code, expiresAt: issued.expiresAt, name: name.trim() });
    } catch (e) {
      setError(describeError(e).message);
    } finally {
      setSaving(false);
    }
  }

  const grantable = roles?.filter((r) => r.grantable) ?? [];
  const blocked = roles?.filter((r) => !r.grantable) ?? [];

  return (
    <ResponsiveDialog open={open} onOpenChange={change}>
      <ResponsiveDialogContent>
        {result ? (
          <div className="grid gap-4">
            <ResponsiveDialogHeader>
              <ResponsiveDialogTitle>{result.name} fait partie de l'équipe</ResponsiveDialogTitle>
              <ResponsiveDialogDescription>Remettez-lui ce code pour qu'il choisisse son PIN.</ResponsiveDialogDescription>
            </ResponsiveDialogHeader>
            <IssuedCode issued={result} />
            <ResponsiveDialogFooter>
              <Button variant="ghost" onClick={reset}>
                Ajouter quelqu'un d'autre
              </Button>
              <Button onClick={() => change(false)}>Terminé</Button>
            </ResponsiveDialogFooter>
          </div>
        ) : (
          <form onSubmit={submit} noValidate className="grid gap-4">
            <ResponsiveDialogHeader>
              <ResponsiveDialogTitle>Ajouter un membre sans compte</ResponsiveDialogTitle>
              <ResponsiveDialogDescription>
                Pour qui n'a pas d'adresse e-mail : il s'identifiera avec un PIN sur les appareils de l'établissement. Portée :{" "}
                {scopeLabel}.
              </ResponsiveDialogDescription>
            </ResponsiveDialogHeader>
            <FieldGroup>
              <FormField label="Nom" error={nameError}>
                <Input value={name} onChange={(e) => setName(e.target.value)} maxLength={LIMITS.name} autoComplete="off" autoFocus placeholder="Aminata K." />
              </FormField>
              <FormField
                label="Rôle"
                description={
                  blocked.length > 0
                    ? "Les rôles grisés accordent des droits que vous n'avez pas vous-même : seule une personne qui les détient peut les attribuer."
                    : undefined
                }
              >
                <NativeSelect className="w-full" value={roleId} onChange={(e) => setRoleId(e.target.value)} disabled={roles === undefined}>
                  <NativeSelectOption value="">{roles === undefined ? "Chargement des rôles…" : "Choisir un rôle"}</NativeSelectOption>
                  {grantable.map((r) => (
                    <NativeSelectOption key={r._id} value={r._id}>
                      {r.label}
                    </NativeSelectOption>
                  ))}
                  {blocked.length > 0 ? (
                    <NativeSelectOptGroup label="Non attribuables par vous">
                      {blocked.map((r) => (
                        <NativeSelectOption key={r._id} value={r._id} disabled>
                          {r.label}
                        </NativeSelectOption>
                      ))}
                    </NativeSelectOptGroup>
                  ) : null}
                </NativeSelect>
              </FormField>
              <ErrorAlert error={error} />
            </FieldGroup>
            <ResponsiveDialogFooter>
              <Button type="button" variant="ghost" onClick={() => change(false)}>
                Annuler
              </Button>
              <PendingButton type="submit" pending={saving} pendingText="Ajout…">
                Ajouter et obtenir un code
              </PendingButton>
            </ResponsiveDialogFooter>
          </form>
        )}
      </ResponsiveDialogContent>
    </ResponsiveDialog>
  );
}

export type PinTarget = { memberId: Id<"organizationMembers">; name: string; pin: PinStatus; isSelf: boolean };

/**
 * Émettre un code remet le PIN à zéro sur-le-champ : on le dit avant, pas après. Le code
 * s'affiche ensuite une seule fois.
 */
export function ActivationCodeDialog({
  target,
  organizationId,
  onClose,
}: {
  target: PinTarget | null;
  organizationId: Id<"organizations">;
  onClose: () => void;
}) {
  const issueActivationCode = useMutation(api.staff.issueActivationCode);
  const [issued, setIssued] = useState<Issued | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  function close() {
    setIssued(null);
    setError(null);
    onClose();
  }

  async function issue() {
    if (!target) return;
    setError(null);
    setBusy(true);
    try {
      setIssued(await issueActivationCode({ organizationId, memberId: target.memberId }));
    } catch (e) {
      setError(describeError(e).message);
    } finally {
      setBusy(false);
    }
  }

  const who = target?.isSelf ? "votre" : "son";

  return (
    <ResponsiveDialog open={target !== null} onOpenChange={(open) => (open ? undefined : close())}>
      <ResponsiveDialogContent>
        {issued ? (
          <div className="grid gap-4">
            <ResponsiveDialogHeader>
              <ResponsiveDialogTitle>Code d'activation {target?.isSelf ? "" : `pour ${target?.name}`}</ResponsiveDialogTitle>
              <ResponsiveDialogDescription>
                {target?.isSelf ? "Saisissez-le sur un appareil de l'établissement." : "Remettez-le en main propre ou dictez-le."}
              </ResponsiveDialogDescription>
            </ResponsiveDialogHeader>
            <IssuedCode issued={issued} />
            <ResponsiveDialogFooter>
              <Button onClick={close}>Terminé</Button>
            </ResponsiveDialogFooter>
          </div>
        ) : (
          <div className="grid gap-4">
            <ResponsiveDialogHeader>
              <ResponsiveDialogTitle>
                {target?.isSelf ? "Obtenir un code d'activation" : `Émettre un code d'activation pour ${target?.name ?? ""}`}
              </ResponsiveDialogTitle>
              <ResponsiveDialogDescription>
                {target?.pin === "active"
                  ? `Le PIN actuel cesse de valoir tout de suite et les sessions ouvertes avec ${who} PIN sont fermées. Un nouveau PIN sera choisi avec le code.`
                  : "Le code permet de choisir un PIN. Tout code émis auparavant et non utilisé cesse de valoir."}
              </ResponsiveDialogDescription>
            </ResponsiveDialogHeader>
            <ErrorAlert error={error} />
            <ResponsiveDialogFooter>
              <Button variant="ghost" onClick={close}>
                Annuler
              </Button>
              <PendingButton pending={busy} pendingText="Émission…" onClick={() => void issue()}>
                Émettre le code
              </PendingButton>
            </ResponsiveDialogFooter>
          </div>
        )}
      </ResponsiveDialogContent>
    </ResponsiveDialog>
  );
}

export function DisablePinDialog({
  target,
  organizationId,
  onClose,
}: {
  target: PinTarget | null;
  organizationId: Id<"organizations">;
  onClose: () => void;
}) {
  const disablePin = useMutation(api.staff.disablePin);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function confirm() {
    if (!target) return;
    setError(null);
    setBusy(true);
    try {
      await disablePin({ organizationId, memberId: target.memberId });
      toast.success(`PIN de ${target.name} désactivé.`);
      onClose();
    } catch (e) {
      setError(describeError(e).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <AlertDialog
      open={target !== null}
      onOpenChange={(open) => {
        if (!open) {
          setError(null);
          onClose();
        }
      }}
    >
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Désactiver le PIN de {target?.name} ?</AlertDialogTitle>
          <AlertDialogDescription>
            Il ne pourra plus s'identifier sur aucun appareil, et ses sessions ouvertes sont fermées tout de suite. Pour lui rendre
            l'accès, émettez un nouveau code d'activation.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <ErrorAlert error={error} />
        <AlertDialogFooter>
          <AlertDialogCancel>Annuler</AlertDialogCancel>
          <PendingButton variant="destructive" pending={busy} pendingText="Désactivation…" onClick={() => void confirm()}>
            Désactiver le PIN
          </PendingButton>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
