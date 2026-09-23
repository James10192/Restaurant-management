# ARCHITECTURE.md — Joliba

> Livrable §112. Les versions exactes des dépendances et leur compatibilité vivent dans
> [`docs/research/stack-compatibility.md`](docs/research/stack-compatibility.md).
> Le détail table par table vit dans [`DATA_MODEL.md`](DATA_MODEL.md).

---

## 1. Contexte système

```mermaid
graph TB
    subgraph clients["Personnes"]
        G["Client à table<br/>(navigateur mobile, sans compte)"]
        W["Serveur<br/>(smartphone)"]
        K["Cuisine / Bar<br/>(tablette murale)"]
        C["Caissier<br/>(tablette / desktop)"]
        M["Manager / Propriétaire<br/>(desktop + mobile)"]
        P["Équipe Joliba<br/>(back-office plateforme)"]
    end

    subgraph edge["Vercel — TanStack Start (SSR + SPA)"]
        PUB["Site public<br/>landing, tarifs, blog, menus publics"]
        GUEST["Application client<br/>/r/:venue/t/:token"]
        APP["Application restaurant<br/>/app/*"]
        ADMIN["Back-office plateforme<br/>/admin/*"]
        SRV["Fonctions serveur<br/>webhooks, sitemap, OG, impression"]
    end

    subgraph convex["Convex — état, temps réel, métier"]
        Q["Queries réactives"]
        MU["Mutations transactionnelles"]
        ACT["Actions<br/>(appels sortants)"]
        SCH["Tâches planifiées / crons"]
        DB[("Base de données<br/>+ index + recherche")]
        FILES[("Stockage fichiers")]
    end

    subgraph ext["Services externes"]
        AUTH["Better Auth<br/>OTP e-mail + Google"]
        PSP["Fournisseurs de paiement<br/>(abstraction PaymentProvider)"]
        MAIL["E-mail transactionnel"]
        LLM["Modèles IA<br/>(via abstraction)"]
        ANA["Analytics produit"]
        OBS["Erreurs / traces"]
    end

    G --> GUEST
    W --> APP
    K --> APP
    C --> APP
    M --> APP
    P --> ADMIN

    GUEST <-->|"WebSocket réactif"| Q
    APP <-->|"WebSocket réactif"| Q
    GUEST --> MU
    APP --> MU
    ADMIN --> MU

    Q --> DB
    MU --> DB
    ACT --> DB
    SCH --> MU
    ACT --> PSP
    ACT --> MAIL
    ACT --> LLM
    MU -.->|"programme"| ACT

    PSP -->|"webhook signé"| SRV
    SRV -->|"mutation idempotente"| MU
    APP --> AUTH
    AUTH --> DB
    APP --> ANA
    PUB --> ANA
    APP --> OBS
```

**Ce que ce schéma impose :**

- **Aucun secret côté navigateur.** Clés PSP, clés de modèles IA, clés e-mail : uniquement dans des
  *actions* Convex ou des fonctions serveur. Le client n'appelle jamais un tiers directement.
- **Les webhooks n'entrent pas par Convex directement** mais par une fonction serveur qui vérifie la
  signature, puis appelle une mutation **idempotente**. La vérification de signature exige le corps
  brut : c'est ce qui décide de ce point d'entrée.
- **Le temps réel n'est pas une option** : les écrans d'exploitation sont des abonnements Convex, pas
  des interrogations périodiques.

---

## 2. Modules

```mermaid
graph LR
    subgraph socle["Socle"]
        IDEN["identity<br/>utilisateurs, organisations,<br/>membres, invitations"]
        ACC["access<br/>rôles, permissions,<br/>portées, appareils"]
        VEN["venues<br/>établissements, réglages,<br/>zones, modes de service"]
        BIL["billing<br/>plans, abonnements,<br/>droits d'usage"]
    end

    subgraph service["Service"]
        MENU["menu<br/>cartes, produits, options,<br/>disponibilité, publications"]
        FLOOR["floor<br/>tables, plan de salle, QR"]
        SESS["sessions<br/>sessions de table,<br/>invités, demandes"]
        ORD["ordering<br/>paniers, commandes,<br/>services, événements"]
        KIT["kitchen<br/>stations, bons, états"]
    end

    subgraph argent["Argent"]
        CHK["checks<br/>additions, partage"]
        PAY["payments<br/>tentatives, paiements,<br/>remboursements, webhooks"]
        CASH["cash<br/>caisses, sessions,<br/>mouvements"]
        REC["bills<br/>tickets, fiscalité par pays"]
    end

    subgraph valeur["Valeur"]
        CRM["customers<br/>profils, consentements,<br/>fidélité, avis"]
        RES["reservations"]
        ANL["analytics<br/>agrégats, indicateurs"]
        AI["ai<br/>assistants, propositions,<br/>traçage d'usage"]
        INT["integrations<br/>clés d'API, webhooks sortants"]
    end

    PLAT["platform<br/>support, incidents,<br/>drapeaux, audit"]

    IDEN --> ACC
    ACC --> VEN
    BIL -.->|"restreint"| VEN
    VEN --> MENU & FLOOR
    FLOOR --> SESS
    MENU --> ORD
    SESS --> ORD
    ORD --> KIT
    ORD --> CHK
    CHK --> PAY
    PAY --> CASH
    PAY --> REC
    SESS --> CRM
    RES --> SESS
    ORD & PAY & KIT --> ANL
    ANL --> AI
    MENU --> AI
    PLAT -.->|"observe"| IDEN
```

**Règles de dépendance, vérifiées en revue :**

1. Les flèches ne remontent jamais. `menu` ignore l'existence de `payments`.
2. Un module ne lit pas la table d'un autre : il passe par la fonction exposée par ce module.
3. `billing` **restreint** (droits d'usage), il n'accorde jamais — un bug d'abonnement ne doit pas
   ouvrir une porte (*PERMISSIONS.md §6*).
4. `platform` est isolé : garde distincte, permissions distinctes, jamais attribuables à un client.

---

## 3. Le multi-tenant, concrètement

```mermaid
graph TD
    O["organization<br/><i>le tenant — porte l'abonnement</i>"]
    V1["venue · Cocody"]
    V2["venue · Plateau"]
    V3["venue · Marcory"]
    U["user<br/><i>une personne, un compte</i>"]
    MB["organizationMember<br/><i>cette personne dans cette organisation</i>"]
    A1["affectation<br/>rôle Manager · portée Cocody"]
    A2["affectation<br/>rôle Serveur · portée Plateau"]

    O --> V1 & V2 & V3
    U --> MB
    O --> MB
    MB --> A1 & A2
    A1 -.-> V1
    A2 -.-> V2
    MB -. "aucun accès" .-> V3
```

**Trois invariants non négociables :**

- **`organizationId` sur toute table métier.** Sans exception. `venueId` en plus dès que la donnée
  est locale à un établissement.
- **La portée se résout depuis l'appelant, avant de toucher une donnée** — et tout document atteint
  par clé étrangère est **re-vérifié** contre cette portée (`order.venueId === args.venueId`).
  C'est **cela** qui protège du franchissement de tenant. Le contre-exemple et sa correction sont
  dans `PERMISSIONS.md §6` : lire puis vérifier, c'est avoir déjà lu.
- **Un index n'a besoin d'un préfixe de portée que s'il est atteignable directement par un
  identifiant fourni par le client, sans garde préalable.** Ceux-là portent la marque
  `SCOPE-CRITIQUE` dans le schéma. Les autres (`orders.by_session`, `orderItems.by_order`) ne sont
  atteints qu'après une garde : y préfixer `venueId` n'ajouterait aucune sécurité, seulement du
  stockage.

> **Correction assumée.** Une version antérieure de ce document exigeait une clé de portée en tête
> de *chaque* index. La règle était **inapplicable** — 78 index sur 142 y dérogeaient légitimement —
> et une règle que la majorité du code viole n'est plus une règle : c'est du bruit qui apprend au
> relecteur à passer outre. Elle est remplacée par celle qui protège réellement.

---

## 4. Cycle de vie d'une session de table

```mermaid
stateDiagram-v2
    [*] --> open : ouverture (scan, serveur, ou réservation installée)
    open --> ordering : première commande envoyée
    ordering --> ordering : commande suivante
    ordering --> billing : addition demandée
    billing --> ordering : le client recommande
    billing --> settling : paiement partiel enregistré
    settling --> settling : autre paiement
    settling --> closed : solde à zéro
    billing --> closed : solde à zéro en une fois
    open --> abandoned : aucune commande, délai dépassé
    ordering --> closed_with_debt : clôture forcée (permission + motif)
    billing --> closed_with_debt : clôture forcée (permission + motif)
    closed --> [*]
    closed_with_debt --> [*]
    abandoned --> [*]
```

- **Une session sans table existe** : `fast_food` et `food_court` sont des types d'établissement
  déclarés, et on n'y sert pas à table. `restaurantTables` porte alors une table logique
  « comptoir » ou « à emporter » par point de vente — plutôt que de rendre `tableId` facultatif,
  ce qui ferait porter le cas particulier à tout le reste du schéma. *(CRITIQUE.md.)*
- Une table n'a **au plus une** session non terminale (*R1*). Garanti par un index unique logique
  `by_table_active` et une vérification transactionnelle à l'ouverture.
- `closed_with_debt` existe parce que la réalité existe : un client part sans payer. Le nier
  produirait des sessions ouvertes pour toujours, qui pourrissent la caisse et les analytics. Cet
  état exige une permission et un motif écrit, et il est compté dans les anomalies (§36).
- `abandoned` est prononcé par une tâche planifiée : un scan sans commande n'immobilise pas la table.

---

## 5. Cycle de vie d'une commande

C'est la machine la plus sensible du produit : elle porte les trois modes de service (§2 de
`PRODUCT.md`) **sans se dupliquer**.

```mermaid
stateDiagram-v2
    [*] --> draft : le panier existe
    draft --> submitted : envoi

    submitted --> pending_payment : si venue.paymentTiming = pre_paid
    pending_payment --> accepted : paiement confirmé côté serveur
    pending_payment --> cancelled : abandon ou expiration

    submitted --> pending_acceptance : si venue.orderingMode = guest_with_approval
    pending_acceptance --> accepted : le personnel accepte
    pending_acceptance --> rejected : le personnel refuse (motif)

    submitted --> accepted : si guest_direct ou staff_only

    accepted --> in_preparation : premier bon démarré
    in_preparation --> partially_ready : une partie des bons prêts
    partially_ready --> ready : tous les bons prêts
    in_preparation --> ready : tous les bons prêts d'un coup

    ready --> partially_served : une partie servie
    partially_served --> served : tout servi
    ready --> served : tout servi d'un coup

    served --> closed : rattachée à une addition soldée

    accepted --> cancelled : annulation avant production
    in_preparation --> partially_cancelled : annulation de lignes (permission + motif)
    partially_cancelled --> in_preparation
    rejected --> [*]
    cancelled --> [*]
    closed --> [*]
```

**Ce que cette machine règle :**

- Les trois modes convergent sur `accepted`. **Aucune branche de code supplémentaire** : la
  transition sortante de `submitted` est choisie par lecture des réglages de l'établissement
  (*D-011*). Ajouter un quatrième mode, c'est ajouter une transition, pas un `if` dans dix fichiers.
- **Aucun bon de production n'existe avant `accepted`** (*R8*). En `pre_paid`, la cuisine ne voit
  rien tant que le paiement n'est pas confirmé **côté serveur** (*R15*).
- `partially_*` existe parce qu'une table de quatre reçoit rarement ses quatre plats en même temps.
  Sans cet état, le serveur ne sait pas quoi porter.
- Chaque transition écrit un `orderEvent` : horodatage, acteur, source. C'est ce qui rend possible
  « qu'est-ce qui a ralenti le service hier soir ? » (§34) — sans journal, l'IA n'aurait rien à lire.

---

## 6. De la commande aux bons de production

```mermaid
flowchart LR
    O["Commande · Table 12<br/>2 cocktails, 2 burgers, 1 dessert"]
    O --> R{"Routage par<br/>station du produit"}
    R -->|bar| T1["Bon A-041 · BAR<br/>2 cocktails"]
    R -->|cuisine| T2["Bon A-042 · CUISINE<br/>2 burgers · ⚠ sans oignon"]
    R -->|pâtisserie| T3["Bon A-043 · PÂTISSERIE<br/>1 dessert · service 4"]
    T1 --> S1["queued → started → ready → recalled?"]
    T2 --> S2["queued → started → ready"]
    T3 --> H["held<br/><i>attend le déclenchement du service</i>"]
    H --> S3["queued → started → ready"]
    S1 & S2 & S3 --> AGG{"Tous prêts ?"}
    AGG -->|non| PR["commande = partially_ready"]
    AGG -->|oui| RD["commande = ready<br/>→ le serveur est prévenu"]
```

L'état de la commande est **dérivé** de ses bons, jamais saisi à la main (*R12*). Une seule source
de vérité : les bons. Le dessert attend en `held` jusqu'au « fire » du serveur — c'est ce qui évite
la glace servie avec le plat.

---

## 7. Cycle de vie d'un paiement

```mermaid
stateDiagram-v2
    [*] --> created : intention créée (montant calculé SERVEUR)
    created --> processing : le client est envoyé chez le fournisseur
    processing --> awaiting_confirmation : il revient (la redirection ne prouve RIEN)
    awaiting_confirmation --> succeeded : vérification serveur OU webhook signé
    awaiting_confirmation --> failed : refus confirmé
    processing --> expired : délai dépassé
    succeeded --> partially_refunded : remboursement partiel
    partially_refunded --> refunded : remboursement complet
    succeeded --> refunded : remboursement total
    succeeded --> voided : annulation d'une saisie erronée (permission + motif)
    failed --> [*]
    expired --> [*]
    refunded --> [*]
    voided --> [*]
    succeeded --> [*]
```

```mermaid
sequenceDiagram
    participant C as Client
    participant A as Application
    participant CX as Convex
    participant P as Fournisseur
    participant WH as Fonction serveur (webhook)

    C->>A: « Payer 35 000 »
    A->>CX: createPaymentIntent(checkId, clé d'idempotence)
    Note over CX: le montant est RECALCULÉ ici.<br/>Celui envoyé par le client est ignoré (R14).
    CX->>P: initialize(montant, référence, clé)
    P-->>CX: url + référence fournisseur
    CX-->>A: url
    A->>C: redirection
    C->>P: paie (Mobile Money / carte)
    par Retour client
        P-->>A: redirection « succès »
        A->>CX: verify(référence)
        Note over A: la redirection n'est qu'un indice.<br/>Seule la vérification fait foi (R15).
    and Webhook
        P-->>WH: POST signé
        WH->>WH: vérifie la signature sur le corps BRUT
        WH->>CX: recordWebhook(id fournisseur)
        Note over CX: déjà traité ? → on ne refait rien (R16).
    end
    CX->>CX: alloue le paiement à l'addition, met à jour le solde
    CX-->>C: reçu (temps réel)
```

**Les quatre pièges traités ici, et nulle part ailleurs :**

| Piège | Traitement |
|---|---|
| Double clic sur « Payer » | Clé d'idempotence portée par le client, unique par (addition, tentative) |
| Webhook livré deux fois | `webhookEvents` unique sur l'identifiant fournisseur ; second passage = aucun effet |
| Paiement réussi, webhook en retard | Le retour client déclenche `verify` ; les deux chemins convergent sur la même mutation idempotente |
| Client hors ligne après paiement | La vérité est côté serveur ; il retrouve son reçu au rechargement, et la caisse voit le paiement |

---

## 8. Session de caisse

```mermaid
stateDiagram-v2
    [*] --> open : ouverture avec fonds de caisse déclaré
    open --> open : encaissement, sortie autorisée, entrée
    open --> counting : début du comptage
    counting --> balanced : compté = attendu
    counting --> discrepancy : écart constaté
    discrepancy --> closed : clôture AVEC l'écart (le caissier suffit)
    discrepancy --> adjusted : correction (permission dédiée + motif) — AUDITÉE
    balanced --> closed
    adjusted --> closed
    closed --> [*]
```

Un établissement ne peut avoir qu'**une** session ouverte par caisse. L'attendu se calcule à partir
des paiements en espèces attribués à la session, jamais saisi. L'écart n'est pas une honte à cacher :
c'est une donnée, et sa correction laisse une trace nominative (*R21*).

---

## 9. Architecture frontend

```
src/
├── routes/                    # TanStack Start — fines, elles orchestrent, elles ne décident pas
│   ├── (marketing)/           # public, SSR, indexable
│   ├── r/$venueSlug/t/$token/ # client à table — NOINDEX, jamais de token indexé
│   ├── menu/$venueSlug/       # menu public indexable (si le restaurant l'active)
│   ├── app/                   # application restaurant (authentifiée)
│   └── admin/                 # plateforme
├── features/                  # le métier vit ici
│   ├── auth/ menu/ floor/ sessions/ ordering/ kitchen/
│   ├── checks/ payments/ cash/ customers/ analytics/ ai/ team/
│   └── <feature>/{components,hooks,lib,types}.ts + index.ts
├── components/
│   ├── ui/                    # shadcn — primitives, aucun métier
│   ├── guest/                 # système « client » : aéré, photo, gros boutons
│   └── ops/                   # système « exploitation » : dense, tabulaire, raccourcis
├── lib/                       # convex client, formatage argent/date, i18n, analytics, erreurs
└── styles/
```

**Quatre règles de structure :**

1. **Une route ne contient pas de règle métier.** Elle assemble des composants de `features/`. Si un
   fichier de `routes/` dépasse ~150 lignes, la logique est au mauvais endroit.
2. **Une feature n'importe pas une autre feature** sauf par son `index.ts`. Interdit :
   `features/payments/lib/internal.ts` importé depuis `features/orders/`. Cela évite les
   dépendances circulaires que le brief redoute (§55).
3. **`components/ui` ne connaît aucun métier.** Il ne sait pas ce qu'est une commande.
4. **`guest/` et `ops/` partagent les jetons de design, pas la densité** (§67). Un même bouton, deux
   échelles.

**Rendu et données**

| Surface | Stratégie | Pourquoi |
|---|---|---|
| Landing, blog, menus publics | SSR + cache | SEO et vitesse sur réseau faible |
| Menu client (session de table) | SSR de la coquille + abonnement temps réel | Première image immédiate, puis disponibilités vivantes |
| Application restaurant | SPA authentifiée + abonnements | Tout y change en permanence |
| KDS | Abonnement seul, aucun polling | Le retard se voit à l'œil nu |

`TanStack Query` n'est utilisé **que** pour ce qui n'est pas dans Convex (appels serveur ponctuels,
tiers). Pour les données Convex, l'abonnement réactif est déjà la bonne réponse : ajouter un cache
par-dessus créerait deux vérités.

---

## 10. Architecture backend

```
convex/
├── schema.ts
├── lib/              auth.ts · permissions.ts · guards.ts · scope.ts
│                     money.ts · ids.ts · idempotency.ts · audit.ts
│                     rateLimiter.ts · errors.ts · time.ts
├── identity/ access/ venues/ billing/
├── menu/ floor/ sessions/ ordering/ kitchen/
├── checks/ payments/ cash/ bills/
├── customers/ reservations/ analytics/ ai/ integrations/
├── platform/
└── http.ts           # webhooks entrants, vérification de signature
```

Dans chaque domaine : `queries.ts` · `mutations.ts` · `actions.ts` · `internal.ts` · `model.ts`
(règles pures, testables sans base) · `machine.ts` (transitions).

**Le patron de toute mutation publique**, dans cet ordre, sans exception :

```ts
export const fireCourse = mutation({
  args: { venueId: v.id("venues"), orderId: v.id("orders"), courseNumber: v.number() },
  handler: async (ctx, args) => {
    // 1. identité + permission + portée — AVANT toute lecture métier
    const actor = await requirePermission(ctx, "order.course.fire", { venueId: args.venueId });
    // 2. limitation de débit sur les surfaces abusables
    await enforceRateLimit(ctx, "orderMutation", actor.userId);
    // 3. charger, en vérifiant l'appartenance à la portée de l'appelant
    const order = await loadInVenue(ctx, "orders", args.orderId, args.venueId);
    // 4. transition validée par la machine à états
    const next = orderMachine.transition(order.status, "FIRE_COURSE", { courseNumber: args.courseNumber });
    // 5. écrire : état + événement métier + audit si sensible
    await ctx.db.patch(order._id, { status: next });
    await recordOrderEvent(ctx, { orderId, type: "course_fired", actor, at: Date.now() });
  },
});
```

**Ce qui est interdit côté Convex**, et cherché en revue :

- une fonction publique sans garde ;
- un `.collect()` sans index de portée en tête (il lira la table entière) ;
- une chaîne de statut écrite en dur au lieu de passer par la machine ;
- un montant reçu du client et enregistré tel quel ;
- un appel sortant dans une `mutation` (c'est le rôle d'une `action`) ;
- une fonction qui fait trois choses — le brief l'interdit (§5) et c'est ce qui rend l'audit illisible.

---

## 11. Architecture IA

```mermaid
graph TB
    U["Utilisateur<br/>(client ou personnel)"] --> ENTRY{"Type d'assistance"}
    ENTRY -->|"client"| GA["Assistant carte<br/>« pas épicé, moins de 8 000 »"]
    ENTRY -->|"manager"| MA["Assistant exploitation<br/>« qu'est-ce qui a ralenti hier ? »"]
    ENTRY -->|"import"| IM["Extraction de carte<br/>PDF / photo"]

    GA & MA & IM --> GUARD["Garde de contexte<br/>portée + permissions de l'appelant"]
    GUARD --> TOOLS["Outils typés<br/>chacun porte sa permission"]
    TOOLS --> DATA[("Données réelles<br/>lues avec la portée de l'appelant")]
    TOOLS --> PROV["Abstraction fournisseur<br/>(modèle interchangeable)"]
    PROV --> LLM["Modèle"]
    LLM --> OUT{"Sortie"}
    OUT -->|"réponse"| ANS["Réponse + période + données citées"]
    OUT -->|"action sensible"| PROP["Proposition<br/>aperçu → validation humaine → exécution → journal"]
    TOOLS --> USG["aiUsage<br/>modèle, coût, jetons, latence,<br/>utilisateur, organisation, succès"]
```

**Quatre garde-fous structurels :**

1. **L'IA n'a pas d'accès privilégié.** Ses outils lisent avec la portée et les permissions de celui
   qui pose la question. Un serveur ne peut pas obtenir par l'IA le chiffre d'affaires d'un
   établissement où il n'a pas accès (*R30*, §90).
2. **Rien d'inventé.** Sur un allergène non déclaré, la réponse est « cette information n'est pas
   renseignée » (*R28*). C'est une contrainte d'outillage, pas une consigne de rédaction : l'outil
   ne renvoie que ce qui existe en base.
3. **Le contenu importé est une donnée, jamais une instruction.** Une carte PDF qui contient « ignore
   les instructions précédentes » est du texte à extraire, rien d'autre. Séparation stricte entre
   consigne système et contenu fourni (§90, §118).
4. **Aucune action sensible sans validation humaine** (*D-014*). L'IA propose ; une personne qui
   détient `ai.actions.approve` exécute ; le journal garde les deux.

Le fournisseur est interchangeable par construction : un adaptateur, pas un SDK importé dans les
écrans. Le coût et la latence sont mesurés à chaque appel, sinon la facture arrive sans explication.

---

## 12. Temps réel, hors ligne, erreurs

**Temps réel.** Les abonnements sont scopés au plus étroit : le KDS d'une station s'abonne aux bons
*de cette station*, pas à toutes les commandes de l'établissement. Un abonnement large est un
abonnement qui se réveille pour rien et vide la batterie d'une tablette.

**Hors ligne** — trois cercles, et pas un de plus (*A4*) :

```mermaid
flowchart TD
    N{"Réseau ?"} -->|"oui"| OK["Fonctionnement normal"]
    N -->|"non"| C1["Cercle 1 — LECTURE<br/>carte, prix, plan de salle<br/>servis depuis le cache"]
    C1 --> C2{"Le geste écrit-il ?"}
    C2 -->|"geste de service"| Q["Cercle 2 — FILE<br/>ajout d'article, prêt, servi, demande<br/>chaque mutation porte une clé d'idempotence<br/>état affiché : « en attente de confirmation »"]
    C2 -->|"argent ou clôture"| BLK["Cercle 3 — REFUS EXPLICITE<br/>« Connexion perdue — l’encaissement attend le réseau »"]
    Q --> SYNC["Au retour du réseau : rejeu ordonné<br/>conflit → l'état serveur gagne, l'utilisateur est prévenu"]
```

Jamais « commande envoyée » tant que le serveur n'a pas confirmé (§71). L'état intermédiaire a son
propre libellé et sa propre icône.

**Erreurs.** Une erreur métier est typée (`ConvexError` avec un code), jamais une chaîne libre : le
client doit pouvoir distinguer `ITEM_UNAVAILABLE` de `PERMISSION_DENIED` de `TABLE_CLOSED` pour
afficher la bonne chose. Chaque erreur porte un identifiant de trace, relié à l'organisation, à
l'établissement et à la route, **sans secret** (§92).

---

## 13. Ce qui n'est pas encore tranché

| Sujet | Pourquoi ce n'est pas tranché | Où ça se décidera |
|---|---|---|
| Versions exactes des dépendances | Vérification des documentations officielles en cours | `docs/research/stack-compatibility.md` |
| Fournisseur de paiement n°1 | Dépend de la couverture réelle en Côte d'Ivoire | `docs/research/payments-africa.md` |
| Gestion de formulaires | Trois candidats crédibles, aucun décisif | `docs/research/stack-compatibility.md` |
| PIN de service pour le personnel | Désaccord ouvert avec le brief | `docs/DECISION_LOG.md` A1 |
| Impression tickets | Dépend du matériel réellement présent | Entretiens terrain |
