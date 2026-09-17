# ADR 0001 — Convex comme backend temps réel

**Statut** : accepté · **Date** : 2026-09-17

## Contexte

Le produit vit ou meurt sur la coordination en temps réel : un bon qui apparaît en cuisine, un plat
qui devient prêt sur l'écran du serveur, une addition dont le solde bouge pendant qu'on paie. Trois
écrans au moins (KDS, tour de contrôle, caisse) sont en abonnement permanent.

## Décision

Convex comme backend : base, fonctions et réactivité.

## Conséquences

**Ce qu'on gagne** : la réactivité est native — pas de serveur WebSocket à écrire ni à exploiter.
Les mutations sont transactionnelles, ce qui permet de vérifier les invariants d'argent *dans*
l'écriture. Le typage traverse le client et le serveur.

**Ce qu'on accepte** : pas de jointure serveur — la dénormalisation devient un **choix documenté**
(trois cas justifiés dans `DATA_MODEL.md`), jamais une facilité. Un plafond de 1 Mo par document,
qui contraint le snapshot de publication de carte. Et surtout : **Convex est en nuage, sans mode
local**, ce qui ferme la porte au hors-ligne pair-à-pair sans second exécutable *(ADR 0006)*.

## Alternatives écartées

**PostgreSQL + une couche temps réel** : plus de liberté, mais il faut écrire et exploiter la
diffusion d'événements, la cohérence et la reconnexion — c'est précisément le travail qu'on
cherchait à éviter. **Un BaaS temps réel générique** : réactivité oui, mais transactions et typage
plus faibles là où l'argent circule.
