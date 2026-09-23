# DATA_MODEL.md — Joliba

> Livrable §113. Chaque table porte : **objectif · champs · index · relations · permissions ·
> cycle de vie**. `convex/schema.ts` est écrit **après** ce document et doit lui correspondre.

---

## 0. Ce qui a été retenu, et ce qui a été écarté

Le brief (§50) propose une liste d'environ 150 tables, puis ajoute : *« Cette liste n'est pas
automatiquement la vérité. Pour chaque table : justifier son existence. Éviter les tables
inutiles. »* Ce document prend cette phrase au sérieux.

**Retenu pour la V1 : 59 tables.** Le reste est soit écarté avec sa raison, soit différé avec son
point d'ancrage — c'est-à-dire le champ déjà prévu qui permettra de le brancher plus tard sans
migration douloureuse.

### Tables du brief volontairement NON créées

| Table proposée | Pourquoi elle n'existe pas | Ce qui la remplace |
|---|---|---|
| `permissions` | Le catalogue est une constante du logiciel : le mettre en base crée une seconde source de vérité à migrer, et empêche le type `Permission` d'exister *(D-002)* | `convex/lib/permissions.ts` |
| `orderItemModifiers` | Un supplément commandé est un **snapshot immuable**, toujours lu avec sa ligne. Une table séparée impose une jointure sur le chemin de lecture le plus chaud du produit | Tableau intégré à `orderItems.modifiers` |
| `productTranslations` | Une traduction est toujours lue avec son produit. Une table séparée double les lectures du menu, l'écran le plus sensible à la latence | Objet intégré `products.i18n` |
| `productAllergens`, `allergens` | Les allergènes sont une liste normalisée courte. Une table de jonction pour 14 valeurs déclarées coûte plus qu'elle ne rapporte | `products.allergens: string[]` + constante de code |
| `tags`, `productTags` | Idem : quelques dizaines d'étiquettes par établissement | `products.tags: string[]` + `venueSettings.tagCatalog` |
| `floorPlans`, `floorPlanObjects` | Le plan se réduit aux tables positionnées dans une zone. Les objets décoratifs (bar, plante) n'apportent rien au service | Coordonnées portées par `restaurantTables` ; zone = `serviceAreas` |
| `ticketEvents` | Les horodatages d'un bon (mise en file, démarrage, prêt) sont **quatre champs**, pas quatre lignes. Les rappels, eux, sont des faits métier | Champs sur `kitchenTickets` ; rappels dans `orderEvents` |
| `paymentAllocations` | Un paiement se rattache à **une** addition. Le paiement mixte se fait par plusieurs paiements sur la même addition — plus simple et plus vrai | `payments.checkId` |
| `entitlements` | Les droits se calculent depuis le plan et ses dérogations. Une table figée se désynchronise du plan | `subscriptions.entitlements` + catalogue de plans |
| `memberVenueScopes` | Une portée sans rôle ne veut rien dire : c'est l'affectation qui porte les deux | `memberRoleAssignments` |
| `shifts`, `shiftAssignments` | Gestion de planning : autre métier, autre produit | Différé |
| Les 11 tables de stock | Construire l'inventaire avant d'avoir une commande qui fonctionne, c'est bâtir le premier étage avant le rez-de-chaussée *(A3)* | Différé — ancrage : `products.recipeId` (nullable) |

### Tables différées, avec leur point d'ancrage

| Différé | Ancrage déjà prévu | Quand |
|---|---|---|
| Fidélité (`loyaltyAccounts`, `loyaltyTransactions`, `rewards`, `coupons`) | `customerProfiles` existe ; `orderAdjustments.source` accepte `loyalty` | Après les commandes |
| Réservations (`reservations`, `waitlistEntries`) | `tableSessions.originType` accepte `reservation` | Après le service |
| Stock complet | `products.recipeId`, `orderItems.productId` | Après la caisse |
| API publique (`apiKeys`, `outboundWebhooks`) | `auditLogs.source` accepte `api` | Après la V1 |
| Intégrations tierces (`integrations`, `integrationCredentials`) | Abstraction fournisseur déjà en place pour le paiement | Au cas par cas |

---

## 1. Conventions valables pour toutes les tables

**Portée.** Toute table métier porte `organizationId`. Elle porte **en plus** `venueId` dès que la
donnée appartient à un établissement. Ce n'est pas de la dénormalisation confortable : c'est la
condition pour que le **premier segment de chaque index soit une clé de portée**, et donc pour
qu'aucune requête ne puisse traverser la frontière d'un tenant *(ARCHITECTURE.md §3)*.

**Index.** Nommage `by_<portée>_<champ>_<champ>`, du plus discriminant au moins. Un index n'a besoin
d'un **préfixe de portée** que s'il est atteignable directement par un identifiant **fourni par le
client sans garde préalable** — ceux-là portent la marque `SCOPE-CRITIQUE` dans le schéma. Les
autres sont atteints après une garde, et un préfixe n'y ajouterait rien. Ce qui protège du
franchissement de tenant, c'est la garde, pas la forme de l'index *(PERMISSIONS.md §6)*.
Convex limite à 32 index par table et 16 champs par index : on reste très en deçà.

**La dénormalisation de `organizationId`.** Une cinquantaine de tables portent **à la fois**
`organizationId` et `venueId`, alors que `venues.organizationId` fait autorité. C'est une
dénormalisation délibérée, au service de l'analytique consolidée d'un groupe multi-sites : sans
elle, chaque agrégat devrait d'abord résoudre la liste des établissements.

Elle a un coût qu'il faut nommer : **une ligne dont l'`organizationId` ne correspond pas à celui de
sa venue est une fuite de tenant silencieuse** — ni les index, ni les gardes ne l'attrapent. Elle
naît d'un `organizationId` recopié depuis le mauvais objet dans une mutation, ou le jour où un
établissement change de propriétaire. Deux garde-fous, obligatoires tous les deux :

1. `assertSameOrg(ctx, venueId, organizationId)` à **chaque écriture** portant les deux champs
   *(`convex/lib/scope.ts`)* ;
2. un **contrôle d'intégrité récurrent** qui compare, table par table, l'`organizationId` des lignes
   à celui de leur venue, et alerte sur toute divergence.

**Argent.** Tout montant est un **entier** dans l'unité mineure de sa devise, accompagné de son code
devise. Le XOF a un exposant décimal de 0 : 5 000 FCFA se stocke `5000`, pas `500000`. Aucun
flottant ne touche jamais un montant *(D-004)*.

**Temps.** Horodatages en millisecondes depuis l'epoch (UTC). L'affichage et les regroupements
« par jour » utilisent la **timezone de l'établissement** (§76), jamais celle du serveur ni du
navigateur.

**Suppression.** Rien de financier ni d'opérationnel ne se supprime. On utilise `status` ou
`archivedAt`. La suppression physique est réservée au droit à l'effacement des clients (§91).

**Identifiants lisibles.** Les objets qu'un humain doit citer à voix haute (commande, bon, addition,
reçu) portent un `reference` court et unique par établissement (`A-042`, `TS-2026-009421`), en plus
de leur `_id` Convex.

**Snapshots.** Ce qui a une conséquence financière ou contractuelle est figé au moment de l'acte.
Une carte qui change ne réécrit jamais le passé *(D-005)*.

---

## 2. Identité, organisations, accès

### `users`
**Objectif.** Le profil applicatif d'une personne. Better Auth détient l'authentification (comptes,
sessions, OTP, OAuth) dans ses propres tables ; cette table est le miroir métier, alimenté par un
déclencheur à la création *(D-016)*.
**Pourquoi séparer.** Pour que le métier référence un `Id<"users">` typé plutôt qu'une chaîne
d'authentification, et pour porter des champs qui n'appartiennent pas à l'authentification (langue,
avatar, préférences).

| Champ | Type | Note |
|---|---|---|
| `authId` | string | identifiant Better Auth — **unique** |
| `email`, `name`, `avatarStorageId?` | string / Id<"_storage"> | |
| `emailVerifiedAt?` | number | adresse **prouvée** (code reçu, ou Google qui l'atteste). Absent : aucune invitation ne peut être acceptée *(D-033)* |
| `locale` | `"fr" \| "en"` | langue d'interface |
| `status` | `"active" \| "suspended"` | suspension plateforme |
| `lastSeenAt` | number | |

**Index** : `by_auth ["authId"]` · `by_email ["email"]`
**Permissions** : lecture de soi toujours ; lecture d'autrui via `team.read` dans une organisation
commune.
**Cycle** : créé au premier login · suspendu · jamais supprimé (anonymisé si effacement demandé).

### `organizations`
**Objectif.** Le tenant. Porte l'abonnement, la facturation, et possède les établissements.

| Champ | Type | Note |
|---|---|---|
| `name`, `slug` | string | `slug` unique global |
| `ownerUserId` | Id<"users"> | propriétaire courant |
| `countryCode`, `defaultCurrency`, `defaultLocale` | string | valeurs par défaut des établissements |
| `status` | `"active" \| "suspended" \| "archived"` | |
| `createdAt` | number | |

**Index** : `by_slug ["slug"]` · `by_owner ["ownerUserId"]` · `by_status ["status"]`
**Permissions** : `organization.manage`.
**Cycle** : créée à l'inscription · suspendue (impayé, décision plateforme) · archivée, jamais
supprimée.

### `organizationMembers`
**Objectif.** L'appartenance d'une personne à une organisation. **C'est le pivot du contrôle
d'accès** : sans ligne ici, aucun accès, quelle que soit la suite.

| Champ | Type |
|---|---|
| `organizationId` | Id |
| `userId?` | Id<"users"> — **absent pour un membre sans compte** (`kind: "pin_only"`, D-060) |
| `kind?` | `"account"` (défaut) `\| "pin_only"` |
| `displayName?` | nom affiché d'un membre sans compte |
| `status` | `"invited" \| "active" \| "suspended" \| "removed"` |
| `invitedByUserId?`, `createdByUserId?`, `joinedAt?`, `removedAt?` | |

**Index** : `by_org_user ["organizationId","userId"]` · `by_user ["userId"]` (« mes organisations »)
· `by_org_status ["organizationId","status"]`
**Permissions** : `team.read` / `team.manage`.
**Cycle** : `invited` → `active` → `suspended`/`removed`. Jamais supprimée : l'historique d'audit y
renvoie.

### `organizationInvitations`
**Objectif.** Une invitation en attente, avant même qu'un compte existe.
**Champs** : `organizationId`, `email`, `roleId`, `venueIds: Id<"venues">[]` (vide = rôle au niveau
de l'organisation), `tokenHash` (SHA-256 du jeton — le jeton en clair n'est jamais stocké, il ne
vit que dans le lien envoyé), `expiresAt`, `status`, `invitedByUserId`, `acceptedByUserId?`,
`acceptedAt?`.
**Index** : `by_token ["tokenHash"]` · `by_org_status ["organizationId","status"]` ·
`by_email ["email"]`
**Permissions** : `team.manage`.
**Cycle** : `pending` → `accepted` / `expired` / `revoked`.

### `roles`
**Objectif.** Un sac de permissions nommé. Les modèles système ont `organizationId` absent ; une
organisation en reçoit une copie à sa création, qu'elle peut modifier.

| Champ | Type | Note |
|---|---|---|
| `organizationId?` | Id | absent = modèle système |
| `key`, `label` | string | `key` stable, `label` modifiable |
| `permissions` | string[] | valeurs du catalogue de code |
| `isCustom` | boolean | |
| `description?` | string | |

**Index** : `by_org ["organizationId"]` · `by_org_key ["organizationId","key"]`
**Permissions** : `permissions.manage`. Une écriture contenant une permission `platform.*` est
rejetée **côté serveur** *(PERMISSIONS.md §7)*.
**Cycle** : copié à la création de l'organisation · modifié · archivé (jamais supprimé si des
affectations y renvoient).

### `memberRoleAssignments`
**Objectif.** *Qui* a *quel rôle* *où*. La table qui rend possible « Manager de Cocody **et**
Serveur de Plateau » sans créer deux comptes pour la même personne.

| Champ | Type |
|---|---|
| `organizationId`, `memberId`, `roleId` | Id |
| `scopeType` | `"organization" \| "venue"` |
| `venueId?` | Id<"venues"> — requis si `scopeType = "venue"` |
| `grantedByUserId`, `grantedAt` | |

**Index** : `by_member ["memberId"]` (chemin chaud : résolution des permissions) ·
`by_org_venue ["organizationId","venueId"]` · `by_role ["roleId"]` (impact avant modification d'un rôle)
**Permissions** : `team.manage` + les trois verrous d'élévation.
**Cycle** : créée · révoquée (supprimée, l'audit garde la trace).

### `venues`
**Objectif.** Un établissement physique. Lue à chaque requête : on y garde **le strict nécessaire**,
la configuration volumineuse va dans `venueSettings`.

| Champ | Type | Note |
|---|---|---|
| `organizationId` | Id | |
| `name`, `slug` | string | `slug` unique sur toute la plateforme : il sert l'URL publique (`/menu/<slug>`, `/r/<slug>/…`) |
| `countryCode`, `currency`, `timezone`, `locales` | string / string[] | **la devise se fige dès la première opération financière** *(R20)* |
| `venueType` | `"restaurant" \| "maquis" \| "bar" \| "lounge" \| "cafe" \| "fast_food" \| "hotel" \| "food_court"` | |
| `status` | `"setup" \| "active" \| "paused" \| "archived"` | |
| `publicMenuEnabled` | boolean | décide de l'indexation du menu public (§64) |
| `onboardingCompletedSteps` | string[] | tableau de bord d'onboarding (§37) |

**Index** : `by_org ["organizationId"]` · `by_slug ["slug"]` · `by_org_status ["organizationId","status"]` · `by_public_menu ["publicMenuEnabled"]` (plan du site : seuls les établissements consentants)
**Permissions** : `venue.read` / `venue.manage` / `venue.create`.
**Cycle** : `setup` → `active` → `paused` → `archived`.

### `venueSettings`
**Objectif.** La configuration d'un établissement — volumineuse, modifiée rarement, lue une fois par
session puis mise en cache. La séparer de `venues` évite de charger tout le paramétrage à chaque
lecture d'un nom d'établissement.
**Un document par établissement.**

| Bloc | Contenu |
|---|---|
| `service` | `orderingMode` (`staff_only`/`guest_with_approval`/`guest_direct`/`hybrid`), `paymentTiming` (`post_paid`/`pre_paid`/`per_order`), `paymentLocations[]`, `qrStrategy` (`frictionless`/`table_activation`/`approval`/`presence_code`), `guestDirectCategories[]` |
| `tax` | `pricesIncludeTax`, `rates[]` (`{code,label,percent,appliesTo}`), `serviceChargePercent?` |
| `tipping` | `enabled`, `mode` (`free`/`percentages`), `suggestions[]` |
| `branding` | `logoStorageId?`, `coverStorageId?`, `primaryColor`, `theme` |
| `fiscal` | `regime`, `taxId?`, `fneEnabled`, `receiptFooter?` *(D-020)* |
| `notifications` | canaux actifs par événement et par rôle |
| `serviceRequestTypes` | types activés + délai anti-spam |
| `tagCatalog` | étiquettes de l'établissement |

**Index** : `by_venue ["venueId"]`
**Permissions** : `venue.manage` ; le bloc `service` exige `venue.settings.service`.

### `trustedDevices`
**Objectif.** Un appareil enrôlé : écran de production, tablette partagée, téléphone d'un employé
*(A1, D-060)*.
**Pourquoi.** Une tablette murale n'est pas une personne, et un serveur sans adresse e-mail
consultée ne peut pas recevoir de code. L'appareil est enrôlé une fois par un gérant ; ensuite,
l'écran de cuisine agit seul, et sur les autres appareils chacun s'identifie par son PIN.

| Champ | Type |
|---|---|
| `venueId` | Id — pas d'`organizationId` : il se lit par l'établissement (invariant du schéma) |
| `label` | string |
| `deviceType` | `kds` (aucun humain, **aucun PIN**) · `shared` (tablette de salle, caisse) · `personal` (téléphone d'un employé) |
| `tokenHash` | string — **jamais le jeton en clair** |
| `stationId?` | Id<"prepStations"> — un écran de cuisine ne lit et ne touche que ce poste |
| `memberId?` | Id — le propriétaire d'un appareil `personal`, seul à pouvoir s'y identifier |
| `enrolledByMemberId`, `enrolledAt`, `lastSeenAt?`, `revokedAt?`, `revokedByMemberId?` | |
| `recentPinFailures` | number[] — échecs de PIN de la dernière heure, tous membres confondus |
| `pinSuspendedUntil?` | number — plus de PIN sur cet appareil au-delà de 15 échecs par heure |

**Index** : `by_venue ["venueId"]` · `by_token ["tokenHash"]`
**Permissions** : `device.manage`.
**Cycle** : enrôlé → actif → révoqué (immédiat, à distance ; les sessions d'opérateur tombent avec
lui, et les PIN de ceux qui s'y sont identifiés depuis 12 heures doivent être rechoisis).

### `deviceEnrollmentCodes`
**Objectif.** Le code à usage unique qu'un gérant fait apparaître et que l'appareil saisit pour
s'enrôler.
**Champs** : `venueId`, `codeHash` (SHA-256), `deviceType`, `label`, `stationId?`, `memberId?`,
`createdByMemberId`, `expiresAt` (10 minutes), `usedAt?`, `deviceId?`.
**Index** : `by_code ["codeHash"]` · `by_venue ["venueId"]`
**Permissions** : `device.manage`.

### `staffCredentials`
**Objectif.** Le PIN de service d'un membre *(D-060)*.
**Pourquoi haché avec un secret.** Un PIN a 10 000 valeurs : son simple SHA-256 se retrouve
instantanément. Le HMAC-SHA256 sous `PIN_PEPPER`, secret qui ne vit que dans l'environnement
Convex, rend une base volée inutilisable sans lui.

| Champ | Type |
|---|---|
| `organizationId`, `memberId` | Id |
| `pinHash?` | string — HMAC, absent tant que l'employé ne l'a pas choisi |
| `status` | `pending` (activation attendue) · `active` · `disabled` (10 échecs, ou retiré) |
| `recentFailures` | number[] — fenêtre de 15 minutes, tous appareils confondus |
| `failuresSinceSuccess`, `lockedUntil?`, `pinSetAt?`, `lastUnlockAt?` | |

**Index** : `by_member ["memberId"]`
**Permissions** : `team.manage`, avec autorité sur le membre (verrou 1).
**Cycle** : `pending` → `active` → (`disabled` → `pending` par un nouveau code d'activation).
Aucun contrôle d'unicité des PIN : il révélerait le code d'un collègue.

### `activationCodes`
**Objectif.** Le code (8 caractères, 24 heures, usage unique) qu'un gérant remet à un employé pour
qu'il choisisse **lui-même** son PIN, que le gérant ne connaît donc jamais.
**Champs** : `organizationId`, `memberId`, `codeHash`, `createdByMemberId`, `expiresAt`, `usedAt?`,
`revokedAt?`.
**Index** : `by_code ["codeHash"]` · `by_member ["memberId"]`
**Permissions** : `team.manage`.

### `operatorSessions`
**Objectif.** Une personne identifiée par son PIN sur un appareil, du déverrouillage au
verrouillage. Le jeton d'opérateur (10 minutes, signé par Convex) la désigne ; chaque appel la
relit.
**Champs** : `venueId`, `deviceId`, `memberId`, `secretHash` (secret de renouvellement, haché),
`startedAt`, `lastActivityAt`, `endedAt?`, `endReason?` (`locked`/`expired`/`revoked`/`replaced`).
**Index** : `by_device ["deviceId"]` · `by_member ["memberId"]` · `by_secret ["secretHash"]`
**Cycle** : close au verrouillage, à la révocation de l'appareil, après 12 heures, ou après 3 minutes
sans geste sur un appareil partagé (30 minutes sur un téléphone personnel).

### `platformAdmins`
**Objectif.** L'équipe Joliba. **Table à part, garde à part** : aucun chemin de code ne doit
permettre à une organisation d'accorder un droit plateforme.
**Champs** : `userId`, `permissions: string[]`, `status`.
**Index** : `by_user ["userId"]`
**Permissions** : `requirePlatformAdmin` exclusivement.

---

## 3. Abonnement

### `plans`
**Objectif.** Le catalogue commercial. **En base et non en code** — contrairement aux permissions —
parce qu'un prix change sans livraison de logiciel, et qu'on veut pouvoir tester une grille.
**Champs** : `key`, `label`, `prices[] ({currency, amount, interval})`, `entitlements` (objet),
`limits` (`{venues, staffSeats, monthlyOrders?}`), `isPublic`, `sortOrder`.
**Index** : `by_key ["key"]` · `by_public ["isPublic"]`
**Permissions** : lecture publique (page tarifs) ; écriture `platform.*`.

### `subscriptions`
**Objectif.** Ce à quoi une organisation a droit, maintenant.
**Champs** : `organizationId`, `planId`, `status` (`trialing`/`active`/`past_due`/`grace`/`cancelled`),
`currentPeriodEnd`, `trialEndsAt?`, `entitlements` (calculées, avec dérogations),
`overrides?`, `cancelledAt?`.
**Index** : `by_org ["organizationId"]` · `by_status_period ["status","currentPeriodEnd"]` (relances)
**Permissions** : `organization.billing.manage`.
**Cycle** : `trialing` → `active` → `past_due` → `grace` → `cancelled`. **Une organisation
`past_due` reste lisible et encaissable** : couper le service d'un restaurant en plein coup de feu
pour un impayé est une faute produit, pas une politique.

### `featureFlags`
**Objectif.** Activer une fonctionnalité pour une cible précise, sans livraison (§94).
**Champs** : `key`, `scopeType` (`global`/`organization`/`venue`/`user`), `scopeId?`, `enabled`,
`rolloutPercent?`, `note?`.
**Index** : `by_key_scope ["key","scopeType","scopeId"]`
**Permissions** : `platform.flags.manage`.

---

## 4. Carte

### `menus`
**Objectif.** Un ensemble cohérent de sections et de produits, avec sa plage d'application — c'est ce
qui permet une carte « Petit déjeuner 07 h–11 h » et une carte « Soir » sans dupliquer les produits.
**Champs** : `organizationId`, `venueId`, `name`, `slug`, `status` (`draft`/`published`/`archived`),
`activeSchedule?` (jours + plages), `sortOrder`, `publishedVersionId?`.
**Index** : `by_venue ["venueId"]` · `by_venue_status ["venueId","status"]`
**Permissions** : `menu.read` / `menu.edit` / `menu.publish`.
**Cycle** : `draft` → `published` → `archived`. **Le client ne voit jamais un brouillon** *(R22)*.

### `menuSections`
**Objectif.** Le regroupement visible par le client (Entrées, Grillades, Boissons).
**Champs** : `organizationId`, `venueId`, `menuId`, `name`, `description?`, `i18n?`, `sortOrder`,
`imageStorageId?`, `isActive`.
**Index** : `by_menu_sort ["menuId","sortOrder"]` · `by_venue ["venueId"]`
**Permissions** : `menu.edit`.

### `products`
**Objectif.** L'article vendable. La table la plus lue du produit : sa forme décide de la vitesse du
menu client.

| Champ | Type | Note |
|---|---|---|
| `organizationId`, `venueId`, `menuSectionId` | Id | |
| `name`, `slug`, `description?` | string | |
| `i18n?` | `{ [locale]: {name, description} }` | **intégré** : toujours lu avec le produit |
| `basePrice`, `currency` | number (entier), string | *(D-004)* |
| `promoPrice?`, `promoEndsAt?` | | |
| `taxCodes` | string[] | renvoie à `venueSettings.tax.rates` |
| `images` | `{storageId, thumbStorageId, width, height}[]` | photo réduite et sa vignette, dimensions connues : la carte réserve la place avant chargement |
| `prepStationId?` | Id<"prepStations"> | décide du routage du bon *(R11)* |
| `prepMinutes?` | number | durée indicative, alimente le retard |
| `tags`, `allergens` | string[] | **déclarés par le restaurant uniquement** *(R28)* |
| `dietary` | `{vegetarian?, vegan?, halal?, spicyLevel?}` | booléens **déclarés**, jamais déduits |
| `nutrition?` | objet libre | facultatif |
| `isAvailable` | boolean | interrupteur manuel — geste de service |
| `unavailableUntil?` | number | rupture temporaire (« plus de poulet ce soir ») |
| `stockCount?` | number | compteur simple, sans module de stock |
| `recipeId?` | Id | **ancrage** du futur module stock *(A3)* |
| `relatedProductIds` | Id[] | recommandations déterministes *(§33)* |
| `sortOrder`, `isActive` | | |

**Index** : `by_venue_section_sort ["venueId","menuSectionId","sortOrder"]` — **SCOPE-CRITIQUE**, seul index atteint par un identifiant venant du client sans garde préalable (menu public non authentifié) · `by_venue_active ["venueId","isActive"]`
· `by_venue_station ["venueId","prepStationId"]` · `by_slug ["venueId","slug"]`
**Recherche** : `search_products` sur `name`, filtré par `venueId` et `isActive` — la recherche §15
ne doit jamais balayer toute la table.
**Permissions** : `menu.read` · `menu.edit` · `menu.price.edit` pour `basePrice`/`promoPrice` ·
`menu.availability.toggle` pour `isAvailable`/`unavailableUntil`/`stockCount`.
**Cycle** : créé → actif → indisponible (réversible) → archivé.

> **Le découpage des permissions sur cette table est délibéré.** Un chef de rang doit pouvoir dire
> « il n'y a plus de poisson » sans pouvoir changer un prix. C'est ce qui rend l'outil utilisable en
> service sans ouvrir la caisse.

### `productVariants`
**Objectif.** Une déclinaison qui change le prix (Normal / Double, 33 cl / 50 cl).
**Pourquoi une table** : une variante est une ligne commandable avec son propre prix et sa propre
disponibilité — contrairement à un supplément.
**Champs** : `organizationId`, `venueId`, `productId`, `name`, `i18n?`, `priceDelta` **ou** `price`,
`isDefault`, `isAvailable`, `sortOrder`.
**Index** : `by_product_sort ["productId","sortOrder"]`
**Permissions** : `menu.edit`, prix sous `menu.price.edit`.

### `modifierGroups` / `modifierOptions` / `productModifierGroups`
**Objectif.** Les choix (Cuisson, Accompagnement) et leurs options (Saignant, Frites, Alloco).
**Pourquoi trois tables** : un groupe « Cuisson » se réutilise sur quinze produits. Le dupliquer par
produit rendrait toute correction impossible.

`modifierGroups` : `name`, `i18n?`, `selectionType` (`single`/`multiple`), `minSelect`, `maxSelect`,
`isRequired`.
`modifierOptions` : `modifierGroupId`, `name`, `i18n?`, `priceDelta`, `isAvailable`, `sortOrder`.
`productModifierGroups` : jonction + `sortOrder` + `overrideRequired?`.

**Index** : `by_venue ["venueId"]` · `by_group_sort ["modifierGroupId","sortOrder"]` ·
`by_product_sort ["productId","sortOrder"]` · `by_group ["modifierGroupId"]`

### `availabilityRules`
**Objectif.** La disponibilité **programmée** (Happy Hour 17 h–19 h, petit déjeuner en semaine),
distincte de l'interrupteur manuel du service.
**Pourquoi séparer du produit** : une règle peut viser un produit, une section ou un menu entier, et
plusieurs règles peuvent se cumuler.
**Champs** : `organizationId`, `venueId`, `targetType` (`product`/`section`/`menu`), `targetId`,
`daysOfWeek: number[]`, `startTime`, `endTime` (minutes locales), `effectiveFrom?`, `effectiveTo?`,
`ruleType` (`available`/`unavailable`), `isActive`.
**Index** : `by_venue_target ["venueId","targetType","targetId"]` · `by_venue_active ["venueId","isActive"]`
**Cycle** : évaluée **à la lecture**, dans la timezone de l'établissement *(R23)*. Jamais matérialisée
en tâche planifiée : une tâche qui se réveille en retard afficherait une carte fausse.

### `menuPublications`
**Objectif.** Une version figée et datée de la carte, c'est-à-dire **ce que le client voit
réellement**. C'est elle qui rend `R22` opposable.
**Champs** : `organizationId`, `venueId`, `menuId`, `version`, `snapshot` (arbre complet sections →
produits → variantes → options), `publishedByUserId`, `publishedAt`, `isCurrent`.
**Index** : `by_venue_current ["venueId","isCurrent"]` · `by_menu_version ["menuId","version"]`
**Cycle** : créée à chaque publication, jamais modifiée. Permet de revenir en arrière, et d'expliquer
« pourquoi ce prix était affiché mardi ».

> **Limite à surveiller** : un document Convex plafonne à 1 Mo. Une très grande carte avec beaucoup
> de traductions pourrait s'en approcher. Le `snapshot` exclut donc les images (identifiants
> seulement) et le contrôle de taille est fait à la publication, avec un message clair si la carte
> doit être scindée en plusieurs menus.

---

## 5. Salle, tables, QR

### `serviceAreas`
**Objectif.** Une zone (Salle, Terrasse, VIP, Étage). Sert au plan, au filtrage serveur et aux
analytics par zone.
**Champs** : `organizationId`, `venueId`, `name`, `sortOrder`, `canvasWidth`, `canvasHeight`, `isActive`.
**Index** : `by_venue_sort ["venueId","sortOrder"]`

### `restaurantTables`
**Objectif.** Le meuble physique. Durable : il survit à des milliers de sessions.
**Champs** : `organizationId`, `venueId`, `serviceAreaId`, `number` (unique par établissement),
`label?`, `seats`, `shape` (`square`/`round`/`rect`), `x`, `y`, `width`, `height`, `rotation?`,
`status` (`available`/`occupied`/`reserved`/`out_of_service`), `activeSessionId?`, `isActive`.
**Index** : `by_venue_number ["venueId","number"]` · `by_area ["serviceAreaId"]` ·
`by_venue_status ["venueId","status"]` · `by_active_session ["activeSessionId"]`
**Permissions** : `table.read` / `table.manage`.

> `activeSessionId` est une **dénormalisation assumée** : elle garantit `R1` (au plus une session
> ouverte par table) par une vérification transactionnelle simple, et évite une requête par table sur
> l'écran serveur, qui affiche trente tables à la fois. Elle est écrite uniquement par les mutations
> d'ouverture et de clôture de session.

### `tableQrCodes`
**Objectif.** Le jeton qui identifie une table depuis le monde physique. **Le point d'entrée du
produit, et sa première surface d'attaque.**

| Champ | Type | Note |
|---|---|---|
| `organizationId`, `venueId`, `tableId` | Id | |
| `token` | string | **opaque, non devinable** (≥ 128 bits d'entropie) *(D-008)* |
| `version` | number | incrémenté à chaque rotation |
| `status` | `"active" \| "revoked"` | |
| `design?` | objet | modèle d'impression choisi |
| `createdByUserId`, `createdAt`, `revokedAt?`, `lastScannedAt?`, `scanCount` | | |

**Index** : `by_token ["token"]` · `by_table ["tableId"]` · `by_venue_status ["venueId","status"]`
**Permissions** : `table.qr.manage`.
**Cycle** : généré → actif → **révoqué** (une photo qui circule se neutralise en réimprimant) →
remplacé par une nouvelle version.

> **Le jeton n'est jamais l'identifiant de session.** Le scan l'échange contre une session signée,
> déposée en cookie `httpOnly`. Sans cela, une photographie du QR partagée sur WhatsApp donnerait un
> accès permanent à la table, depuis n'importe où *(§9, D-008)*. `scanCount` et `lastScannedAt`
> alimentent la détection d'anomalie (un QR scanné 200 fois depuis l'autre bout de la ville).

---

## 6. Session de table et invités

### `tableSessions`
**Objectif.** **L'objet central du produit** : l'occupation d'une table par un groupe, de
l'installation à la clôture. Ni la table, ni la commande, ni l'addition.

| Champ | Type | Note |
|---|---|---|
| `organizationId`, `venueId`, `tableId` | Id | |
| `reference` | string | `TS-2026-009421`, prononçable |
| `status` | `open`/`ordering`/`billing`/`settling`/`closed`/`closed_with_debt`/`abandoned` | machine §4 d'ARCHITECTURE.md |
| `originType` | `qr_scan`/`staff`/`reservation` | **ancrage** des réservations |
| `guestCount?` | number | déclaré, sert au revenu par couvert |
| `assignedWaiterMemberId?` | Id<"organizationMembers"> | attribution du service et du pourboire *(A2)* ; un **membre**, pour qu'un serveur sans compte puisse tenir une table (D-060) |
| `openedByMemberId?`, `openedAt`, `closedAt?`, `closedByMemberId?` | | |
| `closeReason?` | string | **obligatoire** si `closed_with_debt` |
| `currency` | string | figé à l'ouverture |
| `activationCode?` | string | mode « code de présence » (§9) |
| `lastActivityAt` | number | alimente l'abandon automatique |

**Index** : `by_venue_status ["venueId","status"]` (écran serveur et caisse) ·
`by_table_status ["tableId","status"]` (garantit `R1`) · `by_venue_openedAt ["venueId","openedAt"]`
(historique et analytics) · `by_waiter ["assignedWaiterUserId"]` (« mes tables »)
**Permissions** : `table.session.open` / `close` / `transfer` ; lecture par `table.read`.

> **Pourquoi il n'y a PAS de totaux sur la session.** Une version antérieure en portait six, en
> parallèle des huit champs de `checks` : **deux caches d'argent sur les mêmes faits**, sans
> invariant écrit ni testé — c'est-à-dire deux réponses possibles à « combien doit cette table ».
> L'état financier d'une session se dérive donc de ses commandes et de ses paiements
> (`orders.by_session`, `payments.by_check`). Pour trente tables, c'est une lecture d'index par
> table : le prix d'un solde qui ne peut pas être faux. *(CRITIQUE.md S4.)*

### `guestSessions`
**Objectif.** Un navigateur rattaché à une session de table. C'est l'identité légère qui rend la
commande collaborative possible **sans compte** (§11).
**Champs** : `organizationId`, `venueId`, `tableSessionId`, `displayName?` (« Invité 2 », ou le
prénom donné), `colorKey`, `deviceFingerprintHash?`, `joinedAt`, `lastSeenAt`, `status`
(`active`/`left`), `customerProfileId?` (si le client s'identifie volontairement).
**Index** : `by_session ["tableSessionId"]` · `by_session_status ["tableSessionId","status"]`
**Permissions** : lecture par la session elle-même (cookie signé) ; le personnel via `table.read`.
**Cycle** : rejoint → actif → parti → détruit à la clôture + délai de rétention.

> Aucune donnée personnelle n'est exigée : un nom est facultatif, l'empreinte d'appareil est
> **hachée** et sert uniquement à retrouver sa propre session après un rechargement (§91).

### `serviceRequests`
**Objectif.** Un appel du client (serveur, eau, couverts, addition).
**Champs** : `organizationId`, `venueId`, `tableSessionId`, `guestSessionId?`, `type`, `note?`,
`status` (`open`/`acknowledged`/`resolved`/`cancelled`), `createdAt`, `acknowledgedAt?`,
`acknowledgedByMemberId?`, `resolvedAt?`, `resolvedByMemberId?`.
**Index** : `by_venue_status_created ["venueId","status","createdAt"]` (file du serveur, triée) ·
`by_session ["tableSessionId"]`
**Permissions** : création par la session invité ; `service_request.handle` pour le reste.
**Cycle** : `open` → `acknowledged` → `resolved`. Les trois horodatages sont les **seules** données
qui permettront de mesurer « temps demande → réponse » (§41) : les stocker coûte trois champs, les
reconstituer plus tard serait impossible.
**Anti-abus** : délai minimal entre deux demandes du même type et de la même session, réglé dans
`venueSettings.serviceRequestTypes` (§23).

---

## 7. Commandes

### `carts` / `cartItems`
**Objectif.** Le panier avant envoi. Séparé des commandes parce qu'il n'a **aucune valeur
contractuelle** : il change, il expire, il ne se journalise pas.
**Pourquoi deux tables** : les articles du panier changent constamment (quantité, options) ; les
isoler évite de réécrire tout le panier à chaque geste, et rend le panier partagé réel en mode
collaboratif.

`carts` : `tableSessionId`, `guestSessionId?` (absent = panier commun à la table), `status`
(`active`/`submitted`/`abandoned`), `updatedAt`.
`cartItems` : `cartId`, `productId`, `variantId?`, `modifierSelections[]`, `quantity`,
`instructions?`, `addedByGuestSessionId`, `courseNumber?`, `estimatedUnitPrice`.

**Index** : `by_session ["tableSessionId"]` · `by_cart ["cartId"]` · `by_guest ["guestSessionId"]`
**Cycle** : actif → soumis (converti en commande) → abandonné (tâche planifiée).

> `estimatedUnitPrice` porte bien son nom : c'est un **affichage**. Le prix qui fait foi est
> recalculé côté serveur à l'envoi *(R14)*. Le client qui modifierait cette valeur ne changerait
> rien à ce qu'il paiera.

### `orders`
**Objectif.** Un envoi d'articles décidé à un instant donné. Immuable dans ses lignes une fois
accepté.

| Champ | Type | Note |
|---|---|---|
| `organizationId`, `venueId`, `tableSessionId` | Id | |
| `reference` | string | `A-042`, dit à voix haute |
| `status` | machine §5 d'ARCHITECTURE.md | |
| `channel` | `guest`/`staff` | qui a saisi |
| `placedByGuestSessionId?`, `placedByMemberId?` | | |
| `acceptedByMemberId?`, `acceptedAt?`, `rejectedReason?` | | |
| `submittedAt`, `readyAt?`, `servedAt?`, `closedAt?` | | jalons pour les délais de service |
| `totals` | `{subtotal, discounts, tax, serviceCharge, total}` | calculé serveur |
| `currency` | string | |
| `idempotencyKey` | string | **empêche la double commande** *(R7)* |
| `notes?` | string | |

**Index** : `by_session ["tableSessionId"]` · `by_venue_status_submitted ["venueId","status","submittedAt"]`
(tour de contrôle) · `by_venue_idempotency ["venueId","idempotencyKey"]` (unicité par établissement : jamais globale, sinon la clé d'un locataire se lit ou se bloque depuis un autre) ·
`by_venue_submittedAt ["venueId","submittedAt"]` (analytics)
**Permissions** : `order.read` / `create` / `accept` / `modify` / `cancel`.

### `orderItems`
**Objectif.** Une ligne commandée, avec son **snapshot figé** *(D-005, R6)*.

| Champ | Type | Note |
|---|---|---|
| `organizationId`, `venueId`, `orderId`, `tableSessionId` | Id | `tableSessionId` dupliqué : l'addition lit par session |
| `productId`, `variantId?` | Id | référence, pour les analytics |
| `nameSnapshot`, `variantNameSnapshot?` | string | **le nom du jour de la commande** |
| `modifiers` | `[{groupName, optionName, priceDelta}]` | **intégré** — snapshot, jamais une jointure |
| `quantity`, `unitPrice`, `lineTotal` | number | |
| `taxSnapshot` | `[{code, percent, amount}]` | le taux du jour de la commande |
| `instructions?` | string | « sans oignon » |
| `courseNumber` | number | 1 = boissons, 2 = entrée… |
| `prepStationId?` | Id | figé : changer la station d'un produit ne rejoue pas le passé |
| `status` | `ordered`/`preparing`/`ready`/`served`/`cancelled` | état **par ligne** |
| `cancelledReason?`, `cancelledByMemberId?` | | |
| `assignedGuestSessionIds` | Id[] | à qui l'article est attribué, pour le partage (§11) |

**Index** : `by_order ["orderId"]` · `by_session_status ["tableSessionId","status"]` ·
`by_venue_product ["venueId","productId"]` (produits qui se vendent, produits annulés)
**Cycle** : la ligne ne se supprime **jamais** ; elle passe à `cancelled` avec un motif.

### `orderEvents`
**Objectif.** Le journal métier de la commande. Sans lui, la question « qu'est-ce qui a ralenti le
service hier soir ? » (§34) n'a aucune réponse possible, et l'IA n'aurait rien à lire.
**Champs** : `organizationId`, `venueId`, `orderId`, `type` (`submitted`, `accepted`, `rejected`,
`fired`, `item_ready`, `served`, `cancelled`, `modified`, `recalled`…), `actorType`
(`guest`/`staff`/`device`/`system`/`ai`), `actorMemberId?`, `actorDeviceId?`,
`actorOperatorSessionId?` (qui, sur quel appareil, dans quelle session — D-060), `payload?`, `at`.
**Index** : `by_order_at ["orderId","at"]` · `by_venue_type_at ["venueId","type","at"]` (analytics de
délais)
**Cycle** : **append-only**. Jamais modifié, jamais supprimé.

### `orderAdjustments`
**Objectif.** Une remise, un geste commercial, un frais. Séparé de la ligne pour que le prix
d'origine reste lisible — sinon on ne sait plus si le plat était à 5 000 ou à 4 000.
**Champs** : `orderId?`, `checkId?`, `tableSessionId`, `type` (`discount`/`service_charge`/`fee`/`comp`),
`source` (`manual`/`promotion`/`loyalty`), `label`, `amount`, `percent?`, `appliedByUserId`, `reason?`.
**Index** : `by_session ["tableSessionId"]` · `by_order ["orderId"]` · `by_venue_type ["venueId","type"]`
**Permissions** : `order.discount.apply`. **Auditée** au-delà d'un seuil réglé par établissement.

### `venueCounters`
**Objectif.** Les compteurs d'un établissement qui fabriquent les références dites à voix haute :
`order:<jour de service>` pour « A-042 » (repart à 1 chaque jour, à 4 h), `session:<année>` pour
« TS-2026-000123 ».
**Champs** : `venueId`, `key`, `value`.
**Index** : `by_venue_key ["venueId","key"]`
**Pourquoi une table.** Compter les commandes du jour à chaque envoi lirait un nombre de lignes qui
grandit toute la soirée ; un document par compteur coûte une lecture, et Convex sérialise deux
incréments concurrents sur le même document — deux serveurs qui envoient en même temps n'obtiennent
pas le même numéro.

---

## 8. Production

### `prepStations`
**Objectif.** Un poste de production : cuisine, bar, pâtisserie, grillades.
**Champs** : `organizationId`, `venueId`, `name`, `type`, `sortOrder`, `targetPrepMinutes`,
`lateThresholdMinutes`, `soundEnabled`, `isActive`.
**Index** : `by_venue_sort ["venueId","sortOrder"]`
**Permissions** : `kitchen.manage`.

### `kitchenTickets`
**Objectif.** La part d'une commande destinée à **une seule** station *(R11)*. C'est ce que la
cuisine voit ; elle ne voit jamais la commande entière.

| Champ | Type | Note |
|---|---|---|
| `organizationId`, `venueId`, `orderId`, `prepStationId`, `tableSessionId` | Id | |
| `reference` | string | `A-042-BAR` |
| `tableNumber` | string | **dénormalisé** : la cuisine ne doit pas résoudre trois relations pour afficher « Table 12 » |
| `status` | `held`/`queued`/`started`/`ready`/`recalled`/`served`/`cancelled` | `served` : porté à table — l'index par statut ne garde en « prêt » que ce qui attend le serveur |
| `courseNumber` | number | |
| `priority` | number | |
| `queuedAt?`, `startedAt?`, `readyAt?`, `recalledAt?` | number | quatre champs, pas quatre lignes |
| `startedByMemberId?`, `readyByMemberId?`, `servedAt?`, `servedByMemberId?` | | absents quand l'écran de cuisine agit seul : l'appareil est alors dans `orderEvents` |
| `allergyFlags` | string[] | **remonté au niveau du bon** : une allergie ne doit pas se lire en petit dans une ligne |
| `itemCount` | number | |

**Index** : `by_station_status_queued ["prepStationId","status","queuedAt"]` — **l'index le plus
sollicité du produit** : c'est la requête de l'écran de cuisine, qui tourne en permanence sur chaque
tablette · `by_order ["orderId"]` · `by_venue_status ["venueId","status"]` (tour de contrôle) ·
`by_session ["tableSessionId"]`
**Permissions** : `kitchen.read` / `kitchen.ticket.update`.
**Cycle** : `held` (attend le « fire ») → `queued` → `started` → `ready`. `recalled` revient à
`started` et **laisse une trace dans `orderEvents`** *(R13)* : un plat déclaré prêt par erreur est une
information de service, pas une faute à effacer.

### `kitchenTicketItems`
**Objectif.** Les lignes d'un bon, avec tout ce qu'il faut pour cuisiner **sans aucune jointure**.
**Champs** : `kitchenTicketId`, `orderItemId`, `nameSnapshot`, `variantNameSnapshot?`,
`modifiersSnapshot: string[]`, `quantity`, `instructions?`, `status`, `allergyNote?`.
**Index** : `by_ticket ["kitchenTicketId"]` · `by_order_item ["orderItemId"]`

> **Pourquoi dupliquer les noms ici alors qu'ils sont déjà dans `orderItems`.** L'écran de cuisine se
> rafraîchit en continu sur une tablette d'entrée de gamme. Résoudre `ticket → orderItem → product`
> pour chaque ligne, à chaque rendu, c'est trois lectures par plat multipliées par vingt bons. La
> duplication est le prix d'un écran qui reste fluide en plein coup de feu — et ces valeurs sont des
> snapshots de toute façon immuables.

---

## 9. Additions, paiements, caisse

### `checks`
**Objectif.** L'addition : un regroupement de lignes à payer. **Séparée de la commande** *(D-007)* —
c'est ce qui rend le partage possible sans toucher aux commandes.

| Champ | Type | Note |
|---|---|---|
| `organizationId`, `venueId`, `tableSessionId` | Id | |
| `reference` | string | |
| `label?` | string | « Marcel », « Table entière » |
| `splitMode` | `full`/`by_items`/`by_guest`/`by_amount`/`even` | |
| `status` | `open`/`awaiting_payment`/`partially_paid`/`paid`/`voided` | |
| `subtotal`, `discountTotal`, `taxTotal`, `serviceCharge`, `tipAmount`, `total`, `paidTotal`, `dueTotal` | number | |
| `currency` | string | |
| `guestSessionIds?` | Id[] | si l'addition vise des invités |
| `openedByUserId?`, `closedAt?` | | |

**Index** : `by_session ["tableSessionId"]` · `by_venue_status ["venueId","status"]` (écran caisse) ·
`by_venue_closedAt ["venueId","closedAt"]`
**Permissions** : `check.manage`, lecture par la session invité concernée.
**Invariant** : la somme des paiements alloués ne peut jamais dépasser `total` *(R17)*.

### `checkItems`
**Objectif.** L'allocation d'une ligne de commande à une addition — y compris **partielle**, pour le
plat partagé à deux.
**Pourquoi une table** : sans elle, « je paie mon plat et la moitié de la bouteille » est
impossible à représenter.
**Champs** : `checkId`, `orderItemId`, `tableSessionId`, `quantityShare` (fraction ou quantité),
`amount`, `addedAt`.
**Index** : `by_check ["checkId"]` · `by_order_item ["orderItemId"]` (vérifier qu'une ligne n'est pas
allouée deux fois)
**Invariant** : pour une ligne donnée, la somme des `amount` de toutes ses allocations est égale à son
`lineTotal`. Vérifié à chaque écriture ; c'est ce qui empêche une part de repas de disparaître.

### `paymentIntents`
**Objectif.** Une intention de paiement en ligne, avant toute certitude. Distincte du paiement :
**une intention n'est pas de l'argent**.
**Champs** : `organizationId`, `venueId`, `checkId`, `tableSessionId`, `provider`, `providerRef?`,
`amount`, `currency`, `acceptedAmount?` (le montant réellement accepté par le fournisseur — certains imposent un pas et
arrondissent en silence, voir D-028), `status`
(`created`/`processing`/`awaiting_confirmation`/`succeeded`/`failed`/`expired`), `idempotencyKey`, `guestSessionId?`, `createdByUserId?`, `redirectUrl?`, `expiresAt`, `lastCheckedAt?`,
`failureReason?`.
**Index** : `by_check ["checkId"]` · `by_provider_ref ["provider","providerRef"]` (chemin du webhook) ·
`by_idempotency ["idempotencyKey"]` · `by_status_expires ["status","expiresAt"]` (réconciliation)
**Cycle** : machine §7 d'ARCHITECTURE.md. **Le montant est recalculé côté serveur à la création**,
jamais repris du client *(R14)*.

### `payments`
**Objectif.** De l'argent réellement reçu. La table la plus sensible du produit.

| Champ | Type | Note |
|---|---|---|
| `organizationId`, `venueId`, `checkId`, `tableSessionId` | Id | |
| `method` | `cash`/`mobile_money`/`card`/`external_terminal`/`transfer`/`other` | **l'espèce est de première classe** *(D-019)* |
| `provider?`, `providerRef?` | string | si en ligne |
| `paymentIntentId?` | Id | |
| `amount`, `tipAmount`, `currency` | | |
| `status` | `succeeded`/`voided`/`refunded`/`partially_refunded` | un paiement n'existe que s'il a réussi |
| `collectedByUserId?` | Id | **qui a encaissé** — indispensable à `P2` |
| `guestSessionId?` | Id | si payé par le client lui-même |
| `cashRegisterSessionId?` | Id | rattache l'espèce à une caisse |
| `receivedAmount?`, `changeAmount?` | number | espèces : remis / rendu |
| `idempotencyKey` | string | |
| `voidedReason?`, `voidedByUserId?` | | |
| `createdAt` | number | |

**Index** : `by_check ["checkId"]` · `by_venue_createdAt ["venueId","createdAt"]` (journal de caisse) ·
`by_register_session ["cashRegisterSessionId"]` (attendu de clôture) ·
`by_provider_ref ["provider","providerRef"]` · `by_idempotency ["idempotencyKey"]` ·
`by_venue_method_createdAt ["venueId","method","createdAt"]` (répartition des moyens)
**Permissions** : `payment.read` / `collect` / `void`.
**Cycle** : créé **succeeded** → éventuellement `voided` ou `refunded`. **Jamais supprimé** *(R18)*.

> Le paiement mixte — 15 000 en espèces et 20 000 en Mobile Money sur la même addition — se
> représente naturellement : **deux lignes**, même `checkId`. C'est précisément ce qu'aucun
> concurrent étudié ne traite, et cela ne demande aucune structure supplémentaire.

### `refunds`
**Champs** : `paymentId`, `checkId`, `amount`, `reason` (**obligatoire**), `status`,
`requestedByUserId`, `approvedByUserId?`, `provider?`, `providerRef?`, `idempotencyKey`, `createdAt`.
**Index** : `by_payment ["paymentId"]` · `by_venue_createdAt ["venueId","createdAt"]`
**Permissions** : `payment.refund`. **Toujours auditée.**
**Invariant** : la somme des remboursements d'un paiement ne peut excéder son montant *(R19)*.

### `webhookEvents`
**Objectif.** La mémoire des notifications reçues d'un fournisseur. **C'est cette table qui rend
l'idempotence possible** *(R16)*.
**Champs** : `provider`, `providerEventId` (**unique**), `eventType`, `signatureValid`, `payload`,
`processedAt?`, `processingResult?`, `relatedIntentId?`, `receivedAt`, `replayCount`.
**Index** : `by_provider_event ["provider","providerEventId"]` (unicité — le cœur du mécanisme) ·
`by_processed ["processedAt"]` (rattrapage) · `by_provider_received ["provider","receivedAt"]`
**Cycle** : reçu → traité. **Un second passage du même `providerEventId` ne produit aucun effet.**

### `cashRegisters` / `cashRegisterSessions` / `cashMovements`
**Objectif.** La caisse physique, ses ouvertures, et tout ce qui y entre ou en sort.

`cashRegisters` : `venueId`, `name`, `isActive`.
`cashRegisterSessions` : `venueId`, `cashRegisterId`, `openedByUserId`, `openedAt`, `openingFloat`,
`status` (`open`/`counting`/`closed`), `expectedAmount?`, `countedAmount?`, `discrepancy?`,
`closedByUserId?`, `closedAt?`, `adjustedByUserId?`, `adjustmentReason?`.
`cashMovements` : `registerSessionId`, `type` (`sale`/`refund`/`payout`/`deposit`/`correction`),
`amount`, `reason?`, `createdByUserId`, `paymentId?`, `createdAt`.

**Index** : `by_venue ["venueId"]` · `by_register_status ["cashRegisterId","status"]` (au plus une
session ouverte) · `by_venue_openedAt ["venueId","openedAt"]` · `by_session ["registerSessionId"]`
**Permissions** : `cash_register.open` / `close` / `adjust`.
**Invariant** : `expectedAmount` est **calculé** à partir des paiements en espèces rattachés à la
session, jamais saisi. `discrepancy = countedAmount − expectedAmount`. Toute correction exige un motif
et laisse une trace nominative *(R21)*.

### `bills`  *(et non `receipts`)*
**Objectif.** La pièce remise au client.
**Pourquoi ce nom.** En Côte d'Ivoire, « reçu » désigne le **RNE** (Reçu Normalisé Électronique,
remis au particulier) et « facture » le **FNE** (remis à un professionnel) : ce sont deux pièces
**certifiées par la DGI**. Un ticket non certifié ne peut porter ni l'un ni l'autre de ces noms —
ni dans l'interface, ni dans le code. La table s'appelle donc `bills`, et la pièce porte son type
réel dans `fiscalType` une fois certifiée *(D-024)*.
**Champs** : `organizationId`, `venueId`, `checkId`, `tableSessionId`, `reference`, `snapshot`
(établissement, lignes, taxes, paiements, serveur), `format`, `fiscalType` (`none`/`rne`/`fne`), `fiscalStatus`
(`none`/`pending`/`submitted`/`accepted`/`rejected`), `fiscalReference?`, `fiscalQrPayload?`, `buyerTaxId?`,
`issuedAt`, `deliveredVia` (`screen`/`email`/`print`/`whatsapp`), `storageId?`.
**Index** : `by_check ["checkId"]` · `by_venue_issuedAt ["venueId","issuedAt"]` ·
`by_reference ["reference"]` (vérification publique) · `by_venue_fiscal ["venueId","fiscalStatus"]`
(file de soumission)
**Cycle** : émis → (si le pays l'exige) soumis à l'administration → accepté avec sa référence.

> Les champs `fiscal*` existent **dès maintenant** parce que la conformité est un motif d'achat
> *(A7 révisé, D-020)*, mais ils restent à `none` tant que la spécification d'intégration n'est pas
> en main. Le mot « facture » n'apparaît nulle part dans l'interface avant cela *(D-015)*.

---

## 10. Clients, retours, IA, plateforme

### `customerProfiles`
**Objectif.** Une personne qui a **volontairement** laissé ses coordonnées. L'anonymat reste le
défaut.
**Champs** : `organizationId`, `venueIds: Id[]` (multi-établissement dans un groupe), `phone?`,
`email?`, `name?`, `locale?`, `firstSeenAt`, `lastSeenAt`, `visitCount`, `totalSpent`, `tags`,
`notes?`, `status`.
**Index** : `by_org_phone ["organizationId","phone"]` · `by_org_email ["organizationId","email"]` ·
`by_org_lastSeen ["organizationId","lastSeenAt"]`
**Permissions** : `customer.read` / `customer.manage`.
**Cycle** : créé sur consentement → enrichi → anonymisé sur demande d'effacement (§91).

### `customerConsents`
**Objectif.** La **preuve** du consentement, datée et versionnée. Une table à part, parce qu'un
consentement a un historique : l'écraser rendrait impossible de prouver ce qui avait été accepté, et
quand.
**Champs** : `customerProfileId`, `organizationId`, `purpose` (`marketing_email`/`marketing_sms`/
`marketing_whatsapp`/`loyalty`), `granted`, `source`, `textVersion`, `ipHash?`, `at`.
**Index** : `by_profile_purpose ["customerProfileId","purpose"]` · `by_org_at ["organizationId","at"]`
**Cycle** : **append-only**.

### `feedback`
**Champs** : `organizationId`, `venueId`, `tableSessionId?`, `guestSessionId?`, `rating` (1–5),
`comment?`, `topics: string[]`, `isPublicRedirect`, `status`, `respondedByUserId?`, `createdAt`.
**Index** : `by_venue_createdAt ["venueId","createdAt"]` · `by_venue_rating ["venueId","rating"]`
**Règle** : une note basse ouvre un canal **privé** vers le restaurant ; une note haute peut proposer
un avis public. Aucun filtrage artificiel des avis (§46).

### `aiConversations` / `aiMessages`
**Champs (conversation)** : `organizationId`, `venueId?`, `surface` (`guest`/`manager`/`import`),
`actorType`, `userId?`, `guestSessionId?`, `title?`, `status`, `createdAt`.
**Champs (message)** : `conversationId`, `role`, `content`, `toolCalls?`, `modelKey?`, `createdAt`.
**Index** : `by_org_created ["organizationId","createdAt"]` · `by_conversation_created ["conversationId","createdAt"]`
· `by_user ["userId"]`

### `aiUsage`
**Objectif.** Ce que l'IA a coûté, et à qui. Sans cette table, la facture arrive sans explication.
**Champs** : `organizationId`, `venueId?`, `userId?`, `feature`, `provider`, `model`, `promptTokens`,
`completionTokens`, `costMinor`, `currency`, `latencyMs`, `success`, `errorCode?`, `at`.
**Index** : `by_org_at ["organizationId","at"]` · `by_feature_at ["feature","at"]` ·
`by_model_at ["model","at"]`
**Cycle** : append-only, purgé par agrégation au-delà de la période de rétention.

### `aiActionProposals`
**Objectif.** Une action que l'IA propose et qu'**un humain doit valider** *(D-014)*.
**Champs** : `organizationId`, `venueId`, `proposedByConversationId`, `actionType`, `payload`,
`preview`, `riskLevel` (`low`/`medium`/`high`), `status` (`pending`/`approved`/`rejected`/`executed`/`expired`),
`reviewedByUserId?`, `reviewedAt?`, `executedAt?`, `executionResult?`, `expiresAt`.
**Index** : `by_venue_status ["venueId","status"]` · `by_org_created ["organizationId","_creationTime"]`
**Permissions** : `ai.actions.propose` pour créer, `ai.actions.approve` pour valider — **jamais la
même personne dans le même geste**.

### `dailyMetrics`
**Objectif.** Les agrégats quotidiens précalculés qu'`ANALYTICS.md` §3.5 promet. Sans eux, chaque
ouverture d'un écran d'historique recalculerait des mois de commandes.
**Pourquoi une table et pas un calcul.** Parce que la nuit est le seul moment où ce calcul ne coûte
rien à personne, et parce qu'un agrégat figé permet de comparer deux périodes sans que les chiffres
bougent sous les yeux du gérant.
**Champs** : `venueId`, `businessDate` (`YYYY-MM-DD` **dans la timezone de l'établissement**),
`metrics` (dictionnaire), `breakdowns?`, `currency`, `computedAt`, `sourceVersion`.
**Index** : `by_venue_date ["venueId","businessDate"]`
**Cycle** : écrit par une tâche planifiée · **recalculable** — une correction tardive (remboursement,
annulation) déclenche la reconstruction du jour concerné, ce que `sourceVersion` rend détectable.

### `auditLogs`
**Objectif.** Qui a fait quoi, quand, et sur quoi.
**Champs** : `organizationId`, `venueId?`, `actorType` (`staff`/`device`/`guest`/`system`/`ai`/`platform`), `actorUserId?`,
`actorMemberId?`, `actorDeviceId?` (un geste sous PIN n'a pas de compte : c'est le membre et l'appareil qui répondent),
`action`, `resourceType`, `resourceId?`, `before?`, `after?`, `reason?`, `source` (`web`/`api`/`ai`/`support`),
`ipHash?`, `at`.
**Index** : `by_org_at ["organizationId","at"]` · `by_venue_at ["venueId","at"]` ·
`by_resource ["resourceType","resourceId"]` · `by_actor_at ["actorUserId","at"]`
**Cycle** : append-only. **Ne stocke ni secret, ni jeton, ni donnée de paiement** ; les objets
volumineux sont réduits aux champs modifiés (§53).

### `idempotencyKeys`
**Objectif.** Le garde-fou central du produit *(D-010, R7, R16)*.
**Champs** : `key` (**unique**), `scope`, `organizationId?`, `resultRef?`, `status`
(`in_progress`/`completed`/`failed`), `createdAt`, `expiresAt`.
**Index** : `by_key ["key"]` · `by_expires ["expiresAt"]` (purge)
**Cycle** : créée à l'entrée de la mutation, complétée à la sortie, purgée après expiration. Une
seconde requête portant la même clé **renvoie le premier résultat** au lieu de refaire le travail.

### `bugReports`
**Objectif.** Le signalement depuis l'application, avec son contexte (§47) — une des rares
fonctionnalités qui améliore le produit sans qu'on ait à demander.
**Champs** : `organizationId?`, `venueId?`, `userId?`, `title`, `description`, `screenshotStorageId?`,
`route`, `role?`, `userAgent`, `appVersion`, `consoleErrors?`, `status`, `severity?`, `createdAt`.
**Index** : `by_status_created ["status","createdAt"]` · `by_org ["organizationId"]`
**Interdit** : capturer un jeton, un code à usage unique, une donnée de paiement ou un secret. Le
contexte est filtré **avant** l'envoi, côté client puis re-filtré côté serveur.

### `notificationPreferences`
**Champs** : `organizationId`, `venueId?`, `userId?`, `roleKey?`, `eventType`, `channels`
(`in_app`/`sound`/`push`/`email`/`whatsapp`), `enabled`.
**Index** : `by_venue_event ["venueId","eventType"]` · `by_user ["userId"]`

---

## 11. Les index qui portent le produit

Ces cinq index sont sur le chemin critique. S'ils sont mal conçus, le produit est lent là où ça se
voit le plus.

| Index | Écran servi | Fréquence |
|---|---|---|
| `kitchenTickets.by_station_status_queued` | Écran de cuisine | Permanent, sur chaque tablette |
| `tableSessions.by_venue_status` | Écran serveur, caisse, tour de contrôle | Permanent |
| `products.by_venue_section_sort` | Menu client | À chaque scan |
| `orders.by_venue_status_submitted` | Tour de contrôle, retards | Permanent |
| `payments.by_register_session` | Clôture de caisse | Chaque fin de service |

**Règle de vérification**, à appliquer à toute nouvelle requête : écrire la requête **avant**
l'index, puis vérifier que le premier champ de l'index est une clé de portée et que le dernier champ
filtré ou trié y figure. Si la requête a besoin d'un `.filter()` après l'index sur un volume
significatif, **l'index est faux**.

### Ce que Convex impose, et qui a guidé ces choix

| Limite | Conséquence retenue ici |
|---|---|
| 1 Mo par document | `menuPublications.snapshot` exclut les images et contrôle sa taille à la publication |
| Index limités par table | On reste sous 8 index par table ; aucune table n'approche le plafond |
| Pas de jointure serveur | La dénormalisation est **choisie et justifiée** (`tableNumber` sur le bon, `totals` sur la session), jamais subie |
| `.collect()` charge tout | Interdit sans index de portée ; les listes longues (commandes, paiements, journaux) sont paginées |
| Mutation = transaction | Les invariants d'argent (`R17`, `R19`) sont vérifiés **dans** la mutation, pas après |

---

## 12. Ce qui reste à vérifier avant d'écrire la première migration

1. **Le modèle de tenant dans Better Auth** — décision prise : Better Auth ne fait que l'identité,
   la souveraineté du tenant est à nous *(D-016)*. À confirmer par un prototype d'intégration.
2. **La forme exacte du snapshot de publication** — dépend de la taille réelle d'une grande carte
   traduite. À mesurer sur un menu réel avant de figer.
3. **La spécification FNE** — conditionne les champs `fiscal*` de `bills` *(A7)*.
4. **Le mode de partage d'addition par défaut** — dépend des entretiens terrain.
