import { useState, type FormEvent } from "react";
import { useMutation, useQuery } from "convex/react";
import { CircleAlert } from "lucide-react";
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
import { OneTimeCode } from "~/components/settings/one-time-code";
import { RadioChoice } from "~/components/settings/radio-choice";
import { Alert, AlertDescription } from "~/components/ui/alert";
import { Button } from "~/components/ui/button";
import { FieldGroup, FieldLegend, FieldSet } from "~/components/ui/field";
import { Input } from "~/components/ui/input";
import { NativeSelect, NativeSelectOption } from "~/components/ui/native-select";
import { RadioGroup } from "~/components/ui/radio-group";
import { describeError } from "~/lib/errors";

export type DeviceType = "kds" | "shared" | "personal";

export const DEVICE_TYPES: Record<DeviceType, { label: string; description: string; placeholder: string }> = {
  kds: {
    label: "Écran de cuisine",
    description: "Affiche les bons d'un poste. Personne ne s'y identifie.",
    placeholder: "Écran du bar",
  },
  shared: {
    label: "Appareil partagé de salle",
    description: "Une tablette pour l'équipe : chacun s'y identifie avec son PIN.",
    placeholder: "Tablette du comptoir",
  },
  personal: {
    label: "Appareil personnel",
    description: "Le téléphone d'un membre : lui seul peut s'y identifier.",
    placeholder: "Téléphone d'Aminata",
  },
};

type Issued = { code: string; expiresAt: number; label: string };

export function DeviceEnrollmentDialog({
  venueId,
  open,
  onOpenChange,
  canReadStations,
  canReadTeam,
}: {
  venueId: Id<"venues">;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  canReadStations: boolean;
  canReadTeam: boolean;
}) {
  const [issued, setIssued] = useState<Issued | null>(null);
  // Un nouveau formulaire à chaque ouverture : jamais l'ancien code en réouvrant.
  const [attempt, setAttempt] = useState(0);

  function change(next: boolean) {
    if (!next) {
      setIssued(null);
      setAttempt((n) => n + 1);
    }
    onOpenChange(next);
  }

  return (
    <ResponsiveDialog open={open} onOpenChange={change}>
      <ResponsiveDialogContent>
        {issued ? (
          <div className="grid gap-4">
            <ResponsiveDialogHeader>
              <ResponsiveDialogTitle>Code pour « {issued.label} »</ResponsiveDialogTitle>
              <ResponsiveDialogDescription>Saisissez-le sur l'appareil à ajouter, avant qu'il n'expire.</ResponsiveDialogDescription>
            </ResponsiveDialogHeader>
            <OneTimeCode
              code={issued.code}
              expiresAt={issued.expiresAt}
              validity="10 minutes"
              label="Code d'enrôlement"
              instruction={
                <>
                  Sur l'appareil, ouvrez <strong className="font-medium break-all">{window.location.origin}/appareil</strong> et saisissez
                  ce code.
                </>
              }
            />
            <ResponsiveDialogFooter>
              <Button
                variant="ghost"
                onClick={() => {
                  setIssued(null);
                  setAttempt((n) => n + 1);
                }}
              >
                Ajouter un autre appareil
              </Button>
              <Button onClick={() => change(false)}>Terminé</Button>
            </ResponsiveDialogFooter>
          </div>
        ) : open ? (
          <EnrollmentForm
            key={attempt}
            venueId={venueId}
            canReadStations={canReadStations}
            canReadTeam={canReadTeam}
            onIssued={setIssued}
            onCancel={() => change(false)}
          />
        ) : null}
      </ResponsiveDialogContent>
    </ResponsiveDialog>
  );
}

function EnrollmentForm({
  venueId,
  canReadStations,
  canReadTeam,
  onIssued,
  onCancel,
}: {
  venueId: Id<"venues">;
  canReadStations: boolean;
  canReadTeam: boolean;
  onIssued: (issued: Issued) => void;
  onCancel: () => void;
}) {
  const createEnrollment = useMutation(api.devices.createEnrollment);
  const [type, setType] = useState<DeviceType>("shared");
  const [label, setLabel] = useState("");
  const [stationId, setStationId] = useState("");
  const [memberId, setMemberId] = useState("");
  const [errors, setErrors] = useState<{ label?: string; station?: string; member?: string }>({});
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);

  const stations = useQuery(api.stations.list, type === "kds" && canReadStations ? { venueId } : "skip");
  const members = useQuery(api.team.listMembers, type === "personal" && canReadTeam ? { scope: { venueId } } : "skip");
  const activeStations = stations?.filter((s) => s.isActive) ?? [];
  const activeMembers = members?.filter((m) => m.status === "active") ?? [];

  async function submit(event: FormEvent) {
    event.preventDefault();
    const next: typeof errors = {};
    if (!label.trim()) next.label = "Donnez un nom à l'appareil, pour le reconnaître dans la liste.";
    if (type === "kds" && !stationId) next.station = "Choisissez le poste que cet écran affiche.";
    if (type === "personal" && !memberId) next.member = "Choisissez à qui appartient ce téléphone.";
    setErrors(next);
    if (Object.keys(next).length > 0) return;
    setError(null);
    setSending(true);
    try {
      const result = await createEnrollment({
        venueId,
        label: label.trim(),
        deviceType: type,
        ...(type === "kds" ? { stationId: stationId as Id<"prepStations"> } : {}),
        ...(type === "personal" ? { memberId: memberId as Id<"organizationMembers"> } : {}),
      });
      onIssued({ ...result, label: label.trim() });
    } catch (e) {
      setError(describeError(e).message);
    } finally {
      setSending(false);
    }
  }

  const blocked = (type === "kds" && !canReadStations) || (type === "personal" && !canReadTeam);

  return (
    <form onSubmit={submit} noValidate className="grid gap-4">
      <ResponsiveDialogHeader>
        <ResponsiveDialogTitle>Ajouter un appareil</ResponsiveDialogTitle>
        <ResponsiveDialogDescription>
          L'appareil n'aura pas de compte : un code à usage unique le rattache à cet établissement.
        </ResponsiveDialogDescription>
      </ResponsiveDialogHeader>
      <FieldGroup>
        <FieldSet>
          <FieldLegend variant="label">Type d'appareil</FieldLegend>
          <RadioGroup value={type} onValueChange={(value) => setType(value as DeviceType)}>
            {(Object.entries(DEVICE_TYPES) as [DeviceType, (typeof DEVICE_TYPES)[DeviceType]][]).map(([value, t]) => (
              <RadioChoice key={value} id={`device-type-${value}`} value={value} title={t.label} description={t.description} />
            ))}
          </RadioGroup>
        </FieldSet>
        <FormField label="Nom de l'appareil" error={errors.label}>
          <Input value={label} onChange={(e) => setLabel(e.target.value)} maxLength={LIMITS.name} placeholder={DEVICE_TYPES[type].placeholder} />
        </FormField>
        {type === "kds" ? (
          canReadStations ? (
            <FormField label="Poste affiché" error={errors.station}>
              <NativeSelect className="w-full" value={stationId} onChange={(e) => setStationId(e.target.value)} disabled={stations === undefined}>
                <NativeSelectOption value="">{stations === undefined ? "Chargement des postes…" : "Choisir un poste"}</NativeSelectOption>
                {activeStations.map((s) => (
                  <NativeSelectOption key={s._id} value={s._id}>
                    {s.name}
                  </NativeSelectOption>
                ))}
              </NativeSelect>
            </FormField>
          ) : (
            <Alert>
              <CircleAlert />
              <AlertDescription>Votre rôle ne permet pas de voir les postes de préparation : un écran de cuisine doit en afficher un.</AlertDescription>
            </Alert>
          )
        ) : null}
        {type === "personal" ? (
          canReadTeam ? (
            <FormField label="Membre" error={errors.member} description="Seuls les membres affectés à cet établissement apparaissent.">
              <NativeSelect className="w-full" value={memberId} onChange={(e) => setMemberId(e.target.value)} disabled={members === undefined}>
                <NativeSelectOption value="">{members === undefined ? "Chargement de l'équipe…" : "Choisir un membre"}</NativeSelectOption>
                {activeMembers.map((m) => (
                  <NativeSelectOption key={m.memberId} value={m.memberId}>
                    {m.name ?? m.email ?? "Membre"}
                  </NativeSelectOption>
                ))}
              </NativeSelect>
            </FormField>
          ) : (
            <Alert>
              <CircleAlert />
              <AlertDescription>Votre rôle ne permet pas de voir l'équipe : impossible de choisir le propriétaire du téléphone.</AlertDescription>
            </Alert>
          )
        ) : null}
        {error ? (
          <Alert variant="destructive">
            <CircleAlert />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        ) : null}
      </FieldGroup>
      <ResponsiveDialogFooter>
        <Button type="button" variant="ghost" onClick={onCancel}>
          Annuler
        </Button>
        <PendingButton type="submit" pending={sending} pendingText="Création du code…" disabled={blocked}>
          Obtenir un code
        </PendingButton>
      </ResponsiveDialogFooter>
    </form>
  );
}
