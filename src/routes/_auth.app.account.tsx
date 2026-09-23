import { useCallback, useEffect, useState, type FormEvent } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery } from "convex/react";
import { CircleAlert, CircleCheck, Laptop, Smartphone } from "lucide-react";
import { api } from "../../convex/_generated/api";
import { FormField } from "~/components/app/form-field";
import { PendingButton } from "~/components/app/pending-button";
import { LoadingState } from "~/components/app/states";
import { Alert, AlertDescription } from "~/components/ui/alert";
import { Badge } from "~/components/ui/badge";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "~/components/ui/card";
import { FieldGroup } from "~/components/ui/field";
import { Input } from "~/components/ui/input";
import { Item, ItemActions, ItemContent, ItemDescription, ItemGroup, ItemMedia, ItemSeparator, ItemTitle } from "~/components/ui/item";
import { authClient } from "~/lib/auth-client";
import { describeError } from "~/lib/errors";

export const Route = createFileRoute("/_auth/app/account")({
  head: () => ({ meta: [{ title: "Mon compte — Joliba" }] }),
  component: AccountPage,
});

function AccountPage() {
  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight">Mon compte</h1>
        <p className="text-muted-foreground">Votre profil et les appareils connectés à votre compte.</p>
      </div>
      <ProfileCard />
      <SessionsCard />
    </div>
  );
}

function ProfileCard() {
  const me = useQuery(api.users.me, {});
  const updateProfile = useMutation(api.users.updateProfile);
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  useEffect(() => {
    if (me) setName(me.name ?? "");
  }, [me]);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setSaved(false);
    setSaving(true);
    try {
      await updateProfile({ name });
      setSaved(true);
    } catch (e) {
      setError(describeError(e).message);
    } finally {
      setSaving(false);
    }
  }

  if (me === undefined) return <LoadingState />;
  return (
    <Card>
      <form onSubmit={submit} className="flex flex-col gap-(--card-spacing)">
        <CardHeader>
          <CardTitle>Profil</CardTitle>
          <CardDescription>Votre nom apparaît dans l'équipe et dans le journal des actions.</CardDescription>
        </CardHeader>
        <CardContent>
          <FieldGroup>
            <FormField label="Nom affiché" error={error} description={<>Adresse de connexion : {me?.email}</>}>
              <Input value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" maxLength={80} />
            </FormField>
            {saved ? (
              <Alert>
                <CircleCheck />
                <AlertDescription>Profil enregistré.</AlertDescription>
              </Alert>
            ) : null}
          </FieldGroup>
        </CardContent>
        <CardFooter>
          <PendingButton type="submit" pending={saving} pendingText="Enregistrement…" className="w-full sm:w-auto">
            Enregistrer
          </PendingButton>
        </CardFooter>
      </form>
    </Card>
  );
}

type SessionRow = { id: string; token: string; userAgent?: string | null; createdAt: Date | string; updatedAt: Date | string };

/** « Chrome sur Android », « Safari sur iPhone »… Sans prétendre à l'exactitude. */
function describeDevice(userAgent: string | null | undefined): { label: string; mobile: boolean } {
  const ua = userAgent ?? "";
  const os = /iPhone|iPad/.test(ua)
    ? "iPhone"
    : /Android/.test(ua)
      ? "Android"
      : /Windows/.test(ua)
        ? "Windows"
        : /Mac OS X/.test(ua)
          ? "Mac"
          : /Linux/.test(ua)
            ? "Linux"
            : "appareil inconnu";
  const browser = /Edg\//.test(ua) ? "Edge" : /Chrome\//.test(ua) ? "Chrome" : /Firefox\//.test(ua) ? "Firefox" : /Safari\//.test(ua) ? "Safari" : "Navigateur";
  return { label: `${browser} sur ${os}`, mobile: /iPhone|Android/.test(ua) };
}

function SessionsCard() {
  const navigate = useNavigate();
  const current = authClient.useSession();
  const [sessions, setSessions] = useState<SessionRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    const { data, error: failure } = await authClient.listSessions();
    if (failure) {
      setError("La liste de vos appareils n'a pas pu être chargée.");
      return;
    }
    setSessions((data ?? []) as SessionRow[]);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const currentToken = current.data?.session.token;

  async function revoke(token: string) {
    setBusy(token);
    setError(null);
    const { error: failure } = await authClient.revokeSession({ token });
    setBusy(null);
    if (failure) setError("Cet appareil n'a pas pu être déconnecté. Réessayez.");
    await load();
  }

  async function revokeOthers() {
    setBusy("others");
    setError(null);
    const { error: failure } = await authClient.revokeOtherSessions();
    setBusy(null);
    if (failure) setError("Les autres appareils n'ont pas pu être déconnectés. Réessayez.");
    await load();
  }

  async function signOutEverywhere() {
    setBusy("all");
    await authClient.revokeSessions();
    await authClient.signOut();
    await navigate({ to: "/connexion", replace: true });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Appareils connectés</CardTitle>
        <CardDescription>
          Un téléphone perdu ou prêté ? Déconnectez-le ici. L'appareil perd l'accès au plus tard dans les 15 minutes, le temps
          que son jeton en cours expire.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {error ? (
          <Alert variant="destructive">
            <CircleAlert />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        ) : null}
        {sessions === null ? (
          <LoadingState />
        ) : (
          <ItemGroup className="gap-0 rounded-lg border">
            {sessions.map((s, index) => {
              const device = describeDevice(s.userAgent);
              const isCurrent = s.token === currentToken;
              const Icon = device.mobile ? Smartphone : Laptop;
              return (
                <div key={s.id} role="listitem">
                  {index > 0 ? <ItemSeparator className="my-0" /> : null}
                  <Item>
                    <ItemMedia variant="icon">
                      <Icon aria-hidden="true" />
                    </ItemMedia>
                    <ItemContent className="min-w-0">
                      <ItemTitle className="flex-wrap">
                        {device.label} {isCurrent ? <Badge variant="secondary">Cet appareil</Badge> : null}
                      </ItemTitle>
                      <ItemDescription>
                        Dernière activité le{" "}
                        {new Date(s.updatedAt).toLocaleString("fr-FR", { dateStyle: "medium", timeStyle: "short" })}
                      </ItemDescription>
                    </ItemContent>
                    {!isCurrent ? (
                      <ItemActions>
                        <PendingButton
                          variant="ghost"
                          size="sm"
                          pending={busy === s.token}
                          pendingText="Déconnexion…"
                          onClick={() => void revoke(s.token)}
                        >
                          Déconnecter
                        </PendingButton>
                      </ItemActions>
                    ) : null}
                  </Item>
                </div>
              );
            })}
          </ItemGroup>
        )}
      </CardContent>
      <CardFooter className="flex-col items-stretch gap-2 sm:flex-row sm:justify-end">
        <PendingButton variant="outline" pending={busy === "others"} pendingText="Déconnexion…" onClick={() => void revokeOthers()}>
          Déconnecter les autres appareils
        </PendingButton>
        <PendingButton variant="destructive" pending={busy === "all"} pendingText="Déconnexion…" onClick={() => void signOutEverywhere()}>
          Me déconnecter partout
        </PendingButton>
      </CardFooter>
    </Card>
  );
}
