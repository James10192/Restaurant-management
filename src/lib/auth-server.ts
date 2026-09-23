import { convexBetterAuthReactStart } from "@convex-dev/better-auth/react-start";

// Les URL Convex sont inlinées au build par Vite : au runtime serveur (Nitro/Vercel), les
// variables VITE_* ne sont pas dans process.env.
const convexUrl =
  (import.meta.env.VITE_CONVEX_URL as string | undefined) ?? process.env.VITE_CONVEX_URL ?? "";
const convexSiteUrl =
  (import.meta.env.VITE_CONVEX_SITE_URL as string | undefined) ?? process.env.VITE_CONVEX_SITE_URL ?? "";

export const { handler, getToken } = convexBetterAuthReactStart({ convexUrl, convexSiteUrl });
