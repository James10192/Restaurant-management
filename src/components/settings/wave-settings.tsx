/**
 * Brancher le compte Wave du restaurant — Joliba (T5, D-116, D-117, D-128)
 *
 * Le gérant colle ce que le portail Wave Business lui donne ; Joliba le chiffre et ne le montre
 * plus jamais (quatre caractères, pas un de plus). Le compte ne s'active qu'une fois PROUVÉ : la
 * clé répond, et Wave a joint Joliba avec un événement de test signé du bon secret. Sinon, c'est le
 * premier client qui découvrirait l'erreur de saisie.
 */

import { useAction, useMutation, useQuery } from "convex/react";
import { CheckCircle2, CircleAlert, Copy, KeyRound, TriangleAlert } from "lucide-react";
import { useId, useState } from "react";
import { toast } from "sonner";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { PendingButton } from "~/components/app/pending-button";
import { Alert, AlertDescription, AlertTitle } from "~/components/ui/alert";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { Card, CardAction, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "~/components/ui/card";
import { Field, FieldDescription, FieldLabel } from "~/components/ui/field";
import { Input } from "~/components/ui/input";
import { InputGroup, InputGroupAddon, InputGroupButton, InputGroupInput } from "~/components/ui/input-group";
import { Item, ItemActions, ItemContent, ItemDescription, ItemGroup, ItemTitle } from "~/components/ui/item";
import { Separator } from "~/components/ui/separator";
import { describeError } from "~/lib/errors";
import { formatMoney } from "../../../convex/lib/money";

const date = new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });

const STATUS = {
  draft: { label: "Pas encore actif", variant: "outline" },
  active: { label: "Actif", variant: "secondary" },
  disabled: { label: "Coupé", variant: "destructive" },
} as const;

export function WaveSettings({ venueId }: { venueId: Id<"venues"> }) {
  const view = useQuery(api.paymentAccounts.forVenue, { venueId });
  const history = useQuery(api.onlinePayments.reconciliations, { venueId });
  const saveSecrets = useAction(api.paymentAccounts.saveSecrets);
  const testConnection = useAction(api.paymentAccounts.testConnection);
  const activate = useMutation(api.paymentAccounts.activate);
  const disable = useMutation(api.paymentAccounts.disable);
  const dropPrevious = useMutation(api.paymentAccounts.dropPreviousWebhookSecret);
  const rotatePath = useMutation(api.paymentAccounts.rotateWebhookPath);
  const id = useId();
  const [apiKey, setApiKey] = useState("");
  const [webhookSecret, setWebhookSecret] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (!view) return null;
  const account = view.account;

  const run = async (name: string, fn: () => Promise<unknown>, done?: string) => {
    setBusy(name);
    setError(null);
    try {
      await fn();
      if (done) toast.success(done);
    } catch (e) {
      setError(describeError(e).message);
    } finally {
      setBusy(null);
    }
  };

  if (!view.available) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Paiement en ligne (Wave)</CardTitle>
          <CardDescription>Proposé aux établissements de Côte d'Ivoire, en francs CFA.</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  const tested = account?.lastConnectionOk === true;
  const eventReceived = account?.lastTestEventAt !== null && account?.lastTestEventAt !== undefined;

  return (
    <Card data-wave-settings>
      <CardHeader>
        <CardTitle>Paiement en ligne (Wave)</CardTitle>
        <CardDescription>
          Le client règle depuis son téléphone, après avoir saisi le code de la table. L'argent arrive sur le portefeuille Wave Business du restaurant ; la caisse le voit en direct, et le relevé du lendemain est rapproché automatiquement.
        </CardDescription>
        <CardAction>
          <Badge variant={account ? STATUS[account.status].variant : "outline"}>{account ? STATUS[account.status].label : "Non branché"}</Badge>
        </CardAction>
      </CardHeader>
      <CardContent className="flex flex-col gap-5">
        {!view.encryptionReady ? (
          <Alert variant="destructive">
            <CircleAlert />
            <AlertTitle>Le chiffrement des clés n'est pas réglé</AlertTitle>
            <AlertDescription>Ce déploiement n'a pas de clé maîtresse (PAYMENT_SECRETS_KEY) : aucune clé Wave ne peut être enregistrée.</AlertDescription>
          </Alert>
        ) : null}

        {view.simulation ? (
          <Alert>
            <CircleAlert />
            <AlertTitle>Établissement de démonstration</AlertTitle>
            <AlertDescription>Ses tables sont des essais : le paiement en ligne n'y est jamais proposé aux clients, même une fois Wave branché.</AlertDescription>
          </Alert>
        ) : null}

        <Alert>
          <TriangleAlert />
          <AlertTitle>Dans le portail Wave Business</AlertTitle>
          <AlertDescription>
            Créez une clé d'API avec les droits « Checkout » et « Balance & Reconciliation ». N'activez pas la liste blanche d'adresses IP : elle ne se désactive plus, et bloquerait Joliba.
          </AlertDescription>
        </Alert>

        <Field>
          <FieldLabel htmlFor={`${id}-api`}>1. Clé d'API</FieldLabel>
          <Input
            id={`${id}-api`}
            type="password"
            autoComplete="off"
            spellCheck={false}
            placeholder={account?.apiKeyLast4 ? `Enregistrée — se termine par ${account.apiKeyLast4}` : "wave_ci_prod_…"}
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
          />
          <FieldDescription>Chiffrée dès l'enregistrement. Joliba ne vous la remontrera jamais : seuls ses quatre derniers caractères s'affichent.</FieldDescription>
        </Field>

        <Field>
          <FieldLabel htmlFor={`${id}-hook`}>2. Adresse du webhook, à coller chez Wave</FieldLabel>
          {account?.webhookUrl ? (
            <InputGroup>
              <InputGroupInput id={`${id}-hook`} readOnly value={account.webhookUrl} className="font-mono text-xs" />
              <InputGroupAddon align="inline-end">
                <InputGroupButton
                  onClick={async () => {
                    await navigator.clipboard.writeText(account.webhookUrl!);
                    toast.success("Adresse copiée.");
                  }}
                >
                  <Copy />
                  Copier
                </InputGroupButton>
              </InputGroupAddon>
            </InputGroup>
          ) : (
            <p className="text-sm text-muted-foreground">L'adresse apparaît dès que la clé d'API est enregistrée.</p>
          )}
          <FieldDescription>
            Choisissez le mode « signature » (pas « secret partagé ») et les événements checkout.session.completed et checkout.session.payment_failed.
          </FieldDescription>
        </Field>

        <Field>
          <FieldLabel htmlFor={`${id}-secret`}>3. Secret du webhook</FieldLabel>
          <Input
            id={`${id}-secret`}
            type="password"
            autoComplete="off"
            spellCheck={false}
            placeholder={account?.webhookSecretLast4 ? `Enregistré — se termine par ${account.webhookSecretLast4}` : "wave_ci_prod_…"}
            value={webhookSecret}
            onChange={(e) => setWebhookSecret(e.target.value)}
          />
          <FieldDescription>Wave ne l'affiche qu'une fois, à la création du webhook. En remplacer un, c'est garder l'ancien accepté jusqu'à ce que vous le retiriez.</FieldDescription>
        </Field>

        <PendingButton
          className="self-start"
          pending={busy === "save"}
          disabled={!view.encryptionReady || (!apiKey.trim() && !webhookSecret.trim())}
          onClick={() =>
            void run(
              "save",
              async () => {
                await saveSecrets({ venueId, ...(apiKey.trim() ? { apiKey: apiKey.trim() } : {}), ...(webhookSecret.trim() ? { webhookSecret: webhookSecret.trim() } : {}) });
                setApiKey("");
                setWebhookSecret("");
              },
              "Enregistré et chiffré.",
            )
          }
        >
          <KeyRound />
          Enregistrer
        </PendingButton>

        {account ? (
          <>
            <Separator />
            <ItemGroup className="gap-2">
              <Item variant="outline" size="sm">
                <ItemContent>
                  <ItemTitle>4. La clé répond</ItemTitle>
                  <ItemDescription>
                    {account.lastConnectionTestAt === null
                      ? "Pas encore testée."
                      : tested
                        ? `Oui, le ${date.format(account.lastConnectionTestAt)}. ${account.balanceAccess ? "Droit « Solde » : oui, le rapprochement sera automatique." : "Droit « Solde » : non, le rapprochement quotidien sera indisponible."}`
                        : "Non : vérifiez la clé collée."}
                  </ItemDescription>
                </ItemContent>
                <ItemActions>
                  <PendingButton size="sm" variant="outline" pending={busy === "test"} onClick={() => void run("test", () => testConnection({ venueId }))}>
                    Tester la connexion
                  </PendingButton>
                </ItemActions>
              </Item>
              <Item variant="outline" size="sm" data-test-event={eventReceived ? "received" : "waiting"}>
                <ItemContent>
                  <ItemTitle>5. Wave joint Joliba</ItemTitle>
                  <ItemDescription>
                    {eventReceived
                      ? `Événement de test reçu le ${date.format(account.lastTestEventAt!)}, signature vérifiée.`
                      : "Depuis le portail Wave, envoyez l'événement de test du webhook. Il s'affichera ici dès qu'il arrive."}
                  </ItemDescription>
                </ItemContent>
                {eventReceived ? (
                  <ItemActions>
                    <CheckCircle2 className="size-5" aria-label="Reçu" />
                  </ItemActions>
                ) : null}
              </Item>
            </ItemGroup>

            {account.recentSignatureFailures >= 5 ? (
              <Alert variant="destructive">
                <CircleAlert />
                <AlertTitle>Des webhooks arrivent avec une signature refusée</AlertTitle>
                <AlertDescription>{account.recentSignatureFailures} dans l'heure : le secret collé n'est probablement pas celui de ce webhook.</AlertDescription>
              </Alert>
            ) : null}

            {error ? (
              <Alert variant="destructive">
                <CircleAlert />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            ) : null}
          </>
        ) : error ? (
          <Alert variant="destructive">
            <CircleAlert />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        ) : null}

        {history && history.length > 0 ? (
          <>
            <Separator />
            <div className="flex flex-col gap-2">
              <h3 className="font-medium">Rapprochement avec le relevé Wave</h3>
              <ItemGroup className="gap-1">
                {history.map((r) => (
                  <Item key={r.day} size="sm" className="py-1">
                    <ItemContent>
                      <ItemTitle>{r.day}</ItemTitle>
                      <ItemDescription>
                        {r.status === "unavailable"
                          ? "Indisponible : la clé n'a pas le droit « Solde »."
                          : r.status === "failed"
                            ? "Wave n'a pas répondu ; nouvel essai demain."
                            : `${r.matched} rapproché${r.matched > 1 ? "s" : ""} · commissions ${formatMoney({ amount: r.fees, currency: "XOF" })}`}
                      </ItemDescription>
                    </ItemContent>
                    <ItemActions>
                      {r.missingAtProvider > 0 ? <Badge variant="destructive">{r.missingAtProvider} absent{r.missingAtProvider > 1 ? "s" : ""} du relevé</Badge> : null}
                      {r.missingHere + r.amountMismatch > 0 ? <Badge variant="outline">{r.missingHere + r.amountMismatch} écart{r.missingHere + r.amountMismatch > 1 ? "s" : ""}</Badge> : null}
                    </ItemActions>
                  </Item>
                ))}
              </ItemGroup>
            </div>
          </>
        ) : null}
      </CardContent>
      {account ? (
        <CardFooter className="flex flex-wrap gap-2">
          {account.status !== "active" ? (
            <PendingButton
              pending={busy === "activate"}
              disabled={!tested || !eventReceived}
              onClick={() => void run("activate", () => activate({ venueId }), "Paiement en ligne activé.")}
            >
              Proposer aux clients
            </PendingButton>
          ) : (
            <PendingButton variant="outline" pending={busy === "disable"} onClick={() => void run("disable", () => disable({ venueId }), "Paiement en ligne coupé.")}>
              Couper le paiement en ligne
            </PendingButton>
          )}
          {account.hasPreviousWebhookSecret ? (
            <Button variant="ghost" onClick={() => void run("drop", () => dropPrevious({ venueId }), "Ancien secret retiré.")}>
              Retirer l'ancien secret du webhook
            </Button>
          ) : null}
          <Button variant="ghost" onClick={() => void run("path", () => rotatePath({ venueId }), "Nouvelle adresse : recollez-la chez Wave.")}>
            Changer l'adresse du webhook
          </Button>
        </CardFooter>
      ) : null}
    </Card>
  );
}
