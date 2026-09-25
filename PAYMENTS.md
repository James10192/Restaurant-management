# PAYMENTS.md — Joliba

> §24 à §29, §54, §77, §78, §119. Les sources et les vérifications marché sont dans
> [`docs/research/payments-africa.md`](docs/research/payments-africa.md).

---

## 1. Les six règles qui gouvernent l'argent

1. **Aucun montant ne vient du client.** Tout est recalculé côté serveur *(R14)*.
2. **Un paiement n'est réussi que sur vérification serveur.** Une redirection « succès » n'est
   qu'un indice *(R15)*.
3. **Tout ce qui touche l'argent est idempotent.** Double clic, webhook rejoué, réessai réseau :
   un seul effet *(R7, R16)*.
4. **Rien ne se supprime.** On annule, on rembourse, on corrige — avec un motif et un auteur
   *(R18)*.
5. **L'espèce est un moyen de première classe**, pas un repli *(D-019)*.
6. **Le montant est un entier**, dans l'unité mineure de sa devise, et le facteur d'échelle vient de
   la devise, jamais d'une constante.

---

## 2. Représenter l'argent

### Le piège qui coûte un facteur 100

Le réflexe « un montant se stocke en centimes, donc × 100 » est faux ici. **Le franc CFA (XOF et
XAF) a un exposant décimal de 0** : il n'a pas de sous-unité en circulation. Multiplier par 100 un
montant en XOF, c'est **surfacturer le client d'un facteur 100**.

```ts
/** Exposant décimal ISO 4217. Le facteur d'échelle en est DÉRIVÉ, jamais écrit en dur. */
const CURRENCY_EXPONENT: Record<string, number> = {
  XOF: 0, XAF: 0,          // franc CFA — pas de sous-unité
  EUR: 2, USD: 2, MAD: 2, NGN: 2, GHS: 2,
};

export type Money = { amount: number; currency: string }; // amount = ENTIER, unité mineure

export function scaleFactor(currency: string): number {
  const exp = CURRENCY_EXPONENT[currency];
  if (exp === undefined) throw new Error(`Devise inconnue : ${currency}`);
  return 10 ** exp;
}

/** 5 000 FCFA → { amount: 5000, currency: "XOF" }   ·   12,50 € → { amount: 1250, ... } */
export function fromDecimal(value: number, currency: string): Money {
  return { amount: Math.round(value * scaleFactor(currency)), currency };
}

export function formatMoney(m: Money, locale = "fr-CI"): string {
  return new Intl.NumberFormat(locale, { style: "currency", currency: m.currency })
    .format(m.amount / scaleFactor(m.currency));
}
```

**Interdits** : le type `float` sur un montant · une constante `100` dans un calcul de prix · la
chaîne `"FCFA"` concaténée à la main quelque part dans l'interface · additionner deux montants sans
vérifier qu'ils ont la même devise.

### Arrondis et pas de montant

Certains agrégateurs imposent un **pas** (montant multiple de 5) et **arrondissent à l'inférieur
sans prévenir**. L'écart disparaît alors silencieusement et la caisse ne tombe plus juste.

Règle : on arrondit **soi-même au supérieur** avant l'appel, et on stocke le montant réellement
accepté dans un champ distinct (`paymentIntents.acceptedAmount`) *(D-028)*. Tout écart entre demandé
et accepté est visible dans la réconciliation, pas noyé.

---

## 3. L'abstraction `PaymentProvider`

Le domaine métier ne connaît **aucun** fournisseur. Il connaît un contrat.

```ts
export interface PaymentProvider {
  readonly key: string;                       // "cash" | "wave_ci" | ...
  readonly capabilities: {
    online: boolean;                          // redirection / champ hébergé
    refund: boolean;
    partialRefund: boolean;
    webhooks: boolean;
    sandbox: boolean;
  };
  readonly supportedMethods: PaymentMethod[];
  readonly supportedCurrencies: string[];

  /** Crée une intention. Le montant est recalculé côté serveur AVANT l'appel. */
  initialize(input: {
    amount: Money;
    reference: string;                        // notre référence, jamais la leur
    idempotencyKey: string;
    customer?: { phone?: string; email?: string; name?: string };
    returnUrl: string;
    metadata: Record<string, string>;
  }): Promise<{ providerRef: string; redirectUrl?: string; acceptedAmount?: Money; expiresAt: number }>;

  /** Interroge le fournisseur. C'est CE retour qui fait foi, pas la redirection du client. */
  verify(providerRef: string): Promise<{ status: PaymentStatus; paidAmount?: Money; paidAt?: number }>;

  /** Vérifie la signature sur le CORPS BRUT, et extrait l'identifiant d'événement. */
  parseWebhook(raw: string, headers: Record<string, string>):
    | { valid: true; eventId: string; eventType: string; providerRef: string; status: PaymentStatus }
    | { valid: false; reason: string };

  refund(input: { providerRef: string; amount: Money; idempotencyKey: string; reason: string }):
    Promise<{ refundRef: string; status: RefundStatus }>;

  /** Liste les transactions d'une période, pour le rapprochement quotidien. */
  reconcile(range: { from: number; to: number }): Promise<ProviderTransaction[]>;
}
```

**Trois règles d'implémentation :**

- Un adaptateur vit dans `convex/payments/providers/<clé>.ts`. Il ne connaît ni les additions, ni
  les sessions, ni les tables : il traduit, c'est tout.
- **Le fournisseur actif se change par configuration en base, jamais par déploiement** *(D-026)*.
  Un agrégateur régional a fait faillite en 2025, un autre a subi une cyberattaque reconnue, et le
  cadre interbancaire régional évolue : devoir livrer une version pour changer de rail est un risque
  d'exploitation, pas un détail.
- Un fournisseur sans environnement de test documenté impose d'écrire un **faux fournisseur conforme
  au contrat**, sinon rien n'est testable.

> **État en T5** *(D-109, D-110, D-111, D-125)* : le contrat livré est
> `OnlinePaymentProvider` (`convex/lib/providers/types.ts`), plus étroit que l'esquisse ci-dessus.
> `createProvider(compte, secrets)` (`convex/lib/providers/registry.ts`) rend un adaptateur **par
> compte**, avec `initialize`, `findByReference`, `verify`, `expire`, `refund`,
> `transactionsOfDay` et `testConnection`. La signature des webhooks se vérifie hors de
> l'adaptateur (`convex/lib/waveSignature.ts`), sur le corps brut. Un seul adaptateur réel :
> Wave Côte d'Ivoire (`convex/lib/providers/wave.ts`). Le faux fournisseur n'est **pas** un
> adaptateur : c'est un faux serveur Wave (`tests/convex/fakeWave.ts` pour Vitest,
> `e2e/wave-sink.mjs` pour le navigateur), et c'est le vrai adaptateur qui lui parle.

### `CashProvider` : l'espèce comme vrai fournisseur

Contre-intuitif et pourtant décisif. L'espèce implémente le même contrat : `initialize` ouvre une
attente, `verify` est immédiat, `refund` crée un mouvement de caisse, `reconcile` lit la session de
caisse.

Deux bénéfices : le reste du code ne distingue pas « en ligne » de « comptoir », et **l'abstraction
est validée avant d'écrire le premier adaptateur HTTP**. Une abstraction qui n'a qu'une
implémentation n'est pas une abstraction, c'est une promesse.

> **État en T3** *(D-078)* : l'abstraction est reportée à T5, précisément pour cette raison — tant
> qu'aucun fournisseur en ligne n'existe, elle n'aurait qu'une implémentation. Les moyens manuels
> passent tous par `applyPayment` (`convex/payments.ts`), qui deviendra la jonction.
>
> **État en T5** *(D-110)* : l'espèce ne passe toujours pas derrière le contrat. Le comptoir garde
> `applyPayment`, le paiement en ligne passe par `confirmIntent` (`convex/onlinePayments.ts`), et
> les deux écrivent par le même cœur, `insertPayment`. Une seule façon d'enregistrer un paiement,
> deux façons d'y arriver.

### Ordre d'intégration recommandé *(D-025)*

| Rang | Fournisseur | Pourquoi |
|---|---|---|
| 1 | `cash` | L'espèce reste dominante ; et elle valide le contrat |
| 2 | Wave Côte d'Ivoire | Le seul de la région à documenter **par écrit** les quatre garanties nécessaires : webhooks signés **et horodatés**, identifiant d'événement dédié à la déduplication, remboursement idempotent, réessais sur plusieurs jours. Coût le plus bas. |
| 3 | Un agrégateur multi-rails | Couvre Orange Money, MTN, Moov, carte. **Jamais rail unique** : les incidents constatés sur ce segment l'interdisent. |

Le défaut de Wave — un seul rail — est un **avantage d'architecture** : il rend le second adaptateur
obligatoire immédiatement, au lieu de laisser l'abstraction théorique jusqu'au jour où elle casse.

---

## 4. Cycle de vie et idempotence

La machine à états et le diagramme de séquence complet sont dans `ARCHITECTURE.md §7`.

### La clé d'idempotence, concrètement

```ts
/**
 * À utiliser dans une MUTATION. Une action n'a pas `ctx.db` : elle doit passer par
 * une mutation interne (`ctx.runMutation(internal.payments.claimKey, …)`) — sinon ce
 * helper échoue précisément là où le document l'exige, sur les appels sortants.
 */
async function withIdempotency<T>(ctx: MutationCtx, key: string, scope: string, fn: () => Promise<T>) {
  const existing = await ctx.db.query("idempotencyKeys")
    .withIndex("by_key", q => q.eq("key", key)).unique();

  if (existing) {
    // Déjà traité : on rend la MÊME réponse, on ne refait rien.
    if (existing.status === "completed") return loadResult(ctx, existing.resultRef);
    // Une tentative précédente a échoué : on la RECYCLE au lieu d'insérer un doublon.
    // Sans cette branche, un second insert ferait lever `.unique()` à tout appel suivant —
    // et la clé, censée protéger, bloquerait définitivement un chemin d'argent.
    if (existing.status === "failed") {
      await ctx.db.patch(existing._id, { status: "in_progress", createdAt: Date.now() });
      return await run(ctx, existing._id, fn);
    }
    // En cours : une seconde requête ne double pas l'effet, elle attend.
    throw new ConvexError("IN_PROGRESS");
  }

  const id = await ctx.db.insert("idempotencyKeys", {
    key, scope, status: "in_progress", createdAt: Date.now(), expiresAt: Date.now() + DAY,
  });
  return await run(ctx, id, fn);
}

async function run<T>(ctx: MutationCtx, id: Id<"idempotencyKeys">, fn: () => Promise<T>) {
  try {
    const result = await fn();
    await ctx.db.patch(id, { status: "completed", resultRef: String(result) });
    return result;
  } catch (e) {
    // `failed` doit être PRODUIT, sinon la branche qui le traite ne sert à rien.
    await ctx.db.patch(id, { status: "failed" });
    throw e;
  }
}
```

> **Ce qui manquait dans une version antérieure de ce document**, et qui aurait cassé en
> production : le statut `failed` était déclaré dans le schéma mais **jamais écrit ni relu**.
> Une tentative échouée laissait donc une clé orpheline, le rejeu tentait un second `insert`,
> et `.unique()` levait à chaque appel suivant — sur un chemin d'argent. *(CRITIQUE.md S5.)*

**Où la clé est obligatoire** : création d'intention, confirmation de paiement, traitement de
webhook, remboursement, envoi de commande, rejeu d'une file hors ligne, appel à une intégration.

**Qui la génère** : le client, à l'ouverture du formulaire — pas au clic. Une clé générée au clic
change à chaque clic et ne protège de rien.

> **État en T5** *(D-119)* : la table `idempotencyKeys` n'est pas utilisée (elle est marquée
> obsolète dans le schéma). L'idempotence tient à des index uniques sur les tables d'argent
> elles-mêmes, ce qui évite une seconde écriture à garder cohérente :
>
> | Geste | Ce qui l'empêche de se produire deux fois |
> |---|---|
> | Créer une intention | `paymentIntents.by_venue_idempotency` : la clé tirée à l'ouverture du tiroir rend l'intention existante |
> | Créer la session Wave | Une intention ouverte est réutilisée ; bail de 60 s pendant la création ; avant tout nouvel essai, recherche chez Wave par notre référence (`/checkout/sessions/search`). L'API Checkout n'a pas d'en-tête d'idempotence |
> | Confirmer un paiement | `payments.by_provider_ref` : une session Wave donne au plus un paiement, quel que soit le chemin (webhook, rattrapage, vérification du client) |
> | Traiter un webhook | `webhookEvents.by_account_event` : un événement déjà vu répond 200 sans rien refaire |
> | Rembourser | Un remboursement Wave est total et unique par paiement ; Wave le rend idempotent de son côté |

### Webhooks

```
1. Réception du corps BRUT (jamais ré-encodé : le ré-encodage invalide la signature)
2. Vérification de signature, comparaison en TEMPS CONSTANT
3. Contrôle de l'horodatage (hors fenêtre → rejet)
4. Enregistrement dans `webhookEvents` AVANT tout traitement
5. Si `providerEventId` déjà vu → on renvoie 200 et ON NE FAIT RIEN
6. Traitement dans une mutation idempotente
7. Réponse 200 rapide ; le travail long part en tâche programmée
```

**Point qui échappe souvent** : on répond `200` même à un événement déjà traité. Répondre une erreur
ferait réessayer le fournisseur indéfiniment pour un événement que nous avons parfaitement traité.

> **État en T5** *(D-118)* : les webhooks arrivent dans Convex, à l'adresse
> `/webhooks/wave/<chemin>` propre à chaque compte (`convex/http.ts`). Ordre réel : compte trouvé par
> le chemin (404 sinon) ; corps limité à 64 Kio ; signature `Wave-Signature` vérifiée sur le corps
> brut, plusieurs `v1` acceptées (rotation), ±5 min (401 sinon, et l'échec est compté : cinq dans
> l'heure lèvent une alerte au gérant) ; lecture de l'événement (400 si illisible) ; traitement
> idempotent ; 200. L'ancien secret reste accepté pendant une rotation, jusqu'à ce que le gérant le
> retire.

### Les quatre situations réelles à traiter

| Situation | Ce qui se passe |
|---|---|
| Le client paie, ferme son navigateur, le webhook arrive après | La vérité est côté serveur : la caisse voit le paiement, le client retrouve son ticket au rechargement |
| Le webhook arrive avant le retour du client | Le retour trouve l'addition déjà soldée — et n'en refait rien |
| Le webhook n'arrive jamais | Une tâche de réconciliation interroge `verify` sur les intentions en attente et rattrape |
| Le client paie deux fois | Deux paiements existent réellement ; l'excédent est visible et remboursable. **On ne masque pas un paiement reçu** |

---

## 5. Additions et partage

Une session de table porte **une ou plusieurs additions**. Chaque addition reçoit **un ou plusieurs
paiements**. Le paiement n'est pas la commande.

| Mode | Fonctionnement |
|---|---|
| `full` | Une addition pour toute la table |
| `by_items` | Chacun choisit ses lignes ; `checkItems` porte l'allocation |
| `by_guest` | Réparti selon `orderItems.assignedGuestSessionIds` |
| `by_amount` | Montant libre, tant que le total alloué ne dépasse pas le dû |
| `even` | Division égale ; le reste de division va sur la première part, jamais perdu |

**Invariants vérifiés dans la mutation** : la somme des allocations d'une ligne égale son total ;
la somme des paiements d'une addition ne dépasse jamais son dû *(R17)*.

### Le paiement mixte

35 000 FCFA réglés en 15 000 espèces et 20 000 Mobile Money : **deux lignes de `payments`, même
`checkId`**. Aucune structure supplémentaire, et c'est précisément ce qu'aucun concurrent étudié ne
traite. La caisse affiche le solde restant après chaque encaissement, en direct.

> **Ce qui est construit en T3** *(D-075 à D-077)* : l'addition ne stocke aucun montant, son solde
> se recalcule. Deux formes seulement : le « reste de la table », dynamique, et les additions
> détachées par articles (`checkItems`, part fractionnaire possible). Le partage égal et « chacun
> paie tant » sont des aides au montant, pas des additions. `by_guest` est reporté.

---

## 6. Caisse

```
Ouverture  → fonds de caisse DÉCLARÉ
Service    → encaissements espèces rattachés à la session
           → sorties autorisées (achat, monnaie), chacune avec un motif
Comptage   → attendu CALCULÉ (jamais saisi) vs compté
Clôture    → écart = compté − attendu, affiché, jamais masqué
Correction → permission dédiée + motif + journal nominatif
```

Une caisse n'a **qu'une** session ouverte à la fois. L'attendu se calcule depuis les paiements en
espèces de la session : le saisir à la main ouvrirait exactement la porte que la caisse doit fermer.

L'écart n'est pas une faute à cacher, c'est une donnée. Ce qui compte, c'est qu'il soit **visible,
attribué et suivi dans le temps** — un écart isolé est humain, un écart répété chez la même personne
est un signal.

> **Ce qui est construit en T3** *(D-080, D-081)* : caisse centrale à tiroirs ou pochette par
> serveur, au choix de l'établissement ; comptage à l'aveugle, un recomptage conservé, motif exigé
> pour clôturer sur un écart ; on ne compte pas sa propre pochette. L'attendu = fonds + espèces
> encaissées − monnaie rendue sur un paiement non espèces − remboursements en espèces − sorties +
> apports. La correction d'une caisse close est reportée *(D-087)*.

---

## 7. Remboursements

Motif obligatoire · permission `payment.refund` distincte, rarement accordée · jamais au-delà de
l'encaissé *(R19)* · idempotent · toujours journalisé · jamais de suppression de la transaction
d'origine.

Un remboursement en espèces d'un paiement en ligne est possible, mais il crée un **mouvement de
caisse** et doit apparaître dans la réconciliation : sinon l'argent sort sans trace.

> En T3, un remboursement en espèces porte la session de caisse d'où sort l'argent
> (`refunds.cashRegisterSessionId`) et entre dans l'attendu de cette caisse, plutôt qu'un mouvement
> séparé : la trace est la même, sans double écriture *(D-083)*.

> **État en T5** *(D-123)* : un paiement Wave se rembourse **par Wave, en totalité seulement**
> (l'API ne connaît pas le partiel). Le remboursement est écrit `pending` et compte dans le plafond
> tant que Wave n'a pas répondu ; une réponse d'échec le passe `failed` et libère le plafond. Un
> remboursement partiel d'un paiement Wave se fait en espèces, avec la trace de caisse ci-dessus.
> Un paiement en ligne ne s'annule pas : il se rembourse.

---

## 8. Pourboires

Désactivés par défaut *(D-027)* : aucun encadrement légal ivoirien du pourboire n'a été trouvé
pendant la recherche, et activer par défaut une collecte d'argent dont le cadre est inconnu n'est
pas un risque à prendre.

Quand un restaurant les active : montant libre ou suggestions en pourcentage, jamais présélectionné,
jamais de case pré-cochée. Le pourboire est stocké **séparément** du montant de l'addition
(`payments.tipAmount`) — le confondre avec le chiffre d'affaires fausse la comptabilité et la
répartition.

> **État en T5** *(D-129)* : reportés, écart assumé. `tipAmount` reste 0 et le paiement à table ne
> propose aucun pourboire. Aucune source légale nouvelle ne justifiait de lever D-027.

---

## 9. Pièces fiscales

**Le vocabulaire est réglementé, et ce n'est pas un détail de rédaction.** En Côte d'Ivoire, « reçu »
désigne le **RNE** (Reçu Normalisé Électronique, remis au particulier) et « facture » le **FNE**
(remis à un professionnel). Ce sont deux pièces **certifiées par la DGI**. Un ticket non certifié ne
peut porter ni l'un ni l'autre de ces noms — ni dans l'interface, ni dans le code. D'où la table
`bills` *(D-024)*.

Le régime ivoirien est un modèle de **clearance** : la pièce doit être validée par l'administration
**avant** remise au client, et porte un numéro, un visuel, un QR de vérification.

```ts
export interface FiscalProvider {
  readonly jurisdiction: string;                    // "CI" | "BJ" | ...
  readonly requiresClearance: boolean;              // validation AVANT remise
  certify(bill: BillSnapshot): Promise<{
    type: "rne" | "fne";
    reference: string;
    qrPayload: string;
    seal?: string;
  }>;
  status(reference: string): Promise<FiscalStatus>;
}
```

`NoopFiscalProvider` par défaut : le produit émet un ticket non certifié, et ne prétend rien
d'autre. `CiFneProvider` isolé dans son fichier. **Le test de cette abstraction** : ouvrir un
établissement dans un pays voisin au régime comparable ne doit demander qu'**un fichier de plus**.

**Bloquant, et honnêtement signalé** : la spécification technique de l'API n'a pas pu être lue
(portail inaccessible au moment de l'étude). Trois questions restent sans réponse et conditionnent
l'implémentation : l'éditeur de logiciel doit-il être agréé ? le mode hors ligne est-il prévu — un
restaurant perd son réseau, et le régime exige une validation *avant* remise ? quel est le format
exact de la charge utile du QR ? **On ne code pas une intégration dont on n'a pas lu le contrat.**

---

## 10. Taxes

Configurables par établissement, jamais codées en dur *(§78)* : prix affichés TTC ou HT, plusieurs
taux possibles, service compris optionnel. Le taux applicable est **figé dans le snapshot de la
ligne de commande** au moment de l'acte : un changement de taux ne réécrit jamais une commande
passée.

*(Le taux applicable à la restauration ivoirienne est à faire confirmer par un fiscaliste — la
recherche l'a obtenu par déduction, pas par une source primaire. Il est donc paramétré, pas
présumé.)*

---

## 11. Réconciliation

**Quotidienne, automatique** : pour chaque fournisseur, comparer nos paiements à sa liste de
transactions. Trois écarts possibles, trois traitements :

| Écart | Cause probable | Traitement |
|---|---|---|
| Chez eux, pas chez nous | Webhook perdu | Rattrapage automatique par `verify`, alerte si échec |
| Chez nous, pas chez eux | Confirmation prématurée | **Alerte immédiate** — c'est le cas grave |
| Montants différents | Arrondi silencieux du fournisseur | Écart enregistré et affiché *(D-028)* |

Le restaurateur voit un indicateur simple : **« versé / en attente / en retard »**. Un agrégateur
qui tarde à reverser est un risque pour son commerce, pas seulement pour nous : il doit le savoir.

> **État en T5** *(D-121, D-122)* : chaque jour à 06:00 UTC, le jour J-1 puis J-2 est rapproché avec
> le relevé Wave (API Balance, si la clé a le droit « Solde » ; sinon l'écran dit « indisponible »).
> Avec Wave, l'argent atterrit directement dans le portefeuille Wave Business du restaurant : il n'y
> a pas de reversement à attendre. L'indicateur dit donc ce qu'il sait vraiment, sur chaque
> paiement de l'addition : « Vu au relevé Wave », « Relevé à venir », ou « Absent du relevé Wave »,
> qui lève une alerte. Chaque écart (chez eux et pas chez nous, l'inverse, montants différents)
> devient une alerte à la caisse, que seul un geste motivé referme.

---

## 12. Tests obligatoires *(§97)*

Double clic sur « Payer » → un seul paiement · webhook rejoué → aucun effet · webhook falsifié →
rejeté · webhook périmé → rejeté · paiement réussi + webhook en retard → un seul paiement · paiement
échoué → addition intacte · remboursement supérieur à l'encaissé → refusé · remboursement partiel →
soldes cohérents · paiement mixte espèces + mobile → solde à zéro · division en 3 avec reste →
somme exacte, aucun centime perdu · clôture de caisse avec écart → écart journalisé · devise
incohérente → refus · montant envoyé par le client ≠ montant serveur → le serveur gagne.

> **Où chaque test vit, en T5** : `tests/convex/onlinePayments.test.ts` (Vitest, faux serveur Wave)
> reprend chaque ligne ci-dessus, dans ses termes, pour le paiement en ligne (double clic, webhook
> rejoué, falsifié, périmé, webhook en retard, paiement échoué, remboursement au-delà de l'encaissé
> et partiel, paiement mixte espèces + Wave, devise incohérente, montant du client ignoré), plus les
> courses qui lui sont propres : réponse de création perdue, intention annulée pendant que le client
> paie, payé après la clôture, Wave injoignable, rapprochement. `tests/convex/billing.test.ts` couvre
> le comptoir : division avec reste, paiement mixte, clôture avec écart. `e2e/t5.spec.ts` rejoue
> dans un vrai navigateur le double appui, le webhook rejoué et le webhook altéré, contre le vrai
> adaptateur Wave.
