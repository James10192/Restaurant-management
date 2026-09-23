/**
 * La carte vue par le client — Joliba (DESIGN.md §5, IA §3)
 *
 * Partagée par la carte de table (`/r/…/table`) et la carte publique (`/menu/…`).
 *
 * Contraintes qui gouvernent ce fichier :
 *  - AUCUNE dépendance au kit d'interface du personnel : tout ce qui est importé ici est
 *    téléchargé sur une 4G bridée, par un téléphone d'entrée de gamme. React, et c'est tout ;
 *  - un plat épuisé est GRISÉ, jamais masqué : un plat qui disparaît donne une carte pauvre ;
 *  - la place de chaque photo est réservée avant son arrivée : rien ne bouge au chargement ;
 *  - rien n'est déduit : un allergène, un régime, un piment ne s'affichent que déclarés (R28).
 */

import { createContext, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { ALLERGENS } from "../../../convex/lib/allergens";
import type { GuestMenu, GuestProduct, LiveAvailability, PublicVenue } from "../../../convex/lib/guestMenu";
import { formatMoney, type CurrencyCode } from "../../../convex/lib/money";
import { availabilityIndex, formatMinute, type AvailabilityIndex } from "~/lib/guest/availability";
import { GUEST_TEXT, localized, type GuestLocale, type GuestText } from "~/lib/guest/i18n";

/** Devise et heure, lues une fois au plus haut : chaque carte n'a pas à les recevoir. */
const GuestContext = createContext<{ currency: string; now: number }>({ currency: "XOF", now: 0 });

const cx = (...parts: Array<string | false | null | undefined>) => parts.filter(Boolean).join(" ");

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

  const selected = useMemo(() => {
    if (!props.selectedProductId) return null;
    for (const menu of menus) {
      for (const section of menu.sections) {
        const product = section.products.find((p) => p.id === props.selectedProductId);
        if (product) return { menu, sectionId: section.id, product };
      }
    }
    return null;
  }, [menus, props.selectedProductId]);

  const timeFormat = useMemo(
    () => new Intl.DateTimeFormat(locale === "fr" ? "fr-FR" : "en-GB", { timeZone: venue.timezone, hour: "2-digit", minute: "2-digit" }),
    [locale, venue.timezone],
  );

  return (
    <GuestContext.Provider value={{ currency: venue.currency, now }}>
    <div lang={locale} className="min-h-dvh bg-bg pb-16">
      {!online ? (
        <p role="status" className="sticky top-0 z-30 bg-warning-50 px-4 py-2 text-center text-label text-warning-700">
          {t.offline(timeFormat.format(renderedAt))}
        </p>
      ) : null}
      {props.header}

      {menus.length === 0 ? (
        <div className="mx-auto max-w-[960px] px-4 py-12 text-center">
          <p className="text-title-lg text-ink">{t.empty}</p>
          <p className="mt-2 text-body text-ink-2">{t.askWaiter}</p>
        </div>
      ) : (
        <>
          <SectionNav menus={visibleMenus} locale={locale} label={t.sections} />
          <div className="mx-auto max-w-[960px] px-4">
            <div className="mt-4 flex flex-col gap-3">
              <label className="sr-only" htmlFor="guest-search">
                {t.search}
              </label>
              <div className="flex gap-2">
                <input
                  id="guest-search"
                  type="search"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder={t.search}
                  autoComplete="off"
                  className="h-12 min-w-0 flex-1 rounded-md border border-line-control bg-surface px-4 text-body text-ink placeholder:text-ink-3"
                />
                {/* En haut, là où on la cherche : un client anglophone ne descend pas jusqu'au pied de page. */}
                <button
                  type="button"
                  onClick={() => setLocale(locale === "fr" ? "en" : "fr")}
                  className="h-12 shrink-0 rounded-md border border-line-2 bg-surface px-3 text-label text-ink"
                  lang={locale === "fr" ? "en" : "fr"}
                  aria-label={t.language}
                >
                  {locale === "fr" ? "EN" : "FR"}
                </button>
              </div>
              {availableFilters.length > 0 ? (
                <div className="flex flex-wrap gap-2" role="group" aria-label={t.filters}>
                  {availableFilters.map((f) => {
                    const on = filters.includes(f);
                    return (
                      <button
                        key={f}
                        type="button"
                        aria-pressed={on}
                        onClick={() => setFilters(on ? filters.filter((x) => x !== f) : [...filters, f])}
                        className={cx(
                          "h-11 rounded-full border px-4 text-label",
                          on ? "border-accent-600 bg-accent-50 text-accent-700" : "border-line-2 bg-surface text-ink-2",
                        )}
                      >
                        {t[f]}
                      </button>
                    );
                  })}
                </div>
              ) : null}
            </div>

            {visibleMenus.length === 0 ? (
              <div className="py-10 text-center">
                <p className="text-body text-ink-2">{t.noResult}</p>
                <button
                  type="button"
                  onClick={() => {
                    setQuery("");
                    setFilters([]);
                  }}
                  className="mt-3 h-11 rounded-sm px-4 text-label text-accent-700 underline underline-offset-4"
                >
                  {t.clearFilters}
                </button>
              </div>
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

            <p className="mt-10 rounded-md bg-surface-2 px-4 py-3 text-label text-ink-2">{t.noAllergenInfo}</p>
            {props.footer ? <div className="mt-6">{props.footer}</div> : null}
          </div>
        </>
      )}

      <DishSheet
        selection={selected}
        index={index}
        locale={locale}
        t={t}
        currency={venue.currency}
        now={now}
        onClose={() => props.onSelectProduct(null)}
      />
    </div>
    </GuestContext.Provider>
  );
}

type SectionView = GuestMenu["sections"][number];

function sectionAnchor(menu: GuestMenu, section: { id: string }) {
  return `s-${menu.menu.id.slice(-6)}-${section.id.slice(-8)}`;
}

function SectionNav({ menus, locale, label }: { menus: { menu: GuestMenu; sections: SectionView[] }[]; locale: GuestLocale; label: string }) {
  const links = menus.flatMap(({ menu, sections }) => sections.map((s) => ({ href: `#${sectionAnchor(menu, s)}`, name: localized(s, locale).name })));
  const [active, setActive] = useState<string | null>(null);
  useEffect(() => {
    // Suit le défilement sans écouteur de scroll : un observateur ne coûte rien entre deux changements.
    const targets = links.map((l) => document.querySelector(l.href)).filter((el): el is Element => el !== null);
    if (targets.length === 0 || typeof IntersectionObserver === "undefined") return;
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries.filter((e) => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0];
        if (visible) setActive(`#${visible.target.id}`);
      },
      { rootMargin: "-64px 0px -70% 0px" },
    );
    targets.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, [links.map((l) => l.href).join("|")]);
  if (links.length < 2) return null;
  return (
    <nav aria-label={label} className="sticky top-0 z-20 border-b border-line bg-surface/95 backdrop-blur">
      <ul className="mx-auto flex max-w-[960px] gap-1 overflow-x-auto px-2 [scrollbar-width:none]">
        {links.map((l) => (
          <li key={l.href} className="shrink-0">
            <a
              href={l.href}
              aria-current={active === l.href ? "true" : undefined}
              className={cx(
                "inline-flex h-12 items-center border-b-2 px-3 text-label",
                active === l.href ? "border-accent-600 text-ink" : "border-transparent text-ink-2",
              )}
            >
              {l.name}
            </a>
          </li>
        ))}
      </ul>
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
  onSelect: (id: string) => void;
  priorityImages: boolean;
}) {
  const { menu, t } = props;
  const schedule = menu.menu.activeSchedule;
  const active = props.index.menuActive(menu);
  return (
    <section className="mt-8">
      {props.showMenuTitle ? <h2 className="text-title-xl text-ink">{menu.menu.name}</h2> : null}
      {schedule && !active ? (
        <p className="mt-2 rounded-md bg-surface-2 px-4 py-2 text-label text-ink-2">
          {t.servedFrom(formatMinute(schedule.startMinute), formatMinute(schedule.endMinute))}
        </p>
      ) : null}
      {props.sections.map((section, sectionIndex) => {
        const text = localized(section, props.locale);
        const withPhotos = section.products.filter((p) => p.images.length > 0).length;
        const grid = section.products.length > 0 && withPhotos / section.products.length >= PHOTO_GRID_THRESHOLD;
        return (
          <section key={section.id} id={sectionAnchor(menu, section)} className="scroll-mt-16 pt-6" aria-labelledby={`${sectionAnchor(menu, section)}-t`}>
            <h3 id={`${sectionAnchor(menu, section)}-t`} className="text-title-lg text-ink">
              {text.name}
            </h3>
            {text.description ? <p className="mt-1 text-body text-ink-2">{text.description}</p> : null}
            <ul className={cx("mt-3", grid ? "grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3" : "divide-y divide-line rounded-lg border border-line bg-surface")}>
              {section.products.map((product, productIndex) => (
                <li key={product.id}>
                  <DishCard
                    product={product}
                    form={grid ? "grid" : "list"}
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

function DietaryMarks({ product, t }: { product: GuestProduct; t: GuestText }) {
  const marks: string[] = [];
  if (product.dietary.vegan) marks.push(t.vegan);
  else if (product.dietary.vegetarian) marks.push(t.vegetarian);
  if (product.dietary.halal) marks.push(t.halal);
  if ((product.dietary.spicyLevel ?? 0) > 0) marks.push(`${t.spicy} ${"●".repeat(product.dietary.spicyLevel ?? 0)}`);
  if (marks.length === 0) return null;
  return (
    <ul className="mt-2 flex flex-wrap gap-1.5">
      {marks.map((m) => (
        <li key={m} className="rounded-full bg-surface-2 px-2.5 py-0.5 text-label text-ink-2">
          {m}
        </li>
      ))}
    </ul>
  );
}

function DishCard(props: {
  product: GuestProduct;
  form: "grid" | "list";
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
  const { currency, now } = useContext(GuestContext);
  const price = priceLabel(product, currency, t, now);
  const status = props.unavailable === "schedule" ? t.notServedNow : t.soldOut;

  if (props.form === "list") {
    return (
      <button
        type="button"
        onClick={() => props.onSelect(product.id)}
        className="flex min-h-18 w-full items-center gap-3 px-3 py-3 text-left"
        aria-describedby={soldOut ? `${product.id}-status` : undefined}
      >
        {image?.thumbUrl ? (
          <img
            src={image.thumbUrl}
            crossOrigin="anonymous"
            alt=""
            width={56}
            height={56}
            loading={props.eager ? "eager" : "lazy"}
            decoding="async"
            className={cx("size-14 shrink-0 rounded-sm object-cover", soldOut && "opacity-55")}
          />
        ) : null}
        <span className="min-w-0 flex-1">
          <span className={cx("block text-title-md", soldOut ? "text-ink-3" : "text-ink")}>{text.name}</span>
          {text.description ? <span className="block truncate text-body text-ink-2">{text.description}</span> : null}
        </span>
        <span className="shrink-0 text-right">
          {soldOut ? (
            <span id={`${product.id}-status`} className="block text-label text-ink-3">
              {status}
            </span>
          ) : null}
          <span className={cx("block text-title-md tabular-nums", soldOut ? "text-ink-3" : "text-ink")}>{price.main}</span>
          {price.old ? <span className="block text-label text-ink-3 line-through tabular-nums">{price.old}</span> : null}
        </span>
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={() => props.onSelect(product.id)}
      className="flex h-full w-full flex-col overflow-hidden rounded-lg border border-line bg-surface text-left shadow-e1"
      aria-describedby={soldOut ? `${product.id}-status` : undefined}
    >
      <span className="relative block aspect-[4/3] w-full bg-surface-2">
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
            className={cx("absolute inset-0 size-full object-cover", soldOut && "opacity-55")}
          />
        ) : (
          // Repli dessiné : l'initiale du plat, jamais une photo d'illustration (R-D7).
          <span aria-hidden="true" className="absolute inset-0 flex items-center justify-center text-display text-ink-4">
            {text.name.slice(0, 1).toUpperCase()}
          </span>
        )}
        {soldOut ? (
          <span id={`${product.id}-status`} className="absolute inset-x-0 top-1/2 -translate-y-1/2 bg-surface-2 py-1 text-center text-title-md text-ink">
            {status}
          </span>
        ) : null}
      </span>
      <span className="flex flex-1 flex-col p-4">
        <span className="flex items-start justify-between gap-3">
          <span className={cx("text-title-md", soldOut ? "text-ink-3" : "text-ink")}>{text.name}</span>
          <span className="shrink-0 text-right">
            <span className={cx("block text-title-md tabular-nums", soldOut ? "text-ink-3" : "text-ink")}>{price.main}</span>
            {price.old ? <span className="block text-label text-ink-3 line-through tabular-nums">{price.old}</span> : null}
          </span>
        </span>
        {text.description ? <span className="mt-1 line-clamp-2 text-body text-ink-2">{text.description}</span> : null}
        <DietaryMarks product={product} t={t} />
      </span>
    </button>
  );
}


function DishSheet(props: {
  selection: { menu: GuestMenu; sectionId: string; product: GuestProduct } | null;
  index: AvailabilityIndex;
  locale: GuestLocale;
  t: GuestText;
  currency: string;
  now: number;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const { selection, t } = props;
  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    // Le `<dialog>` natif piège le focus, ferme à Échap et rend le focus à son origine.
    if (selection && !dialog.open) dialog.showModal();
    if (!selection && dialog.open) dialog.close();
  }, [selection]);

  const product = selection?.product;
  const text = product ? localized(product, props.locale) : null;
  const unavailable = selection ? props.index.product(selection.menu, selection.sectionId, selection.product.id) : null;
  const image = product?.images[0];
  const price = product ? priceLabel(product, props.currency, t, props.now) : null;

  return (
    <dialog
      ref={ref}
      aria-labelledby="dish-title"
      onClose={props.onClose}
      onClick={(e) => {
        // Un appui sur le voile ferme la feuille.
        if (e.target === e.currentTarget) props.onClose();
      }}
      className="fixed inset-x-0 bottom-0 top-auto m-0 mx-auto max-h-[85vh] w-full max-w-[640px] overflow-y-auto rounded-t-lg bg-surface p-0 text-ink shadow-e2 backdrop:bg-ink/40"
    >
      {product && text ? (
        <div>
          <div className="sticky top-0 z-10 flex justify-end bg-surface/0 p-2">
            <button type="button" onClick={props.onClose} aria-label={t.close} className="flex size-11 items-center justify-center rounded-full bg-surface text-title-lg text-ink shadow-e1">
              <span aria-hidden="true">×</span>
            </button>
          </div>
          {image?.url ? (
            <img src={image.url} crossOrigin="anonymous" alt={text.name} width={image.width} height={image.height} className="-mt-15 block h-auto w-full" />
          ) : null}
          <div className="px-5 pb-8 pt-4">
            <div className="flex items-start justify-between gap-4">
              <h2 id="dish-title" className="text-title-xl text-ink">
                {text.name}
              </h2>
              {price ? (
                <p className="shrink-0 text-right text-title-lg tabular-nums">
                  {price.main}
                  {price.old ? <span className="block text-label text-ink-3 line-through">{price.old}</span> : null}
                </p>
              ) : null}
            </div>
            {unavailable ? (
              <p className="mt-2 inline-block rounded-full bg-surface-2 px-3 py-1 text-label text-ink">
                {unavailable === "schedule" ? t.notServedNow : t.soldOut}
              </p>
            ) : null}
            {text.description ? <p className="mt-3 text-body text-ink-2">{text.description}</p> : null}
            <DietaryMarks product={product} t={t} />

            {product.variants.length > 1 ? (
              <ul className="mt-5 divide-y divide-line rounded-md border border-line">
                {product.variants.map((v) => {
                  const vt = localized(v, props.locale);
                  const ok = props.index.variant(v.id);
                  return (
                    <li key={v.id} className="flex min-h-13 items-center justify-between px-4">
                      <span className={ok ? "text-body text-ink" : "text-body text-ink-3"}>
                        {vt.name}
                        {ok ? null : ` — ${t.soldOut}`}
                      </span>
                      <span className="text-body tabular-nums text-ink-2">{money(v.price, props.currency)}</span>
                    </li>
                  );
                })}
              </ul>
            ) : null}

            {product.modifierGroups.map((group) => {
              const gt = localized(group, props.locale);
              return (
                <section key={group.id} className="mt-5">
                  <h3 className="text-title-md text-ink">
                    {gt.name}
                    <span className="ml-2 text-label text-ink-3">
                      {group.isRequired ? `${t.required} · ` : ""}
                      {t.chooseUpTo(group.maxSelect)}
                    </span>
                  </h3>
                  <ul className="mt-2 divide-y divide-line rounded-md border border-line">
                    {group.options.map((o) => {
                      const ok = props.index.option(o.id);
                      return (
                        <li key={o.id} className="flex min-h-13 items-center justify-between px-4">
                          <span className={ok ? "text-body text-ink" : "text-body text-ink-3"}>
                            {localized(o, props.locale).name}
                            {ok ? null : ` — ${t.soldOut}`}
                          </span>
                          {/* Un supplément à 0 F n'affiche rien — pas « + 0 F ». */}
                          {o.priceDelta !== 0 ? (
                            <span className="text-body tabular-nums text-ink-2">
                              {o.priceDelta > 0 ? "+ " : "− "}
                              {money(Math.abs(o.priceDelta), props.currency)}
                            </span>
                          ) : null}
                        </li>
                      );
                    })}
                  </ul>
                </section>
              );
            })}

            <section className="mt-6">
              <h3 className="text-label text-ink-3">{t.allergens}</h3>
              {product.allergens.length > 0 ? (
                <p className="mt-1 text-body text-ink">
                  {product.allergens.map((a) => ALLERGENS[a as keyof typeof ALLERGENS]?.[props.locale] ?? a).join(" · ")}
                </p>
              ) : null}
              <p className="mt-1 text-label text-ink-2">{t.noAllergenInfo}</p>
            </section>
          </div>
        </div>
      ) : null}
    </dialog>
  );
}
