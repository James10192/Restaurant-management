import { useState, type FormEvent } from "react";
import { useAction, useQuery } from "convex/react";
import { Check, Copy, MessageCircle } from "lucide-react";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { Alert, AlertDescription } from "~/components/ui/alert";
import { Button } from "~/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "~/components/ui/dialog";
import { Field } from "~/components/ui/field";
import { Input } from "~/components/ui/input";
import { NativeSelect } from "~/components/ui/native-select";
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
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) reset();
        onOpenChange(next);
      }}
    >
      <DialogContent>
        {result ? (
          <>
            <DialogHeader>
              <DialogTitle>Invitation prête</DialogTitle>
              <DialogDescription>
                {result.emailSent
                  ? `Un e-mail est parti vers ${result.email}. Vous pouvez aussi lui transmettre le lien vous-même.`
                  : `L'e-mail n'a pas pu partir. Transmettez ce lien à ${result.email} : il n'ouvre l'accès qu'à cette adresse.`}
              </DialogDescription>
            </DialogHeader>
            <div className="mt-4 flex flex-col gap-3">
              <Input readOnly value={result.link} aria-label="Lien d'invitation" onFocus={(e) => e.currentTarget.select()} />
              <div className="flex flex-wrap gap-2">
                <Button
                  variant="secondary"
                  onClick={async () => {
                    await navigator.clipboard.writeText(result.link);
                    setCopied(true);
                  }}
                >
                  {copied ? <Check aria-hidden="true" className="size-4" /> : <Copy aria-hidden="true" className="size-4" />}
                  {copied ? "Lien copié" : "Copier le lien"}
                </Button>
                <Button variant="secondary" asChild>
                  <a
                    href={`https://wa.me/?text=${encodeURIComponent(`Rejoins-nous sur Joliba : ${result.link}`)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <MessageCircle aria-hidden="true" className="size-4" />
                    Envoyer par WhatsApp
                  </a>
                </Button>
              </div>
              <p className="text-label text-ink-3">Le lien expire dans 7 jours.</p>
            </div>
            <DialogFooter className="mt-6">
              <Button variant="quiet" onClick={reset}>
                Inviter quelqu'un d'autre
              </Button>
              <Button onClick={() => onOpenChange(false)}>Terminé</Button>
            </DialogFooter>
          </>
        ) : (
          <form onSubmit={submit} noValidate>
            <DialogHeader>
              <DialogTitle>Inviter un membre</DialogTitle>
              <DialogDescription>Portée : {scopeLabel}. La personne n'aura accès qu'à cela.</DialogDescription>
            </DialogHeader>
            <div className="mt-4 flex flex-col gap-4">
              <Field label="Adresse e-mail" error={emailError}>
                <Input type="email" inputMode="email" autoComplete="off" value={email} onChange={(e) => setEmail(e.target.value)} autoFocus />
              </Field>
              <Field
                label="Rôle"
                description={
                  blocked.length > 0
                    ? "Les rôles grisés accordent des droits que vous n'avez pas vous-même : seule une personne qui les détient peut les attribuer."
                    : undefined
                }
              >
                <NativeSelect value={roleId} onChange={(e) => setRoleId(e.target.value)} disabled={roles === undefined}>
                  <option value="">{roles === undefined ? "Chargement des rôles…" : "Choisir un rôle"}</option>
                  {grantable.map((r) => (
                    <option key={r._id} value={r._id}>
                      {r.label}
                    </option>
                  ))}
                  {blocked.length > 0 ? (
                    <optgroup label="Non attribuables par vous">
                      {blocked.map((r) => (
                        <option key={r._id} value={r._id} disabled>
                          {r.label}
                        </option>
                      ))}
                    </optgroup>
                  ) : null}
                </NativeSelect>
              </Field>
              {formError ? (
                <Alert variant="danger">
                  <AlertDescription>{formError}</AlertDescription>
                </Alert>
              ) : null}
            </div>
            <DialogFooter className="mt-6">
              <Button variant="quiet" onClick={() => onOpenChange(false)}>
                Annuler
              </Button>
              <Button type="submit" loading={sending} loadingText="Envoi…">
                Envoyer l'invitation
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
