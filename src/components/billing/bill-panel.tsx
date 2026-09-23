import { useCallback, useEffect, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import {
  Banknote,
  Gift,
  MoreHorizontal,
  Percent,
  Printer,
  ReceiptText,
  Split,
  Undo2,
} from "lucide-react";
import { toast } from "sonner";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { LoadingState } from "~/components/app/states";
import { ActionButton } from "~/components/service/action-button";
import { useMoney, useServiceScope } from "~/components/service/service-scope";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "~/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "~/components/ui/dropdown-menu";
import {
  Item,
  ItemActions,
  ItemContent,
  ItemDescription,
  ItemGroup,
  ItemTitle,
} from "~/components/ui/item";
import { Field, FieldLabel } from "~/components/ui/field";
import { Separator } from "~/components/ui/separator";
import { ToggleGroup, ToggleGroupItem } from "~/components/ui/toggle-group";
import { describeError } from "~/lib/errors";
import { uuidv7 } from "~/lib/outbox";
import { useOptionalOutbox } from "~/components/service/outbox-provider";
import { amountToText, parseAmount } from "./amount";
import { BILL_NOTICE, PrintJob, type PaperDoc } from "./paper";
import { PaymentDialog, type Bill, type BillCheck } from "./payment-dialog";
import { ReasonDialog } from "./reason-dialog";
import { SplitDialog } from "./split-dialog";

const time = new Intl.DateTimeFormat("fr-FR", {
  hour: "2-digit",
  minute: "2-digit",
});
const EPSILON = 1e-9;

function quantityLabel(q: number): string {
  if (Number.isInteger(q)) return String(q);
  if (Math.abs(q - 0.5) < EPSILON) return "½";
  return q.toLocaleString("fr-FR", { maximumFractionDigits: 2 });
}

type Payment = BillCheck["payments"][number];
type Line = BillCheck["lines"][number];

/**
 * L'addition d'une table : ce qui est dû, ce qui est réglé, par qui, et les gestes qui vont avec.
 * Le solde vient du serveur, jamais d'un calcul à l'écran (PAYMENTS.md, R14).
 */
export function BillPanel({ sessionId }: { sessionId: Id<"tableSessions"> }) {
  const scope = useServiceScope();
  const bill = useQuery(api.checks.forSession, {
    venueId: scope.venueId,
    sessionId,
  });
  const [paying, setPaying] = useState<BillCheck | null>(null);
  const [splitting, setSplitting] = useState(false);
  const [discounting, setDiscounting] = useState<BillCheck | null>(null);
  const [comping, setComping] = useState<{
    check: BillCheck;
    line: Line;
  } | null>(null);
  const [voiding, setVoiding] = useState<Payment | null>(null);
  const [refunding, setRefunding] = useState<Payment | null>(null);
  const [printDoc, setPrintDoc] = useState<PaperDoc | null>(null);
  const [printBill, setPrintBill] = useState<Id<"bills"> | null>(null);
  const money = useMoney();
  const comp = useMutation(api.checks.comp);
  const discount = useMutation(api.checks.discount);
  const voidPayment = useMutation(api.payments.voidPayment);
  const clearPrint = useCallback(() => setPrintDoc(null), []);

  if (bill === undefined) return <LoadingState />;
  const rest = bill.checks.find((c) => c.kind === "remainder") ?? null;
  const single = bill.checks.length <= 1;

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <CardHeader>
          <CardTitle>Addition</CardTitle>
          <CardDescription>
            {bill.unserved > 0
              ? `${bill.unserved} ligne${bill.unserved > 1 ? "s" : ""} pas encore servie${bill.unserved > 1 ? "s" : ""}, incluse${bill.unserved > 1 ? "s" : ""}.`
              : "Tout est servi."}
          </CardDescription>
          <CardAction>
            <Badge
              variant={
                bill.due === 0 && bill.total > 0 ? "secondary" : "outline"
              }
            >
              {bill.due === 0 && bill.total > 0
                ? "Soldée"
                : bill.paid > 0
                  ? "En partie réglée"
                  : "À régler"}
            </Badge>
          </CardAction>
        </CardHeader>
        <CardContent>
          <dl className="grid grid-cols-2 gap-x-4 gap-y-2">
            <div className="col-span-2">
              <dt className="text-xs text-muted-foreground">Reste à payer</dt>
              <dd className="text-3xl font-semibold tracking-tight tabular-nums">
                {money(bill.due)}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">Total</dt>
              <dd className="font-medium tabular-nums">{money(bill.total)}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">Réglé</dt>
              <dd className="font-medium tabular-nums">{money(bill.paid)}</dd>
            </div>
          </dl>
        </CardContent>
        <CardFooter className="flex flex-wrap gap-2">
          {bill.can.collect && rest && rest.balance.due > 0 ? (
            <Button size="lg" onClick={() => setPaying(rest)}>
              <Banknote />
              Encaisser
            </Button>
          ) : null}
          {rest && rest.lines.length > 0 ? (
            <Button
              variant="outline"
              onClick={() =>
                setPrintDoc(
                  noteDoc(bill, rest, scope.venueName, scope.timezone),
                )
              }
            >
              <Printer />
              Note
            </Button>
          ) : null}
          {bill.can.manage && rest && rest.lines.some((l) => !l.comped) ? (
            <Button variant="outline" onClick={() => setSplitting(true)}>
              <Split />
              Partager
            </Button>
          ) : null}
          {bill.can.discount && rest && rest.balance.due > 0 ? (
            <Button variant="outline" onClick={() => setDiscounting(rest)}>
              <Percent />
              Remise
            </Button>
          ) : null}
        </CardFooter>
      </Card>

      {bill.checks.map((c) => (
        <CheckCard
          key={c._id ?? "reste"}
          bill={bill}
          check={c}
          title={
            single
              ? "Détail"
              : c.kind === "remainder"
                ? "Reste de la table"
                : (c.label ?? `Addition ${c.reference ?? ""}`)
          }
          onPay={() => setPaying(c)}
          onComp={(line) => setComping({ check: c, line })}
          onDiscount={() => setDiscounting(c)}
          onVoid={setVoiding}
          onRefund={setRefunding}
          onPrintNote={() =>
            setPrintDoc(noteDoc(bill, c, scope.venueName, scope.timezone))
          }
          onPrintBill={setPrintBill}
          showPayAction={!single || c.kind !== "remainder"}
        />
      ))}

      <PaymentDialog
        bill={bill}
        check={
          paying
            ? (bill.checks.find(
                (c) => c._id === paying._id && c.kind === paying.kind,
              ) ?? paying)
            : null
        }
        open={paying !== null}
        onOpenChange={(o) => !o && setPaying(null)}
      />
      <SplitDialog
        bill={bill}
        rest={rest}
        open={splitting}
        onOpenChange={setSplitting}
      />
      <ReasonDialog
        open={comping !== null}
        onOpenChange={(o) => !o && setComping(null)}
        title={`Offrir ${comping?.line.name ?? ""}`}
        description={`${money(comping?.line.amount ?? 0)} retirés de l'addition. Le geste est à votre nom, avec son motif.`}
        confirmLabel="Offrir"
        onConfirm={async ({ reason }) => {
          if (!comping) return;
          await comp({
            ...scope.acting,
            sessionId: bill.sessionId,
            checkId: comping.check._id,
            orderItemId: comping.line.orderItemId,
            reason,
          });
          toast.success(`${comping.line.name} offert.`);
          setComping(null);
        }}
      />
      <ReasonDialog
        open={discounting !== null}
        onOpenChange={(o) => !o && setDiscounting(null)}
        title="Faire une remise"
        description={`Au plus ${money(discounting?.balance.due ?? 0)}. La remise est à votre nom, avec son motif.`}
        confirmLabel="Appliquer la remise"
        amount={{
          label: "Montant de la remise",
          parse: (t) => parseAmount(t, bill.currency),
        }}
        onConfirm={async ({ reason, amount }) => {
          if (!discounting || amount === null) return;
          await discount({
            ...scope.acting,
            sessionId: bill.sessionId,
            checkId: discounting._id,
            amount,
            reason,
          });
          toast.success("Remise appliquée.");
          setDiscounting(null);
        }}
      />
      <ReasonDialog
        open={voiding !== null}
        onOpenChange={(o) => !o && setVoiding(null)}
        title="Annuler cette saisie"
        description={`${voiding?.label ?? ""} ${money(voiding?.amount ?? 0)}, encaissé par ${voiding?.collectedBy ?? "?"}. Pour une saisie erronée seulement : une fois la caisse comptée, on rembourse.`}
        confirmLabel="Annuler la saisie"
        destructive
        onConfirm={async ({ reason }) => {
          if (!voiding) return;
          await voidPayment({
            ...scope.acting,
            paymentId: voiding._id,
            reason,
          });
          toast.success("Saisie annulée.");
          setVoiding(null);
        }}
      />
      <RefundDialog
        payment={refunding}
        currency={bill.currency}
        onClose={() => setRefunding(null)}
      />
      {printBill ? (
        <BillPrinter billId={printBill} onDone={() => setPrintBill(null)} />
      ) : null}
      <PrintJob doc={printDoc} money={money} onDone={clearPrint} />
    </div>
  );
}

function CheckCard({
  bill,
  check,
  title,
  onPay,
  onComp,
  onDiscount,
  onVoid,
  onRefund,
  onPrintNote,
  onPrintBill,
  showPayAction,
}: {
  bill: Bill;
  check: BillCheck;
  title: string;
  onPay: () => void;
  onComp: (line: Line) => void;
  onDiscount: () => void;
  onVoid: (p: Payment) => void;
  onRefund: (p: Payment) => void;
  onPrintNote: () => void;
  onPrintBill: (id: Id<"bills">) => void;
  showPayAction: boolean;
}) {
  const scope = useServiceScope();
  const money = useMoney();
  const issue = useMutation(api.bills.issue);
  const unsplit = useMutation(api.checks.unsplit);
  const sale = check.bills.find((b) => b.kind === "sale");
  const hasPayments = check.payments.some((p) => p.status !== "voided");
  const settled = check.balance.due === 0 && check.lines.length > 0;

  return (
    <Card size="sm">
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>
          {money(check.balance.total)}
          {check.balance.paid > 0
            ? ` · réglé ${money(check.balance.paid)}`
            : ""}
          {check.balance.due > 0 ? ` · reste ${money(check.balance.due)}` : ""}
          {sale ? ` · ticket ${sale.reference}` : ""}
        </CardDescription>
        {!showPayAction ? null : (
          <CardAction className="flex gap-2">
            {bill.can.collect && check.balance.due > 0 ? (
              <Button size="sm" onClick={onPay}>
                Encaisser
              </Button>
            ) : null}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  size="icon-sm"
                  variant="ghost"
                  aria-label={`Actions pour ${title}`}
                >
                  <MoreHorizontal />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onSelect={onPrintNote}>
                  Imprimer la note
                </DropdownMenuItem>
                {bill.can.discount && check.balance.due > 0 ? (
                  <DropdownMenuItem onSelect={onDiscount}>
                    Faire une remise
                  </DropdownMenuItem>
                ) : null}
                {bill.can.manage &&
                check.kind === "allocated" &&
                check._id &&
                !hasPayments &&
                check.adjustments.length === 0 &&
                !sale ? (
                  <DropdownMenuItem
                    onSelect={async () => {
                      try {
                        await unsplit({ ...scope.acting, checkId: check._id! });
                        toast.success(
                          "Partage défait : les lignes reviennent à la table.",
                        );
                      } catch (error) {
                        toast.error(describeError(error).message);
                      }
                    }}
                  >
                    Défaire le partage
                  </DropdownMenuItem>
                ) : null}
              </DropdownMenuContent>
            </DropdownMenu>
          </CardAction>
        )}
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <ItemGroup className="gap-1">
          {check.lines.map((l) => (
            <Item key={l.orderItemId} size="sm" className="py-1">
              <ItemContent className="min-w-0">
                <ItemTitle className="max-w-full truncate">
                  {quantityLabel(l.quantity)} × {l.name}
                  {l.variantName ? ` — ${l.variantName}` : ""}
                </ItemTitle>
                {l.modifiers.length > 0 || l.itemStatus !== "served" ? (
                  <ItemDescription>
                    {[
                      l.modifiers.join(", "),
                      l.itemStatus !== "served" ? "pas encore servi" : null,
                    ]
                      .filter(Boolean)
                      .join(" · ")}
                  </ItemDescription>
                ) : null}
              </ItemContent>
              <ItemActions>
                {l.comped ? <Badge variant="secondary">Offert</Badge> : null}
                <span className="tabular-nums">{money(l.amount)}</span>
                {bill.can.discount &&
                !l.comped &&
                l.amount > 0 &&
                l.amount <= check.balance.due ? (
                  <Button
                    size="icon-sm"
                    variant="ghost"
                    aria-label={`Offrir ${l.name}`}
                    onClick={() => onComp(l)}
                  >
                    <Gift />
                  </Button>
                ) : null}
              </ItemActions>
            </Item>
          ))}
        </ItemGroup>
        {check.adjustments.length > 0 ? (
          <>
            <Separator />
            <ItemGroup className="gap-1">
              {check.adjustments.map((a) => (
                <Item key={a._id} size="sm" className="py-1">
                  <ItemContent>
                    <ItemTitle>{a.label}</ItemTitle>
                    <ItemDescription>
                      {a.by ?? "?"}
                      {a.reason ? ` · ${a.reason}` : ""}
                    </ItemDescription>
                  </ItemContent>
                  <ItemActions>
                    <span className="tabular-nums">−{money(a.amount)}</span>
                  </ItemActions>
                </Item>
              ))}
            </ItemGroup>
          </>
        ) : null}
        {check.payments.length > 0 ? (
          <>
            <Separator />
            <ItemGroup className="gap-1">
              {check.payments.map((p) => (
                <Item key={p._id} size="sm" className="py-1">
                  <ItemContent>
                    <ItemTitle>
                      {p.label}
                      {p.status === "voided" ? (
                        <Badge variant="outline">Annulé</Badge>
                      ) : null}
                      {p.status === "refunded" ? (
                        <Badge variant="outline">Remboursé</Badge>
                      ) : null}
                      {p.status === "partially_refunded" ? (
                        <Badge variant="outline">En partie remboursé</Badge>
                      ) : null}
                    </ItemTitle>
                    <ItemDescription>
                      {time.format(p.createdAt)} · {p.collectedBy ?? "?"}
                      {p.changeAmount
                        ? ` · monnaie ${money(p.changeAmount)}`
                        : ""}
                      {p.providerRef ? ` · réf. ${p.providerRef}` : ""}
                      {p.voidedReason ? ` · ${p.voidedReason}` : ""}
                    </ItemDescription>
                  </ItemContent>
                  <ItemActions>
                    <span
                      className={
                        p.status === "voided"
                          ? "tabular-nums line-through text-muted-foreground"
                          : "tabular-nums"
                      }
                    >
                      {money(p.amount)}
                    </span>
                    {p.status !== "voided" &&
                    ((bill.can.void && !p.mine) ||
                      (bill.can.refund && p.refundable > 0)) ? (
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            size="icon-sm"
                            variant="ghost"
                            aria-label={`Actions sur le paiement ${p.label}`}
                          >
                            <MoreHorizontal />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          {bill.can.void &&
                          !p.mine &&
                          p.status === "succeeded" &&
                          p.cashSessionOpen !== false &&
                          !sale ? (
                            <DropdownMenuItem onSelect={() => onVoid(p)}>
                              Annuler la saisie
                            </DropdownMenuItem>
                          ) : null}
                          {bill.can.refund && p.refundable > 0 ? (
                            <DropdownMenuItem onSelect={() => onRefund(p)}>
                              <Undo2 />
                              Rembourser
                            </DropdownMenuItem>
                          ) : null}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    ) : null}
                  </ItemActions>
                </Item>
              ))}
            </ItemGroup>
          </>
        ) : null}
      </CardContent>
      {settled && bill.can.issueBill && check._id ? (
        <CardFooter className="flex flex-wrap gap-2">
          {sale ? (
            <Button variant="outline" onClick={() => onPrintBill(sale._id)}>
              <Printer />
              Réimprimer le ticket
            </Button>
          ) : (
            <ActionButton
              onAction={async () => {
                try {
                  const id = await issue({
                    ...scope.acting,
                    checkId: check._id!,
                  });
                  onPrintBill(id);
                } catch (error) {
                  toast.error(describeError(error).message);
                }
              }}
            >
              <ReceiptText />
              Ticket
            </ActionButton>
          )}
        </CardFooter>
      ) : null}
    </Card>
  );
}

/** La note : avant paiement, sans numéro. Ce n'est pas une pièce, c'est une addition à lire. */
function noteDoc(
  bill: Bill,
  check: BillCheck,
  venueName: string,
  timezone: string,
): PaperDoc {
  const totals = [{ label: "Sous-total", amount: check.balance.subtotal }];
  if (check.balance.discounts > 0)
    totals.push({
      label: "Offerts et remises",
      amount: -check.balance.discounts,
    });
  totals.push({ label: "Total", amount: check.balance.total });
  if (check.balance.paid > 0)
    totals.push({ label: "Déjà réglé", amount: check.balance.paid });
  return {
    title: "Note — non payée",
    seller: { name: venueName },
    tableNumber: bill.tableNumber,
    at: Date.now(),
    timezone,
    lines: check.lines.map((l) => ({
      name: [l.name, l.variantName].filter(Boolean).join(" — "),
      quantity: l.quantity,
      amount: l.amount,
      note: l.comped ? "offert" : null,
    })),
    totals: [
      ...totals.map((t) => ({ ...t })),
      { label: "Reste à payer", amount: check.balance.due, strong: true },
    ] as PaperDoc["totals"],
    payments: [],
    notice: BILL_NOTICE,
  };
}

/** Imprime une pièce émise : la première fois, l'original ; ensuite, un duplicata sous droit. */
function BillPrinter({
  billId,
  onDone,
}: {
  billId: Id<"bills">;
  onDone: () => void;
}) {
  const scope = useServiceScope();
  const money = useMoney();
  const bill = useQuery(api.bills.get, { venueId: scope.venueId, billId });
  const recordPrint = useMutation(api.bills.recordPrint);
  const [doc, setDoc] = useState<PaperDoc | null>(null);
  const [started, setStarted] = useState(false);

  useEffect(() => {
    if (!bill || started) return;
    setStarted(true);
    void recordPrint({ ...scope.acting, billId })
      .then(({ duplicate }) => {
        const s = bill.snapshot;
        setDoc({
          title: `${bill.kind === "sale" ? "Ticket" : "Avoir"} ${bill.reference}${bill.correctsReference ? ` (corrige ${bill.correctsReference})` : ""}`,
          duplicate,
          seller: {
            name: s.seller.name,
            ...(s.seller.legalName ? { legalName: s.seller.legalName } : {}),
            ...(s.seller.address ? { address: s.seller.address } : {}),
            ...(s.seller.taxId ? { taxId: s.seller.taxId } : {}),
            ...(s.seller.rccm ? { rccm: s.seller.rccm } : {}),
          },
          tableNumber: bill.tableNumber,
          at: bill.issuedAt,
          timezone: bill.timezone,
          lines: s.lines.map((l) => ({
            name: l.name,
            quantity: l.quantity,
            amount: l.lineTotal,
          })),
          totals: [
            ...(s.totals.discounts > 0
              ? [
                  { label: "Sous-total", amount: s.totals.subtotal },
                  { label: "Offerts et remises", amount: -s.totals.discounts },
                ]
              : []),
            ...(s.totals.tax > 0
              ? [{ label: "Dont taxes", amount: s.totals.tax }]
              : []),
            { label: "Total", amount: s.totals.total, strong: true },
          ],
          payments: s.payments.map((p) => ({
            label: p.method,
            amount: p.amount,
          })),
          servedBy: s.servedBy ?? null,
          notice: bill.notice,
        });
      })
      .catch((error) => {
        toast.error(describeError(error).message);
        onDone();
      });
  }, [bill, started, recordPrint, scope.venueId, billId, onDone]);

  return <PrintJob doc={doc} money={money} onDone={onDone} />;
}

/** Rembourser : en espèces depuis une caisse choisie, ou par le même moyen. Compte seulement. */
function RefundDialog({
  payment,
  currency,
  onClose,
}: {
  payment: Payment | null;
  currency: string;
  onClose: () => void;
}) {
  const scope = useServiceScope();
  const money = useMoney();
  const refund = useMutation(api.payments.refund);
  const cash = useQuery(
    api.cash.overview,
    payment ? { venueId: scope.venueId } : "skip",
  );
  const openCash = (cash?.sessions ?? []).filter((s) => s.status === "open");
  const [method, setMethod] = useState<"cash" | "original">("original");
  const [registerSessionId, setRegisterSessionId] =
    useState<Id<"cashRegisterSessions"> | null>(null);
  const [key, setKey] = useState(() => uuidv7());
  const online = useOptionalOutbox()?.online ?? true;
  useEffect(() => {
    if (payment) {
      setKey(uuidv7());
      setMethod(payment.method === "cash" ? "cash" : "original");
      setRegisterSessionId(null);
    }
  }, [payment]);
  return (
    <ReasonDialog
      open={payment !== null}
      onOpenChange={(o) => !o && onClose()}
      title="Rembourser"
      description={`${payment?.label ?? ""} ${money(payment?.amount ?? 0)}${payment && payment.refundable < payment.amount ? `, dont ${money(payment.refundable)} encore remboursable` : ""}. Jamais au-delà de l'encaissé ; si un ticket a été remis, un avoir le corrige.`}
      confirmLabel="Rembourser"
      destructive
      amount={{
        label: "Montant remboursé",
        initial: payment ? amountToText(payment.refundable, currency) : "",
        parse: (t) => parseAmount(t, currency),
      }}
      onConfirm={async ({ reason, amount }) => {
        if (!payment || amount === null) return;
        if (!online) return;
        if (method === "cash" && !registerSessionId)
          throw new Error("Choisissez la caisse d'où sort l'argent.");
        await refund({
          ...scope.acting,
          paymentId: payment._id,
          amount,
          reason,
          method,
          idempotencyKey: key,
          ...(method === "cash" && registerSessionId
            ? { registerSessionId }
            : {}),
        });
        toast.success(`Remboursé : ${money(amount)}.`);
        onClose();
      }}
    >
      {payment?.method === "cash" ? null : (
        <Field>
          <FieldLabel>L'argent est rendu</FieldLabel>
          <ToggleGroup
            type="single"
            variant="outline"
            className="flex w-full flex-wrap justify-start"
            value={method}
            onValueChange={(v) => v && setMethod(v as "cash" | "original")}
          >
            <ToggleGroupItem value="original">
              Par le même moyen
            </ToggleGroupItem>
            <ToggleGroupItem value="cash">En espèces</ToggleGroupItem>
          </ToggleGroup>
        </Field>
      )}
      {method === "cash" ? (
        openCash.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Aucune caisse ouverte : ouvrez-en une pour rendre des espèces.
          </p>
        ) : (
          <Field>
            <FieldLabel>Caisse d'où sort l'argent</FieldLabel>
            <ToggleGroup
              type="single"
              variant="outline"
              className="flex w-full flex-wrap justify-start"
              value={registerSessionId ?? ""}
              onValueChange={(v) =>
                setRegisterSessionId(
                  v ? (v as Id<"cashRegisterSessions">) : null,
                )
              }
            >
              {openCash.map((s) => (
                <ToggleGroupItem key={s._id} value={s._id}>
                  {s.name}
                </ToggleGroupItem>
              ))}
            </ToggleGroup>
          </Field>
        )
      ) : null}
    </ReasonDialog>
  );
}
