# Decision Log — Joliba

> §121 : « Conserve un Decision Log. » · « Lorsqu'une information manque et qu'elle n'empêche pas
> raisonnablement d'avancer : fais une hypothèse documentée. »

Trois sections : les **désaccords** que je porte sur le brief (§121 : « Si une décision que je
propose est mauvaise : signale-la »), les **hypothèses** qui tiennent lieu de fait tant que le
terrain n'a pas parlé, et les **décisions** arrêtées.

Statuts : `proposé` · `accepté` · `à trancher par l'utilisateur` · `révisé` · `abandonné`.

---

## Partie A — Désaccords avec le brief

Ce ne sont pas des refus : ce sont des points où appliquer le brief à la lettre produirait, à mon
avis, un produit plus faible. Chacun propose une alternative.

### A1 — L'OTP par e-mail seul est impraticable pour le personnel de salle et de cuisine

**Ce que dit le brief** (§7) : « Méthodes initiales : 1. OTP envoyé par e-mail ; 2. Google OAuth.
Pas de mot de passe classique dans la première version. »

**Le problème.** Cela marche pour un gérant. Cela ne marche pas pour un serveur, un cuisinier ou un
caissier en Afrique francophone : beaucoup n'ont pas d'adresse e-mail réellement consultée, et
surtout **personne ne va ouvrir sa boîte mail au milieu d'un coup de feu** pour lire un code à six
chiffres. Une cuisine dont l'écran demande un OTP e-mail à chaque réveil de tablette est une cuisine
qui débranche l'écran au bout de trois jours. C'est le mode d'échec classique des logiciels de
restauration : ce n'est pas le gérant qui les tue, c'est le personnel qui les contourne.

**Ce que je propose, sans supprimer ce qui est demandé :**

| Qui | Méthode | Pourquoi |
|---|---|---|
| Owner, Admin, Manager, Comptable | OTP e-mail + Google OAuth (exactement comme demandé) | Ils ont une adresse, ils se connectent depuis leur propre appareil |
| Serveur, Caissier, Cuisine, Bar | **Code PIN de service sur appareil enrôlé** | Reconnexion en 2 secondes, mains occupées, appareil partagé |
| Écran cuisine / KDS | **Appareil enrôlé** (jeton long, révocable), pas de session humaine | Une tablette murale n'est pas une personne |

Le PIN n'est une authentification faible que s'il est seul. Adossé à un appareil **enrôlé par un
manager déjà authentifié**, limité à un établissement, à durée de session courte, révocable à
distance et journalisé, il est plus sûr en pratique qu'un OTP que trois serveurs finiront par se
partager sur WhatsApp.

**Coût si on ne le fait pas :** le produit reste un outil de gérant, jamais un outil de service.
**Statut : à trancher par l'utilisateur.** Par défaut je conçois le schéma pour que les deux
coexistent : `trustedDevices` **existe déjà** dans le schéma et porte l'appareil enrôlé — la moitié
du mécanisme est donc en place. La table `staffProfiles` qui porterait le `pinHash`, en revanche,
**n'est pas créée** : elle ne le sera qu'après accord, parce qu'un champ de secret qu'on crée « au
cas où » finit par être rempli sans que la question de sécurité ait été tranchée.

### A2 — La commande directe par le client menace le pourboire du serveur : c'est le vrai risque d'adoption

**Ce que dit le brief** (§1) : plusieurs modes, dont « commande directe sans validation ».

**Le problème.** Le brief traite le sujet comme une question de configuration. C'est d'abord une
question humaine. Si le client commande seul, le serveur perd du contact, parfois du pourboire, et
il a la capacité de saboter l'outil (« le réseau ne marche pas », « le QR est décollé »).

**Ce que je propose :** que le mode par défaut à l'installation soit **« QR + commande serveur »**,
pas la commande directe. Le client consulte, compose éventuellement son panier, et **le serveur
valide**. Le restaurant ouvre la commande directe quand il l'a décidé, pas parce que c'était coché
par défaut. Ajouter dans l'écran serveur la trace « table servie par X » pour que le pourboire reste
attribuable, et rendre visible au client qui le sert.

**Statut : proposé.** Confirmé ou infirmé par les entretiens serveurs (guide §4, question 8).

### A3 — La liste de ~150 tables du §50 ne doit pas être implémentée telle quelle

**Ce que dit le brief** (§50) : une longue liste de tables, suivie de « Cette liste n'est pas
automatiquement la vérité. Pour chaque table : justifier son existence. Éviter les tables inutiles. »

**Ce que je fais :** je prends le brief au mot. `DATA_MODEL.md` retient un noyau justifié table par
table, et déplace le reste dans une section « différé, avec son point d'ancrage ». Deux cas concrets :

- **`permissions` ne sera pas une table.** Le catalogue de permissions est une constante de code,
  typée, versionnée avec l'application. Le mettre en base crée une seconde source de vérité qu'il
  faut migrer à chaque déploiement, et rend impossible le typage `Permission` côté TypeScript. Les
  **rôles personnalisés**, eux, sont bien une table (ils appartiennent à l'organisation).
- **Les 11 tables d'inventaire** (§42) ne sont pas créées en V1. Le schéma garde le point
  d'ancrage (`products.recipeId` nullable) pour les brancher sans migration douloureuse, mais
  construire un inventaire avant d'avoir une commande qui fonctionne, c'est bâtir le premier étage
  avant le rez-de-chaussée — et le brief le dit lui-même : « empêcher qu'une fonctionnalité stock
  immature bloque les commandes ».

**Statut : accepté** (le brief l'autorise explicitement).

### A4 — L'offline « complet » est un piège ; l'offline utile est étroit

**Ce que dit le brief** (§71) : PWA, file d'attente offline avec clé d'idempotence, et l'avertissement
« ne jamais afficher "commande envoyée" si elle n'a pas réellement été confirmée ».

**Le problème.** Une file offline générale sur un système où l'argent circule produit des situations
insolubles : une commande envoyée hors ligne à 20 h 10 et synchronisée à 20 h 40 arrive après que la
table a été clôturée et payée. Le coût de correction dépasse le bénéfice.

**Ce que je propose** — trois cercles, et pas un de plus :

1. **Lecture offline** : menu, prix, photos, plan de salle. Sans risque, grande valeur (le client
   dont la 4G tombe voit quand même la carte).
2. **File d'écriture offline pour le personnel uniquement**, sur un périmètre fermé : ajout d'article,
   marquer prêt, marquer servi, demande de service. Chaque mutation porte une clé d'idempotence, et
   l'interface affiche un état **« en attente de confirmation »** distinct de « envoyé ».
3. **Jamais hors ligne** : le paiement, la clôture de caisse, le remboursement, la clôture de table.
   Si le réseau est absent, on encaisse en espèces et on enregistre après. C'est ce que le
   restaurant fait déjà.

**Statut : proposé.**

### A5 — « Architecture complète, livraison progressive » impose des tranches verticales, pas des couches

**Ce que dit le brief** (§108) : « Je ne veux pas que tu supprimes des fonctionnalités importantes
simplement sous prétexte de MVP » et « ne tente pas non plus de coder tout simultanément ».

**Ce que ça implique concrètement**, et qui n'est pas dit : il faut livrer des **tranches verticales**
(un parcours complet utilisable par un vrai restaurant), pas des **couches horizontales** (tous les
CRUD, puis toutes les pages). Une couche horizontale ne sert personne tant que la dernière n'est pas
posée ; une tranche verticale peut être mise en service et corrigée par le réel. La roadmap est donc
organisée par « ce qu'un restaurant peut faire à la fin de l'étape », jamais par « quelles tables
sont créées ».

**Statut : accepté.**

### A6 — Le QR est le discours de vente, mais la valeur opérationnelle est ailleurs

Le brief a raison de dire que le QR n'est que l'entrée (§1, §120). J'ajoute une conséquence
commerciale : dans un maquis d'Abidjan, **la douleur qui fait payer n'est pas « mes clients veulent
un joli menu »**, c'est « je ne sais pas ce qui est entré en caisse », « la commande s'est perdue »,
« le serveur a encaissé sans enregistrer ». Le QR ouvre la porte ; ce qui fait signer, c'est la
coordination cuisine–salle–caisse et la traçabilité de l'argent.

Conséquence produit : la **caisse et le KDS ne sont pas des modules tardifs**, ce sont des modules de
première tranche, au même titre que le menu.

**Statut : proposé.**

### A7 — RÉVISÉ : la conformité fiscale n'est pas un risque à éviter, c'est un motif d'achat

**Ce que je disais le matin même** (version initiale de ce document) : « facture » est un mot
réglementé, donc bannissons-le et prévoyons une abstraction fiscale « plus tard ».

**Ce que la recherche a établi, et qui renverse la conclusion.** En Côte d'Ivoire, la **Facture
Normalisée Électronique (FNE) est obligatoire pour toutes les entreprises, sans exception de régime
fiscal, depuis le 1ᵉʳ décembre 2025**, et **la DGI a lancé des contrôles sur tout le territoire à
compter du 1ᵉʳ septembre 2026** — c'est-à-dire *maintenant*. Chaque facture doit être transmise au
système de la DGI, qui lui attribue un numéro normatif, un visuel et un QR code de vérification.
*(Sources et dates dans `docs/research/competitive-analysis.md` §6.7.)*

Et surtout : **aucune des treize solutions internationales étudiées ne mentionne la facture
normalisée.** Les acteurs locaux, eux, en font leur argument principal.

**Conséquence produit.** Ce n'est plus un mot à éviter, c'est une fonctionnalité qui fait passer le
logiciel du statut d'outil utile à celui d'**obligation légale**. Le module fiscal devient un module
de première classe, pas une note de bas de page.

**Ce qui bloque, honnêtement** : le portail `fne.dgi.gouv.ci` répondait HTTP 503 au moment de
l'étude ; **la spécification technique de l'API n'a pas pu être lue**. On ne peut pas implémenter
une intégration dont on n'a pas vu le contrat. Donc : on conçoit l'abstraction maintenant, on la
déclare comme priorité de feuille de route, et **on ne promet rien sur la FNE tant que la
spécification n'est pas en main**. En attendant, le produit émet des **tickets** —
ni « reçu » ni « facture », qui désignent tous deux des pièces certifiées *(D-024)*.

**Action requise de l'utilisateur** : obtenir la documentation d'intégration éditeur auprès de la
DGI. C'est un préalable, pas une tâche de développement.

**Statut : révisé le 2026-09-17, à la lumière de la recherche.**

### A8 — Le hors-ligne pair-à-pair est le meilleur différenciateur trouvé, et il est incompatible avec la stack choisie

C'est le point le plus important de tout ce document, et il oppose deux travaux sérieux.

**Ce que la recherche a trouvé.** La documentation officielle de Toast dit, mot pour mot :
*« Devices cannot sync with each other while offline, so orders added or updated on one device do
not appear on other devices. »* Hors ligne, Toast ne peut plus afficher les commandes sur les écrans
de cuisine, ni même connecter ou déconnecter un employé. Square transfère explicitement au marchand
le risque des paiements hors ligne expirés ou refusés. Conclusion de l'étude concurrentielle :
*« personne ne propose un OS de service moderne dont le hors-ligne multi-appareils est le mode
nominal »* — et c'est rédhibitoire à Abidjan là où c'est tolérable à Boston.

**Pourquoi je ne peux pas simplement l'inscrire à la feuille de route.** Convex est un backend
**en nuage** : sa réactivité passe par un WebSocket vers ses serveurs. Il n'existe pas de mode
local, pas de réplica LAN, pas de synchronisation pair-à-pair. « Hors-ligne multi-appareils comme
mode nominal » signifie donc **un second exécutable** tournant dans le restaurant (relais local sur
une tablette ou un petit boîtier), avec sa découverte réseau, sa résolution de conflits, son
versionnage et sa mise à jour. C'est un produit dans le produit — et un produit avec du matériel,
que le §7 des questions ouvertes voulait justement éviter.

**Les trois voies, avec leur coût réel :**

| Voie | Ce qu'on livre | Coût | Risque |
|---|---|---|---|
| **1. Hors-ligne étroit** *(mon A4)* | Lecture en cache + file d'écriture du personnel + refus explicite sur l'argent | Faible, tenable en V1 | On n'a pas le différenciateur ; on dit la vérité |
| **2. Relais local d'établissement** | Un appareil fait relais LAN : les commandes circulent entre serveur et cuisine sans internet | **Élevé** — second exécutable, déploiement, mises à jour, support | Le support d'un matériel sur site change le métier |
| **3. Local-first généralisé** | Réplication et résolution de conflits partout | Très élevé | Incompatible avec Convex tel quel ; ce serait changer de backend |

**Ma recommandation : voie 1 en V1, voie 2 comme produit distinct évalué après le terrain** — et
**la conception d'aujourd'hui rend la voie 2 possible sans réécriture**, parce que trois choix déjà
actés y mènent : identifiants générés côté client, clé d'idempotence sur toute mutation, et journal
d'événements métier plutôt que seul état courant. Ce sont exactement les fondations d'une
synchronisation différée.

**Ce que je refuse de faire** : annoncer un hors-ligne que le produit ne tient pas. L'étude
concurrentielle appelle cela « le mode hors-ligne en trompe-l'œil » et le classe parmi les pratiques
à ne pas copier. Le promettre serait reproduire le défaut qu'on reproche à Toast.

**Statut : à trancher par l'utilisateur** — c'est un arbitrage d'investissement, pas un choix
technique. La question précise est posée en Partie C.

---

## Partie B — Hypothèses (à confirmer par le terrain ou l'utilisateur)

Chaque hypothèse porte un **coût si elle est fausse** : c'est ce qui décide s'il faut la vérifier
avant de coder.

| # | Hypothèse | Fondement | Coût si fausse | Comment on la vérifie |
|---|---|---|---|---|
| H1 | Marché initial = Côte d'Ivoire, extension UEMOA | Brief §2, contexte utilisateur | Devise, fiscalité, PSP à refaire | Décision utilisateur |
| H2 | L'espèce reste majoritaire en salle, le Mobile Money progresse | Usage observé en Afrique de l'Ouest | Priorité caisse vs paiement en ligne inversée | Entretiens caissiers |
| H3 | Le personnel utilisera son propre téléphone Android | Coût du matériel | Il faut vendre du matériel → autre métier | Entretiens serveurs |
| H4 | La cuisine accepte une tablette si elle ne ralentit pas | Pratique du secteur | Le KDS devient une imprimante de tickets | Entretiens cuisine |
| H5 | Le réseau tombe assez souvent pour justifier l'offline lecture | Contexte local | Effort PWA surdimensionné | Mesure sur place (guide §8) |
| H6 | Un groupe multi-sites existe dès le départ dans la cible | Brief §6 (Groupe XYZ) | Le modèle organisation→venue est surdimensionné | Décision utilisateur |
| H7 | Les restaurants veulent publier un menu public indexable | Brief §64 | La boucle SEO/growth s'effondre | Entretiens gérants |
| H8 | Le français est la langue principale de l'UI produit | Brief rédigé en français, marché visé | Inversion FR/EN par défaut | Décision utilisateur |
| H9 | Un restaurant type = 1 à 40 tables, 3 à 30 employés | Observation du secteur | Dimensionnement des écrans et des plans tarifaires | Entretiens |
| H10 | Le paiement en ligne n'est pas le mode dominant en V1 | H2 | On a priorisé la caisse pour rien | Entretiens + données d'usage |

## Partie C — Questions à trancher par l'utilisateur

Elles n'empêchent pas d'avancer : j'ai pris une valeur par défaut, indiquée entre crochets.
Elles sont regroupées ici pour être répondues d'un coup.

1. **Nom du produit** — **tranché le 2026-09-22 : Joliba.**
   ⚠️ **Rouvert le 2026-09-23** : Orange SA détient « DJOLIBA » à l'OAPI (classes 9 et 42, logiciels
   et services informatiques, jusqu'en 2030). Garder Joliba avec avis d'un conseil en PI et accord de
   coexistence, ou changer de nom avant le lancement (Balani, Sabar passés au même crible). Détail :
   `docs/brand/verifications-marque.md`. *[défaut : aucun dépôt ni dépense de marque tant que ce
   n'est pas tranché ; le développement continue sous le nom Joliba, facile à remplacer]*
2. **PIN de service pour le personnel** (A1) — **tranché le 2026-09-23 : D-060.**
3. **Mode de service par défaut** (A2) — **tranché le 2026-09-23 : D-061** (`staff_only` et panier
   à montrer).
4. **Pays de lancement** et devise de référence. *[défaut : Côte d'Ivoire, XOF]*
5. **Langue par défaut de l'application** — français. *[défaut : FR, EN livré en même temps]*
6. **Un seul PSP au départ ou deux ?** *[défaut : un seul, derrière l'abstraction, le second brancheable
   sans toucher au métier]*
7. **Le produit vend-il du matériel** (tablette, imprimante ticket) ou reste-t-il logiciel pur ?
   *[défaut : logiciel pur, impression via abstraction]*
8. **Marque blanche** : un restaurant peut-il retirer « Powered by Joliba » ? *[défaut :
   retirable seulement sur les plans payants supérieurs]*
9. **Hors-ligne : quelle ambition ?** *(A8)* — **tranché le 2026-09-23 : D-062** (voie « V1+ »,
   voie 2 seulement sur mesure terrain, voie 3 jamais).
10. **FNE** *(A7)* — **stratégie tranchée le 2026-09-23 : D-063.** Reste une action du
    propriétaire, pas du code : entité ivoirienne avec NCC, lecture de la procédure API, huit
    questions au Comité d'agrément et à un intégrateur agréé, réponses avant le premier lot
    « tickets » de T3.
11. **Nommage des URL** *(G9)* : routes publiques en français et routes applicatives en anglais,
    ou une seule langue partout ? Ce n'est pas bloquant techniquement, mais il faut **choisir une
    fois** — après, chaque changement coûte des redirections. *[défaut : tel quel, français côté
    public, anglais côté application]*
12. **Canal de notification principal** : WhatsApp plutôt que l'e-mail ? La recherche montre que le
    courriel n'est pas le canal d'affaires en Afrique de l'Ouest. *[défaut : e-mail en V1, WhatsApp
    conçu comme canal de premier plan]*

## Partie C bis — Les neuf manques bloquants (G1–G9)

Relevés par l'agent d'architecture de l'information *(`docs/INFORMATION_ARCHITECTURE.md` §0.3)*, qui
les a qualifiés d'écrans « impossibles à spécifier honnêtement en l'état ». La revue adverse
*(`docs/CRITIQUE.md` B3)* a ensuite constaté qu'ils **n'étaient remontés dans aucun document de
synthèse** : quiconque lisait la feuille de route croyait l'architecture prête. Ils sont donc
remontés ici, avec leur état réel.

| # | Manque | État | Ce qui a été fait |
|---|---|---|---|
| **G1** | `venues` sans adresse, téléphone, horaires, description, géo — le menu public de T1 était inatteignable | ✅ **corrigé** | Champs `address`, `geo`, `phone`, `publicEmail`, `description`, `openingHours`, `socialLinks` ajoutés au schéma |
| **G2** | Le mode simulation n'avait **aucun** point d'ancrage, alors qu'`ANALYTICS.md` interdit déjà que ces données comptent | ✅ **corrigé** | `venues.isSimulation` + `tableSessions.isSimulation` |
| **G3** | `closed_with_debt` exigeait « permission + motif » sans qu'aucune permission de ce nom existe : tout serveur aurait pu effacer une dette | ✅ **corrigé** | Permission `table.session.close_with_debt`, sensible, auditée, motif obligatoire — **absente du rôle Serveur** |
| **G4** | La machine de caisse ne sortait de `discrepancy` que par `adjusted`, qui exige une permission que le caissier n'a pas : **Mariam ne pouvait pas fermer sa caisse un soir d'écart** | ✅ **corrigé** | Transition `discrepancy → closed` ajoutée ; `adjust` réservé à la *correction* du chiffre |
| **G6** | `D-026` (changer de fournisseur de paiement sans déploiement) était marquée « accepté » alors qu'aucun champ ne la portait | ✅ **corrigé** | Bloc `venueSettings.payments` (méthodes actives, fournisseurs ordonnés, pas de montant) |
| **G5** | Aucune table pour le support ni les incidents plateforme, alors que leurs permissions existent | ⬜ **ouvert** | `/admin/support` s'appuie sur `bugReports` en V1 ; `/admin/incidents` est **repoussé** et traité hors produit jusqu'à T8 |
| **G7** | Réservations, fidélité, stock, intégrations sont différés mais leurs permissions sont au catalogue | ⬜ **assumé** | Le catalogue réserve les noms pour éviter un renommage plus tard ; les écrans correspondants ne sont pas livrés en V1 |
| **G8** | Deux pages marketing promettent ce que la V1 ne tient pas : `/fonctionnalites/stock` et `/fonctionnalites/hors-ligne` | ✅ **corrigé** | Les deux pages ne sont **pas publiées en V1** ; leur discours est réécrit sur les trois cercles réels *(A4)* |
| **G9** | Routes publiques en français, routes applicatives en anglais | ⬜ **à trancher** | Question 12 de la partie C |

---

## Partie D — Décisions arrêtées

| # | Décision | Motif | Statut | Date |
|---|---|---|---|---|
| D-001 | Le tenant racine est l'**organisation**, l'établissement est la **venue** ; toute table métier porte `organizationId`, et `venueId` dès qu'elle est locale | Brief §6 ; nécessaire aux groupes multi-sites | accepté | 2026-09-17 |
| D-002 | Le catalogue de permissions vit dans le **code**, pas en base ; seuls les rôles personnalisés sont en base | Évite une seconde source de vérité ; permet le typage | accepté | 2026-09-17 |
| D-003 | Toute vérification de permission a lieu **côté Convex** ; l'UI ne fait que masquer | Brief §8 ; l'UI n'est pas une barrière | accepté | 2026-09-17 |
| D-004 | Les montants sont stockés en **entier**, dans l'unité mineure de la devise, avec l'exposant décimal porté par la devise (XOF : exposant 0) | Brief §77 ; jamais de flottant sur de l'argent | accepté | 2026-09-17 |
| D-005 | Les lignes de commande stockent un **snapshot** figé (nom, prix, options, taxes) ; un changement de carte ne réécrit jamais le passé | Brief §17 | accepté | 2026-09-17 |
| D-006 | `tableSession` est l'objet central du service ; une table physique n'est ni une commande ni une addition | Brief §10 | accepté | 2026-09-17 |
| D-007 | L'addition (`check`) est **séparée** de la commande (`order`) ; une session peut porter plusieurs additions et plusieurs paiements | Brief §25 | accepté | 2026-09-17 |
| D-008 | Le QR encode un **token opaque non devinable** ; le scan l'échange contre une session signée. Le token n'est jamais l'identifiant de session | Brief §9 ; une photo de QR ne doit pas suffire | accepté | 2026-09-17 |
| D-009 | Les transitions d'état (commande, ticket, paiement, session, caisse) sont des **machines à états explicites** validées côté serveur, jamais des chaînes libres | Brief §16, §5 | accepté | 2026-09-17 |
| D-010 | Toute mutation financière ou de production porte une **clé d'idempotence** | Brief §54, §119 | accepté | 2026-09-17 |
| D-011 | Les modes de service sont une **configuration d'établissement** lue par la machine à états, jamais un `if` disséminé | Brief §1 | accepté | 2026-09-17 |
| D-012 | Livraison par **tranches verticales** utilisables, pas par couches horizontales | A5 | accepté | 2026-09-17 |
| D-013 | Aucune identité visuelle reprise de `filon` ; seuls les patterns d'ingénierie le sont | Brief §3, §66 | accepté | 2026-09-17 |
| D-014 | L'IA ne décide jamais seule d'une action sensible : proposition → aperçu → validation humaine → exécution → journal | Brief §35, §118 | accepté | 2026-09-17 |
| D-015 | ~~Le produit émet des « reçus »~~ — **révisée par D-024** : « reçu » désigne le RNE, pièce certifiée. Le produit émet des **tickets** ; ni « reçu » ni « facture » n'apparaissent avant certification | Brief §29 ; A7 ; corrigé par D-024 | révisé | 2026-09-17 |
| D-016 | **La souveraineté du tenant appartient à Convex, pas à Better Auth.** Better Auth ne fait que l'identité (comptes, sessions, OTP, Google) ; organisations, membres, rôles et portées sont nos tables | Le plugin `organization` de Better Auth **ne figure pas** dans la liste supportée par le composant Convex ; et il ne modélise de toute façon pas la portée par établissement. Éviter deux sources de vérité sur l'appartenance | accepté | 2026-09-17 |
| D-017 | `better-auth` est épinglé avec un **tilde** (`~1.6.x`), jamais un accent circonflexe | `@convex-dev/better-auth@0.12.5` exige `>=1.6.11 <1.7.0` ; `^1.6.x` autoriserait 1.7.5 et **casserait l'authentification**. Le dépôt de référence `filon` porte ce piège armé (`^1.6.26`) — on ne le reproduit pas | accepté | 2026-09-17 |
| D-018 | TypeScript reste en `~5.9.x` ; la 7.x (portage Go) est écartée | Divergence d'inférence documentée avec TanStack Router (ticket ouvert). Le paquet et le binaire portent le même nom : la bascule serait invisible | accepté | 2026-09-17 |
| D-019 | **L'espèce est un moyen de paiement de première classe**, et une même addition accepte plusieurs moyens (espèces + Mobile Money + carte) | ~75 % des comptes mobile money sont inactifs sur 30 jours : l'espèce reste dominante. Aucun concurrent ne traite le paiement mixte sur une addition | accepté | 2026-09-17 |
| D-020 | Le module **fiscal** est un module de première classe, avec une abstraction par pays ; rien n'est promis sur la FNE avant lecture de sa spécification | A7 révisé | accepté | 2026-09-17 |
| D-021 | **Aucun matériel propriétaire.** Le téléphone du personnel est le terminal ; l'impression est optionnelle ; le KDS tourne sur tablette d'entrée de gamme, sans supplément par écran | 81 % des smartphones vendus en Afrique en 2025 sont sous 200 $ ; les concurrents facturent 30 $/écran/mois ou 599–1 199 $ le terminal | accepté | 2026-09-17 |
| D-022 | La grille tarifaire s'ancre sur la **bande locale réelle** (ordre de grandeur 10 000–20 000 FCFA/mois), pas sur un tarif occidental converti, et affiche les commissions | Cinq concurrents sur treize ne publient aucun prix ; un tarif à 69 $/mois est hors marché | proposé | 2026-09-17 |
| D-023 | Le scan **échange** le jeton contre un cookie `httpOnly`, puis **redirige en 302** vers une URL sans secret (`/r/<venue>/table`) | Retire le jeton de l'historique, du partage, des journaux, de l'analytique et de l'en-tête `Referer`. Aucune autre couche ne supprime le problème, elles ne font que le limiter | accepté | 2026-09-17 |
| D-024 | La pièce remise au client s'appelle `bills` dans le code et « ticket » dans l'UI — **jamais « reçu » ni « facture »** avant certification | En Côte d'Ivoire, « reçu » désigne le **RNE** et « facture » le **FNE** : deux pièces certifiées par la DGI. Un restaurant émet des RNE en B2C et des FNE en B2B | accepté | 2026-09-17 |
| D-025 | Ordre des fournisseurs de paiement : **espèces d'abord** (vrai `PaymentProvider`), puis Wave Côte d'Ivoire, puis un agrégateur | Wave est le seul de la région à documenter par écrit les quatre garanties dont le module a besoin : webhooks signés et horodatés, identifiant d'événement dédié à la déduplication, remboursement idempotent, réessais sur 3 jours. Son défaut (un seul rail) est un avantage : il force le second adaptateur tout de suite | proposé | 2026-09-17 |
| D-026 | Le fournisseur de paiement actif se change **par configuration en base**, jamais par déploiement | Un agrégateur régional est passé en liquidation judiciaire en 2025, un autre a subi une cyberattaque reconnue ; et un nouveau cadre interbancaire régional entre en vigueur. Devoir livrer une version pour changer de rail est un risque d'exploitation | accepté | 2026-09-17 |
| D-027 | Le pourboire est **désactivé par défaut** | Aucun encadrement légal ivoirien du pourboire n'a été trouvé lors de la recherche. Activer par défaut une collecte d'argent dont le cadre est inconnu est un risque qu'on ne prend pas | accepté | 2026-09-17 |
| D-028 | Les montants envoyés à un fournisseur sont arrondis **au supérieur** par nous, et le montant réellement accepté est stocké à part (`acceptedAmount`) | Au moins un agrégateur impose un pas de 5 et arrondit **à l'inférieur sans prévenir** : sans ce champ, l'écart disparaît et la caisse ne tombe plus juste | accepté | 2026-09-17 |
| D-029 | **Pas de redirection automatique** selon la langue du navigateur ou l'adresse IP ; une seule locale française (pas de `fr-CI`/`fr-SN`) | Google l'interdit explicitement, et son robot explorant depuis des adresses américaines en anglais, une telle redirection pourrait rendre tout le contenu français inexploré. Les pays se différencient par des pages marché, pas par des locales | accepté | 2026-09-17 |
| D-030 | **Pas de `Disallow: /r/` dans `robots.txt`** pour les pages de table | Contre-intuitif mais décisif : interdire l'exploration empêcherait Google de **voir** le `noindex`, et l'URL pourrait être indexée sans extrait. On laisse explorer, et on interdit d'indexer | accepté | 2026-09-17 |
| D-031 | Le **propriétaire** d'une organisation (`organizations.ownerUserId`) détient tout le catalogue, partout dans l'organisation, quels que soient ses rôles | Sans cela, un propriétaire qui modifie le rôle « Propriétaire » peut s'enfermer dehors. Ce n'est pas un test de nom de rôle : c'est la propriété du compte. Le plan tarifaire retire toujours ce qu'il ne couvre pas | accepté | 2026-09-22 |
| D-032 | Une permission de portée « organisation » (`venue.create`, `permissions.manage`, `organization.*`) ne s'obtient **que** par une affectation au niveau de l'organisation | Être responsable d'un établissement ne doit pas permettre d'en créer un autre ni de composer les rôles de tous | accepté | 2026-09-22 |
| D-033 | Une invitation n'est acceptable que par le compte dont l'adresse est celle invitée ; seul le **SHA-256** du jeton est stocké ; le lien est aussi rendu à l'invitant pour qu'il le transmette (WhatsApp) | Un lien transféré n'ouvre rien, et une fuite de la base ne donne pas de quoi rejoindre une organisation. **Condition** : l'adresse du compte doit être PROUVÉE (`users.emailVerifiedAt`) — un compte Google peut porter une adresse non vérifiée ; la première version l'oubliait, corrigé avant fusion | accepté | 2026-09-22 |
| D-034 | Les codes de connexion sont limités **par adresse** (5 par 10 minutes) en plus de la limite par IP de Better Auth, qui lit les en-têtes posés par Vercel | Sans IP, Better Auth partage un seul compteur entre tous les utilisateurs : 3 demandes par minute bloqueraient la plateforme. L'IP se falsifie sur un appel direct au backend ; l'adresse visée, non | accepté | 2026-09-22 |
| D-035 | Le verrou 1 s'applique **dans les deux sens** : on ne peut ni ajouter ni retirer un droit qu'on ne détient pas (rôle, affectation, suspension) ; une modification de rôle exige un motif écrit | Sinon on affaiblit ou on écarte une personne plus habilitée que soi | accepté | 2026-09-22 |
| D-036 | Pas de React Query en T0 : les hooks réactifs de `convex/react` suffisent | Une dépendance de moins, et aucun besoin de cache HTTP tant que tout vient de Convex | accepté | 2026-09-22 |
| D-037 | `vitest` en **4.1.x**, pas en 5 | `better-auth@1.6.33` déclare `vitest ^2 \|\| ^3 \|\| ^4` en dépendance de pairs ; avec `strict-peer-dependencies`, la 5 est refusée. Désactiver le contrôle aurait été cacher le problème | accepté | 2026-09-22 |
| D-038 | La révocation d'un appareil coupe la session immédiatement, mais le jeton Convex déjà émis reste valable **15 minutes au plus** ; la suspension ou le retrait d'un membre, eux, coupent l'accès métier **immédiatement** (vérifié à chaque appel) | Limite du composant, affichée honnêtement à l'écran. La barrière qui compte — l'appartenance à l'organisation — n'a pas de délai | accepté | 2026-09-22 |
| D-039 | Les tests de bout en bout tournent contre un backend Convex **local anonyme** et le **build de production** ; les e-mails vont à un faux serveur de courrier | Aucun service extérieur, aucun compte en CI ; le serveur de développement recharge la page en optimisant ses dépendances et rendait le test aléatoire | accepté | 2026-09-22 |
| D-040 | Deux ensembles de permissions par acteur : l'**autorité** (ce que ses rôles lui donnent, avant le plan) et les **droits effectifs** (après le plan). Les verrous, la gestion d'équipe et la composition des rôles se mesurent sur l'autorité ; l'exécution d'une action, sur les droits effectifs | Mesurés sur les droits effectifs, les verrous rendaient la gestion d'équipe impossible dès qu'un plan retire un module : un responsable ne pouvait plus nommer un autre responsable, puisque ce rôle contient l'IA « qu'il n'a pas ». Le plan limite ce qu'on FAIT, pas ce qu'on peut DÉLÉGUER | accepté | 2026-09-23 |
| D-041 | Une invitation est une autorisation **différée** : à l'acceptation, on rejoue l'autorité de son auteur. Suspendre ou retirer un membre révoque ses invitations en attente ; le rétrograder les rend inopérantes | Sinon un responsable sur le départ pouvait semer des invitations vers ses propres adresses et revenir après son retrait | accepté | 2026-09-23 |
| D-042 | Une invitation ne **réactive jamais** un membre suspendu ; un membre retiré qui revient n'a que l'affectation de l'invitation | La suspension est une décision d'une personne habilitée : un lien, même valide, ne la défait pas. Les anciennes affectations d'un retiré ne ressuscitent pas | accepté | 2026-09-23 |
| D-043 | Aucun compte ne naît avec une adresse e-mail non prouvée ; les codes de connexion ont un plafond global en plus des limites par IP et par adresse | Ferme la prise de compte par liaison Google tardive (SECURITY.md M7) et borne le coût d'envoi même si l'IP est falsifiée (M6) | accepté | 2026-09-23 |
| D-044 | Le contrôle statique des gardes efface commentaires et chaînes avant de chercher, lit le corps du `handler` par appariement d'accolades, et n'accepte l'exemption `// garde :` qu'à l'intérieur de ce corps | Une garde en commentaire, le nom d'une garde dans un message, ou une exemption posée au-dessus de la fonction suivante passaient le contrôle. Chaque cas a sa fixture qui doit échouer | accepté | 2026-09-23 |
| D-045 | En T1, le scan d'un QR **n'ouvre pas** de `tableSession` : il ne donne que le droit de lire la carte de CETTE table | La session porte des commandes et une addition (T2). L'ouvrir au scan créerait des milliers de sessions vides, que personne ne ferme, sur des tables qui ne sont pas occupées | accepté | 2026-09-23 |
| D-046 | Le jeton du QR est stocké **en clair** (16 octets aléatoires) ; le laissez-passer rendu au scan est un HMAC-SHA256 (secret `GUEST_PASS_SECRET`, côté Convex seulement), valable 12 h, **revérifié à chaque lecture** contre l'état et la version du QR | Réimprimer un QR usé ne doit pas obliger à le révoquer : il faut donc pouvoir relire le jeton. Le jeton n'ouvre qu'une carte en lecture ; une photo qui circule se neutralise par « Révoquer et régénérer », qui coupe aussi les clients déjà connectés par l'ancien | accepté | 2026-09-23 |
| D-047 | Les photos sont **réduites dans le navigateur** (1280 px et vignette 480 px, WebP, JPEG à défaut) ; le serveur relit leurs **premiers octets** et leur poids dans une action, et **renvoie** le refus au lieu de le lever | Le type déclaré vient de l'expéditeur et ne prouve rien. Une écriture qui lève est annulée, effacement du fichier refusé compris : lever aurait laissé le fichier stocké | accepté | 2026-09-23 |
| D-048 | La disponibilité ne fait **pas** partie de la publication : elle est lue en direct et évaluée **à la lecture**, dans le fuseau de l'établissement, par une fonction pure partagée avec le navigateur ; la requête publique de disponibilité ne renvoie que des identifiants et des plages | Une rupture doit atteindre la table en moins d'une seconde sans republier la carte. Une requête Convex ne doit pas dépendre de l'heure (elle ne se réévaluerait pas) : le navigateur réévalue les plages chaque minute | accepté | 2026-09-23 |
| D-049 | Surface client sans fournisseur d'authentification ni client Convex au chargement : l'authentification vit dans la mise en page `_auth`, le client temps réel se charge **après** l'affichage, et `convex/_generated/api` est déclaré sans effet de bord à Rollup | Le budget de 120 Ko de JavaScript avant interaction (DESIGN §5) était dépassé (151 Ko) : chaque page payait l'authentification et un module que Rollup ne savait pas retirer. Mesuré : 104 Ko brotli sur la carte de table | accepté | 2026-09-23 |
| D-050 | Carte client en français par défaut, bascule vers l'anglais **en haut de page** ; un téléphone réglé en anglais la lit en anglais ; un nom de plat n'est **jamais** traduit automatiquement (à défaut de traduction saisie, le français s'affiche) | Un client anglophone ne descend pas jusqu'au pied de page pour trouver la langue. Une traduction automatique de « garba » ou « kedjenou » serait fausse, et c'est un contenu du restaurant | accepté | 2026-09-23 |
| D-051 | Une seule porte de qualité avant indexation : les mêmes faits (`publishedFacts`) servent au plan du site, à la balise `robots` de la page et à la liste de l'écran de réglages ; `robots.txt` est servi par le serveur pour porter une URL de plan de site **absolue** | Trois calculs parallèles auraient divergé (une page indexée absente du plan du site, ou l'inverse). RFC 9309 exige une URL absolue pour `Sitemap:` | accepté | 2026-09-23 |
| D-052 | Le service worker ne met en cache que des photos demandées en **CORS** (`crossOrigin` sur l'image), jamais une réponse opaque | Chrome réserve environ 7 Mo de quota par réponse opaque : deux cents photos auraient épuisé le quota du téléphone | accepté | 2026-09-23 |
| D-053 | Le restaurant de démonstration est créé par des fonctions **internes** (`convex/devSeed.ts`), verrouillées par `JOLIBA_DEMO_SEED=1` sur le déploiement et par un script qui refuse tout backend autre que local anonyme | Mesurer la carte sur des données réalistes sans ouvrir de porte en production : une fonction interne ne s'appelle qu'avec la clé d'administration | accepté | 2026-09-23 |
| D-054 | Les fichiers statiques sont **précompressés** au build (gzip et brotli) | Un serveur Node les servait non compressés : 419 Ko de JavaScript sur le réseau au lieu de 104. Vercel compresse de lui-même, mais le déploiement ne doit pas en dépendre | accepté | 2026-09-23 |
| D-055 | Remettre en ligne une ancienne version exige **aussi** `menu.price.edit` dès qu'un prix y diffère de ce qui est en ligne. Rattacher à un plat un groupe d'options existant, payant ou non, reste un geste de composition (`menu.edit`) | Revenir en arrière, c'est republier d'anciens prix : un acte financier que `menu.publish` seul ne couvrait pas. Le supplément d'un groupe, lui, a été fixé par quelqu'un qui en avait le droit ; le rattacher ne le change pas — comme dupliquer un plat | accepté | 2026-09-23 |
| D-056 | Une photo n'est rattachée (ou effacée après un refus) que si ses fichiers sont **récents** (moins d'une heure) et **utilisés par aucun produit** de l'organisation | Les identifiants de fichier viennent du navigateur : sans cette règle, on pouvait s'approprier la photo d'un autre plat, ou la faire effacer par un refus volontaire — y compris celle d'une carte en ligne | accepté | 2026-09-23 |
| D-057 | L'échéance du laissez-passer de table est contrôlée **aussi par le serveur web**, à chaque requête ; la signature reste vérifiée par Convex | Une requête Convex mise en cache ne se réévalue pas quand l'heure passe : un laissez-passer expiré aurait continué d'ouvrir la carte tant que rien de ce qu'elle lit ne changeait | accepté | 2026-09-23 |
| D-058 | L'interface n'emploie **que les composants officiels de shadcn/ui** (CLI `shadcn@4.21.0`, preset **Nova**, base **Radix**, police Geist, icônes Lucide, thème `neutral`), sans jeton de couleur ni composant visuel maison. Les assemblages (`FormField`, `PendingButton`, `ResponsiveDialog`, états) ne font que composer ces composants. Sur téléphone : `Sidebar` en tiroir, `Drawer` pour les formulaires et la fiche d'un plat | Demande explicite du propriétaire (2026-09-23) : l'interface précédente, faite de composants maison inspirés de shadcn, ne l'était pas vraiment. Le système maison de `DESIGN.md` §2 et §9 (jetons Pétrole/Grège, typographie Archivo) est **retiré** ; ses règles de conduite (R-D1 à R-D8, états, budget de performance) restent en vigueur. Coût mesuré sur la carte client : plus grand élément 2,08 s au 75ᵉ centile (porte de 2,5 s tenue), mais JavaScript avant interaction ≈ 131 Ko brotli, au-dessus du budget de 120 Ko | accepté | 2026-09-23 |
| D-059 | Logo adopté (2026-09-23) : vagues qui se rejoignent et mot « Joliba », couleur unique **#044E5A**, signature « Le service qui coule de source. ». Les sources PNG sont versionnées (`docs/brand/source/`), la version vectorielle est tracée depuis elles (`public/brand/*.svg`), le favicon reprend les vagues seules en blanc sur un carré de la couleur. Cette couleur devient `--primary` du thème shadcn (clair : `oklch(0.39 0.067 212.7)`, texte blanc à 9,36:1 ; sombre : `oklch(0.716 0.097 213.7)`) | Une couleur de thème est un réglage prévu par shadcn/ui, pas un composant maison (D-058 tient). Les deux fichiers reçus différaient légèrement (#044E5A et #024551) : une seule valeur, celle du logo sans signature | accepté | 2026-09-23 |
| D-060 | **PIN de service** (A1, option « nom touché + PIN personnel ») : un membre peut exister **sans compte** (`kind: "pin_only"`), créé par un gérant. Le PIN (4 chiffres, liste de codes interdits, **aucun contrôle d'unicité**) n'est valable que sur un **appareil enrôlé** ; stocké en HMAC-SHA256 avec un secret serveur ; choisi par l'employé via un code d'activation (8 caractères, 24 h, usage unique), jamais connu du gérant. Verrous : 5 échecs/15 min par membre (tous appareils), 10 échecs ⇒ désactivé, 15 échecs/h par appareil ⇒ suspension et alerte. Trois types d'appareils : `kds` (**aucun PIN**, gestes rattachés à l'appareil et au poste), `shared` (verrou après 60 s d'inactivité), `personal`. Droits sous PIN = rôle ∩ `pinAllowed` : jamais une permission sensible, d'équipe, d'export ou de réglage ; ces gestes passent par une **demande d'approbation sur le téléphone du gérant**, jamais par son PIN tapé sur un appareil partagé. Chaque geste de service est rattaché à un **membre**, un **appareil** et une **session d'opérateur**. Prototype d'un jour : jeton JWT ES256 (`customJwt`) à côté de Better Auth ; repli : jeton d'appareil passé en argument. | RQ1 : un serveur sans e-mail consulté ne peut pas travailler avec l'OTP seul. L'unicité des PIN (Square, Toast) révèle le code d'un collègue et rend une tentative au hasard valable contre n'importe qui. Toast reconnaît lui-même le vol du code gérant. Question déléguée par l'utilisateur à un contradicteur, feu vert donné | accepté | 2026-09-23 |
| D-061 | **Mode de service par défaut : `staff_only`**, avec un **panier à montrer** : le client compose sur son téléphone, rien ne part, l'écran dit « Rien n'est commandé. Montrez cet écran à votre serveur. » ; le serveur l'importe d'un geste dans sa propre saisie (commande `staff`), sans état en attente. `guest_with_approval` n'est qu'un réglage, avec trois garde-fous (message permanent « pas encore en cuisine », alerte à toute la zone à 90 s, expiration à 10 min). `guest_direct` et `hybrid` sont **refusés côté serveur** jusqu'en T4, puis seulement avec un QR non « sans friction ». Porte de sortie de T2 mesurée : saisir 6 articles ne doit pas être plus lent que le carnet | La commande qui dort en attente de validation est le pire des deux mondes : le client croit avoir commandé, le serveur a une corvée de plus. `guest_direct` avec le QR sans friction permet de commander depuis la rue avec une photo. Corrige PRODUCT.md §2, qui donnait `guest_with_approval` comme défaut contre le code | accepté | 2026-09-23 |
| D-062 | **Hors-ligne « V1+ »** : file d'écriture persistante en IndexedDB, une opération à la fois par appareil, `opId` = clé d'idempotence, **`clientRef`** sur toute entité créée par le client ; « envoyé » n'apparaît qu'après confirmation du serveur, « la cuisine ne l'a PAS reçue — annoncez-la » après 45 s ; au-delà de 3 min, « Service dégradé » avec bon à montrer ; au retour, rien de plus de 3 min ne repart seul en cuisine (liste « À régulariser ») ; refus au-delà de 6 h ; l'état du serveur gagne ; mesure des coupures par appareil ; tablette cuisine en 4G sur batterie. Aucun encaissement ni clôture hors ligne | La file de Convex vit en mémoire et ne survit pas au rechargement. Au retour du réseau, renvoyer en cuisine une commande déjà cuisinée sur papier, c'est produire deux fois. Voie 2 seulement si les coupures générales de plus de 20 min sont hebdomadaires sur quatre semaines | accepté | 2026-09-23 |
| D-063 | **Aucune ligne de code fiscal** avant la lecture de la procédure API de la DGI. Le propriétaire mène en parallèle l'agrément (entité ivoirienne avec NCC) et un intégrateur agréé ; le produit reste **« non fiscal »** en attendant (ticket « Document interne — ne vaut pas reçu fiscal »). La question bloquante est d'abord : **l'API peut-elle émettre des RNE** (reçus B2C) ? Le schéma `bills` se prépare sans rien promettre : pièce immuable après émission, avoirs liés (`kind`, `correctsBillId`), numérotation sans trou par établissement et année fiscale, `by_venue_reference` au lieu d'un index global, instantané **typé** (plus de `v.any()`), identité légale du vendeur (raison sociale, NCC, RCCM, régime) | Lettre DGI n°0008 du 28/11/2025 : l'agrément vise un logiciel précis (quatre éditeurs), avec un seul fournisseur de TERNE. Amendes par pièce non conforme depuis le 1er septembre 2026. Un index global de références permettrait une page de « vérification » qui pourrait passer pour une contrefaçon du contrôle de la DGI | accepté | 2026-09-23 |
| D-064 | La clé d'idempotence d'une commande est unique **par établissement** (`by_venue_idempotency`), jamais globalement | Un index global aurait laissé un locataire lire l'existence d'une clé d'un autre, ou la bloquer | accepté | 2026-09-23 |
| D-065 | Un bon porté à table passe à l'état **`served`**, et toute avance d'un bon passe par une seule fonction idempotente (`advanceTicket`) : rejouer un geste déjà appliqué ne fait rien, un geste impossible depuis l'état réel est refusé en nommant cet état. Un « rappel » ne touche pas les lignes déjà servies | L'index par statut ne garde ainsi en « prêt » que ce qui attend vraiment ; et le rejeu d'une file hors ligne (D-062) ne doit jamais lever sur un double appui | accepté | 2026-09-23 |
