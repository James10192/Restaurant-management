import { useState, type FormEvent } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery } from "convex/react";
import { ArrowDown, ArrowUp, Eye, EyeOff } from "lucide-react";
import type { FunctionReturnType } from "convex/server";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import { useWorkspace } from "~/components/app/workspace";
import { moved, PageHeader, useSelectedMenu } from "~/components/menu/shared";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { Card } from "~/components/ui/card";
import { Field } from "~/components/ui/field";
import { Input } from "~/components/ui/input";
import { NativeSelect } from "~/components/ui/native-select";
import { EmptyState, LoadingState, PermissionDeniedState } from "~/components/ui/states";
import { describeError } from "~/lib/errors";

export const Route = createFileRoute("/_auth/app/menu/categories")({
  head: () => ({ meta: [{ title: "Sections — Joliba" }] }),
  component: SectionsPage,
});

const TEMPLATES = [
  ["Entrées", "Plats", "Desserts", "Boissons"],
  ["Grillades", "Plats du jour", "Accompagnements", "Boissons"],
  ["Petit déjeuner", "Viennoiseries", "Boissons chaudes", "Jus"],
];

/**
 * Les sections d'une carte, et l'ordre des plats dans chacune — l'ordre que voit le client.
 * Des flèches plutôt qu'un glisser-déposer : elles marchent au clavier, au pouce et avec un
 * lecteur d'écran.
 */
function SectionsPage() {
  const w = useWorkspace();
  const venueId = w.venue?._id;
  const allowed = venueId !== undefined && w.canInVenue("menu.read");
  const { menus, selected, select } = useSelectedMenu(venueId, allowed);
  if (!allowed) return <PermissionDeniedState venue={w.venue?.name} permission="Consulter la carte" />;
  if (!venueId || menus === undefined) return <LoadingState />;
  if (!selected) {
    return (
      <EmptyState
        title="Aucune carte"
        description="Les sections appartiennent à une carte. Créez-en une depuis l'écran Carte."
        action={
          <Button asChild>
            <Link to="/app/menu">Aller à la carte</Link>
          </Button>
        }
      />
    );
  }
  return (
    <>
      <PageHeader
        title="Sections"
        description="Les rubriques de la carte, dans l'ordre où le client les parcourt."
        actions={
          menus.length > 1 ? (
            <NativeSelect aria-label="Carte" value={selected._id} onChange={(e) => select(e.target.value as Id<"menus">)} className="w-auto">
              {menus.map((m) => (
                <option key={m._id} value={m._id}>
                  {m.name}
                </option>
              ))}
            </NativeSelect>
          ) : null
        }
      />
      <SectionsEditor key={selected._id} venueId={venueId} menuId={selected._id} />
    </>
  );
}

function SectionsEditor({ venueId, menuId }: { venueId: Id<"venues">; menuId: Id<"menus"> }) {
  const editor = useQuery(api.menus.editor, { venueId, menuId });
  const createSections = useMutation(api.menus.createSections);
  const reorderSections = useMutation(api.menus.reorderSections);
  const [error, setError] = useState<string | null>(null);
  const [name, setName] = useState("");

  if (!editor) return <LoadingState />;
  const canEdit = editor.canEdit;

  async function run(action: () => Promise<unknown>) {
    setError(null);
    try {
      await action();
    } catch (e) {
      setError(describeError(e).message);
    }
  }

  async function add(event: FormEvent) {
    event.preventDefault();
    await run(async () => {
      await createSections({ venueId, menuId, names: [name] });
      setName("");
    });
  }

  const ids = editor.sections.map((s) => s._id);
  return (
    <div className="flex flex-col gap-6">
      {editor.sections.length === 0 ? (
        <EmptyState
          title="Une carte se range en sections"
          description="Entrées, Grillades, Boissons… Créez-les une par une, ou d'un coup avec un modèle."
          action={
            canEdit ? (
              <div className="flex flex-col gap-2">
                {TEMPLATES.map((names) => (
                  <Button key={names.join()} variant="secondary" onClick={() => void run(() => createSections({ venueId, menuId, names }))}>
                    {names.join(" · ")}
                  </Button>
                ))}
              </div>
            ) : undefined
          }
        />
      ) : (
        <Card>
          <ol className="divide-y divide-line">
            {editor.sections.map((section, index) => (
              <SectionRow
                key={section._id}
                venueId={venueId}
                section={section}
                canEdit={canEdit}
                first={index === 0}
                last={index === editor.sections.length - 1}
                onMove={(delta) => {
                  const next = moved(ids, index, delta);
                  if (next) void run(() => reorderSections({ venueId, menuId, sectionIds: next }));
                }}
                onError={setError}
              />
            ))}
          </ol>
        </Card>
      )}
      {canEdit ? (
        <form onSubmit={add} noValidate className="flex flex-wrap items-end gap-3">
          <Field label="Nouvelle section" className="max-w-sm">
            <Input value={name} onChange={(e) => setName(e.target.value)} maxLength={80} />
          </Field>
          <Button type="submit" variant="secondary" disabled={!name.trim()}>
            Ajouter une section
          </Button>
        </form>
      ) : null}
      {error ? (
        <p role="alert" className="text-label text-danger-700">
          {error}
        </p>
      ) : null}
    </div>
  );
}

type Section = FunctionReturnType<typeof api.menus.editor>["sections"][number];

function SectionRow({
  venueId,
  section,
  canEdit,
  first,
  last,
  onMove,
  onError,
}: {
  venueId: Id<"venues">;
  section: Section;
  canEdit: boolean;
  first: boolean;
  last: boolean;
  onMove: (delta: -1 | 1) => void;
  onError: (message: string | null) => void;
}) {
  const update = useMutation(api.menus.updateSection);
  const reorderProducts = useMutation(api.products.reorder);
  const [name, setName] = useState(section.name);
  const [nameEn, setNameEn] = useState((section.i18n as { en?: { name?: string } } | null)?.en?.name ?? "");
  const products = section.products;

  async function run(action: () => Promise<unknown>) {
    onError(null);
    try {
      await action();
    } catch (e) {
      onError(describeError(e).message);
    }
  }

  // Ne changer que le nom anglais : une description anglaise (recopiée d'une autre carte, par
  // exemple) ne doit pas disparaître au passage.
  const englishWith = (name: string): Record<string, { name?: string; description?: string }> => {
    const description = (section.i18n as { en?: { description?: string } } | null)?.en?.description;
    const en = { ...(name ? { name } : {}), ...(description ? { description } : {}) };
    return Object.keys(en).length > 0 ? { en } : {};
  };

  const save = () => {
    const changedName = name.trim() && name !== section.name;
    const currentEn = (section.i18n as { en?: { name?: string } } | null)?.en?.name ?? "";
    const changedEn = nameEn.trim() !== currentEn;
    if (!changedName && !changedEn) return;
    void run(() =>
      update({
        venueId,
        sectionId: section._id,
        ...(changedName ? { name } : {}),
        ...(changedEn ? { i18n: englishWith(nameEn.trim()) } : {}),
      }),
    );
  };

  return (
    <li className="px-4 py-3">
      <div className="flex flex-wrap items-center gap-2">
        {canEdit ? (
          <>
            <Input aria-label="Nom de la section" value={name} onChange={(e) => setName(e.target.value)} onBlur={save} className="min-w-40 flex-1" maxLength={80} />
            <Input aria-label="Nom en anglais" lang="en" placeholder="En anglais" value={nameEn} onChange={(e) => setNameEn(e.target.value)} onBlur={save} className="w-40" maxLength={80} />
          </>
        ) : (
          <span className="flex-1 text-body text-ink">{section.name}</span>
        )}
        {!section.isActive ? <Badge>Masquée</Badge> : null}
        {canEdit ? (
          <div className="flex items-center">
            <Button size="icon" variant="quiet" aria-label={`Monter ${section.name}`} disabled={first} onClick={() => onMove(-1)}>
              <ArrowUp aria-hidden="true" />
            </Button>
            <Button size="icon" variant="quiet" aria-label={`Descendre ${section.name}`} disabled={last} onClick={() => onMove(1)}>
              <ArrowDown aria-hidden="true" />
            </Button>
            <Button
              size="icon"
              variant="quiet"
              aria-label={section.isActive ? `Masquer ${section.name}` : `Afficher ${section.name}`}
              aria-pressed={!section.isActive}
              onClick={() => void run(() => update({ venueId, sectionId: section._id, isActive: !section.isActive }))}
            >
              {section.isActive ? <Eye aria-hidden="true" /> : <EyeOff aria-hidden="true" />}
            </Button>
          </div>
        ) : null}
      </div>
      <details className="mt-2">
        <summary className="min-h-11 cursor-pointer content-center text-label text-ink-2">
          {products.length} produit{products.length > 1 ? "s" : ""} — ordre dans la section
        </summary>
        <ol className="mt-1 flex flex-col">
          {products.map((p, index) => (
            <li key={p._id} className="flex min-h-11 items-center gap-2 pl-4">
              <Link to="/app/menu/products/$productId" params={{ productId: p._id }} className={p.isActive ? "flex-1 text-body text-ink" : "flex-1 text-body text-ink-3"}>
                {p.name}
                {!p.isActive ? " (archivé)" : ""}
              </Link>
              {canEdit ? (
                <>
                  <Button
                    size="icon"
                    variant="quiet"
                    aria-label={`Monter ${p.name}`}
                    disabled={index === 0}
                    onClick={() => {
                      const next = moved(products.map((x) => x._id), index, -1);
                      if (next) void run(() => reorderProducts({ venueId, menuSectionId: section._id, productIds: next }));
                    }}
                  >
                    <ArrowUp aria-hidden="true" />
                  </Button>
                  <Button
                    size="icon"
                    variant="quiet"
                    aria-label={`Descendre ${p.name}`}
                    disabled={index === products.length - 1}
                    onClick={() => {
                      const next = moved(products.map((x) => x._id), index, 1);
                      if (next) void run(() => reorderProducts({ venueId, menuSectionId: section._id, productIds: next }));
                    }}
                  >
                    <ArrowDown aria-hidden="true" />
                  </Button>
                </>
              ) : null}
            </li>
          ))}
        </ol>
      </details>
    </li>
  );
}
