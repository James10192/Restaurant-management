import { useState, type FormEvent } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery } from "convex/react";
import { CircleAlert, Coins } from "lucide-react";
import { api } from "../../convex/_generated/api";
import { COUNTRIES, type CountryCode } from "../../convex/lib/countries";
import { VENUE_TYPE_LABELS, type VenueType } from "../../convex/lib/validators";
import { LoadingState, PermissionDeniedState } from "~/components/app/states";
import { useWorkspace } from "~/components/app/workspace";
import { FormField } from "~/components/app/form-field";
import { PendingButton } from "~/components/app/pending-button";
import { Alert, AlertDescription, AlertTitle } from "~/components/ui/alert";
import { Card, CardContent, CardFooter } from "~/components/ui/card";
import { Checkbox } from "~/components/ui/checkbox";
import { Field, FieldGroup, FieldLabel } from "~/components/ui/field";
import { Input } from "~/components/ui/input";
import { NativeSelect, NativeSelectOption } from "~/components/ui/native-select";
import { Button } from "~/components/ui/button";
import { AppearanceEditor } from "~/components/venue/appearance";
import { describeError } from "~/lib/errors";

export const Route = createFileRoute("/_auth/app/onboarding")({
  // L'étape vit dans l'adresse : choisir la nouvelle organisation remonte la page, un état local
  // serait perdu (et un rechargement ramènerait au formulaire déjà envoyé).
  validateSearch: (search: Record<string, unknown>): { etape?: "marque" } => (search.etape === "marque" ? { etape: "marque" } : {}),
  head: () => ({ meta: [{ title: "Ouvrir mon établissement — Joliba" }] }),
  component: Onboarding,
});

type Errors = Partial<Record<"person" | "organization" | "venue", string>>;

function Onboarding() {
  const create = useMutation(api.organizations.create);
  const updateProfile = useMutation(api.users.updateProfile);
  const me = useQuery(api.users.me, {});
  const askName = me !== undefined && me !== null && !me.name;
  const [person, setPerson] = useState("");
  const w = useWorkspace();
  const navigate = useNavigate();
  const [organization, setOrganization] = useState("");
  const [venue, setVenue] = useState("");
  const [sameName, setSameName] = useState(true);
  const [countryCode, setCountryCode] = useState<CountryCode>("CI");
  const [venueType, setVenueType] = useState<VenueType>("maquis");
  const [city, setCity] = useState("");
  const [errors, setErrors] = useState<Errors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const { etape } = Route.useSearch();

  const country = COUNTRIES[countryCode];
  const venueName = sameName ? organization : venue;

  async function submit(event: FormEvent) {
    event.preventDefault();
    const next: Errors = {};
    if (askName && person.trim().length < 2) next.person = "Indiquez votre nom : c'est lui que verra votre équipe.";
    if (organization.trim().length < 2) next.organization = "Indiquez le nom de votre restaurant ou de votre groupe.";
    if (!sameName && venue.trim().length < 2) next.venue = "Indiquez le nom de cet établissement.";
    setErrors(next);
    if (Object.keys(next).length > 0) return;
    setSubmitting(true);
    setFormError(null);
    try {
      if (askName) await updateProfile({ name: person });
      const result = await create({
        name: organization,
        countryCode,
        venue: { name: venueName, venueType, ...(city.trim() ? { city } : {}) },
      });
      w.selectOrganization(result.organizationId);
      // Deuxième étape, facultative : la marque (D-159). Le bouton reste verrouillé : un second
      // appui pendant le chargement de la nouvelle organisation en créerait une deuxième.
      await navigate({ to: "/app/onboarding", search: { etape: "marque" } });
    } catch (e) {
      setFormError(describeError(e).message);
      setSubmitting(false);
    }
  }

  if (etape === "marque") return <BrandStep />;

  return (
    <div className="mx-auto flex w-full max-w-xl flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight">Ouvrir mon établissement</h1>
        <p className="text-muted-foreground">
          Deux minutes suffisent. Tout se modifie ensuite, sauf la devise, qui se fige à votre premier encaissement.
        </p>
      </div>
      <Card>
        <form onSubmit={submit} noValidate className="flex flex-col gap-(--card-spacing)">
          <CardContent>
            <FieldGroup>
              {askName ? (
                <FormField label="Votre nom" error={errors.person} description="Votre équipe le verra à la place de votre adresse e-mail.">
                  <Input value={person} onChange={(e) => setPerson(e.target.value)} autoComplete="name" maxLength={80} />
                </FormField>
              ) : null}
              <FormField
                label="Nom de votre restaurant ou de votre groupe"
                error={errors.organization}
                description="C'est le nom sous lequel vous facturerez."
              >
                <Input value={organization} onChange={(e) => setOrganization(e.target.value)} autoComplete="organization" maxLength={80} />
              </FormField>
              <Field orientation="horizontal">
                <Checkbox id="onboarding-same-name" checked={sameName} onCheckedChange={(v) => setSameName(v === true)} />
                <FieldLabel htmlFor="onboarding-same-name" className="font-normal">
                  L'établissement porte le même nom
                </FieldLabel>
              </Field>
              {!sameName ? (
                <FormField label="Nom de l'établissement" error={errors.venue} description="Par exemple le quartier : « Maquis Awa — Cocody ».">
                  <Input value={venue} onChange={(e) => setVenue(e.target.value)} maxLength={80} />
                </FormField>
              ) : null}
              <div className="grid gap-5 sm:grid-cols-2">
                <FormField label="Type d'établissement">
                  <NativeSelect className="w-full" value={venueType} onChange={(e) => setVenueType(e.target.value as VenueType)}>
                    {(Object.entries(VENUE_TYPE_LABELS) as [VenueType, string][]).map(([value, label]) => (
                      <NativeSelectOption key={value} value={value}>
                        {label}
                      </NativeSelectOption>
                    ))}
                  </NativeSelect>
                </FormField>
                <FormField label="Pays">
                  <NativeSelect className="w-full" value={countryCode} onChange={(e) => setCountryCode(e.target.value as CountryCode)}>
                    {(Object.entries(COUNTRIES) as [CountryCode, (typeof COUNTRIES)[CountryCode]][]).map(([code, c]) => (
                      <NativeSelectOption key={code} value={code}>
                        {c.label}
                      </NativeSelectOption>
                    ))}
                  </NativeSelect>
                </FormField>
              </div>
              <FormField label="Ville" optional>
                <Input value={city} onChange={(e) => setCity(e.target.value)} autoComplete="address-level2" maxLength={80} />
              </FormField>
              <Alert>
                <Coins />
                <AlertTitle>Devise : {country.currency === "XOF" ? "franc CFA (XOF)" : "franc CFA (XAF)"}</AlertTitle>
                <AlertDescription>
                  Elle découle du pays et se fige dès le premier encaissement, pour que vos comptes restent justes.
                </AlertDescription>
              </Alert>
              {formError ? (
                <Alert variant="destructive">
                  <CircleAlert />
                  <AlertDescription>{formError}</AlertDescription>
                </Alert>
              ) : null}
            </FieldGroup>
          </CardContent>
          <CardFooter>
            <PendingButton type="submit" size="lg" pending={submitting} pendingText="Création…" className="w-full sm:ml-auto sm:w-auto">
              Ouvrir l'établissement
            </PendingButton>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
}

/** L'étape « Votre marque » : le même éditeur que Réglages › Apparence (D-159), facultatif. */
function BrandStep() {
  const w = useWorkspace();
  const navigate = useNavigate();
  // La nouvelle organisation vient d'être choisie : ses droits arrivent après un aller-retour.
  if (w.status !== "ready" || !w.venue) return <LoadingState />;
  if (!w.canInVenue("venue.manage")) return <PermissionDeniedState venue={w.venue.name} permission="Configurer l'établissement" />;
  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-semibold tracking-tight">Votre marque sur la carte</h1>
          <p className="text-muted-foreground">Facultatif : votre couleur et votre logo. Vous les retrouverez dans Réglages › Apparence.</p>
        </div>
        <Button size="lg" onClick={() => void navigate({ to: "/app" })}>
          Continuer
        </Button>
      </div>
      <AppearanceEditor venueId={w.venue._id} />
    </div>
  );
}
