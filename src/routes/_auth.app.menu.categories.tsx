import { useState, type FormEvent } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery } from "convex/react";
import { ArrowDown, ArrowUp, ChevronDown, CircleAlert, Eye, EyeOff, LayoutList, Plus } from "lucide-react";
import type { FunctionReturnType } from "convex/server";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import { FormField } from "~/components/app/form-field";
import { EmptyState, LoadingState, PermissionDeniedState } from "~/components/app/states";
import { useWorkspace } from "~/components/app/workspace";
import { moved, PageHeader, useSelectedMenu } from "~/components/menu/shared";
import { Alert, AlertDescription } from "~/components/ui/alert";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "~/components/ui/card";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "~/components/ui/collapsible";
import { Input } from "~/components/ui/input";
import { Item, ItemActions, ItemContent, ItemFooter, ItemTitle } from "~/components/ui/item";
import { NativeSelect, NativeSelectOption } from "~/components/ui/native-select";
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
        className="border"
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
            <NativeSelect aria-label="Carte" value={selected._id} onChange={(e) => select(e.target.value as Id<"menus">)}>
              {menus.map((m) => (
                <NativeSelectOption key={m._id} value={m._id}>
                  {m.name}
                </NativeSelectOption>
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
          className="border"
          icon={<LayoutList />}
          title="Une carte se range en sections"
          description="Entrées, Grillades, Boissons… Créez-les une par une, ou d'un coup avec un modèle."
          action={
            canEdit ? (
              <div className="flex flex-col gap-2">
                {TEMPLATES.map((names) => (
                  <Button
                    key={names.join()}
                    variant="outline"
                    className="h-auto min-h-8 whitespace-normal"
                    onClick={() => void run(() => createSections({ venueId, menuId, names }))}
                  >
                    {names.join(" · ")}
                  </Button>
                ))}
              </div>
            ) : undefined
          }
        />
      ) : (
        <ol className="flex flex-col gap-2">
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
      )}
      {error ? (
        <Alert variant="destructive">
          <CircleAlert />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}
      {canEdit ? (
        <Card>
          <CardHeader>
            <CardTitle>Ajouter une section</CardTitle>
            <CardDescription>Elle se place en fin de carte ; les flèches la remontent.</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={add} noValidate className="flex flex-wrap items-end gap-3">
              <FormField label="Nouvelle section" className="min-w-0 flex-1 sm:max-w-sm">
                <Input value={name} onChange={(e) => setName(e.target.value)} maxLength={80} />
              </FormField>
              <Button type="submit" variant="outline" disabled={!name.trim()}>
                <Plus data-icon="inline-start" />
                Ajouter une section
              </Button>
            </form>
          </CardContent>
        </Card>
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
    <Item asChild variant="outline">
      <li>
        <ItemContent className="min-w-0 basis-full flex-row flex-wrap items-center gap-2 sm:basis-0">
          {canEdit ? (
            <>
              <Input
                aria-label="Nom de la section"
                value={name}
                onChange={(e) => setName(e.target.value)}
                onBlur={save}
                className="min-w-0 flex-1 basis-40"
                maxLength={80}
              />
              <Input
                aria-label="Nom en anglais"
                lang="en"
                placeholder="En anglais"
                value={nameEn}
                onChange={(e) => setNameEn(e.target.value)}
                onBlur={save}
                className="min-w-0 flex-1 basis-32 sm:max-w-40"
                maxLength={80}
              />
            </>
          ) : (
            <ItemTitle className={section.isActive ? undefined : "text-muted-foreground"}>{section.name}</ItemTitle>
          )}
          {!section.isActive ? <Badge variant="outline">Masquée</Badge> : null}
        </ItemContent>
        {canEdit ? (
          <ItemActions className="gap-0">
            <Button size="icon" variant="ghost" aria-label={`Monter ${section.name}`} disabled={first} onClick={() => onMove(-1)}>
              <ArrowUp aria-hidden="true" />
            </Button>
            <Button size="icon" variant="ghost" aria-label={`Descendre ${section.name}`} disabled={last} onClick={() => onMove(1)}>
              <ArrowDown aria-hidden="true" />
            </Button>
            <Button
              size="icon"
              variant="ghost"
              aria-label={section.isActive ? `Masquer ${section.name}` : `Afficher ${section.name}`}
              aria-pressed={!section.isActive}
              onClick={() => void run(() => update({ venueId, sectionId: section._id, isActive: !section.isActive }))}
            >
              {section.isActive ? <Eye aria-hidden="true" /> : <EyeOff aria-hidden="true" />}
            </Button>
          </ItemActions>
        ) : null}
        <ItemFooter>
          <Collapsible className="w-full">
            <CollapsibleTrigger asChild>
              <Button variant="ghost" size="sm" className="group/trigger -ml-2 text-muted-foreground">
                <ChevronDown data-icon="inline-start" className="transition-transform group-data-[state=open]/trigger:rotate-180" />
                {products.length} produit{products.length > 1 ? "s" : ""} — ordre dans la section
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <ol className="mt-1 flex flex-col">
                {products.map((p, index) => (
                  <li key={p._id} className="flex min-h-9 items-center gap-1 border-t pl-2 first:border-t-0">
                    <Link
                      to="/app/menu/products/$productId"
                      params={{ productId: p._id }}
                      className={
                        p.isActive
                          ? "min-w-0 flex-1 truncate hover:underline"
                          : "min-w-0 flex-1 truncate text-muted-foreground hover:underline"
                      }
                    >
                      {p.name}
                      {!p.isActive ? " (archivé)" : ""}
                    </Link>
                    {canEdit ? (
                      <>
                        <Button
                          size="icon-sm"
                          variant="ghost"
                          aria-label={`Monter ${p.name}`}
                          disabled={index === 0}
                          onClick={() => {
                            const next = moved(
                              products.map((x) => x._id),
                              index,
                              -1,
                            );
                            if (next) void run(() => reorderProducts({ venueId, menuSectionId: section._id, productIds: next }));
                          }}
                        >
                          <ArrowUp aria-hidden="true" />
                        </Button>
                        <Button
                          size="icon-sm"
                          variant="ghost"
                          aria-label={`Descendre ${p.name}`}
                          disabled={index === products.length - 1}
                          onClick={() => {
                            const next = moved(
                              products.map((x) => x._id),
                              index,
                              1,
                            );
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
            </CollapsibleContent>
          </Collapsible>
        </ItemFooter>
      </li>
    </Item>
  );
}
