/**
 * Régler l'addition depuis sa table — Joliba (T5, D-112, D-113, D-120)
 *
 * Chargé à la demande, jamais avec la carte (D-058). Deux choix seulement : tout le reste de la
 * table, ou mes articles — le montant vient du serveur, jamais de ce téléphone (R14). « Payer »
 * ouvre Wave ; la clé d'idempotence est tirée à l'ouverture du tiroir, pas au clic : un double
 * appui retrouve la même session Wave.
 *
 * Au retour de Wave, rien n'est cru sur parole (R15) : l'écran demande au serveur de relire Wave,
 * et ne dit « Paiement reçu » qu'une fois le paiement enregistré. Après deux minutes sans
 * confirmation, il dit quoi faire plutôt que d'attendre indéfiniment.
 */

import { CheckCircle2Icon, ExternalLinkIcon, RefreshCwIcon, WifiOffIcon } from "lucide-react";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { formatMoney, type CurrencyCode } from "../../../convex/lib/money";
import { Alert, AlertDescription, AlertTitle } from "~/components/ui/alert";
import { Button } from "~/components/ui/button";
import { Drawer, DrawerClose, DrawerContent, DrawerDescription, DrawerFooter, DrawerHeader, DrawerTitle } from "~/components/ui/drawer";
import { Field, FieldContent, FieldDescription, FieldLabel, FieldLegend, FieldSet, FieldTitle } from "~/components/ui/field";
import { RadioGroup, RadioGroupItem } from "~/components/ui/radio-group";
import { Spinner } from "~/components/ui/spinner";
import { randomKey } from "~/lib/guest/cart";
import type { GuestLocale } from "~/lib/guest/i18n";
import { PAYMENT_TEXT } from "~/lib/guest/payment-text";
import { callTable, type PaymentTarget, type Presence } from "~/lib/guest/table-api";

type Payment = NonNullable<Presence["payment"]>;
export type ReturnState = "retour" | "erreur" | null;

/** Au-delà, sans confirmation de Wave, on dit quoi faire (D-120). */
const CONFIRM_PATIENCE_MS = 2 * 60 * 1000;

export default function GuestPayment({
  open,
  onOpenChange,
  guestKey,
  payment,
  online,
  locale,
  returnState,
  onChanged,
  codeEntry,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  guestKey: string;
  payment: Payment | null;
  online: boolean;
  locale: GuestLocale;
  returnState: ReturnState;
  onChanged: () => void;
  /** Pas encore admis : la saisie du code de la table, fournie par la page (D-112). */
  codeEntry: ReactNode;
}) {
  const t = PAYMENT_TEXT[locale];
  const money = (amount: number) => formatMoney({ amount, currency: (payment?.currency ?? "XOF") as CurrencyCode });
  const [target, setTarget] = useState<PaymentTarget>(payment?.myItemsDue ? "my_items" : "remainder");
  const [busy, setBusy] = useState<"start" | "check" | null>(null);
  const [message, setMessage] = useState<{ tone: "info" | "error"; text: string } | null>(returnState === "erreur" ? { tone: "error", text: t.returnError } : null);
  const [checkingSince, setCheckingSince] = useState<number | null>(returnState === "retour" ? Date.now() : null);
  const [now, setNow] = useState(() => Date.now());
  // Tirée à l'ouverture du tiroir : un double appui rejoue la même clé (PAYMENTS §4).
  const key = useRef(randomKey());
  useEffect(() => {
    if (open) key.current = randomKey();
  }, [open]);

  const current = payment?.current ?? null;
  const pending = current !== null && (current.status === "initializing" || current.status === "processing");
  const paid = current?.status === "succeeded" && now - current.at < 30 * 60 * 1000;

  const check = async () => {
    setBusy("check");
    try {
      const res = await callTable({ action: "checkPayment", guestKey });
      if (res.ok && res.value.status === "paid") setMessage(null);
      else if (res.ok && res.value.status === "pending") setMessage({ tone: "info", text: t.notYet });
      onChanged();
    } finally {
      setBusy(null);
    }
  };

  // Au retour de Wave : relire une fois, puis toutes les 10 s pendant la patience (D-120).
  useEffect(() => {
    if (checkingSince === null || !open) return;
    if (paid) {
      setCheckingSince(null);
      return;
    }
    void check();
    const timer = window.setInterval(() => {
      setNow(Date.now());
      if (Date.now() - checkingSince < CONFIRM_PATIENCE_MS) void check();
    }, 10_000);
    return () => window.clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [checkingSince, open, paid]);

  const start = async () => {
    if (!online) return setMessage({ tone: "error", text: t.offline });
    setBusy("start");
    setMessage(null);
    try {
      const res = await callTable({ action: "startPayment", guestKey, target, idempotencyKey: key.current });
      if (!res.ok) return setMessage({ tone: "error", text: t.unavailable });
      const r = res.value;
      if (r.ok && r.status === "ready") {
        setMessage({ tone: "info", text: t.opening });
        setCheckingSince(Date.now());
        window.location.assign(r.launchUrl);
        return;
      }
      if (r.ok && r.status === "paid") {
        onChanged();
        return;
      }
      if (r.ok && r.status === "pending") {
        setMessage({ tone: "info", text: t.opening });
        window.setTimeout(() => void start(), 2000);
        return;
      }
      if (!r.ok) {
        const text =
          r.reason === "nothing_due"
            ? t.nothingDue
            : r.reason === "in_progress_elsewhere"
              ? t.inProgressElsewhere
              : r.reason === "code_required" || r.reason === "removed"
                ? t.codeRequired
                : r.reason === "rate_limited"
                  ? t.rateLimited
                  : t.unavailable;
        setMessage({ tone: "error", text });
        onChanged();
      }
    } finally {
      setBusy(null);
    }
  };

  const amountOf = (x: PaymentTarget) => (x === "my_items" ? payment?.myItemsDue : payment?.remainderDue) ?? null;
  const selected = amountOf(target);
  const waited = checkingSince !== null && now - checkingSince >= CONFIRM_PATIENCE_MS;

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="mx-auto max-w-2xl">
        <DrawerHeader className="text-left">
          <DrawerTitle className="text-xl font-semibold tracking-tight">{t.title}</DrawerTitle>
          <DrawerDescription>{t.description}</DrawerDescription>
        </DrawerHeader>
        <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-4 pb-2">
          {payment === null && codeEntry ? (
            codeEntry
          ) : paid ? (
            <Alert role="status">
              <CheckCircle2Icon />
              <AlertTitle>{t.paid}</AlertTitle>
              <AlertDescription>
                {money(current!.amount)} · {t.paidText}
              </AlertDescription>
            </Alert>
          ) : pending && current ? (
            <Alert role="status">
              {busy === "check" || checkingSince !== null ? <Spinner /> : <RefreshCwIcon />}
              <AlertTitle>{t.inProgress(money(current.amount))}</AlertTitle>
              <AlertDescription className="flex flex-col gap-1">
                <span>{checkingSince !== null ? t.checking : t.inProgressText}</span>
                {current.lastErrorCode ? <span>{t.failedAttempt}</span> : null}
                {waited ? <span className="font-medium">{t.notYetLong}</span> : null}
              </AlertDescription>
            </Alert>
          ) : payment && (payment.remainderDue !== null || payment.myItemsDue !== null) ? (
            <FieldSet>
              <FieldLegend variant="label">{t.choose}</FieldLegend>
              <RadioGroup value={target} onValueChange={(v) => setTarget(v as PaymentTarget)}>
                {(["my_items", "remainder"] as const).map((x) => {
                  const amount = amountOf(x);
                  if (amount === null) return null;
                  const disabled = x === "remainder" && payment.remainderBusy;
                  return (
                    <FieldLabel key={x} htmlFor={`pay-${x}`}>
                      <Field orientation="horizontal" data-disabled={disabled || undefined}>
                        <FieldContent>
                          <FieldTitle>
                            {x === "my_items" ? t.myItems : t.remainder} · <span className="tabular-nums">{money(amount)}</span>
                          </FieldTitle>
                          <FieldDescription>{disabled ? t.inProgressElsewhere : x === "my_items" ? t.myItemsHint : t.remainderHint}</FieldDescription>
                        </FieldContent>
                        <RadioGroupItem value={x} id={`pay-${x}`} disabled={disabled} />
                      </Field>
                    </FieldLabel>
                  );
                })}
              </RadioGroup>
            </FieldSet>
          ) : (
            <p className="py-2 text-muted-foreground">{t.nothingDue}</p>
          )}
          {current && !pending && !paid && (current.status === "expired" || current.status === "failed" || current.status === "cancelled") && checkingSince !== null ? (
            <Alert>
              <AlertDescription>{t.closedText}</AlertDescription>
            </Alert>
          ) : null}
          {!online ? (
            <Alert>
              <WifiOffIcon />
              <AlertDescription>{t.offline}</AlertDescription>
            </Alert>
          ) : null}
          {message ? (
            <Alert variant={message.tone === "error" ? "destructive" : "default"} role={message.tone === "error" ? "alert" : "status"}>
              <AlertDescription>{message.text}</AlertDescription>
            </Alert>
          ) : null}
          <p className="text-sm text-muted-foreground">{t.orCash}</p>
        </div>
        <DrawerFooter>
          {pending && current ? (
            <>
              {current.launchUrl ? (
                <Button asChild size="lg" className="h-12">
                  <a href={current.launchUrl} rel="noreferrer">
                    <ExternalLinkIcon data-icon="inline-start" />
                    {t.continueWave}
                  </a>
                </Button>
              ) : null}
              <Button type="button" variant="secondary" size="lg" className="h-12" disabled={!online || busy !== null} onClick={() => void check()}>
                {busy === "check" ? <Spinner data-icon="inline-start" /> : null}
                {t.check}
              </Button>
            </>
          ) : !paid && selected !== null && payment ? (
            <Button
              type="button"
              size="lg"
              className="h-12"
              disabled={!online || busy !== null || (target === "remainder" && payment.remainderBusy)}
              onClick={() => void start()}
            >
              {busy === "start" ? <Spinner data-icon="inline-start" /> : null}
              {t.pay(money(selected))}
            </Button>
          ) : null}
          <DrawerClose asChild>
            <Button type="button" variant="outline" size="lg" className="h-11">
              {locale === "fr" ? "Fermer" : "Close"}
            </Button>
          </DrawerClose>
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  );
}
