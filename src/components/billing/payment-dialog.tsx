import { useState } from "react";
import { useMutation } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import { Banknote, CircleAlert, CreditCard, Landmark, Smartphone, Wallet } from "lucide-react";
import { toast } from "sonner";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { evenSplit } from "../../../convex/lib/billing";
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
import { Alert, AlertAction, AlertDescription, AlertTitle } from "~/components/ui/alert";
import { Button } from "~/components/ui/button";
import { Checkbox } from "~/components/ui/checkbox";
import { Field, FieldLabel } from "~/components/ui/field";
import { Input } from "~/components/ui/input";
import { ToggleGroup, ToggleGroupItem } from "~/components/ui/toggle-group";
import { describeError } from "~/lib/errors";
import { uuidv7 } from "~/lib/outbox";
import { useOptionalOutbox } from "~/components/service/outbox-provider";
import { useMoney, useServiceScope } from "~/components/service/service-scope";
import { amountToText, parseAmount } from "./amount";

export type Bill = FunctionReturnType<typeof api.checks.forSession>;
export type BillCheck = Bill["checks"][number];
type Method = "cash" | "mobile_money" | "card" | "transfer" | "other";

const METHODS: { value: Method; label: string; icon: typeof Banknote }[] = [
  { value: "cash", label: "Espèces", icon: Banknote },
  { value: "mobile_money", label: "Mobile Money", icon: Smartphone },
  { value: "card", label: "Carte", icon: CreditCard },
  { value: "transfer", label: "Virement", icon: Landmark },
  { value: "other", label: "Autre", icon: Wallet },
];

/**
 * Encaisser une addition — par une personne nommée, jamais hors ligne. Deux temps : la saisie,
 * puis une confirmation qui affiche en très gros le montant et la monnaie à rendre. Une faute de
 * frappe se prévient ici : l'encaissement ne s'annule pas par son propre auteur.
 */
export function PaymentDialog({ bill, check, open, onOpenChange }: { bill: Bill; check: BillCheck | null; open: boolean; onOpenChange: (open: boolean) => void }) {
  return (
    <ResponsiveDialog open={open} onOpenChange={onOpenChange}>
      <ResponsiveDialogContent>{open && check ? <PaymentForm bill={bill} check={check} onDone={() => onOpenChange(false)} /> : null}</ResponsiveDialogContent>
    </ResponsiveDialog>
  );
}

function PaymentForm({ bill, check, onDone }: { bill: Bill; check: BillCheck; onDone: () => void }) {
  const scope = useServiceScope();
  const money = useMoney();
  const online = useOptionalOutbox()?.online ?? true;
  const collect = useMutation(api.payments.collect);
  const openCash = useMutation(api.cash.open);
  const currency = bill.currency;
  const due = check.balance.due;
  const wallets = bill.settings.wallets;

  // La clé naît à l'ouverture du formulaire, pas au clic : un double appui ne double rien.
  const [idempotencyKey, setIdempotencyKey] = useState(() => uuidv7());
  const [method, setMethod] = useState<Method>("cash");
  const [amountText, setAmountText] = useState(amountToText(due, currency));
  const [receivedText, setReceivedText] = useState("");
  const [changeText, setChangeText] = useState<string | null>(null);
  const [wallet, setWallet] = useState(wallets[0] ?? "");
  const [reference, setReference] = useState("");
  const [cashBack, setCashBack] = useState(false);
  const [registerSessionId, setRegisterSessionId] = useState<Id<"cashRegisterSessions"> | null>(null);
  const [floatText, setFloatText] = useState("");
  const [step, setStep] = useState<"form" | "confirm">("form");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [needsCash, setNeedsCash] = useState(false);

  const amount = parseAmount(amountText, currency);
  const received = method === "cash" ? (receivedText.trim() === "" ? amount : parseAmount(receivedText, currency)) : null;
  const computedChange = method === "cash" && amount !== null && received !== null ? Math.max(0, received - amount) : 0;
  const change = changeText === null ? computedChange : (parseAmount(changeText, currency) ?? 0);
  const nonCashChange = method !== "cash" && cashBack ? (parseAmount(changeText ?? "", currency) ?? 0) : 0;
  const usesCash = method === "cash" || nonCashChange > 0;
  const chooseRegister = usesCash && bill.cash?.status === "choose_register";
  const noCash = usesCash && (bill.cash?.status === "no_cash_session" || needsCash);

  const amountError = amount === null ? "Montant invalide." : amount <= 0 ? "Le montant doit être positif." : amount > due ? `Au plus ${money(due)}.` : null;
  const receivedError = method === "cash" && received !== null && amount !== null && received < amount ? "Le client a remis moins que le montant." : null;
  const changeError =
    method === "cash" && change > computedChange
      ? `Au plus ${money(computedChange)}.`
      : method !== "cash" && amount !== null && nonCashChange >= amount
        ? "La monnaie rendue doit rester inférieure au montant encaissé."
        : null;
  const walletError = method === "mobile_money" && !wallet ? "Choisissez le portefeuille qui a reçu l'argent." : null;
  const ready = !amountError && !receivedError && !changeError && !walletError && (!chooseRegister || registerSessionId !== null) && !noCash;

  const canOpenCash = bill.settings.cashMode === "per_waiter" ? scope.can("payment.collect") : scope.can("cash_register.open");
  const methodLabel = method === "mobile_money" ? wallet || "Mobile Money" : METHODS.find((m) => m.value === method)!.label;

  async function confirm() {
    if (amount === null) return;
    setBusy(true);
    setError(null);
    try {
      const result = await collect({
        ...scope.acting,
        sessionId: bill.sessionId,
        checkId: check._id,
        method,
        amount,
        idempotencyKey,
        ...(method === "cash" && received !== null ? { receivedAmount: received, changeAmount: change } : {}),
        ...(method !== "cash" && nonCashChange > 0 ? { changeAmount: nonCashChange } : {}),
        ...(method === "mobile_money" ? { wallet } : {}),
        ...(reference.trim() ? { providerRef: reference.trim() } : {}),
        ...(registerSessionId ? { registerSessionId } : {}),
      });
      if (!result.ok) {
        // Refus sans effet : un nouvel essai prendra une nouvelle clé.
        setIdempotencyKey(uuidv7());
        setNeedsCash(result.reason === "no_cash_session");
        setStep("form");
        setError(result.reason === "no_cash_session" ? "Aucune caisse ouverte pour ranger ces espèces." : "Plusieurs caisses sont ouvertes : choisissez la vôtre.");
        return;
      }
      toast.success(result.due === 0 ? "Addition soldée." : `Encaissé. Reste ${money(result.due)}.`);
      onDone();
    } catch (err) {
      setError(describeError(err).message);
      setStep("form");
    } finally {
      setBusy(false);
    }
  }

  async function openRegister() {
    const float = parseAmount(floatText, currency);
    if (float === null) return;
    setBusy(true);
    try {
      const id = await openCash({ ...scope.acting, openingFloat: float });
      setRegisterSessionId(id);
      setNeedsCash(false);
      setError(null);
      toast.success(bill.settings.cashMode === "per_waiter" ? "Votre pochette est ouverte." : "La caisse est ouverte.");
    } catch (err) {
      setError(describeError(err).message);
    } finally {
      setBusy(false);
    }
  }

  const title = `Encaisser — Table ${bill.tableNumber}${check.kind === "allocated" && check.label ? ` · ${check.label}` : ""}`;

  if (step === "confirm" && amount !== null) {
    const giveBack = method === "cash" ? change : nonCashChange;
    return (
      <div className="flex flex-col gap-4">
        <ResponsiveDialogHeader>
          <ResponsiveDialogTitle>{title}</ResponsiveDialogTitle>
          <ResponsiveDialogDescription>Vérifiez avant de confirmer : l'encaissement sera à votre nom.</ResponsiveDialogDescription>
        </ResponsiveDialogHeader>
        <dl className="flex flex-col gap-3 rounded-lg border p-4">
          <div>
            <dt className="text-sm text-muted-foreground">Encaisser en {methodLabel}</dt>
            <dd className="text-4xl font-semibold tracking-tight tabular-nums">{money(amount)}</dd>
          </div>
          {method === "cash" && received !== null && received !== amount ? (
            <div>
              <dt className="text-sm text-muted-foreground">Remis par le client</dt>
              <dd className="text-xl tabular-nums">{money(received)}</dd>
            </div>
          ) : null}
          {giveBack > 0 ? (
            <div>
              <dt className="text-sm text-muted-foreground">Rendre en espèces</dt>
              <dd className="text-4xl font-semibold tracking-tight tabular-nums">{money(giveBack)}</dd>
            </div>
          ) : null}
          <div>
            <dt className="text-sm text-muted-foreground">Restera à payer</dt>
            <dd className="text-xl tabular-nums">{money(due - amount)}</dd>
          </div>
        </dl>
        {error ? (
          <Alert variant="destructive">
            <CircleAlert />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        ) : null}
        <ResponsiveDialogFooter>
          <Button variant="outline" onClick={() => setStep("form")}>
            Retour
          </Button>
          <PendingButton size="lg" pending={busy} pendingText="Encaissement…" disabled={!online} onClick={() => void confirm()}>
            Confirmer l'encaissement
          </PendingButton>
        </ResponsiveDialogFooter>
      </div>
    );
  }

  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={(e) => {
        e.preventDefault();
        if (ready) setStep("confirm");
      }}
    >
      <ResponsiveDialogHeader>
        <ResponsiveDialogTitle>{title}</ResponsiveDialogTitle>
        <ResponsiveDialogDescription>Reste à payer : {money(due)}</ResponsiveDialogDescription>
      </ResponsiveDialogHeader>

      <Field>
        <FieldLabel>Moyen de paiement</FieldLabel>
        <ToggleGroup
          type="single"
          variant="outline"
          className="grid w-full grid-cols-2 sm:grid-cols-3"
          value={method}
          onValueChange={(v) => {
            if (!v) return;
            setMethod(v as Method);
            setChangeText(null);
            setCashBack(false);
          }}
        >
          {METHODS.map((m) => (
            <ToggleGroupItem key={m.value} value={m.value} disabled={m.value === "mobile_money" && wallets.length === 0} className="h-11">
              <m.icon />
              {m.label}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
        {wallets.length === 0 ? <p className="text-sm text-muted-foreground">Mobile Money : aucun portefeuille réglé pour l'établissement.</p> : null}
      </Field>

      <FormField label="Montant encaissé" error={amountText.trim() !== "" ? amountError : undefined}>
        <Input inputMode="decimal" autoComplete="off" className="h-11 text-lg" value={amountText} onChange={(e) => setAmountText(e.target.value)} />
      </FormField>
      <div className="flex flex-wrap items-center gap-2">
        <Button type="button" size="sm" variant="secondary" onClick={() => setAmountText(amountToText(due, currency))}>
          Tout
        </Button>
        <span className="text-sm text-muted-foreground">Partager en</span>
        {[2, 3, 4, 5].map((n) => (
          <Button
            key={n}
            type="button"
            size="sm"
            variant="outline"
            onClick={() => setAmountText(amountToText(evenSplit(due, n, bill.settings.amountStep)[0]!, currency))}
          >
            {n}
          </Button>
        ))}
      </div>

      {method === "cash" ? (
        <>
          <FormField label="Remis par le client" optional description="Pour calculer la monnaie.">
            <Input inputMode="decimal" autoComplete="off" value={receivedText} onChange={(e) => setReceivedText(e.target.value)} />
          </FormField>
          {computedChange > 0 ? (
            <FormField
              label="Monnaie rendue"
              description="Ce que vous rendez réellement. Pas de monnaie ? Saisissez ce que vous rendez : l'écart restera visible à la caisse."
              error={changeError}
            >
              <Input inputMode="decimal" autoComplete="off" value={changeText ?? amountToText(computedChange, currency)} onChange={(e) => setChangeText(e.target.value)} />
            </FormField>
          ) : null}
          {receivedError ? <p className="text-sm text-destructive">{receivedError}</p> : null}
        </>
      ) : null}

      {method === "mobile_money" ? (
        <Field>
          <FieldLabel>Portefeuille qui a reçu</FieldLabel>
          <ToggleGroup type="single" variant="outline" className="flex w-full flex-wrap justify-start" value={wallet} onValueChange={(v) => v && setWallet(v)}>
            {wallets.map((w) => (
              <ToggleGroupItem key={w} value={w}>
                {w}
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
        </Field>
      ) : null}

      {method !== "cash" ? (
        <>
          <FormField label="Référence de la transaction" optional>
            <Input autoComplete="off" maxLength={60} value={reference} onChange={(e) => setReference(e.target.value)} />
          </FormField>
          <Field orientation="horizontal">
            <Checkbox
              id="cash-back"
              checked={cashBack}
              onCheckedChange={(v) => {
                setCashBack(v === true);
                setChangeText(v === true ? "" : null);
              }}
            />
            <FieldLabel htmlFor="cash-back" className="font-normal">
              Le client a envoyé plus : je rends la différence en espèces
            </FieldLabel>
          </Field>
          {cashBack ? (
            <FormField label="Monnaie rendue en espèces" error={changeError}>
              <Input inputMode="decimal" autoComplete="off" value={changeText ?? ""} onChange={(e) => setChangeText(e.target.value)} />
            </FormField>
          ) : null}
        </>
      ) : null}

      {chooseRegister ? (
        <Field>
          <FieldLabel>Caisse</FieldLabel>
          <ToggleGroup type="single" variant="outline" className="flex w-full flex-wrap justify-start" value={registerSessionId ?? ""} onValueChange={(v) => setRegisterSessionId(v ? (v as Id<"cashRegisterSessions">) : null)}>
            {(bill.cash?.options ?? []).map((o) => (
              <ToggleGroupItem key={o._id} value={o._id}>
                {o.name}
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
        </Field>
      ) : null}

      {noCash ? (
        <Alert>
          <Banknote />
          <AlertTitle>{bill.settings.cashMode === "per_waiter" ? "Votre pochette n'est pas ouverte" : "Aucune caisse ouverte"}</AlertTitle>
          <AlertDescription>
            {canOpenCash ? (
              <div className="flex flex-col gap-2">
                <span>Une espèce doit entrer dans une caisse ouverte : sinon l'écart du soir serait inexplicable.</span>
                <FormField label="Fonds de départ">
                  <Input inputMode="decimal" value={floatText} onChange={(e) => setFloatText(e.target.value)} />
                </FormField>
              </div>
            ) : (
              "Demandez l'ouverture de la caisse, ou choisissez un autre moyen."
            )}
          </AlertDescription>
          {canOpenCash ? (
            <AlertAction>
              <PendingButton type="button" size="sm" pending={busy} disabled={!online || parseAmount(floatText, currency) === null} onClick={() => void openRegister()}>
                Ouvrir
              </PendingButton>
            </AlertAction>
          ) : null}
        </Alert>
      ) : null}

      {error && !noCash ? (
        <Alert variant="destructive">
          <CircleAlert />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}
      {!online ? <p className="text-sm text-muted-foreground">Sans réseau, on n'encaisse pas : prenez l'argent, saisissez-le au retour du réseau.</p> : null}

      <ResponsiveDialogFooter>
        <Button type="button" variant="outline" onClick={onDone}>
          Annuler
        </Button>
        <Button type="submit" size="lg" disabled={!ready || !online}>
          Continuer
        </Button>
      </ResponsiveDialogFooter>
    </form>
  );
}
