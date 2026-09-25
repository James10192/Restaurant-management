# Stratégie SEO — Joliba (Restaurant OS)

> Livrable **R5** du plan de conception (§62, §63, §64, §122).
> Rédigé le **2026-09-17**. Toutes les règles techniques ci-dessous ont été vérifiées
> le jour même sur les sources officielles (Google Search Central, Schema.org,
> documentation TanStack). Chaque affirmation technique porte sa source.
> Rien n'est repris de mémoire.

**Positionnement produit retenu pour le SEO** : Joliba n'est pas « un générateur de
menu QR ». C'est un **Restaurant OS** — commande à table, KDS, caisse, encaissement Mobile
Money, stock, analytics — dont le QR n'est que la porte d'entrée côté client. Cette
distinction commande toute l'architecture éditoriale : on capte sur la requête d'entrée
(« menu QR »), on convertit sur la requête de fond (« logiciel de gestion restaurant »,
« caisse restaurant Mobile Money »).

**Marchés** : Côte d'Ivoire → Sénégal → Bénin → Cameroun, puis international.

---

## 0. Méthode, et ce que je n'ai PAS pu vérifier

### Ce qui a été fait

- Interrogation réelle des moteurs sur chaque groupe de requêtes, et lecture des pages
  qui se classent. Les concurrents nommés en §1 ont été **effectivement vus dans les
  résultats**, pas déduits.
- Lecture directe de la documentation officielle pour chaque règle technique (liste des
  sources en §10).

### Ce que je n'ai PAS pu vérifier — à ne pas contourner par de l'invention

| Point | Pourquoi | Ce qu'il faut faire |
|---|---|---|
| **Volumes de recherche mensuels** | Aucune source publique fiable. Keyword Planner exige un compte Google Ads actif avec dépense (sinon les volumes sont donnés en fourchettes larges et inutilisables). Les chiffres des outils tiers (Ahrefs/Semrush) sont des estimations modélisées, et leur couverture de la Côte d'Ivoire, du Sénégal, du Bénin et du Cameroun est notoirement faible. | **Aucun volume n'est écrit dans ce document.** Les priorités sont classées par *valeur business* et *difficulté observée sur le SERP*, pas par volume. Ouvrir un compte Google Ads avec une dépense minimale et relever les volumes réels par pays avant d'arbitrer le budget éditorial. Croiser avec Google Trends (comparatif, pas absolu) et surtout avec les requêtes réelles de la Search Console une fois le site en ligne. |
| **Positions et parts de trafic des concurrents** | Non mesurables sans outil de suivi de position payant, et les positions varient par pays/appareil/personnalisation. | Ne jamais affirmer « X est en position 3 ». Ce document dit seulement « X apparaît dans les résultats », ce qui est vérifié. |
| **Difficulté de mot-clé chiffrée (KD)** | C'est une métrique propriétaire d'outils tiers, pas une donnée. | La colonne « difficulté » ci-dessous est une **appréciation qualitative** fondée sur ce que j'ai vu : nature des sites classés (éditeurs SaaS établis vs annuaires vs rien), profondeur du contenu, présence d'agrégateurs. C'est indiqué comme tel. |
| **Le comportement exact de Googlebot sur nos futures pages** | Non prédictible. | Mesurer en Search Console (§9), pas supposer. |

### Règle de conduite pour la suite

§63 impose : *« Toujours privilégier valeur réelle > contenu SEO artificiel »*. Ce n'est pas
qu'un principe interne — c'est aussi la politique de Google, qui qualifie de **spam** la
production de pages en série sans valeur ajoutée :

> « Scaled content abuse is when many pages are generated for the primary purpose of
> manipulating search rankings and not helping users. » — [Google Search Central, Spam
> policies](https://developers.google.com/search/docs/essentials/spam-policies) (mis à
> jour 2026-08-28, consulté le 2026-09-17)

Et le cadre d'évaluation officiel est **E-E-A-T** — *Experience, Expertise,
Authoritativeness, Trustworthiness* — dont Google précise que « **trust is most
important** » ([Creating helpful, reliable, people-first
content](https://developers.google.com/search/docs/fundamentals/creating-helpful-content),
consulté le 2026-09-17).

Conséquence opérationnelle pour nous : **le contenu doit venir du terrain**. Le guide
d'entretiens (livrable R7) n'est pas seulement de la recherche produit, c'est la matière
première SEO. Un article « Comment rapprocher ses encaissements Wave en fin de service »
écrit après avoir regardé faire trois caissiers à Abidjan bat n'importe quel article
généré. C'est notre seul avantage défendable contre les éditeurs français qui écrivent sur
la restauration depuis Paris.

---

## 1. Recherche de mots-clés (§63)

### 1.1 Lecture d'ensemble du paysage

Trois constats, tirés de l'observation directe des résultats :

**Constat A — Le marché « menu QR » est saturé et commoditisé, en français comme en
anglais.** Sur `menu QR restaurant` et ses variantes, les résultats sont occupés par des
générateurs de QR et des éditeurs de menus digitaux : MyDigiMenu, iMenuPro, MustHaveMenus,
OddMenu, FineDine, The QR Code Generator, QRCodeKIT, TableQR côté anglophone ; ID Menu,
Karta, doXmenu, Foodiv, Collectly, Qoul, MenuForma, LaBigCom côté français. Le contenu
comparatif (« les 9 meilleurs », « 22 plateformes à tester ») est déjà écrit et rafraîchi
chaque année. **Se battre frontalement là-dessus, c'est perdre.**

**Constat B — Le marché « logiciel de gestion restaurant » est tenu par des médias et des
comparateurs, pas par des produits.** Sur `logiciel gestion restaurant`, ce qui se classe
ce sont Skello, Combo, Factorial, Agendrix, CoverManager, Komia, Zenchef — c'est-à-dire des
éditeurs RH/réservation qui font du contenu, et des blogs comparatifs. Ce sont des sites à
autorité établie qui publient depuis des années. Difficulté très élevée sur la requête
générique ; opportunité réelle sur la longue traîne opérationnelle.

**Constat C — et c'est là que se trouve notre marché — le terrain africain francophone est
disputé par des acteurs locaux, mais le contenu éditorial y est quasi inexistant.** Sur les
requêtes CI/SN, j'ai effectivement vu : **Zeat** (`zeatapp.com`, positionné exactement sur
« menu QR + paiement Wave » en CI), **KiboERP** (caisse restaurant Mobile Money +
SYSCOHADA), **ZYVO**, **Caisseweb**, **mybe**, **digabloPos**, **Moo Sync**, **Sekoya
Group**, **Akwabax ERP**, **Avobi** ; et au Sénégal **Baol Caisse**, **DakarApps
E-Restaurant**, **Yorine**, **Kolonell**, **PayTech**, **Change.sn**. Surtout : sur la
requête `maquis`, tout un écosystème dédié existe — **e-maquis.com**, **maquisapp.com**,
**maquisbar.ci**, `maquisbar.joobazar.com`.

Ce constat C est le plus important du document, et il coupe dans les deux sens :

- **Mauvaise nouvelle** : il n'y a pas de « désert concurrentiel africain ». Des produits
  locaux existent déjà, certains avec un positionnement SEO propre (Zeat cible littéralement
  notre requête cœur).
- **Bonne nouvelle** : ces acteurs font surtout des **pages produit**, très peu de **contenu
  de fond**. Sur `digitalisation restaurant Bénin`, `POS restaurant Cameroun`,
  `gestion maquis Cotonou`, les résultats retombent immédiatement sur des annuaires
  (Petit Futé, GoAfricaOnline), de la presse (Agence Ecofin, Digital Business Africa) et
  Wikipédia. **Il n'y a personne qui écrit sérieusement pour ces gérants.** C'est là qu'on
  entre.

### 1.2 Groupes de requêtes

Légende difficulté : **Faible** = résultats non pertinents ou annuaires ; **Moyenne** =
quelques acteurs spécialisés, contenu superficiel ; **Élevée** = éditeurs SaaS établis ;
**Très élevée** = médias à forte autorité + comparateurs rafraîchis annuellement.

#### Groupe 1 — Entrée « menu QR / menu digital » (générique, international)

`menu QR restaurant` · `menu digital restaurant` · `carte digitale restaurant` ·
`créer menu QR code gratuit` · `QR code menu restaurant`

| | |
|---|---|
| **Intention** | Majoritairement **transactionnelle outil** (« je veux générer un QR maintenant, gratuitement »), avec une frange informationnelle (« comment ça marche »). |
| **Qui se classe** | Générateurs de QR gratuits et éditeurs de menus : MyDigiMenu, iMenuPro, MustHaveMenus, OddMenu, TableQR, The QR Code Generator, QRCodeKIT ; en français ID Menu, Karta, doXmenu, LaBigCom. Beaucoup de pages « outil », peu de profondeur. |
| **Difficulté** | **Très élevée** en générique. Le mot-clé est aussi un marché de freemium agressif : la requête attire des gens qui cherchent **gratuit**. |
| **Valeur business** | **Faible à moyenne, et trompeuse.** Le trafic est volumineux mais l'intention est « outil jetable gratuit », pas « je change mon système d'exploitation de salle ». Un restaurant qui cherche un générateur de QR gratuit n'achète pas un Restaurant OS. **Ne pas construire la stratégie là-dessus.** |
| **Décision** | On prend cette requête **uniquement en local** (voir Groupe 5) et **uniquement en angle « et après ? »** : « Le menu QR ne suffit pas — voici ce qui manque ». C'est notre angle différenciant : on est les seuls à avoir intérêt à dire que le menu QR seul est insuffisant. |

#### Groupe 2 — Commande à table / commande QR (le vrai cœur d'entrée)

`commande à table QR code` · `commande QR restaurant` · `commander sans application
restaurant` · `prise de commande QR code bar` · `paiement à table smartphone`

| | |
|---|---|
| **Intention** | **Commerciale** — le gérant compare des solutions, il a dépassé le stade du menu statique. |
| **Qui se classe** | Acteurs spécialisés avec vraies fiches produit : Lightspeed (blog), Tickeat, QR2App, Resmio, AltTab, Feedup, Deliver by Linkeo, QRCode Tiger. Contenu plus étoffé que le groupe 1, mais essentiellement franco-belge. |
| **Difficulté** | **Élevée** en FR générique (Lightspeed a une autorité massive). **Moyenne** dès qu'on ajoute un modificateur métier (« sans application », « synchronisée en cuisine », « avec Mobile Money »). |
| **Valeur business** | **Élevée.** L'intention est déjà qualifiée : ce gérant veut que la commande arrive en cuisine, pas juste afficher une carte. C'est exactement notre produit. |
| **Décision** | **Cluster pilier n°1.** On attaque par les modificateurs, pas par le générique. |

#### Groupe 3 — Logiciel de gestion / caisse restaurant (fond de panier)

`logiciel restaurant` · `logiciel gestion restaurant` · `logiciel caisse restaurant` ·
`POS restaurant` · `caisse enregistreuse restaurant`

| | |
|---|---|
| **Intention** | **Commerciale** haute, mais très large — du gérant de food-truck au groupe multi-sites. |
| **Qui se classe** | En FR : Skello, Combo, Factorial, Agendrix, CoverManager, Komia, Zenchef, Asterio, Sage — c'est-à-dire **des médias d'éditeurs**, pas des pages produit. Le SERP est un SERP de comparatifs (« TOP 15 », « 19 meilleurs », « 12 logiciels gratuits »). |
| **Difficulté** | **Très élevée.** Ces sites publient depuis des années, ont des backlinks, et rafraîchissent le millésime chaque année. Une nouvelle marque n'y entre pas en 12 mois. |
| **Valeur business** | **Très élevée si on convertit, quasi nulle si on ne se classe pas.** Le trafic générique est aussi largement français/européen, donc hors de notre marché initial. |
| **Décision** | **Ne pas attaquer le générique.** On cible la **variante géolocalisée** (Groupe 5) où le SERP est faible, et la **longue traîne opérationnelle** (Groupe 4) où le SERP est vide. Le générique redeviendra atteignable dans 18–24 mois, avec de l'autorité accumulée. |

#### Groupe 4 — Opérations : KDS, stock, food cost, personnel

`KDS restaurant` · `écran cuisine restaurant` · `kitchen display system` ·
`gestion stock restaurant` · `food cost restaurant` · `calcul coût matière restauration` ·
`fiche technique cuisine`

| | |
|---|---|
| **Intention** | **Informationnelle → commerciale.** Le gérant cherche d'abord à comprendre un concept métier (« c'est quoi un food cost sain ? »), puis un outil. |
| **Qui se classe** | Sur KDS : Toast, Oracle, Lightspeed, PAR, GoTab, Crunchtime, WebstaurantStore — **anglophone et très fort**. Sur food cost/stock en FR : Inpulse, Koust, Adoria, Komia, CosKitchen, RestoMaestro, Coopeo, digabloPos — spécialistes établis, contenu calculatoire de qualité. |
| **Difficulté** | KDS anglophone : **très élevée**. Food cost FR : **élevée**. Food cost **contextualisé Afrique de l'Ouest** (prix en FCFA, attiéké, achat au marché de gros, absence de facture fournisseur) : **faible** — personne ne l'écrit. |
| **Valeur business** | **Moyenne à élevée.** C'est le contenu qui prouve qu'on est un Restaurant OS et pas un gadget QR. Il ne convertit pas immédiatement mais il construit l'autorité thématique et il nourrit le cycle de vente long (multi-sites). |
| **Décision** | **Cluster pilier n°3**, mais **systématiquement re-contextualisé** : « food cost quand on achète au marché sans facture », « KDS dans une cuisine sans climatisation ni réseau fiable ». Jamais de traduction d'article américain. |

#### Groupe 5 — Géolocalisé Afrique francophone (notre terrain)

`logiciel restaurant Côte d'Ivoire` · `logiciel caisse restaurant Abidjan` ·
`menu QR Côte d'Ivoire` · `menu digital Abidjan` · `logiciel restaurant Sénégal` ·
`caisse restaurant Dakar` · `logiciel restaurant Bénin` · `gestion restaurant Cotonou` ·
`logiciel restaurant Cameroun` · `POS restaurant Douala` · `gestion maquis` ·
`logiciel maquis Abidjan`

| | |
|---|---|
| **Intention** | **Transactionnelle.** Quelqu'un qui tape « logiciel caisse restaurant Abidjan » veut acheter, et veut quelqu'un de joignable localement. |
| **Qui se classe** | **CI** : Zeat, KiboERP, ZYVO, Caisseweb, mybe, digabloPos, Moo Sync, Akwabax, Avobi, Sekoya Group, et l'écosystème maquis (e-maquis, MaquisApp, MaquisBar). **SN** : Baol Caisse, DakarApps, Yorine, Kolonell. **BJ / CM** : quasi rien de spécialisé — le SERP retombe sur Petit Futé, GoAfricaOnline, Agence Ecofin, Digital Business Africa, Wikipédia. |
| **Difficulté** | **Moyenne en CI** (acteurs installés, mais pages produit minces, peu de contenu de fond). **Faible au Sénégal**, **très faible au Bénin et au Cameroun**. |
| **Valeur business** | **Maximale.** C'est la seule zone où l'on peut se classer vite *et* où l'intention est d'achat *et* où notre différenciateur (Mobile Money, SYSCOHADA, hors-ligne) est décisif. |
| **Décision** | **Priorité n°1 absolue.** Mais attention : §62 interdit de fabriquer 500 pages locales creuses. Voir §3.3 pour la règle de création de pages géographiques. |

#### Groupe 6 — Encaissement & Mobile Money (le différenciateur)

`encaisser Mobile Money restaurant` · `paiement Wave restaurant` ·
`caisse Orange Money commerçant` · `rapprochement encaissements Mobile Money` ·
`QR code marchand Wave` · `MTN MoMo restaurant` · `caisse SYSCOHADA restaurant`

| | |
|---|---|
| **Intention** | **Informationnelle à forte douleur, puis transactionnelle.** Le problème réel du gérant n'est pas « accepter Wave » — les opérateurs le font déjà — c'est **rapprocher** ce qui est tombé sur le téléphone du patron avec ce qui a été vendu en salle. |
| **Qui se classe** | Kkiapay, PayTech, Orange Business CI, Change.sn, Yorine, Facturaal, Kolonell, Sentur, Absitech, Riverpe. Beaucoup d'agrégateurs de paiement et de blogs techniques ; **presque aucun contenu écrit du point de vue du restaurateur**. |
| **Difficulté** | **Faible à moyenne.** Les agrégateurs écrivent pour des développeurs ou pour « le commerçant » en général, pas pour la salle d'un restaurant. |
| **Valeur business** | **Très élevée.** C'est le point de douleur qui justifie l'abonnement, et c'est sur ce terrain que les éditeurs français (Lightspeed, Tickeat, Zenchef) sont structurellement absents. **C'est notre fossé.** |
| **Décision** | **Cluster pilier n°2.** À traiter avec le plus grand sérieux : chiffres réels, captures d'écran réelles, procédure de fin de service réelle. |

#### Groupe 7 — Douleurs de gestion (le contenu qui vient du terrain)

`vol en caisse restaurant` · `écart de caisse maquis` · `gérer ses serveurs restaurant` ·
`fin de service caisse` · `rentabilité restaurant Afrique` · `ouvrir un restaurant Abidjan`

| | |
|---|---|
| **Intention** | **Informationnelle**, très haute charge émotionnelle. |
| **Qui se classe** | Sur `vol caisse maquis`, ce sont les **pages produit des concurrents locaux qui répondent** (MaquisBar, MaquisApp mettent en avant des témoignages du type « je perdais l'équivalent de 3 casiers par semaine »). Aucun contenu éditorial de fond. |
| **Difficulté** | **Faible.** |
| **Valeur business** | **Élevée** en haut de tunnel : c'est la requête que tape un gérant à 23h après avoir compté sa caisse. |
| **Décision** | **Cluster pilier n°5.** Contenu à écrire *après* les entretiens terrain (R7), jamais avant — sinon on produit exactement le « contenu SEO artificiel » que §63 interdit. |

#### Groupe 8 — Marque & alternatives (défensif, plus tard)

`Joliba avis` · `alternative Zeat` · `Zeat vs Joliba` ·
`alternative Toast Afrique`

| | |
|---|---|
| **Intention** | **Transactionnelle**, fond de tunnel. |
| **Difficulté** | Faible techniquement, mais **nulle utilité tant que la marque n'existe pas**. |
| **Valeur business** | Élevée plus tard. |
| **Décision** | **Différé**. Les pages « alternative à X » ne se publient qu'une fois qu'on a une base de clients et des comparaisons honnêtes à faire. Publier des comparatifs à charge sans clients est à la fois inefficace et risqué en image. |

### 1.3 Arbitrage final

| Priorité | Groupe | Pourquoi |
|---|---|---|
| **P0** | 5 (géolocalisé) + 6 (Mobile Money) | Seule zone où SERP faible × intention d'achat × différenciateur produit se rencontrent. |
| **P1** | 2 (commande à table) + 7 (douleurs) | Intention qualifiée, difficulté surmontable par l'angle local. |
| **P2** | 4 (opérations : KDS, food cost, stock) | Construit l'autorité « OS » et non « gadget ». Long terme. |
| **P3** | 1 (menu QR générique) | Uniquement en angle « et après ? ». Jamais en frontal. |
| **P4** | 3 (logiciel gestion générique) | Inatteignable à 12 mois. À rouvrir à 18–24 mois. |
| **Différé** | 8 (marque/alternatives) | Rien à dire tant qu'il n'y a pas de clients. |

---

## 2. Clusters de contenu

Modèle **pilier → satellites**. Chaque pilier est une page longue, mise à jour, qui vise la
requête de tête du cluster ; chaque satellite traite une sous-question et **renvoie vers le
pilier et vers une page produit précise**. Le maillage interne est explicite dans les
tableaux — il n'est pas laissé à l'improvisation de la rédaction.

Règle transverse (§63) : **un article ne part pas en rédaction tant qu'on n'a pas une
source de première main** — un entretien (R7), une capture d'écran d'un vrai service, une
donnée mesurée chez un client pilote. Sinon l'article est reporté, pas écrit « en
attendant ».

### Cluster 1 — « Encaisser et rapprocher au restaurant en Afrique de l'Ouest » ⭐ P0

*Pilier* : `/guides/encaissement-mobile-money-restaurant`
*Requête de tête* : `encaisser Mobile Money restaurant` · *Intention* : informationnelle → commerciale

| Article satellite | Intention | Angle | Mots-clés | Maille vers |
|---|---|---|---|---|
| Rapprocher ses encaissements Wave et Orange Money en fin de service | Informationnelle | La procédure réelle, minute par minute, du moment où le serveur encaisse au moment où le patron ferme la caisse. Montrer le tableau papier que les gérants utilisent aujourd'hui, puis ce qu'on remplace. | rapprochement encaissements Mobile Money, fin de service caisse | Pilier + `/fonctionnalites/caisse` |
| QR marchand Wave vs encaissement intégré à la caisse : ce qui change vraiment | Commerciale | Distinguer honnêtement : le QR marchand de l'opérateur *fonctionne*. Ce qu'il ne fait pas, c'est relier le paiement à la table et à la commande. | QR code marchand Wave, paiement Wave restaurant | Pilier + `/fonctionnalites/paiements` |
| Pourquoi votre caisse ne tombe jamais juste (et les 6 fuites classiques) | Informationnelle | Typologie des écarts : commande non saisie, remise sauvage, annulation après encaissement, paiement mobile sur le téléphone personnel, avance sur salaire, casse non déclarée. | écart de caisse restaurant, vol en caisse | Pilier + `/fonctionnalites/caisse` |
| Espèces, Wave, Orange Money, MTN MoMo, carte : construire un plan de caisse qui tient | Informationnelle | Le plan de caisse multi-moyens et sa réconciliation. | caisse multi moyens de paiement, gestion point de vente Mobile Money | Pilier + `/fonctionnalites/caisse` |
| Tenir une comptabilité SYSCOHADA quand 70 % des recettes arrivent par mobile | Informationnelle | Le pont entre encaissement réel et écriture comptable. **À faire relire par un expert-comptable OHADA** — sujet à risque, on n'improvise pas. | caisse SYSCOHADA restaurant, comptabilité restaurant OHADA | Pilier + `/fonctionnalites/rapports` |
| Ce que coûte réellement un encaissement mobile (et comment le répercuter, ou pas) | Commerciale | Frais opérateur, arbitrage prix affiché / prix payé. **Aucun chiffre de frais ne sera publié sans capture d'écran de la grille tarifaire opérateur datée** — ces grilles changent. | frais Wave commerçant, coût encaissement Mobile Money | Pilier + `/tarifs` |

### Cluster 2 — « Commande à table : de la carte au passe » ⭐ P1

*Pilier* : `/guides/commande-a-table-qr-code`
*Requête de tête* : `commande à table QR code` · *Intention* : commerciale

| Article satellite | Intention | Angle | Mots-clés | Maille vers |
|---|---|---|---|---|
| Le menu QR ne suffit pas : les 5 choses qui manquent encore après le scan | Informationnelle | **Notre article-manifeste.** Écrit contre la catégorie « menu QR » à laquelle on refuse d'appartenir. C'est aussi la seule façon crédible d'entrer sur le Groupe 1. | menu QR restaurant, menu digital restaurant | Pilier + `/` |
| Faut-il laisser le client commander seul ? Les cas où la réponse est non | Informationnelle | Contre-intuitif et honnête : maquis à forte rotation, clientèle âgée, plats à négocier, upsell du serveur. Renforce la confiance (E-E-A-T). | commande autonome restaurant, self-ordering | Pilier + `/solutions/maquis` |
| Réseau instable : comment une commande passe quand la 4G lâche | Informationnelle | File d'attente locale, réconciliation, idempotence — vulgarisé. Contenu que **personne** n'écrit en FR et qui est *le* sujet en Afrique de l'Ouest. | commande hors ligne restaurant, restaurant sans connexion | Pilier + `/fonctionnalites/commande-a-table` |
| Une commande, deux écrans : ce qui se passe entre la table et le passe | Informationnelle | Le trajet technique expliqué simplement ; introduit le KDS. | commande cuisine, écran cuisine restaurant | Pilier + `/fonctionnalites/kds` |
| Partager l'addition à 8 autour d'un plat commun | Informationnelle | Split bill, très concret, culturellement situé (plats partagés). | partage addition restaurant, split bill | Pilier + `/fonctionnalites/paiements` |
| Allergènes et information du consommateur sur un menu numérique | Informationnelle | Obligations d'affichage ; **vérifier le cadre applicable pays par pays avant publication** (voir §2.7). | allergènes menu restaurant, affichage prix restaurant | Pilier + `/fonctionnalites/menu` |

### Cluster 3 — « Piloter les coûts d'un restaurant » (P2)

*Pilier* : `/guides/food-cost-restaurant`
*Requête de tête* : `food cost restaurant` · *Intention* : informationnelle

| Article satellite | Intention | Angle | Mots-clés | Maille vers |
|---|---|---|---|---|
| Calculer son food cost quand on achète au marché sans facture | Informationnelle | **L'angle qui n'existe nulle part.** Tous les articles FR supposent une facture fournisseur dématérialisée. Ici : achat en gros au marché, prix qui bouge chaque semaine, pas de justificatif. | calcul coût matière, food cost sans facture | Pilier + `/fonctionnalites/stock` |
| Fiche technique d'un plat : la faire une fois, s'en servir tous les jours | Informationnelle | Méthode + gabarit téléchargeable (aimant à lien). | fiche technique cuisine, recette coût | Pilier + `/fonctionnalites/stock` |
| Quel food cost viser selon le type d'établissement | Informationnelle | Fourchettes par format. **Toute fourchette publiée doit citer sa source ou être présentée comme issue de nos propres clients, avec l'échantillon annoncé.** | food cost moyen restaurant, marge brute restauration | Pilier + `/fonctionnalites/rapports` |
| Casse, offerts, repas du personnel : les sorties qu'on oublie de compter | Informationnelle | Les fuites hors vente. | pertes restaurant, gestion casse | Pilier + `/fonctionnalites/stock` |
| Lire son chiffre d'affaires autrement que « c'était une bonne soirée » | Informationnelle | Ticket moyen, rotation de table, heure de pointe, mix produit. | analyse ventes restaurant, ticket moyen | Pilier + `/fonctionnalites/rapports` |

### Cluster 4 — « Équiper son établissement » (P0/P1, pivot commercial local)

*Pilier* : `/guides/choisir-logiciel-restaurant-afrique`
*Requête de tête* : `logiciel gestion restaurant` (variante locale) · *Intention* : commerciale

| Article satellite | Intention | Angle | Mots-clés | Maille vers |
|---|---|---|---|---|
| Choisir un logiciel de caisse en Côte d'Ivoire : la grille de questions à poser | Commerciale | Grille d'évaluation neutre et réutilisable (Mobile Money, hors-ligne, SYSCOHADA, support local, matériel, sortie de données). Doit rester **utile même si on n'est pas retenu** — c'est ce qui la rend citable. | logiciel caisse restaurant Côte d'Ivoire | Pilier + `/solutions/cote-divoire` |
| Faut-il une caisse tactile, une tablette, ou juste des téléphones ? | Commerciale | Arbitrage matériel réaliste (coût, poussière, coupures, vol). | caisse enregistreuse restaurant, matériel POS | Pilier + `/tarifs` |
| Migrer depuis un cahier ou un fichier Excel sans perdre trois semaines | Informationnelle | Plan de reprise concret. Cible la majorité réelle du marché : ceux qui n'ont **aucun** logiciel. | passer du cahier au logiciel, digitalisation restaurant | Pilier + `/demo` |
| Combien coûte vraiment un logiciel de restaurant (et ce qu'on paie sans le voir) | Commerciale | Coût total : abonnement, matériel, frais de transaction, formation, temps. Transparence = conversion. | prix logiciel restaurant, tarif caisse restaurant | Pilier + `/tarifs` |
| Former une équipe qui n'a jamais utilisé de logiciel | Informationnelle | Adoption, pas technique. Sujet décisif et jamais traité. | formation personnel restaurant, adoption logiciel | Pilier + `/solutions/*` |

### Cluster 5 — « Tenir son établissement » (P1, haut de tunnel émotionnel)

*Pilier* : `/guides/gestion-maquis-restaurant`
*Requête de tête* : `gestion maquis` · *Intention* : informationnelle

| Article satellite | Intention | Angle | Mots-clés | Maille vers |
|---|---|---|---|---|
| Ouvrir un maquis à Abidjan : ce que personne ne vous dit sur la gestion | Informationnelle | Contenu de fond issu des entretiens. Pas un article « business plan » générique. | ouvrir un maquis, ouvrir restaurant Abidjan | Pilier + `/solutions/maquis` |
| Organiser le service quand chaque serveur encaisse lui-même | Informationnelle | Le modèle dominant localement, et ses conséquences. | gestion serveurs restaurant, responsabilité caisse serveur | Pilier + `/fonctionnalites/caisse` |
| Fermer sa caisse en 10 minutes au lieu de 2 heures | Informationnelle | Procédure de clôture. Angle « temps rendu », le plus parlant. | clôture caisse restaurant, fin de service | Pilier + `/fonctionnalites/caisse` |
| Gérer plusieurs établissements sans passer sa vie en voiture | Commerciale | Multi-sites — segment le plus rentable. | gestion multi établissements restaurant | Pilier + `/solutions/groupes` |

### Cluster 6 — « Le passe et la cuisine » (P2)

*Pilier* : `/guides/kds-ecran-cuisine`
*Requête de tête* : `KDS restaurant` / `écran cuisine restaurant` · *Intention* : informationnelle → commerciale

| Article satellite | Intention | Angle | Mots-clés | Maille vers |
|---|---|---|---|---|
| Remplacer les tickets papier en cuisine : ce qu'on gagne, ce qu'on perd | Informationnelle | Honnête sur les pertes (le papier ne tombe jamais en panne). | KDS restaurant, écran cuisine | Pilier + `/fonctionnalites/kds` |
| Organiser plusieurs postes : grill, froid, bar, sur un ou plusieurs écrans | Informationnelle | Routage par poste. | routage commande cuisine, poste de préparation | Pilier + `/fonctionnalites/kds` |
| Un écran de cuisine qui survit à la chaleur, à la graisse et aux coupures | Informationnelle | Contrainte matérielle réelle, jamais traitée par les éditeurs occidentaux. | matériel cuisine écran, tablette cuisine restaurant | Pilier + `/fonctionnalites/kds` |
| Mesurer le temps de préparation sans stresser la brigade | Informationnelle | Métrique + éthique managériale. | temps préparation cuisine, performance cuisine | Pilier + `/fonctionnalites/rapports` |

### Cluster 7 — « Marchés » (pages pays, P0 — sous conditions strictes)

*Pilier* : `/solutions/afrique-de-louest`
Ce cluster est **commercial, pas éditorial**. Il est traité en §3.3 avec une règle
anti-prolifération. Une page pays n'existe que si elle contient des éléments **réellement
propres au pays** : moyens de paiement disponibles, devise, cadre comptable, références
clients locales, contact local, tarification locale. Sinon elle n'est pas créée.

### 2.7 Ce qu'il ne faut pas écrire avant vérification

Trois sujets sont tentants en SEO et dangereux en contenu :

1. **Obligations légales d'affichage** (allergènes, prix, facture normalisée, TVA). Le cadre
   diffère par pays et évolue. Chaque article de cette famille doit citer le texte
   applicable, daté, et être relu. En cas de doute, **ne pas publier**.
2. **Chiffres de marché** (« 70 % des transactions passent par Wave »). Ces chiffres
   circulent dans des blogs qui se citent les uns les autres. Ne publier qu'avec une source
   primaire (régulateur, opérateur, institution) datée.
3. **Comparatifs nommant des concurrents.** À réserver au moment où l'on peut comparer
   honnêtement, fonctionnalité par fonctionnalité, avec une date de relevé.

---

## 3. Sitemap marketing

### 3.1 Critique de la liste proposée (§56)

Liste au brief : `/`, `/fonctionnalites/*`, `/solutions/*`, `/tarifs`, `/demo`, `/contact`,
`/ressources`, `/blog`, `/guides`, `/securite`, `/confidentialite`, `/conditions`,
`/cookies`.

**Ce qui est bon et que je garde tel quel** : l'éclatement `/fonctionnalites/*` (une page
par capacité = une page par intention de recherche, c'est le bon découpage), la séparation
`/blog` (daté, périssable) / `/guides` (intemporel, mis à jour) qui est exactement la
distinction satellite/pilier du §2, et la présence de `/securite` en page publique — rare,
et décisif en vente B2B quand on manipule des paiements.

**Cinq problèmes.**

**(a) `/ressources` fait doublon avec `/blog` + `/guides` et dilue.** Trois hubs de contenu
pour un site jeune, c'est deux de trop : l'autorité se répartit, l'utilisateur ne sait pas
où aller, et Google voit trois pages de listes qui se ressemblent. → **`/ressources` devient
le hub unique**, avec `/blog` et `/guides` comme sous-sections. Une seule porte d'entrée
contenu.

**(b) Il manque la page qui porte la requête la plus qualifiée du marché.** Aucune route ne
cible « logiciel de caisse restaurant à Abidjan ». `/solutions/*` est prévu mais son axe
n'est pas défini. → `/solutions/*` doit couvrir **deux axes distincts** : par **type
d'établissement** (maquis, fast-food, restaurant de table, hôtel, groupe) et par **marché**
(Côte d'Ivoire, Sénégal, Bénin, Cameroun). Ce sont deux intentions différentes, elles ne se
mélangent pas dans la même page.

**(c) Il manque `/integrations/*`.** Wave, Orange Money, MTN MoMo, Moov Money : ce sont des
requêtes de marque à forte intention (« logiciel caisse compatible Wave ») et ce sont nos
pages les plus convertissantes. Leur absence est un trou net.

**(d) Il manque la contrepartie publique du produit.** Le menu public du restaurant client
(§57) n'apparaît nulle part dans le sitemap marketing — normal, il n'y appartient pas. Mais
il faut **décider explicitement où il vit**, et la réponse est : **pas sur le domaine
marketing** (voir §7.4). Il faut aussi une page `/menu-public` côté marketing qui explique
la fonctionnalité et cible « page menu en ligne restaurant ».

**(e) `/cookies` n'a pas besoin d'être une route séparée** si la politique tient dans une
section de `/confidentialite`. Une page juridique quasi vide est une page faible de plus.
→ Garder la route (attendue par les bandeaux de consentement qui pointent vers une URL
dédiée) mais l'assumer comme `noindex` — elle n'a aucune valeur de recherche et n'a pas à
peser dans l'index.

**Deux ajouts de fond** : `/a-propos` (E-E-A-T — Google insiste sur le « who » : *« Is it
self-evident to your visitors who authored your content? »*, [Creating helpful
content](https://developers.google.com/search/docs/fundamentals/creating-helpful-content),
consulté le 2026-09-17) et `/clients` (preuve sociale, requêtes de marque).

### 3.2 Sitemap final

Toutes les URL sont préfixées de la locale (`/fr/…`, `/en/…`) — voir §4.
`MP` = mot-clé principal. Longueurs visées : titre ≤ 60 caractères, description 140–160.

#### Racine et conversion

| Route | Titre SEO | Meta description | MP | Type |
|---|---|---|---|---|
| `/` | Joliba — Le système d'exploitation de votre restaurant | Commande à table, cuisine, caisse et encaissement Mobile Money dans un seul outil. Conçu pour les restaurants d'Afrique de l'Ouest. | logiciel restaurant | Page produit |
| `/tarifs` | Tarifs — Joliba | Des formules en FCFA, sans engagement, matériel inclus selon l'offre. Voyez exactement ce que vous payez, et ce que vous ne payez pas. | prix logiciel restaurant | Page commerciale |
| `/demo` | Demander une démonstration — Joliba | 30 minutes avec quelqu'un qui connaît votre métier. En ligne, ou sur place à Abidjan et Dakar. | démo logiciel restaurant | Conversion |
| `/contact` | Nous contacter — Joliba | Téléphone, WhatsApp, e-mail. Une équipe joignable aux heures où votre restaurant travaille. | contact | Conversion |
| `/a-propos` | Qui nous sommes — Joliba | L'équipe, pourquoi nous construisons un outil pensé ici, et comment nous travaillons avec les restaurants. | à propos | Confiance / E-E-A-T |
| `/clients` | Ils nous font confiance — Joliba | Des restaurants, maquis et groupes qui pilotent leur salle avec Joliba. Chiffres et témoignages réels. | avis logiciel restaurant | Preuve |

#### Fonctionnalités — une page = une intention

| Route | Titre SEO | Meta description | MP | Type |
|---|---|---|---|---|
| `/fonctionnalites/commande-a-table` | Commande à table par QR code — Joliba | Le client scanne, commande, la cuisine reçoit. Sans application à installer, et même quand le réseau faiblit. | commande à table QR code | Page fonctionnalité |
| `/fonctionnalites/menu` | Menu digital et carte en ligne — Joliba | Modifiez un prix, retirez un plat épuisé : la carte est à jour au scan suivant. Photos, allergènes, plusieurs langues. | menu digital restaurant | Page fonctionnalité |
| `/fonctionnalites/menu-public` | Votre page menu publique, visible sur Google — Joliba | Une page menu propre et rapide, indexable si vous le décidez, pour que les clients vous trouvent avant d'entrer. | page menu en ligne restaurant | Page fonctionnalité |
| `/fonctionnalites/kds` | Écran de cuisine (KDS) — Joliba | Les commandes arrivent au passe, classées par poste et par temps. Fini les tickets papier perdus. | écran cuisine restaurant | Page fonctionnalité |
| `/fonctionnalites/caisse` | Caisse et clôture de service — Joliba | Encaissez en espèces ou par mobile, et fermez la caisse en dix minutes avec un écart expliqué. | logiciel caisse restaurant | Page fonctionnalité |
| `/fonctionnalites/paiements` | Paiements et partage d'addition — Joliba | Wave, Orange Money, MTN MoMo, espèces, carte. Chaque paiement rattaché à sa table et à sa commande. | paiement restaurant Mobile Money | Page fonctionnalité |
| `/fonctionnalites/stock` | Stock, fiches techniques et food cost — Joliba | Ce que vous achetez, ce que vous vendez, ce que vous perdez. Et la marge de chaque plat. | gestion stock restaurant | Page fonctionnalité |
| `/fonctionnalites/rapports` | Rapports et pilotage — Joliba | Chiffre d'affaires, ticket moyen, heures de pointe, mix produit. Sur votre téléphone, chaque matin. | rapport ventes restaurant | Page fonctionnalité |
| `/fonctionnalites/equipe` | Équipe, rôles et responsabilités — Joliba | Chaque serveur son compte, chaque rôle ses droits. Vous savez qui a fait quoi. | gestion personnel restaurant | Page fonctionnalité |
| `/fonctionnalites/hors-ligne` | Fonctionne même sans connexion — Joliba | Le service continue quand la 4G tombe. Les commandes se synchronisent dès que le réseau revient. | logiciel restaurant hors ligne | Page fonctionnalité |

#### Solutions — axe « type d'établissement »

| Route | Titre SEO | Meta description | MP | Type |
|---|---|---|---|---|
| `/solutions/maquis` | Logiciel de gestion pour maquis et bars — Joliba | Chaque serveur son compte, chaque table son addition, une caisse qui tombe juste. Pensé pour le rythme d'un maquis. | gestion maquis | Page solution |
| `/solutions/restaurant` | Logiciel pour restaurant de table — Joliba | Du plan de salle au passe en cuisine, jusqu'à l'addition partagée. | logiciel restaurant | Page solution |
| `/solutions/fast-food` | Caisse et commande pour fast-food — Joliba | File rapide, commande sur place ou à emporter, cuisine synchronisée. | logiciel fast food | Page solution |
| `/solutions/hotel` | Restauration d'hôtel — Joliba | Restaurant, bar, room service et facturation à la chambre. | logiciel restauration hôtel | Page solution |
| `/solutions/groupes` | Plusieurs établissements — Joliba | Une vue consolidée, des cartes et des prix par établissement, des droits par site. | gestion multi établissements restaurant | Page solution |

#### Solutions — axe « marché » (règle stricte en §3.3)

| Route | Titre SEO | Meta description | MP | Type |
|---|---|---|---|---|
| `/solutions/cote-divoire` | Logiciel de restaurant en Côte d'Ivoire — Joliba | Wave, Orange Money, Moov Money, MTN MoMo, prix en FCFA, comptabilité SYSCOHADA, équipe à Abidjan. | logiciel restaurant Côte d'Ivoire | Page marché |
| `/solutions/senegal` | Logiciel de restaurant au Sénégal — Joliba | Wave et Orange Money, tarifs en FCFA, accompagnement à Dakar. | logiciel restaurant Sénégal | Page marché |
| `/solutions/benin` | Logiciel de restaurant au Bénin — Joliba | MTN MoMo, Moov Money, Celtiis Cash, prix en FCFA, accompagnement à Cotonou. | logiciel restaurant Bénin | Page marché |
| `/solutions/cameroun` | Logiciel de restaurant au Cameroun — Joliba | MTN MoMo et Orange Money, prix en FCFA, accompagnement à Douala et Yaoundé. | logiciel restaurant Cameroun | Page marché |

#### Intégrations

| Route | Titre SEO | Meta description | MP | Type |
|---|---|---|---|---|
| `/integrations` | Intégrations — Joliba | Moyens de paiement, imprimantes, comptabilité. Ce avec quoi Joliba se connecte. | intégrations logiciel restaurant | Hub |
| `/integrations/wave` | Encaisser par Wave dans votre restaurant — Joliba | Chaque paiement Wave rattaché à sa table et à sa commande, et réconcilié à la clôture. | paiement Wave restaurant | Page intégration |
| `/integrations/orange-money` | Encaisser par Orange Money — Joliba | Le paiement Orange Money relié à la commande, pas juste au téléphone du patron. | Orange Money restaurant | Page intégration |
| `/integrations/mtn-momo` | Encaisser par MTN Mobile Money — Joliba | MTN MoMo rattaché à la table, réconcilié en fin de service. | MTN MoMo restaurant | Page intégration |
| `/integrations/moov-money` | Encaisser par Moov Money — Joliba | Moov Money intégré à la caisse et à la clôture. | Moov Money restaurant | Page intégration |

> Règle : une page `/integrations/<x>` **n'est publiée que si l'intégration existe**. Une
> page « bientôt disponible » est une page faible et une promesse commerciale non tenue.

#### Contenu

| Route | Titre SEO | Meta description | MP | Type |
|---|---|---|---|---|
| `/ressources` | Ressources pour restaurateurs — Joliba | Guides, articles et modèles pour tenir un établissement en Afrique de l'Ouest. | ressources restaurateur | Hub |
| `/guides` | Guides — Joliba | Nos guides de fond : encaissement, food cost, commande à table, gestion d'équipe. | guide gestion restaurant | Index piliers |
| `/guides/<slug>` | *(voir §2)* | *(propre à chaque pilier)* | *(voir §2)* | Pilier |
| `/blog` | Blog — Joliba | Ce que nous apprenons en travaillant avec des restaurants, et ce que nous construisons. | blog restauration | Index articles |
| `/blog/<slug>` | *(propre à l'article)* | *(propre à l'article)* | *(voir §2)* | Satellite |
| `/modeles/<slug>` | *(ex. : Modèle de fiche technique de plat)* | Un gabarit prêt à remplir, en FCFA. Téléchargeable sans inscription. | fiche technique cuisine modèle | Aimant à lien |

`/modeles/*` est ajouté délibérément : les gabarits téléchargeables sont, en B2B, le
contenu qui attire le plus de liens naturels. Les proposer **sans formulaire** est ce qui
les rend citables.

#### Confiance et juridique

| Route | Titre SEO | Meta description | MP | Type | Indexation |
|---|---|---|---|---|---|
| `/securite` | Sécurité et protection des données — Joliba | Où vivent vos données, qui peut y accéder, comment nous les protégeons, et ce qui se passe si vous partez. | sécurité logiciel restaurant | Confiance | Index |
| `/confidentialite` | Politique de confidentialité — Joliba | Les données que nous traitons, pourquoi, combien de temps, et vos droits. | politique confidentialité | Juridique | Index |
| `/conditions` | Conditions générales — Joliba | Les règles du service, votre abonnement, vos obligations et les nôtres. | conditions générales | Juridique | Index |
| `/cookies` | Politique de cookies — Joliba | Les traceurs que nous déposons, à quoi ils servent, et comment les refuser. | politique cookies | Juridique | **noindex, follow** |
| `/statut` | État du service — Joliba | Disponibilité en temps réel et historique des incidents. | statut service | Confiance | **noindex** (souvent sous-domaine tiers) |

### 3.3 Règle anti-prolifération des pages géographiques (§62)

§62 interdit de *« créer 500 pages locales pauvres pour manipuler Google »*. Ce n'est pas
seulement une règle interne : Google qualifie cette pratique de **doorway abuse** —

> « Doorway abuse is when sites or pages are created to rank for specific, similar search
> queries. […] Multiple domain names or pages targeted at specific regions or cities that
> funnel users to one page. » — [Spam
> policies](https://developers.google.com/search/docs/essentials/spam-policies) (consulté
> le 2026-09-17)

Autrement dit, `/logiciel-restaurant-cocody`, `/logiciel-restaurant-yopougon`,
`/logiciel-restaurant-marcory`… qui renvoient tous vers le même formulaire est *exactement*
le cas décrit. Interdit.

**Le test à passer avant de créer une page marché ou ville.** Une page n'existe que si elle
réunit **au moins trois** des éléments suivants, *propres à elle* :

1. des moyens de paiement réellement disponibles et différents ;
2. une devise ou une grille tarifaire différente ;
3. un cadre comptable, fiscal ou réglementaire différent ;
4. au moins deux clients référencés dans ce marché, nommés, avec leur accord ;
5. un contact ou une présence physique locale (numéro, adresse, personne) ;
6. un contenu éditorial propre (au minimum un guide écrit pour ce marché).

Un pays coche facilement 4 à 6 critères → **page légitime**. Une commune d'Abidjan n'en
coche aucun → **page interdite**. La granularité maximale est donc **le pays**, jamais la
ville, tant que nous n'avons pas de bureau, d'équipe ou de portefeuille client dans cette
ville. Le jour où une ville coche trois critères, elle devient légitime — et ce jour-là, ce
n'est plus de la manipulation, c'est une information.

---

## 4. Internationalisation et `hreflang`

### 4.1 Structure d'URL : sous-dossier, et rien d'autre

Google documente trois structures possibles, avec leurs compromis
([Managing multi-regional and multilingual
sites](https://developers.google.com/search/docs/specialty/international/managing-multi-regional-sites),
consulté le 2026-09-17) :

| Structure | Avantages (Google) | Inconvénients (Google) | Notre verdict |
|---|---|---|---|
| ccTLD (`exemple.ci`, `exemple.sn`) | Ciblage géographique clair, emplacement serveur indifférent, séparation nette | « Expensive ; requires more infrastructure ; strict requirements ; targets single country only » | **Non.** Il nous faudrait 4 domaines pour 4 pays qui parlent la même langue et partagent la même devise. Chacun repart de zéro en autorité. Coût maximal, bénéfice nul. |
| Sous-domaine (`ci.exemple.com`) | Facile à mettre en place, serveurs séparables | Ciblage peu lisible pour l'utilisateur | Non — sépare inutilement l'autorité, sans bénéfice ici. |
| **Sous-dossier (`exemple.com/fr/`)** | « Easy setup ; low maintenance » | Ciblage peu lisible, emplacement serveur unique | **Oui.** Toute l'autorité s'accumule sur un domaine. C'est ce que fait notre SSR naturellement. |

**Décision : `exemple.com/fr/…` et `exemple.com/en/…`, préfixe explicite pour les deux
locales.**

Pas de « français sans préfixe à la racine ». C'est tentant (URL plus courtes en français,
notre marché principal) mais cela crée une asymétrie permanente : la racine devient à la
fois la page d'accueil française *et* le point d'entrée neutre, et l'ajout d'une troisième
langue oblige à tout remanier. Le préfixe explicite coûte quelques caractères et règle la
question une fois pour toutes.

### 4.2 Une seule locale française — pas `fr-CI`, `fr-SN`, `fr-BJ`, `fr-CM`

C'est le piège principal de notre configuration, parce que nous ciblons **quatre pays qui
parlent la même langue**.

La tentation est de créer `/fr-ci/`, `/fr-sn/`, `/fr-bj/`, `/fr-cm/` avec `hreflang`
correspondant. **Il ne faut pas**, parce que ces quatre versions auraient un contenu quasi
identique : ce serait quatre fois la même page, et Google le dit clairement pour ce cas —

> « pick a preferred version and use the `rel="canonical"` and `hreflang` tags to make sure
> that the correct language or regional URL is served to searchers. » — [Managing
> multi-regional sites](https://developers.google.com/search/docs/specialty/international/managing-multi-regional-sites)
> (consulté le 2026-09-17)

**Règle retenue : `hreflang="fr"` (langue seule, sans région) pour tout le français, et
`hreflang="en"` pour l'anglais.** La différenciation par pays passe par les **pages
marché** (`/fr/solutions/cote-divoire`, `/fr/solutions/senegal`…), qui sont des pages
*différentes* avec un *contenu différent*, et non par des variantes locales d'une même
page.

Si un jour la tarification diverge réellement par pays (grille en FCFA CFA BCEAO vs XAF
BEAC, par exemple), alors seulement `/fr-cm/tarifs` devient légitime — parce que la page
sera *réellement* différente. La règle est la même qu'en §3.3 : **la variante n'existe que
si le contenu diffère.**

### 4.3 Les règles `hreflang` en vigueur

Source unique : [Tell Google about localized versions of your
page](https://developers.google.com/search/docs/specialty/international/localized-versions)
(consulté le 2026-09-17).

**Trois méthodes, équivalentes du point de vue de Google** : balises `<link>` dans le
`<head>`, en-têtes HTTP `Link:`, ou annotations `xhtml:link` dans le sitemap XML.

**Format des codes.** *« The first code of the `hreflang` attribute is the language code (in
ISO 639-1 format) followed by an optional second code that represents the region code (in
ISO 3166-1 Alpha 2 format). »* Erreur classique citée par Google : utiliser `UK` au lieu de
`GB`.

**Bidirectionnalité — la règle qui casse tout en silence.** *« Each language version must
list itself as well as all other language versions. »* Et si ce n'est pas réciproque :
*« the tags will be ignored »*. Une page `/fr/tarifs` qui pointe vers `/en/pricing` sans que
`/en/pricing` pointe en retour vers `/fr/tarifs` → **l'annotation entière est jetée**, sans
erreur visible. C'est la panne silencieuse numéro un du `hreflang`.

→ Conséquence d'architecture : le jeu de liens alternatifs **ne se code pas page par
page**. Il doit être **généré à partir d'une table de correspondance unique** (voir §4.5),
sinon la réciprocité se casse dès la première page dont le slug diffère entre les langues
(`/fr/tarifs` ↔ `/en/pricing`).

**`x-default`.** Valeur réservée, *« used when no other language/region matches the user's
browser setting »*, et *« designed for language selector pages »*
([localized-versions](https://developers.google.com/search/docs/specialty/international/localized-versions)
et [How x-default can help
you](https://developers.google.com/search/blog/2023/05/x-default), consultés le
2026-09-17).

→ **Décision : `x-default` pointe sur la version française** (`/fr/…`), et non sur une page
de sélection de langue. Justification : notre marché principal est francophone, et une page
de sélection intercalée serait un frein à la conversion pour 95 % de notre audience réelle.
`x-default` est fait pour désigner la page de repli — la nôtre est le français.

### 4.4 Ne jamais rediriger automatiquement selon la langue ou l'IP

Google est explicite, et c'est une des rares interdictions formulées aussi directement :

> « Avoid automatically redirecting users from one language version of a site to a different
> language version of a site. For example, don't redirect based on what you think the user's
> language may be. »
>
> « Don't use IP analysis to adapt your content. IP location analysis is difficult and
> generally not reliable. »
>
> — [Managing multi-regional and multilingual
> sites](https://developers.google.com/search/docs/specialty/international/managing-multi-regional-sites)
> (consulté le 2026-09-17)

C'est doublement important pour nous : Googlebot explore majoritairement depuis des IP
américaines avec `Accept-Language: en`. Une redirection automatique enverrait
systématiquement le robot sur `/en/`, et **notre contenu français — l'essentiel du site —
pourrait ne jamais être exploré**.

**Ce qu'on fait à la place** :
- `/` (racine sans locale) renvoie une **302** vers `/fr/` par défaut. 302 et non 301 :
  c'est une redirection de commodité, pas une consolidation d'URL, et elle doit rester
  révisable.
- On peut **suggérer** une autre langue par une bannière discrète (« This page is available
  in English »), jamais l'imposer.
- Le sélecteur de langue est visible sur toutes les pages, et il **conserve la page
  courante** (`/fr/tarifs` → `/en/pricing`, pas → `/en/`).
- Le choix de l'utilisateur est mémorisé côté client uniquement, et n'entraîne **jamais** de
  redirection du robot.

### 4.5 Mise en œuvre côté TanStack Start

La locale est un segment de route. Arborescence :

```
src/routes/
  $locale/
    route.tsx              → valide la locale, charge les traductions
    index.tsx              → /fr/  |  /en/
    tarifs.tsx             → /fr/tarifs  (slug par locale via la table, cf. ci-dessous)
    guides/
      index.tsx
      $slug.tsx
  sitemap[.]xml.ts
  robots[.]txt.ts
```

Le `head` de route accepte un tableau `links`, qui est exactement ce qu'il faut pour les
alternats ([TanStack Start —
SEO](https://tanstack.com/start/latest/docs/framework/react/guide/seo), consulté le
2026-09-17) :

```tsx
// src/lib/seo/alternates.ts
// Table de correspondance UNIQUE : c'est elle qui garantit la bidirectionnalité.
// Une page n'est traduite que si elle a une entrée ici. Pas d'entrée = pas d'alternat.
export const ROUTE_SLUGS = {
  home:     { fr: '',          en: '' },
  pricing:  { fr: 'tarifs',    en: 'pricing' },
  demo:     { fr: 'demo',      en: 'demo' },
  security: { fr: 'securite',  en: 'security' },
  // …
} as const

export const LOCALES = ['fr', 'en'] as const
export type Locale = (typeof LOCALES)[number]

const SITE = 'https://example.com' // ← domaine réel à injecter par variable d'env

/**
 * Produit le jeu COMPLET de liens alternatifs, self-référence incluse.
 * Google : « Each language version must list itself as well as all other language
 * versions. » Ne jamais construire ces liens à la main dans une route.
 */
export function alternateLinks(key: keyof typeof ROUTE_SLUGS) {
  const links = LOCALES.map((l) => {
    const slug = ROUTE_SLUGS[key][l]
    return {
      rel: 'alternate',
      hrefLang: l,
      href: `${SITE}/${l}${slug ? `/${slug}` : ''}`,
    }
  })
  // x-default → français (cf. §4.3)
  const frSlug = ROUTE_SLUGS[key].fr
  links.push({
    rel: 'alternate',
    hrefLang: 'x-default',
    href: `${SITE}/fr${frSlug ? `/${frSlug}` : ''}`,
  })
  return links
}

export function canonicalFor(key: keyof typeof ROUTE_SLUGS, locale: Locale) {
  const slug = ROUTE_SLUGS[key][locale]
  return `${SITE}/${locale}${slug ? `/${slug}` : ''}`
}
```

Usage dans une route :

```tsx
// src/routes/$locale/tarifs.tsx
import { createFileRoute } from '@tanstack/react-router'
import { alternateLinks, canonicalFor, type Locale } from '~/lib/seo/alternates'

export const Route = createFileRoute('/$locale/tarifs')({
  head: ({ params }) => {
    const locale = params.locale as Locale
    return {
      meta: [
        { title: 'Tarifs — Joliba' },
        { name: 'description', content: 'Des formules en FCFA, sans engagement…' },
        { property: 'og:locale', content: locale === 'fr' ? 'fr_FR' : 'en_US' },
      ],
      links: [
        { rel: 'canonical', href: canonicalFor('pricing', locale) },
        ...alternateLinks('pricing'),
      ],
    }
  },
  component: PricingPage,
})
```

> **Note sur `hrefLang` en React.** L'attribut HTML est `hreflang` (tout en minuscules) ;
> React attend `hrefLang` en camelCase sur un `<link>` JSX. Selon la façon dont TanStack
> Start sérialise le tableau `links`, la casse peut ne pas être normalisée. **À vérifier sur
> le HTML réellement servi** (`curl -s <url> | grep hreflang`) avant de considérer
> l'internationalisation comme livrée — un `hrefLang` qui ressort tel quel dans le HTML
> n'est pas un attribut valide. C'est un point à contrôler, pas à supposer.

Le même jeu d'alternats est **répété dans le sitemap** (voir §5.2) : les deux méthodes sont
équivalentes pour Google, et les cumuler donne une redondance utile si l'une des deux se
casse lors d'un refactor.

---

## 5. SEO technique

### 5.1 `robots.txt`

Spécification vérifiée : [Google robots.txt
specifications](https://developers.google.com/search/docs/crawling-indexing/robots/robots_txt)
(consulté le 2026-09-17).

Ce qu'il faut retenir, et qui décide de notre configuration :

- Champs supportés : `user-agent`, `allow`, `disallow`, `sitemap`. *« other fields such as
  `crawl-delay` aren't supported »*.
- **`noindex` n'est PAS supporté dans `robots.txt`.** Y écrire `Noindex:` ne fait rien.
- Un `disallow` empêche l'exploration, mais *« Google can't index the content of pages which
  are disallowed for crawling, but it may still index the URL and show it in search results
  without a snippet »*. **Interdire n'est donc pas désindexer.** C'est le point charnière de
  §7.
- Fichier à la racine du domaine, 500 Kio maximum, la suite est ignorée.
- Jokers : `*` et `$` supportés. En cas de conflit, *« Google uses the least restrictive
  rule »*, et la spécificité se juge à la **longueur du chemin**.

```
# public/robots.txt — ou mieux, généré (cf. ci-dessous)
User-agent: *
Allow: /

# Espace applicatif : aucune valeur de recherche, on économise le budget d'exploration.
Disallow: /app/
Disallow: /api/
Disallow: /auth/

# Paramètres de campagne : évite des variantes d'URL inutiles.
Disallow: /*?utm_

# ATTENTION — NE PAS interdire /r/ ni /menu/.
# /r/ (sessions de table) doit rester EXPLORABLE pour que le noindex soit vu (cf. §7).
# /menu/ est piloté page par page par un meta robots, pas par robots.txt.

Sitemap: https://example.com/sitemap.xml
```

Génération dynamique en route serveur — la syntaxe exacte, avec l'échappement du point
([TanStack Start — Server
routes](https://tanstack.com/start/latest/docs/framework/react/guide/server-routes) et
[SEO](https://tanstack.com/start/latest/docs/framework/react/guide/seo), consultés le
2026-09-17) :

```ts
// src/routes/robots[.]txt.ts   →  sert /robots.txt
// Le nom de fichier utilise [.] parce que TanStack Router traite le point
// comme un séparateur de chemin ; les crochets le rendent littéral.
import { createFileRoute } from '@tanstack/react-router'

const SITE = process.env.SITE_URL ?? 'https://example.com'

export const Route = createFileRoute('/robots[.]txt')({
  server: {
    handlers: {
      GET: async () => {
        // En préproduction, on ferme tout : une préprod indexée est une fuite
        // de contenu dupliqué et de tarifs non définitifs.
        const body =
          process.env.APP_ENV !== 'production'
            ? 'User-agent: *\nDisallow: /\n'
            : [
                'User-agent: *',
                'Allow: /',
                'Disallow: /app/',
                'Disallow: /api/',
                'Disallow: /auth/',
                'Disallow: /*?utm_',
                '',
                `Sitemap: ${SITE}/sitemap.xml`,
                '',
              ].join('\n')

        return new Response(body, {
          headers: {
            'Content-Type': 'text/plain; charset=utf-8',
            'Cache-Control': 'public, max-age=3600',
          },
        })
      },
    },
  },
})
```

> La préprod fermée par `robots.txt` **n'est pas suffisante** si des URL de préprod ont
> fuité : rappel de la règle ci-dessus, un `disallow` peut laisser l'URL indexée sans
> extrait. Sur la préprod, ajouter en plus une **authentification HTTP** (le plus sûr) ou un
> en-tête `X-Robots-Tag: noindex` — et alors ne pas la bloquer dans `robots.txt`, sinon le
> `noindex` n'est jamais lu.

### 5.2 `sitemap.xml`

Spécification vérifiée : [Build and submit a
sitemap](https://developers.google.com/search/docs/crawling-indexing/sitemaps/build-sitemap)
(consulté le 2026-09-17).

- **50 000 URL et 50 Mo décompressés** au maximum par fichier ; au-delà, index de sitemaps.
- Encodage **UTF-8** obligatoire.
- **Google ignore `<priority>` et `<changefreq>`.** Ne pas les écrire : ce sont des octets
  inutiles et un faux signal de maîtrise.
- `<lastmod>` n'est utilisé *« if it's consistently and verifiably accurate »*, et doit
  refléter *« the last significant update to the page »* — pas un changement cosmétique ni
  la date du dernier déploiement.

→ Conséquence concrète : `<lastmod>` doit venir de la **date de dernière modification
éditoriale du contenu**, stockée en base, et **jamais** de `Date.now()` ni de la date de
build. Un `lastmod` qui bouge à chaque déploiement est un `lastmod` que Google apprendra à
ignorer.

```ts
// src/routes/sitemap[.]xml.ts   →  sert /sitemap.xml
import { createFileRoute } from '@tanstack/react-router'
import { LOCALES, ROUTE_SLUGS } from '~/lib/seo/alternates'
import { getPublishedContent } from '~/lib/content.server'

const SITE = process.env.SITE_URL ?? 'https://example.com'
const esc = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
     .replace(/"/g, '&quot;').replace(/'/g, '&apos;')

type Entry = { path: string; lastmod?: string; alternates: Record<string, string> }

export const Route = createFileRoute('/sitemap[.]xml')({
  server: {
    handlers: {
      GET: async () => {
        const entries: Entry[] = []

        // 1. Pages statiques du sitemap marketing (§3.2)
        for (const key of Object.keys(ROUTE_SLUGS) as (keyof typeof ROUTE_SLUGS)[]) {
          const alternates = Object.fromEntries(
            LOCALES.map((l) => {
              const s = ROUTE_SLUGS[key][l]
              return [l, `${SITE}/${l}${s ? `/${s}` : ''}`]
            }),
          )
          for (const l of LOCALES) entries.push({ path: alternates[l], alternates })
        }

        // 2. Contenu publié — lastmod = date d'édition réelle, jamais Date.now()
        for (const doc of await getPublishedContent()) {
          const alternates = Object.fromEntries(
            doc.translations.map((t) => [t.locale, `${SITE}/${t.locale}/${t.path}`]),
          )
          for (const t of doc.translations) {
            entries.push({
              path: `${SITE}/${t.locale}/${t.path}`,
              lastmod: t.contentUpdatedAt.toISOString(), // date éditoriale
              alternates,
            })
          }
        }

        const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
        xmlns:xhtml="http://www.w3.org/1999/xhtml">
${entries
  .map(
    (e) => `  <url>
    <loc>${esc(e.path)}</loc>${e.lastmod ? `\n    <lastmod>${e.lastmod}</lastmod>` : ''}
${Object.entries(e.alternates)
  .map(
    ([l, href]) =>
      `    <xhtml:link rel="alternate" hreflang="${l}" href="${esc(href)}"/>`,
  )
  .join('\n')}
    <xhtml:link rel="alternate" hreflang="x-default" href="${esc(e.alternates.fr)}"/>
  </url>`,
  )
  .join('\n')}
</urlset>`

        return new Response(xml, {
          headers: {
            'Content-Type': 'application/xml; charset=utf-8',
            'Cache-Control': 'public, max-age=3600',
          },
        })
      },
    },
  },
})
```

**Ce qui n'entre JAMAIS dans le sitemap** : `/r/*` (sessions de table, §7), `/app/*`,
`/api/*`, les pages `noindex` (`/cookies`, `/statut`), et tout menu public dont le
restaurant n'a pas activé l'indexation.

> Le sitemap des **menus publics** est un fichier séparé (`/sitemap-menus.xml`), sur un
> **hôte séparé** (§7.4), alimenté uniquement par les menus qui passent la porte de qualité
> du §7.5. Le dépasser 50 000 URL est probable à l'échelle → prévoir l'index de sitemaps
> dès le départ.

### 5.3 Canonique

[Canonicalization and duplicate
URLs](https://developers.google.com/search/docs/crawling-indexing/consolidate-duplicate-urls)
(consulté le 2026-09-17). Deux choses à retenir :

- `rel="canonical"` est un **signal fort, pas une directive** : *« A strong signal that the
  specified URL should become canonical »*. Google tranche en dernier ressort.
- Les signaux **se cumulent** : redirection (le plus fort) > `rel=canonical` > présence dans
  le sitemap (*« a weak signal »*). Un canonique contredit par une redirection ou par
  l'absence dans le sitemap perd en force.
- Il n'existe **pas de pénalité de contenu dupliqué** dans la documentation. Le coût réel
  est un coût d'exploration : *« it's better for it to spend time crawling new (or updated)
  pages on your site, rather than crawling duplicate versions »*. Utile à savoir pour §7.5 :
  le risque des menus multiples n'est pas une pénalité, c'est du gaspillage d'exploration et
  un risque de **qualité perçue**.

Règles retenues :
- Canonique **auto-référente et absolue** sur chaque page indexable.
- Un seul hôte canonique (`https://`, avec ou sans `www`, choisi une fois) ; toutes les
  autres formes en **301**.
- Les paramètres de campagne (`utm_*`) **ne changent jamais** le canonique.
- Pagination (`/blog?page=2`) : canonique auto-référent vers la page paginée, **pas** vers
  la page 1 — sinon les articles des pages profondes ne sont plus découverts.

### 5.4 Balises par route

Générées depuis un seul module (`~/lib/seo/meta.ts`) pour éviter la dérive page à page. Sur
chaque page indexable :

| Balise | Règle |
|---|---|
| `<title>` | ≤ 60 caractères, mot-clé principal en tête, marque en fin |
| `<meta name="description">` | 140–160 caractères, écrite pour le clic, pas pour le robot |
| `<link rel="canonical">` | Absolue, auto-référente |
| `<link rel="alternate" hreflang>` | Jeu complet + `x-default` (§4.5) |
| `<meta name="robots">` | Absente si indexable ; `noindex, follow` sinon |
| `og:type` `og:title` `og:description` `og:url` `og:image` `og:locale` `og:site_name` | `og:url` = canonique. `og:image` en 1200×630, avec `og:image:width` / `og:image:height` renseignés (évite le recadrage et le reflow chez les clients qui pré-réservent l'espace) |
| `twitter:card` | `summary_large_image` |
| `<html lang>` | `fr` ou `en`, depuis le paramètre de route |

Les cartes sociales peuvent être **générées côté serveur** par une route
`/og/$key[.]png` — même mécanisme de route serveur que le sitemap. Cela évite d'avoir à
produire une image à la main pour chaque article, et garantit qu'aucun article ne part sans
visuel.

### 5.5 SSR, streaming et rendu

TanStack Start fournit *« full-document SSR, streaming, server functions »*
([TanStack Start v1](https://tanstack.com/blog/announcing-tanstack-start-v1), consulté le
2026-09-17 ; v1.0 stable depuis mars 2026), et la documentation GEO note que le SSR
*« ensures AI crawlers see fully rendered content »*
([GEO](https://tanstack.com/start/latest/docs/framework/react/guide/geo), consulté le
2026-09-17).

Règles pour les pages publiques (marketing, guides, menus publics) :

1. **Tout le contenu indexable doit être dans le HTML de la réponse initiale.** Le
   streaming est un atout pour la perception de vitesse, mais un bloc différé derrière un
   `Suspense` peut ne pas être vu par tous les robots — et sûrement pas par les robots des
   assistants, moins tolérants que Googlebot. Ce qui est différé doit être **secondaire**
   (avis clients, blocs de recommandation), jamais le corps de la page.
2. **Aucune donnée indexable derrière une fonction serveur appelée depuis le client.** Elle
   doit venir du `loader` de route.
3. **Contrôle par la mesure, pas par la confiance** : `curl -s <url> | grep "<h1"` doit
   retourner le titre. Si ce n'est pas le cas, la page n'est pas prête.
4. **Vérification obligatoire** : outil d'inspection d'URL de la Search Console → « HTML
   rendu ». C'est le seul juge.

### 5.6 Core Web Vitals

Métriques et seuils actuels, vérifiés sur [Understanding Core Web Vitals and Google search
results](https://developers.google.com/search/docs/appearance/core-web-vitals) (consulté le
2026-09-17) :

| Métrique | Seuil « bon » | Ce qu'elle mesure |
|---|---|---|
| **LCP** — Largest Contentful Paint | *« strive to have LCP occur within the first 2.5 seconds »* | Chargement |
| **INP** — Interaction to Next Paint | *« strive to have an INP of less than 200 milliseconds »* | Réactivité |
| **CLS** — Cumulative Layout Shift | *« strive to have a CLS score of less than 0.1 »* | Stabilité visuelle |

**Oui, INP a bien remplacé FID.** Confirmé : *« INP replaced FID as a Core Web Vital on
March 12, 2024 »*, et le support de FID a été retiré des outils Chrome le 10 septembre 2024
([Introducing INP to Core Web
Vitals](https://developers.google.com/search/blog/2023/05/introducing-inp) et [Interaction
to Next Paint is officially a Core Web Vital](https://web.dev/blog/inp-cwv-launch),
consultés le 2026-09-17). **FID n'existe plus** — toute documentation interne qui le
mentionnerait est périmée.

Deux points de méthode :

- Le seuil s'apprécie au **75ᵉ centile** des visites réelles : *« At least 75% of INP
  experiences should respond to user input in under 200 milliseconds »*
  ([web.dev](https://web.dev/blog/inp-cwv-launch), consulté le 2026-09-17).
- Ce qui compte est la **donnée de terrain** (rapport Core Web Vitals de la Search Console,
  alimenté par CrUX), pas la note d'un audit en laboratoire. Un score Lighthouse de 100 sur
  un portable de développeur ne dit rien de l'expérience d'un client sur un Android d'entrée
  de gamme en 3G à Cotonou.

**Ce que cela impose à notre produit, concrètement.** Notre public réel utilise des
téléphones modestes sur des réseaux irréguliers. Les seuils ne sont pas une case à cocher
SEO, ils décrivent notre contrainte de conception :

| Risque | Mesure |
|---|---|
| LCP dégradé par les photos de plats | Formats modernes, dimensions explicites, `fetchpriority="high"` sur l'image principale, chargement paresseux ailleurs, redimensionnement côté serveur. **Les photos de plats sont notre premier poste de LCP sur les menus publics.** |
| CLS dû aux images sans dimensions | `width`/`height` ou `aspect-ratio` sur **toutes** les images. Espace réservé pour les blocs différés. |
| CLS dû aux polices | `font-display: swap` + préchargement de la police critique, ou police système. |
| INP dégradé par l'hydratation | Découpage par route (natif dans TanStack Start), pas de JS tiers sur les pages publiques, et surtout **aucun script d'analytique bloquant sur le menu public**. |
| Tout | Budget de performance vérifié en intégration continue **sur un profil mobile bridé**, pas sur une machine de développement. |

### 5.7 En-têtes HTTP

| En-tête | Valeur | Raison |
|---|---|---|
| `Strict-Transport-Security` | `max-age=63072000; includeSubDomains; preload` | HTTPS partout ; évite un aller-retour en clair |
| `Referrer-Policy` | `strict-origin-when-cross-origin` par défaut ; **`no-referrer` sur `/r/*`** | Voir §7.3 |
| `Content-Security-Policy` | Restrictive sur les pages publiques | Réduit le risque de tiers, et donc de dégradation d'INP |
| `X-Robots-Tag` | Sur les routes non indexables uniquement | Voir §7.2 |
| `Cache-Control` | `public, max-age=…` sur le marketing ; **`no-store`** sur `/r/*` | Évite qu'un intermédiaire mette en cache une réponse porteuse de jeton |
| `Vary` | `Accept-Encoding` | Cohérence de cache |

**Pas de `Vary: Accept-Language`** sur les pages de contenu : puisque l'on ne négocie pas la
langue côté serveur (§4.4), l'en-tête serait mensonger et fragmenterait le cache pour rien.

---

## 6. Données structurées (§64)

### 6.1 Le constat qui doit être posé d'abord

**Il faut distinguer deux choses que l'on confond systématiquement** : le balisage qui
donne droit à un **résultat enrichi dans Google**, et le balisage qui rend simplement une
page **compréhensible par des machines**. La galerie officielle des résultats enrichis
Google contient aujourd'hui, et exhaustivement :

Article, Breadcrumb, Carousel, Course list, Dataset, Discussion forum, Education Q&A,
Employer aggregate rating, Event, Image metadata, Job posting, **Local business**, Math
solver, Movie, **Organization**, **Product**, Profile page, Q&A, Recipe, Review snippet,
**Software app**, Speakable, Subscription and paywalled content, Vacation rental, Video.
([Structured data markup that Google Search
supports](https://developers.google.com/search/docs/appearance/structured-data/search-gallery),
consulté le 2026-09-17)

**`Menu`, `MenuSection` et `MenuItem` n'y figurent pas. `Restaurant` non plus en tant que
type autonome** — Restaurant n'apparaît que comme sous-type de Local business. **`FAQPage`
n'y figure plus non plus.**

Conséquence, à dire clairement à toute l'équipe pour éviter une déception prévisible :
**baliser les menus en `Menu`/`MenuItem` ne produira pas de résultat enrichi dans Google
Search.** Ce n'est pas une raison de ne pas le faire — c'est une raison de le faire pour la
bonne raison : rendre la carte lisible par les moteurs, les assistants et les agrégateurs,
ce qui est un pari sur la recherche conversationnelle, pas sur un affichage garanti
aujourd'hui.

### 6.2 Tableau de décision

| Type | Résultat enrichi Google ? | Où | Verdict |
|---|---|---|---|
| `Organization` | **Oui** (panneau de connaissances, logo) | `/` et `/a-propos` | **À faire, phase 1** |
| `WebSite` | Pas un résultat enrichi documenté | `/` | À faire — contexte peu coûteux |
| `BreadcrumbList` | **Oui** | Guides, blog, solutions, fonctionnalités | **À faire, phase 1** |
| `Article` / `BlogPosting` | **Oui** | `/blog/*`, `/guides/*` | **À faire, phase 1** |
| `SoftwareApplication` | Oui, **mais** exige une note ou un avis | `/` | **Différé** — voir 6.5 |
| `Product` / `Offer` | Oui, mais destiné aux produits achetables | `/tarifs` | **À ne pas faire** — voir 6.6 |
| `FAQPage` | **Non** sauf sites gouvernementaux/santé reconnus | — | **À ne pas faire pour le résultat enrichi** — voir 6.7 |
| `Restaurant` (Local business) | **Oui** | Menus publics clients | **À faire, phase 2** |
| `Menu` / `MenuSection` / `MenuItem` | **Non** | Menus publics clients | **À faire quand même** — voir 6.1 et 6.8 |

### 6.3 `Organization` + `WebSite` (page d'accueil)

*« There are no required properties; instead, add the properties that apply to your
content. »* Recommandés : `address`, `alternateName`, `contactPoint`, `description`,
`email`, `foundingDate`, `logo`, `name`, `sameAs`, `telephone`, `url`. À placer *« on your
home page, or a single page that describes your organization »*
([Organization](https://developers.google.com/search/docs/appearance/structured-data/organization),
consulté le 2026-09-17).

```json
{
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "Organization",
      "@id": "https://example.com/#organization",
      "name": "Joliba",
      "url": "https://example.com/",
      "logo": {
        "@type": "ImageObject",
        "url": "https://example.com/img/logo-512.png",
        "width": 512,
        "height": 512
      },
      "description": "Système d'exploitation pour restaurants : commande à table, cuisine, caisse et encaissement Mobile Money.",
      "email": "contact@example.com",
      "telephone": "+225XXXXXXXXXX",
      "address": {
        "@type": "PostalAddress",
        "streetAddress": "…",
        "addressLocality": "Abidjan",
        "addressCountry": "CI"
      },
      "contactPoint": [
        {
          "@type": "ContactPoint",
          "contactType": "sales",
          "telephone": "+225XXXXXXXXXX",
          "areaServed": ["CI", "SN", "BJ", "CM"],
          "availableLanguage": ["fr", "en"]
        },
        {
          "@type": "ContactPoint",
          "contactType": "customer support",
          "email": "support@example.com",
          "availableLanguage": ["fr", "en"]
        }
      ],
      "sameAs": [
        "https://www.linkedin.com/company/…",
        "https://www.facebook.com/…",
        "https://www.instagram.com/…"
      ]
    },
    {
      "@type": "WebSite",
      "@id": "https://example.com/#website",
      "url": "https://example.com/",
      "name": "Joliba",
      "publisher": { "@id": "https://example.com/#organization" },
      "inLanguage": "fr"
    }
  ]
}
```

> `sameAs` ne contient que des profils **réellement contrôlés et actifs**. Un lien vers un
> compte vide dessert le signal d'identité plus qu'il ne l'aide.

### 6.4 `BreadcrumbList`

Propriétés requises : `itemListElement`, et par `ListItem` : `position`, `name`, `item`
(facultatif pour le dernier maillon). Minimum deux maillons
([Breadcrumb](https://developers.google.com/search/docs/appearance/structured-data/breadcrumb),
consulté le 2026-09-17).

```json
{
  "@context": "https://schema.org",
  "@type": "BreadcrumbList",
  "itemListElement": [
    {
      "@type": "ListItem",
      "position": 1,
      "name": "Accueil",
      "item": "https://example.com/fr"
    },
    {
      "@type": "ListItem",
      "position": 2,
      "name": "Guides",
      "item": "https://example.com/fr/guides"
    },
    {
      "@type": "ListItem",
      "position": 3,
      "name": "Encaissement Mobile Money au restaurant"
    }
  ]
}
```

> Le dernier maillon omet `item` volontairement — Google retombe alors sur l'URL de la page
> courante. Et le fil d'Ariane doit refléter *« typical user paths, not necessarily URL
> structure »* : il décrit la navigation, pas l'arborescence des fichiers.

### 6.5 `Article` / `BlogPosting`

Types acceptés : `Article`, `NewsArticle`, `BlogPosting`. *« There are no required
properties »* ; recommandés : `author` (avec `author.name` et `author.url`),
`datePublished`, `dateModified`, `headline`, `image`
([Article](https://developers.google.com/search/docs/appearance/structured-data/article),
consulté le 2026-09-17).

```json
{
  "@context": "https://schema.org",
  "@type": "BlogPosting",
  "headline": "Rapprocher ses encaissements Wave et Orange Money en fin de service",
  "description": "La procédure réelle, du moment où le serveur encaisse jusqu'à la clôture de caisse.",
  "image": ["https://example.com/img/articles/rapprochement-mobile-money-1200x630.jpg"],
  "datePublished": "2026-09-17T08:00:00+00:00",
  "dateModified": "2026-09-17T08:00:00+00:00",
  "inLanguage": "fr",
  "author": {
    "@type": "Person",
    "name": "Prénom Nom",
    "url": "https://example.com/fr/a-propos#prenom-nom",
    "jobTitle": "…"
  },
  "publisher": { "@id": "https://example.com/#organization" },
  "mainEntityOfPage": {
    "@type": "WebPage",
    "@id": "https://example.com/fr/blog/rapprochement-encaissements-mobile-money"
  }
}
```

> **`author` doit être une personne réelle, avec une page qui la présente.** C'est le « who »
> d'E-E-A-T. Un `author` valant le nom de la société sur un article de méthode affaiblit le
> signal au lieu de le renforcer. Et `dateModified` ne bouge que si le contenu a réellement
> changé — le faire bouger artificiellement figure explicitement dans la liste des signaux
> de contenu fait pour les moteurs
> ([helpful content](https://developers.google.com/search/docs/fundamentals/creating-helpful-content),
> consulté le 2026-09-17).

### 6.6 `SoftwareApplication` — pourquoi on attend

Propriétés requises : `name`, `offers.price`, **et obligatoirement `aggregateRating` ou
`review`** — *« You must include one of the following properties: `aggregateRating` [or]
`review` »*
([Software app](https://developers.google.com/search/docs/appearance/structured-data/software-app),
consulté le 2026-09-17).

Nous n'aurons pas d'avis authentiques au lancement. Or inventer une note est une violation
directe des règles générales sur les données structurées, exposant à une action manuelle. Le
gain espéré (des étoiles dans les résultats) ne justifie en rien le risque de désindexation.

**Décision : on publie le balisage `SoftwareApplication` *sans* `aggregateRating` dès le
départ** — il reste valide au sens de Schema.org, il décrit correctement le produit pour les
moteurs et les assistants, il n'ouvre simplement pas droit au résultat enrichi. On ajoute
`aggregateRating` **le jour où l'on a des avis réels, vérifiables et affichés sur la
page** — car les règles générales imposent que les données structurées correspondent à un
contenu visible par l'utilisateur.

```json
{
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  "name": "Joliba",
  "applicationCategory": "BusinessApplication",
  "operatingSystem": "Web, Android, iOS",
  "url": "https://example.com/fr",
  "description": "Commande à table, écran de cuisine, caisse et encaissement Mobile Money pour restaurants et maquis.",
  "publisher": { "@id": "https://example.com/#organization" },
  "offers": {
    "@type": "Offer",
    "price": "0",
    "priceCurrency": "XOF",
    "description": "Essai gratuit, puis abonnement mensuel sans engagement.",
    "url": "https://example.com/fr/tarifs"
  }
  // "aggregateRating": à AJOUTER seulement avec des avis réels et affichés sur la page.
}
```

### 6.7 `Product` / `Offer` sur `/tarifs` — pourquoi on s'abstient

Google distingue deux usages : les *product snippets* (« for product pages where people
can't directly purchase the product ») et les *merchant listings* (« for pages where
customers can purchase products from you »)
([Product](https://developers.google.com/search/docs/appearance/structured-data/product),
consulté le 2026-09-17). La documentation est écrite pour le commerce de biens et ne traite
pas le cas d'un abonnement logiciel.

**Décision : pas de `Product` sur `/tarifs`.** Un abonnement SaaS n'est pas un produit
achetable au sens décrit, la page ne permet pas l'achat direct, et le balisage n'ouvrirait
pas droit à un résultat enrichi pertinent. Le prix est déjà porté par `offers` dans
`SoftwareApplication` (6.6), ce qui est l'endroit correct.

> **Réserve honnête** : la documentation ne contient pas d'interdiction explicite d'employer
> `Product` pour un logiciel. Ma décision repose sur le fait que la page ne coche aucun des
> deux cas d'usage documentés, pas sur une prohibition citée. Si nous ouvrons un jour l'achat
> en ligne direct depuis `/tarifs`, la question doit être rouverte.

### 6.8 `FAQPage` — le résultat enrichi n'existe plus pour nous

> *« the feature is only shown for well-known, authoritative government and health
> websites »*
> — [FAQPage](https://developers.google.com/search/docs/appearance/structured-data/faqpage)
> et [Changes to HowTo and FAQ rich
> results](https://developers.google.com/search/blog/2023/08/howto-faq-changes) (consultés
> le 2026-09-17)

Nous ne sommes ni un site gouvernemental ni un site de santé. **`FAQPage` n'apportera aucun
résultat enrichi.** Toute feuille de route qui l'inscrit comme levier SEO est périmée.

Nuance, parce qu'elle change la décision : la documentation TanStack sur l'optimisation pour
les moteurs génératifs affirme que le balisage FAQ est *« particularly effective for GEO —
AI systems often extract Q&A pairs »*
([GEO](https://tanstack.com/start/latest/docs/framework/react/guide/geo), consulté le
2026-09-17). **C'est une affirmation d'éditeur de framework, non vérifiable par une source
primaire, et je la signale comme telle.**

**Décision pragmatique** : on écrit de vraies sections questions/réponses sur les pages
produit — parce qu'elles sont utiles aux visiteurs, ce qui est la seule justification
solide. On y ajoute le balisage `FAQPage` : coût nul, gain nul côté Google Search, gain
possible et non prouvé côté assistants. **Mais on ne le compte pas comme un levier SEO dans
les prévisions.**

### 6.9 Menus publics des restaurants clients — `Restaurant` + `Menu`

C'est le balisage le plus ambitieux, et celui dont il faut attendre le moins à court terme.

**Ce qui est acquis.** Google traite `Restaurant` comme sous-type de Local business :
*« Use the most specific `LocalBusiness` sub-type possible; for example, `Restaurant` »*.
Requis : `address`, `name`. Recommandés utiles ici : `menu` (*« For food establishments, the
fully-qualified URL of the menu »*), `servesCuisine`, `openingHoursSpecification`,
`priceRange`, `telephone`, `geo`, `url`
([Local business](https://developers.google.com/search/docs/appearance/structured-data/local-business),
consulté le 2026-09-17).

**Ce qui relève de Schema.org sans contrepartie Google.** `Menu` *« a structured
representation of food or drink items available from a FoodEstablishment »*, rattaché via
`hasMenu` sur `FoodEstablishment`, avec `hasMenuSection` (imbricables) et `hasMenuItem`
([schema.org/Menu](https://schema.org/Menu), V30.1, consulté le 2026-09-17). `MenuItem`
accepte `offers`, `nutrition`, `suitableForDiet`, `menuAddOn`
([schema.org/MenuItem](https://schema.org/MenuItem), consulté le 2026-09-17).

Exemple complet et directement utilisable :

```json
{
  "@context": "https://schema.org",
  "@type": "Restaurant",
  "@id": "https://menus.example.com/le-comptoir#restaurant",
  "name": "Le Comptoir",
  "url": "https://menus.example.com/le-comptoir",
  "image": "https://menus.example.com/img/le-comptoir/devanture.jpg",
  "telephone": "+225XXXXXXXXXX",
  "priceRange": "5000-15000 XOF",
  "servesCuisine": ["Ivoirienne", "Grillades"],
  "address": {
    "@type": "PostalAddress",
    "streetAddress": "Rue …",
    "addressLocality": "Cocody",
    "addressRegion": "Abidjan",
    "addressCountry": "CI"
  },
  "geo": { "@type": "GeoCoordinates", "latitude": 5.35, "longitude": -3.99 },
  "openingHoursSpecification": [
    {
      "@type": "OpeningHoursSpecification",
      "dayOfWeek": ["Monday","Tuesday","Wednesday","Thursday","Friday"],
      "opens": "11:00",
      "closes": "23:00"
    },
    {
      "@type": "OpeningHoursSpecification",
      "dayOfWeek": ["Saturday","Sunday"],
      "opens": "12:00",
      "closes": "01:00"
    }
  ],
  "menu": "https://menus.example.com/le-comptoir",
  "hasMenu": {
    "@type": "Menu",
    "@id": "https://menus.example.com/le-comptoir#menu",
    "name": "Carte",
    "inLanguage": "fr",
    "hasMenuSection": [
      {
        "@type": "MenuSection",
        "name": "Entrées",
        "description": "À partager ou pour commencer.",
        "hasMenuItem": [
          {
            "@type": "MenuItem",
            "name": "Attiéké poisson braisé",
            "description": "Attiéké, poisson braisé du jour, sauce tomate pimentée.",
            "image": "https://menus.example.com/img/le-comptoir/attieke.jpg",
            "suitableForDiet": "https://schema.org/GlutenFreeDiet",
            "offers": {
              "@type": "Offer",
              "price": "3500",
              "priceCurrency": "XOF",
              "availability": "https://schema.org/InStock"
            }
          },
          {
            "@type": "MenuItem",
            "name": "Salade d'avocat",
            "description": "Avocat, tomate, oignon rouge, vinaigrette citron.",
            "suitableForDiet": "https://schema.org/VegetarianDiet",
            "offers": {
              "@type": "Offer",
              "price": "2500",
              "priceCurrency": "XOF",
              "availability": "https://schema.org/InStock"
            }
          }
        ]
      },
      {
        "@type": "MenuSection",
        "name": "Grillades",
        "hasMenuSection": [
          {
            "@type": "MenuSection",
            "name": "Viandes",
            "hasMenuItem": [
              {
                "@type": "MenuItem",
                "name": "Poulet braisé entier",
                "description": "Poulet mariné, braisé au feu de bois, servi avec alloco.",
                "offers": {
                  "@type": "Offer",
                  "price": "7000",
                  "priceCurrency": "XOF",
                  "availability": "https://schema.org/InStock"
                },
                "menuAddOn": [
                  {
                    "@type": "MenuItem",
                    "name": "Supplément alloco",
                    "offers": {
                      "@type": "Offer",
                      "price": "1000",
                      "priceCurrency": "XOF"
                    }
                  }
                ]
              }
            ]
          }
        ]
      }
    ]
  }
}
```

**Trois règles de génération, non négociables** :

1. **Un plat épuisé passe à `"availability": "https://schema.org/OutOfStock"` ou disparaît du
   balisage.** Un menu balisé qui annonce un plat indisponible est pire qu'un menu non
   balisé : c'est une information fausse publiée sous notre nom.
2. **Le prix balisé est exactement le prix affiché**, même devise, même montant. Les règles
   générales exigent la correspondance entre balisage et contenu visible.
3. **`Restaurant` avec `address` et `name` renseignés, ou pas de `Restaurant` du tout.** Un
   restaurant qui n'a pas saisi son adresse ne reçoit pas de balisage Local business
   incomplet — il ne reçoit que `Menu`.

**Vérification** : passer chaque gabarit au Test des résultats enrichis et au validateur
Schema.org avant mise en production, puis suivre le rapport « Local business » de la Search
Console de l'hôte des menus.

### 6.10 `llms.txt`

TanStack recommande un point d'entrée `/llms.txt` *« providing AI systems with guidance on
key facts, documentation links, and contact information — mirroring robots.txt
conventions »* ([GEO](https://tanstack.com/start/latest/docs/framework/react/guide/geo),
consulté le 2026-09-17).

**Ce n'est pas un standard reconnu par Google**, et aucune source primaire ne garantit qu'un
moteur le lise. Coût : une route serveur de vingt lignes. **Décision : on le fait**, en
l'assumant comme un pari à faible coût, et **sans l'inscrire comme levier mesuré**. Il ne
doit contenir que des informations publiques.

---

## 7. Le point délicat — menus publics indexables vs sessions de table (§57, §62, §64)

Deux familles d'URL publiques coexistent, avec des exigences **opposées**. Les confondre est
la faute la plus coûteuse possible sur ce produit.

| | `/menu/<restaurant>` | `/r/<venue>/t/<token>` |
|---|---|---|
| Nature | Vitrine publique de la carte | Session de table authentifiée par jeton |
| Découverte | Liens, recherche, partage | **Uniquement** en scannant un QR physique sur la table |
| Doit être indexée | **Oui, si le restaurant l'active** | **Jamais** |
| Contenu | Carte, horaires, adresse | Carte **+ panier + commande en cours + addition** |
| Risque si fuite | Faible | **Élevé** — un tiers peut commander sur la table d'autrui, voir l'addition, et potentiellement payer ou faire payer |

Ce n'est donc pas un problème de SEO. **C'est un problème de sécurité qui se manifeste par
un symptôme SEO.** Traité uniquement par des directives `noindex`, il resterait ouvert.

### 7.1 Correction de fond : sortir le jeton de l'URL

Toutes les protections qui suivent sont des couches. **La seule qui supprime le problème au
lieu de le contenir est architecturale** : le jeton ne doit pas vivre dans l'URL que le
navigateur conserve.

```
1. Le client scanne le QR         →  GET /r/<venue>/t/<token>
2. Le serveur valide le jeton, ouvre une session de table,
   pose un cookie httpOnly + SameSite=Lax + Secure
3. Le serveur répond 302 vers     →  /r/<venue>/table
4. Toute la suite du parcours se déroule sur /r/<venue>/table,
   qui ne contient AUCUN secret.
```

Ce que cet échange supprime d'un coup, et qu'aucune balise ne pourrait supprimer :

- **L'historique du navigateur** ne garde qu'une URL sans secret. Aujourd'hui, un client qui
  rouvre son historique trois jours plus tard rouvrirait une session de table valide.
- **Le partage.** Un client qui envoie le lien dans une conversation de groupe ne partage
  plus qu'une URL inerte. C'est le vecteur de fuite le plus probable en pratique — plus que
  Googlebot.
- **Les journaux.** Le jeton n'apparaît que dans une seule requête, ce qui rend son
  expurgation des journaux d'accès (serveur, CDN, proxy) réaliste. Avec le jeton dans
  chaque URL, il faudrait expurger chaque ligne de journal de chaque couche.
- **L'analytique.** Le `page_path` envoyé aux outils de mesure ne contient plus de secret.
  C'est le cas de fuite le plus souvent oublié : une balise d'analytique transmet fidèlement
  l'URL complète à un tiers.
- **Le référent interne.** Même en `same-origin`, l'URL complète est transmise ; ici il n'y a
  plus rien à transmettre.

Par-dessus : jeton **à durée de vie courte**, **révocable**, **lié au service en cours**, et
**rotatif par session de table**. Un jeton qui survit à la soirée est un jeton qui finira
par fuiter.

### 7.2 Interdire l'indexation, correctement

Le piège est documenté, et il est contre-intuitif : **`robots.txt` ne désindexe pas.**

> « Google can't index the content of pages which are disallowed for crawling, but it may
> still index the URL and show it in search results without a snippet. »
> — [robots.txt specifications](https://developers.google.com/search/docs/crawling-indexing/robots/robots_txt)
> (consulté le 2026-09-17)

Et pour que `noindex` fonctionne :

> « For the `noindex` rule to be effective, the page or resource **must not** be blocked by a
> robots.txt file, and it has to be otherwise accessible to the crawler. If the page is
> blocked […] the crawler will never see the noindex rule, and the page can still appear in
> search results. »
> — [Block search indexing with noindex](https://developers.google.com/search/docs/crawling-indexing/block-indexing)
> (consulté le 2026-09-17)

**Donc : ne PAS mettre `Disallow: /r/` dans `robots.txt`.** Le réflexe naturel est le
mauvais. Il faut laisser la route explorable pour que la directive `noindex` soit lue si une
URL était découverte, tout en sachant qu'aucune ne devrait l'être puisqu'il n'existe aucun
lien entrant.

Application, en ceinture et bretelles :

```ts
// Middleware/handler sur toutes les routes /r/*
const GUEST_SESSION_HEADERS = {
  // En-tête HTTP : couvre aussi les réponses non-HTML (JSON, redirections)
  'X-Robots-Tag': 'noindex, nofollow, noarchive, nosnippet',
  // Le jeton ne doit jamais être mis en cache par un intermédiaire
  'Cache-Control': 'no-store, no-cache, must-revalidate, private',
  // §7.3
  'Referrer-Policy': 'no-referrer',
}
```

```tsx
// src/routes/r/$venue/table.tsx — et TOUTES les routes /r/*
export const Route = createFileRoute('/r/$venue/table')({
  head: () => ({
    meta: [
      { name: 'robots', content: 'noindex, nofollow, noarchive, nosnippet' },
      { name: 'referrer', content: 'no-referrer' },
    ],
    // Aucune balise canonique, aucun alternat hreflang, aucune donnée structurée :
    // ces pages ne doivent exister pour aucun moteur.
  }),
  component: TablePage,
})
```

Les sept garanties, cumulées :

| # | Garantie | Mécanisme | Vérification |
|---|---|---|---|
| 1 | Le jeton ne survit pas à la première requête | Échange jeton → cookie + 302 (§7.1) | `curl -sI ".../r/v/t/TOKEN"` → `302`, et `Location` sans jeton |
| 2 | En-tête `noindex` sur toutes les réponses | `X-Robots-Tag` | `curl -sI ".../r/v/table" \| grep -i x-robots-tag` |
| 3 | Balise `noindex` dans le HTML | `<meta name="robots">` | `curl -s ".../r/v/table" \| grep -i 'name="robots"'` |
| 4 | Exploration **autorisée** pour que 2 et 3 soient lues | Pas de `Disallow: /r/` | `curl -s .../robots.txt \| grep -c '/r/'` → `0` |
| 5 | Absent des sitemaps | Liste blanche à la génération (§5.2) | `curl -s .../sitemap.xml \| grep -c '/r/'` → `0` |
| 6 | Aucun lien indexable entrant | Le QR est une **image imprimée**, pas un hyperlien. Aucune page publique ne renvoie vers `/r/*` | Revue de code : `grep -rn 'href=.*"/r/' src/` → vide |
| 7 | Aucune fuite par référent, cache ou journal | §7.3 et §7.5 | Voir ci-dessous |

Et une garantie de dernier recours, qui est celle qui compte vraiment : **même si une URL de
session fuitait intégralement, le jeton doit être expiré ou révoqué**. C'est la seule qui ne
dépend d'aucun tiers.

### 7.3 `Referrer-Policy` — ce qui fuit et ce qui ne fuit pas

Le comportement par défaut des navigateurs est `strict-origin-when-cross-origin` depuis
2020 ([MDN —
Referrer-Policy](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Referrer-Policy),
consulté le 2026-09-17). Concrètement, depuis `https://example.com/r/venue/t/TOKEN` :

| Destination | Ce qui part par défaut | Verdict |
|---|---|---|
| Ressource même origine (notre API, nos images) | **URL complète, jeton compris** | ⚠️ fuite interne — journaux, traces |
| Ressource tierce en HTTPS (police, analytique, CDN) | Origine seule (`https://example.com/`) | ✅ |
| Lien sortant cliqué par le client (site du restaurant, Instagram) | Origine seule | ✅ |
| Destination en HTTP | Rien | ✅ |

Le défaut protège donc déjà des tiers. **Il ne protège pas de nous-mêmes** : chaque appel à
notre propre API porte l'URL complète dans `Referer`, et atterrit dans nos journaux.

**Décision : `Referrer-Policy: no-referrer` sur tout `/r/*`.** *« Omits the Referer header
entirely »*. Il n'y a sur ces pages aucun usage légitime du référent — ni attribution, ni
analytique de provenance : la provenance est toujours « un QR sur une table ». Coût nul,
bénéfice réel.

> Rappel : avec l'échange du §7.1, il n'y a de toute façon plus de jeton dans l'URL à faire
> fuir. Les deux mesures se renforcent ; aucune ne remplace l'autre.

### 7.4 Où vivent les menus publics — un hôte séparé

**Décision : les menus des restaurants clients ne vivent PAS sur le domaine marketing.**

```
example.com          → site marketing (§3.2)
menus.example.com    → menus publics des restaurants clients
app.example.com      → application (noindex intégral)
```

Quatre raisons, par ordre d'importance :

1. **Cloisonnement de réputation.** Si un client publie un contenu problématique, ou si
   l'agrégat des menus était un jour jugé de faible qualité, le sous-domaine absorbe le
   choc. Notre site marketing — celui qui porte nos guides, nos pages produit et notre
   conversion — n'est pas atteint. C'est de l'assurance, et elle est gratuite.
2. **Cloisonnement des rapports.** En Search Console, un hôte séparé est une propriété
   séparée. On peut suivre la performance des menus sans qu'elle pollue les rapports du
   marketing, ce qui serait le cas dès quelques centaines de menus — les menus généreraient
   un volume d'impressions qui masquerait entièrement le signal du site marketing.
3. **Cloisonnement des règles.** `robots.txt`, `sitemap.xml` et en-têtes sont propres à
   l'hôte (la spécification le dit : *« Rules apply only to the host, protocol, and port
   number where the robots.txt file is hosted »*). Deux régimes, deux fichiers, aucune
   interférence.
4. **Cloisonnement de la performance.** Les menus servent beaucoup d'images de plats sous
   contrainte réseau. Un hôte dédié permet un cache et un CDN réglés pour ce profil, sans
   compromis avec le site marketing.

Le contre-argument — « on perd le transfert d'autorité vers le domaine principal » — est
faible : les liens entrants d'un menu de restaurant pointent vers ce restaurant, pas vers
nous. Nous ne perdons presque rien, et nous nous protégeons de beaucoup.

**Domaine personnalisé du client.** Si un restaurant branche `carte.son-restaurant.ci`, la
page canonique devient **la sienne**. Notre copie sur `menus.example.com` porte alors un
`rel="canonical"` vers son domaine, ou un `noindex`. Cela évite d'être en concurrence avec
notre propre client sur sa propre marque — ce qui serait à la fois contre-productif et
commercialement indéfendable.

### 7.5 Contenu dupliqué et pages faibles à l'échelle de 500 restaurants (§62)

**Le duplicata, d'abord, est le moindre des deux risques.** Cinq cents restaurants ont cinq
cents cartes différentes : des plats différents, des prix différents, des descriptions
différentes. Ce n'est pas du contenu dupliqué. Et la documentation ne décrit aucune pénalité
de duplicata — seulement un coût d'exploration
([canonicalization](https://developers.google.com/search/docs/crawling-indexing/consolidate-duplicate-urls),
consulté le 2026-09-17).

**Le vrai risque est la page faible produite en série**, et il est nommé par la politique
anti-spam :

> « Scaled content abuse is when many pages are generated for the primary purpose of
> manipulating search rankings and not helping users. »
> — [Spam policies](https://developers.google.com/search/docs/essentials/spam-policies)
> (consulté le 2026-09-17)

Les vraies sources de duplicata dans notre cas, et leur traitement :

| Source | Traitement |
|---|---|
| Le gabarit lui-même (en-tête, pieds, mentions, appel à l'action) | Réduire le texte de gabarit au minimum. Le rapport contenu propre / contenu de gabarit doit rester favorable au contenu propre — c'est ce qui distingue une page utile d'une page en série. |
| Les menus quasi vides (un restaurant qui a saisi trois plats sans description) | **Porte de qualité** ci-dessous |
| Les chaînes qui ont N établissements avec la même carte | Canonique vers l'établissement principal, ou une seule page avec un sélecteur d'établissement |
| Les plats génériques (« Poulet braisé » chez 200 restaurants) | Rien à faire — c'est un nom de plat, pas du contenu dupliqué. Ce qui différencie la page, c'est la carte entière, l'adresse, les horaires, les photos. |
| Variantes d'URL (`?lang=`, `?table=`, `?utm_`) | Canonique auto-référent propre, paramètres ignorés |

**La porte de qualité — le mécanisme central.** Un menu **n'est proposé à l'indexation que
s'il franchit un seuil**, contrôlé par le code, pas par la bonne volonté du client :

```ts
// src/lib/seo/menu-indexability.server.ts
type Verdict = { indexable: boolean; reasons: string[] }

export function menuIndexability(venue: Venue): Verdict {
  const reasons: string[] = []

  // 1. Consentement explicite — jamais d'indexation par défaut (§57)
  if (!venue.publicMenuEnabled) reasons.push('indexation non activée par le restaurant')

  // 2. Substance : une carte de 3 plats sans description n'est pas une page utile
  const items = venue.menuItemCount
  const described = venue.menuItemsWithDescriptionCount
  if (items < 8) reasons.push(`seulement ${items} plats (minimum 8)`)
  if (described / Math.max(items, 1) < 0.5) reasons.push('moins de la moitié des plats décrits')

  // 3. Identité : ce qui rend la page unique et lui donne une valeur locale
  if (!venue.address) reasons.push('adresse absente')
  if (!venue.openingHours?.length) reasons.push('horaires absents')
  if (!venue.description || venue.description.length < 120)
    reasons.push('présentation trop courte (120 caractères minimum)')

  // 4. Fraîcheur : un menu abandonné depuis 6 mois affiche des prix faux
  const days = (Date.now() - venue.menuUpdatedAt.getTime()) / 86_400_000
  if (days > 180) reasons.push(`carte non mise à jour depuis ${Math.round(days)} jours`)

  return { indexable: reasons.length === 0, reasons }
}
```

Conséquences appliquées automatiquement :

- `indexable === false` → **`noindex, follow`** (on laisse suivre les liens vers le site du
  restaurant, qui restent utiles) **et absence du sitemap**.
- `indexable === true` → indexable, présent dans `sitemap-menus.xml`, avec données
  structurées complètes (§6.9).
- **Les motifs sont affichés au restaurateur dans son tableau de bord.** C'est ce qui
  transforme une contrainte en fonctionnalité : « Votre page n'est pas encore visible sur
  Google : il manque vos horaires et une présentation. » Cela sert le client, cela sert la
  qualité, et cela nourrit l'engagement produit.
- Le passage sous le seuil **rebascule en `noindex`** et retire du sitemap. C'est vérifié à
  chaque publication de carte, pas une fois pour toutes.

**Ce qui est formellement interdit, quelle que soit la pression commerciale** :

1. Générer des pages d'annuaire par ville ou par cuisine (`/restaurants/abidjan`,
   `/restaurants/cocody/grillades`) tant que nous n'avons pas de véritable contenu éditorial
   sur ces pages. Un annuaire automatique de nos clients est exactement le cas de « doorway
   abuse » du §3.3.
2. Indexer un menu sans le consentement explicite du restaurant.
3. Publier des avis, des notes ou des classements que nous n'avons pas réellement collectés.
4. Créer des pages « Le meilleur restaurant de X » alimentées par nos seuls clients. C'est
   un classement de complaisance déguisé en contenu.

**Point de contrôle chiffré, à surveiller** : si le ratio *menus indexables / menus totaux*
dépasse durablement 60 %, c'est que la porte de qualité est trop permissive. Si le rapport
d'indexation de la Search Console montre une proportion croissante de « Explorée, non
indexée » ou « Détectée, non indexée » sur l'hôte des menus, **Google nous dit que nos pages
sont jugées faibles**. C'est le signal qui déclenche un durcissement du seuil, pas un signal
à ignorer.

---

## 8. Growth SEO — la boucle du menu public (§84)

### 8.1 La boucle, et ce qu'elle produit vraiment

```
Un restaurant active sa page menu publique
        ↓
La page se classe sur « <nom du restaurant> menu », « <nom> carte », « <nom> prix »
  — requêtes de marque, faciles à gagner, parce que personne d'autre ne les sert bien :
    aujourd'hui elles renvoient vers une fiche Facebook incomplète ou un agrégateur
        ↓
Des clients du restaurant arrivent sur une page rapide, à jour, propre
        ↓
Le restaurant constate un trafic qu'il n'avait pas → il en parle
        ↓
  (a) il partage le lien (réseaux, WhatsApp, Google Business, son propre site)
      → liens entrants et signaux de notoriété vers menus.example.com
  (b) une mention discrète « Carte propulsée par Joliba » en pied de page
      → notoriété de marque auprès d'autres restaurateurs
  (c) un autre gérant voit la page, la trouve professionnelle, demande qui l'a faite
      → acquisition par imitation entre pairs — le canal le plus efficace du secteur
```

**Ce qui fait la force de cette boucle dans notre marché précis** : la requête
« <nom du maquis> menu » est aujourd'hui très mal servie en Côte d'Ivoire, au Sénégal, au
Bénin et au Cameroun. Les résultats renvoient vers des pages Facebook sans carte, des
agrégateurs qui recopient d'anciens prix, ou rien du tout. **Une page menu propre, rapide et
à jour gagne cette requête sans effort SEO**, parce qu'il n'y a pas de concurrence
sérieuse. C'est un gain réel, pas une théorie.

Et c'est aussi la meilleure preuve commerciale possible : on ne dit pas au gérant « le SEO
est important », on lui montre le nombre de personnes qui ont ouvert sa carte cette semaine.

### 8.2 Exploiter sans spammer — la ligne à ne pas franchir

| Ce qu'on fait | Ce qu'on ne fait pas, et pourquoi |
|---|---|
| Mention sobre « Carte propulsée par Joliba » en pied de page, **`rel="nofollow"`** | Un lien suivi depuis des centaines de pages clientes vers notre domaine est un schéma de liens à l'échelle. `nofollow` rend la mention honnête : elle sert la notoriété, pas la manipulation. |
| Donner au restaurant un lien direct vers **sa** page, à partager où il veut | Acheter, échanger ou automatiser des liens |
| L'aider à renseigner sa fiche Google Business et à y mettre le lien du menu | Créer des fiches Google Business à sa place — c'est une donnée qui lui appartient |
| Un article de fond par marché, écrit à partir du terrain (§2) | Un article par ville dupliqué avec le nom remplacé (§3.3) |
| Publier des résultats chiffrés de clients **nommés et consentants** | Publier des témoignages composés ou des moyennes invérifiables |
| Laisser le restaurant emporter ses données et son contenu s'il part | Retenir la page ou le référencement en otage — indéfendable, et cela se saurait |

**Le point le plus important de cette section** : la boucle ne fonctionne que si la page
menu est **réellement bonne pour le client final**. Une page lente, avec des prix périmés,
ne se classe pas et ne se partage pas. La porte de qualité du §7.5 n'est donc pas une
contrainte imposée à la croissance — **c'est le moteur de la croissance**. Les deux vont
dans le même sens, ce qui est rare et qu'il faut exploiter.

### 8.3 Deux leviers d'acquisition de liens, réalistes

1. **Les gabarits téléchargeables** (`/modeles/*`, §3.2) : fiche technique de plat, tableau
   de clôture de caisse, calculateur de food cost en FCFA. Sans formulaire. C'est le contenu
   que les groupes professionnels et les formations en restauration citent spontanément.
2. **Les données que nous seuls possédons.** À terme, et **uniquement avec un volume
   suffisant pour être honnête et un anonymat garanti** : heures de pointe réelles par
   marché, ticket moyen par format, part des paiements mobiles dans l'encaissement. C'est le
   type de publication que la presse économique régionale (Agence Ecofin, Digital Business
   Africa — vus dans les résultats du §1) reprend, et qui apporte des liens que l'on ne peut
   pas acheter. **À ne pas tenter avant d'avoir un échantillon défendable** : publier une
   « étude » sur douze restaurants abîmerait durablement notre crédibilité.

---

## 9. Plan de mesure

### 9.1 Propriétés Search Console

Trois propriétés distinctes, conformément au cloisonnement du §7.4 :

| Propriété | Type | Ce qu'on y suit |
|---|---|---|
| `example.com` | Domaine | Marketing, contenu, conversion |
| `menus.example.com` | Domaine | Menus clients, boucle de croissance |
| `app.example.com` | Domaine | Uniquement pour **vérifier qu'il n'y est rien** |

> Une propriété de type « domaine » (vérifiée par DNS) couvre tous les sous-domaines et
> protocoles ; c'est celle qu'il faut, pour ne pas découvrir trop tard qu'une préproduction
> est indexée.

À raccorder également : Bing Webmaster Tools (coût marginal, et l'indexation Bing alimente
plusieurs assistants), et l'analytique produit côté `app.example.com` — sans jamais y
envoyer d'URL porteuse de jeton (§7.1).

### 9.2 Rapports à suivre, et rythme

| Fréquence | Rapport | Ce qu'on regarde | Seuil d'alerte |
|---|---|---|---|
| **Quotidien** (automatisé, alerte seulement) | Couverture / indexation | Apparition d'une URL `/r/` ou `/app/` dans l'index | **Toute occurrence = incident de sécurité**, pas un point SEO. Traiter immédiatement. |
| **Hebdomadaire** | Performances, filtré par pays (CI, SN, BJ, CM) | Impressions et clics par marché, nouvelles requêtes | Baisse > 20 % d'une semaine à l'autre |
| **Hebdomadaire** | Performances, filtré par page, sur `/guides/*` | Quels piliers prennent, lesquels stagnent | Un pilier sans impression après 8 semaines → réécrire ou retirer |
| **Hebdomadaire** | Requêtes non anticipées | Ce que les gens cherchent vraiment — **la seule source de volume fiable dont nous disposerons** (cf. §0) | Toute requête récurrente absente de notre plan éditorial → sujet à écrire |
| **Bimensuel** | Indexation de `menus.example.com` | Ratio indexé / soumis ; part de « Explorée, non indexée » | Part croissante de non indexées → durcir la porte de qualité (§7.5) |
| **Mensuel** | Core Web Vitals (données de terrain) | LCP / INP / CLS au 75ᵉ centile, mobile d'abord | Sortie du « bon » sur une métrique |
| **Mensuel** | Résultats enrichis (Breadcrumb, Article, Local business) | Erreurs et avertissements | Toute erreur |
| **Mensuel** | Liens | Nouveaux domaines référents | — |
| **Trimestriel** | Revue complète | Positions, contenu à rafraîchir, décisions de §1 à rejuger | — |

### 9.3 Indicateurs, par ordre d'importance

**Ce que nous pilotons réellement** (du plus significatif au moins) :

1. **Démonstrations demandées depuis la recherche organique**, par marché. C'est le seul
   indicateur qui compte financièrement. Tout le reste est un moyen.
2. **Clics organiques sur les pages à forte intention** — `/solutions/*`,
   `/integrations/*`, `/tarifs`. Un trafic qui monte sur le blog sans monter ici signifie que
   nous écrivons pour la mauvaise audience.
3. **Nombre de requêtes distinctes déclenchant une impression**, par marché. C'est la mesure
   de l'étendue de notre autorité thématique, et elle est plus honnête qu'une position
   moyenne.
4. **Menus clients indexés** et **clics vers ces menus** — santé de la boucle du §8.
5. **Position moyenne sur les requêtes du §1**, par pays. À lire avec prudence : la position
   moyenne agrège des requêtes incomparables.
6. **Core Web Vitals au 75ᵉ centile, sur mobile.** Non pas comme un score, mais comme un
   indicateur de l'expérience réelle de nos utilisateurs sur des appareils modestes.

**Ce que nous refusons de piloter** : le nombre d'articles publiés, le nombre de mots, la
« densité de mots-clés », le volume de trafic total sans segmentation d'intention. Ce sont
des indicateurs qui poussent mécaniquement vers ce que §63 interdit.

### 9.4 Dispositif d'alerte à mettre en place avec le site

Ce ne sont pas des tableaux de bord — ce sont des vérifications automatisées qui échouent
bruyamment :

1. **Contrôle d'indexation de `/r/`** — requête quotidienne à l'API Search Console ; toute
   URL `/r/` ou `/app/` indexée déclenche une alerte traitée comme un incident.
2. **Contrôle des en-têtes en intégration continue** — après chaque déploiement, vérifier que
   `/r/<v>/table` renvoie bien `X-Robots-Tag: noindex` et `Referrer-Policy: no-referrer`, et
   que `/fr/tarifs` ne les renvoie **pas**. Une inversion de ces deux règles est silencieuse
   et catastrophique.
3. **Contrôle de réciprocité `hreflang`** — script qui parcourt le sitemap et vérifie que
   chaque alternat pointe en retour. La panne est silencieuse (§4.3), donc elle doit être
   détectée par une machine.
4. **Contrôle de validité des données structurées** — validation de chaque gabarit en
   intégration continue, en particulier le gabarit de menu qui est généré pour des centaines
   de pages : une erreur dans le gabarit est une erreur multipliée par le nombre de clients.
5. **Contrôle du HTML rendu** — `curl` sur trois pages publiques de types différents ;
   présence du `<h1>`, du canonique, du titre. Détecte une régression de SSR avant qu'elle
   n'atteigne l'index.
6. **Budget de performance** — mesure sur profil mobile bridé à chaque déploiement, échec si
   dépassement.

### 9.5 Séquence de mise en œuvre

| Phase | Contenu | Pourquoi dans cet ordre |
|---|---|---|
| **Avant la mise en ligne** | `robots.txt`, `sitemap.xml`, canoniques, `hreflang`, en-têtes, `noindex` sur `/r/*` et `/app/*`, contrôles 9.4 (1, 2, 3, 5) | Ce sont les seules choses qu'il est **coûteux de corriger après coup**. Une URL de session indexée se désindexe lentement — Google note que *« it may take months for Googlebot to revisit a page »* ([block-indexing](https://developers.google.com/search/docs/crawling-indexing/block-indexing), consulté le 2026-09-17). |
| **Mise en ligne** | Sitemap marketing complet (§3.2), `Organization`, `BreadcrumbList`, `Article` | Le socle. |
| **Semaines 1–8** | Clusters 1 et 4 (P0) : encaissement + équipement. Pages marché CI et SN. | On commence là où le SERP est faible et l'intention d'achat forte. |
| **Semaines 9–16** | Clusters 2 et 5 (P1). Pages marché BJ et CM. Menus publics + porte de qualité (§7.5). | La boucle de croissance ne s'ouvre qu'une fois la porte de qualité en place — pas avant. |
| **Mois 5–8** | Clusters 3 et 6 (P2). `/modeles/*`. Version anglaise des piliers les plus performants. | On ne traduit que ce qui a fait ses preuves en français. |
| **Mois 9+** | Réexamen du Groupe 3 (générique). Pages de comparaison, si et seulement si nous avons des clients et des comparaisons honnêtes. | §1, Groupe 8. |

---

## 10. Sources

Toutes consultées le **2026-09-17**.

**Google Search Central**
- [Core Web Vitals and Google Search results](https://developers.google.com/search/docs/appearance/core-web-vitals) — LCP 2,5 s, INP 200 ms, CLS 0,1
- [Introducing INP to Core Web Vitals](https://developers.google.com/search/blog/2023/05/introducing-inp) — INP remplace FID
- [Tell Google about localized versions](https://developers.google.com/search/docs/specialty/international/localized-versions) — `hreflang`, réciprocité, `x-default`
- [Managing multi-regional and multilingual sites](https://developers.google.com/search/docs/specialty/international/managing-multi-regional-sites) — structures d'URL, interdiction de la redirection automatique
- [How x-default can help you](https://developers.google.com/search/blog/2023/05/x-default)
- [robots.txt specifications](https://developers.google.com/search/docs/crawling-indexing/robots/robots_txt) — champs supportés, `noindex` non supporté
- [Block search indexing with noindex](https://developers.google.com/search/docs/crawling-indexing/block-indexing) — `X-Robots-Tag`, incompatibilité avec `Disallow`
- [Build and submit a sitemap](https://developers.google.com/search/docs/crawling-indexing/sitemaps/build-sitemap) — 50 000 URL / 50 Mo, `priority` et `changefreq` ignorés
- [Canonicalization and duplicate URLs](https://developers.google.com/search/docs/crawling-indexing/consolidate-duplicate-urls) — signal et non directive
- [Spam policies](https://developers.google.com/search/docs/essentials/spam-policies) — scaled content abuse, doorway abuse (mis à jour 2026-08-28)
- [Creating helpful, reliable, people-first content](https://developers.google.com/search/docs/fundamentals/creating-helpful-content) — E-E-A-T, « who / how / why »
- [Structured data markup that Google Search supports](https://developers.google.com/search/docs/appearance/structured-data/search-gallery) — galerie complète
- [Organization](https://developers.google.com/search/docs/appearance/structured-data/organization)
- [Breadcrumb](https://developers.google.com/search/docs/appearance/structured-data/breadcrumb)
- [Article](https://developers.google.com/search/docs/appearance/structured-data/article)
- [Software app](https://developers.google.com/search/docs/appearance/structured-data/software-app) — `aggregateRating` ou `review` obligatoire
- [Product](https://developers.google.com/search/docs/appearance/structured-data/product)
- [FAQPage](https://developers.google.com/search/docs/appearance/structured-data/faqpage) et [Changes to HowTo and FAQ rich results](https://developers.google.com/search/blog/2023/08/howto-faq-changes) — restriction gouvernement/santé
- [Local business](https://developers.google.com/search/docs/appearance/structured-data/local-business) — sous-type `Restaurant`, `menu`, `servesCuisine`
- [Performance report](https://support.google.com/webmasters/answer/7576553) et [Search Analytics API](https://developers.google.com/webmaster-tools/search-console-api-original/v3/searchanalytics/query)

**web.dev**
- [INP is officially a Core Web Vital](https://web.dev/blog/inp-cwv-launch) — 12 mars 2024, 75ᵉ centile
- [Chrome ends support for First Input Delay](https://web.dev/blog/fid) — 10 septembre 2024

**Schema.org** (V30.1)
- [Menu](https://schema.org/Menu) · [MenuItem](https://schema.org/MenuItem) · [MenuSection](https://schema.org/MenuSection) · [Restaurant](https://schema.org/Restaurant)

**TanStack**
- [TanStack Start — SEO](https://tanstack.com/start/latest/docs/framework/react/guide/seo) — `head`, `meta`, `links`, `scripts`, `sitemap[.]xml.ts`, `robots[.]txt.ts`
- [TanStack Start — Server routes](https://tanstack.com/start/latest/docs/framework/react/guide/server-routes) — `server.handlers`, échappement `[.]`
- [TanStack Start — GEO](https://tanstack.com/start/latest/docs/framework/react/guide/geo) — SSR et robots d'IA, `llms.txt`
- [Annonce TanStack Start v1](https://tanstack.com/blog/announcing-tanstack-start-v1) — v1.0, mars 2026

**MDN**
- [Referrer-Policy](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Referrer-Policy) — défaut `strict-origin-when-cross-origin`

**Observation directe des résultats de recherche (2026-09-17)** — acteurs relevés :
*International/FR* : MyDigiMenu, iMenuPro, MustHaveMenus, OddMenu, FineDine, TableQR,
QRCodeKIT, ID Menu, Karta, doXmenu, Foodiv, Collectly, Qoul, MenuForma, LaBigCom,
Lightspeed, Tickeat, QR2App, Resmio, AltTab, Feedup, Skello, Combo, Factorial, Agendrix,
CoverManager, Komia, Zenchef, Asterio, Inpulse, Koust, Adoria, CosKitchen, RestoMaestro,
Coopeo, Toast, Oracle, PAR, GoTab, Crunchtime.
*Afrique francophone* : Zeat, KiboERP, ZYVO, Caisseweb, mybe, digabloPos, Moo Sync, Sekoya
Group, Akwabax, Avobi, ChicMenu, e-maquis, MaquisApp, MaquisBar, Baol Caisse, DakarApps,
Yorine, Kolonell, PayTech, Change.sn, Kkiapay, Facturaal.

---

## 11. Cinq décisions à faire valider

Signalées explicitement parce qu'elles engagent l'architecture et qu'elles doivent être
tranchées avant l'implémentation, pas pendant.

1. **Hôte séparé pour les menus clients** (`menus.example.com`, §7.4). Cloisonne la
   réputation, les rapports et les règles. Coût : une propriété et un pipeline de plus.
2. **Échange jeton → cookie + redirection** pour les sessions de table (§7.1). C'est une
   décision de sécurité avec des conséquences SEO, pas l'inverse. Elle doit figurer dans
   `SECURITY.md` et dans le modèle de menaces (§87), pas seulement ici.
3. **Une seule locale française, pas de variantes par pays** (§4.2). La différenciation
   passe par des pages marché distinctes, jamais par des copies localisées.
4. **Porte de qualité obligatoire avant indexation d'un menu** (§7.5). Cela ralentira la
   boucle de croissance à court terme. C'est volontaire, et c'est aussi ce qui la rend
   durable.
5. **Pas de `FAQPage` ni de `Product` comme leviers, pas de `SoftwareApplication` avec note
   avant d'avoir de vrais avis** (§6). Renoncer à des résultats enrichis qui n'existent plus,
   ou qu'on ne peut obtenir qu'en trichant.
