#!/usr/bin/env sh
# Pose sur le déploiement Convex LOCAL les variables dont le parcours de bout en bout a
# besoin. RESEND_API_URL détourne les e-mails vers le faux serveur de courrier
# (e2e/mail-sink.mjs) : ce script REFUSE de s'exécuter contre autre chose qu'un backend
# local anonyme.
set -eu
if ! grep -q '^CONVEX_DEPLOYMENT=anonymous:' .env.local 2>/dev/null; then
  echo "Refusé : .env.local ne désigne pas un backend Convex local anonyme." >&2
  exit 1
fi
export CONVEX_AGENT_MODE=anonymous
SECRET=$(node -e "console.log(require('crypto').randomBytes(32).toString('base64'))")
pnpm exec convex env set SITE_URL "http://localhost:3000"
pnpm exec convex env set BETTER_AUTH_SECRET "$SECRET"
pnpm exec convex env set GUEST_PASS_SECRET "$(node -e "console.log(require('crypto').randomBytes(32).toString('base64'))")"
pnpm exec convex env set RESEND_API_KEY "test-local"
pnpm exec convex env set EMAIL_FROM "Joliba <noreply@joliba.test>"
pnpm exec convex env set RESEND_API_URL "http://127.0.0.1:4010/emails"
