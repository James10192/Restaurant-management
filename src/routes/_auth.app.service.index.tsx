import { createFileRoute } from "@tanstack/react-router";
import { FloorBoard } from "~/components/service/floor-board";

export const Route = createFileRoute("/_auth/app/service/")({
  head: () => ({ meta: [{ title: "Service — Joliba" }] }),
  component: FloorBoard,
});
