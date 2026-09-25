# ADR 0003 — Montants entiers, facteur d'échelle dérivé de la devise

**Statut** : accepté · **Date** : 2026-09-17

## Contexte

Le marché initial utilise le franc CFA. Le produit doit aussi accepter l'euro, le dollar, le naira,
le dirham.

**Le fait qui décide** : le franc CFA (XOF, XAF) a un **exposant décimal de 0** — il n'a pas de
sous-unité en circulation. Le réflexe « un montant se stocke en centimes, donc × 100 » **surfacture
le client d'un facteur 100**.

## Décision

Un montant est un **entier** dans l'unité mineure de sa devise, toujours accompagné de son code
devise. Le facteur d'échelle est **dérivé de l'exposant ISO 4217 de la devise**, jamais écrit en dur.
Aucun flottant ne touche jamais un montant.

## Conséquences

Interdits, cherchés en revue : le type `float` sur un montant · une constante `100` dans un calcul
de prix · la chaîne `"FCFA"` concaténée à la main dans l'interface · l'addition de deux montants sans
vérifier qu'ils partagent la même devise.

La devise d'un établissement se **fige** dès la première opération financière : la changer après
rendrait tout l'historique incohérent.

Corollaire découvert pendant la recherche : certains agrégateurs imposent un pas de montant et
**arrondissent à l'inférieur sans prévenir**. On arrondit soi-même au supérieur et on stocke le
montant réellement accepté dans un champ distinct — sinon l'écart disparaît et la caisse ne tombe
plus juste.
