import { createFileRoute } from "@tanstack/react-router";
import { AccountService } from "~/components/service/account-service";
import { FloorBoard } from "~/components/service/floor-board";

export const Route = createFileRoute("/_auth/app/service/")({
  head: () => ({ meta: [{ title: "Service — Joliba" }] }),
  component: () => (
    <AccountService permission="table.read">
      <FloorBoard />
    </AccountService>
  ),
});
