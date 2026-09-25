# CRITIQUE — revue adverse de la conception Joliba

> Revue écrite le 2026-09-17 contre l'état du dépôt à cette date.
> Méthode : vérification mécanique du schéma contre les documents, confrontation des documents
> entre eux, et lecture en exploitant plutôt qu'en concepteur.
> **Ce qui est vérifié est marqué `[vérifié]`** (commande ou `fichier:ligne` à l'appui).
> **Ce qui est déduit est marqué `[déduit]`.** Rien n'est affirmé sans l'un des deux.

---

## Verdict en une phrase

La conception est **sérieuse, honnête et largement au-dessus de la moyenne** — mais elle **n'est pas
prête à être implémentée** : son invariant de sécurité le plus répété est violé par 55 % du schéma
écrit *tout en étant déclaré « vérifié par script »*, et neuf manques que le dépôt qualifie lui-même
de **bloquants** ne sont remontés dans aucun document de synthèse ni dans la feuille de route.

---

# 1. BLOQUANT

## B1 — La règle d'index de portée est violée par 78 index sur 142, et la synthèse affirme qu'elle est respectée

**Gravité : bloquant.**

**Ce qui ne va pas.** La règle est posée cinq fois, à chaque fois comme non négociable :

| Source | Texte |
|---|---|
| `convex/schema.ts:10-11` | « Le PREMIER champ de chaque index est une clé de portée. Un index qui déroge porte un commentaire disant pourquoi. » |
| `ARCHITECTURE.md:183-185` | « **Le premier segment de tout index est une clé de portée.** […] doit être justifié par écrit. » |
| `DATA_MODEL.md:54-55` | « Un index qui ne commence pas par `organizationId` ou `venueId` doit être justifié par un commentaire dans le schéma. » |
| `docs/ARCHITECTURE_DECISIONS.md:171` | « Une dérogation se justifie par écrit. » |
| `SECURITY.md:45-46` | mitigation **n°1 de M1**, « le risque qui tue le produit » |

Et `docs/ARCHITECTURE_DECISIONS.md:316` affirme : *« **Vérifié par script** : aucun doublon, aucune
limite dépassée, **règle de portée respectée**. »*

**La preuve. [vérifié]** Analyse des 142 index de `convex/schema.ts` :

```
Index dont le premier champ n'est PAS organizationId/venueId : 78 / 142  (55 %)
  dont porteurs d'un commentaire justificatif                : 12
  dont SANS aucune justification                             : 66
```

Échantillon non contestable : `products.by_section_sort ["menuSectionId","sortOrder"]`,
`orders.by_session ["tableSessionId"]`, `payments.by_check ["checkId"]`,
`kitchenTickets.by_station_status_queued ["prepStationId","status","queuedAt"]`,
`orderItems.by_order ["orderId"]`, `checks.by_session ["tableSessionId"]`,
`bills.by_check ["checkId"]`, `cashMovements.by_session ["registerSessionId"]`.

**Trois de ces index sont, dans le même document, présentés comme « les cinq index du chemin
critique »** (`DATA_MODEL.md:844-848`) : `products.by_section_sort`,
`kitchenTickets.by_station_status_queued`, `payments.by_register_session`. Les trois violent la
règle. Aucun des trois ne porte de justification de dérogation — le commentaire de
`by_station_status_queued` parle de sa *fréquence*, pas de sa *portée*.

**La conséquence concrète.** Deux, et la seconde est la pire.

1. L'affirmation « vérifié par script, règle de portée respectée » est **fausse**. Si un script
   existe, il ne teste pas ce qu'on dit qu'il teste ; s'il n'existe pas, la phrase est une
   vérification imaginaire. Dans les deux cas, la mitigation n°1 de la menace fatale M1 est
   comptabilisée comme tenue alors qu'elle ne l'est pas.
2. **Une règle violée par la majorité du code qu'elle gouverne n'est plus une règle : c'est du
   bruit.** Le relecteur qui voit 66 dérogations non justifiées apprend à passer outre — et il
   passera outre le jour où la dérogation sera réellement dangereuse.

**Ce que je propose — et c'est un retrait, pas un durcissement.** La règle est **mal formulée**, ce
qui explique qu'elle soit inapplicable. Un index comme `orderItems.by_order ["orderId"]` est
parfaitement sûr : on ne l'atteint qu'après avoir chargé la commande et vérifié
`order.venueId === args.venueId`. Y préfixer `venueId` n'ajoute **aucune** sécurité (on connaît déjà
la venue) et coûte du stockage.

Ce qui protège réellement du franchissement de tenant est déjà écrit, et bien écrit, dans
`PERMISSIONS.md:314-328` : *on part du scope de l'appelant, et la cible doit y appartenir.*

→ **Remplacer** la règle « premier champ = clé de portée » (dans les 5 documents) par la règle
vraie : *« toute fonction publique résout la portée depuis l'appelant avant de toucher une donnée,
et tout document atteint par clé étrangère est re-vérifié contre cette portée. »*
→ **Conserver** l'exigence de préfixe de portée uniquement sur les index **directement atteignables
par un identifiant fourni par le client** — et il y en a un qui compte vraiment :
`products.by_section_sort`, servi au **menu public non authentifié**, où le `menuSectionId` vient du
client. Celui-là doit être scopé, ou sa requête doit vérifier la venue avant. **[déduit]** de
l'absence de code applicatif ; à trancher à l'écriture de la requête.

---

## B2 — La portée repose sur un champ recopié que rien ne vérifie jamais

**Gravité : bloquant.**

**Ce qui ne va pas.** ~50 tables portent **à la fois** `organizationId` et `venueId`
*(`convex/schema.ts`, passim)*. Or `organizationId` est **fonctionnellement dérivable** :
`venues.organizationId` fait autorité. C'est donc une dénormalisation — mais, contrairement aux
trois dénormalisations que `DATA_MODEL.md` assume et justifie explicitement, **celle-ci n'est ni
nommée, ni justifiée, ni vérifiée.**

**La preuve. [vérifié]** Recherche d'un contrôle de cohérence entre le `organizationId` d'une ligne
et celui de sa venue, dans tout le dépôt : **aucun résultat**. La seule garde voisine est
`requireVenueAccess(ctx, venueId)` *(`PERMISSIONS.md:296`)*, qui vérifie que **la venue** appartient
à l'org **du membre** — jamais que **la ligne** appartient à l'org **de sa venue**.
La batterie de tests de `PERMISSIONS.md:361-373` (9 tests) ne la contient pas non plus.

**La conséquence concrète.** Une ligne où `organizationId` et `venueId` désignent deux organisations
différentes est une fuite de tenant que **rien** n'attrape : ni les index, ni les gardes, ni les
tests. Elle se crée par un simple oubli dans une mutation (`organizationId` copié depuis le mauvais
objet), et R4/M1 — classés « fatal » — se réalisent en silence. Elle se crée aussi
mécaniquement le jour où un établissement change d'organisation (vente, changement de franchise) :
`venues.organizationId` bascule, les 50 tables gardent l'ancien.

**Ce que je propose.** Au choix, mais l'un des deux, et maintenant :
- **(a)** retirer `organizationId` des tables scopées par `venueId` et le dériver. C'est ~50 champs
  en moins et une seule source de vérité ;
- **(b)** le garder pour l'analytique consolidée de T8, mais poser une **assertion à l'écriture**
  (`assertSameOrg(venueId, organizationId)`) **et** un test d'intégrité récurrent. Le coût est d'une
  demi-journée ; l'absence est un trou dans le seul risque classé fatal.

---

## B3 — Neuf manques déclarés bloquants par le dépôt lui-même ne sont remontés nulle part

**Gravité : bloquant.**

**Ce qui ne va pas.** `docs/INFORMATION_ARCHITECTURE.md:83-95` ouvre une section intitulée
*« Manques bloquants — à trancher avant d'implémenter ces écrans »* et y liste **G1 à G9**, avec pour
chacun l'effet du non-traitement. C'est un excellent travail — et il est **orphelin**.

**La preuve. [vérifié]** Recherche de `G1`…`G9` dans tout le dépôt : les neuf n'apparaissent **que**
dans `INFORMATION_ARCHITECTURE.md`. Absents de `docs/ARCHITECTURE_DECISIONS.md` — qui se présente
pourtant ligne 4 comme *« la synthèse opposable »* —, absents de `docs/ROADMAP.md`, absents de
`docs/DECISION_LOG.md` partie C (« questions à trancher par l'utilisateur », 11 entrées, aucune n'est
un G).

**La conséquence concrète.** Quelqu'un qui lit la synthèse et la feuille de route — c'est-à-dire
quiconque décide de commencer — croit l'architecture prête. Trois exemples mesurables :

| Manque | Ce qu'il bloque | Vérification |
|---|---|---|
| **G1** — `venues` ne porte ni adresse, ni téléphone, ni horaires, ni description, ni géo | La **porte de sortie de T1** (« menu public indexable », `ROADMAP.md:51`) est inatteignable : ni JSON-LD `Restaurant`, ni porte de qualité | **[vérifié]** aucun champ `address`/`phone`/`openingHours`/`geo` sur `venues` dans `convex/schema.ts:188-219` |
| **G2** — le mode simulation n'a aucun point d'ancrage | La **porte de sortie de T7** (`ROADMAP.md:132-139`) ; **et** deux règles d'`ANALYTICS.md` deviennent inapplicables (voir C3) | **[vérifié]** `isSimulation`/`isDemo`/`simulation` : zéro occurrence dans `convex/schema.ts` |
| **G6** — aucune table ne porte le fournisseur de paiement actif | **D-026 est marquée « accepté »** (`DECISION_LOG.md:283`) et interdit de changer de rail par déploiement. Sans support en base, D-026 est inapplicable | **[vérifié]** aucun bloc `payment`/`provider` dans `venueSettings` (`convex/schema.ts:222-273`) |

Une décision marquée **« accepté »** que le schéma ne peut pas porter n'est pas une décision : c'est
une intention. Le journal de décisions perd sa valeur d'opposabilité s'il ne distingue pas les deux.

**Ce que je propose.** Avant toute ligne de code : remonter G1–G9 dans `DECISION_LOG.md` partie C
(ce sont des questions ouvertes, pas des détails d'écran), rétrograder **D-026** de « accepté » à
« proposé » jusqu'à ce que son support existe, et **ajouter les champs de G1 à `venues`** — c'est
une heure de travail et c'est la condition de T1.

---

# 2. SÉRIEUX

## S1 — La dénormalisation `kitchenTickets.tableNumber` sert les plats à la mauvaise table

**Gravité : sérieux.** *C'est la panne de production la plus concrète que j'aie trouvée.*

**Ce qui ne va pas.** `kitchenTickets.tableNumber` est un **snapshot figé à la création du bon**
(`convex/schema.ts:850-851`), justifié ainsi : *« la cuisine ne doit pas résoudre 3 relations pour
afficher "Table 12" »*. Par ailleurs, la permission `table.session.transfer` existe et promet
explicitement *« Déplacer des clients, fusionner/scinder des tables »* (`PERMISSIONS.md:91`).

**Aucun mécanisme n'invalide ni ne réécrit `tableNumber` lors d'un transfert. [vérifié]** —
recherche de `fusion|merge|scinder|transfer` dans `DATA_MODEL.md` et `convex/schema.ts` : aucune
occurrence hors du libellé de la permission et du moyen de paiement `transfer`.

**La conséquence concrète.** Samedi, 21 h. La table 12 (quatre personnes) demande à passer en
terrasse, table 7 — geste banal, plusieurs fois par service. Le serveur transfère. Les trois bons
déjà en cuisine affichent toujours **« Table 12 »**. Le runner sort les plats et les pose sur la
table 12, qui vient d'être réoccupée par d'autres clients. Personne ne voit d'erreur à l'écran :
le système est parfaitement cohérent avec lui-même.

**Et le problème est plus large que le transfert.** Le schéma **ne sait pas représenter** une fusion
ou une scission de table : `tableSessions.tableId` est un identifiant unique et obligatoire
(`convex/schema.ts:594`), `restaurantTables.activeSessionId` est mono-valué
(`convex/schema.ts:559`), et il n'existe ni `mergedIntoSessionId`, ni historique de table. Une
permission promet donc une capacité que le modèle de données rend impossible.

**Aggravant. [vérifié]** `tableSessionId` est dupliqué dans **cinq** tables — `orderItems`,
`checkItems`, `payments`, `bills`, `kitchenTickets`. Une fusion de sessions imposerait de réécrire
les lignes des cinq dans une seule transaction Convex, `orderItems` pouvant se compter en centaines
sur une grande tablée. **[déduit]** : c'est un risque de dépassement des limites transactionnelles,
à mesurer avant de concevoir la fusion.

**Ce que je propose.** Trancher, et l'écrire :
- soit **retirer `table.session.transfer` du catalogue V1** et l'assumer (c'est défendable, mais
  cela contredit `PERMISSIONS.md:91` et l'écran `/app/tables/$id`) ;
- soit **modéliser le transfert** : garder `tableNumber` mais y ajouter une réécriture des bons non
  terminés dans la même mutation, et poser un test « transfert pendant préparation → le bon affiche
  la nouvelle table ». C'est deux heures, et cela ferme la panne ci-dessus.

Et dans tous les cas : **ajouter ce cas à la liste des tests non négociables** de
`ARCHITECTURE_DECISIONS.md:526-528`, qui ne le contient pas.

---

## S2 — La machine à états de la caisse a trois états que le schéma ne peut pas stocker

**Gravité : sérieux.**

**Ce qui ne va pas. [vérifié]**

| Source | États |
|---|---|
| `ARCHITECTURE.md:363-372` (diagramme) | `open` · `counting` · **`balanced`** · **`discrepancy`** · **`adjusted`** · `closed` |
| `convex/schema.ts:1080` | `open` · `counting` · `closed` — **et rien d'autre** |

Trois états dessinés comme des états de la machine sont **inécrivables**. `ARCHITECTURE_DECISIONS.md:269`
annonce pourtant *« Cinq machines explicites, validées côté serveur »*, dont celle-ci.

**La conséquence concrète.** Qui écrit `cash/machine.ts` d'après le diagramme obtient un validateur
Convex qui refuse trois de ses six états. Il « corrigera » — soit en élargissant le schéma sans
comprendre pourquoi il était étroit, soit en mutilant la machine en silence. Les deux sont mauvais.

**Note d'équité.** `INFORMATION_ARCHITECTURE.md:91` a déjà identifié un **autre** défaut de cette
même machine (**G4** : pas de sortie de `discrepancy` sans `adjusted`, or `cash_register.adjust`
n'est pas dans le rôle Cashier → la caissière ne peut pas fermer sa caisse). **G4 et S2 sont
distincts** : G4 parle des transitions, S2 de l'impossibilité de stocker les états. Les deux
tombent au même endroit, ce qui est le signe que cette machine n'a jamais été relue contre le schéma.

**Ce que je propose.** Une seule rédaction fait foi. La plus simple : `balanced` / `discrepancy` /
`adjusted` **ne sont pas des états** mais des **qualifications de la clôture**, déjà portées par
`discrepancy` (le champ) et `adjustedByUserId`. Redessiner le diagramme en trois états, y ajouter la
transition `counting → closed` avec écart conservé (la correction que G4 propose), et laisser le
schéma tel quel.

---

## S3 — Deux valeurs d'énumération n'ont aucune transition dans la machine la plus critique

**Gravité : sérieux.**

**Ce qui ne va pas. [vérifié]** La machine de commande (`ARCHITECTURE.md:226-258`), présentée comme
*« la machine la plus sensible du produit »*, décide de la sortie de `submitted` ainsi :

```
submitted --> pending_payment    : si venue.paymentTiming = pre_paid
submitted --> pending_acceptance : si venue.orderingMode  = guest_with_approval
submitted --> accepted           : si guest_direct ou staff_only
```

Or le schéma définit **quatre** modes de commande et **trois** moments de paiement
(`convex/schema.ts:38-49`) :

- `orderingMode` : `staff_only` · `guest_with_approval` · `guest_direct` · **`hybrid`** ← sans transition
- `paymentTiming` : `post_paid` · `pre_paid` · **`per_order`** ← sans transition

`hybrid` et `per_order` sont documentés comme des modes produits réels (`PRODUCT.md:61` : *« Client
direct autorisé sur certaines catégories (boissons), validation requise ailleurs — Bars, lounges »* ;
`PRODUCT.md:69`), livrés en T4 (`ROADMAP.md:97`), et `venueSettings.service.guestDirectCategories`
existe précisément pour porter `hybrid` (`convex/schema.ts:230`).

**Aggravant conceptuel.** Le point de décision **mélange deux axes que `PRODUCT.md:36-37` déclare
indépendants** (« qui saisit » et « quand on paie »). Une venue en `guest_with_approval` **et**
`pre_paid` a deux transitions candidates depuis `submitted` et le diagramme ne dit pas laquelle
gagne. C'est exactement ce que D-011 prétend éviter.

**La conséquence concrète.** `hybrid` ne peut pas être implémenté sans rouvrir la machine — alors
que l'argument de vente de cette machine est *« ajouter un quatrième mode, c'est ajouter une
transition, pas un `if` dans dix fichiers »* (`ARCHITECTURE.md:264`). Le quatrième mode existe déjà,
et il n'a pas sa transition.

**Ce que je propose.** Expliciter la sortie de `submitted` comme une **fonction de deux axes**, avec
la précédence écrite (le paiement d'abord, puis l'approbation — **[déduit]** de R8 : *« en mode
`pre_paid`, aucun bon de production avant confirmation »*), et traiter `hybrid` comme une décision
**par ligne** (`guestDirectCategories`) et non par commande — ce qui change la machine, et c'est
mieux de le découvrir maintenant.

---

## S4 — Deux caches d'argent concurrents sur les mêmes faits, sans invariant énoncé ni test

**Gravité : sérieux.**

**Ce qui ne va pas. [vérifié]** Les totaux d'argent d'une table sont stockés **deux fois** :

- `tableSessions.totals` — 6 champs : `ordered`, `discounts`, `tax`, `serviceCharge`, `paid`, `due`
  (`convex/schema.ts:615-622`)
- `checks.{subtotal, discountTotal, taxTotal, serviceCharge, tipAmount, total, paidTotal, dueTotal}`
  — 8 champs (`convex/schema.ts:924-931`)

`DATA_MODEL.md` assume et justifie `tableSessions.totals` comme dénormalisation. Il ne mentionne
**pas** que `checks` porte le même agrégat à un autre grain. **L'invariant qui les relie —
`Σ checks.total == tableSessions.totals.ordered`, `Σ checks.paidTotal == totals.paid` — n'est écrit
nulle part**, et il est absent des tests obligatoires de `PAYMENTS.md:338-345` (13 tests) comme de
ceux d'`ARCHITECTURE_DECISIONS.md:526-528`.

**La conséquence concrète.** Toute mutation d'argent doit maintenir **deux** caches cohérents. Le
jour où une seule en oublie un (un remboursement partiel, une remise appliquée au niveau session, un
`voided`), l'écran serveur et l'écran caisse affichent deux soldes différents pour la même table —
et aucun des deux n'est faux du point de vue de sa propre table. `ARCHITECTURE_DECISIONS.md:307`
promet que `totals` est *« vérifié quotidiennement contre le calcul complet »* ; rien n'est dit de
`checks`.

**Ce que je propose.** **Un seul cache.** `checks` est le bon niveau (c'est lui qui reçoit les
paiements, et D-007 a raison de le séparer) : garder les totaux sur `checks`, **supprimer
`tableSessions.totals`**, et servir l'écran serveur par une requête `checks.by_session` — une
session porte une poignée d'additions, pas trente. Si la mesure montre que c'est trop lent, alors
seulement réintroduire `totals`, avec son invariant **écrit et testé**.

---

## S5 — Le helper d'idempotence ne peut pas tourner là où le document l'exige, et se casse au premier échec

**Gravité : sérieux.** *L'idempotence est D-010, et elle protège l'argent.*

**Ce qui ne va pas.** `PAYMENTS.md:156-169` publie `withIdempotency` comme **le** patron, et
`PAYMENTS.md:172-173` en impose l'usage pour *« création d'intention, confirmation de paiement,
traitement de webhook, remboursement, envoi de commande, rejeu d'une file hors ligne, **appel à une
intégration** »*. Trois défauts :

1. **Le statut `failed` n'est ni produit ni traité. [vérifié]** Le schéma déclare
   `status: in_progress | completed | failed` (`convex/schema.ts:1316`). Le helper ne teste que
   `completed` et `in_progress`. Une ligne `failed` **tombe dans le cas par défaut et déclenche un
   second `insert` sur la même clé** — après quoi le `.unique()` de la ligne 158 **lève une
   exception à chaque appel suivant**. Une clé d'idempotence empoisonnée, sur un chemin d'argent,
   avec une erreur illisible. Et symétriquement : aucun chemin n'écrit jamais `failed`, qui est donc
   un état mort du schéma.
2. **`resultRef: String(result)` ne rend pas « la même réponse ».** Le commentaire de la ligne 160
   dit `// même réponse`. Si `fn()` renvoie autre chose qu'un identifiant — une commande **et** ses
   bons, par exemple — `String(result)` vaut `"[object Object]"`. Le champ est typé
   `v.optional(v.string())` (`convex/schema.ts:1315`) : il ne peut structurellement porter qu'une
   référence, pas un résultat.
3. **`ctx.db` n'existe pas dans une *action* Convex. [déduit — sémantique Convex, non vérifiable
   dans ce dépôt qui ne contient aucun code applicatif].** Le contexte d'action expose `runQuery` /
   `runMutation` / `runAction`, pas `db`. Or « appel à une intégration » et « traitement de webhook »
   sont, par construction (`ARCHITECTURE.md:448-460` interdit tout appel sortant dans une mutation),
   des actions. **Le helper universel ne compile pas dans la moitié des cas où il est rendu
   obligatoire.**

**Ce que je propose.** Traiter `failed` explicitement (le rejouer, pas l'ignorer) ; typer `resultRef`
comme ce qu'il est — une référence — et l'écrire ; et publier **deux** patrons, un pour les
mutations (transactionnel) et un pour les actions (`runMutation` de réservation, puis `runMutation`
de complétion). Le troisième point mérite une vérification sur un prototype avant d'écrire la suite.

---

## S6 — Une commande sans table est impossible, alors que deux types d'établissement déclarés n'ont pas de tables

**Gravité : sérieux.**

**Ce qui ne va pas. [vérifié]**
`venues.venueType` accepte huit valeurs, dont **`fast_food`** et **`food_court`**
(`convex/schema.ts:196-205`). Or :

- `tableSessions.tableId: v.id("restaurantTables")` — **obligatoire** (`convex/schema.ts:594`)
- `orders.tableSessionId: v.id("tableSessions")` — **obligatoire** (`convex/schema.ts:707`)

Il n'existe donc **aucun chemin** pour enregistrer une commande au comptoir, à emporter, ou dans un
food court sans table attribuée. Recherche de `comptoir|emporter|takeaway|counter|walk-in` dans
`PRODUCT.md`, `DATA_MODEL.md`, `ARCHITECTURE.md`, `INFORMATION_ARCHITECTURE.md` : **aucune occurrence
traitant l'absence de table**. Les seules mentions du comptoir concernent le *lieu de paiement*
(`at_counter`, `PRODUCT.md:77`) — c'est-à-dire un client qui a bien une table et va payer ailleurs.

**La conséquence concrète.** Un maquis avec un bar où l'on consomme debout, un fast-food, un stand de
food court : ces établissements sont **dans la liste des types supportés** et le produit ne peut pas
prendre leur commande. Le contournement inévitable est la création de tables fictives
(« Comptoir 1 », « Emporter »), qui pollue le plan de salle, le taux d'occupation, la rotation et le
CA par couvert — c'est-à-dire **plusieurs des indicateurs d'`ANALYTICS.md:73-74`**.

**Ce que je propose.** Deux options honnêtes ; la première est la bonne pour la V1 :
- **retirer `fast_food` et `food_court` de `venueType`** et l'écrire dans « ce qui est volontairement
  absent » (`ROADMAP.md:188-197`), qui est précisément fait pour ça ;
- ou rendre `tableSessions.tableId` optionnel et ajouter `originType: "counter"` — **mais** cela
  touche R1, R5, `restaurantTables.activeSessionId` et l'écran serveur. Ce n'est pas un champ, c'est
  une tranche.

---

## S7 — Le renommage `receipts` → `bills` n'est pas propagé, et deux décisions « acceptées » se contredisent

**Gravité : sérieux.** *Parce que le sujet est juridique, pas cosmétique.*

**La contradiction. [vérifié]** Deux décisions, toutes deux marquées **« accepté »**, même date :

| | Texte |
|---|---|
| `DECISION_LOG.md:272` (**D-015**) | « le produit émet des **« reçus »** » |
| `DECISION_LOG.md:281` (**D-024**) | « **jamais « reçu » ni « facture »** avant certification […] « reçu » désigne le **RNE** […] certifié par la DGI » |

D-024 est la conclusion de la révision d'A7 ; D-015 est l'état antérieur, laissé intact. Pire :
**le corps même d'A7**, dans le paragraphe qui porte la révision, conclut encore
*« le produit émet des reçus »* (`DECISION_LOG.md:156`).

**Le renommage non propagé. [vérifié]** Cinq sites appellent encore la pièce ou son module
`receipts` / « reçu » :

- `ARCHITECTURE.md:114` — le module du diagramme d'architecture : `REC["receipts<br/>reçus, fiscalité par pays"]`
- `ARCHITECTURE.md:439` — l'arborescence backend : `├── checks/ payments/ cash/ receipts/`
- `ARCHITECTURE.md:346` et `:356` — le diagramme de séquence de paiement : `CX-->>C: reçu (temps réel)`, « il retrouve son reçu »
- `DATA_MODEL.md:874` — « conditionne les champs `fiscal*` de `receipts` »
- `DATA_MODEL.md:70` — « les objets qu'un humain doit citer à voix haute (commande, bon, addition, **reçu**) »

**La conséquence concrète.** D-024 dit *« ni dans l'interface, ni dans le code »*. Un module backend
nommé `receipts/` **est** du code. Et l'enjeu n'est pas la pureté : c'est qu'un développeur qui lit
l'arborescence nommera ses fonctions `createReceipt`, son UI dira « reçu », et le produit affichera
le nom d'une pièce certifiée sur un ticket qui ne l'est pas — dans un pays qui contrôle depuis le
1ᵉʳ septembre 2026.

**Ce que je propose.** Supprimer D-015 (absorbée par D-024, et fausse en l'état) ou la marquer
« révisée par D-024 » ; renommer le module `receipts/` en `bills/` ; corriger les cinq sites.
**Et ajouter un test de lint** sur les mots « reçu » / « facture » / « receipt » / « invoice » dans
`src/` et `convex/` — c'est la seule façon qu'une règle de vocabulaire survive à six mois.

---

## S8 — L'abstraction fiscale a perdu les deux membres qui portaient sa raison d'être

**Gravité : sérieux.**

**Ce qui ne va pas. [vérifié]** `docs/research/payments-africa.md:1596-1614` définit `FiscalProvider`
avec, notamment, `allowsDeferredCertification` et `documentLabel()`. `PAYMENTS.md:284-294` republie
l'interface **sans ces deux membres** :

```ts
export interface FiscalProvider {
  readonly jurisdiction: string;
  readonly requiresClearance: boolean;
  certify(bill: BillSnapshot): Promise<{ type; reference; qrPayload; seal? }>;
  status(reference: string): Promise<FiscalStatus>;
}
```

Or ces deux membres portaient exactement les deux enjeux :

- `allowsDeferredCertification` encode la réponse à ce que la recherche classe **« question n°2 par
  ordre d'importance »** (`payments-africa.md:1634-1636`) : que fait-on quand le réseau tombe sous un
  régime de *clearance* ?
- `documentLabel()` est le **mécanisme** qui rend D-024 exécutable — la recherche l'annote
  `// jamais "Facture"`. Sans lui, le libellé est décidé dans l'UI, c'est-à-dire partout.

**Ce que je propose.** Restaurer les deux membres. Ils ne coûtent rien et ils sont la différence
entre une abstraction et un formulaire.

---

## S9 — Un conflit non vu entre le régime de clearance et le cercle 3 du hors-ligne

**Gravité : sérieux.** *Personne n'a rapproché ces deux décisions.*

**Ce qui ne va pas.** Deux affirmations, dans deux documents, incompatibles :

| Source | Texte |
|---|---|
| `PAYMENTS.md:280-281` | « Le régime ivoirien est un modèle de **clearance** : la pièce doit être validée par l'administration **avant** remise au client » |
| `DECISION_LOG.md:100-102` (**A4**, cercle 3) | « Si le réseau est absent, **on encaisse en espèces et on enregistre après**. C'est ce que le restaurant fait déjà » |

**La conséquence concrète.** Si la clearance est bien exigée avant remise — et
`payments-africa.md:1637-1639` note que *« rien n'indique que la DGI [l']autorise »* pour la file
locale —, alors **le cercle 3 d'A4 décrit potentiellement une pratique non conforme** : encaisser
hors ligne sans pièce certifiée. A4 est écrit comme une prudence ; ce pourrait être la faute.

Ce conflit n'est signalé ni dans A4, ni dans A7, ni dans le risque R6, ni dans la question ouverte
n°10 du `DECISION_LOG.md` — qui demande seulement *qui obtient la spécification*.

**Ce que je propose.** Reformuler la question n°10 pour qu'elle porte la vraie question :
*« la DGI autorise-t-elle une certification différée après coupure réseau, et sous quelles
conditions ? »*. C'est la réponse à celle-là, pas à « obtenir la spec », qui décide si ce produit
peut servir un restaurant ivoirien un soir de panne — c'est-à-dire s'il peut servir un restaurant
ivoirien.

---

## S10 — `R1`…`R11` désignent deux choses différentes dans le même dépôt

**Gravité : sérieux.** *Petit défaut, grosse conséquence de lecture.*

**Ce qui ne va pas. [vérifié]** Deux numérotations concurrentes, toutes deux actives :

| Schéma | Source | Exemple |
|---|---|---|
| **Règles métier R1–R30** | `PRODUCT.md §8` (lignes 280-311) | **R7** = « une commande envoyée deux fois par un double clic n'en crée qu'une » |
| **Risques R1–R11** | `docs/ARCHITECTURE_DECISIONS.md:569-581` | **R7** = « Le hors-ligne promis n'est pas tenu » |

Collisions sur **R1 à R11**, soit onze jetons. Le schéma et `DATA_MODEL.md` citent abondamment le
premier jeu (`// garantit R1`, `(R28)`, `Verrou de R20`, `(R23)`, `Rend R22 opposable`…) ; la
synthèse — le document que l'on lit en premier — publie le second.

**La conséquence concrète.** Qui lit `convex/schema.ts:628` (`// garantit R1`) et cherche R1 dans la
synthèse trouve *« Le personnel contourne l'outil — mode d'échec n°1 du secteur »*, ce qui n'a aucun
rapport avec un index sur les sessions de table. `SECURITY.md` utilise, lui, un préfixe distinct
(`M1`…`M20`) — ce qui prouve que le problème a été résolu une fois, et pas partout.

**Ce que je propose.** Renommer les risques en **`K1`…`K11`** dans `ARCHITECTURE_DECISIONS.md §27`
(un seul document à modifier, aucune référence entrante) et laisser les règles métier en `R`.

---

# 3. À CONSIDÉRER

**C1 — L'ancrage promis pour le PIN de service n'existe pas.** `DECISION_LOG.md:46` (A1) affirme :
*« Par défaut je conçois le schéma pour que les deux coexistent (`staffProfiles.pinHash`,
`trustedDevices`) »*. **[vérifié]** : `trustedDevices` existe ; **`staffProfiles` n'est nulle part
dans `convex/schema.ts`**, et `pinHash` n'apparaît dans aucun fichier du dépôt hors cette phrase.
Conséquence : le risque classé **n°1 et « Fatal »** (« le personnel contourne l'outil ») a pour
mitigation principale un PIN dont l'ancrage annoncé est imaginaire — l'ajouter plus tard sera une
migration, exactement ce qu'A1 prétendait éviter. *Correction : ajouter la table, ou corriger la
phrase — mais ne pas laisser croire que c'est fait.*

**C2 — Aucune table d'agrégats quotidiens.** `ANALYTICS.md:122` (« Agrégats quotidiens précalculés
par tâche planifiée ») et `ROADMAP.md:124` (T6) en dépendent. **[vérifié]** : aucune table
d'agrégat dans `convex/schema.ts`, et elle n'apparaît **pas non plus** dans la liste des tables
différées avec point d'ancrage (`DATA_MODEL.md:35-43`) — ce n'est donc pas un report assumé, c'est
un oubli. *Correction : l'ajouter aux différés avec son ancrage, ou la créer en T6.*

**C3 — Deux règles d'analytique sont inapplicables.** `ANALYTICS.md:113` (*« Les commandes de test et
le mode simulation ne comptent jamais »*) et `ANALYTICS.md:197` (interdit n°5) supposent un
marqueur qui n'existe pas (voir **G2**/B3). Une règle énoncée comme un interdit sans donnée pour la
faire respecter finit par être violée sans que personne s'en aperçoive — et, comme le dit le
document lui-même, *« elle rend tous les chiffres suspects quand on la découvre »*. *Correction : le
champ d'abord, la règle ensuite.*

**C4 — `bills` n'est gouvernée par aucune permission.** **[vérifié]** : le catalogue de
`PERMISSIONS.md §3` ne contient **aucune** permission `bill.*` ni équivalente, et la fiche `bills`
de `DATA_MODEL.md:729-746` est l'une des **23 fiches sur 52 dépourvues de la ligne
« **Permissions** »** — alors que l'en-tête du document (`DATA_MODEL.md:3`) annonce que *chaque*
table en porte une. Ne sont donc gouvernés ni la réimpression d'un ticket (vecteur de fraude
classique en restauration), ni son envoi par e-mail/WhatsApp (exfiltration), ni — le jour où la FNE
sera branchée — **le droit de soumettre une pièce à l'administration fiscale**. *Correction :
`bill.issue`, `bill.reprint`, `bill.send`, `bill.fiscal.submit`.*

**C5 — `roles.isSystemTemplate` n'existe pas.** `PERMISSIONS.md:255` publie un extrait de schéma
contenant `isSystemTemplate` ; **[vérifié]** `convex/schema.ts:161-171` ne porte que `isCustom`. Le
même extrait omet `archivedAt` et `description`. *Correction : régénérer l'extrait depuis le schéma,
ou le remplacer par un renvoi — un extrait recopié à la main diverge toujours.*

**C6 — Les index mono-statut servent des écrans multi-statuts.** `tableSessions.by_venue_status` est
présenté comme servant *« Écran serveur, caisse, tour de contrôle »* (`DATA_MODEL.md:845`). Or
l'écran serveur veut les sessions **non terminales** — quatre statuts — donc quatre requêtes, ou un
`.filter()` que la règle de `DATA_MODEL.md:855-856` interdit elle-même. Idem pour
`orders.by_venue_status_submitted` et les « retards ». Ce n'est pas grave (quatre requêtes indexées
sont bon marché), mais la fiche §11 est trompeuse. *Correction : écrire « une requête par statut » —
ou ajouter un booléen `isTerminal` et indexer dessus.*

**C7 — TTL d'idempotence (1 jour) plus courte que la fenêtre de réessai du fournisseur (3 jours).**
`PAYMENTS.md:164` pose `expiresAt: Date.now() + DAY` ; D-025 retient Wave *« pour ses réessais sur
3 jours »* (`DECISION_LOG.md:282`). Le risque réel est limité — la déduplication des webhooks passe
par `webhookEvents.by_provider_event`, qui n'a pas de TTL — mais les deux chiffres devraient être
liés, pas indépendants. *Correction : TTL = fenêtre de réessai maximale des fournisseurs actifs.*

**C8 — `carts` / `cartItems` ne servent rien avant T4.** Leur justification
(`DATA_MODEL.md:486-492`) est le panier **collaboratif** — livré en T4 (`ROADMAP.md:97`). En T0–T3,
`localStorage` suffit, d'autant que `cartItems.estimatedUnitPrice` est explicitement marqué
« AFFICHAGE seulement » (`convex/schema.ts:698`) et que R14 impose de tout recalculer côté serveur.
Deux tables, trois index et un cycle de vie (dont une tâche d'abandon) portés quatre tranches à
l'avance. *C'est mineur et le rattrapage est facile — je le signale comme économie possible, pas
comme défaut.*

**C9 — « 1 341 lignes, typecheck vert ».** `ARCHITECTURE_DECISIONS.md:288-289`. **[vérifié]** :
`wc -l convex/schema.ts` → **1 360**. Le « typecheck vert » n'est pas vérifiable ici (pas de
dépendances Convex exploitables dans l'environnement). *Nit — mais dans un document qui se prévaut
de vérifications mécaniques, un chiffre faux entame la confiance dans les autres. À l'inverse, les
comptes « 58 tables », « 141 index + 1 index de recherche » et « 6 au maximum par table » sont
**exacts** : je les ai recomptés.*

---

# 4. LE COUP DE JUDO

**Les questions posées étaient : 58 tables sont-elles nécessaires ? La séparation commande /
addition / paiement est-elle sur-conçue ? Le multi-tenant à deux niveaux est-il prématuré ?**

Ma réponse aux deux premières est **non, et c'est du bon travail** :

- **58 tables, ce n'est pas trop.** Le brief en proposait ~150 ; 12 sont écartées **avec leur
  raison**, 5 groupes différés **avec leur point d'ancrage** (`DATA_MODEL.md:18-43`). Les
  justifications d'écart (`orderItemModifiers` intégré, `productTranslations` intégré,
  `paymentAllocations` inutile parce qu'un paiement se rattache à une seule addition) sont
  techniquement justes. Je ne retirerais que `carts`/`cartItems` (C8), et c'est marginal.
- **La séparation commande / addition / paiement n'est pas sur-conçue.** Le partage d'addition est
  un besoin quotidien, pas un luxe, et le rétrofit est brutal. D-007 tient.

**Mais il y a un pan entier à supprimer, et ce n'est aucun des trois : c'est le second appareil de
sécurité.**

La conception défend la frontière de tenant **deux fois**, par deux mécanismes distincts :

1. **La dérivation** — `requireVenueAccess`, « la portée avant la donnée », la re-vérification de
   toute cible chargée par clé étrangère (`PERMISSIONS.md §6`). **Ce mécanisme est correct, complet,
   bien expliqué, et suffisant.**
2. **La recopie** — `organizationId` dénormalisé sur ~50 tables + la règle « premier champ d'index =
   clé de portée ». **Ce mécanisme est violé à 55 % (B1), jamais vérifié (B2), et il n'apporte rien
   que le premier n'apporte déjà.**

Le second existe parce qu'il *ressemble* à de la sécurité. Il produit l'inverse : un champ recopié
qui peut mentir, une règle que personne ne peut suivre, et une affirmation de vérification qui est
fausse — le tout sur le seul risque classé **fatal**.

**Ce que je propose, et c'est un retrait net :**

| Retirer | Gagner |
|---|---|
| La règle « premier champ = clé de portée » des 5 documents | 66 dérogations non justifiées disparaissent ; la règle restante (`PERMISSIONS.md §6`) redevient lisible, et donc respectée |
| `organizationId` des tables scopées par `venueId` | ~50 champs ; un seul chemin de portée ; plus aucune ligne capable de se contredire elle-même |
| `tableSessions.totals` (S4) | Un seul cache d'argent au lieu de deux ; un invariant non écrit de moins |

**Conserver à tout prix :** `requireVenueAccess`, la re-vérification de la cible, la réponse
`NOT_FOUND` plutôt que `FORBIDDEN`, et **le test d'isolation croisée sur chaque fonction publique**
(`ARCHITECTURE_DECISIONS.md:178-179`) — qui reste, et de loin, le meilleur garde-fou du projet.

**Sur le multi-tenant à deux niveaux : la question est mal posée.** Le coût n'est pas le niveau
`organization` — il faut bien un porteur d'abonnement, et H6 le justifie. Le coût est d'avoir
**matérialisé le lien sur chaque ligne** au lieu de le dériver. Garder deux niveaux, oui. Recopier
la clé du niveau haut cinquante fois sans jamais la vérifier, non.

---

# 5. ADOPTION — ce qui va agacer dès le premier service

Le dépôt identifie correctement R1 (« le personnel contourne l'outil ») comme le mode d'échec n°1, et
ses réponses — PIN de service, mode serveur par défaut, mode simulation — sont les bonnes réponses.
**Deux des trois ne sont pas ancrées** (le PIN : C1 ; la simulation : G2/B3). Voici ce que la
conception **n'a pas vu** :

1. **Le transfert de table casse le service, et c'est l'un des gestes les plus fréquents du métier**
   (S1). Un serveur qui voit un plat arriver à la mauvaise table à cause du logiciel ne le pardonne
   pas : il reprend son carnet le soir même. C'est le scénario d'abandon le plus probable de toute
   cette conception.
2. **La caissière ne peut pas fermer sa caisse le soir où il y a un écart** (G4 — déjà identifié
   dans l'IA, mais absent de la synthèse et de la roadmap). Un écart de caisse n'est pas rare :
   c'est quotidien. Un logiciel qui immobilise la caissière jusqu'à l'arrivée d'un manager sera
   contourné en une semaine.
3. **Le serveur n'a aucun moyen de servir un client debout au comptoir** (S6). Il inventera une
   table. Le plan de salle deviendra faux, puis les analytics, puis le produit perdra sa crédibilité
   auprès du gérant — qui est celui qui paie.
4. **`order.modify.after_fire` est refusée au serveur** (`PERMISSIONS.md:221`) — et c'est
   défendable. Mais rien dans les écrans ne dit **quoi faire à la place** : appeler un Floor Manager
   à 21 h pour retirer un plat d'une commande, c'est le genre de friction qui produit une commande
   fantôme (le serveur envoie le plat et s'arrange « à la main »). *Suggestion : une demande
   d'annulation qui remonte au manager sans bloquer le serveur — `serviceRequests` peut la porter
   sans nouvelle table.*

**Ce qui est bien vu et qu'il ne faut pas affaiblir :** le mode serveur par défaut (A2), le refus de
classer les serveurs (`ANALYTICS.md:84-87`), et le plafond opposable de 5 entrées de navigation sur
mobile (`INFORMATION_ARCHITECTURE.md §1.2`, règle 5). Ces trois choix montrent que quelqu'un a pensé
au personnel, et pas seulement au gérant.

---

# 6. JUSTE — bien pesé, ne pas y toucher au prochain passage

Ces points ont été instruits sérieusement. Les rouvrir coûterait du temps sans rien gagner.

- **La recherche est la meilleure partie du dépôt.** `docs/research/*` source chaque affirmation avec
  URL et date de consultation, et distingue explicitement le vérifié (✅), l'incertain (⚠️) et le non
  établi (❌ / « NV »). `payments-africa.md:1662-1668` va jusqu'à écrire que le taux de TVA
  applicable à la restauration est *« une déduction par exclusion, pas une citation »*, et
  `competitive-analysis.md:376` note que le portail FNE renvoyait HTTP 503 au moment de la
  consultation plutôt que d'inventer une spécification. C'est exactement la discipline attendue.
- **D-023** (le scan échange le jeton contre un cookie `httpOnly` puis redirige en 302) : c'est la
  seule mesure qui *supprime* le jeton de l'historique, du `Referer` et des journaux au lieu de le
  limiter. Bien vu, bien argumenté.
- **D-030** (pas de `Disallow: /r/`) : contre-intuitif et **juste** — interdire l'exploration
  empêcherait Google de voir le `noindex`.
- **D-004 + D-028** (exposant décimal dérivé de la devise, jamais écrit en dur ; `acceptedAmount`
  distinct de `amount` pour capter l'arrondi silencieux d'un agrégateur) : deux pièges réels, tous
  deux évités, et le second est de ceux qu'on ne découvre normalement qu'après une caisse fausse.
- **A8** : refuser d'annoncer un hors-ligne qu'on ne tient pas, et poser explicitement l'arbitrage
  d'investissement à l'utilisateur plutôt que de le trancher soi-même, est la bonne conduite.
- **D-002** (catalogue de permissions en code, rôles en base) : l'argument du typage et de la source
  de vérité unique est décisif.
- **`PERMISSIONS.md §6`** : le contre-exemple « lire puis vérifier » et sa correction sont la
  meilleure page technique du dépôt. C'est elle qui doit devenir **la** règle de portée (voir B1).
- **`docs/INFORMATION_ARCHITECTURE.md §0.3`** : un document qui ouvre sur ses propres manques
  bloquants, nommés et numérotés, est un document honnête. Le défaut n'est pas cette section — c'est
  qu'elle n'ait pas été remontée (B3).

---

# 7. VERDICT

**Non, cette conception n'est pas prête à être implémentée — mais elle en est proche, et les
corrections sont petites au regard de la qualité de l'ensemble.**

Ce qui interdit de commencer aujourd'hui tient en trois points, et aucun ne demande de repenser le
produit :

1. **B1 + B2 — décider de la règle de portée.** Soit on la tient (et il faut alors justifier ou
   corriger 66 index), soit on la retire au profit de `PERMISSIONS.md §6` — c'est ce que je
   recommande. Dans les deux cas, **retirer de la synthèse l'affirmation « vérifié par script :
   règle de portée respectée »**, qui est fausse aujourd'hui. Et ajouter l'assertion de cohérence
   `organizationId ↔ venue.organizationId`, qui est le vrai trou.
2. **B3 — remonter G1–G9 au niveau où ils décident.** Deux portes de sortie de la feuille de route
   (T1, T7) sont inatteignables en l'état, et une décision « acceptée » (D-026) n'a aucun support en
   base. Une demi-journée d'écriture, plus les champs de G1 sur `venues`.
3. **S1 — trancher le transfert de table.** Le modéliser ou le retirer du catalogue. Le laisser
   promis-et-impossible est la voie la plus courte vers l'abandon par le personnel, c'est-à-dire
   vers le risque que ce projet a lui-même classé fatal.

Ensuite viennent S2, S3, S5 et S6 — quatre corrections d'une demi-journée chacune, toutes localisées,
aucune structurelle.

**Ce que je veux dire clairement pour finir :** ce dépôt est nettement au-dessus de ce qu'on voit
habituellement à ce stade. Il documente ses désaccords, marque ses hypothèses, source ses faits,
nomme ses manques et refuse plusieurs fois de promettre ce qu'il ne tient pas. Les défauts trouvés
ici ne sont pas des défauts de jugement — ce sont des **défauts de propagation** : des décisions
justes prises tard (A7 révisé, D-024, les neuf G) qui ne sont pas redescendues dans les documents
écrits plus tôt, et un schéma écrit après les documents, qui a discrètement divergé d'eux.

La correction n'est donc pas de reconcevoir. C'est de **relire chaque document contre
`convex/schema.ts`, une fois, sérieusement** — et d'écrire les quatre tests mécaniques (règle de
portée, cohérence org ↔ venue, catalogue de permissions ↔ documentation, vocabulaire réglementé) qui
empêcheront la prochaine divergence de passer inaperçue.
