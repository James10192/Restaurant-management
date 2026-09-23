import type { Id } from "../../../convex/_generated/dataModel";

/** La portée d'un écran d'équipe : un établissement, ou l'organisation entière. */
export type TeamScope = { venueId: Id<"venues"> } | { organizationId: Id<"organizations"> };
