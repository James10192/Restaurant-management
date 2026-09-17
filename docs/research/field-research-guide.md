# Guide d'entretiens terrain — [PRODUCT_NAME]

> §105 : « Le produit ne doit pas être conçu seulement depuis un ordinateur. »

Ce guide sert à aller voir le service réel avant de figer des décisions produit. Il est écrit pour
être utilisable tel quel par quelqu'un qui n'a jamais conduit d'entretien utilisateur.

**Statut : guide prêt, entretiens NON réalisés.** Tant qu'ils ne le sont pas, toute décision produit
qui en dépend est marquée comme *hypothèse* dans [DECISION_LOG.md](../DECISION_LOG.md) — jamais
comme fait.

---

## 1. Les trois règles qui font la différence

1. **Faire raconter le passé, pas prédire le futur.** « La dernière fois qu'une commande s'est
   perdue, raconte-moi » vaut dix fois « est-ce que tu utiliserais une app ? ». Les gens se trompent
   sur ce qu'ils feront ; ils se souviennent bien de ce qui les a énervés.
2. **Observer avant de demander.** 45 minutes debout pendant un coup de feu apprennent plus qu'une
   heure d'interview au calme. Ce qu'on cherche, ce sont les **contournements** : le carnet, le cri
   vers la cuisine, le post-it sur la caisse, la photo WhatsApp du ticket. Chaque contournement est
   un besoin non couvert.
3. **Ne jamais présenter le produit en premier.** Dès qu'on montre une maquette, l'interlocuteur
   devient poli et arrête de dire ce qui ne va pas.

## 2. Échantillon visé

| Profil | Nombre min. | Où | Pourquoi lui |
|---|---|---|---|
| Gérant / propriétaire | 5 | 2 maquis, 2 restaurants de standing, 1 groupe multi-sites | Il paie, il décide, il vit les pertes |
| Serveur | 6 | mêmes lieux, en service | C'est lui qui adoptera ou sabotera l'outil |
| Caissier | 3 | dont 1 lieu où le serveur encaisse lui-même | La caisse est l'endroit où l'argent disparaît |
| Cuisinier / chef de partie | 4 | dont 1 cuisine sans écran, 1 avec | Le KDS échoue si la cuisine ne l'accepte pas |
| Barman | 2 | bar/lounge à fort volume boissons | Le bar a un tempo différent de la cuisine |
| Client | 10 | en salle, après l'addition | Le scan et l'attente se jugent de leur côté |

Viser **au moins deux types d'établissement différents** (maquis populaire à forte rotation vs
restaurant de standing) : leurs contraintes sont opposées et un produit qui ne sert que l'un des
deux se vend mal.

## 3. Trame — GÉRANT (45 min)

**Contexte**
1. Décris-moi une soirée type, de l'ouverture à la fermeture.
2. Combien de personnes travaillent en salle ? En cuisine ? Qui fait la caisse ?
3. Comment savez-vous, le soir, combien vous avez fait ?

**Douleurs (le cœur)**
4. Raconte-moi la dernière fois qu'une commande a été perdue ou servie en retard. Qu'est-ce qui
   s'est passé exactement ?
5. La dernière fois que la caisse ne tombait pas juste — c'était quoi, l'écart ? Qu'avez-vous fait ?
6. Qu'est-ce qui vous fait perdre le plus d'argent sans qu'on le voie ?
7. Qu'est-ce qui vous réveille la nuit dans la gestion du restaurant ?

**Outils actuels**
8. Qu'utilisez-vous aujourd'hui : carnet, Excel, logiciel, WhatsApp ? Montrez-moi.
9. Avez-vous déjà essayé un logiciel de caisse ou un menu QR ? Que s'est-il passé ? *(Si abandon :
   pourquoi exactement ? — la réponse vaut de l'or.)*
10. Combien payez-vous pour vos outils aujourd'hui, tous compris ?

**Décision**
11. Si un outil vous faisait gagner du temps, qui décide de l'acheter ? Qui doit être convaincu ?
12. Qu'est-ce qui vous ferait dire non tout de suite ?
13. Quel prix mensuel vous paraîtrait normal ? À partir de quel prix c'est non ? *(Ne jamais
    annoncer un prix en premier.)*

**Contraintes**
14. Internet ici, ça tombe souvent ? Que faites-vous quand ça tombe ?
15. Quels appareils avez-vous déjà : téléphones du personnel, tablette, imprimante, TPE ?
16. Le personnel change souvent ? Combien de temps pour former un nouveau serveur ?

## 4. Trame — SERVEUR (25 min, si possible pendant un creux)

1. Montre-moi comment tu prends une commande, là, maintenant.
2. Comment la cuisine sait-elle qu'il y a une commande ?
3. Comment sais-tu qu'un plat est prêt ? *(Écouter : « on crie », « la cloche », « je passe voir ».)*
4. Qu'est-ce qui te fait perdre le plus de temps dans un service ?
5. Raconte-moi la dernière erreur de commande. À cause de quoi ?
6. Comment tu gères une table qui veut payer séparément ?
7. Combien de tables tu gères en même temps quand c'est plein ?
8. Si les clients commandaient eux-mêmes avec leur téléphone, ça changerait quoi pour toi ?
   *(Question piège volontaire : chercher la peur du pourboire et de la perte de contact — c'est le
   risque d'adoption numéro un.)*
9. Tu as ton propre téléphone au travail ? Tu accepterais de l'utiliser pour le service ?

## 5. Trame — CAISSIER (25 min)

1. Montre-moi une encaissement complet, du début à la fin.
2. Comment ouvres-tu ta caisse le matin ? Comment la clôtures-tu ?
3. Que se passe-t-il s'il manque de l'argent à la clôture ?
4. Quelle proportion en espèces, Mobile Money, carte ? *(Demander un ordre de grandeur, pas un
   chiffre inventé.)*
5. Comment encaisses-tu un Mobile Money ? Montre-moi. *(Observer : transfert vers un numéro perso ?
   attente du SMS de confirmation ? c'est là que se joue la faisabilité du paiement intégré.)*
6. Comment fais-tu un remboursement ou une annulation ?
7. Que fais-tu quand un client conteste l'addition ?
8. Donnes-tu un reçu ? Lequel ? Quelqu'un te le réclame-t-il ?

## 6. Trame — CUISINIER / CHEF (25 min, jamais pendant le rush)

1. Comment les commandes arrivent-elles jusqu'à toi ?
2. Comment décides-tu par quoi commencer quand il y en a dix ?
3. Comment tu gères « entrée d'abord, plat après » ?
4. Que se passe-t-il quand une commande est modifiée ou annulée après le départ en cuisine ?
5. Comment signales-tu qu'un plat est prêt ?
6. Comment sais-tu qu'un produit est épuisé ? Comment la salle l'apprend-elle ?
   *(C'est la question qui justifie ou non toute la partie disponibilité temps réel.)*
7. Y a-t-il un écran ici ? Tu accepterais une tablette ? Tes mains sont sales/mouillées — comment tu
   ferais ? *(Déterminant pour les zones tactiles du KDS.)*
8. Qu'est-ce qui te ferait dire « cet écran me ralentit » ?

## 7. Trame — CLIENT (8 min, après l'addition)

1. Comment avez-vous commandé aujourd'hui ?
2. Combien de temps avez-vous attendu ? C'était acceptable ?
3. Avez-vous déjà scanné un QR code pour un menu ? Comment ça s'est passé ?
   *(Chercher : batterie, données mobiles, PDF illisible, page lente — les vraies causes d'échec.)*
4. Qu'est-ce qui vous agace le plus au restaurant ?
5. Auriez-vous commandé vous-même depuis votre téléphone ? Pourquoi / pourquoi pas ?
6. Comment avez-vous payé ? Auriez-vous voulu payer autrement ?
7. Si vous étiez 4 et que chacun voulait payer sa part, comment ça se passe d'habitude ?

## 8. Observation — grille à remplir sur place

À noter sans poser de question, pendant un service complet :

| À mesurer | Comment |
|---|---|
| Temps commande → arrivée en cuisine | Chronomètre, 10 commandes |
| Temps prêt → servi | Chronomètre, 10 plats |
| Temps client lève la main → serveur arrive | Chronomètre, 10 fois |
| Nombre d'allers-retours du serveur par table | Comptage |
| Nombre d'erreurs / corrections observées | Comptage + cause |
| Nombre de contournements papier | Photo (avec autorisation) |
| Qualité du réseau | Test de débit à 3 moments, dont le coup de feu |
| Modèles de téléphones du personnel | Observation |
| Luminosité / bruit en cuisine | Note qualitative — décide de la taille de police du KDS |

## 9. Ce qu'on cherche à trancher (et qui bloque des décisions produit)

Chaque entretien doit permettre d'avancer sur au moins une de ces questions ouvertes :

| Question | Décision produit qu'elle débloque |
|---|---|
| Le serveur a-t-il peur de la commande client directe ? | Mode par défaut à l'onboarding (§9) |
| Le Mobile Money passe-t-il par un numéro personnel ? | Faisabilité du paiement intégré vs simple enregistrement (§27) |
| La cuisine acceptera-t-elle une tablette ? | Priorité du KDS vs ticket imprimé (§20, §79) |
| Le réseau tombe-t-il pendant le service ? | Ampleur de l'effort offline/PWA (§71) |
| Qui réclame un reçu ? | Priorité de la facture normalisée (§29) |
| Le personnel tourne-t-il beaucoup ? | Exigence sur la simplicité de formation (§38 mode simulation) |
| Combien de tables un serveur gère-t-il ? | Densité de l'écran serveur (§21) |

## 10. Après les entretiens

1. Transcrire dans les 24 h, verbatim pour les phrases fortes.
2. Une ligne par douleur observée, avec sa fréquence et son coût estimé.
3. Classer : *douleur fréquente et chère* → fonctionnalité prioritaire ; *rare et chère* → à traiter
   plus tard ; *fréquente et peu chère* → confort ; *rare et peu chère* → ne rien faire.
4. Reporter chaque décision débloquée dans [DECISION_LOG.md](../DECISION_LOG.md), en remplaçant
   l'hypothèse par un fait sourcé (« entretien gérant, maquis Cocody, 2026-xx-xx »).
5. Toute hypothèse **contredite** par le terrain doit déclencher une révision explicite du document
   concerné, pas un ajustement silencieux.
