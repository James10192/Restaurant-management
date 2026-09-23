import { useDeferredValue, useState, type FormEvent } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery } from "convex/react";
import { Plus } from "lucide-react";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import { useWorkspace } from "~/components/app/workspace";
import { formatPrice, PageHeader, PriceInput } from "~/components/menu/shared";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { Card } from "~/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "~/components/ui/dialog";
import { Field } from "~/components/ui/field";
import { Input } from "~/components/ui/input";
import { NativeSelect } from "~/components/ui/native-select";
import { EmptyState, LoadingState, PermissionDeniedState } from "~/components/ui/states";
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

  return (
    <>
      <PageHeader
        title="Produits"
        actions={
          canCreate ? (
            <Button onClick={() => setCreating(true)} disabled={!sections || sections.length === 0}>
              <Plus aria-hidden="true" />
              Ajouter un produit
            </Button>
          ) : null
        }
      />
      <div className="mb-4 grid gap-3 sm:grid-cols-[1fr_auto_auto]">
        <label className="sr-only" htmlFor="product-search">
          Rechercher un produit
        </label>
        <Input id="product-search" type="search" placeholder="Rechercher un produit" value={search} onChange={(e) => setSearch(e.target.value)} />
        <NativeSelect aria-label="Section" value={section} onChange={(e) => setSection(e.target.value)}>
          <option value="">Toutes les sections</option>
          {(sections ?? []).map((s) => (
            <option key={s._id} value={s._id}>
              {s.menuName} — {s.name}
            </option>
          ))}
        </NativeSelect>
        <NativeSelect aria-label="État" value={state} onChange={(e) => setState(e.target.value as AvailabilityFilter)}>
          <option value="all">Tous</option>
          <option value="available">Disponibles</option>
          <option value="unavailable">Indisponibles</option>
          <option value="archived">Archivés</option>
        </NativeSelect>
      </div>

      {products === undefined ? (
        <LoadingState />
      ) : rows.length === 0 ? (
        <EmptyState
          title={search || section || state !== "all" ? "Aucun produit ne correspond" : "Aucun produit"}
          description={
            search || section || state !== "all"
              ? "Changez la recherche ou les filtres."
              : sections && sections.length === 0
                ? "Créez d'abord une carte et ses sections, ou importez un tableur depuis l'écran Carte."
                : undefined
          }
          action={
            !search && !section && state === "all" && canCreate && sections && sections.length > 0 ? (
              <Button onClick={() => setCreating(true)}>Ajouter un produit</Button>
            ) : undefined
          }
        />
      ) : (
        <Card>
          <ul className="divide-y divide-line">
            {rows.map((p) => (
              <li key={p._id}>
                <Link
                  to="/app/menu/products/$productId"
                  params={{ productId: p._id }}
                  className="flex min-h-16 items-center gap-3 px-4 py-2 hover:bg-surface-2"
                >
                  {p.thumbUrl ? (
                    <img src={p.thumbUrl} alt="" width={48} height={48} loading="lazy" className="size-12 shrink-0 rounded-sm object-cover" />
                  ) : (
                    <span aria-hidden="true" className="flex size-12 shrink-0 items-center justify-center rounded-sm bg-surface-2 text-title-md text-ink-4">
                      {p.name.slice(0, 1).toUpperCase()}
                    </span>
                  )}
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-body text-ink">{p.name}</span>
                    <span className="block truncate text-label text-ink-3">{p.sectionName}</span>
                  </span>
                  {!p.isActive ? (
                    <Badge>Archivé</Badge>
                  ) : !p.isAvailable ? (
                    <Badge variant="warning">Indisponible</Badge>
                  ) : null}
                  <span className="shrink-0 text-body text-ink tabular-nums">{formatPrice(p.basePrice, p.currency)}</span>
                </Link>
              </li>
            ))}
          </ul>
        </Card>
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
    <Dialog open={open} onOpenChange={(o) => !busy && onOpenChange(o)}>
      <DialogContent>
        <form onSubmit={submit} noValidate>
          <DialogHeader>
            <DialogTitle>Nouveau produit</DialogTitle>
            <DialogDescription>Le nom, la section et le prix suffisent. Le reste se complète sur la fiche.</DialogDescription>
          </DialogHeader>
          <div className="mt-4 flex flex-col gap-4">
            <Field label="Nom">
              <Input value={name} onChange={(e) => setName(e.target.value)} maxLength={80} autoFocus />
            </Field>
            <Field label="Section">
              <NativeSelect value={sectionId || sections[0]?._id} onChange={(e) => setSectionId(e.target.value)}>
                {sections.map((s) => (
                  <option key={s._id} value={s._id}>
                    {s.menuName} — {s.name}
                  </option>
                ))}
              </NativeSelect>
            </Field>
            <Field label="Prix" error={error}>
              <PriceInput currency={currency} value={price} onChange={setPrice} />
            </Field>
          </div>
          <DialogFooter>
            <Button type="button" variant="quiet" onClick={() => onOpenChange(false)} disabled={busy}>
              Annuler
            </Button>
            <Button type="submit" loading={busy} loadingText="Création…" disabled={!name.trim()}>
              Créer le produit
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
