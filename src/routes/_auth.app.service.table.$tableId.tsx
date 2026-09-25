import { createFileRoute } from "@tanstack/react-router";
import type { Id } from "../../convex/_generated/dataModel";
import { TableView } from "~/components/service/table-view";

export const Route = createFileRoute("/_auth/app/service/table/$tableId")({
  head: () => ({ meta: [{ title: "Table — Joliba" }] }),
  component: function TablePage() {
    const { tableId } = Route.useParams();
    return <TableView tableId={tableId as Id<"restaurantTables">} />;
  },
});
