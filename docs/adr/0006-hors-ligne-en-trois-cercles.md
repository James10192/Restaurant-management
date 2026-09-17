# ADR 0006 — Le hors-ligne se limite à trois cercles ; le pair-à-pair est différé

**Statut** : accepté pour la V1 · **la voie 2 est à trancher par le propriétaire du produit**
**Date** : 2026-09-17

## Contexte

Le réseau tombe. C'est une contrainte du marché visé, pas un cas limite.

La recherche concurrentielle a établi que c'est **l'angle mort le plus exploitable du marché** : la
documentation officielle de Toast énonce que les appareils **ne se synchronisent pas entre eux hors
ligne**, et qu'en mode dégradé la cuisine ne reçoit plus rien. Personne ne propose un système de
service moderne dont le hors-ligne multi-appareils est le mode nominal.

Mais Convex est un backend **en nuage**, sans mode local ni réplica réseau *(ADR 0001)*.

## Décision

**V1 — trois cercles, et pas un de plus :**

1. **Lecture** hors ligne : carte, prix, plan de salle, depuis le cache.
2. **File d'écriture** pour les gestes de service uniquement (ajouter un article, marquer prêt,
   marquer servi, demander un service), chaque mutation portant une clé d'idempotence, et un état
   d'interface **« en attente de confirmation »** distinct de « envoyé ».
3. **Refus explicite** sur l'argent et les clôtures : « Connexion perdue — encaissez en espèces, ce
   sera enregistré au retour du réseau. »

**Le pair-à-pair sur réseau local est différé**, et présenté comme un arbitrage d'investissement.

## Conséquences

**Ce qu'on perd** : le meilleur différenciateur identifié.

**Ce qu'on gagne** : on ne promet pas un hors-ligne qu'on ne tient pas — ce que l'étude
concurrentielle appelle « le mode hors-ligne en trompe-l'œil » et classe parmi les pratiques à ne
pas copier. Le promettre reviendrait à reproduire le défaut qu'on reproche à Toast.

**Ce qui rend la voie 2 encore possible sans réécriture** : trois choix déjà actés y mènent —
identifiants générés côté client, clé d'idempotence sur toute mutation, journal d'événements métier
plutôt que seul état courant. Ce sont exactement les fondations d'une synchronisation différée.

## Alternatives

**Voie 2 — relais local d'établissement** : un appareil fait relais sur le réseau local, les
commandes circulent entre salle et cuisine sans internet. Coût élevé : second exécutable, découverte
réseau, résolution de conflits, mises à jour, support d'un matériel sur site — ce qui change le
métier. **Voie 3 — local-first généralisé** : incompatible avec Convex ; ce serait changer de
backend.
