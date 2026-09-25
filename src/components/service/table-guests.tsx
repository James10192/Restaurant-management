/**
 * Le code de la table et les téléphones présents — Joliba (D-095, D-096, D-107)
 *
 * En commande directe, le serveur donne à voix haute le code tiré à l'ouverture : sans lui, un
 * téléphone rejoint la table mais n'envoie rien en cuisine. D'ici, le serveur voit qui est à la
 * table (« Convive N »), admet un téléphone sans code — seulement s'il le voit à la table —, en
 * retire un, ou renouvelle le code s'il a fuité.
 *
 * Ces gestes demandent `table.session.open`, comme l'ouverture elle-même. Ils ne passent pas par
 * la file hors ligne : sans réseau, le téléphone du client ne peut pas non plus envoyer.
 */

import { useState } from "react";
import { useMutation } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import { KeyRound, RefreshCw, Smartphone } from "lucide-react";
import { toast } from "sonner";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
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
import { Alert, AlertDescription, AlertTitle } from "~/components/ui/alert";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "~/components/ui/card";
import { Item, ItemActions, ItemContent, ItemDescription, ItemGroup, ItemTitle } from "~/components/ui/item";
import { describeError } from "~/lib/errors";
import { ActionButton } from "./action-button";
import { useOutbox } from "./outbox-provider";
import { useServiceScope } from "./service-scope";

type Detail = FunctionReturnType<typeof api.sessions.detail>;
type Guest = Detail["guests"][number];

/** Une alerte de code est récente pendant 30 minutes, comme sur le plan de salle. */
const CODE_ALERT_MS = 30 * 60 * 1000;

function guestState(g: Guest): { label: string; variant: "default" | "secondary" | "outline" | "destructive" } {
  if (g.removed) return { label: "Retiré", variant: "destructive" };
  if (g.admitted) return { label: g.admittedBy === "staff" ? "Admis par le personnel" : "Admis par le code", variant: "default" };
  return { label: "Sans code", variant: "outline" };
}

/** Ouverture faite hors ligne : le code n'existe qu'une fois l'ouverture arrivée au serveur. */
export function TableCodePending() {
  return (
    <Alert>
      <KeyRound />
      <AlertTitle>Code de la table</AlertTitle>
      <AlertDescription>Code disponible au retour du réseau.</AlertDescription>
    </Alert>
  );
}

export function TableGuests({ detail }: { detail: Detail }) {
  const scope = useServiceScope();
  const { online } = useOutbox();
  const rotate = useMutation(api.sessions.rotateCode);
  const admit = useMutation(api.sessions.admitGuest);
  const remove = useMutation(api.sessions.removeGuest);
  const removeUnadmitted = useMutation(api.sessions.removeUnadmitted);
  const [purging, setPurging] = useState(false);
  const [admitting, setAdmitting] = useState<Guest | null>(null);
  const [removing, setRemoving] = useState<Guest | null>(null);
  const [rotating, setRotating] = useState(false);
  if (detail.orderingMode !== "guest_direct") return null;
  const manage = detail.can.manageGuests;
  const recentAlert = detail.codeAlertAt !== null && Date.now() - detail.codeAlertAt < CODE_ALERT_MS;

  const run = async (action: () => Promise<unknown>, done: string) => {
    try {
      await action();
      toast.success(done);
    } catch (error) {
      toast.error(describeError(error).message);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <KeyRound className="size-4" />
          Code de la table
        </CardTitle>
        <CardDescription>Donnez-le aux clients à leur arrivée : sans lui, leur téléphone ne peut pas envoyer en cuisine. Il change à chaque tablée.</CardDescription>
        {manage ? (
          <CardAction>
            <Button variant="outline" size="sm" disabled={!online} title={online ? undefined : "Pas sans réseau."} onClick={() => setRotating(true)}>
              <RefreshCw />
              Renouveler
            </Button>
          </CardAction>
        ) : null}
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {detail.code ? (
          <p className="font-mono text-4xl font-semibold tracking-[0.35em] tabular-nums" data-table-code aria-label={`Code ${detail.code.split("").join(" ")}`}>
            {detail.code}
          </p>
        ) : (
          <p className="text-sm text-muted-foreground">
            {manage ? "Pas de code pour cette table (ouverte avant la mise à jour) : touchez « Renouveler » pour en tirer un." : "Le code est visible par le personnel de salle."}
          </p>
        )}
        {recentAlert ? (
          <Alert variant="destructive">
            <AlertTitle>Trop de codes faux : le code a été renouvelé</AlertTitle>
            <AlertDescription>Donnez le nouveau code aux clients de la table. Si un téléphone vous semble étranger à la table, retirez-le.</AlertDescription>
          </Alert>
        ) : null}
        {manage && detail.guests.filter((g) => !g.admitted && !g.removed).length > 1 ? (
          <Button variant="outline" size="sm" className="w-fit" disabled={!online} onClick={() => setPurging(true)}>
            Retirer les téléphones sans code
          </Button>
        ) : null}
        {detail.guests.length === 0 ? (
          <p className="text-sm text-muted-foreground">Aucun téléphone n'a encore rejoint la table.</p>
        ) : (
          <ItemGroup className="gap-1" aria-label="Téléphones à la table">
            {detail.guests.map((g) => {
              const state = guestState(g);
              return (
                <Item key={g._id} size="sm" variant="muted" data-guest={g.number ?? undefined}>
                  <ItemContent>
                    <ItemTitle className="flex items-center gap-2">
                      <Smartphone className="size-4" />
                      {g.number !== null ? `Convive ${g.number}` : "Téléphone"}
                    </ItemTitle>
                    <ItemDescription>
                      <Badge variant={state.variant}>{state.label}</Badge>
                    </ItemDescription>
                  </ItemContent>
                  {manage && !g.removed ? (
                    <ItemActions className="flex-wrap">
                      {!g.admitted ? (
                        <Button size="sm" variant="outline" disabled={!online} onClick={() => setAdmitting(g)}>
                          Admettre
                        </Button>
                      ) : null}
                      <Button size="sm" variant="ghost" disabled={!online} onClick={() => setRemoving(g)}>
                        Retirer
                      </Button>
                    </ItemActions>
                  ) : null}
                </Item>
              );
            })}
          </ItemGroup>
        )}
      </CardContent>

      <AlertDialog open={rotating} onOpenChange={setRotating}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Renouveler le code de la table {detail.tableNumber} ?</AlertDialogTitle>
            <AlertDialogDescription>
              Un nouveau code est tiré. Les téléphones déjà admis continuent d'envoyer ; les autres devront saisir le nouveau code.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => void run(() => rotate({ ...scope.acting, sessionId: detail._id }), "Nouveau code tiré.")}
            >
              Renouveler
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={admitting !== null} onOpenChange={(o) => !o && setAdmitting(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Admettre le convive {admitting?.number ?? ""} ?</AlertDialogTitle>
            <AlertDialogDescription>
              Seulement si vous voyez ce téléphone à la table. Une fois admis, il envoie ses commandes directement en cuisine, sans le code.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <ActionButton
              onAction={async () => {
                const g = admitting;
                if (!g) return;
                await run(() => admit({ ...scope.acting, sessionId: detail._id, guestSessionId: g._id as Id<"guestSessions"> }), `Convive ${g.number ?? ""} admis.`);
                setAdmitting(null);
              }}
            >
              Admettre
            </ActionButton>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={purging} onOpenChange={setPurging}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Retirer tous les téléphones sans code ?</AlertDialogTitle>
            <AlertDialogDescription>
              Pour une table envahie de faux convives (une photo du QR qui circule). Les convives admis restent ; le code est renouvelé. Un vrai client retiré par erreur rescanne, et vous l'admettez depuis son panier.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <ActionButton
              variant="destructive"
              onAction={async () => {
                await run(() => removeUnadmitted({ ...scope.acting, sessionId: detail._id }), "Téléphones sans code retirés, code renouvelé.");
                setPurging(false);
              }}
            >
              Retirer
            </ActionButton>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={removing !== null} onOpenChange={(o) => !o && setRemoving(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Retirer le convive {removing?.number ?? ""} ?</AlertDialogTitle>
            <AlertDialogDescription>
              Ce téléphone ne pourra plus envoyer de commande à cette tablée, et le code est renouvelé en même temps : donnez le nouveau aux clients qui n'ont pas encore commandé. Ce qu'il a déjà commandé reste sur l'addition.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <ActionButton
              variant="destructive"
              onAction={async () => {
                const g = removing;
                if (!g) return;
                await run(() => remove({ ...scope.acting, sessionId: detail._id, guestSessionId: g._id as Id<"guestSessions"> }), `Convive ${g.number ?? ""} retiré, code renouvelé.`);
                setRemoving(null);
              }}
            >
              Retirer
            </ActionButton>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}
