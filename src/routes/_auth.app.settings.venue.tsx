import { useEffect, useState, type FormEvent } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import { VENUE_TYPE_LABELS, type VenueType } from "../../convex/lib/validators";
import { CircleAlert, CircleCheck } from "lucide-react";
import { FormField } from "~/components/app/form-field";
import { PendingButton } from "~/components/app/pending-button";
import { LoadingState, PermissionDeniedState } from "~/components/app/states";
import { useWorkspace } from "~/components/app/workspace";
import { Alert, AlertDescription } from "~/components/ui/alert";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "~/components/ui/card";
import { Input } from "~/components/ui/input";
import { NativeSelect, NativeSelectOption } from "~/components/ui/native-select";
import { Textarea } from "~/components/ui/textarea";
import { describeError } from "~/lib/errors";
import { OpeningHoursCard, PublicMenuCard } from "~/components/venue/public-settings";

export const Route = createFileRoute("/_auth/app/settings/venue")({
  head: () => ({ meta: [{ title: "Établissement — Joliba" }] }),
  component: VenueSettingsPage,
});

function VenueSettingsPage() {
  const w = useWorkspace();
  const venueId = w.venue?._id;
  const allowed = venueId !== undefined && w.canInVenue("venue.manage");
  const venue = useQuery(api.venues.get, allowed ? { venueId } : "skip");
  if (!allowed) return <PermissionDeniedState venue={w.venue?.name} permission="Configurer l'établissement" />;
  if (!venue) return <LoadingState />;
  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-6">
      <VenueForm key={venue._id} venue={venue} />
      <OpeningHoursCard key={`hours-${venue._id}`} venueId={venue._id} hours={venue.openingHours} />
      <PublicMenuCard venueId={venue._id} enabled={venue.publicMenuEnabled} />
    </div>
  );
}

type VenueData = {
  _id: Id<"venues">;
  name: string;
  venueType: VenueType;
  currency: string;
  timezone: string;
  address: { line1?: string; line2?: string; city: string; district?: string; landmark?: string } | null;
  phone: string | null;
  publicEmail: string | null;
  description: string | null;
};

function VenueForm({ venue }: { venue: VenueData }) {
  const update = useMutation(api.venues.update);
  const [form, setForm] = useState({
    name: venue.name,
    venueType: venue.venueType,
    phone: venue.phone ?? "",
    publicEmail: venue.publicEmail ?? "",
    description: venue.description ?? "",
    city: venue.address?.city ?? "",
    district: venue.address?.district ?? "",
    line1: venue.address?.line1 ?? "",
    landmark: venue.address?.landmark ?? "",
  });
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  useEffect(() => setSaved(false), [form]);

  const set = <K extends keyof typeof form>(key: K) => (value: (typeof form)[K]) => setForm((f) => ({ ...f, [key]: value }));

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setSaving(true);
    try {
      const optional = (value: string) => (value.trim() ? value.trim() : undefined);
      const line1 = optional(form.line1);
      const district = optional(form.district);
      const landmark = optional(form.landmark);
      await update({
        venueId: venue._id,
        name: form.name,
        venueType: form.venueType,
        phone: form.phone,
        publicEmail: form.publicEmail,
        description: form.description,
        ...(form.city.trim()
          ? { address: { city: form.city, ...(line1 ? { line1 } : {}), ...(district ? { district } : {}), ...(landmark ? { landmark } : {}) } }
          : {}),
      });
      setSaved(true);
    } catch (e) {
      setError(describeError(e).message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={submit} noValidate className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Établissement</h1>
        <p className="text-muted-foreground">Ce que vos clients verront sur votre carte en ligne.</p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Identité</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <FormField label="Nom">
            <Input value={form.name} onChange={(e) => set("name")(e.target.value)} maxLength={80} />
          </FormField>
          <FormField label="Type d'établissement">
            <NativeSelect className="w-full" value={form.venueType} onChange={(e) => set("venueType")(e.target.value as VenueType)}>
              {(Object.entries(VENUE_TYPE_LABELS) as [VenueType, string][]).map(([value, label]) => (
                <NativeSelectOption key={value} value={value}>
                  {label}
                </NativeSelectOption>
              ))}
            </NativeSelect>
          </FormField>
          <FormField label="Description" optional description="Deux ou trois phrases : la cuisine, l'ambiance, la spécialité.">
            <Textarea value={form.description} onChange={(e) => set("description")(e.target.value)} maxLength={500} rows={3} />
          </FormField>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Adresse et contact</CardTitle>
          <CardDescription>Beaucoup d'adresses n'ont pas de numéro : le repère suffit souvent à vous trouver.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField label="Ville">
              <Input value={form.city} onChange={(e) => set("city")(e.target.value)} autoComplete="address-level2" />
            </FormField>
            <FormField label="Quartier" optional>
              <Input value={form.district} onChange={(e) => set("district")(e.target.value)} />
            </FormField>
          </div>
          <FormField label="Rue" optional>
            <Input value={form.line1} onChange={(e) => set("line1")(e.target.value)} autoComplete="address-line1" />
          </FormField>
          <FormField label="Repère" optional description="« Face à la pharmacie du carrefour », par exemple.">
            <Input value={form.landmark} onChange={(e) => set("landmark")(e.target.value)} />
          </FormField>
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField label="Téléphone" optional>
              <Input type="tel" inputMode="tel" value={form.phone} onChange={(e) => set("phone")(e.target.value)} autoComplete="tel" />
            </FormField>
            <FormField label="E-mail public" optional>
              <Input type="email" inputMode="email" value={form.publicEmail} onChange={(e) => set("publicEmail")(e.target.value)} />
            </FormField>
          </div>
        </CardContent>
      </Card>
      <Card size="sm">
        <CardContent>
          <dl className="grid grid-cols-2 gap-4 text-sm">
            <div className="flex flex-col gap-1">
              <dt className="text-muted-foreground">Devise</dt>
              <dd className="font-medium tabular-nums">{venue.currency}</dd>
            </div>
            <div className="flex min-w-0 flex-col gap-1">
              <dt className="text-muted-foreground">Fuseau horaire</dt>
              <dd className="truncate font-medium">{venue.timezone}</dd>
            </div>
          </dl>
        </CardContent>
      </Card>
      {error ? (
        <Alert variant="destructive">
          <CircleAlert />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}
      {saved ? (
        <Alert role="status">
          <CircleCheck />
          <AlertDescription>Modifications enregistrées.</AlertDescription>
        </Alert>
      ) : null}
      <PendingButton type="submit" size="lg" pending={saving} pendingText="Enregistrement…" className="self-start">
        Enregistrer
      </PendingButton>
    </form>
  );
}
