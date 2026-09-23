import { useEffect, useId, useRef, useState, type FormEvent } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useAction, useMutation, useQuery } from "convex/react";
import {
  Archive,
  ArchiveRestore,
  ArrowLeft,
  ChevronDown,
  CircleAlert,
  CircleCheck,
  Copy,
  ImagePlus,
  Languages,
  Lock,
  Plus,
  Star,
  Trash2,
} from "lucide-react";
import type { FunctionReturnType } from "convex/server";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import { ALLERGENS } from "../../convex/lib/allergens";
import { FormField } from "~/components/app/form-field";
import { PendingButton } from "~/components/app/pending-button";
import { LoadingState, PermissionDeniedState } from "~/components/app/states";
import { useWorkspace } from "~/components/app/workspace";
import { ConfirmDialog, formatPrice, PriceInput } from "~/components/menu/shared";
import { Alert, AlertDescription } from "~/components/ui/alert";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "~/components/ui/card";
import { Checkbox } from "~/components/ui/checkbox";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "~/components/ui/collapsible";
import { Field, FieldContent, FieldDescription, FieldGroup, FieldLabel, FieldLegend, FieldSet } from "~/components/ui/field";
import { Input } from "~/components/ui/input";
import { Item, ItemActions, ItemContent, ItemGroup } from "~/components/ui/item";
import { Label } from "~/components/ui/label";
import { NativeSelect, NativeSelectOption } from "~/components/ui/native-select";
import { Switch } from "~/components/ui/switch";
import { Textarea } from "~/components/ui/textarea";
import { describeError } from "~/lib/errors";
import { PhotoError, reducePhoto, uploadBlob } from "~/lib/photo";
import { dateIn, endOfDayIn } from "~/lib/zoned";

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
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
      <div className="flex flex-col gap-2">
        <Button asChild variant="ghost" size="sm" className="-ml-2 w-fit">
          <Link to="/app/menu/products">
            <ArrowLeft data-icon="inline-start" />
            Produits
          </Link>
        </Button>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="flex min-w-0 flex-wrap items-center gap-2 text-2xl font-semibold tracking-tight">
            <span className="min-w-0 break-words">{product.name}</span>
            {!product.isActive ? (
              <Badge variant="outline">Archivé</Badge>
            ) : !product.isAvailable ? (
              <Badge variant="destructive">Indisponible</Badge>
            ) : null}
          </h1>
          {product.canEdit ? (
            <div className="flex flex-wrap gap-2">
              <Button
                variant="outline"
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
                <Copy data-icon="inline-start" />
                Dupliquer
              </Button>
              {product.isActive ? (
                <Button variant="destructive" size="sm" onClick={() => setArchiveOpen(true)}>
                  <Archive data-icon="inline-start" />
                  Archiver
                </Button>
              ) : (
                <Button variant="outline" size="sm" onClick={() => void setActive({ venueId, productId: product._id, isActive: true })}>
                  <ArchiveRestore data-icon="inline-start" />
                  Restaurer
                </Button>
              )}
            </div>
          ) : null}
        </div>
      </div>
      {error ? (
        <Alert variant="destructive">
          <CircleAlert />
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

/** Le retour d'un enregistrement, à côté du bouton : confirmé ou refusé, jamais les deux. */
function SaveFeedback({ saved, savedText, error }: { saved: boolean; savedText: string; error: string | null }) {
  return (
    <>
      {saved ? (
        <p role="status" className="flex items-center gap-1.5 text-sm text-muted-foreground">
          <CircleCheck aria-hidden="true" className="size-4 shrink-0" />
          {savedText}
        </p>
      ) : null}
      {error ? (
        <p role="alert" className="flex items-center gap-1.5 text-sm text-destructive">
          <CircleAlert aria-hidden="true" className="size-4 shrink-0" />
          {error}
        </p>
      ) : null}
    </>
  );
}

function DetailsForm({ venueId, product }: { venueId: Id<"venues">; product: Product }) {
  const update = useMutation(api.products.update);
  const choices = useQuery(api.menus.sectionChoices, { venueId });
  const idPrefix = useId();
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
  const [translationOpen, setTranslationOpen] = useState(Boolean(form.nameEn || form.descriptionEn));
  const disabled = !product.canEdit;
  const set = <K extends keyof typeof form>(key: K, value: (typeof form)[K]) => setForm((f) => ({ ...f, [key]: value }));

  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const prep = form.prepMinutes.trim();
      const en = {
        ...(form.nameEn.trim() ? { name: form.nameEn.trim() } : {}),
        ...(form.descriptionEn.trim() ? { description: form.descriptionEn.trim() } : {}),
      };
      await update({
        venueId,
        productId: product._id,
        name: form.name,
        description: form.description,
        i18n: Object.keys(en).length > 0 ? { en } : {},
        menuSectionId: form.menuSectionId as Id<"menuSections">,
        prepMinutes: prep === "" ? null : Number(prep),
        tags: form.tags
          .split(",")
          .map((t) => t.trim())
          .filter(Boolean),
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
            <CardDescription>Ce que le client lit sur la carte.</CardDescription>
          </CardHeader>
          <CardContent>
            <FieldGroup>
              <FormField label="Nom">
                <Input value={form.name} onChange={(e) => set("name", e.target.value)} maxLength={80} />
              </FormField>
              <FormField
                label="Description"
                optional
                description="Ce qui fait choisir le plat : la cuisson, l'accompagnement, la quantité."
              >
                <Textarea value={form.description} onChange={(e) => set("description", e.target.value)} maxLength={500} rows={3} />
              </FormField>
              <div className="grid gap-4 sm:grid-cols-2">
                <FormField label="Section">
                  <NativeSelect className="w-full" value={form.menuSectionId} onChange={(e) => set("menuSectionId", e.target.value)}>
                    {(choices?.sections ?? []).map((s) => (
                      <NativeSelectOption key={s._id} value={s._id}>
                        {s.menuName} — {s.name}
                      </NativeSelectOption>
                    ))}
                    {choices && !choices.sections.some((s) => s._id === form.menuSectionId) ? (
                      <NativeSelectOption value={form.menuSectionId}>Section actuelle</NativeSelectOption>
                    ) : null}
                  </NativeSelect>
                </FormField>
                <FormField label="Temps de préparation (minutes)" optional>
                  <Input
                    type="number"
                    inputMode="numeric"
                    min={0}
                    max={240}
                    value={form.prepMinutes}
                    onChange={(e) => set("prepMinutes", e.target.value)}
                  />
                </FormField>
              </div>
              <Collapsible open={translationOpen} onOpenChange={setTranslationOpen} className="rounded-lg border">
                <CollapsibleTrigger asChild>
                  <Button type="button" variant="ghost" className="w-full justify-between rounded-lg px-3">
                    <span className="flex items-center gap-2">
                      <Languages aria-hidden="true" />
                      Traduction anglaise
                    </span>
                    <ChevronDown
                      aria-hidden="true"
                      className={translationOpen ? "rotate-180 transition-transform" : "transition-transform"}
                    />
                  </Button>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <FieldGroup className="border-t p-3">
                    <FormField label="Nom en anglais" optional description="Vide : le client anglophone lit le nom français.">
                      <Input lang="en" value={form.nameEn} onChange={(e) => set("nameEn", e.target.value)} maxLength={80} />
                    </FormField>
                    <FormField label="Description en anglais" optional>
                      <Textarea
                        lang="en"
                        value={form.descriptionEn}
                        onChange={(e) => set("descriptionEn", e.target.value)}
                        maxLength={500}
                        rows={2}
                      />
                    </FormField>
                  </FieldGroup>
                </CollapsibleContent>
              </Collapsible>
            </FieldGroup>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Allergènes et régimes</CardTitle>
            <CardDescription>Seulement ce que vous savez. Le client voit ce qui est déclaré, jamais une déduction.</CardDescription>
          </CardHeader>
          <CardContent>
            <FieldGroup>
              <FieldSet>
                <FieldLegend variant="label">Allergènes</FieldLegend>
                <FieldGroup data-slot="checkbox-group" className="grid grid-cols-1 gap-3 min-[400px]:grid-cols-2 sm:grid-cols-3">
                  {Object.entries(ALLERGENS).map(([key, labels]) => (
                    <Field key={key} orientation="horizontal">
                      <Checkbox
                        id={`${idPrefix}-allergen-${key}`}
                        checked={form.allergens.includes(key)}
                        onCheckedChange={(checked) =>
                          set("allergens", checked === true ? [...form.allergens, key] : form.allergens.filter((a) => a !== key))
                        }
                      />
                      <FieldLabel htmlFor={`${idPrefix}-allergen-${key}`} className="font-normal">
                        {labels.fr}
                      </FieldLabel>
                    </Field>
                  ))}
                </FieldGroup>
              </FieldSet>
              <FieldSet>
                <FieldLegend variant="label">Régimes</FieldLegend>
                <FieldGroup data-slot="checkbox-group" className="flex flex-row flex-wrap gap-x-6 gap-y-3">
                  {(
                    [
                      ["vegetarian", "Végétarien"],
                      ["vegan", "Végétalien"],
                      ["halal", "Halal"],
                    ] as const
                  ).map(([key, label]) => (
                    <Field key={key} orientation="horizontal" className="w-auto">
                      <Checkbox
                        id={`${idPrefix}-diet-${key}`}
                        checked={form[key]}
                        onCheckedChange={(checked) => set(key, checked === true)}
                      />
                      <FieldLabel htmlFor={`${idPrefix}-diet-${key}`} className="font-normal">
                        {label}
                      </FieldLabel>
                    </Field>
                  ))}
                </FieldGroup>
              </FieldSet>
              <div className="grid gap-4 sm:grid-cols-2">
                <FormField label="Piment">
                  <NativeSelect className="w-full" value={form.spicyLevel} onChange={(e) => set("spicyLevel", Number(e.target.value))}>
                    <NativeSelectOption value={0}>Pas piquant</NativeSelectOption>
                    <NativeSelectOption value={1}>Relevé</NativeSelectOption>
                    <NativeSelectOption value={2}>Piquant</NativeSelectOption>
                    <NativeSelectOption value={3}>Très piquant</NativeSelectOption>
                  </NativeSelect>
                </FormField>
                <FormField label="Étiquettes" optional description="Séparées par des virgules : « maison, nouveau ».">
                  <Input value={form.tags} onChange={(e) => set("tags", e.target.value)} />
                </FormField>
              </div>
            </FieldGroup>
          </CardContent>
        </Card>
      </fieldset>
      {product.canEdit ? (
        <div className="flex flex-wrap items-center gap-3">
          <PendingButton type="submit" pending={busy} pendingText="Enregistrement…">
            Enregistrer
          </PendingButton>
          <SaveFeedback saved={saved} savedText="Enregistré. Visible des clients à la prochaine publication." error={error} />
        </div>
      ) : null}
    </form>
  );
}

function PriceBlock({ venueId, product }: { venueId: Id<"venues">; product: Product }) {
  const setPrice = useMutation(api.products.setPrice);
  const [base, setBase] = useState<number | null>(product.basePrice);
  const [promo, setPromo] = useState<number | null>(product.promoPrice);
  const [promoEnds, setPromoEnds] = useState(product.promoEndsAt === null ? "" : dateIn(product.promoEndsAt, product.timezone));
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useSaved([base, promo, promoEnds]);

  if (!product.canEditPrice) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Lock aria-hidden="true" className="size-4 text-muted-foreground" />
            Prix
          </CardTitle>
          <CardDescription>Changer un prix est un acte financier : il demande un droit à part, que votre rôle n'a pas.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-1">
          <p className="text-2xl font-semibold tabular-nums">{formatPrice(product.basePrice, product.currency)}</p>
          {product.promoPrice !== null ? (
            <p className="text-muted-foreground">
              En promotion à {formatPrice(product.promoPrice, product.currency)}
              {product.promoEndsAt
                ? ` jusqu'au ${new Date(product.promoEndsAt).toLocaleDateString("fr-FR", { timeZone: product.timezone })}`
                : ""}
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
      // La promotion prend fin à la fin du jour choisi, à l'heure de l'ÉTABLISSEMENT.
      const endsAt = promoEnds ? endOfDayIn(promoEnds, product.timezone) : null;
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
      <form onSubmit={submit} noValidate className="contents">
        <CardHeader>
          <CardTitle>Prix</CardTitle>
          <CardDescription>Chaque changement de prix est enregistré : qui, quand, avant, après.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 sm:grid-cols-3">
            <FormField label="Prix">
              <PriceInput currency={product.currency} value={base} onChange={setBase} />
            </FormField>
            <FormField label="Prix promotionnel" optional>
              <PriceInput currency={product.currency} value={promo} onChange={setPromo} />
            </FormField>
            <FormField label="Fin de la promotion" optional>
              <Input type="date" value={promoEnds} onChange={(e) => setPromoEnds(e.target.value)} disabled={promo === null} />
            </FormField>
          </div>
        </CardContent>
        <CardFooter className="flex-wrap gap-3">
          <PendingButton type="submit" variant="outline" pending={busy} pendingText="Enregistrement…">
            Enregistrer le prix
          </PendingButton>
          <SaveFeedback saved={saved} savedText="Prix enregistré. Visible des clients à la prochaine publication." error={error} />
        </CardFooter>
      </form>
    </Card>
  );
}

function Photos({ venueId, product }: { venueId: Id<"venues">; product: Product }) {
  const uploadUrl = useMutation(api.products.generateUploadUrl);
  const addImage = useAction(api.products.addImage);
  const removeImage = useMutation(api.products.removeImage);
  const fileInput = useRef<HTMLInputElement>(null);
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
        <CardDescription>
          Jusqu'à 4. La première est celle de la carte. Elles sont réduites avant l'envoi : une bonne photo de téléphone suffit.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {product.images.length > 0 ? (
          <ul className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {product.images.map((image, index) => (
              <li key={image.storageId} className="relative overflow-hidden rounded-lg border bg-muted">
                {image.url ? <img src={image.url} alt={`Photo ${index + 1}`} className="aspect-[4/3] w-full object-cover" /> : null}
                {index === 0 ? (
                  <Badge variant="secondary" className="absolute bottom-1.5 left-1.5">
                    Sur la carte
                  </Badge>
                ) : null}
                {product.canEdit ? (
                  <Button
                    variant="secondary"
                    size="icon-sm"
                    aria-label={`Retirer la photo ${index + 1}`}
                    className="absolute top-1.5 right-1.5"
                    onClick={() => void removeImage({ venueId, productId: product._id, storageId: image.storageId })}
                  >
                    <Trash2 aria-hidden="true" />
                  </Button>
                ) : null}
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted-foreground">Aucune photo. Sans photo, le plat s'affiche en liste, avec son nom en grand.</p>
        )}
        {product.canEdit && product.images.length < 4 ? (
          <div>
            <PendingButton type="button" variant="outline" pending={busy} pendingText="Envoi…" onClick={() => fileInput.current?.click()}>
              <ImagePlus data-icon="inline-start" />
              Ajouter une photo
            </PendingButton>
            <input
              ref={fileInput}
              type="file"
              accept="image/jpeg,image/png,image/webp,image/heic"
              className="hidden"
              tabIndex={-1}
              aria-hidden="true"
              disabled={busy}
              onChange={(e) => {
                const file = e.target.files?.[0];
                e.target.value = "";
                if (file) void add(file);
              }}
            />
          </div>
        ) : null}
        <SaveFeedback saved={false} savedText="" error={error} />
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
      <CardContent className="flex flex-col gap-4">
        {product.variants.length > 0 ? (
          <ItemGroup className="gap-2">
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
                onAvailable={
                  canToggle
                    ? (available) => run(() => setVariantAvailable({ venueId, variantId: variant._id, isAvailable: available }))
                    : undefined
                }
              />
            ))}
          </ItemGroup>
        ) : (
          <p className="text-sm text-muted-foreground">Aucune variante : le plat a un prix unique.</p>
        )}
        <SaveFeedback saved={false} savedText="" error={error} />
      </CardContent>
      {canAdd ? (
        <CardFooter>
          <form
            noValidate
            className="grid w-full items-end gap-3 sm:grid-cols-[1fr_12rem_auto]"
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
            <FormField label="Nouvelle variante">
              <Input value={name} onChange={(e) => setName(e.target.value)} maxLength={80} placeholder="Grand" />
            </FormField>
            <FormField label="Son prix">
              <PriceInput currency={product.currency} value={price} onChange={setPrice} />
            </FormField>
            <Button type="submit" variant="outline" disabled={!name.trim()}>
              <Plus data-icon="inline-start" />
              Ajouter
            </Button>
          </form>
        </CardFooter>
      ) : null}
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
  const switchId = useId();
  return (
    <Item role="listitem" variant="outline" size="sm">
      <ItemContent className="min-w-0 basis-full flex-row flex-wrap items-center gap-2 sm:basis-0">
        <Input
          aria-label="Nom de la variante"
          value={name}
          disabled={!canEdit}
          onChange={(e) => setName(e.target.value)}
          onBlur={() => name.trim() && name !== variant.name && void onRename(name)}
          className="min-w-0 flex-1 basis-32"
        />
        <div className="w-full min-[400px]:w-40">
          {canEditPrice ? (
            <PriceInput aria-label={`Prix de ${variant.name}`} currency={currency} value={price} onChange={setPrice} />
          ) : (
            <span className="text-sm font-medium tabular-nums">{formatPrice(variant.price, currency)}</span>
          )}
        </div>
        {canEditPrice && price !== null && price !== variant.price ? (
          <Button size="sm" variant="outline" onClick={() => void onPrice(price)}>
            Enregistrer le prix
          </Button>
        ) : null}
      </ItemContent>
      <ItemActions className="flex-wrap">
        {onAvailable ? (
          <div className="flex items-center gap-2">
            <Switch id={switchId} checked={variant.isAvailable} onCheckedChange={(checked) => void onAvailable(checked)} />
            <Label htmlFor={switchId} className="font-normal">
              {variant.isAvailable ? "Disponible" : "Épuisée"}
            </Label>
          </div>
        ) : !variant.isAvailable ? (
          <Badge variant="destructive">Épuisée</Badge>
        ) : null}
        {variant.isDefault ? (
          <Badge variant="secondary">
            <Star data-icon="inline-start" />
            Par défaut
          </Badge>
        ) : canEdit ? (
          <Button
            size="icon-sm"
            variant="ghost"
            aria-label={`Faire de ${variant.name} la variante par défaut`}
            onClick={() => void onDefault()}
          >
            <Star aria-hidden="true" />
          </Button>
        ) : null}
        {canEdit ? (
          <Button size="icon-sm" variant="ghost" aria-label={`Retirer ${variant.name}`} onClick={() => void onRemove()}>
            <Trash2 aria-hidden="true" />
          </Button>
        ) : null}
      </ItemActions>
    </Item>
  );
}

function OptionGroups({ venueId, product }: { venueId: Id<"venues">; product: Product }) {
  const groups = useQuery(api.modifiers.list, { venueId });
  const setGroups = useMutation(api.products.setModifierGroups);
  const idPrefix = useId();
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
          <Link to="/app/menu/options" className="text-foreground underline underline-offset-4">
            Options
          </Link>
          .
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {groups === undefined ? (
          <LoadingState />
        ) : groups.length === 0 ? (
          <p className="text-sm text-muted-foreground">Aucun groupe d'options dans cet établissement.</p>
        ) : (
          <FieldGroup data-slot="checkbox-group" className="gap-3">
            {groups.map((group) => (
              <Field key={group._id} orientation="horizontal">
                <Checkbox
                  id={`${idPrefix}-${group._id}`}
                  disabled={!product.canEdit}
                  checked={selected.includes(group._id)}
                  onCheckedChange={(checked) =>
                    setSelected(checked === true ? [...selected, group._id] : selected.filter((id) => id !== group._id))
                  }
                />
                <FieldContent>
                  <FieldLabel htmlFor={`${idPrefix}-${group._id}`}>{group.name}</FieldLabel>
                  <FieldDescription>
                    {group.isRequired ? "obligatoire" : "facultatif"} · {group.options.map((o) => o.name).join(", ")}
                  </FieldDescription>
                </FieldContent>
              </Field>
            ))}
          </FieldGroup>
        )}
        {product.canEdit && dirty ? (
          <Button
            variant="outline"
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
        <SaveFeedback saved={saved} savedText="Options enregistrées." error={error} />
      </CardContent>
    </Card>
  );
}
