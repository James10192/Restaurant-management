import { createFileRoute } from "@tanstack/react-router";
import { FloorBoard } from "~/components/service/floor-board";

export const Route = createFileRoute("/appareil/")({
  component: FloorBoard,
});
