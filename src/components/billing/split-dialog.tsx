import { useState } from "react";
import { useMutation } from "convex/react";
import { CircleAlert, Minus, Plus } from "lucide-react";
import { toast } from "sonner";
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
import { ButtonGroup } from "~/components/ui/button-group";
import { Input } from "~/components/ui/input";
import { Item, ItemActions, ItemContent, ItemDescription, ItemGroup, ItemTitle } from "~/components/ui/item";
import { describeError } from "~/lib/errors";
import { useOptionalOutbox } from "~/components/service/outbox-provider";
import { useMoney, useServiceScope } from "~/components/service/service-scope";
import type { Bill, BillCheck } from "./payment-dialog";

const EPSILON = 1e-9;

function quantityLabel(q: number): string {
  if (Number.isInteger(q)) return String(q);
  if (Math.abs(q - 0.5) < EPSILON) return "½";
  return q.toLocaleString("fr-FR", { maximumFractionDigits: 2 });
}

/**
 * Partager par articles : « Marcel paie son poulet et la moitié de la bouteille ». Les lignes
 * choisies quittent le reste de la table pour une addition à son nom. Ce qui est déjà payé ne se
 * détache pas.
 */
export function SplitDialog({ bill, rest, open, onOpenChange }: { bill: Bill; rest: BillCheck | null; open: boolean; onOpenChange: (open: boolean) => void }) {
  return (
    <ResponsiveDialog open={open} onOpenChange={onOpenChange}>
      <ResponsiveDialogContent>{open && rest ? <SplitForm bill={bill} rest={rest} onDone={() => onOpenChange(false)} /> : null}</ResponsiveDialogContent>
    </ResponsiveDialog>
  );
}

function SplitForm({ bill, rest, onDone }: { bill: Bill; rest: BillCheck; onDone: () => void }) {
  const scope = useServiceScope();
  const money = useMoney();
  const online = useOptionalOutbox()?.online ?? true;
  const split = useMutation(api.checks.split);
  const [label, setLabel] = useState("");
  const [taken, setTaken] = useState<Record<string, number>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const lines = rest.lines.filter((l) => !l.comped && l.quantity > EPSILON);

  const estimate = lines.reduce((s, l) => s + Math.floor((l.amount * (taken[l.orderItemId] ?? 0)) / l.quantity), 0);
  const chosen = Object.entries(taken).filter(([, q]) => q > EPSILON);
  // Les convives qui ont commandé de leur téléphone (D-102) : « Articles du convive 2 » coche d'un
  // geste toutes leurs lignes. Les lignes sans convive unique restent au reste de la table.
  const guestNumbers = [...new Set(lines.map((l) => l.guestNumber).filter((n): n is number => n !== null))].sort((a, b) => a - b);

  function presetGuest(n: number) {
    setTaken(Object.fromEntries(lines.filter((l) => l.guestNumber === n).map((l) => [l.orderItemId, l.quantity])));
    if (!label.trim()) setLabel(`Convive ${n}`);
  }

  function set(id: Id<"orderItems">, q: number, max: number) {
    setTaken((t) => ({ ...t, [id]: Math.max(0, Math.min(max, q)) }));
  }

  async function submit() {
    setBusy(true);
    setError(null);
    try {
      await split({
        ...scope.acting,
        sessionId: bill.sessionId,
        ...(label.trim() ? { label: label.trim() } : {}),
        lines: chosen.map(([orderItemId, quantity]) => ({ orderItemId: orderItemId as Id<"orderItems">, quantity })),
      });
      toast.success(label.trim() ? `Addition de ${label.trim()} créée.` : "Addition séparée créée.");
      onDone();
    } catch (err) {
      setError(describeError(err).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <ResponsiveDialogHeader>
        <ResponsiveDialogTitle>Partager par articles</ResponsiveDialogTitle>
        <ResponsiveDialogDescription>Choisissez ce que cette personne paie. Un plat partagé : prenez-en la moitié.</ResponsiveDialogDescription>
      </ResponsiveDialogHeader>
      {guestNumbers.length > 0 ? (
        <div className="flex flex-wrap gap-2" role="group" aria-label="Présélection par convive">
          {guestNumbers.map((n) => (
            <Button key={n} type="button" size="sm" variant="outline" onClick={() => presetGuest(n)}>
              Articles du convive {n}
            </Button>
          ))}
        </div>
      ) : null}
      <FormField label="Au nom de" optional>
        <Input maxLength={40} placeholder="Ex. : Marcel" value={label} onChange={(e) => setLabel(e.target.value)} />
      </FormField>
      <ItemGroup className="gap-2">
        {lines.map((l) => {
          const q = taken[l.orderItemId] ?? 0;
          const canHalf = q + 0.5 <= l.quantity + EPSILON;
          return (
            <Item key={l.orderItemId} variant="outline" size="sm">
              <ItemContent className="min-w-0">
                <ItemTitle className="max-w-full truncate">
                  {quantityLabel(l.quantity)} × {l.name}
                  {l.variantName ? ` — ${l.variantName}` : ""}
                </ItemTitle>
                <ItemDescription>
                  {money(l.amount)}
                  {l.guestNumber !== null ? ` · Convive ${l.guestNumber}` : ""}
                </ItemDescription>
              </ItemContent>
              <ItemActions>
                <Button type="button" size="sm" variant="ghost" disabled={!canHalf} onClick={() => set(l.orderItemId, q + 0.5, l.quantity)}>
                  +½
                </Button>
                <ButtonGroup aria-label={`Part de ${l.name}`}>
                  <Button type="button" size="icon-sm" variant="outline" aria-label="Moins" disabled={q <= EPSILON} onClick={() => set(l.orderItemId, Math.ceil(q - 1 - EPSILON), l.quantity)}>
                    <Minus />
                  </Button>
                  <Button type="button" size="sm" variant="outline" className="min-w-10 tabular-nums" tabIndex={-1}>
                    {quantityLabel(q)}
                  </Button>
                  <Button type="button" size="icon-sm" variant="outline" aria-label="Plus" disabled={q >= l.quantity - EPSILON} onClick={() => set(l.orderItemId, Math.floor(q + 1 + EPSILON), l.quantity)}>
                    <Plus />
                  </Button>
                </ButtonGroup>
              </ItemActions>
            </Item>
          );
        })}
      </ItemGroup>
      <p className="text-sm text-muted-foreground">Environ {money(estimate)} sur cette addition.</p>
      {error ? (
        <Alert variant="destructive">
          <CircleAlert />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}
      <ResponsiveDialogFooter>
        <Button type="button" variant="outline" onClick={onDone}>
          Annuler
        </Button>
        <PendingButton pending={busy} disabled={chosen.length === 0 || !online} onClick={() => void submit()}>
          Créer l'addition
        </PendingButton>
      </ResponsiveDialogFooter>
    </div>
  );
}
