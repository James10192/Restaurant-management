# ADR 0005 — Le catalogue de permissions vit dans le code, les rôles en base

**Statut** : accepté · **Date** : 2026-09-17

## Contexte

Le brief propose une table `permissions`. Le produit a besoin de rôles personnalisables par chaque
restaurant, avec des portées par établissement.

## Décision

Le **catalogue** de permissions est une constante typée du code (`convex/lib/permissions.ts`). Les
**rôles** — y compris personnalisés — sont des données appartenant à l'organisation.

## Conséquences

**Ce qu'on gagne** : le type `Permission` existe côté TypeScript, donc une permission inexistante ne
compile pas. Une permission naît et meurt avec la fonctionnalité qu'elle protège, dans le même
commit. Pas de migration de données à chaque livraison.

**Ce qu'on accepte** : ajouter une permission demande une livraison. C'est correct — une permission
sans code qui la vérifie ne sert à rien.

**Ce que cela permet**, et qui compte plus que le reste : le code ne demande jamais « est-ce un
serveur ? » mais « a-t-il `order.create` sur cette venue ? ». C'est ce qui laisse un restaurant
décider que ses chefs de rang encaissent et pas ses commis, sans qu'on touche au logiciel.
