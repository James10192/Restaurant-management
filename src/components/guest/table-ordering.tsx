/**
 * Commander et appeler depuis la table — Joliba (T2, D-061, D-068)
 *
 * Chargé APRÈS l'affichage de la carte : la carte est lisible sans lui (DESIGN §5). Une barre
 * fixe en bas (Appeler · Mes commandes · Mon panier) et trois tiroirs.
 *
 * Deux conduites, choisies par l'établissement et relues à chaque appel côté serveur :
 *  - `staff_only` (par défaut) : le client compose un PANIER À MONTRER. « Montrer au serveur »
 *    le confie à Convex, où la tablette du serveur le voit ; rien n'est commandé, l'écran le dit ;
 *  - `guest_with_approval` : « Envoyer la commande » ; elle attend la validation d'un serveur,
 *    et l'écran dit en permanence qu'elle n'est pas encore en cuisine.
 *
 * Le panier vit dans le téléphone (`lib/guest/cart.ts`) : sans réseau, il reste, et l'envoi
 * attend. L'état de la table est relu par intervalles (pas de connexion temps réel : un `fetch`
 * de quelques centaines d'octets suffit, et le laissez-passer ne quitte pas son cookie).
 */

import { BellRingIcon, CheckIcon, ClockIcon, MinusIcon, PlusIcon, ReceiptTextIcon, ShoppingBagIcon, Trash2Icon, WifiOffIcon } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { GuestMenu, LiveAvailability, PublicVenue } from "../../../convex/lib/guestMenu";
import { formatMoney, type CurrencyCode } from "../../../convex/lib/money";
import { indexPublishedProducts, priceLine, type LineProblemCode } from "../../../convex/lib/ordering";
import { Alert, AlertDescription, AlertTitle } from "~/components/ui/alert";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { ButtonGroup, ButtonGroupText } from "~/components/ui/button-group";
import { Drawer, DrawerClose, DrawerContent, DrawerDescription, DrawerFooter, DrawerHeader, DrawerTitle } from "~/components/ui/drawer";
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia } from "~/components/ui/empty";
import { Item, ItemActions, ItemContent, ItemDescription, ItemFooter, ItemGroup, ItemTitle } from "~/components/ui/item";
import { Separator } from "~/components/ui/separator";
import { Spinner } from "~/components/ui/spinner";
import { cart, CART_LIMITS, cartSignature, getCart as cartState, guestKeyFor, useCart, type CartLine } from "~/lib/guest/cart";
import { localized, type GuestLocale } from "~/lib/guest/i18n";
import { ORDER_TEXT, type OrderText } from "~/lib/guest/order-text";
import { callTable, type Presence, type TableCallError } from "~/lib/guest/table-api";

export const GUEST_ADDED_EVENT = "joliba:ajout";

export type TableOrderingProps = {
  venueSlug: string;
  venue: PublicVenue;
  menus: GuestMenu[];
  locale: GuestLocale;
  live: LiveAvailability;
  now: number;
  online: boolean;
};

type Notice = { tone: "info" | "error"; text: string } | null;
type Panel = "cart" | "call" | "orders" | null;

const POLL_IDLE_MS = 15_000;
/** Plus serré quand quelque chose attend un geste du personnel. */
const POLL_WAITING_MS = 5_000;

function money(amount: number, currency: string) {
  return formatMoney({ amount, currency: currency as CurrencyCode });
}

function problemText(code: LineProblemCode, o: OrderText): string {
  if (code === "VARIANT_REQUIRED") return o.chooseVariant;
  if (code === "OPTIONS_INVALID" || code === "QUANTITY_INVALID" || code === "INSTRUCTIONS_TOO_LONG" || code === "COURSE_INVALID") return o.completeChoices;
  return o.unavailable;
}

function callErrorText(error: TableCallError, o: OrderText): string {
  return error === "no_pass" ? o.noPass : o.networkError;
}

/** Délais d'appel par type, gardés par établissement : un rechargement ne les efface pas. */
function useCooldowns(venueSlug: string) {
  const storageKey = `joliba.appels.${venueSlug}`;
  const [until, setUntil] = useState<Record<string, number>>({});
  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(storageKey) ?? "{}") as Record<string, unknown>;
      const clean: Record<string, number> = {};
      for (const [k, v] of Object.entries(saved)) if (typeof v === "number" && v > Date.now()) clean[k] = v;
      setUntil(clean);
    } catch {
      /* sans stockage, les délais ne valent que pour cette visite */
    }
  }, [storageKey]);
  const set = (type: string, at: number) => {
    setUntil((prev) => {
      const next = { ...prev, [type]: at };
      try {
        localStorage.setItem(storageKey, JSON.stringify(next));
      } catch {
        /* rien */
      }
      return next;
    });
  };
  return [until, set] as const;
}

/** L'heure à la seconde, seulement quand un compte à rebours est affiché. */
function useTicker(active: boolean): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!active) return;
    setNow(Date.now());
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [active]);
  return now;
}

export default function TableOrdering(props: TableOrderingProps) {
  const { venue, locale, online } = props;
  const o = ORDER_TEXT[locale];
  const state = useCart();
  const guestKey = useMemo(() => guestKeyFor(props.venueSlug), [props.venueSlug]);
  const published = useMemo(() => indexPublishedProducts(props.menus), [props.menus]);

  const [presence, setPresence] = useState<Presence | null>(null);
  const [presenceError, setPresenceError] = useState<TableCallError | null>(null);
  const [panel, setPanel] = useState<Panel>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [notice, setNotice] = useState<Notice>(null);
  const [lineProblems, setLineProblems] = useState<Record<string, string>>({});
  /** Un court message dans la barre : plat ajouté, panier pris par le serveur… */
  const [flash, setFlashText] = useState<string | null>(null);
  const flashTimer = useRef<number | undefined>(undefined);
  const setFlash = useCallback((text: string) => {
    setFlashText(text);
    window.clearTimeout(flashTimer.current);
    flashTimer.current = window.setTimeout(() => setFlashText(null), 4000);
  }, []);
  useEffect(() => () => window.clearTimeout(flashTimer.current), []);
  const [cooldowns, setCooldown] = useCooldowns(props.venueSlug);
  const tick = useTicker(panel === "call");

  /* ── Relire l'état de la table ─────────────────────────────────────────── */

  const hydrated = useRef(false);

  const refresh = useCallback(async () => {
    const startedAt = Date.now();
    const res = await callTable({ action: "presence", guestKey });
    if (!res.ok) {
      // Une coupure réseau n'efface pas ce qu'on savait ; un laissez-passer expiré, si.
      if (res.error === "no_pass") setPresence(null);
      setPresenceError(res.error);
      return;
    }
    setPresenceError(null);
    const p = res.value;
    setPresence(p);
    const local = cartState();
    // Premier regard : un panier déjà confié au serveur (autre onglet, stockage effacé) revient.
    if (!hydrated.current) {
      hydrated.current = true;
      if (local.lines.length === 0 && p.cart && p.cart.lines.length > 0) {
        cart.replace(
          p.cart.lines.map((l) => ({
            productId: l.productId,
            ...(l.variantId ? { variantId: l.variantId } : {}),
            optionIds: l.optionIds,
            quantity: l.quantity,
            ...(l.instructions ? { instructions: l.instructions } : {}),
          })),
        );
        cart.markShown(p.orders.length);
        return;
      }
    }
    // Le panier montré a disparu chez le serveur : pris (une commande de plus) ou ignoré.
    // Seule une lecture commencée APRÈS l'envoi fait foi : une réponse en vol dirait « pas de panier ».
    const shownAt = local.shownAt;
    if (shownAt !== null && startedAt > shownAt && p.tableOpen && p.cart === null) {
      if (p.orders.length > (local.shownOrderCount ?? 0)) {
        cart.clear();
        setFlash(o.importedByWaiter);
      } else {
        cart.forgetShown();
        setFlash(o.dismissedByWaiter);
      }
    }
  }, [guestKey, o, setFlash]);

  const waiting =
    state.shownSignature !== null || state.pendingSubmitKey !== null || (presence?.orders.some((x) => x.status === "pending_acceptance") ?? false);

  useEffect(() => {
    if (!online) return;
    let timer: number | undefined;
    let stopped = false;
    const loop = async () => {
      if (!document.hidden) await refresh();
      if (!stopped) timer = window.setTimeout(loop, waiting ? POLL_WAITING_MS : POLL_IDLE_MS);
    };
    void loop();
    const onVisible = () => {
      if (!document.hidden) void refresh();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      stopped = true;
      window.clearTimeout(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [online, waiting, refresh]);

  /* ── Retour visuel d'un ajout ──────────────────────────────────────────── */

  useEffect(() => {
    const onAdded = (e: Event) => setFlash(o.added((e as CustomEvent<string>).detail));
    window.addEventListener(GUEST_ADDED_EVENT, onAdded);
    return () => window.removeEventListener(GUEST_ADDED_EVENT, onAdded);
  }, [o, setFlash]);

  /* ── Les lignes, chiffrées par la même règle que le serveur ────────────── */

  const priced = useMemo(
    () =>
      state.lines.map((line, i) => {
        const result = priceLine({ ...line, courseNumber: 1 }, i, published, props.live, props.now, venue.timezone);
        const found = published.get(line.productId);
        const product = found?.product;
        const name = product ? localized(product, locale).name : line.productId;
        const variant = product?.variants.find((v) => v.id === line.variantId);
        const options = line.optionIds.map((id) => {
          for (const g of product?.modifierGroups ?? []) {
            const opt = g.options.find((x) => x.id === id);
            if (opt) return localized(opt, locale).name;
          }
          return null;
        });
        const details = [variant ? localized(variant, locale).name : null, ...options].filter((x): x is string => x !== null);
        return {
          line,
          name,
          details,
          total: "line" in result ? result.line.lineTotal : null,
          problem: lineProblems[line.key] ?? ("problem" in result ? problemText(result.problem.code, o) : null),
        };
      }),
    [state.lines, published, props.live, props.now, venue.timezone, locale, lineProblems, o],
  );
  const itemCount = state.lines.reduce((s, l) => s + l.quantity, 0);
  const total = priced.reduce((s, p) => s + (p.total ?? 0), 0);
  const hasProblem = priced.some((p) => p.problem !== null);
  const shown = state.shownSignature !== null;
  const changedSinceShown = shown && state.shownSignature !== cartSignature(state.lines);
  const orders = presence?.orders ?? [];
  const pending = orders.filter((x) => x.status === "pending_acceptance");
  const canSend = presence?.canSend ?? false;

  /* ── Gestes ────────────────────────────────────────────────────────────── */

  const wire = (lines: readonly CartLine[]) =>
    lines.map((l) => ({
      productId: l.productId,
      ...(l.variantId ? { variantId: l.variantId } : {}),
      optionIds: l.optionIds,
      quantity: l.quantity,
      ...(l.instructions ? { instructions: l.instructions } : {}),
    }));

  /** Confie le panier à Convex. `true` si toutes les lignes ont été prises. */
  const save = async (): Promise<boolean> => {
    const lines = cartState().lines;
    const res = await callTable({ action: "saveCart", guestKey, lines: wire(lines) });
    if (!res.ok) {
      setNotice({ tone: "error", text: callErrorText(res.error, o) });
      return false;
    }
    const r = res.value;
    if (!r.ok) {
      const text =
        r.reason === "table_not_open"
          ? `${o.tableClosedTitle}. ${o.tableClosedText}`
          : r.reason === "full"
            ? o.full
            : r.reason === "invalid_pass"
              ? o.noPass
              : r.reason === "rate_limited"
                ? o.rateLimited(Math.ceil(r.retryAfter / 1000))
                : o.completeChoices;
      setNotice({ tone: "error", text });
      return false;
    }
    if (r.problems.length > 0) {
      const byKey: Record<string, string> = {};
      for (const p of r.problems) {
        const line = lines[p.index];
        if (line) byKey[line.key] = problemText(p.code, o);
      }
      setLineProblems(byKey);
      setNotice({ tone: "error", text: o.problemsRemoved });
      return false;
    }
    setLineProblems({});
    return true;
  };

  const showWaiter = async () => {
    if (!online) return setNotice({ tone: "error", text: o.offlineSend });
    setBusy("show");
    setNotice(null);
    try {
      if (await save()) {
        cart.markShown(orders.length);
        void refresh();
      }
    } finally {
      setBusy(null);
    }
  };

  const send = async () => {
    if (!online) return setNotice({ tone: "error", text: o.offlineSend });
    setBusy("send");
    setNotice(null);
    try {
      const resumed = cartState().pendingSubmitKey !== null;
      const idempotencyKey = cart.beginSubmit();
      // Un envoi interrompu se rejoue d'abord tel quel : s'il était passé, la même commande revient,
      // sans reconstituer chez le serveur un panier déjà parti.
      let res = resumed ? await callTable({ action: "submitCart", guestKey, idempotencyKey }) : null;
      if (!res || (res.ok && !res.value.ok && res.value.reason === "empty")) {
        if (!(await save())) {
          cart.cancelSubmit();
          return;
        }
        res = await callTable({ action: "submitCart", guestKey, idempotencyKey });
      }
      if (!res.ok) {
        // Pas de réponse : la clé est gardée, le prochain essai rejoue le même envoi.
        setNotice({ tone: "error", text: callErrorText(res.error, o) });
        return;
      }
      const r = res.value;
      if (r.ok) {
        cart.clear();
        setLineProblems({});
        setNotice({ tone: "info", text: o.sent(r.reference) });
        setPanel("orders");
        void refresh();
        return;
      }
      cart.cancelSubmit();
      if (r.reason === "rate_limited") setNotice({ tone: "error", text: o.rateLimited(Math.ceil(r.retryAfter / 1000)) });
      else if (r.reason === "problems") {
        const lines = cartState().lines;
        const byKey: Record<string, string> = {};
        for (const p of r.problems) {
          const line = lines[p.index];
          if (line) byKey[line.key] = problemText(p.code, o);
        }
        setLineProblems(byKey);
        setNotice({ tone: "error", text: o.problemsRemoved });
      } else if (r.reason === "invalid_pass") setNotice({ tone: "error", text: o.noPass });
      else if (r.reason === "table_not_open") setNotice({ tone: "error", text: `${o.tableClosedTitle}. ${o.tableClosedText}` });
      else if (r.reason === "full") setNotice({ tone: "error", text: o.full });
      else {
        // `not_allowed` : l'établissement a changé de conduite entre-temps ; on relit.
        setNotice({ tone: "error", text: o.networkError });
        void refresh();
      }
    } finally {
      setBusy(null);
    }
  };

  const requestService = async (type: string) => {
    if (!online) return setNotice({ tone: "error", text: o.offlineSend });
    setBusy(`call:${type}`);
    setNotice(null);
    try {
      const res = await callTable({ action: "requestService", guestKey, type });
      if (!res.ok) return setNotice({ tone: "error", text: callErrorText(res.error, o) });
      const r = res.value;
      if (r.ok) {
        setCooldown(type, Date.now() + r.retryAfter);
        setNotice({ tone: "info", text: r.already ? o.alreadyAsked : o.requestSent });
      } else if (r.reason === "rate_limited") {
        setNotice({ tone: "error", text: o.rateLimited(Math.ceil(r.retryAfter / 1000)) });
      } else if (r.reason === "invalid_pass") {
        setNotice({ tone: "error", text: o.noPass });
      } else {
        setNotice({ tone: "error", text: o.networkError });
        void refresh();
      }
    } finally {
      setBusy(null);
    }
  };

  const setQuantity = (key: string, q: number) => {
    setLineProblems((prev) => {
      const { [key]: _, ...rest } = prev;
      return rest;
    });
    cart.setQuantity(key, q);
  };

  const openPanel = (next: Panel) => {
    setNotice(null);
    setPanel(next);
  };

  /* ── Rendu ─────────────────────────────────────────────────────────────── */

  const noPass = presenceError === "no_pass";
  const statusLine = noPass
    ? o.noPass
    : pending.length > 0
      ? `${o.order(pending[pending.length - 1]!.reference)} · ${o.statusPendingText}`
      : shown && !changedSinceShown
        ? o.shownTitle
        : null;

  return (
    <>
      <div className="fixed inset-x-0 bottom-0 z-30 border-t bg-background/95 pb-[env(safe-area-inset-bottom)] backdrop-blur">
        <div className="mx-auto flex max-w-[960px] flex-col gap-2 px-4 py-3">
          {!online ? (
            <p className="flex items-center gap-2 text-sm text-muted-foreground">
              <WifiOffIcon className="size-4 shrink-0" />
              {o.offlineSend}
            </p>
          ) : flash ? (
            <p className="flex items-center gap-2 text-sm font-medium" role="status">
              <CheckIcon className="size-4 shrink-0" />
              {flash}
            </p>
          ) : statusLine ? (
            <p className="flex items-center gap-2 text-sm text-muted-foreground" role="status">
              {pending.length > 0 ? <ClockIcon className="size-4 shrink-0" /> : <CheckIcon className="size-4 shrink-0" />}
              <span className="min-w-0">{statusLine}</span>
            </p>
          ) : null}
          <div className="flex items-center gap-2">
            <Button type="button" variant="outline" size="lg" className="h-12" onClick={() => openPanel("call")}>
              <BellRingIcon data-icon="inline-start" />
              {o.call}
            </Button>
            {orders.length > 0 ? (
              <Button type="button" variant="outline" size="lg" className="h-12" onClick={() => openPanel("orders")} aria-label={`${o.myOrders} (${orders.length})`}>
                <ReceiptTextIcon data-icon="inline-start" />
                {state.lines.length === 0 ? o.myOrders : orders.length}
              </Button>
            ) : null}
            {state.lines.length > 0 ? (
              <Button type="button" size="lg" className="h-12 min-w-0 flex-1 justify-between gap-3" onClick={() => openPanel("cart")}>
                <span className="flex min-w-0 items-center gap-2">
                  <ShoppingBagIcon />
                  <span className="truncate">
                    {o.myCart} · {o.items(itemCount)}
                  </span>
                </span>
                <span className="shrink-0 tabular-nums">{money(total, venue.currency)}</span>
              </Button>
            ) : null}
          </div>
        </div>
      </div>

      {/* ── Le panier ── */}
      <Drawer open={panel === "cart"} onOpenChange={(open) => !open && setPanel(null)}>
        <DrawerContent className="mx-auto max-w-2xl">
          <DrawerHeader className="text-left">
            <DrawerTitle className="text-xl font-semibold tracking-tight">{o.cartTitle}</DrawerTitle>
            <DrawerDescription>{o.priceNote}</DrawerDescription>
          </DrawerHeader>
          <div className="min-h-0 flex-1 overflow-y-auto px-4">
            {state.lines.length === 0 ? (
              <Empty className="py-6">
                <EmptyHeader>
                  <EmptyMedia variant="icon">
                    <ShoppingBagIcon />
                  </EmptyMedia>
                  <EmptyDescription>{o.cartEmpty}</EmptyDescription>
                </EmptyHeader>
              </Empty>
            ) : (
              <ItemGroup className="gap-2">
                {priced.map(({ line, name, details, total: lineTotal, problem }) => (
                  <Item key={line.key} role="listitem" variant="outline" className="flex-wrap">
                    <ItemContent className="min-w-0">
                      <ItemTitle className="text-base">{name}</ItemTitle>
                      {details.length > 0 ? <ItemDescription>{details.join(" · ")}</ItemDescription> : null}
                      {line.instructions ? <ItemDescription className="italic">« {line.instructions} »</ItemDescription> : null}
                      {problem ? <p className="text-sm text-destructive">{problem}</p> : null}
                    </ItemContent>
                    <ItemActions className="tabular-nums">{lineTotal !== null ? money(lineTotal, venue.currency) : "—"}</ItemActions>
                    <ItemFooter>
                      <ButtonGroup aria-label={`${o.quantity} — ${name}`}>
                        <Button type="button" variant="outline" size="icon-lg" className="size-10" aria-label={o.less} onClick={() => setQuantity(line.key, line.quantity - 1)}>
                          <MinusIcon />
                        </Button>
                        <ButtonGroupText className="min-w-10 justify-center tabular-nums">{line.quantity}</ButtonGroupText>
                        <Button
                          type="button"
                          variant="outline"
                          size="icon-lg"
                          className="size-10"
                          aria-label={o.more}
                          disabled={line.quantity >= CART_LIMITS.quantity}
                          onClick={() => setQuantity(line.key, line.quantity + 1)}
                        >
                          <PlusIcon />
                        </Button>
                      </ButtonGroup>
                      <Button type="button" variant="ghost" size="lg" className="h-10" onClick={() => setQuantity(line.key, 0)}>
                        <Trash2Icon data-icon="inline-start" />
                        {o.remove}
                      </Button>
                    </ItemFooter>
                  </Item>
                ))}
              </ItemGroup>
            )}

            {state.lines.length > 0 ? (
              <>
                <Separator className="my-4" />
                <div className="flex items-baseline justify-between gap-4">
                  <span className="font-medium">{o.estimatedTotal}</span>
                  <span className="text-lg font-semibold tabular-nums">{money(total, venue.currency)}</span>
                </div>
              </>
            ) : null}

            <div className="mt-4 flex flex-col gap-3 pb-2">
              {!online ? (
                <Alert>
                  <WifiOffIcon />
                  <AlertDescription>{o.offlineSend}</AlertDescription>
                </Alert>
              ) : null}
              {noPass ? (
                <Alert variant="destructive">
                  <AlertDescription>{o.noPass}</AlertDescription>
                </Alert>
              ) : presence && !presence.tableOpen ? (
                <Alert>
                  <AlertTitle>{o.tableClosedTitle}</AlertTitle>
                  <AlertDescription>{o.tableClosedText}</AlertDescription>
                </Alert>
              ) : null}
              {!canSend && shown && !changedSinceShown ? (
                <Alert>
                  <CheckIcon />
                  <AlertTitle>{o.shownTitle}</AlertTitle>
                  <AlertDescription>{o.shownText}</AlertDescription>
                </Alert>
              ) : null}
              {!canSend && changedSinceShown ? (
                <Alert>
                  <AlertDescription>{o.changedSinceShown}</AlertDescription>
                </Alert>
              ) : null}
              {canSend && state.lines.length > 0 ? <p className="text-sm text-muted-foreground">{o.sendNote}</p> : null}
              {notice ? (
                <Alert variant={notice.tone === "error" ? "destructive" : "default"} role={notice.tone === "error" ? "alert" : "status"}>
                  <AlertDescription>{notice.text}</AlertDescription>
                </Alert>
              ) : null}
            </div>
          </div>
          <DrawerFooter>
            {state.lines.length > 0 && presence ? (
              canSend ? (
                <Button type="button" size="lg" className="h-12" disabled={!online || busy !== null || hasProblem || noPass || !presence.tableOpen} onClick={() => void send()}>
                  {busy === "send" ? <Spinner data-icon="inline-start" /> : null}
                  {o.send} · {money(total, venue.currency)}
                </Button>
              ) : shown && !changedSinceShown ? null : (
                <Button
                  type="button"
                  size="lg"
                  className="h-12"
                  disabled={!online || busy !== null || hasProblem || noPass || !presence.tableOpen}
                  onClick={() => void showWaiter()}
                >
                  {busy === "show" ? <Spinner data-icon="inline-start" /> : null}
                  {shown ? o.showAgain : o.showWaiter}
                </Button>
              )
            ) : state.lines.length > 0 && !presence && !noPass ? (
              <Button type="button" size="lg" className="h-12" disabled>
                <Spinner data-icon="inline-start" />
                {o.loading}
              </Button>
            ) : null}
            {presence && !presence.tableOpen && !noPass ? (
              <Button type="button" variant="secondary" size="lg" className="h-11" onClick={() => openPanel("call")}>
                <BellRingIcon data-icon="inline-start" />
                {o.call}
              </Button>
            ) : null}
            <DrawerClose asChild>
              <Button type="button" variant="outline" size="lg" className="h-11">
                {o.close}
              </Button>
            </DrawerClose>
          </DrawerFooter>
        </DrawerContent>
      </Drawer>

      {/* ── Appeler ── */}
      <Drawer open={panel === "call"} onOpenChange={(open) => !open && setPanel(null)}>
        <DrawerContent className="mx-auto max-w-2xl">
          <DrawerHeader className="text-left">
            <DrawerTitle className="text-xl font-semibold tracking-tight">{o.callTitle}</DrawerTitle>
            <DrawerDescription>{o.callDescription}</DrawerDescription>
          </DrawerHeader>
          <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto px-4 pb-2">
            {noPass ? (
              <Alert variant="destructive">
                <AlertDescription>{o.noPass}</AlertDescription>
              </Alert>
            ) : !presence ? (
              <p className="flex items-center gap-2 py-4 text-muted-foreground">
                <Spinner />
                {o.loading}
              </p>
            ) : presence.requestTypes.length === 0 ? (
              <p className="py-4 text-muted-foreground">{o.noRequestTypes}</p>
            ) : (
              presence.requestTypes.map((type) => {
                const remaining = Math.ceil(((cooldowns[type.key] ?? 0) - tick) / 1000);
                const waitingType = remaining > 0;
                return (
                  <div key={type.key} className="flex flex-col gap-1">
                    <Button
                      type="button"
                      variant={waitingType ? "secondary" : "outline"}
                      size="lg"
                      className="h-12 justify-start"
                      disabled={!online || busy !== null || waitingType}
                      onClick={() => void requestService(type.key)}
                    >
                      {busy === `call:${type.key}` ? <Spinner data-icon="inline-start" /> : waitingType ? <CheckIcon data-icon="inline-start" /> : <BellRingIcon data-icon="inline-start" />}
                      {type.label}
                    </Button>
                    {waitingType ? <p className="px-1 text-sm text-muted-foreground">{o.waitBefore(o.duration(remaining))}</p> : null}
                  </div>
                );
              })
            )}
            {!online ? (
              <Alert>
                <WifiOffIcon />
                <AlertDescription>{o.offlineSend}</AlertDescription>
              </Alert>
            ) : null}
            {notice ? (
              <Alert variant={notice.tone === "error" ? "destructive" : "default"} role={notice.tone === "error" ? "alert" : "status"}>
                {notice.tone === "info" ? <CheckIcon /> : null}
                <AlertDescription>{notice.text}</AlertDescription>
              </Alert>
            ) : null}
          </div>
          <DrawerFooter>
            <DrawerClose asChild>
              <Button type="button" variant="outline" size="lg" className="h-11">
                {o.close}
              </Button>
            </DrawerClose>
          </DrawerFooter>
        </DrawerContent>
      </Drawer>

      {/* ── Mes commandes ── */}
      <Drawer open={panel === "orders"} onOpenChange={(open) => !open && setPanel(null)}>
        <DrawerContent className="mx-auto max-w-2xl">
          <DrawerHeader className="text-left">
            <DrawerTitle className="text-xl font-semibold tracking-tight">{o.ordersTitle}</DrawerTitle>
          </DrawerHeader>
          <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto px-4 pb-2">
            {notice ? (
              <Alert variant={notice.tone === "error" ? "destructive" : "default"} role={notice.tone === "error" ? "alert" : "status"}>
                <AlertDescription>{notice.text}</AlertDescription>
              </Alert>
            ) : null}
            {orders.length === 0 ? (
              <p className="py-4 text-muted-foreground">{o.ordersEmpty}</p>
            ) : (
              <ItemGroup className="gap-2">
                {[...orders].reverse().map((order) => (
                  <OrderItem key={order.reference} order={order} o={o} />
                ))}
              </ItemGroup>
            )}
          </div>
          <DrawerFooter>
            <DrawerClose asChild>
              <Button type="button" variant="outline" size="lg" className="h-11">
                {o.close}
              </Button>
            </DrawerClose>
          </DrawerFooter>
        </DrawerContent>
      </Drawer>
    </>
  );
}

type GuestOrder = Presence["orders"][number];

function orderStatus(order: GuestOrder, o: OrderText): { label: string; detail: string | null; variant: "default" | "secondary" | "outline" | "destructive" } {
  switch (order.status) {
    case "pending_acceptance":
      return { label: o.statusPending, detail: o.statusPendingText, variant: "outline" };
    case "accepted":
      return { label: o.statusAccepted, detail: null, variant: "secondary" };
    case "in_preparation":
    case "partially_ready":
      return { label: o.statusInPreparation, detail: null, variant: "secondary" };
    case "ready":
      return { label: o.statusReady, detail: null, variant: "default" };
    case "partially_served":
    case "served":
      return { label: o.statusServed, detail: null, variant: "secondary" };
    case "rejected":
      return order.expired
        ? { label: o.statusExpired, detail: o.statusExpiredText, variant: "destructive" }
        : { label: o.statusRejected, detail: order.rejectedReason ? `${o.reason} : ${order.rejectedReason}` : null, variant: "destructive" };
    case "cancelled":
      return { label: o.statusCancelled, detail: null, variant: "destructive" };
    default:
      return { label: order.label, detail: null, variant: "secondary" };
  }
}

function OrderItem({ order, o }: { order: GuestOrder; o: OrderText }) {
  const status = orderStatus(order, o);
  return (
    <Item role="listitem" variant="outline">
      <ItemContent className="min-w-0">
        <ItemTitle className="text-base">{o.order(order.reference)}</ItemTitle>
        {order.items.length > 0 ? <ItemDescription>{order.items.map((i) => `${i.quantity} × ${i.name}`).join(" · ")}</ItemDescription> : null}
        {status.detail ? <p className="text-sm text-muted-foreground">{status.detail}</p> : null}
      </ItemContent>
      <ItemActions>
        <Badge variant={status.variant}>{status.label}</Badge>
      </ItemActions>
    </Item>
  );
}
