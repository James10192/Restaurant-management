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

import { ClockIcon, InfoIcon, PlusIcon, SearchIcon, UtensilsCrossedIcon, WifiOffIcon, XIcon } from "lucide-react";
import { createContext, lazy, Suspense, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { ALLERGENS } from "../../../convex/lib/allergens";
import type { GuestMenu, GuestProduct, LiveAvailability, PublicVenue } from "../../../convex/lib/guestMenu";
import { currencySymbol, formatAmount, formatMoney, type CurrencyCode } from "../../../convex/lib/money";
import { Alert, AlertDescription } from "~/components/ui/alert";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "~/components/ui/empty";
import { InputGroup, InputGroupAddon, InputGroupInput } from "~/components/ui/input-group";
import { Item, ItemActions, ItemContent, ItemGroup, ItemTitle } from "~/components/ui/item";
import { Skeleton } from "~/components/ui/skeleton";
import { Toggle } from "~/components/ui/toggle";
import { availabilityIndex, formatMinute, type AvailabilityIndex } from "~/lib/guest/availability";
import type { AddResult, DishChoice } from "~/lib/guest/cart";
import { GUEST_TEXT, localized, type GuestLocale, type GuestText } from "~/lib/guest/i18n";
import { cn } from "~/lib/utils";

/** Devise et heure, lues une fois au plus haut : chaque carte n'a pas à les recevoir. */
const GuestContext = createContext<{ currency: string; now: number; orderable: boolean }>({ currency: "XOF", now: 0, orderable: false });

export type MenuViewProps = {
  venue: PublicVenue;
  menus: GuestMenu[];
  live: LiveAvailability;
  renderedAt: number;
  /**
   * L'en-tête. Sous forme de fonction, il reçoit l'heure qui tourne et la langue de la carte :
   * « Ouvert · ferme à 23 h » avance avec la page et suit le passage en anglais.
   */
  header: ReactNode | ((c: { now: number; t: GuestText; locale: GuestLocale }) => ReactNode);
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
        {typeof props.header === "function" ? props.header({ now, t, locale }) : props.header}

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
          <div id="carte">
            <MenuToolbar
              menus={visibleMenus}
              locale={locale}
              t={t}
              query={query}
              onQuery={setQuery}
              filters={filters}
              availableFilters={availableFilters}
              onFilters={setFilters}
              onLocale={() => setLocale(locale === "fr" ? "en" : "fr")}
            />
            <div className="mx-auto max-w-[960px] px-4">
              {/* La devise, UNE fois : dans la liste, les prix ne portent que leurs chiffres (D-166). */}
              <p className="pt-4 text-xs text-muted-foreground">{t.pricesIn(currencySymbol(venue.currency as CurrencyCode))}</p>
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
                    onSelect={props.onSelectProduct}
                    priorityImages={menu === visibleMenus[0]?.menu}
                  />
                ))
              )}

              {/* Une note, pas une alerte : en gris, sous la carte, elle informe sans inquiéter (D-166). */}
              <p role="note" className="mt-10 flex gap-2 text-sm text-muted-foreground">
                <InfoIcon aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
                {t.noAllergenInfo}
              </p>
              {props.footer ? <div className="mt-6">{props.footer}</div> : null}
            </div>
          </div>
        )}

        {sheetMounted ? (
          <Suspense fallback={selected ? <DishSheetSkeleton t={t} photo={Boolean(selected.product.images[0]?.url)} /> : null}>
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

/** Le début de la carte : la barre collante et tout ce qui suit. */


/** « Entrées, Grillades & Plats » : de quoi reconnaître une carte avant de l'ouvrir. */
function summary(names: string[]) {
  const shown = names.slice(0, 3);
  return shown.length < 2 ? (shown[0] ?? "") : `${shown.slice(0, -1).join(", ")} & ${shown.at(-1)}`;
}

/**
 * La barre collante, sur UNE ligne : les sections, la recherche, la langue. La recherche et les
 * filtres s'ouvrent à la demande — ils ne repoussent pas les plats sous la ligne de flottaison.
 * Les sections sont des liens d'ancre, pas des onglets : elles défilent jusqu'à la section avant
 * même que le JavaScript soit arrivé, et rien n'est masqué. Plusieurs cartes publiées (le midi,
 * le soir, les boissons) ajoutent un étage d'étiquettes au-dessus.
 */
/**
 * Une zone active de 56 px autour d'un contrôle qui en paraît 40 (DESIGN §11 : « une cible peut
 * être visuellement plus petite que sa zone active ») : 8 px au-dessus et au-dessous.
 */
const HIT = "relative after:absolute after:inset-x-0 after:-inset-y-2 after:content-['']";
/**
 * La loupe et la langue, côte à côte : 44 px à l'œil, 56 px sous le doigt dans les DEUX sens. Les
 * 12 px d'écart entre elles sont exactement partagés par leurs zones actives, sans chevauchement.
 */
const HIT_ICON = "relative size-11 shrink-0 rounded-full after:absolute after:-inset-1.5 after:content-['']";

type ToolbarGroup = { key: string; name: string; summary: string; links: { href: string; name: string }[] };

/**
 * La barre collante : les cartes (s'il y en a plusieurs), les sections en pastilles, la loupe et la
 * langue. Sa hauteur réelle, mesurée, est publiée dans `--guest-nav-h` : une section atteinte par
 * une pastille s'arrête dessous, et la pastille allumée est celle qu'on lit — une seule valeur pour
 * les deux, recherche ouverte comprise.
 */
function MenuToolbar(props: {
  menus: { menu: GuestMenu; sections: SectionView[] }[];
  locale: GuestLocale;
  t: GuestText;
  query: string;
  onQuery: (q: string) => void;
  filters: Filter[];
  availableFilters: Filter[];
  onFilters: (f: Filter[]) => void;
  onLocale: () => void;
}) {
  const { menus, locale, t } = props;
  const groups: ToolbarGroup[] = menus.map(({ menu, sections }) => {
    const names = sections.map((s) => localized(s, locale).name);
    return {
      key: menu.publicationId,
      name: menu.menu.name,
      summary: summary(names),
      links: sections.map((s, i) => ({ href: `#${sectionAnchor(menu, s)}`, name: names[i]! })),
    };
  });
  const links = groups.flatMap((g) => g.links);
  const bar = useRef<HTMLDivElement>(null);
  const height = useStickyHeight(bar);
  const current = useCurrentSection(links.map((l) => l.href), height);
  const currentGroup = groups.find((g) => g.links.some((l) => l.href === current)) ?? groups[0];
  // Ouverte d'office quand une recherche ou un filtre est en cours : on voit ce qui filtre la carte.
  const [searching, setSearching] = useState(props.query !== "" || props.filters.length > 0);

  return (
    <div ref={bar} className="sticky top-0 z-20 border-b bg-background">
      <div className="mx-auto max-w-[960px]">
        {groups.length > 1 ? <MenuTabs groups={groups} current={currentGroup} /> : null}
        <div className="flex items-center gap-3 py-2 pr-2 pl-4">
          <nav aria-label={t.sections} className="min-w-0 flex-1">
            {links.length > 1 && currentGroup ? <SectionPills links={currentGroup.links} current={current} /> : null}
          </nav>
          <Toggle
            size="lg"
            className={HIT_ICON}
            pressed={searching}
            onPressedChange={(on) => {
              setSearching(on);
              if (!on) {
                props.onQuery("");
                props.onFilters([]);
              }
            }}
            aria-label={searching ? t.searchClose : t.search}
          >
            {searching ? <XIcon /> : <SearchIcon />}
          </Toggle>
          {/* En haut, là où on la cherche : un client anglophone ne descend pas jusqu'au pied de page. */}
          <Button type="button" variant="ghost" className={cn(HIT_ICON, "font-semibold")} onClick={props.onLocale} lang={locale === "fr" ? "en" : "fr"} aria-label={t.language}>
            {locale === "fr" ? "EN" : "FR"}
          </Button>
        </div>
        {searching ? <SearchPanel t={t} query={props.query} onQuery={props.onQuery} filters={props.filters} availableFilters={props.availableFilters} onFilters={props.onFilters} /> : null}
      </div>
    </div>
  );
}

/** La hauteur de la barre collante, publiée en variable CSS pour le défilement vers une section. */
function useStickyHeight(bar: React.RefObject<HTMLDivElement | null>): number {
  const [height, setHeight] = useState(64);
  useEffect(() => {
    const el = bar.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(() => {
      const h = Math.ceil(el.getBoundingClientRect().height);
      setHeight(h);
      document.documentElement.style.setProperty("--guest-nav-h", `${h}px`);
    });
    observer.observe(el);
    return () => {
      observer.disconnect();
      // La variable n'a de sens que sous cette barre : une navigation interne ne l'emporte pas.
      document.documentElement.style.removeProperty("--guest-nav-h");
    };
  }, [bar]);
  return height;
}

/** La section qu'on lit, suivie sans écouteur de scroll : un observateur ne coûte rien entre deux changements. */
function useCurrentSection(hrefs: string[], navHeight: number): string | null {
  const [active, setActive] = useState<string | null>(null);
  const key = hrefs.join("|");
  useEffect(() => {
    const targets = hrefs.map((h) => document.querySelector(h)).filter((el): el is Element => el !== null);
    if (targets.length === 0 || typeof IntersectionObserver === "undefined") return;
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries.filter((e) => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0];
        if (visible) setActive(`#${visible.target.id}`);
      },
      { rootMargin: `-${navHeight}px 0px -60% 0px` },
    );
    targets.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
    // `key` résume `hrefs` : un nouveau tableau aux mêmes adresses ne relance pas l'observateur.
  }, [key, navHeight]);
  return active ?? hrefs[0] ?? null;
}

/** L'étage des cartes publiées, quand il y en a plusieurs (le midi, le soir, les boissons). */
function MenuTabs({ groups, current }: { groups: ToolbarGroup[]; current: ToolbarGroup | undefined }) {
  return (
    <ul className="flex gap-5 overflow-x-auto px-4 pt-2 [scrollbar-width:none]">
      {groups.map((g) => {
        const on = g === current;
        return (
          <li key={g.key} className="shrink-0">
            <a
              href={g.links[0]!.href}
              aria-current={on ? "true" : undefined}
              // Souligné, pas rempli : la couleur du restaurant marque la carte lue, sans aplat (D-166).
              className={cn(
                "flex min-h-14 min-w-36 flex-col justify-center border-b-2 px-1 py-2 transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
                on ? "border-primary" : "border-transparent hover:border-border",
              )}
            >
              <span className={cn("text-base font-bold", !on && "text-muted-foreground")}>{g.name}</span>
              <span className="max-w-52 truncate text-xs text-muted-foreground">{g.summary}</span>
            </a>
          </li>
        );
      })}
    </ul>
  );
}

/** Les sections en pastilles ; la lue reste visible dans la rangée, sans faire bouger la page. */
function SectionPills({ links, current }: { links: { href: string; name: string }[]; current: string | null }) {
  const row = useRef<HTMLUListElement>(null);
  useEffect(() => {
    const pill = row.current?.querySelector<HTMLElement>("[aria-current=true]")?.parentElement;
    if (row.current && pill) row.current.scrollTo({ left: pill.offsetLeft - (row.current.clientWidth - pill.clientWidth) / 2, behavior: "smooth" });
  }, [current]);
  return (
    // Le fondu à droite dit qu'il y a d'autres sections plus loin ; la marge laisse la dernière
    // pastille sortir du fondu. Le rembourrage vertical laisse la place aux zones actives de 56 px.
    <ul ref={row} className="-my-2 flex gap-5 overflow-x-auto py-2 pr-8 [scrollbar-width:none] [mask-image:linear-gradient(to_right,#000_calc(100%-2rem),transparent)]">
      {links.map((l) => (
        <li key={l.href} className="shrink-0">
          {/* Des sections soulignées, pas des pastilles : seule la lue porte la couleur (D-166). */}
          <a
            href={l.href}
            aria-current={current === l.href ? "true" : undefined}
            className={cn(
              "flex h-10 items-center border-b-2 px-1 text-[15px] font-semibold whitespace-nowrap transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
              current === l.href ? "border-primary text-foreground" : "border-transparent text-muted-foreground hover:text-foreground",
              HIT,
            )}
          >
            {l.name}
          </a>
        </li>
      ))}
    </ul>
  );
}

/** La recherche et les filtres, derrière la loupe : fermés, ils ne coûtent pas une rangée à la carte. */
function SearchPanel(props: { t: GuestText; query: string; onQuery: (q: string) => void; filters: Filter[]; availableFilters: Filter[]; onFilters: (f: Filter[]) => void }) {
  const { t } = props;
  const input = useRef<HTMLInputElement>(null);
  useEffect(() => input.current?.focus(), []);
  return (
    <div className="flex flex-col gap-2 px-4 pb-3">
      <label className="sr-only" htmlFor="guest-search">
        {t.search}
      </label>
      <InputGroup className="h-13">
        <InputGroupInput id="guest-search" ref={input} type="search" value={props.query} onChange={(e) => props.onQuery(e.target.value)} placeholder={t.search} autoComplete="off" />
        <InputGroupAddon>
          <SearchIcon />
        </InputGroupAddon>
      </InputGroup>
      {props.availableFilters.length > 0 ? (
        // Des Toggle indépendants, et non un ToggleGroup : même rendu, même annonce (bouton
        // « pressé »), mais sans la navigation au clavier du groupe — plusieurs Ko de moins sur la
        // 4G du client, pour quatre boutons au plus.
        <div role="group" aria-label={t.filters} className="flex flex-wrap gap-2">
          {props.availableFilters.map((f) => (
            <Toggle
              key={f}
              variant="outline"
              className="h-13 rounded-full px-4"
              pressed={props.filters.includes(f)}
              onPressedChange={(on) => props.onFilters(FILTERS.filter((x) => (x === f ? on : props.filters.includes(x))))}
            >
              {t[f]}
            </Toggle>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function MenuBlock(props: {
  menu: GuestMenu;
  sections: SectionView[];
  index: AvailabilityIndex;
  locale: GuestLocale;
  t: GuestText;
  showMenuTitle: boolean;
  onSelect: (id: string) => void;
  priorityImages: boolean;
}) {
  const { menu, t } = props;
  const schedule = menu.menu.activeSchedule;
  const active = props.index.menuActive(menu);
  return (
    <section className="mt-2">
      {props.showMenuTitle ? <h2 className="mt-8 text-sm font-semibold text-muted-foreground">{menu.menu.name}</h2> : null}
      {schedule && !active ? (
        <Badge variant="secondary" className="mt-3">
          <ClockIcon data-icon="inline-start" />
          {t.servedFrom(formatMinute(schedule.startMinute), formatMinute(schedule.endMinute))}
        </Badge>
      ) : null}
      {props.sections.map((section, sectionIndex) => {
        const text = localized(section, props.locale);
        const anchor = sectionAnchor(menu, section);
        return (
          <section key={section.id} id={anchor} className="scroll-mt-(--guest-nav-h,64px) pt-8" aria-labelledby={`${anchor}-t`}>
            <div className="flex items-baseline gap-3 border-b pb-2">
              <h3 id={`${anchor}-t`} className="min-w-0 text-xl leading-tight font-bold tracking-tight [overflow-wrap:anywhere]">
                {text.name}
              </h3>
              <span className="ml-auto shrink-0 text-sm text-muted-foreground">{t.dishes(section.products.length)}</span>
            </div>
            {text.description ? <p className="mt-2 max-w-xl text-sm text-muted-foreground">{text.description}</p> : null}
            {/* Une liste, deux colonnes sur grand écran : on compare des plats en balayant, on
                ouvre la fiche pour la grande photo. */}
            <ul className="grid md:grid-cols-2 md:gap-x-8">
              {section.products.map((product, productIndex) => (
                <li key={product.id} className="border-b last:border-b-0 md:[&:nth-last-child(2):nth-child(odd)]:border-b-0">
                  <DishCard
                    product={product}
                    unavailable={props.index.product(menu, section.id, product.id)}
                    locale={props.locale}
                    t={t}
                    onSelect={props.onSelect}
                    // Les premières photos portent l'affichage utile : chargées tout de suite, les autres à l'approche.
                    eager={props.priorityImages && sectionIndex === 0 && productIndex < 2}
                  />
                </li>
              ))}
            </ul>
          </section>
        );
      })}
    </section>
  );
}

/**
 * Le prix d'un plat, sous deux formes : complète (`main`, avec la devise) pour la fiche, et sans
 * devise (`list`) pour la liste, où « Prix en F CFA » est écrit une fois au-dessus (D-166).
 */
function priceLabel(product: GuestProduct, currency: string, t: GuestText, now: number) {
  const promoActive = product.promoPrice !== undefined && (product.promoEndsAt === undefined || product.promoEndsAt > now);
  const both = (amount: number) => ({ full: money(amount, currency), bare: bareAmount(amount, currency) });
  let main: { full: string; bare: string };
  let old: { full: string; bare: string } | null = null;
  let prefix = "";
  if (product.variants.length > 1) {
    main = both(Math.min(...product.variants.map((v) => v.price)));
    prefix = `${t.from} `;
  } else if (product.variants.length === 1) main = both(product.variants[0]!.price);
  else if (promoActive) {
    main = both(product.promoPrice!);
    old = both(product.basePrice);
  } else main = both(product.basePrice);
  return { main: prefix + main.full, old: old?.full ?? null, list: prefix + main.bare, oldList: old?.bare ?? null };
}

function bareAmount(amount: number, currency: string) {
  return formatAmount({ amount, currency: currency as CurrencyCode });
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

/**
 * Un plat, en ligne : le nom, deux lignes de description, le prix, et la photo à droite. C'est la
 * forme des cartes qu'on lit vite (on balaie les noms et les prix) ; la grande photo est dans la
 * fiche, à un appui. Sans photo, la ligne ne laisse pas de trou.
 */
function DishCard(props: {
  product: GuestProduct;
  unavailable: string | null;
  locale: GuestLocale;
  t: GuestText;
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
  const status = props.unavailable === "schedule" ? t.notServedNow : t.soldOut;
  const statusId = `${product.id}-status`;
  const marks = dietaryMarks(product, t);
  // Sur la carte de table, un plat disponible se commande : le « + » le dit sans un mot de plus.
  const add = orderable && !soldOut;

  return (
    <button
      type="button"
      onClick={() => props.onSelect(product.id)}
      onPointerDown={prefetch}
      className="flex w-full gap-4 py-4 text-left outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
      aria-describedby={soldOut ? statusId : undefined}
    >
      <span className="flex min-w-0 flex-1 flex-col gap-1">
        <span className={cn("text-base leading-snug font-bold", soldOut && "text-muted-foreground")}>{text.name}</span>
        {text.description ? <span className="line-clamp-2 text-sm text-muted-foreground">{text.description}</span> : null}
        <span className="mt-1 flex flex-wrap items-baseline gap-x-2 gap-y-1">
          <span className={cn("font-semibold tabular-nums", soldOut && "text-muted-foreground")}>{price.list}</span>
          {price.oldList ? <span className="text-xs text-muted-foreground tabular-nums line-through">{price.oldList}</span> : null}
          {marks.length > 0 ? <span className="text-xs text-muted-foreground">{marks.join(" · ")}</span> : null}
        </span>
        {soldOut ? (
          <Badge id={statusId} variant="secondary" className="mt-1 self-start">
            {status}
          </Badge>
        ) : null}
      </span>
      {image?.thumbUrl ? (
        <span className="relative size-28 shrink-0 overflow-hidden rounded-2xl bg-muted">
          <img
            src={image.thumbUrl}
            crossOrigin="anonymous"
            alt=""
            width={112}
            height={112}
            loading={props.eager ? "eager" : "lazy"}
            {...(props.eager ? { fetchPriority: "high" as const } : {})}
            decoding="async"
            className={cn("absolute inset-0 size-full object-cover", soldOut && "opacity-40 grayscale")}
          />
          {add ? <AddMark className="absolute right-1.5 bottom-1.5" /> : null}
        </span>
      ) : add ? (
        <AddMark className="self-center" />
      ) : null}
      {add ? <span className="sr-only">{t.add}</span> : null}
    </button>
  );
}

function AddMark({ className }: { className?: string }) {
  return (
    <span aria-hidden="true" className={cn("grid size-9 place-items-center rounded-full bg-background text-primary shadow-md ring-1 ring-border", className)}>
      <PlusIcon className="size-5" />
    </span>
  );
}

/**
 * Ce que voit le client entre son appui et l'arrivée de la fiche (vaul et le Dialog de Radix,
 * téléchargés à part) : la forme du tiroir, tout de suite. Sur une 4G lente, un appui sans effet
 * visible fait appuyer une deuxième fois (D-166). Rien d'interactif : il ne vit que quelques
 * centaines de millisecondes.
 */
function DishSheetSkeleton({ t, photo }: { t: GuestText; photo: boolean }) {
  return (
    <>
      <div aria-hidden="true" className="fixed inset-0 z-50 bg-black/10" />
      <div role="status" aria-busy="true" className="fixed inset-x-0 bottom-0 z-50 mx-auto flex max-h-[80vh] max-w-2xl flex-col rounded-t-xl border-t bg-popover px-4 pb-6">
        <div className="mx-auto mt-4 h-1 w-[100px] shrink-0 rounded-full bg-muted" />
        <span className="sr-only">{t.loading}</span>
        {photo ? <Skeleton className="mt-4 aspect-[4/3] w-full rounded-lg" /> : null}
        <Skeleton className="mt-4 h-6 w-2/3" />
        <Skeleton className="mt-3 h-4 w-full" />
        <Skeleton className="mt-2 h-4 w-4/5" />
      </div>
    </>
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
