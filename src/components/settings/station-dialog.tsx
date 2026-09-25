import { useState, type FormEvent } from "react";
import { useMutation } from "convex/react";
import { CakeSlice, ChefHat, CircleAlert, Flame, Utensils, Wine, type LucideIcon } from "lucide-react";
import { toast } from "sonner";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { LIMITS } from "../../../convex/lib/catalog";
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
import { Alert, AlertDescription } from "~/components/ui/alert";
import { Button } from "~/components/ui/button";
import { Field, FieldContent, FieldDescription, FieldGroup, FieldLabel } from "~/components/ui/field";
import { Input } from "~/components/ui/input";
import { NativeSelect, NativeSelectOption } from "~/components/ui/native-select";
import { Switch } from "~/components/ui/switch";
import { describeError } from "~/lib/errors";

export type StationType = "kitchen" | "bar" | "grill" | "pastry" | "other";

export const STATION_TYPES: Record<StationType, { label: string; icon: LucideIcon }> = {
  kitchen: { label: "Cuisine", icon: ChefHat },
  bar: { label: "Bar", icon: Wine },
  grill: { label: "Grillades", icon: Flame },
  pastry: { label: "Pâtisserie", icon: CakeSlice },
  other: { label: "Autre", icon: Utensils },
};

/** Le type est stocké en texte libre : une valeur inconnue s'affiche comme « Autre ». */
export function stationTypeOf(type: string): { label: string; icon: LucideIcon } {
  return type in STATION_TYPES ? STATION_TYPES[type as StationType] : STATION_TYPES.other;
}

export type EditableStation = {
  _id: Id<"prepStations">;
  name: string;
  targetPrepMinutes: number;
  lateThresholdMinutes: number;
  soundEnabled: boolean;
};

/**
 * Création : nom et type seulement, le serveur choisit des temps sensés selon le type (5 min au
 * bar, 15 en cuisine). Modification : nom, temps visé, seuil de retard, son. Le type ne change
 * pas après coup.
 */
export function StationDialog({
  venueId,
  station,
  open,
  onOpenChange,
}: {
  venueId: Id<"venues">;
  /** `null` : création. */
  station: EditableStation | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <ResponsiveDialog open={open} onOpenChange={onOpenChange}>
      <ResponsiveDialogContent>
        {open ? (
          station ? (
            <EditForm key={station._id} venueId={venueId} station={station} onDone={() => onOpenChange(false)} />
          ) : (
            <CreateForm venueId={venueId} onDone={() => onOpenChange(false)} />
          )
        ) : null}
      </ResponsiveDialogContent>
    </ResponsiveDialog>
  );
}

function FormError({ error }: { error: string | null }) {
  return error ? (
    <Alert variant="destructive">
      <CircleAlert />
      <AlertDescription>{error}</AlertDescription>
    </Alert>
  ) : null;
}

function CreateForm({ venueId, onDone }: { venueId: Id<"venues">; onDone: () => void }) {
  const create = useMutation(api.stations.create);
  const [name, setName] = useState("");
  const [type, setType] = useState<StationType>("kitchen");
  const [nameError, setNameError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!name.trim()) {
      setNameError("Donnez un nom au poste.");
      return;
    }
    setNameError(null);
    setError(null);
    setSaving(true);
    try {
      await create({ venueId, name: name.trim(), type });
      toast.success(`Poste « ${name.trim()} » créé.`);
      onDone();
    } catch (e) {
      setError(describeError(e).message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={submit} noValidate className="grid gap-4">
      <ResponsiveDialogHeader>
        <ResponsiveDialogTitle>Nouveau poste</ResponsiveDialogTitle>
        <ResponsiveDialogDescription>
          Un poste reçoit les bons des produits qui lui sont routés, sur son propre écran.
        </ResponsiveDialogDescription>
      </ResponsiveDialogHeader>
      <FieldGroup>
        <FormField label="Nom" error={nameError}>
          <Input value={name} onChange={(e) => setName(e.target.value)} maxLength={LIMITS.name} autoFocus placeholder="Bar, Grillades…" />
        </FormField>
        <FormField label="Type" description="Il fixe les temps de départ : 5 minutes au bar, 15 ailleurs. Vous les ajusterez ensuite.">
          <NativeSelect className="w-full" value={type} onChange={(e) => setType(e.target.value as StationType)}>
            {(Object.entries(STATION_TYPES) as [StationType, { label: string }][]).map(([value, { label }]) => (
              <NativeSelectOption key={value} value={value}>
                {label}
              </NativeSelectOption>
            ))}
          </NativeSelect>
        </FormField>
        <FormError error={error} />
      </FieldGroup>
      <ResponsiveDialogFooter>
        <Button type="button" variant="ghost" onClick={onDone}>
          Annuler
        </Button>
        <PendingButton type="submit" pending={saving} pendingText="Création…">
          Créer le poste
        </PendingButton>
      </ResponsiveDialogFooter>
    </form>
  );
}

function parseMinutes(value: string): number | null {
  const n = Number(value);
  return Number.isInteger(n) && n >= 1 && n <= 180 ? n : null;
}

function EditForm({ venueId, station, onDone }: { venueId: Id<"venues">; station: EditableStation; onDone: () => void }) {
  const update = useMutation(api.stations.update);
  const [name, setName] = useState(station.name);
  const [target, setTarget] = useState(String(station.targetPrepMinutes));
  const [late, setLate] = useState(String(station.lateThresholdMinutes));
  const [sound, setSound] = useState(station.soundEnabled);
  const [errors, setErrors] = useState<{ name?: string; target?: string; late?: string }>({});
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    const targetMinutes = parseMinutes(target);
    const lateMinutes = parseMinutes(late);
    const next: typeof errors = {};
    if (!name.trim()) next.name = "Donnez un nom au poste.";
    if (targetMinutes === null) next.target = "Un nombre entier de 1 à 180 minutes.";
    if (lateMinutes === null) next.late = "Un nombre entier de 1 à 180 minutes.";
    else if (targetMinutes !== null && lateMinutes < targetMinutes) next.late = "Le retard ne peut pas commencer avant le temps visé.";
    setErrors(next);
    if (Object.keys(next).length > 0 || targetMinutes === null || lateMinutes === null) return;
    setError(null);
    setSaving(true);
    try {
      await update({
        venueId,
        stationId: station._id,
        name: name.trim(),
        targetPrepMinutes: targetMinutes,
        lateThresholdMinutes: lateMinutes,
        soundEnabled: sound,
      });
      toast.success("Poste enregistré.");
      onDone();
    } catch (e) {
      setError(describeError(e).message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={submit} noValidate className="grid gap-4">
      <ResponsiveDialogHeader>
        <ResponsiveDialogTitle>Modifier « {station.name} »</ResponsiveDialogTitle>
        <ResponsiveDialogDescription>
          Les temps pilotent les couleurs de l'écran : un bon passe en retard au-delà du seuil.
        </ResponsiveDialogDescription>
      </ResponsiveDialogHeader>
      <FieldGroup>
        <FormField label="Nom" error={errors.name}>
          <Input value={name} onChange={(e) => setName(e.target.value)} maxLength={LIMITS.name} />
        </FormField>
        <div className="grid gap-4 sm:grid-cols-2">
          <FormField label="Temps visé (min)" error={errors.target}>
            <Input type="number" inputMode="numeric" min={1} max={180} step={1} value={target} onChange={(e) => setTarget(e.target.value)} />
          </FormField>
          <FormField label="En retard après (min)" error={errors.late}>
            <Input type="number" inputMode="numeric" min={1} max={180} step={1} value={late} onChange={(e) => setLate(e.target.value)} />
          </FormField>
        </div>
        <Field orientation="horizontal">
          <FieldContent>
            <FieldLabel htmlFor={`station-sound-${station._id}`}>Son à l'arrivée d'un bon</FieldLabel>
            <FieldDescription>Coupez-le pour un poste en salle, près des clients.</FieldDescription>
          </FieldContent>
          <Switch id={`station-sound-${station._id}`} checked={sound} onCheckedChange={setSound} />
        </Field>
        <FormError error={error} />
      </FieldGroup>
      <ResponsiveDialogFooter>
        <Button type="button" variant="ghost" onClick={onDone}>
          Annuler
        </Button>
        <PendingButton type="submit" pending={saving} pendingText="Enregistrement…">
          Enregistrer
        </PendingButton>
      </ResponsiveDialogFooter>
    </form>
  );
}
