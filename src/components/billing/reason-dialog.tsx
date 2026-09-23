import { useState, type ReactNode } from "react";
import { CircleAlert } from "lucide-react";
import { PendingButton } from "~/components/app/pending-button";
import { FormField } from "~/components/app/form-field";
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
import { Input } from "~/components/ui/input";
import { Textarea } from "~/components/ui/textarea";
import { describeError } from "~/lib/errors";
import { useOptionalOutbox } from "~/components/service/outbox-provider";

/**
 * Un geste d'argent qui exige un motif : offrir, remettre, annuler une saisie, rembourser, clôturer
 * avec un impayé. Le motif est lu par le gérant dans le rapport de fin de service : il se tape,
 * il ne se coche pas. Jamais hors ligne.
 */
export function ReasonDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel,
  destructive = false,
  amount,
  children,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: ReactNode;
  confirmLabel: string;
  destructive?: boolean;
  /** Un montant à saisir (remise, remboursement), avec sa conversion depuis le texte. */
  amount?: { label: string; initial?: string; parse: (text: string) => number | null };
  children?: ReactNode;
  onConfirm: (input: { reason: string; amount: number | null }) => Promise<void>;
}) {
  return (
    <ResponsiveDialog open={open} onOpenChange={onOpenChange}>
      <ResponsiveDialogContent>
        {open ? (
          <ReasonForm
            title={title}
            description={description}
            confirmLabel={confirmLabel}
            destructive={destructive}
            {...(amount ? { amount } : {})}
            onConfirm={onConfirm}
            onCancel={() => onOpenChange(false)}
          >
            {children}
          </ReasonForm>
        ) : null}
      </ResponsiveDialogContent>
    </ResponsiveDialog>
  );
}

function ReasonForm({
  title,
  description,
  confirmLabel,
  destructive,
  amount,
  children,
  onConfirm,
  onCancel,
}: {
  title: string;
  description: ReactNode;
  confirmLabel: string;
  destructive: boolean;
  amount?: { label: string; initial?: string; parse: (text: string) => number | null };
  children?: ReactNode;
  onConfirm: (input: { reason: string; amount: number | null }) => Promise<void>;
  onCancel: () => void;
}) {
  const online = useOptionalOutbox()?.online ?? true;
  const [reason, setReason] = useState("");
  const [amountText, setAmountText] = useState(amount?.initial ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const parsed = amount ? amount.parse(amountText) : null;
  const reasonOk = reason.trim().length >= 5;
  const amountOk = !amount || (parsed !== null && parsed > 0);

  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={async (e) => {
        e.preventDefault();
        if (!reasonOk || !amountOk) return;
        setBusy(true);
        setError(null);
        try {
          await onConfirm({ reason: reason.trim(), amount: parsed });
        } catch (err) {
          setError(describeError(err).message);
        } finally {
          setBusy(false);
        }
      }}
    >
      <ResponsiveDialogHeader>
        <ResponsiveDialogTitle>{title}</ResponsiveDialogTitle>
        <ResponsiveDialogDescription>{description}</ResponsiveDialogDescription>
      </ResponsiveDialogHeader>
      <div className="flex flex-col gap-4">
        {children}
        {amount ? (
          <FormField label={amount.label} error={amountText !== "" && !amountOk ? "Montant invalide." : undefined}>
            <Input inputMode="decimal" autoComplete="off" value={amountText} onChange={(e) => setAmountText(e.target.value)} />
          </FormField>
        ) : null}
        <FormField label="Motif" description="Lu par le gérant dans le rapport de fin de service. Cinq caractères au moins.">
          <Textarea rows={2} maxLength={300} value={reason} onChange={(e) => setReason(e.target.value)} />
        </FormField>
        {error ? (
          <Alert variant="destructive">
            <CircleAlert />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        ) : null}
        {!online ? <p className="text-sm text-muted-foreground">Sans réseau : ce geste attend la connexion.</p> : null}
      </div>
      <ResponsiveDialogFooter>
        <Button type="button" variant="outline" onClick={onCancel}>
          Annuler
        </Button>
        <PendingButton type="submit" variant={destructive ? "destructive" : "default"} pending={busy} disabled={!reasonOk || !amountOk || !online}>
          {confirmLabel}
        </PendingButton>
      </ResponsiveDialogFooter>
    </form>
  );
}
