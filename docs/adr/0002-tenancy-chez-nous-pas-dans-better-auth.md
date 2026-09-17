# ADR 0002 — Better Auth fait l'identité ; la souveraineté du tenant est à nous

**Statut** : accepté · **Date** : 2026-09-17

## Contexte

Le produit est multi-tenant à deux niveaux : `organization` → `venue`, avec des rôles **portés par
établissement** (« Manager de Cocody **et** Serveur de Plateau »). Better Auth propose un plugin
`organization`.

Vérification faite : ce plugin **ne figure pas** dans la liste des plugins supportés par le composant
Convex de Better Auth *(`docs/research/stack-compatibility.md`)*. Trois voies existaient : modéliser
nous-mêmes, passer par une installation locale du composant, ou attendre une prise en charge
officielle.

## Décision

Better Auth ne fait que l'**identité** : comptes, sessions, code à usage unique, Google.
Organisations, membres, invitations, rôles et portées sont **nos tables Convex**.

## Conséquences

**Ce qu'on gagne** : une seule source de vérité sur l'appartenance. Le plugin ne modélise de toute
façon pas la portée par établissement — on aurait dû l'étendre, donc dupliquer. Le modèle reste
typé, indexé selon nos requêtes réelles, et ne dépend pas du rythme de publication d'un composant
tiers (le composant n'avait pas bougé depuis trois mois au moment de l'étude).

**Ce qu'on accepte** : écrire nous-mêmes les invitations, le changement d'organisation et la
résolution des rôles. C'est du travail connu et testable.

## Alternative écartée

L'installation locale du composant, qui « rend possible l'usage de plugins au-delà de ceux
supportés ». L'inférence que cela couvre `organization` est **raisonnable mais non confirmée**, et
le coût (génération de schéma à régénérer à chaque changement d'options) s'ajouterait de toute façon
à l'extension nécessaire. Prototyper avant d'y engager un modèle de données aurait retardé sans
bénéfice.
