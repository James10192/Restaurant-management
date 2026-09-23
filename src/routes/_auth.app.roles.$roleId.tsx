import { useEffect, useMemo, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery } from "convex/react";
import { ArrowLeft } from "lucide-react";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import type { Permission } from "../../convex/lib/permissions";
import { useWorkspace } from "~/components/app/workspace";
import { Alert, AlertDescription, AlertTitle } from "~/components/ui/alert";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { Checkbox } from "~/components/ui/checkbox";
import { Field } from "~/components/ui/field";
import { Input } from "~/components/ui/input";
import { LoadingState, PermissionDeniedState } from "~/components/ui/states";
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
      <Alert variant="warning">
        <AlertTitle>Ce rôle est introuvable</AlertTitle>
        <AlertDescription>
          Il a peut-être été archivé. <Link to="/app/roles" className="underline">Revenir aux rôles</Link>
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
      <Link to="/app/roles" className="inline-flex items-center gap-1 self-start text-label text-accent-700">
        <ArrowLeft aria-hidden="true" className="size-4" />
        Rôles
      </Link>
      <div>
        <h1 className="text-title-xl text-ink">{role ? role.label : "Nouveau rôle"}</h1>
        {role && role.memberCount > 0 ? (
          <p className="text-body text-ink-2">
            Attribué à {role.memberCount} personne{role.memberCount > 1 ? "s" : ""} : toute modification s'applique à elles
            immédiatement.
          </p>
        ) : null}
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <div className="flex flex-col gap-6">
          <Card>
            <CardContent className="flex flex-col gap-4 py-5">
              <Field label="Nom du rôle">
                <Input value={label} onChange={(e) => setLabel(e.target.value)} maxLength={60} />
              </Field>
              <Field label="Description" optional>
                <Textarea value={description} onChange={(e) => setDescription(e.target.value)} maxLength={300} rows={2} />
              </Field>
            </CardContent>
          </Card>

          {groups.map(([group, entries]) => (
            <Card key={group}>
              <CardHeader>
                <CardTitle>{group}</CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col gap-1 pb-4">
                {entries.map((entry) => {
                  const held = holds(entry.key);
                  return (
                    <label key={entry.key} className="flex min-h-(--tap) items-start gap-3 rounded-sm px-2 py-2 hover:bg-surface-2">
                      <Checkbox
                        className="mt-0.5"
                        checked={selected.has(entry.key)}
                        disabled={!held}
                        onCheckedChange={(value) => {
                          const next = new Set(selected);
                          if (value === true) next.add(entry.key);
                          else next.delete(entry.key);
                          setSelected(next);
                        }}
                      />
                      <span className="flex flex-1 flex-col">
                        <span className={held ? "text-body text-ink" : "text-body text-ink-disabled"}>{entry.label}</span>
                        {!held ? <span className="text-label text-ink-3">Vous ne détenez pas ce droit.</span> : null}
                      </span>
                      {entry.sensitive ? <Badge variant="warning">Sensible</Badge> : null}
                    </label>
                  );
                })}
              </CardContent>
            </Card>
          ))}
        </div>

        <aside className="flex flex-col gap-4 lg:sticky lg:top-32 lg:self-start">
          <Card>
            <CardContent className="flex flex-col gap-3 py-5">
              <p className="text-title-md text-ink">
                {selected.size} droit{selected.size > 1 ? "s" : ""}
              </p>
              {forgotten.length > 0 ? (
                <div className="text-label text-ink-2">
                  <p className="text-ink">Ce rôle ne pourra pas :</p>
                  <ul className="mt-1 list-disc pl-5">
                    {forgotten.map((p) => (
                      <li key={p.key}>{p.label.charAt(0).toLowerCase() + p.label.slice(1)}</li>
                    ))}
                  </ul>
                </div>
              ) : null}
              {lockedIn.length > 0 ? (
                <Alert variant="warning">
                  <AlertDescription>
                    Ce rôle contient des droits que vous n'avez pas : seule une personne qui les détient peut le modifier.
                  </AlertDescription>
                </Alert>
              ) : null}
              {role ? (
                <Field label="Motif de la modification" description="Conservé dans le journal d'audit.">
                  <Textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={2} maxLength={500} />
                </Field>
              ) : null}
              {error ? (
                <Alert variant="danger">
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              ) : null}
              {saved ? (
                <Alert variant="success">
                  <AlertDescription>Rôle enregistré.</AlertDescription>
                </Alert>
              ) : null}
              <Button onClick={() => void save()} loading={saving} loadingText="Enregistrement…" disabled={lockedIn.length > 0}>
                Enregistrer le rôle
              </Button>
              {role && role.memberCount === 0 ? (
                <Button variant="danger" onClick={() => void doArchive()}>
                  Archiver ce rôle
                </Button>
              ) : null}
            </CardContent>
          </Card>
        </aside>
      </div>
    </div>
  );
}
