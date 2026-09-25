import { createFileRoute } from "@tanstack/react-router";
import { PermissionDeniedState } from "~/components/app/states";
import { useWorkspace } from "~/components/app/workspace";
import { PeriodView } from "~/components/analytics/period-view";

const DAY = /^\d{4}-\d{2}-\d{2}$/;

export const Route = createFileRoute("/_auth/app/analytics")({
  head: () => ({ meta: [{ title: "Données — Joliba" }] }),
  // La période vit dans l'adresse : l'écran exact s'envoie à un associé.
  // Deux dates à l'envers (adresse tapée à la main) se remettent dans l'ordre plutôt que de casser la page.
  validateSearch: (search: Record<string, unknown>): { du?: string; au?: string } => {
    const du = typeof search.du === "string" && DAY.test(search.du) ? search.du : undefined;
    const au = typeof search.au === "string" && DAY.test(search.au) ? search.au : undefined;
    const [from, to] = du && au && du > au ? [au, du] : [du, au];
    return { ...(from ? { du: from } : {}), ...(to ? { au: to } : {}) };
  },
  component: AnalyticsPage,
});

/**
 * Les données du restaurant (IA §4.13) : des questions, pas un tableau de bord. Ce qui se vend,
 * quand on est chargé, où le service coince, comment tournent les tables, et l'argent.
 */
function AnalyticsPage() {
  const w = useWorkspace();
  const search = Route.useSearch();
  const navigate = Route.useNavigate();
  if (!w.venue || !w.canInVenue("analytics.read")) {
    return <PermissionDeniedState venue={w.venue?.name} permission="lire les données de l'établissement" />;
  }
  return (
    <PeriodView
      key={w.venue._id}
      venueId={w.venue._id}
      from={search.du}
      to={search.au}
      onChange={(du, au) => void navigate({ search: { du, au } })}
    />
  );
}
