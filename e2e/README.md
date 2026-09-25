# Tests de bout en bout

Les parcours `t0.spec.ts` (ouvrir, inviter, cloisonner) et `t1.spec.ts` (composer la carte, la
publier, imprimer un QR, le scanner, couper un plat en direct, régénérer le QR) et `t2.spec.ts` (le service : saisir, préparer, porter, envoyer la suite, couper le réseau ;
le client compose et le serveur reprend son panier ; tablette partagée avec PIN, écran de cuisine,
révocation) et `t3.spec.ts` (l'argent : encaisser en deux fois, ouvrir la caisse sur place,
imprimer le ticket et vérifier qu'il part en 80 mm, compter une caisse juste, puis provoquer un
écart et le retrouver au rapport avec son auteur et son motif ; puis, en pochettes, encaisser sous
PIN sur une tablette partagée, faire compter la pochette par un responsable, et recouvrer un
impayé) et `t4.spec.ts` (le client commande lui-même : quatre téléphones à une table, trois admis
par le code et un par le serveur, envois simultanés dont une réponse coupée puis rejouée et un double
appui, une commande par convive, un plat prêt lu par le seul téléphone concerné, un cinquième
téléphone sans code tenu à l'écart) s'exécutent dans un vrai navigateur, contre le build de production et un
backend Convex **local** (sans compte). Aucun service extérieur n'est appelé : les e-mails, codes
de connexion compris, sont recueillis par un faux serveur de courrier.

```bash
# 1. Faux serveur de courrier (écoute sur 127.0.0.1:4010)
node e2e/mail-sink.mjs /tmp/joliba-mails.jsonl &

# 2. Backend Convex local, puis ses variables d'environnement de test (les secrets déjà posés
#    sont gardés : les régénérer rendrait illisible la clé de connexion déjà enregistrée)
CONVEX_AGENT_MODE=anonymous pnpm exec convex dev &
sh scripts/e2e-env.sh

# 3. Build de production servi sur le port 3000
NITRO_PRESET=node-server pnpm build
PORT=3000 node .output/server/index.mjs &

# 4. Le parcours
MAIL_SINK=/tmp/joliba-mails.jsonl pnpm test:e2e
```

`t2.spec.ts`, `t3.spec.ts` et `t4.spec.ts` sèment eux-mêmes un établissement de démonstration (`scripts/seed-demo.mjs`) et y
rattachent le compte de test par `devSeed:joinDemo`, qui ne fonctionne que sur un backend local
(`JOLIBA_DEMO_SEED=1`, posé par `scripts/e2e-env.sh`).

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
