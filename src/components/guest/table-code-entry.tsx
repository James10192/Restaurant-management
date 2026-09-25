/**
 * Saisie du code de la table — Joliba (D-095, D-096)
 *
 * En commande directe, seul un convive ADMIS envoie en cuisine. Le code — quatre chiffres tirés à
 * chaque ouverture de la table — prouve qu'on est assis à cette tablée-ci : le QR, lui, reste le
 * même d'une tablée à l'autre, et une photo suffit à le rescanner depuis la rue.
 *
 * Le code est vérifié par Convex, qui compte les essais faux (5 par QR et par 10 minutes, puis un
 * code neuf après 10 échecs). Il n'est gardé nulle part sur le téléphone.
 */

import { REGEXP_ONLY_DIGITS } from "input-otp";
import { useState } from "react";
import { Alert, AlertDescription, AlertTitle } from "~/components/ui/alert";
import { Field, FieldDescription, FieldLabel } from "~/components/ui/field";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "~/components/ui/input-otp";
import { Spinner } from "~/components/ui/spinner";
import type { OrderText } from "~/lib/guest/order-text";
import { callTable } from "~/lib/guest/table-api";

export function TableCodeEntry({
  guestKey,
  guestNumber,
  online,
  o,
  onAdmitted,
}: {
  guestKey: string;
  /** Connu dès que le téléphone a rejoint (panier montré) : le serveur admet « le convive N ». */
  guestNumber: number | null;
  online: boolean;
  o: OrderText;
  onAdmitted: () => void;
}) {
  const [value, setValue] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (code: string) => {
    if (!online) return setError(o.offlineSend);
    setBusy(true);
    setError(null);
    try {
      const res = await callTable({ action: "enterCode", guestKey, code });
      if (!res.ok) return setError(res.error === "no_pass" ? o.noPass : o.networkError);
      const r = res.value;
      if (r.ok) {
        onAdmitted();
        return;
      }
      setValue("");
      setError(
        r.reason === "wrong_code"
          ? o.codeWrong
          : r.reason === "rate_limited"
            ? o.codeRateLimited(Math.ceil(r.retryAfter / 1000))
            : r.reason === "removed"
              ? o.removedText
              : r.reason === "table_not_open"
                ? `${o.tableClosedTitle}. ${o.tableClosedText}`
                : r.reason === "full"
                  ? o.full
                  : r.reason === "invalid_pass"
                    ? o.noPass
                    : o.networkError,
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <Alert>
      <AlertTitle>{o.codeTitle}</AlertTitle>
      <AlertDescription className="flex flex-col gap-3">
        <span>{o.codeText}</span>
        <Field className="gap-2">
          <FieldLabel htmlFor="table-code" className="sr-only">
            {o.codeLabel}
          </FieldLabel>
          <div className="flex items-center gap-3">
            <InputOTP
              id="table-code"
              maxLength={4}
              pattern={REGEXP_ONLY_DIGITS}
              inputMode="numeric"
              autoComplete="off"
              value={value}
              disabled={busy}
              aria-invalid={error !== null}
              onChange={(next) => {
                setValue(next);
                if (error) setError(null);
              }}
              onComplete={(code: string) => void submit(code)}
            >
              <InputOTPGroup>
                {[0, 1, 2, 3].map((i) => (
                  <InputOTPSlot key={i} index={i} className="size-12 text-lg" />
                ))}
              </InputOTPGroup>
            </InputOTP>
            {busy ? <Spinner /> : null}
          </div>
          {error ? (
            <p className="text-sm text-destructive" role="alert">
              {error}
            </p>
          ) : (
            <FieldDescription>{guestNumber !== null ? o.showToBeAdmitted(guestNumber) : o.codeOrShow}</FieldDescription>
          )}
        </Field>
      </AlertDescription>
    </Alert>
  );
}
