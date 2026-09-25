import { useState, type FormEvent } from "react";
import { useAction, useQuery } from "convex/react";
import { Check, CircleAlert, Copy, MessageCircle } from "lucide-react";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
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
import { Alert, AlertDescription } from "~/components/ui/alert";
import { Button } from "~/components/ui/button";
import { FieldDescription, FieldGroup } from "~/components/ui/field";
import { Input } from "~/components/ui/input";
import { NativeSelect, NativeSelectOptGroup, NativeSelectOption } from "~/components/ui/native-select";
import { describeError } from "~/lib/errors";
import type { TeamScope } from "./scope";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Invitation d'un membre DANS la portée affichée. Les rôles que l'appelant ne peut pas
 * attribuer restent visibles, désactivés, avec la raison (INFORMATION_ARCHITECTURE §4.14).
 * Le lien est rendu après l'envoi : on le transmet souvent soi-même, par WhatsApp.
 */
export function InviteDialog({
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
  const invite = useAction(api.team.invite);
  const [email, setEmail] = useState("");
  const [roleId, setRoleId] = useState<string>("");
  const [emailError, setEmailError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState<{ link: string; emailSent: boolean; email: string } | null>(null);
  const [copied, setCopied] = useState(false);

  function reset() {
    setEmail("");
    setRoleId("");
    setEmailError(null);
    setFormError(null);
    setResult(null);
    setCopied(false);
  }

  /** Fermer remet à zéro : une réouverture ne doit jamais montrer l'ancien lien. */
  function close() {
    reset();
    onOpenChange(false);
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    const value = email.trim().toLowerCase();
    if (!EMAIL_PATTERN.test(value)) {
      setEmailError("Saisissez une adresse e-mail complète.");
      return;
    }
    if (!roleId) {
      setFormError("Choisissez un rôle.");
      return;
    }
    setEmailError(null);
    setFormError(null);
    setSending(true);
    try {
      const response = await invite({
        organizationId,
        email: value,
        roleId: roleId as Id<"roles">,
        venueIds: "venueId" in scope ? [scope.venueId] : [],
      });
      setResult({ ...response, email: value });
    } catch (e) {
      setFormError(describeError(e).message);
    } finally {
      setSending(false);
    }
  }

  const grantable = roles?.filter((r) => r.grantable) ?? [];
  const blocked = roles?.filter((r) => !r.grantable) ?? [];

  return (
    <ResponsiveDialog
      open={open}
      onOpenChange={(next) => {
        if (!next) reset();
        onOpenChange(next);
      }}
    >
      <ResponsiveDialogContent>
        {result ? (
          <div className="grid gap-4">
            <ResponsiveDialogHeader>
              <ResponsiveDialogTitle>Invitation prête</ResponsiveDialogTitle>
              <ResponsiveDialogDescription>
                {result.emailSent
                  ? `Un e-mail est parti vers ${result.email}. Vous pouvez aussi lui transmettre le lien vous-même.`
                  : `L'e-mail n'a pas pu partir. Transmettez ce lien à ${result.email} : il n'ouvre l'accès qu'à cette adresse.`}
              </ResponsiveDialogDescription>
            </ResponsiveDialogHeader>
            <FieldGroup className="gap-3">
              <Input readOnly value={result.link} aria-label="Lien d'invitation" onFocus={(e) => e.currentTarget.select()} />
              <div className="grid gap-2 sm:grid-cols-2">
                <Button
                  variant="outline"
                  onClick={async () => {
                    await navigator.clipboard.writeText(result.link);
                    setCopied(true);
                  }}
                >
                  {copied ? <Check data-icon="inline-start" aria-hidden="true" /> : <Copy data-icon="inline-start" aria-hidden="true" />}
                  {copied ? "Lien copié" : "Copier le lien"}
                </Button>
                <Button variant="outline" asChild>
                  <a
                    href={`https://wa.me/?text=${encodeURIComponent(`Rejoins-nous sur Joliba : ${result.link}`)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <MessageCircle data-icon="inline-start" aria-hidden="true" />
                    Envoyer par WhatsApp
                  </a>
                </Button>
              </div>
              <FieldDescription>Le lien expire dans 7 jours.</FieldDescription>
            </FieldGroup>
            <ResponsiveDialogFooter>
              <Button variant="ghost" onClick={reset}>
                Inviter quelqu'un d'autre
              </Button>
              <Button onClick={close}>Terminé</Button>
            </ResponsiveDialogFooter>
          </div>
        ) : (
          <form onSubmit={submit} noValidate className="grid gap-4">
            <ResponsiveDialogHeader>
              <ResponsiveDialogTitle>Inviter un membre</ResponsiveDialogTitle>
              <ResponsiveDialogDescription>Portée : {scopeLabel}. La personne n'aura accès qu'à cela.</ResponsiveDialogDescription>
            </ResponsiveDialogHeader>
            <FieldGroup>
              <FormField label="Adresse e-mail" error={emailError}>
                <Input
                  type="email"
                  inputMode="email"
                  autoComplete="off"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  autoFocus
                  placeholder="koffi@exemple.ci"
                />
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
              {formError ? (
                <Alert variant="destructive">
                  <CircleAlert />
                  <AlertDescription>{formError}</AlertDescription>
                </Alert>
              ) : null}
            </FieldGroup>
            <ResponsiveDialogFooter>
              <Button type="button" variant="ghost" onClick={close}>
                Annuler
              </Button>
              <PendingButton type="submit" pending={sending} pendingText="Envoi…">
                Envoyer l'invitation
              </PendingButton>
            </ResponsiveDialogFooter>
          </form>
        )}
      </ResponsiveDialogContent>
    </ResponsiveDialog>
  );
}
