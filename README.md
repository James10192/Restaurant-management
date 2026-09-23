# Joliba

**L'infrastructure numérique qui orchestre le service d'un restaurant.**

Le QR code n'est que la porte d'entrée. Ce qui est construit derrière, c'est la coordination en
temps réel entre le client à table, le serveur, la cuisine, le bar, la caisse et le gérant.

> Le nom **Joliba** (« le grand fleuve », le Niger en mandingue) est retenu depuis le 2026-09-22 —
> voir [`docs/research/naming-study.md`](docs/research/naming-study.md) §9. La vérification de marque
> (OAPI) reste à faire avant tout dépôt ou dépense de communication.

---

## État du projet

**Tranche T0 (fondations) livrée.** Une personne se connecte par code reçu par e-mail (ou Google),
ouvre son organisation et son premier établissement, invite un collègue avec un rôle limité à cet
établissement — et le collègue ne voit rien d'autre. Prouvé par un test de bout en bout dans un vrai
navigateur, et par un test d'isolation multi-tenant qui appelle **chaque** fonction publique avec les
identifiants d'une autre organisation.

| Ce qui existe | Où |
|---|---|
| Authentification : code à 6 chiffres par e-mail (haché, 10 min, 3 essais, limité par IP **et** par adresse), Google si configuré, appareils connectés et déconnexion à distance | `convex/auth.ts`, `/connexion`, `/auth/otp`, `/app/account` |
| Organisations et établissements (devise et fuseau déduits du pays) | `convex/organizations.ts`, `convex/venues.ts`, `/app/onboarding`, `/app/settings/venue` |
| Équipe : invitations (jeton haché, lien à partager par WhatsApp), rôles par portée, suspension, retrait | `convex/team.ts`, `/invitation/$token`, `/app/team` |
| Rôles composables, avec les trois verrous contre l'élévation de privilèges | `convex/roles.ts`, `convex/lib/authority.ts`, `/app/roles` |
| Gardes Convex et résolution des permissions | `convex/lib/guards.ts` |
| Système de design (jetons, composants, six états d'écran) | `src/styles/app.css`, `src/components/ui/` |
| Observabilité minimale : point de santé, journaux à liste d'inclusion, erreurs du navigateur reliées à un `traceId` | `convex/lib/log.ts`, `/api/health`, `/api/client-errors` |

Ce qui n'existe pas encore : tout le service (carte, tables, commandes, cuisine, caisse, paiements) —
voir [`docs/ROADMAP.md`](docs/ROADMAP.md), tranches T1 et suivantes.

### Documents de conception

| Livrable | Fichier | État |
|---|---|---|
| Document d'architecture (28 sections) | [`docs/ARCHITECTURE_DECISIONS.md`](docs/ARCHITECTURE_DECISIONS.md) | ✅ |
| Vision, personas, règles métier | [`PRODUCT.md`](PRODUCT.md) | ✅ |
| Architecture technique + diagrammes | [`ARCHITECTURE.md`](ARCHITECTURE.md) | ✅ |
| Modèle de données (58 tables justifiées) | [`DATA_MODEL.md`](DATA_MODEL.md) | ✅ |
| Schéma Convex | `convex/schema.ts` | ✅ typecheck vert |
| Rôles et permissions | [`PERMISSIONS.md`](PERMISSIONS.md) | ✅ |
| Sécurité et modèle de menaces | [`SECURITY.md`](SECURITY.md) | ✅ |
| Paiements, caisse, fiscalité | [`PAYMENTS.md`](PAYMENTS.md) | ✅ |
| IA et garde-fous | [`AI.md`](AI.md) | ✅ |
| Analytique | [`ANALYTICS.md`](ANALYTICS.md) | ✅ |
| Déploiement et observabilité | [`DEPLOYMENT.md`](DEPLOYMENT.md) | ✅ |
| Système de design | [`DESIGN.md`](DESIGN.md) | ✅ |
| Architecture de l'information | [`docs/INFORMATION_ARCHITECTURE.md`](docs/INFORMATION_ARCHITECTURE.md) | ✅ |
| Feuille de route | [`docs/ROADMAP.md`](docs/ROADMAP.md) | ✅ |
| Journal de décisions | [`docs/DECISION_LOG.md`](docs/DECISION_LOG.md) | ✅ |
| Application | `convex/`, `src/` | 🟡 T0 livrée, T1 à venir |

---

## Par où commencer

**Pour comprendre le produit** → [`PRODUCT.md`](PRODUCT.md), puis
[`docs/ARCHITECTURE_DECISIONS.md`](docs/ARCHITECTURE_DECISIONS.md).

**Pour comprendre les décisions et les désaccords** → [`docs/DECISION_LOG.md`](docs/DECISION_LOG.md).
C'est le document qui dit ce qui n'est pas tranché, et pourquoi.

**Pour construire** → [`docs/ROADMAP.md`](docs/ROADMAP.md), puis le document du domaine concerné.

**Avant d'écrire une fonction Convex** → [`PERMISSIONS.md`](PERMISSIONS.md) §6 et
[`ARCHITECTURE.md`](ARCHITECTURE.md) §10. Toute fonction publique commence par une garde.

---

## Recherche

Les documents de `docs/research/` portent des faits **sourcés et datés**, pas des impressions.
Ce qui n'a pas pu être vérifié y est écrit comme tel.

| Document | Ce qu'il établit |
|---|---|
| [`competitive-analysis.md`](docs/research/competitive-analysis.md) | 18 solutions, angles morts, contraintes africaines, différenciateurs |
| [`stack-compatibility.md`](docs/research/stack-compatibility.md) | Versions vérifiées au registre, pièges de compatibilité |
| [`payments-africa.md`](docs/research/payments-africa.md) | Fournisseurs, Mobile Money, idempotence, fiscalité |
| [`seo-strategy.md`](docs/research/seo-strategy.md) | Mots-clés, i18n, données structurées, noindex des tables |
| [`naming-study.md`](docs/research/naming-study.md) | 36 candidats, shortlist, vérifications de domaines |
| [`filon-patterns.md`](docs/research/filon-patterns.md) | Patterns réutilisables du dépôt de référence |
| [`field-research-guide.md`](docs/research/field-research-guide.md) | Guide d'entretiens — **entretiens non réalisés** |

---

## Stack

TanStack Start · React 19 · TypeScript strict · Tailwind v4 · shadcn/ui · **Convex** (temps réel) ·
Better Auth · Vercel.

Les versions ne sont pas choisies au hasard, et `@latest` est le mauvais choix sur trois paquets
structurants : voir [`docs/research/stack-compatibility.md`](docs/research/stack-compatibility.md).

---

## Commandes

```bash
pnpm install

# Développement : backend Convex local (sans compte) + application
CONVEX_AGENT_MODE=anonymous pnpm exec convex dev   # écrit .env.local
pnpm dev                                            # http://localhost:3000

# Contrôles (ceux de la CI)
pnpm typecheck
pnpm check:permissions   # catalogue ↔ PERMISSIONS.md
pnpm check:schema        # invariants du schéma
pnpm check:guards        # toute fonction publique commence par une garde
pnpm check:money         # le franc CFA n'a pas de sous-unité
pnpm test                # isolation multi-tenant, verrous, portée (convex-test)
pnpm check               # tout ce qui précède

pnpm test:e2e            # parcours T0 dans un navigateur — voir e2e/README.md
```

Variables du déploiement Convex : `SITE_URL`, `BETTER_AUTH_SECRET`, `RESEND_API_KEY`, `EMAIL_FROM`
(sans elles, aucun code de connexion ne part), et `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` pour
Google (le bouton n'apparaît qu'avec `VITE_AUTH_GOOGLE=true` côté application).

---

## Les règles qui ne se négocient pas

1. **La portée avant la donnée.** Toute fonction publique vérifie organisation et établissement
   **avant** de lire. Une fonction sans garde est un défaut bloquant.
2. **L'argent ne se devine pas.** Aucun montant ne vient du client. Aucun paiement n'est réussi sur
   une simple redirection. Rien de financier ne se supprime.
3. **Rien d'inventé.** Un allergène, un prix, un chiffre : si la donnée n'existe pas, le produit dit
   qu'il ne sait pas. Cela vaut d'abord pour l'IA.
4. **Le service ne s'arrête pas parce que le logiciel hésite.** Il reste toujours un chemin pour
   servir et encaisser.
5. **Deux publics, deux densités.** Le client veut de l'air ; la cuisine veut de la densité.

---

## Ce qui attend une décision

Dix questions restent ouvertes (le nom est tranché) dans [`docs/DECISION_LOG.md`](docs/DECISION_LOG.md) partie C. Les trois
qui changent le plus de choses :

- **Le hors-ligne** *(A8)* : jusqu'où ? C'est le meilleur différenciateur trouvé, et il est
  incompatible avec la stack telle quelle. Arbitrage d'investissement.
- **Le code PIN de service** *(A1)* : l'authentification par courriel est impraticable en cuisine.
- **La spécification fiscale FNE** *(A7)* : préalable à obtenir, pas une tâche de développement.
