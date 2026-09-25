# INFORMATION_ARCHITECTURE.md — Joliba

> Livrable §115. Architecture de l'information et wireframes textuels de **toutes** les surfaces.
> Ce document ne décide rien de neuf : il **traduit en écrans** ce que `PRODUCT.md` (personas, modes,
> règles), `PERMISSIONS.md` (catalogue), `ARCHITECTURE.md` (routes, machines à états),
> `DATA_MODEL.md` (tables, index) et `docs/research/seo-strategy.md` §3 (sitemap validé) ont arrêté.
>
> Quand un écran demande une donnée ou une permission qui **n'existe pas** dans ces documents,
> je ne l'invente pas : je l'écris en **manque bloquant** au §0.3 et la page est marquée en
> conséquence. C'est la seule façon d'avoir un document sur lequel on peut coder.

---

## 0. Comment lire ce document

### 0.1 Le gabarit d'une page

Chaque page est décrite dans cet ordre, sans exception :

```
### <titre> — `<route>`
**Persona** · **Objectif** (la question à laquelle la page répond, en une phrase)
**Appareil dominant** · **Permissions requises** (citées de PERMISSIONS.md)
**Header** / **Navigation**
**Sections** (ordre visuel, contenu réel)
**Action principale** (une seule) · **Actions secondaires**
**États** : chargement · vide · erreur · permission refusée · hors ligne
**Mobile** / **Desktop**
**Données** (tables et index lus, cités de DATA_MODEL.md)
```

**Les familles de pages qui ne diffèrent que par leur contenu rédactionnel** (les 10 pages
fonctionnalité, les 9 pages solution, les 5 pages intégration, les 3 pages juridiques) sont décrites
**une fois comme gabarit**, suivi d'un tableau de variantes route par route. Recopier quarante fois
la même structure ne documenterait rien de plus et rendrait ce fichier illisible : ce qui compte,
pour ces pages, c'est le gabarit et ce qui change dedans.

### 0.2 Conventions valables partout

**Une page = une question = une action principale.** *(PRODUCT.md §5, principe 7.)* Si je n'arrive
pas à nommer l'action principale d'une page, je l'écris explicitement dans sa fiche au lieu de
l'inventer. C'est le cas de trois pages de ce document, toutes signalées.

**Deux densités, un seul système.** *(PRODUCT.md §5, principe 5 · ARCHITECTURE.md §9.)*
`components/guest/` = aéré, photo, grandes cibles tactiles, une action par écran.
`components/ops/` = dense, tabulaire, raccourcis clavier, aucune animation décorative.
Une même primitive, deux échelles. Une page de ce document indique toujours de quelle famille elle
relève.

**Les permissions sont masquantes côté client, bloquantes côté serveur.** *(PERMISSIONS.md §8.)*
Ce qui est écrit « Permissions requises » décrit ce que la garde Convex exige ; l'UI masque ce qui
n'est pas permis, sauf quand l'absence rendrait l'écran incompréhensible — auquel cas elle affiche
l'élément avec sa raison. L'état « permission refusée » est un état d'écran à part entière, avec
**qui contacter**.

**L'état hors ligne suit les trois cercles de `A4`**, jamais autre chose :

| Cercle | Portée | Comportement d'écran |
|---|---|---|
| 1 — Lecture | Carte, prix, photos, plan de salle | Servi depuis le cache, bandeau discret « hors ligne — affichage du <heure> » |
| 2 — File d'écriture | **Personnel uniquement** : ajout d'article, prêt, servi, demande prise en charge | Le geste est accepté, l'élément porte l'état **« en attente de confirmation »**, visuellement distinct de « envoyé » |
| 3 — Refus explicite | Argent, clôture de caisse, remboursement, clôture de table, **et tout geste client** | Message qui dit quoi faire à la place : « Connexion perdue — l’encaissement attend le réseau » *(D-062 : aucune pièce différée n’est promise)* |

> Conséquence souvent oubliée : **le client à table n'est jamais dans le cercle 2.** Un invité hors
> ligne peut consulter la carte et composer son panier localement, mais l'envoi est refusé avec un
> message qui le renvoie vers le serveur. Afficher « commande envoyée » à un client hors ligne
> serait le pire mensonge que ce produit puisse faire.

**Aucune page n'affiche une donnée parce qu'elle existe.** Chaque section de chaque écran répond à
la question de la page. Les chiffres qui ne déclenchent aucune décision ne sont pas affichés — ils
sont dans l'export.

**Chaque état vide dit quoi faire**, avec un bouton qui le fait. Un état vide sans action est un
cul-de-sac ; il y en a zéro dans ce document.

**Argent, temps, langue.** Les montants sont formatés depuis l'entier en unité mineure + la devise
de l'établissement *(D-004)*. Les regroupements « par jour » utilisent `venues.timezone`, jamais
celle du navigateur. L'UI est en français, une seule locale *(D-029)*. Le mot « facture » n'apparaît
nulle part ; la pièce remise s'appelle **ticket** dans l'UI et `bills` dans le code *(D-015, D-024)*.

### 0.3 Manques bloquants — à trancher avant d'implémenter ces écrans

Ces points ne sont pas des détails de mise en page : ce sont des écrans que **je ne peux pas
spécifier honnêtement** en l'état. Ils sont numérotés `G1…G9` et cités dans les fiches concernées.

| # | Manque | Écrans touchés | Effet si on ne tranche pas |
|---|---|---|---|
| **G1** | **`venues` ne porte ni adresse, ni téléphone, ni horaires, ni description, ni coordonnées géo.** Or `seo-strategy.md` §6.9 (JSON-LD `Restaurant`) et §7.5 (porte de qualité `menuIndexability`) les exigent, et lisent `venue.address`, `venue.openingHours`, `venue.description`, `venue.menuItemCount`, `venue.menuUpdatedAt` | `/menu/$venueSlug`, `/app/settings/venue`, la carte du client (bloc « infos »), le tableau d'indexabilité de l'onboarding | Le menu public ne peut **pas** être livré : ni son balisage, ni sa porte de qualité, ni son écran de réglage n'ont de données |
| **G2** | **Le mode simulation (§38) n'a aucun point d'ancrage.** Ni `tableSessions.isSimulation`, ni `venues.isDemo`, rien. Le seul voisin est `venues.status = "setup"` | `/app/onboarding/simulation`, `/app/live`, `/app/cashier`, `/app/analytics` | Soit la simulation pollue la caisse et les analytics réelles, soit elle n'existe pas. Aucune des deux n'est acceptable |
| **G3** | **`closed_with_debt` n'a pas de permission.** `R2` et `ARCHITECTURE.md` §4 exigent « permission + motif », le catalogue n'en propose aucune. `table.session.close` est détenue par tout serveur | `/app/tables/$id`, `/app/cashier`, parcours (e) | Soit un serveur peut effacer une dette d'un geste, soit personne ne peut clôturer une table dont le client est parti |
| **G4** | **La machine de caisse n'a pas de sortie depuis `discrepancy` sans `adjusted`** (`ARCHITECTURE.md` §8). Or `cash_register.adjust` n'est **pas** dans le rôle Cashier (`PERMISSIONS.md` §4) | `/app/registers`, parcours (e) | Mariam constate un écart et **ne peut pas fermer sa caisse** : elle attend un manager, chaque soir. Correction proposée : ajouter la transition `discrepancy → closed` (écart **constaté et conservé**), et réserver `adjusted` à la modification effective du chiffre |
| **G5** | **Aucune table pour le support ni les incidents plateforme**, alors que `platform.support.manage` et `platform.incidents.manage` existent | `/admin/support`, `/admin/incidents` | Ces deux pages n'ont rien à lire. `bugReports` couvre une partie du support, rien des incidents |
| **G6** | **`D-026` exige que le fournisseur de paiement actif se change par configuration en base** ; aucun bloc de `venueSettings` ni aucune table ne le porte | `/app/settings/payments`, `/admin/organizations/$id` | L'écran de réglage des paiements n'a rien à écrire, et changer de rail redevient un déploiement — ce que `D-026` interdit |
| **G7** | **Réservations, fidélité, stock, intégrations tierces sont différés** (`DATA_MODEL.md` §0) mais leurs permissions sont au catalogue (`reservation.*`, `loyalty.manage`, `inventory.*`) | `/app/settings/integrations`, `/fonctionnalites/stock` | Des écrans et une page marketing promettent des fonctions sans données. Voir G8 |
| **G8** | **Deux pages marketing du sitemap validé promettent ce que la V1 ne tient pas** : `/fonctionnalites/stock` (le stock est un simple point d'ancrage, `A3`) et `/fonctionnalites/hors-ligne` dont la description promet « le service continue quand la 4G tombe » — c'est exactement le **« hors-ligne en trompe-l'œil »** que `A8` refuse d'annoncer | `/fonctionnalites/stock`, `/fonctionnalites/hors-ligne` | Le produit publie une promesse que son propre journal de décisions lui interdit. Ces deux pages ne sont pas publiées en V1, ou leur discours est réécrit sur les trois cercles réels |
| **G9** | **Nommage d'URL incohérent** : les routes publiques sont en français (`/fonctionnalites`, `/tarifs`, `/connexion`) et les routes applicatives en anglais (`/app/live`, `/app/kitchen`, `/app/settings`) | Toute la surface C, D | Ce n'est pas bloquant techniquement. C'est bloquant pour la cohérence : il faut **choisir une fois**. Ce document garde les routes telles qu'`ARCHITECTURE.md` §9 et le brief les nomment, sans les harmoniser de sa propre autorité |

> Trois pages de ce document n'ont **pas** d'action principale nommable en l'état, et c'est un défaut
> de conception, pas de rédaction : `/app/settings/integrations` (G7), `/admin/incidents` (G5) et
> `/fonctionnalites/stock` (G8). Elles sont écrites comme telles.

---

## 1. Carte de navigation par rôle

### 1.1 Le problème, nommé

Le catalogue compte une cinquantaine de permissions et la surface applicative une quarantaine de
routes. La pente naturelle est une barre latérale de trente-cinq entrées, identique pour tous, où le
cuisinier cherche son écran entre « Abonnement » et « Journal d'audit ». Le brief l'interdit (§58) et
il a raison : **une navigation qui ne se réduit pas est une navigation qui n'aide personne.**

### 1.2 Les cinq règles qui font la réduction

1. **La navigation est dérivée des permissions, jamais du nom du rôle.** Une entrée s'affiche si
   l'utilisateur détient **au moins une** permission de lecture de son groupe, résolue par
   `usePermissions(venueId)` *(PERMISSIONS.md §8)*. Aucun `if (role === "waiter")` nulle part.
2. **Un groupe qui ne rendrait qu'une entrée n'est pas un groupe.** Il est remplacé par cette
   entrée. C'est ce qui fait qu'un caissier voit trois liens et non « Argent ▸ Caisse ».
3. **Les réglages ne sont jamais dans la navigation principale.** Ils vivent derrière le sélecteur
   d'établissement, en pied de rail. Personne ne règle la TVA pendant le service.
4. **La posture prime sur l'exhaustivité.** Pendant le service, le manager a **une** destination par
   défaut : `/app/live`. Le reste existe, mais ce n'est pas ce qui s'ouvre.
5. **Plafond opposable : 5 entrées sur mobile, 9 sur desktop, réglages exclus.** Dépasser ce plafond
   est un défaut de revue, pas une tolérance. La onzième entrée d'un rôle est le signe qu'on lui a
   donné le travail de deux personnes.

### 1.3 Ce que chaque rôle voit réellement

**Koffi — serveur** *(mobile, barre basse, 4 entrées)*

| Entrée | Route | Permission qui la déclenche |
|---|---|---|
| **Mes tables** *(défaut)* | `/app/tables?filtre=mes-tables` | `table.read` |
| Salle | `/app/tables` | `table.read` |
| Demandes <sup>·pastille·</sup> | `/app/live?vue=demandes` | `service_request.read` |
| Carte | `/app/menu` (lecture seule) | `menu.read` |

Pas de « Commandes » : une commande se lit **depuis sa table**. C'est ainsi que Koffi la cherche.
S'il détient `payment.collect` (case cochée par le restaurant, `PERMISSIONS.md` §4 note 1), une
cinquième entrée **Encaisser** apparaît ; sinon elle n'existe pas.

**Ibrahim — cuisine** *(tablette murale, aucune navigation)*

Un seul écran : `/app/kitchen/$stationId`. Pas de barre, pas de tiroir, pas de retour. Deux
affordances dans l'en-tête, et rien d'autre :
- un **sélecteur de station**, affiché **seulement** s'il a accès à plus d'une station ;
- **Ruptures**, qui ouvre une feuille de disponibilité — visible seulement avec
  `menu.availability.toggle`.

C'est le seul rôle du produit dont la navigation est **nulle**, et c'est délibéré : la cuisine n'a
pas de main libre pour naviguer.

**Mariam — caissière** *(tablette ou desktop, 3 entrées)*

| Entrée | Route | Permission |
|---|---|---|
| **Caisse** *(défaut)* | `/app/cashier` | `check.manage` ou `payment.collect` |
| Paiements | `/app/payments` | `payment.read` |
| Ma caisse | `/app/registers` | `cash_register.open` ou `cash_register.close` |

Aucun accès carte, aucun accès équipe, aucun accès analytics. Le rôle Cashier ne porte pas
`order.create` : elle ne voit donc **aucun bouton de prise de commande**.

**Awa — gérante d'un établissement** *(desktop + mobile, 8 entrées en 3 groupes)*

| Groupe | Entrées | Permissions |
|---|---|---|
| **Service** | **En direct** *(défaut)*, Salle, Commandes, Cuisine | `order.read`, `table.read`, `kitchen.read`, `service_request.read` |
| **Argent** | Caisse, Paiements | `payment.read`, `check.manage`, `cash_register.*` |
| **Gestion** | Carte, Données | `menu.read`, `analytics.read` |
| *pied de rail* | Équipe, Clients, Assistant, ⚙ Réglages | `team.read`, `customer.read`, `ai.use`, `venue.manage` |

« En direct » est la destination par défaut **pendant les heures de service**
(`venues.timezone` + plages d'ouverture) ; « Données » le devient en dehors. La navigation ne change
pas de contenu, seulement de point d'entrée.

**Serge — propriétaire de quatre établissements** *(desktop d'abord)*

Sa navigation **commence par le sélecteur d'établissement**, et c'est l'essentiel de son produit :

```
┌─────────────────────────────────────────┐
│ ▾ Cocody            (4 établissements)  │   ← sélecteur = navigation principale
├─────────────────────────────────────────┤
│ ★ Vue groupe          ← SEULE entrée de portée organisation
├─────────────────────────────────────────┤
│   …navigation de l'établissement sélectionné (identique à Awa)…
└─────────────────────────────────────────┘
```

**Vue groupe** n'apparaît que s'il détient `organization.analytics.read`, et **uniquement** s'il a
accès à plus d'un établissement. Un manager mono-site ne voit jamais cette entrée : elle n'aurait
rien à comparer. Un manager affecté à Cocody et Plateau voit deux lignes dans le sélecteur, jamais
les quatre — la portée est dans la question, pas dans le rôle *(PERMISSIONS.md §1.3)*.

**Équipe Joliba** — surface `/admin/*`, chemin totalement séparé
(`requirePlatformAdmin`), jamais mélangé à la navigation client. Un administrateur plateforme qui
ouvre `/app` est un utilisateur ordinaire de ses propres organisations, et rien de plus.

### 1.4 La preuve du plafond

| Rôle | Entrées principales | Réglages | Total visible |
|---|---:|---:|---:|
| Kitchen / Bar | 0 | 0 | **0** |
| Cashier | 3 | 0 | **3** |
| Waiter | 4 (5 si encaissement) | 0 | **4–5** |
| Floor Manager | 6 | 0 | **6** |
| Venue Manager | 8 | 1 tiroir | **9** |
| Owner multi-sites | 9 (8 + Vue groupe) | 1 tiroir | **10** — plus le sélecteur d'établissement, qui n'est pas une entrée mais un contexte |
| Accountant | 2 (Paiements, Données) | 0 | **2** |

Trente-cinq entrées, jamais. Le rôle le plus chargé du produit en voit dix.

### 1.5 La barre de réglages, surface à part

`/app/settings/*` est un **tiroir**, pas une page de la navigation : onze onglets, chacun gardé par
sa propre permission, dont trois qui ne s'affichent qu'au niveau organisation (`billing`, `roles`,
audit organisation). Un Venue Manager qui ouvre le tiroir voit six onglets sur onze. Le détail est
en §4.17.

---

## 2. Surface A — public et marketing

**Hôte et rendu.** `example.com` (SSR + cache, indexable). Les menus publics des clients vivent sur
un **hôte séparé**, `menus.example.com` *(seo-strategy §7.4)* ; l'application sur `app.example.com`,
en `noindex` intégral. Toute URL est préfixée de sa locale (`/fr/…`, `/en/…`) et **aucune
redirection automatique** selon la langue du navigateur ou l'IP *(D-029)*.

**Source du contenu.** Les pages marketing, les articles et les guides **n'ont aucune table** dans
`DATA_MODEL.md`. Leur contenu est donc en **fichiers versionnés (MDX) rendus au SSR** — c'est la
seule lecture possible du modèle actuel, et c'est le bon choix : un article ne change pas en temps
réel, il se relit en revue et il se déploie. Deux exceptions qui lisent Convex : `/tarifs` (table
`plans`, lecture publique) et `/menu/$venueSlug` (`venues` + `menuPublications`).

**Navigation commune à toute la surface.** En-tête : logo · Fonctionnalités ▾ · Solutions ▾ ·
Tarifs · Ressources ▾ · **Demander une démo** (bouton) · Se connecter. Pied : quatre colonnes
(Produit, Solutions, Ressources, Entreprise) + mentions légales + sélecteur de langue avec liens
`hreflang` réciproques. Un seul bouton de conversion dans l'en-tête, partout.

### Accueil — `/`

**Persona** : Awa (gérante) en premier ; Serge (multi-sites) en second.
**Objectif** : répondre en dix secondes à « est-ce que ça sait faire tourner *mon* établissement, et
combien ça coûte ? ».
**Appareil dominant** : mobile Android d'entrée de gamme, 4G instable.
**Permissions requises** : aucune (page publique).

**Header** : en-tête marketing commun, fond transparent qui se solidifie au défilement.
**Navigation** : en-tête commun + ancres internes vers les trois blocs de preuve.

**Sections**
1. **Hero** — titre qui nomme la douleur, pas la technologie : « Sachez enfin ce qui entre dans
   votre caisse. » Sous-titre : la chaîne complète en une phrase (commande à table → cuisine →
   caisse → encaissement Mobile Money). Un bouton primaire **Demander une démonstration**, un lien
   secondaire « Voir les tarifs ». Visuel : une capture réelle de `/app/live` sur téléphone, pas une
   illustration.
2. **Les quatre douleurs**, dans l'ordre de `PRODUCT.md` §4 : la commande qui se perd (P1), l'argent
   qu'on ne compte pas (P2), le client qui attend (P3), le gérant qui découvre le lendemain (P5).
   Une ligne par douleur, le geste du produit en regard. Pas d'icônes décoratives.
3. **La chaîne**, en un seul schéma horizontal : scan → carte → commande → cuisine → service →
   addition → paiement → clôture. Chaque maillon renvoie à sa page fonctionnalité.
4. **« Vous travaillez comment ? »** — trois cartes correspondant aux trois axes de service
   *(PRODUCT.md §2)* : « Mes serveurs prennent tout », « Le client compose, mon serveur valide »,
   « Le client commande seul ». Message : *le logiciel s'adapte, vous ne changez rien.*
5. **Preuve** — trois clients nommés avec leur accord, un chiffre chacun, et un lien vers
   `/clients`. Aucun témoignage composé, aucune moyenne invérifiable *(seo-strategy §8.2)*.
6. **Paiements** — les rails réellement branchés, logos et rien d'autre. Une intégration non livrée
   ne figure pas ici *(règle de `/integrations/*`)*.
7. **Prix, en clair** — la fourchette d'entrée en FCFA et « aucun matériel à acheter » *(D-021,
   D-022)*, avec lien vers `/tarifs`.
8. **Conversion finale** — démo, ou essai en autonomie.

**Action principale** : **Demander une démonstration** (`/demo`).
**Actions secondaires** : voir les tarifs · ouvrir une page solution · se connecter.

**États** — *chargement* : SSR, le premier écran est complet sans JavaScript ; les images sous la
ligne de flottaison sont différées. *Vide* : sans objet. *Erreur* : page 500 sobre avec un numéro de
téléphone et un lien WhatsApp — c'est le canal réel du marché. *Permission refusée* : sans objet.
*Hors ligne* : coquille servie par le cache, bandeau « vous êtes hors ligne ».

**Mobile** : une colonne, le hero tient en un écran, la barre de navigation devient un tiroir, le
bouton de démo reste **collé en bas** au défilement. **Desktop** : deux colonnes dans le hero, le
schéma de chaîne en pleine largeur.

**Données** : aucune lecture Convex. Contenu MDX + données structurées `Organization` + `WebSite`
*(seo-strategy §6.3)*.

### Tarifs — `/tarifs`

**Persona** : Awa ; Serge pour le palier multi-sites.
**Objectif** : « combien je paie par mois, et qu'est-ce qui s'ajoute quand j'encaisse ? »
**Appareil dominant** : mobile.
**Permissions requises** : aucune. Lecture publique de `plans` *(DATA_MODEL §3)*.

**Sections**
1. **Bascule mensuel / annuel** et **sélecteur de devise**, par défaut la devise du marché affiché.
2. **Grille des plans** — un plan par colonne, lu depuis `plans` (`key`, `label`, `prices[]`,
   `limits`). Les limites sont affichées **telles qu'elles sont** (`venues`, `staffSeats`,
   `monthlyOrders`) : ce sont elles qui rétrécissent les droits *(PERMISSIONS.md §6)*.
3. **Commissions de paiement, publiées** — tableau par rail. C'est le point où cinq concurrents sur
   treize se taisent ; se taire ici coûterait plus que le chiffre lui-même.
4. **Ce qui est inclus et ne se facture pas** : nombre d'écrans de cuisine, terminaux, QR.
   *(D-021 : aucun matériel propriétaire, pas de supplément par écran.)*
5. **Comparatif détaillé**, repliable, fonctionnalité par fonctionnalité.
6. **Questions fréquentes** — engagement, résiliation, export des données au départ. Pas de balisage
   `FAQPage` *(seo-strategy §6.8 : le résultat enrichi n'existe plus)*.

**Action principale** : **Commencer** (ouvre l'inscription en autonomie).
**Actions secondaires** : demander une démo · nous appeler.

**États** — *chargement* : la grille est rendue au SSR depuis `plans` ; squelette uniquement si le
cache est froid. *Vide* : impossible en pratique ; si `plans` ne renvoie rien, on affiche « Nos
formules sont en cours de mise à jour » + bouton contact, jamais une grille vide. *Erreur* :
repli sur une grille statique du dernier déploiement, avec la date. *Hors ligne* : dernière grille
en cache. **Aucune donnée structurée `Product`/`Offer`** *(seo-strategy §6.7)*.

**Mobile** : une carte par plan, empilées, le plan recommandé en premier ; le comparatif devient un
accordéon. **Desktop** : quatre colonnes comparables d'un coup d'œil.

**Données** : `plans` par `by_public ["isPublic"]`, trié par `sortOrder`.

### Demander une démonstration — `/demo`

**Persona** : Awa, Serge. **Objectif** : obtenir un rendez-vous qualifié en moins d'une minute.
**Appareil** : mobile. **Permissions** : aucune.

**Sections**
1. **Ce qui va se passer** — 30 minutes, en ligne ou sur place, avec quelqu'un qui connaît le
   métier. Dire la durée supprime la moitié de l'hésitation.
2. **Formulaire court** : nom · établissement · **WhatsApp** (canal principal du marché, l'e-mail
   est facultatif) · ville · nombre de tables · créneau souhaité. Six champs, pas huit.
3. **Alternative immédiate** : « Pressé ? Appelez-nous » + bouton WhatsApp direct.
4. Preuve légère : trois logos clients.

**Action principale** : **Réserver le créneau**.
**Actions secondaires** : appeler · écrire sur WhatsApp · voir les tarifs.

**États** — *chargement* : bouton en attente, champs verrouillés, jamais de double envoi.
*Vide* : sans objet. *Erreur* : le message d'erreur est sous le champ fautif, le formulaire **n'est
jamais vidé**. *Hors ligne* : refus explicite (cercle 3) — « pas de connexion : appelez-nous », avec
le numéro cliquable. *Permission refusée* : sans objet.

**Mobile** : un champ par ligne, clavier adapté par type (`tel` pour le numéro).
**Desktop** : deux colonnes, argumentaire à gauche, formulaire à droite, sans défilement.

**Données** : aucune table. La soumission part vers une fonction serveur (e-mail + notification
interne). Rien n'est écrit dans une table métier : un prospect n'est pas un `customerProfile`.

### Nous contacter — `/contact` · Qui nous sommes — `/a-propos` · Ils nous font confiance — `/clients`

Trois pages de confiance, même gabarit, objectifs distincts.

| Route | Objectif | Sections | Action principale | État vide |
|---|---|---|---|---|
| `/contact` | Joindre un humain **maintenant** | Canaux par ordre d'efficacité réelle : WhatsApp, téléphone, e-mail · horaires alignés sur ceux d'un restaurant (soirs et week-ends) · adresse et carte si un bureau existe · formulaire en dernier | **Écrire sur WhatsApp** | sans objet |
| `/a-propos` | Répondre au « qui a écrit ça ? » de l'E-E-A-T | L'équipe, nommée, avec photos réelles · pourquoi un outil conçu ici · comment nous travaillons avec les restaurants (terrain, entretiens) · ce que nous ne faisons pas | Demander une démo | sans objet |
| `/clients` | Preuve sociale vérifiable | Trois à six cas, chacun : établissement nommé, format, ce qui a changé, **un** chiffre consenti · filtre par type d'établissement | Demander une démo | « Nos premiers cas seront publiés dès l'accord de nos clients » + lien `/demo`. Jamais de faux témoignage pour remplir |

**Appareil** : mobile. **Permissions** : aucune. **Données** : MDX. **Hors ligne** : cercle 1 pour
`/a-propos` et `/clients` ; `/contact` reste utile hors ligne car le numéro est du texte.

### Fonctionnalités — `/fonctionnalites` (hub) et ses dix pages

> ⚠️ Le sitemap validé *(seo-strategy §3.2)* ne comporte **pas** de page hub `/fonctionnalites`, et
> il compte **dix** pages fonctionnalité, pas sept. Je garde les dix (c'est la liste validée) et
> j'ajoute le hub, parce qu'un menu déroulant à dix entrées a besoin d'une page d'atterrissage
> lorsqu'on y arrive par un lien. Le hub est `noindex, follow` : il n'a pas de requête propre et ne
> doit pas concurrencer ses enfants.

**Hub `/fonctionnalites`** — **Objectif** : orienter vers la bonne page en un coup d'œil.
**Sections** : la chaîne de service en schéma, chaque maillon cliquable · les dix pages groupées en
trois familles (Salle, Production, Argent) · lien vers `/tarifs`.
**Action principale** : ouvrir la fonctionnalité qui correspond à sa douleur.
**États** : vide/erreur sans objet ; hors ligne, cercle 1.

**Gabarit d'une page fonctionnalité** — *toutes identiques en structure, c'est voulu : la
comparaison entre pages doit être immédiate.*

```
1. Titre = la promesse en langage de restaurateur, pas de logiciel
2. Le problème, en trois lignes, avec la douleur de PRODUCT.md §4 qu'il traite
3. Comment ça marche — 3 étapes, une capture RÉELLE par étape
4. Ce que ça change, mesuré ou pas dit du tout
5. « Et si… » — les objections du terrain, traitées (réseau, personnel, matériel)
6. Ce que ça ne fait pas   ← section rare et décisive en vente B2B
7. Renvois : 2 pages fonctionnalité voisines + 1 page solution + 1 guide
8. Conversion : Demander une démo
```
**Action principale** (toutes) : **Demander une démonstration**.
**Appareil** : mobile. **Permissions** : aucune. **Données** : MDX + `BreadcrumbList`.
**États** : *hors ligne* cercle 1 ; les autres sans objet.

| Route | Douleur traitée | Ce que la page montre en capture | Livraison |
|---|---|---|---|
| `/fonctionnalites/commande-a-table` | P1, P3 | Le parcours client : scan → carte → envoi | V1 |
| `/fonctionnalites/menu` | P6, P8 | L'édition d'un prix, puis la carte client à jour au scan suivant | V1 |
| `/fonctionnalites/menu-public` | acquisition | La page menu publique et sa porte de qualité | V1.5 — **dépend de G1** |
| `/fonctionnalites/kds` | P1, P4 | `/app/kitchen/$stationId` en plein service | V1 |
| `/fonctionnalites/caisse` | P2 | Une clôture avec écart, expliquée | V1 |
| `/fonctionnalites/paiements` | P2, P7 | Une addition à quatre, espèces + Mobile Money | V1 |
| `/fonctionnalites/rapports` | P5 | Le rapport du matin sur téléphone | V1 |
| `/fonctionnalites/equipe` | P2, P10 | Rôles et portées : « Manager de Cocody, et rien d'autre » | V1 |
| `/fonctionnalites/stock` | P8 | — | **Non publiée en V1 (G8)** : le stock n'est qu'un point d'ancrage `A3`. Publier cette page, c'est vendre ce qui n'existe pas |
| `/fonctionnalites/hors-ligne` | résilience | Les **trois cercles** de `A4`, nommés | **Non publiée telle quelle (G8)** : la description validée promet un hors-ligne que `A8` refuse d'annoncer. À réécrire sur ce que le produit tient : lecture en cache, file d'écriture du personnel, refus explicite sur l'argent |

### Solutions — neuf pages, deux axes

**Axe « type d'établissement »** — gabarit : *le vocabulaire du métier, pas le nôtre.* Sections :
une journée type dans ce format · les trois ou quatre fonctions qui comptent **pour lui** (jamais la
liste complète) · le mode de service recommandé parmi les trois axes de `PRODUCT.md` §2 · un cas
client du même format · tarif d'entrée · démo.
**Action principale** : Demander une démonstration.

| Route | Format | Mode de service mis en avant | Angle |
|---|---|---|---|
| `/solutions/maquis` | Maquis, bars de quartier | `staff_only` puis `guest_with_approval` | La caisse qui tombe juste, chaque serveur son compte |
| `/solutions/restaurant` | Restaurant de table | `guest_with_approval` *(défaut A2)* | Plan de salle → passe → addition partagée |
| `/solutions/fast-food` | Fast-food, food court | `guest_direct` | File rapide, cuisine synchronisée |
| `/solutions/hotel` | Restauration d'hôtel | `staff_only` + `hybrid` | Restaurant, bar, room service |
| `/solutions/groupes` | Groupes multi-sites | tous | Vue consolidée, droits par site, cartes par établissement |

**Axe « marché »** — une page pays n'existe que si elle réunit **au moins trois** des six critères de
`seo-strategy` §3.3 (moyens de paiement propres, devise, cadre fiscal, deux clients nommés, présence
locale, contenu éditorial propre). **La granularité maximale est le pays, jamais la ville** : une
page par commune d'Abidjan est du *doorway abuse* et c'est interdit, quelle que soit la pression
commerciale. Sections : les rails réellement disponibles ici · prix en monnaie locale · cadre fiscal
(pour la Côte d'Ivoire : la FNE, **sans rien promettre** tant que la spécification n'est pas en main,
`A7`) · clients locaux nommés · contact local.

| Route | Rails cités | Cadre cité | Condition de publication |
|---|---|---|---|
| `/solutions/cote-divoire` | Wave, Orange Money, Moov, MTN | FNE / DGI, SYSCOHADA | V1 |
| `/solutions/senegal` | Wave, Orange Money | — | Deux clients nommés au Sénégal |
| `/solutions/benin` | MTN MoMo, Moov, Celtiis Cash | — | Idem, au Bénin |
| `/solutions/cameroun` | MTN MoMo, Orange Money | — | Idem, au Cameroun |

**Appareil** : mobile. **Permissions** : aucune. **Données** : MDX. **État vide** : une page marché
dont les critères ne sont plus réunis est **dépubliée**, pas laissée vide.

### Intégrations — `/integrations` et ses quatre pages

**Règle absolue** : une page `/integrations/<x>` **n'est publiée que si l'intégration existe**. Une
page « bientôt disponible » est une page faible **et** une promesse commerciale non tenue.

**Hub `/integrations`** — **Objectif** : « est-ce que ça marche avec ce que j'utilise déjà ? »
**Sections** : trois familles (moyens de paiement, impression, comptabilité) · une carte par
intégration livrée · une ligne honnête « ce qui n'est pas encore branché », sans page dédiée ni date.
**Action principale** : ouvrir la fiche de son moyen de paiement.

**Gabarit d'une page intégration** : ce que ça fait concrètement (« chaque paiement rattaché à sa
table et à sa commande ») · comment on la met en service, en trois étapes · **les commissions,
chiffrées** · ce qui se passe en cas d'échec ou de double notification *(l'idempotence est un
argument de vente, pas un détail)* · ce dont on a besoin côté restaurant (compte marchand, pièces).
**Action principale** : Demander une démonstration.

| Route | Publiée quand | Ordre de branchement |
|---|---|---|
| `/integrations/wave` | Rail n°1 livré | 1 *(D-025)* |
| `/integrations/orange-money` | Via l'agrégateur, quand il est livré | 2 |
| `/integrations/mtn-momo` | Idem | 2 |
| `/integrations/moov-money` | Idem | 2 |

> L'espèce n'a pas de page d'intégration : ce n'est pas une intégration, c'est un moyen de paiement
> de première classe du produit *(D-019)*. Elle est traitée dans `/fonctionnalites/caisse`.

**Données** : MDX. **Hors ligne** : cercle 1.

### Ressources — `/ressources` (hub unique), `/guides`, `/blog`, `/modeles`

`/ressources` est **le hub unique** du contenu ; `/guides` et `/blog` en sont les sous-sections
*(seo-strategy §3.1a : trois hubs pour un site jeune, c'en est deux de trop)*.

**`/ressources`** — **Objectif** : « par où je commence ? »
**Sections** : trois piliers mis en avant (les guides les plus utiles) · les cinq derniers articles ·
les gabarits téléchargeables · une ligne d'abonnement, WhatsApp **ou** e-mail.
**Action principale** : ouvrir un guide. **État vide** : impossible — le hub n'est publié qu'avec
au moins trois guides.

**`/guides`** (index des piliers) et **`/blog`** (index des satellites, antéchronologique, paginé).
Sections communes : filtre par thème · carte par contenu (titre, promesse en une ligne, temps de
lecture, date de **mise à jour** pour un guide, date de publication pour un article).
**Action principale** : ouvrir un contenu.
**État vide** d'un filtre : « Aucun contenu sur ce thème pour l'instant » + bouton « Voir tout » +
lien « Dites-nous ce que vous voulez lire » vers `/contact`.

**`/guides/$slug`** — pilier, intemporel, mis à jour.
**Sections** : sommaire ancré et collant · corps avec des captures réelles · encadrés « sur le
terrain » issus des entretiens · **date de dernière mise à jour en évidence** · auteur nommé avec
son rôle (E-E-A-T) · gabarit téléchargeable associé · trois articles satellites · conversion en pied.
**Action principale** : télécharger le gabarit associé, **ou**, s'il n'y en a pas, demander une démo.
**Données** : MDX + `Article`/`BlogPosting` + `BreadcrumbList` *(seo-strategy §6.4, §6.5)*.

**`/blog/$slug`** — satellite, daté, périssable. Même gabarit, sans sommaire, avec un renvoi
**obligatoire** vers son guide pilier : un satellite qui ne renvoie à rien n'a pas de raison d'être.
**Action principale** : lire le guide pilier.

**`/modeles/$slug`** — gabarit téléchargeable (fiche technique de plat, tableau de clôture de caisse,
calculateur de food cost en FCFA).
**Objectif** : donner quelque chose d'utile **sans rien demander**.
**Sections** : à quoi ça sert et comment s'en servir · aperçu du gabarit · bouton de téléchargement
· ce que le produit fait à sa place, en une ligne, sans insister.
**Action principale** : **Télécharger** — sans formulaire. C'est précisément l'absence de formulaire
qui rend ces pages citables, donc qui apporte les liens.
**États** — *erreur* : si le fichier manque, on affiche le contenu en ligne plutôt qu'un 404.
*Hors ligne* : la page est en cache, le téléchargement échoue avec un message clair.
**Appareil** : desktop dominant (on télécharge un tableur), mobile lisible.

### Confiance et juridique — `/securite`, `/confidentialite`, `/conditions`, `/cookies`, `/statut`

**`/securite`** est la seule des cinq qui vend, et elle vend beaucoup en B2B dès qu'on touche à
l'argent. **Objectif** : « où vivent mes données, qui peut y accéder, et que se passe-t-il si je
pars ? »
**Sections** : où sont hébergées les données et sous quelle juridiction · qui y accède côté
Joliba, et le fait que **tout accès support est journalisé, motivé et limité dans le temps**
*(`platform.impersonate`)* · le contrôle d'accès du client (rôles, portée par établissement) · les
paiements : ce que nous ne stockons **jamais** · le journal d'audit · la sauvegarde et la
restauration · **la réversibilité : vous partez avec vos données** · comment signaler une faille.
**Action principale** : télécharger la fiche de sécurité (PDF) — c'est ce qu'un acheteur transmet en
interne. **Secondaire** : signaler une vulnérabilité.

**Gabarit juridique** (`/confidentialite`, `/conditions`, `/cookies`) : sommaire ancré · date
d'entrée en vigueur en tête · corps en sections numérotées · contact du responsable de traitement.
**Action principale** : aucune — et c'est **normal pour ces trois pages** : leur objectif est d'être
lisibles et citables, pas de convertir. C'est le seul endroit du document où l'absence d'action est
un choix et non un défaut.

| Route | Indexation | Particularité |
|---|---|---|
| `/confidentialite` | index | Renvoie vers l'effacement des données *(§91)* |
| `/conditions` | index | Abonnement, résiliation, réversibilité |
| `/cookies` | **noindex, follow** | Existe parce que les bandeaux de consentement pointent vers une URL dédiée ; aucune valeur de recherche *(seo-strategy §3.1e)* |
| `/statut` | **noindex** | Souvent un sous-domaine tiers ; disponibilité en temps réel + historique |

**États** (les quatre) — *hors ligne* : cercle 1. *Erreur* : la version précédente en cache avec sa
date, jamais une page vide. **Données** : MDX.

### Connexion — `/connexion` et `/auth/otp`

**Persona** : tout le personnel ; en pratique surtout Awa, Serge et les managers.
**Objectif** : entrer dans l'application en moins de dix secondes, depuis un téléphone, en salle.
**Appareil dominant** : mobile. **Permissions** : aucune (surface non authentifiée).
**Indexation** : `noindex`.

**`/connexion` — sections**
1. Logo, et une phrase : « Entrez votre e-mail, nous vous envoyons un code. »
2. Champ e-mail (clavier `email`, saisie automatique activée) → **Recevoir mon code**.
3. Séparateur, puis **Continuer avec Google**.
4. Lien « Rejoindre avec une invitation » (jeton d'`organizationInvitations`).
5. Aucune création de compte ici : **une organisation se crée depuis le site**, pas depuis l'écran
   de connexion.

**`/auth/otp` — sections** : six cases de code, collage automatique depuis les SMS/e-mails,
compte à rebours de renvoi (60 s), lien « changer d'adresse », et l'adresse visée affichée en clair
pour rattraper une faute de frappe.

**Action principale** : `/connexion` → **Recevoir mon code** · `/auth/otp` → **Valider**.

**États** — *chargement* : bouton en attente, un seul envoi possible (limitation de débit côté
serveur). *Vide* : sans objet. *Erreur* : « code invalide ou expiré » sans jamais préciser si
l'adresse existe — dire « cette adresse n'existe pas » est une fuite d'existence, exactement comme
répondre `FORBIDDEN` sur une ressource d'une autre organisation *(PERMISSIONS.md §6)*. *Permission
refusée* : un utilisateur authentifié mais membre d'aucune organisation **active** voit un écran
dédié : « Votre accès a été suspendu ou retiré — contactez le responsable de votre établissement »,
avec le contact si on le connaît. *Hors ligne* : cercle 3, refus explicite — l'OTP exige le réseau.

**Mobile** : plein écran, une seule cible tactile visible à la fois.
**Desktop** : carte centrée, largeur 380 px, rien d'autre à l'écran.

**Données** : Better Auth (tables propres, hors `DATA_MODEL.md`) puis `users by_auth ["authId"]`,
`organizationMembers by_user ["userId"]` pour choisir l'organisation d'entrée. Si le membre a
plusieurs organisations, un sélecteur s'intercale ; s'il n'en a qu'une, il ne le voit jamais.

> **Ce que cet écran ne résout pas, et qu'il faut savoir.** `A1` établit que l'OTP par e-mail est
> impraticable pour un serveur ou un cuisinier en plein service. Tant que le PIN de service sur
> appareil enrôlé n'est pas tranché, `/connexion` reste **l'écran des gérants**, et la cuisine tient
> par `trustedDevices` (jeton long, révocable, aucune session humaine). L'écran ci-dessus est donc
> juste, mais il ne couvre pas la moitié du personnel.

### Menu public d'un établissement — `/menu/$venueSlug`

> Hôte : `menus.example.com`. C'est la seule page publique qui lit Convex et la seule qui appartient
> à un client. Elle est **la contrepartie SEO du produit** et le moteur de la boucle de croissance
> *(seo-strategy §8)*.

**Persona** : Aïcha **avant** d'entrer dans le restaurant — elle cherche « <nom du maquis> menu » ;
et le restaurateur qui partage son lien.
**Objectif** : montrer la carte réelle, à jour, avec les prix, en moins de deux secondes.
**Appareil dominant** : mobile, réseau faible.
**Permissions requises** : aucune. La garde est `venues.publicMenuEnabled` — **jamais d'indexation
par défaut**, le restaurant consent explicitement.

**Header** : nom de l'établissement, photo de couverture, type de cuisine, fourchette de prix,
**horaires (ouvert / fermé maintenant)**, adresse, bouton d'appel. *(⚠️ **G1** — aucun de ces
champs sauf le nom n'existe aujourd'hui dans `venues`.)*
**Navigation** : barre de sections collante (Entrées, Grillades, Boissons…), qui suit le défilement.

**Sections**
1. En-tête d'établissement (ci-dessus).
2. **La carte**, par section, chaque produit : photo, nom, description, prix, étiquettes et
   allergènes **déclarés** — et rien de déduit *(R28)*.
3. Un produit indisponible est **affiché grisé avec « épuisé »**, pas masqué : le client doit savoir
   que le plat existe habituellement.
4. Pied : adresse, plan, horaires, téléphone, et la mention sobre « Carte propulsée par
   Joliba », **en `rel="nofollow"`** *(seo-strategy §8.2)*.

**Action principale** : **Appeler l'établissement** (ou « Itinéraire » selon ce qui est renseigné).
C'est une vitrine : elle ne prend pas de commande, et elle ne doit pas essayer.
**Actions secondaires** : partager la carte · changer de langue.

**États** — *chargement* : SSR + cache CDN, images différées et dimensionnées ; le texte est lisible
avant les photos. *Vide* : si l'établissement n'a publié aucune carte, la page renvoie **404**, pas
une coquille vide — une page sans contenu est une page faible en série *(seo-strategy §7.5)*. *Erreur* : 404 avec
un lien vers l'accueil de l'hôte. *Permission refusée* : `publicMenuEnabled = false` → **404**, et
non 403 : l'existence de l'établissement n'a pas à être confirmée. *Hors ligne* : cercle 1, dernière
carte en cache avec sa date.

**Indexabilité** — décidée **par le code**, pas par la bonne volonté du client
*(seo-strategy §7.5)* : consentement + au moins 8 plats + la moitié décrits + adresse + horaires +
présentation ≥ 120 caractères + carte mise à jour depuis moins de 180 jours. En dessous :
`noindex, follow` et absence du sitemap. **Les motifs du refus sont montrés au restaurateur dans son
onboarding** (§5.1) — c'est ce qui transforme la contrainte en fonctionnalité.

**Mobile** : une colonne, photos en ratio fixe, barre de sections collante.
**Desktop** : deux colonnes, en-tête d'établissement en bandeau.

**Données** : `venues by_slug ["slug"]` · `menuPublications by_venue_current ["venueId","isCurrent"]`
— **on lit la publication, jamais le brouillon** *(R22)*. La disponibilité est évaluée **à la
lecture** (`availabilityRules by_venue_target`, `products.isAvailable`, `unavailableUntil`) dans la
timezone de l'établissement *(R23)*. Données structurées `Restaurant` + `hasMenu` *(§6.9)*, servies
**seulement si la page est indexable**.

---

## 3. Surface B — le client à table

### 3.0 Ce qui gouverne toute cette surface

**Il n'y a aucune permission ici, et ce n'est pas un oubli.** Le client n'a pas de compte
*(PRODUCT.md §7.1 : on ne lui impose jamais d'en créer)*. La garde n'est pas
`requirePermission` mais **la session invité** : un cookie `httpOnly` + `SameSite=Lax` + `Secure`,
signé, posé lors de l'échange du jeton, et dont la portée est **un `tableSessionId` et un seul**
*(D-008, D-023)*. Toute fonction Convex de cette surface commence par vérifier ce cookie et refuse
tout `tableSessionId` qui n'est pas le sien. C'est la garde ; elle est aussi stricte que les autres,
elle n'est simplement pas la même.

**Le jeton ne vit pas dans l'URL** *(D-023, seo-strategy §7.1)*. Toutes les routes ci-dessous, sauf
la première, sont **sans secret** : partageables sans danger, inertes hors du navigateur qui porte le
cookie.

**En-têtes, sur toute la surface `/r/*`** : `X-Robots-Tag: noindex, nofollow, noarchive, nosnippet` ·
`Cache-Control: no-store` · `Referrer-Policy: no-referrer` · `<meta name="robots">` en doublon ·
aucune balise canonique, aucun `hreflang`, aucune donnée structurée. Et **pas de `Disallow: /r/`
dans `robots.txt`** — interdire l'exploration empêcherait Google de *lire* le `noindex` *(D-030)*.

**Système de design** : `components/guest/` — aéré, photographique, grandes cibles, **une action par
écran**. Aucune animation qui coûte une image par seconde sur un Android d'entrée de gamme.

**Budget de performance, opposable** *(PRODUCT.md §5, principe 4)* : la carte s'affiche en moins de
deux secondes sur Android d'entrée de gamme en 4G instable. La coquille est rendue au SSR, la
disponibilité arrive ensuite par abonnement.

**Barre d'action persistante, en bas, sur toutes les pages de session** — trois cibles au plus, et
elles changent selon l'état de la session :

| État de `tableSessions` | Barre basse |
|---|---|
| `open` / `ordering`, panier vide | Carte · **Appeler** · Mes commandes |
| `ordering`, panier non vide | Carte · **Voir mon panier (n) · <total>** · Appeler |
| `billing` / `settling` | Carte · **Mon addition · <reste dû>** · Appeler |
| `closed` | Ticket · Laisser un avis |

### Échange du jeton — `/r/$venueSlug/t/$token`

**Persona** : Aïcha, appareil photo ouvert. **Objectif** : transformer un QR physique en session,
sans jamais laisser le secret derrière soi.
**Appareil** : mobile. **Permissions** : aucune ; la garde est la validité du jeton.

**Ce n'est pas une page : c'est un échange.** Le serveur valide `tableQrCodes.token`, ouvre ou
rejoint le `tableSession` de la table selon `venueSettings.service.qrStrategy`, pose le cookie et
répond **302 vers `/r/$venueSlug/table`**. En chemin nominal, l'utilisateur ne voit rien.

**Cette route ne rend un écran que pour échouer**, et chaque échec a son message et sa sortie :

| Cas | Écran | Sortie proposée |
|---|---|---|
| Jeton inconnu ou révoqué | « Ce QR code n'est plus valide » | Appeler un serveur (si la venue est identifiable) · voir la carte publique `/menu/$venueSlug` |
| Table `out_of_service` | « Cette table n'est pas en service » | Idem |
| `qrStrategy = table_activation` | La table doit être ouverte par le personnel | **Prévenir le serveur** (crée un `serviceRequest`) |
| `qrStrategy = presence_code` | Redirection vers `/r/$venueSlug/rejoindre` | Saisie du code affiché sur la table |
| `qrStrategy = approval` | « Votre demande a été transmise » | Attente, avec l'état en temps réel |
| Établissement `paused` / `archived` | « Le service est fermé » | Carte publique, horaires |

**Anomalie**, sans bloquer le client : `scanCount` et `lastScannedAt` alimentent la détection d'un QR
scanné deux cents fois depuis l'autre bout de la ville *(DATA_MODEL §5)*. Un scan suspect n'affiche
rien de spécial au client ; il remonte au personnel.

**États** — *chargement* : redirection serveur, jamais d'écran blanc. *Hors ligne* : cercle 3 —
« Impossible de rejoindre la table sans connexion », et on propose la carte en cache si on l'a.

**Données** : `tableQrCodes by_token ["token"]` · `restaurantTables` · `tableSessions
by_table_status ["tableId","status"]` (garantit `R1` : au plus une session non terminale) ·
création d'un `guestSessions`.

### Rejoindre par code — `/r/$venueSlug/rejoindre`

**Objectif** : entrer dans la session quand l'établissement exige un code de présence.
**Sections** : « Entrez le code affiché sur votre table » · 4 à 6 cases · « Je ne vois pas de code »
→ appeler un serveur.
**Action principale** : **Rejoindre la table**.
**États** — *erreur* : code faux, avec un compteur de tentatives et une limitation de débit côté
serveur. *Hors ligne* : cercle 3.
**Données** : `tableSessions.activationCode`, résolu dans la portée `venueId`.

### La carte — `/r/$venueSlug/table`

**Persona** : Aïcha, assise, quatre personnes, peu de batterie.
**Objectif** : voir ce qu'on peut manger ici, à quel prix, et le mettre dans le panier.
**Appareil** : mobile exclusivement (le desktop existe mais n'est pas le cas d'usage).
**Permissions** : aucune ; session invité.

**Header** (compact, se réduit au défilement) : nom de l'établissement · **Table 12** · le prénom du
serveur s'il est attribué (`assignedWaiterUserId`) — c'est ce qui garde le lien humain, et le
pourboire attribuable *(A2)* · un compteur discret « 3 personnes connectées » quand plusieurs invités
partagent la session *(R4)*.

**Navigation** : barre de sections collante, horizontale, qui suit le défilement ; un bouton
recherche ; la barre d'action basse.

**Sections**
1. **Bandeau de service** — visible **seulement** s'il dit quelque chose : « Votre commande est en
   préparation », « Le serveur arrive ». Pas de bandeau vide.
2. **Recherche et filtres** — un champ, et des filtres en puces : végétarien, sans porc, épicé,
   fourchette de prix. Les filtres ne portent **que sur ce qui est déclaré** *(R28)* ; un filtre
   allergène n'apparaît que si l'établissement a renseigné des allergènes, sinon il mentirait.
3. **Sections de carte** — par `menuSections.sortOrder`. Chaque produit : photo (ratio fixe, pas de
   décalage de mise en page), nom, une ligne de description, prix, étiquettes.
4. **Indisponibles** : grisés, « épuisé », **non masqués** et non cliquables.
5. **Suggestions** — `products.relatedProductIds`, déterministes, jamais une recommandation inventée
   par un modèle *(§33)*.
6. **Pied** : allergies → « prévenez votre serveur », mentions, langue.

**Action principale** : **ajouter un produit au panier** (ouvre la feuille de détail).
**Actions secondaires** : rechercher · filtrer · appeler un serveur · voir ses commandes.

**Temps réel** : la disponibilité est un abonnement. Quand la cuisine bascule un plat en rupture, la
carte du client change **sous ses yeux** — mais en douceur : le produit passe en grisé avec une
transition lente, et **aucun élément ne se déplace**. S'il est déjà au panier, l'alerte est traitée
au panier, pas ici *(R10)*.

**États** — *chargement* : coquille SSR avec sections et emplacements d'images dimensionnés ; le
texte avant les photos. *Vide* (aucune carte publiée) : « La carte n'est pas encore en ligne » +
**Appeler un serveur** — jamais un écran mort. *Erreur* : dernière carte en cache + bandeau.
*Permission refusée* : sans objet ; une session close renvoie vers l'écran de fin (ticket + avis).
*Hors ligne* : cercle 1, carte complète servie du cache avec « affichage du <heure> » ; le panier
reste manipulable **en local**, l'envoi est refusé.

**Mobile** : deux produits par ligne en grille, ou une colonne pour les sections à photos larges.
**Desktop** : trois colonnes, largeur maximale 960 px — la page reste une page de téléphone agrandie,
ce n'est pas un écran de bureau.

**Données** : `menuPublications by_venue_current` (**la publication, jamais le brouillon**, `R22`) ·
`products by_section_sort ["menuSectionId","sortOrder"]` — l'index du chemin le plus chaud du
produit · `availabilityRules by_venue_target` évaluées **à la lecture** dans la timezone de
l'établissement *(R23)* · `carts by_session` · `tableSessions`.

### Détail d'un produit — `/r/$venueSlug/table/produit/$productId` *(feuille basse)*

**Objectif** : composer exactement ce qu'on veut, et connaître le prix **avant** d'ajouter.
**Présentation** : feuille qui monte sur 90 % de la hauteur ; la carte reste visible derrière. Elle
a une route propre pour survivre à un rechargement et pour être partageable entre invités de la même
table.

**Sections** : photo · nom, description longue, allergènes et régimes **déclarés** · variantes
(`productVariants`, radio, prix visible sur chacune) · groupes d'options (`modifierGroups`, avec
`minSelect`/`maxSelect` appliqués et expliqués : « choisissez 1 » / « 2 au maximum ») · instructions
libres (« sans oignon ») · quantité · **service** (`courseNumber`) si l'établissement l'utilise, avec
des mots, pas des numéros : Boissons / Entrée / Plat / Dessert.

**Action principale** : **Ajouter — <prix recalculé en direct>**. Le bouton porte le prix, et il est
collé en bas ; il n'y a rien d'autre à faire sur cet écran.
**Actions secondaires** : fermer · ajouter puis continuer sur la même section.

**États** — *chargement* : contenu déjà connu par la liste, la feuille s'ouvre pleine. *Vide* : sans
objet. *Erreur* : produit devenu indisponible pendant l'ouverture → la feuille se verrouille et
propose deux alternatives de la même section. *Hors ligne* : composition possible, ajout au panier
local, avec la mention « sera envoyé au retour du réseau » **sur le panier, pas ici**.

**Données** : `products`, `productVariants by_product_sort`, `productModifierGroups by_product_sort`,
`modifierOptions by_group_sort`. Écriture : `cartItems` avec `estimatedUnitPrice` — dont le nom dit
tout : c'est un **affichage**, le prix qui fait foi est recalculé côté serveur à l'envoi *(R14)*.

### Panier — `/r/$venueSlug/table/panier`

**Persona** : Aïcha, et les trois autres si le panier est commun.
**Objectif** : vérifier ce qu'on envoie, et l'envoyer.
**Permissions** : aucune ; session invité. Le panier est commun à la table
(`carts.guestSessionId` absent) ou individuel selon le mode.

**Sections**
1. **Lignes** — nom, options choisies, instructions, quantité (− / +), prix de ligne. **Qui a ajouté
   quoi** est indiqué par une pastille de couleur (`guestSessions.colorKey`, `displayName`) dès que
   la table compte plus d'un invité : à quatre, c'est la seule façon de s'y retrouver.
2. **Alerte de disponibilité** — si un article est devenu indisponible pendant qu'il était au
   panier, il est signalé **ici et avant l'envoi**, jamais après *(R10)*, avec deux choix : retirer,
   ou remplacer par une suggestion.
3. **Total indicatif** — sous-total, taxes selon `venueSettings.tax.pricesIncludeTax`. Marqué
   « estimation » : le montant qui fait foi est celui que le serveur recalcule.
4. **Ce qui va se passer**, en une phrase, **dépendante du mode** *(D-011)* :
   - `guest_direct` → « Votre commande part directement en cuisine. »
   - `guest_with_approval` → « Votre serveur valide, puis la cuisine prépare. » *(défaut, A2)*
   - `pre_paid` → « Vous réglez, puis la cuisine prépare. »
   - `staff_only` → **il n'y a pas de bouton d'envoi** : « Montrez cet écran à votre serveur » +
     **Appeler le serveur**. C'est le mode par défaut d'un maquis, et il doit être aussi soigné que
     les autres.

**Action principale** : **Envoyer la commande** — ou, en `pre_paid`, **Payer et envoyer** ; ou, en
`staff_only`, **Appeler le serveur**.
**Actions secondaires** : continuer à commander · vider le panier · ajouter une note générale.

**États** — *chargement* : bouton en attente et **verrouillé** ; une clé d'idempotence est générée
**au premier appui** et réutilisée à chaque nouvelle tentative, si bien qu'un double appui ne crée
qu'une commande *(R7, D-010)*. *Vide* : « Votre panier est vide » + **Parcourir la carte**.
*Erreur* : `ITEM_UNAVAILABLE` → retour au point 2, rien n'est envoyé, le panier est conservé
intégralement. *Hors ligne* : **cercle 3, refus explicite** — « Pas de connexion : votre panier est
gardé sur ce téléphone. Appelez votre serveur pour commander. » On n'affiche **jamais** « commande
envoyée » sans confirmation serveur *(§71)*.

**Mobile** : liste pleine largeur, total et bouton collés en bas.
**Desktop** : deux colonnes, récapitulatif à droite.

**Données** : `carts by_session`, `cartItems by_cart` → mutation d'envoi qui crée `orders`
(+ `idempotencyKey`, index `by_idempotency`) et `orderItems` **avec leur snapshot figé**
*(R6, D-005)*.

### Suivi des commandes — `/r/$venueSlug/table/commandes`

**Persona** : Aïcha qui attend. **Objectif** : « où en est ce que j'ai commandé ? » — et surtout :
ne plus avoir à lever la main pour le savoir *(P3)*.

**Sections**
1. **Commande en cours**, la plus récente en haut : sa référence prononçable (`A-042`), l'heure
   d'envoi, et une **frise d'état en quatre temps** — Envoyée → Acceptée → En préparation → Prête.
   Les états `partially_ready` et `partially_served` sont rendus **par ligne**, pas par une
   cinquième pastille : à quatre, tout n'arrive jamais ensemble, et c'est exactement ce que le client
   veut voir *(ARCHITECTURE §5)*.
2. **Les lignes** avec leur propre état (`orderItems.status`), le nom **du jour de la commande**
   (`nameSnapshot`) — pas le nom actuel du catalogue.
3. **Attente en `pending_acceptance`** : « Votre serveur valide votre commande » + l'attente écoulée.
   Au-delà d'un seuil : **Appeler le serveur**.
4. **Attente en `pending_payment`** (mode `pre_paid`) : bouton **Payer maintenant**, et la mention
   explicite que **la cuisine ne commence pas avant** *(R8)*.
5. **Refus** (`rejected`) : le motif est affiché tel que le personnel l'a écrit, sans reformulation.
6. Commandes précédentes de la même session, repliées.
7. **Recommander** — reprend une commande passée sans rouvrir de session *(PRODUCT.md §7.1.7)*.

**Action principale** : **Commander à nouveau** *(ou **Payer maintenant** quand la commande attend
un paiement)*.
**Actions secondaires** : appeler le serveur · demander l'addition · signaler un problème sur une
ligne.

**Temps réel — ce qui bouge tout seul, et comment on le remarque sans être dérangé** : la frise
avance par abonnement. Un passage à **Prête** déclenche **une** pulsation de la ligne concernée et une
vibration courte si la page est au premier plan ; si elle est en arrière-plan, rien ne se passe — on
ne notifie pas un client qui a rangé son téléphone. Aucun son. Rien ne se réordonne sous le doigt :
une commande qui change d'état **reste à sa place**.

**États** — *chargement* : squelette d'une carte de commande. *Vide* : « Vous n'avez encore rien
commandé » + **Voir la carte**. *Erreur* : dernier état connu + « mise à jour impossible ».
*Hors ligne* : cercle 1, dernier état avec son horodatage — et surtout **pas de fausse progression**.

**Données** : `orders by_session ["tableSessionId"]` · `orderItems by_order` ·
`orderEvents by_order_at` pour les horodatages de la frise.

### Demande de service — feuille, accessible partout

**Objectif** : appeler sans lever la main *(P3)*. Un geste, deux au maximum.
**Déclenchement** : bouton **Appeler** de la barre basse, présent sur toutes les pages de session.

**Sections** : les types **activés par l'établissement**
(`venueSettings.serviceRequestTypes`) — Appeler le serveur · De l'eau · Des couverts · L'addition —
en gros boutons ; un champ note facultatif ; puis, une fois envoyé, l'état en clair : « Demande
reçue » → « <prénom> arrive ».
**Action principale** : **envoyer la demande** (le type choisi *est* l'envoi : un seul appui).
**États** — *erreur* : anti-abus, « vous avez déjà appelé il y a 30 secondes » avec le compte à
rebours issu de `cooldownSeconds` — un refus qui s'explique, pas un bouton mort. *Hors ligne* :
cercle 3 — « Pas de connexion : faites signe à votre serveur. » *Vide* : sans objet.
**Temps réel** : le passage de `open` à `acknowledged` change le libellé sans notification sonore.
**Données** : `serviceRequests` ; lecture côté personnel par
`by_venue_status_created ["venueId","status","createdAt"]`.

### Addition — `/r/$venueSlug/table/addition`

**Persona** : Aïcha, fin de repas, quatre personnes.
**Objectif** : « combien on doit, et comment on paie ? »

**Sections**
1. **Total dû**, en gros, en premier. C'est la question de l'écran.
2. Détail par ligne, regroupé par commande, avec remises (`orderAdjustments`), taxes, service.
3. **Déjà payé** — chaque paiement reçu, son moyen, son heure : c'est ce qui rend le paiement mixte
   compréhensible sans explication.
4. **Reste dû**, mis en évidence dès qu'il diffère du total.
5. Choix de la suite, **selon `venueSettings.service.paymentLocations`** :
   - `with_staff` → **Demander l'addition** (crée un `serviceRequest` de type addition) ;
   - `at_counter` → « Réglez au comptoir » + le numéro de table à citer ;
   - `in_app` → **Payer ma part** / **Payer le tout** ;
   - `mixed` → les deux, sans hiérarchie imposée.
6. **Partager l'addition** — visible dès que la session compte plus d'un invité.
7. Pourboire : **affiché seulement si `venueSettings.tipping.enabled`**, désactivé par défaut
   *(D-027)*.

**Action principale** : **Payer** — ou **Demander l'addition** dans les établissements qui encaissent
à table.
**Actions secondaires** : partager · demander un ticket · signaler une erreur sur l'addition.

**États** — *chargement* : le total avant le détail. *Vide* (rien de consommé) : « Rien à régler
pour l'instant » + **Voir la carte**. *Erreur* : montant indisponible → « Demandez votre addition à
votre serveur » — on n'affiche **jamais** un total approximatif. *Hors ligne* : cercle 3, refus
explicite, avec le dernier montant connu marqué « peut avoir changé ».

**Temps réel** : si le serveur ajoute une tournée pendant que l'écran est ouvert, le total change
avec un bandeau **« L'addition a été mise à jour »** et le bouton de paiement est **brièvement
désactivé** — payer un montant périmé est précisément ce que `R14` interdit.

**Données** : `checks by_session` · `checkItems by_check` · `payments by_check` ·
`tableSessions.totals` (dénormalisé, écrit uniquement par le domaine argent).

### Partage d'addition — `/r/$venueSlug/table/addition/partage`

**Persona** : les quatre de la table. **Objectif** : que chacun paie sa part sans négociation — le
moment de friction finale qui décide du souvenir *(P7)*.

**Sections**
1. **Le mode de partage**, en quatre choix nommés dans la langue des gens :
   - **Par article** (`by_items`) — on coche ce qu'on a pris ; un plat partagé peut être réparti,
     ce que `checkItems.quantityShare` sait représenter ;
   - **Par personne** (`by_guest`) — une part par invité connecté ;
   - **En parts égales** (`even`) — diviser par le nombre de convives ;
   - **Montant libre** (`by_amount`) — « je mets 10 000 ».
2. **Répartition en direct** — qui paie quoi, par pastille de couleur, avec le restant non attribué
   **toujours visible**. Cette ligne est la plus importante de l'écran : tant qu'elle n'est pas à
   zéro, la table n'est pas soldée.
3. **Ma part**, en gros, et son bouton de paiement.

**Action principale** : **Payer ma part**.
**Actions secondaires** : changer de mode · payer pour quelqu'un d'autre · tout remettre à zéro.

**Invariant affiché, pas seulement calculé** : pour une ligne de commande donnée, la somme des
allocations est égale à son `lineTotal` — c'est ce qui empêche une part de repas de disparaître
*(DATA_MODEL §9)*. Si l'écran ne peut pas le garantir, il refuse de valider et le dit.

**États** — *chargement* : squelette. *Vide* (un seul invité) : l'écran n'est pas proposé du tout.
*Erreur* : deux invités qui s'attribuent la même ligne en même temps → la seconde écriture est
refusée avec « Karim vient de prendre ce plat », et la répartition se rafraîchit. *Hors ligne* :
cercle 3.

**Temps réel** : c'est l'écran **le plus collaboratif** du produit — quatre téléphones écrivent sur
la même addition. Chaque changement apparaît chez les autres en moins d'une seconde, la ligne
touchée s'illumine une fois, avec le prénom de l'auteur. Rien ne se réordonne.

**Données** : `checks` (création d'une addition par part), `checkItems by_check` et
`by_order_item` — cet index sert précisément à vérifier qu'une ligne n'est pas allouée deux fois ·
`guestSessions by_session_status`.

### Paiement — `/r/$venueSlug/table/addition/payer` et retour `/…/retour`

**Persona** : Aïcha. **Objectif** : payer, et **savoir** que c'est payé.

**Sections** : le montant, non modifiable, **recalculé côté serveur** *(R14)* · les moyens réellement
disponibles pour cet établissement · selon le rail, l'écran adapte son action *(voir l'abstraction
`PaymentProvider`, payments-africa §5.5)* :
`redirect` (page du fournisseur) · `deep_link` (ouverture de l'application Wave) ·
`display_qr` · `await_push` (« validez la demande sur votre téléphone », avec compte à rebours) ·
`none` (espèces : l'écran renvoie vers le serveur et ne prétend rien encaisser).

**Action principale** : **Payer <montant>**.
**Actions secondaires** : changer de moyen · revenir à l'addition.

**États** — *chargement* : bouton verrouillé, clé d'idempotence unique par (addition, tentative) : un
double appui ne crée **pas** deux intentions *(D-010)*. *Attente* : état dédié « En attente de
confirmation », avec ce qu'il faut faire (« validez sur votre téléphone ») et un compte à rebours.
*Erreur* : échec confirmé → motif lisible + **Réessayer** + **Payer au comptoir**. *Hors ligne* :
cercle 3.

**Le retour du fournisseur ne prouve rien** *(R15)*. `/…/retour` affiche **« Vérification en
cours… »** et interroge le serveur ; c'est la vérification serveur, ou le webhook signé, qui écrit
l'état. Les deux chemins convergent sur la même mutation idempotente *(ARCHITECTURE §7)*. Si le
client ferme son navigateur, il retrouve son ticket au rechargement : la vérité est côté serveur.

**Cas réel à traiter et qui n'est pas un détail** : certains agrégateurs arrondissent le montant
sans prévenir. L'écran affiche le montant **accepté** (`acceptedAmount`) quand il diffère du montant
demandé, et la différence est visible — sinon la caisse ne tombe plus juste *(D-028)*.

**Données** : `paymentIntents` (+ `by_idempotency`, `by_provider_ref`) → `payments by_check` ·
`webhookEvents by_provider_event` pour l'idempotence *(R16)*.

### Ticket — `/r/$venueSlug/table/ticket/$reference`

**Objectif** : emporter une preuve de ce qu'on a payé.
**Le mot « reçu » et le mot « facture » n'apparaissent pas** : ce sont des pièces certifiées par la
DGI *(D-024, D-015)*. L'écran dit **ticket**.

**Sections** : établissement · date, table, serveur · lignes · taxes · paiements reçus avec leur
moyen · référence prononçable · pied configuré par l'établissement
(`venueSettings.fiscal.receiptFooter`). Les champs fiscaux existent mais restent à `none` tant que
la spécification FNE n'est pas en main : **rien n'est promis**.

**Action principale** : **Envoyer sur WhatsApp** — c'est le canal réel du marché, devant l'e-mail
*(question ouverte n°11)*.
**Actions secondaires** : enregistrer en PDF · recevoir par e-mail · laisser un avis.

**États** — *vide* : sans objet (le ticket n'existe qu'après paiement). *Erreur* : « Ticket
indisponible » + **Demander à votre serveur**. *Hors ligne* : cercle 1 si le ticket a été vu une
fois. *Permission refusée* : une référence qui n'appartient pas à la session du cookie → **404**,
jamais 403.

**Données** : `bills by_reference ["reference"]` — l'index existe précisément pour la vérification
publique d'une pièce.

### Avis — `/r/$venueSlug/table/avis`

**Objectif** : capter l'avis **quand le client vient de payer et qu'il est encore à table**.
**Déclenchement** : proposé après le paiement, jamais avant — et **jamais avant d'avoir consulté la
carte** *(PRODUCT.md §7.1.10)*.

**Sections** : une note de 1 à 5, des thèmes proposés (accueil, attente, plats, boissons,
propreté, prix), un commentaire libre facultatif avec le rappel « n'y mettez pas vos coordonnées ».
L'avis va **au restaurant seul, quelle que soit la note** : **aucun renvoi vers un avis public selon
la note** *(D-105)* — trier les clients satisfaits vers Google est interdit par ses règles et trompe
les autres clients. Proposé dans les 6 h qui suivent la clôture, une fois, au convive admis par le code ou qui a
commandé de son téléphone *(D-108)*.
**Action principale** : **Envoyer mon avis**.
**Actions secondaires** : fermer. Aucune coordonnée n'est demandée en T4.
**États** — *erreur* : l'avis est conservé localement et réessayé. *Hors ligne* : cercle 3, avec
conservation locale. *Vide* : sans objet.
**Données** : `feedback` ; `customerProfiles` + `customerConsents` **seulement** si le client
laisse volontairement ses coordonnées — le consentement est daté, versionné et *append-only*.

---

## 4. Surface C — l'application restaurant

**Hôte et rendu** : `app.example.com`, SPA authentifiée + abonnements Convex, `noindex` intégral.
**Système de design** : `components/ops/` — dense, tabulaire, raccourcis clavier, zéro animation
décorative. **Portée** : tout écran est lu dans la portée `(organizationId, venueId)` de l'appelant ;
la portée est vérifiée **avant** la lecture, jamais après *(PERMISSIONS.md §6)*.

**Gabarit d'en-tête, commun à tous les écrans `/app/*`** : sélecteur d'établissement (seulement si
l'utilisateur en a plus d'un) · titre de l'écran · zone d'actions à droite · pastille d'état réseau
qui n'apparaît **que** lorsqu'elle a quelque chose à dire.

**Deux règles de temps réel valables partout dans cette surface :**
1. **Rien ne se réordonne sous le doigt.** Une ligne qui change d'état change d'apparence à sa place.
   Un tri qui change pendant qu'on vise une cible est un geste raté, et en plein service, un geste
   raté est un plat perdu.
2. **Ce qui apparaît s'annonce une fois, puis se tait.** Un nouvel élément arrive avec une pulsation
   d'une seconde et, si l'écran le justifie, un son court **configurable par station**. Aucun
   clignotement permanent : un écran qui clignote tout le temps devient un écran qu'on ne regarde
   plus.

### 4.1 Accueil — `/app`

**Persona** : tous. **Objectif** : envoyer chacun là où il travaille, en un appui, sans lui faire
lire un tableau de bord dont il n'a pas l'usage.
**Appareil** : celui du rôle. **Permissions** : être membre actif
(`requireOrganizationMember`) et avoir accès à au moins un établissement.

**Ce n'est pas un tableau de bord : c'est un aiguillage.** `/app` **redirige** vers la destination
par défaut du rôle, calculée à partir des permissions résolues :

| Permissions détenues | Redirection |
|---|---|
| `kitchen.read` seul (ou appareil `trustedDevices.deviceType = "kds"`) | `/app/kitchen/$stationId` |
| `payment.collect` / `check.manage` sans `order.create` | `/app/cashier` |
| `order.create` + `table.read`, sans `analytics.read` | `/app/tables?filtre=mes-tables` |
| `analytics.read` + `order.read` | `/app/live` pendant le service, `/app/analytics` en dehors |
| Accès à plusieurs établissements + `organization.analytics.read` | Sélecteur d'établissement, puis comme ci-dessus |

**L'écran n'est rendu que dans deux cas** : plusieurs établissements à choisir, ou aucune destination
calculable.
**Sections dans ce cas** : la liste des établissements accessibles, avec pour chacun une seule
information utile — tables ouvertes maintenant — et rien d'autre.
**Action principale** : **entrer dans un établissement**.
**États** — *vide* (membre sans aucune affectation) : « Votre compte n'est rattaché à aucun
établissement » + **Contacter le responsable**, avec son nom si `team.read` le permet. C'est l'état
qui se produit réellement quand une invitation a été acceptée mais qu'aucun rôle n'a été affecté.
*Hors ligne* : la dernière destination connue est rouverte depuis le cache.
**Données** : `organizationMembers by_user`, `memberRoleAssignments by_member`, `venues by_org_status`.

### 4.2 En direct — `/app/live` *(la tour de contrôle)*

> **C'est la page la plus importante du produit pendant le service.** Pour Awa, c'est la réponse à
> P5 : ne plus découvrir les problèmes le lendemain. Elle a une règle de conception propre, plus
> stricte que les autres : **elle ne montre que ce qui appelle une décision maintenant.** Un chiffre
> qui ne déclenche aucun geste n'a pas sa place ici ; il est dans `/app/analytics`.

**Persona** : Awa (gérante), Floor Manager. **Objectif** : « qu'est-ce qui ne va pas, là,
maintenant ? »
**Appareil dominant** : desktop ou tablette posée ; mobile en version réduite.
**Permissions requises** : composition — `order.read` **et** `table.read`, plus
`kitchen.read` pour la colonne production, `service_request.read` + `service_request.handle` pour
les demandes. Chaque
colonne s'affiche selon la permission qui la couvre ; il n'existe **pas** de permission `live.read`,
et il ne faut pas en créer une : cette page est une vue, pas un domaine.

**Header** : établissement · heure locale (`venues.timezone`) · **quatre compteurs d'anomalie**, et
seulement des anomalies : `Retards` · `À valider` · `Prêts non servis` · `Demandes en attente`.
Un compteur à zéro reste affiché en gris — son absence serait ambiguë.

**Navigation** : quatre colonnes, chacune une file triée par **ancienneté décroissante**. Sur mobile,
quatre onglets avec pastilles.

**Sections (colonnes)**
1. **À valider** — commandes en `pending_acceptance` *(mode `guest_with_approval`)*. Par carte :
   table, invité, montant, contenu replié, **temps d'attente qui court**. Deux boutons : **Accepter**
   / Refuser (motif obligatoire). C'est la colonne qui se vide le plus vite, donc la première.
2. **En production** — commandes `accepted` / `in_preparation` / `partially_ready`, avec le temps
   écoulé comparé à `prepStations.targetPrepMinutes` et `lateThresholdMinutes`. Au-delà du seuil, la
   carte change **de contraste, pas de couleur clignotante**, et remonte en tête de colonne.
3. **Prêt à porter** — commandes `ready` et lignes `ready` d'une commande `partially_ready`. C'est la
   colonne qui répond à P4 : le serveur ne va plus voir. Chaque carte indique la table, le serveur
   attribué, et depuis combien de temps le plat attend au passe — **le compteur qui coûte le plus
   cher au restaurant**.
4. **Demandes** — `serviceRequests` ouvertes, par ancienneté. **Prendre en charge** en un appui
   (`service_request.handle`).

**Action principale** : **traiter l'élément le plus ancien de la colonne la plus à gauche.** L'écran
matérialise cette hiérarchie : la première carte de la première colonne non vide porte le focus
clavier au chargement.
**Actions secondaires** : filtrer par zone (`serviceAreas`) · filtrer par serveur · ouvrir la table ·
ouvrir la commande.

**Temps réel — ce qui bouge tout seul, et comment on le voit sans être distrait**

| Événement | Ce qui se passe à l'écran | Ce qui **ne** se passe **pas** |
|---|---|---|
| Nouvelle commande à valider | La carte apparaît en haut, pulsation d'une seconde, compteur d'en-tête incrémenté | Pas de son par défaut, pas de fenêtre modale |
| Un bon passe `ready` | La carte glisse de la colonne 2 à la colonne 3, **une seule fois**, en 400 ms | La colonne ne se retrie pas ; rien d'autre ne bouge |
| Un retard franchit son seuil | La carte gagne du contraste et remonte | Pas de rouge clignotant : un écran qui hurle en permanence n'est plus lu |
| Une demande est prise par un collègue | La carte se grise, avec le prénom de qui l'a prise, puis disparaît après 3 s | Elle ne disparaît pas instantanément — sinon on vise une carte qui n'est plus là |

Le compteur de temps écoulé se met à jour **toutes les 10 secondes**, pas chaque seconde : une
seconde qui défile attire l'œil en continu et fatigue.

**États** — *chargement* : les quatre colonnes avec deux squelettes chacune. *Vide* — et c'est l'état
**normal et souhaitable** d'un service qui va bien : « Rien à traiter. Tout est à jour. » avec
l'heure de la dernière activité ; jamais une illustration de vide générique. *Erreur* : bandeau
« Mise à jour interrompue » + dernier état daté. *Permission refusée* : les colonnes non permises
n'apparaissent pas ; si aucune n'est permise, l'écran n'est pas dans la navigation. *Hors ligne* :
cercle 1 en lecture ; les gestes de la colonne 4 (prise en charge) passent en cercle 2 avec l'état
« en attente de confirmation » ; **accepter une commande reste possible en cercle 2**, mais
l'affichage est explicite tant que le serveur n'a pas confirmé.

**Mobile** : quatre onglets, une colonne à la fois, pastilles de compte sur les onglets.
**Desktop** : quatre colonnes simultanées, raccourcis `1`–`4` pour le focus de colonne, `Entrée`
pour l'action principale de la carte focalisée.

**Données** : `orders by_venue_status_submitted ["venueId","status","submittedAt"]` — l'index de la
tour de contrôle · `kitchenTickets by_venue_status ["venueId","status"]` ·
`serviceRequests by_venue_status_created` · `tableSessions by_venue_status`. Quatre abonnements
**scopés au plus étroit**, jamais un abonnement global à l'établissement *(ARCHITECTURE §12)*.

### 4.3 Salle — `/app/tables`

**Persona** : Koffi (serveur) en premier, Floor Manager.
**Objectif** : « quelles tables sont à moi, lesquelles attendent quelque chose ? »
**Appareil dominant** : mobile (le téléphone du serveur **est** le terminal, `D-021`).
**Permissions requises** : `table.read`. `table.session.open` pour ouvrir,
`table.session.transfer` pour déplacer ou fusionner.

**Header** : établissement · bascule **Mes tables / Toutes** · filtre de zone.
**Navigation** : deux présentations, mémorisées par utilisateur — **Liste** (défaut mobile) et
**Plan** (défaut desktop, lecture seule ; l'édition est dans `/app/floor`).

**Sections** — une carte par table, et **quatre informations, pas cinq** :
1. Numéro de table et zone ;
2. **Depuis combien de temps** la session est ouverte (`openedAt`) — c'est ce qui dit si une table
   traîne ;
3. **Ce qu'elle attend**, en un mot : *rien* · *à valider* · *prêt à porter* · *demande* · *addition* ;
4. Montant en cours (`tableSessions.totals.due`), affiché **seulement** avec `payment.read`.

Les tables libres sont grises et compactes ; les tables qui attendent quelque chose passent devant.
Le tri par défaut est **l'urgence, puis l'ancienneté** — pas le numéro de table.

**Action principale** : **ouvrir la table** *(sur une table libre : **Ouvrir une session**)*.
**Actions secondaires** : filtrer · basculer liste/plan · fusionner deux tables · me l'attribuer.

**Temps réel** : les cartes changent d'état en place. L'arrivée d'un « prêt à porter » sur une de
**ses** tables déclenche une vibration courte et une pulsation ; sur la table d'un collègue, rien.
C'est la différence entre un outil qui aide et un outil qui sonne.

**États** — *chargement* : grille de squelettes à la bonne taille. *Vide* (aucune table créée) :
« Aucune table dans cet établissement » + **Créer le plan de salle** → `/app/floor` (masqué sans
`table.manage`, auquel cas : « Demandez au responsable de créer les tables »). *Vide* (filtre « mes
tables » sans résultat) : « Aucune table ne vous est attribuée » + **Voir toutes les tables**.
*Erreur* : dernier état + bandeau. *Permission refusée* : écran dédié avec le nom du responsable.
*Hors ligne* : cercle 1 ; le plan et les tables sont en cache, les montants sont marqués « à
confirmer ».

**Mobile** : une colonne, cartes hautes de 88 px minimum (on les vise debout, en marchant).
**Desktop** : grille ou plan à l'échelle, avec survol.

**Données** : `restaurantTables by_venue_status ["venueId","status"]` ·
`tableSessions by_venue_status` et `by_waiter ["assignedWaiterUserId"]` pour « mes tables » ·
`serviceAreas by_venue_sort`. `restaurantTables.activeSessionId` est une **dénormalisation assumée**
qui évite une requête par table sur un écran qui en affiche trente *(DATA_MODEL §5)*.

### 4.4 Une table — `/app/tables/$id`

**Persona** : Koffi, puis Mariam au moment de l'addition.
**Objectif** : tout ce qu'on peut faire pour cette table, au même endroit.
**Appareil** : mobile. **Permissions** : `table.read` ; les actions apparaissent selon
`order.create`, `order.accept`, `order.course.fire`, `payment.collect`, `table.session.close`,
`table.session.transfer`, `check.manage`.

**Header** : **Table 12** · zone · durée d'ouverture · nombre de couverts · serveur attribué ·
**reste dû** en évidence.

**Sections**
1. **Ce qui attend** — bandeau d'action : commande à valider, plats prêts à porter, demande ouverte.
   S'il n'y a rien, **il n'y a pas de bandeau**.
2. **Commandes de la session**, antéchronologiques, repliées sauf la dernière ; état par ligne ;
   un service `held` porte un bouton **Lancer** (`order.course.fire`) — c'est ce qui évite le dessert
   servi avec le plat.
3. **Addition(s)** — état, total, reste dû, paiements reçus.
4. **Invités connectés** — pastilles de couleur, utiles pour comprendre qui a commandé quoi.
5. **Journal**, replié : les `orderEvents` en clair (« 20 h 14 — commande acceptée par Koffi »).
   C'est ce qui règle une contestation sans hausser le ton.

**Action principale** : **Prendre une commande** — l'action pour laquelle on ouvre une table neuf
fois sur dix. Elle devient **Encaisser** dès que la session est en `billing` / `settling`.
**Actions secondaires** : valider une commande client · lancer un service · demander l'addition ·
scinder l'addition · déplacer ou fusionner la table · **clôturer**.

**La clôture, et son cas difficile** : `R2` interdit de clôturer tant qu'il reste dû, **sauf** geste
explicite avec motif écrit, journalisé, par quelqu'un qui en a le droit. L'écran demande donc un
motif obligatoire et affiche qui l'a fait. ⚠️ **G3 — la permission correspondante n'existe pas au
catalogue.** En l'état, seule `table.session.close` la garde, or tout serveur la détient : cela
revient à laisser n'importe qui effacer une dette. Cet écran est spécifié, mais **il ne doit pas
être implémenté avant que cette permission soit tranchée**.

**États** — *chargement* : en-tête d'abord (il porte la réponse). *Vide* (session ouverte sans
commande) : « Aucune commande pour l'instant » + **Prendre une commande**. *Erreur* :
`TABLE_CLOSED` → « Cette session est clôturée » + lien vers l'historique. *Permission refusée* : les
actions absentes sont masquées ; l'écran reste lisible, car lire une table sans pouvoir agir est un
cas légitime (un manager qui regarde). *Hors ligne* : cercle 1 en lecture ; ajout d'article et
« servi » en cercle 2 ; **encaisser et clôturer en cercle 3**, avec le message qui dit d'encaisser
en espèces et d'enregistrer au retour du réseau.

**Mobile** : sections repliables, barre d'action collée en bas.
**Desktop** : deux colonnes — commandes à gauche, addition à droite.

**Données** : `tableSessions` · `orders by_session` · `orderItems by_order` ·
`checks by_session` · `payments by_check` · `serviceRequests by_session` ·
`orderEvents by_order_at` · `guestSessions by_session_status`.

### 4.5 Plan de salle — `/app/floor`

**Persona** : Awa ou le Floor Manager, **hors service**. Ce n'est pas un écran de coup de feu.
**Objectif** : que le plan à l'écran ressemble à la salle réelle, et que chaque table ait son QR.
**Appareil dominant** : desktop (on dessine à la souris) ; le mobile est en lecture seule.
**Permissions requises** : `table.manage` pour éditer ; `table.qr.manage` pour les QR ;
`table.read` pour consulter.

**Header** : sélecteur de zone (`serviceAreas`) · **Ajouter une table** · **Imprimer les QR** ·
indicateur d'enregistrement (« Enregistré à 14 h 03 »).

**Sections**
1. **Canevas** — `serviceAreas.canvasWidth/Height`, grille magnétique. Une table se pose, se glisse,
   se tourne, se redimensionne (`x`, `y`, `width`, `height`, `rotation`, `shape`).
2. **Panneau de la table sélectionnée** — numéro (**unique par établissement**), libellé, nombre de
   places, forme, état (`available` / `out_of_service`), et son **QR** : version, date de création,
   nombre de scans, **Révoquer et régénérer**, **Réimprimer**.
3. **Zones** — créer, renommer, réordonner, supprimer (refusé si des tables y sont encore).

**Action principale** : **Ajouter une table**.
**Actions secondaires** : créer une zone · imprimer une planche de QR · dupliquer une rangée ·
révoquer un QR.

**La révocation d'un QR est un geste de sécurité, et l'écran le dit.** Une photo de QR qui circule
sur WhatsApp se neutralise en réimprimant : `tableQrCodes` passe en `revoked`, la `version`
s'incrémente, l'ancien jeton ne vaut plus rien. L'écran demande confirmation avec la phrase qui
compte : « Les QR imprimés pour cette table ne fonctionneront plus. »

**Impression** : planche A4 par zone, un QR par table, avec le numéro en grand — sur une table, on
lit le numéro avant le code.

**États** — *chargement* : canevas avec la grille, tables en squelette. *Vide* (aucune zone) :
« Commencez par créer une zone : Salle, Terrasse, VIP… » + **Créer une zone**, avec trois modèles
d'un appui. *Vide* (zone sans table) : « Aucune table ici » + **Ajouter une table**. *Erreur* :
numéro déjà pris → message sous le champ, la table reste où elle est. *Permission refusée* : le
canevas passe en lecture seule, sans bouton, avec « Seul un responsable peut modifier le plan ».
*Hors ligne* : **cercle 3** — l'édition du plan est refusée : deux personnes qui déplacent les mêmes
tables hors ligne produisent un plan faux, et un plan faux fait perdre des commandes.

**Mobile** : lecture seule, avec la liste des tables et l'accès aux QR ; on ne dessine pas un plan de
salle au pouce.
**Desktop** : canevas plein écran, panneau latéral, `Suppr` pour retirer, flèches pour déplacer au
pixel.

**Données** : `serviceAreas by_venue_sort` · `restaurantTables by_area` et `by_venue_number` ·
`tableQrCodes by_table` et `by_venue_status`.

### 4.6 Commandes — `/app/orders` et `/app/orders/$id`

**Persona** : Floor Manager, Awa ; Mariam en lecture (le rôle Cashier porte `order.read`).
**Objectif de `/app/orders`** : retrouver une commande précise, et voir ce qui a été refusé ou
annulé aujourd'hui.
**Appareil dominant** : desktop. **Permissions** : `order.read` ; les actions selon
`order.accept`, `order.modify`, `order.modify.after_fire`, `order.cancel`, `order.discount.apply`,
`order.course.fire`.

> Cet écran n'est **pas** la tour de contrôle. `/app/live` sert le présent ; `/app/orders` sert la
> recherche et l'après-coup. Les confondre produirait deux écrans médiocres au lieu de deux bons.

**Sections de `/app/orders`**
1. **Filtres** : période (par défaut le service en cours, dans `venues.timezone`), état, canal
   (`guest` / `staff`), table, serveur.
2. **Tableau dense** : référence (`A-042`) · heure · table · canal · articles (nombre) · total ·
   état · qui a saisi. Pagination, jamais de `.collect()` sur la table entière.
3. **Ligne de totaux** de la sélection : nombre, montant, **taux d'annulation** — le seul agrégat
   présent ici, parce qu'il déclenche une décision.

**Action principale** : **ouvrir une commande**.
**Actions secondaires** : filtrer · **Exporter** (visible seulement avec `export.data` — c'est une
surface d'exfiltration, donc une permission à part).

**Sections de `/app/orders/$id`**
1. En-tête : référence, table, session, canal, état, horodatages (`submittedAt`, `readyAt`,
   `servedAt`).
2. **Lignes** avec leur snapshot : nom du jour, options, instructions, prix figé, taxes figées,
   station de production, état par ligne *(D-005, R6)*.
3. **Bons de production** engendrés, par station, avec leurs quatre horodatages.
4. **Remises et frais** (`orderAdjustments`) avec leur auteur et leur motif.
5. **Journal** (`orderEvents`), append-only, en clair : c'est cette section qui répond à
   « qu'est-ce qui a ralenti hier soir ? ».

**Action principale** : dépend de l'état — **Accepter** si `pending_acceptance`, **Lancer le
service** s'il reste un `held`, sinon **Ouvrir la table**.
**Actions secondaires** : annuler une ligne (motif obligatoire) · modifier après envoi
(`order.modify.after_fire`, **motif écrit obligatoire et journalisé**, parce que cela coûte des
denrées) · appliquer une remise · imprimer le bon.

**États** — *chargement* : en-tête puis lignes. *Vide* (`/app/orders` filtré à néant) : « Aucune
commande sur cette période » + **Élargir à aujourd'hui**. *Erreur* : `NOT_FOUND` si la commande
appartient à une autre organisation — **jamais `FORBIDDEN`**, qui confirmerait son existence
*(PERMISSIONS.md §6)*. *Permission refusée* : lecture conservée, actions masquées.
*Hors ligne* : cercle 1 ; annuler et modifier après envoi sont en **cercle 3**.

**Mobile** : liste de cartes, filtres en feuille basse.
**Desktop** : tableau dense, `/` pour la recherche, `j`/`k` pour naviguer.

**Données** : `orders by_venue_status_submitted` et `by_venue_submittedAt` (analytics et recherche) ·
`orderItems by_order` · `kitchenTickets by_order` · `orderEvents by_order_at` ·
`orderAdjustments by_order`.

### 4.7 Production — `/app/kitchen` et `/app/kitchen/$stationId` *(KDS)*

> **L'écran le plus contraint du produit.** Ibrahim a les mains mouillées, du bruit, de la chaleur et
> quatre commandes en même temps. Il doit voir **en une seconde, à un mètre de distance**, ce qui
> part maintenant. Tout ce qui suit découle de cette phrase.

**`/app/kitchen`** — un simple **aiguillage** : la liste des stations de l'établissement avec, pour
chacune, le nombre de bons en file et le plus ancien. Il ne s'affiche que si l'utilisateur a accès à
plus d'une station ; sinon il redirige. **Action principale** : **entrer dans une station**.
**État vide** : « Aucune station configurée » + **Créer une station** (`kitchen.manage`), ou
« Demandez au responsable » sans la permission.

**`/app/kitchen/$stationId` — le KDS**

**Persona** : Ibrahim. **Objectif** : « qu'est-ce que je fais maintenant, et depuis combien de
temps ça attend ? »
**Appareil dominant** : **tablette d'entrée de gamme fixée au mur**, en paysage. Pas de souris, pas
de clavier, des doigts éventuellement gantés.
**Permissions requises** : `kitchen.read` ; `kitchen.ticket.update` pour agir ;
`menu.availability.toggle` pour signaler une rupture. Une tablette murale n'est **pas une personne** :
elle s'authentifie par `trustedDevices` (jeton long, révocable, `stationId` porté par l'appareil),
pas par une session humaine *(A1)*.

**Header, réduit au strict nécessaire** : nom de la station · **nombre de bons en file** ·
**le plus ancien, en minutes** · un bouton **Ruptures** · l'état réseau. Rien d'autre. Pas de
navigation, pas de retour, pas de menu.

**Sections** : une **grille de bons** (`kitchenTickets`), 3 à 4 colonnes en paysage, en défilement
horizontal. Chaque bon :

```
┌──────────────────────────────┐
│ A-042-CUISINE      TABLE 12  │  ← référence + numéro de table DÉNORMALISÉ
│ 20:14                 6 min  │     (aucune jointure : lisible à un mètre)
│ ⚠ ARACHIDE                   │  ← allergies AU NIVEAU DU BON, jamais en petit
├──────────────────────────────┤
│ 2 ×  Burger                  │
│      sans oignon             │  ← instructions sous leur ligne
│ 1 ×  Poulet braisé  (½ part) │
├──────────────────────────────┤
│   [ DÉMARRER ]   [ ✓ PRÊT ]  │  ← cibles ≥ 64 px de haut
└──────────────────────────────┘
```

**Ce qui est affiché, et rien d'autre** : référence du bon, table, heure d'envoi, temps écoulé,
allergies, service (`courseNumber`) s'il n'est pas le premier, lignes avec quantité, nom, variante,
options et instructions. **Pas de prix. Pas de nom de client. Pas de total.** La cuisine ne vend pas,
elle produit — afficher un montant ici, ce serait afficher une donnée parce qu'elle existe.

**Action principale** : **marquer un bon prêt.** C'est le geste qui fait avancer tout le restaurant.
**Actions secondaires** : démarrer · rappeler un bon marqué prêt par erreur · signaler une rupture ·
filtrer sur les seuls bons `held`.

**Le rappel n'est pas une honte, c'est une information** *(R13)*. Un bon `ready` reste visible 90
secondes avec un bouton **Rappeler**, qui le ramène à `started` et **laisse les deux gestes dans
`orderEvents`**. On n'efface pas une erreur de service : on la trace.

**Temps réel — ce qui bouge, et pourquoi c'est supportable huit heures d'affilée**

| Événement | À l'écran | Son |
|---|---|---|
| Nouveau bon | Il apparaît **à sa place chronologique**, pulsation de 1 s | Un son court, **seulement si `prepStations.soundEnabled`**, réglé par station |
| Bon qui dépasse `targetPrepMinutes` | Bordure épaissie, compteur en gras | Aucun |
| Bon qui dépasse `lateThresholdMinutes` | Contraste maximal, remonte en tête | Un rappel unique, jamais répété |
| Bon marqué prêt ailleurs (autre tablette de la même station) | La carte se grise, puis sort après 90 s | Aucun |
| Service déclenché (`fire`) | Le bon `held` rejoint la file, pulsation | Comme un nouveau bon |

Le compteur de minutes se rafraîchit toutes les 10 secondes. **Aucune animation décorative, aucun
défilement automatique** : Ibrahim décide où il regarde, pas l'écran.

**États** — *chargement* : grille de squelettes, pas d'écran blanc — un KDS blanc, on croit qu'il est
tombé. *Vide* : « Rien en attente » en très grand, avec l'heure du dernier bon envoyé. C'est un état
de fierté, pas un état d'erreur, et il doit être **lisible à trois mètres**. *Erreur* : bandeau rouge
« Connexion perdue — les bons affichés datent de <heure> », et les boutons **restent actifs** : le
geste part en file (cercle 2) et la carte porte « en attente de confirmation ». *Permission refusée* :
`kitchen.read` sans `kitchen.ticket.update` → les bons sont visibles, les boutons absents, avec un
bandeau « lecture seule » (ici, masquer les boutons sans dire pourquoi rendrait l'écran
incompréhensible — c'est l'exception prévue par `PERMISSIONS.md` §8). *Hors ligne* : **cercle 2** —
démarrer et marquer prêt sont mis en file avec clé d'idempotence, et rejoués en ordre au retour.

**Mobile** : le téléphone n'est pas la cible, mais il doit marcher pour un chef qui passe : une
colonne, mêmes cibles tactiles.
**Desktop / tablette** : 3–4 colonnes, plein écran, réveil d'écran empêché, contraste élevé assumé.

**Feuille « Ruptures »** : recherche d'un produit, interrupteur de disponibilité, et
« indisponible jusqu'à » (`unavailableUntil`, ce soir / demain / jusqu'à nouvel ordre). Ce geste est
gardé par `menu.availability.toggle` **et pas par `menu.edit`** : le chef doit pouvoir dire « il n'y
a plus de poisson » **sans pouvoir toucher aux prix**. C'est la séparation la plus utile du
catalogue, et elle se voit ici.

**Données** : `kitchenTickets by_station_status_queued ["prepStationId","status","queuedAt"]` —
**l'index le plus sollicité du produit**, qui tourne en permanence sur chaque tablette ·
`kitchenTicketItems by_ticket`, dont les noms sont **dupliqués volontairement** pour éviter trois
lectures par plat à chaque rendu *(DATA_MODEL §8)* · `prepStations by_venue_sort`. L'abonnement est
scopé **à cette station**, jamais à l'établissement.

### 4.8 Caisse — `/app/cashier`

**Persona** : Mariam. **Objectif** : « qui doit combien, et comment est-ce que j'encaisse ? »
**Appareil dominant** : tablette ou desktop au comptoir.
**Permissions requises** : `check.manage` et/ou `payment.collect` ; `order.read` pour le détail ;
`payment.refund` et `payment.void` seulement si détenues ; `order.discount.apply` pour une remise.

**Header** : établissement · **état de la session de caisse** (« Caisse ouverte — fonds 50 000 » ou
**« Aucune caisse ouverte »** en évidence, car c'est bloquant) · recherche par table ou référence.

**Sections**
1. **Tables à encaisser** — sessions en `ordering` / `billing` / `settling` avec un reste dû, triées
   par ancienneté de la demande d'addition. Par ligne : table, couverts, total, **reste dû**,
   paiements déjà reçus, serveur.
2. **Le panneau d'encaissement** (moitié droite, ou plein écran sur mobile) : détail de l'addition,
   **le montant dû en très gros**, et les moyens de paiement.
3. **Encaissement mixte** — le cas réel : 15 000 en espèces + 20 000 en Mobile Money sur la même
   addition. On saisit un premier montant et un premier moyen, on valide ; le reste dû se met à
   jour ; on recommence. **Deux lignes de `payments`, même `checkId`** — aucune structure
   supplémentaire, et c'est exactement ce qu'aucun concurrent étudié ne traite *(D-019)*.
4. **Espèces** : montant remis → **rendu monnaie calculé et affiché en grand**
   (`receivedAmount`, `changeAmount`). C'est le chiffre que Mariam lit à voix haute.
5. **Derniers encaissements** de la session, avec la possibilité d'annuler le dernier
   (`payment.void`, motif obligatoire, audité).

**Action principale** : **Encaisser <montant>**.
**Actions secondaires** : scinder l'addition · appliquer une remise · imprimer le ticket · envoyer le
ticket par WhatsApp · rembourser.

**Règles que l'écran rend visibles, et pas seulement vérifiées** :
`R17` — la somme allouée ne peut jamais dépasser le dû : le champ montant est plafonné au reste dû,
et le dire évite la question. `R18` — rien ne se supprime : on annule ou on rembourse, **avec
motif**. `R14` — aucun montant ne vient du client : même ici, le dû affiché est celui que le serveur
recalcule.

**États** — *chargement* : liste des tables d'abord. *Vide* : « Aucune table à encaisser » + l'heure
de la dernière ; si la journée n'a pas commencé : **Ouvrir la caisse**. *Bloquant* : sans session de
caisse ouverte, l'encaissement en espèces est refusé avec **Ouvrir une session de caisse** — refuser
sans proposer le geste serait un cul-de-sac. *Erreur* : un paiement en ligne en attente reste en
« vérification en cours », **jamais** compté comme reçu *(R15)*. *Permission refusée* : un
utilisateur avec `payment.read` seul voit les additions sans pouvoir encaisser, avec la raison.
*Hors ligne* : **cercle 3** — « Connexion perdue : encaissez en espèces et enregistrez au retour du
réseau. » La caisse est le seul endroit où un refus franc vaut mieux qu'une file.

**Mobile** : deux étapes (choisir la table, puis encaisser), jamais deux panneaux côte à côte.
**Desktop** : panneau double, pavé numérique physique utilisable, `Entrée` pour valider.

**Données** : `tableSessions by_venue_status` · `checks by_venue_status ["venueId","status"]` —
l'index de l'écran caisse · `checkItems by_check` · `payments by_check` et
`by_register_session` · `cashRegisterSessions by_register_status`.

### 4.9 Sessions de caisse — `/app/registers`

**Persona** : Mariam d'abord, Awa pour le contrôle.
**Objectif** : « est-ce que ma caisse tombe juste, et si non, de combien ? »
**Appareil** : tablette / desktop.
**Permissions** : `cash_register.open`, `cash_register.close` ; `cash_register.adjust` pour
corriger un écart — **jamais dans le rôle Cashier** *(PERMISSIONS.md §4)*.

**Sections**
1. **Ma session en cours** — caisse, ouverte par qui et à quelle heure, fonds initial, **attendu
   calculé** (jamais saisi), nombre d'encaissements, répartition par moyen.
2. **Mouvements** (`cashMovements`) : ventes, remboursements, sorties (`payout`), entrées
   (`deposit`), corrections — chacun avec son auteur et son motif.
3. **Historique** des sessions clôturées : date, ouvert par, fermé par, attendu, compté, **écart**.
4. **Le comptage**, en plein écran au moment de clôturer : saisie par coupure (10 000, 5 000, 2 000,
   1 000, 500…) avec total qui s'additionne ; puis, **et seulement ensuite**, révélation de
   l'attendu et de l'écart. Montrer l'attendu avant le comptage, c'est inviter à compter jusqu'au
   chiffre attendu.

**Action principale** : **Ouvrir la caisse** s'il n'y a pas de session, **Clôturer et compter**
sinon.
**Actions secondaires** : déclarer une sortie · déclarer une entrée · voir l'historique · exporter
(`export.data`).

**L'écart n'est pas une honte à cacher** *(ARCHITECTURE §8)*. Il est affiché en clair, avec son
signe, à côté du détail par moyen de paiement qui aide à le comprendre. Une correction
(`cash_register.adjust`) exige un **motif écrit** et laisse une trace nominative dans `auditLogs`
*(R21, PERMISSIONS.md §10)*.

⚠️ **G4 — le blocage à trancher** : la machine à états ne propose aucune sortie de `discrepancy`
autre que `adjusted`, et `adjusted` exige une permission que Mariam **n'a pas**. En l'état, elle
constate un écart et **ne peut pas fermer sa caisse**. L'écran est donc spécifié avec la transition
manquante : **`discrepancy → closed`**, qui **conserve l'écart tel quel** et le signale au manager,
`adjusted` restant réservé à la modification effective du chiffre. Sans cette transition, cet écran
bloque un caissier tous les soirs.

**États** — *chargement* : l'état de session d'abord. *Vide* : « Aucune session ouverte » +
**Ouvrir la caisse** (demande le fonds initial). *Erreur* : une seule session ouverte par caisse
(`by_register_status`) — si une autre existe, on l'affiche avec qui l'a ouverte, au lieu d'un refus
opaque. *Permission refusée* : un écart non corrigeable affiche **qui contacter**.
*Hors ligne* : **cercle 3** intégral. Ouvrir, clôturer, corriger : tout est refusé.

**Mobile** : le comptage par coupures fonctionne au pouce, une coupure par ligne.
**Desktop** : comptage à gauche, attendu à droite (révélé après saisie).

**Données** : `cashRegisters by_venue` · `cashRegisterSessions by_register_status` et
`by_venue_openedAt` · `cashMovements by_session` · `payments by_register_session` — l'index qui
calcule l'attendu *(DATA_MODEL §11)*.

### 4.10 Paiements — `/app/payments`

**Persona** : Mariam, Awa, le comptable (rôle Accountant : lecture seule, aucune écriture).
**Objectif** : « retrouver un paiement, et comprendre un écart. »
**Appareil** : desktop. **Permissions** : `payment.read` ; `payment.refund` / `payment.void` si
détenues ; `export.data` pour l'export ; `analytics.financial.read` pour les agrégats de marge.

**Sections**
1. **Filtres** : période (par défaut aujourd'hui, `venues.timezone`), moyen, état, caissier,
   fournisseur, table.
2. **Tableau** : heure · montant · moyen · état · qui a encaissé (`collectedByUserId`, la donnée qui
   répond à P2) · table · référence fournisseur · session de caisse.
3. **Répartition par moyen** sur la période — un seul graphique, parce qu'il répond à une question
   qu'on se pose vraiment : où va l'argent, espèces ou mobile.
4. **À réconcilier** — intentions en `awaiting_confirmation` au-delà d'un délai, et webhooks reçus
   sans intention correspondante. C'est la section qui évite qu'un paiement réussi reste invisible.

**Action principale** : **ouvrir un paiement** (panneau de détail avec son historique complet et ses
remboursements).
**Actions secondaires** : rembourser (motif obligatoire, audité, plafonné au montant encaissé `R19`) ·
annuler une saisie erronée · exporter.

**États** — *chargement* : tableau squelette. *Vide* : « Aucun paiement sur cette période » +
**Voir aujourd'hui**. *Erreur* : un paiement dont le fournisseur ne répond pas est marqué « état
non confirmé », **jamais** « réussi ». *Permission refusée* : `payment.read` sans `payment.refund` →
le bouton n'existe pas ; et si la mutation est appelée quand même, elle est refusée **côté serveur**
— c'est exactement le test de `PERMISSIONS.md` §9. *Hors ligne* : cercle 1 en lecture, cercle 3 pour
tout le reste.

**Données** : `payments by_venue_createdAt`, `by_venue_method_createdAt`, `by_check`,
`by_register_session` · `refunds by_payment` · `paymentIntents by_status_expires` (réconciliation) ·
`webhookEvents by_processed` (rattrapage).

### 4.11 Carte — `/app/menu` et ses écrans

**Persona** : Awa, ou un Menu Manager. **Objectif global** : que ce que le client voit soit exact.
**Appareil dominant** : desktop pour l'édition, **mobile pour la disponibilité** (c'est un geste de
service, fait en salle).
**Permissions** : `menu.read` · `menu.edit` · `menu.price.edit` (**séparée** : un acte financier) ·
`menu.publish` · `menu.availability.toggle`.

> La séparation des permissions sur cette table est délibérée et se voit dans les écrans : un chef de
> rang doit pouvoir signaler une rupture **sans pouvoir changer un prix**. Fusionner les deux, c'est
> choisir entre paralyser le service et ouvrir la caisse *(DATA_MODEL §4)*.

**`/app/menu` — l'écran de tête**
**Objectif** : « ma carte en ligne est-elle à jour ? »
**Header** : sélecteur de carte (`menus` : « Midi », « Soir ») · état **Brouillon / Publiée** ·
**Publier** (le seul bouton primaire de l'écran).
**Sections** : (1) **bandeau d'écart** — « 7 modifications non publiées », avec la liste, parce que
c'est la seule question qui compte ici ; (2) sections de carte, réordonnables, avec le nombre de
produits et le nombre d'indisponibles ; (3) accès aux quatre écrans enfants ; (4) **historique des
publications** (`menuPublications`, version, auteur, date) avec **Revenir à cette version** — ce qui
permet d'expliquer « pourquoi ce prix était affiché mardi ».
**Action principale** : **Publier la carte**.
**Actions secondaires** : prévisualiser en tant que client · importer (CSV) · dupliquer depuis un
autre établissement · créer une carte.
**États** — *vide* : « Votre carte est vide » + trois chemins : **Importer un fichier**,
**Dupliquer une carte existante**, **Ajouter un premier produit**. *Erreur* à la publication :
**la carte dépasse la taille d'un document** → message explicite proposant de la scinder en
plusieurs cartes, jamais une erreur technique *(DATA_MODEL §4)*. *Permission refusée* :
`menu.read` sans `menu.publish` → bandeau d'écart visible, bouton absent, avec qui contacter.
*Hors ligne* : cercle 1 en lecture, cercle 3 pour publier.
**Données** : `menus by_venue_status` · `menuSections by_menu_sort` ·
`menuPublications by_venue_current` et `by_menu_version`.

**`/app/menu/products` et `/app/menu/products/$id`**
**Objectif** : tenir le catalogue.
**Liste** : recherche (index `search_products`, filtré par `venueId` et `isActive` — **jamais un
balayage de table**), filtres par section, station, disponibilité ; colonnes : photo, nom, section,
prix, station, état.
**Fiche produit**, en cinq blocs : identité (nom, description, traductions intégrées `i18n`) ·
**prix** (`basePrice`, promotion et sa date de fin) — **bloc verrouillé sans `menu.price.edit`,
affiché en lecture avec la raison** · classement (section, ordre, étiquettes, allergènes, régimes,
tous **déclarés**, jamais déduits `R28`) · production (station `prepStationId`, durée indicative
`prepMinutes`) · variantes et groupes d'options.
**Action principale** : **Enregistrer**.
**Actions secondaires** : dupliquer · archiver (jamais supprimer) · rendre indisponible · voir les
ventes du produit.
**États** — *vide* : « Aucun produit » + **Ajouter un produit** / **Importer**. *Erreur* : `slug`
déjà pris dans l'établissement → message sous le champ. *Hors ligne* : cercle 3 (l'édition du
catalogue n'est pas un geste de service).
**Données** : `products by_section_sort`, `by_venue_active`, `by_venue_station`, `by_slug` ·
`productVariants by_product_sort` · `productModifierGroups by_product_sort`.

**`/app/menu/categories`** — sections : nom, traductions, image, ordre (glisser-déposer), activation.
**Action principale** : **Ajouter une section**. **État vide** : « Une carte se range en sections :
Entrées, Grillades, Boissons… » + **Créer trois sections d'un coup** (modèles).
**Données** : `menuSections by_menu_sort`.

**`/app/menu/options`** — groupes d'options réutilisables (Cuisson, Accompagnement) et leurs options.
**Objectif** : ne pas retaper « Saignant / À point / Bien cuit » sur quinze produits.
**Sections** : liste des groupes avec **le nombre de produits qui les utilisent** (l'information qui
évite une modification à l'aveugle) · éditeur d'un groupe : type de sélection, minimum, maximum,
obligatoire · options avec leur `priceDelta` et leur disponibilité.
**Action principale** : **Créer un groupe d'options**.
**États** — *erreur* : supprimer un groupe utilisé est refusé, avec **la liste des produits
concernés**, pas un simple refus. *Vide* : « Aucun groupe d'options » + deux modèles prêts.
**Données** : `modifierGroups by_venue` · `modifierOptions by_group_sort` ·
`productModifierGroups by_group`.

**`/app/menu/availability`** — l'écran de service, pas d'édition.
**Persona** : Ibrahim, Floor Manager, en salle ou en cuisine.
**Objectif** : « ce qui est épuisé ce soir doit disparaître de la carte du client, maintenant. »
**Appareil dominant** : **mobile**.
**Permissions** : `menu.availability.toggle` **seule** — c'est tout ce qu'il faut.
**Sections** : recherche · liste plate de tous les produits avec un interrupteur par ligne · une
section **« Indisponibles »** en tête, avec « jusqu'à quand » (ce soir / demain / jusqu'à nouvel
ordre → `unavailableUntil`) · règles programmées actives (`availabilityRules`) en lecture, avec un
lien vers leur édition si l'utilisateur a `menu.edit`.
**Action principale** : **basculer la disponibilité d'un produit**.
**Temps réel** : le basculement se propage aux clients à table **en moins d'une seconde**, et l'écran
le confirme par ligne (« Visible par les clients »). C'est la boucle qui traite P8.
**États** — *hors ligne* : **cercle 2** — le basculement est mis en file avec sa clé d'idempotence et
la ligne porte « en attente de confirmation ». C'est un geste de service, il ne doit pas être
bloqué. *Vide* : « Tous les produits sont disponibles » — état normal, affiché comme tel.
**Données** : `products by_venue_active` · `availabilityRules by_venue_active`.

### 4.12 Clients — `/app/customers` et `/app/customers/$id`

**Persona** : Awa. **Objectif** : « qui revient, et qu'est-ce qu'on nous dit ? »
**Appareil** : desktop. **Permissions** : `customer.read` ; `customer.manage` pour modifier,
fusionner, **supprimer (droit à l'effacement)** ; `export.data` pour l'export.

> **L'anonymat reste le défaut.** Un profil n'existe que si la personne a **volontairement** laissé
> ses coordonnées *(DATA_MODEL §10)*. Cet écran ne doit jamais donner l'impression qu'on a fiché
> tous les clients passés à table : ce serait faux, et ce serait un problème.

**Sections** : (1) trois compteurs **qui déclenchent une décision** — clients identifiés ce mois,
qui reviennent, note moyenne ; (2) **derniers avis** (`feedback`), les notes basses en premier avec
**Répondre** — c'est l'usage réel de cet écran ; (3) table des profils : nom, téléphone, visites,
total dépensé, dernière visite, étiquettes ; (4) fiche client : historique de visites, consentements
**datés et versionnés** (`customerConsents`, *append-only*), notes internes.
**Action principale** : **répondre à un avis** *(sur la fiche : **Ajouter une note**)*.
**Actions secondaires** : fusionner deux profils · exporter · **anonymiser** (effacement, §91).
**États** — *vide* : « Aucun client identifié pour l'instant. Les clients laissent leurs
coordonnées après avoir payé, s'ils le souhaitent. » + lien vers le réglage de l'invitation en fin
de repas. *Permission refusée* : `customer.read` sans `customer.manage` → lecture, actions masquées.
*Hors ligne* : cercle 1.
**Données** : `customerProfiles by_org_lastSeen`, `by_org_phone`, `by_org_email` ·
`customerConsents by_profile_purpose` · `feedback by_venue_createdAt` et `by_venue_rating`.

### 4.13 Données — `/app/analytics`

**Persona** : Awa après le service ; Serge pour comparer ; le comptable en lecture.
**Objectif** : **répondre à une question**, jamais afficher un mur d'indicateurs parce qu'ils
existent *(PRODUCT.md §7.5)*.
**Appareil** : desktop ; **mobile pour le rapport du matin**, qui est l'usage le plus fréquent.
**Permissions** : `analytics.read` ; `analytics.financial.read` pour les marges et le CA consolidé
(**séparée**, et c'est voulu) ; `organization.analytics.read` pour la vue tous établissements ;
`export.data` pour l'export.

**Structure : des questions, pas des onglets de métriques.**

| Question | Ce qui est montré | Données |
|---|---|---|
| **Comment s'est passée la soirée ?** *(vue par défaut)* | CA du service, nombre de couverts, ticket moyen, répartition des moyens de paiement, **et les trois anomalies du service** | `orders by_venue_submittedAt` · `payments by_venue_method_createdAt` |
| **Qu'est-ce qui se vend ?** | Mix produit, top et flop, produits **annulés** (signal de qualité, pas de vente) | `orderItems by_venue_product` |
| **Quand suis-je chargé ?** | Couvre-t-on le coup de feu ? Commandes par tranche de 30 min, dans la timezone de l'établissement | `orders by_venue_submittedAt` |
| **Où le service coince-t-il ?** | Délais envoi → accepté → prêt → servi, par station ; temps demande → réponse | `orderEvents by_venue_type_at` · `serviceRequests` |
| **Mes tables tournent-elles ?** | Durée moyenne d'occupation, rotation par zone | `tableSessions by_venue_openedAt` |
| **L'argent tombe-t-il juste ?** *(`analytics.financial.read`)* | Écarts de caisse sur la période, remises accordées et par qui, annulations après envoi | `cashRegisterSessions` · `orderAdjustments by_venue_type` |

**Action principale** : **changer la période** — c'est le geste qui sert à toutes les questions ;
l'écran est construit autour de lui (hier / aujourd'hui / 7 jours / 30 jours / personnalisé).
**Actions secondaires** : comparer à la période précédente · filtrer par zone ou serveur · exporter.

**Deux règles de cet écran** : tout regroupement « par jour » utilise `venues.timezone`, **jamais**
celle du navigateur *(DATA_MODEL §1)*. Et **aucun chiffre n'est affiché sans sa période** — un
nombre sans fenêtre de temps n'est pas une information.

**États** — *chargement* : chaque bloc charge indépendamment ; le premier bloc ne dépend jamais du
dernier. *Vide* : « Pas assez de données sur cette période » avec la date de la première commande
enregistrée + **Voir depuis le début**. *Erreur* : le bloc en échec affiche son erreur, **les autres
restent** — un tableau de bord entièrement mort parce qu'un calcul a échoué est un mauvais tableau de
bord. *Permission refusée* : les blocs financiers sont absents, et une ligne explique pourquoi.
*Hors ligne* : cercle 1, dernier calcul avec son horodatage.
**Mobile** : le « rapport du matin » — quatre chiffres, une anomalie, un lien. Rien d'autre.
**Desktop** : la question sélectionnée en grand, les autres en accès rapide.

### 4.14 Équipe — `/app/team` et `/app/team/$memberId`

**Persona** : Awa, Serge. **Objectif** : « qui a accès à quoi, et où ? »
**Appareil** : desktop. **Permissions** : `team.read` ; `team.manage` pour inviter, affecter,
retirer ; `permissions.manage` pour toucher aux rôles (écran séparé, §4.15).

**Sections** : (1) membres, avec **pour chacun ses rôles ET leurs portées** — « Manager · Cocody »,
« Serveur · Plateau » — parce que c'est exactement le besoin de Serge et que le taire serait taire
l'essentiel ; (2) invitations en attente, avec relance et révocation ; (3) filtre par établissement
et par rôle.
**Fiche membre** : identité, état (`invited` / `active` / `suspended` / `removed`), affectations
(ajouter, retirer), **dernière activité**, et un lien vers son journal d'audit
(`auditLogs by_actor_at`) si `audit.read`.
**Action principale** : **Inviter un membre**.
**Actions secondaires** : ajouter une affectation · suspendre · retirer · renvoyer une invitation.

**Les trois verrous, rendus visibles dans l'écran** *(PERMISSIONS.md §7)* :
on ne peut pas attribuer un rôle plus puissant que le sien — les rôles non attribuables **sont
affichés désactivés avec la raison**, parce que les masquer ferait croire à un bogue ; on ne peut pas
modifier ses propres affectations — sa propre ligne n'a pas de bouton, avec la mention « Vous ne
pouvez pas modifier vos propres droits » ; aucune permission `platform.*` n'est attribuable, et le
filtrage est **à l'écriture**, pas seulement dans l'UI.

**États** — *vide* : « Vous êtes seul pour l'instant » + **Inviter un collègue**, avec un rappel
utile : « commencez par un serveur, il n'aura accès qu'à cet établissement ». *Erreur* : e-mail déjà
invité → on propose de renvoyer l'invitation plutôt que d'échouer. *Permission refusée* :
`team.read` sans `team.manage` → liste visible, actions absentes. *Hors ligne* : cercle 3.
**Données** : `organizationMembers by_org_status` · `memberRoleAssignments by_member` et
`by_org_venue` · `organizationInvitations by_org_status` · `roles by_org`.

### 4.15 Rôles — `/app/roles` et `/app/roles/$roleId`

**Persona** : Awa (une fois), Serge (plus souvent). **Objectif** : composer un rôle qui correspond à
la réalité de **cet** établissement.
**Appareil** : desktop uniquement. **Permissions** : `permissions.manage` (portée organisation).

> C'est l'écran qui fait tenir la promesse de `PERMISSIONS.md` §1.2 : le code ne demande jamais
> « est-ce un serveur ? », il demande « a-t-il `order.create` ici ? ». Un restaurant qui veut un chef
> de rang qui encaisse et un autre qui ne peut pas le fait **ici**, sans que le logiciel change.

**Sections** : (1) rôles de l'organisation — modèles copiés à la création, puis personnalisés — avec
**le nombre de membres affectés** ; (2) éditeur : nom, description, et les permissions **groupées par
domaine avec leur libellé français** (jamais la clé technique seule) ; les permissions `sensitive`
sont marquées, les `audited` indiquent « toute utilisation est journalisée » ; (3) **aperçu** : « ce
rôle pourra… » en langage clair, et surtout **« ce rôle ne pourra pas… »** pour les trois ou quatre
permissions qu'on oublie toujours de cocher.
**Action principale** : **Enregistrer le rôle**.
**Actions secondaires** : dupliquer un modèle · voir les membres affectés · archiver.

**États** — *erreur* : cocher une permission qu'on ne détient pas soi-même est refusé **côté
serveur** et expliqué côté écran. *Vide* : impossible — les modèles système sont copiés à la
création de l'organisation. *Avertissement* : modifier un rôle affecté à N personnes affiche
**l'impact avant d'enregistrer** (`memberRoleAssignments by_role` existe précisément pour ça).
*Permission refusée* : l'entrée n'apparaît pas dans la navigation.
**Données** : `roles by_org` et `by_org_key` · `memberRoleAssignments by_role` ·
catalogue de permissions **lu depuis le code**, pas depuis la base *(D-002)*.

### 4.16 Assistant — `/app/ai`

**Persona** : Awa ; un serveur peut y accéder si on lui donne `ai.use`.
**Objectif** : poser une question sur son exploitation en langage courant.
**Appareil** : mobile et desktop. **Permissions** : `ai.use` ; `ai.actions.propose` ;
`ai.actions.approve` — **jamais accordée par défaut au même rôle que `propose`** *(PERMISSIONS.md
§3)*.

**Sections**
1. **Conversation** — questions suggérées qui correspondent à de vraies questions : « Qu'est-ce qui a
   ralenti le service hier soir ? », « Quels plats ont été annulés cette semaine ? ».
2. **Réponse** — accompagnée **de sa période et des données citées**, avec un lien vers l'écran qui
   les montre. Une réponse sans source n'est pas affichée.
3. **Propositions d'action** (`aiActionProposals`) : niveau de risque, **aperçu du avant/après**,
   **Valider** / Rejeter. L'IA propose ; une personne exécute ; le journal garde les deux gestes
   *(D-014)*.
4. **Usage**, replié : consommation de la période (`aiUsage`) — pour que la facture n'arrive jamais
   sans explication.

**Action principale** : **poser une question**.
**Actions secondaires** : valider une proposition · ouvrir la source d'une réponse · effacer une
conversation.

**Les trois garde-fous, visibles à l'écran** : l'IA lit **avec la portée et les permissions de celui
qui demande** — un serveur n'obtiendra jamais par ce chemin le chiffre d'affaires d'un établissement
où il n'a pas accès *(R30)* ; sur une donnée non déclarée, la réponse est **« cette information n'est
pas renseignée »**, pas une estimation *(R28)* ; aucune action sensible ne s'exécute sans validation
humaine explicite *(R29)*.

**États** — *chargement* : réponse en flux, avec possibilité d'arrêter. *Vide* : trois questions
d'exemple, cliquables. *Erreur* : « Je n'ai pas pu répondre » + la question reformulable, jamais une
réponse inventée pour combler. *Permission refusée* : `ai.use` sans `ai.actions.approve` → les
propositions sont visibles mais le bouton **Valider** est remplacé par « Demandez à <responsable> de
valider » — ici, masquer rendrait l'écran incompréhensible. *Hors ligne* : cercle 3.
**Données** : `aiConversations by_org_created` · `aiMessages by_conversation_created` ·
`aiActionProposals by_venue_status` · `aiUsage by_org_at`.

### 4.17 Réglages — `/app/settings/*`

**Tiroir**, pas une page de navigation : onze onglets, chacun gardé par sa permission. Un Venue
Manager en voit six ; un Owner, onze.
**Appareil** : desktop dominant. **États communs** : *hors ligne* **cercle 3** partout (on ne règle
pas une TVA en file d'attente) ; *permission refusée* : l'onglet n'apparaît pas, sauf `billing` et
`audit` où il apparaît avec « réservé au propriétaire » — leur absence inexpliquée fait croire à un
bogue.

| Onglet | Route | Persona | Objectif · action principale | Permission | Données |
|---|---|---|---|---|---|
| Général | `/app/settings/general` | Awa | Nom de l'organisation, langue, devise par défaut · **Enregistrer** | `organization.manage` | `organizations` |
| Établissement | `/app/settings/venue` | Awa | Nom, type, fuseau, langues, **et l'identité publique** · **Enregistrer** | `venue.manage` | `venues` ⚠️ **G1 : adresse, téléphone, horaires, description n'existent pas** — cet onglet ne peut pas être livré tel quel |
| Service | `/app/settings/service` | Awa | **Les trois axes de `PRODUCT.md` §2**, posés en trois questions et non en douze profils : qui saisit · quand on paie · où l'on paie · **Enregistrer** | **`venue.settings.service`** — séparée du reste, parce que changer le mode change la machine à états | `venueSettings.service` |
| Paiements | `/app/settings/payments` | Awa | Moyens acceptés, taxes, service, pourboire (**désactivé par défaut**, `D-027`) · **Enregistrer** | `venue.manage` | `venueSettings.tax`, `.tipping` ⚠️ **G6 : aucun champ ne porte le fournisseur actif**, alors que `D-026` exige de le changer par configuration |
| Notifications | `/app/settings/notifications` | Awa | Qui est prévenu de quoi, et par quel canal · **Enregistrer** | `venue.manage` | `notificationPreferences by_venue_event` |
| Apparence | `/app/settings/branding` | Awa | Logo, couverture, couleur, thème — ce que le client voit · **Téléverser le logo** | `venue.manage` | `venueSettings.branding` |
| Intégrations | `/app/settings/integrations` | Awa | ⚠️ **G7 — pas d'action principale nommable** : les tables `integrations` et `integrationCredentials` sont **différées**. En V1, cet onglet n'affiche que les rails de paiement actifs, en lecture. Il ne doit pas exister tant qu'il n'a rien à régler | `venue.manage` | — |
| Abonnement | `/app/settings/billing` | Serge, Awa | Plan, limites, consommation, factures SaaS · **Changer de formule** | `organization.billing.manage` | `subscriptions by_org` · `plans` |
| Sécurité | `/app/settings/security` | Awa | **Appareils enrôlés** (KDS, caisse) : enrôler, voir la dernière activité, **révoquer à distance** · **Enrôler un appareil** | `device.manage` | `trustedDevices by_venue_type` |
| Journal | `/app/settings/audit` | Awa, comptable | « Qui a fait quoi » : acteur, action, ressource, avant/après, **motif** · **Filtrer par personne** | `audit.read` | `auditLogs by_venue_at`, `by_actor_at`, `by_resource` |
| Stations | *(dans `/app/settings` ou depuis `/app/kitchen`)* | Awa | Créer les postes de production, leurs délais cibles et leurs seuils de retard · **Ajouter une station** | `kitchen.manage` | `prepStations by_venue_sort` |

**L'onglet Service mérite un mot.** C'est le seul écran de réglage qui change **le comportement des
machines à états**. Il pose trois questions en langage clair, montre **un aperçu du parcours client
résultant**, et prévient quand un changement affecte des sessions ouvertes. Il est gardé par sa
propre permission (`venue.settings.service`) précisément parce que se tromper ici arrête le service.

**L'onglet Journal est l'écran de la confiance.** Il rend visibles les motifs écrits exigés par
`PERMISSIONS.md` §10 : correction d'écart de caisse, remboursement, annulation d'un paiement,
modification après envoi en production, accès support, toute modification de rôle. C'est ce qui
transforme « je crois qu'il manque de l'argent » en « voilà qui, quand, et pourquoi ».
**État vide** du journal : « Aucune action sensible enregistrée sur cette période » — et c'est une
bonne nouvelle, formulée comme telle.

---

## 5. Surface D — mise en service et mode simulation

> **Ce que cette surface décide** : le coût d'acquisition. Tant qu'un restaurant ne peut pas
> s'installer seul, chaque client coûte une installation accompagnée *(ROADMAP T7)*. Et c'est aussi
> la réponse à P10 : le personnel change, on ne peut pas tout réexpliquer à chaque fois.

### 5.1 Mise en service — `/app/onboarding`

**Persona** : Awa, seule, le soir, sur son téléphone ou un ordinateur portable.
**Objectif** : « qu'est-ce qu'il me reste à faire pour que ça marche demain ? »
**Appareil** : desktop et mobile, à égalité — la mise en service se fait en plusieurs fois, entre
deux services.
**Permissions** : `venue.manage` pour la plupart des étapes ; chaque étape porte **la permission de
l'écran qu'elle ouvre** et se masque si l'utilisateur ne l'a pas.

**Header** : nom de l'établissement · **barre de progression** (« 4 étapes sur 7 ») · **Ignorer pour
l'instant**, toujours disponible.

> **Rien n'est bloquant.** *(PRODUCT.md §5, principe 1 : toute fonctionnalité doit pouvoir être
> ignorée sans casser le reste.)* Un restaurant qui veut seulement une carte en ligne doit pouvoir
> s'arrêter à l'étape 3 et être un client satisfait. Un parcours qui séquestre est un parcours qu'on
> abandonne.

**Sections — quatre groupes, sept étapes.** Le groupement compte : sept cases à cocher à plat
découragent, quatre groupes qui disent *pourquoi* avancent.

| Groupe | Étapes | Ce que l'étape débloque | Permission |
|---|---|---|---|
| **1. Votre établissement** | ① Identité (nom, type, fuseau, devise — **la devise se fige à la première opération financière**, `R20`) ② **Comment vous travaillez** : les trois axes de service | Le comportement de tout le reste | `venue.manage`, `venue.settings.service` |
| **2. Votre carte** | ③ Créer ou importer la carte ④ **Publier** | Le QR devient utile | `menu.edit`, `menu.publish` |
| **3. Votre salle** | ⑤ Zones et tables ⑥ **Imprimer les QR** | Les clients peuvent scanner | `table.manage`, `table.qr.manage` |
| **4. Votre équipe** | ⑦ Inviter un collègue avec un rôle limité | Le service tourne à plusieurs | `team.manage` |

Chaque étape affiche **le temps réaliste** qu'elle prend (« ~10 min ») et son état : à faire, en
cours, faite. `venues.onboardingCompletedSteps` porte cet état.

**Deux blocs supplémentaires, en bas**
- **Essayez sans risque** → `/app/onboarding/simulation` (§5.2). Proposé **dès que la carte est
  publiée**, avant même l'impression des QR : c'est là qu'il est le plus utile.
- **Votre page menu publique** — avec, quand elle n'est pas encore indexable, **les motifs exacts**
  renvoyés par la porte de qualité : « il manque vos horaires et une présentation de 120 caractères ».
  C'est ce qui transforme une contrainte SEO en fonctionnalité utile *(seo-strategy §7.5)*.
  ⚠️ **G1** : ce bloc dépend de champs qui n'existent pas encore.

**Action principale** : **continuer l'étape en cours** — un seul bouton, qui sait toujours où
reprendre.
**Actions secondaires** : sauter une étape · demander de l'aide (**WhatsApp**, canal réel) ·
lancer la simulation.

**États** — *chargement* : les étapes déjà faites sont connues, on les affiche cochées d'emblée.
*Vide* : n'existe pas — au pire, zéro étape faite, ce qui est l'état de départ et il est accueillant.
*Erreur* sur une étape : elle passe en « à reprendre » avec son motif, **les autres restent
franchissables**. *Permission refusée* : les étapes non permises sont affichées **grisées avec qui
les fera** — les masquer donnerait une progression fausse. *Hors ligne* : cercle 1 en lecture ; les
étapes d'écriture sont refusées avec un message clair.

**Mobile** : une étape par écran, progression collante en haut.
**Desktop** : la liste des étapes à gauche, l'étape en cours à droite, sans quitter la page.

**Données** : `venues.onboardingCompletedSteps` · `venueSettings` · `menus by_venue_status` ·
`menuPublications by_venue_current` · `restaurantTables by_venue_number` ·
`tableQrCodes by_venue_status` · `organizationMembers by_org_status`.

### 5.2 Mode simulation — `/app/onboarding/simulation`

**Persona** : Awa, et **tout nouvel employé** — c'est l'antidote au coût de formation permanent (P10).
**Objectif** : **faire le tour complet du produit sans conséquence** : commander comme un client,
voir le bon arriver en cuisine, servir, encaisser.
**Appareil** : desktop pour la vue d'ensemble ; mobile pour jouer le rôle du client.
**Permissions** : `venue.manage` pour lancer une simulation ; à l'intérieur, les écrans gardent
**leurs propres permissions réelles** — on n'apprend rien dans un environnement qui ment sur les
droits.

**Header** : un bandeau qui ne disparaît **jamais**, sur **tous** les écrans traversés :
**« MODE SIMULATION — rien n'est réel »**, avec un bouton **Terminer et tout effacer**. Sa
permanence est la seule protection contre la confusion, et elle vaut plus que n'importe quel avis
d'alerte au lancement.

**Sections** — le parcours est joué, pas décrit :
1. **Choisir une table** de démonstration (une table marquée, hors du plan réel).
2. **« Vous êtes le client »** — l'écran client s'ouvre côte à côte (desktop) ou par un QR à scanner
   avec son propre téléphone (mobile). On compose, on envoie.
3. **« Vous êtes la cuisine »** — le bon apparaît dans un KDS de démonstration. On démarre, on marque
   prêt. **C'est le moment qui fait comprendre le produit** : le geste d'un écran change l'autre,
   sous les yeux.
4. **« Vous êtes le serveur »** — la commande passe en prête, on sert.
5. **« Vous êtes la caisse »** — on encaisse en espèces, on voit le ticket.
6. **Fin** : « Voilà ce qui s'est passé » — la frise des `orderEvents` de la commande jouée, en
   clair, puis **Tout effacer** ou **Recommencer**.

**Action principale** : **Lancer la simulation** *(à l'intérieur : l'action de l'étape en cours)*.
**Actions secondaires** : recommencer · inviter un employé à la faire · terminer et effacer.

**⚠️ G2 — le manque qui empêche d'implémenter cet écran tel quel.** Rien, ni dans `DATA_MODEL.md` ni
dans `convex/schema.ts`, ne distingue une session simulée d'une session réelle : pas de
`tableSessions.isSimulation`, pas de `venues.isDemo`. Or une commande jouée ne doit **jamais** entrer
dans le chiffre d'affaires, ni dans l'attendu de caisse, ni dans les délais de service. Deux voies,
et il faut en choisir une **avant** d'écrire cet écran :

| Voie | Ce que ça donne | Ce que ça coûte |
|---|---|---|
| **A — `venues.status = "setup"`** : la simulation n'est possible qu'avant la mise en service, et **tout est purgé** au passage à `active` | Aucun champ nouveau ; l'isolation est totale | La simulation **disparaît** après l'ouverture — donc elle ne sert plus à former un nouvel employé, ce qui est pourtant sa raison d'être (P10) |
| **B — un drapeau porté par la session** (`tableSessions`, propagé à `orders`, `payments`, `cashMovements`) et **exclu de tous les agrégats** | La formation reste possible à tout moment, y compris en pleine exploitation | Un champ de plus sur les tables d'argent, et **un filtre à ne jamais oublier** dans chaque requête d'analytics et de caisse. C'est exactement le genre d'oubli qui fausse un chiffre d'affaires |

**Ma recommandation : B**, avec le drapeau posé **sur la table de démonstration** plutôt que sur
chaque session (une table `isDemo` ne produit que des sessions de démonstration, ce qui rend l'oubli
structurellement impossible : le filtre est sur une dimension, pas sur une ligne). Mais c'est une
décision de modèle de données, elle n'appartient pas à ce document.

**États** — *chargement* : les deux panneaux (client / cuisine) s'ouvrent ensemble. *Vide* : « Vous
n'avez pas encore de carte publiée — la simulation a besoin d'au moins un produit » +
**Publier ma carte**. *Erreur* : une simulation interrompue est **effacée automatiquement** après 24 h.
*Permission refusée* : masqué. *Hors ligne* : cercle 3 — la simulation est une démonstration du
fonctionnement normal, elle ne s'apprend pas en mode dégradé.

**Données** : les tables réelles, avec l'isolation décidée en G2.

---

## 6. Surface E — back-office plateforme `/admin/*`

> **Chemin totalement séparé.** Garde `requirePlatformAdmin`, permissions `platform.*` stockées dans
> `platformAdmins`, **jamais attribuables par une organisation**, filtrées à l'écriture et pas
> seulement masquées *(PERMISSIONS.md §3, §7)*. Aucune route `/admin/*` ne réutilise une garde de
> `/app/*` : le mélange serait la faille.

**Gabarit commun** : en-tête avec recherche globale (organisation, établissement, utilisateur,
référence de paiement) · `noindex` · **toute consultation d'un tenant est journalisée**.
**Appareil dominant** : desktop, partout. **Hors ligne** : cercle 3 partout, sans exception.

### Tableau de bord — `/admin`

**Objectif** : « est-ce que la plateforme va bien, et qui a besoin de nous ? »
**Sections** : (1) **santé** — incidents ouverts, taux d'erreur, webhooks non traités
(`webhookEvents by_processed`) ; (2) **activité** — organisations actives, établissements en service,
commandes des dernières 24 h ; (3) **argent** — abonnements en `past_due`, essais qui se terminent
cette semaine ; (4) **attention** — organisations sans aucune commande depuis 7 jours (le signal
d'attrition qui précède tous les autres).
**Action principale** : **ouvrir l'organisation qui demande une action**.
**Permissions** : `platform.organizations.read`.
**État vide** : « Rien ne demande votre attention » avec l'heure du dernier contrôle.

### Organisations — `/admin/organizations` et la vue 360° `/admin/organizations/$id`

**Objectif de la liste** : retrouver un client en trois secondes quand il appelle.
**Sections** : recherche (nom, `slug`, e-mail du propriétaire) · filtres (état, plan, pays) ·
tableau : organisation, propriétaire, plan, état de l'abonnement, nombre d'établissements, dernière
activité.
**Action principale** : **ouvrir la vue 360°**.

**La vue 360° — l'écran le plus sensible du back-office.**
**Sections** : (1) identité, propriétaire, plan, état, date de création ; (2) **établissements**,
avec pour chacun son état, ses commandes du jour, sa dernière activité ; (3) **abonnement** : plan,
droits d'usage, dérogations (`subscriptions.overrides`), fin de période ; (4) **usage** : commandes,
paiements, membres, stockage, **usage IA et son coût** ; (5) **santé** : erreurs récentes, webhooks
en échec ; (6) **journal** : les actions de la plateforme sur ce client.
**Action principale** : **Accéder au contexte du client** (`platform.impersonate`).
**Actions secondaires** : suspendre / réactiver (`platform.organizations.manage`) · changer de plan ·
poser une dérogation.

**La consultation d'un client n'est pas un geste anodin, et l'écran le montre.**
`platform.impersonate` exige **un motif écrit**, une **durée limitée**, et **journalise** l'accès
*(PERMISSIONS.md §3, §10)*. Pendant toute la session, un **bandeau permanent et non masquable**
indique le client consulté, le motif saisi et le temps restant. Ce bandeau est la contrepartie du
pouvoir : sans lui, la promesse de `/securite` (« tout accès support est journalisé et motivé »)
serait une phrase sans mécanisme.
**État vide** : « Cette organisation n'a encore aucun établissement » + rien à faire d'autre que
contacter le client — on ne crée pas un établissement à sa place.

### Établissements — `/admin/venues` · Utilisateurs — `/admin/users` · Abonnements — `/admin/subscriptions`

| Route | Objectif | Sections | Action principale | Permission | Données |
|---|---|---|---|---|---|
| `/admin/venues` | Retrouver un établissement par son `slug` (celui d'une URL de menu public) | Recherche · filtres pays / type / état · tableau avec organisation, état, menu public activé ou non, dernière commande | Ouvrir l'organisation propriétaire | `platform.organizations.read` | `venues by_slug`, `by_org_status` |
| `/admin/users` | Répondre à « je ne peux plus me connecter » | Recherche par e-mail · organisations du compte et rôles · état · dernière connexion | Voir ses organisations | `platform.organizations.read` | `users by_email` · `organizationMembers by_user` |
| `/admin/subscriptions` | Voir qui est en impayé et qui sort d'essai | Filtres par état · tableau plan, montant, fin de période, relances | Ouvrir l'organisation | `platform.organizations.manage` | `subscriptions by_status_period` |

**Règle produit rappelée sur `/admin/subscriptions`** : une organisation `past_due` **reste lisible
et encaissable**. Couper le service d'un restaurant en plein coup de feu pour un impayé est une faute
produit, pas une politique de recouvrement *(DATA_MODEL §3)*. L'écran propose de relancer, pas de
couper.

### Support — `/admin/support` · Incidents — `/admin/incidents`

⚠️ **G5 — ces deux pages n'ont pas de tables.** `platform.support.manage` et
`platform.incidents.manage` existent au catalogue ; `DATA_MODEL.md` ne crée ni file de support ni
registre d'incidents. Ce qui est spécifiable honnêtement aujourd'hui :

**`/admin/support`** — **peut exister en V1 sur `bugReports`**, qui contient exactement ce qu'il
faut : titre, description, capture, **route**, rôle, agent utilisateur, version, erreurs console,
état, gravité — et dont le contexte est **filtré côté client puis re-filtré côté serveur** pour
n'emporter ni jeton, ni code à usage unique, ni donnée de paiement.
**Objectif** : « qu'est-ce qui casse, chez qui ? »
**Sections** : file par état et gravité · fiche : contexte technique complet, organisation et
établissement concernés, lien vers la vue 360° · réponse.
**Action principale** : **prendre en charge un signalement**.
**Permissions** : `platform.support.manage`. **Données** : `bugReports by_status_created`, `by_org`.
**État vide** : « Aucun signalement en attente ».

**`/admin/incidents`** — ⚠️ **pas d'action principale nommable, et c'est un défaut de conception, pas
de rédaction.** Sans table d'incidents, la page ne peut ni en ouvrir un, ni en suivre la chronologie,
ni alimenter `/statut`. **Ce qu'il faudrait au minimum** : un registre portant titre, gravité,
périmètre (global / organisation / établissement), début, fin, chronologie des messages, et lien avec
la page d'état publique. Tant que ce registre n'existe pas, **cette page ne doit pas être
construite** : un écran d'incidents vide pendant un incident est pire que pas d'écran du tout.

### Drapeaux — `/admin/flags`

**Objectif** : activer une fonctionnalité pour une cible précise, **sans livraison**.
**Sections** : liste des drapeaux avec leur portée (`global` / `organization` / `venue` / `user`) et
leur pourcentage de déploiement · éditeur avec **note obligatoire** (à quoi sert ce drapeau) ·
recherche d'une cible.
**Action principale** : **activer ou désactiver un drapeau**.
**Permissions** : `platform.flags.manage`. **Données** : `featureFlags by_key_scope`.
**Règle** : un drapeau **n'accorde jamais une permission**. Il montre ou cache une fonctionnalité ;
le contrôle d'accès reste entier derrière *(PERMISSIONS.md §6 : le plan rétrécit, jamais n'élargit)*.
**État vide** : « Aucun drapeau actif » + **Créer un drapeau**.

### Usage IA — `/admin/ai-usage`

**Objectif** : « combien l'IA nous coûte, sur quelle fonctionnalité, et chez quel client ? »
**Sections** : coût de la période, par **fonctionnalité**, par **modèle**, par organisation · latence
moyenne et **taux d'échec** (`success`, `errorCode`) · les dix organisations les plus consommatrices
· jetons consommés.
**Action principale** : **changer la période**.
**Actions secondaires** : ouvrir une organisation · exporter.
**Permissions** : `platform.organizations.read`. **Données** : `aiUsage by_org_at`, `by_feature_at`,
`by_model_at`.
**Pourquoi cet écran existe** : sans lui, la facture du fournisseur arrive sans explication
*(DATA_MODEL §10)*. C'est aussi lui qui dira si une fonctionnalité IA vaut son coût.
**État vide** : « Aucun usage sur cette période ».

### Audit plateforme — `/admin/audit`

**Objectif** : « qu'est-ce que **notre** équipe a fait chez nos clients ? »
**Sections** : filtres par acteur, organisation, action, période · tableau : horodatage, acteur,
organisation, action, ressource, **motif**, source (`web` / `api` / `ai` / `support`) · **mise en
évidence des `platform.impersonate`**, qui sont la raison d'être de cet écran.
**Action principale** : **filtrer par personne**.
**Permissions** : `platform.audit.read`. **Données** : `auditLogs by_actor_at`, `by_org_at`,
`by_resource`.
**Ce qui n'y figure jamais** : ni secret, ni jeton, ni donnée de paiement ; les objets volumineux
sont réduits aux champs modifiés *(DATA_MODEL §10)*.
**État vide** : « Aucune intervention sur cette période » — et c'est l'état souhaitable.

### Santé système — `/admin/health`

**Objectif** : « est-ce que quelque chose est en train de casser ? »
**Sections** : (1) **webhooks** — reçus, traités, en échec, rejoués (`webhookEvents by_processed`),
avec **Rejouer** ; (2) **intentions de paiement bloquées** en `awaiting_confirmation` au-delà du
délai (`paymentIntents by_status_expires`) — la file qui, si personne ne la regarde, produit des
paiements réussis jamais enregistrés ; (3) **tâches planifiées** : abandon de sessions, purge des
clés d'idempotence (`idempotencyKeys by_expires`), **vérification quotidienne des totaux
dénormalisés** de `tableSessions` qui signale toute divergence ; (4) erreurs applicatives par route.
**Action principale** : **rejouer les webhooks en échec**.
**Actions secondaires** : relancer une vérification · ouvrir l'organisation touchée.
**Permissions** : `platform.incidents.manage`. **Données** : `webhookEvents`, `paymentIntents`,
`idempotencyKeys`.
**État vide** : « Rien en échec » avec l'heure du dernier passage — **l'heure est essentielle** :
« rien en échec » et « le contrôle ne tourne plus » se ressemblent trop pour qu'on les confonde.

### 5.3 Le détail des écrans d'étape — `/app/onboarding/$step`

**Une règle avant la liste** : **jamais vingt-et-un écrans successifs.** Les onze étapes ci-dessous
sont réparties dans les quatre groupes du §5.1, chacune est **individuellement sautable**
(« Configurer plus tard » présent partout où l'étape n'empêche pas les suivantes), et chacune est
**le vrai écran de réglage**, pas un doublon jetable : la même route est réutilisée plus tard depuis
`/app/settings/*`. Construire deux fois le même formulaire, c'est garantir qu'ils divergeront.

| # | Étape · route | Objectif (une question) | Sections | Action principale | Sautable | Permission | Données |
|---|---|---|---|---|:---:|---|---|
| ① | **Organisation** `/app/onboarding/organisation` | « Sous quel nom facture-t-on ? » | Nom · `slug` (proposé, modifiable) · pays · langue par défaut | **Continuer** | non | `organization.manage` | `organizations` |
| ② | **Établissement** `…/etablissement` | « Où et comment travaille-t-on ? » | Nom · **type** (`venueType`, 8 choix imagés) · **pays, devise, fuseau, langues** · avertissement en clair : **la devise se fige à la première opération financière** *(R20)* | **Continuer** | non | `venue.manage`, `venue.create` | `venues` |
| ③ | **Mode de service** `…/service` | « Qui saisit, quand paie-t-on, où paie-t-on ? » — **les trois questions de `PRODUCT.md` §2, posées une par écran**, jamais un choix parmi douze profils | Q1 `orderingMode` (avec **`guest_with_approval` proposé par défaut**, `A2`) · Q2 `paymentTiming` · Q3 `paymentLocations[]` · **aperçu du parcours client résultant**, qui se recompose à chaque réponse | **Continuer** | non | **`venue.settings.service`** | `venueSettings.service` |
| ④ | **Taxes** `…/taxes` | « Les prix affichés incluent-ils la taxe ? » | `pricesIncludeTax` · `rates[]` (code, libellé, taux, périmètre) · frais de service facultatif | **Continuer** | **oui** | `venue.manage` | `venueSettings.tax` |
| ⑤ | **Carte** `…/carte` | « Comment fait-on entrer la carte ? » | Trois chemins offerts d'emblée : **importer un CSV** · **dupliquer** un autre établissement · **saisir** un premier produit. Aperçu du fichier avant import, correction ligne à ligne | **Importer ma carte** | non *(sans carte, rien ne marche)* | `menu.edit` | `menus`, `menuSections`, `products` |
| ⑥ | **Stations** `…/stations` | « Qui prépare quoi ? » | Modèles d'un appui : Cuisine · Bar · Pâtisserie · Grillades · délai cible et seuil de retard par station · **affectation des produits sans station**, listés explicitement | **Créer mes stations** | **oui** — sans station, tout part sur une station par défaut, et le KDS fonctionne quand même | `kitchen.manage` | `prepStations`, `products.prepStationId` |
| ⑦ | **Zones et tables** `…/salle` | « Combien de tables, et où ? » | Création rapide (« 12 tables en Salle, 6 en Terrasse ») **avant** tout dessin · puis affinage optionnel sur le plan | **Créer mes tables** | non | `table.manage` | `serviceAreas`, `restaurantTables` |
| ⑧ | **QR** `…/qr` | « Qu'est-ce que je colle sur mes tables ? » | Choix du modèle d'impression · aperçu avec **le numéro de table en grand** · planche A4 par zone · rappel : un QR se **révoque et se réimprime** si une photo circule | **Imprimer mes QR** | **oui** — on peut servir en `staff_only` sans QR | `table.qr.manage` | `tableQrCodes` |
| ⑨ | **Équipe** `…/equipe` | « Qui d'autre va s'en servir ? » | Invitation par e-mail · **rôle ET établissement** choisis ensemble, jamais séparément · rappel des trois verrous d'élévation | **Inviter** | **oui** | `team.manage` | `organizationInvitations`, `memberRoleAssignments` |
| ⑩ | **Paiements** `…/paiements` | « Comment encaisse-t-on ? » | **Espèces d'abord**, activées par défaut *(D-019)* · moyens en ligne disponibles pour le pays · pourboire **désactivé par défaut** *(D-027)* | **Continuer** | **oui** — l'espèce suffit pour ouvrir | `venue.manage` | `venueSettings.tipping` ⚠️ **G6** pour le choix du fournisseur |
| ⑪ | **Marque** `…/marque` | « À quoi ressemble ce que voit mon client ? » | Logo, couverture, couleur principale, thème · **aperçu de la carte client en direct** | **Téléverser mon logo** | **oui** | `venue.manage` | `venueSettings.branding` |

**États communs à tous les écrans d'étape** — *chargement* : les valeurs déjà saisies sont
pré-remplies, jamais un formulaire vide qu'on croit devoir refaire. *Erreur* : sous le champ fautif,
**sans perdre la saisie**. *Permission refusée* : l'étape s'affiche grisée avec **qui peut la faire**,
et le parcours continue à l'étape suivante. *Hors ligne* : cercle 3, avec conservation locale du
formulaire en cours. **Mobile** : un écran par étape, bouton collé en bas. **Desktop** : liste des
étapes à gauche, formulaire à droite, sans rechargement.

**Ce que l'onboarding ne fait jamais** : demander une carte bancaire avant d'avoir montré quelque
chose, exiger les onze étapes avant de laisser entrer dans l'application, ou masquer le bouton
« plus tard ».

### 5.4 Isolation des données de simulation — la règle et son mécanisme

`ANALYTICS.md` §3.4 pose la règle sans ambiguïté : **« Les commandes de test et le mode simulation
(§38) ne comptent jamais. C'est une erreur banale, et elle rend tous les chiffres suspects quand on
la découvre. »** C'est exactement le risque de `G2` : la règle est écrite, **le mécanisme qui la rend
vraie n'existe pas**.

Les quatre endroits où une commande simulée doit être exclue, et qui doivent être traités **au même
moment** :

| Où | Ce qui serait faux sans exclusion |
|---|---|
| Chiffre d'affaires et ticket moyen (`/app/analytics`) | Le CA du jour compte un repas qui n'a jamais été servi |
| **Attendu de caisse** (`cashRegisterSessions.expectedAmount`) | La caisse réclame des espèces qui n'existent pas → écart inexplicable, exactement le mal qu'on prétend soigner *(P2)* |
| Délais de service (`orderEvents`) | Un bon joué en 4 secondes fausse la moyenne de production |
| Mix produit et ruptures | Un produit « vendu » en simulation remonte dans le top |

**Le mécanisme recommandé, une fois de plus** : porter le drapeau **sur la table de démonstration**
et le propager à la session, aux commandes et aux paiements qui en descendent. Un filtre posé sur une
**dimension** (la table) est un filtre qu'on n'oublie pas ; un filtre posé ligne à ligne s'oublie au
troisième écran d'analytique. La décision appartient à `DATA_MODEL.md` ; ce document se contente de
dire qu'**aucun écran de simulation ne doit être livré avant elle**.

---

## 7. Les six parcours critiques

> Chaque parcours est écrit comme il se joue : **un geste, l'écran où il se fait, ce que le serveur
> écrit, et ce que les autres écrans voient au même instant.** La dernière colonne est celle qui
> compte : un produit de coordination se juge sur ce qui se passe *ailleurs* quand quelqu'un appuie.
> Chaque parcours se termine par **ce qui peut mal tourner**, parce que c'est là que le produit se
> perd ou se gagne.

### (a) Premier scan d'un client → commande servie

**Acteurs** : Aïcha (table 12, quatre personnes) · Koffi (serveur) · Ibrahim (cuisine).
**Préconditions** : carte publiée · QR collé sur la table · mode `guest_with_approval` *(défaut A2)*
· paiement `post_paid`.

| # | Geste | Écran | Écrit | Ce que les autres voient |
|---|---|---|---|---|
| 1 | Aïcha scanne le QR | appareil photo → `/r/le-comptoir/t/<jeton>` | Validation de `tableQrCodes.token` ; ouverture d'un `tableSessions` (`status: open`, `originType: qr_scan`) ; `guestSessions` créé ; **cookie `httpOnly` posé** | Table 12 passe en « occupée » sur `/app/tables` chez Koffi |
| 2 | *(aucun — automatique)* | **302 vers `/r/le-comptoir/table`** | `restaurantTables.activeSessionId` renseigné *(garantit `R1`)* | — |
| 3 | Elle parcourt la carte | `/r/…/table` | rien | — |
| 4 | Ses trois amis scannent à leur tour | idem | Trois `guestSessions` de plus sur **la même** session *(R4)* | L'en-tête affiche « 4 personnes connectées » à chacun |
| 5 | Chacun ajoute ses plats | feuille `/…/table/produit/$id` | `cartItems` avec `estimatedUnitPrice` — **un affichage**, pas un prix | Le panier commun se met à jour chez les quatre, avec la pastille de couleur de l'auteur |
| 6 | Aïcha appuie **Envoyer la commande** | `/…/table/panier` | **Prix recalculés côté serveur** *(R14)* · `orders` avec `idempotencyKey` *(R7)* · `orderItems` avec leur **snapshot figé** *(R6)* · état `submitted` → **`pending_acceptance`** (lu depuis les réglages, pas un `if`, `D-011`) · `orderEvents: submitted` | **Une carte apparaît en tête de la colonne « À valider » de `/app/live`**, avec une pulsation d'une seconde et le compteur d'en-tête qui s'incrémente |
| 7 | Koffi appuie **Accepter** | `/app/live` (ou `/app/tables/$id`) | `accepted` · `orderEvents: accepted` · **découpe en bons par station** *(R11)* : `A-042-CUISINE`, `A-042-BAR` · le dessert part en **`held`** | Aïcha voit sa frise passer à « Acceptée ». **Les bons apparaissent sur les KDS**, chacun ne voyant que le sien |
| 8 | Ibrahim démarre, puis marque prêt | `/app/kitchen/$stationId` | `started` → `ready` (quatre horodatages sur le bon, pas quatre lignes) | La commande devient `partially_ready` tant que le bar n'a pas fini, puis **`ready`** quand tous les bons le sont *(R12 — l'état est **dérivé**, jamais saisi)* |
| 9 | *(aucun)* | `/app/live` colonne **« Prêt à porter »** | `orders.readyAt` | **Vibration courte sur le téléphone de Koffi**, et seulement sur ses tables. Aïcha voit « Prêt » |
| 10 | Koffi sert et marque servi | `/app/tables/$id` | lignes `served` → commande `served` · `orderEvents: served` | La frise d'Aïcha est complète |
| 11 | Plus tard, Koffi lance le dessert | **Lancer le service** | Le bon `held` passe en `queued` | Le bon apparaît en pâtisserie — **c'est ce qui évite la glace servie avec le plat** |

**Ce qui peut mal tourner, et ce que l'écran fait**

| Incident | Réponse |
|---|---|
| Aïcha double-clique sur Envoyer | La clé d'idempotence est générée **au premier appui** : une seule commande *(R7, D-010)* |
| Un plat est épuisé pendant qu'il est au panier | Signalé **avant** l'envoi, au panier, avec un remplacement proposé *(R10)* — jamais après |
| Koffi refuse la commande | `rejected` + **motif obligatoire**, affiché à Aïcha tel qu'il a été écrit |
| La 4G d'Aïcha tombe | **Cercle 3** : la carte reste lisible (cache), l'envoi est refusé, l'écran dit d'appeler le serveur. **Jamais « commande envoyée »** |
| Personne ne valide pendant 8 minutes | Le compteur d'attente de la carte grossit et remonte dans `/app/live` ; côté client, un bouton **Appeler le serveur** apparaît |
| L'établissement est en `staff_only` | **Il n'y a pas de bouton d'envoi** : l'écran dit « montrez cet écran à votre serveur ». Le parcours bascule sur (b) |

### (b) Un serveur prend une commande et l'envoie en cuisine

**Acteur** : Koffi, debout, une main prise. **Mode** : `staff_only` — le maquis d'Awa.
**Contrainte** : moins de gestes que son carnet, sinon il ne s'en sert pas *(PRODUCT.md §10.1)*.

1. `/app/tables` → **Mes tables** — il voit la 12 libre, appuie dessus.
2. `/app/tables/$id` → **Ouvrir une session** — `tableSessions` (`originType: staff`,
   `openedByUserId`, `assignedWaiterUserId` = lui, ce qui rend **le pourboire attribuable**, `A2`).
   Saisie des couverts, facultative.
3. **Prendre une commande** — l'action principale de l'écran, atteinte en **trois appuis depuis le
   déverrouillage du téléphone**.
4. Sélecteur de produits : recherche en tête, sections en onglets, **derniers produits commandés sur
   cette table** en accès direct — c'est ce qui fait gagner le plus de temps sur une tournée.
5. Options et cuisson dans la même feuille que le produit, jamais un second écran.
6. **Service** (`courseNumber`) proposé seulement si l'établissement l'utilise, avec des mots :
   Boissons, Entrée, Plat, Dessert.
7. **Envoyer** → `orders` (`channel: staff`, `placedByUserId`), état **`accepted` directement** — en
   `staff_only`, la transition sortante de `submitted` saute la validation *(ARCHITECTURE §5)*.
8. Les bons apparaissent **immédiatement** sur les KDS concernés. Koffi ne va plus crier vers la
   cuisine : c'est le traitement de P1.
9. Il reste sur `/app/tables/$id` et enchaîne : ajouter un article, lancer un service, encaisser.

**Ce qui peut mal tourner**

| Incident | Réponse |
|---|---|
| Le réseau tombe en pleine saisie | **Cercle 2** : l'envoi part en file avec sa clé d'idempotence, la commande porte **« en attente de confirmation »** — un libellé et une icône distincts de « envoyée » *(§71)*. Rejeu ordonné au retour |
| Il se trompe de table | `table.session.transfer` — déplacer les clients, sans recréer la commande |
| Il doit modifier après envoi | `order.modify.after_fire`, **permission distincte, motif écrit, journalisé** : ça coûte des denrées |
| Il n'a pas `payment.collect` | Le bouton **Encaisser** n'existe pas chez lui. La case se coche dans `/app/roles`, sans que le logiciel change *(PERMISSIONS.md §4 note 1)* |

### (c) Cuisine : bon reçu → prêt

**Acteur** : Ibrahim. **Écran** : `/app/kitchen/$stationId`, tablette murale authentifiée par
`trustedDevices` — **pas de session humaine** *(A1)*.

1. Le bon `A-042-CUISINE` apparaît **à sa place chronologique**, avec une pulsation d'une seconde et,
   si `prepStations.soundEnabled`, un son court. Il porte **Table 12** en grand
   (`kitchenTickets.tableNumber`, dénormalisé exprès : aucune jointure sur le chemin le plus chaud du
   produit) et **⚠ ARACHIDE** au niveau du bon, jamais en petit dans une ligne.
2. Ibrahim appuie **Démarrer** — cible de 64 px, mains occupées. `queued → started`, `startedAt`.
3. Le compteur court, rafraîchi **toutes les 10 secondes**. À `targetPrepMinutes`, la bordure
   s'épaissit ; à `lateThresholdMinutes`, le contraste monte et le bon remonte en tête. **Aucun
   clignotement permanent** : un écran qui hurle tout le temps n'est plus lu.
4. Il appuie **✓ PRÊT**. `started → ready`, `readyAt`, `readyByUserId`.
5. Le bon reste visible **90 secondes** avec **Rappeler**.
6. Dès que **tous** les bons de la commande sont prêts, la commande devient `ready` *(R12)* :
   Koffi est prévenu **sans aller voir** — c'est le traitement de P4.
7. Plus de poisson ? **Ruptures** → interrupteur. Le plat disparaît de la carte des clients **en
   moins d'une seconde**, et c'est `menu.availability.toggle` qui l'autorise — **pas** `menu.edit` :
   Ibrahim ne peut pas toucher un prix. C'est le traitement de P8.

**Ce qui peut mal tourner**

| Incident | Réponse |
|---|---|
| Il marque prêt par erreur | **Rappeler** dans les 90 s : retour à `started`, **les deux gestes restent dans `orderEvents`** *(R13)*. On trace, on n'efface pas |
| Le réseau tombe | **Cercle 2** : les boutons **restent actifs**, bandeau « les bons affichés datent de <heure> », chaque geste en file avec sa clé. Le service ne s'arrête pas parce que le logiciel hésite *(PRODUCT.md §5.2)* |
| Deux tablettes sur la même station | Le bon pris par l'une se grise chez l'autre avec le prénom, puis sort après 3 s — jamais une disparition instantanée sous le doigt |
| L'écran affiche du blanc | Interdit : le chargement montre une grille de squelettes. Un KDS blanc, on croit qu'il est tombé, et on ressort le carnet |

### (d) Addition partagée à quatre, paiement mixte espèces + Mobile Money

**Acteurs** : Aïcha et ses trois amis · Mariam (caisse). **Total** : 48 000 FCFA. C'est le moment de
friction finale, celui qui décide du souvenir *(P7)*.

| # | Geste | Écran | Écrit |
|---|---|---|---|
| 1 | Aïcha : **Mon addition** | `/…/table/addition` | `tableSessions` passe en `billing` |
| 2 | **Partager l'addition** → **Par personne** | `/…/table/addition/partage` | `splitMode: by_guest` · **quatre `checks`** sur la même session · `checkItems` alloue chaque `orderItem` |
| 3 | Le plat partagé à deux est réparti | idem | Deux `checkItems` sur la même ligne, `quantityShare` ½ chacun. **Invariant** : la somme des allocations d'une ligne = son `lineTotal` — c'est ce qui empêche une part de repas de disparaître |
| 4 | Aïcha : **Payer ma part** (12 500), Wave | `/…/addition/payer` | `paymentIntents` (montant **recalculé serveur**, `R14`), `idempotencyKey` unique par (addition, tentative). Action `deep_link` → l'application Wave s'ouvre |
| 5 | Elle revient | `/…/addition/retour` | **« Vérification en cours… »**. La redirection **ne prouve rien** *(R15)* : c'est `verify` côté serveur, ou le webhook signé, qui écrit. Les deux convergent sur la même mutation idempotente *(R16)* |
| 6 | Confirmation | temps réel | `payments` (`method: mobile_money`, `guestSessionId`) · `checks[1].status: paid` · le **reste dû de la table** baisse chez tout le monde |
| 7 | Karim paie sa part de la même façon | idem | Deuxième `payments` |
| 8 | Les deux autres n'ont pas de Mobile Money : ils paient **en espèces** à Mariam | `/app/cashier` | Mariam ouvre la table 12, voit **deux parts déjà réglées** avec leur moyen et leur heure |
| 9 | Elle saisit 12 500 espèces sur la part 3 | panneau d'encaissement | `payments` (`method: cash`, **`collectedByUserId` = Mariam** — la donnée qui répond à P2, `cashRegisterSessionId` = sa session ouverte) · `receivedAmount` / `changeAmount` affichés **en grand** |
| 10 | Idem pour la part 4, réglée avec un billet de 20 000 | idem | Rendu monnaie calculé : 7 500. `cashMovements` de type `sale` |
| 11 | Reste dû = 0 | `/app/cashier` + écrans clients | `tableSessions` : `settling` → **`closed`** *(R2 respectée : plus rien n'est dû)* |
| 12 | Tickets | `/…/table/ticket/$reference` | `bills` par addition. **Envoyer sur WhatsApp**, canal réel du marché |
| 13 | Avis proposé après la clôture | tiroir « Donner mon avis » sur la carte de la table | `feedback`, **vers le restaurant seul quelle que soit la note** *(D-105)* : aucun renvoi vers un avis public |

**Variante tout aussi réelle** : une **seule** addition réglée 28 000 en espèces + 20 000 en Mobile
Money. C'est **deux lignes de `payments` avec le même `checkId`** — aucune structure supplémentaire,
et c'est précisément ce qu'aucun concurrent étudié ne traite *(D-019)*.

**Ce qui peut mal tourner**

| Incident | Réponse |
|---|---|
| Deux amis cochent le même plat en même temps | La seconde écriture est refusée : « Karim vient de prendre ce plat », la répartition se rafraîchit. `checkItems by_order_item` existe pour ça |
| Koffi ajoute une tournée pendant le partage | Bandeau **« L'addition a été mise à jour »**, bouton de paiement **brièvement désactivé** : payer un montant périmé, c'est exactement ce que `R14` interdit |
| Le fournisseur arrondit le montant | `acceptedAmount` est stocké **à part** et la différence est **affichée** — sans ce champ, l'écart disparaît et la caisse ne tombe plus juste *(D-028)* |
| Le webhook arrive deux fois | `webhookEvents.providerEventId` est unique : **aucun second effet** *(R16)* |
| Le paiement en ligne réussit mais le client ferme son navigateur | La vérité est côté serveur : il retrouve son ticket au rechargement, et Mariam voit déjà le paiement |
| Un ami part sans payer | **`closed_with_debt`**, motif écrit obligatoire, journalisé — ⚠️ **G3 : la permission qui devrait le garder n'existe pas** |

### (e) Clôture de caisse avec écart

**Acteur** : Mariam, 23 h 40, service terminé. C'est le parcours qui décide si elle fait confiance au
produit — quand ça ne tombe pas juste, c'est elle qu'on regarde.

1. `/app/registers` → sa session ouverte : fonds 50 000, ouverte à 11 h 00.
2. **Clôturer et compter** → plein écran de comptage par coupures. **L'attendu n'est pas affiché** :
   le montrer avant, c'est inviter à compter jusqu'au chiffre attendu.
3. Elle saisit : 6 × 10 000, 4 × 5 000, 12 × 1 000, … Total compté : **287 000**.
4. **Valider le comptage** → `counting` · `countedAmount: 287000`.
5. **Révélation** : attendu **291 500**, *calculé* depuis `payments by_register_session` filtré sur
   `method: cash` + le fonds — **jamais saisi**. **Écart : −4 500.**
6. L'écran montre **le détail qui aide à comprendre** : répartition par moyen, les trois derniers
   encaissements espèces, les sorties de caisse (`payout`) déclarées. Un écart s'explique ou se
   constate ; il ne se cache pas *(ARCHITECTURE §8)*.
7. Mariam ajoute un commentaire : « 5 000 remis au livreur de boissons à 19 h, pas déclaré. »
8. **Clôturer** → ⚠️ **G4, le blocage réel** : la machine ne sort de `discrepancy` que par `adjusted`,
   qui exige `cash_register.adjust` — **une permission que le rôle Cashier ne porte pas**. En l'état,
   **Mariam ne peut pas fermer sa caisse** et attend un manager chaque soir.
   **Transition manquante à ajouter** : `discrepancy → closed`, qui **conserve l'écart tel quel** et
   le signale, `adjusted` restant réservé à la modification effective du chiffre.
9. Le lendemain, Awa ouvre `/app/registers` → historique : l'écart est là, avec son auteur, son
   commentaire, et la sortie non déclarée identifiée. Elle corrige avec `cash_register.adjust` :
   **motif écrit obligatoire**, trace nominative dans `auditLogs` *(R21)*.
10. `/app/settings/audit` montre la correction : qui, quand, avant/après, pourquoi. **C'est ce qui
    transforme « je crois qu'il manque de l'argent » en « voilà qui, quand, et pourquoi ».**

**Ce qui peut mal tourner**

| Incident | Réponse |
|---|---|
| Le réseau tombe pendant le comptage | **Cercle 3**, refus explicite. La clôture est un acte comptable : elle ne se met pas en file |
| Une seconde session est ouverte sur la même caisse | Refusé par `by_register_status` ; l'écran affiche **qui** l'a ouverte, pas un refus opaque |
| L'écart est énorme | Aucun blocage automatique, aucune accusation : le produit **montre**, il n'arbitre pas. La détection d'anomalie remonte au manager |
| Une correction sans motif | Refusée **côté serveur**, pas seulement masquée |

### (f) Mise en service d'un établissement jusqu'à la première commande de test

**Acteur** : Awa, seule, un jeudi soir, sans commercial. **Objectif de ce parcours** : que
`ROADMAP` T7 tienne sa porte de sortie — *trois restaurants s'installent sans assistance, mesuré*.

| # | Étape | Écran | Ce qui est débloqué |
|---|---|---|---|
| 1 | Inscription (code par e-mail) | `/connexion` → `/auth/otp` | `users`, `organizations`, `organizationMembers` (Owner), **rôles système copiés** dans l'organisation |
| 2 | Organisation et établissement | `…/onboarding/organisation`, `…/etablissement` | `venues` en **`status: setup`** · devise, fuseau, langues. L'avertissement sur le gel de la devise est affiché **avant** la saisie *(R20)* |
| 3 | **Les trois questions du mode de service** | `…/onboarding/service` | `venueSettings.service`. Awa choisit `staff_only` — son maquis fonctionne au carnet, et **le logiciel s'y adapte** |
| 4 | Carte, par import CSV | `…/onboarding/carte` | 42 produits, 6 sections. Aperçu et correction ligne à ligne avant écriture |
| 5 | **Publier** | `/app/menu` | `menuPublications` v1 · `isCurrent` — **le client ne voit jamais un brouillon** *(R22)* |
| 6 | Stations | `…/onboarding/stations` | Cuisine + Bar. Les produits sans station sont **listés explicitement**, pas silencieusement rattachés |
| 7 | Zones et tables | `…/onboarding/salle` | « 18 tables en Salle » d'un geste, affinage du plan plus tard |
| 8 | **La simulation** — avant d'imprimer quoi que ce soit | `/app/onboarding/simulation` | **C'est le moment décisif du parcours** ⤵ |
| 8a | « Vous êtes le client » : elle commande un poulet braisé | écran client de démonstration | Une commande de test |
| 8b | « Vous êtes la cuisine » : le bon apparaît | KDS de démonstration | **Elle voit son geste changer un autre écran** — c'est ce qui fait comprendre le produit, et aucune vidéo ne le remplace |
| 8c | « Vous êtes le serveur » : prêt → servi | écran serveur | — |
| 8d | « Vous êtes la caisse » : encaissement espèces, ticket | écran caisse | — |
| 8e | **Fin** : la frise des `orderEvents` de sa commande jouée, en clair | récapitulatif | **Tout effacer** ⚠️ **G2 : l'isolation n'a pas de mécanisme**. `ANALYTICS.md` §3.4 exige que ces données ne comptent jamais |
| 9 | Impression des QR | `…/onboarding/qr` | Planche A4 par zone, **numéro de table en grand** |
| 10 | Invitation de Koffi | `…/onboarding/equipe` | `organizationInvitations` : rôle Serveur, **portée : cet établissement uniquement** |
| 11 | Passage en service | `/app/settings/venue` | `venues.status: active`. **Si la voie A de `G2` était retenue, c'est ici que les données de simulation seraient purgées** |
| 12 | Première vraie commande | `/app/live` | Le compteur bouge pour de bon |
| 13 | Le lendemain matin | `/app/analytics` (mobile) | Quatre chiffres, une anomalie, un lien. **Awa sait ce qui est entré en caisse** — la promesse de `PRODUCT.md` §3 est tenue le premier soir |

**Ce qui peut mal tourner**

| Incident | Réponse |
|---|---|
| Awa s'arrête à l'étape 5 | **C'est un succès, pas un abandon** : elle a une carte en ligne et des QR. Le parcours ne séquestre pas *(PRODUCT.md §5.1)* |
| L'import CSV est mal formé | Aperçu avant écriture, erreurs ligne à ligne, import partiel accepté |
| Elle n'a pas de Mobile Money marchand | L'espèce suffit pour ouvrir *(D-019)* : l'étape Paiements est sautable |
| Elle ne comprend pas le mode de service | Chaque question montre **l'aperçu du parcours client résultant** ; et le réglage se change plus tard, sans perte |
| Elle appelle à l'aide | Bouton **WhatsApp** présent à toutes les étapes — pas un formulaire de contact |

---

## 8. Tableau récapitulatif

**Comment lire la colonne priorité.** `docs/ROADMAP.md` séquence le produit en **tranches
verticales** `T0`–`T10` *(A5, D-012)* ; `PRODUCT.md` §9 raisonne en V1 / ensuite. Les deux sont
conservés ici, **la tranche faisant foi**, avec la correspondance :
**V1 = T0–T3** (ce qu'un restaurant peut acheter et utiliser en entier) · **V1.5 = T4–T7** ·
**plus tard = T8–T10**.

**Permissions** : toutes citées de `PERMISSIONS.md` §3. « publique » = aucune garde.
« session invité » = cookie `httpOnly` signé, portée à un `tableSessionId` *(D-023)*.
**Appareils** : 📱 mobile · 🖥 desktop · 📟 tablette murale.

### A — Public et marketing *(45 routes)*

| Route | Persona | App. | Permission | Priorité |
|---|---|:--:|---|---|
| `/` | Awa, Serge | 📱 | publique | T1 · **V1** |
| `/tarifs` | Awa | 📱 | publique (lit `plans`) | T1 · **V1** |
| `/demo` · `/contact` · `/a-propos` | Awa | 📱 | publique | T1 · **V1** |
| `/clients` | Awa | 📱 | publique | T7 · V1.5 *(exige des clients nommés et consentants)* |
| `/fonctionnalites` *(hub, noindex)* | Awa | 📱 | publique | T1 · **V1** |
| `/fonctionnalites/{commande-a-table, menu, kds, caisse, paiements, rapports, equipe}` *(×7)* | Awa | 📱 | publique | T1–T3 · **V1** |
| `/fonctionnalites/menu-public` | Awa | 📱 | publique | T1 · V1.5 — **bloqué par G1** |
| `/fonctionnalites/hors-ligne` | Awa | 📱 | publique | **à réécrire (G8)** — la promesse validée contredit `A8` |
| `/fonctionnalites/stock` | Awa | 📱 | publique | T10 · **non publiée en V1 (G8)** |
| `/solutions/{maquis, restaurant, fast-food, hotel, groupes}` *(×5)* | Awa, Serge | 📱 | publique | T1 · **V1** |
| `/solutions/cote-divoire` | Awa | 📱 | publique | T1 · **V1** |
| `/solutions/{senegal, benin, cameroun}` *(×3)* | Awa | 📱 | publique | plus tard — **3 critères sur 6 requis** *(seo-strategy §3.3)* |
| `/integrations` + `/integrations/{wave, orange-money, mtn-momo, moov-money}` *(×5)* | Awa | 📱 | publique | T5 · V1.5 — **publiée seulement si l'intégration existe** |
| `/ressources` · `/guides` · `/blog` | Awa | 📱 | publique | T1 · **V1** |
| `/guides/$slug` · `/blog/$slug` · `/modeles/$slug` | Awa | 📱/🖥 | publique | T1 · **V1** |
| `/securite` | Serge, acheteur B2B | 🖥 | publique | T1 · **V1** |
| `/confidentialite` · `/conditions` | — | 📱 | publique | T1 · **V1** |
| `/cookies` *(noindex)* · `/statut` *(noindex)* | — | 📱 | publique | T1 / T5 · V1–V1.5 |
| `/connexion` · `/auth/otp` | Tout le personnel | 📱 | publique *(noindex)* | T0 · **V1** |
| `/menu/$venueSlug` *(hôte `menus.*`)* | Aïcha avant d'entrer | 📱 | `venues.publicMenuEnabled` | T1 · **V1** — **bloqué par G1** |

### B — Client à table *(13 surfaces)* — `noindex` intégral, aucune permission, session invité

| Route | Persona | App. | Garde | Priorité |
|---|---|:--:|---|---|
| `/r/$venueSlug/t/$token` *(échange 302)* | Aïcha | 📱 | `tableQrCodes.token` valide | T1 · **V1** |
| `/r/$venueSlug/rejoindre` | Aïcha | 📱 | `tableSessions.activationCode` | T1 · **V1** |
| `/r/$venueSlug/table` *(la carte)* | Aïcha | 📱 | session invité | T1 · **V1** |
| `/r/$venueSlug/table/produit/$productId` | Aïcha | 📱 | session invité | T1 · **V1** |
| `/r/$venueSlug/table/panier` | Aïcha | 📱 | session invité | T2 · **V1** |
| `/r/$venueSlug/table/commandes` | Aïcha | 📱 | session invité | T2 · **V1** |
| *feuille* **Demande de service** *(overlay, partout)* | Aïcha | 📱 | session invité | T2 · **V1** |
| `/r/$venueSlug/table/addition` | Aïcha | 📱 | session invité | T3 · **V1** |
| `/r/$venueSlug/table/addition/partage` | Les 4 | 📱 | session invité | T3 · **V1** |
| `/r/$venueSlug/table/addition/payer` · `/retour` | Aïcha | 📱 | session invité | T5 · V1.5 |
| `/r/$venueSlug/table/ticket/$reference` | Aïcha | 📱 | session invité *(404 si hors session)* | T3 · **V1** |
| `/r/$venueSlug/table/avis` | Aïcha | 📱 | session invité | T4 · V1.5 |

### C — Application restaurant *(37 routes)* — `noindex` intégral

| Route | Persona | App. | Permission *(PERMISSIONS.md §3)* | Priorité |
|---|---|:--:|---|---|
| `/app` *(aiguillage)* | Tous | 📱/🖥 | membre actif | T0 · **V1** |
| `/app/live` | Awa, Floor Manager | 🖥/📟 | `order.read` + `table.read` (+ `kitchen.read`, `service_request.read` par colonne) | T6 · V1.5 |
| `/app/tables` | **Koffi** | 📱 | `table.read` · `table.session.open` | T2 · **V1** |
| `/app/tables/$id` | Koffi, Mariam | 📱 | `table.read` + actions selon `order.*`, `payment.collect`, `table.session.*` | T2 · **V1** |
| `/app/floor` | Awa *(hors service)* | 🖥 | `table.manage` · `table.qr.manage` | T1 · **V1** |
| `/app/orders` · `/app/orders/$id` | Floor Manager, Awa | 🖥 | `order.read` (+ `order.modify.after_fire`, `order.cancel`, `order.discount.apply`) | T2 · **V1** |
| `/app/kitchen` *(aiguillage)* | Ibrahim | 📟 | `kitchen.read` | T2 · **V1** |
| **`/app/kitchen/$stationId`** *(KDS)* | **Ibrahim** | 📟 | `kitchen.read` · `kitchen.ticket.update` · `menu.availability.toggle` | T2 · **V1** |
| `/app/cashier` | **Mariam** | 📟/🖥 | `check.manage` · `payment.collect` (+ `payment.refund`, `payment.void`) | T3 · **V1** |
| `/app/registers` | Mariam, Awa | 📟/🖥 | `cash_register.open` · `close` · `adjust` | T3 · **V1** |
| `/app/payments` | Mariam, Awa, comptable | 🖥 | `payment.read` (+ `export.data`) | T3 · **V1** |
| `/app/menu` | Awa, Menu Manager | 🖥 | `menu.read` · `menu.publish` | T1 · **V1** |
| `/app/menu/products` · `/products/$id` | Menu Manager | 🖥 | `menu.edit` · **`menu.price.edit`** pour les prix | T1 · **V1** |
| `/app/menu/categories` · `/options` | Menu Manager | 🖥 | `menu.edit` | T1 · **V1** |
| `/app/menu/availability` | **Ibrahim, Floor Manager** | 📱 | **`menu.availability.toggle`** seule | T1 · **V1** |
| `/app/customers` · `/customers/$id` | Awa | 🖥 | `customer.read` · `customer.manage` | T9 · plus tard *(la section avis dès T4)* |
| `/app/analytics` | Awa, Serge, comptable | 🖥/📱 | `analytics.read` · `analytics.financial.read` · `organization.analytics.read` | T6 · V1.5 |
| `/app/team` · `/team/$memberId` | Awa, Serge | 🖥 | `team.read` · `team.manage` | T0 · **V1** |
| `/app/roles` · `/roles/$roleId` | Serge, Awa | 🖥 | `permissions.manage` | T0 · **V1** |
| `/app/ai` | Awa | 📱/🖥 | `ai.use` · `ai.actions.propose` · `ai.actions.approve` | T9 · plus tard |
| `/app/settings/general` | Awa | 🖥 | `organization.manage` | T0 · **V1** |
| `/app/settings/venue` | Awa | 🖥 | `venue.manage` | T0 · **V1** — **bloqué par G1** |
| `/app/settings/service` | Awa | 🖥 | **`venue.settings.service`** | T1 · **V1** |
| `/app/settings/payments` | Awa | 🖥 | `venue.manage` | T3 · **V1** — **incomplet par G6** |
| `/app/settings/branding` | Awa | 🖥 | `venue.manage` | T1 · **V1** |
| `/app/settings/stations` | Awa | 🖥 | `kitchen.manage` | T2 · **V1** |
| `/app/settings/security` *(appareils)* | Awa | 🖥 | `device.manage` | T2 · **V1** |
| `/app/settings/audit` | Awa, comptable | 🖥 | `audit.read` | T3 · **V1** |
| `/app/settings/notifications` | Awa | 🖥 | `venue.manage` | T9 · plus tard |
| `/app/settings/billing` | Serge | 🖥 | `organization.billing.manage` | T8 · plus tard |
| `/app/settings/integrations` | Awa | 🖥 | `venue.manage` | T10 · plus tard — **pas d'action principale (G7)** |

### D — Mise en service *(13 routes)* — toutes en T7 · V1.5

| Route | Persona | App. | Permission | Note |
|---|---|:--:|---|---|
| `/app/onboarding` *(tableau de progression)* | Awa | 📱/🖥 | `venue.manage` | 4 groupes, 11 étapes, **rien de bloquant** |
| `…/organisation` | Awa | 🖥 | `organization.manage` | non sautable |
| `…/etablissement` | Awa | 🖥 | `venue.manage` · `venue.create` | non sautable · **gel de la devise annoncé** |
| `…/service` | Awa | 🖥 | **`venue.settings.service`** | **les trois questions de `PRODUCT.md` §2** |
| `…/taxes` | Awa | 🖥 | `venue.manage` | sautable |
| `…/carte` | Awa | 🖥 | `menu.edit` | non sautable |
| `…/stations` | Awa | 🖥 | `kitchen.manage` | sautable |
| `…/salle` | Awa | 🖥 | `table.manage` | non sautable |
| `…/qr` | Awa | 🖥 | `table.qr.manage` | sautable |
| `…/equipe` | Awa | 🖥 | `team.manage` | sautable |
| `…/paiements` | Awa | 🖥 | `venue.manage` | sautable — **l'espèce suffit pour ouvrir** |
| `…/marque` | Awa | 🖥 | `venue.manage` | sautable |
| **`/app/onboarding/simulation`** | **Awa + tout nouvel employé** | 🖥 + 📱 | `venue.manage` *(les écrans internes gardent leurs permissions réelles)* | **bloqué par G2** — `ANALYTICS.md` §3.4 exige l'exclusion, le mécanisme n'existe pas |

### E — Plateforme *(12 routes)* — garde `requirePlatformAdmin`, jamais attribuable à un client

| Route | Persona | App. | Permission | Priorité |
|---|---|:--:|---|---|
| `/admin` | Équipe Joliba | 🖥 | `platform.organizations.read` | T8 · plus tard |
| `/admin/organizations` | Support | 🖥 | `platform.organizations.read` | T8 · plus tard |
| **`/admin/organizations/$id`** *(vue 360°)* | Support | 🖥 | `platform.organizations.read` · `platform.organizations.manage` · **`platform.impersonate`** *(motif obligatoire, durée limitée, bandeau permanent, audité — `SECURITY.md` M18)* | T8 · plus tard |
| `/admin/venues` · `/admin/users` | Support | 🖥 | `platform.organizations.read` | T8 · plus tard |
| `/admin/subscriptions` | Facturation | 🖥 | `platform.organizations.manage` | T8 · plus tard |
| `/admin/support` | Support | 🖥 | `platform.support.manage` | T7 · V1.5 — **sur `bugReports` uniquement (G5)** |
| `/admin/incidents` | Astreinte | 🖥 | `platform.incidents.manage` | **à ne pas construire (G5)** — aucune table |
| `/admin/flags` | Produit | 🖥 | `platform.flags.manage` | T8 · plus tard |
| `/admin/ai-usage` | Produit, finance | 🖥 | `platform.organizations.read` | T9 · plus tard |
| `/admin/audit` | Sécurité | 🖥 | `platform.audit.read` | T8 · plus tard |
| `/admin/health` | Astreinte | 🖥 | `platform.incidents.manage` | T5 · V1.5 *(les webhooks en échec ne peuvent pas attendre T8)* |

**Total : 120 routes documentées** — 45 publiques, 13 côté client à table, 37 applicatives, 13 de
mise en service, 12 de plateforme.

---

## 9. Ce que je n'ai pas tranché, et pourquoi

Ces points relèvent d'une décision qui n'appartient pas à l'architecture de l'information. Les
trancher ici aurait été les cacher.

1. **`G1` à `G9` du §0.3** — chacun est une décision de modèle de données, de catalogue de
   permissions ou de machine à états. Les deux plus coûteux si on les laisse filer : **`G2`**
   (isolation de la simulation : une commande jouée dans le chiffre d'affaires discrédite tous les
   chiffres, et `ANALYTICS.md` §3.4 l'interdit déjà sans en donner le moyen) et **`G4`** (Mariam
   bloquée devant sa caisse chaque soir où il y a un écart).
2. **Le nommage des URL** — français côté public, anglais côté application *(G9)*. Il faut choisir
   une fois ; je n'ai pas voulu renommer quarante routes de ma propre autorité.
3. **Le mode de partage d'addition par défaut** — `DATA_MODEL.md` §12.4 le laisse explicitement aux
   entretiens terrain. L'écran §3 gère les quatre modes ; **lequel est présélectionné** reste ouvert.
4. **Le PIN de service** *(A1)* — tant qu'il n'est pas tranché, `/connexion` reste l'écran des
   gérants et la cuisine tient par `trustedDevices`. La moitié du personnel n'a donc pas d'écran de
   connexion praticable, et c'est un risque d'adoption, pas un détail d'IA.
5. **Le canal de notification principal** *(question ouverte n°11)* — j'ai posé **WhatsApp** en action
   principale sur le ticket et sur l'aide de l'onboarding, parce que la recherche établit que le
   courriel n'est pas le canal d'affaires en Afrique de l'Ouest. Si la décision retient l'e-mail,
   trois actions principales changent.
6. **La page `/fonctionnalites/hors-ligne`** *(G8)* — je n'ai pas réécrit son discours : c'est un
   arbitrage commercial qui dépend de la réponse à `A8` (voie 1, 2 ou 3), pas une question de
   maquette.
7. **Le contenu éditorial en fichiers plutôt qu'en base** — aucune table d'articles n'existe, donc
   `/blog`, `/guides` et `/modeles` sont en MDX versionné. C'est le bon choix, mais il n'a jamais été
   écrit noir sur blanc ; il devrait l'être dans une décision.
