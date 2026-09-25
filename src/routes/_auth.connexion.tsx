import { useEffect, useRef, useState, type FormEvent } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { CircleAlert } from "lucide-react";
import { AuthLayout } from "~/components/app/auth-layout";
import { useAuthStatus } from "~/components/app/convex-providers";
import { FormField } from "~/components/app/form-field";
import { PendingButton } from "~/components/app/pending-button";
import { Alert, AlertDescription } from "~/components/ui/alert";
import { FieldDescription, FieldGroup, FieldSeparator } from "~/components/ui/field";
import { Input } from "~/components/ui/input";
import { authClient } from "~/lib/auth-client";
import { pendingEmail, safeRedirect } from "~/lib/redirect";

type Search = { redirect?: string };

export const Route = createFileRoute("/_auth/connexion")({
  validateSearch: (search: Record<string, unknown>): Search =>
    typeof search.redirect === "string" ? { redirect: search.redirect } : {},
  head: () => ({ meta: [{ title: "Connexion — Joliba" }, { name: "robots", content: "noindex" }] }),
  component: ConnexionPage,
});

const GOOGLE_ENABLED = import.meta.env.VITE_AUTH_GOOGLE === "true";
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function ConnexionPage() {
  const { redirect } = Route.useSearch();
  const destination = safeRedirect(redirect);
  const navigate = useNavigate();
  const auth = useAuthStatus();
  // Champ NON contrôlé : une saisie faite avant l'hydratation survit (un champ contrôlé
  // serait remis à vide par React au moment où la page devient interactive).
  const emailRef = useRef<HTMLInputElement>(null);
  const [fieldError, setFieldError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);

  // Déjà connecté : l'écran de connexion n'a rien à proposer.
  useEffect(() => {
    if (auth.isAuthenticated) void navigate({ to: destination, replace: true });
  }, [auth.isAuthenticated, destination, navigate]);

  useEffect(() => {
    const previous = pendingEmail.get();
    if (previous && emailRef.current && !emailRef.current.value) emailRef.current.value = previous;
  }, []);

  async function submit(event: FormEvent) {
    event.preventDefault();
    const value = (emailRef.current?.value ?? "").trim().toLowerCase();
    if (!EMAIL_PATTERN.test(value)) {
      setFieldError("Saisissez une adresse e-mail complète, par exemple awa@exemple.ci.");
      return;
    }
    setFieldError(null);
    setFormError(null);
    setSending(true);
    const { error } = await authClient.emailOtp.sendVerificationOtp({ email: value, type: "sign-in" });
    setSending(false);
    if (error) {
      // Le message ne dit jamais si l'adresse existe (INFORMATION_ARCHITECTURE §Connexion).
      setFormError(
        error.status === 429
          ? "Trop de demandes de code. Patientez une minute avant de réessayer."
          : "Le code n'a pas pu être envoyé. Vérifiez votre connexion et réessayez.",
      );
      return;
    }
    pendingEmail.set(value);
    await navigate({ to: "/auth/otp", search: redirect ? { redirect: destination } : {} });
  }

  async function signInWithGoogle() {
    setGoogleLoading(true);
    setFormError(null);
    const { error } = await authClient.signIn.social({ provider: "google", callbackURL: destination });
    if (error) {
      setGoogleLoading(false);
      setFormError("La connexion avec Google n'a pas abouti. Réessayez, ou recevez un code par e-mail.");
    }
  }

  return (
    <AuthLayout title="Connexion" description="Entrez votre e-mail, nous vous envoyons un code.">
      <FieldGroup>
        <form onSubmit={submit} noValidate className="flex flex-col gap-4">
          <FormField label="Adresse e-mail" error={fieldError}>
            <Input
              type="email"
              inputMode="email"
              autoComplete="email"
              autoCapitalize="none"
              spellCheck={false}
              autoFocus
              ref={emailRef}
              name="email"
              placeholder="awa@exemple.ci"
              onBlur={(e) => {
                const typed = e.currentTarget.value.trim();
                if (typed && !EMAIL_PATTERN.test(typed)) {
                  setFieldError("Saisissez une adresse e-mail complète, par exemple awa@exemple.ci.");
                }
              }}
            />
          </FormField>
          {formError ? (
            <Alert variant="destructive">
              <CircleAlert />
              <AlertDescription>{formError}</AlertDescription>
            </Alert>
          ) : null}
          <PendingButton type="submit" size="lg" pending={sending} pendingText="Envoi du code…" className="w-full">
            Recevoir mon code
          </PendingButton>
        </form>

        {GOOGLE_ENABLED ? (
          <>
            <FieldSeparator>ou</FieldSeparator>
            <PendingButton
              variant="outline"
              size="lg"
              className="w-full"
              pending={googleLoading}
              pendingText="Redirection…"
              onClick={signInWithGoogle}
            >
              Continuer avec Google
            </PendingButton>
          </>
        ) : null}

        <FieldDescription className="text-center">
          Vous avez reçu une invitation ? Ouvrez le lien qu'elle contient : il vous ramènera ici.{" "}
          <Link to="/">Découvrir Joliba</Link>
        </FieldDescription>
      </FieldGroup>
    </AuthLayout>
  );
}
