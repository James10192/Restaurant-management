# DEPLOYMENT.md — Joliba

> §92 à §96. Environnements, intégration continue, observabilité, drapeaux, incidents.

---

## 1. Environnements

| Environnement | Frontend | Convex | Base | Paiements | Qui y accède |
|---|---|---|---|---|---|
| `local` | Vite dev | déploiement dev personnel | jeu de démonstration | **faux fournisseur** | développeur |
| `preview` | déploiement par branche | déploiement de prévisualisation | jeu de démonstration | **faux fournisseur** | équipe, relecteurs |
| `staging` | domaine dédié | déploiement dédié | données anonymisées | **bac à sable** | équipe, clients pilotes |
| `production` | domaine public | déploiement de production | réelle | **réels** | tout le monde |

**Trois interdits absolus** *(§95)* :

1. **Jamais la base de production dans un environnement de prévisualisation.** Une prévisualisation
   est ouverte par définition ; y brancher la production, c'est publier les données des clients.
2. **Jamais les mêmes identifiants de paiement entre deux environnements.** Un test qui encaisse
   réellement est une faute qu'on ne peut pas rattraper.
3. **Jamais de données réelles de clients dans un jeu de démonstration.** Les jeux de démonstration
   sont **générés**, pas copiés.

Les identifiants de paiement de production ne sont accessibles qu'au déploiement de production, et
un contrôle au démarrage vérifie la cohérence : un environnement autre que `production` qui trouve
une clé de production **refuse de démarrer**. Un avertissement dans un journal ne suffit pas — il
sera lu trop tard.

### Variables de la carte client (T1)

| Variable | Où | Rôle |
|---|---|---|
| `GUEST_PASS_SECRET` | déploiement **Convex** | Signe les laissez-passer de table (HMAC-SHA256). 32 caractères au moins, aléatoires, **différents par environnement**. Absente ou trop courte : l'échange de QR échoue — jamais de laissez-passer non signé. La changer invalide tous les clients attablés : ils rescannent. |
| `PIN_PEPPER` | déploiement **Convex** | Secret sous lequel les PIN de service et les codes d'activation sont hachés (HMAC-SHA256, D-060). 32 caractères au moins, aléatoires, **différents par environnement**. Absent : aucun PIN ne se choisit ni ne se vérifie. Le changer rend tous les PIN invalides : chacun doit recevoir un nouveau code d'activation. |
| `OPERATOR_JWT_PRIVATE_KEY` | déploiement **Convex** | Clé privée ES256 (JWK) qui signe les jetons d'appareil et de PIN, 10 minutes. `node scripts/operator-keys.mjs --apply` la fabrique et la pose sans l'écrire nulle part. |
| `OPERATOR_JWKS` | déploiement **Convex** | La clé publique correspondante, lue par `convex/auth.config.ts` **au déploiement** : redéployer après l'avoir changée. Absente : le second fournisseur n'existe pas, et aucun jeton d'opérateur n'est accepté. |
| `SITE_URL` | application web | Origine publique (`https://…`, sans barre finale). Sert l'adresse canonique, les données structurées, `robots.txt` et le plan du site. À défaut, l'origine de la requête — acceptable en local, pas en production derrière un proxy. |
| `JOLIBA_DEMO_SEED` | déploiement Convex | **Jamais en production.** `1` autorise le restaurant de démonstration (`scripts/seed-demo.mjs`) ; seul `scripts/e2e-env.sh` la pose, sur un backend local anonyme. |

### Variables du paiement en ligne (T5)

| Variable | Où | Rôle |
|---|---|---|
| `PAYMENT_SECRETS_KEY` | déploiement **Convex** | Clé maîtresse qui chiffre les clés Wave des restaurants (AES-256-GCM, D-117) : 32 octets aléatoires en base64 (`openssl rand -base64 32`), **différente par environnement**. Absente : l'écran de réglage le dit, et aucune clé Wave ne s'enregistre. **La perdre, c'est perdre toutes les clés enregistrées** : chaque restaurant devra recoller les siennes. |
| `PAYMENT_SECRETS_KEY_VERSION` | déploiement Convex | Numéro de la clé maîtresse en cours (1 par défaut). |
| `PAYMENT_SECRETS_KEY_PREVIOUS` | déploiement Convex | Pendant une rotation seulement : l'ancienne clé, qui ouvre encore ce qu'elle a chiffré. Rotation : poser l'ancienne ici, la nouvelle dans `PAYMENT_SECRETS_KEY`, incrémenter la version ; puis lancer `npx convex run paymentAccounts:resealAll`, qui ré-encode toutes les clés sous la nouvelle (la même tâche tourne chaque nuit). L'ancienne se retire quand il répond `unreadable: 0`. |
| `SITE_URL` | déploiement **Convex** aussi | L'adresse où Wave renvoie le client après paiement (`/r/<établissement>/table?paiement=retour`). Même valeur que côté application web. |
| `JOLIBA_FAKE_PAYMENTS`, `WAVE_API_URL` | déploiement Convex | **Jamais en production.** Font parler l'adaptateur Wave au faux Wave de `e2e/wave-sink.mjs`. Ignorées hors d'un backend local (`CONVEX_CLOUD_URL` sur localhost) : même posées par erreur en production, Joliba parle au vrai Wave. |

Quatre tâches planifiées tournent d'elles-mêmes (`convex/crons.ts`) : le rattrapage des paiements en
attente toutes les 2 minutes, le rapprochement avec le relevé Wave chaque jour à 06:00 UTC, le
ré-encodage des clés après une rotation de la clé maîtresse, chaque nuit (sans effet sinon), et la
clôture des jours de service toutes les heures (J-1, puis J-2 recalculé, D-141).

**Les chiffres des jours passés** : à la mise en service de T6, et chaque fois que `METRICS_VERSION`
change (`convex/lib/serviceDay.ts`), reconstruire l'historique de chaque établissement, un jour par
transaction :

```sh
npx convex run analytics:rebuild '{"venueId":"…","from":"2026-06-01","to":"2026-09-24"}'
```

Sans cela, `/app/analytics` dit combien de jours de la période n'ont pas de chiffres, et la
comparaison des jours attend trois mêmes jours de semaine clos.

**À dire à chaque restaurant qui branche Wave** : dans le portail Wave Business, **ne pas activer la
liste blanche d'adresses IP** sur la clé d'API. Elle ne se désactive plus ensuite, et Convex n'a pas
d'adresse sortante fixe : la clé cesserait de fonctionner. L'écran de réglage le rappelle.

Les fichiers de `/assets/` sont précompressés au build (gzip, brotli) et servis avec un cache d'un
an, `immutable` ; `/sw.js` est servi `no-cache`, sinon une correction du service worker n'atteint
jamais les téléphones (D-054).

**Mesure de la carte client** avant chaque mise en production :
`node scripts/measure-guest.mjs <adresse de scan> 20` sur le build de production (profil DESIGN §5
émulé), **puis** le test sur un vrai téléphone (DESIGN §12, point 6), qui seul tranche.

---

## 2. Intégration continue

À chaque *pull request*, dans cet ordre — le moins cher d'abord, pour rendre la main vite :

```
1. Installation avec verrouillage strict (le fichier de verrou fait foi)
2. Génération des types Convex + vérification qu'ils sont COMMITÉS
3. Lint
4. Typage (tsc --noEmit)
5. Tests unitaires + tests Convex
6. Build
7. Audit des dépendances + analyse de secrets
8. Tests de bout en bout sur les parcours critiques
9. Tests d'accessibilité sur les écrans principaux
```

**L'étape 2 mérite son existence.** Générer les types puis vérifier qu'aucune différence n'apparaît
garantit que ce qui est dans le dépôt correspond au schéma. Sans elle, un développeur peut livrer
du code qui compile chez lui et nulle part ailleurs. *(Pratique reprise du dépôt de référence
`filon`, où elle est en place.)*

**Bloquent la fusion** : typage, lint, tests unitaires, build, isolation multi-tenant, secrets
détectés.
**Signalent sans bloquer** : accessibilité, budget de performance, audit de dépendances de gravité
faible.

### Ce qu'on ne reprend pas du dépôt de référence

`filon` n'a **aucun test** et aucun script de lint — vérifié. C'est le trou de sa discipline, et
l'endroit exact où l'on doit faire autrement **dès le premier jour** : une suite de tests qu'on
ajoute « plus tard » n'est jamais ajoutée.

---

## 3. Dépendances

Toute montée de version suit la procédure de `docs/research/stack-compatibility.md` : lire la
documentation officielle, vérifier les dépendances de pairs, lire le journal des changements,
typer, construire, tester.

**Deux verrous en place :**

- `strict-peer-dependencies=true` dans `.npmrc` : une incompatibilité déclarée devient une **erreur**,
  pas un avertissement qu'on finit par ne plus lire.
- `better-auth` est épinglé avec un **tilde** (`~1.6.x`) et non un accent circonflexe *(D-017)* : le
  composant Convex exige `< 1.7.0`, et `^` autoriserait une version qui **casse l'authentification**.
  Le dépôt de référence porte ce piège armé ; on ne le reproduit pas.

Un contrôle d'intégration continue vérifie que la version installée reste dans la fourchette
attendue — parce qu'un verrou qui n'est pas vérifié finit par sauter à la faveur d'une résolution.

---

## 4. Livraison

```
branche → PR → contrôles → revue → fusion sur `main`
       → déploiement Convex (migrations de schéma d'abord)
       → déploiement frontend
       → vérification post-déploiement
```

**L'ordre compte** : le schéma Convex se déploie **avant** le frontend. L'inverse sert une interface
qui appelle des fonctions qui n'existent pas encore.

**Changements de schéma** : toujours additifs d'abord. Ajouter le champ optionnel, remplir, puis
seulement rendre obligatoire et retirer l'ancien. Un déploiement qui supprime et recrée dans le même
mouvement casse les clients ouverts — et dans un restaurant, un client ouvert est un serveur en plein
service.

**Vérification post-déploiement**, exécutée et non supposée :

```bash
curl -I https://<domaine>            # en-têtes de sécurité RÉELLEMENT servis
curl -s https://<domaine>/api/health # version, connexion base, horodatage
# puis : un scan de QR de démonstration, une commande de test, un encaissement de test
```

Les en-têtes de sécurité définis en configuration ne sont pas forcément ceux servis en production :
le passage par la plateforme d'hébergement peut les modifier. On les vérifie à chaque déploiement
qui y touche.

---

## 5. Drapeaux de fonctionnalité

Portée : global · organisation · établissement · utilisateur *(§94)*.

À utiliser pour : une bêta, un déploiement progressif, un nouvel écran de caisse, un nouvel
assistant. **Pas** pour masquer du code mort.

Deux règles d'hygiène : tout drapeau naît avec une **date de retrait** ; un drapeau actif depuis plus
de trois mois est soit adopté, soit supprimé. Un drapeau oublié devient une branche de code que
personne ne teste.

---

## 6. Observabilité

Ce qu'on capture *(§92)* : erreurs frontend et backend · échecs de mutation · erreurs de paiement ·
erreurs de webhook · erreurs d'IA · latences des surfaces critiques · budget de performance.

Chaque incident doit se relier à `traceId` · organisation · établissement · utilisateur · route ·
opération — **et à rien d'autre**. Jamais de jeton, de code à usage unique, de donnée de paiement ni
de contenu de commande dans un journal.

**Journaux structurés**, avec une liste **explicite** des champs autorisés. Une liste d'exclusion
laisse toujours passer le prochain champ ajouté ; une liste d'inclusion, non.

### Alertes

Une alerte réveille quelqu'un ou n'existe pas.

| Gravité | Exemples | Réaction |
|---|---|---|
| Critique | Paiements en échec sur un rail · KDS muet sur un établissement en service · fuite de portée détectée | Immédiate, jour et nuit |
| Élevée | Taux d'erreur anormal · webhooks non traités qui s'accumulent · réconciliation en écart | Sous 1 h ouvrée |
| Moyenne | Dégradation de performance · dépassement de quota IA | Jour ouvré |

**Le service du soir est le moment sensible.** Une alerte sur un établissement en plein service ne
doit pas attendre le lendemain matin : c'est précisément à ce moment que le produit se juge.

### Page d'état

Publique quand le produit atteindra un niveau commercial qui le justifie *(§93)* : application,
base, authentification, paiements, notifications. **Aucun engagement de disponibilité chiffré n'est
publié tant qu'on ne peut pas le tenir** *(SECURITY.md §1)*.

---

## 7. Sauvegardes et restauration

Les sauvegardes du fournisseur, **plus** un export périodique hors fournisseur des données
financières — celles qu'on ne peut pas reconstituer.

**Une sauvegarde qu'on n'a jamais restaurée n'existe pas.** Un exercice de restauration est planifié
et daté ; tant qu'il n'a pas eu lieu, ce document ne prétend pas que la restauration fonctionne.

---

## 8. Incidents

```
Détection → qualification → communication → correction → rétablissement → post-mortem
```

Le **post-mortem est sans reproche** et cherche la cause, pas le coupable. Il produit au moins une
action concrète : un test, une alerte, un garde-fou. Un post-mortem sans action est une réunion.

**Communication** : un restaurateur en plein service préfère un message honnête à un silence. La
règle est de communiquer dès la qualification, même sans solution, en disant ce qu'on sait, ce
qu'on ne sait pas encore, et quand on redonnera des nouvelles.

---

## 9. Ce qui reste à faire avant la mise en production

- [ ] Exercice de restauration exécuté et daté
- [ ] En-têtes de sécurité vérifiés par `curl -I` sur le domaine réel
- [ ] Identifiants de paiement séparés et contrôle de démarrage en place
- [ ] Parcours critiques couverts en bout en bout
- [ ] Alertes branchées sur un canal réellement lu
- [ ] Point d'état de santé exposé et surveillé
- [ ] Procédure de rotation des secrets écrite et testée
- [ ] `GUEST_PASS_SECRET` posé en production, distinct de tous les autres environnements
- [ ] `PIN_PEPPER`, `OPERATOR_JWT_PRIVATE_KEY`, `OPERATOR_JWKS` posés en production, distincts de tous les autres environnements
- [ ] Carte client mesurée sur un vrai Android d'entrée de gamme en 4G bridée (DESIGN §12, point 6)
- [ ] Limitation de débit par IP sur `/r/*/t/*` en bordure (SECURITY M3)
- [ ] `PAYMENT_SECRETS_KEY` posée en production, distincte de tous les autres environnements, et gardée en lieu sûr hors du déploiement
- [ ] `JOLIBA_FAKE_PAYMENTS` et `WAVE_API_URL` **absentes** de la production
- [ ] Essai réel Wave à 100 FCFA, payé puis remboursé, avec `scripts/wave-probe.mjs` (D-128)
