import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import { ArrowDown, ArrowUp, CircleAlert, MoreHorizontal, Plus, VolumeX } from "lucide-react";
import { toast } from "sonner";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import { PendingButton } from "~/components/app/pending-button";
import { EmptyState, LoadingState, PermissionDeniedState } from "~/components/app/states";
import { useWorkspace } from "~/components/app/workspace";
import { StationDialog, stationTypeOf, type EditableStation } from "~/components/settings/station-dialog";
import { StationRouting } from "~/components/settings/station-routing";
import { Alert, AlertDescription } from "~/components/ui/alert";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "~/components/ui/alert-dialog";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { ButtonGroup } from "~/components/ui/button-group";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "~/components/ui/dropdown-menu";
import { Item, ItemActions, ItemContent, ItemDescription, ItemFooter, ItemGroup, ItemMedia, ItemTitle } from "~/components/ui/item";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "~/components/ui/tabs";
import { describeError } from "~/lib/errors";

export const Route = createFileRoute("/_auth/app/settings/stations")({
  head: () => ({ meta: [{ title: "Postes de préparation — Joliba" }] }),
  component: StationsPage,
});

type Station = FunctionReturnType<typeof api.stations.list>[number];

/** Au-delà, le serveur refuse (`MAX_STATIONS` dans convex/stations.ts). */
const MAX_STATIONS = 12;

function StationsPage() {
  const w = useWorkspace();
  const venueId = w.venue?._id;
  const canRead = venueId !== undefined && w.canInVenue("kitchen.read");
  if (!venueId || !canRead) return <PermissionDeniedState venue={w.venue?.name} permission="voir l'écran de production" />;
  return (
    <StationsView
      key={venueId}
      venueId={venueId}
      canManage={w.canInVenue("kitchen.manage")}
    />
  );
}

function StationsView({ venueId, canManage }: { venueId: Id<"venues">; canManage: boolean }) {
  const stations = useQuery(api.stations.list, { venueId });
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<EditableStation | null>(null);

  const active = stations?.filter((s) => s.isActive) ?? [];
  const full = active.length >= MAX_STATIONS;

  function openCreate() {
    setEditing(null);
    setDialogOpen(true);
  }

  const list =
    stations === undefined ? (
      <LoadingState />
    ) : (
      <StationList
        venueId={venueId}
        stations={active}
        canManage={canManage}
        onEdit={(s) => {
          setEditing(s);
          setDialogOpen(true);
        }}
        onCreate={openCreate}
      />
    );

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-semibold tracking-tight">Postes de préparation</h1>
          <p className="text-muted-foreground">
            Chaque poste a son écran et ne voit que ses bons : le bar ne voit jamais le poulet.
          </p>
        </div>
        {canManage ? (
          <Button onClick={openCreate} disabled={stations === undefined || full}>
            <Plus data-icon="inline-start" aria-hidden="true" />
            Ajouter un poste
          </Button>
        ) : null}
      </div>
      {full && canManage ? (
        <p className="text-sm text-muted-foreground">{MAX_STATIONS} postes au plus : retirez-en un pour en créer un autre.</p>
      ) : null}

      {canManage ? (
        <Tabs defaultValue="stations">
          <TabsList>
            <TabsTrigger value="stations">Postes</TabsTrigger>
            <TabsTrigger value="routing">Routage</TabsTrigger>
          </TabsList>
          <TabsContent value="stations" className="pt-2">
            {list}
          </TabsContent>
          <TabsContent value="routing" className="pt-2">
            {stations === undefined ? <LoadingState /> : <StationRouting venueId={venueId} stations={stations} />}
          </TabsContent>
        </Tabs>
      ) : (
        list
      )}

      {canManage ? <StationDialog venueId={venueId} station={editing} open={dialogOpen} onOpenChange={setDialogOpen} /> : null}
    </div>
  );
}

function StationList({
  venueId,
  stations,
  canManage,
  onEdit,
  onCreate,
}: {
  venueId: Id<"venues">;
  stations: Station[];
  canManage: boolean;
  onEdit: (station: Station) => void;
  onCreate: () => void;
}) {
  const reorder = useMutation(api.stations.reorder);
  const archive = useMutation(api.stations.archive);
  const [moving, setMoving] = useState(false);
  const [archiving, setArchiving] = useState<Station | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [archiveError, setArchiveError] = useState<string | null>(null);

  async function move(index: number, delta: -1 | 1) {
    const ids = stations.map((s) => s._id);
    const target = index + delta;
    if (target < 0 || target >= ids.length) return;
    [ids[index], ids[target]] = [ids[target]!, ids[index]!];
    setError(null);
    setMoving(true);
    try {
      await reorder({ venueId, stationIds: ids });
    } catch (e) {
      setError(describeError(e).message);
    } finally {
      setMoving(false);
    }
  }

  async function confirmArchive() {
    if (!archiving) return;
    setArchiveError(null);
    setBusy(true);
    try {
      await archive({ venueId, stationId: archiving._id });
      toast.success(`Poste « ${archiving.name} » retiré.`);
      setArchiving(null);
    } catch (e) {
      setArchiveError(describeError(e).message);
    } finally {
      setBusy(false);
    }
  }

  if (stations.length === 0) {
    return (
      <EmptyState
        className="border"
        title={<h2>Aucun poste pour l'instant</h2>}
        description="Au premier envoi en cuisine, un poste « Cuisine » est créé tout seul. Ajoutez-en un pour séparer le bar de la cuisine."
        action={
          canManage ? (
            <Button onClick={onCreate}>
              <Plus data-icon="inline-start" aria-hidden="true" />
              Ajouter un poste
            </Button>
          ) : undefined
        }
      />
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {error ? (
        <Alert variant="destructive">
          <CircleAlert />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}
      <ItemGroup className="gap-3">
        {stations.map((station, index) => {
          const { label, icon: Icon } = stationTypeOf(station.type);
          return (
            <Item key={station._id} variant="outline" role="listitem">
              <ItemMedia variant="icon">
                <Icon aria-hidden="true" />
              </ItemMedia>
              <ItemContent className="min-w-0">
                <ItemTitle className="max-w-full truncate">{station.name}</ItemTitle>
                <ItemDescription>
                  {label} · prêt en {station.targetPrepMinutes} min · en retard après {station.lateThresholdMinutes} min
                </ItemDescription>
              </ItemContent>
              {canManage ? (
                <ItemActions>
                  <ButtonGroup aria-label={`Ordre de ${station.name}`}>
                    <Button
                      variant="outline"
                      size="icon-sm"
                      aria-label={`Monter ${station.name}`}
                      disabled={moving || index === 0}
                      onClick={() => void move(index, -1)}
                    >
                      <ArrowUp aria-hidden="true" />
                    </Button>
                    <Button
                      variant="outline"
                      size="icon-sm"
                      aria-label={`Descendre ${station.name}`}
                      disabled={moving || index === stations.length - 1}
                      onClick={() => void move(index, 1)}
                    >
                      <ArrowDown aria-hidden="true" />
                    </Button>
                  </ButtonGroup>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon-sm" aria-label={`Actions pour ${station.name}`}>
                        <MoreHorizontal aria-hidden="true" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onSelect={() => onEdit(station)}>Modifier</DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        variant="destructive"
                        onSelect={() => {
                          setArchiveError(null);
                          setArchiving(station);
                        }}
                      >
                        Retirer le poste
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </ItemActions>
              ) : null}
              <ItemFooter className="flex-wrap justify-start gap-1">
                {station.isDefault ? <Badge>Par défaut</Badge> : null}
                <Badge variant="secondary">
                  {station.productCount} produit{station.productCount > 1 ? "s" : ""}
                </Badge>
                {station.soundEnabled ? null : (
                  <Badge variant="outline">
                    <VolumeX data-icon="inline-start" aria-hidden="true" />
                    Son coupé
                  </Badge>
                )}
              </ItemFooter>
            </Item>
          );
        })}
      </ItemGroup>
      <p className="text-sm text-muted-foreground">
        Le poste par défaut, le premier de la liste, reçoit tout produit qui n'est routé nulle part.
      </p>

      <AlertDialog
        open={archiving !== null}
        onOpenChange={(open) => {
          if (!open) {
            setArchiving(null);
            setArchiveError(null);
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Retirer le poste « {archiving?.name} » ?</AlertDialogTitle>
            <AlertDialogDescription>
              Ses produits reviennent au poste par défaut. C'est impossible tant que des bons y sont en cours : terminez d'abord le
              service.
            </AlertDialogDescription>
          </AlertDialogHeader>
          {archiveError ? (
            <Alert variant="destructive">
              <CircleAlert />
              <AlertDescription>{archiveError}</AlertDescription>
            </Alert>
          ) : null}
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <PendingButton variant="destructive" pending={busy} pendingText="Retrait…" onClick={() => void confirmArchive()}>
              Retirer
            </PendingButton>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
