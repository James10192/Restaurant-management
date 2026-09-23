import { useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery } from "convex/react";
import { CircleAlert, TriangleAlert } from "lucide-react";
import { api } from "../../convex/_generated/api";
import { AuthLayout } from "~/components/app/auth-layout";
import { useAuthStatus } from "~/components/app/convex-providers";
import { FormField } from "~/components/app/form-field";
import { PendingButton } from "~/components/app/pending-button";
import { LoadingState } from "~/components/app/states";
import { Alert, AlertDescription } from "~/components/ui/alert";
import { Button } from "~/components/ui/button";
import { FieldDescription, FieldGroup } from "~/components/ui/field";
import { Input } from "~/components/ui/input";
import { authClient } from "~/lib/auth-client";
import { describeError } from "~/lib/errors";

export const Route = createFileRoute("/_auth/invitation/$token")({
  head: () => ({
    // Le jeton est dans l'URL : ne jamais la transmettre à un tiers, ni la faire indexer.
    meta: [{ title: "Invitation — Joliba" }, { name: "robots", content: "noindex, nofollow" }, { name: "referrer", content: "no-referrer" }],
  }),
  component: InvitationPage,
});

function InvitationPage() {
  const { token } = Route.useParams();
  const auth = useAuthStatus();
  const navigate = useNavigate();
  const preview = useQuery(api.team.previewInvitation, auth.isLoading ? "skip" : { token });
  const accept = useMutation(api.team.acceptInvitation);
  const updateProfile = useMutation(api.users.updateProfile);
  const me = useQuery(api.users.me, auth.isAuthenticated ? {} : "skip");
  const askName = me !== undefined && me !== null && !me.name;
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [accepting, setAccepting] = useState(false);
  const here = `/invitation/${token}`;

  if (auth.isLoading || preview === undefined) {
    return (
      <AuthLayout title="Invitation">
        <LoadingState />
      </AuthLayout>
    );
  }

  if (preview === null) {
    return (
      <AuthLayout
        title="Cette invitation n'est plus valable"
        description="Elle a expiré, a été révoquée ou a déjà été utilisée. Demandez-en une nouvelle à la personne qui vous a invité."
      >
        <Button asChild variant="outline" size="lg" className="w-full">
          <Link to="/connexion">Aller à la connexion</Link>
        </Button>
      </AuthLayout>
    );
  }

  const intro = (
    <>
      {preview.inviterName ? `${preview.inviterName} vous invite` : "Vous êtes invité"} à rejoindre{" "}
      <strong className="font-medium text-foreground">{preview.organizationName}</strong> en tant que « {preview.roleLabel} ».
    </>
  );

  if (!auth.isAuthenticated) {
    return (
      <AuthLayout title="Rejoindre l'équipe" description={intro}>
        <FieldGroup>
          <FieldDescription>
            Connectez-vous avec l'adresse qui a reçu l'invitation ({preview.maskedEmail}). Pas besoin de mot de passe : un code
            vous sera envoyé.
          </FieldDescription>
          <Button asChild size="lg" className="w-full">
            <Link to="/connexion" search={{ redirect: here }}>
              Se connecter pour accepter
            </Link>
          </Button>
        </FieldGroup>
      </AuthLayout>
    );
  }

  if (preview.viewerEmailMatches && preview.viewerEmailVerified === false) {
    return (
      <AuthLayout title="Confirmez votre adresse" description={intro}>
        <Alert>
          <TriangleAlert />
          <AlertDescription>
            Votre compte n'a pas encore prouvé qu'il détient cette adresse. Reconnectez-vous avec un code reçu par e-mail :
            l'invitation sera alors acceptable.
          </AlertDescription>
        </Alert>
        <Button
          size="lg"
          className="mt-4 w-full"
          onClick={async () => {
            await authClient.signOut();
            await navigate({ to: "/connexion", search: { redirect: here } });
          }}
        >
          Recevoir un code
        </Button>
      </AuthLayout>
    );
  }

  if (preview.viewerEmailMatches === false) {
    return (
      <AuthLayout title="Mauvaise adresse" description={intro}>
        <Alert>
          <TriangleAlert />
          <AlertDescription>
            Cette invitation a été envoyée à {preview.maskedEmail}, pas à l'adresse avec laquelle vous êtes connecté.
          </AlertDescription>
        </Alert>
        <Button
          variant="outline"
          size="lg"
          className="mt-4 w-full"
          onClick={async () => {
            await authClient.signOut();
            await navigate({ to: "/connexion", search: { redirect: here } });
          }}
        >
          Changer de compte
        </Button>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout title="Rejoindre l'équipe" description={intro}>
      <FieldGroup>
        {error ? (
          <Alert variant="destructive">
            <CircleAlert />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        ) : null}
        {askName ? (
          <FormField label="Votre nom" description="Votre équipe le verra à la place de votre adresse e-mail.">
            <Input value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" maxLength={80} />
          </FormField>
        ) : null}
        <PendingButton
          size="lg"
          className="w-full"
          pending={accepting}
          pendingText="Acceptation…"
          onClick={async () => {
            if (askName && name.trim().length < 2) {
              setError("Indiquez votre nom avant d'accepter.");
              return;
            }
            setAccepting(true);
            setError(null);
            try {
              if (askName) await updateProfile({ name });
              const { organizationId } = await accept({ token });
              try {
                localStorage.setItem("joliba.organisation", organizationId);
              } catch {
                /* le choix d'organisation sera simplement refait */
              }
              await navigate({ to: "/app", replace: true });
            } catch (e) {
              setError(describeError(e).message);
              setAccepting(false);
            }
          }}
        >
          Accepter l'invitation
        </PendingButton>
      </FieldGroup>
    </AuthLayout>
  );
}
