import { createFileRoute } from "@tanstack/react-router";
import { CashScreen } from "~/components/billing/cash-screen";

export const Route = createFileRoute("/_auth/app/service/caisse")({
  head: () => ({ meta: [{ title: "Caisse — Joliba" }] }),
  component: CashScreen,
});
