# ROADMAP — Joliba

> §108, §109, et la décision *D-012* : **tranches verticales, pas couches horizontales**.

---

## 1. Le principe de découpe

Le brief pose une exigence qui semble contradictoire : *« Je ne veux pas que tu supprimes des
fonctionnalités importantes sous prétexte de MVP »* et *« ne tente pas non plus de coder tout
simultanément »*.

Elle se résout par la **forme** du découpage, pas par son contenu.

| | Couche horizontale | Tranche verticale |
|---|---|---|
| Exemple | « Tous les CRUD », puis « toutes les pages » | « Un restaurant peut afficher sa carte et la maintenir » |
| Utilisable à la fin ? | Non — rien ne sert avant la dernière | Oui, par un vrai restaurant |
| Corrigée par quoi ? | Par notre imagination | Par le réel |

Chaque tranche ci-dessous se termine par une phrase testable : **« à la fin, un restaurant peut… »**.
Si cette phrase n'existe pas, la tranche est mal découpée.

L'architecture complète — schéma, permissions, machines à états, abstractions — **existe dès
maintenant** *(elle est écrite dans ce dépôt)*. Ce qui est séquencé, c'est l'implémentation.

---

## 2. Les tranches

### T0 — Fondations *(la seule tranche sans utilisateur final)*

Authentification du personnel (code à usage unique + Google) · organisations, établissements,
membres, invitations · rôles et permissions avec portée par établissement · gardes Convex ·
système de design et composants de base · intégration continue complète · observabilité minimale.

**À la fin** : une personne crée une organisation, crée un établissement, invite un collègue avec un
rôle limité à cet établissement — et le collègue ne voit rien d'autre.

**Porte de sortie** *(un test, pas une opinion)* : le test d'isolation multi-tenant passe sur
**toutes** les fonctions publiques existantes. Cette porte ne se franchit qu'une fois, et elle
conditionne tout le reste.

> C'est la seule tranche qui ne sert personne directement. Elle est assumée : construire le
> contrôle d'accès après coup, c'est le construire faux.

**État (2026-09-23) : livrée.**
- Porte de sortie franchie : `tests/convex/isolation.test.ts` appelle chacune des 27 fonctions
  publiques avec les identifiants d'une autre organisation (clés étrangères croisées comprises), et
  échoue si une fonction nouvelle n'a pas son cas. Contre-épreuve faite : retirer une garde ou un
  contrôle d'organisation fait tomber le test.
- « Le collègue ne voit rien d'autre » : prouvé côté serveur (`tests/convex/permissions.test.ts`) et
  dans un navigateur réel, contre le build de production (`e2e/t0.spec.ts`).
- Écarts assumés : le PIN de service *(A1)* n'est pas implémenté ; la dernière activité d'un membre
  n'est pas encore affichée dans l'équipe ; la révocation d'un appareil laisse au plus 15 minutes au
  jeton déjà émis *(D-038)*.

### T1 — La carte est en ligne

Cartes, sections, produits, variantes, groupes d'options · disponibilité manuelle et programmée ·
photos · publication versionnée · plan de salle simple, tables, **QR avec échange jeton → cookie**
*(D-023)* · menu client en lecture, rapide, hors ligne en lecture · menu public indexable,
optionnel · import CSV et duplication d'un autre établissement.

**À la fin** : un restaurant remplace son menu papier, imprime ses QR, et ses clients consultent la
carte avec les vraies disponibilités.

**Porte de sortie** : le menu client s'affiche en moins de 2,5 s au 75ᵉ centile sur un Android
d'entrée de gamme en 4G bridée — **mesuré, pas estimé**.

**État (2026-09-23) : livrée, sous réserve du test sur appareil réel.**
- Porte de sortie, **mesurée en émulation** (`scripts/measure-guest.mjs`, 20 essais, navigateur
  vide, profil DESIGN §5 : 1,6 Mbit/s, 300 ms, processeur ralenti 6 fois, 360 × 740) sur le
  restaurant de démonstration (40 plats, 30 photos), du scan du QR à l'affichage :
  **première peinture — la carte, rendue au serveur — 1,42 s au 75ᵉ centile ; plus grand élément
  (première photo) 2,05 s**. Chromium n'a compté la latence émulée qu'une fois sur l'échange :
  en ajoutant un aller-retour, la borne pessimiste reste sous 2,5 s (≈ 1,72 s et ≈ 2,35 s).
  Octets : JavaScript avant interaction **104 Ko** brotli (budget 120), CSS 9 Ko, police 35 Ko,
  deux photos prioritaires ≈ 84 Ko (budget 180). Résultat brut : `docs/perf/2026-09-23-carte-client.json`.
- **Après le passage aux composants officiels shadcn/ui (D-058)**, même protocole : première
  peinture **1,73 s**, plus grand élément **2,08 s** au 75ᵉ centile — la porte de 2,5 s tient, avec
  moins de marge (≈ 2,38 s en ajoutant l'aller-retour manquant). JavaScript avant interaction
  **≈ 131 Ko** brotli : **au-dessus du budget de 120 Ko**. L'essentiel vient du moteur de fusion de
  classes `cn` qu'importe chaque composant officiel (≈ 9 Ko) et du code des composants ; la fiche
  d'un plat (vaul) est chargée en différé et n'y entre pas. Résultat brut :
  `docs/perf/2026-09-23-carte-client-shadcn.json`.
- **Non fait** : la mesure sur un vrai Android d'entrée de gamme (DESIGN §12, point 6). Un
  processeur ralenti par logiciel n'a ni la dalle ni le processeur graphique d'un téléphone à
  100 $ : c'est l'appareil réel qui tranche, avant la première mise en service.
- Parcours complet prouvé dans un navigateur, contre le build de production (`e2e/t1.spec.ts`) :
  composer, publier, imprimer le QR, le scanner, couper un plat — la carte du client change sans
  rechargement —, régénérer le QR — l'ancien et les clients qu'il avait fait entrer sont coupés.
- Isolation : chaque fonction publique du catalogue, de la salle et des QR a son cas dans
  `tests/convex/isolation.test.ts`.
- Écarts assumés : pas de limitation de débit sur l'échange de QR ni de ré-encodage serveur des
  photos (SECURITY M3, M14) ; pas de CSP stricte ; la disponibilité d'une variante se règle sur la fiche
  produit et celle d'une option sur l'écran Options, pas encore sur l'écran de service mobile ; l'ordre des sections se change par
  flèches, sans glisser-déposer.

> Première tranche vendable. Elle ne suffit pas à gagner (le marché du menu QR est saturé et
> Mr Yum et me&u ont fusionné), mais elle ouvre la porte et fait vivre le QR en salle.

### T2 — Le service passe par le logiciel *(le cœur)*

Sessions de table et invités · panier · commandes avec machine à états et journal d'événements ·
mode `staff_only` avec **panier à montrer**, `guest_with_approval` en réglage sous garde-fous
*(D-061)* · découpe en bons par station · **KDS** · écran serveur (mes tables, prêt à servir,
attentes) · demandes de service · services (`courses`) avec `hold` et `fire` · **PIN de service
sur appareil enrôlé** *(D-060)* · file d'écriture hors ligne persistante et « À régulariser »
*(D-062)*.

**Lots** :

| Lot | Contenu | État |
|---|---|---|
| T2.a | Moteur : postes et routage, sessions de table, commandes chiffrées côté serveur, bons par poste et par service, écran de production, « à servir », clôture | fait (2026-09-23) |
| T2.c | Modèle d'acteur (membre, appareil, session d'opérateur), enrôlement d'appareil, PIN, `clientRef`, file hors ligne | fait (2026-09-23) |
| T2.b | Côté client : panier à montrer, demandes de service, validation sous garde-fous | fait (2026-09-23) |
| T2.d | Écrans (composants shadcn uniquement) : prise de commande, KDS, mes tables, demandes, postes | fait (2026-09-23) |
| T2.e | Bout en bout d'un service complet, revue adverse, documentation | fait (2026-09-23) |

- Écarts assumés à la fin de T2 : un gérant ne voit pas les gestes en attente sur l'appareil d'un
  autre (chaque file est locale) ; « envoyer la suite » envoie tout le service, pas un plat ; pas
  de limite de débit globale sur l'enrôlement (seulement par code) ; la preuve de D-061 (le panier
  à montrer ne ralentit pas le service) attend un essai en salle réelle.

**À la fin** : un serveur prend une commande sur son téléphone, la cuisine la reçoit et la marque
prête, le serveur est prévenu et sert. **Le restaurant coordonne sa salle et sa cuisine sans crier.**

**Porte de sortie** : un service complet réel, dans un vrai restaurant, du premier client au
dernier, sans retomber sur le carnet. Si le personnel contourne, la tranche n'est pas finie.

> C'est ici que le produit devient un *Restaurant OS* et non un menu. C'est aussi la tranche la
> plus risquée : elle se joue sur l'adoption par le personnel, pas sur la technique *(A1, A2)*.

### T3 — L'argent est tracé

Additions séparées des commandes · partage (par article, par personne, par montant, égal) ·
`CashProvider` · paiement mixte sur une même addition · sessions de caisse avec fonds, comptage,
écart · mouvements de caisse · tickets non certifiés (`bills`) · remboursements et annulations avec
motif · journal d'audit branché.

**Lots** :

| Lot | Contenu | État |
|---|---|---|
| T3.a | Arbitrages adverses : qui agit, forme des additions, partage, organisation des espèces *(D-075 à D-083)* | fait (2026-09-23) |
| T3.b | Moteur : additions sans montant stocké, partage par articles, paiements mixtes idempotents, caisses et pochettes, comptage à l'aveugle, annulations et remboursements, tickets numérotés, rapport de fin de service | fait (2026-09-23) |
| T3.c | Écrans (composants shadcn uniquement) : onglet Addition de la table, encaissement en deux temps, caisse, ticket imprimable 80 mm, rapport, réglages d'encaissement | fait (2026-09-23) |
| T3.d | Bout en bout (`e2e/t3.spec.ts`) : caisse juste puis écart provoqué, revue adverse, documentation | fait (2026-09-23) |
| T3.e | Corrections de la revue adverse : commandes non acceptées hors addition, clôture par addition, gestes d'argent attribués à leur auteur sous PIN, recomptage motivé, sorties d'argent réservées, rapport sans fuite pendant un comptage *(D-088 à D-092)* | fait (2026-09-23) |

- Écarts assumés à la fin de T3 : `CashProvider` reporté à T5, `applyPayment` en tient lieu
  *(D-078)* ; pas de partage par convive *(D-077)* ; pas de grille de comptage par coupures, pas de
  correction d'une caisse close, pas de pourboire ni de service *(D-087)* ; le ticket reste un
  document interne tant que la conformité fiscale n'est pas branchée *(D-024)* ; la porte de sortie
  (une vraie clôture en salle) attend un essai en restaurant réel — l'e2e en rejoue le scénario.

**À la fin** : le gérant sait, à la fin du service, ce qui est entré, par quel moyen, encaissé par
qui — et l'écart de caisse s'explique.

**Porte de sortie** : une clôture de caisse réelle qui tombe juste, et un écart provoqué
volontairement qui remonte avec son auteur et son motif.

> C'est la tranche qui fait *signer*. La douleur qui fait payer un maquis d'Abidjan n'est pas
> « mes clients veulent un joli menu », c'est « je ne sais pas ce qui est entré en caisse » *(A6)*.

### T4 — Le client commande lui-même

Modes `guest_direct` et `hybrid` · panier collaboratif à plusieurs invités · attribution des
articles par invité · suivi de commande côté client · recommandations déterministes · avis en fin
de service.

**À la fin** : quatre personnes à une table commandent chacune depuis son téléphone, en même temps,
et savent où en est leur plat.

**Porte de sortie** : une table de quatre, quatre appareils, aucune commande perdue ni dupliquée.

> Vient **après** T2 délibérément : on ouvre la commande directe quand le restaurant l'a décidé,
> pas parce que c'était le défaut *(A2)*.

### T5 — Le paiement en ligne

Abstraction `PaymentProvider` avec un second adaptateur réel · intentions, webhooks signés,
idempotence · réconciliation quotidienne · indicateur « versé / en attente / en retard » ·
pourboires (désactivés par défaut).

**À la fin** : un client règle depuis son téléphone en Mobile Money, la caisse le voit en direct, et
le rapprochement du lendemain est automatique.

**Porte de sortie** : la batterie de tests du §12 de `PAYMENTS.md` passe, webhook rejoué et
falsifié compris.

### T6 — Le gérant comprend

Tour de contrôle `/app/live` · tableau de bord du jour avec alertes avant chiffres · analytique
ventes, produits, service, tables, paiements · agrégats quotidiens précalculés · détection
d'anomalies par règles.

**À la fin** : pendant le service, le gérant voit ce qui est en retard ; après le service, il sait
pourquoi.

### T7 — L'installation devient autonome

Onboarding progressif avec tableau de progression · **mode simulation** *(§38)* : simuler une table,
commander, voir arriver en cuisine, servir, encaisser — avant même d'imprimer un QR · import de carte
assisté par IA avec validation humaine obligatoire · centre d'aide et signalement de bogue intégré.

**À la fin** : un restaurant s'installe **seul**, apprend le produit en s'en servant, et passe sa
première commande de test sans nous.

**Porte de sortie** : trois restaurants s'installent sans assistance, mesuré.

> Cette tranche décide du coût d'acquisition. Tant qu'elle n'est pas faite, chaque client coûte une
> installation accompagnée.

### T8 — Les groupes

Multi-établissements pour de bon · analytique consolidée, y compris multi-devises · plans,
abonnements, droits d'usage · back-office plateforme avec vue 360°, support et audit des
consultations · drapeaux de fonctionnalité.

### T9 — La relation client

Profils volontaires et consentements prouvés · fidélité · réservations et liste d'attente ·
assistant exploitation · actions proposées par l'IA avec validation humaine · notifications
multi-canal (**WhatsApp traité comme canal de premier plan**, pas le courriel).

### T10 — L'ouverture

Stock : recettes, mouvements, inventaires, pertes · API publique avec clés hachées et portées ·
webhooks sortants signés avec réessais · intégrations tierces.

---

## 3. Ce qui traverse toutes les tranches

| Sujet | Règle |
|---|---|
| Conformité fiscale | Le module existe dès T3 avec `NoopFiscalProvider`. L'intégration réelle démarre **dès que la spécification est en main**, quelle que soit la tranche en cours — c'est un motif d'achat immédiat *(A7)* |
| Accessibilité | Dans chaque tranche, jamais « à la fin ». Une reprise d'accessibilité après coup coûte trois fois plus |
| Tests | Une tranche sans tests n'est pas finie. Le dépôt de référence n'en a aucun : c'est l'écart à ne pas reproduire |
| Français et anglais | Livrés ensemble. Une langue ajoutée après coup laisse des chaînes en dur partout |
| Hors ligne | Cercle 1 dès T1, cercle 2 dès T2, cercle 3 (refus explicite) partout *(A4)* |

---

## 4. Les trois décisions qui peuvent changer cet ordre

1. **Le hors-ligne pair-à-pair** *(A8)*. Si l'utilisateur choisit la voie 2, une tranche entière
   s'insère après T2 — et le produit gagne son meilleur différenciateur au prix d'un second
   exécutable et d'un support matériel.
2. ~~**Le PIN de service** *(A1)*. S'il est retenu, il entre en T0.~~ **Retenu (D-060).** T0 est
   livrée sans lui : il passe en tête de T2, **avant** le premier écran de service, pour que les
   tables de service rattachent leurs gestes à un membre et un appareil dès le départ.
3. **Le terrain** *(R7, guide d'entretiens)*. Il peut inverser T3 et T4, ou avancer la conformité
   fiscale. Les entretiens ne sont **pas encore faits** : cet ordre repose donc sur des hypothèses
   documentées, pas sur des faits.

---

## 5. Ce qui est volontairement absent

- **La livraison et l'emport.** Autre produit, autre parcours, autres partenaires.
- **La paie et les plannings.** Autre métier.
- **La comptabilité complète.** On exporte vers un comptable, on ne le remplace pas.
- **Le matériel propriétaire.** Le téléphone du personnel est le terminal *(D-021)*.
- **Une place de marché de convives.** Nous servons le restaurant, pas un annuaire.

Chacune de ces absences est une décision, pas un oubli. Les rouvrir demande un argument, pas une
envie.
