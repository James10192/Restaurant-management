import { Fragment, useState, type FormEvent } from "react";
import { createFileRoute, Link, Navigate } from "@tanstack/react-router";
import { useMutation, useQuery } from "convex/react";
import {
  Archive,
  CircleAlert,
  CircleCheck,
  Copy,
  FileUp,
  History as HistoryIcon,
  Info,
  Plus,
  RotateCcw,
  TriangleAlert,
} from "lucide-react";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import type { SnapshotChange } from "../../convex/lib/menuSnapshot";
import { FormField } from "~/components/app/form-field";
import { PendingButton } from "~/components/app/pending-button";
import {
  ResponsiveDialog,
  ResponsiveDialogContent,
  ResponsiveDialogDescription,
  ResponsiveDialogFooter,
  ResponsiveDialogHeader,
  ResponsiveDialogTitle,
} from "~/components/app/responsive-dialog";
import { EmptyState, LoadingState, PermissionDeniedState } from "~/components/app/states";
import { useWorkspace } from "~/components/app/workspace";
import { ImportDialog } from "~/components/menu/import-dialog";
import { ConfirmDialog, PageHeader, useSelectedMenu } from "~/components/menu/shared";
import { Alert, AlertDescription, AlertTitle } from "~/components/ui/alert";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { Card, CardAction, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "~/components/ui/card";
import { Input } from "~/components/ui/input";
import { Item, ItemActions, ItemContent, ItemDescription, ItemGroup, ItemSeparator, ItemTitle } from "~/components/ui/item";
import { NativeSelect, NativeSelectOption } from "~/components/ui/native-select";
import { describeError } from "~/lib/errors";

export const Route = createFileRoute("/_auth/app/menu/")({
  component: MenuHome,
});

const dateTime = new Intl.DateTimeFormat("fr-FR", {
  dateStyle: "medium",
  timeStyle: "short",
});

/**
 * L'écran de tête de la carte (IA §4.11) : une seule question, « ma carte en ligne est-elle
 * à jour ? ». D'où le bandeau d'écart en premier, et un seul bouton primaire : Publier.
 */
function MenuHome() {
  const w = useWorkspace();
  const venueId = w.venue?._id;
  const canRead = w.canInVenue("menu.read");
  const { menus, selected, select } = useSelectedMenu(venueId, canRead);
  const [dialog, setDialog] = useState<"create" | "import" | "duplicate" | null>(null);

  if (!canRead) {
    // Un chef de rang n'a que l'interrupteur de disponibilité : on l'y emmène directement.
    if (w.canInVenue("menu.availability.toggle")) return <Navigate to="/app/menu/availability" replace />;
    return <PermissionDeniedState venue={w.venue?.name} permission="Consulter la carte" />;
  }
  if (!venueId || menus === undefined) return <LoadingState />;
  const canEdit = w.canInVenue("menu.edit");
  const canImport = canEdit && w.canInVenue("menu.price.edit");

  if (menus.length === 0 || !selected) {
    return (
      <>
        <PageHeader title="Carte" />
        <EmptyState
          className="border"
          title="Votre carte est vide"
          description={
            canEdit
              ? "Trois façons de commencer : importer un tableur, reprendre la carte d'un autre de vos établissements, ou partir d'une carte vierge."
              : "Aucune carte n'a encore été créée dans cet établissement."
          }
          action={
            canEdit ? (
              <Button onClick={() => setDialog("create")}>
                <Plus data-icon="inline-start" />
                Créer une carte
              </Button>
            ) : undefined
          }
          secondaryAction={
            canImport ? (
              <Button variant="outline" onClick={() => setDialog("duplicate")}>
                <Copy data-icon="inline-start" />
                Dupliquer une carte existante
              </Button>
            ) : undefined
          }
        />
        <CreateMenuDialog
          open={dialog === "create"}
          onOpenChange={(o) => setDialog(o ? "create" : null)}
          venueId={venueId}
          onCreated={select}
        />
        <DuplicateDialog
          open={dialog === "duplicate"}
          onOpenChange={(o) => setDialog(o ? "duplicate" : null)}
          venueId={venueId}
          onCreated={select}
        />
      </>
    );
  }

  return (
    <>
      <MenuWorkspace
        key={selected._id}
        venueId={venueId}
        menuId={selected._id}
        menus={menus}
        onSelect={select}
        onDialog={setDialog}
        canEdit={canEdit}
        canImport={canImport}
      />
      <CreateMenuDialog
        open={dialog === "create"}
        onOpenChange={(o) => setDialog(o ? "create" : null)}
        venueId={venueId}
        onCreated={select}
      />
      <DuplicateDialog
        open={dialog === "duplicate"}
        onOpenChange={(o) => setDialog(o ? "duplicate" : null)}
        venueId={venueId}
        onCreated={select}
      />
    </>
  );
}

function MenuWorkspace({
  venueId,
  menuId,
  menus,
  onSelect,
  onDialog,
  canEdit,
  canImport,
}: {
  venueId: Id<"venues">;
  menuId: Id<"menus">;
  menus: { _id: Id<"menus">; name: string }[];
  onSelect: (id: Id<"menus">) => void;
  onDialog: (d: "create" | "import" | "duplicate") => void;
  canEdit: boolean;
  canImport: boolean;
}) {
  const editor = useQuery(api.menus.editor, { venueId, menuId });
  const pending = useQuery(api.publications.pendingChanges, {
    venueId,
    menuId,
  });
  const publish = useMutation(api.publications.publish);
  const [publishing, setPublishing] = useState(false);
  const [message, setMessage] = useState<{
    tone: "success" | "danger";
    text: string;
  } | null>(null);
  const [importOpen, setImportOpen] = useState(false);

  if (!editor || !pending) return <LoadingState />;
  const published = pending.isPublished;
  const changes = pending.changes;

  async function onPublish() {
    setPublishing(true);
    setMessage(null);
    try {
      const result = await publish({ venueId, menuId });
      setMessage({
        tone: "success",
        text: result.changed ? `Version ${result.version} en ligne. Les clients la voient dès maintenant.` : "Rien de nouveau à publier.",
      });
    } catch (e) {
      setMessage({ tone: "danger", text: describeError(e).message });
    } finally {
      setPublishing(false);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Carte"
        description={
          published
            ? `En ligne : version ${pending.version}, publiée le ${dateTime.format(pending.publishedAt ?? 0)}.`
            : "Cette carte n'a jamais été publiée : les clients ne la voient pas encore."
        }
        actions={
          <>
            {menus.length > 1 ? (
              <NativeSelect aria-label="Carte" value={menuId} onChange={(e) => onSelect(e.target.value as Id<"menus">)}>
                {menus.map((m) => (
                  <NativeSelectOption key={m._id} value={m._id}>
                    {m.name}
                  </NativeSelectOption>
                ))}
              </NativeSelect>
            ) : null}
            <Badge variant={!published ? "outline" : changes.length > 0 ? "secondary" : "default"}>
              {!published ? "Brouillon" : changes.length > 0 ? "Modifications non publiées" : "Publiée"}
            </Badge>
            {pending.canPublish ? (
              <PendingButton
                onClick={() => void onPublish()}
                pending={publishing}
                pendingText="Publication…"
                disabled={published && changes.length === 0}
              >
                Publier la carte
              </PendingButton>
            ) : null}
          </>
        }
      />

      {message ? (
        <Alert variant={message.tone === "danger" ? "destructive" : "default"} role={message.tone === "danger" ? "alert" : "status"}>
          {message.tone === "danger" ? <CircleAlert /> : <CircleCheck />}
          <AlertDescription>{message.text}</AlertDescription>
        </Alert>
      ) : null}

      <PendingBanner published={published} changes={changes} canPublish={pending.canPublish} productCount={pending.productCount} />

      <Card>
        <CardHeader>
          <CardTitle>{editor.menu.name}</CardTitle>
          <CardDescription>
            {editor.sections.length} section
            {editor.sections.length > 1 ? "s" : ""}
          </CardDescription>
          {canImport || canEdit ? (
            <CardAction className="flex flex-wrap justify-end gap-2">
              {canImport ? (
                <Button variant="outline" size="sm" onClick={() => setImportOpen(true)}>
                  <FileUp data-icon="inline-start" />
                  Importer
                </Button>
              ) : null}
              {canImport ? (
                <Button variant="outline" size="sm" onClick={() => onDialog("duplicate")}>
                  <Copy data-icon="inline-start" />
                  Dupliquer une carte
                </Button>
              ) : null}
              {canEdit ? (
                <Button variant="outline" size="sm" onClick={() => onDialog("create")}>
                  <Plus data-icon="inline-start" />
                  Nouvelle carte
                </Button>
              ) : null}
            </CardAction>
          ) : null}
        </CardHeader>
        <CardContent>
          {editor.sections.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Aucune section.{" "}
              {canEdit ? (
                <Button asChild variant="link" className="h-auto p-0">
                  <Link to="/app/menu/categories">Créer les sections</Link>
                </Button>
              ) : null}
            </p>
          ) : (
            <ItemGroup className="gap-0">
              {editor.sections.map((section, index) => {
                const active = section.products.filter((p) => p.isActive);
                const unavailable = active.filter((p) => !p.isAvailable).length;
                return (
                  <Fragment key={section._id}>
                    {index > 0 ? <ItemSeparator className="my-0" /> : null}
                    <Item role="listitem" size="sm" className="px-0">
                      <ItemContent className="min-w-0">
                        <ItemTitle className={section.isActive ? undefined : "text-muted-foreground"}>
                          {section.name}
                          {!section.isActive ? " (masquée)" : ""}
                        </ItemTitle>
                      </ItemContent>
                      <ItemActions className="text-muted-foreground">
                        <span className="tabular-nums">
                          {active.length} produit{active.length > 1 ? "s" : ""}
                        </span>
                        {unavailable > 0 ? (
                          <Badge variant="destructive">
                            {unavailable} indisponible
                            {unavailable > 1 ? "s" : ""}
                          </Badge>
                        ) : null}
                      </ItemActions>
                    </Item>
                  </Fragment>
                );
              })}
            </ItemGroup>
          )}
        </CardContent>
      </Card>

      <History venueId={venueId} menuId={menuId} canPublish={pending.canPublish} />

      {canEdit ? (
        <MenuSettings venueId={venueId} menuId={menuId} name={editor.menu.name} canPublish={pending.canPublish} published={published} />
      ) : null}

      <ImportDialog open={importOpen} onOpenChange={setImportOpen} venueId={venueId} menuId={menuId} currency={editor.currency} />
    </div>
  );
}

const KIND_LABEL: Record<SnapshotChange["kind"], string> = {
  added: "Ajouté",
  removed: "Retiré",
  changed: "Modifié",
  moved: "Déplacé",
};
const ENTITY_LABEL: Record<SnapshotChange["entity"], string> = {
  menu: "carte",
  section: "section",
  product: "produit",
};

function PendingBanner({
  published,
  changes,
  canPublish,
  productCount,
}: {
  published: boolean;
  changes: SnapshotChange[];
  canPublish: boolean;
  productCount: number;
}) {
  const [all, setAll] = useState(false);
  if (published && changes.length === 0) {
    return (
      <Alert role="status">
        <CircleCheck />
        <AlertTitle>Ce que voient les clients est à jour.</AlertTitle>
      </Alert>
    );
  }
  if (!published) {
    return (
      <Alert role="status">
        <Info />
        <AlertTitle>
          {productCount === 0
            ? "Ajoutez des produits, puis publiez"
            : `${productCount} produit${productCount > 1 ? "s" : ""} prêts à être publiés`}
        </AlertTitle>
        <AlertDescription>
          {canPublish
            ? "Les clients ne voient jamais un brouillon : la carte leur arrive quand vous la publiez."
            : "Les clients ne voient jamais un brouillon. Demandez à un responsable qui peut publier la carte."}
        </AlertDescription>
      </Alert>
    );
  }
  const shown = all ? changes : changes.slice(0, 8);
  return (
    <Alert role="status">
      <TriangleAlert />
      <AlertTitle>
        {changes.length} modification{changes.length > 1 ? "s" : ""} non publiée
        {changes.length > 1 ? "s" : ""}
      </AlertTitle>
      <AlertDescription>
        <ul className="flex flex-col gap-0.5">
          {shown.map((c, i) => (
            <li key={i}>
              {KIND_LABEL[c.kind]} ({ENTITY_LABEL[c.entity]}) : <span className="font-medium text-foreground">{c.name}</span>
              {c.fields.length > 0 ? ` — ${c.fields.join(", ")}` : ""}
            </li>
          ))}
        </ul>
        {changes.length > 8 ? (
          <Button type="button" variant="link" className="h-auto p-0" onClick={() => setAll(!all)}>
            {all ? "Montrer moins" : `Voir les ${changes.length} modifications`}
          </Button>
        ) : null}
        {!canPublish ? <p>Seul un responsable qui peut publier la carte les mettra en ligne.</p> : null}
      </AlertDescription>
    </Alert>
  );
}

function History({ venueId, menuId, canPublish }: { venueId: Id<"venues">; menuId: Id<"menus">; canPublish: boolean }) {
  const history = useQuery(api.publications.history, { venueId, menuId });
  const rollback = useMutation(api.publications.rollback);
  const [target, setTarget] = useState<{
    id: Id<"menuPublications">;
    version: number;
  } | null>(null);
  if (!history || history.length === 0) return null;
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <HistoryIcon className="size-4 text-muted-foreground" aria-hidden="true" />
          Historique des publications
        </CardTitle>
        <CardDescription>Chaque publication reste disponible : on peut remettre en ligne une version antérieure.</CardDescription>
      </CardHeader>
      <CardContent>
        <ItemGroup className="gap-0">
          {history.slice(0, 20).map((row, index) => (
            <Fragment key={row._id}>
              {index > 0 ? <ItemSeparator className="my-0" /> : null}
              <Item role="listitem" size="sm" className="px-0">
                <ItemContent className="min-w-0">
                  <ItemTitle>
                    Version {row.version}
                    {row.isCurrent ? <Badge>En ligne</Badge> : null}
                  </ItemTitle>
                  <ItemDescription className="tabular-nums">
                    {dateTime.format(row.publishedAt)}
                    {row.publishedBy ? ` · ${row.publishedBy}` : ""} · {row.productCount} produit{row.productCount > 1 ? "s" : ""}
                  </ItemDescription>
                </ItemContent>
                {canPublish && !row.isCurrent ? (
                  <ItemActions>
                    <Button variant="ghost" size="sm" onClick={() => setTarget({ id: row._id, version: row.version })}>
                      <RotateCcw data-icon="inline-start" />
                      Revenir à cette version
                    </Button>
                  </ItemActions>
                ) : null}
              </Item>
            </Fragment>
          ))}
        </ItemGroup>
      </CardContent>
      <ConfirmDialog
        open={target !== null}
        onOpenChange={(o) => !o && setTarget(null)}
        title={`Remettre en ligne la version ${target?.version ?? ""} ?`}
        description="Les clients verront aussitôt son contenu, sous un nouveau numéro de version. Votre brouillon n'est pas touché."
        confirmLabel="Remettre en ligne"
        onConfirm={async () => {
          if (target) await rollback({ venueId, menuId, publicationId: target.id });
        }}
      />
    </Card>
  );
}

function MenuSettings({
  venueId,
  menuId,
  name,
  canPublish,
  published,
}: {
  venueId: Id<"venues">;
  menuId: Id<"menus">;
  name: string;
  canPublish: boolean;
  published: boolean;
}) {
  const update = useMutation(api.menus.update);
  const archive = useMutation(api.menus.archive);
  const [value, setValue] = useState(name);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [archiving, setArchiving] = useState(false);

  async function save(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setSaved(false);
    try {
      await update({ venueId, menuId, name: value });
      setSaved(true);
    } catch (e) {
      setError(describeError(e).message);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Réglages de la carte</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={save} noValidate className="flex flex-wrap items-end gap-3">
          <FormField label="Nom de la carte" error={error} description={saved ? "Enregistré." : undefined} className="max-w-sm">
            <Input value={value} onChange={(e) => setValue(e.target.value)} maxLength={80} />
          </FormField>
          <Button type="submit" variant="outline" disabled={value.trim() === name}>
            Renommer
          </Button>
        </form>
      </CardContent>
      {!published || canPublish ? (
        <CardFooter>
          <Button variant="destructive" size="sm" onClick={() => setArchiving(true)}>
            <Archive data-icon="inline-start" />
            Archiver cette carte
          </Button>
        </CardFooter>
      ) : null}
      <ConfirmDialog
        open={archiving}
        onOpenChange={setArchiving}
        danger
        title={`Archiver « ${name} » ?`}
        description={
          published
            ? "Elle disparaît aussitôt de la carte des clients. Ses produits restent dans le catalogue."
            : "Elle disparaît de cet écran. Ses produits restent dans le catalogue."
        }
        confirmLabel="Archiver"
        onConfirm={async () => {
          await archive({ venueId, menuId });
        }}
      />
    </Card>
  );
}

function CreateMenuDialog({
  open,
  onOpenChange,
  venueId,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  venueId: Id<"venues">;
  onCreated: (id: Id<"menus">) => void;
}) {
  const create = useMutation(api.menus.create);
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const id = await create({ venueId, name });
      onCreated(id);
      setName("");
      onOpenChange(false);
    } catch (e) {
      setError(describeError(e).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <ResponsiveDialog open={open} onOpenChange={(o) => !busy && onOpenChange(o)}>
      <ResponsiveDialogContent>
        <form onSubmit={submit} noValidate className="flex flex-col gap-4">
          <ResponsiveDialogHeader>
            <ResponsiveDialogTitle>Nouvelle carte</ResponsiveDialogTitle>
            <ResponsiveDialogDescription>
              « Carte », « Midi », « Soir », « Boissons »… Une carte se publie indépendamment des autres.
            </ResponsiveDialogDescription>
          </ResponsiveDialogHeader>
          <FormField label="Nom" error={error}>
            <Input value={name} onChange={(e) => setName(e.target.value)} maxLength={80} autoFocus />
          </FormField>
          <ResponsiveDialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)} disabled={busy}>
              Annuler
            </Button>
            <PendingButton type="submit" pending={busy} pendingText="Création…" disabled={!name.trim()}>
              Créer
            </PendingButton>
          </ResponsiveDialogFooter>
        </form>
      </ResponsiveDialogContent>
    </ResponsiveDialog>
  );
}

function DuplicateDialog({
  open,
  onOpenChange,
  venueId,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  venueId: Id<"venues">;
  onCreated: (id: Id<"menus">) => void;
}) {
  const sources = useQuery(api.menuImport.sources, open ? { venueId } : "skip");
  const duplicate = useMutation(api.menuImport.duplicateFromVenue);
  const [choice, setChoice] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const options = (sources ?? []).flatMap((s) =>
    s.menus.map((m) => ({
      value: `${s.venueId}|${m._id}`,
      label: `${s.venueName} — ${m.name}`,
    })),
  );

  async function submit() {
    const [sourceVenueId, sourceMenuId] = (choice || options[0]?.value || "").split("|") as [Id<"venues">, Id<"menus">];
    if (!sourceVenueId || !sourceMenuId) return;
    setBusy(true);
    setError(null);
    try {
      const result = await duplicate({ venueId, sourceVenueId, sourceMenuId });
      onCreated(result.menuId);
      onOpenChange(false);
    } catch (e) {
      setError(describeError(e).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <ResponsiveDialog open={open} onOpenChange={(o) => !busy && onOpenChange(o)}>
      <ResponsiveDialogContent>
        <ResponsiveDialogHeader>
          <ResponsiveDialogTitle>Dupliquer une carte</ResponsiveDialogTitle>
          <ResponsiveDialogDescription>
            La carte d'un autre de vos établissements, recopiée ici en brouillon : sections, produits, prix, variantes, options et photos.
            Les ruptures ne sont pas recopiées.
          </ResponsiveDialogDescription>
        </ResponsiveDialogHeader>
        <div>
          {sources === undefined ? (
            <LoadingState />
          ) : options.length === 0 ? (
            <p className="text-sm text-muted-foreground">Aucun autre établissement de votre organisation n'a de carte à recopier.</p>
          ) : (
            <FormField label="Carte à recopier" error={error}>
              <NativeSelect className="w-full" value={choice || options[0]!.value} onChange={(e) => setChoice(e.target.value)}>
                {options.map((o) => (
                  <NativeSelectOption key={o.value} value={o.value}>
                    {o.label}
                  </NativeSelectOption>
                ))}
              </NativeSelect>
            </FormField>
          )}
        </div>
        <ResponsiveDialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={busy}>
            Annuler
          </Button>
          {options.length > 0 ? (
            <PendingButton onClick={() => void submit()} pending={busy} pendingText="Copie…">
              Dupliquer
            </PendingButton>
          ) : null}
        </ResponsiveDialogFooter>
      </ResponsiveDialogContent>
    </ResponsiveDialog>
  );
}
