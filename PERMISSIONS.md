# PERMISSIONS.md — [PRODUCT_NAME]

> §8 : « Ne pas implémenter uniquement des rôles rigides. Construire un RBAC avec permissions
> granulaires et scope par établissement. » · « Toute vérification importante doit avoir lieu côté
> backend. Le frontend peut cacher les actions interdites mais ne constitue jamais la barrière de
> sécurité. »

---

## 1. Les quatre décisions qui structurent tout

**1. Le catalogue de permissions vit dans le code, pas en base.** *(D-002)*
Une permission est une constante du logiciel : elle naît avec la fonctionnalité qui la protège et
meurt avec elle. La mettre en base créerait une seconde source de vérité à migrer à chaque
déploiement, et empêcherait le type `Permission` d'exister côté TypeScript. Ce sont les **rôles**
qui sont des données — ils appartiennent à l'organisation, qui les compose.

**2. Un rôle est un sac de permissions, pas une identité.** Le code ne demande jamais « est-ce un
serveur ? », il demande « a-t-il `order.create` sur cette venue ? ». C'est ce qui permet à un
restaurant d'avoir un « chef de rang » qui encaisse et un autre qui ne peut pas, sans toucher au
logiciel.

**3. Toute permission est évaluée dans un scope.** Une permission sans établissement ne veut rien
dire : « Manager de Cocody et Plateau » n'est pas « Manager ». Le scope fait partie de la question,
jamais du rôle seul.

**4. La barrière est dans Convex.** L'UI masque, elle ne protège pas. Une action cachée dont la
mutation n'est pas gardée est une faille, pas une fonctionnalité.

---

## 2. Convention de nommage

```
domaine.action[.qualifier]
```

Minuscules, `snake_case` pour les qualifieurs composés, jamais d'espace ni de tiret. Le domaine est
un nom au singulier (`order`, pas `orders`) : on parle du domaine, pas de la table.

Exemples : `order.create` · `payment.refund` · `cash_register.close` · `ai.actions.approve`

**Interdit** : `view_orders`, `manage-menu`, `ORDER_CREATE`. Une seule convention, sinon les alias
se multiplient et l'audit devient impossible.

---

## 3. Catalogue des permissions

Source de vérité : `convex/lib/permissions.ts`. Le tableau ci-dessous est la documentation de ce
fichier ; les deux doivent rester alignés (un test le vérifie — voir §9).

### Organisation

| Permission | Ce qu'elle autorise | Scope |
|---|---|---|
| `organization.manage` | Renommer l'organisation, la configurer, la supprimer | org |
| `organization.billing.manage` | Abonnement, moyen de paiement SaaS, factures | org |
| `organization.analytics.read` | Analytics consolidées **tous établissements** | org |
| `venue.create` | Créer un nouvel établissement | org |

### Établissement

| Permission | Ce qu'elle autorise | Scope |
|---|---|---|
| `venue.read` | Voir l'établissement et ses réglages | venue |
| `venue.manage` | Modifier réglages, horaires, modes de service, branding | venue |
| `venue.settings.service` | Changer le **mode de service** (§1) — sensible, sépare du reste | venue |

### Carte

| Permission | Ce qu'elle autorise | Scope |
|---|---|---|
| `menu.read` | Consulter la carte en back-office | venue |
| `menu.edit` | Créer/modifier produits, sections, options | venue |
| `menu.publish` | **Publier** une version de carte (la rendre visible aux clients) | venue |
| `menu.price.edit` | Modifier un **prix** — séparé de `menu.edit`, c'est un acte financier | venue |
| `menu.availability.toggle` | Rendre un produit disponible/indisponible (geste de service) | venue |

> Pourquoi séparer `menu.price.edit` : un chef de rang doit pouvoir signaler une rupture sans pouvoir
> changer les prix. Fusionner les deux, c'est choisir entre paralyser le service et ouvrir la caisse.

### Salle et tables

| Permission | Ce qu'elle autorise | Scope |
|---|---|---|
| `table.read` | Voir les tables et leur état | venue |
| `table.manage` | Créer/déplacer/supprimer des tables, éditer le plan de salle | venue |
| `table.session.open` | Ouvrir une session de table | venue |
| `table.session.close` | Clôturer une session, **écart de caisse compris** | venue |
| `table.session.close_with_debt` | Clôturer une session **sur laquelle il reste un dû** — renoncer à de l'argent | venue |
| `table.session.transfer` | Déplacer des clients, fusionner/scinder des tables | venue |
| `table.qr.manage` | Générer, révoquer, réimprimer un QR | venue |

### Commandes

| Permission | Ce qu'elle autorise | Scope |
|---|---|---|
| `order.read` | Voir les commandes | venue |
| `order.create` | Créer/envoyer une commande | venue |
| `order.accept` | Accepter une commande client en attente de validation | venue |
| `order.modify` | Modifier une commande avant production | venue |
| `order.modify.after_fire` | Modifier **après** envoi en production — coûte des denrées | venue |
| `order.cancel` | Annuler une commande ou une ligne | venue |
| `order.discount.apply` | Appliquer une remise | venue |
| `order.course.fire` | Déclencher un service en attente (« fire ») | venue |

### Production (cuisine / bar)

| Permission | Ce qu'elle autorise | Scope |
|---|---|---|
| `kitchen.read` | Voir l'écran de production | venue |
| `kitchen.ticket.update` | Démarrer / marquer prêt / rappeler un ticket | venue |
| `kitchen.manage` | Configurer stations, priorités, délais cibles | venue |

### Service

| Permission | Ce qu'elle autorise | Scope |
|---|---|---|
| `service_request.read` | Voir les demandes clients | venue |
| `service_request.handle` | Prendre en charge / résoudre une demande | venue |

### Encaissement

| Permission | Ce qu'elle autorise | Scope |
|---|---|---|
| `payment.read` | Voir les paiements | venue |
| `payment.collect` | Encaisser | venue |
| `payment.refund` | Rembourser | venue |
| `payment.void` | Annuler un paiement enregistré par erreur | venue |
| `check.manage` | Créer, scinder, fusionner des additions | venue |
| `bill.reissue` | Ré-émettre ou renvoyer un ticket au client | venue |
| `bill.reissue` | Ré-émettre ou renvoyer un ticket au client | venue |
| `cash_register.open` | Ouvrir une session de caisse | venue |
| `cash_register.close` | Clôturer, déclarer le compté — **y compris avec un écart** | venue |
| `cash_register.adjust` | Corriger un écart — **toujours audité** | venue |

### Clients et fidélité

| Permission | Ce qu'elle autorise | Scope |
|---|---|---|
| `customer.read` | Voir les profils clients | venue |
| `customer.manage` | Modifier, fusionner, supprimer (RGPD) | venue |
| `loyalty.manage` | Configurer points, récompenses, coupons | venue |
| `reservation.read` / `reservation.manage` | Réservations et liste d'attente | venue |

### Stock *(différé en V1, catalogue déjà réservé)*

| Permission | Scope |
|---|---|
| `inventory.read` · `inventory.manage` · `inventory.count` · `inventory.waste.declare` | venue |

### Équipe

| Permission | Ce qu'elle autorise | Scope |
|---|---|---|
| `team.read` | Voir les membres | org/venue |
| `team.manage` | Inviter, retirer, affecter à un établissement | org/venue |
| `permissions.manage` | Créer/modifier des rôles et leurs permissions | org |
| `device.manage` | Enrôler/révoquer un appareil (KDS, caisse) | venue |

### Données

| Permission | Ce qu'elle autorise | Scope |
|---|---|---|
| `analytics.read` | Analytics de l'établissement | venue |
| `analytics.financial.read` | Marges, coûts, CA consolidé — séparé du reste | venue |
| `audit.read` | Journal d'audit | org/venue |
| `export.data` | Exporter (CSV/Excel) — surface d'exfiltration, donc à part | venue |

### IA

| Permission | Ce qu'elle autorise | Scope |
|---|---|---|
| `ai.use` | Poser des questions à l'assistant | venue |
| `ai.actions.propose` | Demander à l'IA de préparer une action | venue |
| `ai.actions.approve` | **Valider** une action proposée par l'IA | venue |

> `ai.actions.approve` n'est jamais accordée au même niveau que `ai.actions.propose` par défaut :
> c'est la séparation qui empêche l'IA d'agir seule (§35).

### Plateforme (équipe [PRODUCT_NAME] uniquement)

Ces permissions ne sont **jamais** attribuables par une organisation. Elles vivent dans une table
distincte (`platformAdmins`) et une garde distincte (`requirePlatformAdmin`).

| Permission | Ce qu'elle autorise |
|---|---|
| `platform.organizations.read` | Voir les organisations |
| `platform.organizations.manage` | Suspendre, changer de plan |
| `platform.impersonate` | Accéder au contexte d'un client — **audité, motif obligatoire, durée limitée** |
| `platform.support.manage` · `platform.flags.manage` · `platform.incidents.manage` · `platform.audit.read` | Support, drapeaux, incidents, audit |

---

## 4. Rôles prédéfinis

Ce sont des **modèles**, copiés dans l'organisation à sa création. Une organisation peut ensuite les
modifier : ce ne sont pas des constantes du logiciel.

| Rôle | Scope naturel | Permissions (résumé) |
|---|---|---|
| **Owner** | organisation | Tout, y compris `organization.*` et `permissions.manage` |
| **Organization Admin** | organisation | Tout sauf `organization.billing.manage` et suppression |
| **Venue Manager** | venue(s) | `venue.manage`, carte complète, commandes, caisse, équipe locale, analytics |
| **Floor Manager** | venue(s) | Tables, sessions, commandes, demandes, `menu.availability.toggle`, pas les prix |
| **Waiter** | venue(s) | `order.*` (sans `after_fire` ni remise), tables, demandes, `menu.read` |
| **Cashier** | venue(s) | `payment.collect`, `check.manage`, `cash_register.open/close`, `order.read` |
| **Kitchen** | venue(s) | `kitchen.read`, `kitchen.ticket.update`, `menu.availability.toggle` |
| **Bar** | venue(s) | Identique à Kitchen, restreint aux stations bar |
| **Menu Manager** | venue(s) | `menu.*` y compris `menu.price.edit` et `menu.publish` |
| **Accountant** | organisation | `payment.read`, `analytics.financial.read`, `export.data`, `audit.read` — **aucune écriture** |
| **Analyst** | organisation | `analytics.read`, `analytics.financial.read` en lecture seule |
| **Support (client)** | venue(s) | Lecture large, aucune action financière |

**Custom Role** : une organisation compose son propre sac de permissions. Interdits : les permissions
`platform.*`, et l'auto-élévation (voir §6).

### Matrice des différences qui comptent

| | Waiter | Floor Manager | Cashier | Venue Manager |
|---|:---:|:---:|:---:|:---:|
| `order.create` | ✅ | ✅ | ❌ | ✅ |
| `order.modify.after_fire` | ❌ | ✅ | ❌ | ✅ |
| `order.discount.apply` | ❌ | ✅ | ❌ | ✅ |
| `menu.availability.toggle` | ❌ | ✅ | ❌ | ✅ |
| `menu.price.edit` | ❌ | ❌ | ❌ | ✅ |
| `payment.collect` | ❌¹ | ✅ | ✅ | ✅ |
| `payment.refund` | ❌ | ❌ | ❌ | ✅ |
| `cash_register.adjust` | ❌ | ❌ | ❌ | ✅ |
| `analytics.financial.read` | ❌ | ❌ | ❌ | ✅ |

¹ Dans beaucoup d'établissements le serveur encaisse. C'est précisément pourquoi c'est une
permission et non un rôle : le restaurant coche la case, sans que le logiciel change.

---

## 5. Modèle de données

```ts
// convex/lib/permissions.ts — source de vérité, en code
export const PERMISSIONS = {
  "organization.manage": { label: "Gérer l'organisation", scope: "organization", sensitive: true },
  "order.create":        { label: "Créer une commande",   scope: "venue" },
  "payment.refund":      { label: "Rembourser",            scope: "venue", sensitive: true, audited: true },
  // …
} as const;

export type Permission = keyof typeof PERMISSIONS;
```

```ts
// convex/schema.ts (extrait)
organizationMembers: { organizationId, userId, status, invitedByUserId?, joinedAt }
  .index("by_org_user",  ["organizationId", "userId"])
  .index("by_user",      ["userId"])                      // « mes organisations »

roles: { organizationId?, key, label, permissions: string[], isSystemTemplate, isCustom }
  .index("by_org", ["organizationId"])                    // organizationId absent = modèle système

memberRoleAssignments: { organizationId, memberId, roleId, scopeType: "organization"|"venue", venueId? }
  .index("by_member",      ["memberId"])
  .index("by_org_venue",   ["organizationId", "venueId"])
```

**Pourquoi trois tables et pas un champ `role` sur le membre.** Un même membre est souvent
« Manager à Cocody **et** Serveur à Plateau ». Un champ unique force à créer deux comptes pour la
même personne — et c'est ainsi qu'on perd la trace de qui a fait quoi.

---

## 6. Algorithme de résolution

```
resolve(userId, organizationId, venueId?) → Set<Permission>

1. membre ← organizationMembers by_org_user(organizationId, userId)
   absent ou status ≠ "active" → ∅   (et l'appelant renvoie « introuvable », pas « interdit »)
2. affectations ← memberRoleAssignments by_member(membre._id)
3. applicables ← affectations où
      scopeType = "organization"                       (vaut pour tous les établissements)
   ou (scopeType = "venue" et venueId = celui demandé)
4. permissions ← union des roles[affectation.roleId].permissions
5. si le plan de l'organisation ne couvre pas la fonctionnalité (entitlements),
   retirer les permissions correspondantes                       ← le plan rétrécit, jamais n'élargit
```

Deux propriétés à ne jamais casser :

- **L'union, pas l'intersection.** Deux rôles sur la même venue s'additionnent.
- **Le plan tarifaire ne donne jamais un droit.** Il peut seulement en retirer. Un bug d'entitlement
  ne doit jamais ouvrir une permission.

### Les gardes Convex

```ts
requireUser(ctx)                                  → identité authentifiée
requireOrganizationMember(ctx, organizationId)    → membre actif
requireVenueAccess(ctx, venueId)                  → la venue appartient bien à l'org du membre
requirePermission(ctx, "order.create", { venueId })→ la garde à utiliser par défaut
requirePlatformAdmin(ctx, "platform.impersonate") → chemin totalement séparé
```

**Règle sans exception : toute fonction Convex publique qui lit ou écrit une donnée métier commence
par une de ces gardes.** Une fonction publique sans garde est un défaut bloquant en revue.

```ts
export const createOrder = mutation({
  args: { venueId: v.id("venues"), tableSessionId: v.id("tableSessions"), items: v.array(orderItemInput) },
  handler: async (ctx, args) => {
    const actor = await requirePermission(ctx, "order.create", { venueId: args.venueId });
    // …le venueId est vérifié AVANT toute lecture — jamais après
  },
});
```

### L'erreur de scoping qui fuit, et comment on l'évite

```ts
// ❌ Fuite : on lit d'abord, on vérifie ensuite. Le document d'une autre organisation a déjà été lu.
const order = await ctx.db.get(args.orderId);
await requirePermission(ctx, "order.read", { venueId: order.venueId }); // vérifie l'org DE LA CIBLE

// ✅ On part du scope de l'appelant, et la cible doit y appartenir.
const actor = await requirePermission(ctx, "order.read", { venueId: args.venueId });
const order = await ctx.db.get(args.orderId);
if (!order || order.venueId !== args.venueId) throw new ConvexError("NOT_FOUND");
```

La seconde forme renvoie `NOT_FOUND` et non `FORBIDDEN` : répondre « interdit » sur un identifiant
d'une autre organisation confirme son existence.

---

## 7. Élévation de privilèges : les trois verrous

1. **On ne peut pas donner ce qu'on n'a pas.** Attribuer un rôle exige `team.manage` **et** de
   posséder soi-même toutes les permissions du rôle attribué.
2. **On ne peut pas s'auto-promouvoir.** Modifier ses propres affectations est refusé, même avec
   `permissions.manage`. Le dernier Owner d'une organisation ne peut pas non plus se retirer.
3. **Aucune permission `platform.*` n'est attribuable** par une organisation, même à un rôle
   personnalisé. Filtrée à l'écriture, pas seulement masquée dans l'UI.

---

## 8. Côté frontend

```tsx
const can = usePermissions(venueId);          // résolu côté serveur, mis en cache réactif
{can("payment.refund") && <RefundButton />}   // masquer, pour ne pas proposer un mur
```

Trois règles :

- **Masquer, pas désactiver.** Un bouton grisé qu'on ne pourra jamais activer est une frustration ;
  sauf si l'absence rend l'écran incompréhensible — alors on l'affiche avec la raison.
- **Ne jamais dériver un droit d'un nom de rôle côté client** (`if (role === "waiter")`). C'est le
  retour des rôles rigides par la fenêtre.
- **Prévoir l'état « permission refusée »** comme un état d'écran à part entière (§99), avec qui
  contacter.

---

## 9. Ce qui est testé (§97)

| Test | Ce qu'il prouve |
|---|---|
| Catalogue ↔ documentation alignés | Aucune permission n'existe sans être documentée, et réciproquement |
| Chaque fonction publique Convex appelle une garde | Détection statique ; une exception doit être déclarée explicitement |
| Un membre de l'org A ne lit rien de l'org B | Isolation multi-tenant — le test le plus important du produit |
| Un Manager de Cocody est refusé sur Plateau | Le scope par établissement tient |
| Un serveur sans `payment.refund` reçoit un refus **côté serveur** malgré l'UI masquée | La barrière n'est pas dans l'UI |
| On ne peut pas attribuer un rôle plus puissant que le sien | Verrou 1 |
| On ne peut pas modifier ses propres droits | Verrou 2 |
| Un rôle personnalisé ne peut pas contenir `platform.*` | Verrou 3 |
| Retirer une permission via le plan ne casse pas la lecture | Les entitlements rétrécissent sans planter |

---

## 10. Journalisation

Toute permission marquée `audited` écrit dans `auditLogs` : acteur, organisation, établissement,
action, ressource, avant/après, motif si exigé, source (`web`/`api`/`ai`/`support`), horodatage.

Exigent un **motif écrit** : `cash_register.adjust`, `payment.refund`, `payment.void`,
`order.modify.after_fire`, `table.session.close_with_debt`, `platform.impersonate`, toute
modification de rôle.

> **Pourquoi `cash_register.close` n'exige pas de motif, mais `cash_register.adjust` oui.**
> Un écart constaté est une donnée : l'interdire de clôture obligerait Mariam à appeler son
> manager chaque soir où la caisse ne tombe pas juste — et à force, quelqu'un « arrangerait »
> le comptage pour rentrer chez lui. Ce qui exige un motif, c'est de **corriger** l'écart,
> c'est-à-dire de le faire disparaître des comptes.

---

## 11. Anti-patterns à bloquer en revue

1. ❌ `if (user.role === "manager")` dans une fonction Convex ou un composant.
2. ❌ Une mutation publique sans garde, parce que « l'UI ne montre pas le bouton ».
3. ❌ Lire le document **puis** vérifier la permission avec le scope du document lu.
4. ❌ Une permission créée sans entrée dans le catalogue et dans ce fichier.
5. ❌ Un nouveau **rôle codé en dur** pour couvrir un besoin métier : c'est une **permission** qu'il
   faut créer, que l'organisation attribuera à qui elle veut.
6. ❌ Un plan tarifaire qui **ajoute** une permission.
7. ❌ Répondre `FORBIDDEN` sur une ressource d'une autre organisation (fuite d'existence).
8. ❌ Accorder `ai.actions.approve` par défaut au même rôle que `ai.actions.propose`.
