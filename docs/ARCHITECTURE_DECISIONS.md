# Document d'architecture — [PRODUCT_NAME]

> **Livrable §110.** Les 28 sections demandées, chacune avec des décisions concrètes.
> Ce document est la **synthèse opposable** ; le détail vit dans les documents cités.
> Écrit le 2026-09-17. Les affirmations sur le monde extérieur sont sourcées dans `docs/research/`.

| Document | Ce qu'il porte |
|---|---|
| [PRODUCT.md](../PRODUCT.md) | Vision, personas, problèmes, principes, terminologie, règles métier |
| [ARCHITECTURE.md](../ARCHITECTURE.md) | Diagrammes, modules, machines à états, temps réel, hors ligne |
| [DATA_MODEL.md](../DATA_MODEL.md) | 58 tables justifiées une par une + celles écartées |
| [PERMISSIONS.md](../PERMISSIONS.md) | Catalogue, rôles, résolution, verrous d'élévation |
| [SECURITY.md](../SECURITY.md) | 20 menaces, mitigations, vérifications |
| [PAYMENTS.md](../PAYMENTS.md) | Abstraction, argent, idempotence, caisse, fiscalité |
| [AI.md](../AI.md) | Couche IA, garde-fous, actions validées |
| [ANALYTICS.md](../ANALYTICS.md) | Indicateurs métier + analytique produit |
| [DEPLOYMENT.md](../DEPLOYMENT.md) | Environnements, CI, observabilité, incidents |
| [DECISION_LOG.md](DECISION_LOG.md) | 8 désaccords, 10 hypothèses, 11 questions, 30 décisions |
| [ROADMAP.md](ROADMAP.md) | 11 tranches verticales avec portes de sortie |

---

## 1. Compréhension de la vision

**Ce que j'ai compris, et qui gouverne tout le reste :** le produit demandé n'est pas un menu QR
amélioré. C'est l'**infrastructure de coordination du service**. Le QR est une porte d'entrée
physique — bon marché, visible, familière — mais la valeur est dans ce qui circule derrière : la
commande qui arrive en cuisine sans qu'on crie, le plat prêt que le serveur apprend sans aller voir,
l'argent qu'on peut compter le soir.

**La conséquence structurante**, et c'est elle qui décide de l'architecture : le restaurant
**configure son propre fonctionnement**. Un maquis où le serveur prend tout au carnet et où l'on
paie au comptoir, et un lounge où le client commande et paie sur son téléphone, doivent tourner sur
le même code, sans branche séparée.

**Trois axes de configuration indépendants** *(PRODUCT.md §2)* : qui saisit la commande · quand on
paie · où l'on paie. Ils sont lus par les machines à états, jamais dispersés en conditions.

**Ce que la recherche a ajouté à la vision.** La case « OS de service moderne à contraintes
africaines » est **vide** : aucun des treize acteurs internationaux étudiés n'a de présence africaine
documentée, aucun ne mentionne le Mobile Money, aucun ne traite la conformité fiscale locale. Et le
QR seul n'est plus défendable — deux acteurs majeurs du segment ont fusionné.

---

## 2. Hypothèses

Dix hypothèses documentées dans `DECISION_LOG.md` partie B, chacune avec son **coût si elle est
fausse** et sa méthode de vérification. Les plus structurantes :

| # | Hypothèse | Coût si fausse |
|---|---|---|
| H2 | L'espèce reste majoritaire, le Mobile Money progresse | Priorité caisse ↔ paiement en ligne inversée |
| H3 | Le personnel utilisera son propre téléphone Android | Il faut vendre du matériel — autre métier |
| H4 | La cuisine accepte une tablette si elle ne ralentit pas | Le KDS devient une imprimante à tickets |
| H5 | Le réseau tombe assez souvent pour justifier l'offline lecture | Effort PWA surdimensionné |

**Ce qui n'est pas une hypothèse mais un fait établi** : le franc CFA n'a pas de sous-unité ; la
conformité fiscale ivoirienne est en contrôle depuis septembre 2026 ; le plugin d'organisation de
Better Auth n'est pas supporté par le composant Convex.

**Le statut honnête des entretiens terrain** : le guide est écrit *(`docs/research/field-research-guide.md`)*,
**les entretiens ne sont pas faits**. Tout ce qui en dépend est marqué hypothèse, jamais fait.

---

## 3. Décisions produit

Trente décisions arrêtées dans `DECISION_LOG.md` partie D. Les huit qui changent le produit :

1. **Le mode par défaut est « QR + commande serveur »**, pas la commande directe *(A2)*. Le serveur
   peut saboter l'outil ; on ne lui retire pas la main par un réglage coché d'avance.
2. **L'espèce est un moyen de paiement de première classe** *(D-019)*, avec paiement mixte sur une
   même addition — ce qu'aucun concurrent étudié ne traite.
3. **Aucun matériel propriétaire** *(D-021)* : le téléphone du personnel est le terminal, le KDS
   tourne sur tablette d'entrée de gamme, sans supplément par écran.
4. **La pièce remise s'appelle « ticket »**, jamais « reçu » ni « facture » avant certification
   *(D-024)* — ces deux mots désignent des pièces réglementées.
5. **Le pourboire est désactivé par défaut** *(D-027)* : son cadre légal local n'a pas été établi.
6. **Le fournisseur de paiement se change par configuration en base**, jamais par déploiement
   *(D-026)*.
7. **L'IA ne décide jamais seule** *(D-014)* : proposition → aperçu → validation → exécution →
   journal.
8. **Livraison par tranches verticales** *(D-012)* : chaque étape se termine par « un restaurant
   peut… ».

**Les huit désaccords avec le brief** sont en partie A du `DECISION_LOG.md`. Le plus important est
**A8** : le hors-ligne pair-à-pair est le meilleur différenciateur trouvé *et* il est incompatible
avec la stack choisie. C'est un arbitrage d'investissement qui appartient à l'utilisateur.

---

## 4. Architecture globale

Diagrammes dans `ARCHITECTURE.md §1` et `§2`.

```
Navigateurs → Vercel (TanStack Start, SSR + SPA) → Convex (état, temps réel, métier) → services tiers
                       ↑ fonctions serveur : webhooks (corps brut), sitemap, images sociales
```

**Quatre décisions de forme :**

- **Aucun secret côté navigateur.** Clés de paiement, de modèles IA, d'e-mail : uniquement dans des
  *actions* Convex ou des fonctions serveur.
- **Les webhooks n'entrent pas directement par Convex** mais par une fonction serveur qui vérifie la
  signature sur le **corps brut**, puis appelle une mutation idempotente. C'est la vérification de
  signature qui impose ce point d'entrée.
- **Le temps réel n'est pas une option** : les écrans d'exploitation sont des abonnements, jamais des
  interrogations périodiques.
- **20 modules par domaine**, avec une règle de dépendance qui ne remonte jamais ; `billing`
  restreint mais n'accorde jamais.

---

## 5. Stack exacte

| Couche | Choix | Raison |
|---|---|---|
| Framework | TanStack Start + TanStack Router | SSR pour le SEO et la vitesse du menu, typage de bout en bout |
| UI | React 19, TypeScript strict, Tailwind v4, shadcn/ui, Radix, Lucide | Deux systèmes de design sur un socle *(§67)* |
| Backend | Convex | Réactivité native — c'est elle qui rend le KDS et la tour de contrôle possibles sans infrastructure de temps réel à écrire |
| Auth | Better Auth via `@convex-dev/better-auth` | Code à usage unique + Google, sans mot de passe |
| Données | Requêtes réactives Convex ; TanStack Query **uniquement** hors Convex | Deux caches sur la même donnée = deux vérités |
| Validation | Validateurs Convex **obligatoires** côté serveur ; Zod côté client | La barrière est serveur |
| Mouvement | Motion ; GSAP réservé au marketing complexe | |
| Glisser-déposer | dnd-kit | Plan de salle, tri de carte |
| IA | Vercel AI SDK + abstraction fournisseur | Modèles interchangeables *(§31)* |
| Analytique | PostHog ou équivalent | |
| E-mail | Resend derrière une abstraction | Changer de fournisseur sans toucher au métier |
| Tests | Vitest, Playwright, axe | |
| Hébergement | Vercel + Convex | |

**Une décision de méthode** : `@latest` est le mauvais choix sur les trois paquets les plus
structurants *(section 6)*. On installe des versions choisies, jamais des versions disponibles.

---

## 6. Versions et compatibilités

Tableau complet, sourcé au registre npm et aux documentations officielles :
[`docs/research/stack-compatibility.md`](research/stack-compatibility.md).

**Les quatre pièges identifiés, et ce qu'on en fait :**

| Piège | Décision |
|---|---|
| `better-auth@latest` (1.7.x) **casse l'authentification** : le composant Convex exige `< 1.7.0` | Épinglé avec un **tilde** `~1.6.x`, jamais `^` *(D-017)*. Le dépôt de référence porte ce piège armé — on ne le reproduit pas |
| `typescript@latest` est la 7.x (portage Go) : divergence d'inférence documentée avec TanStack Router, ticket ouvert. **Même nom de paquet, même binaire** → bascule invisible | Reste en `~5.9.x` *(D-018)*. Réévaluation à la clôture du ticket |
| `vite@latest` est la 8.x mais le greffon React 6.x exige Vite 8 **exclusivement** | Vite 7 + greffon 5.2.0 (qui accepte `^7 \|\| ^8`) : la migration coûtera deux lignes |
| Couple IA indivisible : provider 2.x ⇔ SDK v6, provider 3.x ⇔ SDK v7 | SDK v7 retenu (projet neuf, pas de dette) — **à confirmer** |

**Le point de compatibilité qui a changé le modèle de données** : le plugin `organization` de Better
Auth **ne figure pas** dans la liste supportée par le composant Convex. Trois voies existaient ; on
retient la première — modéliser les tenants nous-mêmes *(D-016)* — parce que le plugin ne modélise de
toute façon pas la portée par établissement, et qu'avoir deux sources de vérité sur l'appartenance
serait pire que d'écrire les invitations soi-même.

**Décision laissée ouverte** : la gestion de formulaires (trois candidats crédibles, aucun décisif).

---

## 7. Architecture multi-tenant

`organization` (le tenant, porte l'abonnement) → `venue` (l'établissement physique).
Un utilisateur est **membre** d'une organisation, et ses rôles sont **portés par établissement**.

**Trois invariants** *(ARCHITECTURE.md §3)* :

1. `organizationId` sur toute table métier ; `venueId` dès que la donnée est locale.
2. **Un index n'exige un préfixe de portée que s'il est atteignable par un identifiant venant du
   client sans garde préalable** — marqué `SCOPE-CRITIQUE` dans le schéma. Les autres sont atteints
   après une garde.
3. **La portée se vérifie avant la lecture, jamais après.** Le contre-exemple précis est dans
   `PERMISSIONS.md §6`.

**Sur une ressource d'une autre organisation, on répond `NOT_FOUND`, jamais `FORBIDDEN`** : répondre
« interdit » confirme son existence.

**Le test le plus important du produit** : deux organisations, et pour **chaque** fonction publique,
une tentative d'accès croisé. Il doit échouer bruyamment si quelqu'un ajoute une fonction sans garde.

> Le dépôt de référence `filon` annonce « multi-tenant strict » mais est **mono-utilisateur** : son
> commentaire dit lui-même qu'« aucune table métier ne porte d'`organizationId` », et la visibilité
> d'équipe se calcule en itérant les membres. Ses 181 index sont préfixés par `userId`. Son modèle
> de portée n'est donc **pas** réutilisable ; sa méthode de nommage d'index l'est.

---

## 8. Rôles et permissions

Catalogue complet, matrice des rôles et algorithme : [`PERMISSIONS.md`](../PERMISSIONS.md).

**Quatre décisions :**

1. **Le catalogue vit dans le code**, pas en base *(D-002)* : une permission naît avec la
   fonctionnalité qu'elle protège. Seuls les **rôles** sont des données.
2. **Un rôle est un sac de permissions, pas une identité.** Le code demande « a-t-il `order.create`
   sur cette venue ? », jamais « est-ce un serveur ? ».
3. **Toute permission s'évalue dans un scope.** « Manager de Cocody et Plateau » n'est pas
   « Manager ».
4. **La barrière est dans Convex.** L'interface masque ; elle ne protège pas.

**Trois découpages délibérés**, parce qu'ils décident de l'utilisabilité réelle :
`menu.availability.toggle` séparé de `menu.price.edit` (un chef de rang signale une rupture sans
pouvoir toucher aux prix) · `order.modify.after_fire` séparé de `order.modify` (modifier après
départ en production coûte des denrées) · `ai.actions.approve` séparé de `ai.actions.propose` (c'est
la séparation qui empêche l'IA d'agir seule).

**Trois verrous d'élévation** : on ne donne pas ce qu'on n'a pas · on ne modifie pas ses propres
droits · aucune permission `platform.*` n'est attribuable, filtrée **à l'écriture**.

---

## 9. Carte des routes

Détail complet et wireframes : [`docs/INFORMATION_ARCHITECTURE.md`](INFORMATION_ARCHITECTURE.md).

```
PUBLIC        /  /fonctionnalites/*  /solutions/*  /tarifs  /demo  /contact
              /ressources  /blog/*  /guides/*  /securite  /confidentialite  /conditions
              /connexion  /auth/otp
MENU PUBLIC   /menu/$venueSlug                        ← indexable SI le restaurant l'active
CLIENT        /r/$venueSlug/t/$token → 302 → /r/$venueSlug/table   ← NOINDEX, sans secret
APP           /app  /app/live  /app/tables  /app/floor  /app/orders  /app/kitchen/$stationId
              /app/cashier  /app/registers  /app/payments  /app/menu/*  /app/customers
              /app/analytics  /app/team  /app/roles  /app/ai  /app/settings/*
PLATEFORME    /admin/*
```

**La décision de route la plus importante** *(D-023)* : l'URL du QR **n'est pas** l'URL qu'on
consulte. Le scan **échange** le jeton contre un cookie `httpOnly`, puis **redirige en 302 vers une
URL sans secret**. Le jeton disparaît de l'historique, du partage, des journaux, de l'analytique et
de l'en-tête `Referer`. Aucune autre couche ne supprime le problème — elles ne font que le limiter.

**La navigation n'est pas une liste de 35 entrées** *(§58)* : elle se réduit et se hiérarchise selon
le rôle. Un cuisinier voit un écran, pas un menu.

---

## 10. Plan du site marketing

Validé et priorisé dans [`docs/research/seo-strategy.md`](research/seo-strategy.md) §3.

**Décisions d'internationalisation** *(D-029)* : sous-dossiers `/fr/` et `/en/` avec préfixe
explicite pour les deux, sur un seul domaine · **une seule locale française** (pas de `fr-CI`,
`fr-SN`… qui produiraient des quasi-doublons) — les pays se différencient par des **pages marché**
distinctes · `x-default` vers le français · **aucune redirection automatique** selon la langue du
navigateur ou l'adresse IP : Google l'interdit, et son robot explorant depuis des adresses
américaines en anglais, une telle redirection pourrait rendre tout le contenu français inexploré.

---

## 11. Parcours utilisateurs

Les six parcours critiques sont détaillés dans `docs/INFORMATION_ARCHITECTURE.md` ; les parcours
métier sont dans `PRODUCT.md §7`.

**Le parcours fondamental** : le client s'installe → scan → carte → composition → envoi →
cuisine/bar → préparation → serveur prévenu → service → nouvelle commande éventuelle → addition →
partage → paiement → clôture → fidélisation → données.

**Deux principes qui gouvernent tous les parcours** : aucune inscription n'est jamais exigée avant
la consultation de la carte ; et il reste toujours un chemin pour servir et encaisser même si le
logiciel hésite.

---

## 12. Machines à états

Diagrammes dans `ARCHITECTURE.md §4` à `§8`. Cinq machines explicites, validées **côté serveur** :
session de table · commande · bon de production · paiement · session de caisse.

**Ce que la machine de commande règle, et qui justifie sa complexité** : les trois modes de service
convergent sur `accepted`. La transition sortante de `submitted` est **choisie par lecture des
réglages de l'établissement**, pas par une condition disséminée. Ajouter un quatrième mode, c'est
ajouter une transition — pas un `if` dans dix fichiers.

**Trois états qui existent parce que la réalité existe** : `partially_ready` (une table de quatre
reçoit rarement ses quatre plats ensemble — sans cet état, le serveur ne sait pas quoi porter) ·
`closed_with_debt` (un client part sans payer ; le nier laisserait des sessions ouvertes pour
toujours) · `recalled` (un plat déclaré prêt par erreur est une information de service, pas une
faute à effacer).

---

## 13. Schéma de données Convex

[`DATA_MODEL.md`](../DATA_MODEL.md) — **59 tables**, chacune avec objectif, champs, index, relations,
permissions et cycle de vie. Le schéma est écrit : `convex/schema.ts`, **1 341 lignes, typecheck
vert**.

**Le brief proposait ~150 tables et demandait de justifier chacune.** Résultat : 59 retenues,
12 écartées avec leur raison, 5 groupes différés **avec leur point d'ancrage** — le champ déjà prévu
qui permettra de les brancher sans migration douloureuse.

**Les écarts les plus significatifs, et pourquoi :**

- `permissions` **n'est pas une table** : seconde source de vérité à migrer, et typage impossible.
- Les suppléments d'une ligne de commande sont **intégrés**, pas en table : c'est un snapshot
  immuable, toujours lu avec sa ligne, sur le chemin de lecture le plus chaud du produit.
- Les **11 tables de stock** ne sont pas créées : construire l'inventaire avant d'avoir une commande
  qui fonctionne, c'est bâtir le premier étage avant le rez-de-chaussée.
- `receipts` devient **`bills`** : « reçu » et « facture » désignent des pièces certifiées.

**Quatre dénormalisations assumées et justifiées** : `restaurantTables.activeSessionId` (garantit
qu'une table n'a qu'une session ouverte, et évite N requêtes sur l'écran serveur) ·
`tableSessions.totals` (l'écran serveur affiche trente soldes ; écrit **uniquement** par les
mutations d'argent, et vérifié quotidiennement contre le calcul complet) ·
`kitchenTickets.tableNumber` + noms dupliqués dans les lignes de bon (zéro jointure sur un écran qui
se rafraîchit en continu sur une tablette d'entrée de gamme) · et **`organizationId` recopié à côté
de `venueId` sur une cinquantaine de tables**, au service de l'analytique consolidée — celle-là est
la plus dangereuse, parce qu'une ligne dont les deux champs désignent deux organisations est une
fuite que rien n'attrape : elle est donc gardée par `assertSameOrg()` à l'écriture **et** par un
contrôle d'intégrité récurrent *(`CRITIQUE.md` B2)*.

---

## 14. Index

**142 index, 1 index de recherche, 6 au maximum par table** — très en deçà du plafond de 32.
Vérifié par script : aucun doublon, aucune limite Convex dépassée, et tout index marqué
`SCOPE-CRITIQUE` porte bien un préfixe de portée ou sa justification.

> **Correction assumée.** Une version antérieure de ce document affirmait « règle de portée
> respectée, vérifié par script ». C'était **faux** : la règle exigeait alors une clé de portée en
> tête de *chaque* index, 78 index sur 142 y dérogeaient, et le script de vérification portait une
> liste de dérogations si large qu'il ne vérifiait rien. La revue adverse l'a relevé *(`CRITIQUE.md`
> B1)*. La règle était inapplicable parce qu'elle était **fausse** : ce qui protège du franchissement
> de tenant, c'est la garde qui résout la portée depuis l'appelant, pas la forme de l'index. Règle et
> script ont été refaits.

**Les cinq index du chemin critique** *(DATA_MODEL.md §11)* :

| Index | Écran | Fréquence |
|---|---|---|
| `kitchenTickets.by_station_status_queued` | Cuisine | permanent, sur chaque tablette |
| `tableSessions.by_venue_status` | Serveur, caisse, tour de contrôle | permanent |
| `products.by_section_sort` | Menu client | à chaque scan |
| `orders.by_venue_status_submitted` | Retards | permanent |
| `payments.by_register_session` | Clôture de caisse | chaque fin de service |

**Règle de vérification** : écrire la requête **avant** l'index. Si elle a besoin d'un filtre après
l'index sur un volume significatif, l'index est faux.

---

## 15. Architecture frontend

`ARCHITECTURE.md §9`. Routes fines · métier dans `features/` · `components/ui` sans métier ·
`guest/` et `ops/` partagent les jetons de design, pas la densité.

**Quatre règles opposables** : une route qui dépasse ~150 lignes a sa logique au mauvais endroit ·
une feature n'importe une autre que par son `index.ts` (c'est ce qui évite les dépendances
circulaires) · `components/ui` ne sait pas ce qu'est une commande · chaque écran implémente **six
états** : chargement, vide, erreur, permission refusée, hors ligne, succès.

**Rendu** : SSR + cache pour la landing et les menus publics · SSR de la coquille puis abonnement
pour le menu client · SPA authentifiée pour l'application · abonnement seul pour le KDS.

---

## 16. Architecture backend

`ARCHITECTURE.md §10`. Découpage par domaine, jamais de fichier fourre-tout. Dans chaque domaine :
`queries` · `mutations` · `actions` · `internal` · `model` (règles pures, testables sans base) ·
`machine` (transitions).

**Le patron de toute mutation publique, dans cet ordre, sans exception** : garde de permission et de
portée → limitation de débit → chargement en vérifiant l'appartenance à la portée → transition
validée par la machine → écriture de l'état, de l'événement métier, et de l'audit si sensible.

**Six interdits cherchés en revue** : fonction publique sans garde · `.collect()` sans index de
portée · statut écrit en dur hors machine · montant reçu du client et enregistré tel quel · appel
sortant dans une mutation · fonction qui fait trois choses.

---

## 17. Direction de design

[`DESIGN.md`](../DESIGN.md). **Aucune identité visuelle reprise du dépôt de référence** *(D-013)* :
seules sa méthode et sa discipline le sont.

**Deux systèmes, un socle** *(§67)* : « Guest » (aéré, photographique, grands boutons, feuilles
basses) et « Ops » (dense, tabulaire, temps réel, raccourcis). Mêmes jetons, densités opposées.

**Deux surfaces traitées à part** : le **KDS** (tablette en cuisine, mains mouillées, bruit, lecture
à un mètre — zones tactiles généreuses, contraste fort, aucune animation) et la **caisse** (tactile
prioritaire, clavier en accélérateur).

**Accessibilité WCAG 2.2 AA minimum** : cibles ≥ 44 px, navigation clavier, focus visible,
`prefers-reduced-motion`, et **jamais d'information portée uniquement par la couleur** — un badge
porte couleur **+ forme + libellé**.

**Contrainte matérielle qui contraint le design** : 81 % des smartphones vendus en Afrique en 2025
sont sous 200 $. Cela borne le poids des polices, des images et des effets.

---

## 18. Onboarding

`§37`, `§38`. Onboarding **progressif**, pas 21 écrans successifs : un tableau de progression, des
étapes regroupées, et « configurer plus tard » partout où c'est possible.

**Trois questions plutôt qu'un choix parmi douze profils** : qui saisit la commande · quand on paie ·
où l'on paie.

**Le mode simulation est une fonctionnalité de premier plan, pas un gadget.** Avant même d'imprimer
un QR, le gérant simule une table, commande comme un client, voit la commande arriver en cuisine, la
passe prête, la sert, l'encaisse. **Le produit s'enseigne par l'action**, pas par un manuel — et
c'est ce qui permet de former un nouveau serveur dans un secteur à forte rotation.

**Porte de sortie mesurable** *(ROADMAP T7)* : trois restaurants s'installent sans assistance.

---

## 19. Paiements

[`PAYMENTS.md`](../PAYMENTS.md).

**Le piège qui coûte un facteur 100** : le franc CFA a un **exposant décimal de 0**. Le réflexe
« un montant se stocke en centimes, donc × 100 » **surfacture le client d'un facteur 100**. Le
facteur d'échelle est **dérivé de la devise**, jamais écrit en dur.

**Ordre d'intégration** *(D-025)* : `CashProvider` d'abord — l'espèce reste dominante, **et** elle
valide le contrat avant d'écrire le premier adaptateur HTTP ; puis un fournisseur qui documente par
écrit les quatre garanties nécessaires (webhooks signés et horodatés, identifiant d'événement dédié à
la déduplication, remboursement idempotent, réessais) ; puis un agrégateur multi-rails, **jamais en
rail unique**.

**Le fournisseur actif se change par configuration en base** *(D-026)* : un agrégateur régional est
entré en liquidation en 2025, un autre a subi une cyberattaque reconnue, et le cadre interbancaire
régional évolue.

**Idempotence partout** ; **deux chemins de confirmation** (retour client et webhook) convergeant sur
la même mutation ; **réconciliation quotidienne** avec trois écarts typés — dont « chez nous, pas
chez eux », qui est le cas grave.

**Fiscalité** : `FiscalProvider` par juridiction, `NoopFiscalProvider` par défaut. **On ne code pas
une intégration dont on n'a pas lu le contrat** : la spécification n'a pas pu être obtenue.

---

## 20. IA

[`AI.md`](../AI.md). **Critère d'admission** : gagner du temps, vendre plus, réduire les erreurs,
améliorer le service, faciliter l'exploitation, ou apporter une intelligence inaccessible autrement.
Sinon, on ne construit pas.

**Quatre interdits** : ne rien inventer · ne jamais dépasser les droits du demandeur · ne jamais agir
seule sur du sensible · ne jamais obéir à un document importé.

**Sur les allergies, la formulation est fixée**, pas laissée au modèle : *« Le restaurant n'a pas
renseigné les allergènes de ce plat. Je ne peux pas vous répondre. Demandez au serveur. »* C'est le
seul endroit du produit où l'on préfère explicitement une mauvaise expérience à un risque.

**L'import de carte est la fonctionnalité qui fait gagner le plus de temps** — saisir 120 plats à la
main est la première raison d'abandonner avant d'avoir essayé. Avec un indice de confiance **par
champ**, une validation humaine **obligatoire**, et **aucun allergène déduit**.

**Ordre des recommandations** : règles déterministes → données → IA. Et une fonctionnalité d'IA qui
coûte plus qu'elle ne rapporte est **retirée**.

---

## 21. SEO

[`docs/research/seo-strategy.md`](research/seo-strategy.md).

**Trois croyances répandues corrigées par la vérification** : `Menu`/`MenuSection`/`MenuItem` ne
donnent **aucun** résultat enrichi (on les balise pour les assistants, sans les compter comme
levier) · `FAQPage` est réservé à des sites reconnus · `SoftwareApplication` exige une note ou un
avis → on publie sans note et on attend de vrais avis plutôt que d'en inventer.

**Le point contre-intuitif et central** *(D-030)* : **il ne faut surtout pas mettre `Disallow: /r/`
dans `robots.txt`**. Interdire l'exploration empêcherait Google de **voir** le `noindex`, et l'URL
pourrait être indexée sans extrait. On laisse explorer, et on interdit d'indexer.

**Porte de qualité avant d'indexer un menu public** : un minimum de plats, des descriptions, une
adresse, des horaires, une carte fraîche. Elle ralentit volontairement la boucle de croissance
plutôt que de publier des pages pauvres.

**Aucun volume de recherche n'est affirmé** : les outils fiables manquent sur ces marchés. Les
priorités sont classées par valeur × difficulté observée, et la Search Console sera la seule source
fiable une fois en ligne.

---

## 22. Analytique

[`ANALYTICS.md`](../ANALYTICS.md). Deux analytiques à ne pas confondre : celle du restaurateur et la
nôtre.

**Le test avant d'afficher un indicateur** : quelle décision change selon sa valeur · comparé à quoi
il est lisible · qui agit dessus et depuis où. Sans les trois réponses, il ne s'affiche pas.

**Cinq règles de calcul qui évitent des chiffres faux** : la journée est celle de l'établissement,
dans sa timezone · un service à cheval sur minuit appartient à sa journée d'ouverture · les
annulations et remboursements sont exclus **et affichés à part** · les commandes de test et le mode
simulation ne comptent jamais · une moyenne s'affiche avec son effectif.

**North star candidate** : le nombre d'établissements ayant traité au moins N commandes **réelles**
sur 7 jours glissants — un compte créé sans commande ne compte pas. Elle reste **candidate** jusqu'aux
premiers usages réels.

**Un avertissement inscrit dans le produit** : les indicateurs par personne servent à organiser, pas
à surveiller. Le produit ne propose pas de « classement des serveurs ».

---

## 23. Sécurité

[`SECURITY.md`](../SECURITY.md) — **20 menaces**, chacune avec attaquant, scénario, impact,
mitigation et **méthode de vérification**.

**Les quatre plus structurantes** : évasion de tenant (fatale) · QR photographié (la plus concrète —
traitée par l'échange jeton → cookie, puis par les modes de service configurables) · falsification de
webhook · injection de consigne dans l'IA.

**Ce qu'on assume et qu'on écrit** : en mode `frictionless`, une photo de QR permet de rejoindre une
session ouverte. C'est un choix du restaurant, présenté comme tel dans l'onboarding avec sa
conséquence. On ne prétend pas que le mode le plus fluide est aussi le plus sûr.

**Ce qu'on n'affirmera pas** : aucune certification, aucun engagement de disponibilité chiffré,
aucune garantie de localisation, aucun audit externe — tant que ce ne sera pas vrai. La page
publique reprendra **exactement** cette liste.

---

## 24. Tests

| Niveau | Objet |
|---|---|
| Unitaire | Argent, taxes, disponibilité, partage d'addition, transitions — **sans base** |
| Convex | Gardes, portées, idempotence, invariants transactionnels |
| Contractuel | Fournisseurs de paiement : signature valide, invalide, rejouée, périmée |
| Bout en bout | Les parcours critiques, sur navigateur réel |
| Accessibilité | Écrans principaux, clavier et lecteur d'écran |

**Les tests non négociables** *(§97)* : isolation multi-tenant (le plus important) · permission
refusée **côté serveur** malgré une UI masquée · double clic sur « Commander » → une seule commande ·
webhook en double → un seul effet · remboursement supérieur à l'encaissé → refusé · division en 3
avec reste → somme exacte · article indisponible dans un panier → signalé **avant** l'envoi.

**Ce qu'on ne reprend pas du dépôt de référence** : `filon` n'a **aucun test** et aucun script de
lint — vérifié. C'est l'écart exact à ne pas reproduire, dès le premier jour.

---

## 25. Observabilité

`DEPLOYMENT.md §6`. Chaque incident se relie à trace, organisation, établissement, utilisateur,
route, opération — **et à rien d'autre**. Jamais de jeton, de code à usage unique, de donnée de
paiement ni de contenu de commande dans un journal.

**Journaux structurés avec liste d'inclusion explicite**, jamais d'exclusion : une liste d'exclusion
laisse toujours passer le prochain champ ajouté.

**Une alerte réveille quelqu'un ou n'existe pas.** Et le service du soir est le moment sensible :
une alerte sur un établissement en plein service ne doit pas attendre le lendemain.

---

## 26. Déploiement

`DEPLOYMENT.md`. Quatre environnements. **Trois interdits absolus** : jamais la base de production
en prévisualisation · jamais les mêmes identifiants de paiement entre deux environnements · jamais
de données réelles dans un jeu de démonstration.

Un contrôle au démarrage **refuse de démarrer** si un environnement autre que la production trouve
une clé de production — un avertissement dans un journal serait lu trop tard.

**L'ordre de déploiement compte** : le schéma Convex avant le frontend. **Les changements de schéma
sont additifs d'abord** : ajouter, remplir, puis rendre obligatoire — parce qu'un client ouvert, ici,
est un serveur en plein service.

**Les en-têtes de sécurité se vérifient par `curl -I` après déploiement**, jamais par la
configuration seule.

---

## 27. Risques

> Numérotés `RQ…` et non `R…` : `PRODUCT.md` utilise déjà `R1`–`R30` pour les **règles métier**.
> Deux séries qui se ressemblent dans des documents qui se citent finissent par être confondues.

| # | Risque | Probabilité | Impact | Ce qu'on fait |
|---|---|---|---|---|
| RQ1 | **Le personnel contourne l'outil** — mode d'échec n°1 du secteur | Élevée | Fatal | Moins de gestes que la méthode actuelle dès le premier jour ; PIN de service *(A1)* ; mode serveur par défaut *(A2)* |
| RQ2 | **Blocage du service un soir de rush** | Moyenne | Fatal | Chemin de secours toujours ouvert ; hors-ligne étroit mais honnête ; jamais de « commande envoyée » non confirmée |
| RQ3 | **Menu client lent** sur téléphone d'entrée de gamme | Moyenne | Élevé | Budget de performance opposable, mesuré en 4G bridée |
| RQ4 | **Fuite de portée entre organisations** | Faible | Fatal | Portée avant donnée, testée automatiquement sur chaque fonction |
| RQ5 | **Écart de caisse inexpliqué** | Moyenne | Élevé | Attendu calculé, jamais saisi ; audit nominatif ; idempotence |
| RQ6 | **La FNE devient bloquante avant qu'on l'ait intégrée** | Élevée | Élevé | Abstraction prête ; **obtenir la spécification est un préalable utilisateur**, pas une tâche de développement |
| RQ7 | **Le hors-ligne promis n'est pas tenu** | Moyenne | Élevé | On ne promet que les trois cercles qu'on tient *(A4)* ; A8 tranché par l'utilisateur |
| RQ8 | **Montée de version qui casse l'authentification** | Moyenne | Élevé | Tilde sur `better-auth`, `strict-peer-dependencies`, contrôle en CI *(D-017)* |
| RQ9 | **Dépendance à un fournisseur de paiement défaillant** | Moyenne | Élevé | Abstraction + changement par configuration + jamais de rail unique *(D-026)* |
| RQ10 | **Le produit ne fait gagner ni temps ni argent** | Faible | Fatal | Chaque fonctionnalité doit nommer laquelle des dix douleurs elle traite |
| RQ11 | **Les entretiens terrain contredisent l'ordre de construction** | Moyenne | Moyen | Hypothèses explicitement marquées ; roadmap révisable |

---

## 28. Feuille de route d'implémentation

[`docs/ROADMAP.md`](ROADMAP.md) — **11 tranches verticales**, chacune se terminant par « à la fin, un
restaurant peut… » et par une **porte de sortie mesurable**.

```
T0 Fondations              → le contrôle d'accès tient (test d'isolation vert)
T1 La carte est en ligne   → menu client < 2,5 s sur Android d'entrée de gamme
T2 Le service passe par le logiciel  → un service complet réel sans retour au carnet   ← LE CŒUR
T3 L'argent est tracé      → une clôture de caisse réelle qui tombe juste
T4 Le client commande      → 4 personnes, 4 appareils, aucune commande perdue
T5 Paiement en ligne       → la batterie de tests paiement passe
T6 Le gérant comprend      → retards visibles pendant le service
T7 Installation autonome   → 3 restaurants s'installent sans nous
T8 Les groupes · T9 Relation client · T10 L'ouverture
```

**Ce qui traverse toutes les tranches** : accessibilité dans chaque tranche (jamais « à la fin »),
français et anglais livrés ensemble, une tranche sans tests n'est pas finie, et la conformité
fiscale démarre **dès que la spécification est en main**, quelle que soit la tranche en cours.

**Trois décisions peuvent changer cet ordre** : le hors-ligne pair-à-pair *(A8)* · le PIN de service
*(A1)* · les entretiens terrain, qui ne sont **pas encore faits**.
