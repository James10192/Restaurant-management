import { useEffect, useRef, useState, type FormEvent } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { AuthLayout } from "~/components/app/auth-layout";
import { useAuthStatus } from "~/components/app/convex-providers";
import { Alert, AlertDescription } from "~/components/ui/alert";
import { Button } from "~/components/ui/button";
import { Field } from "~/components/ui/field";
import { Input } from "~/components/ui/input";
import { Separator } from "~/components/ui/separator";
import { authClient } from "~/lib/auth-client";
import { pendingEmail, safeRedirect } from "~/lib/redirect";

type Search = { redirect?: string };

export const Route = createFileRoute("/connexion")({
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
      <form onSubmit={submit} noValidate className="flex flex-col gap-4">
        <Field label="Adresse e-mail" error={fieldError}>
          <Input
            type="email"
            inputMode="email"
            autoComplete="email"
            autoCapitalize="none"
            spellCheck={false}
            autoFocus
            ref={emailRef}
            name="email"
            onBlur={(e) => {
              const typed = e.currentTarget.value.trim();
              if (typed && !EMAIL_PATTERN.test(typed)) {
                setFieldError("Saisissez une adresse e-mail complète, par exemple awa@exemple.ci.");
              }
            }}
          />
        </Field>
        {formError ? (
          <Alert variant="danger">
            <AlertDescription>{formError}</AlertDescription>
          </Alert>
        ) : null}
        <Button type="submit" size="lg" loading={sending} loadingText="Envoi du code…" className="w-full">
          Recevoir mon code
        </Button>
      </form>

      {GOOGLE_ENABLED ? (
        <>
          <div className="my-6 flex items-center gap-3 text-label text-ink-3">
            <Separator className="flex-1" />
            ou
            <Separator className="flex-1" />
          </div>
          <Button variant="secondary" size="lg" className="w-full" loading={googleLoading} loadingText="Redirection…" onClick={signInWithGoogle}>
            Continuer avec Google
          </Button>
        </>
      ) : null}

      <p className="mt-6 text-label text-ink-3">
        Vous avez reçu une invitation ? Ouvrez le lien qu'elle contient : il vous ramènera ici.{" "}
        <Link to="/" className="text-accent-700 underline underline-offset-4">
          Découvrir Joliba
        </Link>
      </p>
    </AuthLayout>
  );
}
