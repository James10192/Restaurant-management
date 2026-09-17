# Compatibilité des dépendances — étude préalable

**Date du relevé : 17 septembre 2026.** Toutes les versions « dernière stable » proviennent
du registre npm (`registry.npmjs.org`, champ `dist-tags.latest` + `time[version]`), pas de
mémoire ni d'un article de blog. Les contraintes `peerDependencies` citées sont extraites des
métadonnées publiées de chaque paquet.

**Statut : rien n'est installé.** Ce document est le préalable exigé avant toute installation
(§3 : « ne jamais utiliser automatiquement la dernière version simplement parce qu'elle est
disponible »). Il doit être relu et validé avant le premier `pnpm install`.

## Résumé exécutif

Trois constats commandent tout le reste.

1. **`better-auth@latest` (1.7.5) casserait l'authentification.** `@convex-dev/better-auth@0.12.5`
   déclare `"better-auth": ">=1.6.11 <1.7.0"`. La doc officielle de Convex le dit en toutes
   lettres : `npm install better-auth@~1.6.15`. Il faut un **tilde**, jamais un caret.
2. **`typescript@latest` (7.0.2) n'est pas utilisable ici.** TypeScript 7 est le portage natif en
   Go. La compatibilité avec TanStack Router fait l'objet d'un ticket de suivi **encore ouvert**
   (TanStack/router#7328), avec une différence d'inférence documentée. Or le typage des routes est
   la partie la plus sensible de cette pile. → TypeScript 5.9.3.
3. **`vite@latest` (8.3.0) engage plus qu'il n'en a l'air.** `@vitejs/plugin-react@6.x` exige
   `vite ^8.0.0` *exclusivement* : l'écosystème est au milieu du gué. → Vite 7.3.6 avec
   `@vitejs/plugin-react@5.2.0`, qui accepte `^7 || ^8` et offre donc un chemin de sortie propre.

Autrement dit : sur les trois paquets les plus structurants de la pile, `@latest` est le mauvais
choix. C'est exactement ce que cette étude devait établir.

## Référence interne : `/home/user/filon/package.json`

Projet réel tournant sur cette famille de pile (lu en seule lecture, non modifié). Ses choix sont
un signal fort, notamment là où il **épingle une version exacte** au lieu d'un caret :

| Il épingle | Version | Lecture |
|---|---|---|
| `@tanstack/react-start` / `react-router` / `router-plugin` | 1.168.32 / 1.170.18 / 1.168.18 | Les trois doivent bouger ensemble |
| `vite` | 7.3.5 | Refus délibéré de Vite 8 |
| `@vitejs/plugin-react` | 4.7.0 | Reste sur la ligne compatible Vite 7 |
| `react` / `react-dom` | 19.2.7 | Pas 19.3.0 |
| `nitro` | 3.0.260610-beta | Beta, donc figée |
| `ai` / `@openrouter/ai-sdk-provider` | 6.0.205 / 2.9.1 | Couple v6 cohérent |
| `typescript` | `^5.7.3` → résout 5.9.3 | **Ni 6 ni 7** |

Une réserve honnête sur cette référence : filon écrit `"better-auth": "^1.6.26"`. Le caret autorise
1.7.5 et **violerait** la pair-dépendance de `@convex-dev/better-auth`. Aujourd'hui pnpm résout
sans doute encore sur 1.6.33, mais c'est un piège armé. Nous ne reprenons pas cette formulation.

## Fiches par dépendance

### Socle framework

#### `@tanstack/react-start`
- **Dernière stable** : 1.168.56 (16/09/2026) · **Retenue : 1.168.56, épinglée**
- **Peer** : `vite >=7.0.0`, `react >=18||>=19`, `react-dom >=18||>=19` · **engines** : `node >=22.12.0`
- **Statut** : l'équipe communique sur une **« v1.0 Release Candidate »**. Le paquet est publié sous
  le tag `latest` et non `rc`, mais le 1.0 définitif n'est pas annoncé. À traiter comme
  quasi-stable, pas comme stable.
- **Changement récent notable** : abandon des *adapters* de déploiement au profit de `nitro/vite`.
  Tout tutoriel antérieur mentionnant un adapter Vercel dédié est périmé.
- **Pourquoi épingler** : 1.168.56 embarque `@tanstack/react-router@1.170.38` en dépendance
  **exacte**. Un caret sur l'un et pas l'autre produit deux copies du routeur dans l'arbre — panne
  de contexte React difficile à diagnostiquer.
- Source : https://registry.npmjs.org/@tanstack/react-start · https://tanstack.com/start/latest/docs/framework/react/guide/hosting

#### `@tanstack/react-router` + `@tanstack/router-plugin`
- **Dernières stables** : 1.170.38 et 1.168.40 (16/09/2026) · **Retenues : identiques, épinglées**
- **Peer critique** : `router-plugin@1.168.40` exige `@tanstack/react-router ^1.170.38`. Ce couple
  est verrouillé par le publieur ; le traiter comme un bloc indivisible avec `react-start`.
- **engines** : `node >=20.19`
- Source : https://registry.npmjs.org/@tanstack/router-plugin

#### `nitro`
- **Dernière** : `3.0.260903-beta` (03/09/2026) · **Retenue : `3.0.260903-beta`, épinglée**
- **Pourquoi** : c'est le **seul** chemin de déploiement Vercel documenté pour TanStack Start. Il
  n'existe aucune version non-beta ; le tag `latest` *est* une beta. La doc TanStack prévient :
  « still under active development and receives regular updates ».
- **Risque** : une beta dans le chemin de build de production. Épinglage obligatoire, montée de
  version uniquement après vérification manuelle du build.
- Source : https://registry.npmjs.org/nitro · https://tanstack.com/start/latest/docs/framework/react/guide/hosting

**Configuration Vercel (citée de la doc officielle)** — l'ordre des plugins compte :

```ts
import { tanstackStart } from '@tanstack/react-start/plugin/vite'
import { defineConfig } from 'vite'
import { nitro } from 'nitro/vite'
import viteReact from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [tanstackStart(), nitro(), viteReact()],
})
```

#### `react` / `react-dom`
- **Dernière stable** : 19.3.0 (09/09/2026) · **Retenue : 19.2.7, épinglée**
- **Pourquoi pas 19.3.0** : huit jours d'âge au moment du relevé, aucun bénéfice identifié pour ce
  produit, et 19.2.7 est la version que fait tourner filon en production. Un changement mineur de
  React touche l'hydratation SSR — précisément la zone où TanStack Start + nitro sont les plus
  jeunes. Montée à 19.3.0 prévue **après** le premier build vert, pas avant.
- **Compatibilité React 19 vérifiée par les métadonnées publiées** (et non supposée) :
  `radix-ui@1.6.7` → `react ^16.8||^17||^18||^19` ✅ · `motion@13.4.0` → `^18||^19` ✅ ·
  `lucide-react@1.47.0` → `^16.5.1||^17||^18||^19` ✅ · `@tanstack/react-query@5.103.1` → `^18||^19` ✅
- Source : https://registry.npmjs.org/react

#### `@types/react` / `@types/react-dom`
- **Dernière stable** : 19.3.0 (09/09/2026) · **Retenue : `~19.2.17`**
- **Pourquoi le tilde** : les types 19.3.0 décrivent des API de React 19.3 qui **n'existent pas**
  dans le runtime 19.2.7 épinglé. Laisser le caret revient à autoriser du code qui typecheck et
  plante à l'exécution. Le tilde aligne types et runtime.
- DefinitelyTyped publie un tag `ts5.9` → 19.3.0 et un tag `ts6.0` → 19.3.0 ; **aucun tag `ts7.0`**,
  ce qui corrobore la prudence sur TypeScript 7.
- Source : https://registry.npmjs.org/@types/react

#### `vite` + `@vitejs/plugin-react`
- **Dernières stables** : `vite@8.3.0` (10/09/2026), `@vitejs/plugin-react@6.1.1` (28/08/2026)
- **Retenues : `vite@7.3.6` (25/06/2026) + `@vitejs/plugin-react@5.2.0`**
- **Le point de bascule, en clair** :

  | plugin-react | `peerDependencies.vite` |
  |---|---|
  | 4.7.0 | `^4.2 \|\| ^5 \|\| ^6 \|\| ^7` |
  | 5.1.4 | `^4.2 \|\| ^5 \|\| ^6 \|\| ^7` |
  | **5.2.0** | `^4.2 \|\| ^5 \|\| ^6 \|\| ^7 \|\| ^8` ← le pont |
  | 6.0.5 → 6.1.1 | **`^8.0.0` seulement** |

  `5.2.0` est la seule version qui accepte Vite 7 *et* Vite 8. La choisir permet de migrer vers
  Vite 8 plus tard **en ne changeant qu'un paquet**. Prendre 6.1.1 aujourd'hui forcerait Vite 8
  immédiatement, sur une pile (Start + nitro beta) qui n'y est pas éprouvée.
- `@tanstack/react-start` accepte formellement `vite >=7.0.0`, donc Vite 8 n'est pas *interdit* —
  mais une plage de peer n'est pas une garantie de test. filon, en production, est sur Vite 7.
- Source : https://registry.npmjs.org/@vitejs/plugin-react

#### `typescript`
- **Dernière stable** : **7.0.2** (08/07/2026) · **Retenue : `~5.9.3`**
- **Ce qu'est TypeScript 7** : le portage natif en Go, 8× à 12× plus rapide en build complet. Le
  nom du paquet et le binaire `tsc` sont inchangés — donc **un `typescript@latest` distrait bascule
  le projet sur un compilateur entièrement réécrit sans que rien ne le signale.**
- **Pourquoi nous ne le prenons pas** :
  1. TanStack Router a un ticket de compatibilité tsgo **ouvert** (#7328, ouvert le 02/05/2026),
     avec une divergence d'inférence identifiée (`const T extends string = string` se lie au défaut
     au lieu d'inférer `never`). Le typage des routes est le cœur de ce framework.
  2. TS 7 adopte les défauts de TS 6 et transforme en **erreurs dures** ce que TS 6 signalait comme
     dépréciations. Sauter 5 → 7 saute l'étape d'avertissement prévue pour la migration.
- **Et TypeScript 6.0.3 ?** Écarté aussi : nouveaux défauts à absorber, sans le gain de vitesse
  de 7. Aucun bénéfice pour un démarrage de projet.
- **Réévaluer quand** : le ticket #7328 sera clos. Le gain de vitesse est réel et mérite le retour.
- Source : https://registry.npmjs.org/typescript · https://github.com/TanStack/router/issues/7328 · https://devblogs.microsoft.com/typescript/announcing-typescript-7-0/

### Interface

#### `tailwindcss` + `@tailwindcss/vite`
- **Dernière stable** : 4.3.3 (16/07/2026) · **Retenue : 4.3.3 pour les deux**
- **Contrainte dure** : `@tailwindcss/vite@4.3.3` dépend de `tailwindcss` en version **exacte**
  `4.3.3`. Des numéros divergents installent deux Tailwind. Toujours les bouger ensemble.
- **Peer** : `vite ^5.2 || ^6 || ^7 || ^8` — compatible avec notre Vite 7 comme avec un futur Vite 8.
- **Ce qui change en v4 (config CSS-first)** : plus de `tailwind.config.js` comme source de vérité ;
  `@import "tailwindcss"` et la directive `@theme` dans le CSS. Le plugin Vite remplace la chaîne
  PostCSS. Les couleurs shadcn passent en **OKLCH**.
- Source : https://registry.npmjs.org/@tailwindcss/vite · https://ui.shadcn.com/docs/tailwind-v4

#### `shadcn` (CLI) — convention, pas dépendance
- **Dernière stable** : 4.21.0 (04/09/2026) · **Usage : `pnpm dlx shadcn@4.21.0 init`**
- shadcn **ne s'installe pas** comme dépendance : le CLI copie du code source dans le dépôt. Il n'y
  a donc aucune version à verrouiller dans `package.json` — mais figer le numéro dans la
  documentation d'onboarding évite que deux développeurs génèrent des composants divergents.
- **Tailwind v4 + React 19** : pris en charge. Changements à connaître : `forwardRef` retiré,
  attributs `data-slot` ajoutés sur toutes les primitives, style `default` déprécié au profit de
  `new-york`.
- Source : https://ui.shadcn.com/docs/tailwind-v4

#### `radix-ui`
- **Dernière stable** : 1.6.7 (24/07/2026) · **Retenue : `^1.6.7`**
- **Décision** : utiliser le paquet **unifié** `radix-ui`, pas la trentaine de `@radix-ui/react-*`.
  filon mélange les deux approches — héritage historique, à ne pas reproduire sur un projet neuf :
  le paquet unifié garantit que toutes les primitives partagent la même version des utilitaires
  internes (`react-compose-refs`, `react-primitive`…).
- **Peer React** : `^16.8 || ^17 || ^18 || ^19` ✅
- Source : https://registry.npmjs.org/radix-ui

#### `lucide-react`
- **Dernière stable** : 1.47.0 (17/09/2026 — publiée le jour même) · **Retenue : `^1.46.0`**
- Cadence de publication très élevée (1.45.0 le 11/09, 1.46.0 le 14/09, 1.47.0 le 17/09). Le caret
  suffit : ce paquet n'expose que des composants d'icônes, la surface de rupture est minime.
- **Retenir 1.46.0 comme plancher** plutôt que 1.47.0 : ne pas bâtir sur une publication du jour.

### Backend temps réel et authentification

#### `convex`
- **Dernière stable** : 1.46.0 (16/09/2026) · **Retenue : `^1.46.0`**
- Satisfait les deux pairs qui comptent : `@convex-dev/better-auth` (`^1.25.0`) et
  `@convex-dev/rate-limiter@0.4.0` (`^1.43.0`, donc **plancher 1.43** — un `convex` plus ancien
  casserait le limiteur).
- **Limites à connaître avant de modéliser** (chiffres officiels, pas approximations) :

  | Limite | Valeur |
  |---|---|
  | Taille d'un document | 1 MiB |
  | Champs par document / profondeur d'imbrication | 1024 / 16 |
  | Éléments d'un tableau | 8192 |
  | **Index par table** | **32** |
  | Champs par index | 16 |
  | **Documents parcourus par transaction** | **32 000** |
  | Données lues par transaction | 16 MiB |
  | Documents écrits par transaction | 16 000 |
  | Temps d'exécution query/mutation (code utilisateur) | **1 seconde** |
  | Action runtime Convex / runtime Node | 30 min / 10 min |
  | Taille des arguments / du retour de fonction | 16 MiB (5 MiB en action Node) |
  | Résultats max recherche plein texte / vectorielle | 1024 / 256 |

- **Conséquences concrètes pour un SaaS multi-tenant** :
  - **`.collect()` est un piège d'échelle.** Il matérialise tout le résultat : sur une table qui
    grossit par tenant, il finit par heurter les 32 000 documents ou les 16 MiB, et l'erreur
    n'arrive qu'**en production, chez le plus gros client**. Toute liste potentiellement non bornée
    doit utiliser `.paginate()`, jamais `.collect()`.
  - **32 index par table** est une limite basse quand chaque requête est scopée par tenant. Prévoir
    des index **composites commençant par `tenantId`** (`by_tenant_and_status`) plutôt qu'un index
    par champ, sinon le budget est consommé avant la fin du modèle.
  - **Transactions** : queries et mutations sont exécutées de façon transactionnelle et
    déterministe, avec 1 seconde de temps utilisateur. Tout travail long (envoi d'e-mail, appel
    LLM) appartient à une **action**, pas à une mutation.
- Source : https://docs.convex.dev/production/state/limits

#### `@convex-dev/better-auth` — **le point de compatibilité le plus dangereux**
- **Dernière stable** : 0.12.5 (27/06/2026) · **Retenue : `0.12.5`, épinglée**
- **Peer déclarée** : `better-auth ">=1.6.11 <1.7.0"`, `convex "^1.25.0"`, `react "^18.3.1 || ^19.0.0"`
- **La doc officielle Convex écrit noir sur blanc** :
  ```bash
  npm install convex@latest @convex-dev/better-auth
  npm install better-auth@~1.6.15   # « requires a pinned version »
  ```
- **Historique des contraintes** — la borne haute est systématiquement fermée, ce n'est pas un
  oubli mais une politique :

  | Composant | exige `better-auth` |
  |---|---|
  | 0.10.x | `>=1.4.9 <1.5.0` |
  | 0.11.x | `>=1.5.0 <1.6.0` |
  | **0.12.0 → 0.12.5** | **`>=1.6.11 <1.7.0`** |

- **Le décalage à assumer** : `better-auth` est en 1.7.5 depuis le 14/09, la ligne 1.7 existe depuis
  le 10/09 au moins, et le composant Convex n'a pas bougé depuis le **27/06/2026** (près de 3 mois).
  Nous serons durablement une version mineure en retard sur Better Auth. C'est le prix de
  l'intégration Convex ; il doit être accepté explicitement, pas découvert.
- **Configuration Vite obligatoire** (sinon échec de résolution de module en SSR) :
  ```ts
  ssr: { noExternal: ['@convex-dev/better-auth'] }
  ```
- **Enregistrement du composant** (`convex/convex.config.ts`) :
  ```ts
  import { defineApp } from "convex/server";
  import betterAuth from "@convex-dev/better-auth/convex.config";
  const app = defineApp();
  app.use(betterAuth);
  export default app;
  ```
- **Les deux méthodes d'authentification voulues sont prises en charge**, d'après la liste officielle
  des plugins supportés : **Email OTP** ✅ et **Generic OAuth / providers sociaux (Google)** ✅.
  Figurent aussi : Anonymous, JWT, Magic Link, One Tap, Phone Number, Two Factor, Username.
  **Incompatible** : le plugin **SSO** (dépendances Node directes) — sans importance ici.
- Source : https://labs.convex.dev/better-auth/framework-guides/tanstack-start · https://labs.convex.dev/better-auth/supported-plugins

#### `better-auth`
- **Dernière stable** : 1.7.5 (14/09/2026) · **Retenue : `~1.6.33`** (1.6.33 publiée le 14/09/2026)
- **Le tilde n'est pas une préférence de style, c'est la condition de fonctionnement.** `^1.6.33`
  autorise 1.7.5 et viole la pair-dépendance ci-dessus. `~1.6.33` borne à `<1.7.0`.
- Bonne nouvelle : la ligne 1.6 est **activement maintenue** (tag `release-1.6` → 1.6.33, publiée le
  même jour que 1.7.5). Rester en 1.6 n'est pas rester sur une branche morte.
- Peers pertinentes, toutes optionnelles : `react ^18||^19` ✅, `@tanstack/react-start ^1.0.0` ✅
  (le support Start est reconnu en amont). Dépend de `zod ^4.5.4` en interne → cohérent avec notre Zod 4.
- Source : https://registry.npmjs.org/better-auth

#### `@convex-dev/rate-limiter`
- **Dernière stable** : 0.4.0 (14/09/2026) · **Retenue : `^0.4.0`**
- **Peer** : `convex ^1.43.0` — c'est ce paquet qui fixe le **plancher** de Convex, pas l'inverse.
- Publication très récente (trois jours). Le retenir quand même : en 0.x, rester sur 0.3.2 (celle de
  filon) signifierait sortir du flux de correctifs. Vérifier la limitation de débit dans les tests
  d'intégration dès la première itération.

#### `@convex-dev/react-query` + `@tanstack/react-query`
- **Dernières stables** : 0.1.0 (**20/11/2025**) et 5.103.1 (16/09/2026) · **Retenues : `^0.1.0` et `^5.103.1`**
- **Réserve à signaler** : `@convex-dev/react-query` n'a pas été republié depuis **dix mois**. Ce
  n'est pas forcément un abandon (c'est une couche d'adaptation mince, elle peut être simplement
  terminée), mais c'est le paquet le plus dormant de la pile. Sa peer est large
  (`@tanstack/react-query ^5.0.0`), donc React Query peut avancer sans lui.
- **Point d'attention** : React Query publie une alpha `6.0.0` ? Non — le tag `alpha` pointe encore
  sur du 5.0.0-alpha. La ligne 5 est la ligne vivante.

### IA

#### `ai` (Vercel AI SDK)
- **Dernière stable** : **7.0.105** (16/09/2026) · **Retenue : `^7.0.105`**
- **Écart avec la commande initiale** : le cahier des charges mentionne « Vercel AI SDK v6 ». La v7
  est sortie et porte le tag `latest` ; la v6 reste publiée sous le tag `ai-v6` (6.0.285). **Pour un
  projet neuf, prendre la v7** : il n'y a aucun code à migrer, donc aucun des coûts de migration
  qui justifieraient de rester en v6 — ce serait démarrer avec une dette.
- **Ruptures v6 → v7** (utiles même sans migration, car toute la documentation v6 en ligne devient
  trompeuse) :
  - **Node.js 22 minimum** ; **CommonJS supprimé**, ESM uniquement.
  - Option `system` → **`instructions`**.
  - `onFinish` → `onEnd`, `onStepFinish` → `onStepEnd` (alias dépréciés conservés).
  - `fullStream` → `stream` ; `experimental_output` → `output`.
  - Préfixes `experimental_` retirés : `generateImage`, `transcribe`, `generateSpeech`,
    `customProvider`, `activeTools`, `telemetry`.
  - Outils : `context` remplace `experimental_context` ; nouveaux `toolsContext` / `runtimeContext`.
  - `usage` **cumule désormais toutes les étapes** (avant : dernière étape seulement) — piège de
    facturation si l'on porte du code v6 sans relire.
  - OpenTelemetry extrait dans `@ai-sdk/otel`.
  - Les messages `system` dans `prompt`/`messages` sont **rejetés par défaut**.
- **Peer** : `zod "^3.25.76 || ^4.1.8"` ✅ · **engines** : `node >=22`
- Source : https://registry.npmjs.org/ai · https://ai-sdk.dev/docs/migration-guides/migration-guide-7-0

#### `@openrouter/ai-sdk-provider`
- **Dernière stable** : 3.0.0 (06/07/2026) · **Retenue : `^3.0.0`**
- **Couplage majeur strict** — c'est ce paquet qui décide de la version de `ai` :

  | Provider | `peerDependencies.ai` |
  |---|---|
  | 2.9.1 / 2.10.0 | `^6.0.0` |
  | **3.0.0** | **`^7.0.0`** |

  Il n'y a **pas** de version du provider qui accepte les deux. Le choix `ai` v6 ou v7 est donc
  indivisible du choix du provider. Nous prenons le couple **v7 + 3.0.0**.
- **Risque à surveiller** : 3.0.0 est la **seule** publication de la ligne 3 et n'a reçu aucun
  correctif depuis le 06/07/2026, alors que `ai` a publié une centaine de patches sur la même
  période. Un décalage d'API amont est plausible. Prévoir une couche d'abstraction mince autour des
  appels au provider pour pouvoir en changer sans toucher au métier.

#### `zod`
- **Dernière stable** : 4.6.5 (13/09/2026) · **Retenue : `^4.6.5`**
- Zod 4 est requis *de fait* : `better-auth@1.6.33` dépend de `zod ^4.5.4` et
  `@tanstack/router-plugin` de `zod ^4.5.4`. Installer Zod 3 en parallèle créerait deux copies et
  des types incompatibles aux frontières.
- **Ruptures v3 → v4 qui touchent la validation de formulaires** :
  - **API d'erreurs unifiée** : `message` déprécié au profit de **`error`** (chaîne ou fonction).
    `invalid_type_error`, `required_error` et `errorMap` sont **supprimés** (fusionnés dans `error`).
  - **Validateurs de chaîne déplacés au niveau racine** : `z.email()`, `z.uuid()`, `z.url()` au lieu
    de `z.string().email()` (formes méthode dépréciées mais fonctionnelles). `z.uuid()` est
    désormais strict RFC 9562/4122. `z.string().ip()` scindé en `z.ipv4()` / `z.ipv6()`.
  - **`.default()` s'applique désormais à l'intérieur d'un `.optional()`** :
    `z.string().default("tuna").optional()` renvoie `{ a: "tuna" }` et non `{}`. Changement de
    comportement silencieux sur les valeurs par défaut de formulaires — à vérifier en test.
  - `.default()` attend une valeur du type **de sortie**, plus du type d'entrée.
- Source : https://zod.dev/v4/changelog

### Produit et observabilité

| Paquet | Dernière stable | Retenue | Note |
|---|---|---|---|
| `posthog-js` | 1.433.9 (17/09/2026) | `^1.433.0` | Cadence quotidienne ; caret suffisant, surface de rupture faible. Ne pas figer sur une publication du jour. |
| `resend` | 6.28.1 (15/09/2026) | `^6.28.1` | Sert aussi à l'**envoi des codes OTP** de Better Auth : c'est une dépendance du chemin d'authentification, pas un simple outil marketing. |
| `motion` | 13.4.0 (16/09/2026) | `^13.2.0` | filon est en 12.x. La 13 est un majeur récent (02/09/2026). Plancher 13.2.0 plutôt que 13.4.0 (publiée l'avant-veille). Peer React `^18||^19` ✅ |
| `gsap` | 3.15.0 (13/04/2026) | `^3.15.0` | Stable et mature. **Vérifier la licence** avant usage de plugins non-« club ». |
| `@dnd-kit/core` | 6.3.1 (**05/12/2024**) | `^6.3.1` | **~21 mois sans publication.** Aucune peer React déclarée. Fonctionne (filon l'utilise), mais c'est la dépendance la plus figée du lot — à réévaluer si un problème React 19 apparaît. Ajouter `@dnd-kit/sortable ^10` et `@dnd-kit/utilities ^3.2.2`. |

### Tests

| Paquet | Dernière stable | Retenue | Contrainte |
|---|---|---|---|
| `vitest` | 5.0.1 (15/09/2026) | `^5.0.1` | Peer `vite "^6.4.0 \|\| ^7.0.0 \|\| ^8.0.0"` ✅ avec Vite 7.3.6. **engines : `node ^22.12 \|\| ^24 \|\| >=26`** |
| `@vitest/coverage-v8` | 5.0.1 | **`5.0.1` exacte** | Peer déclarée en version **exacte** `5.0.1` : tout écart avec `vitest` échoue |
| `@playwright/test` | 1.63.0 (04/09/2026) | `^1.63.0` | engines `node >=20`. Les navigateurs se téléchargent séparément (`playwright install`) — à prévoir en CI |
| `@axe-core/playwright` | 4.13.0 (11/08/2026) | `^4.13.0` | Peer `playwright-core >= 1.0.0` ✅ (fourni transitivement) |

### Node

- **Retenue : `>=22.12.0`**, développement sur **Node 22 LTS** (`.nvmrc`).
- C'est un **maximum de planchers**, pas un choix arbitraire :
  `@tanstack/react-start` → `>=22.12.0` · `vitest@5` → `^22.12 || ^24 || >=26` · `ai@7` → `>=22` ·
  `@vitejs/plugin-react` → `^20.19 || >=22.12` · `@playwright/test` → `>=20`.
  Le plancher contraignant est donc **22.12.0**.
- filon déclare `>=22.17.0`. Nous alignons sur `>=22.17.0` pour bénéficier des correctifs de la
  ligne 22 tout en restant sur le LTS que Vercel propose.

## Tableau de synthèse

| Paquet | Dernière stable (date) | Version retenue | Raison | Risque | Source |
|---|---|---|---|---|---|
| `@tanstack/react-start` | 1.168.56 (16/09/26) | `1.168.56` épinglée | Doit bouger avec router + plugin | Annoncé « v1 RC », pas 1.0 final | [npm](https://registry.npmjs.org/@tanstack/react-start) |
| `@tanstack/react-router` | 1.170.38 (16/09/26) | `1.170.38` épinglée | Dépendance exacte de react-start | Deux copies si caret | [npm](https://registry.npmjs.org/@tanstack/react-router) |
| `@tanstack/router-plugin` | 1.168.40 (16/09/26) | `1.168.40` épinglée | Peer `react-router ^1.170.38` | Couple verrouillé amont | [npm](https://registry.npmjs.org/@tanstack/router-plugin) |
| `nitro` | 3.0.260903-beta (03/09/26) | `3.0.260903-beta` épinglée | Seule voie Vercel documentée | **Beta en prod** | [doc](https://tanstack.com/start/latest/docs/framework/react/guide/hosting) |
| `react` / `react-dom` | 19.3.0 (09/09/26) | `19.2.7` épinglées | Combinaison éprouvée (filon) | 19.3.0 trop fraîche (8 j) | [npm](https://registry.npmjs.org/react) |
| `@types/react(-dom)` | 19.3.0 (09/09/26) | `~19.2.17` | Aligner types et runtime | Types en avance = faux positifs | [npm](https://registry.npmjs.org/@types/react) |
| `vite` | **8.3.0** (10/09/26) | **`7.3.6`** épinglée | Écosystème plugins à mi-migration | Vite 8 non éprouvé avec Start | [npm](https://registry.npmjs.org/vite) |
| `@vitejs/plugin-react` | 6.1.1 (28/08/26) | **`5.2.0`** | Seule version acceptant `^7 \|\| ^8` | 6.x forcerait Vite 8 | [npm](https://registry.npmjs.org/@vitejs/plugin-react) |
| `typescript` | **7.0.2** (08/07/26) | **`~5.9.3`** | Compat tsgo/Router non résolue | Ticket #7328 **ouvert** | [issue](https://github.com/TanStack/router/issues/7328) |
| `tailwindcss` | 4.3.3 (16/07/26) | `4.3.3` | Doit égaler @tailwindcss/vite | Deux Tailwind si divergence | [npm](https://registry.npmjs.org/tailwindcss) |
| `@tailwindcss/vite` | 4.3.3 (16/07/26) | `4.3.3` | Dépend de tailwindcss **exact** | idem | [npm](https://registry.npmjs.org/@tailwindcss/vite) |
| `shadcn` (CLI) | 4.21.0 (04/09/26) | `dlx shadcn@4.21.0` | Copie du code, pas une dépendance | Générations divergentes entre devs | [doc](https://ui.shadcn.com/docs/tailwind-v4) |
| `radix-ui` | 1.6.7 (24/07/26) | `^1.6.7` | Paquet unifié, React 19 ✅ | Faible | [npm](https://registry.npmjs.org/radix-ui) |
| `lucide-react` | 1.47.0 (17/09/26) | `^1.46.0` | Surface de rupture minime | Publication du jour évitée | [npm](https://registry.npmjs.org/lucide-react) |
| `convex` | 1.46.0 (16/09/26) | `^1.46.0` | Satisfait tous les composants | Plancher 1.43 (rate-limiter) | [limites](https://docs.convex.dev/production/state/limits) |
| `@convex-dev/better-auth` | 0.12.5 (27/06/26) | `0.12.5` épinglée | Dicte la version de better-auth | **3 mois de retard sur BA** | [doc](https://labs.convex.dev/better-auth/framework-guides/tanstack-start) |
| `better-auth` | **1.7.5** (14/09/26) | **`~1.6.33`** | Peer `>=1.6.11 <1.7.0` | **`^` casserait l'auth** | [npm](https://registry.npmjs.org/better-auth) |
| `@convex-dev/rate-limiter` | 0.4.0 (14/09/26) | `^0.4.0` | Peer `convex ^1.43.0` | 0.x, publiée il y a 3 j | [npm](https://registry.npmjs.org/@convex-dev/rate-limiter) |
| `@convex-dev/react-query` | 0.1.0 (**20/11/25**) | `^0.1.0` | Seule couche d'adaptation | **10 mois sans publication** | [npm](https://registry.npmjs.org/@convex-dev/react-query) |
| `@tanstack/react-query` | 5.103.1 (16/09/26) | `^5.103.1` | Peer React `^18 \|\| ^19` ✅ | Faible | [npm](https://registry.npmjs.org/@tanstack/react-query) |
| `ai` | 7.0.105 (16/09/26) | `^7.0.105` | Greenfield : pas de dette v6 | Doc v6 en ligne trompeuse | [migration](https://ai-sdk.dev/docs/migration-guides/migration-guide-7-0) |
| `@openrouter/ai-sdk-provider` | 3.0.0 (06/07/26) | `^3.0.0` | Seule version pour `ai ^7` | **Aucun patch depuis 2 mois** | [npm](https://registry.npmjs.org/@openrouter/ai-sdk-provider) |
| `zod` | 4.6.5 (13/09/26) | `^4.6.5` | Imposé par better-auth + router | API d'erreurs v3 supprimée | [changelog](https://zod.dev/v4/changelog) |
| `motion` | 13.4.0 (16/09/26) | `^13.2.0` | React 19 ✅ | Majeur récent (02/09/26) | [npm](https://registry.npmjs.org/motion) |
| `gsap` | 3.15.0 (13/04/26) | `^3.15.0` | Mature | **Licence à vérifier** | [npm](https://registry.npmjs.org/gsap) |
| `@dnd-kit/core` | 6.3.1 (**05/12/24**) | `^6.3.1` | Fonctionne en prod (filon) | **21 mois sans publication** | [npm](https://registry.npmjs.org/@dnd-kit/core) |
| `posthog-js` | 1.433.9 (17/09/26) | `^1.433.0` | Faible surface de rupture | Publication du jour évitée | [npm](https://registry.npmjs.org/posthog-js) |
| `resend` | 6.28.1 (15/09/26) | `^6.28.1` | Chemin critique OTP | Panne = plus de connexion OTP | [npm](https://registry.npmjs.org/resend) |
| `vitest` | 5.0.1 (15/09/26) | `^5.0.1` | Peer vite `^6.4 \|\| ^7 \|\| ^8` ✅ | Majeur récent (03/09/26) | [npm](https://registry.npmjs.org/vitest) |
| `@vitest/coverage-v8` | 5.0.1 (15/09/26) | `5.0.1` exacte | Peer en version exacte | Échec si écart | [npm](https://registry.npmjs.org/vitest) |
| `@playwright/test` | 1.63.0 (04/09/26) | `^1.63.0` | engines `node >=20` | Navigateurs à installer en CI | [npm](https://registry.npmjs.org/@playwright/test) |
| `@axe-core/playwright` | 4.13.0 (11/08/26) | `^4.13.0` | Peer playwright-core ✅ | Faible | [npm](https://registry.npmjs.org/@axe-core/playwright) |
| `node` | 24 LTS dispo | **`>=22.17.0`** | Max des planchers = 22.12 | Vercel doit être aligné | (engines agrégées) |

## Combinaison recommandée

```jsonc
{
  "name": "restaurant-management",
  "private": true,
  "type": "module",
  "engines": { "node": ">=22.17.0" },
  "packageManager": "pnpm@10.11.1",
  "dependencies": {
    // --- Framework : les 3 bougent ENSEMBLE, versions exactes ---
    "@tanstack/react-start": "1.168.56",
    "@tanstack/react-router": "1.170.38",
    "react": "19.2.7",
    "react-dom": "19.2.7",

    // --- Backend temps réel ---
    "convex": "^1.46.0",
    "@convex-dev/react-query": "^0.1.0",
    "@convex-dev/rate-limiter": "^0.4.0",
    "@tanstack/react-query": "^5.103.1",

    // --- Auth : l'exactitude ici n'est PAS négociable ---
    "@convex-dev/better-auth": "0.12.5",
    "better-auth": "~1.6.33",   // ~ et non ^ : la peer exige <1.7.0

    // --- UI ---
    "radix-ui": "^1.6.7",
    "lucide-react": "^1.46.0",
    "class-variance-authority": "^0.7.1",
    "clsx": "^2.1.1",
    "tailwind-merge": "^3.6.0",
    "motion": "^13.2.0",
    "gsap": "^3.15.0",
    "@dnd-kit/core": "^6.3.1",
    "@dnd-kit/sortable": "^10.0.0",
    "@dnd-kit/utilities": "^3.2.2",

    // --- IA : couple indivisible (provider 3.x <-> ai 7.x) ---
    "ai": "^7.0.105",
    "@openrouter/ai-sdk-provider": "^3.0.0",

    // --- Divers ---
    "zod": "^4.6.5",
    "posthog-js": "^1.433.0",
    "resend": "^6.28.1"
  },
  "devDependencies": {
    "@tanstack/router-plugin": "1.168.40",
    "vite": "7.3.6",
    "@vitejs/plugin-react": "5.2.0",
    "nitro": "3.0.260903-beta",
    "typescript": "~5.9.3",
    "tailwindcss": "4.3.3",
    "@tailwindcss/vite": "4.3.3",
    "@types/react": "~19.2.17",
    "@types/react-dom": "~19.2.17",
    "@types/node": "^22.10.7",
    "vite-tsconfig-paths": "^5.1.4",
    "vitest": "^5.0.1",
    "@vitest/coverage-v8": "5.0.1",
    "jsdom": "^27.0.0",
    "@playwright/test": "^1.63.0",
    "@axe-core/playwright": "^4.13.0"
  },
  "scripts": {
    "dev": "vite dev --port 3000",
    "build": "vite build",
    "start": "node .output/server/index.mjs",
    "typecheck": "tsc --noEmit",
    "test": "vitest run",
    "test:e2e": "playwright test"
  }
}
```

> `jsdom ^27.0.0` n'a pas été vérifié au registre dans cette passe — à confirmer au moment de
> l'installation (voir « Ce qui n'a pas pu être vérifié »). Alternative : `happy-dom`.

### Versions épinglées (sans `^` ni `~`) et pourquoi

| Épinglé | Raison précise |
|---|---|
| `@tanstack/react-start`, `@tanstack/react-router`, `@tanstack/router-plugin` | `react-start` dépend du routeur en version **exacte** ; `router-plugin` déclare une peer exacte sur le routeur. Un caret désynchronisé installe deux routeurs → perte du contexte React, panne à l'exécution seulement. |
| `react`, `react-dom` | Alignés sur la combinaison éprouvée par filon. Les mineurs de React touchent l'hydratation SSR, là où Start + nitro sont les plus jeunes. |
| `@convex-dev/better-auth` | Paquet en `0.x` : par sémantique, un mineur **peut** rompre. Et c'est lui qui impose la fenêtre `better-auth`. |
| `better-auth` → `~1.6.33` | **Le seul endroit où un `^` mal placé casse l'authentification en production.** `^1.6.33` autoriserait 1.7.5, hors de la peer `<1.7.0`. |
| `vite`, `@vitejs/plugin-react` | Le caret sur `vite` finirait par franchir le pas vers la 8 sans que le plugin suive. Verrouiller le couple. |
| `nitro` | Beta dans le chemin de build de production. |
| `tailwindcss` + `@tailwindcss/vite` | `@tailwindcss/vite` dépend de `tailwindcss` en version **exacte**. |
| `@vitest/coverage-v8` | Peer déclarée en version exacte par `vitest`. |
| `typescript` → `~5.9.3` | Le `~` interdit le saut vers 6 et 7, où la compatibilité TanStack n'est pas établie. |

## Décisions ouvertes — à trancher par un humain

### 1. Gestion des formulaires (à trancher avant la première page de saisie)

Constat de départ : **shadcn/ui ne dépend plus d'une bibliothèque unique.** Sa documentation propose
désormais React Hook Form, TanStack Form et Formisch en intégrations de premier rang (avec
`useActionState` annoncé). L'argument historique « shadcn impose react-hook-form » **ne tient plus**.
La décision est donc réellement ouverte.

| | `react-hook-form` 7.88.0 (11/09/26) | `@tanstack/form` 1.33.5 (11/08/26) | `@conform-to/react` 1.21.1 (18/08/26) |
|---|---|---|---|
| Maturité | La plus élevée ; écosystème le plus large | v1 stable, mais **`2.0.0-alpha.2` déjà publiée** | Mature, plus confidentiel |
| Cohérence avec la pile | Externe à TanStack | **Même famille** que Router/Query/Start | Externe |
| Zod | Via `@hookform/resolvers` (peer `zod ^3.25 \|\| ^4`) ✅ | Standard Schema natif ✅ | Standard Schema ✅ |
| Risque à 12 mois | `8.0.0-beta.3` existe aussi → majeur à venir | **Majeur v2 en approche** : adopter v1 aujourd'hui, c'est une migration programmée | Faible |
| Type-safety | Bonne | Excellente (inférence de bout en bout) | Bonne, orientée progressive enhancement |

**Recommandation : `react-hook-form@^7.88.0` + `@hookform/resolvers@^5.9.1`**, pour une raison et une
seule : les deux candidats ont un majeur en préparation, mais RHF a le plus grand volume de code
existant, d'exemples et de réponses en ligne, ce qui réduit le coût du moindre cas tordu sur un
produit métier riche en formulaires (commandes, menus, réservations). TanStack Form serait le choix
le plus élégant pour la cohérence de pile — **à retenir si l'équipe accepte d'assumer la migration
v1 → v2**. Ce n'est pas un arbitrage technique tranchable seul : il dépend de l'appétit de l'équipe.

### 2. `ai` v7 vs v6 — confirmer l'écart avec le cahier des charges
Le brief dit « v6 » ; la v7 est `latest` et la v6 reste disponible sous le tag `ai-v6`. La
recommandation ci-dessus (v7) suppose qu'il n'existe **aucun** code IA à reprendre d'un projet
antérieur. **À confirmer.** Si du code v6 doit être repris, basculer le couple en
`ai@^6.0.285` + `@openrouter/ai-sdk-provider@^2.10.0` — les deux ensemble, jamais l'un sans l'autre.

### 3. Multi-tenant : quel mécanisme d'organisations ?
Le plugin `organization` de Better Auth **ne figure pas** dans la liste des plugins supportés par le
composant Convex. Trois voies :
- **(a)** Modéliser les tenants soi-même dans les tables Convex (le plus simple, contrôle total,
  mais tout est à écrire : invitations, rôles, changement d'organisation) ;
- **(b)** Passer par le **« local install »** du composant, qui donne la main sur le schéma Better
  Auth et « rend possible l'usage de plugins au-delà de ceux supportés » — donc a priori
  `organization`. Coût : génération de schéma via la CLI Better Auth, régénération manuelle à chaque
  changement d'options, structure de composant séparée à maintenir ;
- **(c)** Attendre une prise en charge officielle — risqué vu les 3 mois d'inactivité du composant.

**Ce choix conditionne le modèle de données entier et doit être tranché avant la première
migration.** Non tranché ici volontairement : il relève du produit, pas de la compatibilité.

### 4. Vite 7 → Vite 8 : quand ?
La recommandation retient Vite 7 avec `@vitejs/plugin-react@5.2.0`, précisément parce que cette
version accepte déjà Vite 8. Point de réévaluation : quand TanStack Start documentera Vite 8, ou
quand `nitro` sortira de beta. La migration coûtera alors **deux lignes**.

### 5. TypeScript 7 : gain réel, mais pas maintenant
8× à 12× plus rapide en build complet — sur un monorepo SaaS c'est significatif. Réévaluer à la
clôture de TanStack/router#7328. Prévoir alors le passage par TS 6 (dépréciations) plutôt qu'un saut
direct 5 → 7.

### 6. Licence GSAP
À vérifier avant d'utiliser un plugin hors noyau : certains relèvent d'une licence commerciale.
Question juridique, pas technique.

## Procédure d'ajout ou de montée de version

À appliquer **à chaque fois**, y compris pour un correctif qui « ne peut rien casser ».

1. **Relever le fait, ne pas se souvenir.** `npm view <pkg> versions --json` ou
   `curl -s https://registry.npmjs.org/<pkg> | jq '{latest:."dist-tags".latest, date:.time[."dist-tags".latest]}'`.
   La mémoire d'un modèle et les articles de blog sont périmés ; le registre ne l'est pas.
2. **Lire les `peerDependencies` de la version visée**, pas celles de l'actuelle :
   `curl -s https://registry.npmjs.org/<pkg> | jq '.versions["<version>"].peerDependencies'`.
   Vérifier en particulier les bornes **hautes fermées** (`<1.7.0`) : ce sont elles qui piègent.
3. **Consulter la documentation officielle du paquet** (pas un tutoriel) pour la commande
   d'installation recommandée. C'est ainsi qu'on trouve des consignes comme `better-auth@~1.6.15`,
   invisibles dans les seules métadonnées npm.
4. **Lire le changelog / les notes de version** entre la version actuelle et la cible, en cherchant
   explicitement « breaking », « removed », « renamed », et le **plancher Node**.
5. **Installer isolément** (`pnpm add <pkg>@<version>`), sur une branche dédiée, puis vérifier dans
   cet ordre : `pnpm install` sans avertissement de peer non résolue → `pnpm typecheck` →
   `pnpm build` → `pnpm test` → `pnpm test:e2e`. **Une erreur de peer n'est jamais à ignorer**, même
   si l'application démarre : elle se manifestera à l'exécution, en production.
6. **Consigner la décision** dans ce fichier (ligne du tableau de synthèse + date), et si le choix
   est structurant, ouvrir une ADR dans `docs/adr/`. Une montée de version non écrite sera défaite
   par la personne suivante.

**Règle transverse** : ne jamais monter deux paquets couplés séparément. Les blocs indivisibles de
cette pile sont : `{react-start, react-router, router-plugin}`, `{tailwindcss, @tailwindcss/vite}`,
`{vite, @vitejs/plugin-react}`, `{ai, @openrouter/ai-sdk-provider}`,
`{@convex-dev/better-auth, better-auth}`, `{vitest, @vitest/coverage-v8}`.

## Ce qui n'a pas pu être vérifié

Signalé pour que personne ne prenne ces points pour acquis.

- **`jsdom@^27.0.0`** : version citée de mémoire, non relevée au registre. À confirmer (ou remplacer
  par `happy-dom`) au moment de l'installation.
- **Versions non interrogées au registre** : `class-variance-authority`, `clsx`, `tailwind-merge`,
  `vite-tsconfig-paths`, `@dnd-kit/sortable`, `@dnd-kit/utilities`. Reprises telles quelles de
  `filon` (donc éprouvées ensemble), mais leur « dernière stable » n'a pas été vérifiée.
- **Aucune installation, donc aucune résolution réelle de l'arbre de dépendances.** Les conflits de
  peers transitifs (deux versions de `zod`, de `@radix-ui/react-primitive`, etc.) ne se révèlent
  qu'au `pnpm install`. Ce document élimine les conflits **déclarés**, pas les conflits résolus.
- **Aucun build, typecheck ni test exécuté.** Les affirmations de compatibilité reposent sur les
  métadonnées publiées et la documentation, pas sur une exécution.
- **Statut « v1 » exact de TanStack Start** : la communication publique parle d'une « Release
  Candidate » de 1.0, alors que npm publie 1.168.56 sous le tag `latest`. Cette contradiction n'a pas
  pu être levée ; traiter le framework comme quasi-stable.
- **Compatibilité `@openrouter/ai-sdk-provider@3.0.0` avec `ai@7.0.105`** : la peer (`ai ^7.0.0`) est
  satisfaite, mais le provider n'a reçu aucun correctif depuis juillet tandis que `ai` a publié une
  centaine de patches. Aucun test d'intégration réel n'a été possible.
- **Plugin `organization` de Better Auth via le « local install »** : la documentation indique que
  local install « rend possible l'usage de plugins au-delà de ceux supportés ». L'inférence que cela
  couvre `organization` est **raisonnable mais non confirmée explicitement** par la documentation.
  À valider par un prototype avant d'y engager le modèle de données.
- **Comportement de `pnpm` face à la peer `better-auth`** : selon la configuration
  (`strict-peer-dependencies`), pnpm peut avertir sans bloquer. Recommandation : activer
  `strict-peer-dependencies=true` dans `.npmrc` pour que ce garde-fou soit une erreur, pas un
  avertissement qu'on finit par ne plus lire.

---

*Relevé effectué le 17/09/2026 contre `registry.npmjs.org` et les documentations officielles citées.
Référence de combinaison éprouvée : `/home/user/filon/package.json` (lu en seule lecture).
Aucun paquet n'a été installé.*
