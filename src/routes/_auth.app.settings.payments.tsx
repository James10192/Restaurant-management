import { useEffect, useId, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery } from "convex/react";
import { CircleAlert, Plus, X } from "lucide-react";
import { toast } from "sonner";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import { FormField } from "~/components/app/form-field";
import { PendingButton } from "~/components/app/pending-button";
import { LoadingState, PermissionDeniedState } from "~/components/app/states";
import { useWorkspace } from "~/components/app/workspace";
import { RadioChoice } from "~/components/settings/radio-choice";
import { Alert, AlertDescription } from "~/components/ui/alert";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "~/components/ui/card";
import { Field, FieldDescription, FieldLabel } from "~/components/ui/field";
import { Input } from "~/components/ui/input";
import { InputGroup, InputGroupAddon, InputGroupButton, InputGroupInput } from "~/components/ui/input-group";
import { Item, ItemContent, ItemGroup, ItemTitle } from "~/components/ui/item";
import { RadioGroup } from "~/components/ui/radio-group";
import { describeError } from "~/lib/errors";

export const Route = createFileRoute("/_auth/app/settings/payments")({
  head: () => ({ meta: [{ title: "Encaissement — Joliba" }] }),
  component: PaymentSettingsPage,
});

type CashMode = "central" | "per_waiter";

const MODES: Record<CashMode, { title: string; description: string }> = {
  central: {
    title: "Une caisse centrale",
    description: "Les espèces vont dans le tiroir ouvert, quel que soit celui qui encaisse. La caissière compte le tiroir en fin de service.",
  },
  per_waiter: {
    title: "Chaque serveur a sa pochette",
    description: "Chacun encaisse dans sa pochette et la remet en fin de service. Un responsable la compte : on ne compte jamais sa propre pochette.",
  },
};

function PaymentSettingsPage() {
  const w = useWorkspace();
  const venueId = w.venue?._id;
  if (!venueId || !w.canInVenue("venue.settings.service")) {
    return <PermissionDeniedState venue={w.venue?.name} permission="régler l'encaissement" />;
  }
  return <PaymentSettings key={venueId} venueId={venueId} />;
}

function PaymentSettings({ venueId }: { venueId: Id<"venues"> }) {
  const current = useQuery(api.cash.paymentSettings, { venueId });
  const overview = useQuery(api.cash.overview, { venueId });
  const save = useMutation(api.cash.setPaymentSettings);
  const createRegister = useMutation(api.cash.createRegister);
  const idPrefix = useId();
  const [mode, setMode] = useState<CashMode>("central");
  const [wallets, setWallets] = useState<string[]>([]);
  const [walletText, setWalletText] = useState("");
  const [step, setStep] = useState("1");
  const [hour, setHour] = useState("4");
  const [registerName, setRegisterName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!current) return;
    setMode(current.cashMode);
    setWallets(current.mobileMoneyWallets);
    setStep(String(current.amountStep));
    setHour(String(current.serviceDayStartHour));
  }, [current]);

  if (current === undefined) return <LoadingState />;

  const stepValue = Number(step);
  const hourValue = Number(hour);
  const valid = Number.isInteger(stepValue) && stepValue >= 1 && stepValue <= 1000 && Number.isInteger(hourValue) && hourValue >= 0 && hourValue <= 12;

  function addWallet() {
    const w = walletText.trim();
    if (!w || wallets.includes(w) || wallets.length >= 10) return;
    setWallets([...wallets, w]);
    setWalletText("");
  }

  async function submit() {
    setBusy(true);
    setError(null);
    try {
      await save({ venueId, cashMode: mode, mobileMoneyWallets: wallets, amountStep: stepValue, serviceDayStartHour: hourValue });
      toast.success("Réglages d'encaissement enregistrés.");
    } catch (e) {
      setError(describeError(e).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight">Encaissement</h1>
        <p className="text-muted-foreground">Où va l'argent, par quels moyens, et quand finit une journée.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Les espèces</CardTitle>
          <CardDescription>Changer de mode demande que toutes les caisses soient clôturées.</CardDescription>
        </CardHeader>
        <CardContent>
          <RadioGroup aria-label="Organisation des espèces" value={mode} onValueChange={(v) => setMode(v as CashMode)}>
            {(Object.entries(MODES) as [CashMode, (typeof MODES)[CashMode]][]).map(([m, d]) => (
              <RadioChoice key={m} id={`${idPrefix}-${m}`} value={m} title={d.title} description={d.description} />
            ))}
          </RadioGroup>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Mobile Money</CardTitle>
          <CardDescription>Les portefeuilles que l'établissement reçoit sur ses téléphones. Chaque encaissement dit lequel : c'est lui que vous rapprochez de l'historique de l'application.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          {wallets.length === 0 ? <p className="text-sm text-muted-foreground">Aucun portefeuille : le Mobile Money ne peut pas être encaissé.</p> : null}
          <div className="flex flex-wrap gap-2">
            {wallets.map((w) => (
              <Badge key={w} variant="secondary" className="gap-1 pr-1">
                {w}
                <Button variant="ghost" size="icon-xs" aria-label={`Retirer ${w}`} onClick={() => setWallets(wallets.filter((x) => x !== w))}>
                  <X />
                </Button>
              </Badge>
            ))}
          </div>
          <Field>
            <FieldLabel htmlFor={`${idPrefix}-wallet`}>Ajouter un portefeuille</FieldLabel>
            <InputGroup>
              <InputGroupInput
                id={`${idPrefix}-wallet`}
                aria-describedby={`${idPrefix}-wallet-hint`}
                maxLength={30}
                value={walletText}
                onChange={(e) => setWalletText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    addWallet();
                  }
                }}
              />
              <InputGroupAddon align="inline-end">
                <InputGroupButton onClick={addWallet} disabled={!walletText.trim()}>
                  <Plus />
                  Ajouter
                </InputGroupButton>
              </InputGroupAddon>
            </InputGroup>
            <FieldDescription id={`${idPrefix}-wallet-hint`}>Par exemple : Wave, Orange Money, MTN MoMo, Moov Money.</FieldDescription>
          </Field>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Arrondis et journée</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <FormField label="Pas d'arrondi des parts" description="Pour « partager en 3 » : des parts rondes, le reste sur la première.">
            <Input inputMode="numeric" value={step} onChange={(e) => setStep(e.target.value)} />
          </FormField>
          <FormField label="Début du jour de service (heure)" description="4 par défaut. Un établissement qui ferme à 5 h règle 6.">
            <Input inputMode="numeric" value={hour} onChange={(e) => setHour(e.target.value)} />
          </FormField>
        </CardContent>
        <CardFooter className="flex flex-col items-stretch gap-3">
          {error ? (
            <Alert variant="destructive">
              <CircleAlert />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          ) : null}
          <PendingButton className="self-start" pending={busy} disabled={!valid} onClick={() => void submit()}>
            Enregistrer
          </PendingButton>
        </CardFooter>
      </Card>

      {current.cashMode === "central" ? (
        <Card>
          <CardHeader>
            <CardTitle>Tiroirs</CardTitle>
            <CardDescription>Une caisse par tiroir physique : le comptoir, le bar. La première se crée à la première ouverture.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            <ItemGroup className="gap-1">
              {(overview?.registers ?? []).map((r) => (
                <Item key={r._id} size="sm" variant="outline">
                  <ItemContent>
                    <ItemTitle>{r.name}</ItemTitle>
                  </ItemContent>
                  {r.busy ? <Badge variant="secondary">Ouverte</Badge> : null}
                </Item>
              ))}
            </ItemGroup>
            <InputGroup>
              <InputGroupInput aria-label="Nom du tiroir" placeholder="Ex. : Bar" maxLength={40} value={registerName} onChange={(e) => setRegisterName(e.target.value)} />
              <InputGroupAddon align="inline-end">
                <InputGroupButton
                  disabled={registerName.trim().length < 2}
                  onClick={async () => {
                    try {
                      await createRegister({ venueId, name: registerName.trim() });
                      setRegisterName("");
                      toast.success("Tiroir ajouté.");
                    } catch (e) {
                      toast.error(describeError(e).message);
                    }
                  }}
                >
                  <Plus />
                  Ajouter
                </InputGroupButton>
              </InputGroupAddon>
            </InputGroup>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
