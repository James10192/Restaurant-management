# ADR 0007 — La pièce remise s'appelle `bills`, jamais `receipt` ni `invoice`

**Statut** : accepté · **Date** : 2026-09-17

## Contexte

En Côte d'Ivoire, « reçu » désigne le **RNE** (Reçu Normalisé Électronique, remis au particulier) et
« facture » le **FNE** (remis à un professionnel). Ce sont deux pièces **certifiées par la DGI**,
dans un régime de *clearance* : la pièce doit être validée par l'administration **avant** remise au
client, et porte un numéro, un visuel et un QR de vérification.

Le dispositif est obligatoire depuis le 1ᵉʳ décembre 2025, et les contrôles ont commencé le
1ᵉʳ septembre 2026.

## Décision

La table s'appelle `bills`. L'interface dit « ticket ». Les mots « reçu » et « facture »
n'apparaissent **nulle part** tant que la pièce n'est pas certifiée. Une fois certifiée, elle porte
son type réel dans `fiscalType` (`rne` ou `fne`).

## Conséquences

Un renommage tardif aurait touché la table, ses index, l'API, l'interface, les traductions et la
documentation — pour un motif juridique, donc non négociable. Le faire maintenant coûte une ligne.

L'abstraction `FiscalProvider` est prête, avec `NoopFiscalProvider` par défaut. Le test de sa
qualité : ouvrir un établissement dans un pays voisin au régime comparable ne doit demander qu'**un
fichier de plus**.

**Ce qui bloque, et qui n'est pas une tâche de développement** : la spécification technique de l'API
n'a pas pu être obtenue (portail inaccessible pendant l'étude). Trois questions restent ouvertes :
l'éditeur doit-il être agréé ? le mode hors ligne est-il prévu — un restaurant perd son réseau, et le
régime exige une validation *avant* remise ? quel est le format exact du QR ? **On ne code pas une
intégration dont on n'a pas lu le contrat.**
