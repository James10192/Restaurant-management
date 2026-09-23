import { useEffect, useState, type FormEvent } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useAction, useMutation, useQuery } from "convex/react";
import { ArrowLeft, Copy, ImagePlus, Lock, Star, Trash2 } from "lucide-react";
import type { FunctionReturnType } from "convex/server";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import { ALLERGENS } from "../../convex/lib/allergens";
import { useWorkspace } from "~/components/app/workspace";
import { ConfirmDialog, formatPrice, PriceInput } from "~/components/menu/shared";
import { Alert, AlertDescription } from "~/components/ui/alert";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "~/components/ui/card";
import { Checkbox } from "~/components/ui/checkbox";
import { Field } from "~/components/ui/field";
import { Input } from "~/components/ui/input";
import { NativeSelect } from "~/components/ui/native-select";
import { LoadingState, PermissionDeniedState } from "~/components/ui/states";
import { Textarea } from "~/components/ui/textarea";
import { describeError } from "~/lib/errors";
import { PhotoError, reducePhoto, uploadBlob } from "~/lib/photo";

export const Route = createFileRoute("/_auth/app/menu/products/$productId")({
  head: () => ({ meta: [{ title: "Produit — Joliba" }] }),
  component: ProductPage,
});

type Product = FunctionReturnType<typeof api.products.get>;

function ProductPage() {
  const { productId } = Route.useParams();
  const w = useWorkspace();
  const venueId = w.venue?._id;
  const allowed = venueId !== undefined && w.canInVenue("menu.read");
  const product = useQuery(api.products.get, allowed ? { venueId, productId: productId as Id<"products"> } : "skip");
  if (!allowed) return <PermissionDeniedState venue={w.venue?.name} permission="Consulter la carte" />;
  if (!product || !venueId) return <LoadingState />;
  return <ProductSheet key={product._id} venueId={venueId} product={product} />;
}

/**
 * La fiche produit, en blocs (IA §4.11). Le prix est un bloc À PART : sans le droit de
 * modifier les prix, il s'affiche en lecture avec la raison — le serveur refuserait de toute
 * façon, mais on ne laisse pas saisir un chiffre pour rien.
 */
function ProductSheet({ venueId, product }: { venueId: Id<"venues">; product: Product }) {
  const navigate = useNavigate();
  const duplicate = useMutation(api.products.duplicate);
  const setActive = useMutation(api.products.setActive);
  const [archiveOpen, setArchiveOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6">
      <div>
        <Link to="/app/menu/products" className="inline-flex min-h-11 items-center gap-1 text-label text-ink-2 hover:text-ink">
          <ArrowLeft aria-hidden="true" className="size-4" />
          Produits
        </Link>
        <div className="mt-1 flex flex-wrap items-center justify-between gap-3">
          <h1 className="flex flex-wrap items-center gap-2 text-title-xl text-ink">
            {product.name}
            {!product.isActive ? <Badge>Archivé</Badge> : !product.isAvailable ? <Badge variant="warning">Indisponible</Badge> : null}
          </h1>
          {product.canEdit ? (
            <div className="flex flex-wrap gap-2">
              <Button
                variant="secondary"
                size="sm"
                onClick={async () => {
                  setError(null);
                  try {
                    const id = await duplicate({ venueId, productId: product._id });
                    await navigate({ to: "/app/menu/products/$productId", params: { productId: id } });
                  } catch (e) {
                    setError(describeError(e).message);
                  }
                }}
              >
                <Copy aria-hidden="true" />
                Dupliquer
              </Button>
              {product.isActive ? (
                <Button variant="danger" size="sm" onClick={() => setArchiveOpen(true)}>
                  Archiver
                </Button>
              ) : (
                <Button variant="secondary" size="sm" onClick={() => void setActive({ venueId, productId: product._id, isActive: true })}>
                  Restaurer
                </Button>
              )}
            </div>
          ) : null}
        </div>
      </div>
      {error ? (
        <Alert variant="danger">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}

      <DetailsForm venueId={venueId} product={product} />
      <PriceBlock venueId={venueId} product={product} />
      <Photos venueId={venueId} product={product} />
      <Variants venueId={venueId} product={product} />
      <OptionGroups venueId={venueId} product={product} />

      <ConfirmDialog
        open={archiveOpen}
        onOpenChange={setArchiveOpen}
        danger
        title={`Archiver « ${product.name} » ?`}
        description="Il quitte la carte à la prochaine publication. Rien n'est effacé : vous pourrez le restaurer."
        confirmLabel="Archiver"
        onConfirm={async () => {
          await setActive({ venueId, productId: product._id, isActive: false });
        }}
      />
    </div>
  );
}

function useSaved(deps: unknown[]) {
  const [saved, setSaved] = useState(false);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => setSaved(false), deps);
  return [saved, setSaved] as const;
}

function DetailsForm({ venueId, product }: { venueId: Id<"venues">; product: Product }) {
  const update = useMutation(api.products.update);
  const choices = useQuery(api.menus.sectionChoices, { venueId });
  const [form, setForm] = useState({
    name: product.name,
    description: product.description ?? "",
    nameEn: product.i18n?.en?.name ?? "",
    descriptionEn: product.i18n?.en?.description ?? "",
    menuSectionId: product.menuSectionId as string,
    prepMinutes: product.prepMinutes === null ? "" : String(product.prepMinutes),
    tags: product.tags.join(", "),
    allergens: product.allergens,
    vegetarian: product.dietary.vegetarian ?? false,
    vegan: product.dietary.vegan ?? false,
    halal: product.dietary.halal ?? false,
    spicyLevel: product.dietary.spicyLevel ?? 0,
  });
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useSaved([form]);
  const disabled = !product.canEdit;
  const set = <K extends keyof typeof form>(key: K, value: (typeof form)[K]) => setForm((f) => ({ ...f, [key]: value }));

  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const prep = form.prepMinutes.trim();
      const en = { ...(form.nameEn.trim() ? { name: form.nameEn.trim() } : {}), ...(form.descriptionEn.trim() ? { description: form.descriptionEn.trim() } : {}) };
      await update({
        venueId,
        productId: product._id,
        name: form.name,
        description: form.description,
        i18n: Object.keys(en).length > 0 ? { en } : {},
        menuSectionId: form.menuSectionId as Id<"menuSections">,
        prepMinutes: prep === "" ? null : Number(prep),
        tags: form.tags.split(",").map((t) => t.trim()).filter(Boolean),
        allergens: form.allergens,
        dietary: { vegetarian: form.vegetarian || form.vegan, vegan: form.vegan, halal: form.halal, spicyLevel: form.spicyLevel },
      });
      setSaved(true);
    } catch (e) {
      setError(describeError(e).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} noValidate className="flex flex-col gap-6">
      <fieldset disabled={disabled} className="contents">
        <Card>
          <CardHeader>
            <CardTitle>Identité</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-4 pb-5">
            <Field label="Nom">
              <Input value={form.name} onChange={(e) => set("name", e.target.value)} maxLength={80} />
            </Field>
            <Field label="Description" optional description="Ce qui fait choisir le plat : la cuisson, l'accompagnement, la quantité.">
              <Textarea value={form.description} onChange={(e) => set("description", e.target.value)} maxLength={500} rows={3} />
            </Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Section">
                <NativeSelect value={form.menuSectionId} onChange={(e) => set("menuSectionId", e.target.value)}>
                  {(choices?.sections ?? []).map((s) => (
                    <option key={s._id} value={s._id}>
                      {s.menuName} — {s.name}
                    </option>
                  ))}
                  {choices && !choices.sections.some((s) => s._id === form.menuSectionId) ? <option value={form.menuSectionId}>Section actuelle</option> : null}
                </NativeSelect>
              </Field>
              <Field label="Temps de préparation (minutes)" optional>
                <Input type="number" inputMode="numeric" min={0} max={240} value={form.prepMinutes} onChange={(e) => set("prepMinutes", e.target.value)} />
              </Field>
            </div>
            <details className="rounded-sm border border-line px-4 py-3" open={Boolean(form.nameEn || form.descriptionEn)}>
              <summary className="min-h-11 cursor-pointer content-center text-label text-ink">Traduction anglaise</summary>
              <div className="mt-3 flex flex-col gap-4">
                <Field label="Nom en anglais" optional description="Vide : le client anglophone lit le nom français.">
                  <Input lang="en" value={form.nameEn} onChange={(e) => set("nameEn", e.target.value)} maxLength={80} />
                </Field>
                <Field label="Description en anglais" optional>
                  <Textarea lang="en" value={form.descriptionEn} onChange={(e) => set("descriptionEn", e.target.value)} maxLength={500} rows={2} />
                </Field>
              </div>
            </details>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Allergènes et régimes</CardTitle>
            <CardDescription>Seulement ce que vous savez. Le client voit ce qui est déclaré, jamais une déduction.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-5 pb-5">
            <fieldset>
              <legend className="mb-2 text-label text-ink">Allergènes</legend>
              <div className="grid grid-cols-2 gap-x-4 sm:grid-cols-3">
                {Object.entries(ALLERGENS).map(([key, labels]) => (
                  <label key={key} className="flex min-h-11 items-center gap-2 text-body text-ink">
                    <Checkbox
                      checked={form.allergens.includes(key)}
                      onCheckedChange={(checked) =>
                        set("allergens", checked === true ? [...form.allergens, key] : form.allergens.filter((a) => a !== key))
                      }
                    />
                    {labels.fr}
                  </label>
                ))}
              </div>
            </fieldset>
            <fieldset>
              <legend className="mb-2 text-label text-ink">Régimes</legend>
              <div className="flex flex-wrap gap-x-6">
                {(
                  [
                    ["vegetarian", "Végétarien"],
                    ["vegan", "Végétalien"],
                    ["halal", "Halal"],
                  ] as const
                ).map(([key, label]) => (
                  <label key={key} className="flex min-h-11 items-center gap-2 text-body text-ink">
                    <Checkbox checked={form[key]} onCheckedChange={(checked) => set(key, checked === true)} />
                    {label}
                  </label>
                ))}
              </div>
            </fieldset>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Piment">
                <NativeSelect value={form.spicyLevel} onChange={(e) => set("spicyLevel", Number(e.target.value))}>
                  <option value={0}>Pas piquant</option>
                  <option value={1}>Relevé</option>
                  <option value={2}>Piquant</option>
                  <option value={3}>Très piquant</option>
                </NativeSelect>
              </Field>
              <Field label="Étiquettes" optional description="Séparées par des virgules : « maison, nouveau ».">
                <Input value={form.tags} onChange={(e) => set("tags", e.target.value)} />
              </Field>
            </div>
          </CardContent>
        </Card>
      </fieldset>
      {product.canEdit ? (
        <div className="flex flex-wrap items-center gap-3">
          <Button type="submit" loading={busy} loadingText="Enregistrement…">
            Enregistrer
          </Button>
          {saved ? (
            <span role="status" className="text-label text-success-700">
              Enregistré. Visible des clients à la prochaine publication.
            </span>
          ) : null}
          {error ? (
            <span role="alert" className="text-label text-danger-700">
              {error}
            </span>
          ) : null}
        </div>
      ) : null}
    </form>
  );
}

function toDateInput(ms: number | null): string {
  if (ms === null) return "";
  const d = new Date(ms);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function PriceBlock({ venueId, product }: { venueId: Id<"venues">; product: Product }) {
  const setPrice = useMutation(api.products.setPrice);
  const [base, setBase] = useState<number | null>(product.basePrice);
  const [promo, setPromo] = useState<number | null>(product.promoPrice);
  const [promoEnds, setPromoEnds] = useState(toDateInput(product.promoEndsAt));
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useSaved([base, promo, promoEnds]);

  if (!product.canEditPrice) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Lock aria-hidden="true" className="size-4 text-ink-3" />
            Prix
          </CardTitle>
          <CardDescription>Changer un prix est un acte financier : il demande un droit à part, que votre rôle n'a pas.</CardDescription>
        </CardHeader>
        <CardContent className="pb-5">
          <p className="text-title-md text-ink tabular-nums">{formatPrice(product.basePrice, product.currency)}</p>
          {product.promoPrice !== null ? (
            <p className="text-body text-ink-2">
              En promotion à {formatPrice(product.promoPrice, product.currency)}
              {product.promoEndsAt ? ` jusqu'au ${new Date(product.promoEndsAt).toLocaleDateString("fr-FR")}` : ""}
            </p>
          ) : null}
        </CardContent>
      </Card>
    );
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (base === null) {
      setError("Indiquez un prix, par exemple « 2 500 ».");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      // La promotion prend fin à la fin du jour choisi, à l'heure de l'appareil.
      const endsAt = promoEnds ? new Date(`${promoEnds}T23:59:59`).getTime() : null;
      await setPrice({ venueId, productId: product._id, basePrice: base, promoPrice: promo, promoEndsAt: promo === null ? null : endsAt });
      setSaved(true);
    } catch (e) {
      setError(describeError(e).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card>
      <form onSubmit={submit} noValidate>
        <CardHeader>
          <CardTitle>Prix</CardTitle>
          <CardDescription>Chaque changement de prix est enregistré : qui, quand, avant, après.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4 pb-5">
          <div className="grid gap-4 sm:grid-cols-3">
            <Field label="Prix">
              <PriceInput currency={product.currency} value={base} onChange={setBase} />
            </Field>
            <Field label="Prix promotionnel" optional>
              <PriceInput currency={product.currency} value={promo} onChange={setPromo} />
            </Field>
            <Field label="Fin de la promotion" optional>
              <Input type="date" value={promoEnds} onChange={(e) => setPromoEnds(e.target.value)} disabled={promo === null} />
            </Field>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <Button type="submit" variant="secondary" loading={busy} loadingText="Enregistrement…">
              Enregistrer le prix
            </Button>
            {saved ? (
              <span role="status" className="text-label text-success-700">
                Prix enregistré. Visible des clients à la prochaine publication.
              </span>
            ) : null}
            {error ? (
              <span role="alert" className="text-label text-danger-700">
                {error}
              </span>
            ) : null}
          </div>
        </CardContent>
      </form>
    </Card>
  );
}

function Photos({ venueId, product }: { venueId: Id<"venues">; product: Product }) {
  const uploadUrl = useMutation(api.products.generateUploadUrl);
  const addImage = useAction(api.products.addImage);
  const removeImage = useMutation(api.products.removeImage);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function add(file: File) {
    setBusy(true);
    setError(null);
    try {
      const photo = await reducePhoto(file);
      const [fullUrl, thumbUrl] = [await uploadUrl({ venueId }), await uploadUrl({ venueId })];
      const [storageId, thumbStorageId] = await Promise.all([uploadBlob(fullUrl, photo.full), uploadBlob(thumbUrl, photo.thumb)]);
      const result = await addImage({
        venueId,
        productId: product._id,
        storageId: storageId as Id<"_storage">,
        thumbStorageId: thumbStorageId as Id<"_storage">,
        width: photo.width,
        height: photo.height,
      });
      if (!result.ok) setError(result.message);
    } catch (e) {
      setError(e instanceof PhotoError ? e.message : describeError(e).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Photos</CardTitle>
        <CardDescription>Jusqu'à 4. La première est celle de la carte. Elles sont réduites avant l'envoi : une bonne photo de téléphone suffit.</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4 pb-5">
        {product.images.length > 0 ? (
          <ul className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {product.images.map((image, index) => (
              <li key={image.storageId} className="relative">
                {image.url ? <img src={image.url} alt={`Photo ${index + 1}`} className="aspect-[4/3] w-full rounded-sm object-cover" /> : null}
                {product.canEdit ? (
                  <Button
                    variant="secondary"
                    size="icon"
                    aria-label={`Retirer la photo ${index + 1}`}
                    className="absolute top-1 right-1"
                    onClick={() => void removeImage({ venueId, productId: product._id, storageId: image.storageId })}
                  >
                    <Trash2 aria-hidden="true" />
                  </Button>
                ) : null}
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-body text-ink-2">Aucune photo. Sans photo, le plat s'affiche en liste, avec son nom en grand.</p>
        )}
        {product.canEdit && product.images.length < 4 ? (
          <label className="inline-flex min-h-11 w-fit cursor-pointer items-center gap-2 rounded-sm border border-line-control bg-surface px-4 text-label text-ink hover:bg-surface-2 has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-accent-600">
            <ImagePlus aria-hidden="true" className="size-5" />
            {busy ? "Envoi…" : "Ajouter une photo"}
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp,image/heic"
              className="sr-only"
              disabled={busy}
              onChange={(e) => {
                const file = e.target.files?.[0];
                e.target.value = "";
                if (file) void add(file);
              }}
            />
          </label>
        ) : null}
        {error ? (
          <p role="alert" className="text-label text-danger-700">
            {error}
          </p>
        ) : null}
      </CardContent>
    </Card>
  );
}

function Variants({ venueId, product }: { venueId: Id<"venues">; product: Product }) {
  const addVariant = useMutation(api.products.addVariant);
  const updateVariant = useMutation(api.products.updateVariant);
  const setVariantPrice = useMutation(api.products.setVariantPrice);
  const removeVariant = useMutation(api.products.removeVariant);
  const setVariantAvailable = useMutation(api.availability.setVariant);
  const canToggle = useWorkspace().canInVenue("menu.availability.toggle");
  const [name, setName] = useState("");
  const [price, setPrice] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const canAdd = product.canEdit && product.canEditPrice;

  async function run(action: () => Promise<unknown>) {
    setError(null);
    try {
      await action();
    } catch (e) {
      setError(describeError(e).message);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Variantes</CardTitle>
        <CardDescription>Des tailles ou des formats, chacun avec son prix : « 33 cl », « 1 L ».</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4 pb-5">
        {product.variants.length > 0 ? (
          <ul className="divide-y divide-line rounded-sm border border-line">
            {product.variants.map((variant) => (
              <VariantRow
                key={variant._id}
                variant={variant}
                currency={product.currency}
                canEdit={product.canEdit}
                canEditPrice={product.canEditPrice}
                onRename={(value) => run(() => updateVariant({ venueId, variantId: variant._id, name: value }))}
                onPrice={(value) => run(() => setVariantPrice({ venueId, variantId: variant._id, price: value }))}
                onDefault={() => run(() => updateVariant({ venueId, variantId: variant._id, isDefault: true }))}
                onRemove={() => run(() => removeVariant({ venueId, variantId: variant._id }))}
                onAvailable={canToggle ? (available) => run(() => setVariantAvailable({ venueId, variantId: variant._id, isAvailable: available })) : undefined}
              />
            ))}
          </ul>
        ) : (
          <p className="text-body text-ink-2">Aucune variante : le plat a un prix unique.</p>
        )}
        {canAdd ? (
          <form
            noValidate
            className="grid items-end gap-3 sm:grid-cols-[1fr_12rem_auto]"
            onSubmit={(e) => {
              e.preventDefault();
              if (price === null) {
                setError("Indiquez le prix de la variante.");
                return;
              }
              void run(async () => {
                await addVariant({ venueId, productId: product._id, name, price });
                setName("");
                setPrice(null);
              });
            }}
          >
            <Field label="Nouvelle variante">
              <Input value={name} onChange={(e) => setName(e.target.value)} maxLength={80} placeholder="Grand" />
            </Field>
            <Field label="Son prix">
              <PriceInput currency={product.currency} value={price} onChange={setPrice} />
            </Field>
            <Button type="submit" variant="secondary" disabled={!name.trim()}>
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
    </Card>
  );
}

function VariantRow({
  variant,
  currency,
  canEdit,
  canEditPrice,
  onRename,
  onPrice,
  onDefault,
  onRemove,
  onAvailable,
}: {
  variant: Product["variants"][number];
  currency: string;
  canEdit: boolean;
  canEditPrice: boolean;
  onRename: (name: string) => Promise<void>;
  onPrice: (price: number) => Promise<void>;
  onDefault: () => Promise<void>;
  onRemove: () => Promise<void>;
  onAvailable?: (available: boolean) => Promise<void>;
}) {
  const [name, setName] = useState(variant.name);
  const [price, setPrice] = useState<number | null>(variant.price);
  return (
    <li className="flex flex-wrap items-center gap-3 px-3 py-2">
      <Input aria-label="Nom de la variante" value={name} disabled={!canEdit} onChange={(e) => setName(e.target.value)} onBlur={() => name.trim() && name !== variant.name && void onRename(name)} className="min-w-0 flex-1" />
      <div className="w-40">
        {canEditPrice ? (
          <PriceInput
            aria-label={`Prix de ${variant.name}`}
            currency={currency}
            value={price}
            onChange={setPrice}
          />
        ) : (
          <span className="text-body text-ink tabular-nums">{formatPrice(variant.price, currency)}</span>
        )}
      </div>
      {canEditPrice && price !== null && price !== variant.price ? (
        <Button size="sm" variant="secondary" onClick={() => void onPrice(price)}>
          Enregistrer le prix
        </Button>
      ) : null}
      {onAvailable ? (
        <Button size="sm" variant={variant.isAvailable ? "quiet" : "secondary"} aria-pressed={!variant.isAvailable} onClick={() => void onAvailable(!variant.isAvailable)}>
          {variant.isAvailable ? "Disponible" : "Épuisée"}
        </Button>
      ) : !variant.isAvailable ? (
        <Badge variant="warning">Épuisée</Badge>
      ) : null}
      {variant.isDefault ? (
        <Badge variant="accent" glyph={false}>
          Par défaut
        </Badge>
      ) : canEdit ? (
        <Button size="icon" variant="quiet" aria-label={`Faire de ${variant.name} la variante par défaut`} onClick={() => void onDefault()}>
          <Star aria-hidden="true" />
        </Button>
      ) : null}
      {canEdit ? (
        <Button size="icon" variant="quiet" aria-label={`Retirer ${variant.name}`} onClick={() => void onRemove()}>
          <Trash2 aria-hidden="true" />
        </Button>
      ) : null}
    </li>
  );
}

function OptionGroups({ venueId, product }: { venueId: Id<"venues">; product: Product }) {
  const groups = useQuery(api.modifiers.list, { venueId });
  const setGroups = useMutation(api.products.setModifierGroups);
  const [selected, setSelected] = useState<string[]>(product.modifierGroups.map((g) => g._id));
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useSaved([selected]);
  const dirty = selected.join() !== product.modifierGroups.map((g) => g._id).join();

  return (
    <Card>
      <CardHeader>
        <CardTitle>Options</CardTitle>
        <CardDescription>
          Les groupes réutilisables (« Cuisson », « Accompagnement ») se préparent dans{" "}
          <Link to="/app/menu/options" className="text-accent-700 underline underline-offset-4">
            Options
          </Link>
          .
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3 pb-5">
        {groups === undefined ? (
          <LoadingState />
        ) : groups.length === 0 ? (
          <p className="text-body text-ink-2">Aucun groupe d'options dans cet établissement.</p>
        ) : (
          <div className="flex flex-col">
            {groups.map((group) => (
              <label key={group._id} className="flex min-h-11 items-center gap-2 text-body text-ink">
                <Checkbox
                  disabled={!product.canEdit}
                  checked={selected.includes(group._id)}
                  onCheckedChange={(checked) =>
                    setSelected(checked === true ? [...selected, group._id] : selected.filter((id) => id !== group._id))
                  }
                />
                {group.name}
                <span className="text-label text-ink-3">
                  {group.isRequired ? "obligatoire" : "facultatif"} · {group.options.map((o) => o.name).join(", ")}
                </span>
              </label>
            ))}
          </div>
        )}
        {product.canEdit && dirty ? (
          <Button
            variant="secondary"
            className="self-start"
            onClick={async () => {
              setError(null);
              try {
                await setGroups({ venueId, productId: product._id, modifierGroupIds: selected as Id<"modifierGroups">[] });
                setSaved(true);
              } catch (e) {
                setError(describeError(e).message);
              }
            }}
          >
            Enregistrer les options
          </Button>
        ) : null}
        {saved ? (
          <span role="status" className="text-label text-success-700">
            Options enregistrées.
          </span>
        ) : null}
        {error ? (
          <p role="alert" className="text-label text-danger-700">
            {error}
          </p>
        ) : null}
      </CardContent>
    </Card>
  );
}
