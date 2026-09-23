import { useState, type FormEvent } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import { ArrowDown, ArrowUp, Plus, Trash2 } from "lucide-react";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import { useWorkspace } from "~/components/app/workspace";
import { ConfirmDialog, formatPrice, moved, PageHeader, PriceInput } from "~/components/menu/shared";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { Checkbox } from "~/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "~/components/ui/dialog";
import { Field } from "~/components/ui/field";
import { Input } from "~/components/ui/input";
import { NativeSelect } from "~/components/ui/native-select";
import { EmptyState, LoadingState, PermissionDeniedState } from "~/components/ui/states";
import { describeError } from "~/lib/errors";

export const Route = createFileRoute("/_auth/app/menu/options")({
  head: () => ({ meta: [{ title: "Options — Joliba" }] }),
  component: OptionsPage,
});

type Group = FunctionReturnType<typeof api.modifiers.list>[number];

const TEMPLATES = [
  { name: "Cuisson", selectionType: "single" as const, isRequired: true, options: ["Saignant", "À point", "Bien cuit"] },
  { name: "Accompagnement", selectionType: "single" as const, isRequired: true, options: ["Attiéké", "Alloco", "Riz", "Frites"] },
];

/**
 * Les groupes d'options réutilisables (IA §4.11). Chaque groupe dit combien de produits
 * l'utilisent : c'est l'information qui évite de modifier quinze plats à l'aveugle.
 */
function OptionsPage() {
  const w = useWorkspace();
  const venueId = w.venue?._id;
  const allowed = venueId !== undefined && w.canInVenue("menu.read");
  const groups = useQuery(api.modifiers.list, allowed ? { venueId } : "skip");
  const choices = useQuery(api.menus.sectionChoices, allowed ? { venueId } : "skip");
  const createGroup = useMutation(api.modifiers.createGroup);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  if (!allowed) return <PermissionDeniedState venue={w.venue?.name} permission="Consulter la carte" />;
  if (!venueId || groups === undefined || choices === undefined) return <LoadingState />;
  const canEdit = w.canInVenue("menu.edit");
  const canEditPrice = w.canInVenue("menu.price.edit");
  const currency = choices.currency;

  async function addTemplate(template: (typeof TEMPLATES)[number]) {
    setError(null);
    try {
      await createGroup({
        venueId: venueId!,
        name: template.name,
        selectionType: template.selectionType,
        minSelect: template.isRequired ? 1 : 0,
        maxSelect: 1,
        isRequired: template.isRequired,
        options: template.options.map((name) => ({ name, priceDelta: 0 })),
      });
    } catch (e) {
      setError(describeError(e).message);
    }
  }

  return (
    <>
      <PageHeader
        title="Options"
        description="« Cuisson », « Accompagnement » : préparées une fois, rattachées à autant de plats que nécessaire."
        actions={
          canEdit ? (
            <Button onClick={() => setCreating(true)}>
              <Plus aria-hidden="true" />
              Créer un groupe d'options
            </Button>
          ) : null
        }
      />
      {error ? (
        <p role="alert" className="mb-4 text-label text-danger-700">
          {error}
        </p>
      ) : null}
      {groups.length === 0 ? (
        <EmptyState
          title="Aucun groupe d'options"
          description="Deux modèles pour commencer, à ajuster ensuite."
          action={
            canEdit ? (
              <div className="flex flex-col gap-2">
                {TEMPLATES.map((t) => (
                  <Button key={t.name} variant="secondary" onClick={() => void addTemplate(t)}>
                    {t.name} : {t.options.join(", ")}
                  </Button>
                ))}
              </div>
            ) : undefined
          }
        />
      ) : (
        <div className="flex flex-col gap-4">
          {groups.map((group) => (
            <GroupCard key={group._id} venueId={venueId} group={group} currency={currency} canEdit={canEdit} canEditPrice={canEditPrice} />
          ))}
        </div>
      )}
      <CreateGroupDialog open={creating} onOpenChange={setCreating} venueId={venueId} />
    </>
  );
}

function GroupCard({
  venueId,
  group,
  currency,
  canEdit,
  canEditPrice,
}: {
  venueId: Id<"venues">;
  group: Group;
  currency: string;
  canEdit: boolean;
  canEditPrice: boolean;
}) {
  const updateGroup = useMutation(api.modifiers.updateGroup);
  const deleteGroup = useMutation(api.modifiers.deleteGroup);
  const addOption = useMutation(api.modifiers.addOption);
  const updateOption = useMutation(api.modifiers.updateOption);
  const setOptionPrice = useMutation(api.modifiers.setOptionPrice);
  const removeOption = useMutation(api.modifiers.removeOption);
  const reorderOptions = useMutation(api.modifiers.reorderOptions);
  const setOptionAvailable = useMutation(api.availability.setOption);
  const canToggle = useWorkspace().canInVenue("menu.availability.toggle");
  const [name, setName] = useState(group.name);
  const [newOption, setNewOption] = useState("");
  const [newDelta, setNewDelta] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  async function run(action: () => Promise<unknown>) {
    setError(null);
    try {
      await action();
    } catch (e) {
      setError(describeError(e).message);
    }
  }

  const bounds =
    group.selectionType === "single"
      ? group.isRequired
        ? "un choix, obligatoire"
        : "un choix, facultatif"
      : `de ${group.minSelect} à ${group.maxSelect} choix${group.isRequired ? ", obligatoire" : ""}`;

  return (
    <Card>
      <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2">
        <div className="min-w-0">
          <CardTitle>{group.name}</CardTitle>
          <p className="text-label text-ink-3">
            {bounds} · utilisé par {group.productCount} produit{group.productCount > 1 ? "s" : ""}
          </p>
        </div>
        {canEdit ? (
          <Button variant="quiet" size="sm" onClick={() => setDeleting(true)}>
            Supprimer
          </Button>
        ) : null}
      </CardHeader>
      <CardContent className="flex flex-col gap-4 pb-5">
        {canEdit ? (
          <div className="grid items-end gap-3 sm:grid-cols-[1fr_auto_auto]">
            <Field label="Nom du groupe">
              <Input value={name} onChange={(e) => setName(e.target.value)} onBlur={() => name.trim() && name !== group.name && void run(() => updateGroup({ venueId, modifierGroupId: group._id, name }))} maxLength={80} />
            </Field>
            <Field label="Type de choix">
              <NativeSelect
                value={group.selectionType}
                onChange={(e) => void run(() => updateGroup({ venueId, modifierGroupId: group._id, selectionType: e.target.value as "single" | "multiple", maxSelect: e.target.value === "multiple" ? Math.max(2, group.maxSelect) : 1 }))}
              >
                <option value="single">Un seul choix</option>
                <option value="multiple">Plusieurs choix</option>
              </NativeSelect>
            </Field>
            <label className="flex min-h-11 items-center gap-2 text-body text-ink">
              <Checkbox checked={group.isRequired} onCheckedChange={(c) => void run(() => updateGroup({ venueId, modifierGroupId: group._id, isRequired: c === true }))} />
              Obligatoire
            </label>
            {group.selectionType === "multiple" ? (
              <Field label="Au plus" className="sm:col-start-1">
                <Input
                  type="number"
                  inputMode="numeric"
                  min={1}
                  max={30}
                  defaultValue={group.maxSelect}
                  onBlur={(e) => {
                    const max = Number(e.target.value);
                    if (max !== group.maxSelect) void run(() => updateGroup({ venueId, modifierGroupId: group._id, maxSelect: max }));
                  }}
                />
              </Field>
            ) : null}
          </div>
        ) : null}

        <ol className="divide-y divide-line rounded-sm border border-line">
          {group.options.map((option, index) => (
            <li key={option._id} className="flex flex-wrap items-center gap-2 px-3 py-2">
              {canEdit ? (
                <Input
                  aria-label="Nom de l'option"
                  defaultValue={option.name}
                  onBlur={(e) => e.target.value.trim() && e.target.value !== option.name && void run(() => updateOption({ venueId, optionId: option._id, name: e.target.value }))}
                  className="min-w-32 flex-1"
                  maxLength={80}
                />
              ) : (
                <span className="flex-1 text-body text-ink">{option.name}</span>
              )}
              {canEditPrice ? (
                <OptionPrice currency={currency} value={option.priceDelta} label={option.name} onSave={(delta) => run(() => setOptionPrice({ venueId, optionId: option._id, priceDelta: delta }))} />
              ) : (
                <span className="text-label text-ink-2 tabular-nums">{option.priceDelta === 0 ? "sans supplément" : `+ ${formatPrice(option.priceDelta, currency)}`}</span>
              )}
              {canToggle ? (
                <Button
                  size="sm"
                  variant={option.isAvailable ? "quiet" : "secondary"}
                  aria-pressed={!option.isAvailable}
                  aria-label={option.isAvailable ? `${option.name} disponible — marquer épuisée` : `${option.name} épuisée — remettre disponible`}
                  onClick={() => void run(() => setOptionAvailable({ venueId, optionId: option._id, isAvailable: !option.isAvailable }))}
                >
                  {option.isAvailable ? "Disponible" : "Épuisée"}
                </Button>
              ) : !option.isAvailable ? (
                <Badge variant="warning">Épuisée</Badge>
              ) : null}
              {canEdit ? (
                <>
                  <Button
                    size="icon"
                    variant="quiet"
                    aria-label={`Monter ${option.name}`}
                    disabled={index === 0}
                    onClick={() => {
                      const next = moved(group.options.map((o) => o._id), index, -1);
                      if (next) void run(() => reorderOptions({ venueId, modifierGroupId: group._id, optionIds: next }));
                    }}
                  >
                    <ArrowUp aria-hidden="true" />
                  </Button>
                  <Button
                    size="icon"
                    variant="quiet"
                    aria-label={`Descendre ${option.name}`}
                    disabled={index === group.options.length - 1}
                    onClick={() => {
                      const next = moved(group.options.map((o) => o._id), index, 1);
                      if (next) void run(() => reorderOptions({ venueId, modifierGroupId: group._id, optionIds: next }));
                    }}
                  >
                    <ArrowDown aria-hidden="true" />
                  </Button>
                  <Button size="icon" variant="quiet" aria-label={`Retirer ${option.name}`} onClick={() => void run(() => removeOption({ venueId, optionId: option._id }))}>
                    <Trash2 aria-hidden="true" />
                  </Button>
                </>
              ) : null}
            </li>
          ))}
        </ol>

        {canEdit ? (
          <form
            noValidate
            className="grid items-end gap-3 sm:grid-cols-[1fr_12rem_auto]"
            onSubmit={(e: FormEvent) => {
              e.preventDefault();
              void run(async () => {
                await addOption({ venueId, modifierGroupId: group._id, name: newOption, priceDelta: newDelta ?? 0 });
                setNewOption("");
                setNewDelta(null);
              });
            }}
          >
            <Field label="Nouvelle option">
              <Input value={newOption} onChange={(e) => setNewOption(e.target.value)} maxLength={80} />
            </Field>
            {canEditPrice ? (
              <Field label="Supplément" optional>
                <PriceInput currency={currency} value={newDelta} onChange={setNewDelta} allowNegative />
              </Field>
            ) : (
              <span />
            )}
            <Button type="submit" variant="secondary" disabled={!newOption.trim()}>
              Ajouter
            </Button>
          </form>
        ) : null}
        {error ? (
          <p role="alert" className="text-label text-danger-700">
            {error}
          </p>
        ) : null}
      </CardContent>
      <ConfirmDialog
        open={deleting}
        onOpenChange={setDeleting}
        danger
        title={`Supprimer le groupe « ${group.name} » ?`}
        description={
          group.productCount > 0
            ? `Il est encore rattaché à ${group.productCount} produit${group.productCount > 1 ? "s" : ""} : la suppression sera refusée, avec leur liste.`
            : "Ses options disparaissent avec lui."
        }
        confirmLabel="Supprimer"
        onConfirm={async () => {
          await deleteGroup({ venueId, modifierGroupId: group._id });
        }}
      />
    </Card>
  );
}

function OptionPrice({ currency, value, label, onSave }: { currency: string; value: number; label: string; onSave: (delta: number) => Promise<void> }) {
  const [delta, setDelta] = useState<number | null>(value);
  return (
    <div className="flex items-center gap-2">
      <div className="w-36">
        <PriceInput aria-label={`Supplément pour ${label}`} currency={currency} value={delta} onChange={setDelta} allowNegative />
      </div>
      {(delta ?? 0) !== value ? (
        <Button size="sm" variant="secondary" onClick={() => void onSave(delta ?? 0)}>
          Enregistrer
        </Button>
      ) : null}
    </div>
  );
}

function CreateGroupDialog({ open, onOpenChange, venueId }: { open: boolean; onOpenChange: (open: boolean) => void; venueId: Id<"venues"> }) {
  const createGroup = useMutation(api.modifiers.createGroup);
  const [name, setName] = useState("");
  const [selectionType, setSelectionType] = useState<"single" | "multiple">("single");
  const [isRequired, setIsRequired] = useState(false);
  const [options, setOptions] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const list = options.split(/[,\n]/).map((o) => o.trim()).filter(Boolean);
      await createGroup({
        venueId,
        name,
        selectionType,
        minSelect: isRequired ? 1 : 0,
        maxSelect: selectionType === "single" ? 1 : Math.max(1, list.length),
        isRequired,
        options: list.map((o) => ({ name: o, priceDelta: 0 })),
      });
      setName("");
      setOptions("");
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
            <DialogTitle>Nouveau groupe d'options</DialogTitle>
            <DialogDescription>Les suppléments payants se fixent ensuite, option par option.</DialogDescription>
          </DialogHeader>
          <div className="mt-4 flex flex-col gap-4">
            <Field label="Nom">
              <Input value={name} onChange={(e) => setName(e.target.value)} maxLength={80} autoFocus placeholder="Cuisson" />
            </Field>
            <Field label="Type de choix">
              <NativeSelect value={selectionType} onChange={(e) => setSelectionType(e.target.value as "single" | "multiple")}>
                <option value="single">Un seul choix</option>
                <option value="multiple">Plusieurs choix</option>
              </NativeSelect>
            </Field>
            <label className="flex min-h-11 items-center gap-2 text-body text-ink">
              <Checkbox checked={isRequired} onCheckedChange={(c) => setIsRequired(c === true)} />
              Le client doit choisir
            </label>
            <Field label="Options" description="Séparées par des virgules : « Saignant, À point, Bien cuit »." error={error}>
              <Input value={options} onChange={(e) => setOptions(e.target.value)} />
            </Field>
          </div>
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
