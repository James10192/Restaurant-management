import { useCallback, useEffect, useState, type FormEvent } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery } from "convex/react";
import { Laptop, Smartphone } from "lucide-react";
import { api } from "../../convex/_generated/api";
import { Alert, AlertDescription } from "~/components/ui/alert";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "~/components/ui/card";
import { Field } from "~/components/ui/field";
import { Input } from "~/components/ui/input";
import { LoadingState } from "~/components/ui/states";
import { authClient } from "~/lib/auth-client";
import { describeError } from "~/lib/errors";

export const Route = createFileRoute("/app/account")({
  head: () => ({ meta: [{ title: "Mon compte — Joliba" }] }),
  component: AccountPage,
});

function AccountPage() {
  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-6">
      <h1 className="text-title-xl text-ink">Mon compte</h1>
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
      <CardHeader>
        <CardTitle>Profil</CardTitle>
        <CardDescription>Votre nom apparaît dans l'équipe et dans le journal des actions.</CardDescription>
      </CardHeader>
      <CardContent className="pb-5">
        <form onSubmit={submit} className="flex flex-col gap-4">
          <Field label="Nom affiché" error={error}>
            <Input value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" maxLength={80} />
          </Field>
          <p className="text-label text-ink-3">Adresse de connexion : {me?.email}</p>
          {saved ? (
            <Alert variant="success">
              <AlertDescription>Profil enregistré.</AlertDescription>
            </Alert>
          ) : null}
          <Button type="submit" loading={saving} loadingText="Enregistrement…" className="self-start">
            Enregistrer
          </Button>
        </form>
      </CardContent>
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
      <CardContent className="flex flex-col gap-4 pb-5">
        {error ? (
          <Alert variant="danger">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        ) : null}
        {sessions === null ? (
          <LoadingState />
        ) : (
          <ul className="divide-y divide-line rounded-sm border border-line">
            {sessions.map((s) => {
              const device = describeDevice(s.userAgent);
              const isCurrent = s.token === currentToken;
              const Icon = device.mobile ? Smartphone : Laptop;
              return (
                <li key={s.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
                  <Icon aria-hidden="true" className="size-5 text-ink-3" />
                  <div className="min-w-0 flex-1">
                    <p className="text-body text-ink">
                      {device.label} {isCurrent ? <Badge variant="success">Cet appareil</Badge> : null}
                    </p>
                    <p className="text-label text-ink-3">
                      Dernière activité le {new Date(s.updatedAt).toLocaleString("fr-FR", { dateStyle: "medium", timeStyle: "short" })}
                    </p>
                  </div>
                  {!isCurrent ? (
                    <Button variant="quiet" size="sm" loading={busy === s.token} loadingText="…" onClick={() => void revoke(s.token)}>
                      Déconnecter
                    </Button>
                  ) : null}
                </li>
              );
            })}
          </ul>
        )}
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" loading={busy === "others"} loadingText="Déconnexion…" onClick={() => void revokeOthers()}>
            Déconnecter les autres appareils
          </Button>
          <Button variant="danger" loading={busy === "all"} loadingText="Déconnexion…" onClick={() => void signOutEverywhere()}>
            Me déconnecter partout
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
