import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery } from "convex/react";
import { MessageSquare, Star } from "lucide-react";
import { toast } from "sonner";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import { EmptyState, LoadingState, PermissionDeniedState } from "~/components/app/states";
import { useWorkspace } from "~/components/app/workspace";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "~/components/ui/card";
import { Item, ItemActions, ItemContent, ItemDescription, ItemGroup, ItemTitle } from "~/components/ui/item";
import { describeError } from "~/lib/errors";

export const Route = createFileRoute("/_auth/app/feedback")({
  head: () => ({ meta: [{ title: "Avis des clients — Joliba" }] }),
  component: FeedbackPage,
});

const TOPICS: Record<string, string> = { accueil: "Accueil", attente: "Attente", plats: "Plats", boissons: "Boissons", proprete: "Propreté", prix: "Prix" };
const date = new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" });

function FeedbackPage() {
  const w = useWorkspace();
  const venueId = w.venue?._id;
  if (!venueId || !w.canInVenue("feedback.read")) {
    return <PermissionDeniedState venue={w.venue?.name} permission="lire les avis des clients" />;
  }
  return <FeedbackView key={venueId} venueId={venueId} />;
}

/**
 * Les avis laissés après le repas (D-105), les notes basses d'abord : c'est là qu'il y a quelque
 * chose à comprendre. Aucune coordonnée : on ne répond pas à un client, on corrige le service.
 */
function FeedbackView({ venueId }: { venueId: Id<"venues"> }) {
  const data = useQuery(api.feedback.list, { venueId });
  const markSeen = useMutation(api.feedback.markSeen);
  if (data === undefined) return <LoadingState />;

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight">Avis des clients</h1>
        <p className="text-muted-foreground">Laissés après le repas, depuis le téléphone de la table. Les 90 derniers jours, les notes basses d'abord.</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardHeader>
            <CardDescription>Note moyenne</CardDescription>
            <CardTitle className="text-3xl tabular-nums">{data.average === null ? "—" : `${data.average.toLocaleString("fr-FR")} / 5`}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader>
            <CardDescription>Avis</CardDescription>
            <CardTitle className="text-3xl tabular-nums">{data.count}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader>
            <CardDescription>Pas encore lus</CardDescription>
            <CardTitle className="text-3xl tabular-nums">{data.unseen}</CardTitle>
          </CardHeader>
        </Card>
      </div>

      {data.items.length === 0 ? (
        <EmptyState title="Aucun avis pour l'instant" description="Après la clôture d'une table, chaque convive qui a commandé de son téléphone peut en laisser un, une fois." />
      ) : (
        <Card>
          <CardContent>
            <ItemGroup className="gap-2">
              {data.items.map((f) => (
                <Item key={f._id} variant="outline" data-rating={f.rating}>
                  <ItemContent className="min-w-0">
                    <ItemTitle className="flex flex-wrap items-center gap-2">
                      <span className="flex items-center gap-0.5" aria-label={`${f.rating} sur 5`}>
                        {[1, 2, 3, 4, 5].map((n) => (
                          <Star key={n} className={n <= f.rating ? "size-4 fill-current" : "size-4 text-muted-foreground"} aria-hidden />
                        ))}
                      </span>
                      {f.status === "new" ? <Badge>Nouveau</Badge> : null}
                    </ItemTitle>
                    <ItemDescription className="line-clamp-none">
                      {[f.table ? `Table ${f.table}` : null, date.format(f.createdAt)].filter(Boolean).join(" · ")}
                    </ItemDescription>
                    {f.topics.length > 0 ? (
                      <div className="flex flex-wrap gap-1 pt-1">
                        {f.topics.map((t) => (
                          <Badge key={t} variant="outline">
                            {TOPICS[t] ?? t}
                          </Badge>
                        ))}
                      </div>
                    ) : null}
                    {f.comment ? (
                      <p className="flex gap-2 pt-1 text-sm">
                        <MessageSquare className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden />
                        <span className="min-w-0 break-words">« {f.comment} »</span>
                      </p>
                    ) : null}
                  </ItemContent>
                  {f.status === "new" ? (
                    <ItemActions>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() =>
                          void markSeen({ venueId, feedbackId: f._id }).catch((error: unknown) => toast.error(describeError(error).message))
                        }
                      >
                        Lu
                      </Button>
                    </ItemActions>
                  ) : null}
                </Item>
              ))}
            </ItemGroup>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
