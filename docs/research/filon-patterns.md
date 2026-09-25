<!-- Source : inspection du dépôt /home/user/filon en lecture seule, 2026-09-17.
     Filon n'a été ni modifié ni copié — seuls ses patterns d'ingénierie sont repris (D-013). -->

# Patterns techniques réutilisables du dépôt `filon`

> Rapport d'inspection en lecture seule de `/home/user/filon`, pour le produit
> SaaS multi-tenant **Restaurant OS** (organisation → venue).
> Chaque affirmation cite `fichier:ligne`. Rien d'affirmé qui n'ait été ouvert.
>
> **Avertissement central** : filon se décrit comme « multi-tenant strict »
> (`convex/schema.ts:7`) alors qu'il est **mono-produit, mono-tenant, scopé par
> utilisateur**. `convex/lib/withOrg.ts:11-13` le dit noir sur blanc :
> « aucune table métier ne porte d'`organizationId` ». Tout ce qui touche au
> scoping doit donc être repensé, pas copié.

---

## 1. Organisation générale

### Arbre `src/` (profondeur 2)

```
src/
├── components/      # 30 dossiers par domaine métier + ui/
│   ├── admin/ ai-elements/ analytics/ app/ billing/ closing/ companies/
│   ├── copilot/{brief,widgets}/ dashboard/ data-table/ docs/ documents/
│   ├── growth/ i18n/ mailpulse/ marketing/ needs/ onboarding/
│   ├── opportunities/{detail,views}/ org/ pipeline/
│   ├── proposals/{detail,views}/ recovery/ relances/ relationships/
│   ├── settings/ shared/ today/ ui/ veille/
├── hooks/           # use-media-query.ts, use-mobile.ts
├── lib/             # analytics/ auth/ billing/ export/ proposals/ + utils.ts
├── routes/          # file-based TanStack (api/, app/)
├── styles/          # app.css (seul fichier)
├── router.tsx  routeTree.gen.ts  react-global.ts  vite-env.d.ts
```

### Arbre `convex/` (profondeur 2)

```
convex/
├── _generated/         # committé et vérifié en CI
├── agent/              # copilote IA : agent.ts, models.ts, instructions.ts,
│   └── tools/          #   gating.ts, permissions.ts, *Reads.ts + 11 outils
├── conversion/radar.ts
├── copilot/brief.ts
├── domain/             # actions, closing, deals, growth, needs, ownership,
│   └── billing/        #   relationships
├── lib/                # 23 helpers partagés (withUser, withOrg, plan, credits…)
├── veille/             # 7 fichiers (actions, ai, connectors, parser, urlGuard…)
└── ~70 modules racine   # un fichier = un domaine (opportunities.ts, proposals.ts…)
```

### Conventions de nommage

| Élément | Convention | Preuve |
|---|---|---|
| Fichiers convex | `camelCase.ts`, 1 fichier = 1 domaine | `convex/opportunities.ts`, `convex/proposalRecipients.ts` |
| Composants React | `kebab-case.tsx` | `src/components/app/quick-capture.tsx` |
| Routes | **URLs en français** | `src/routes/app/opportunites.tsx`, `connexion.tsx`, `mot-de-passe-oublie.tsx` |
| Index Convex | `by_<scope>_<champ>[_<champ>]` | `convex/schema.ts:407` `by_user_stage_order` |
| Événements analytics | `snake_case`, `objet_action` | `src/lib/analytics/events.ts:7` |
| Alias TS | `~/*` → `./src/*` | `tsconfig.json:15-17` |

Le code convex est **massivement commenté en français**, avec des commentaires
qui expliquent le *pourquoi* et posent des invariants (ex. `convex/schema.ts:60-62`
« Nom STABLE (lu par admin.userDetail) : ne pas renommer »).

**Verdict pour Restaurant OS** : *à reprendre tel quel* — le découpage
« 1 fichier convex = 1 domaine », la colocation `components/<domaine>/`, l'alias
`~/`, et surtout la culture du commentaire-invariant. URLs en français : à
décider selon le marché, mais le principe (URLs dans la langue produit) tient.

---

## 2. TanStack Start

### Organisation des routes

`src/routes/` en file-based, **sans route group `(…)`** — le découpage se fait par
dossier réel :

| Chemin | Rôle |
|---|---|
| `src/routes/__root.tsx` | racine : fonts, head/SEO/JSON-LD, providers globaux |
| `src/routes/index.tsx`, `connexion.tsx`, `inscription.tsx`, `conditions.tsx`, `confidentialite.tsx`, `mentions-legales.tsx`, `mot-de-passe-oublie.tsx`, `reinitialiser-mot-de-passe.tsx` | pages publiques |
| `src/routes/app/route.tsx` | **layout** de l'app protégée |
| `src/routes/app/*.tsx` (21 fichiers) | pages applicatives |
| `src/routes/api/*.$.tsx` | handlers serveur (auth, proxy PostHog, PDF) |
| `src/routes/docs.tsx`, `docs_.$slug.tsx` | docs fumadocs (`_` = segment non-imbriqué) |

Routes dynamiques par point : `src/routes/app/opportunites.$id.tsx`,
`src/routes/app/propositions.$id.apercu-pdf.tsx`.

### `createFileRoute`

- Layout : `src/routes/app/route.tsx:39-47` — `createFileRoute('/app')({ component, head })`
  avec `meta: [{ name: 'robots', content: 'noindex, nofollow' }]` sur toute l'app.
- Racine typée : `src/routes/__root.tsx:107-112` — `createRootRouteWithContext<RouterContext>()`
  où `RouterContext = { queryClient, convexQueryClient }`.
- Handler serveur : `src/routes/api/auth.$.tsx:6-13` — `createFileRoute('/api/auth/$')({ server: { handlers: { GET, POST } } })`.

### Loaders : **il n'y en a aucun**

Un seul `beforeLoad` dans tout `src/routes/` : `src/routes/app/pipeline.tsx:8-13`,
et c'est une simple redirection de compatibilité. Aucune route n'a de `loader`.
Toutes les données passent par `useQuery` de `convex/react` côté client
(`src/routes/app/index.tsx:3`), donc **réactivité temps réel, zéro donnée au SSR**.

### Auth au montage, pas au loader

`src/routes/app/route.tsx:49-52` : bloc commenté
« Logique d'authentification : NE PAS MODIFIER (SSR + Better Auth fragiles).
AppLayout -> ConvexProviders -> AuthGate -> AppShell ».
`route.tsx:70-88` : au SSR et au 1er rendu client on monte un `ConvexProvider`
nu, puis après `useEffect(() => setMounted(true))` on bascule sur
`ConvexBetterAuthProvider`. Motif : éviter « more than one copy of React » au SSR.
La garde de session est purement cliente (`route.tsx:90`, « redirige vers
/connexion si pas de session »).

### Router

`src/router.tsx:7-34` : `ConvexQueryClient` + `QueryClient` dont `queryKeyHashFn`
et `queryFn` viennent de Convex (`router.tsx:18-19`), `convexQueryClient.connect(queryClient)`
(`router.tsx:23`), puis `routerWithQueryClient` (`router.tsx:33`).
Options notables : `defaultPreload: 'intent'`, `defaultPreloadStaleTime: 0`
(`router.tsx:28-29`). `expectAuth: false` (`router.tsx:12`) — conséquence directe
du gate client.

### `vite.config.ts`

| Ligne | Ce qui est fait | Pourquoi (commentaire du fichier) |
|---|---|---|
| `vite.config.ts:14-16` | `resolve.dedupe: ['react','react-dom']` | évite « more than one copy of React » au SSR |
| `vite.config.ts:17-33` | `ssr.noExternal` de 14 libs (convex, better-auth, tanstack, radix-dialog, fumadocs, lucide) | sinon elles résolvent une 2e instance de React |
| `vite.config.ts:36-40` | `ssr.external: ['xlsx','puppeteer-core','@sparticuz/chromium']` | libs navigateur/binaires, jamais dans le graphe SSR |
| `vite.config.ts:50-55` | `paraglideVitePlugin` avant tailwind | i18n compile-time |
| `vite.config.ts:60` | `tanstackStart()` | **SSR au runtime, aucun prérendu statique** (données Convex temps réel) |
| `vite.config.ts:61-90` | `nitro({ preset: 'vercel' })` + `traceDeps` chromium + `routeRules` | en-têtes de sécurité sitewide |
| `vite.config.ts:78-89` | `X-Content-Type-Options`, `X-Frame-Options: SAMEORIGIN`, `Referrer-Policy`, `Permissions-Policy: camera=() microphone=() geolocation=()`, `HSTS 1 an` | headers HTTP sur `/**` |
| `vite.config.ts:94` | `viteReact()` **en dernier** | sinon le client entry échoue et l'app tourne en SSR seul |

### `vercel.json`

4 lignes utiles (`vercel.json:1-6`) : `framework: null`, `buildCommand` =
`convex deploy --cmd-url-env-var-name VITE_CONVEX_URL --cmd "pnpm build"`
(**Convex est déployé pendant le build Vercel et injecte son URL**),
`outputDirectory: .output/public`. Conséquence documentée dans
`src/routes/api/ph.$.tsx:4-6` : sous `framework: null`, les `rewrites` de
`vercel.json` sont ignorés → tout proxy doit passer par `server.handlers`.

**Verdict pour Restaurant OS** :
- Structure de routes + `createFileRoute` + `server.handlers` : *à reprendre tel quel*.
- `vite.config.ts` (dedupe, noExternal, headers Nitro, ordre des plugins) : *à reprendre tel quel* — c'est de la connaissance chèrement acquise.
- `vercel.json` : *à reprendre tel quel*.
- **Absence de loaders + gate d'auth client** : *à ne pas reprendre*. Pour un produit multi-tenant avec rôles (manager, serveur, cuisine), il faut résoudre l'organisation ET la venue **avant** le rendu (`beforeLoad` + `fetchAuthQuery`, déjà exporté par `src/lib/auth/auth-server.ts:16-22` mais jamais utilisé). Sinon : flash de contenu, pas de 403 serveur, et impossible de router `/:orgSlug/:venueSlug/...` proprement.

---

## 3. Convex

### `convex/schema.ts`

- **1682 lignes**, **65 tables**, **181 index** (`grep -c '\.index('`).
- Style : `defineSchema({ table: defineTable({ champs }).index(...).index(...) })`,
  un seul export default (`convex/schema.ts:13`).
- Chaque table est précédée d'un pavé de commentaire expliquant son rôle et ses
  invariants (ex. `convex/schema.ts:983-984` pour `aiUsage`, `convex/schema.ts:1355-1361`
  pour `memberships`).
- Validators : `v.string()`, `v.number()`, `v.optional(...)`, `v.id('organizations')`
  (`schema.ts:1363`), `v.array(v.string())` (`schema.ts:1000`), et surtout
  **`v.union(v.literal(...))` pour tous les enums** (`schema.ts:41-52` pour les 9 plans,
  `schema.ts:1368-1373` pour les 4 rôles org).
- Les enums sont **re-déclarés côté domaine** comme constantes réutilisables :
  `convex/opportunities.ts:23-31` (`stageValidator`), `:33-38` (`typeValidator`),
  `:40-44` (`priorityValidator`), `:46-51` (`importSourceValidator`).
- Validator importé depuis un helper partagé : `convex/schema.ts:3`
  `import { assistantKindValidator } from './lib/assistant'`.

### 10 exemples réels d'index

| # | Table | Index | Ligne |
|---|---|---|---|
| 1 | `users` | `by_authId ['authId']` | `convex/schema.ts:170` |
| 2 | `users` | `by_planRenewsAt ['planRenewsAt']` (balayage cron) | `convex/schema.ts:183` |
| 3 | `opportunities` | `by_user_stage_order ['userId','stage','order']` (kanban ordonné) | `convex/schema.ts:407` |
| 4 | `opportunities` | `by_user_next_action ['userId','nextActionAt']` | `convex/schema.ts:410` |
| 5 | `followups` | `by_user_done_due ['userId','done','dueDate']` | `convex/schema.ts:459` |
| 6 | `documentLinks` | `by_entity ['entityType','entityId']` (polymorphe) | `convex/schema.ts:622` |
| 7 | `billingDocuments` | `by_scope_year_type ['scopeKey','year','documentType']` (numérotation) | `convex/schema.ts:689` |
| 8 | `aiUsage` | `by_created ['createdAt']` — **explicitement « lecture cross-tenant admin »** | `convex/schema.ts:1001-1002` |
| 9 | `memberships` | `by_org_user ['organizationId','userId']` | `convex/schema.ts:1396` |
| 10 | `memberships` | `by_org_email ['organizationId','email']` | `convex/schema.ts:1399` |

Lecture : **seules `organizations`, `memberships` et `organizationBillingProfiles`
(`schema.ts:665` `by_org`) ont un index par organisation.** Les 60+ autres tables
sont indexées `by_user*`.

### Séparation query / mutation / action / internal

| Type | Occurrences (hors `_generated`) |
|---|---|
| `query(` | 94 |
| `mutation(` | 122 |
| `action(` | 15 |
| `internalQuery(` | 29 |
| `internalMutation(` | 50 |
| `internalAction(` | 5 |

Règle observée : les `action` servent aux appels sortants (Paystack, OpenRouter,
veille) et délèguent toute écriture à des `internalMutation` via `ctx.runMutation`
(`convex/aiChat.ts:465-489` : `internal.aiChat.bumpThread`, `internal.aiChat.logEvent`,
`internal.memory.recordConversationMemory`). Les `internalQuery` servent aussi à
donner un accès DB aux actions (`convex/lib/withUser.ts:129-135` `userAuthState`).

### Helpers partagés `convex/lib/` (23 fichiers)

`adminAiMessages`, `aiChatRuntime`, `aiGate`, `assistant`, `copilotRouting`,
`credits`, `crypto`, `email`, `flagPriority`, `paystackPlans`, `plan`, `pricing`,
`rateLimiter`, `recoveryCaseHelpers`, `referral`, `teamMetrics`, `track`,
`withOrg`, `withUser`.

Principe fort : **modules purs sans import Convex** quand c'est possible, pour
être partagés client/serveur — `convex/lib/pricing.ts:1-8` « source unique, pure
(aucun import Convex). Importée à la fois par l'action Paystack et par le miroir
client `src/lib/billing/plan.ts` ». Idem `convex/lib/credits.ts:16-17`.

### HTTP & crons

- `convex/http.ts:11` : `authComponent.registerRoutes(http, createAuth, { cors: true })`.
- `convex/http.ts:23-27` : webhook Paystack signé HMAC-SHA512 sur `/paystack/webhook`.
- `convex/crons.ts:14-50` : `cronJobs()` avec `crons.interval`, 2× `crons.daily`, `crons.monthly`.
- `convex/convex.config.ts:6-11` : `defineApp()` + `app.use(betterAuth)`, `app.use(agent)`, `app.use(rateLimiter)`.

### Pagination : quasi inexistante

`paginationOptsValidator` n'apparaît **qu'une fois** (`convex/aiChat.ts:271`) et
**aucun `.paginate()`** n'existe ailleurs dans `convex/`. Tout le reste fait
`.collect()` (ex. `convex/lib/withOrg.ts:47`, `:122`, `convex/admin.ts:630`).

**Verdict pour Restaurant OS** :
- Style de schéma (commentaire-invariant par table, `v.union(v.literal)` pour tout enum, validators extraits en constantes réutilisables) : *à reprendre tel quel*.
- Convention de nommage d'index `by_<scope>_<a>_<b>` : *à reprendre tel quel*.
- **Le préfixe de scope** : *à adapter* — `by_venue_*` et `by_org_venue_*`. Une commande, un ticket, un stock, un shift sont scopés venue ; un menu ou un fournisseur peuvent l'être org. Le choix du préfixe est la décision d'architecture n°1.
- Séparation query/mutation/action/internal : *à reprendre tel quel*.
- `convex/lib/` avec modules purs partagés client/serveur : *à reprendre tel quel*.
- **Pagination** : *à ne pas reprendre* — filon `collect()` partout, ce qui tient parce qu'un freelance a 50 opportunités. Un restaurant fait des milliers de tickets/mois : `paginationOptsValidator` doit être le défaut, pas l'exception, sous peine d'exploser la limite de 16 MiB / 16384 docs par lecture Convex.

---

## 4. Sécurité Convex

### Vérification d'auth

Toute fonction métier commence par `requireUser` : `convex/opportunities.ts:20-21`
pose la règle (« chaque fonction commence par `requireUser` et scope via un index
`by_user*`. Aucune lecture/ecriture sans filtre `userId` »), et
`convex/lib/withUser.ts:43-53` en donne l'exemple canonique en docstring.

| Helper | Ligne | Comportement |
|---|---|---|
| `requireUser(ctx)` | `convex/lib/withUser.ts:55-71` | `safeGetAuthUser` → throw `authError` si absent → **lit `users.suspended` et throw `suspendedError()`** |
| `optionalUser(ctx)` | `convex/lib/withUser.ts:84-96` | ne throw JAMAIS, renvoie `null` (queries montées en permanence) |
| `requireUserFromAction(ctx)` | `convex/lib/withUser.ts:103-123` | variante action : garde de suspension via `internalQuery` (pas de `ctx.db`) |
| `currentPlan(ctx,userId)` | `convex/lib/withUser.ts:142-148` | palier effectif, absence = `free` |
| `isAdmin(ctx)` | `convex/lib/withUser.ts:201-209` | ne throw jamais ; `role === 'admin'` OU allowlist e-mail |
| `requireAdmin(ctx)` | `convex/lib/withUser.ts:217-232` | « le SEUL endroit autorisé à lire en cross-tenant » |
| `withUserQuery` / `withUserMutation` | `convex/lib/withUser.ts:249-267` | wrappers `Object.assign(ctx, user)` |

Détail notable : `convex/lib/withUser.ts:60-62` justifie le coût de la garde de
suspension (« Sans cette lecture, le flag est décoratif. Point read indexé
`by_authId` — négligeable »). Et `withUser.ts:163` : « ConvexError (pas Error
brute) : sinon le message est masqué en prod ».

### Scoping par organisation : **il n'existe pas au niveau des données**

`convex/lib/withOrg.ts:11-13` :
> « Modèle = surcouche visibilité : aucune table métier ne porte d'`organizationId`.
> La visibilité d'équipe se calcule en itérant les `userId` des membres ACTIFS
> (cf. `activeMemberUserIds`). Le pipeline mono-utilisateur reste intact. »

Concrètement :
- `getActiveMembership` (`withOrg.ts:37-49`) lit `memberships` via `by_org_user` puis filtre `status === 'active'` en mémoire.
- `activeMemberUserIds` (`withOrg.ts:130-140`) renvoie la liste des `userId`, et **les lectures d'équipe bouclent dessus** sur les index `by_user*`.
- Gardes de rôle : `requireOrgMember` (`withOrg.ts:56-72`), `requireOrgManager` (`withOrg.ts:78-87`, `MANAGER_ROLES = {admin, head_sell}` `withOrg.ts:19-22`), `requireOrgAdmin` (`withOrg.ts:93-102`).
- Consentement : `carnetSharingEnabled` (`withOrg.ts:148-150`) — « SOURCE DE VERITE UNIQUE … Seul `false` desactive le partage ».
- **Le meilleur morceau du dépôt** : `requireOrgManagerCanReadCarnet` (`withOrg.ts:156-184`) documente un ordre impératif anti-fuite cross-org en 5 points, dont le point 4 : « cible introuvable/inactive => THROW **avant** de lire le flag. Crucial : `targetUserId: v.string()` ne valide que le type ; sans ce throw, une cible d'une AUTRE org (membership null) passerait (`null?.x === false` est faux) ».

Il existe **une** exception scopée org côté données : `organizationBillingProfiles`
(`convex/schema.ts:646`, index `by_org` ligne 665).

### Rate limiting

`convex/lib/rateLimiter.ts:17-26` définit 4 limites, **toutes scopées par utilisateur**
(`rateLimiter.ts:15`), sur les surfaces « qui coûtent de l'argent (Paystack),
déclenchent un fetch sortant (veille) ou écrivent en masse (import) » :

| Limite | Config | Ligne |
|---|---|---|
| `veilleParse` | token bucket, 30/min, capacité 10 | `rateLimiter.ts:19` |
| `startCheckout` | fixed window, 20/h | `rateLimiter.ts:21` |
| `feedbackSubmit` | fixed window, 20/h | `rateLimiter.ts:23` |
| `contactsImport` | fixed window, 10/h | `rateLimiter.ts:25` |

Type union `RateLimitName` (`rateLimiter.ts:29-33`) pour l'autocomplétion, et
`enforceRateLimit` (`rateLimiter.ts:40-52`) qui throw un `validationError` avec le
délai en secondes — « jamais d'échec silencieux, le client affiche le motif ».

**Verdict pour Restaurant OS** :
- `requireUser` / `optionalUser` / `requireUserFromAction` / `requireAdmin` : *à reprendre tel quel* (renommer en `requireStaff`, etc.).
- Hiérarchie `requireOrgMember` → `requireOrgManager` → `requireOrgAdmin` : *à adapter* — il faut un niveau de plus : `requireVenueMember(ctx, venueId)` qui vérifie **org → venue → rôle**, et une notion de rôle *par venue* (un manager de la venue A n'est pas manager de la venue B). Le modèle de filon n'a qu'un rôle par org.
- **Scoping par `activeMemberUserIds` + boucle sur `by_user*`** : *à ne pas reprendre* — coût O(nombre de membres) par lecture, impossible à indexer, et rend toute agrégation venue-wide non scalable. Restaurant OS doit porter `venueId` (et probablement `organizationId`) **sur chaque document métier**, avec des index préfixés par ce scope. C'est la divergence structurelle n°1.
- L'**ordre impératif anti-fuite** de `withOrg.ts:156-184` : *à reprendre tel quel comme méthode* — le rédiger en tête de chaque garde multi-tenant.
- Rate limiter : *à adapter* — reprendre la mécanique, mais changer la clé (`key: userId` → `key: venueId` pour les ressources partagées comme l'impression de tickets ou l'envoi SMS ; garder `userId` pour l'authentification).

---

## 5. Better Auth

### Fichiers

| Fichier | Rôle |
|---|---|
| `convex/auth.ts` (184 l.) | serveur : client `@convex-dev/better-auth`, triggers, `createAuth` |
| `convex/auth.config.ts` (5 l.) | `providers: [getAuthConfigProvider()]` |
| `convex/http.ts:11` | `authComponent.registerRoutes(http, createAuth, { cors: true })` |
| `src/lib/auth/auth-client.ts` (23 l.) | `createAuthClient({ plugins: [convexClient()] })` |
| `src/lib/auth/auth-server.ts` (22 l.) | `convexBetterAuthReactStart({ convexUrl, convexSiteUrl })` |
| `src/routes/api/auth.$.tsx` | relai `/api/auth/*` |
| `src/routes/app/route.tsx:54-88` | providers + gate |

### Intégration

- `convex/convex.config.ts:7` : `app.use(betterAuth)`.
- `convex/auth.ts:59-62` : `createClient<DataModel>(components.betterAuth, { authFunctions, triggers })`.
- `convex/auth.ts:142` : `export const { onCreate, onUpdate, onDelete } = authComponent.triggersApi()`.
- `convex/auth.ts:144-182` : `createAuth(ctx)` = `betterAuth({ baseURL, database: authComponent.adapter(ctx), trustedOrigins, emailAndPassword, socialProviders, account, session, plugins: [convex({ authConfig })] })`.

### Providers activés

- **E-mail/mot de passe** (`convex/auth.ts:150-166`) : `autoSignIn: true`, `minPasswordLength: 8`, `requireEmailVerification: false`, et un `sendResetPassword` obligatoire (`auth.ts:161-165`) — « Sans ce handler, un utilisateur qui oublie son mot de passe perd définitivement son compte ».
- **Google et GitHub, conditionnels** (`convex/auth.ts:34-57`) : `buildSocialProviders()` n'active un provider que si **ses deux** variables d'env sont posées, « pour ne pas casser le déploiement tant que les secrets OAuth ne sont pas configurés ».
- `overrideUserInfoOnSignIn: true` (`auth.ts:41`, `:50`) avec le chemin exact dans `node_modules` documenté en commentaire (`auth.ts:24-31`).
- **Account linking** (`convex/auth.ts:171-176`) : e-mail vérifié identique → liaison auto, `trustedProviders: ['google','github']`.
- **Session** (`convex/auth.ts:177-180`) : `expiresIn` 30 jours, `updateAge` 24 h.

### Triggers → table métier

`convex/auth.ts:63-140` :
- `user.onCreate` (`auth.ts:66-113`) : idempotent (`auth.ts:67-71`), construit la ligne **sans clé `undefined`** (« regle Convex : ne jamais passer `undefined` en argument », `auth.ts:73-75`), insère dans `users`, émet `signup_completed` côté serveur (`auth.ts:97-100`), puis **relie les invitations d'équipe en attente** en posant `userId` sur les `memberships` trouvés via `by_email` (`auth.ts:105-112`) — le statut reste `pending`, l'acceptation reste explicite.
- `user.onUpdate` (`auth.ts:118-139`) : propage nom/photo, **sauf si `customImage`** (auth.ts:134-136) pour ne pas écraser une photo importée à la main.

### Client / serveur

- `src/lib/auth/auth-client.ts:4-7` : commentaire précieux — « baseURL same-origin par défaut (/api/auth), proxié vers Convex. **Pas de customFetchImpl manuel** (celui-ci renvoyait l'endpoint token Convex en cross-origin -> "Failed to fetch" au signup/autoSignIn) ».
- `src/lib/auth/auth-client.ts:15-23` exporte `signIn, signUp, signOut, useSession, linkSocial, listAccounts, unlinkAccount`.
- `src/lib/auth/auth-server.ts:3-12` : les URLs Convex sont lues via `import.meta.env` **puis** `process.env`, « car les `VITE_*` ne sont PAS dans `process.env` au runtime Nitro/Vercel ».
- `src/lib/auth/auth-server.ts:16-22` exporte `handler, getToken, fetchAuthQuery, fetchAuthMutation, fetchAuthAction` — **`fetchAuthQuery` n'est utilisé par aucune route**.

### Guards de route

Aucun guard serveur. `src/routes/app/route.tsx:90` : « Garde d'authentification :
redirige vers /connexion si pas de session » — exécutée côté client après montage.
Côté back-office, le guard est une query publique `admin.amIAdmin` qui ne throw
jamais (`convex/lib/withUser.ts:196-199`).

**Verdict pour Restaurant OS** :
- `createAuth` + `registerRoutes` + `auth.$.tsx` + `auth-client`/`auth-server` : *à reprendre tel quel* — c'est le pattern officiel, et les commentaires documentent les pièges déjà payés.
- `buildSocialProviders()` conditionnel : *à reprendre tel quel*.
- Trigger `user.onCreate` → ligne métier + **liaison des invitations en attente par e-mail** : *à reprendre et étendre* — c'est exactement le mécanisme d'onboarding d'un employé invité sur une venue.
- **Guard d'auth 100 % client** : *à ne pas reprendre* — voir §2. Ajouter `beforeLoad` + `fetchAuthQuery` pour résoudre org/venue/rôle avant rendu, et rediriger côté serveur.
- `requireEmailVerification: false` : *à adapter* — acceptable pour un freelance, discutable quand le compte donne accès à la caisse d'un restaurant.

---

## 6. Architecture IA

### Abstraction du provider

`convex/agent/models.ts` est le **seul** point de contact avec OpenRouter :
- `models.ts:19-22` : `MODELS: Record<AiMode, string> = { fast: 'openai/gpt-5.4-mini', quality: 'anthropic/claude-sonnet-4.6' }` — l'utilisateur ne voit jamais un nom de modèle, seulement « Rapide » / « Qualité » (`models.ts:12-14`).
- `models.ts:24-27` : `createOpenRouter({ apiKey: process.env.OPENROUTER_API_KEY!, extraBody: { usage: { include: true } } })` — la clé « vit UNIQUEMENT côté serveur, jamais committée » (`models.ts:8`).
- `models.ts:35-41` : 2e instance `openrouterPriority` avec `provider: { sort: 'throughput' }`, réservée au palier le plus cher.
- `models.ts:54-67` : `modelFor(mode, plan?, byokKey?)` renvoie un `LanguageModelV3`. **BYOK** : si `byokKey`, provider éphémère sur la clé du client, « La clé n'est jamais persistée ni journalisée — elle ne vit que le temps de l'appel » (`models.ts:48-52`). Chiffrement dans `convex/lib/crypto.ts`, surface dans `convex/byok.ts`.

### Agent

`convex/agent/agent.ts:13-19` : `new Agent(components.agent, { name, languageModel: modelFor('fast'), instructions: INSTRUCTIONS, tools, stopWhen: stepCountIs(5) })`.
Composant enregistré dans `convex/convex.config.ts:8`.

Outils : `convex/agent/tools/` — `carnet, followups, network, pipeline, proposals,
referral, team, veille` + `ctx.ts`, `shared.ts`, `manifest.ts`, `index.ts`.
Gating/permissions : `convex/agent/gating.ts`, `convex/agent/permissions.ts`,
`convex/agent/govWrites.ts` ; lectures spécialisées `orgReads.ts`, `networkReads.ts`,
`referralReads.ts`, `veilleReads.ts`.

L'exécution : `convex/aiChat.ts:444-456` — `thread.streamText({ prompt, system, model: modelFor(mode, gate.plan, byokKey), tools: toolsFor(gate.plan, orgRole, tools), stopWhen: stopWhenFor(gate.plan) }, { saveStreamDeltas: true })`. **Les outils disponibles dépendent du palier ET du rôle org** (`aiChat.ts:451-453`).

### Prompts

Un seul endroit : `convex/agent/instructions.ts:9-53`, une constante `INSTRUCTIONS`
en template string. Le prompt est remarquablement discipliné : langue imposée
(`instructions.ts:15-16`), **interdiction d'exposer les codes internes** au user
(`instructions.ts:18-20` : « ne dis jamais "job_offer", "spontaneous", … C'est TOI
qui traduis »), anti-boucle sur recherche vide (`instructions.ts:29`), obligation
d'appeler l'outil avant d'affirmer avoir agi (`instructions.ts:25`), outils
d'équipe conditionnels (`instructions.ts:50-52`).

### Traçage usage / coût

Oui, complet :
1. `extraBody.usage.include` demande la compta à OpenRouter (`models.ts:9-10`, `:26`).
2. `convex/aiChat.ts:459-464` : `usage.inputTokens`, `usage.outputTokens`, `toolCalls` → `creditsForUsage(input, output, mode)`.
3. `convex/lib/credits.ts:19-37` : coût = `MAX(1, poids_tokens, plancher_coût_réel)` où poids = ×1 (fast) / ×3 (quality) et plancher = `costUsd × FX_XOF_PER_USD × AI_MARKUP / CREDIT_XOF` — « on n'est JAMAIS sous l'eau » (`credits.ts:14`).
4. Persistance : table `aiCredits` (`convex/schema.ts:974-981` : `balance`, `monthlyAllowance`, `periodStart`, `packBalance`) et journal `aiUsage` (`convex/schema.ts:985-1003` : `model`, `mode`, `inputTokens`, `outputTokens`, `costUsd`, `creditsDebited`, `toolsUsed`), écrit par `convex/aiCredits.ts:118-119`.
5. Journal d'événements : `convex/aiChat.ts:466-489` (`internal.aiChat.logEvent`, type `message_completed`, métadonnées tokens/crédits/byok).
6. Pré-contrôle avant appel : `convex/lib/aiGate.ts:35` lit `aiUsage`.
7. Même comptabilité pour l'IA hors-chat : `convex/veille/ai.ts:114`, `:183`.

**Verdict pour Restaurant OS** :
- `modelFor(mode, plan, byokKey)` comme **unique** frontière provider : *à reprendre tel quel*. C'est ce qui permet de changer de modèle sans toucher au produit.
- Modes produit `fast`/`quality` au lieu de noms de modèles : *à reprendre tel quel*.
- `credits.ts` (MAX poids/plancher) + table `aiUsage` + `aiCredits` : *à reprendre tel quel* pour la mécanique, *à adapter* pour le scope — les crédits IA doivent être portés par l'**organisation** (ou la venue), pas par l'utilisateur : `by_org_created` plutôt que `by_user_created`.
- `INSTRUCTIONS` en constante unique : *à adapter* — un prompt monolithique de 53 lignes suffit pour un copilote ; Restaurant OS aura plusieurs assistants (commandes, stocks, planning) → un module `prompts/` avec une constante par assistant + un socle commun. La règle « ne jamais exposer les codes internes » (`instructions.ts:18-20`) est à reprendre mot pour mot.
- BYOK : *à ne pas reprendre au lancement* — complexité (chiffrement, validation, provider éphémère) sans valeur pour un restaurateur.

---

## 7. Design system

### `DESIGN.md` — la MÉTHODE (valeurs d'identité volontairement omises)

**Structure du fichier (275 lignes)** :
1. Front-matter YAML de tokens (`DESIGN.md:1-121`) : `name`, `description`, puis `colors:` (map plate de rôles sémantiques), `typography:` (objets `display`/`body`/… avec `fontFamily`, `fontSize`, `fontWeight`, `lineHeight`). **Machine-lisible** : parsé par `.claude/skills/impeccable/scripts/lib/design-parser.mjs`.
2. `## 1. Overview` (`DESIGN.md:124-140`) : une « Creative North Star » en une phrase, 5 « Key Characteristics », et une **règle nommée en gras** (`DESIGN.md:140`).
3. `## 2. Colors` (`DESIGN.md:142-175`) : principe « les teintes sémantiques transportent de l'information ; elles ne décorent jamais la structure » (`DESIGN.md:144`), 4 familles (Primary/Secondary/Tertiary/Neutral).
4. `## 3. Typography` (`DESIGN.md:177-199`) : 2 familles seulement (UI + mono), une **hiérarchie à 6 niveaux nommés** avec poids + taille + line-height fixes (`DESIGN.md:191-196`), chaque niveau décrit par son *usage* et non par sa taille. Longueur de ligne bornée à 65-75 caractères pour les paragraphes (`DESIGN.md:194`). Deux règles : « The Instrument Type Rule » (les valeurs mesurables en mono, les décisions en sans, `DESIGN.md:197`) et « The Product Scale Rule » (tailles **fixes** en app, échelles fluides réservées à la landing, `DESIGN.md:199`).
5. `## 4. Elevation` (`DESIGN.md:200-209`) : élévation « structurelle et presque plate », **exactement 2 ombres nommées** (« Carte basse », « Surface élevée », `DESIGN.md:206-207`), en sombre les bordures remplacent les ombres (`DESIGN.md:202`), et « The Flat-by-Default Rule » : bordure et ombre large ne coexistent pas (`DESIGN.md:209`).
6. `## 5. Components` (`DESIGN.md:211-252`) : pour chaque primitive (Buttons, Chips, Cards, Inputs, Navigation, Page Toolbar, Data Rows), une spec en puces `Shape / Background / Shadow Strategy / Border / Internal Padding` ou `Style / State / Focus / Error-Disabled`. Exigence transverse (`DESIGN.md:213`) : « Chaque primitive interactive couvre les états par défaut, survol, focus, actif, désactivé, chargement et erreur ». Rayons et hauteurs **chiffrés** (8/12 px de rayon, 44 px de hauteur d'action, 16/20 px de padding).
7. `## 6. Do's and Don'ts` (`DESIGN.md:253-275`) : 6 Do + 11 Don't, tous **vérifiables mécaniquement**.

**A11y** : cible tactile ≥ 44 px et WCAG 2.2 AA explicitement exigés (`DESIGN.md:259`) ; anneau de focus de 2 px avec offset au clavier (`DESIGN.md:219`) ; focus sans déplacement de layout (`DESIGN.md:238`) ; états chargement/vide/erreur/succès avec action de reprise (`DESIGN.md:261`) ; **« ne jamais transmettre une information importante uniquement par la couleur »** (`DESIGN.md:275`) ; « une icône ne remplace jamais le libellé essentiel » (`DESIGN.md:226`).

**Anti-patterns interdits** (`DESIGN.md:264-275`) : interface SaaS générique, accumulation de cartes sans hiérarchie, décoration gratuite, « composition immédiatement reconnaissable comme générée par IA », texte en dégradé, glassmorphism, orbes, bento décoratif, grille de fond, bordure latérale colorée épaisse, petits titres en capitales espacées répétés, police d'affichage dans les boutons/tableaux.

**Application dans le code** : les tokens du front-matter sont matérialisés en
CSS dans `src/styles/app.css:13` (`@theme { … }`), avec des variables **sémantiques**
(`--color-bg`, `--color-surface`, `--color-surface-2`, `--color-border`,
`--color-border-strong`, `--color-fg`, `--color-fg-muted`, `--color-fg-subtle`,
`app.css:32-39`), des rôles d'état (`--color-success/warning/danger/info` + variantes
`-soft`, `app.css:42-49`) et des **tokens métier** par étape de pipeline et par type
(`--color-stage-*`, `--color-type-*`, `app.css:52-69`). Les familles de police sont
des tokens (`--font-sans`, `--font-mono`, `app.css:16-17`).

### `components.json` (shadcn)

`components.json:1-21` : `style: "new-york"`, `rsc: false`, `tsx: true`,
`tailwind.config: ""` (**Tailwind v4, config CSS-first**), `tailwind.css: "src/styles/app.css"`,
`baseColor: "zinc"`, `cssVariables: true`, `prefix: ""`, alias `~/components`,
`~/lib/utils`, `~/components/ui`, `~/lib`, `~/hooks`, `iconLibrary: "lucide"`.

### `src/components/ui`

36 fichiers, `kebab-case.tsx`. Primitives shadcn standard (`button`, `card`,
`dialog`, `select`, `sidebar`, `table`, `tabs`, `tooltip`…) **plus des primitives
maison** dans le même dossier : `entity-combobox.tsx`, `tag-combobox.tsx`,
`value-combobox.tsx`, `progress-bar.tsx`, `button-group.tsx`, `input-group.tsx`,
`spinner.tsx`. Un baril `src/components/ui/index.ts` (24 ré-exports `export * from './x'`)
qui **ne couvre pas tout** (ni `entity-combobox`, ni `sheet`… — import direct pour le reste).

**Verdict pour Restaurant OS** :
- **Méthode** de `DESIGN.md` (front-matter machine-lisible → CSS `@theme` → règles nommées → spec par composant → Do/Don't vérifiables) : *à reprendre tel quel*. C'est le meilleur actif du dépôt.
- Tokens **sémantiques** plutôt que littéraux, + tokens métier par statut : *à reprendre tel quel* — pour Restaurant OS ce sera `--color-ticket-*` (reçu/en cuisine/prêt/servi/annulé), `--color-table-*` (libre/occupée/à nettoyer), `--color-stock-*`.
- Valeurs de couleur, polices, « North Star » de filon : *à ne pas reprendre* — identité visuelle propre, comme demandé.
- `components.json` : *à reprendre tel quel* (seul `baseColor` à changer).
- `src/components/ui` mélangeant shadcn et primitives maison : *à adapter* — séparer `ui/` (shadcn, régénérable par la CLI) de `ui-app/` ou `primitives/` (maison), sinon un `shadcn add` écrase du code métier. Et faire un baril **exhaustif** ou pas de baril du tout : un baril partiel produit deux styles d'import.
- Le hook `.claude/settings.local.json:4-17` qui lance le détecteur d'anti-patterns après chaque Edit/Write UI : *à reprendre tel quel* — c'est ce qui rend le design system exécutoire au lieu d'être décoratif.

---

## 8. Qualité / discipline

### Scripts `package.json`

`package.json:9-15` : `dev` (`vite dev --port 3000`), `i18n` (`paraglide-js compile`),
`build` (`node --max-old-space-size=8192 vite build` — **le build a besoin de 8 Go**),
`start`, `preview`, `typecheck` (`tsc --noEmit`).
**Aucun script de lint, de format, ni de test.**

### Typecheck

`tsconfig.json:9` : `strict: true`. Mais `tsconfig.json:10` : `noUncheckedIndexedAccess: false`.
`tsconfig.json:19` : `include: ["src", "convex"]` — **un seul typecheck couvre front et back**.
`tsconfig.json:15-17` : path `~/*`.

### CI `.github/workflows/ci.yml`

Un seul workflow, un seul job `verify` (`ci.yml:9-12`), sur `pull_request` et push
sur `main` (`ci.yml:3-7`). Étapes : checkout → pnpm 10.11.1 (`ci.yml:18-21`) →
Node 22 + cache pnpm (`ci.yml:23-27`) → `pnpm install --frozen-lockfile` →
**`pnpm exec convex codegen`** (`ci.yml:33`) → **`git diff --exit-code convex/_generated`**
(`ci.yml:36`) → `pnpm typecheck` (`ci.yml:39`) → `pnpm build` (`ci.yml:42`).

L'étape `git diff --exit-code convex/_generated` est le pattern le plus malin de
la CI : elle garantit que les types Convex générés committés sont à jour.

### Conventions de commit

Conventional Commits, scope optionnel, sujet en français ou anglais
(`git log` : `feat: durcissement securite et conformite`,
`fix(mailpulse): sync recovery settings state`, `chore: sync router type registration`,
`fix(build): track convex generated bindings`).

### `.claude/` et `.agents/`

- `.claude/settings.local.json:4-17` : hook `PostToolUse` sur `Edit|Write|MultiEdit`
  lançant `.claude/skills/impeccable/scripts/hook.mjs` (timeout 5 s,
  statusMessage « Checking UI changes ») — « surfaces findings as system reminders ».
- `.claude/skills/impeccable/` : skill de design volumineuse (détecteur
  d'anti-patterns multi-moteurs : `detector/engines/{static-html,visual,browser,regex}/`,
  `detector/registry/antipatterns.mjs`, `detector/rules/checks.mjs`, serveur de
  live-edit, ~60 scripts).
- `.agents/skills/` : miroir de `impeccable` (format Codex : `agents/*.toml`,
  `agents/openai.yaml`, 33 fichiers `reference/*.md`) **plus deux skills produit** :
  - `.agents/skills/filon-roadmap/SKILL.md:2-3` — « Relaunch and orchestrate the Filon product roadmap across sessions… launches a worktree-isolated multi-agent workflow », `disable-model-invocation: true`.
  - `.agents/skills/feedback-triage/SKILL.md:2-3` — « Triage les feedbacks Filon en production via Convex CLI, avec notification utilisateur obligatoire ».
- `.codex/hooks.json` : équivalent Codex.

### Tests

**Aucun.** `find` sur `*.test.*` / `*.spec.*` : zéro résultat. Aucun runner en
`devDependencies` (`package.json:76-90`). La validation se fait par
screenshots manuels (`qa-screenshots/`, `docs/expert-audit/*.png`).

**Verdict pour Restaurant OS** :
- CI `codegen` + `git diff --exit-code _generated` + typecheck + build : *à reprendre tel quel*.
- `tsconfig` unique couvrant `src` et `convex` : *à reprendre tel quel*.
- `noUncheckedIndexedAccess: false` : *à adapter* — le passer à `true` dès le départ (impayable à activer plus tard).
- Conventional Commits : *à reprendre tel quel*, en fixant **une seule langue** de sujet.
- Hook `PostToolUse` de contrôle design : *à reprendre tel quel*.
- Skills `.agents/` orientées produit (roadmap, triage feedback) : *à reprendre comme idée*.
- **Zéro test, zéro lint** : *à ne pas reprendre*. Un OS de restaurant touche à l'argent (addition, TVA, caisse, stock) et à des règles de calcul : il faut au minimum Vitest sur les modules purs (`lib/pricing`-like, calcul d'addition, arrondis, taxes) et `convex-test` sur les gardes multi-tenant. Ajouter ESLint + Prettier + un script `check` agrégé dès le premier commit.
- `--max-old-space-size=8192` : *signal d'alerte* — surveiller la taille du bundle dès le début.

---

## 9. i18n

- Compilateur : `@inlang/paraglide-js` (`package.json:36`), plugin Vite
  `vite.config.ts:50-55`, script manuel `package.json:11`
  (`paraglide-js compile --project ./project.inlang --outdir ./src/lib/paraglide`).
- `project.inlang/settings.json:1-11` : `baseLocale: "fr"`, `locales: ["fr","en"]`,
  module `@inlang/plugin-message-format@4`, `pathPattern: "./messages/{locale}.json"`.
- `messages/fr.json` (123 Ko) et `messages/en.json` (115 Ko) — clés plates,
  traduction intégrale de l'UI.
- Sortie compilée dans `src/lib/paraglide/` (généré, non committé en tant que source).
- Usage : `import { m } from '~/lib/paraglide/messages'` puis appel de fonction —
  `src/routes/app/route.tsx:11` et `:42` (`m.shell_page_title()`).
- **Stratégie SSR-safe** (`vite.config.ts:44-55`) : `strategy: ['localStorage', 'baseLocale']`,
  `localStorageKey: 'filon-locale'`. Commentaire explicite : « On NE suit PAS la
  langue du navigateur : Filon est un produit francophone-first (Côte d'Ivoire),
  le français est le défaut dur ; l'anglais est un choix volontaire ».
- **Anti-flash** : `src/routes/__root.tsx:41` injecte un script inline synchrone
  qui pose `document.documentElement.lang` depuis `localStorage` **avant**
  l'hydratation (même technique que l'anti-FOUC de thème, `__root.tsx:33`).
- Provider client : `src/components/i18n/locale-provider.tsx` (`__root.tsx:22`).

**Verdict pour Restaurant OS** : *à reprendre tel quel*. Compile-time,
tree-shakeable, typé, SSR-safe, avec le script anti-flash. Seules décisions à
revoir : la `baseLocale`, et **la stratégie** — pour un restaurant, la langue peut
devoir être une préférence de la *venue* (menu, tickets cuisine) et pas seulement
du navigateur : prévoir une strategy `['localStorage','cookie','baseLocale']` avec
une valeur poussée depuis les réglages de venue.

---

## 10. Analytics (PostHog)

### Architecture en 3 couches

| Fichier | Rôle |
|---|---|
| `src/lib/analytics/posthog.ts` | cœur navigateur (init, queue, identify) |
| `src/lib/analytics/events.ts` | catalogue de noms d'événements |
| `src/lib/analytics/index.ts` | **façade typée, unique point d'import** |

`src/lib/analytics/index.ts:40-43` : « Façade analytique typée — UNIQUE point
d'import de l'analytics dans l'app (DIP : rien d'autre n'importe posthog-js).
`track()` n'accepte que des `EventName` connus, ce qui bloque les fautes de
frappe à la compilation ». Signature : `track(event: EventName, properties?)`
(`index.ts:48-53`).

### Initialisation

`src/lib/analytics/posthog.ts:95-118` — `initPostHog()` :
idempotent et navigateur-only (`posthog.ts:96`), **no-op sans clé** (`posthog.ts:97-98`),
**import dynamique** `void import('posthog-js').then(...)` (`posthog.ts:100`) pour
ne jamais entrer dans le graphe SSR (`posthog.ts:56-61`). Les événements émis avant
la fin de l'init sont **tamponnés puis rejoués** (`posthog.ts:70`, `:111-117`), idem
pour un `identify` précoce (`posthog.ts:71`, `:103-110`).

Config (`posthog.ts:74-92`) : `api_host: '/api/ph'` (**proxy même-origine**, résiste
aux bloqueurs), `ui_host` depuis `VITE_POSTHOG_HOST`, `autocapture: true`,
`capture_pageview: 'history_change'` (suit la navigation SPA TanStack Router),
`capture_pageleave: true`, `person_profiles: 'identified_only'` (quota),
`persistence: 'localStorage+cookie'`.

Montage : `AnalyticsBootstrap` dans `src/routes/__root.tsx:23`, et
`AnalyticsIdentify` dans le layout app (`src/routes/app/route.tsx:33`).

### Le proxy

`src/routes/api/ph.$.tsx` : route handler TanStack Start qui sépare assets
(`/static`, `/array` → `us-assets.i.posthog.com`, `ph.$.tsx:13`, `:19-21`) et
ingestion (`us.i.posthog.com`, `ph.$.tsx:14`). Supprime les en-têtes `host` et
`connection` (`ph.$.tsx:26-28`), **bufferise le corps en `arrayBuffer()`** car
« undici exige `duplex` pour un body en flux » (`ph.$.tsx:23-25`). Raison du
handler plutôt qu'un rewrite : `vercel.json` a `framework: null`, donc les
rewrites sont ignorés (`ph.$.tsx:4-6`).

### Événements

`src/lib/analytics/events.ts:10-28`, catalogue `as const` + type dérivé
(`events.ts:30`), convention `snake_case` / `objet_action` (`events.ts:7`) :
- Acquisition : `landing_viewed`, `cta_clicked`, `signup_started`, `signup_submitted`, `signup_failed`, `login_submitted`, `login_failed`.
- Revenu : `pricing_viewed`, `upgrade_cta_clicked`, `payment_channel_selected`, `checkout_started`, `checkout_failed`, `payment_returned`.
- Parrainage : `referral_link_copied`.

**Miroir serveur** : `convex/lib/track.ts` avec `SERVER_EVENTS` — les étapes
*confirmées* (source de vérité) sont émises depuis Convex, pas depuis le client.
Exemple : `convex/auth.ts:97-100` émet `signup_completed` dans le trigger
`user.onCreate` avec `signup_channel: 'social'|'email'`. Le commentaire
`events.ts:19` explicite la règle : « Revenu (intention — la confirmation est
serveur, cf. SERVER_EVENTS) ». Clés serveur posées sur Convex, pas dans `.env`
(`.env.example`, section PostHog serveur).

**Verdict pour Restaurant OS** : *à reprendre tel quel* — façade typée (DIP),
import dynamique + queue, proxy même-origine, `identified_only`, et surtout la
**dualité client=intention / serveur=confirmation**. Une seule adaptation :
`identify()` doit poser des **person properties ET des group properties**
(`posthog.group('organization', orgId)` / `posthog.group('venue', venueId)`) —
sans quoi aucune analyse par restaurant ne sera possible. C'est l'ajout n°1
par rapport à filon.

---

## 11. Documentation produit

### Racine

| Fichier | Taille | Rôle |
|---|---|---|
| `README.md` | 1,9 Ko | Pitch produit + (présumé) démarrage — `README.md:1-6` décrit le SaaS |
| `PRODUCT.md` | 3,2 Ko | Registre produit (`PRODUCT.md:1-5` : `# Product` / `## Register` / `product`) |
| `ROADMAP.md` | 31 Ko | « Source de vérité du plan produit. Mise à jour à chaque livraison de phase » (`ROADMAP.md:3`), avec 8 décisions de cadrage actées |
| `DESIGN.md` | 12,7 Ko | Design system (front-matter de tokens + 6 sections, cf. §7) |
| `.env.example` | 1,5 Ko | Toutes les variables commentées, avec la **distinction client/serveur Convex** explicitée |

### `docs/`

| Fichier | Rôle |
|---|---|
| `docs/ROUTES.md` | Arbre de routes commenté ; pose l'invariant « Provider Convex/Auth scopé au layout `app/`, jamais dans `__root.tsx` » (`docs/ROUTES.md:3-5`) |
| `docs/FEATURES.md` | Carte des fonctionnalités et du cœur de métier (`docs/FEATURES.md:1-6`) |
| `docs/UX-CONTRACT.md` | « fige les **primitives UX partagees** et les **regles de densite** » auxquelles les pages `app/*` doivent se conformer (`docs/UX-CONTRACT.md:1-6`) |
| `docs/UX-REPORT.md` | Revue de cohérence UX statique après passage de plusieurs agents (`docs/UX-REPORT.md:1-5`) |
| `docs/expert-audit/` | Audit externe : `PLAN_REFONTE_FILON.md`, un PDF de note de validation, ~50 captures PNG |
| `qa-screenshots/` (racine) | Captures de QA manuelle |
| `scripts/og-template.html` | Template de génération de l'image Open Graph |

`docs/ROUTES.md:5` référence un document `tanstack-start-vite-gotchas.md`
**que je n'ai pas trouvé dans le dépôt** (probablement externe ou supprimé).

**Verdict pour Restaurant OS** :
- Le quatuor `README` / `PRODUCT` / `ROADMAP` / `DESIGN` à la racine, dont `ROADMAP.md` déclaré « source de vérité, mise à jour à chaque livraison » : *à reprendre tel quel*.
- `docs/ROUTES.md` et `docs/FEATURES.md` maintenus à la main : *à adapter* — utiles mais ils dérivent ; les générer depuis `routeTree.gen.ts` / le schéma, ou accepter qu'ils soient des documents d'intention datés.
- `docs/UX-CONTRACT.md` (primitives + règles de densité opposables) : *à reprendre tel quel*, et à écrire **avant** la première page.
- `.env.example` exhaustivement commenté avec la frontière client/serveur : *à reprendre tel quel* — critique ici, car les secrets Convex (`npx convex env set`) ne vivent pas dans le même endroit que les `VITE_*`.
- `docs/expert-audit/` et `qa-screenshots/` committés (~50 PNG + PDF) : *à ne pas reprendre* — alourdit le dépôt ; sortir les binaires (Git LFS ou stockage externe).

---

## Récapitulatif des verdicts

| # | Pattern | Verdict |
|---|---|---|
| 1 | Découpage `src/` + `convex/` par domaine, alias `~/`, commentaires-invariants | à reprendre tel quel |
| 2 | Routes file-based, `createFileRoute`, `server.handlers`, `vite.config.ts`, `vercel.json` | à reprendre tel quel |
| 2b | Absence de loaders + gate d'auth client | à ne pas reprendre (pas de 403 serveur, flash, routage org/venue impossible) |
| 3 | Style de schéma, `v.union(v.literal)`, validators extraits, nommage d'index | à reprendre tel quel |
| 3b | Préfixe de scope `by_user_*` | à adapter (→ `by_venue_*` / `by_org_venue_*`) |
| 3c | `.collect()` partout, pagination quasi absente | à ne pas reprendre (volume tickets) |
| 4 | `requireUser`/`optionalUser`/`requireAdmin`, ConvexError typées | à reprendre tel quel |
| 4b | Scoping org par `activeMemberUserIds` + boucle | à ne pas reprendre (O(membres), non indexable) |
| 4c | Ordre impératif anti-fuite documenté en tête de garde | à reprendre tel quel (méthode) |
| 4d | Rate limiter nommé + `enforceRateLimit` | à adapter (clé venue) |
| 5 | Better Auth : `createAuth`, `registerRoutes`, proxy `/api/auth`, providers conditionnels, triggers → ligne métier + liaison d'invitations | à reprendre tel quel |
| 6 | `modelFor(mode, plan, byokKey)`, modes `fast`/`quality`, `usage.include`, `credits.ts`, `aiUsage` | à reprendre tel quel (scope à adapter) |
| 6b | `INSTRUCTIONS` monolithique | à adapter (plusieurs assistants) |
| 6c | BYOK | à ne pas reprendre au lancement |
| 7 | Méthode `DESIGN.md` + tokens sémantiques + `components.json` + hook de contrôle | à reprendre tel quel |
| 7b | `ui/` mélangeant shadcn et primitives maison, baril partiel | à adapter |
| 8 | CI codegen + `git diff --exit-code` + typecheck + build, Conventional Commits | à reprendre tel quel |
| 8b | Zéro test, zéro lint, `noUncheckedIndexedAccess: false` | à ne pas reprendre |
| 9 | Paraglide compile-time + strategy SSR-safe + script anti-flash | à reprendre tel quel |
| 10 | Façade analytics typée, import dynamique, proxy même-origine, client=intention / serveur=confirmation | à reprendre tel quel (+ ajouter les groups PostHog) |
| 11 | README/PRODUCT/ROADMAP/DESIGN + `docs/UX-CONTRACT.md` + `.env.example` commenté | à reprendre tel quel |
| 11b | ~50 PNG et un PDF committés | à ne pas reprendre |
