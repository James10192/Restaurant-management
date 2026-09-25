import { createFileRoute } from "@tanstack/react-router";
import { PermissionDeniedState } from "~/components/app/states";
import { useWorkspace } from "~/components/app/workspace";
import { AppearanceEditor } from "~/components/venue/appearance";

export const Route = createFileRoute("/_auth/app/settings/apparence")({
  head: () => ({ meta: [{ title: "Apparence de la carte — Joliba" }] }),
  component: AppearancePage,
});

function AppearancePage() {
  const w = useWorkspace();
  const venueId = w.venue?._id;
  if (venueId === undefined || !w.canInVenue("venue.manage")) {
    return <PermissionDeniedState venue={w.venue?.name} permission="Configurer l'établissement" />;
  }
  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Apparence de la carte</h1>
        <p className="text-muted-foreground">Votre couleur et votre logo, sur la carte que vos clients ouvrent. Chaque enregistrement est en ligne aussitôt.</p>
      </div>
      <AppearanceEditor venueId={venueId} />
    </div>
  );
}
