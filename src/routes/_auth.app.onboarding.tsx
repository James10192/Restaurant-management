import { useState, type FormEvent } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { COUNTRIES, type CountryCode } from "../../convex/lib/countries";
import { VENUE_TYPE_LABELS, type VenueType } from "../../convex/lib/validators";
import { useWorkspace } from "~/components/app/workspace";
import { Alert, AlertDescription, AlertTitle } from "~/components/ui/alert";
import { Button } from "~/components/ui/button";
import { Card, CardContent } from "~/components/ui/card";
import { Checkbox } from "~/components/ui/checkbox";
import { Field } from "~/components/ui/field";
import { Input } from "~/components/ui/input";
import { NativeSelect } from "~/components/ui/native-select";
import { describeError } from "~/lib/errors";

export const Route = createFileRoute("/_auth/app/onboarding")({
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
      await navigate({ to: "/app" });
    } catch (e) {
      setFormError(describeError(e).message);
      setSubmitting(false);
    }
  }

  return (
    <div className="mx-auto max-w-xl">
      <h1 className="text-title-xl text-ink">Ouvrir mon établissement</h1>
      <p className="mt-2 text-body text-ink-2">
        Deux minutes suffisent. Tout se modifie ensuite, sauf la devise, qui se fige à votre premier encaissement.
      </p>
      <Card className="mt-6">
        <CardContent className="py-6">
          <form onSubmit={submit} noValidate className="flex flex-col gap-5">
            {askName ? (
              <Field label="Votre nom" error={errors.person} description="Votre équipe le verra à la place de votre adresse e-mail.">
                <Input value={person} onChange={(e) => setPerson(e.target.value)} autoComplete="name" maxLength={80} />
              </Field>
            ) : null}
            <Field label="Nom de votre restaurant ou de votre groupe" error={errors.organization} description="C'est le nom sous lequel vous facturerez.">
              <Input value={organization} onChange={(e) => setOrganization(e.target.value)} autoComplete="organization" maxLength={80} />
            </Field>
            <label className="flex min-h-(--tap) items-center gap-3 text-body text-ink">
              <Checkbox checked={sameName} onCheckedChange={(v) => setSameName(v === true)} />
              L'établissement porte le même nom
            </label>
            {!sameName ? (
              <Field label="Nom de l'établissement" error={errors.venue} description="Par exemple le quartier : « Maquis Awa — Cocody ».">
                <Input value={venue} onChange={(e) => setVenue(e.target.value)} maxLength={80} />
              </Field>
            ) : null}
            <Field label="Type d'établissement">
              <NativeSelect value={venueType} onChange={(e) => setVenueType(e.target.value as VenueType)}>
                {(Object.entries(VENUE_TYPE_LABELS) as [VenueType, string][]).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </NativeSelect>
            </Field>
            <Field label="Pays">
              <NativeSelect value={countryCode} onChange={(e) => setCountryCode(e.target.value as CountryCode)}>
                {(Object.entries(COUNTRIES) as [CountryCode, (typeof COUNTRIES)[CountryCode]][]).map(([code, c]) => (
                  <option key={code} value={code}>
                    {c.label}
                  </option>
                ))}
              </NativeSelect>
            </Field>
            <Field label="Ville" optional>
              <Input value={city} onChange={(e) => setCity(e.target.value)} autoComplete="address-level2" maxLength={80} />
            </Field>
            <Alert variant="info">
              <AlertTitle>Devise : {country.currency === "XOF" ? "franc CFA (XOF)" : "franc CFA (XAF)"}</AlertTitle>
              <AlertDescription>
                Elle découle du pays et se fige dès le premier encaissement, pour que vos comptes restent justes.
              </AlertDescription>
            </Alert>
            {formError ? (
              <Alert variant="danger">
                <AlertDescription>{formError}</AlertDescription>
              </Alert>
            ) : null}
            <Button type="submit" size="lg" loading={submitting} loadingText="Création…">
              Ouvrir l'établissement
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
