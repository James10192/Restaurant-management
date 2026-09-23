import { useEffect, useMemo, useState } from "react";
import { useQuery } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import { Minus, Plus, Search, Send, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { api } from "../../../convex/_generated/api";
import { availabilityIndex } from "../../../convex/lib/availabilityIndex";
import type { GuestMenu } from "../../../convex/lib/guestMenu";
import { indexPublishedProducts, ORDER_LIMITS, priceLine, type LineRequest, type PricedLine } from "../../../convex/lib/ordering";
import { LoadingState } from "~/components/app/states";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { ButtonGroup, ButtonGroupText } from "~/components/ui/button-group";
import { Checkbox } from "~/components/ui/checkbox";
import { Field, FieldContent, FieldDescription, FieldLabel, FieldLegend, FieldSet, FieldTitle } from "~/components/ui/field";
import { Input } from "~/components/ui/input";
import { InputGroup, InputGroupAddon, InputGroupInput } from "~/components/ui/input-group";
import { Item, ItemActions, ItemContent, ItemDescription, ItemGroup, ItemTitle } from "~/components/ui/item";
import { RadioGroup, RadioGroupItem } from "~/components/ui/radio-group";
import { ScrollArea, ScrollBar } from "~/components/ui/scroll-area";
import { Separator } from "~/components/ui/separator";
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from "~/components/ui/sheet";
import { Switch } from "~/components/ui/switch";
import { Textarea } from "~/components/ui/textarea";
import { ToggleGroup, ToggleGroupItem } from "~/components/ui/toggle-group";
import {
  ResponsiveDialog,
  ResponsiveDialogContent,
  ResponsiveDialogDescription,
  ResponsiveDialogFooter,
  ResponsiveDialogHeader,
  ResponsiveDialogTitle,
} from "~/components/app/responsive-dialog";
import { useIsMobile } from "~/hooks/use-mobile";
import { cn } from "~/lib/utils";
import { useMoney, useServiceScope } from "./service-scope";
import { useMinuteClock } from "./time";

type Product = GuestMenu["sections"][number]["products"][number];

/** Une ligne en cours de saisie. La clé sert à l'écran ; le prix affiché est une estimation, le serveur rechiffre. */
export type DraftLine = { key: string; request: LineRequest };

export type Draft = { lines: DraftLine[]; notes: string; held: number[] };
export const EMPTY_DRAFT: Draft = { lines: [], notes: "", held: [] };

const COURSES = [1, 2, 3, 4] as const;

type OrderMenu = FunctionReturnType<typeof api.orders.menu>;
const menuKey = (venueId: string) => `joliba.carte-service.${venueId}`;

/**
 * La carte à commander, gardée sur l'appareil : sans réseau, le serveur saisit encore (D-062).
 * La disponibilité gardée peut dater ; le serveur tranche à l'envoi, ligne par ligne.
 * Appelé aussi par le tableau de salle, pour que la carte soit déjà là quand le réseau tombe.
 */
export function useOrderMenu(): OrderMenu | undefined {
  const scope = useServiceScope();
  const live = useQuery(api.orders.menu, scope.can("order.create") ? { venueId: scope.venueId } : "skip");
  const [cached, setCached] = useState<OrderMenu | undefined>(undefined);
  useEffect(() => {
    try {
      const raw = localStorage.getItem(menuKey(scope.venueId));
      if (raw) setCached(JSON.parse(raw) as OrderMenu);
    } catch {
      /* pas de carte gardée */
    }
  }, [scope.venueId]);
  useEffect(() => {
    if (!live) return;
    try {
      localStorage.setItem(menuKey(scope.venueId), JSON.stringify(live));
    } catch {
      /* stockage plein : la carte vivante suffit tant que le réseau tient */
    }
  }, [live, scope.venueId]);
  return live ?? cached;
}

/** Sans accents ni majuscules : « poulet brai » trouve « Poulet braisé ». */
function normalize(text: string) {
  return text.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();
}

function sameRequest(a: LineRequest, b: LineRequest) {
  return (
    a.productId === b.productId &&
    a.variantId === b.variantId &&
    a.courseNumber === b.courseNumber &&
    (a.instructions ?? "") === (b.instructions ?? "") &&
    [...a.optionIds].sort().join() === [...b.optionIds].sort().join()
  );
}

/**
 * La saisie d'une commande par le serveur. Objectif mesuré (D-061) : six articles pas plus
 * lentement qu'au carnet. D'où : la recherche dès deux lettres, un appui par plat simple, le
 * choix des options seulement quand il existe, et le service courant appliqué d'office.
 */
export function OrderComposer({
  open,
  onOpenChange,
  tableNumber,
  draft,
  onDraftChange,
  onSend,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tableNumber: string;
  draft: Draft;
  onDraftChange: (draft: Draft) => void;
  onSend: (draft: Draft, estimate: number) => Promise<void>;
}) {
  const scope = useServiceScope();
  const money = useMoney();
  const isMobile = useIsMobile();
  const data = useOrderMenu();
  const now = useMinuteClock(60_000);
  const [query, setQuery] = useState("");
  const [sectionKey, setSectionKey] = useState<string | null>(null);
  const [course, setCourse] = useState(1);
  const [choosing, setChoosing] = useState<{ product: Product } | null>(null);
  const [step, setStep] = useState<"menu" | "review">("menu");

  const view = useMemo(() => {
    if (!data) return null;
    const published = indexPublishedProducts(data.menus);
    const availability = availabilityIndex(data.live, now, data.timezone);
    const sections = data.menus
      .filter((m) => availability.menuActive(m))
      .flatMap((menu) => menu.sections.filter((s) => s.products.length > 0).map((section) => ({ key: `${menu.menu.id}:${section.id}`, label: section.name, menu, section })));
    const price = (request: LineRequest, index = 0) => priceLine(request, index, published, data.live, now, data.timezone);
    return { published, availability, sections, price };
  }, [data, now]);

  const priced = useMemo(() => {
    if (!view) return [];
    return draft.lines.map((l, i) => ({ line: l, result: view.price(l.request, i) }));
  }, [view, draft.lines]);
  const estimate = priced.reduce((s, p) => s + ("line" in p.result ? p.result.line.lineTotal : 0), 0);
  const count = draft.lines.reduce((s, l) => s + l.request.quantity, 0);
  const problems = priced.flatMap((p) => ("problem" in p.result ? [p.result.problem] : []));
  const coursesUsed = [...new Set(draft.lines.map((l) => l.request.courseNumber))].sort();

  function setLines(lines: DraftLine[]) {
    const used = new Set(lines.map((l) => l.request.courseNumber));
    onDraftChange({ ...draft, lines, held: draft.held.filter((c) => used.has(c)) });
  }

  function add(request: LineRequest) {
    const existing = draft.lines.find((l) => sameRequest(l.request, { ...request, quantity: l.request.quantity }));
    const lines = existing
      ? draft.lines.map((l) => (l === existing ? { ...l, request: { ...l.request, quantity: Math.min(ORDER_LIMITS.quantity, l.request.quantity + request.quantity) } } : l))
      : [...draft.lines, { key: crypto.randomUUID(), request }];
    // Un service au-delà du premier attend par défaut l'appel du serveur (« envoyez la suite »).
    const held = request.courseNumber > 1 && !draft.lines.some((l) => l.request.courseNumber === request.courseNumber) ? [...new Set([...draft.held, request.courseNumber])] : draft.held;
    onDraftChange({ ...draft, lines, held });
  }

  function tap(product: Product, menu: GuestMenu, sectionId: string) {
    if (!view) return;
    if (view.availability.product(menu, sectionId, product.id) !== null) {
      toast.error(`${product.name} n'est pas disponible en ce moment.`);
      return;
    }
    if (product.variants.length > 1 || product.modifierGroups.length > 0) {
      setChoosing({ product });
      return;
    }
    add({ productId: product.id, optionIds: [], quantity: 1, courseNumber: course });
    toast.success(`${product.name} ajouté`, { duration: 1200 });
  }

  const search = normalize(query.trim());
  const shown = !view
    ? []
    : search.length >= 2
      ? view.sections.flatMap((s) => s.section.products.filter((p) => normalize(p.name).includes(search)).map((p) => ({ product: p, section: s })))
      : (view.sections.find((s) => s.key === sectionKey) ?? view.sections[0])?.section.products.map((p) => ({ product: p, section: (view.sections.find((s) => s.key === sectionKey) ?? view.sections[0])! })) ?? [];
  const activeKey = sectionKey ?? view?.sections[0]?.key ?? null;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side={isMobile ? "bottom" : "right"} className={cn("flex flex-col gap-0 p-0", isMobile ? "data-[side=bottom]:h-[95dvh]" : "w-full data-[side=right]:sm:max-w-xl")}>
        <SheetHeader className="border-b">
          <SheetTitle>Table {tableNumber} — {step === "menu" ? "commande" : "vérifier et envoyer"}</SheetTitle>
          <SheetDescription>
            {count === 0 ? "Touchez un plat pour l'ajouter." : `${count} article${count > 1 ? "s" : ""} · environ ${money(estimate)}`}
          </SheetDescription>
        </SheetHeader>

        {!view ? (
          <LoadingState />
        ) : step === "menu" ? (
          <>
            <div className="flex flex-col gap-3 border-b p-4">
              <InputGroup>
                <InputGroupInput aria-label="Chercher un plat" placeholder="Chercher un plat (2 lettres)" value={query} onChange={(e) => setQuery(e.target.value)} />
                <InputGroupAddon>
                  <Search />
                </InputGroupAddon>
              </InputGroup>
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">Service</span>
                <ToggleGroup type="single" variant="outline" size="sm" value={String(course)} onValueChange={(v) => v && setCourse(Number(v))}>
                  {COURSES.map((c) => (
                    <ToggleGroupItem key={c} value={String(c)} aria-label={`Service ${c}`}>
                      {c}
                    </ToggleGroupItem>
                  ))}
                </ToggleGroup>
              </div>
              {search.length < 2 && view.sections.length > 1 ? (
                <ScrollArea className="w-full whitespace-nowrap">
                  <ToggleGroup type="single" variant="outline" size="sm" value={activeKey ?? ""} onValueChange={(v) => v && setSectionKey(v)} className="w-max">
                    {view.sections.map((s) => (
                      <ToggleGroupItem key={s.key} value={s.key}>
                        {s.label}
                      </ToggleGroupItem>
                    ))}
                  </ToggleGroup>
                  <ScrollBar orientation="horizontal" />
                </ScrollArea>
              ) : null}
            </div>
            <ScrollArea className="min-h-0 flex-1">
              <ItemGroup className="gap-1 p-4">
                {view.sections.length === 0 ? <p className="text-sm text-muted-foreground">Aucune carte en ligne en ce moment.</p> : null}
                {search.length >= 2 && shown.length === 0 ? <p className="text-sm text-muted-foreground">Aucun plat ne correspond.</p> : null}
                {shown.map(({ product, section }) => {
                  const unavailable = view.availability.product(section.menu, section.section.id, product.id) !== null;
                  const inDraft = draft.lines.filter((l) => l.request.productId === product.id).reduce((s, l) => s + l.request.quantity, 0);
                  return (
                    <Item
                      key={`${section.key}:${product.id}`}
                      variant="outline"
                      size="sm"
                      asChild
                      className={cn(unavailable && "opacity-50")}
                    >
                      <button type="button" onClick={() => tap(product, section.menu, section.section.id)} aria-disabled={unavailable}>
                        <ItemContent>
                          <ItemTitle>
                            {product.name}
                            {inDraft > 0 ? <Badge>{inDraft}</Badge> : null}
                          </ItemTitle>
                          <ItemDescription>
                            {unavailable ? "Indisponible" : product.variants.length > 1 ? `${product.variants.length} tailles` : product.modifierGroups.length > 0 ? "Options à choisir" : section.label}
                          </ItemDescription>
                        </ItemContent>
                        <ItemActions>
                          <span className="text-sm tabular-nums">
                            {money(product.variants.length > 0 ? Math.min(...product.variants.map((v) => v.price)) : (product.promoPrice ?? product.basePrice))}
                          </span>
                          <Plus className="size-4" />
                        </ItemActions>
                      </button>
                    </Item>
                  );
                })}
              </ItemGroup>
            </ScrollArea>
            <SheetFooter className="border-t">
              <Button size="lg" disabled={count === 0} onClick={() => setStep("review")}>
                Vérifier ({count})
              </Button>
            </SheetFooter>
          </>
        ) : (
          <Review
            priced={priced}
            draft={draft}
            coursesUsed={coursesUsed}
            onLines={setLines}
            onDraft={onDraftChange}
            estimate={estimate}
            hasProblems={problems.length > 0}
            onBack={() => setStep("menu")}
            onSend={async () => {
              await onSend(draft, estimate);
              setStep("menu");
              setQuery("");
            }}
          />
        )}

        {choosing && view ? (
          <ProductChoice
            product={choosing.product}
            course={course}
            price={view.price}
            isVariantAvailable={view.availability.variant}
            isOptionAvailable={view.availability.option}
            onClose={() => setChoosing(null)}
            onAdd={(request) => {
              add(request);
              setChoosing(null);
            }}
          />
        ) : null}
      </SheetContent>
    </Sheet>
  );
}

function Review({
  priced,
  draft,
  coursesUsed,
  onLines,
  onDraft,
  estimate,
  hasProblems,
  onBack,
  onSend,
}: {
  priced: { line: DraftLine; result: { line: PricedLine } | { problem: { message: string } } }[];
  draft: Draft;
  coursesUsed: number[];
  onLines: (lines: DraftLine[]) => void;
  onDraft: (draft: Draft) => void;
  estimate: number;
  hasProblems: boolean;
  onBack: () => void;
  onSend: () => Promise<void>;
}) {
  const money = useMoney();
  const [sending, setSending] = useState(false);
  const quantity = (key: string, delta: number) =>
    onLines(
      draft.lines
        .map((l) => (l.key === key ? { ...l, request: { ...l.request, quantity: l.request.quantity + delta } } : l))
        .filter((l) => l.request.quantity > 0),
    );

  return (
    <>
      <ScrollArea className="min-h-0 flex-1">
        <div className="flex flex-col gap-4 p-4">
          {coursesUsed.map((c) => (
            <section key={c} className="flex flex-col gap-2">
              <div className="flex items-center justify-between gap-2">
                <h3 className="text-sm font-medium">Service {c}</h3>
                {c > 1 ? (
                  <Field orientation="horizontal" className="w-auto">
                    <Switch
                      id={`hold-${c}`}
                      checked={draft.held.includes(c)}
                      onCheckedChange={(on) => onDraft({ ...draft, held: on ? [...new Set([...draft.held, c])] : draft.held.filter((h) => h !== c) })}
                    />
                    <FieldLabel htmlFor={`hold-${c}`} className="font-normal">
                      Attendre « envoyez la suite »
                    </FieldLabel>
                  </Field>
                ) : null}
              </div>
              <ItemGroup className="gap-1">
                {priced
                  .filter((p) => p.line.request.courseNumber === c)
                  .map(({ line, result }) => (
                    <Item key={line.key} variant="outline" size="sm">
                      <ItemContent>
                        <ItemTitle>{"line" in result ? result.line.nameSnapshot : "Plat"}</ItemTitle>
                        <ItemDescription className={cn("problem" in result && "text-destructive")}>
                          {"problem" in result
                            ? result.problem.message
                            : [result.line.variantNameSnapshot, ...result.line.modifiers.map((m) => m.optionName), result.line.instructions ? `« ${result.line.instructions} »` : null]
                                .filter(Boolean)
                                .join(" · ") || money(result.line.unitPrice)}
                        </ItemDescription>
                      </ItemContent>
                      <ItemActions>
                        <ButtonGroup>
                          <Button size="icon-sm" variant="outline" aria-label="Retirer un" onClick={() => quantity(line.key, -1)}>
                            {line.request.quantity === 1 ? <Trash2 /> : <Minus />}
                          </Button>
                          <ButtonGroupText className="min-w-8 justify-center tabular-nums">{line.request.quantity}</ButtonGroupText>
                          <Button
                            size="icon-sm"
                            variant="outline"
                            aria-label="Ajouter un"
                            disabled={line.request.quantity >= ORDER_LIMITS.quantity}
                            onClick={() => quantity(line.key, 1)}
                          >
                            <Plus />
                          </Button>
                        </ButtonGroup>
                      </ItemActions>
                    </Item>
                  ))}
              </ItemGroup>
            </section>
          ))}
          <Field>
            <FieldLabel htmlFor="order-notes">
              Note pour la cuisine <span className="font-normal text-muted-foreground">(facultatif)</span>
            </FieldLabel>
            <Textarea id="order-notes" maxLength={ORDER_LIMITS.note} value={draft.notes} onChange={(e) => onDraft({ ...draft, notes: e.target.value })} />
          </Field>
        </div>
      </ScrollArea>
      <SheetFooter className="border-t">
        <p className="text-sm text-muted-foreground">
          Total estimé <span className="font-medium text-foreground tabular-nums">{money(estimate)}</span> — le prix définitif est celui du serveur.
        </p>
        <div className="grid grid-cols-2 gap-2">
          <Button variant="outline" size="lg" onClick={onBack}>
            Ajouter
          </Button>
          <Button
            size="lg"
            disabled={hasProblems || draft.lines.length === 0 || sending}
            onClick={async () => {
              setSending(true);
              try {
                await onSend();
              } finally {
                setSending(false);
              }
            }}
          >
            <Send />
            Envoyer
          </Button>
        </div>
      </SheetFooter>
    </>
  );
}

/** Taille, options, quantité, précision : seulement quand le plat en a. */
function ProductChoice({
  product,
  course,
  price,
  isVariantAvailable,
  isOptionAvailable,
  onClose,
  onAdd,
}: {
  product: Product;
  course: number;
  price: (request: LineRequest) => { line: PricedLine } | { problem: { message: string } };
  isVariantAvailable: (id: string) => boolean;
  isOptionAvailable: (id: string) => boolean;
  onClose: () => void;
  onAdd: (request: LineRequest) => void;
}) {
  const money = useMoney();
  const defaultVariant = product.variants.find((v) => v.isDefault && isVariantAvailable(v.id)) ?? product.variants.find((v) => isVariantAvailable(v.id));
  const [variantId, setVariantId] = useState<string | undefined>(product.variants.length > 0 ? defaultVariant?.id : undefined);
  const [options, setOptions] = useState<string[]>([]);
  const [quantity, setQuantity] = useState(1);
  const [instructions, setInstructions] = useState("");
  const [lineCourse, setLineCourse] = useState(course);

  const request: LineRequest = {
    productId: product.id,
    ...(variantId ? { variantId } : {}),
    optionIds: options,
    quantity,
    ...(instructions.trim() ? { instructions: instructions.trim() } : {}),
    courseNumber: lineCourse,
  };
  const result = price(request);

  return (
    <ResponsiveDialog open onOpenChange={(o) => !o && onClose()}>
      <ResponsiveDialogContent className="max-h-[90dvh] overflow-y-auto">
        <ResponsiveDialogHeader>
          <ResponsiveDialogTitle>{product.name}</ResponsiveDialogTitle>
          {product.description ? <ResponsiveDialogDescription>{product.description}</ResponsiveDialogDescription> : null}
        </ResponsiveDialogHeader>
        <div className="flex flex-col gap-5 px-4 md:px-0">
          {product.variants.length > 1 ? (
            <FieldSet>
              <FieldLegend variant="label">Taille</FieldLegend>
              <RadioGroup value={variantId ?? ""} onValueChange={setVariantId}>
                {product.variants.map((v) => (
                  <Field key={v.id} orientation="horizontal" data-disabled={!isVariantAvailable(v.id) || undefined}>
                    <RadioGroupItem value={v.id} id={`v-${v.id}`} disabled={!isVariantAvailable(v.id)} />
                    <FieldLabel htmlFor={`v-${v.id}`} className="flex-1 font-normal">
                      {v.name}
                      {!isVariantAvailable(v.id) ? " — indisponible" : ""}
                    </FieldLabel>
                    <span className="text-sm tabular-nums">{money(v.price)}</span>
                  </Field>
                ))}
              </RadioGroup>
            </FieldSet>
          ) : null}
          {product.modifierGroups.map((group) => {
            const chosen = options.filter((id) => group.options.some((o) => o.id === id));
            const max = group.selectionType === "single" ? 1 : group.maxSelect;
            const required = group.isRequired ? Math.max(1, group.minSelect) : group.minSelect;
            return (
              <FieldSet key={group.id}>
                <FieldLegend variant="label">
                  {group.name}
                  {required > 0 ? <Badge variant="outline" className="ml-2">Obligatoire</Badge> : null}
                </FieldLegend>
                {max > 1 ? <FieldDescription>{max} au plus</FieldDescription> : null}
                {group.selectionType === "single" ? (
                  <RadioGroup
                    value={chosen[0] ?? ""}
                    onValueChange={(id) => setOptions([...options.filter((o) => !group.options.some((g) => g.id === o)), id])}
                  >
                    {group.options.map((o) => (
                      <Field key={o.id} orientation="horizontal" data-disabled={!isOptionAvailable(o.id) || undefined}>
                        <RadioGroupItem value={o.id} id={`o-${o.id}`} disabled={!isOptionAvailable(o.id)} />
                        <FieldLabel htmlFor={`o-${o.id}`} className="flex-1 font-normal">
                          {o.name}
                        </FieldLabel>
                        {o.priceDelta !== 0 ? <span className="text-sm tabular-nums">+{money(o.priceDelta)}</span> : null}
                      </Field>
                    ))}
                  </RadioGroup>
                ) : (
                  group.options.map((o) => {
                    const checked = options.includes(o.id);
                    const disabled = !isOptionAvailable(o.id) || (!checked && chosen.length >= max);
                    return (
                      <Field key={o.id} orientation="horizontal" data-disabled={disabled || undefined}>
                        <Checkbox
                          id={`o-${o.id}`}
                          checked={checked}
                          disabled={disabled}
                          onCheckedChange={(on) => setOptions(on ? [...options, o.id] : options.filter((x) => x !== o.id))}
                        />
                        <FieldContent>
                          <FieldTitle>
                            <label htmlFor={`o-${o.id}`}>{o.name}</label>
                          </FieldTitle>
                        </FieldContent>
                        {o.priceDelta !== 0 ? <span className="text-sm tabular-nums">+{money(o.priceDelta)}</span> : null}
                      </Field>
                    );
                  })
                )}
              </FieldSet>
            );
          })}
          <Field>
            <FieldLabel htmlFor="line-instructions">
              Précision <span className="font-normal text-muted-foreground">(facultatif)</span>
            </FieldLabel>
            <Input
              id="line-instructions"
              maxLength={ORDER_LIMITS.instructions}
              placeholder="Ex. : bien cuit, sans piment"
              value={instructions}
              onChange={(e) => setInstructions(e.target.value)}
            />
          </Field>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <ButtonGroup>
              <Button size="icon" variant="outline" aria-label="Un de moins" disabled={quantity <= 1} onClick={() => setQuantity((q) => q - 1)}>
                <Minus />
              </Button>
              <ButtonGroupText className="min-w-10 justify-center tabular-nums">{quantity}</ButtonGroupText>
              <Button size="icon" variant="outline" aria-label="Un de plus" disabled={quantity >= ORDER_LIMITS.quantity} onClick={() => setQuantity((q) => q + 1)}>
                <Plus />
              </Button>
            </ButtonGroup>
            <ToggleGroup type="single" variant="outline" size="sm" value={String(lineCourse)} onValueChange={(v) => v && setLineCourse(Number(v))} aria-label="Service">
              {COURSES.map((c) => (
                <ToggleGroupItem key={c} value={String(c)} aria-label={`Service ${c}`}>
                  S{c}
                </ToggleGroupItem>
              ))}
            </ToggleGroup>
          </div>
          <Separator />
          {"problem" in result ? <p className="text-sm text-destructive">{result.problem.message}</p> : null}
          <ResponsiveDialogFooter>
            <Button size="lg" disabled={"problem" in result} onClick={() => onAdd(request)}>
              Ajouter{"line" in result ? ` · ${money(result.line.lineTotal)}` : ""}
            </Button>
          </ResponsiveDialogFooter>
        </div>
      </ResponsiveDialogContent>
    </ResponsiveDialog>
  );
}
