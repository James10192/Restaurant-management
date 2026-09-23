# ADR 0006 — Le hors-ligne se limite à trois cercles ; le pair-à-pair est différé

**Statut** : accepté pour la V1, précisé par D-062 (voie « V1+ ») · la voie 2 ne s'ouvre que sur mesure terrain
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
3. **Refus explicite** sur l'argent et les clôtures. ~~« encaissez en espèces, ce sera enregistré
   au retour du réseau »~~ — retiré (D-062) : la phrase laissait croire à une pièce conforme, alors
   qu'aucune certification différée n'est connue (A7). L'écran dit seulement que l'encaissement
   attend le réseau.

**Précisions de D-062** : au-delà de 3 minutes sans réseau, l'application passe en « Service
dégradé » (bandeau persistant, « bon à montrer » plein écran par commande) ; au retour, **rien de
ce qui a été saisi plus de 3 minutes auparavant ne repart seul en cuisine** : chaque commande passe
par une liste « À régulariser » (déjà préparée · envoyer maintenant · annuler). Un geste de plus de
6 heures est refusé au rejeu. La file vit en IndexedDB, part une opération à la fois, et l'état du
serveur gagne toujours. Chaque appareil mesure ses coupures.

**Le pair-à-pair sur réseau local est différé**, et présenté comme un arbitrage d'investissement.

## Conséquences

**Ce qu'on perd** : le meilleur différenciateur identifié.

**Ce qu'on gagne** : on ne promet pas un hors-ligne qu'on ne tient pas — ce que l'étude
concurrentielle appelle « le mode hors-ligne en trompe-l'œil » et classe parmi les pratiques à ne
pas copier. Le promettre reviendrait à reproduire le défaut qu'on reproche à Toast.

**Ce qui rend la voie 2 encore possible sans réécriture** : trois fondations y mènent — une
référence générée côté client (`clientRef`, UUIDv7, index unique par établissement), une clé
d'idempotence sur toute mutation de création, un journal d'événements métier plutôt que seul état
courant. ⚠️ Correction du 2026-09-23 : ce document disait les identifiants côté client « déjà
actés » ; ils ne l'étaient pas (Convex ne laisse pas le client choisir un `_id`). Le `clientRef` est
à poser en T2.c (D-062).

**Déclencheur de la voie 2** : dans les établissements pilotes, au moins une coupure par semaine,
de plus de 20 minutes, touchant **tous** les appareils (4G comprise) pendant le service, quatre
semaines de suite.

## Alternatives

**Voie 2 — relais local d'établissement** : un appareil fait relais sur le réseau local, les
commandes circulent entre salle et cuisine sans internet. Coût élevé : second exécutable, découverte
réseau, résolution de conflits, mises à jour, support d'un matériel sur site — ce qui change le
métier. **Voie 3 — local-first généralisé** : incompatible avec Convex ; ce serait changer de
backend.
