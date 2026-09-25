/**
 * La carte vue par le client — Joliba (DESIGN.md §5, IA §3)
 *
 * Partagée par la carte de table (`/r/…/table`) et la carte publique (`/menu/…`).
 *
 * Contraintes qui gouvernent ce fichier :
 *  - tout ce qui est importé ici est téléchargé sur une 4G bridée, par un téléphone d'entrée de
 *    gamme. Seuls des composants shadcn/ui légers sont chargés au premier affichage ; la fiche
 *    d'un plat (Drawer, donc vaul et le Dialog de Radix) arrive À PART, au premier appui ;
 *  - le rendu serveur porte déjà toute la carte : rien d'utile n'attend l'hydratation ;
 *  - un plat épuisé est GRISÉ, jamais masqué : un plat qui disparaît donne une carte pauvre ;
 *  - la place de chaque photo est réservée avant son arrivée : rien ne bouge au chargement ;
 *  - rien n'est déduit : un allergène, un régime, un piment ne s'affichent que déclarés (R28).
 */

import { ClockIcon, InfoIcon, PlusIcon, SearchIcon, UtensilsCrossedIcon, WifiOffIcon } from "lucide-react";
import { createContext, lazy, Suspense, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { ALLERGENS } from "../../../convex/lib/allergens";
import type { GuestMenu, GuestProduct, LiveAvailability, PublicVenue } from "../../../convex/lib/guestMenu";
import { formatMoney, type CurrencyCode } from "../../../convex/lib/money";
import { Alert, AlertDescription } from "~/components/ui/alert";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "~/components/ui/card";
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "~/components/ui/empty";
import { InputGroup, InputGroupAddon, InputGroupInput } from "~/components/ui/input-group";
import { Item, ItemActions, ItemContent, ItemDescription, ItemGroup, ItemMedia, ItemTitle } from "~/components/ui/item";
import { Toggle } from "~/components/ui/toggle";
import { availabilityIndex, formatMinute, type AvailabilityIndex } from "~/lib/guest/availability";
import type { AddResult, DishChoice } from "~/lib/guest/cart";
import { GUEST_TEXT, localized, type GuestLocale, type GuestText } from "~/lib/guest/i18n";
import { cn } from "~/lib/utils";

/** Devise et heure, lues une fois au plus haut : chaque carte n'a pas à les recevoir. */
const GuestContext = createContext<{ currency: string; now: number; orderable: boolean }>({ currency: "XOF", now: 0, orderable: false });

/** Une section bascule en liste sans photo sous 40 % de plats photographiés (R-D7). */
const PHOTO_GRID_THRESHOLD = 0.4;

export type MenuViewProps = {
  venue: PublicVenue;
  menus: GuestMenu[];
  live: LiveAvailability;
  renderedAt: number;
  header: ReactNode;
  footer?: ReactNode;
  selectedProductId: string | null;
  onSelectProduct: (productId: string | null) => void;
  /**
   * Commande à table. Absent sur la carte publique : aucun bouton d'ajout, et rien de la
   * composition d'un plat n'est téléchargé.
   */
  ordering?: MenuOrdering;
};

/** Ce que la carte partage avec la commande : la langue choisie, la disponibilité en direct, l'heure. */
export type MenuOrderingContext = { locale: GuestLocale; live: LiveAvailability; now: number; online: boolean };

export type MenuOrdering = {
  /** Ajoute un plat composé dans sa fiche ; `false` si le panier ne peut plus rien recevoir. */
  onAdd: (choice: DishChoice, productName: string) => AddResult;
  /** La barre du panier et ses tiroirs, rendus dans le contexte de la carte. */
  render: (context: MenuOrderingContext) => ReactNode;
};

function normalize(text: string) {
  return text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function money(amount: number, currency: string) {
  return formatMoney({ amount, currency: currency as CurrencyCode });
}

/** L'heure qui tourne : celle du rendu serveur au premier affichage (pas d'écart d'hydratation), puis la vraie. */
function useNow(renderedAt: number): number {
  const [now, setNow] = useState(renderedAt);
  useEffect(() => {
    setNow(Date.now());
    const timer = window.setInterval(() => setNow(Date.now()), 60_000);
    return () => window.clearInterval(timer);
  }, []);
  return now;
}

/** La disponibilité en direct, dont le client arrive après l'affichage (`lib/guest/live.ts`). */
function useLiveAvailability(venueId: PublicVenue["_id"], initial: LiveAvailability) {
  const [live, setLive] = useState(initial);
  const [connected, setConnected] = useState<boolean | null>(null);
  useEffect(() => {
    const url = import.meta.env.VITE_CONVEX_URL as string | undefined;
    if (!url) return;
    let stop: (() => void) | undefined;
    let cancelled = false;
    void import("~/lib/guest/live").then(({ subscribeAvailability }) => {
      if (cancelled) return;
      stop = subscribeAvailability(url, venueId, setLive, setConnected);
    });
    return () => {
      cancelled = true;
      stop?.();
    };
  }, [venueId]);
  return { live, connected };
}

function useOnline(): boolean {
  const [online, setOnline] = useState(true);
  useEffect(() => {
    const update = () => setOnline(navigator.onLine);
    update();
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    return () => {
      window.removeEventListener("online", update);
      window.removeEventListener("offline", update);
    };
  }, []);
  return online;
}

export function useGuestLocale(): [GuestLocale, (l: GuestLocale) => void] {
  const [locale, setLocale] = useState<GuestLocale>("fr");
  useEffect(() => {
    try {
      const saved = localStorage.getItem("joliba.langue");
      if (saved === "en" || saved === "fr") setLocale(saved);
      // Sans choix enregistré, un téléphone réglé en anglais lit la carte en anglais.
      else if (navigator.language.toLowerCase().startsWith("en")) setLocale("en");
    } catch {
      /* sans stockage, on reste en français */
    }
  }, []);
  const update = (next: GuestLocale) => {
    setLocale(next);
    try {
      localStorage.setItem("joliba.langue", next);
    } catch {
      /* rien */
    }
  };
  return [locale, update];
}

type Filter = "vegetarian" | "vegan" | "halal" | "spicy";
const FILTERS: readonly Filter[] = ["vegetarian", "vegan", "halal", "spicy"];

type DishSelection = { menu: GuestMenu; sectionId: string; product: GuestProduct };

export function MenuView(props: MenuViewProps) {
  const { venue, menus, renderedAt } = props;
  const [locale, setLocale] = useGuestLocale();
  const t = GUEST_TEXT[locale];
  const now = useNow(renderedAt);
  const online = useOnline();
  const { live } = useLiveAvailability(venue._id, props.live);
  const index = useMemo(() => availabilityIndex(live, now, venue.timezone), [live, now, venue.timezone]);
  const [query, setQuery] = useState("");
  const [filters, setFilters] = useState<Filter[]>([]);

  const allProducts = useMemo(() => menus.flatMap((m) => m.sections.flatMap((s) => s.products)), [menus]);
  // Un filtre n'apparaît que si au moins un plat le DÉCLARE : sinon il mentirait par omission.
  const availableFilters = useMemo(() => {
    const out: Filter[] = [];
    if (allProducts.some((p) => p.dietary.vegetarian)) out.push("vegetarian");
    if (allProducts.some((p) => p.dietary.vegan)) out.push("vegan");
    if (allProducts.some((p) => p.dietary.halal)) out.push("halal");
    if (allProducts.some((p) => (p.dietary.spicyLevel ?? 0) > 0)) out.push("spicy");
    return out;
  }, [allProducts]);

  const matches = (p: GuestProduct) => {
    if (filters.includes("vegetarian") && !p.dietary.vegetarian) return false;
    if (filters.includes("vegan") && !p.dietary.vegan) return false;
    if (filters.includes("halal") && !p.dietary.halal) return false;
    if (filters.includes("spicy") && !((p.dietary.spicyLevel ?? 0) > 0)) return false;
    if (!query.trim()) return true;
    const text = localized(p, locale);
    return normalize(`${text.name} ${text.description ?? ""}`).includes(normalize(query.trim()));
  };

  const visibleMenus = menus
    .map((menu) => ({
      menu,
      sections: menu.sections.map((s) => ({ ...s, products: s.products.filter(matches) })).filter((s) => s.products.length > 0),
    }))
    .filter((m) => m.sections.length > 0);

  const selected = useMemo<DishSelection | null>(() => {
    if (!props.selectedProductId) return null;
    for (const menu of menus) {
      for (const section of menu.sections) {
        const product = section.products.find((p) => p.id === props.selectedProductId);
        if (product) return { menu, sectionId: section.id, product };
      }
    }
    return null;
  }, [menus, props.selectedProductId]);

  // La fiche n'est montée qu'au premier plat ouvert, et jamais au rendu serveur (un effet n'y
  // tourne pas) : vaul reste hors du premier paquet. Une fois montée, elle le reste, pour que
  // la fermeture s'anime au lieu de disparaître.
  const [sheetMounted, setSheetMounted] = useState(false);
  useEffect(() => {
    if (selected) setSheetMounted(true);
  }, [selected]);

  const timeFormat = useMemo(
    () => new Intl.DateTimeFormat(locale === "fr" ? "fr-FR" : "en-GB", { timeZone: venue.timezone, hour: "2-digit", minute: "2-digit" }),
    [locale, venue.timezone],
  );

  return (
    <GuestContext.Provider value={{ currency: venue.currency, now, orderable: props.ordering !== undefined }}>
      <div lang={locale} className={cn("min-h-dvh bg-background text-foreground", props.ordering ? "pb-40" : "pb-16")}>
        {!online ? (
          <Alert role="status" className="sticky top-0 z-30 rounded-none border-x-0 border-t-0">
            <WifiOffIcon />
            <AlertDescription>{t.offline(timeFormat.format(renderedAt))}</AlertDescription>
          </Alert>
        ) : null}
        {props.header}

        {menus.length === 0 ? (
          <Empty className="mx-auto max-w-[960px] px-4 py-12">
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <UtensilsCrossedIcon />
              </EmptyMedia>
              <EmptyTitle className="text-lg">{t.empty}</EmptyTitle>
              <EmptyDescription>{t.askWaiter}</EmptyDescription>
            </EmptyHeader>
          </Empty>
        ) : (
          <div id={MENU_ANCHOR}>
            <SectionNav menus={visibleMenus} locale={locale} label={t.sections} />
            <div className="mx-auto max-w-[960px] px-4">
              <div className="mt-4 flex flex-col gap-3">
                <label className="sr-only" htmlFor="guest-search">
                  {t.search}
                </label>
                <div className="flex gap-2">
                  <InputGroup className="h-11 flex-1">
                    <InputGroupInput
                      id="guest-search"
                      type="search"
                      value={query}
                      onChange={(e) => setQuery(e.target.value)}
                      placeholder={t.search}
                      autoComplete="off"
                    />
                    <InputGroupAddon>
                      <SearchIcon />
                    </InputGroupAddon>
                  </InputGroup>
                  {/* En haut, là où on la cherche : un client anglophone ne descend pas jusqu'au pied de page. */}
                  <Button
                    type="button"
                    variant="outline"
                    size="lg"
                    className="h-11 min-w-11"
                    onClick={() => setLocale(locale === "fr" ? "en" : "fr")}
                    lang={locale === "fr" ? "en" : "fr"}
                    aria-label={t.language}
                  >
                    {locale === "fr" ? "EN" : "FR"}
                  </Button>
                </div>
                {availableFilters.length > 0 ? (
                  // Des Toggle indépendants, et non un ToggleGroup : même rendu, même annonce (bouton
                  // « pressé »), mais sans la navigation au clavier du groupe — plusieurs Ko de moins
                  // sur la 4G du client, pour quatre boutons au plus.
                  <div role="group" aria-label={t.filters} className="flex flex-wrap gap-2">
                    {availableFilters.map((f) => (
                      <Toggle
                        key={f}
                        variant="outline"
                        size="lg"
                        pressed={filters.includes(f)}
                        onPressedChange={(on) => setFilters(FILTERS.filter((x) => (x === f ? on : filters.includes(x))))}
                      >
                        {t[f]}
                      </Toggle>
                    ))}
                  </div>
                ) : null}
              </div>

              {visibleMenus.length === 0 ? (
                <Empty className="py-10">
                  <EmptyHeader>
                    <EmptyMedia variant="icon">
                      <SearchIcon />
                    </EmptyMedia>
                    <EmptyTitle>{t.noResult}</EmptyTitle>
                  </EmptyHeader>
                  <EmptyContent>
                    <Button
                      type="button"
                      variant="outline"
                      size="lg"
                      onClick={() => {
                        setQuery("");
                        setFilters([]);
                      }}
                    >
                      {t.clearFilters}
                    </Button>
                  </EmptyContent>
                </Empty>
              ) : (
                visibleMenus.map(({ menu, sections }) => (
                  <MenuBlock
                    key={menu.publicationId}
                    menu={menu}
                    sections={sections}
                    index={index}
                    locale={locale}
                    t={t}
                    showMenuTitle={menus.length > 1}
                    twoRowNav={visibleMenus.length > 1}
                    onSelect={props.onSelectProduct}
                    priorityImages={menu === visibleMenus[0]?.menu}
                  />
                ))
              )}

              <Alert role="note" className="mt-10">
                <InfoIcon />
                <AlertDescription>{t.noAllergenInfo}</AlertDescription>
              </Alert>
              {props.footer ? <div className="mt-6">{props.footer}</div> : null}
            </div>
          </div>
        )}

        {sheetMounted ? (
          <Suspense fallback={null}>
            <DishSheet
              selection={selected}
              menus={menus}
              onSelect={props.onSelectProduct}
              index={index}
              locale={locale}
              t={t}
              currency={venue.currency}
              now={now}
              live={live}
              timeZone={venue.timezone}
              ordering={props.ordering}
              onClose={() => props.onSelectProduct(null)}
            />
          </Suspense>
        ) : null}
        {props.ordering ? props.ordering.render({ locale, live, now, online }) : null}
      </div>
    </GuestContext.Provider>
  );
}

type SectionView = GuestMenu["sections"][number];

function sectionAnchor(menu: GuestMenu, section: { id: string }) {
  return `s-${menu.menu.id.slice(-6)}-${section.id.slice(-8)}`;
}

/** La cible du bouton « Découvrir la carte » de l'en-tête : la navigation et tout ce qui suit. */
export const MENU_ANCHOR = "carte";

/** « Entrées, Grillades & Plats » : de quoi reconnaître une carte avant de l'ouvrir. */
function summary(names: string[]) {
  const shown = names.slice(0, 3);
  return shown.length < 2 ? (shown[0] ?? "") : `${shown.slice(0, -1).join(", ")} & ${shown.at(-1)}`;
}

/**
 * Des liens d'ancre, et non des onglets : ils défilent jusqu'à la section avant même que le
 * JavaScript soit arrivé, et chaque section reste dans la page (rien n'est masqué).
 *
 * Deux étages quand l'établissement publie plusieurs cartes (le midi, le soir, les boissons) :
 * les cartes en grandes étiquettes, puis les sections de celle qu'on lit. Avec une seule carte,
 * seules les sections.
 */
function SectionNav({ menus, locale, label }: { menus: { menu: GuestMenu; sections: SectionView[] }[]; locale: GuestLocale; label: string }) {
  const groups = menus.map(({ menu, sections }) => {
    const names = sections.map((s) => localized(s, locale).name);
    return {
      key: menu.publicationId,
      name: menu.menu.name,
      summary: summary(names),
      links: sections.map((s, i) => ({ href: `#${sectionAnchor(menu, s)}`, name: names[i]! })),
    };
  });
  const links = groups.flatMap((g) => g.links);
  const twoRows = groups.length > 1;
  const [active, setActive] = useState<string | null>(null);
  const current = active ?? links[0]?.href ?? null;
  const currentGroup = groups.find((g) => g.links.some((l) => l.href === current)) ?? groups[0];
  const pills = useRef<HTMLUListElement>(null);

  useEffect(() => {
    // Suit le défilement sans écouteur de scroll : un observateur ne coûte rien entre deux changements.
    const targets = links.map((l) => document.querySelector(l.href)).filter((el): el is Element => el !== null);
    if (targets.length === 0 || typeof IntersectionObserver === "undefined") return;
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries.filter((e) => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0];
        if (visible) setActive(`#${visible.target.id}`);
      },
      // Sous la barre collante, dont la hauteur dépend du nombre d'étages.
      { rootMargin: `${twoRows ? "-140px" : "-72px"} 0px -60% 0px` },
    );
    targets.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, [links.map((l) => l.href).join("|"), twoRows]);

  useEffect(() => {
    // La section lue reste visible dans la rangée, sans faire bouger la page.
    const row = pills.current;
    const pill = row?.querySelector<HTMLElement>("[aria-current=true]")?.parentElement;
    if (row && pill) row.scrollTo({ left: pill.offsetLeft - (row.clientWidth - pill.clientWidth) / 2, behavior: "smooth" });
  }, [current]);

  if (links.length < 2 || !currentGroup) return null;
  return (
    <nav aria-label={label} className="sticky top-0 z-20 border-b bg-background/95 backdrop-blur">
      <div className="mx-auto max-w-[960px]">
        {twoRows ? (
          <ul className="flex gap-2 overflow-x-auto px-4 pt-3 [scrollbar-width:none]">
            {groups.map((g) => {
              const on = g === currentGroup;
              return (
                <li key={g.key} className="shrink-0">
                  <a
                    href={g.links[0]!.href}
                    aria-current={on ? "true" : undefined}
                    className={cn(
                      "flex min-w-36 flex-col rounded-xl border px-4 py-2 transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
                      on ? "border-primary bg-primary text-primary-foreground" : "bg-card hover:bg-muted",
                    )}
                  >
                    <span className="text-sm font-black tracking-wide uppercase">{g.name}</span>
                    <span className={cn("max-w-52 truncate text-xs", on ? "text-primary-foreground/80" : "text-muted-foreground")}>{g.summary}</span>
                  </a>
                </li>
              );
            })}
          </ul>
        ) : null}
        <ul ref={pills} className="flex gap-2 overflow-x-auto px-4 py-2.5 [scrollbar-width:none]">
          {currentGroup.links.map((l) => (
            <li key={l.href} className="shrink-0">
              <Button asChild variant={current === l.href ? "default" : "outline"} className="h-10 rounded-full px-4 font-semibold">
                <a href={l.href} aria-current={current === l.href ? "true" : undefined}>
                  {l.name}
                </a>
              </Button>
            </li>
          ))}
        </ul>
      </div>
    </nav>
  );
}

function MenuBlock(props: {
  menu: GuestMenu;
  sections: SectionView[];
  index: AvailabilityIndex;
  locale: GuestLocale;
  t: GuestText;
  showMenuTitle: boolean;
  twoRowNav: boolean;
  onSelect: (id: string) => void;
  priorityImages: boolean;
}) {
  const { menu, t } = props;
  const schedule = menu.menu.activeSchedule;
  const active = props.index.menuActive(menu);
  return (
    <section className="mt-6">
      {/* Le nom de la carte est dit par le bandeau de chaque section ; le titre ne sert qu'à la structure. */}
      {props.showMenuTitle ? <h2 className="sr-only">{menu.menu.name}</h2> : null}
      {schedule && !active ? (
        <Badge variant="secondary" className="mt-2">
          <ClockIcon data-icon="inline-start" />
          {t.servedFrom(formatMinute(schedule.startMinute), formatMinute(schedule.endMinute))}
        </Badge>
      ) : null}
      {props.sections.map((section, sectionIndex) => {
        const text = localized(section, props.locale);
        const withPhotos = section.products.filter((p) => p.images.length > 0).length;
        const grid = section.products.length > 0 && withPhotos / section.products.length >= PHOTO_GRID_THRESHOLD;
        const anchor = sectionAnchor(menu, section);
        const card = (product: GuestProduct, productIndex: number) => (
          <DishCard
            product={product}
            form={grid ? "grid" : "list"}
            unavailable={props.index.product(menu, section.id, product.id)}
            locale={props.locale}
            t={t}
            eyebrow={text.name}
            onSelect={props.onSelect}
            // Les premières photos portent l'affichage utile : chargées tout de suite, les autres à l'approche.
            eager={props.priorityImages && sectionIndex === 0 && productIndex < 2}
          />
        );
        return (
          <section key={section.id} id={anchor} className={cn("pt-6", props.twoRowNav ? "scroll-mt-36" : "scroll-mt-20")} aria-labelledby={`${anchor}-t`}>
            <div className="rounded-2xl bg-primary px-5 py-6 text-primary-foreground">
              <p className="flex items-baseline gap-3 text-xs font-semibold tracking-[0.18em] uppercase">
                {/* Le rang dans la carte publiée, et non dans la liste filtrée : il ne bouge pas quand on cherche. */}
                <span aria-hidden="true" className="text-sm font-black tabular-nums opacity-70">
                  {String(menu.sections.findIndex((s) => s.id === section.id) + 1).padStart(2, "0")}
                </span>
                {props.showMenuTitle ? <span className="opacity-80">{menu.menu.name}</span> : null}
              </p>
              <h3 id={`${anchor}-t`} className="mt-2 text-3xl leading-none font-black tracking-tight uppercase [overflow-wrap:anywhere]">
                {text.name}
              </h3>
              {text.description ? <p className="mt-3 max-w-xl text-sm text-primary-foreground/80">{text.description}</p> : null}
            </div>
            {grid ? (
              <ul className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
                {section.products.map((product, productIndex) => (
                  <li key={product.id}>{card(product, productIndex)}</li>
                ))}
              </ul>
            ) : (
              <ItemGroup className="mt-4 gap-2">
                {section.products.map((product, productIndex) => (
                  <div key={product.id} role="listitem">
                    {card(product, productIndex)}
                  </div>
                ))}
              </ItemGroup>
            )}
          </section>
        );
      })}
    </section>
  );
}

function priceLabel(product: GuestProduct, currency: string, t: GuestText, now: number) {
  const promoActive = product.promoPrice !== undefined && (product.promoEndsAt === undefined || product.promoEndsAt > now);
  if (product.variants.length > 1) {
    const min = Math.min(...product.variants.map((v) => v.price));
    return { main: `${t.from} ${money(min, currency)}`, old: null };
  }
  if (product.variants.length === 1) return { main: money(product.variants[0]!.price, currency), old: null };
  if (promoActive) return { main: money(product.promoPrice!, currency), old: money(product.basePrice, currency) };
  return { main: money(product.basePrice, currency), old: null };
}

function dietaryMarks(product: GuestProduct, t: GuestText): string[] {
  const marks: string[] = [];
  if (product.dietary.vegan) marks.push(t.vegan);
  else if (product.dietary.vegetarian) marks.push(t.vegetarian);
  if (product.dietary.halal) marks.push(t.halal);
  if ((product.dietary.spicyLevel ?? 0) > 0) marks.push(`${t.spicy} ${"●".repeat(product.dietary.spicyLevel ?? 0)}`);
  return marks;
}

function DietaryMarks({ marks }: { marks: string[] }) {
  if (marks.length === 0) return null;
  return (
    <ul className="flex flex-wrap gap-1.5">
      {marks.map((m) => (
        <li key={m}>
          <Badge variant="outline">{m}</Badge>
        </li>
      ))}
    </ul>
  );
}

/** La fiche se prépare dès que le doigt touche un plat : le téléchargement part avant le relâchement. */
const loadDrawer = () => import("~/components/ui/drawer");
const loadOrderForm = () => import("./dish-order-form");
const prefetchDishSheet = () => void loadDrawer();
const prefetchOrderSheet = () => {
  void loadDrawer();
  void loadOrderForm();
};
/** Chargée seulement sur la carte de table, au premier plat ouvert. */
const DishOrderForm = lazy(loadOrderForm);

function DishCard(props: {
  product: GuestProduct;
  form: "grid" | "list";
  unavailable: string | null;
  locale: GuestLocale;
  t: GuestText;
  /** Le nom de la section, rappelé au-dessus du plat sur les cartes à photo. */
  eyebrow: string;
  onSelect: (id: string) => void;
  eager: boolean;
}) {
  const { product, t } = props;
  const text = localized(product, props.locale);
  const image = product.images[0];
  const soldOut = props.unavailable !== null;
  const { currency, now, orderable } = useContext(GuestContext);
  const price = priceLabel(product, currency, t, now);
  const prefetch = orderable ? prefetchOrderSheet : prefetchDishSheet;
  // Sur la carte de table, chaque plat disponible dit qu'on peut l'ajouter ; l'appui ouvre sa fiche,
  // où se choisissent variante, options et quantité.
  const addHint =
    orderable && !soldOut ? (
      <Badge variant="secondary" className="h-7 px-2.5">
        <PlusIcon data-icon="inline-start" />
        {t.add}
      </Badge>
    ) : null;
  const status = props.unavailable === "schedule" ? t.notServedNow : t.soldOut;
  const statusId = `${product.id}-status`;

  const priceBlock = (
    <>
      <span className={cn("block font-bold text-primary tabular-nums", soldOut && "text-muted-foreground")}>{price.main}</span>
      {price.old ? <span className="block text-xs text-muted-foreground tabular-nums line-through">{price.old}</span> : null}
    </>
  );

  if (props.form === "list") {
    return (
      <Item asChild variant="outline" className="min-h-18 text-left">
        <button
          type="button"
          onClick={() => props.onSelect(product.id)}
          onPointerDown={prefetch}
          aria-describedby={soldOut ? statusId : undefined}
        >
          {image?.thumbUrl ? (
            <ItemMedia variant="image" className="size-14">
              <img
                src={image.thumbUrl}
                crossOrigin="anonymous"
                alt=""
                width={56}
                height={56}
                loading={props.eager ? "eager" : "lazy"}
                decoding="async"
                className={cn(soldOut && "opacity-50")}
              />
            </ItemMedia>
          ) : null}
          <ItemContent className="min-w-0">
            <ItemTitle className={cn("line-clamp-2 text-base font-bold", soldOut && "text-muted-foreground")}>{text.name}</ItemTitle>
            {text.description ? <ItemDescription className="line-clamp-1">{text.description}</ItemDescription> : null}
          </ItemContent>
          <ItemActions className="flex-col items-end gap-1 text-right">
            {soldOut ? (
              <Badge id={statusId} variant="secondary">
                {status}
              </Badge>
            ) : null}
            <span>{priceBlock}</span>
            {addHint}
          </ItemActions>
        </button>
      </Item>
    );
  }

  const marks = dietaryMarks(product, t);
  return (
    <button
      type="button"
      onClick={() => props.onSelect(product.id)}
      onPointerDown={prefetch}
      className="block h-full w-full rounded-xl text-left outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
      aria-describedby={soldOut ? statusId : undefined}
    >
      <Card className="h-full pt-0">
        <span className="relative block aspect-[4/3] w-full bg-muted">
          {image?.thumbUrl ? (
            <img
              src={image.thumbUrl}
              crossOrigin="anonymous"
              alt=""
              width={image.width}
              height={image.height}
              loading={props.eager ? "eager" : "lazy"}
              {...(props.eager ? { fetchPriority: "high" as const } : {})}
              decoding="async"
              className={cn("absolute inset-0 size-full object-cover", soldOut && "opacity-50")}
            />
          ) : (
            // Repli dessiné : l'initiale du plat, jamais une photo d'illustration (R-D7).
            <span aria-hidden="true" className="absolute inset-0 flex items-center justify-center text-4xl font-semibold text-muted-foreground">
              {text.name.slice(0, 1).toUpperCase()}
            </span>
          )}
          {soldOut ? (
            <Badge id={statusId} variant="secondary" className="absolute top-3 left-3">
              {status}
            </Badge>
          ) : null}
        </span>
        <CardHeader>
          <p className={cn("text-xs font-semibold tracking-[0.16em] uppercase", soldOut ? "text-muted-foreground" : "text-primary")}>{props.eyebrow}</p>
          <CardTitle className={cn("text-xl leading-tight font-black tracking-tight uppercase", soldOut && "text-muted-foreground")}>{text.name}</CardTitle>
          <div className="text-lg">{priceBlock}</div>
          {text.description ? <CardDescription className="line-clamp-2">{text.description}</CardDescription> : null}
        </CardHeader>
        {marks.length > 0 || addHint ? (
          <CardContent className="mt-auto flex items-end justify-between gap-2">
            <DietaryMarks marks={marks} />
            {addHint ? <span className="ml-auto shrink-0">{addHint}</span> : null}
          </CardContent>
        ) : null}
      </Card>
    </button>
  );
}

type DishSheetProps = {
  selection: DishSelection | null;
  /** Toutes les cartes publiées : la suggestion du restaurant peut venir d'une autre section. */
  menus: GuestMenu[];
  onSelect: (productId: string) => void;
  index: AvailabilityIndex;
  locale: GuestLocale;
  t: GuestText;
  currency: string;
  now: number;
  live: LiveAvailability;
  timeZone: string;
  ordering: MenuOrdering | undefined;
  onClose: () => void;
};

/**
 * La fiche d'un plat, dans un Drawer (tiroir du bas). Chargée à part : vaul et le Dialog de
 * Radix n'entrent pas dans le paquet du premier affichage. Le Drawer piège le focus, ferme à
 * Échap ou d'un glissement, et rend le focus au plat qui l'a ouvert.
 */
const DishSheet = lazy(async () => {
  const { Drawer, DrawerClose, DrawerContent, DrawerDescription, DrawerFooter, DrawerTitle } = await loadDrawer();

  function DishSheetContent(props: DishSheetProps) {
    // Garde le dernier plat pendant l'animation de fermeture : le tiroir ne se vide pas en descendant.
    const [shown, setShown] = useState(props.selection);
    if (props.selection && props.selection !== shown) setShown(props.selection);

    const { t } = props;
    const product = shown?.product;
    const text = product ? localized(product, props.locale) : null;
    const unavailable = shown ? props.index.product(shown.menu, shown.sectionId, shown.product.id) : null;
    const image = product?.images[0];
    const price = product ? priceLabel(product, props.currency, t, props.now) : null;
    const promo = price?.old !== null && price?.old !== undefined;

    const top =
      product && text ? (
        <>
          {image?.url ? (
            <img
              src={image.url}
              crossOrigin="anonymous"
              alt={text.name}
              width={image.width}
              height={image.height}
              // Sur la carte de table, la photo cède de la place aux choix du plat.
              className={cn("block w-full rounded-lg object-cover", props.ordering ? "aspect-[16/9]" : "aspect-[4/3]")}
            />
          ) : null}
          <div className="mt-4 flex items-start justify-between gap-4">
            <DrawerTitle className="text-xl font-semibold tracking-tight">{text.name}</DrawerTitle>
            {price ? (
              <p className="shrink-0 text-right text-lg font-semibold tabular-nums">
                {price.main}
                {price.old ? <span className="block text-xs font-normal text-muted-foreground line-through">{price.old}</span> : null}
              </p>
            ) : null}
          </div>
          {unavailable || promo ? (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {unavailable ? <Badge variant="secondary">{unavailable === "schedule" ? t.notServedNow : t.soldOut}</Badge> : null}
              {promo ? <Badge>{t.promo}</Badge> : null}
            </div>
          ) : null}
          {text.description ? <DrawerDescription className="mt-3 text-base">{text.description}</DrawerDescription> : null}
          <div className="mt-3">
            <DietaryMarks marks={dietaryMarks(product, t)} />
          </div>
        </>
      ) : null;

    // « Le restaurant suggère » (D-104) : un seul plat, le premier DISPONIBLE dans l'ordre choisi
    // par le gérant. Rien si la liste est vide ou tout est indisponible.
    let suggestion: { product: GuestProduct; price: string } | null = null;
    for (const id of product?.relatedProductIds ?? []) {
      for (const menu of props.menus) {
        for (const section of menu.sections) {
          const candidate = section.products.find((p) => p.id === id);
          if (candidate && !props.index.product(menu, section.id, candidate.id)) {
            suggestion = { product: candidate, price: priceLabel(candidate, props.currency, t, props.now).main };
          }
          if (suggestion) break;
        }
        if (suggestion) break;
      }
      if (suggestion) break;
    }
    const suggested = suggestion ? (
      <section className="mt-6" aria-label={t.suggests}>
        <h3 className="text-sm font-medium text-muted-foreground">{t.suggests}</h3>
        <Item asChild variant="outline" size="sm" className="mt-2">
          <button type="button" className="w-full text-left" onClick={() => props.onSelect(suggestion.product.id)}>
            <ItemContent className="min-w-0">
              <ItemTitle className="max-w-full truncate">{localized(suggestion.product, props.locale).name}</ItemTitle>
            </ItemContent>
            <ItemActions className="tabular-nums text-muted-foreground">{suggestion.price}</ItemActions>
          </button>
        </Item>
      </section>
    ) : null;

    const allergens = product ? (
      <section className="mt-6 pb-2">
        <h3 className="text-sm font-medium text-muted-foreground">{t.allergens}</h3>
        {product.allergens.length > 0 ? (
          <ul className="mt-2 flex flex-wrap gap-1.5">
            {product.allergens.map((a) => (
              <li key={a}>
                <Badge variant="outline">{ALLERGENS[a as keyof typeof ALLERGENS]?.[props.locale] ?? a}</Badge>
              </li>
            ))}
          </ul>
        ) : null}
        <p className="mt-2 text-sm text-muted-foreground">{t.noAllergenInfo}</p>
      </section>
    ) : null;

    const closeFooter = (
      <DrawerFooter>
        <DrawerClose asChild>
          <Button type="button" variant="outline" size="lg" className="h-11">
            {t.close}
          </Button>
        </DrawerClose>
      </DrawerFooter>
    );

    // Carte de table : la fiche compose le plat (variante, options, quantité) et l'ajoute.
    const orderForm =
      props.ordering && shown && product ? (
        <Suspense
          fallback={
            <>
              <div className="min-h-0 flex-1 overflow-y-auto px-4 pt-4">{top}</div>
              {closeFooter}
            </>
          }
        >
          <DishOrderForm
            key={product.id}
            menu={shown.menu}
            sectionId={shown.sectionId}
            product={product}
            live={props.live}
            timeZone={props.timeZone}
            currency={props.currency}
            now={props.now}
            locale={props.locale}
            t={t}
            top={top}
            bottom={
              <>
                {suggested}
                {allergens}
              </>
            }
            onAdd={props.ordering.onAdd}
            onDone={props.onClose}
          />
        </Suspense>
      ) : null;

    return (
      <Drawer
        open={props.selection !== null}
        onOpenChange={(open) => {
          if (!open) props.onClose();
        }}
      >
        <DrawerContent className="mx-auto max-w-2xl" {...(text?.description ? {} : { "aria-describedby": undefined })}>
          {product && text ? (
            orderForm ?? (
              <>
                <div className="min-h-0 flex-1 overflow-y-auto px-4 pt-4">
                  {top}

                  {product.variants.length > 1 ? (
                    <ItemGroup className="mt-5 gap-2">
                      {product.variants.map((v) => {
                        const vt = localized(v, props.locale);
                        const ok = props.index.variant(v.id);
                        return (
                          <Item key={v.id} role="listitem" variant="outline" size="sm">
                            <ItemContent>
                              <ItemTitle className={cn(!ok && "text-muted-foreground")}>
                                {vt.name}
                                {ok ? null : ` — ${t.soldOut}`}
                              </ItemTitle>
                            </ItemContent>
                            <ItemActions className="tabular-nums text-muted-foreground">{money(v.price, props.currency)}</ItemActions>
                          </Item>
                        );
                      })}
                    </ItemGroup>
                  ) : null}

                  {product.modifierGroups.map((group) => {
                    const gt = localized(group, props.locale);
                    return (
                      <section key={group.id} className="mt-5">
                        <h3 className="text-sm font-medium">
                          {gt.name}
                          <span className="ml-2 font-normal text-muted-foreground">
                            {group.isRequired ? `${t.required} · ` : ""}
                            {t.chooseUpTo(group.maxSelect)}
                          </span>
                        </h3>
                        <ItemGroup className="mt-2 gap-2">
                          {group.options.map((o) => {
                            const ok = props.index.option(o.id);
                            return (
                              <Item key={o.id} role="listitem" variant="outline" size="sm">
                                <ItemContent>
                                  <ItemTitle className={cn(!ok && "text-muted-foreground")}>
                                    {localized(o, props.locale).name}
                                    {ok ? null : ` — ${t.soldOut}`}
                                  </ItemTitle>
                                </ItemContent>
                                {/* Un supplément à 0 F n'affiche rien — pas « + 0 F ». */}
                                {o.priceDelta !== 0 ? (
                                  <ItemActions className="tabular-nums text-muted-foreground">
                                    {o.priceDelta > 0 ? "+ " : "− "}
                                    {money(Math.abs(o.priceDelta), props.currency)}
                                  </ItemActions>
                                ) : null}
                              </Item>
                            );
                          })}
                        </ItemGroup>
                      </section>
                    );
                  })}

                  {suggested}
                  {allergens}
                </div>
                {closeFooter}
              </>
            )
          ) : null}
        </DrawerContent>
      </Drawer>
    );
  }

  return { default: DishSheetContent };
});
