# DEPLOYMENT.md — Joliba

> §92 à §96. Environnements, intégration continue, observabilité, drapeaux, incidents.

---

## 1. Environnements

| Environnement | Frontend | Convex | Base | Paiements | Qui y accède |
|---|---|---|---|---|---|
| `local` | Vite dev | déploiement dev personnel | jeu de démonstration | **faux fournisseur** | développeur |
| `preview` | déploiement par branche | déploiement de prévisualisation | jeu de démonstration | **faux fournisseur** | équipe, relecteurs |
| `staging` | domaine dédié | déploiement dédié | données anonymisées | **bac à sable** | équipe, clients pilotes |
| `production` | domaine public | déploiement de production | réelle | **réels** | tout le monde |

**Trois interdits absolus** *(§95)* :

1. **Jamais la base de production dans un environnement de prévisualisation.** Une prévisualisation
   est ouverte par définition ; y brancher la production, c'est publier les données des clients.
2. **Jamais les mêmes identifiants de paiement entre deux environnements.** Un test qui encaisse
   réellement est une faute qu'on ne peut pas rattraper.
3. **Jamais de données réelles de clients dans un jeu de démonstration.** Les jeux de démonstration
   sont **générés**, pas copiés.

Les identifiants de paiement de production ne sont accessibles qu'au déploiement de production, et
un contrôle au démarrage vérifie la cohérence : un environnement autre que `production` qui trouve
une clé de production **refuse de démarrer**. Un avertissement dans un journal ne suffit pas — il
sera lu trop tard.

---

## 2. Intégration continue

À chaque *pull request*, dans cet ordre — le moins cher d'abord, pour rendre la main vite :

```
1. Installation avec verrouillage strict (le fichier de verrou fait foi)
2. Génération des types Convex + vérification qu'ils sont COMMITÉS
3. Lint
4. Typage (tsc --noEmit)
5. Tests unitaires + tests Convex
6. Build
7. Audit des dépendances + analyse de secrets
8. Tests de bout en bout sur les parcours critiques
9. Tests d'accessibilité sur les écrans principaux
```

**L'étape 2 mérite son existence.** Générer les types puis vérifier qu'aucune différence n'apparaît
garantit que ce qui est dans le dépôt correspond au schéma. Sans elle, un développeur peut livrer
du code qui compile chez lui et nulle part ailleurs. *(Pratique reprise du dépôt de référence
`filon`, où elle est en place.)*

**Bloquent la fusion** : typage, lint, tests unitaires, build, isolation multi-tenant, secrets
détectés.
**Signalent sans bloquer** : accessibilité, budget de performance, audit de dépendances de gravité
faible.

### Ce qu'on ne reprend pas du dépôt de référence

`filon` n'a **aucun test** et aucun script de lint — vérifié. C'est le trou de sa discipline, et
l'endroit exact où l'on doit faire autrement **dès le premier jour** : une suite de tests qu'on
ajoute « plus tard » n'est jamais ajoutée.

---

## 3. Dépendances

Toute montée de version suit la procédure de `docs/research/stack-compatibility.md` : lire la
documentation officielle, vérifier les dépendances de pairs, lire le journal des changements,
typer, construire, tester.

**Deux verrous en place :**

- `strict-peer-dependencies=true` dans `.npmrc` : une incompatibilité déclarée devient une **erreur**,
  pas un avertissement qu'on finit par ne plus lire.
- `better-auth` est épinglé avec un **tilde** (`~1.6.x`) et non un accent circonflexe *(D-017)* : le
  composant Convex exige `< 1.7.0`, et `^` autoriserait une version qui **casse l'authentification**.
  Le dépôt de référence porte ce piège armé ; on ne le reproduit pas.

Un contrôle d'intégration continue vérifie que la version installée reste dans la fourchette
attendue — parce qu'un verrou qui n'est pas vérifié finit par sauter à la faveur d'une résolution.

---

## 4. Livraison

```
branche → PR → contrôles → revue → fusion sur `main`
       → déploiement Convex (migrations de schéma d'abord)
       → déploiement frontend
       → vérification post-déploiement
```

**L'ordre compte** : le schéma Convex se déploie **avant** le frontend. L'inverse sert une interface
qui appelle des fonctions qui n'existent pas encore.

**Changements de schéma** : toujours additifs d'abord. Ajouter le champ optionnel, remplir, puis
seulement rendre obligatoire et retirer l'ancien. Un déploiement qui supprime et recrée dans le même
mouvement casse les clients ouverts — et dans un restaurant, un client ouvert est un serveur en plein
service.

**Vérification post-déploiement**, exécutée et non supposée :

```bash
curl -I https://<domaine>            # en-têtes de sécurité RÉELLEMENT servis
curl -s https://<domaine>/api/health # version, connexion base, horodatage
# puis : un scan de QR de démonstration, une commande de test, un encaissement de test
```

Les en-têtes de sécurité définis en configuration ne sont pas forcément ceux servis en production :
le passage par la plateforme d'hébergement peut les modifier. On les vérifie à chaque déploiement
qui y touche.

---

## 5. Drapeaux de fonctionnalité

Portée : global · organisation · établissement · utilisateur *(§94)*.

À utiliser pour : une bêta, un déploiement progressif, un nouvel écran de caisse, un nouvel
assistant. **Pas** pour masquer du code mort.

Deux règles d'hygiène : tout drapeau naît avec une **date de retrait** ; un drapeau actif depuis plus
de trois mois est soit adopté, soit supprimé. Un drapeau oublié devient une branche de code que
personne ne teste.

---

## 6. Observabilité

Ce qu'on capture *(§92)* : erreurs frontend et backend · échecs de mutation · erreurs de paiement ·
erreurs de webhook · erreurs d'IA · latences des surfaces critiques · budget de performance.

Chaque incident doit se relier à `traceId` · organisation · établissement · utilisateur · route ·
opération — **et à rien d'autre**. Jamais de jeton, de code à usage unique, de donnée de paiement ni
de contenu de commande dans un journal.

**Journaux structurés**, avec une liste **explicite** des champs autorisés. Une liste d'exclusion
laisse toujours passer le prochain champ ajouté ; une liste d'inclusion, non.

### Alertes

Une alerte réveille quelqu'un ou n'existe pas.

| Gravité | Exemples | Réaction |
|---|---|---|
| Critique | Paiements en échec sur un rail · KDS muet sur un établissement en service · fuite de portée détectée | Immédiate, jour et nuit |
| Élevée | Taux d'erreur anormal · webhooks non traités qui s'accumulent · réconciliation en écart | Sous 1 h ouvrée |
| Moyenne | Dégradation de performance · dépassement de quota IA | Jour ouvré |

**Le service du soir est le moment sensible.** Une alerte sur un établissement en plein service ne
doit pas attendre le lendemain matin : c'est précisément à ce moment que le produit se juge.

### Page d'état

Publique quand le produit atteindra un niveau commercial qui le justifie *(§93)* : application,
base, authentification, paiements, notifications. **Aucun engagement de disponibilité chiffré n'est
publié tant qu'on ne peut pas le tenir** *(SECURITY.md §1)*.

---

## 7. Sauvegardes et restauration

Les sauvegardes du fournisseur, **plus** un export périodique hors fournisseur des données
financières — celles qu'on ne peut pas reconstituer.

**Une sauvegarde qu'on n'a jamais restaurée n'existe pas.** Un exercice de restauration est planifié
et daté ; tant qu'il n'a pas eu lieu, ce document ne prétend pas que la restauration fonctionne.

---

## 8. Incidents

```
Détection → qualification → communication → correction → rétablissement → post-mortem
```

Le **post-mortem est sans reproche** et cherche la cause, pas le coupable. Il produit au moins une
action concrète : un test, une alerte, un garde-fou. Un post-mortem sans action est une réunion.

**Communication** : un restaurateur en plein service préfère un message honnête à un silence. La
règle est de communiquer dès la qualification, même sans solution, en disant ce qu'on sait, ce
qu'on ne sait pas encore, et quand on redonnera des nouvelles.

---

## 9. Ce qui reste à faire avant la mise en production

- [ ] Exercice de restauration exécuté et daté
- [ ] En-têtes de sécurité vérifiés par `curl -I` sur le domaine réel
- [ ] Identifiants de paiement séparés et contrôle de démarrage en place
- [ ] Parcours critiques couverts en bout en bout
- [ ] Alertes branchées sur un canal réellement lu
- [ ] Point d'état de santé exposé et surveillé
- [ ] Procédure de rotation des secrets écrite et testée
