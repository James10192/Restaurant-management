import type { ReactNode } from "react";
import { Copy } from "lucide-react";
import { toast } from "sonner";
import { FieldDescription, FieldGroup } from "~/components/ui/field";
import { InputGroup, InputGroupAddon, InputGroupButton, InputGroupInput } from "~/components/ui/input-group";

const timeFormat = new Intl.DateTimeFormat("fr-FR", { hour: "2-digit", minute: "2-digit" });
const dateTimeFormat = new Intl.DateTimeFormat("fr-FR", { weekday: "long", hour: "2-digit", minute: "2-digit" });

/**
 * Un code à usage unique, montré une seule fois : le serveur n'en garde que l'empreinte, il ne
 * pourra pas le réafficher. D'où la copie à portée de pouce et l'heure limite écrite en clair.
 */
export function OneTimeCode({
  code,
  expiresAt,
  validity,
  label,
  instruction,
}: {
  code: string;
  expiresAt: number;
  /** « 10 minutes », « 24 heures ». */
  validity: string;
  label: string;
  instruction: ReactNode;
}) {
  const sameDay = new Date(expiresAt).toDateString() === new Date().toDateString();
  const until = sameDay ? timeFormat.format(expiresAt) : dateTimeFormat.format(expiresAt);

  async function copy() {
    try {
      await navigator.clipboard.writeText(code.replace(/-/g, ""));
      toast.success("Code copié.");
    } catch {
      toast.error("Copie impossible : recopiez le code à la main.");
    }
  }

  return (
    <FieldGroup className="gap-3">
      <InputGroup className="h-14">
        <InputGroupInput
          readOnly
          value={code}
          aria-label={label}
          className="text-center font-mono text-2xl font-semibold tracking-[0.2em] tabular-nums"
          onFocus={(e) => e.currentTarget.select()}
        />
        <InputGroupAddon align="inline-end">
          <InputGroupButton size="sm" variant="secondary" onClick={() => void copy()}>
            <Copy data-icon="inline-start" aria-hidden="true" />
            Copier
          </InputGroupButton>
        </InputGroupAddon>
      </InputGroup>
      <FieldDescription>
        Valable {validity}, jusqu'à {until}. Il ne sert qu'une fois et ne sera plus affiché après fermeture.
      </FieldDescription>
      <p className="text-sm">{instruction}</p>
    </FieldGroup>
  );
}
