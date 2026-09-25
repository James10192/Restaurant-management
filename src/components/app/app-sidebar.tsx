import { useState } from "react";
import { Link, useLocation, useNavigate, useRouter } from "@tanstack/react-router";
import { useQuery } from "convex/react";
import {
  Banknote,
  Building2,
  ChartColumn,
  ChevronRight,
  ClipboardList,
  ChefHat,
  ChevronsUpDown,
  ConciergeBell,
  Flame,
  House,
  LayoutGrid,
  LogOut,
  MessageSquare,
  Settings,
  ShieldCheck,
  SlidersHorizontal,
  TabletSmartphone,
  UserRound,
  Users,
  UtensilsCrossed,
  Wallet,
  type LucideIcon,
} from "lucide-react";
import { api } from "../../../convex/_generated/api";
import { Avatar, AvatarFallback } from "~/components/ui/avatar";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "~/components/ui/collapsible";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "~/components/ui/dropdown-menu";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  SidebarRail,
  useSidebar,
} from "~/components/ui/sidebar";
import { useWorkspace } from "~/components/app/workspace";
import { JolibaMark } from "~/components/app/auth-layout";
import { authClient } from "~/lib/auth-client";

/**
 * `settings` : ce qu'on règle une fois, rangé sous « Réglages », replié. La navigation du service
 * reste sous neuf entrées (INFORMATION_ARCHITECTURE §1.2).
 */
type NavItem = { to: string; label: string; icon: LucideIcon; show: boolean; exact?: boolean; settings?: boolean };

export function useNavItems(): NavItem[] {
  const w = useWorkspace();
  return [
    { to: "/app", label: "Accueil", icon: House, show: true, exact: true },
    { to: "/app/service", label: "Service", icon: ConciergeBell, show: w.canInVenue("table.read") },
    { to: "/app/cuisine", label: "Cuisine", icon: ChefHat, show: w.canInVenue("kitchen.ticket.update") },
    {
      to: "/app/service/caisse",
      label: "Caisse",
      icon: Wallet,
      show: w.canInVenue("table.read") && (w.canInVenue("payment.collect") || w.canInVenue("cash_register.open") || w.canInVenue("cash_register.close")),
    },
    { to: "/app/rapport", label: "Fin de service", icon: ClipboardList, show: w.canInVenue("report.service_day.read") },
    { to: "/app/analytics", label: "Données", icon: ChartColumn, show: w.canInVenue("analytics.read") },
    { to: "/app/feedback", label: "Avis des clients", icon: MessageSquare, show: w.canInVenue("feedback.read") },
    {
      to: "/app/menu",
      label: "Carte",
      icon: UtensilsCrossed,
      show: w.canInVenue("menu.read") || w.canInVenue("menu.availability.toggle"),
    },
    { to: "/app/floor", label: "Plan de salle", icon: LayoutGrid, show: w.canInVenue("table.read") },
    { to: "/app/team", label: "Équipe", icon: Users, show: w.canInVenue("team.read") || w.canInOrganization("team.read"), settings: true },
    { to: "/app/roles", label: "Rôles", icon: ShieldCheck, show: w.canInOrganization("permissions.manage"), settings: true },
    { to: "/app/settings/stations", label: "Postes de préparation", icon: Flame, show: w.canInVenue("kitchen.manage"), settings: true },
    { to: "/app/settings/payments", label: "Encaissement", icon: Banknote, show: w.canInVenue("venue.settings.service"), settings: true },
    { to: "/app/settings/devices", label: "Appareils", icon: TabletSmartphone, show: w.canInVenue("device.manage") || w.canInVenue("venue.settings.service"), settings: true },
    { to: "/app/settings/venue", label: "Établissement", icon: Settings, show: w.canInVenue("venue.manage"), settings: true },
  ].filter((item) => item.show);
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return ((parts[0]?.[0] ?? "?") + (parts[1]?.[0] ?? "")).toUpperCase();
}

export function AppSidebar() {
  const workspace = useWorkspace();
  const items = useNavItems();
  const { pathname } = useLocation();
  const { setOpenMobile } = useSidebar();
  // L'entrée la plus précise l'emporte : « Caisse » (/app/service/caisse) n'allume pas « Service ».
  const matches = (i: NavItem) => (i.exact ? pathname === i.to : pathname === i.to || pathname.startsWith(`${i.to}/`));
  const best = items.filter(matches).sort((x, y) => y.to.length - x.to.length)[0];
  const settings = items.filter((i) => i.settings);
  // Replié par défaut ; ouvert quand on est dans un réglage, pour voir où l'on est.
  const [settingsOpen, setSettingsOpen] = useState(best?.settings === true);

  return (
    <Sidebar collapsible="icon" className="print:hidden">
      <SidebarHeader>
        {workspace.status === "ready" ? <VenueSwitcher /> : <JolibaMark />}
      </SidebarHeader>
      <SidebarContent>
        {workspace.status === "ready" ? (
          <SidebarGroup>
            <SidebarGroupLabel>Restaurant</SidebarGroupLabel>
            <SidebarGroupContent>
              <nav aria-label="Navigation principale">
                <SidebarMenu>
                  {items.filter((i) => !i.settings).map((item) => (
                    <NavEntry key={item.to} item={item} active={best?.to === item.to} onNavigate={() => setOpenMobile(false)} />
                  ))}
                  {settings.length > 0 ? (
                    <Collapsible asChild open={settingsOpen} onOpenChange={setSettingsOpen} className="group/settings">
                      <SidebarMenuItem>
                        <CollapsibleTrigger asChild>
                          <SidebarMenuButton tooltip="Réglages" isActive={!settingsOpen && best?.settings === true}>
                            <SlidersHorizontal />
                            <span>Réglages</span>
                            <ChevronRight className="ml-auto transition-transform group-data-[state=open]/settings:rotate-90" />
                          </SidebarMenuButton>
                        </CollapsibleTrigger>
                        <CollapsibleContent>
                          <SidebarMenuSub>
                            {settings.map((item) => (
                              <SidebarMenuSubItem key={item.to}>
                                <SidebarMenuSubButton asChild isActive={best?.to === item.to}>
                                  <Link to={item.to} onClick={() => setOpenMobile(false)}>
                                    <item.icon />
                                    <span>{item.label}</span>
                                  </Link>
                                </SidebarMenuSubButton>
                              </SidebarMenuSubItem>
                            ))}
                          </SidebarMenuSub>
                        </CollapsibleContent>
                      </SidebarMenuItem>
                    </Collapsible>
                  ) : null}
                </SidebarMenu>
              </nav>
            </SidebarGroupContent>
          </SidebarGroup>
        ) : null}
      </SidebarContent>
      <SidebarFooter>
        <UserMenu />
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  );
}

function NavEntry({ item, active, onNavigate }: { item: NavItem; active: boolean; onNavigate: () => void }) {
  return (
    <SidebarMenuItem>
      <SidebarMenuButton asChild isActive={active} tooltip={item.label}>
        <Link to={item.to} onClick={onNavigate}>
          <item.icon />
          <span>{item.label}</span>
        </Link>
      </SidebarMenuButton>
    </SidebarMenuItem>
  );
}

/** Organisation et établissement courants ; le menu n'apparaît que s'il y a un choix. */
function VenueSwitcher() {
  const w = useWorkspace();
  const { isMobile } = useSidebar();
  if (!w.organization) return null;
  const venues = w.organization.venues;
  const choice = w.organizations.length > 1 || venues.length > 1;
  const title = w.venue?.name ?? w.organization.name;
  const subtitle = w.venue && w.venue.name !== w.organization.name ? w.organization.name : "Établissement";

  const button = (
    <SidebarMenuButton size="lg" aria-label={choice ? `${title}. Changer d'établissement` : undefined} className="data-[state=open]:bg-sidebar-accent">
      <div className="flex aspect-square size-8 items-center justify-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground">
        <Building2 className="size-4" />
      </div>
      <div className="grid flex-1 text-left text-sm leading-tight">
        <span className="truncate font-medium">{title}</span>
        <span className="truncate text-xs text-muted-foreground">{subtitle}</span>
      </div>
      {choice ? <ChevronsUpDown className="ml-auto" /> : null}
    </SidebarMenuButton>
  );

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        {choice ? (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>{button}</DropdownMenuTrigger>
            <DropdownMenuContent className="min-w-56" side={isMobile ? "bottom" : "right"} align="start">
              {w.organizations.length > 1 ? (
                <DropdownMenuGroup>
                  <DropdownMenuLabel>Organisation</DropdownMenuLabel>
                  {w.organizations.map((o) => (
                    <DropdownMenuItem key={o._id} onSelect={() => w.selectOrganization(o._id)}>
                      {o.name}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuGroup>
              ) : null}
              {w.organizations.length > 1 && venues.length > 1 ? <DropdownMenuSeparator /> : null}
              {venues.length > 1 ? (
                <DropdownMenuGroup>
                  <DropdownMenuLabel>Établissement</DropdownMenuLabel>
                  {venues.map((v) => (
                    <DropdownMenuItem key={v._id} onSelect={() => w.selectVenue(v._id)}>
                      {v.name}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuGroup>
              ) : null}
            </DropdownMenuContent>
          </DropdownMenu>
        ) : (
          button
        )}
      </SidebarMenuItem>
    </SidebarMenu>
  );
}

function UserMenu() {
  const me = useQuery(api.users.me, {});
  const navigate = useNavigate();
  const router = useRouter();
  const { isMobile, setOpenMobile } = useSidebar();
  const name = me?.name ?? me?.email ?? "";

  async function signOut() {
    await authClient.signOut();
    await router.invalidate();
    await navigate({ to: "/connexion", replace: true });
  }

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <SidebarMenuButton size="lg" aria-label="Mon compte" className="data-[state=open]:bg-sidebar-accent">
              <Avatar className="size-8 rounded-lg">
                <AvatarFallback className="rounded-lg">{initials(name || "?")}</AvatarFallback>
              </Avatar>
              <div className="grid flex-1 text-left text-sm leading-tight">
                <span className="truncate font-medium">{me?.name ?? "Mon compte"}</span>
                <span className="truncate text-xs text-muted-foreground">{me?.email ?? ""}</span>
              </div>
              <ChevronsUpDown className="ml-auto size-4" />
            </SidebarMenuButton>
          </DropdownMenuTrigger>
          <DropdownMenuContent className="min-w-56" side={isMobile ? "bottom" : "right"} align="end">
            {me ? (
              <DropdownMenuLabel className="font-normal">
                <span className="block truncate font-medium text-foreground">{me.name ?? "Mon compte"}</span>
                <span className="block truncate text-xs text-muted-foreground">{me.email}</span>
              </DropdownMenuLabel>
            ) : null}
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onSelect={() => {
                setOpenMobile(false);
                void navigate({ to: "/app/account" });
              }}
            >
              <UserRound />
              Mon compte et mes appareils
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => void signOut()}>
              <LogOut />
              Se déconnecter
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
    </SidebarMenu>
  );
}
