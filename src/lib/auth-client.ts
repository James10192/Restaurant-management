import { createAuthClient } from "better-auth/react";
import { emailOTPClient } from "better-auth/client/plugins";
import { convexClient } from "@convex-dev/better-auth/client/plugins";

/**
 * Client Better Auth. Même origine (`/api/auth`), relayé vers Convex par
 * `src/routes/api/auth.$.ts` : les cookies de session restent sur le domaine de
 * l'application, jamais exposés au JavaScript (httpOnly).
 */
export const authClient = createAuthClient({
  plugins: [convexClient(), emailOTPClient()],
});
