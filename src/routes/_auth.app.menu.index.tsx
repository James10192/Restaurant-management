import { useState, type FormEvent } from "react";
import { createFileRoute, Link, Navigate } from "@tanstack/react-router";
import { useMutation, useQuery } from "convex/react";
import { FileUp, Copy, Plus } from "lucide-react";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import type { SnapshotChange } from "../../convex/lib/menuSnapshot";
import { useWorkspace } from "~/components/app/workspace";
import { ImportDialog } from "~/components/menu/import-dialog";
import { ConfirmDialog, PageHeader, useSelectedMenu } from "~/components/menu/shared";
import { Alert, AlertDescription, AlertTitle } from "~/components/ui/alert";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "~/components/ui/dialog";
import { Field } from "~/components/ui/field";
import { Input } from "~/components/ui/input";
import { NativeSelect } from "~/components/ui/native-select";
import { EmptyState, LoadingState, PermissionDeniedState } from "~/components/ui/states";
import { describeError } from "~/lib/errors";

export const Route = createFileRoute("/_auth/app/menu/")({
  component: MenuHome,
});

const dateTime = new Intl.DateTimeFormat("fr-FR", { dateStyle: "medium", timeStyle: "short" });

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
          title="Votre carte est vide"
          description={
            canEdit
              ? "Trois façons de commencer : importer un tableur, reprendre la carte d'un autre de vos établissements, ou partir d'une carte vierge."
              : "Aucune carte n'a encore été créée dans cet établissement."
          }
          action={
            canEdit ? (
              <Button onClick={() => setDialog("create")}>
                <Plus aria-hidden="true" />
                Créer une carte
              </Button>
            ) : undefined
          }
          secondaryAction={
            canImport ? (
              <Button variant="secondary" onClick={() => setDialog("duplicate")}>
                <Copy aria-hidden="true" />
                Dupliquer une carte existante
              </Button>
            ) : undefined
          }
        />
        <CreateMenuDialog open={dialog === "create"} onOpenChange={(o) => setDialog(o ? "create" : null)} venueId={venueId} onCreated={select} />
        <DuplicateDialog open={dialog === "duplicate"} onOpenChange={(o) => setDialog(o ? "duplicate" : null)} venueId={venueId} onCreated={select} />
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
      <CreateMenuDialog open={dialog === "create"} onOpenChange={(o) => setDialog(o ? "create" : null)} venueId={venueId} onCreated={select} />
      <DuplicateDialog open={dialog === "duplicate"} onOpenChange={(o) => setDialog(o ? "duplicate" : null)} venueId={venueId} onCreated={select} />
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
  const pending = useQuery(api.publications.pendingChanges, { venueId, menuId });
  const publish = useMutation(api.publications.publish);
  const [publishing, setPublishing] = useState(false);
  const [message, setMessage] = useState<{ tone: "success" | "danger"; text: string } | null>(null);
  const [importOpen, setImportOpen] = useState(false);

  if (!editor || !pending) return <LoadingState />;
  const published = pending.isPublished;
  const changes = pending.changes;

  async function onPublish() {
    setPublishing(true);
    setMessage(null);
    try {
      const result = await publish({ venueId, menuId });
      setMessage({ tone: "success", text: result.changed ? `Version ${result.version} en ligne. Les clients la voient dès maintenant.` : "Rien de nouveau à publier." });
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
              <label className="flex items-center gap-2 text-label text-ink-2">
                <span className="sr-only sm:not-sr-only">Carte</span>
                <NativeSelect value={menuId} onChange={(e) => onSelect(e.target.value as Id<"menus">)} className="w-auto">
                  {menus.map((m) => (
                    <option key={m._id} value={m._id}>
                      {m.name}
                    </option>
                  ))}
                </NativeSelect>
              </label>
            ) : null}
            <Badge variant={!published ? "neutral" : changes.length > 0 ? "warning" : "success"}>
              {!published ? "Brouillon" : changes.length > 0 ? "Modifications non publiées" : "Publiée"}
            </Badge>
            {pending.canPublish ? (
              <Button onClick={() => void onPublish()} loading={publishing} loadingText="Publication…" disabled={published && changes.length === 0}>
                Publier la carte
              </Button>
            ) : null}
          </>
        }
      />

      {message ? (
        <Alert variant={message.tone} role={message.tone === "danger" ? "alert" : "status"}>
          <AlertDescription>{message.text}</AlertDescription>
        </Alert>
      ) : null}

      <PendingBanner published={published} changes={changes} canPublish={pending.canPublish} productCount={pending.productCount} />

      <Card>
        <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2">
          <CardTitle>{editor.menu.name}</CardTitle>
          <div className="flex flex-wrap gap-2">
            {canImport ? (
              <Button variant="secondary" size="sm" onClick={() => setImportOpen(true)}>
                <FileUp aria-hidden="true" />
                Importer
              </Button>
            ) : null}
            {canImport ? (
              <Button variant="secondary" size="sm" onClick={() => onDialog("duplicate")}>
                <Copy aria-hidden="true" />
                Dupliquer une carte
              </Button>
            ) : null}
            {canEdit ? (
              <Button variant="secondary" size="sm" onClick={() => onDialog("create")}>
                <Plus aria-hidden="true" />
                Nouvelle carte
              </Button>
            ) : null}
          </div>
        </CardHeader>
        <CardContent className="pb-5">
          {editor.sections.length === 0 ? (
            <p className="text-body text-ink-2">
              Aucune section.{" "}
              {canEdit ? (
                <Link to="/app/menu/categories" className="text-accent-700 underline underline-offset-4">
                  Créer les sections
                </Link>
              ) : null}
            </p>
          ) : (
            <ul className="divide-y divide-line">
              {editor.sections.map((section) => {
                const active = section.products.filter((p) => p.isActive);
                const unavailable = active.filter((p) => !p.isAvailable).length;
                return (
                  <li key={section._id} className="flex flex-wrap items-center justify-between gap-2 py-3">
                    <span className={section.isActive ? "text-body text-ink" : "text-body text-ink-3"}>
                      {section.name}
                      {!section.isActive ? " (masquée)" : ""}
                    </span>
                    <span className="flex items-center gap-3 text-label text-ink-2">
                      <span className="tabular-nums">
                        {active.length} produit{active.length > 1 ? "s" : ""}
                      </span>
                      {unavailable > 0 ? (
                        <Badge variant="warning">
                          {unavailable} indisponible{unavailable > 1 ? "s" : ""}
                        </Badge>
                      ) : null}
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
        </CardContent>
      </Card>

      <History venueId={venueId} menuId={menuId} canPublish={pending.canPublish} />

      {canEdit ? <MenuSettings venueId={venueId} menuId={menuId} name={editor.menu.name} canPublish={pending.canPublish} published={published} /> : null}

      <ImportDialog open={importOpen} onOpenChange={setImportOpen} venueId={venueId} menuId={menuId} currency={editor.currency} />
    </div>
  );
}

const KIND_LABEL: Record<SnapshotChange["kind"], string> = { added: "Ajouté", removed: "Retiré", changed: "Modifié", moved: "Déplacé" };
const ENTITY_LABEL: Record<SnapshotChange["entity"], string> = { menu: "carte", section: "section", product: "produit" };

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
      <Alert variant="success">
        <AlertDescription>Ce que voient les clients est à jour.</AlertDescription>
      </Alert>
    );
  }
  if (!published) {
    return (
      <Alert variant="info">
        <AlertTitle>{productCount === 0 ? "Ajoutez des produits, puis publiez" : `${productCount} produit${productCount > 1 ? "s" : ""} prêts à être publiés`}</AlertTitle>
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
    <Alert variant="warning">
      <AlertTitle>
        {changes.length} modification{changes.length > 1 ? "s" : ""} non publiée{changes.length > 1 ? "s" : ""}
      </AlertTitle>
      <AlertDescription>
        <ul className="mt-1 flex flex-col gap-0.5">
          {shown.map((c, i) => (
            <li key={i}>
              {KIND_LABEL[c.kind]} ({ENTITY_LABEL[c.entity]}) : <span className="font-medium">{c.name}</span>
              {c.fields.length > 0 ? ` — ${c.fields.join(", ")}` : ""}
            </li>
          ))}
        </ul>
        {changes.length > 8 ? (
          <button type="button" onClick={() => setAll(!all)} className="mt-2 min-h-11 text-accent-700 underline underline-offset-4">
            {all ? "Montrer moins" : `Voir les ${changes.length} modifications`}
          </button>
        ) : null}
        {!canPublish ? <p className="mt-2">Seul un responsable qui peut publier la carte les mettra en ligne.</p> : null}
      </AlertDescription>
    </Alert>
  );
}

function History({ venueId, menuId, canPublish }: { venueId: Id<"venues">; menuId: Id<"menus">; canPublish: boolean }) {
  const history = useQuery(api.publications.history, { venueId, menuId });
  const rollback = useMutation(api.publications.rollback);
  const [target, setTarget] = useState<{ id: Id<"menuPublications">; version: number } | null>(null);
  if (!history || history.length === 0) return null;
  return (
    <Card>
      <CardHeader>
        <CardTitle>Historique des publications</CardTitle>
      </CardHeader>
      <CardContent className="pb-5">
        <ul className="divide-y divide-line">
          {history.slice(0, 20).map((row) => (
            <li key={row._id} className="flex flex-wrap items-center justify-between gap-2 py-3">
              <span className="text-body text-ink">
                Version {row.version}
                {row.isCurrent ? (
                  <Badge variant="success" className="ml-2">
                    En ligne
                  </Badge>
                ) : null}
                <span className="block text-label text-ink-3">
                  {dateTime.format(row.publishedAt)}
                  {row.publishedBy ? ` · ${row.publishedBy}` : ""} · {row.productCount} produit{row.productCount > 1 ? "s" : ""}
                </span>
              </span>
              {canPublish && !row.isCurrent ? (
                <Button variant="quiet" size="sm" onClick={() => setTarget({ id: row._id, version: row.version })}>
                  Revenir à cette version
                </Button>
              ) : null}
            </li>
          ))}
        </ul>
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
      <CardContent className="flex flex-col gap-4 pb-5">
        <form onSubmit={save} noValidate className="flex flex-wrap items-end gap-3">
          <Field label="Nom de la carte" error={error} description={saved ? "Enregistré." : undefined} className="max-w-sm">
            <Input value={value} onChange={(e) => setValue(e.target.value)} maxLength={80} />
          </Field>
          <Button type="submit" variant="secondary" disabled={value.trim() === name}>
            Renommer
          </Button>
        </form>
        {!published || canPublish ? (
          <div>
            <Button variant="danger" size="sm" onClick={() => setArchiving(true)}>
              Archiver cette carte
            </Button>
          </div>
        ) : null}
      </CardContent>
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
    <Dialog open={open} onOpenChange={(o) => !busy && onOpenChange(o)}>
      <DialogContent>
        <form onSubmit={submit} noValidate>
          <DialogHeader>
            <DialogTitle>Nouvelle carte</DialogTitle>
            <DialogDescription>« Carte », « Midi », « Soir », « Boissons »… Une carte se publie indépendamment des autres.</DialogDescription>
          </DialogHeader>
          <Field label="Nom" error={error} className="mt-4">
            <Input value={name} onChange={(e) => setName(e.target.value)} maxLength={80} autoFocus />
          </Field>
          <DialogFooter>
            <Button type="button" variant="quiet" onClick={() => onOpenChange(false)} disabled={busy}>
              Annuler
            </Button>
            <Button type="submit" loading={busy} loadingText="Création…" disabled={!name.trim()}>
              Créer
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
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
  const options = (sources ?? []).flatMap((s) => s.menus.map((m) => ({ value: `${s.venueId}|${m._id}`, label: `${s.venueName} — ${m.name}` })));

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
    <Dialog open={open} onOpenChange={(o) => !busy && onOpenChange(o)}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Dupliquer une carte</DialogTitle>
          <DialogDescription>
            La carte d'un autre de vos établissements, recopiée ici en brouillon : sections, produits, prix, variantes,
            options et photos. Les ruptures ne sont pas recopiées.
          </DialogDescription>
        </DialogHeader>
        <div className="mt-4">
          {sources === undefined ? (
            <LoadingState />
          ) : options.length === 0 ? (
            <p className="text-body text-ink-2">Aucun autre établissement de votre organisation n'a de carte à recopier.</p>
          ) : (
            <Field label="Carte à recopier" error={error}>
              <NativeSelect value={choice || options[0]!.value} onChange={(e) => setChoice(e.target.value)}>
                {options.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </NativeSelect>
            </Field>
          )}
        </div>
        <DialogFooter>
          <Button variant="quiet" onClick={() => onOpenChange(false)} disabled={busy}>
            Annuler
          </Button>
          {options.length > 0 ? (
            <Button onClick={() => void submit()} loading={busy} loadingText="Copie…">
              Dupliquer
            </Button>
          ) : null}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
