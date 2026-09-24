import { useEffect, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import { ArrowDownToLine, ArrowLeft, ArrowUpFromLine, Calculator, CircleAlert, Lock, Wallet } from "lucide-react";
import { toast } from "sonner";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { EmptyState, LoadingState } from "~/components/app/states";
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
import { ActionButton } from "~/components/service/action-button";
import { useOptionalOutbox } from "~/components/service/outbox-provider";
import { useMoney, useServiceScope } from "~/components/service/service-scope";
import { Alert, AlertDescription } from "~/components/ui/alert";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "~/components/ui/alert-dialog";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { Card, CardAction, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "~/components/ui/card";
import { Input } from "~/components/ui/input";
import { Item, ItemActions, ItemContent, ItemDescription, ItemGroup, ItemTitle } from "~/components/ui/item";
import { describeError } from "~/lib/errors";
import { amountToText, parseAmount } from "./amount";
import { PaymentDialog } from "./payment-dialog";
import { ReasonDialog } from "./reason-dialog";

type Overview = FunctionReturnType<typeof api.cash.overview>;
type CashSession = Overview["sessions"][number];
type OpenTarget = { registerId: Id<"cashRegisters"> | null; label: string; suggestedFloat: number | null };

const STATUS: Record<CashSession["status"], { label: string; variant: "default" | "secondary" | "outline" | "destructive" }> = {
  open: { label: "Ouverte", variant: "secondary" },
  counting: { label: "Comptage en cours", variant: "default" },
  balanced: { label: "Juste", variant: "secondary" },
  discrepancy: { label: "Écart", variant: "destructive" },
  closed: { label: "Close", variant: "outline" },
};
const time = new Intl.DateTimeFormat("fr-FR", { hour: "2-digit", minute: "2-digit" });

/**
 * La caisse : ouvrir avec son fonds, sortir ou rentrer de l'argent avec un motif, compter À
 * L'AVEUGLE (l'attendu n'apparaît qu'après la saisie du compté), clôturer — avec l'écart s'il y en
 * a un, et son motif. Une pochette se fait compter par quelqu'un d'autre que son porteur.
 */
export function CashScreen() {
  const scope = useServiceScope();
  const money = useMoney();
  const overview = useQuery(api.cash.overview, { venueId: scope.venueId });
  const [opening, setOpening] = useState<OpenTarget | null>(null);

  if (overview === undefined) return <LoadingState />;
  const mine = overview.sessions.find((s) => s.isMine);
  const freeRegisters = overview.registers.filter((r) => !r.busy);

  return (
    <div className="flex flex-col gap-4 pb-8">
      <div className="flex flex-wrap items-center gap-2">
        <Button variant="ghost" size="icon" aria-label="Retour aux tables" onClick={scope.nav.board}>
          <ArrowLeft />
        </Button>
        <div className="min-w-0 flex-1">
          <h1 className="text-2xl font-semibold tracking-tight">Caisse</h1>
          <p className="text-sm text-muted-foreground">
            {overview.mode === "per_waiter"
              ? "Chacun encaisse dans sa pochette, comptée en fin de service par un responsable."
              : "Les espèces vont dans le tiroir ouvert, quel que soit celui qui encaisse."}
          </p>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {overview.can.openOwnPouch && !mine ? (
          <Button size="lg" onClick={() => setOpening({ registerId: null, label: "ma pochette", suggestedFloat: null })}>
            <Wallet />
            Ouvrir ma pochette
          </Button>
        ) : null}
        {overview.can.openDrawer && overview.registers.length === 0 ? (
          <Button size="lg" onClick={() => setOpening({ registerId: null, label: "la caisse principale", suggestedFloat: null })}>
            <Wallet />
            Ouvrir la caisse
          </Button>
        ) : null}
        {overview.can.openDrawer
          ? freeRegisters.map((r) => (
              <Button key={r._id} size="lg" variant={freeRegisters.length > 1 ? "outline" : "default"} onClick={() => setOpening({ registerId: r._id, label: r.name, suggestedFloat: r.lastCounted })}>
                <Wallet />
                Ouvrir {r.name}
              </Button>
            ))
          : null}
      </div>

      {overview.sessions.length === 0 ? (
        <EmptyState title="Aucune caisse ouverte" description="Ouvrez une caisse avec son fonds de départ avant d'encaisser des espèces." />
      ) : (
        overview.sessions.map((s) => <CashCard key={s._id} session={s} overview={overview} />)
      )}

      {overview.closed.length > 0 ? (
        <Card size="sm">
          <CardHeader>
            <CardTitle>Clôturées récemment</CardTitle>
            <CardDescription>Les dernières 36 heures.</CardDescription>
          </CardHeader>
          <CardContent>
            <ItemGroup className="gap-1">
              {overview.closed.map((s) => (
                <Item key={s._id} size="sm" className="py-1">
                  <ItemContent>
                    <ItemTitle>{s.name}</ItemTitle>
                    <ItemDescription>
                      Close à {s.closedAt ? time.format(s.closedAt) : "?"} par {s.closedBy ?? "?"}
                      {s.closeReason ? ` · ${s.closeReason}` : ""}
                    </ItemDescription>
                  </ItemContent>
                  <ItemActions>
                    {s.discrepancy === 0 ? <Badge variant="secondary">Juste</Badge> : <Badge variant="destructive">Écart {money(s.discrepancy ?? 0)}</Badge>}
                  </ItemActions>
                </Item>
              ))}
            </ItemGroup>
          </CardContent>
        </Card>
      ) : null}

      {scope.can("payment.collect") ? <DebtsCard /> : null}

      <OpenDialog target={opening} onClose={() => setOpening(null)} />
    </div>
  );
}

const day = new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "short" });

/**
 * Les tables parties sans payer, tant que la dette n'est pas éteinte. Le client revient : on
 * encaisse ici, comme à table — espèces dans la caisse ouverte, portefeuille nommé.
 */
function DebtsCard() {
  const scope = useServiceScope();
  const money = useMoney();
  const debts = useQuery(api.sessions.debts, { venueId: scope.venueId });
  const [collecting, setCollecting] = useState<Id<"tableSessions"> | null>(null);
  if (!debts || debts.length === 0) return null;
  return (
    <Card size="sm">
      <CardHeader>
        <CardTitle>Impayés à recouvrer</CardTitle>
        <CardDescription>Le client revient payer : encaissez ici. La dette s'éteint à zéro, et le rapport le dit.</CardDescription>
      </CardHeader>
      <CardContent>
        <ItemGroup className="gap-1">
          {debts.map((d) => (
            <Item key={d._id} size="sm" variant="outline">
              <ItemContent>
                <ItemTitle>
                  Table {d.table} · {money(d.owed)}
                </ItemTitle>
                <ItemDescription>
                  Partie le {day.format(d.closedAt)}
                  {d.reason ? ` · ${d.reason}` : ""}
                  {d.owed < d.debtAmount ? ` · déjà recouvré ${money(d.debtAmount - d.owed)}` : ""}
                </ItemDescription>
              </ItemContent>
              <ItemActions>
                <Button size="sm" onClick={() => setCollecting(d._id)}>
                  <Wallet />
                  Encaisser
                </Button>
              </ItemActions>
            </Item>
          ))}
        </ItemGroup>
      </CardContent>
      {collecting ? <DebtPayment sessionId={collecting} onClose={() => setCollecting(null)} /> : null}
    </Card>
  );
}

function DebtPayment({ sessionId, onClose }: { sessionId: Id<"tableSessions">; onClose: () => void }) {
  const scope = useServiceScope();
  const bill = useQuery(api.checks.forSession, { venueId: scope.venueId, sessionId });
  if (!bill) return null;
  const check = bill.checks.find((c) => c.balance.due > 0) ?? null;
  return <PaymentDialog bill={bill} check={check} open={check !== null} onOpenChange={(o) => !o && onClose()} />;
}

function CashCard({ session: s, overview }: { session: CashSession; overview: Overview }) {
  const scope = useServiceScope();
  const money = useMoney();
  const startCount = useMutation(api.cash.startCount);
  const cancelCount = useMutation(api.cash.cancelCount);
  const [confirmCount, setConfirmCount] = useState(false);
  const online = useOptionalOutbox()?.online ?? true;
  const addMovement = useMutation(api.cash.addMovement);
  const close = useMutation(api.cash.close);
  const [movement, setMovement] = useState<"payout" | "deposit" | null>(null);
  const [counting, setCounting] = useState(false);
  const [closing, setClosing] = useState(false);
  const status = STATUS[s.status];
  const holderIsMe = s.isMine;
  const canCount = overview.can.count && !holderIsMe;
  const canDeposit = s.status === "open" && (holderIsMe ? scope.can("payment.collect") : scope.can("cash_register.open"));
  // Une sortie d'argent : depuis un compte, ou sur la pochette d'un autre (D-082). Le serveur tranche.
  const canPayout = s.status === "open" && scope.can("cash_register.open") && (overview.can.payoutFromAccount || (s.kind === "pouch" && !holderIsMe));
  // Recomptée juste après un premier écart : le premier écart reste, et il demande un motif.
  const recountedAway = s.status === "balanced" && (s.initialDiscrepancy ?? 0) !== 0;

  return (
    <Card>
      <CardHeader>
        <CardTitle>{s.name}</CardTitle>
        <CardDescription>
          Ouverte à {time.format(s.openedAt)} par {s.openedBy} · fonds {money(s.openingFloat)} · {s.paymentCount} encaissement{s.paymentCount > 1 ? "s" : ""}
        </CardDescription>
        <CardAction>
          <Badge variant={status.variant}>{status.label}</Badge>
        </CardAction>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {s.movements.length > 0 ? (
          <ItemGroup className="gap-1">
            {s.movements.map((m) => (
              <Item key={m._id} size="sm" className="py-1">
                <ItemContent>
                  <ItemTitle>{m.type === "payout" ? "Sortie" : "Entrée"} · {m.reason}</ItemTitle>
                  <ItemDescription>
                    {time.format(m.at)} · {m.by}
                  </ItemDescription>
                </ItemContent>
                <ItemActions>
                  <span className="tabular-nums">
                    {m.type === "payout" ? "−" : "+"}
                    {money(m.amount)}
                  </span>
                </ItemActions>
              </Item>
            ))}
          </ItemGroup>
        ) : null}
        {s.status === "counting" ? (
          <p className="text-sm text-muted-foreground">Plus aucun encaissement en espèces ne va dans cette caisse. Comptez l'argent, puis saisissez le total : l'attendu s'affichera ensuite.</p>
        ) : null}
        {s.expectedAmount !== null ? (
          <dl className="grid grid-cols-3 gap-2 rounded-lg border p-3 text-center">
            <div>
              <dt className="text-xs text-muted-foreground">Attendu</dt>
              <dd className="font-medium tabular-nums">{money(s.expectedAmount)}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">Compté</dt>
              <dd className="font-medium tabular-nums">{money(s.countedAmount ?? 0)}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">Écart</dt>
              <dd className={s.discrepancy ? "text-xl font-semibold text-destructive tabular-nums" : "text-xl font-semibold tabular-nums"}>
                {(s.discrepancy ?? 0) > 0 ? "+" : ""}
                {money(s.discrepancy ?? 0)}
              </dd>
            </div>
          </dl>
        ) : null}
        {s.counts.length > 1 ? (
          <p className="text-sm text-muted-foreground">
            Comptages : {s.counts.map((c) => `${money(c.amount)} (${c.by})`).join(" puis ")}
            {s.initialDiscrepancy ? ` · écart au premier comptage ${money(s.initialDiscrepancy)}` : ""}
          </p>
        ) : null}
        {holderIsMe && s.status !== "open" ? <p className="text-sm text-muted-foreground">Votre pochette est comptée par un responsable.</p> : null}
      </CardContent>
      <CardFooter className="flex flex-wrap gap-2">
        {canPayout ? (
          <Button variant="outline" onClick={() => setMovement("payout")}>
            <ArrowUpFromLine />
            Sortie
          </Button>
        ) : null}
        {canDeposit ? (
          <Button variant="outline" onClick={() => setMovement("deposit")}>
            <ArrowDownToLine />
            Entrée
          </Button>
        ) : null}
        {canCount && s.status === "open" ? (
          <Button disabled={!online} onClick={() => setConfirmCount(true)}>
            <Calculator />
            Commencer le comptage
          </Button>
        ) : null}
        {canCount && s.status === "counting" && s.counts.length === 0 ? (
          <ActionButton
            variant="ghost"
            onAction={async () => {
              try {
                await cancelCount({ ...scope.acting, sessionId: s._id });
                toast.success(`${s.name} : de nouveau ouverte.`);
              } catch (error) {
                toast.error(describeError(error).message);
              }
            }}
          >
            Annuler le comptage
          </ActionButton>
        ) : null}
        {canCount && (s.status === "counting" || (s.status === "discrepancy" && s.counts.length === 1)) ? (
          <Button onClick={() => setCounting(true)}>
            <Calculator />
            {s.status === "counting" ? "Saisir le compté" : "Recompter"}
          </Button>
        ) : null}
        {canCount && (s.status === "balanced" || s.status === "discrepancy") ? (
          s.status === "balanced" && !recountedAway ? (
            <ActionButton
              onAction={async () => {
                try {
                  await close({ ...scope.acting, sessionId: s._id });
                  toast.success(`${s.name} clôturée : la caisse tombe juste.`);
                } catch (error) {
                  toast.error(describeError(error).message);
                }
              }}
            >
              <Lock />
              Clôturer
            </ActionButton>
          ) : (
            <Button variant="destructive" onClick={() => setClosing(true)}>
              <Lock />
              {recountedAway ? "Clôturer" : "Clôturer avec l'écart"}
            </Button>
          )
        ) : null}
      </CardFooter>
      <ReasonDialog
        open={movement !== null}
        onOpenChange={(o) => !o && setMovement(null)}
        title={movement === "payout" ? "Sortie d'argent" : "Entrée d'argent"}
        description={movement === "payout" ? "Un achat payé en espèces : glace, charbon, monnaie." : "Un apport de monnaie dans la caisse."}
        confirmLabel="Enregistrer"
        amount={{ label: "Montant", parse: (t) => parseAmount(t, s.currency) }}
        onConfirm={async ({ reason, amount }) => {
          if (!movement || amount === null) return;
          await addMovement({ ...scope.acting, sessionId: s._id, type: movement, amount, reason });
          toast.success("Enregistré.");
          setMovement(null);
        }}
      />
      <ReasonDialog
        open={closing}
        onOpenChange={setClosing}
        title={recountedAway ? `Clôturer ${s.name}` : `Clôturer ${s.name} avec l'écart`}
        description={
          recountedAway
            ? `Le premier comptage montrait un écart de ${money(s.initialDiscrepancy ?? 0)}. Il reste au rapport, avec votre nom et ce motif.`
            : `Écart de ${money(s.discrepancy ?? 0)}. Il reste au rapport, avec votre nom et ce motif.`
        }
        confirmLabel="Clôturer"
        destructive
        onConfirm={async ({ reason }) => {
          await close({ ...scope.acting, sessionId: s._id, reason });
          toast.success(`${s.name} clôturée.`);
          setClosing(false);
        }}
      />
      <CountDialog session={s} open={counting} onOpenChange={setCounting} />
      <AlertDialog open={confirmCount} onOpenChange={setConfirmCount}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Commencer le comptage de {s.name} ?</AlertDialogTitle>
            <AlertDialogDescription>
              Plus aucune espèce n'entrera dans cette caisse{s.kind === "pouch" ? ", et son porteur ne pourra plus encaisser en espèces" : ""}. Tant que rien n'est saisi, vous pourrez annuler.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Pas encore</AlertDialogCancel>
            <AlertDialogAction
              onClick={async () => {
                try {
                  await startCount({ ...scope.acting, sessionId: s._id });
                } catch (error) {
                  toast.error(describeError(error).message);
                }
              }}
            >
              Commencer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}

/** Saisir le compté. L'attendu n'est pas montré avant : c'est tout le principe. */
function CountDialog({ session, open, onOpenChange }: { session: CashSession; open: boolean; onOpenChange: (open: boolean) => void }) {
  const scope = useServiceScope();
  const money = useMoney();
  const online = useOptionalOutbox()?.online ?? true;
  const submit = useMutation(api.cash.submitCount);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const counted = parseAmount(text, session.currency);
  return (
    <ResponsiveDialog
      open={open}
      onOpenChange={(o) => {
        onOpenChange(o);
        if (!o) {
          setText("");
          setError(null);
        }
      }}
    >
      <ResponsiveDialogContent>
        <form
          className="flex flex-col gap-4"
          onSubmit={async (e) => {
            e.preventDefault();
            if (counted === null) return;
            setBusy(true);
            setError(null);
            try {
              const r = await submit({ ...scope.acting, sessionId: session._id, countedAmount: counted });
              toast[r.discrepancy === 0 ? "success" : "warning"](r.discrepancy === 0 ? "La caisse tombe juste." : `Écart de ${money(r.discrepancy)} (attendu ${money(r.expected)}).`);
              onOpenChange(false);
              setText("");
            } catch (err) {
              setError(describeError(err).message);
            } finally {
              setBusy(false);
            }
          }}
        >
          <ResponsiveDialogHeader>
            <ResponsiveDialogTitle>{session.status === "counting" ? `Compter ${session.name}` : `Recompter ${session.name}`}</ResponsiveDialogTitle>
            <ResponsiveDialogDescription>Comptez billets et pièces, fonds de départ compris, puis saisissez le total.</ResponsiveDialogDescription>
          </ResponsiveDialogHeader>
          <FormField label="Total compté">
            <Input inputMode="decimal" autoComplete="off" className="h-11 text-lg" value={text} onChange={(e) => setText(e.target.value)} />
          </FormField>
          {error ? (
            <Alert variant="destructive">
              <CircleAlert />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          ) : null}
          <ResponsiveDialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Annuler
            </Button>
            <PendingButton type="submit" pending={busy} disabled={counted === null || !online}>
              Valider le compté
            </PendingButton>
          </ResponsiveDialogFooter>
        </form>
      </ResponsiveDialogContent>
    </ResponsiveDialog>
  );
}

function OpenDialog({ target, onClose }: { target: OpenTarget | null; onClose: () => void }) {
  const scope = useServiceScope();
  const online = useOptionalOutbox()?.online ?? true;
  const open = useMutation(api.cash.open);
  const [text, setText] = useState("");
  // Le fonds proposé : ce qui restait dans ce tiroir au dernier comptage. Jamais 0 d'office — une
  // monnaie déjà dans le tiroir et oubliée ferait un écart positif toute la soirée.
  useEffect(() => {
    if (target) setText(target.suggestedFloat !== null ? amountToText(target.suggestedFloat, scope.currency) : "");
  }, [target, scope.currency]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const float = parseAmount(text, scope.currency);
  return (
    <ResponsiveDialog open={target !== null} onOpenChange={(o) => !o && onClose()}>
      <ResponsiveDialogContent>
        <form
          className="flex flex-col gap-4"
          onSubmit={async (e) => {
            e.preventDefault();
            if (float === null || !target) return;
            setBusy(true);
            setError(null);
            try {
              await open({ ...scope.acting, openingFloat: float, ...(target.registerId ? { registerId: target.registerId } : {}) });
              toast.success(`${target.label[0]!.toUpperCase()}${target.label.slice(1)} : ouverte.`);
              onClose();
            } catch (err) {
              setError(describeError(err).message);
            } finally {
              setBusy(false);
            }
          }}
        >
          <ResponsiveDialogHeader>
            <ResponsiveDialogTitle>Ouvrir {target?.label}</ResponsiveDialogTitle>
            <ResponsiveDialogDescription>Le fonds de départ : la monnaie déjà dans la caisse. Il compte dans l'attendu du soir.</ResponsiveDialogDescription>
          </ResponsiveDialogHeader>
          <FormField label="Fonds de départ">
            <Input inputMode="decimal" autoComplete="off" value={text} onChange={(e) => setText(e.target.value)} />
          </FormField>
          {error ? (
            <Alert variant="destructive">
              <CircleAlert />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          ) : null}
          <ResponsiveDialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Annuler
            </Button>
            <PendingButton type="submit" pending={busy} disabled={float === null || !online}>
              Ouvrir
            </PendingButton>
          </ResponsiveDialogFooter>
        </form>
      </ResponsiveDialogContent>
    </ResponsiveDialog>
  );
}
