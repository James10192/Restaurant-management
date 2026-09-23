import { useDeferredValue, useState, type FormEvent } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery } from "convex/react";
import { ChevronRight, Plus, Search, SearchX, UtensilsCrossed } from "lucide-react";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
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
import { formatPrice, PageHeader, PriceInput } from "~/components/menu/shared";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { FieldGroup } from "~/components/ui/field";
import { Input } from "~/components/ui/input";
import { InputGroup, InputGroupAddon, InputGroupInput } from "~/components/ui/input-group";
import { Item, ItemActions, ItemContent, ItemDescription, ItemGroup, ItemMedia, ItemTitle } from "~/components/ui/item";
import { Label } from "~/components/ui/label";
import { NativeSelect, NativeSelectOption } from "~/components/ui/native-select";
import { Skeleton } from "~/components/ui/skeleton";
import { describeError } from "~/lib/errors";

export const Route = createFileRoute("/_auth/app/menu/products/")({
  head: () => ({ meta: [{ title: "Produits — Joliba" }] }),
  component: ProductsPage,
});

type AvailabilityFilter = "all" | "available" | "unavailable" | "archived";

/**
 * Le catalogue (IA §4.11). La recherche passe par l'index plein texte, filtré par
 * établissement ; les filtres de section et d'état s'appliquent sur ce qu'il renvoie.
 */
function ProductsPage() {
  const w = useWorkspace();
  const venueId = w.venue?._id;
  const allowed = venueId !== undefined && w.canInVenue("menu.read");
  const [search, setSearch] = useState("");
  const deferred = useDeferredValue(search.trim());
  const [section, setSection] = useState("");
  const [state, setState] = useState<AvailabilityFilter>("all");
  const [creating, setCreating] = useState(false);
  const products = useQuery(
    api.products.list,
    allowed ? { venueId, ...(deferred ? { search: deferred } : {}), includeArchived: state === "archived" } : "skip",
  );
  const choices = useQuery(api.menus.sectionChoices, allowed ? { venueId } : "skip");
  const sections = choices?.sections;

  if (!allowed) return <PermissionDeniedState venue={w.venue?.name} permission="Consulter la carte" />;
  const canCreate = w.canInVenue("menu.edit") && w.canInVenue("menu.price.edit");

  const rows = (products ?? []).filter((p) => {
    if (section && p.sectionId !== section) return false;
    if (state === "archived") return !p.isActive;
    if (state === "available") return p.isAvailable;
    if (state === "unavailable") return !p.isAvailable;
    return true;
  });

  const filtered = Boolean(search || section || state !== "all");

  return (
    <>
      <PageHeader
        title="Produits"
        description={products ? `${rows.length} produit${rows.length > 1 ? "s" : ""}` : undefined}
        actions={
          canCreate ? (
            <Button onClick={() => setCreating(true)} disabled={!sections || sections.length === 0}>
              <Plus data-icon="inline-start" />
              Ajouter un produit
            </Button>
          ) : null
        }
      />
      <div className="mb-4 grid gap-2 sm:grid-cols-[1fr_auto_auto]">
        <Label className="sr-only" htmlFor="product-search">
          Rechercher un produit
        </Label>
        <InputGroup>
          <InputGroupAddon>
            <Search />
          </InputGroupAddon>
          <InputGroupInput
            id="product-search"
            type="search"
            placeholder="Rechercher un produit"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </InputGroup>
        <NativeSelect aria-label="Section" className="w-full sm:w-auto" value={section} onChange={(e) => setSection(e.target.value)}>
          <NativeSelectOption value="">Toutes les sections</NativeSelectOption>
          {(sections ?? []).map((s) => (
            <NativeSelectOption key={s._id} value={s._id}>
              {s.menuName} — {s.name}
            </NativeSelectOption>
          ))}
        </NativeSelect>
        <NativeSelect
          aria-label="État"
          className="w-full sm:w-auto"
          value={state}
          onChange={(e) => setState(e.target.value as AvailabilityFilter)}
        >
          <NativeSelectOption value="all">Tous</NativeSelectOption>
          <NativeSelectOption value="available">Disponibles</NativeSelectOption>
          <NativeSelectOption value="unavailable">Indisponibles</NativeSelectOption>
          <NativeSelectOption value="archived">Archivés</NativeSelectOption>
        </NativeSelect>
      </div>

      {products === undefined ? (
        <LoadingState>
          <div className="flex flex-col gap-2">
            {[0, 1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-16 w-full rounded-lg" />
            ))}
          </div>
        </LoadingState>
      ) : rows.length === 0 ? (
        <EmptyState
          className="border"
          icon={filtered ? <SearchX /> : <UtensilsCrossed />}
          title={filtered ? "Aucun produit ne correspond" : "Aucun produit"}
          description={
            filtered
              ? "Changez la recherche ou les filtres."
              : sections && sections.length === 0
                ? "Créez d'abord une carte et ses sections, ou importez un tableur depuis l'écran Carte."
                : undefined
          }
          action={
            !filtered && canCreate && sections && sections.length > 0 ? (
              <Button onClick={() => setCreating(true)}>
                <Plus data-icon="inline-start" />
                Ajouter un produit
              </Button>
            ) : undefined
          }
        />
      ) : (
        <ItemGroup className="gap-2">
          {rows.map((p) => (
            <div role="listitem" key={p._id}>
              <Item asChild variant="outline">
                <Link to="/app/menu/products/$productId" params={{ productId: p._id }}>
                  <ItemMedia variant="image" className="size-12">
                    {p.thumbUrl ? (
                      <img src={p.thumbUrl} alt="" width={48} height={48} loading="lazy" />
                    ) : (
                      <span
                        aria-hidden="true"
                        className="flex size-full items-center justify-center bg-muted font-medium text-muted-foreground"
                      >
                        {p.name.slice(0, 1).toUpperCase()}
                      </span>
                    )}
                  </ItemMedia>
                  <ItemContent className="min-w-0">
                    <ItemTitle className="w-full truncate">{p.name}</ItemTitle>
                    <ItemDescription className="truncate">{p.sectionName}</ItemDescription>
                  </ItemContent>
                  <ItemActions>
                    {!p.isActive ? (
                      <Badge variant="outline">Archivé</Badge>
                    ) : !p.isAvailable ? (
                      <Badge variant="destructive">Indisponible</Badge>
                    ) : null}
                    <span className="font-medium tabular-nums">{formatPrice(p.basePrice, p.currency)}</span>
                    <ChevronRight className="size-4 text-muted-foreground" aria-hidden="true" />
                  </ItemActions>
                </Link>
              </Item>
            </div>
          ))}
        </ItemGroup>
      )}
      {venueId && sections ? (
        <CreateProductDialog
          open={creating}
          onOpenChange={setCreating}
          venueId={venueId}
          currency={choices?.currency ?? "XOF"}
          sections={sections.filter((s) => s.isActive)}
        />
      ) : null}
    </>
  );
}

function CreateProductDialog({
  open,
  onOpenChange,
  venueId,
  currency,
  sections,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  venueId: Id<"venues">;
  currency: string;
  sections: { _id: Id<"menuSections">; name: string; menuName: string }[];
}) {
  const create = useMutation(api.products.create);
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [sectionId, setSectionId] = useState("");
  const [price, setPrice] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (price === null) {
      setError("Indiquez un prix, par exemple « 2 500 ».");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const productId = await create({
        venueId,
        menuSectionId: (sectionId || sections[0]!._id) as Id<"menuSections">,
        name,
        basePrice: price,
      });
      onOpenChange(false);
      await navigate({ to: "/app/menu/products/$productId", params: { productId } });
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
            <ResponsiveDialogTitle>Nouveau produit</ResponsiveDialogTitle>
            <ResponsiveDialogDescription>
              Le nom, la section et le prix suffisent. Le reste se complète sur la fiche.
            </ResponsiveDialogDescription>
          </ResponsiveDialogHeader>
          <FieldGroup className="gap-4">
            <FormField label="Nom">
              <Input value={name} onChange={(e) => setName(e.target.value)} maxLength={80} autoFocus />
            </FormField>
            <FormField label="Section">
              <NativeSelect className="w-full" value={sectionId || sections[0]?._id} onChange={(e) => setSectionId(e.target.value)}>
                {sections.map((s) => (
                  <NativeSelectOption key={s._id} value={s._id}>
                    {s.menuName} — {s.name}
                  </NativeSelectOption>
                ))}
              </NativeSelect>
            </FormField>
            <FormField label="Prix" error={error}>
              <PriceInput currency={currency} value={price} onChange={setPrice} />
            </FormField>
          </FieldGroup>
          <ResponsiveDialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)} disabled={busy}>
              Annuler
            </Button>
            <PendingButton type="submit" pending={busy} pendingText="Création…" disabled={!name.trim()}>
              Créer le produit
            </PendingButton>
          </ResponsiveDialogFooter>
        </form>
      </ResponsiveDialogContent>
    </ResponsiveDialog>
  );
}
