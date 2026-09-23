import { createFileRoute } from "@tanstack/react-router";
import { CashScreen } from "~/components/billing/cash-screen";

export const Route = createFileRoute("/appareil/caisse")({
  component: CashScreen,
});
