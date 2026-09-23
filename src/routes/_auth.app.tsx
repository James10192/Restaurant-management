import { useEffect, type ReactNode } from "react";
import { createFileRoute, Link, Outlet, useLocation, useNavigate, useRouter } from "@tanstack/react-router";
import { useQuery } from "convex/react";
import { ChevronDown, LogOut, UserRound } from "lucide-react";
import { api } from "../../convex/_generated/api";
import { JolibaMark } from "~/components/app/auth-layout";
import { useAuthStatus } from "~/components/app/convex-providers";
import { useWorkspace, WorkspaceProvider } from "~/components/app/workspace";
import { Avatar } from "~/components/ui/avatar";
import { Button } from "~/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "~/components/ui/dropdown-menu";
import { RouteError } from "~/components/app/route-error";
import { LoadingState } from "~/components/ui/states";
import { authClient } from "~/lib/auth-client";
import { cn } from "~/lib/cn";

export const Route = createFileRoute("/_auth/app")({
  head: () => ({ meta: [{ title: "Joliba" }, { name: "robots", content: "noindex, nofollow" }] }),
  component: AppLayout,
  errorComponent: ({ error, reset }) => (
    <AppFrame>
      <RouteError error={error} reset={reset} />
    </AppFrame>
  ),
});

function AppLayout() {
  const auth = useAuthStatus();
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    if (!auth.isLoading && !auth.isAuthenticated) {
      void navigate({ to: "/connexion", search: { redirect: location.href }, replace: true });
    }
  }, [auth.isLoading, auth.isAuthenticated, navigate, location.href]);

  if (!auth.isAuthenticated) {
    return (
      <AppFrame>
        <LoadingState />
      </AppFrame>
    );
  }
  return (
    <WorkspaceProvider>
      <Shell />
    </WorkspaceProvider>
  );
}

function AppFrame({ children }: { children: ReactNode }) {
  return <div className="min-h-dvh bg-bg">{children}</div>;
}

function Shell() {
  const workspace = useWorkspace();
  const nav = [
    { to: "/app", label: "Accueil", show: true, exact: true },
    {
      to: "/app/team",
      label: "Équipe",
      show: workspace.canInVenue("team.read") || workspace.canInOrganization("team.read"),
    },
    { to: "/app/roles", label: "Rôles", show: workspace.canInOrganization("permissions.manage") },
    { to: "/app/settings/venue", label: "Établissement", show: workspace.canInVenue("venue.manage") },
  ] as const;

  return (
    <AppFrame>
      <header className="sticky top-0 z-(--z-sticky) border-b border-line bg-surface">
        <div className="mx-auto flex h-14 max-w-6xl items-center gap-3 px-4">
          <Link to="/app" aria-label="Joliba, accueil">
            <JolibaMark />
          </Link>
          {workspace.status === "ready" ? <ContextSwitcher /> : null}
          <div className="ml-auto">
            <UserMenu />
          </div>
        </div>
        {workspace.status === "ready" && nav.filter((item) => item.show).length > 1 ? (
          <nav aria-label="Navigation principale" className="mx-auto flex max-w-6xl gap-1 overflow-x-auto px-2">
            {nav
              .filter((item) => item.show)
              .map((item) => (
                <Link
                  key={item.to}
                  to={item.to}
                  activeOptions={{ exact: "exact" in item ? item.exact : false }}
                  className="inline-flex h-11 items-center border-b-2 border-transparent px-3 text-label text-ink-2 hover:text-ink data-[status=active]:border-accent-600 data-[status=active]:text-ink"
                >
                  {item.label}
                </Link>
              ))}
          </nav>
        ) : null}
      </header>
      <main className="mx-auto max-w-6xl px-4 py-6">
        {workspace.status === "loading" ? <LoadingState /> : <Outlet />}
      </main>
    </AppFrame>
  );
}

/** Sélecteurs d'organisation et d'établissement, affichés seulement s'il y a un choix. */
function ContextSwitcher() {
  const w = useWorkspace();
  if (!w.organization) return null;
  const multipleOrgs = w.organizations.length > 1;
  const multipleVenues = w.organization.venues.length > 1;
  return (
    <div className="flex min-w-0 items-center gap-1 text-label">
      {multipleOrgs ? (
        <Switcher
          label="Organisation"
          current={w.organization.name}
          items={w.organizations.map((o) => ({ id: o._id, label: o.name }))}
          onSelect={(id) => w.selectOrganization(id as typeof w.organizations[number]["_id"])}
        />
      ) : (
        <span className="truncate text-ink-2">{w.organization.name}</span>
      )}
      {w.venue && (multipleVenues || w.venue.name !== w.organization.name) ? (
        <span aria-hidden="true" className="text-ink-4">/</span>
      ) : null}
      {w.venue && !multipleVenues && w.venue.name === w.organization.name ? null : w.venue && multipleVenues ? (
        <Switcher
          label="Établissement"
          current={w.venue.name}
          items={w.organization.venues.map((v) => ({ id: v._id, label: v.name }))}
          onSelect={(id) => w.selectVenue(id as NonNullable<typeof w.venue>["_id"])}
        />
      ) : w.venue ? (
        <span className="truncate text-ink">{w.venue.name}</span>
      ) : null}
    </div>
  );
}

function Switcher({
  label,
  current,
  items,
  onSelect,
}: {
  label: string;
  current: string;
  items: { id: string; label: string }[];
  onSelect: (id: string) => void;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="quiet" size="sm" aria-label={`${label} : ${current}. Changer`}>
          <span className="max-w-[12rem] truncate">{current}</span>
          <ChevronDown aria-hidden="true" className="size-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start">
        <DropdownMenuLabel>{label}</DropdownMenuLabel>
        {items.map((item) => (
          <DropdownMenuItem key={item.id} onSelect={() => onSelect(item.id)} className={cn(item.label === current && "font-semibold")}>
            {item.label}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function UserMenu() {
  const me = useQuery(api.users.me, {});
  const navigate = useNavigate();
  const router = useRouter();
  const name = me?.name ?? me?.email ?? "";

  async function signOut() {
    await authClient.signOut();
    await router.invalidate();
    await navigate({ to: "/connexion", replace: true });
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="quiet" size="icon" aria-label="Mon compte">
          <Avatar name={name || "?"} size="sm" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {me ? (
          <DropdownMenuLabel>
            <span className="block text-ink">{me.name ?? "Mon compte"}</span>
            <span className="block text-micro font-normal text-ink-3">{me.email}</span>
          </DropdownMenuLabel>
        ) : null}
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={() => void navigate({ to: "/app/account" })}>
          <UserRound aria-hidden="true" className="size-4" />
          Mon compte et mes appareils
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => void signOut()}>
          <LogOut aria-hidden="true" className="size-4" />
          Se déconnecter
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
