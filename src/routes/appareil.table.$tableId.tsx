import { createFileRoute } from "@tanstack/react-router";
import type { Id } from "../../convex/_generated/dataModel";
import { TableView } from "~/components/service/table-view";

export const Route = createFileRoute("/appareil/table/$tableId")({
  component: function DeviceTable() {
    const { tableId } = Route.useParams();
    return <TableView tableId={tableId as Id<"restaurantTables">} />;
  },
});
