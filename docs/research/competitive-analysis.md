# Analyse concurrentielle — logiciels de restauration

**Objet** : positionner un « Restaurant OS » (le QR n'est que le point d'entrée) visant en priorité l'Afrique francophone.
**Date de consultation de toutes les sources** : 2026-09-17.
**Statut** : document de recherche. Aucune donnée n'est extrapolée ; ce qui n'a pas été vérifié est marqué **« non vérifié »**.

---

## 0. Méthodologie et niveau de preuve

Trois niveaux de preuve sont utilisés dans tout le document. Ils sont indiqués explicitement parce qu'ils ne se valent pas.

| Niveau | Signification |
|---|---|
| **P** — primaire | Page de l'éditeur lui-même (tarifs, documentation produit) ou source officielle (administration fiscale). |
| **S** — secondaire | Site de comparaison, presse spécialisée, cabinet d'analyse. Le chiffre est rapporté, pas constaté. |
| **NV** — non vérifié | Information cherchée et **non trouvée** de source publique. Traitée comme inconnue, jamais comblée. |

Deux limites méthodologiques importantes, qui sont elles-mêmes des résultats :

1. **La majorité des acteurs « QR / commande à table » ne publient aucun prix.** me&u, Mr Yum, Deliverect, UEAT, Otter (partiellement) renvoient tous vers un formulaire commercial. Le tarif est donc négocié par établissement et non comparable. C'est traité comme une donnée en soi au §6.8 et au §8.
2. **Les résultats de recherche sur le marché africain sont fortement pollués.** Une part notable des pages qui remontent sur « logiciel caisse restaurant Côte d'Ivoire », « best restaurant POS Nigeria », etc. sont des pages d'atterrissage à mot-clé exact, sans mentions légales, sans entité juridique, sans client nommé — parfois hébergées sur des sous-domaines de générateurs de sites. Chaque acteur africain cité ci-dessous a donc été ouvert individuellement et fait l'objet d'une **évaluation d'authenticité** (§3). Ce bruit est lui-même un signal de marché (§6).

**Vérification demandée et négative** : les acteurs **Yaba**, **Sanaa** et **Lengo** ont été cherchés explicitement comme logiciels de caisse / gestion de restaurant en Afrique de l'Ouest. **Aucun des trois ne ressort comme éditeur de POS restaurant** dans les recherches menées (`Yaba POS restaurant Afrique OR Sanaa POS OR Lengo POS restaurant Sénégal Cameroun logiciel`, consulté le 2026-09-17). Ils ne sont donc pas traités comme des concurrents. Leur existence sous une autre forme (autre secteur, autre géographie, marque non indexée) n'est **ni confirmée ni infirmée**.

**Conversions** : le franc CFA (XOF/XAF) est en parité fixe avec l'euro à 655,957 FCFA = 1 EUR. Les équivalents en euros donnés pour les prix en FCFA sont donc exacts. Les montants en cédis (GHS), nairas (NGN) et dirhams (MAD) sont laissés en monnaie locale : ces devises flottent et une conversion datée serait trompeuse.

---

## 1. Fiches détaillées — POS / restaurant international

### 1.1 Toast

| Critère | Constat |
|---|---|
| **Proposition de valeur** | POS restaurant tout-en-un aux États-Unis, matériel + logiciel + paiement intégrés et indissociables. Environ 106 000 restaurants. **(S)** |
| **Onboarding** | Piloté par un commercial, avec matériel à installer. Frais d'installation et de mise en service mentionnés parmi les coûts additionnels. **(S)** |
| **Menu** | Gestion de menu complète, modificateurs, menus par canal. **(S)** |
| **Commande** | POS fixe, terminal de poche (Toast Go 2), borne, commande en ligne, QR. **(S)** |
| **Kitchen / KDS** | KDS matériel propriétaire, 599–1 199 $. **(S)** |
| **Paiement** | **Obligatoirement Toast.** Le taux ne se négocie pas ailleurs. ~2,49 % + 0,15 $ en présentiel sur le plan à 69 $ ; ~3,09–3,69 % + 0,15 $ sur l'offre gratuite ; ~3,5 % + 0,15 $ en ligne. **(S)** |
| **Multi-site** | Offre « Custom & Multi-Location » sur devis. **(S)** |
| **Analytics** | Reporting inclus ; modules avancés facturés en sus. **(S)** |
| **Pricing** | Starter Kit 0 $/mois ; Point of Sale 69 $/mois ; multi-site sur devis. Matériel : Flex 799–1 199 $, Go 2 409–699 $, borne 1 099–1 899 $. **(S)** |
| **Différenciation** | Intégration verticale totale (logiciel + matériel + acquisition + financement). |
| **UX** | Réputée solide et pensée pour le service. Non testée ici. **(NV)** |
| **Points faibles** | Verrouillage sur le paiement ; coût réel très supérieur à l'abonnement affiché ; **disponible uniquement aux États-Unis, Canada, Irlande et Royaume-Uni** — donc absent d'Afrique. **(S)** |
| **Mode hors-ligne** | **Le point le plus important de toute cette analyse.** Voir §6.1 : documentation Toast, source primaire. |
| **Innovation à retenir** | Le matériel de poche pour la prise de commande en salle, et le financement du matériel étalé. |

Sources : [upmenu.com/blog/toast-pricing](https://www.upmenu.com/blog/toast-pricing/) (article daté « mis à jour le 12 mai 2026», consulté 2026-09-17) ; [technology.toasttab.com/entry/internationalization-toast](https://technology.toasttab.com/entry/internationalization-toast/) et [paymentsdive.com](https://www.paymentsdive.com/news/lightspeed-ceo-jp-chauvet-toast-restaurant-pos-payments-european-market/699708/) (consulté 2026-09-17) pour la couverture géographique.
**Note de fiabilité** : `pos.toasttab.com/pricing` renvoie HTTP 403 aux requêtes automatisées (testé 2026-09-17). Les tarifs Toast ci-dessus sont donc **secondaires** et doivent être reconfirmés auprès de l'éditeur avant toute décision.

---

### 1.2 Square for Restaurants

| Critère | Constat |
|---|---|
| **Proposition de valeur** | POS restaurant greffé sur l'écosystème Square ; entrée de gamme gratuite, montée en charge payante. |
| **Onboarding** | Auto-service, sans commercial. C'est le meilleur onboarding du panel, et le plus imitable. |
| **Menu / commande** | Menus, plan de salle, commande en ligne, QR. |
| **KDS** | Disponible ; inclus selon le palier. **(S)** |
| **Paiement** | Square, 2,6 % + 10 ¢ en présentiel ; 2,9 % + 30 ¢ en ligne. **(S)** |
| **Multi-site** | Tarification **par établissement**. |
| **Pricing** | Free 0 $ ; Plus 49 $/mois/site ; Premium 149 $/mois/site. **(S)** |
| **Différenciation** | Le palier gratuit réellement utilisable, et l'absence totale de friction commerciale à l'entrée. |
| **Points faibles** | Coût qui grimpe par site ; profondeur restaurant inférieure à Toast/Lightspeed ; **mode hors-ligne fortement contraint** (§6.1). |
| **Innovation à retenir** | Le « free tier » comme canal d'acquisition, sans démo ni devis. |

Sources : [nerdwallet.com](https://www.nerdwallet.com/business/software/reviews/square-for-restaurants), [capterra.com](https://www.capterra.com/p/175628/Square-Point-of-Sale/pricing/) (consultés 2026-09-17).
**Note de fiabilité** : les pages tarifaires de `squareup.com` ont renvoyé HTTP 429 à quatre reprises (testé 2026-09-17). Les montants sont donc **secondaires**. En revanche la documentation hors-ligne de Square a été obtenue en **source primaire** (§6.1).

---

### 1.3 Lightspeed Restaurant

| Critère | Constat |
|---|---|
| **Proposition de valeur** | POS restaurant cloud, positionné sur la profondeur fonctionnelle et le multi-site. |
| **Menu / commande** | Menus personnalisables, plans de salle, commande et paiement à table **en option payante**. |
| **KDS** | **30 $/écran/mois**, en supplément. |
| **Paiement** | Lightspeed Payments par défaut ; traitement personnalisé accessible seulement à partir du palier Essential. |
| **Multi-site** | Gestion multi-établissements **à partir de Premium (399 $/mois)**. |
| **Analytics** | « Advanced Insights » et IA à partir d'Essential. |
| **Pricing** | Starter **69 $/mois** · Essential **189 $/mois** · Premium **399 $/mois** · Enterprise sur devis. |
| **Différenciation** | API brute accessible au palier Premium — rare dans le panel. |
| **Points faibles** | Escalade tarifaire brutale entre paliers ; le multi-site, besoin structurant des groupes, est réservé au palier le plus cher ; KDS facturé à l'écran, ce qui pénalise précisément les cuisines à plusieurs postes. |
| **Innovation à retenir** | L'accès API en self-service plutôt que par contrat d'intégration. |

Source **primaire** : [lightspeedhq.com/pos/restaurant/pricing](https://www.lightspeedhq.com/pos/restaurant/pricing/) (consulté 2026-09-17). Taux de commission de paiement **non publiés sur cette page (NV)**.

---

### 1.4 Oracle MICROS Simphony

| Critère | Constat |
|---|---|
| **Proposition de valeur** | POS d'entreprise pour l'hôtellerie-restauration, héritage MICROS, orienté grands comptes et chaînes internationales. |
| **Onboarding** | Projet d'intégration, pas une inscription. Installation, paramétrage, formation. |
| **Multi-site** | C'est son terrain. Déploiements multi-pays, multi-marques. |
| **Pricing** | Essentials à partir de **55 $/mois**, Plus à partir de **75 $/mois** ; déploiements mono-tenant sur devis. Matériel : 2 500–8 000 $ par terminal complet. **(S)** |
| **Différenciation** | Robustesse, architecture hybride avec résilience locale, présence internationale. |
| **Points faibles** | Coût total de possession très élevé et opaque ; dépendance matérielle ; cycle de vente long ; ergonomie héritée. |
| **Innovation à retenir** | L'architecture hybride cloud + local, conçue pour que le service continue quand le réseau tombe. C'est le seul grand acteur à traiter cela comme une exigence d'architecture et non comme un mode dégradé. |

Sources : [loman.ai/blog/micros-pricing](https://loman.ai/blog/micros-pricing), [costbench.com](https://costbench.com/software/restaurant-pos/oracle-micros/) (consultés 2026-09-17).
**Note de fiabilité** : `oracle.com/food-beverage/micros/` renvoie HTTP 403 aux requêtes automatisées (testé 2026-09-17). Tarifs **secondaires**. Oracle ne publie pas de grille officielle : ces montants sont à considérer comme des ordres de grandeur rapportés, pas comme un tarif officiel.

---

## 2. Fiches détaillées — QR, commande à table, agrégation

### 2.1 GloriaFood

| Critère | Constat |
|---|---|
| **Proposition de valeur** | Commande en ligne **gratuite** (livraison, à emporter, sur place), réservation, marketing automatisé. Monétisation par options. |
| **Pricing** | Socle 0 €, sans engagement. Paiement en ligne **29 $/mois**. Application mobile de marque **59 $/mois**. Promotions avancées **19 $/mois**. Commission de paiement annoncée à **2 %**. POS séparé à **49 $/mois**. **(S)** |
| **Différenciation** | Le gratuit sans carte bancaire, qui en fait la porte d'entrée par défaut des petits établissements. |
| **Points faibles** | Pas un OS de service : pas de gestion de salle, pas de KDS de premier plan, pas de multi-site sérieux. Le gratuit sert d'appel vers les options. |
| **Innovation à retenir** | Le découpage en modules à petit prix plutôt qu'en paliers, qui laisse l'établissement composer. |

Sources : [gloriafood.com/pricing](https://www.gloriafood.com/pricing), [gloriafood-pos.com/pricing](https://www.gloriafood-pos.com/pricing) (consultés 2026-09-17, via résultats de recherche — **S**).

---

### 2.2 sunday

| Critère | Constat |
|---|---|
| **Proposition de valeur** | Paiement à table par QR, sans application : scanner, partager l'addition, laisser un pourboire, payer. Promesse de « 10 secondes pour payer ». |
| **Commande** | Commande et paiement à table, terminaux de poche. |
| **Paiement** | Cœur du produit : addition numérique, partage d'addition, pourboire optimisé par IA, rapprochement automatisé. |
| **Analytics** | Tableau de bord d'exploitation, données clients, suivi de la performance du personnel, gestion de la réputation en ligne. |
| **Pricing** | **Standard 199 $/mois** · **Premium 299 $/mois** · **QR codes 5 $ pièce** · onboarding physique 299 $ en option sur Standard, inclus sur Premium. Taux de commission **non publiés (NV)**. |
| **Multi-site** | « Enterprise pack » au palier Premium. |
| **Différenciation** | L'obsession du temps de paiement et la capture d'avis au moment du paiement. |
| **Points faibles** | Cher pour ce que c'est — 199 $/mois pour une couche de paiement, sans POS ; présence limitée à 8 pays ; **facturation du QR code à l'unité**, ce qui est une friction absurde à l'échelle d'une salle. |
| **Innovation à retenir** | Déclencher la demande d'avis Google au moment exact du paiement, quand le client est encore attablé et satisfait. C'est le meilleur détail produit du panel. |

Source **primaire** : [sundayapp.com/pricing](https://sundayapp.com/pricing/) (consulté 2026-09-17). 8 pays et 5 000+ restaurants revendiqués sur cette même page.

---

### 2.3 Tabesto

| Critère | Constat |
|---|---|
| **Proposition de valeur** | Bornes de commande pour la restauration rapide, référence revendiquée en France avec 2 500 restaurateurs clients. **(S)** |
| **Pricing** | Matériel : borne 22 pouces avec paiement intégré ~1 600 €, ~2 500 € installée pour la première, ~2 000 € les suivantes. Commissions de paiement regroupées sous un taux unique dégressif au volume. Devis personnalisé. **(S)** |
| **Différenciation** | Le taux de paiement unique et transparent, dégressif — rare et honnête dans ce secteur. |
| **Points faibles** | Modèle centré sur le matériel, donc capitalistique et peu transposable là où l'investissement initial est un obstacle. Marché essentiellement français. |
| **Innovation à retenir** | FOX, borne gérant commande et paiement sur un seul écran. Et surtout : **afficher un taux de commission unique** au lieu d'un empilement interchange + acquisition + service. |

Sources : [tabesto.com/en/tarifs](https://tabesto.com/en/tarifs), [lhotellerie-restauration.fr](https://www.lhotellerie-restauration.fr/actualite/fox-borne-pour-gerer-la-commande-et-le-paiement-sur-un-seul-ecran) (consultés 2026-09-17).

---

### 2.4 Flipdish

| Critère | Constat |
|---|---|
| **Proposition de valeur** | Canal de commande direct de marque — site, application, borne — pour échapper aux commissions des agrégateurs. |
| **Pricing** | **Starter 119 $/mois** (149 $ si mensuel), **Professional 199 $/mois** (249 $ si mensuel), **Kiosk 79 $/mois** (99 $ si mensuel). Par établissement. Matériel en sus. |
| **Multi-site** | Gestion centralisée des menus et reporting consolidé. |
| **Points faibles** | Coût par site élevé pour un canal de commande ; le matériel de borne reste à financer ; pas un POS. |
| **Innovation à retenir** | La remise explicite pour engagement annuel, affichée en clair à côté du prix mensuel. |

Source **primaire** : [flipdish.com/us/pricing](https://www.flipdish.com/us/pricing) (consulté 2026-09-17).

---

### 2.5 Mr Yum / me&u — **fusionnés**

**Fait structurant** : Mr Yum (Melbourne) et me&u (Sydney), les deux rivaux historiques de la commande par QR, **ont fusionné** par échange d'actions pour former un ensemble d'environ **6 000 établissements** en Australie, Nouvelle-Zélande, Royaume-Uni et États-Unis. Kim Teo (Mr Yum) a pris la direction générale, Stevan Premutico (me&u) un siège d'administrateur non exécutif. **(S)**

| Critère | Constat |
|---|---|
| **Pricing** | **Non publié (NV).** Devis par établissement, indexé sur le volume. Des sources secondaires évoquent 200 à 500 $+/mois pour Mr Yum avant fusion — à traiter comme une indication, pas comme un tarif. |
| **Différenciation** | Le menu comme média : photographies, filtres allergènes, découverte, recommandations. |
| **Points faibles** | Opacité tarifaire totale ; consolidation qui réduit le choix et signale que le QR seul ne suffit pas à tenir une entreprise. |
| **Innovation à retenir** | Le menu visuel qui augmente le panier moyen — le QR traité comme une surface de vente, pas comme un PDF. |

Sources : [smartcompany.com.au](https://www.smartcompany.com.au/industries/hospitality/mr-yum-meu-merger-restaurant-tech/), [businessnewsaustralia.com](https://www.businessnewsaustralia.com/articles/hospitality-platforms-mr-yum-and-me-u-merging-to-become-a-new-global-giant.html), [margincompare.com.au/meandu](https://margincompare.com.au/meandu) (consultés 2026-09-17).

**Lecture stratégique** : deux leaders d'un marché QR pur qui fusionnent, c'est le signe que **le QR seul n'est pas un produit défendable**. Il devient une fonctionnalité. C'est précisément la prémisse du présent projet.

---

### 2.6 Bopple

| Critère | Constat |
|---|---|
| **Pricing** | **Starter gratuit** (menu numérique, boutique en ligne) · **Online Ordering 49 $/mois** (QR à table, retrait, livraison, précommande, intégrations POS) · marque blanche web **+99 $/mois** · pack applications natives **+399 $/mois**. |
| **Paiement** | Via Stripe. Taux **non publiés sur la page tarifaire (NV)**. Commissions dégressives au volume évoquées sans chiffre. |
| **Intégrations** | Lightspeed Kounta, Square. |
| **Points faibles** | Dépendance à un POS tiers ; commissions non transparentes malgré une grille d'abonnement claire. |
| **Innovation à retenir** | **« Full control of service and order fees »** : le restaurateur fixe lui-même les frais de service répercutés au client. C'est un choix de confiance rare. |

Source **primaire** : [bopple.com/pricing](https://www.bopple.com/pricing) (consulté 2026-09-17). Marchés : AUD/NZD/USD.

---

### 2.7 Otter

| Critère | Constat |
|---|---|
| **Proposition de valeur** | « Restaurant Operating System » revendiqué : agrégation des plateformes de livraison, POS, borne, fidélité, analytics. |
| **Pricing** | **Starter 79 $/mois** (POS + kit matériel) · **Advanced 178 $/mois** (+ agrégation livraison, commande en ligne, **commande par QR**) · **Professional 278 $/mois** (+ site, fidélité, cartes cadeaux). Par établissement, USD uniquement. |
| **Conditions** | **Minimum de 100 $/mois de frais de traitement** si le volume carte est inférieur à 25 000 $/mois. **Engagement de 24 mois** sur la location de matériel. |
| **Points faibles** | Le plancher de 100 $/mois **pénalise mécaniquement les petits établissements** — exactement la cible d'un marché émergent. Engagement de 2 ans sur le matériel. |
| **Innovation à retenir** | Le positionnement « OS » et la baisse du taux de traitement à mesure qu'on monte en palier, affichée comme un bénéfice. |

Source **primaire** : [tryotter.com/pricing](https://www.tryotter.com/pricing) (consulté 2026-09-17).

---

### 2.8 UEAT

| Critère | Constat |
|---|---|
| **Proposition de valeur** | Commande en ligne sans commission pour chaînes, intégrée à Moneris (Canada). Cible annoncée : chaînes de 5 à 200 établissements. **(S)** |
| **Pricing** | Frais mensuels fixes + traitement carte standard. **Montants non publiés (NV).** Offre promotionnelle : 50 % de remise les 3 premiers mois pour un engagement de 12 mois. |
| **Différenciation** | Le « sans commission » comme argument central face aux agrégateurs, et Uboard, commande sur tablette en salle. |
| **Points faibles** | Opacité tarifaire ; adossement fort au Canada et à Moneris. |

Sources : [ueat.io](https://ueat.io/en/), [get.ueat.io/50percent-off-offer](http://get.ueat.io/50percent-off-offer/), [moneris.com — Uboard](https://www.moneris.com/en/solutions/restaurants/uboard) (consultés 2026-09-17).

---

### 2.9 Deliverect

| Critère | Constat |
|---|---|
| **Proposition de valeur** | Intergiciel entre plateformes de livraison et POS : synchronisation des commandes et des menus, analytics. |
| **Couverture** | **Plus de 52 pays**, plus de 50 000 établissements revendiqués. |
| **Pricing** | **Non publié (NV).** « Tarification flexible selon vos besoins », devis obligatoire. |
| **Points faibles** | Opacité tarifaire ; **aucun pays africain ne figure dans le sélecteur de région** de la page tarifaire — 16 régions listées : Australie, Belgique, Canada, France, Allemagne, Italie, LATAM, Mexique, Moyen-Orient, Pays-Bas, Nordiques, Portugal, Espagne, Suisse, Royaume-Uni, États-Unis. |
| **Innovation à retenir** | La synchronisation des menus dans les deux sens, qui règle le vrai problème opérationnel : un plat épuisé doit disparaître de tous les canaux en même temps. |

Source **primaire** : [deliverect.com/en/pricing](https://www.deliverect.com/en/pricing) (consulté 2026-09-17).

---

## 3. Le marché africain — ce qui a réellement été trouvé

Cette section est le résultat d'une recherche active pays par pays. Chaque acteur a été ouvert et évalué. **Aucun n'est présenté comme vérifié au-delà de ce qui a pu l'être.**

### 3.1 Acteurs identifiés

| Acteur | Pays visés | Prix constaté | Éléments notables | Authenticité |
|---|---|---|---|---|
| **DIAM POS** | Sénégal, Côte d'Ivoire, Mali, Guinée, Burkina — « zone UEMOA / 17 pays OHADA » | **À partir de 15 000 FCFA/mois** (≈ 22,87 €) | **Mode local sur réseau du restaurant** (hors-ligne), Mobile Money (Orange Money, Wave, MTN, Moov), facturation conforme OHADA, module restaurant, multi-site. Paiement possible en Mobile Money, virement **ou espèces**. | Prix en monnaie locale, conformité régionale détaillée, WhatsApp +221 76 943 47 15. **Pas d'adresse ni d'entité juridique affichée.** Crédibilité moyenne-haute. |
| **Zeat** | Côte d'Ivoire | **Non publié sur la page consultée (NV)** | Menu QR, commande à table, paiement **Wave et Orange Money**, ciblage explicite « restaurants, maquis, fast-food ». | Téléphone +225 01 72 21 14 48, e-mail, Abidjan, mentions légales présentes. Pas de témoignage client malgré une rubrique « Témoignages », pas d'équipe, pas d'entité juridique. **Jeune structure probable.** |
| **KiboERP** | 11 pays d'Afrique de l'Ouest / UEMOA | Paliers Starter / Essentiel / Pro / Enterprise, **montants non publiés (NV)** ; essai 14 jours | Caisse tactile par table, Mobile Money (Wave, Orange Money, MTN), **comptabilité SYSCOHADA automatisée avec TVA**, recettes et ingrédients, tickets thermiques. | Connaissance métier réelle (SYSCOHADA). **Aucune adresse, aucun téléphone, aucun client nommé**, « 100+ entreprises » sans exemple. Crédibilité moyenne. |
| **CliqPOS** | Ghana, Nigeria | **À partir de 199 GHS/mois** | Plan de salle, KOT cuisine, modificateurs, **partage d'addition**, coût matière par recette, stock à l'ingrédient, session serveur, MTN MoMo, reçus conformes GRA, **mode hors-ligne complet**, support WhatsApp depuis Accra. | Tarification en cédis, conformité fiscale ghanéenne citée. Pages à mot-clé exact (« best-restaurant-pos-… »), typiques d'une stratégie SEO agressive. Crédibilité moyenne. |
| **HilsonPOS** | Ghana | **À partir de 90 GHS/mois** | Intégration facturation MTN MoMo avec enregistrement automatique des paiements. | Crédibilité **non établie (NV)** — page non ouverte individuellement. |
| **MealNix** | Nigeria (et Inde, Qatar, Singapour, EAU) | **Non publié en nairas (NV)** ; offre Starter gratuite + essai 30 jours | TVA 7,5 %, facturation en naira, **Paystack et Flutterwave**, QR à table, KDS, multi-succursale, hors-ligne. | **Éditeur indien** (EdgeSys Technologies, Kerala, +91 90488 32164), application Google Play `com.edgesys.mealnix`. Produit réel mais **acteur étranger ciblant le Nigeria par le SEO**. |
| **Alivaon** | Cameroun (Douala) | **À partir de 10 000 FCFA HT/mois** (2 utilisateurs, ≈ 15,24 €) ; 20 000 FCFA HT (5 utilisateurs, ≈ 30,49 €) | Orange Money et MTN MoMo, formation initiale incluse. | Agence digitale locale identifiée à Douala. Crédibilité moyenne. **(S)** |
| **Akwabax** | Côte d'Ivoire | **NV** | Intégrateur Odoo certifié : caisse, inventaire, ERP restaurant. | Modèle d'intégrateur, pas d'éditeur. **(S)** |
| **Sen-caisse, JAAY CAISSE, KABRAK, iPOS Sénégal** | Sénégal, Cameroun | **NV** | Caisse généraliste, Mobile Money. | **Attention** : iPOS Sénégal est hébergé sur `ipos-snap-shop.lovable.app`, un sous-domaine de générateur de sites — signal fort de prototype ou de vitrine non consolidée. |
| **Systeme Maroc** | Maroc | **Startup 250 DH/mois · Professional 329 DH/mois · Premium 750 DH/mois** (multi-boutique illimité) | Grille publique et lisible. | **(S)** |
| **QuickCom** | Maroc | **À partir de 299 DH/mois** | Caisse restaurant. | **(S)** |
| **Sagatec — « Ma Caisse »** | Maroc | **3 900 MAD HT** en licence ; pack TPV complet **10 500 MAD HT** | Gestion des tables, envoi cuisine, **additions partagées**, suivi des serveurs. Réseau de revendeurs national. | Modèle licence + matériel, revendeurs physiques. **(S)** |
| **Odoo via Oasis Techno Cloud** | Maroc | Pack Café 9 900 MAD, Restaurant complet 15 900 MAD, Multi-site 22 900 MAD — **réduits à 990 / 1 590 / 2 290 MAD via la subvention MOWAKABA (90 %)** | | **Point remarquable** : un dispositif public de subvention à la digitalisation **modifie radicalement l'économie de l'achat**. **(S)** |

Sources : [diampos.net](https://www.diampos.net/) (**P**), [zeatapp.com](https://zeatapp.com/logiciel-restaurant-cote-divoire/) (**P**), [kiboerp.com/erp/restaurant](https://kiboerp.com/erp/restaurant) (**P**), [mealnix.com](https://mealnix.com/best-restaurant-pos-in-nigeria) (**P**), [cliqpos.com](https://cliqpos.com/restaurant-pos-accra), [hilsonpos.com](https://hilsonpos.com/pos-system-ghana), [alivaon.com](https://www.alivaon.com/services/logiciel-de-caisse-pos-douala), [systememaroc.com](https://systememaroc.com/), [quickcom.ma](https://quickcom.ma/activites/restaurant), [sagatec.ma](https://www.sagatec.ma/caisse-restaurant/), [oasistechnocloud.com](https://oasistechnocloud.com/blog/logiciel-gestion-restaurant-maroc/) — tous consultés 2026-09-17.

### 3.2 Ce que cette cartographie dit vraiment

1. **Les leaders mondiaux sont absents.** Toast : États-Unis, Canada, Irlande, Royaume-Uni. Deliverect : 52 pays, aucun africain dans son sélecteur. sunday : 8 pays. Flipdish, Otter, UEAT, Bopple, me&u : marchés anglo-saxons et européens. **Aucun des treize acteurs internationaux étudiés n'a de présence africaine documentée.**
2. **Le marché est tenu par des acteurs locaux fragmentés**, souvent mono-pays, à faible surface web, sans entité juridique affichée, parfois sans tarif public.
3. **Le prix de référence local est 3 à 10 fois inférieur** à celui des solutions occidentales : 10 000–20 000 FCFA/mois au Cameroun, à partir de 15 000 FCFA/mois en zone UEMOA, 199 GHS/mois au Ghana, 250–750 MAD/mois au Maroc. Rapportées à l'euro, les offres UEMOA se situent entre **15 € et 31 € par mois** — à comparer aux 69 $ de Toast ou aux 199 $ de sunday.
4. **Personne ne fait le « Restaurant OS » complet.** Les locaux font de la caisse conforme. Zeat fait du QR. Les internationaux font l'OS mais ne sont pas là. **La case est vide.**
5. **Des éditeurs étrangers arrivent par le SEO** (MealNix depuis l'Inde). La fenêtre n'est pas indéfiniment ouverte.

---

## 4. Tableau comparatif de synthèse

| Produit | Catégorie | Prix affiché | Prix public ? | Paiement imposé ? | KDS | Multi-site | Hors-ligne | Afrique | Mobile Money |
|---|---|---|---|---|---|---|---|---|---|
| **Toast** | POS lourd intégré | 0 / 69 $ / devis | Partiel (**S**) | **Oui** | Matériel 599–1 199 $ | Devis | Dégradé, **pas de sync inter-terminaux** | Non (US/CA/IE/UK) | Non |
| **Square for Restaurants** | POS SaaS | 0 / 49 / 149 $ par site | Oui (**S**) | Oui | Inclus selon palier | Par site | 72 h max, risque au marchand | Non | Non |
| **Lightspeed Restaurant** | POS SaaS profond | 69 / 189 / 399 $ | **Oui (P)** | Par défaut | **+30 $/écran/mois** | **Premium seulement** | Annoncé sur tous paliers | Non | Non |
| **Oracle Simphony** | POS entreprise héritage | dès 55–75 $ + matériel | Non (**S**) | Non | Inclus projet | Oui, c'est sa force | Architecture hybride | Non documentée | Non |
| **GloriaFood** | Commande en ligne | 0 € + options 19/29/59 $ | Oui (**S**) | Non | Faible | Faible | **NV** | Non ciblée | Non |
| **sunday** | Paiement QR | **199 / 299 $** + 5 $/QR | **Oui (P)** | Oui | Non | Premium | **NV** | Non (8 pays) | Non |
| **Tabesto** | Bornes | ~1 600–2 500 € matériel | Partiel (**S**) | Taux unique dégressif | n/a | Devis | **NV** | Non | Non |
| **Flipdish** | Canal direct | 119 / 199 / 79 $ par site | **Oui (P)** | Oui | Non | Centralisé | **NV** | Non | Non |
| **Mr Yum / me&u** | QR menu média | **Non publié** | **Non** | Oui | Non | **NV** | **NV** | Non | Non |
| **Bopple** | Commande QR | 0 / 49 $ + 99 / 399 $ | **Oui (P)** | Stripe | Non | **NV** | **NV** | Non | Non |
| **Otter** | « rOS » | 79 / 178 / 278 $ | **Oui (P)** | Oui, **plancher 100 $/mois** | Oui | Professional | **NV** | Non | Non |
| **UEAT** | Commande chaînes | **Non publié** | **Non** | Moneris | Non | Oui (5–200 sites) | **NV** | Non | Non |
| **Deliverect** | Agrégation | **Non publié** | **Non** | n/a | n/a | Oui | **NV** | **Aucun pays africain listé** | Non |
| **DIAM POS** | POS local UEMOA | **dès 15 000 FCFA** | **Oui (P)** | Non | **NV** | Oui | **Mode local réseau** | **Oui** | **Oui** |
| **CliqPOS** | POS local GH/NG | **dès 199 GHS** | Oui (**S**) | Non | KOT imprimante | **NV** | **Complet** | **Oui** | **Oui (MoMo)** |
| **Zeat** | QR local CI | **NV** | Non | Wave / OM | **NV** | **NV** | **NV** | **Oui** | **Oui** |
| **KiboERP** | ERP restaurant UEMOA | **NV** | Non | Non | **NV** | Oui | **NV** | **Oui** | **Oui** |

---

## 5. Matrice de positionnement

```
                    PROFONDEUR OPÉRATIONNELLE (salle + cuisine + stock + compta)
                    faible ──────────────────────────────────────────► forte

    moderne   │  GloriaFood        Bopple         Otter « rOS »      Toast
              │  Zeat              Flipdish       Square Rest.       Lightspeed
    UX /      │  sunday            me&u/Mr Yum
    modèle    │  ── MENU QR SEUL ──┤              ├── VRAI OS DE SERVICE ──┤
    SaaS      │                    │              │
              │                    │              │
              │  ─────────────────────────────────┼──────────────────────────
              │                                   │
    héritage  │  (vitrines locales                │   Oracle MICROS Simphony
    / lourd   │   non consolidées)                │   DIAM POS · CliqPOS · KiboERP
              │                                   │   (locaux, conformes, sobres)
              ▼
```

**Trois blocs, et une case vide.**

- **Bloc « menu QR seul »** — GloriaFood, Bopple, sunday, Zeat, me&u/Mr Yum, Flipdish. Excellente UX d'entrée, faible profondeur. **Ce bloc se consolide** : la fusion Mr Yum / me&u en est la preuve. Le QR seul n'est pas défendable.
- **Bloc « vrai OS de service »** — Toast, Lightspeed, Square, Otter. Profondeur réelle, UX moderne, **mais coût élevé, paiement imposé, et absence totale d'Afrique**.
- **Bloc « POS lourd héritage »** — Oracle Simphony ; et, à un tout autre niveau de prix, les POS locaux africains (DIAM POS, CliqPOS, KiboERP) qui partagent avec lui la sobriété fonctionnelle et la priorité donnée à la conformité et à la résilience, sans la modernité d'usage.

**La case vide, qui est le positionnement visé** : un **OS de service moderne**, à profondeur comparable au bloc 2, à un prix et avec des contraintes d'infrastructure compatibles avec le bloc 3 africain. Personne ne l'occupe.

---

## 6. Ce que personne ne fait bien — les angles morts

### 6.1 Le hors-ligne est traité comme une panne, pas comme un mode de fonctionnement

**C'est l'angle mort le plus exploitable, et il est documenté par les concurrents eux-mêmes.**

La documentation officielle de Toast énonce : **« Devices cannot sync with each other while offline, so orders added or updated on one device do not appear on other devices. »** Toast recommande alors que *chaque employé choisisse un seul appareil* pour prendre et modifier les commandes. En mode hors-ligne, Toast ne peut pas non plus : afficher les commandes POS et borne sur les écrans de cuisine, envoyer ou recevoir les commandes borne, pointer les entrées/sorties sur un autre appareil, ni même **se connecter ou se déconnecter de l'application POS**. Le paiement EMV est indisponible — seule la piste magnétique fonctionne.
Source **primaire** : [doc.toasttab.com — Offline mode](https://doc.toasttab.com/doc/platformguide/platformOfflineMode.html), consulté 2026-09-17.

Square, de son côté : les paiements hors-ligne doivent être téléversés **dans les 72 heures** sous peine d'expiration, et **« You're responsible for any expired, declined, or disputed payments accepted while taking offline payments. »** Le risque est intégralement transféré au commerçant.
Source **primaire** : [squareup.com — Process offline payments](https://squareup.com/help/us/en/article/7777-process-card-payments-with-offline-mode), consulté 2026-09-17.

**Traduction concrète** : dans un restaurant sans internet, Toast cesse d'être un système de restaurant. Le serveur ne peut plus envoyer en cuisine, la cuisine ne voit plus rien, et deux serveurs sur deux terminaux travaillent en aveugle l'un de l'autre. C'est acceptable une heure par trimestre à Boston. C'est rédhibitoire à Abidjan, Douala ou Lagos.

Fait notable : ce sont les **acteurs africains** qui traitent le sujet sérieusement — DIAM POS fonctionne « en mode local sur votre réseau », CliqPOS revendique un mode hors-ligne complet. Mais sans la profondeur ni l'UX du bloc 2.

**L'angle mort est donc précis : personne ne propose un OS de service moderne dont le hors-ligne multi-appareils est le mode nominal.**

### 6.2 Le Mobile Money est absent de toutes les solutions internationales

Sur les treize solutions internationales étudiées, **aucune** ne mentionne Wave, Orange Money, MTN MoMo ou Moov Money. Toutes supposent une carte bancaire et un terminal. Or en Afrique de l'Ouest, le mobile money a représenté **498 milliards de dollars de transactions en 2025**, avec **76 services actifs** — le plus grand nombre de toutes les régions du monde ([GSMA via connectingafrica.com](https://www.connectingafrica.com/mobile-money/-1-4t-flowed-through-mobile-money-in-sub-saharan-africa-in-2025-gsma), consulté 2026-09-17).

Les commissions marchands y sont par ailleurs **structurellement plus basses** que les taux carte occidentaux : Wave Côte d'Ivoire ≈ **1 %** sur encaissement API, Orange Money **1 à 1,2 %**, agrégateurs type CinetPay **1,5 à 2 %** ([kolonell.com](https://kolonell.com/fr/blog/passerelle-paiement-cote-divoire-wave-orange-mtn-2026), [kkiapay.me](https://kkiapay.me/paiements-en-ligne-afrique-ouest-4/), consultés 2026-09-17) — contre 2,49 % à 3,69 % + 0,15 $ chez Toast. **(S)**

### 6.3 Le mode hybride serveur / client n'est jamais configurable

Le panel se divise en deux dogmes opposés : soit le client commande lui-même (sunday, me&u, Bopple, GloriaFood), soit le serveur prend la commande (Toast, Lightspeed, Simphony). **Aucune solution étudiée ne permet de basculer finement** — par service, par zone de salle, par plage horaire, par table. Or c'est exactement le besoin d'un maquis qui fait du service assis à midi et du comptoir le soir, ou d'un établissement dont la clientèle est mixte.

### 6.4 Le partage d'addition n'est jamais collaboratif

sunday permet de partager l'addition ; CliqPOS et Sagatec gèrent les additions partagées côté caisse. Mais **rien dans le panel ne gère le partage collaboratif en temps réel** : plusieurs convives, chacun sur son téléphone, voyant l'addition se répartir en direct, chacun payant sa part par le moyen qu'il veut — l'un en Wave, l'autre en espèces au serveur, le troisième par carte. **Le paiement mixte espèces/numérique sur une même addition n'est traité nulle part**, alors qu'il est la norme en Afrique de l'Ouest.

### 6.5 Le KDS est facturé, propriétaire, et suppose du bon matériel

Lightspeed facture **30 $ par écran et par mois**. Toast vend un KDS matériel **599 à 1 199 $**. Otter et Square l'incluent selon le palier. Aucun n'est pensé pour tourner sur une tablette Android d'entrée de gamme — alors que **81 % des smartphones vendus en Afrique en 2025 étaient sous la barre des 200 $** et qu'Android Go est préinstallé sur plus de 40 millions d'appareils d'entrée de gamme ([Omdia](https://omdia.tech.informa.com/pr/2026/feb/african-smartphone-market-jumps-14percent-in-4a25-as-entry-tier-pressures-signal-2026-reset), consulté 2026-09-17).

### 6.6 Le multi-site est vendu au prix fort, alors que c'est le besoin des groupes africains

Lightspeed réserve le multi-établissement au palier **Premium à 399 $/mois**. Square facture **par site**. Flipdish facture **par site**. Otter réserve le multi-site à Professional. Or les groupes de restauration africains — chaînes de maquis, groupes hôteliers, franchises régionales — sont souvent **multi-sites avant d'être riches**, et parfois **multi-pays et multi-devises** (zone UEMOA XOF, zone CEMAC XAF, Ghana GHS, Nigeria NGN). Aucune solution du panel ne traite le multi-devises et la consolidation transfrontalière.

### 6.7 La conformité fiscale locale est ignorée par tous les internationaux

Aucune des treize solutions internationales ne mentionne la facture normalisée. Or en **Côte d'Ivoire, la Facture Normalisée Électronique (FNE) est obligatoire pour toutes les entreprises, sans exception de régime fiscal, depuis le 1er décembre 2025**, et **la DGI a lancé des contrôles sur l'ensemble du territoire à compter du 1er septembre 2026** — c'est-à-dire maintenant. Chaque facture doit être transmise au système de la DGI, qui lui attribue un numéro normatif, un visuel FNE et **un QR code de vérification d'authenticité** ([pulse.ci](https://www.pulse.ci/article/facture-normalisee-electronique-fne-tout-ce-qui-change-pour-les-entreprises-ivoiriennes-en-2026-2026022802421220085), [yeclo.com](https://www.yeclo.com/facture-normalisee-electronique-en-cote-divoire-la-dgi-lance-des-controles-le-1er-septembre/), consultés 2026-09-17 ; portail officiel : [fne.dgi.gouv.ci](https://www.fne.dgi.gouv.ci/index.php) — **renvoyait HTTP 503 au moment de la consultation, détail technique de l'API non vérifié (NV)**).

Les acteurs locaux, eux, l'ont compris : DIAM POS met en avant la conformité OHADA, KiboERP la comptabilité SYSCOHADA avec TVA automatisée, CliqPOS les reçus conformes GRA au Ghana, MealNix la TVA nigériane à 7,5 %.

### 6.8 L'opacité tarifaire est la norme

Cinq acteurs sur treize ne publient **aucun prix** : me&u/Mr Yum, UEAT, Deliverect, et partiellement Oracle et Toast. Trois autres publient l'abonnement mais **pas les commissions de paiement** (Lightspeed, sunday, Bopple). Pour un restaurateur, le coût réel est donc inconnu avant un entretien commercial. C'est une friction, et c'est une faiblesse exploitable.

---

## 7. Opportunités spécifiques au marché africain

| Contrainte réelle (sourcée) | Implication produit |
|---|---|
| **Coupures internet et d'électricité fréquentes.** Coupures de câbles sous-marins, pannes régionales et coupures décidées à l'échelle nationale ont marqué 2025–2026 ([pulse.internetsociety.org](https://pulse.internetsociety.org/blog/major-internet-outages-across-western-and-southern-africa-today), [WEF](https://www.weforum.org/stories/2025/06/how-internet-shutdowns-drain-african-economies/), consultés 2026-09-17). | **Le hors-ligne doit être le mode nominal, pas le mode dégradé.** Synchronisation pair-à-pair sur le réseau local du restaurant : serveurs, caisse et cuisine continuent de se voir sans internet. C'est exactement ce que Toast ne sait pas faire. |
| **81 % des smartphones vendus en Afrique en 2025 sont sous 200 $** ; Android Go massivement déployé ; 84,4 millions d'unités livrées en 2025 (+13 %) ([Omdia](https://omdia.tech.informa.com/pr/2026/feb/african-smartphone-market-jumps-14percent-in-4a25-as-entry-tier-pressures-signal-2026-reset)). | Cible matérielle : **Android d'entrée de gamme, 1–2 Go de RAM, écran modeste**. KDS fonctionnel sur tablette à 60 €. Application légère, budget mémoire et taille d'installation contraints. Aucune dépendance à du matériel propriétaire. |
| **Mobile money dominant** : 498 Md$ en Afrique de l'Ouest en 2025, 76 services actifs ([GSMA](https://www.connectingafrica.com/mobile-money/-1-4t-flowed-through-mobile-money-in-sub-saharan-africa-in-2025-gsma)). Commissions marchand 1–2 % ([kolonell.com](https://kolonell.com/fr/blog/passerelle-paiement-cote-divoire-wave-orange-mtn-2026)). | **Wave, Orange Money, MTN MoMo, Moov en natif**, pas en option. Avantage de coût structurel à afficher : 1–2 % contre 2,5–3,7 % chez les acteurs à carte imposée. |
| **Les espèces restent dominantes** : ~75 % des comptes mobile money sont inactifs sur 30 jours, et la fiscalité sur les transactions pousse au retour aux espèces dans certains pays ([GSMA / connectingafrica](https://www.connectingafrica.com/mobile-money/sub-saharan-africa-maintains-mobile-money-lead-gsma)). | **L'espèce est un moyen de paiement de première classe**, pas un repli. Gestion du fond de caisse, du rendu de monnaie, de l'écart de caisse en fin de service, et **addition réglée en partie en espèces, en partie en Mobile Money**. |
| **Facture normalisée obligatoire** : FNE en Côte d'Ivoire depuis le 01/12/2025, contrôles DGI depuis le 01/09/2026. OHADA/SYSCOHADA en zone UEMOA/CEMAC, GRA au Ghana, TVA 7,5 % au Nigeria. | **La conformité est une fonctionnalité de vente, pas une contrainte.** Émission conforme, QR de vérification, export comptable SYSCOHADA. C'est ce qui fait passer le logiciel du statut d'outil à celui d'obligation. |
| **Personnel peu formé, rotation élevée.** | **Interface utilisable sans formation** : icônes, photos des plats, français simple, parcours court. Objectif explicite : un nouveau serveur opérationnel en moins de dix minutes, sans manuel. |
| **Pas de TPE partout ; l'investissement initial est un obstacle.** | **Zéro matériel propriétaire.** Le téléphone du serveur est le terminal. Impression optionnelle. Modèle en abonnement sans acompte matériel — à l'opposé du modèle Tabesto (1 600–2 500 € la borne) ou Toast (799–1 199 € le terminal). |
| **Sensibilité au prix extrême** : offres locales à 10 000–20 000 FCFA/mois (15–31 €), 199 GHS, 250–750 MAD. | La grille doit **partir du niveau local**, pas du niveau occidental converti. Un tarif à 69 $ est hors marché. |
| **Subventions publiques à la digitalisation** — MOWAKABA au Maroc réduit un pack Odoo de 9 900 à 990 MAD ([oasistechnocloud.com](https://oasistechnocloud.com/blog/logiciel-gestion-restaurant-maroc/)). | Se rendre **éligible aux dispositifs publics** de digitalisation des PME est un levier d'acquisition sous-exploité. Cartographie à faire pays par pays. **(NV pour la Côte d'Ivoire et le Sénégal.)** |
| **Groupes multi-pays, multi-devises** (XOF, XAF, GHS, NGN, MAD). | Consolidation multi-site **et multi-devises** dès les premiers paliers, pas au palier à 399 $. |
| **WhatsApp comme canal d'affaires par défaut** — support WhatsApp mis en avant par CliqPOS et DIAM POS. | Support, notifications de commande, reçus et alertes **par WhatsApp**. Le courriel n'est pas le canal. |

---

## 8. Ce qu'il faut absolument éviter de copier

1. **Le paiement imposé.** Toast interdit de négocier son taux ailleurs. Sur un marché où la commission Mobile Money est de 1 %, verrouiller le marchand serait à la fois hostile et non compétitif. Le choix du moyen d'encaissement doit rester au restaurateur.
2. **L'opacité tarifaire.** me&u, UEAT, Deliverect, Oracle : prix sur devis. C'est une friction et une défiance. Publier une grille complète, commissions comprises.
3. **Le plancher de facturation qui punit les petits.** Otter impose **100 $/mois minimum** de frais de traitement en dessous de 25 000 $ de volume carte. Appliqué à un maquis, ce mécanisme est une exclusion pure et simple.
4. **La dépendance matérielle propriétaire.** Toast (799–1 199 $ le terminal), Tabesto (1 600–2 500 € la borne), Oracle (2 500–8 000 $). Modèle inapplicable, et contraire à l'idée que le téléphone du serveur suffit.
5. **La facturation à l'unité de ce qui doit être illimité.** sunday facture **5 $ le QR code**, Lightspeed **30 $ par écran de cuisine**. On facture ainsi l'adoption de son propre produit. Les QR et les écrans doivent être illimités.
6. **Réserver le multi-site au palier le plus cher** (Lightspeed, 399 $/mois). Le multi-site est un besoin structurel, pas un luxe.
7. **L'engagement long sur le matériel.** Otter : 24 mois. Inadapté à une clientèle dont la trésorerie est le premier souci.
8. **L'ergonomie héritée des POS d'entreprise.** Denses, conçues pour des opérateurs formés, dépendantes d'un intégrateur.
9. **Le mode hors-ligne en trompe-l'œil.** Annoncer « offline mode » alors que les terminaux ne se synchronisent pas entre eux et que la cuisine ne reçoit plus rien, c'est vendre une promesse qui se brise au pire moment. Si le hors-ligne est annoncé, il doit être entier.
10. **Le transfert du risque de paiement au restaurateur**, comme Square le fait explicitement pour les paiements hors-ligne expirés ou refusés.

---

## 9. Recommandations de différenciation pour [PRODUCT_NAME]

Chacune est reliée à un angle mort identifié au §6 ou à une contrainte du §7.

### R1 — Le hors-ligne pair-à-pair comme mode nominal
→ *Répond à l'angle mort 6.1 et à la contrainte « coupures ».*
Les appareils se synchronisent **entre eux sur le réseau local**, sans passer par le cloud : le serveur envoie en cuisine, le KDS reçoit, la caisse voit tout — internet coupé. Le cloud ne sert qu'à la consolidation différée. C'est l'inverse exact du modèle Toast, dont la documentation reconnaît que les appareils ne se synchronisent pas hors-ligne. **C'est le différenciateur technique central et le plus défendable.**

### R2 — Mobile Money natif, multi-opérateur, avec l'espèce en première classe
→ *Répond à 6.2 et aux contraintes « mobile money » et « espèces dominantes ».*
Wave, Orange Money, MTN MoMo, Moov intégrés nativement, plus **la gestion complète des espèces** : fond de caisse, rendu de monnaie, écart de caisse en fin de service. Argument commercial chiffré : 1–2 % de commission contre 2,5–3,7 % chez les solutions à carte imposée.

### R3 — Le mode de service configurable par zone et par plage horaire
→ *Répond à 6.3.*
Un réglage, pas deux produits : commande par le serveur, par le client, ou les deux — **différent selon la zone de salle, le service et l'heure**. Terrasse en autonomie le soir, salle en service assis à midi. Aucun concurrent étudié ne le propose.

### R4 — Addition collaborative à paiement mixte
→ *Répond à 6.4.*
Plusieurs convives, chacun sur son téléphone, voient l'addition se répartir en temps réel. Chacun règle comme il veut — **Wave, Orange Money, carte ou espèces remises au serveur — sur la même addition**, avec solde restant mis à jour en direct. C'est la fonctionnalité la plus visible côté client et la plus absente du marché.

### R5 — Conformité fiscale intégrée, à commencer par la FNE ivoirienne
→ *Répond à 6.7 et à la contrainte réglementaire.*
Émission conforme, QR de vérification, export SYSCOHADA. La DGI contrôle depuis le 1er septembre 2026 : le sujet est brûlant et il est **un motif d'achat immédiat**. Feuille de route : Côte d'Ivoire (FNE), puis OHADA/UEMOA, puis Ghana (GRA) et Nigeria (TVA 7,5 %). *Prérequis : obtenir la spécification technique officielle de l'API FNE, non consultable au moment de cette étude.*

### R6 — KDS gratuit et illimité sur Android d'entrée de gamme
→ *Répond à 6.5 et à la contrainte matérielle.*
Autant d'écrans que nécessaire, sans supplément, sur des tablettes à 60 €. Face aux 30 $/écran/mois de Lightspeed et au KDS à 599–1 199 $ de Toast, c'est un écart de coût d'un ordre de grandeur, et un argument immédiatement compréhensible par un chef.

### R7 — Multi-site et multi-devises dès l'entrée de gamme
→ *Répond à 6.6.*
Consolidation de plusieurs établissements, **y compris à travers les zones XOF, XAF, GHS, NGN, MAD**, disponible dès les premiers paliers. Lightspeed la vend 399 $/mois et sans multi-devises ; c'est le besoin exact des groupes régionaux.

### R8 — Grille tarifaire publique, en monnaie locale, commissions comprises
→ *Répond à 6.8 et à la sensibilité au prix.*
Prix affiché en FCFA, GHS, NGN, MAD. **Commissions de paiement publiées**, ce que Lightspeed, sunday et Bopple ne font pas. Point d'ancrage à viser : la bande locale de 10 000–20 000 FCFA/mois, pas les 69 $ de Toast. Aucun plancher de facturation, aucun engagement matériel.

### R9 — Zéro matériel propriétaire, démarrage en autonomie
→ *Répond aux contraintes « pas de TPE » et « investissement initial ».*
Le téléphone du serveur est le terminal. Impression optionnelle sur imprimantes thermiques génériques. **Inscription et mise en service sans commercial**, sur le modèle de Square — le meilleur onboarding du panel — mais sans sa dépendance à la carte bancaire.

### R10 — Interface utilisable sans formation, et support WhatsApp
→ *Répond à « personnel peu formé » et « WhatsApp ».*
Photos des plats, icônes, français simple, parcours court ; objectif mesurable : **un serveur opérationnel en moins de dix minutes sans manuel**. Support, alertes et reçus par WhatsApp, canal réellement utilisé, comme l'ont compris CliqPOS et DIAM POS.

### R11 — L'avis client capté au moment du paiement
→ *Reprise assumée de la meilleure idée du panel (sunday), appliquée au contexte local.*
Demander l'avis Google quand le client vient de payer et qu'il est encore à table. À combiner avec le partage WhatsApp, plus pertinent localement que le courriel. **On reprend le mécanisme, jamais le design.**

### R12 — Synchronisation des menus dans les deux sens sur tous les canaux
→ *Reprise du seul vrai apport de Deliverect, absent du continent.*
Un plat épuisé disparaît **simultanément** du QR en salle, de la commande à emporter et des plateformes de livraison. Deliverect résout ce problème dans 52 pays dont aucun en Afrique : la brique est à construire localement, avec les agrégateurs réellement présents sur chaque marché (*à cartographier — non traité dans cette étude, **NV***).

---

## 10. Synthèse — la thèse en trois phrases

Le QR seul n'est plus un produit défendable : ses deux leaders mondiaux ont fusionné pour survivre. Les vrais OS de service existent, mais ils sont chers, verrouillés sur leur propre paiement, dépendants de leur matériel, et **aucun des treize acteurs internationaux étudiés n'a de présence africaine documentée**. Le marché africain est tenu par des acteurs locaux qui ont raison sur la conformité, le Mobile Money et le hors-ligne, mais qui n'ont ni la profondeur ni l'ergonomie d'un OS moderne — et c'est précisément cette case, vide, qui est à occuper.

---

## 11. Ce qui reste à vérifier

Liste explicite des points **non vérifiés** dans ce document, à traiter avant toute décision d'investissement :

1. **Tarifs Toast, Square et Oracle** — obtenus de sources secondaires uniquement ; les pages officielles renvoient HTTP 403 ou 429 aux requêtes automatisées. À reconfirmer auprès des éditeurs.
2. **Spécification technique de l'API FNE (DGI Côte d'Ivoire)** — le portail officiel `fne.dgi.gouv.ci` renvoyait HTTP 503 à la consultation. Modalités d'intégration pour un éditeur de logiciel : **inconnues**. C'est un prérequis de R5.
3. **Commissions de paiement** de Lightspeed, sunday, Bopple, me&u, UEAT, Deliverect — non publiées.
4. **Tarifs de Zeat, KiboERP, HilsonPOS, MealNix, Akwabax, Sen-caisse, JAAY CAISSE, KABRAK** — non publics ou non ouverts individuellement.
5. **Existence de Yaba, Sanaa et Lengo** comme éditeurs de POS restaurant — **cherchés, non trouvés**. Ni confirmés ni infirmés sous une autre forme.
6. **Capacités hors-ligne réelles** de sunday, Flipdish, Bopple, Otter, me&u, Tabesto — non documentées publiquement.
7. **Existence et conditions de subventions publiques à la digitalisation** en Côte d'Ivoire, Sénégal, Cameroun, Bénin — seul le dispositif marocain MOWAKABA a été identifié.
8. **Cartographie des agrégateurs de livraison réellement actifs** par pays africain — non traitée, prérequis de R12.
9. **Parts de marché, nombres de clients et chiffres d'affaires des acteurs africains** — aucune donnée fiable disponible ; aucun chiffre n'a été avancé.
10. **Qualité réelle des UX** décrites — aucun produit n'a été testé en conditions d'usage. Les appréciations d'UX de ce document reposent sur la documentation des éditeurs.
