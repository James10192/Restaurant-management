# ANALYTICS.md — Joliba

> §41 (analytique métier) et §83 (analytique du produit lui-même).
> *« Ne jamais afficher un KPI uniquement parce qu'il existe. Chaque dashboard doit aider à prendre
> une décision. »*

---

## 1. Deux analytiques à ne pas confondre

| | **Métier** — pour le restaurateur | **Produit** — pour nous |
|---|---|---|
| Question | « Comment va mon restaurant ? » | « Le produit sert-il à quelque chose ? » |
| Source | Nos propres données Convex | Instrumentation d'événements |
| Fraîcheur | Temps réel ou quotidien | Quotidien |
| Public | Client | Équipe |
| Confidentialité | Les données du client lui appartiennent | Jamais de donnée identifiante d'un convive |

Les mélanger produit des tableaux de bord que personne ne lit : le restaurateur se moque de notre
taux d'activation, et nous ne décidons rien avec son ticket moyen.

---

## 2. Le test avant d'afficher un indicateur

Trois questions. Si l'une reste sans réponse, l'indicateur ne s'affiche pas.

1. **Quelle décision change** selon sa valeur ?
2. **Comparé à quoi** est-il lisible ? (Un nombre seul ne dit rien : 340 000 FCFA, c'est bien ou mal ?)
3. **Qui agit** dessus, et depuis quel écran ?

C'est ce test, appliqué sérieusement, qui évite le « mur de KPI » que le brief interdit (§39).

---

## 3. Analytique métier

### 3.1 Aujourd'hui — l'écran du gérant pendant le service

Il répond à **une** question : *« Que dois-je regarder maintenant ? »*

| Bloc | Contenu |
|---|---|
| Chiffres du jour | CA, commandes, ticket moyen, tables ouvertes, temps moyen de préparation |
| **Alertes** | 3 commandes en retard · 1 caisse à clôturer · 2 articles indisponibles · 1 écart de caisse |
| Activité récente | Le fil de ce qui vient de se passer |
| Comparaison | Aujourd'hui vs **jour comparable** (même jour de semaine), jamais vs hier |

> **Pourquoi le jour comparable.** Comparer un samedi à un vendredi produit une alarme tous les
> samedis. Un restaurant a un rythme hebdomadaire, pas quotidien.

Les alertes passent **avant** les chiffres : un chiffre se consulte, une alerte se traite.

### 3.2 Les indicateurs, par famille

**Ventes** — CA (brut, net, par moyen de paiement) · nombre de commandes · ticket moyen · articles
par commande · CA par couvert · CA par heure · CA par zone.

**Produits** — les plus vendus (volume et valeur) · les moins vendus · **taux d'annulation par
produit** (signal d'un problème de carte ou de cuisine) · produits souvent achetés ensemble ·
indisponibilités et leur durée.

**Service** — les cinq délais qui décrivent une soirée :

| Délai | Ce qu'il révèle |
|---|---|
| commande → acceptation | Réactivité de la salle |
| acceptation → début de préparation | Engorgement en cuisine |
| début → prêt | Temps de production réel vs annoncé |
| prêt → servi | **Le plus révélateur** : un plat prêt qui attend, c'est un service désorganisé |
| demande client → prise en charge | Qualité perçue du service |

**Tables** — taux d'occupation · rotation · durée moyenne de session · CA par table · sessions
abandonnées · sessions clôturées avec impayé.

**Cuisine** — bons par station et par heure · dépassements de délai cible · rappels de bons ·
charge comparée entre stations.

**Paiements** — répartition par moyen · taux de réussite en ligne · délai de règlement par
fournisseur · **écarts de caisse dans le temps** · remboursements (montant, motif, auteur).

**Équipe** — commandes prises, tables servies, encaissements, temps de réponse aux demandes.

> **Un avertissement à écrire dans le produit.** Ces indicateurs par personne servent à
> *organiser*, pas à *surveiller*. Un classement individuel affiché en salle abîme une équipe plus
> vite qu'il ne l'améliore. Ils sont réservés au manager, jamais affichés publiquement, et le
> produit ne propose pas de « classement des serveurs ».

**Clients** — nouveaux vs habitués (sur les profils volontaires) · fréquence · note moyenne ·
sujets récurrents des avis.

### 3.3 Le tunnel du client à table

Propre au produit, et c'est lui qui dit si le QR sert réellement :

```
scan → carte consultée → article ajouté → commande envoyée → servie → payée
```

Une chute entre « carte consultée » et « article ajouté » signale une carte trop longue, sans photos,
ou des prix qui surprennent. Une chute entre « ajouté » et « envoyé » signale une hésitation à
commander seul — souvent le signe qu'il faut passer en mode validation par le serveur.

### 3.4 Règles de calcul

- **La journée est celle de l'établissement**, dans sa timezone (§76). « Aujourd'hui » à Abidjan
  n'est pas « aujourd'hui » du serveur.
- **Le service à cheval sur minuit** appartient à la journée d'ouverture : une table ouverte à 23 h
  et clôturée à 1 h compte le jour où les clients se sont installés. Sinon tous les restaurants de
  nuit ont des chiffres faux.
- **Les montants annulés et remboursés sont exclus** du CA, et **affichés à part** — pas soustraits
  en silence.
- **Les commandes de test et le mode simulation** (§38) ne comptent jamais. C'est une erreur banale,
  et elle rend tous les chiffres suspects quand on la découvre.
- Les comparaisons portent sur des périodes de même nature.

### 3.5 Comment c'est calculé techniquement

| Besoin | Approche |
|---|---|
| Aujourd'hui, temps réel | Requête directe, index `by_venue_*` bornés à la journée |
| Historique (semaines, mois) | Agrégats quotidiens précalculés par tâche planifiée |
| Détail à la demande | Requête paginée sur la période |

On ne recalcule pas six mois d'historique à chaque ouverture d'écran. L'agrégat quotidien est écrit
la nuit, dans la timezone de l'établissement, et il est **recalculable** : une correction tardive
(remboursement, annulation) déclenche la reconstruction du jour concerné.

---

## 4. Analytique produit

### 4.1 Le tunnel d'activation

```
landing vue → démo lancée → inscription commencée → inscription terminée
→ organisation créée → établissement créé → carte importée → première table créée
→ premier QR généré → commande de test réussie → PREMIÈRE VRAIE COMMANDE
→ paiement configuré → équipe invitée
```

L'étape qui compte est **« première vraie commande »** : tout ce qui précède est une promesse.

### 4.2 North star

**Candidate** : *nombre d'établissements ayant traité au moins N commandes réelles sur une période
glissante de 7 jours.*

Ce qu'elle a de bon : elle exige que le produit soit **utilisé en service**, pas seulement installé.
Un compte créé, un menu importé, zéro commande — elle ne compte pas, et c'est exactement ce qu'on
veut.

Ce qu'elle a de discutable, et qu'il faut trancher avec des données réelles : elle ne distingue pas
un maquis à 300 commandes d'un restaurant à 30 ; et elle ignore la valeur encaissée. Le brief dit
« analyser avant décision » (§83) — cette métrique reste donc **candidate** jusqu'aux premiers vrais
usages.

### 4.3 Convention d'événements

`domaine.objet_action` en minuscules : `order.submitted`, `menu.imported`, `qr.generated`,
`onboarding.step_completed`.

**Propriétés systématiques** : `organizationId`, `venueId`, `role`, `plan`, `surface`
(`guest`/`app`/`kds`/`cashier`/`admin`), `locale`.

**Jamais dans un événement** : nom, téléphone ou courriel d'un convive · contenu d'une commande ·
montant exact d'une addition · jeton, identifiant de session, code à usage unique. Les montants sont
envoyés en **tranches** (`0-5k`, `5-20k`, `20k+`), ce qui suffit à décider et ne transfère aucune
donnée commerciale à un tiers.

### 4.4 Indicateurs de santé

Activation (inscription → première vraie commande) · délai jusqu'à la première commande · rétention
à 7 / 30 / 90 jours par établissement · profondeur d'usage (combien de modules réellement utilisés) ·
adoption par rôle — **la cuisine et la caisse sont les meilleurs signaux de survie** : quand elles
décrochent, le restaurant s'en va, même s'il paie encore.

### 4.5 Qualité technique, mesurée là où ça compte

| Mesure | Seuil | Pourquoi ici |
|---|---|---|
| LCP du menu client | ≤ 2,5 s au 75ᵉ centile | Sur Android d'entrée de gamme en 4G instable |
| INP | < 200 ms | INP a remplacé FID en mars 2024 |
| CLS | < 0,1 | Un bouton qui bouge fait commander de travers |
| Latence KDS (événement → écran) | < 1 s | Un retard invisible en cuisine est un plat froid |
| Taux d'échec des mutations | < 0,5 % | |
| Taux de réussite des paiements en ligne | suivi par fournisseur | Un rail qui se dégrade se voit là |

---

## 5. Ce qui est interdit

1. ❌ Un tableau de bord qui affiche tout ce qu'on sait calculer.
2. ❌ Un nombre sans point de comparaison.
3. ❌ Un classement individuel des employés affiché publiquement.
4. ❌ Un indicateur qui change de définition selon l'écran (« CA » = brut ici, net là).
5. ❌ Des commandes de test comptées dans les chiffres réels.
6. ❌ Une donnée personnelle de convive dans un outil tiers.
7. ❌ Une moyenne sans effectif : « temps moyen 4 min » sur 3 commandes ne veut rien dire — l'effectif
   s'affiche à côté.
8. ❌ Un graphique dont on ne peut pas dire quelle décision il éclaire.
