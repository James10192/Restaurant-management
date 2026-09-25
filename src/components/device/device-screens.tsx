import { useState, type FormEvent, type ReactNode } from "react";
import { useMutation } from "convex/react";
import { ArrowLeft, Delete, KeyRound, Lock, Smartphone } from "lucide-react";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { JolibaMark } from "~/components/app/auth-layout";
import { FormField } from "~/components/app/form-field";
import { PendingButton } from "~/components/app/pending-button";
import { EmptyState } from "~/components/app/states";
import { Alert, AlertDescription } from "~/components/ui/alert";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "~/components/ui/alert-dialog";
import { Avatar, AvatarFallback } from "~/components/ui/avatar";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "~/components/ui/card";
import { Input } from "~/components/ui/input";
import { Item, ItemActions, ItemContent, ItemGroup, ItemMedia, ItemTitle } from "~/components/ui/item";
import { describeError } from "~/lib/errors";
import { useDevice, type UnlockRefusal } from "./device-session";

/** Un écran d'appareil : centré, sobre, lisible à bout de bras. */
export function DeviceFrame({ children }: { children: ReactNode }) {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-6 bg-muted p-4">
      <JolibaMark />
      <div className="w-full max-w-sm">{children}</div>
    </main>
  );
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return ((parts[0]?.[0] ?? "?") + (parts[1]?.[0] ?? "")).toUpperCase();
}

const minutes = (ms: number) => Math.max(1, Math.ceil(ms / 60_000));

/** Enrôler : le code vient d'un gérant (Réglages › Appareils), il vaut 10 minutes et une fois. */
export function EnrollScreen() {
  const device = useDevice();
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setPending(true);
    setError(null);
    const result = await device.enroll(code.replace(/[\s-]/g, "").toUpperCase());
    setPending(false);
    if (!result.ok) setError(result.message);
  }

  return (
    <DeviceFrame>
      <Card>
        <CardHeader>
          <CardTitle>Enrôler cet appareil</CardTitle>
          <CardDescription>
            Un gérant obtient le code dans Réglages › Appareils. L'appareil sert ensuite à toute l'équipe, chacun avec son PIN.
          </CardDescription>
        </CardHeader>
        <form onSubmit={submit}>
          <CardContent className="flex flex-col gap-4">
            {device.revoked ? (
              <Alert variant="destructive">
                <AlertDescription>Cet appareil a été retiré par un gérant. Enrôlez-le de nouveau pour continuer.</AlertDescription>
              </Alert>
            ) : null}
            <FormField label="Code d'enrôlement" error={error ?? undefined}>
              <Input
                autoFocus
                autoComplete="off"
                autoCapitalize="characters"
                spellCheck={false}
                placeholder="XXXX-XXXX"
                className="text-center font-mono text-lg tracking-widest uppercase"
                value={code}
                onChange={(e) => setCode(e.target.value)}
              />
            </FormField>
          </CardContent>
          <CardFooter className="mt-4">
            <PendingButton type="submit" className="w-full" size="lg" pending={pending} pendingText="Vérification…" disabled={code.replace(/[\s-]/g, "").length !== 8}>
              Enrôler
            </PendingButton>
          </CardFooter>
        </form>
      </Card>
    </DeviceFrame>
  );
}

/** L'écran de verrouillage : on touche son nom, on tape son PIN. */
export function LockScreen() {
  const device = useDevice();
  const roster = device.roster!;
  const [picked, setPicked] = useState<{ memberId: Id<"organizationMembers">; name: string } | null>(
    roster.deviceType === "personal" && roster.people.length === 1 ? roster.people[0]! : null,
  );
  const [activating, setActivating] = useState(false);

  if (activating) return <ActivateScreen onDone={() => setActivating(false)} />;
  if (picked) return <PinScreen member={picked} onBack={roster.deviceType === "personal" ? undefined : () => setPicked(null)} />;

  return (
    <DeviceFrame>
      <Card>
        <CardHeader>
          <CardTitle>{roster.venueName}</CardTitle>
          <CardDescription>{roster.label} · touchez votre nom</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          {roster.pinSuspendedUntil ? (
            <Alert variant="destructive">
              <AlertDescription>
                Trop de PIN erronés sur cet appareil : la saisie reprend dans {minutes(roster.pinSuspendedUntil - Date.now())} min. Un gérant a été averti.
              </AlertDescription>
            </Alert>
          ) : null}
          {roster.people.length === 0 ? (
            <EmptyState title="Personne n'a encore de PIN" description="Un gérant remet un code d'activation depuis la page Équipe." />
          ) : (
            <ItemGroup className="gap-2">
              {roster.people.map((p) => (
                <Item key={p.memberId} variant="outline" asChild>
                  <button type="button" onClick={() => setPicked(p)} disabled={roster.pinSuspendedUntil !== null}>
                    <ItemMedia>
                      <Avatar>
                        <AvatarFallback>{initials(p.name)}</AvatarFallback>
                      </Avatar>
                    </ItemMedia>
                    <ItemContent>
                      <ItemTitle>{p.name}</ItemTitle>
                    </ItemContent>
                    {p.locked ? (
                      <ItemActions>
                        <Badge variant="secondary">
                          <Lock />
                          Bloqué
                        </Badge>
                      </ItemActions>
                    ) : null}
                  </button>
                </Item>
              ))}
            </ItemGroup>
          )}
        </CardContent>
        <CardFooter className="flex-col gap-2">
          <Button variant="outline" className="w-full" onClick={() => setActivating(true)}>
            <KeyRound />
            Activer mon PIN
          </Button>
          <ForgetDeviceButton />
        </CardFooter>
      </Card>
    </DeviceFrame>
  );
}

function refusalMessage(r: UnlockRefusal): string {
  switch (r.reason) {
    case "wrong_pin":
      return r.attemptsLeft > 0 ? `PIN incorrect. Encore ${r.attemptsLeft} essai${r.attemptsLeft > 1 ? "s" : ""} avant blocage.` : "PIN incorrect.";
    case "locked":
      return `Trop d'essais : réessayez dans ${minutes(r.retryAfter)} min.`;
    case "device_suspended":
      return `Trop de PIN erronés sur cet appareil : reprise dans ${minutes(r.retryAfter)} min.`;
    case "pin_unavailable":
      return "Votre PIN n'est pas actif. Demandez un code d'activation à un gérant.";
    case "not_here":
      return "Vous ne pouvez pas vous identifier sur cet appareil.";
  }
}

/** Le clavier du PIN : grand, chiffres seulement, jamais affiché en clair. */
function PinPad({ value, onChange, disabled }: { value: string; onChange: (v: string) => void; disabled?: boolean }) {
  const press = (d: string) => value.length < 4 && onChange(value + d);
  return (
    <div className="grid grid-cols-3 gap-2">
      {["1", "2", "3", "4", "5", "6", "7", "8", "9"].map((d) => (
        <Button key={d} type="button" variant="outline" size="lg" className="h-14 text-xl" disabled={disabled} onClick={() => press(d)}>
          {d}
        </Button>
      ))}
      <span />
      <Button type="button" variant="outline" size="lg" className="h-14 text-xl" disabled={disabled} onClick={() => press("0")}>
        0
      </Button>
      <Button type="button" variant="ghost" size="lg" className="h-14" aria-label="Effacer" disabled={disabled || value.length === 0} onClick={() => onChange(value.slice(0, -1))}>
        <Delete />
      </Button>
    </div>
  );
}

function PinField({ label, value, onChange, autoFocus }: { label: string; value: string; onChange: (v: string) => void; autoFocus?: boolean }) {
  return (
    <FormField label={label}>
      <Input
        type="password"
        inputMode="numeric"
        autoComplete="off"
        maxLength={4}
        autoFocus={autoFocus}
        className="text-center text-2xl tracking-[0.5em]"
        value={value}
        onChange={(e) => onChange(e.target.value.replace(/\D/g, "").slice(0, 4))}
      />
    </FormField>
  );
}

function PinScreen({ member, onBack }: { member: { memberId: Id<"organizationMembers">; name: string }; onBack?: () => void }) {
  const device = useDevice();
  const [pin, setPin] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function submit(value: string) {
    if (value.length !== 4 || pending) return;
    setPending(true);
    setError(null);
    try {
      const result = await device.unlock(member.memberId, value);
      if (!result.ok) {
        setError(refusalMessage(result));
        setPin("");
      }
    } catch (e) {
      setError(describeError(e).message);
      setPin("");
    } finally {
      setPending(false);
    }
  }

  const change = (v: string) => {
    setPin(v);
    if (v.length === 4) void submit(v);
  };

  return (
    <DeviceFrame>
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            {onBack ? (
              <Button variant="ghost" size="icon" aria-label="Changer de personne" onClick={onBack}>
                <ArrowLeft />
              </Button>
            ) : null}
            <div>
              <CardTitle>{member.name}</CardTitle>
              <CardDescription>Votre PIN à 4 chiffres</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <PinField label="PIN" value={pin} onChange={change} autoFocus />
          {error ? (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          ) : null}
          <PinPad value={pin} onChange={change} disabled={pending} />
        </CardContent>
      </Card>
    </DeviceFrame>
  );
}

/** Choisir son PIN avec le code remis par un gérant. Le gérant ne connaît jamais le PIN. */
function ActivateScreen({ onDone }: { onDone: () => void }) {
  const device = useDevice();
  const activate = useMutation(api.operators.activate);
  const [code, setCode] = useState("");
  const [pin, setPin] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (pin !== confirm) {
      setError("Les deux PIN ne sont pas identiques.");
      return;
    }
    setPending(true);
    setError(null);
    try {
      const result = await activate({ deviceToken: device.deviceToken!, code: code.replace(/[\s-]/g, "").toUpperCase(), pin });
      if (result.ok) setDone(result.name);
      else if (result.reason === "weak_pin") setError(result.message);
      else if (result.reason === "rate_limited") setError("Trop d'essais. Patientez une minute.");
      else setError("Ce code n'est pas valable : il a pu expirer (24 heures) ou servir déjà.");
    } catch (err) {
      setError(describeError(err).message);
    } finally {
      setPending(false);
    }
  }

  if (done) {
    return (
      <DeviceFrame>
        <Card>
          <CardHeader>
            <CardTitle>PIN enregistré</CardTitle>
            <CardDescription>{done}, touchez votre nom puis tapez votre PIN pour commencer. Ne le confiez à personne.</CardDescription>
          </CardHeader>
          <CardFooter>
            <Button className="w-full" onClick={onDone}>
              Continuer
            </Button>
          </CardFooter>
        </Card>
      </DeviceFrame>
    );
  }

  return (
    <DeviceFrame>
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" aria-label="Retour" onClick={onDone}>
              <ArrowLeft />
            </Button>
            <div>
              <CardTitle>Activer mon PIN</CardTitle>
              <CardDescription>Avec le code remis par un gérant, valable 24 heures.</CardDescription>
            </div>
          </div>
        </CardHeader>
        <form onSubmit={submit}>
          <CardContent className="flex flex-col gap-4">
            <FormField label="Code d'activation">
              <Input
                autoFocus
                autoComplete="off"
                autoCapitalize="characters"
                spellCheck={false}
                placeholder="XXXX-XXXX"
                className="text-center font-mono tracking-widest uppercase"
                value={code}
                onChange={(e) => setCode(e.target.value)}
              />
            </FormField>
            <PinField label="Nouveau PIN (4 chiffres)" value={pin} onChange={setPin} />
            <PinField label="Le même, encore une fois" value={confirm} onChange={setConfirm} />
            <p className="text-sm text-muted-foreground">Pas de date de naissance, pas de 1234 ni de 0000.</p>
            {error ? (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            ) : null}
          </CardContent>
          <CardFooter className="mt-4">
            <PendingButton type="submit" className="w-full" size="lg" pending={pending} disabled={pin.length !== 4 || confirm.length !== 4 || code.replace(/[\s-]/g, "").length !== 8}>
              Enregistrer mon PIN
            </PendingButton>
          </CardFooter>
        </form>
      </Card>
    </DeviceFrame>
  );
}

/**
 * Oublier l'appareil (avant de le donner ou de le changer de restaurant). Seulement sur cet
 * appareil : pour qu'il ne compte plus, un gérant le révoque dans Réglages › Appareils.
 */
export function ForgetDeviceButton() {
  const device = useDevice();
  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button variant="link" size="sm" className="text-muted-foreground">
          <Smartphone />
          Ce n'est plus l'appareil de ce restaurant
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Oublier cet appareil ?</AlertDialogTitle>
          <AlertDialogDescription>
            Il faudra un nouveau code d'enrôlement pour s'en servir. Les gestes non envoyés restent sur l'appareil. Pour
            qu'il ne compte plus du tout, un gérant le révoque dans Réglages › Appareils.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Garder</AlertDialogCancel>
          <AlertDialogAction onClick={device.forget}>Oublier</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
