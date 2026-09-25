import { useEffect, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { REGEXP_ONLY_DIGITS } from "input-otp";
import { CircleCheck } from "lucide-react";
import { AuthLayout } from "~/components/app/auth-layout";
import { useAuthStatus } from "~/components/app/convex-providers";
import { FormField } from "~/components/app/form-field";
import { PendingButton } from "~/components/app/pending-button";
import { Alert, AlertDescription } from "~/components/ui/alert";
import { Button } from "~/components/ui/button";
import { FieldDescription, FieldGroup } from "~/components/ui/field";
import { InputOTP, InputOTPGroup, InputOTPSeparator, InputOTPSlot } from "~/components/ui/input-otp";
import { authClient } from "~/lib/auth-client";
import { pendingEmail, safeRedirect } from "~/lib/redirect";

type Search = { redirect?: string };

export const Route = createFileRoute("/_auth/auth/otp")({
  validateSearch: (search: Record<string, unknown>): Search =>
    typeof search.redirect === "string" ? { redirect: search.redirect } : {},
  head: () => ({ meta: [{ title: "Code de connexion — Joliba" }, { name: "robots", content: "noindex" }] }),
  component: OtpPage,
});

const RESEND_DELAY_SECONDS = 60;

function OtpPage() {
  const { redirect } = Route.useSearch();
  const destination = safeRedirect(redirect);
  const navigate = useNavigate();
  const auth = useAuthStatus();
  const [email, setEmail] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [verifying, setVerifying] = useState(false);
  const [signedIn, setSignedIn] = useState(false);
  const [resendIn, setResendIn] = useState(RESEND_DELAY_SECONDS);
  const [resent, setResent] = useState(false);

  useEffect(() => {
    const stored = pendingEmail.get();
    if (!stored) {
      void navigate({ to: "/connexion", search: redirect ? { redirect: destination } : {}, replace: true });
      return;
    }
    setEmail(stored);
  }, [navigate, redirect, destination]);

  useEffect(() => {
    if (resendIn <= 0) return;
    const timer = window.setTimeout(() => setResendIn((s) => s - 1), 1000);
    return () => window.clearTimeout(timer);
  }, [resendIn]);

  // On ne quitte l'écran qu'une fois la session VUE par Convex : partir avant ferait
  // rebondir l'application vers la connexion.
  useEffect(() => {
    if (signedIn && auth.isAuthenticated) {
      pendingEmail.clear();
      void navigate({ to: destination, replace: true });
    }
  }, [signedIn, auth.isAuthenticated, destination, navigate]);

  async function verify(value: string) {
    if (!email || value.length !== 6 || verifying) return;
    setVerifying(true);
    setError(null);
    const { error: failure } = await authClient.signIn.emailOtp({ email, otp: value });
    if (failure) {
      setVerifying(false);
      setCode("");
      const tooMany = failure.code === "TOO_MANY_ATTEMPTS" || failure.status === 429;
      setError(
        tooMany
          ? "Trop d'essais pour ce code. Demandez-en un nouveau."
          : "Code invalide ou expiré. Vérifiez les six chiffres, ou demandez un nouveau code.",
      );
      return;
    }
    setSignedIn(true);
  }

  async function resend() {
    if (!email) return;
    setError(null);
    setResent(false);
    setResendIn(RESEND_DELAY_SECONDS);
    const { error: failure } = await authClient.emailOtp.sendVerificationOtp({ email, type: "sign-in" });
    if (failure) {
      setError(
        failure.status === 429
          ? "Trop de demandes de code. Patientez une minute avant de réessayer."
          : "Le code n'a pas pu être renvoyé. Vérifiez votre connexion.",
      );
      return;
    }
    setResent(true);
  }

  return (
    <AuthLayout
      title="Saisissez votre code"
      description={
        email ? (
          <>
            Nous avons envoyé un code à six chiffres à <strong className="font-medium text-foreground">{email}</strong>. Il est
            valable 10 minutes.
          </>
        ) : null
      }
    >
      <FieldGroup>
        <form
          className="flex flex-col gap-4"
          onSubmit={(e) => {
            e.preventDefault();
            void verify(code);
          }}
        >
          <FormField label="Code de connexion" error={error}>
            <InputOTP
              maxLength={6}
              pattern={REGEXP_ONLY_DIGITS}
              // Le code doit pouvoir se coller (WCAG 3.3.8) : espaces et tirets d'un collage
              // sont retirés avant d'atteindre le champ.
              pasteTransformer={(pasted) => pasted.replace(/\D/g, "")}
              inputMode="numeric"
              autoComplete="one-time-code"
              value={code}
              onChange={setCode}
              onComplete={(v: string) => void verify(v)}
              autoFocus
              disabled={verifying || signedIn}
              containerClassName="justify-center"
            >
              <InputOTPGroup>
                <InputOTPSlot index={0} aria-invalid={Boolean(error) || undefined} />
                <InputOTPSlot index={1} aria-invalid={Boolean(error) || undefined} />
                <InputOTPSlot index={2} aria-invalid={Boolean(error) || undefined} />
              </InputOTPGroup>
              <InputOTPSeparator />
              <InputOTPGroup>
                <InputOTPSlot index={3} aria-invalid={Boolean(error) || undefined} />
                <InputOTPSlot index={4} aria-invalid={Boolean(error) || undefined} />
                <InputOTPSlot index={5} aria-invalid={Boolean(error) || undefined} />
              </InputOTPGroup>
            </InputOTP>
          </FormField>
          {resent ? (
            <Alert>
              <CircleCheck />
              <AlertDescription>Un nouveau code vient de partir. Le précédent ne fonctionne plus.</AlertDescription>
            </Alert>
          ) : null}
          <PendingButton
            type="submit"
            size="lg"
            className="w-full"
            pending={verifying || signedIn}
            pendingText="Vérification…"
            disabled={code.length !== 6}
          >
            Valider
          </PendingButton>
        </form>
        <div className="flex flex-col items-center gap-2 text-center">
          {resendIn > 0 ? (
            <FieldDescription aria-live="polite">
              Pas reçu ? Vérifiez vos courriers indésirables. Nouveau code possible dans{" "}
              <span className="tabular-nums">{resendIn}</span> s.
            </FieldDescription>
          ) : (
            <Button variant="link" onClick={() => void resend()}>
              Renvoyer un code
            </Button>
          )}
          <Button variant="link" asChild>
            <Link to="/connexion" search={redirect ? { redirect: destination } : {}}>
              Changer d'adresse e-mail
            </Link>
          </Button>
        </div>
      </FieldGroup>
    </AuthLayout>
  );
}
