import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { useAction, useMutation, useQuery } from "convex/react";
import { CircleAlert, CircleCheck, ExternalLink, ImagePlus, Trash2 } from "lucide-react";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { normalizeHex, resolveBrandColor } from "../../../convex/lib/brand";
import { PendingButton } from "~/components/app/pending-button";
import { LoadingState } from "~/components/app/states";
import { Button } from "~/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "~/components/ui/card";
import { Field, FieldDescription, FieldLabel } from "~/components/ui/field";
import { Input } from "~/components/ui/input";
import { describeError } from "~/lib/errors";
import { PhotoError, reduceLogo, uploadBlob } from "~/lib/photo";
import { PREVIEW_MESSAGE, PREVIEW_READY, type PreviewMessage } from "~/lib/preview";

/**
 * L'apparence de la carte client : une couleur, un logo, et l'aperçu — Joliba (T7.a, D-149 à D-159)
 *
 * Enregistrer publie (D-156) : la carte en ligne change aussitôt. D'où l'aperçu, qui montre la
 * vraie carte AVANT l'enregistrement. La couleur n'est jamais refusée : l'écran dit ce qui sera
 * affiché, et pourquoi, quand elle a dû être assombrie pour rester lisible (D-150).
 *
 * Partagé par Réglages › Apparence et l'étape « Marque » de la mise en route (D-159).
 */
export function AppearanceEditor({ venueId }: { venueId: Id<"venues"> }) {
  const data = useQuery(api.branding.get, { venueId });
  if (!data) return <LoadingState />;
  return <Editor key={venueId} venueId={venueId} data={data} />;
}

type Data = NonNullable<ReturnType<typeof useQuery<typeof api.branding.get>>>;

function Editor({ venueId, data }: { venueId: Id<"venues">; data: Data }) {
  const [input, setInput] = useState(data.color?.input ?? "");
  const hex = normalizeHex(input);
  // Le même calcul que le serveur, dans le navigateur : l'aperçu suit la saisie sans aller-retour.
  const resolved = useMemo(() => (hex ? resolveBrandColor(hex) : null), [hex]);
  const logo = data.logo?.url ? { url: data.logo.url, width: data.logo.width, height: data.logo.height } : null;

  return (
    <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_390px] lg:items-start">
      <div className="flex min-w-0 flex-col gap-6">
        <ColorCard venueId={venueId} data={data} input={input} onInput={setInput} resolved={resolved} />
        <LogoCard venueId={venueId} logo={logo} />
      </div>
      <PreviewFrame venueId={venueId} primary={input.trim() === "" ? null : (resolved?.primary ?? data.color?.primary ?? null)} logo={logo} publicSlug={data.publicMenuEnabled ? data.slug : null} />
    </div>
  );
}

function Feedback({ ok, text }: { ok: boolean; text: string }) {
  const Icon = ok ? CircleCheck : CircleAlert;
  return (
    <p role={ok ? "status" : "alert"} className={ok ? "flex items-center gap-1.5 text-sm text-muted-foreground" : "flex items-center gap-1.5 text-sm text-destructive"}>
      <Icon aria-hidden="true" className="size-4 shrink-0" />
      {text}
    </p>
  );
}

function Swatch({ color, label }: { color: string; label: string }) {
  return (
    <span className="flex items-center gap-2 text-sm">
      <span aria-hidden="true" className="size-6 shrink-0 rounded-md ring-1 ring-border" style={{ background: color }} />
      <span>
        {label} <span className="font-mono text-muted-foreground">{color}</span>
      </span>
    </span>
  );
}

function ColorCard(props: {
  venueId: Id<"venues">;
  data: Data;
  input: string;
  onInput: (value: string) => void;
  resolved: ReturnType<typeof resolveBrandColor> | null;
}) {
  const { data, input, resolved } = props;
  const setColor = useMutation(api.branding.setColor);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const saved = data.color?.input ?? "";
  const dirty = (normalizeHex(input) ?? input.trim()) !== saved;
  const invalid = input.trim() !== "" && !resolved;

  async function save(color: string | null) {
    setBusy(true);
    setMessage(null);
    try {
      await setColor({ venueId: props.venueId, color });
      setMessage({ ok: true, text: color ? "Couleur enregistrée : la carte en ligne l'affiche déjà." : "La carte a repris la couleur de Joliba." });
    } catch (e) {
      setMessage({ ok: false, text: describeError(e).message });
    } finally {
      setBusy(false);
    }
  }

  function submit(event: FormEvent) {
    event.preventDefault();
    if (input.trim() === "") void save(null);
    else if (resolved) void save(resolved.input);
  }

  return (
    <Card>
      <form onSubmit={submit} className="flex flex-col gap-6">
        <CardHeader>
          <CardTitle>Couleur</CardTitle>
          <CardDescription>
            Elle marque le bouton d'ajout et la section qu'on lit. Le reste de la carte reste sobre, pour que les plats passent devant.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <Field>
            <FieldLabel htmlFor="brand-color">Couleur de votre établissement</FieldLabel>
            <div className="flex items-center gap-3">
              <input
                type="color"
                aria-label="Choisir dans la palette"
                value={resolved?.input ?? data.jolibaColor}
                onChange={(e) => props.onInput(e.target.value)}
                className="h-11 w-14 shrink-0 cursor-pointer rounded-md border bg-background p-1"
              />
              <Input
                id="brand-color"
                value={input}
                onChange={(e) => props.onInput(e.target.value)}
                placeholder={`Aucune : ${data.jolibaColor}`}
                autoComplete="off"
                spellCheck={false}
                aria-invalid={invalid || undefined}
                aria-describedby="brand-color-help"
                className="h-11 max-w-44 font-mono"
              />
            </div>
            <FieldDescription id="brand-color-help">Au format #RRVVBB, celui de votre logo ou de votre enseigne. Laissez vide pour la couleur de Joliba.</FieldDescription>
          </Field>
          {invalid ? <Feedback ok={false} text="Ce n'est pas une couleur au format #RRVVBB." /> : null}
          {resolved ? (
            <div className="flex flex-col gap-2 rounded-lg border p-3" aria-live="polite">
              {resolved.adjusted ? (
                <>
                  <p className="text-sm">Pour rester lisible sur la carte, votre couleur sera affichée un peu plus sombre.</p>
                  <div className="flex flex-wrap gap-x-6 gap-y-2">
                    <Swatch color={resolved.input} label="Choisie" />
                    <Swatch color={resolved.primary} label="Affichée" />
                  </div>
                </>
              ) : (
                <Swatch color={resolved.primary} label="Lisible telle quelle" />
              )}
            </div>
          ) : null}
        </CardContent>
        <CardFooter className="flex-wrap gap-3">
          <PendingButton type="submit" pending={busy} pendingText="Enregistrement…" disabled={!dirty || invalid}>
            Enregistrer la couleur
          </PendingButton>
          {saved ? (
            <Button
              type="button"
              variant="ghost"
              disabled={busy}
              onClick={() => {
                props.onInput("");
                void save(null);
              }}
            >
              Revenir à la couleur de Joliba
            </Button>
          ) : null}
          {message ? <Feedback ok={message.ok} text={message.text} /> : null}
        </CardFooter>
      </form>
    </Card>
  );
}

function LogoCard({ venueId, logo }: { venueId: Id<"venues">; logo: PreviewMessage["logo"] }) {
  const uploadUrl = useMutation(api.branding.generateLogoUploadUrl);
  const setLogo = useAction(api.branding.setLogo);
  const removeLogo = useMutation(api.branding.removeLogo);
  const fileInput = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);

  async function add(file: File) {
    setBusy(true);
    setMessage(null);
    try {
      const blob = await reduceLogo(file);
      const storageId = await uploadBlob(await uploadUrl({ venueId }), blob);
      const result = await setLogo({ venueId, storageId: storageId as Id<"_storage"> });
      setMessage(result.ok ? { ok: true, text: "Logo enregistré : la carte en ligne l'affiche déjà." } : { ok: false, text: result.message });
    } catch (e) {
      setMessage({ ok: false, text: e instanceof PhotoError ? e.message : describeError(e).message });
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    setBusy(true);
    setMessage(null);
    try {
      await removeLogo({ venueId });
      setMessage({ ok: true, text: "Logo retiré : la carte affiche votre nom seul." });
    } catch (e) {
      setMessage({ ok: false, text: describeError(e).message });
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Logo</CardTitle>
        <CardDescription>Montré à côté de votre nom, sur une pastille claire. Un PNG sur fond transparent donne le meilleur résultat ; il est réduit avant l'envoi.</CardDescription>
      </CardHeader>
      <CardContent className="flex items-center gap-4">
        <span className="grid size-16 shrink-0 place-items-center overflow-hidden rounded-xl bg-white p-1.5 ring-1 ring-border">
          {logo ? <img src={logo.url} width={logo.width} height={logo.height} alt="Votre logo" className="max-h-full max-w-full object-contain" /> : <span className="text-xs text-muted-foreground">Aucun</span>}
        </span>
        <p className="text-sm text-muted-foreground">{logo ? "Ce logo est en ligne." : "Sans logo, la carte affiche votre nom seul."}</p>
      </CardContent>
      <CardFooter className="flex-wrap gap-3">
        <PendingButton type="button" variant="outline" pending={busy} pendingText="Envoi…" onClick={() => fileInput.current?.click()}>
          <ImagePlus data-icon="inline-start" />
          {logo ? "Remplacer le logo" : "Ajouter un logo"}
        </PendingButton>
        {logo ? (
          <Button type="button" variant="ghost" disabled={busy} onClick={() => void remove()}>
            <Trash2 data-icon="inline-start" />
            Retirer
          </Button>
        ) : null}
        <input
          ref={fileInput}
          type="file"
          // Pas de SVG : il peut porter du script (D-153).
          accept="image/png,image/webp,image/jpeg"
          className="hidden"
          tabIndex={-1}
          aria-hidden="true"
          onChange={(e) => {
            const file = e.target.files?.[0];
            e.target.value = "";
            if (file) void add(file);
          }}
        />
        {message ? <Feedback ok={message.ok} text={message.text} /> : null}
      </CardFooter>
    </Card>
  );
}

/**
 * La vraie carte, dans un cadre de téléphone de 390 px (D-157). Elle reçoit la couleur en cours de
 * saisie par `postMessage`, sur la même origine seulement ; le cadre, lui, n'écoute que sa fenêtre
 * parente.
 */
function PreviewFrame({ venueId, primary, logo, publicSlug }: { venueId: Id<"venues">; primary: string | null; logo: PreviewMessage["logo"]; publicSlug: string | null }) {
  const frame = useRef<HTMLIFrameElement>(null);
  const state = useRef<PreviewMessage>({ type: PREVIEW_MESSAGE, primary, logo });
  state.current = { type: PREVIEW_MESSAGE, primary, logo };

  const send = () => frame.current?.contentWindow?.postMessage(state.current, window.location.origin);
  useEffect(send, [primary, logo?.url]);
  useEffect(() => {
    const ready = (event: MessageEvent) => {
      if (event.origin === window.location.origin && event.source === frame.current?.contentWindow && (event.data as { type?: string })?.type === PREVIEW_READY) send();
    };
    window.addEventListener("message", ready);
    return () => window.removeEventListener("message", ready);
  }, []);

  return (
    <aside className="flex flex-col items-center gap-3 lg:sticky lg:top-6" aria-label="Aperçu">
      <p className="self-start text-sm font-medium lg:self-center">Aperçu, sur un téléphone</p>
      <iframe
        ref={frame}
        src={`/apercu/${venueId}`}
        title="Aperçu de la carte"
        className="h-[720px] w-full max-w-[390px] rounded-[28px] border-[6px] border-foreground/85 bg-background"
      />
      {publicSlug ? (
        <Button asChild variant="link" size="sm">
          <a href={`/menu/${publicSlug}`} target="_blank" rel="noopener noreferrer">
            Voir la carte en ligne
            <ExternalLink data-icon="inline-end" />
          </a>
        </Button>
      ) : (
        <p className="max-w-[390px] text-center text-xs text-muted-foreground">L'aperçu montre vos cartes publiées. Votre carte n'est pas encore ouverte au public.</p>
      )}
    </aside>
  );
}
