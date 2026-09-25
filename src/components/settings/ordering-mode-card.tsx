import { useId, useState } from "react";
import { useMutation } from "convex/react";
import { CircleAlert } from "lucide-react";
import { toast } from "sonner";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { RadioChoice } from "~/components/settings/radio-choice";
import { Alert, AlertDescription } from "~/components/ui/alert";
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "~/components/ui/card";
import { RadioGroup } from "~/components/ui/radio-group";
import { Spinner } from "~/components/ui/spinner";
import { describeError } from "~/lib/errors";

/**
 * Les trois modes que le serveur accepte (D-061, D-068, D-106). La commande directe n'est ouverte
 * qu'avec le code de la table (D-095) : une photo du QR ne suffit plus pour commander depuis la
 * rue. `hybrid` reste refusé (D-094) : le proposer n'aboutirait qu'à une erreur.
 */
export type OrderingMode = "staff_only" | "guest_with_approval" | "guest_direct";

const MODES: Record<OrderingMode, { title: string; description: string }> = {
  staff_only: {
    title: "Le serveur prend la commande",
    description:
      "Le client compose son panier sur son téléphone, mais rien ne part : il montre l'écran à son serveur, qui l'importe d'un geste. Recommandé.",
  },
  guest_with_approval: {
    title: "Le client envoie, un serveur valide",
    description:
      "La commande attend l'accord d'un serveur avant d'aller en cuisine, et le client lit qu'elle n'y est pas encore. Sans réponse, la zone est alertée au bout de 90 secondes et la commande expire à 10 minutes.",
  },
  guest_direct: {
    title: "Le client envoie directement en cuisine, avec le code de la table",
    description:
      "À l'ouverture, la table reçoit un code de quatre chiffres, nouveau à chaque tablée, que le serveur donne aux clients. Avec lui, chacun envoie sa commande de son téléphone, sans attendre ; on règle à la fin. Un téléphone se retire depuis la fiche de la table. Tous les plats partent au premier service.",
  },
};

/** Le mode en vigueur, tel que le renvoie `venues.get`. */
export function readOrderingMode(source: object): OrderingMode | null {
  const value = "orderingMode" in source ? source.orderingMode : undefined;
  return value === "staff_only" || value === "guest_with_approval" || value === "guest_direct" ? value : null;
}

export function OrderingModeCard({ venueId, current }: { venueId: Id<"venues">; current: OrderingMode | null }) {
  const setOrderingMode = useMutation(api.venues.setOrderingMode);
  const [pending, setPending] = useState<OrderingMode | null>(null);
  const [error, setError] = useState<string | null>(null);
  const idPrefix = useId();
  const value = pending ?? current;

  async function choose(mode: OrderingMode) {
    if (mode === value) return;
    setError(null);
    setPending(mode);
    try {
      await setOrderingMode({ venueId, orderingMode: mode });
      toast.success("Mode de commande enregistré.");
    } catch (e) {
      setError(describeError(e).message);
    } finally {
      setPending(null);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Mode de commande des clients</CardTitle>
        <CardDescription>Ce que le client peut faire après avoir scanné le QR de sa table.</CardDescription>
        {pending ? (
          <CardAction>
            <Spinner aria-label="Enregistrement…" />
          </CardAction>
        ) : null}
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <RadioGroup
          aria-label="Mode de commande des clients"
          value={value ?? ""}
          disabled={pending !== null}
          onValueChange={(next) => void choose(next as OrderingMode)}
        >
          {(Object.entries(MODES) as [OrderingMode, (typeof MODES)[OrderingMode]][]).map(([mode, m]) => (
            <RadioChoice key={mode} id={`${idPrefix}-${mode}`} value={mode} title={m.title} description={m.description} />
          ))}
        </RadioGroup>
        <p className="text-sm text-muted-foreground">
          La commande directe, sans validation d'un serveur, n'est pas encore proposée.
        </p>
        {error ? (
          <Alert variant="destructive">
            <CircleAlert />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        ) : null}
      </CardContent>
    </Card>
  );
}
