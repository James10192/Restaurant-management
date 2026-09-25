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
# Les secrets ne se posent qu'UNE fois : les régénérer à chaque passage rendrait illisibles ce
# qu'ils ont chiffré — la clé de signature de Better Auth d'abord, et plus personne ne se connecte.
EXISTING=$(pnpm exec convex env list 2>/dev/null | cut -d= -f1)
has() { printf '%s\n' "$EXISTING" | grep -qx "$1"; }
random() { node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"; }
pnpm exec convex env set SITE_URL "http://localhost:3000"
has BETTER_AUTH_SECRET || pnpm exec convex env set BETTER_AUTH_SECRET "$(random)"
has GUEST_PASS_SECRET || pnpm exec convex env set GUEST_PASS_SECRET "$(random)"
has PIN_PEPPER || pnpm exec convex env set PIN_PEPPER "$(random)"
# Clés des jetons d'appareil et de PIN : la publique n'est lue qu'au déploiement suivant.
has OPERATOR_JWT_PRIVATE_KEY || node scripts/operator-keys.mjs --apply
pnpm exec convex env set RESEND_API_KEY "test-local"
pnpm exec convex env set EMAIL_FROM "Joliba <noreply@joliba.test>"
pnpm exec convex env set RESEND_API_URL "http://127.0.0.1:4010/emails"
# Paiement en ligne (T5) : la clé maîtresse des secrets, posée une fois ; et le faux Wave
# (e2e/wave-sink.mjs), honoré seulement sur un backend local (D-125).
has PAYMENT_SECRETS_KEY || pnpm exec convex env set PAYMENT_SECRETS_KEY "$(random)"
pnpm exec convex env set JOLIBA_FAKE_PAYMENTS "1"
pnpm exec convex env set WAVE_API_URL "http://127.0.0.1:4020"
# Autorise `scripts/seed-demo.mjs` (restaurant de démonstration, convex/devSeed.ts).
pnpm exec convex env set JOLIBA_DEMO_SEED "1"
