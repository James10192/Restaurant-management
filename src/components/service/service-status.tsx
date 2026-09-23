import { useState } from "react";
import { CircleAlert, ClipboardList, Megaphone, WifiOff } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "~/components/ui/alert";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { Item, ItemActions, ItemContent, ItemDescription, ItemGroup, ItemTitle } from "~/components/ui/item";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "~/components/ui/sheet";
import { AUTO_SEND_MAX_MS, useOutbox, useToRegularize, useUnannounced } from "./outbox-provider";

const time = new Intl.DateTimeFormat("fr-FR", { hour: "2-digit", minute: "2-digit" });

/**
 * L'état de la liaison, dit sans détour (D-062) : hors ligne, les gestes attendent ; au-delà de
 * trois minutes, le service passe au papier ; une commande que la cuisine n'a pas reçue se
 * dit de vive voix.
 */
export function ServiceStatus() {
  const { online, offlineFor, entries } = useOutbox();
  const unannounced = useUnannounced();
  const toRegularize = useToRegularize();
  const [open, setOpen] = useState(false);
  const waiting = entries.filter((e) => e.status === "pending" || e.status === "sending").length;

  return (
    <div className="flex flex-col gap-2 empty:hidden">
      {!online && offlineFor >= AUTO_SEND_MAX_MS ? (
        <Alert variant="destructive">
          <WifiOff />
          <AlertTitle>Service dégradé : plus de réseau depuis {Math.floor(offlineFor / 60_000)} min</AlertTitle>
          <AlertDescription>
            Passez au carnet. Montrez le bon en cuisine. Au retour du réseau, les commandes de plus de trois minutes ne
            repartiront pas seules : vous direz lesquelles ont déjà été préparées.
          </AlertDescription>
        </Alert>
      ) : !online ? (
        <Alert>
          <WifiOff />
          <AlertTitle>Hors ligne</AlertTitle>
          <AlertDescription>
            {waiting > 0 ? `${waiting} geste${waiting > 1 ? "s" : ""} en attente. ` : ""}Ils partiront dès le retour du réseau,
            dans l'ordre.
          </AlertDescription>
        </Alert>
      ) : null}
      {unannounced.length > 0 ? (
        <Alert variant="destructive">
          <Megaphone />
          <AlertTitle>La cuisine ne l'a PAS reçue — annoncez-la</AlertTitle>
          <AlertDescription>{unannounced.map((e) => e.label).join(" · ")}</AlertDescription>
        </Alert>
      ) : null}
      {toRegularize.length > 0 ? (
        <Alert>
          <CircleAlert />
          <AlertTitle>À régulariser : {toRegularize.length}</AlertTitle>
          <AlertDescription>Des gestes attendent une décision avant de partir, ou ont été refusés.</AlertDescription>
          <Button size="sm" variant="outline" className="col-start-2 mt-2 w-fit" onClick={() => setOpen(true)}>
            <ClipboardList />
            Voir
          </Button>
        </Alert>
      ) : null}
      <RegularizeSheet open={open} onOpenChange={setOpen} />
    </div>
  );
}

/** Chaque geste en suspens, et ce qu'on peut en faire. Rien ne part sans qu'une personne le décide. */
function RegularizeSheet({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const { resolve } = useOutbox();
  const entries = useToRegularize();
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="data-[side=bottom]:max-h-[85dvh] overflow-y-auto">
        <SheetHeader>
          <SheetTitle>À régulariser</SheetTitle>
          <SheetDescription>
            Une commande restée plus de trois minutes sans réseau a peut-être été préparée sur papier : dites ce qu'il en est.
          </SheetDescription>
        </SheetHeader>
        <ItemGroup className="px-4 pb-4">
          {entries.length === 0 ? <p className="text-sm text-muted-foreground">Rien à régulariser.</p> : null}
          {entries.map((e) => {
            const isOrder = e.mutation === "orders:submit";
            return (
              <Item key={e.opId} variant="outline">
                <ItemContent>
                  <ItemTitle>
                    {e.label}
                    {e.status === "rejected" ? <Badge variant="destructive">Refusé</Badge> : <Badge variant="secondary">En attente de décision</Badge>}
                  </ItemTitle>
                  <ItemDescription>
                    Saisi à {time.format(e.createdAt)}
                    {e.error ? ` — ${e.error.message}` : ""}
                  </ItemDescription>
                </ItemContent>
                <ItemActions className="flex-wrap">
                  {e.status === "needs_review" && isOrder ? (
                    <Button size="sm" onClick={() => void resolve(e.opId, { kind: "send_as", args: { ...e.args, recordOnly: true, heldCourses: [] } })}>
                      Déjà préparée
                    </Button>
                  ) : null}
                  {e.status === "needs_review" ? (
                    <Button size="sm" variant="outline" onClick={() => void resolve(e.opId, { kind: "send" })}>
                      {isOrder ? "Envoyer en cuisine" : "Envoyer"}
                    </Button>
                  ) : null}
                  <Button size="sm" variant="ghost" onClick={() => void resolve(e.opId, { kind: "drop" })}>
                    {e.status === "rejected" ? "Retirer" : "Annuler"}
                  </Button>
                </ItemActions>
              </Item>
            );
          })}
        </ItemGroup>
      </SheetContent>
    </Sheet>
  );
}
