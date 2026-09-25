import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery } from "convex/react";
import { Building2, ChartColumn, ChefHat, ChevronRight, CircleAlert, ClipboardList, ConciergeBell, KeyRound, MailOpen, Users, UtensilsCrossed, Wallet } from "lucide-react";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import { useWorkspace } from "~/components/app/workspace";
import { PendingButton } from "~/components/app/pending-button";
import { EmptyState } from "~/components/app/states";
import { Alert, AlertDescription } from "~/components/ui/alert";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { Card, CardContent } from "~/components/ui/card";
import { Item, ItemActions, ItemContent, ItemDescription, ItemGroup, ItemMedia, ItemTitle } from "~/components/ui/item";
import { describeError } from "~/lib/errors";

export const Route = createFileRoute("/_auth/app/")({
  component: AppHome,
});

/**
 * L'accueil est un AIGUILLAGE, pas un tableau de bord (INFORMATION_ARCHITECTURE §4.1) : il mène
 * chacun à ses écrans, selon ses droits et jamais selon l'heure — les horaires d'ouverture sont
 * facultatifs (D-146). Le travail du jour d'abord, les réglages ensuite.
 */
function AppHome() {
  const w = useWorkspace();
  const invitations = useQuery(api.team.myInvitations, {});

  if (w.status === "no-organization") {
    return (
      <div className="mx-auto flex max-w-xl flex-col gap-6">
        <PendingInvitations invitations={invitations} />
        <EmptyState
          // Titre de page : le seul titre de l'écran porte le niveau 1.
          title={<h1>Vous ne faites encore partie d'aucune organisation</h1>}
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
        title={<h1>Votre compte n'est rattaché à aucun établissement</h1>}
        description="Vous faites partie de l'organisation, mais aucun rôle ne vous a encore été attribué. Contactez le responsable de votre établissement."
      />
    );
  }

  const canCollect = w.canInVenue("payment.collect") || w.canInVenue("cash_register.open") || w.canInVenue("cash_register.close");
  const sections = [
    {
      to: "/app/service" as const,
      icon: ConciergeBell,
      title: "Service",
      description: "Les tables, ce qui attend d'être servi, les demandes des clients.",
      show: w.canInVenue("table.read"),
    },
    {
      to: "/app/cuisine" as const,
      icon: ChefHat,
      title: "Cuisine",
      description: "Les bons de votre poste, dans l'ordre où les préparer.",
      show: w.canInVenue("kitchen.ticket.update"),
    },
    {
      to: "/app/service/caisse" as const,
      icon: Wallet,
      title: "Caisse",
      description: "Ouvrir, encaisser, compter, clôturer.",
      show: w.canInVenue("table.read") && canCollect,
    },
    {
      to: "/app/rapport" as const,
      icon: ClipboardList,
      title: "Fin de service",
      description: "Ce qui est entré, par quel moyen, par qui — et la journée comparée à ses semblables.",
      show: w.canInVenue("report.service_day.read"),
    },
    {
      to: "/app/analytics" as const,
      icon: ChartColumn,
      title: "Données",
      description: "Ce qui se vend, quand vous êtes chargé, où le service coince.",
      show: w.canInVenue("analytics.read"),
    },
    {
      to: "/app/menu" as const,
      icon: UtensilsCrossed,
      title: "Carte",
      description: "Les plats, les prix, ce qui est disponible ce soir.",
      show: w.canInVenue("menu.read") || w.canInVenue("menu.availability.toggle"),
    },
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
      <div className="flex flex-wrap items-center gap-2">
        <h1 className="text-2xl font-semibold tracking-tight">{w.venue.name}</h1>
        {w.venue.status === "setup" ? <Badge variant="secondary">En préparation</Badge> : null}
      </div>
      {sections.length > 0 ? (
        <ItemGroup className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {sections.map((s) => (
            <div key={s.to} role="listitem" className="flex">
              <Item variant="outline" asChild>
                <Link to={s.to}>
                  <ItemMedia variant="icon">
                    <s.icon aria-hidden="true" />
                  </ItemMedia>
                  <ItemContent>
                    <ItemTitle>{s.title}</ItemTitle>
                    <ItemDescription>{s.description}</ItemDescription>
                  </ItemContent>
                  <ItemActions>
                    <ChevronRight aria-hidden="true" className="size-4 text-muted-foreground" />
                  </ItemActions>
                </Link>
              </Item>
            </div>
          ))}
        </ItemGroup>
      ) : (
        <Card>
          <CardContent>
            <p className="text-muted-foreground">
              Votre rôle ne donne encore accès à aucun écran de cet établissement. Votre responsable peut vous indiquer la
              suite.
            </p>
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
      <h2 id="invitations-title" className="text-lg font-semibold tracking-tight">
        Invitations en attente
      </h2>
      {error ? (
        <Alert variant="destructive">
          <CircleAlert />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}
      <ItemGroup className="gap-3">
        {invitations.map((inv) => (
          <Item key={inv.invitationId} variant="outline" role="listitem">
            <ItemMedia variant="icon">
              <MailOpen aria-hidden="true" />
            </ItemMedia>
            <ItemContent className="min-w-40">
              <ItemTitle className="line-clamp-none">{inv.organizationName}</ItemTitle>
              <ItemDescription>vous invite comme « {inv.roleLabel} ».</ItemDescription>
            </ItemContent>
            <ItemActions className="w-full sm:w-auto">
              <PendingButton
                className="w-full sm:w-auto"
                pending={busy === inv.invitationId}
                pendingText="Acceptation…"
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
              </PendingButton>
            </ItemActions>
          </Item>
        ))}
      </ItemGroup>
    </section>
  );
}
