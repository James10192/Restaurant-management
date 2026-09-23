import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery } from "convex/react";
import { Building2, KeyRound, Users } from "lucide-react";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import { useWorkspace } from "~/components/app/workspace";
import { Alert, AlertDescription } from "~/components/ui/alert";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "~/components/ui/card";
import { EmptyState } from "~/components/ui/states";
import { describeError } from "~/lib/errors";

export const Route = createFileRoute("/_auth/app/")({
  component: AppHome,
});

/**
 * L'accueil est un AIGUILLAGE, pas un tableau de bord (INFORMATION_ARCHITECTURE §4.1).
 * Tant que les écrans de service (salle, cuisine, caisse) ne sont pas livrés, il mène aux
 * seuls écrans qui existent — sans promettre ceux qui n'existent pas encore.
 */
function AppHome() {
  const w = useWorkspace();
  const invitations = useQuery(api.team.myInvitations, {});

  if (w.status === "no-organization") {
    return (
      <div className="mx-auto flex max-w-xl flex-col gap-6">
        <PendingInvitations invitations={invitations} />
        <EmptyState
          title="Vous ne faites encore partie d'aucune organisation"
          description="Ouvrez votre restaurant sur Joliba, ou ouvrez le lien d'invitation que votre responsable vous a envoyé."
          action={
            <Button asChild>
              <Link to="/app/onboarding">Ouvrir mon établissement</Link>
            </Button>
          }
        />
      </div>
    );
  }

  if (!w.venue) {
    return (
      <EmptyState
        title="Votre compte n'est rattaché à aucun établissement"
        description="Vous faites partie de l'organisation, mais aucun rôle ne vous a encore été attribué. Contactez le responsable de votre établissement."
      />
    );
  }

  const sections = [
    {
      to: "/app/team" as const,
      icon: Users,
      title: "Équipe",
      description: "Qui a accès à quoi, et où. Inviter un collègue, ajuster ses rôles.",
      show: w.canInVenue("team.read") || w.canInOrganization("team.read"),
    },
    {
      to: "/app/roles" as const,
      icon: KeyRound,
      title: "Rôles",
      description: "Composer les rôles qui correspondent à votre organisation.",
      show: w.canInOrganization("permissions.manage"),
    },
    {
      to: "/app/settings/venue" as const,
      icon: Building2,
      title: "Établissement",
      description: "Nom, adresse, téléphone : ce que vos clients verront.",
      show: w.canInVenue("venue.manage"),
    },
  ].filter((s) => s.show);

  return (
    <div className="flex flex-col gap-6">
      <PendingInvitations invitations={invitations} />
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-title-xl text-ink">{w.venue.name}</h1>
        {w.venue.status === "setup" ? <Badge variant="warning">En préparation</Badge> : null}
      </div>
      {sections.length > 0 ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {sections.map((s) => (
            <Link key={s.to} to={s.to} className="group rounded-md focus-visible:outline-none">
              <Card className="h-full transition-colors group-hover:bg-surface-2">
                <CardHeader>
                  <s.icon aria-hidden="true" className="size-6 text-accent-600" />
                  <CardTitle>{s.title}</CardTitle>
                  <CardDescription>{s.description}</CardDescription>
                </CardHeader>
              </Card>
            </Link>
          ))}
        </div>
      ) : (
        <Card>
          <CardContent className="py-6 text-body text-ink-2">
            Votre espace de travail sera ici dès que les écrans de service de votre rôle seront ouverts.
            Votre responsable peut vous indiquer la suite.
          </CardContent>
        </Card>
      )}
    </div>
  );
}

type Invitation = { invitationId: Id<"organizationInvitations">; organizationName: string; roleLabel: string };

function PendingInvitations({ invitations }: { invitations: Invitation[] | undefined }) {
  const accept = useMutation(api.team.acceptInvitationById);
  const w = useWorkspace();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  if (!invitations || invitations.length === 0) return null;
  return (
    <section aria-labelledby="invitations-title" className="flex flex-col gap-3">
      <h2 id="invitations-title" className="text-title-md text-ink">
        Invitations en attente
      </h2>
      {error ? (
        <Alert variant="danger">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}
      {invitations.map((inv) => (
        <Card key={inv.invitationId}>
          <CardContent className="flex flex-wrap items-center justify-between gap-3 py-4">
            <p className="text-body text-ink">
              <strong>{inv.organizationName}</strong> vous invite comme « {inv.roleLabel} ».
            </p>
            <Button
              loading={busy === inv.invitationId}
              loadingText="Acceptation…"
              onClick={async () => {
                setBusy(inv.invitationId);
                setError(null);
                try {
                  const { organizationId } = await accept({ invitationId: inv.invitationId });
                  w.selectOrganization(organizationId);
                } catch (e) {
                  setError(describeError(e).message);
                } finally {
                  setBusy(null);
                }
              }}
            >
              Rejoindre
            </Button>
          </CardContent>
        </Card>
      ))}
    </section>
  );
}
