import { createFileRoute } from "@tanstack/react-router";
import { ConvexHttpClient } from "convex/browser";
import type { FunctionReturnType } from "convex/server";
import { api } from "../../convex/_generated/api";
import { logEvent } from "../../convex/lib/log";
import { convexServerUrl, TABLE_COOKIE } from "~/lib/guest/env.server";

/**
 * Le scan d'un QR — Joliba (D-023, ADR 0004)
 *
 * Ce n'est pas une page : c'est un ÉCHANGE. Le jeton du QR est remis à Convex, qui rend un
 * laissez-passer signé ; on le dépose en cookie `httpOnly`, puis on redirige (302) vers une
 * adresse SANS SECRET. Le jeton disparaît ainsi de l'historique, du partage, des journaux et
 * de l'en-tête `Referer`.
 *
 * En cas d'échec, même règle : redirection vers une page qui dit quoi faire, sans le jeton.
 */
const TWELVE_HOURS = 12 * 60 * 60;

function redirect(location: string, cookie?: string): Response {
  const headers = new Headers({
    Location: location,
    "Cache-Control": "no-store",
    "Referrer-Policy": "no-referrer",
    "X-Robots-Tag": "noindex, nofollow, noarchive, nosnippet",
  });
  if (cookie) headers.append("Set-Cookie", cookie);
  return new Response(null, { status: 302, headers });
}

export const Route = createFileRoute("/r/$venueSlug/t/$token")({
  server: {
    handlers: {
      GET: async ({ request, params }) => {
        const slug = /^[a-z0-9-]{1,64}$/.test(params.venueSlug) ? params.venueSlug : "carte";
        let result: FunctionReturnType<typeof api.guest.exchange>;
        try {
          result = await new ConvexHttpClient(convexServerUrl()).mutation(api.guest.exchange, { token: params.token });
        } catch {
          // Le jeton n'est jamais journalisé : seule la route, masquée, apparaît.
          logEvent("error", "guest.exchange_failed", { route: "/r/:slug/t/:token" });
          return redirect(`/r/${slug}/indisponible?raison=erreur`);
        }
        if (!result.ok) {
          return redirect(`/r/${result.venueSlug ?? slug}/indisponible?raison=${result.reason}`);
        }
        const secure = new URL(request.url).protocol === "https:" || request.headers.get("x-forwarded-proto") === "https";
        const cookie = [
          `${TABLE_COOKIE}=${result.pass}`,
          // Envoyé seulement aux pages de CET établissement.
          `Path=/r/${result.venueSlug}`,
          `Max-Age=${TWELVE_HOURS}`,
          "HttpOnly",
          "SameSite=Lax",
          ...(secure ? ["Secure"] : []),
        ].join("; ");
        return redirect(`/r/${result.venueSlug}/table`, cookie);
      },
    },
  },
});
