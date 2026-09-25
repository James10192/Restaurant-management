# PRODUCT.md — Joliba

> Nom de code. Le nom commercial n'est pas arrêté — voir `docs/research/naming-study.md`.
> Tant qu'il ne l'est pas, `Joliba` est utilisé partout dans le code et la configuration,
> et rien n'attend cette décision.

---

## 1. Vision

**Joliba est l'infrastructure numérique qui orchestre le service d'un restaurant.**

Pas un menu en ligne. Pas un QR code. Le QR est une porte d'entrée physique — utile, visible,
bon marché — mais ce qui se passe derrière est le vrai produit : la coordination, en temps réel,
entre le client assis à la table, le serveur qui la prend en charge, la cuisine qui produit, le bar
qui sert, la caisse qui encaisse et le gérant qui doit comprendre sa soirée.

Le parcours complet que le produit doit pouvoir porter :

```
le client s'installe → il scanne la table → il consulte la carte → il compose
→ la commande part → cuisine / bar la reçoivent → préparation → le serveur est prévenu
→ service → éventuelle nouvelle commande → addition → partage éventuel → paiement
→ clôture de la table → fidélisation → données
```

Chaque flèche de cette chaîne est aujourd'hui, dans la plupart des restaurants, une **voix qui crie,
un carnet, ou un aller-retour**. C'est là que se perdent les commandes, le temps, et l'argent.

### Ce que le produit n'est pas

- Ce n'est pas un PDF de menu derrière un QR code.
- Ce n'est pas une application de livraison.
- Ce n'est pas un logiciel de caisse qui exige du matériel propriétaire.
- Ce n'est pas un produit qui impose au restaurant de changer sa façon de travailler.

### Le principe qui gouverne tout le reste

**Le restaurant configure son propre fonctionnement ; le logiciel s'y adapte.**

Un maquis où le serveur prend tout au carnet et où l'on paie au comptoir, et un lounge où le client
commande et paie depuis son téléphone, doivent tourner sur **le même produit**, sans branche de code
séparée. C'est l'exigence d'architecture la plus structurante du projet (§1) : aucune décision
technique n'a le droit de supposer un seul mode de fonctionnement.

---

## 2. Les modes de service

Le restaurant compose son mode à partir de trois axes indépendants. Ces axes sont des **réglages
d'établissement lus par les machines à états**, jamais des conditions disséminées dans le code
(*D-011*).

### Axe 1 — Qui saisit la commande

| Mode | Description | Pour qui |
|---|---|---|
| `staff_only` | Seul le personnel saisit. Le QR sert à consulter la carte et à préparer un **panier à montrer** que le serveur importe d'un geste. | **Défaut** *(D-061)* — maquis, restaurants traditionnels, débuts prudents |
| `guest_with_approval` | Le client compose, le serveur valide avant production | Réglage, avec garde-fous : message « pas encore en cuisine », alerte à toute la zone à 90 s, expiration à 10 min *(D-061)* |
| `guest_direct` | Le client envoie directement en cuisine, **une fois admis par le code de la table** (quatre chiffres tirés à chaque ouverture, donnés par le serveur) ou par le personnel | Maquis et restaurants qui veulent que chacun commande de son téléphone *(T4, D-094, D-095)* ; jamais avec un QR sans friction |
| `hybrid` | Client direct autorisé sur certaines catégories (boissons), validation requise ailleurs | Bars, lounges — **reporté après T4** : une commande à moitié partie est ce que D-061 condamne *(D-094)* |

### Axe 2 — Quand on paie

| Mode | Description |
|---|---|
| `post_paid` | On consomme, puis on paie (défaut en restauration assise) |
| `pre_paid` | Paiement exigé **avant** l'envoi en production |
| `per_order` | Chaque commande se règle à l'envoi, la table peut en enchaîner plusieurs |

> `pre_paid` n'est pas une option cosmétique : elle change la machine à états de la commande, qui
> attend la confirmation du paiement avant de générer les tickets de production. C'est traité comme
> une transition conditionnelle, pas comme un cas particulier.

### Axe 3 — Où l'on paie

`at_counter` (caisse) · `with_staff` (le serveur encaisse à table) · `in_app` (le client paie depuis
son téléphone) · `mixed` (plusieurs à la fois, y compris sur une même addition)

**Toute combinaison des trois axes doit fonctionner.** L'onboarding pose trois questions simples
plutôt que de faire choisir un « profil » parmi douze.

---

## 3. Pour qui

### Les établissements

Restaurants · maquis · bars · lounges · cafés · fast-foods · hôtels avec restauration · food courts ·
groupes multi-établissements.

Marché prioritaire : **Afrique francophone**, à commencer par la Côte d'Ivoire (*H1*). L'architecture
est internationale dès le départ — devise, langue, fuseau, fiscalité et moyens de paiement sont des
données d'établissement, jamais des constantes.

### Les personnes

**Awa — gérante-propriétaire, maquis de 18 tables, Cocody.**
Elle est présente tous les soirs. Elle sait que « ça marche » mais pas combien exactement est entré
en caisse. Elle a déjà vu un serveur encaisser sans enregistrer. Elle a essayé un cahier, puis Excel,
puis a laissé tomber. Elle n'achètera pas un « logiciel de gestion » : elle achètera *savoir ce qui
rentre*. Téléphone Android correct, connexion capricieuse, aucun temps pour une formation.
→ *Ce qu'elle doit obtenir le premier soir : le total de la soirée, juste, sans rien changer à son
organisation.*

**Koffi — serveur, 7 tables en simultané au coup de feu.**
Il porte les assiettes, il crie vers la cuisine, il retient trois commandes de tête. Son revenu
dépend en partie du pourboire, donc du contact avec le client. Il se méfie d'un outil qui le
remplacerait. Il n'utilisera jamais quelque chose qui demande plus de trois gestes.
→ *Ce qu'il doit obtenir : moins d'allers-retours inutiles, et savoir qu'un plat est prêt sans aller
voir.*

**Mariam — caissière.**
Elle ouvre son fonds le matin, elle compte le soir. Quand ça ne tombe pas juste, c'est elle qu'on
regarde. Le Mobile Money passe parfois par un téléphone posé à côté de la caisse.
→ *Ce qu'elle doit obtenir : une clôture qui s'explique, et un écart qu'elle peut justifier.*

**Ibrahim — chef de partie.**
Mains mouillées, bruit, chaleur, plusieurs commandes en même temps. Il déteste les papiers qui se
perdent autant que les écrans lents. Il doit voir en une seconde ce qui part maintenant.
→ *Ce qu'il doit obtenir : l'ordre de production, lisible à un mètre, sans jamais avoir à chercher.*

**Aïcha — cliente, 4 personnes à table.**
Elle a peu de batterie et une connexion moyenne. Elle veut voir la carte, savoir les prix, et ne pas
attendre vingt minutes pour demander l'addition. À quatre, chacun veut payer sa part.
→ *Ce qu'elle doit obtenir : la carte en moins de deux secondes, et ne jamais devoir lever la main.*

**Serge — propriétaire de quatre établissements.**
Il ne peut pas être partout. Il veut comparer, pas gérer. Il veut savoir quel site décroche, et
pouvoir donner à son manager de Marcory l'accès à Marcory **et rien d'autre**.
→ *Ce qu'il doit obtenir : une vue consolidée, et un contrôle d'accès qui ne l'oblige pas à faire
confiance aveuglément.*

---

## 4. Les problèmes qu'on résout

Classés par ce qu'ils coûtent réellement, pas par ce qui se démontre bien.

| # | Problème | Ce qu'il coûte | Ce que le produit fait |
|---|---|---|---|
| P1 | La commande se perd entre la salle et la cuisine | Un plat refait, un client qui ne revient pas | La commande arrive en production horodatée, personne ne peut dire « je n'ai pas reçu » |
| P2 | Personne ne sait ce qui est réellement entré en caisse | De l'argent qui disparaît sans coupable identifiable | Chaque encaissement est attribué, la clôture de caisse affiche l'écart |
| P3 | Le client attend sans savoir | Perte de satisfaction, tables qui tournent moins | Statut visible, demande de service en un geste, addition sans attendre |
| P4 | Le serveur fait des allers-retours pour rien | Des tables mal servies au coup de feu | Il est prévenu quand c'est prêt, il ne va plus voir |
| P5 | Le gérant découvre les problèmes le lendemain, ou jamais | Décisions prises à l'aveugle | Tour de contrôle temps réel + analytics qui répondent à une question |
| P6 | Le prix affiché n'est plus celui facturé | Litiges, perte de confiance | Snapshot figé à la commande *(D-005)* |
| P7 | Partager l'addition à quatre est pénible | Friction finale, sur le moment qui décide du souvenir | Partage natif : par article, par personne, par montant |
| P8 | Un produit est épuisé mais la salle continue de le vendre | Client déçu, commande annulée | Disponibilité temps réel, la cuisine la change elle-même |
| P9 | Le groupe multi-sites ne se compare pas | Le site qui décroche n'est vu que trop tard | Organisation → établissements, analytics consolidées |
| P10 | Le personnel change et il faut tout réexpliquer | Coût de formation permanent | Le produit s'apprend en faisant (§38, mode simulation) |

---

## 5. Principes produit

**1. Le restaurant a déjà une façon de travailler.** Le logiciel s'y insère ; il ne la remplace pas
d'un coup. Toute fonctionnalité doit pouvoir être ignorée sans casser le reste.

**2. Le service ne s'arrête pas parce que le logiciel hésite.** Réseau coupé, tablette déchargée,
imprimante morte : il doit toujours rester un chemin pour servir et encaisser. Un logiciel de
restauration qui bloque le service est désinstallé le soir même.

**3. L'argent ne se devine pas.** Aucun montant ne vient du client. Aucun paiement n'est réputé
réussi sur la seule foi d'une redirection. Rien de financier ne se supprime — on corrige avec une
écriture, jamais une gomme.

**4. La vitesse est une fonctionnalité.** Le menu client doit s'ouvrir sur un Android d'entrée de
gamme, en 4G instable, plus vite que le serveur n'arrive. C'est un budget de performance, pas une
intention.

**5. Deux publics, deux densités.** Le client veut de l'air, des photos, de grands boutons. La
cuisine et la caisse veulent de la densité, des raccourcis et aucune animation. Même système de
design, réglages opposés.

**6. Rien d'inventé.** Un allergène, un prix, un chiffre d'affaires, une composition : si la donnée
n'a pas été déclarée par le restaurant, le produit dit qu'il ne sait pas. Cela vaut d'abord pour l'IA.

**7. Chaque écran a une question et une action.** Si l'on ne sait pas dire ce que l'utilisateur doit
regarder en premier, l'écran n'est pas conçu.

**8. Ce qui compte se prouve.** Les décisions produit s'appuient sur l'usage mesuré et le terrain,
pas sur l'intuition de celui qui code.

---

## 6. Terminologie

Un vocabulaire ambigu produit un schéma ambigu. Ces mots sont les mêmes dans le code, l'UI française
et la documentation.

| Terme (code) | UI française | Définition précise | À ne pas confondre avec |
|---|---|---|---|
| `organization` | Organisation | L'entreprise cliente, titulaire du compte et de l'abonnement | Une adresse physique |
| `venue` | Établissement | Un lieu physique exploité par l'organisation | L'organisation |
| `serviceArea` | Zone | Un espace dans l'établissement (salle, terrasse, VIP) | L'établissement |
| `restaurantTable` | Table | Le meuble physique, durable, numéroté | Une session |
| `tableSession` | Service en cours | **L'occupation** d'une table par un groupe, de l'installation à la clôture | La table, la commande |
| `guestSession` | Invité | Un navigateur rattaché à une session de table | Un compte client |
| `customerProfile` | Client | Une personne identifiée, volontairement, pour la fidélité | Un invité |
| `order` | Commande | Un envoi d'articles décidé à un instant donné | La session, l'addition |
| `orderItem` | Ligne de commande | Un article commandé, avec son snapshot de prix | Le produit au catalogue |
| `course` | Service | Le rang du repas : boisson, entrée, plat, dessert | La commande |
| `kitchenTicket` | Bon de production | La part d'une commande destinée à **une** station | La commande |
| `prepStation` | Station | Cuisine, bar, pâtisserie, grillades | La zone de salle |
| `check` | Addition | Un regroupement de lignes à payer | La commande, le paiement |
| `payment` | Paiement | Un encaissement réel, d'un montant, par un moyen | L'addition |
| `paymentIntent` | Tentative de paiement | Une intention en ligne, pas encore confirmée | Le paiement |
| `cashRegisterSession` | Session de caisse | D'une ouverture de fonds à sa clôture comptée | La caisse (le meuble) |
| `serviceRequest` | Demande | Un appel du client (serveur, eau, addition) | La commande |
| `menuPublication` | Publication de carte | Une version de carte rendue visible | Le brouillon |

**Trois distinctions que le produit ne doit jamais perdre :**

- **table ≠ session** — la table reste, la session se termine.
- **commande ≠ addition** — trois commandes peuvent se régler en deux additions.
- **addition ≠ paiement** — une addition peut recevoir plusieurs paiements, de moyens différents.

---

## 7. Les parcours

### 7.1 Le client (chemin nominal)

1. Il scanne le QR collé sur la table.
2. Le token est échangé contre une session signée ; il rejoint le service en cours, ou en ouvre un
   selon le mode de l'établissement.
3. La carte s'affiche — filtrée par les disponibilités réelles du moment.
4. Il compose : variantes, suppléments, instructions libres.
5. Il envoie. Selon le mode : départ direct en production, ou attente de validation du serveur.
6. Il suit l'état de sa commande.
7. Il peut recommander sans rouvrir de session.
8. Il demande l'addition, ou paie depuis son téléphone.
9. À quatre, chacun paie sa part — par article, par personne, ou d'un montant libre.
10. Reçu numérique. Avis. Fidélité, s'il le veut — **jamais avant d'avoir consulté la carte**.

**Ce que le produit ne lui impose jamais :** créer un compte pour consulter, ou pour commander.

### 7.2 Le serveur

Il ouvre son écran et voit *ses* tables, celles qui attendent, les plats prêts à porter, les demandes
en cours, l'ancienneté de chaque attente. Il prend une commande lui-même, ou valide celle d'un
client. Il déclenche un service en attente. Il déplace des clients, fusionne deux tables, encaisse
s'il en a le droit, clôture.

### 7.3 La cuisine et le bar

Une commande de table se **scinde en bons par station** : les cocktails au bar, les grillades en
cuisine, le dessert en pâtisserie. Chaque station ne voit que ce qui la concerne, dans l'ordre
d'arrivée, avec le temps écoulé, les modifications et les allergies déclarées bien visibles.
Démarrer, marquer prêt, rappeler. Grandes zones tactiles : on travaille avec les mains occupées.

### 7.4 La caisse

Les tables ouvertes, ce qui reste dû, les paiements déjà reçus. Un encaissement peut être mixte —
15 000 en espèces et 20 000 en Mobile Money sur la même addition. La session de caisse s'ouvre avec
un fonds, se clôture avec un comptage, et l'écart est affiché, expliqué, journalisé.

### 7.5 Le gérant

Pendant le service, une seule page : la tour de contrôle. Ce qui est en retard, ce qui attend, ce qui
est anormal. Après le service, des analytics qui répondent à une question — jamais un mur
d'indicateurs affichés parce qu'ils existent.

---

## 8. Règles métier

Ces règles sont opposables : elles seront testées (§97) et un manquement est un défaut bloquant.

### Session de table
- **R1** — Une table physique n'a **au plus une** session ouverte à la fois.
- **R2** — Une session ne se clôture pas tant qu'il reste un montant dû, sauf geste explicite avec
  motif, journalisé, par quelqu'un qui en a le droit.
- **R3** — Clôturer une session ne supprime rien : elle passe à `closed` et reste consultable.
- **R4** — Plusieurs invités peuvent rejoindre la même session simultanément et commander en même
  temps.

### Commande
- **R5** — Une commande appartient à une session, jamais directement à une table.
- **R6** — Chaque ligne fige un **snapshot** de prix et de composition *(D-005)*.
- **R7** — Une commande envoyée deux fois par un double clic **n'en crée qu'une** *(D-010)*.
- **R8** — En mode `pre_paid`, aucun bon de production n'est généré avant confirmation du paiement.
- **R9** — Annuler après départ en production exige une permission distincte et un motif.
- **R10** — Un article devenu indisponible pendant qu'il est au panier est signalé **avant** l'envoi,
  jamais après.

### Production
- **R11** — Une commande se scinde en bons par station ; un bon appartient à une seule station.
- **R12** — La commande est `ready` quand **tous** ses bons le sont ; `partially_ready` sinon.
- **R13** — Un bon marqué prêt par erreur se rappelle (`recall`) — le journal garde les deux gestes.

### Argent
- **R14** — Aucun montant n'est accepté depuis le client : tout est recalculé côté serveur.
- **R15** — Un paiement en ligne n'est réputé réussi que sur **vérification serveur**, jamais sur une
  redirection.
- **R16** — Un webhook reçu deux fois ne produit qu'un seul effet *(D-010)*.
- **R17** — Une addition peut recevoir plusieurs paiements ; la somme allouée ne peut jamais dépasser
  le dû.
- **R18** — Une transaction financière ne se supprime pas : on l'annule ou on la rembourse, avec
  motif.
- **R19** — Un remboursement ne peut excéder le montant réellement encaissé.
- **R20** — La devise d'un établissement ne change plus dès qu'une opération financière existe.
- **R21** — La clôture de caisse enregistre attendu, compté et écart ; corriger l'écart exige une
  permission dédiée et un motif.

### Carte
- **R22** — La carte vue par le client est une **publication**, pas le brouillon en cours d'édition.
- **R23** — La disponibilité se calcule à la lecture : réglage manuel, plage horaire, jour,
  établissement, station.
- **R24** — Changer un prix n'affecte aucune commande déjà passée *(R6)*.

### Accès
- **R25** — Aucune requête ne franchit la frontière d'une organisation *(PERMISSIONS.md §6)*.
- **R26** — Toute permission est évaluée côté serveur.
- **R27** — Toute action sensible est journalisée avec son acteur.

### IA
- **R28** — L'IA ne répond que sur des données déclarées ; sur un allergène non renseigné, elle dit
  qu'elle ne sait pas.
- **R29** — Aucune action sensible n'est exécutée par l'IA sans validation humaine explicite.
- **R30** — L'IA ne voit jamais au-delà des permissions de celui qui la sollicite.

---

## 9. Périmètre fonctionnel

Tout est **conçu** maintenant ; la livraison est séquencée (*D-012*, voir `docs/ROADMAP.md`).

| Domaine | V1 | Ensuite |
|---|---|---|
| Organisation, établissements, équipe, rôles | ✅ | Rôles personnalisés avancés |
| Authentification personnel (OTP e-mail, Google) | ✅ | PIN de service, appareils enrôlés *(A1)* |
| Carte, sections, variantes, options, disponibilité | ✅ | Traductions assistées, saisonnalité |
| Plan de salle, tables, QR | ✅ | Éditeur graphique avancé, fusion de tables |
| Sessions de table, invités, panier | ✅ | — |
| Commandes, machine à états, services (`courses`) | ✅ | Séquencement avancé (`hold`/`fire` programmé) |
| Écran de production (KDS) | ✅ | SLA, priorisation automatique |
| Écran serveur, demandes de service | ✅ | — |
| Additions, partage, caisse, session de caisse | ✅ | — |
| Paiement en ligne (un fournisseur) | ✅ | Deuxième fournisseur, pourboires |
| Reçus | ✅ | Conformité fiscale par pays |
| Analytics d'exploitation | ✅ | Analytics avancées, cohortes |
| Onboarding + mode simulation | ✅ | — |
| Import de carte (manuel, CSV) | ✅ | Import IA depuis PDF/photo |
| IA (assistant, recommandations) | Socle | Assistant exploitation, actions validées |
| CRM, fidélité, réservations | Socle de données | Fonctionnalités complètes |
| Stock | Point d'ancrage seulement *(A3)* | Recettes, mouvements, inventaires |
| Super admin plateforme, abonnements | ✅ (minimal) | Facturation complète, usage |
| API publique, webhooks sortants | Conçu | Implémenté |

---

## 10. Ce qui ferait échouer le produit

Écrit ici pour qu'on le surveille, pas pour se rassurer.

1. **Le personnel le contourne.** C'est le mode d'échec numéro un des logiciels de restauration.
   Antidote : moins de gestes que la méthode actuelle, dès le premier jour *(A1, A2)*.
2. **Ça bloque le service un soir de rush.** Un seul incident de ce type fait désinstaller.
   Antidote : un chemin de secours toujours ouvert, et un offline étroit mais honnête *(A4)*.
3. **Le menu client est lent.** Trois secondes sur un téléphone d'entrée de gamme, et le client
   repose son téléphone. Antidote : budget de performance opposable.
4. **Une donnée d'une organisation apparaît chez une autre.** Antidote : le scope avant la donnée,
   testé automatiquement *(R25)*.
5. **Un écart de caisse inexpliqué.** La confiance perdue ne revient pas. Antidote : journal
   d'audit, idempotence, attribution systématique.
6. **On facture un produit qui ne fait gagner ni temps ni argent.** Antidote : chaque fonctionnalité
   doit pouvoir répondre à « laquelle des dix douleurs du §4 elle traite ».
