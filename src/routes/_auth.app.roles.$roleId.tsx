import { useEffect, useMemo, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery } from "convex/react";
import { ArrowLeft, CircleAlert, CircleCheck, TriangleAlert } from "lucide-react";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import type { Permission } from "../../convex/lib/permissions";
import { FormField } from "~/components/app/form-field";
import { PendingButton } from "~/components/app/pending-button";
import { LoadingState, PermissionDeniedState } from "~/components/app/states";
import { useWorkspace } from "~/components/app/workspace";
import { Alert, AlertDescription, AlertTitle } from "~/components/ui/alert";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "~/components/ui/card";
import { Checkbox } from "~/components/ui/checkbox";
import { Field, FieldContent, FieldDescription, FieldGroup, FieldLabel } from "~/components/ui/field";
import { Input } from "~/components/ui/input";
import { Textarea } from "~/components/ui/textarea";
import { describeError } from "~/lib/errors";

export const Route = createFileRoute("/_auth/app/roles/$roleId")({
  head: () => ({ meta: [{ title: "Rôle — Joliba" }] }),
  component: RoleEditorPage,
});

const NEW = "nouveau";

function RoleEditorPage() {
  const { roleId } = Route.useParams();
  const w = useWorkspace();
  const allowed = w.canInOrganization("permissions.manage");
  const organizationId = w.organization?._id;
  const roles = useQuery(api.roles.list, allowed && organizationId ? { organizationId } : "skip");
  const catalog = useQuery(api.roles.catalog, allowed ? {} : "skip");

  if (!allowed || !organizationId) return <PermissionDeniedState permission="Gérer les rôles et les permissions" />;
  if (roles === undefined || catalog === undefined) return <LoadingState />;

  const role = roleId === NEW ? null : roles.find((r) => r._id === roleId);
  if (roleId !== NEW && !role) {
    return (
      <Alert>
        <TriangleAlert />
        <AlertTitle>Ce rôle est introuvable</AlertTitle>
        <AlertDescription>
          <p>
            Il a peut-être été archivé.{" "}
            <Link to="/app/roles" className="underline underline-offset-4">
              Revenir aux rôles
            </Link>
          </p>
        </AlertDescription>
      </Alert>
    );
  }
  return <RoleEditor key={roleId} organizationId={organizationId} role={role ?? null} catalog={catalog} holds={w.canInOrganization} />;
}

type CatalogEntry = { key: Permission; label: string; group: string; scope: string; sensitive: boolean };
type RoleData = {
  _id: Id<"roles">;
  label: string;
  description: string | null;
  permissions: string[];
  memberCount: number;
  isCustom: boolean;
};

function RoleEditor({
  organizationId,
  role,
  catalog,
  holds,
}: {
  organizationId: Id<"organizations">;
  role: RoleData | null;
  catalog: CatalogEntry[];
  holds: (p: Permission) => boolean;
}) {
  const navigate = useNavigate();
  const create = useMutation(api.roles.create);
  const update = useMutation(api.roles.update);
  const archive = useMutation(api.roles.archive);
  const [label, setLabel] = useState(role?.label ?? "");
  const [description, setDescription] = useState(role?.description ?? "");
  const [selected, setSelected] = useState<Set<string>>(new Set(role?.permissions ?? []));
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => setSaved(false), [label, description, selected]);

  const groups = useMemo(() => {
    const map = new Map<string, CatalogEntry[]>();
    for (const entry of catalog) map.set(entry.group, [...(map.get(entry.group) ?? []), entry]);
    return [...map.entries()];
  }, [catalog]);

  // Verrou 1 rendu visible : on ne coche ni ne décoche un droit qu'on ne détient pas.
  const lockedIn = [...selected].filter((p) => !holds(p as Permission));
  const forgotten = catalog.filter((p) => p.sensitive && !selected.has(p.key)).slice(0, 4);

  async function save() {
    setError(null);
    if (label.trim().length < 2) {
      setError("Donnez un nom au rôle.");
      return;
    }
    if (selected.size === 0) {
      setError("Un rôle doit contenir au moins un droit.");
      return;
    }
    if (role && reason.trim().length < 10) {
      setError("Indiquez le motif de la modification (au moins 10 caractères) : elle change les droits de plusieurs personnes.");
      return;
    }
    setSaving(true);
    try {
      if (role) {
        await update({
          organizationId,
          roleId: role._id,
          label,
          description,
          permissions: [...selected],
          reason,
        });
        setReason("");
        setSaved(true);
      } else {
        const roleId = await create({ organizationId, label, description, permissions: [...selected] });
        await navigate({ to: "/app/roles/$roleId", params: { roleId }, replace: true });
      }
    } catch (e) {
      setError(describeError(e).message);
    } finally {
      setSaving(false);
    }
  }

  async function doArchive() {
    if (!role) return;
    setError(null);
    if (reason.trim().length < 10) {
      setError("Indiquez le motif de l'archivage (au moins 10 caractères).");
      return;
    }
    try {
      await archive({ organizationId, roleId: role._id, reason });
      await navigate({ to: "/app/roles" });
    } catch (e) {
      setError(describeError(e).message);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-3">
        <Button variant="ghost" size="sm" asChild className="self-start">
          <Link to="/app/roles">
            <ArrowLeft data-icon="inline-start" aria-hidden="true" />
            Rôles
          </Link>
        </Button>
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-semibold tracking-tight">{role ? role.label : "Nouveau rôle"}</h1>
          {role && role.memberCount > 0 ? (
            <p className="text-muted-foreground">
              Attribué à {role.memberCount} personne{role.memberCount > 1 ? "s" : ""} : toute modification s'applique à elles
              immédiatement.
            </p>
          ) : null}
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="flex min-w-0 flex-col gap-6">
          <Card>
            <CardContent>
              <FieldGroup>
                <FormField label="Nom du rôle">
                  <Input value={label} onChange={(e) => setLabel(e.target.value)} maxLength={60} />
                </FormField>
                <FormField label="Description" optional>
                  <Textarea value={description} onChange={(e) => setDescription(e.target.value)} maxLength={300} rows={2} />
                </FormField>
              </FieldGroup>
            </CardContent>
          </Card>

          {groups.map(([group, entries]) => (
            <Card key={group}>
              <CardHeader className="border-b">
                <CardTitle>{group}</CardTitle>
              </CardHeader>
              <CardContent>
                <FieldGroup className="gap-4">
                  {entries.map((entry) => {
                    const held = holds(entry.key);
                    const id = `permission-${entry.key}`;
                    return (
                      <Field key={entry.key} orientation="horizontal" data-disabled={!held}>
                        <Checkbox
                          id={id}
                          checked={selected.has(entry.key)}
                          disabled={!held}
                          onCheckedChange={(value) => {
                            const next = new Set(selected);
                            if (value === true) next.add(entry.key);
                            else next.delete(entry.key);
                            setSelected(next);
                          }}
                        />
                        <FieldContent>
                          <FieldLabel htmlFor={id} className="font-normal">
                            {entry.label}
                          </FieldLabel>
                          {!held ? <FieldDescription>Vous ne détenez pas ce droit.</FieldDescription> : null}
                        </FieldContent>
                        {entry.sensitive ? <Badge variant="outline">Sensible</Badge> : null}
                      </Field>
                    );
                  })}
                </FieldGroup>
              </CardContent>
            </Card>
          ))}
        </div>

        <aside className="flex flex-col gap-4 lg:sticky lg:top-20 lg:self-start">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg tabular-nums">
                {selected.size} droit{selected.size > 1 ? "s" : ""}
              </CardTitle>
              {forgotten.length > 0 ? <CardDescription>Ce rôle ne pourra pas :</CardDescription> : null}
            </CardHeader>
            <CardContent>
              <FieldGroup className="gap-4">
                {forgotten.length > 0 ? (
                  <ul className="list-disc pl-5 text-sm text-muted-foreground">
                    {forgotten.map((p) => (
                      <li key={p.key}>{p.label.charAt(0).toLowerCase() + p.label.slice(1)}</li>
                    ))}
                  </ul>
                ) : null}
                {lockedIn.length > 0 ? (
                  <Alert>
                    <TriangleAlert />
                    <AlertDescription>
                      Ce rôle contient des droits que vous n'avez pas : seule une personne qui les détient peut le modifier.
                    </AlertDescription>
                  </Alert>
                ) : null}
                {role ? (
                  <FormField label="Motif de la modification" description="Conservé dans le journal d'audit.">
                    <Textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={2} maxLength={500} />
                  </FormField>
                ) : null}
                {error ? (
                  <Alert variant="destructive">
                    <CircleAlert />
                    <AlertDescription>{error}</AlertDescription>
                  </Alert>
                ) : null}
                {saved ? (
                  <Alert>
                    <CircleCheck />
                    <AlertDescription>Rôle enregistré.</AlertDescription>
                  </Alert>
                ) : null}
              </FieldGroup>
            </CardContent>
            <CardFooter className="flex-col items-stretch gap-2">
              <PendingButton onClick={() => void save()} pending={saving} pendingText="Enregistrement…" disabled={lockedIn.length > 0}>
                Enregistrer le rôle
              </PendingButton>
              {role && role.memberCount === 0 ? (
                <Button variant="destructive" onClick={() => void doArchive()}>
                  Archiver ce rôle
                </Button>
              ) : null}
            </CardFooter>
          </Card>
        </aside>
      </div>
    </div>
  );
}
