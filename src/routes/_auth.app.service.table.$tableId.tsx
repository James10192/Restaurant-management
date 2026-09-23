import { createFileRoute } from "@tanstack/react-router";
import type { Id } from "../../convex/_generated/dataModel";
import { AccountService } from "~/components/service/account-service";
import { TableView } from "~/components/service/table-view";

export const Route = createFileRoute("/_auth/app/service/table/$tableId")({
  head: () => ({ meta: [{ title: "Table — Joliba" }] }),
  component: TablePage,
});

function TablePage() {
  const { tableId } = Route.useParams();
  return (
    <AccountService permission="table.read">
      <TableView tableId={tableId as Id<"restaurantTables">} />
    </AccountService>
  );
}
