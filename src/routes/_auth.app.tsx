import { useEffect, type ReactNode } from "react";
import { createFileRoute, Outlet, useLocation, useNavigate } from "@tanstack/react-router";
import { AppSidebar, useNavItems } from "~/components/app/app-sidebar";
import { useAuthStatus } from "~/components/app/convex-providers";
import { RouteError } from "~/components/app/route-error";
import { LoadingState } from "~/components/app/states";
import { useWorkspace, WorkspaceProvider } from "~/components/app/workspace";
import { Breadcrumb, BreadcrumbItem, BreadcrumbList, BreadcrumbPage } from "~/components/ui/breadcrumb";
import { Separator } from "~/components/ui/separator";
import { SidebarInset, SidebarProvider, SidebarTrigger } from "~/components/ui/sidebar";
import { Toaster } from "~/components/ui/sonner";
import { TooltipProvider } from "~/components/ui/tooltip";

export const Route = createFileRoute("/_auth/app")({
  head: () => ({ meta: [{ title: "Joliba" }, { name: "robots", content: "noindex, nofollow" }] }),
  component: AppLayout,
  errorComponent: ({ error, reset }) => (
    <Frame>
      <RouteError error={error} reset={reset} />
    </Frame>
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
      <Frame>
        <LoadingState />
      </Frame>
    );
  }
  return (
    <WorkspaceProvider>
      <Shell />
    </WorkspaceProvider>
  );
}

function Frame({ children }: { children: ReactNode }) {
  return <div className="min-h-dvh bg-background p-4">{children}</div>;
}

function Shell() {
  const workspace = useWorkspace();
  return (
    <TooltipProvider>
      <SidebarProvider>
        <AppSidebar />
        <SidebarInset>
          <header className="sticky top-0 z-10 flex h-14 shrink-0 items-center gap-2 border-b bg-background px-4 print:hidden">
            <SidebarTrigger className="-ml-1" />
            <Separator orientation="vertical" className="mr-2 data-[orientation=vertical]:h-4" />
            <CurrentSection />
          </header>
          <div className="mx-auto w-full max-w-6xl flex-1 p-4 md:p-6 print:max-w-none print:p-0">
            {workspace.status === "loading" ? <LoadingState /> : <Outlet />}
          </div>
        </SidebarInset>
      </SidebarProvider>
      <Toaster position="top-center" />
    </TooltipProvider>
  );
}

/** Le fil d'Ariane de l'en-tête : la section où l'on se trouve. */
function CurrentSection() {
  const items = useNavItems();
  const { pathname } = useLocation();
  const current =
    [...items]
      .sort((a, b) => b.to.length - a.to.length)
      .find((item) => (item.exact ? pathname === item.to : pathname === item.to || pathname.startsWith(`${item.to}/`)))?.label ??
    (pathname.startsWith("/app/account") ? "Mon compte" : "Joliba");
  return (
    <Breadcrumb>
      <BreadcrumbList>
        <BreadcrumbItem>
          <BreadcrumbPage>{current}</BreadcrumbPage>
        </BreadcrumbItem>
      </BreadcrumbList>
    </Breadcrumb>
  );
}
