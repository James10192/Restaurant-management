import { defineApp } from "convex/server";
import betterAuth from "@convex-dev/better-auth/convex.config";
import rateLimiter from "@convex-dev/rate-limiter/convex.config";

/**
 * Composants Convex de Joliba.
 *
 * - `betterAuth` détient l'IDENTITÉ (utilisateurs, sessions, comptes, codes OTP) dans ses
 *   propres tables. La souveraineté du tenant n'y est pas : elle vit dans nos tables
 *   (`organizations`, `organizationMembers`, `memberRoleAssignments`) — D-016.
 * - `rateLimiter` borne les actions coûteuses ou abusables (invitations, et plus tard
 *   les appels de serveur, les requêtes IA).
 */
const app = defineApp();
app.use(betterAuth);
app.use(rateLimiter);

export default app;
