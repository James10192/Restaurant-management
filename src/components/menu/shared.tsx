import { useEffect, useState, type ReactNode } from "react";
import { Link, useLocation } from "@tanstack/react-router";
import { CircleAlert } from "lucide-react";
import { useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { formatMoney, type CurrencyCode } from "../../../convex/lib/money";
import { parsePrice } from "../../../convex/lib/menuImport";
import { useWorkspace } from "~/components/app/workspace";
import { PendingButton } from "~/components/app/pending-button";
import { Alert, AlertDescription } from "~/components/ui/alert";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "~/components/ui/alert-dialog";
import { InputGroup, InputGroupAddon, InputGroupInput, InputGroupText } from "~/components/ui/input-group";
import { Tabs, TabsList, TabsTrigger } from "~/components/ui/tabs";
import { describeError } from "~/lib/errors";

/**
 * Pièces communes aux écrans de la carte — Joliba (IA §4.11)
 *
 * Les droits viennent du serveur et servent ici à MASQUER ; c'est le serveur qui refuse.
 */

export function formatPrice(amount: number, currency: string): string {
  return formatMoney({ amount, currency: currency as CurrencyCode });
}

const menuKey = (venueId: string) => `joliba.carte.${venueId}`;

/** La carte choisie, mémorisée par établissement sur l'appareil. */
export function useSelectedMenu(venueId: Id<"venues"> | undefined, enabled = true) {
  const menus = useQuery(api.menus.list, venueId && enabled ? { venueId } : "skip");
  const [preferred, setPreferred] = useState<string | null>(null);
  useEffect(() => {
    if (!venueId) return;
    try {
      setPreferred(localStorage.getItem(menuKey(venueId)));
    } catch {
      /* sans stockage, la première carte */
    }
  }, [venueId]);
  const selected = menus?.find((m) => m._id === preferred) ?? menus?.[0] ?? null;
  const select = (id: Id<"menus">) => {
    setPreferred(id);
    try {
      if (venueId) localStorage.setItem(menuKey(venueId), id);
    } catch {
      /* rien */
    }
  };
  return { menus, selected, select };
}

/**
 * Les écrans enfants de la carte, montrés selon les droits. L'aspect est celui des `Tabs`
 * officiels (variante « line ») mais chaque onglet est un vrai lien du routeur : l'écran actif
 * vient de l'adresse, et on rend aux éléments leur sémantique de navigation (des liens dans un
 * `nav`, `aria-current` posé par le routeur) plutôt que des onglets sans panneau.
 */
export function MenuTabs() {
  const w = useWorkspace();
  const pathname = useLocation({ select: (l) => l.pathname });
  const read = w.canInVenue("menu.read");
  const tabs = [
    { to: "/app/menu", label: "Carte", show: read, exact: true },
    { to: "/app/menu/products", label: "Produits", show: read, exact: false },
    { to: "/app/menu/categories", label: "Sections", show: read, exact: false },
    { to: "/app/menu/options", label: "Options", show: read, exact: false },
    { to: "/app/menu/availability", label: "Disponibilité", show: w.canInVenue("menu.availability.toggle"), exact: false },
  ] as const;
  const visible = tabs.filter((t) => t.show);
  if (visible.length < 2) return null;
  const path = pathname.replace(/\/+$/, "") || "/";
  const active = visible.find((t) => (t.exact ? path === t.to : path === t.to || path.startsWith(`${t.to}/`)))?.to ?? "";
  return (
    <nav aria-label="Carte" className="-mx-1 mb-6 overflow-x-auto px-1 pb-1.5">
      <Tabs value={active} activationMode="manual">
        <TabsList variant="line" role={undefined} aria-orientation={undefined}>
          {visible.map((tab) => (
            <TabsTrigger
              key={tab.to}
              value={tab.to}
              asChild
              role={undefined}
              type={undefined}
              aria-selected={undefined}
              aria-controls={undefined}
              className="flex-none px-2.5"
            >
              <Link to={tab.to} activeOptions={{ exact: tab.exact }}>
                {tab.label}
              </Link>
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>
    </nav>
  );
}

export function PageHeader({ title, description, actions }: { title: string; description?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
      <div className="flex min-w-0 flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
        {description ? <p className="text-muted-foreground">{description}</p> : null}
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
    </div>
  );
}

/**
 * Un prix saisi comme on l'écrit (« 2 500 », « 2.500 F ») : relu par le même analyseur que
 * l'import CSV, donc les mêmes règles — pas de centimes en franc CFA.
 */
export function PriceInput({
  currency,
  value,
  onChange,
  allowNegative = false,
  ...props
}: {
  currency: string;
  value: number | null;
  onChange: (value: number | null) => void;
  allowNegative?: boolean;
  id?: string;
  disabled?: boolean;
  "aria-describedby"?: string;
  "aria-invalid"?: boolean;
  "aria-label"?: string;
}) {
  const [text, setText] = useState(value === null ? "" : formatPlain(value, currency));
  useEffect(() => {
    // Suit la valeur venue d'ailleurs (serveur, remise à zéro) sans écraser une saisie en cours.
    const parsed = parseSigned(text, currency, allowNegative);
    if (parsed !== value) setText(value === null ? "" : formatPlain(value, currency));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, currency]);
  return (
    <InputGroup>
      <InputGroupInput
        {...props}
        inputMode="decimal"
        autoComplete="off"
        value={text}
        onChange={(e) => {
          setText(e.target.value);
          onChange(parseSigned(e.target.value, currency, allowNegative));
        }}
        className="tabular-nums"
      />
      <InputGroupAddon align="inline-end" aria-hidden="true">
        <InputGroupText>{currency === "XOF" || currency === "XAF" ? "FCFA" : currency}</InputGroupText>
      </InputGroupAddon>
    </InputGroup>
  );
}

function parseSigned(text: string, currency: string, allowNegative: boolean): number | null {
  const trimmed = text.trim();
  if (trimmed === "") return null;
  if (allowNegative && trimmed.startsWith("-")) {
    const parsed = parsePrice(trimmed.slice(1), currency);
    return parsed === null ? null : -parsed;
  }
  return parsePrice(trimmed.replace(/^\+/, ""), currency);
}

function formatPlain(amount: number, currency: string): string {
  const exponent = currency === "XOF" || currency === "XAF" ? 0 : 2;
  return new Intl.NumberFormat("fr-FR", { minimumFractionDigits: exponent, maximumFractionDigits: exponent })
    .format(amount / 10 ** exponent)
    .replace(/[\u202f\u00a0]/g, " ");
}

/**
 * Une confirmation qui dit la conséquence, pas « Êtes-vous sûr ? » (DESIGN §9.3). Le bouton
 * reste occupé pendant l'envoi : un double clic ne fait pas deux fois la chose.
 */
export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel,
  danger = false,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: ReactNode;
  confirmLabel: string;
  danger?: boolean;
  onConfirm: () => Promise<void>;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  return (
    <AlertDialog
      open={open}
      onOpenChange={(next) => {
        if (busy) return;
        setError(null);
        onOpenChange(next);
      }}
    >
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
        </AlertDialogHeader>
        {error ? (
          <Alert variant="destructive">
            <CircleAlert />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        ) : null}
        <AlertDialogFooter>
          <AlertDialogCancel variant="ghost" disabled={busy}>
            Annuler
          </AlertDialogCancel>
          {/* Pas d'`AlertDialogAction` : elle fermerait la fenêtre avant la réponse du serveur. */}
          <PendingButton
            variant={danger ? "destructive" : "default"}
            pending={busy}
            pendingText="Un instant…"
            onClick={async () => {
              setBusy(true);
              setError(null);
              try {
                await onConfirm();
                onOpenChange(false);
              } catch (e) {
                setError(describeError(e).message);
              } finally {
                setBusy(false);
              }
            }}
          >
            {confirmLabel}
          </PendingButton>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

/** Déplace un élément d'une place dans une liste : l'alternative clavier au glisser-déposer. */
export function moved<T>(items: readonly T[], index: number, delta: -1 | 1): T[] | null {
  const target = index + delta;
  if (target < 0 || target >= items.length) return null;
  const next = [...items];
  [next[index], next[target]] = [next[target]!, next[index]!];
  return next;
}
