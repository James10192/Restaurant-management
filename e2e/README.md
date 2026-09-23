# Tests de bout en bout

Le parcours `t0.spec.ts` s'exécute dans un vrai navigateur, contre le build de production et un
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
