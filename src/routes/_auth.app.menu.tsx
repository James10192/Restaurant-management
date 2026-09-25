import { createFileRoute, Outlet } from "@tanstack/react-router";
import { MenuTabs } from "~/components/menu/shared";

export const Route = createFileRoute("/_auth/app/menu")({
  head: () => ({ meta: [{ title: "Carte — Joliba" }] }),
  component: MenuLayout,
});

function MenuLayout() {
  return (
    <>
      <MenuTabs />
      <Outlet />
    </>
  );
}
