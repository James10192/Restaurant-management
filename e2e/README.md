# Tests de bout en bout

Les parcours `t0.spec.ts` (ouvrir, inviter, cloisonner) et `t1.spec.ts` (composer la carte, la
publier, imprimer un QR, le scanner, couper un plat en direct, régénérer le QR) s'exécutent dans un vrai navigateur, contre le build de production et un
backend Convex **local** (sans compte). Aucun service extérieur n'est appelé : les e-mails, codes
de connexion compris, sont recueillis par un faux serveur de courrier.

```bash
# 1. Faux serveur de courrier (écoute sur 127.0.0.1:4010)
node e2e/mail-sink.mjs /tmp/joliba-mails.jsonl &

# 2. Backend Convex local, puis ses variables d'environnement de test
CONVEX_AGENT_MODE=anonymous pnpm exec convex dev &
sh scripts/e2e-env.sh

# 3. Build de production servi sur le port 3000
NITRO_PRESET=node-server pnpm build
PORT=3000 node .output/server/index.mjs &

# 4. Le parcours
MAIL_SINK=/tmp/joliba-mails.jsonl pnpm test:e2e
```

Variables utiles : `E2E_SCREENSHOTS=<dossier>` enregistre une capture à chaque étape ;
`PLAYWRIGHT_CHROMIUM_PATH` désigne un Chromium déjà installé.

`scripts/e2e-env.sh` pose `RESEND_API_URL` sur le déploiement : **ne jamais** l'exécuter contre un
déploiement réel, les e-mails partiraient vers le faux serveur.

## Mesurer la carte client

```bash
node scripts/seed-demo.mjs              # affiche { venueSlug, token, scanPath }
node scripts/measure-guest.mjs http://localhost:3000<scanPath> 20
```

Le profil émulé est celui de DESIGN §5 (1,6 Mbit/s, 300 ms, processeur ralenti 6 fois). C'est une
borne, pas le verdict : le test sur un vrai téléphone (DESIGN §12, point 6) reste obligatoire.
Le serveur Node local ne compresse pas le HTML ; en production il l'est, le chiffre local est donc
pessimiste sur ce point.
