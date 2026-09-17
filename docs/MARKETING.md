# MARKETING.md — [PRODUCT_NAME]

> Stratégie de mise sur le marché : positionnement, messages, landing, démonstration,
> tarification, croissance, objections, lancement.
> Couvre §59 à §65, §84 et §85 du brief.

**Statut : document de travail opérationnel.** Ce n'est pas une plaquette. Il sert à écrire la
landing, à tenir une conversation de vente et à décider d'une grille tarifaire.

**Règle qui gouverne tout le document.** Aucun client, aucun logo, aucun témoignage, aucune
certification, aucun chiffre d'usage n'est inventé. Là où une preuve manque, un **placeholder
explicite** est écrit à sa place. Les seuls chiffres présents ici viennent des documents de
recherche du dépôt, avec leur source. Ce qui n'a pas été vérifié est signalé **(NV)**.

**Sources amont** (à lire avant de modifier ce document) :
[`PRODUCT.md`](../PRODUCT.md) ·
[`docs/research/competitive-analysis.md`](research/competitive-analysis.md) ·
[`docs/research/seo-strategy.md`](research/seo-strategy.md) ·
[`docs/research/naming-study.md`](research/naming-study.md) ·
[`docs/research/payments-africa.md`](research/payments-africa.md) ·
[`docs/DECISION_LOG.md`](DECISION_LOG.md)

---

## 1. Positionnement

### En une phrase

**[PRODUCT_NAME] est le système d'exploitation du service pour les restaurants d'Afrique
francophone : la salle, la cuisine et la caisse sur le même fil, sur les téléphones que l'équipe
a déjà, à un prix libellé en FCFA.**

### En un paragraphe

L'étude concurrentielle établit qu'il existe trois blocs et une case vide
(`competitive-analysis.md` §5). Le bloc « menu QR » — GloriaFood, Bopple, sunday, me&u/Mr Yum,
Flipdish, et localement Zeat — a une bonne UX d'entrée et aucune profondeur ; il se consolide,
et la fusion de Mr Yum et me&u en est la démonstration : **le QR seul n'est plus un produit
défendable**. Le bloc « vrai OS de service » — Toast, Lightspeed, Square, Otter — a la
profondeur et la modernité, mais il impose son propre encaissement, son matériel, ses tarifs
occidentaux, et **aucun des treize acteurs internationaux étudiés n'a de présence africaine
documentée**. Le bloc local — DIAM POS, CliqPOS, KiboERP — a raison sur ce qui compte
réellement ici (Mobile Money, conformité OHADA/GRA, fonctionnement sans internet) mais s'arrête
à la caisse conforme, sans coordination de service ni ergonomie moderne. **[PRODUCT_NAME] occupe
la case vide** : la profondeur opérationnelle du bloc 2, aux contraintes d'infrastructure et de
prix du bloc 3.

### Ce que nous sommes

- Un **outil de coordination du service** : la commande part, la cuisine la reçoit, le serveur
  est prévenu, la caisse sait ce qui est dû, le gérant voit sa soirée pendant qu'elle a lieu.
- Un outil qui **s'adapte au fonctionnement existant** : trois axes de configuration (qui saisit
  la commande, quand on paie, où l'on paie) et toute combinaison doit tourner (`PRODUCT.md` §2).
- Un outil **sans matériel propriétaire** : le téléphone du serveur est le terminal, l'écran de
  cuisine est une tablette d'entrée de gamme, l'impression est optionnelle (*D-021*).
- Un outil où **l'espèce est un moyen de paiement de première classe**, au même rang que Wave ou
  Orange Money, et où une même addition accepte plusieurs moyens (*D-019*).

### Ce que nous ne sommes pas

- **Pas un menu QR.** C'est la catégorie dont nous refusons de faire partie, et c'est aussi
  notre meilleur angle d'entrée : nous sommes les seuls à avoir intérêt à expliquer pourquoi le
  menu QR seul ne suffit pas (`seo-strategy.md` §1.2, Groupe 1).
- **Pas une caisse enregistreuse.** Le terrain « POS / caisse / ERP » est encombré et
  interchangeable (`naming-study.md` §5.2) ; s'y nommer, c'est disparaître.
- **Pas une plateforme de livraison**, pas un agrégateur, pas un logiciel qui exige d'acheter
  son matériel.
- **Pas un produit qui impose au restaurant de changer sa façon de travailler** (`PRODUCT.md`
  principe 1).

### Contre qui on se bat — dans l'ordre réel

| # | Adversaire | Sa force | Notre angle |
|---|---|---|---|
| **1** | **Le carnet, le cahier, le fichier Excel, le groupe WhatsApp** | Gratuit, connu de tous, ne tombe jamais en panne, ne se met pas à jour de travers | C'est l'adversaire principal, et c'est le plus grand marché : la majorité réelle n'a **aucun** logiciel (`seo-strategy.md`, cluster 4). On ne gagne pas en étant « plus complet » — on gagne en étant **moins de gestes que le carnet dès le premier soir**. |
| **2** | **Les acteurs locaux** — Zeat (CI, menu QR + Wave/Orange Money), DIAM POS (dès 15 000 FCFA/mois, mode local réseau), KiboERP (SYSCOHADA), CliqPOS (Ghana, dès 199 GHS/mois) | Ils ont raison sur le Mobile Money, la conformité et le fonctionnement sans internet. Ils sont joignables sur WhatsApp. | Ils s'arrêtent à la caisse conforme. Aucun ne coordonne réellement salle ↔ cuisine ↔ caisse dans un seul fil, ni ne laisse configurer le mode de service. **La profondeur opérationnelle et l'ergonomie sont notre écart.** |
| **3** | **Les internationaux** — Toast, Lightspeed, Square, sunday, Otter | Profondeur, UX, marque, capital | Absents du continent ; tarifs hors marché (69 à 399 $/mois) ; matériel imposé (terminal Toast 799–1 199 $, borne Tabesto 1 600–2 500 €) ; encaissement verrouillé ; multi-site réservé au palier haut (Lightspeed, 399 $/mois). **On ne les combat pas frontalement : on occupe le terrain qu'ils ne servent pas.** |

> **Ce qu'il faut retenir pour toute la suite** : la douleur qui fait payer n'est pas « mes
> clients veulent un joli menu ». C'est *« je ne sais pas ce qui est entré en caisse »*, *« la
> commande s'est perdue »*, *« le serveur a encaissé sans enregistrer »* (*A6*). Le QR ouvre la
> porte. Ce qui fait signer, c'est la coordination et la traçabilité de l'argent.

---

## 2. Messages par persona

Les personas sont ceux de [`PRODUCT.md`](../PRODUCT.md) §3. Pour chacun : sa douleur **dans ses
mots**, la promesse, et **la preuve qu'on peut réellement apporter aujourd'hui** — qui est
souvent un placeholder, parce que les entretiens terrain ne sont pas encore faits
(`field-research-guide.md` : *« Statut : guide prêt, entretiens NON réalisés »*).

### Awa — gérante-propriétaire, maquis de 18 tables, Cocody

| | |
|---|---|
| **Sa douleur, dans ses mots** | « Le soir, je compte, et je ne sais jamais si c'est juste. J'ai déjà vu un serveur encaisser sans rien noter. J'ai essayé un cahier, puis Excel. J'ai laissé tomber. » |
| **Ce qu'elle achète** | Pas un logiciel de gestion : **savoir ce qui rentre**. |
| **Promesse** | « À la fermeture, vous savez combien est entré, par quel moyen, et par qui. » |
| **Second message** | « Sans rien changer à votre organisation le premier soir : vos serveurs prennent les commandes comme d'habitude, et vous, vous voyez tout. » |
| **Preuve aujourd'hui** | La démonstration interactive (§5) : elle ouvre la clôture de caisse et voit l'écart calculé. C'est démontrable sans client. |
| **Preuve à collecter** | `[CHIFFRE — temps de clôture de caisse avant / après, mesuré chez 3 pilotes sur 4 semaines]` · `[TÉMOIGNAGE — gérante de maquis, à collecter auprès d'un client pilote, avec accord écrit de citation nominative]` |
| **Ce qu'on ne lui dit pas** | Qu'elle « récupérera X % de chiffre d'affaires ». On ne l'a pas mesuré. |

### Koffi — serveur, 7 tables en simultané au coup de feu

| | |
|---|---|
| **Sa douleur, dans ses mots** | « Je cours. Je crie vers la cuisine. Je retiens trois commandes de tête. Je vais voir si c'est prêt, ce n'est pas prêt, j'y retourne. » |
| **Sa peur, qu'il ne dira pas spontanément** | Qu'un outil le remplace, ou que le client ne lui parle plus — donc plus de pourboire. C'est **le risque d'adoption numéro un** (`field-research-guide.md` §4, question 8, posée comme question piège). |
| **Promesse** | « Vous savez qu'un plat est prêt sans aller voir. Vous ne portez plus rien pour rien. » |
| **Message anti-peur, explicite** | « Le client commande seul **seulement si le patron le décide**, et même dans ce cas la commande passe par vous avant la cuisine si c'est le réglage choisi. Vous gardez la main sur votre table. » *(mode `guest_with_approval`, défaut recommandé — A2.)* |
| **Preuve aujourd'hui** | La démonstration : trois gestes pour envoyer une commande, chronométrables par le visiteur lui-même. |
| **Preuve à collecter** | `[MESURE — nombre d'allers-retours par service, observé avant/après chez 2 pilotes]` · `[TÉMOIGNAGE — serveur, à collecter]` |

### Ibrahim — chef de partie

| | |
|---|---|
| **Sa douleur, dans ses mots** | « On me crie des choses. Les papiers se perdent. Et si l'écran met trois secondes à réagir, je reviens au papier. » |
| **Promesse** | « Ce qui part maintenant, lisible à un mètre, sans jamais chercher. » |
| **Second message** | « Autant d'écrans que de postes, sans supplément, sur une tablette d'entrée de gamme. » |
| **Argument chiffré, sourcé** | Lightspeed facture **30 $ par écran et par mois** ; Toast vend un écran de cuisine **599 à 1 199 $**. Chez nous : illimité, inclus (*D-021*). *(Source : `competitive-analysis.md` §6.5.)* |
| **Preuve aujourd'hui** | La démonstration : le visiteur envoie une commande côté client et voit le bon apparaître, scindé par station, sur l'écran de cuisine. |
| **Preuve à collecter** | `[MESURE — temps entre envoi et affichage au passe, mesuré en service réel]` · `[PHOTO — écran de cuisine en service chez un pilote, avec autorisation]` |
| **Honnêteté requise** | Le papier ne tombe jamais en panne. On le dit, et on explique le chemin de secours (§9, objection 5). |

### Mariam — caissière

| | |
|---|---|
| **Sa douleur, dans ses mots** | « J'ouvre mon fonds le matin, je compte le soir. Quand ça ne tombe pas juste, c'est moi qu'on regarde. » |
| **Promesse** | « Une clôture qui s'explique, et un écart que vous pouvez justifier. » |
| **Second message** | « Une addition réglée 15 000 en espèces et 20 000 en Wave reste **une seule addition**, avec les deux paiements attribués. » |
| **Pourquoi c'est différenciant** | *« Le paiement mixte espèces/numérique sur une même addition n'est traité nulle part »* alors qu'il est la norme en Afrique de l'Ouest (`competitive-analysis.md` §6.4). |
| **Preuve aujourd'hui** | La démonstration : paiement d'une addition en deux moyens, solde restant mis à jour en direct. |
| **Preuve à collecter** | `[CHIFFRE — écart de caisse moyen avant / après, sur 8 semaines, chez 3 pilotes]` |

### Serge — propriétaire de quatre établissements

| | |
|---|---|
| **Sa douleur, dans ses mots** | « Je ne peux pas être partout. Je veux savoir quel site décroche, et donner à mon manager de Marcory l'accès à Marcory **et rien d'autre**. » |
| **Promesse** | « Une vue consolidée, et des droits par établissement que vous décidez vous-même. » |
| **Argument commercial** | Le multi-site est chez nous **dans l'offre courante, pas dans le palier haut**. Lightspeed le réserve à Premium (399 $/mois) ; Square et Flipdish facturent par site sans consolidation. *(Source : `competitive-analysis.md` §6.6.)* |
| **Argument que personne d'autre ne peut tenir** | Multi-devises XOF / XAF / GHS / NGN dans une même organisation. Aucune solution du panel ne traite la consolidation transfrontalière. |
| **Preuve aujourd'hui** | Rien de démontrable sans données réelles. `[DÉMONSTRATION MULTI-SITES — à construire avec un groupe pilote, sur ses vraies données, avec son accord]` |
| **Ce qu'il faut savoir sur lui** | C'est le segment le plus rentable et le cycle de vente le plus long. Il n'achète pas depuis une landing : il achète après une démonstration accompagnée. La landing sert à obtenir le rendez-vous, pas la signature. |

### Aïcha — cliente, quatre personnes à table

Elle n'est pas notre acheteuse, mais **elle est notre meilleur vendeur** : c'est elle qui, en
sortant, dit au gérant que c'était pratique (§8, boucle de croissance).

| | |
|---|---|
| **Sa douleur** | « Je veux voir la carte, savoir les prix, et ne pas attendre vingt minutes pour demander l'addition. Et à quatre, chacun veut payer sa part. » |
| **Promesse** | « La carte en moins de deux secondes, sans installer d'application, sans créer de compte. » |
| **Second message** | « Chacun paie sa part — par article, par personne, ou d'un montant libre — par le moyen qu'il veut. » |
| **Contrainte produit derrière la promesse** | Le menu doit s'ouvrir sur un Android d'entrée de gamme en 4G instable, plus vite que le serveur n'arrive. C'est un budget de performance opposable, pas une intention (`PRODUCT.md` principe 4). **On ne publie « moins de deux secondes » qu'une fois mesuré sur un appareil réel.** `[MESURE — temps d'affichage de la carte, appareil Android d'entrée de gamme, réseau 3G/4G dégradé, à établir avant publication]` |

---

## 3. Proposition de valeur principale — trois variantes

### Variante A (celle du brief) — « Du scan à l'addition, tout le service avance au même endroit. »

**Forces.** Elle décrit le parcours complet, elle est concrète, « au même endroit » porte
l'argument du fil unique, et elle se comprend sans contexte.

**Faiblesses, et elles sont sérieuses.**

1. **Elle commence par « scan ».** Or *A6* établit précisément l'inverse : le QR est la porte,
   pas le produit. Ouvrir sur le scan nous range dans la catégorie « menu QR », qui est
   commoditisée, disputée par des générateurs gratuits, et dont la fusion Mr Yum / me&u montre
   qu'elle ne tient plus (`competitive-analysis.md` §5, `seo-strategy.md` §1.2 Groupe 1).
2. **« Tout le service avance » ne nomme aucun résultat.** Awa n'achète pas « que le service
   avance ». Elle achète de savoir ce qui est entré en caisse.
3. **Elle ne parle pas d'argent**, alors que l'argent est la douleur qui fait signer.
4. **Elle est vraie de nos concurrents aussi.** Toast et Lightspeed pourraient l'écrire mot pour
   mot. Une proposition de valeur qui va à un concurrent n'en est pas une.

### Variante B — « Ce qui part en cuisine, ce qui rentre en caisse. » ★ recommandée

**Forces.**

1. Elle nomme **les deux douleurs qui font payer** — P1 (la commande qui se perd) et P2
   (personne ne sait ce qui est entré) — en une respiration, sans jargon.
2. Elle est **impossible à écrire pour un menu QR**. Elle nous sort de la catégorie par
   construction, ce qui est exactement l'objectif du positionnement.
3. Elle vaut pour **un maquis comme pour un lounge**, pour un établissement comme pour un
   groupe. Elle grandit avec l'ambition « OS » au lieu de la brider.
4. Elle est **binaire et vérifiable** : soit le logiciel sait dire ces deux choses, soit non.
   C'est une promesse qu'on peut tenir et qu'on peut démontrer en trente secondes.
5. Elle se retient. Six mots, deux membres symétriques.

**Faiblesses, honnêtement.**

1. Elle **ne dit pas ce que c'est**. Il faut impérativement un sous-titre qui nomme la
   catégorie, sinon un visiteur qui arrive de Google ne sait pas s'il lit un logiciel, un
   service comptable ou un cabinet de conseil.
2. Elle **ne parle pas au client final ni au serveur** — seulement au gérant. C'est assumé : le
   gérant paie. Mais il faut que Koffi et Aïcha trouvent leur message ailleurs sur la page (§4,
   sections 6 et 8).
3. Elle **n'est pas cherchée sur Google**. Elle ne sert pas le SEO ; le titre SEO de la page
   d'accueil reste celui validé (`seo-strategy.md` §3.2). Le slogan et la balise `<title>` ne
   sont pas le même objet et n'ont pas le même travail à faire.

**Formulation complète recommandée :**

> **Ce qui part en cuisine, ce qui rentre en caisse.**
> Le logiciel qui fait tenir ensemble votre salle, votre cuisine et votre caisse — sur les
> téléphones que votre équipe a déjà.

### Variante C — « Votre façon de travailler, en plus rapide. »

**Forces.** Elle attaque de front le mode d'échec numéro un des logiciels de restauration —
*le personnel le contourne* (`PRODUCT.md` §10.1) — et elle porte le principe le plus
structurant du produit : le restaurant configure, le logiciel s'adapte (*D-011*). C'est aussi
la réponse à l'objection la plus fréquente (« j'ai déjà essayé, ça n'a pas marché »).

**Faiblesses.** Elle est **défensive** : elle rassure au lieu de promettre. Elle ne nomme aucune
douleur et aucun résultat. Et « en plus rapide » est une promesse de performance qu'on ne peut
pas encore prouver — on ne dispose d'aucune mesure avant/après. Elle deviendra excellente **le
jour où on aura les chiffres des pilotes** ; aujourd'hui, elle est invérifiable.

### Recommandation

**Variante B en titre principal**, avec le sous-titre ci-dessus.

**Variante C conservée**, non comme titre mais comme **section dédiée de la landing** (§4,
section 7 : les trois modes de service) et comme **réponse d'ouverture en rendez-vous
commercial**. C'est là qu'elle travaille le mieux.

**Variante A écartée en titre**, mais sa colonne vertébrale — le parcours complet — est réutilisée
telle quelle dans la section « comment ça marche » (§4, section 5), où décrire le parcours est
précisément le travail à faire.

---

## 4. Structure de la landing (§59, §60)

**Interdits de design, rappelés parce qu'ils se réintroduisent tout seuls** (§59) : pas de
dégradé violet, pas d'orbe lumineux, pas de faux tableau de bord en perspective 3D, pas de
grille « bento » sans logique, pas de « révolutionnez votre restaurant grâce à l'IA », pas de
compteurs animés, pas de mode sombre décoratif. Aucune identité visuelle n'est reprise de
`filon` (*D-013*).

**Structure de chaque section : problème → impact → solution → preuve.** Quand la preuve
manque, la section le dit ou renvoie à la démonstration ; elle ne comble pas.

### Section 0 — Barre de navigation

**Objectif** : ne pas gêner, et offrir deux sorties.
**Contenu** : logo · Fonctionnalités (menu déroulant) · Solutions · Tarifs · Ressources ·
**Voir la démonstration** (bouton plein) · Se connecter (lien discret).
**Note** : pas de bandeau promotionnel flottant, pas de fenêtre modale d'intention de sortie.

### Section 1 — Titre (« hero »)

**Objectif** : qu'un gérant sache en cinq secondes si c'est pour lui, et qu'il puisse essayer
sans parler à personne.

**Contenu et texte réel :**

> # Ce qui part en cuisine, ce qui rentre en caisse.
>
> Le logiciel qui fait tenir ensemble votre salle, votre cuisine et votre caisse — sur les
> téléphones que votre équipe a déjà.
>
> **[ Essayer la démonstration ]**  ·  [ Voir les tarifs ]
>
> Sans matériel à acheter. Sans engagement. Prix en FCFA.

**Visuel.** Pas d'illustration de marque, pas de rendu 3D. **Une capture d'écran réelle du
produit**, à taille lisible, montrant l'écran de cuisine avec deux bons en cours — l'écran le
moins « joli » et le plus crédible. Si le produit n'est pas assez avancé pour une capture
honnête : `[CAPTURE — écran de production réel, à produire dès la première tranche verticale
livrée ; ne pas remplacer par une maquette présentée comme un produit]`.

**Ce qui est un placeholder** : rien. Cette section ne demande aucune preuve externe.

### Section 2 — Bandeau de réassurance (à la place du bandeau de logos clients)

**Objectif** : occuper la place où tout le monde met des logos de clients — que nous n'avons
pas — sans mentir.

**Décision** : **on ne met pas de bandeau de logos tant qu'on n'a pas de clients nommés et
consentants.** À la place, un bandeau de **faits vérifiables sur le produit lui-même**, qui
sont tous des différenciateurs sourcés au §1 :

> Prix en FCFA · Wave, Orange Money, MTN MoMo, espèces · Écrans de cuisine illimités ·
> Aucun matériel à acheter · Vos données exportables à tout moment · Support WhatsApp

**Ce qui est un placeholder** : `[BANDEAU CLIENTS — remplace ce bandeau dès que 4 établissements
pilotes ont donné leur accord écrit d'être nommés. Avant 4, on ne met rien : deux logos
signalent la faiblesse plus qu'ils ne rassurent.]`

### Section 3 — Le problème

**Objectif** : que le gérant se reconnaisse, sans dramatisation.

**Contenu** : trois scènes courtes, au présent, sans adjectif. Pas de statistique inventée, pas
de « saviez-vous que 73 % des restaurants… ».

> ## Trois choses qui arrivent tous les soirs
>
> **La commande ne part jamais.**
> Elle a été prise, elle a été criée, elle n'est pas arrivée. On la refait. Le client, lui,
> a attendu quarante minutes pour rien.
>
> **La caisse ne tombe pas juste.**
> Il manque quelque chose, et personne ne peut dire quoi ni depuis quand. Un paiement mobile
> est arrivé sur un téléphone posé à côté de la caisse. Une addition a été réglée sans être
> enregistrée.
>
> **Vous découvrez les problèmes le lendemain. Ou jamais.**
> Vous savez que la soirée a été bonne. Vous ne savez pas combien exactement, ni quelle table
> a attendu, ni quel plat est parti en rupture à 21 h.

**Impact.** Une ligne sobre, sans chiffrage inventé :

> Aucun de ces trois problèmes ne se règle en surveillant plus. Ils se règlent quand la salle,
> la cuisine et la caisse écrivent au même endroit.

**Ce qui est un placeholder** : `[CITATION TERRAIN — remplacer une des trois scènes par une
citation réelle issue des entretiens (field-research-guide.md §3, questions 4 à 7), attribuée
avec l'accord de la personne. Une phrase de gérant vaut mieux que trois phrases écrites par
nous.]`

### Section 4 — Ce que fait le produit, en une phrase par rôle

**Objectif** : que chacun des cinq métiers se retrouve. Réutilise §2.

**Contenu** : cinq lignes, une par rôle, chacune avec une icône sobre et **sans superlatif**.

> **Le client** consulte la carte en scannant la table. Pas d'application à installer, pas de
> compte à créer.
> **Le serveur** voit ses tables, ce qui attend, et ce qui est prêt à porter. Il ne va plus
> voir en cuisine.
> **La cuisine** reçoit les bons scindés par poste, dans l'ordre, avec le temps écoulé.
> **La caisse** encaisse en espèces, en Wave, en Orange Money — parfois les trois sur la même
> addition — et clôture avec un écart expliqué.
> **Vous** voyez votre service pendant qu'il a lieu, et vos chiffres le lendemain matin sur
> votre téléphone.

### Section 5 — Comment ça marche

**Objectif** : rendre le parcours concret. C'est ici que la variante A du §3 est réutilisée.

**Contenu** : quatre temps, avec une capture réelle par temps.

> ## Du scan à l'addition
>
> **1. Le client s'installe et scanne.** La carte s'affiche, à jour : les plats épuisés n'y
> sont pas.
> **2. La commande part.** Selon votre réglage : directement en cuisine, ou après validation du
> serveur.
> **3. La cuisine produit, le serveur est prévenu.** Chaque poste voit ce qui le concerne. Quand
> c'est prêt, le serveur le sait sans se déplacer.
> **4. L'addition se règle.** En une fois ou en plusieurs parts, en espèces, en mobile, ou les
> deux.

**Preuve** : bouton **« Voir ces quatre étapes en direct »** → ancre vers la démonstration.

**Ce qui est un placeholder** : `[CAPTURES — quatre captures d'écran réelles du produit, prises
sur un appareil réel, sans retouche autre que le floutage de données personnelles.]`

### Section 6 — La démonstration interactive, intégrée dans la page

**Objectif** : convaincre sans rendez-vous. C'est la section la plus importante de la landing.
Détaillée au §5 de ce document.

**Contenu** : le simulateur trois écrans, jouable directement dans la page, sans inscription,
sans adresse e-mail.

**Texte d'accompagnement :**

> ## Essayez-le. Maintenant, depuis cette page.
>
> Vous êtes le client de la table 4 d'un établissement de démonstration. Commandez. Regardez
> l'écran de cuisine réagir. Marquez le plat prêt, et voyez l'écran du serveur s'allumer.
> Demandez l'addition, partagez-la, payez une part.
>
> Rien de ce que vous faites ici n'est enregistré et aucun vrai restaurant n'est concerné.

### Section 7 — Le produit s'adapte à votre fonctionnement

**Objectif** : désamorcer l'objection « ça ne marchera pas chez moi » avant qu'elle ne se forme.
C'est la variante C du §3, à sa vraie place.

**Contenu** : les trois axes de `PRODUCT.md` §2, présentés comme trois questions simples et non
comme une matrice de douze profils.

> ## Le même produit, votre organisation
>
> Trois réglages, et pas un profil à choisir dans une liste.
>
> **Qui prend la commande ?** Vos serveurs uniquement · le client, avec validation du serveur ·
> le client, directement · un mélange selon la catégorie ou la zone de salle.
> **Quand paie-t-on ?** Après avoir consommé · avant que la cuisine ne produise · à chaque
> commande.
> **Où paie-t-on ?** Au comptoir · au serveur, à table · depuis le téléphone du client ·
> plusieurs à la fois, y compris sur une même addition.
>
> Un maquis où l'on prend au carnet et où l'on paie au comptoir, et un lounge où le client
> commande et paie depuis son téléphone, tournent sur le même produit. C'est un réglage, pas
> deux logiciels.

**Pourquoi cette section existe** : aucun concurrent étudié ne permet ce basculement fin
(`competitive-analysis.md` §6.3). C'est un différenciateur réel et il est démontrable
immédiatement.

### Section 8 — L'argent

**Objectif** : traiter frontalement ce qui fait signer.

> ## L'argent ne se devine pas
>
> **Chaque encaissement porte un nom.** Qui a encaissé, quand, par quel moyen, sur quelle table.
> **Une addition, plusieurs paiements.** 15 000 en espèces et 20 000 en Wave sur la même
> addition, avec le solde qui se met à jour.
> **Les espèces comptent autant que le reste.** Fonds de caisse, rendu de monnaie, comptage de
> clôture, écart affiché et justifié.
> **Rien ne se supprime.** Une erreur se corrige par une écriture, jamais par une gomme. Le
> journal garde les deux gestes.

**Preuve** : renvoi vers la démonstration (paiement mixte) et vers `/securite`.

**Argument différenciant à placer ici, sourcé** :

> Nous ne prenons aucune commission sur vos encaissements, et nous ne vous imposons pas notre
> moyen de paiement. C'est l'inverse du modèle dominant : Toast interdit de négocier son taux
> ailleurs, et Otter facture **au minimum 100 $ par mois** de frais de traitement même en
> dessous du seuil. *(Source : `competitive-analysis.md` §8.1 et §8.3.)*

### Section 9 — Conçu pour ici

**Objectif** : la section que ni Toast ni Lightspeed ne peuvent écrire.

> ## Conçu pour des restaurants d'ici
>
> **Wave, Orange Money, MTN MoMo, Moov — et les espèces.** Pas en option, pas « bientôt ».
> **Des prix en FCFA.** Pas un tarif américain converti au cours du jour.
> **Sur le téléphone que votre serveur a déjà.** Aucun terminal à acheter, aucune borne, aucun
> écran propriétaire.
> **Du français simple, des photos, de grands boutons.** Un serveur qui arrive ce soir doit
> pouvoir servir ce soir.
> **Le support répond sur WhatsApp**, aux heures où votre restaurant travaille.

**Argument chiffré, sourcé, à placer en note de bas de section** :

> En Afrique de l'Ouest, le mobile money a représenté **498 milliards de dollars de transactions
> en 2025**, avec **76 services actifs** — le plus grand nombre de toutes les régions du monde.
> *(GSMA, relayé par Connecting Africa ; voir `competitive-analysis.md` §6.2.)*
> **81 % des smartphones vendus en Afrique en 2025 coûtaient moins de 200 $.** *(Omdia ; voir
> §6.5.)* C'est la machine pour laquelle le produit est conçu — pas une exception à gérer.

### Section 10 — Ce que le produit ne fait pas

**Objectif** : c'est la section la plus rare et la plus rentable de la page. Elle fait trois
choses à la fois : elle désamorce les objections, elle rend crédible tout le reste, et elle
évite les désillusions à l'installation — qui sont la première cause de résiliation.

> ## Ce que nous ne promettons pas
>
> **Nous ne remplaçons pas votre connexion internet.** Quand le réseau tombe, vos serveurs
> peuvent continuer à saisir et la carte reste consultable ; mais tant que le réseau n'est pas
> revenu, **les appareils ne se voient pas entre eux**. Nous vous disons exactement ce qui
> marche et ce qui ne marche pas dans ce cas, et nous vous laissons un chemin pour servir et
> encaisser quoi qu'il arrive. *(Voir `/fonctionnalites/hors-ligne` — à rédiger selon §10 de ce
> document.)*
> **Nous ne sommes pas encore certifiés pour la facture normalisée.** Le produit émet un ticket
> pour le client. Le jour où nous serons raccordés au système de la DGI, nous le dirons — et pas
> avant.
> **Nous ne gérons pas encore votre stock à l'ingrédient.** C'est prévu, ce n'est pas livré.
> **Nous ne vendons pas de matériel.** Si vous voulez une imprimante, nous vous disons laquelle
> acheter et où ; nous ne vous la facturons pas.

**Pourquoi c'est une décision, pas de la modestie.** L'étude concurrentielle classe *« le mode
hors-ligne en trompe-l'œil »* parmi les pratiques à ne jamais copier : *« annoncer offline mode
alors que les terminaux ne se synchronisent pas entre eux […], c'est vendre une promesse qui se
brise au pire moment »* (§8.9). Écrire cette section, c'est refuser de reproduire le défaut
qu'on reproche à Toast.

### Section 11 — Tarifs (résumé)

**Objectif** : donner le prix sur la page d'accueil. Cinq concurrents sur treize ne le publient
nulle part ; c'est une friction, et c'est une faiblesse à exploiter (§7).

**Contenu** : les trois offres en une ligne chacune, le prix visible, et un lien vers `/tarifs`.
Détail au §7 de ce document.

### Section 12 — Questions fréquentes

**Objectif** : traiter les objections du §9 sur la page, en texte.

**Contenu** : six à huit questions, reprises telles quelles du §9, avec les réponses honnêtes.

**Décision technique** : **pas de balisage `FAQPage`.** Le résultat enrichi correspondant n'existe
plus pour un site comme le nôtre ; le baliser n'apporte rien et ajoute une dépendance
(`seo-strategy.md` §6.8 et §11.5). Ces questions sont écrites pour des humains.

### Section 13 — Qui nous sommes

**Objectif** : E-E-A-T, et la réponse à l'objection « vous serez encore là dans deux ans ? ».
Google insiste explicitement sur le *« who »* (`seo-strategy.md` §3.1).

**Contenu** : `[À PROPOS — noms, photos et parcours réels de l'équipe ; ville où elle est
basée ; comment nous joindre par téléphone. Aucun texte générique du type « une équipe
passionnée ». Si l'équipe ne veut pas être nommée publiquement, cette section ne doit pas
exister — un « à propos » anonyme fait plus de mal que pas d'« à propos » du tout.]`

**Note** : l'absence d'entité juridique et d'équipe nommée est **précisément** ce qui fait
baisser la crédibilité de nos concurrents locaux dans l'étude — KiboERP : *« aucune adresse,
aucun téléphone, aucun client nommé »* ; DIAM POS : *« pas d'adresse ni d'entité juridique
affichée »*. C'est un écart gratuit à prendre.

### Section 14 — Appel à l'action final

> ## Voyez-le tourner sur votre carte
>
> Envoyez-nous votre carte (une photo suffit). Nous vous rappelons avec votre établissement déjà
> configuré, et vous décidez ensuite.
>
> **[ Essayer la démonstration ]**  ·  [ Nous écrire sur WhatsApp ]  ·  [ Demander un rappel ]

**Pourquoi cette formulation** : elle propose une action que le gérant peut faire depuis son
téléphone en dix secondes (photographier sa carte), elle porte notre travail plutôt que le sien,
et elle crée une conversation sans formulaire. C'est aussi le premier pas de l'import de carte
(`PRODUCT.md` §9).

### Section 15 — Pied de page

Liens produit · Solutions · Ressources · `/securite` · `/confidentialite` · `/conditions` ·
`/cookies` · `/statut` · Téléphone et WhatsApp visibles, pas cachés derrière un formulaire.

### Ce qui n'apparaît nulle part sur cette landing

| Élément habituel | Pourquoi il est absent |
|---|---|
| Bandeau de logos clients | Nous n'en avons pas. Un bandeau vide ou inventé se voit. |
| Compteur « +200 restaurants » | Faux aujourd'hui. |
| Témoignages avec photo de banque d'images | C'est le signal le plus reconnaissable d'un produit qui n'a pas de clients. |
| « Noté 4,9/5 » | Aucun avis réel. Et nous nous interdisons le balisage `SoftwareApplication` avec note tant que ce n'est pas vrai (`seo-strategy.md` §6.6). |
| Section « Propulsé par l'IA » | L'IA n'est qu'un socle en V1 (`PRODUCT.md` §9), et elle ne répond que sur des données déclarées (*R28*). Rien à vendre encore. |
| Décompte de fin de promotion | Manipulation ; et notre prix ne bouge pas. |

---

## 5. La démonstration interactive (§61)

**Thèse** : c'est le meilleur outil de vente dont nous disposerons avant d'avoir des clients, et
c'est le seul qui fonctionne sans preuve sociale. Il faut le traiter comme une fonctionnalité du
produit, pas comme un habillage de la landing.

### 5.1 L'établissement de démonstration

**Nom : « [PRODUCT_NAME] Café »**, et rien d'autre.

Pourquoi ce choix précis : tout nom « réaliste » de maquis ou de restaurant abidjanais risque de
désigner un établissement réel, ce qui serait à la fois une faute et un risque juridique. Nommer
la démonstration d'après le produit lui-même rend la fiction **auto-évidente** et supprime le
risque de collision.

**Marquage obligatoire, permanent, non masquable** : un bandeau fin en haut de la zone de
démonstration — `Démonstration · aucune commande réelle, aucun restaurant réel` — visible sur
les trois écrans, y compris sur mobile, y compris sur une capture d'écran partagée.

**La carte** : dix à douze articles maximum, en FCFA, avec des prix plausibles pour Abidjan,
photographiés. `[PHOTOS — à produire ou à acquérir sous licence explicite. Ne pas utiliser de
photos de plats provenant des réseaux sociaux d'un restaurant existant.]` La carte doit contenir
au moins un article à **variantes** (taille), un à **options payantes** (supplément), un
**épuisé** (pour montrer la disponibilité temps réel, P8), et des articles relevant de **deux
stations différentes** — cuisine et bar — sinon la scission des bons ne se démontre pas.

### 5.2 Les trois écrans

L'écran partagé est le cœur du dispositif : **c'est la seule façon de rendre visible ce que le
produit est réellement** — la coordination. Un menu QR ne peut pas se démontrer ainsi ; nous, si.

```
┌───────────────────────┬───────────────────────┬───────────────────────┐
│  CLIENT — table 4     │  CUISINE — le passe   │  SERVEUR — mes tables │
│  (cadre de téléphone) │  (grandes tuiles)     │  (liste compacte)     │
│                       │                       │                       │
│  ← le visiteur agit   │  ← il voit apparaître │  ← il voit s'allumer  │
│     ici               │     et peut agir      │                       │
└───────────────────────┴───────────────────────┴───────────────────────┘
```

**Sur mobile** — c'est-à-dire sur l'appareil de la majorité de nos visiteurs — trois écrans côte
à côte sont illisibles. Disposition obligatoire : l'écran client en pleine largeur, et les deux
autres en **tuiles empilées sous lui**, qui **s'animent brièvement** (un liseré, pas une
animation décorative) quand elles changent, avec un défilement automatique doux vers la tuile qui
vient de changer. Si cela n'est pas réalisable proprement, la démonstration mobile se réduit à
**deux** écrans — client et cuisine — et l'écran serveur est retiré. **Ne jamais livrer une
démonstration à trois colonnes tassées sur un écran de 5 pouces.**

### 5.3 Ce que le visiteur peut faire

Parcours guidé en six actes, chacun réalisable en un ou deux gestes. Une pastille discrète
indique l'étape suivante ; elle n'ouvre jamais de fenêtre modale bloquante.

| # | Action du visiteur | Ce qu'il voit ailleurs | Ce que ça prouve |
|---|---|---|---|
| **1** | Bouton **« Je scanne la table 4 »** | La carte s'affiche, un article est marqué épuisé | Aucune application à installer ; la disponibilité est réelle (P8) |
| **2** | Il ajoute un plat avec une variante et un supplément, plus une boisson | Le total se met à jour, le prix affiché est le prix retenu | Variantes et options existent ; le prix est figé à la commande (*D-005*, P6) |
| **3** | Il envoie la commande | **Deux bons apparaissent** : le plat sur l'écran cuisine, la boisson sur l'écran bar | La commande se scinde par station (*R11*) — c'est le cœur du produit |
| **4** | Il passe sur l'écran cuisine et marque le plat **prêt** | L'écran serveur s'allume : « table 4 — à porter » | Le serveur sait sans se déplacer (P4) |
| **5** | Il demande l'addition, puis la partage en trois | Trois parts calculées, solde restant visible | Le partage d'addition, absent du marché (§6.4 de l'étude) |
| **6** | Il règle une part « en Wave » (simulé) et une part « en espèces » | Le solde tombe, la troisième part reste due | **Le paiement mixte sur une même addition** — traité nulle part ailleurs |

**Acte optionnel, pour le gérant curieux** : un septième bouton « Voir la clôture de caisse »
qui ouvre l'écran de comptage avec l'attendu, le compté et l'écart. C'est l'écran qui parle à
Awa, et il n'a aucun équivalent démontrable chez les concurrents « menu QR ».

**Durée cible : moins de 90 secondes** pour les six actes. Au-delà, le gérant abandonne.

**Ce que le visiteur ne peut pas faire** : saisir des données personnelles, imprimer, inviter
quelqu'un, ou sortir de l'établissement de démonstration. La démonstration n'est pas un bac à
sable généraliste ; c'est un parcours.

### 5.4 Pourquoi elle convainc mieux qu'une vidéo

1. **Elle prouve la latence, une vidéo ne peut pas.** Une vidéo montre un bon qui apparaît
   instantanément parce qu'elle a été montée. Dans la démonstration, le visiteur appuie et
   **compte lui-même**. Or la vitesse est une fonctionnalité chez nous, pas une intention
   (`PRODUCT.md` principe 4). C'est le seul format qui rend cette promesse vérifiable.
2. **Elle met le gérant à la place de son serveur.** L'objection numéro un est *« mon serveur ne
   saura pas »* (§9.1). Aucun argumentaire ne la lève. Trois gestes chronométrés par
   l'intéressé lui-même, si.
3. **Elle est contrôlée par le visiteur.** Il s'arrête où il veut, il refait l'étape 3, il ignore
   les autres. Une vidéo impose son rythme et son ordre.
4. **Elle se partage.** Le gérant envoie le lien à son associé ou à son manager sur WhatsApp —
   le canal réel des affaires ici. Une vidéo de deux minutes ne se regarde pas sur données
   mobiles ; une page interactive légère, si.
5. **Elle se mesure.** `démo lancée` est déjà une étape du tunnel d'activation
   (`ANALYTICS.md` §4.1). On saura à quel acte les gens s'arrêtent — ce qui est une information
   produit, pas seulement marketing.
6. **Elle ne vieillit pas de travers.** Une vidéo montre l'interface d'il y a six mois. La
   démonstration montre le produit d'aujourd'hui, puisqu'elle en utilise les vrais composants.

### 5.5 Ce qui la rendrait contre-productive — à surveiller

| Risque | Pourquoi c'est grave | Ce qu'on fait |
|---|---|---|
| **Elle est lente** | La démonstration **est** l'argument de vitesse. Si elle rame sur un Android d'entrée de gamme, elle démontre le contraire de la promesse — et elle le démontre mieux qu'aucun concurrent n'aurait pu le faire. | Budget de performance opposable sur la démonstration au même titre que sur le menu client. Testée sur un appareil réel bas de gamme avant toute mise en ligne, jamais sur un simulateur de navigateur. |
| **Elle est trop longue** | Au-delà de deux minutes, le taux d'achèvement s'effondre et on n'atteint jamais l'acte 6 — qui est le plus différenciant. | Six actes, pas douze. Les actes 5 et 6 ne sont jamais coupés pour faire de la place à autre chose. |
| **Elle montre ce qui n'existe pas** | Une démonstration qui affiche le stock à l'ingrédient ou la facture normalisée crée une attente qu'on brisera à l'installation. C'est la manière la plus rapide de perdre un client acquis. | **Règle absolue : la démonstration n'utilise que des fonctionnalités livrées.** Une fonctionnalité non livrée est décrite en texte sur une page `/fonctionnalites/*`, jamais jouée. |
| **Elle pollue les données réelles** | Le mode simulation n'a aucun point d'ancrage dans le modèle de données à ce jour (`INFORMATION_ARCHITECTURE.md`, G2) : les commandes de démonstration risquent d'entrer dans les analytics et la caisse. | Prérequis bloquant : un marqueur porté par les données de démonstration, exclu de tous les agrégats (`ANALYTICS.md` §3.4 : *« les commandes de test et le mode simulation ne comptent jamais »*). **La démonstration ne se met pas en ligne avant que ce marqueur existe.** |
| **Elle demande une adresse e-mail pour démarrer** | Cela détruit le seul avantage du format — l'absence de friction — et contredit le principe produit qui interdit d'exiger un compte avant d'avoir vu la carte. | Aucun formulaire avant l'acte 6. L'invitation à laisser un contact arrive **après**, et elle est refusable. |
| **Le visiteur croit s'être inscrit** | Il repart en pensant avoir un compte, il ne revient pas. | Le bandeau « Démonstration » est permanent, et l'écran de fin dit explicitement ce qui vient de se passer et ce qu'il faut faire ensuite. |
| **Elle ressemble à un vrai restaurant** | Risque de confusion, et faute vis-à-vis de l'établissement homonyme. | Nom auto-évidemment fictif (§5.1), bandeau permanent, aucune adresse, aucun numéro de téléphone. |
| **Elle devient le produit** | Une démonstration trop soignée peut coûter plus cher à maintenir que la fonctionnalité qu'elle montre. | Elle réutilise les **composants réels** du produit avec un jeu de données figé. Si elle exige un code séparé, c'est qu'elle est mal conçue. |

---

## 6. Pages fonctionnalités et solutions

Le sitemap est validé dans `seo-strategy.md` §3.2 et n'est pas rediscuté ici. Ce tableau donne
**l'angle et le message clé** de chaque page — pas son contenu complet.

### 6.1 Fonctionnalités

| Route | Angle | Message clé |
|---|---|---|
| `/fonctionnalites/commande-a-table` | La commande **arrive**, elle ne se crie pas | « Prise à la table, reçue au passe, horodatée. Personne ne peut plus dire qu'il ne l'a pas eue. » |
| `/fonctionnalites/menu` | La carte est **vivante**, pas un PDF | « Un plat épuisé disparaît de la carte au scan suivant. Un prix changé ne réécrit aucune commande déjà passée. » |
| `/fonctionnalites/menu-public` | Vos clients vous cherchent avant de venir | « Une page carte propre et rapide, que vous décidez de rendre visible sur Google — ou pas. » **C'est aussi notre moteur de croissance (§8).** |
| `/fonctionnalites/kds` | L'écran de cuisine **gratuit et illimité** | « Autant d'écrans que de postes, sur des tablettes ordinaires. Ailleurs, un écran de cuisine se facture 30 $ par mois ou s'achète 599 $. » *(sourcé)* |
| `/fonctionnalites/caisse` | La clôture qui s'explique | « Attendu, compté, écart. Et le nom de qui a encaissé chaque franc. » |
| `/fonctionnalites/paiements` | Le paiement **mixte**, et l'absence de commission | « Espèces, Wave, Orange Money, MTN MoMo — parfois sur la même addition. Nous ne prenons rien au passage et nous ne vous imposons rien. » |
| `/fonctionnalites/rapports` | Une question, une réponse | « Pas un mur d'indicateurs. Ce qui a marché hier, ce qui a décroché, et pourquoi. » |
| `/fonctionnalites/equipe` | Chacun son compte, chacun ses droits | « Votre manager de Marcory voit Marcory. Rien d'autre. » |
| `/fonctionnalites/hors-ligne` | **Le sujet le plus délicat de tout le site — voir §10** | Formulation à respecter mot pour mot, donnée au §10.2. Ne jamais écrire « fonctionne hors-ligne » sans qualification. |
| `/fonctionnalites/stock` | **Ne pas publier en l'état** | Le stock n'est qu'un point d'ancrage en V1 (*A3*). Une page produit pour une fonctionnalité non livrée est une promesse commerciale non tenue — la même règle que pour `/integrations/*`. `[PAGE — à publier quand le module est livré, pas avant]` |

### 6.2 Solutions — par type d'établissement

| Route | Angle | Message clé |
|---|---|---|
| `/solutions/maquis` | Le rythme, l'argent, le personnel qui tourne | « Chaque serveur son compte, chaque table son addition, une caisse qui tombe juste. Et un nouveau serveur opérationnel le soir même. » |
| `/solutions/restaurant` | La table, le service, le partage | « Du plan de salle au passe, jusqu'à l'addition partagée à huit autour d'un plat commun. » |
| `/solutions/fast-food` | La file et la cadence | « Commande sur place ou à emporter, paiement avant production si vous le voulez, cuisine synchronisée. » *(mode `pre_paid`.)* |
| `/solutions/hotel` | Plusieurs points de vente, une facturation | « Restaurant, bar, room service. » `[À VÉRIFIER — la facturation à la chambre suppose une intégration PMS non traitée dans la recherche. Ne pas l'annoncer avant d'avoir statué.]` |
| `/solutions/groupes` | Comparer, pas gérer | « Une vue consolidée, des cartes par établissement, des droits par site — et plusieurs devises dans la même organisation. » |

### 6.3 Solutions — par marché

Règle stricte : une page pays n'existe que si elle réunit **au moins trois** éléments qui lui
sont propres (`seo-strategy.md` §3.3). La granularité maximale est **le pays**, jamais la ville.
Créer `/logiciel-restaurant-cocody`, `/…-yopougon`, `/…-marcory` pointant vers le même formulaire
est du *doorway abuse* au sens des règles anti-spam de Google, et c'est interdit.

| Route | Angle | Ce qui la rend légitime aujourd'hui |
|---|---|---|
| `/solutions/cote-divoire` | Marché de lancement | Wave, Orange Money, MTN, Moov · FCFA · SYSCOHADA et FNE · `[contact local et clients nommés — à obtenir]` |
| `/solutions/senegal` | Extension naturelle (Wave y est né) | Wave, Orange Money · FCFA · OHADA |
| `/solutions/benin` | SERP quasi vide (`seo-strategy.md` §1.2, Groupe 5) | MTN MoMo, Moov, Celtiis Cash · FCFA · OHADA |
| `/solutions/cameroun` | Zone CEMAC, autre devise dans la même zone FCFA | MTN MoMo, Orange Money · XAF · OHADA |

**Ordre de publication recommandé** : Côte d'Ivoire d'abord et seule. Les trois autres ne se
publient qu'une fois qu'au moins un client y est installé et nommé — sinon elles ne cochent que
deux critères et deviennent exactement les pages creuses que la règle interdit.

### 6.4 Intégrations

`/integrations/wave`, `/orange-money`, `/mtn-momo`, `/moov-money`.

**Angle commun** : le gérant accepte déjà Wave. Ce qu'il n'a pas, c'est le lien entre ce qui est
tombé sur le téléphone et ce qui a été vendu en salle. C'est le point de douleur réel, et il est
presque inoccupé éditorialement (`seo-strategy.md` §1.2, Groupe 6 : *« presque aucun contenu
écrit du point de vue du restaurateur »*).

**Message clé** : « Le paiement Wave rattaché à sa table et à sa commande — pas seulement au
téléphone du patron. »

**Règle absolue déjà actée** : une page `/integrations/<x>` **n'est publiée que si
l'intégration existe**. Pas de page « bientôt disponible ». L'ordre de livraison est celui de
*D-025* : les espèces d'abord — qui sont un vrai fournisseur de paiement, pas une absence — puis
Wave Côte d'Ivoire, puis un agrégateur.

---

## 7. Tarification (§85)

### 7.1 Le point d'ancrage, et pourquoi il n'est pas négociable

*D-022* fixe la règle : **la grille s'ancre sur la bande locale réelle, pas sur un tarif
occidental converti.** Voici la bande, telle qu'elle a été relevée (`competitive-analysis.md`
§3.1, toutes sources consultées le 2026-09-17) :

| Acteur | Prix relevé | Périmètre |
|---|---|---|
| **Alivaon** (Cameroun) | **10 000 FCFA HT/mois** (2 utilisateurs) · **20 000 FCFA HT/mois** (5 utilisateurs) | Caisse, Orange Money, MTN MoMo |
| **DIAM POS** (UEMOA) | **à partir de 15 000 FCFA/mois** (≈ 22,87 €) | Caisse, Mobile Money, OHADA, multi-site, mode local réseau |
| **CliqPOS** (Ghana) | à partir de **199 GHS/mois** | POS restaurant complet |
| **HilsonPOS** (Ghana) | à partir de **90 GHS/mois** | Facturation MTN MoMo |
| **Systeme Maroc** | **250 / 329 / 750 DH/mois** | Multi-boutique illimité au palier haut |
| **QuickCom** (Maroc) | à partir de **299 DH/mois** | Caisse restaurant |

Et voici, pour comparaison, ce qu'on refuse de convertir :
Toast **69 $/mois** + terminal 799–1 199 $ · Square **49 / 149 $ par site** · Lightspeed
**69 / 189 / 399 $** + 30 $/écran de cuisine · sunday **199 / 299 $** + 5 $ par QR code ·
Otter **79 / 178 / 278 $** avec un **plancher de 100 $/mois** de frais de traitement.

> **Conclusion opérationnelle.** La zone de crédibilité est **10 000 – 20 000 FCFA par mois et
> par établissement**. Un tarif à 69 $/mois n'est pas « plus cher » : il est **hors marché**, et
> le gérant cesse de lire.

### 7.2 Sur quoi on facture — la décision la plus structurante

| Unité de facturation | Décision | Raison |
|---|---|---|
| **Par établissement (`venue`), par mois** | ✅ **Oui, c'est l'unité** | C'est l'unité qui correspond à la valeur reçue et au modèle de données (*D-001* : organisation → établissement). Un gérant comprend « je paie par restaurant » sans explication. |
| **Par utilisateur** | ❌ **Non, et c'est la décision la plus importante de cette section** | Facturer à l'utilisateur, c'est facturer exactement ce qu'on vend. La traçabilité de l'argent (P2) suppose que **chaque serveur ait son compte**. Un prix par utilisateur pousse le gérant à partager un compte entre trois serveurs — et détruit l'attribution de chaque encaissement, donc la promesse centrale. Alivaon facture ainsi (10 000 pour 2 utilisateurs, 20 000 pour 5) : c'est notre écart le plus lisible. |
| **Par commande / par couvert** | ❌ Non | Punit le succès, rend la facture imprévisible, et sur des tickets bas le coût de gestion est disproportionné. Une facture qui varie chaque mois est une source d'angoisse, pas un modèle. |
| **Commission sur les encaissements** | ❌ Non par défaut | C'est le modèle Toast, et il est doublement disqualifié ici : il est hostile (l'étude le classe en tête des pratiques à ne pas copier, §8.1) et **il n'est pas compétitif** — la commission mobile money locale est déjà de l'ordre de 1 à 2 %, contre 2,49 à 3,69 % chez Toast. Prendre une part par-dessus l'opérateur serait à la fois cher et injustifiable. |
| **QR codes, écrans de cuisine, tables** | ❌ Jamais | sunday facture **5 $ le QR**, Lightspeed **30 $ par écran**. C'est facturer l'adoption de son propre produit (§8.5). Illimités partout, y compris sur l'offre gratuite. |
| **Matériel** | ❌ Non (*D-021*) | Aucun matériel propriétaire. On conseille une imprimante, on ne la vend pas. |
| **Frais d'installation, plancher de facturation, engagement** | ❌ Aucun | Le plancher d'Otter (100 $/mois) appliqué à un maquis est une exclusion pure. L'engagement de 24 mois sur le matériel est inadapté à une clientèle dont la trésorerie est le premier souci (§8.3 et §8.7). |

### 7.3 La grille

> **Statut des montants : ancres à valider par le terrain.** La structure ci-dessous est ferme.
> Les chiffres sont construits à partir de la bande relevée au §7.1 et doivent être confrontés
> à la question 13 du guide d'entretien gérant — *« Quel prix mensuel vous paraîtrait normal ?
> À partir de quel prix c'est non ? »* — avant d'être publiés. `[PRIX — à confirmer sur
> 5 entretiens gérants minimum, dont 2 maquis et 1 groupe]`

| | **Découverte** | **Service** ★ | **Groupe** |
|---|---|---|---|
| **Prix** | **0 FCFA** | **15 000 FCFA HT / mois / établissement** | **Dégressif par établissement** + socle organisation |
| **Pour qui** | Un établissement qui veut d'abord une carte en ligne propre | Un établissement qui veut piloter son service | Plusieurs établissements sous une même enseigne |
| **Carte, QR, page menu publique** | ✅ | ✅ | ✅ |
| **Commande à table, écran de cuisine, écran serveur** | ❌ | ✅ | ✅ |
| **Caisse, clôture, additions, partage, paiement mixte** | ❌ | ✅ | ✅ |
| **Rapports d'exploitation** | ❌ | ✅ | ✅ |
| **Consolidation multi-établissements, rôles au niveau organisation, multi-devises** | ❌ | ❌ | ✅ |
| **Mention « Carte propulsée par [PRODUCT_NAME] » retirable** | ❌ | ❌ | ✅ |
| **API et webhooks sortants** | ❌ | ❌ | ✅ |

**Dégressivité proposée pour l'offre Groupe** (structure ferme, montants à valider) :
1ᵉʳ établissement 15 000 · du 2ᵉ au 5ᵉ 12 000 chacun · à partir du 6ᵉ 9 000 chacun · plus un
socle organisation de 15 000 FCFA/mois qui porte la consolidation.

**Au-delà de 15 établissements** : devis — mais **la méthode de calcul reste publiée**. « Sur
devis » sans aucun chiffre est ce que nous reprochons à nos concurrents ; « sur devis à partir
de cette formule » ne l'est pas.

### 7.4 Ce qui est inclus dans **toutes** les offres, y compris la gratuite

C'est cette liste qui fait le positionnement, autant que le prix.

- **Utilisateurs illimités.** Autant de comptes serveurs que de serveurs.
- **QR codes illimités**, écrans de cuisine illimités, tables illimitées.
- **Aucun matériel à acheter**, aucun frais d'installation, aucun engagement de durée.
- **Aucune commission** prélevée par nous sur vos encaissements.
- **Aucun plancher de facturation.**
- **Export de vos données**, à tout moment, dans un format ouvert, y compris en partant.
- **Support WhatsApp** aux heures de service.
- **Mises à jour incluses.**

> **Sur l'export en partant.** Ce n'est pas une générosité : *« laisser le restaurant emporter
> ses données et son contenu s'il part »* est une ligne explicite de la charte de croissance
> (`seo-strategy.md` §8.2). Retenir la page ou le référencement en otage serait indéfendable, et
> cela se saurait.

### 7.5 Ce qui différencie les paliers — et ce qui ne les différencie jamais

**Ne différencie jamais** : l'écran de cuisine, le nombre d'écrans, le nombre d'utilisateurs, le
nombre de tables, le partage d'addition, le paiement mixte, l'export de données, le support. Ce
sont les fonctions opérationnelles du produit ; les dégrader pour créer un palier reviendrait à
vendre un produit qui ne fait pas son travail.

**Différencie** : le nombre d'établissements, la consolidation entre établissements, les rôles
au niveau de l'organisation, le multi-devises, l'API, et la marque blanche.

**Le saut entre Découverte et Service est volontairement franc, et il n'y a pas de palier
intermédiaire.** Un palier « carte payante » serait un produit de menu QR — exactement la
catégorie commoditisée dont nous refusons de faire partie (§1). Le gratuit est la porte ; le
payant est le système d'exploitation. Entre les deux, il n'y a rien à vendre.

### 7.6 Faut-il afficher les prix publiquement ?

**Constat** : cinq acteurs sur treize ne publient **aucun prix** — me&u/Mr Yum, UEAT,
Deliverect, et partiellement Oracle et Toast. Trois autres publient l'abonnement mais **pas les
commissions de paiement** : Lightspeed, sunday, Bopple (`competitive-analysis.md` §6.8).

**Décision : oui, publier. Intégralement.** Quatre raisons, dans l'ordre de leur poids.

1. **C'est une faiblesse à exploiter, pas une pratique à imiter.** Pour un restaurateur, le coût
   réel est aujourd'hui inconnu avant un entretien commercial. C'est une friction, et c'est de la
   défiance. Nous sommes le seul acteur pour qui l'afficher est un avantage net.
2. **Notre acheteur ne demande pas de devis.** Awa ne remplit pas un formulaire pour connaître un
   prix ; elle ferme l'onglet. Les acteurs opaques vendent à des chaînes avec un cycle long et
   une force commerciale. Nous vendons en libre-service à des indépendants. **Le modèle de vente
   commande le modèle d'affichage** — et c'est pourquoi imiter leur opacité serait une erreur de
   raisonnement, pas seulement de posture.
3. **Le prix est une requête.** `/tarifs` vise « prix logiciel restaurant », et l'article
   « Combien coûte vraiment un logiciel de restaurant » est au plan éditorial
   (`seo-strategy.md` §2, cluster 4). On ne peut pas écrire cet article et cacher son propre prix.
4. **C'est cohérent avec tout le reste du positionnement.** Un produit qui promet de faire tomber
   la caisse juste et qui cache son propre tarif se contredit à la première page.

**Ce qu'on publie exactement :**

- Le prix mensuel par établissement, **en FCFA, HT et TTC**. La TVA ivoirienne au taux normal est
  de **18 %** ; le taux réduit de 9 % vise une liste limitative de produits qui ne couvre pas les
  prestations de services. `[FISCALITÉ — cette conclusion est une déduction par exclusion à
  partir de PwC, pas une citation ; à faire confirmer par un conseil fiscal ivoirien avant
  publication d'un prix TTC (voir payments-africa.md §9.1).]`
- **Le fait que nous ne prenons aucune commission** sur les encaissements. C'est la version
  honnête de « publier ses commissions » quand on n'en prend pas : on l'écrit noir sur blanc,
  parce que c'est justement ce que les autres ne font pas.
- **Les frais des opérateurs de paiement**, quand nous les intermédions — en les présentant comme
  ce qu'ils sont : les frais de l'opérateur, pas les nôtres. **Aucun taux n'est publié sans
  capture datée de la grille tarifaire de l'opérateur**, parce que ces grilles changent
  (`seo-strategy.md` §2, cluster 1). `[TAUX OPÉRATEURS — à documenter avec captures datées.
  Ordres de grandeur relevés, non publiables en l'état : Wave CI ≈ 1 % (source secondaire),
  Orange Money 1 à 1,2 % (secondaire), Paystack 1,95 % mobile money (publié).]`
- **Ce qui n'est pas inclus**, en toutes lettres : le matériel qu'il faudra éventuellement
  acheter ailleurs (imprimante, tablette), et le temps de reprise de la carte.

**Une seule chose reste hors grille** : au-delà de 15 établissements, le montant final se
discute — mais la formule est publiée (§7.3).

### 7.7 Trois points à trancher, signalés parce qu'ils ne le sont pas

1. **Paiement annuel.** Une remise pour paiement annuel est un levier de trésorerie classique.
   Ici, la trésorerie est le premier souci du client, et l'engagement long est classé parmi les
   pratiques à éviter (§8.7). **Recommandation : proposer l'annuel en option avec une remise de
   deux mois, jamais par défaut, et jamais comme un engagement — le remboursement au prorata
   reste possible.** À valider auprès des pilotes.
2. **Comment se paie l'abonnement ?** Nos clients paient en Mobile Money ou en espèces, pas par
   carte. DIAM POS accepte explicitement Mobile Money, virement **ou espèces**. **Un abonnement
   qui exige une carte bancaire exclut une partie de sa cible.** `[À TRAITER — l'encaissement de
   notre propre abonnement est un sujet produit à part entière, non traité dans la recherche.]`
3. **Subventions publiques à la digitalisation.** Le dispositif marocain MOWAKABA fait passer un
   pack Odoo de 9 900 à **990 MAD** — une subvention de 90 % qui change radicalement l'économie
   de l'achat. **L'existence d'un équivalent en Côte d'Ivoire, au Sénégal, au Bénin et au
   Cameroun n'a pas été vérifiée (NV).** Si un tel dispositif existe, s'y rendre éligible est
   probablement le levier d'acquisition le plus rentable de toute cette stratégie. `[RECHERCHE —
   à mener, pays par pays.]`

---

## 8. Boucle de croissance (§84)

### 8.1 La boucle principale — le menu public

Elle est décrite dans `seo-strategy.md` §8.1 et reprise ici parce que c'est le mécanisme
d'acquisition central du produit, pas un canal parmi d'autres.

```
Un restaurant active sa page menu publique
        ↓
La page se classe sur « <nom du restaurant> menu », « <nom> carte », « <nom> prix »
  — requêtes de marque, faciles à gagner : aujourd'hui elles renvoient vers une fiche
    Facebook incomplète, un agrégateur aux prix périmés, ou rien
        ↓
Des clients du restaurant arrivent sur une page rapide, à jour, propre
        ↓
Le gérant constate un trafic qu'il n'avait pas → il en parle
        ↓
  (a) il partage le lien — réseaux, WhatsApp, fiche Google Business, son propre site
  (b) une mention sobre « Carte propulsée par [PRODUCT_NAME] » en pied de page
  (c) un autre gérant voit la page, la trouve professionnelle, demande qui l'a faite
      → acquisition par imitation entre pairs, le canal le plus efficace du secteur
```

**Pourquoi elle fonctionne ici précisément** : la requête « <nom du maquis> menu » est
aujourd'hui très mal servie en Côte d'Ivoire, au Sénégal, au Bénin et au Cameroun. Une page
carte propre, rapide et à jour gagne cette requête **sans effort de référencement**, parce
qu'il n'y a pas de concurrence sérieuse dessus.

**Ce que ça change pour la vente** : on ne dit pas au gérant que « le référencement est
important ». On lui montre **combien de personnes ont ouvert sa carte cette semaine**. C'est un
chiffre qu'il n'avait pas, sur son propre établissement, produit par nous.

**La contrainte qui est en réalité le moteur.** Une porte de qualité conditionne l'indexation
d'un menu (`seo-strategy.md` §7.5 et §11.4) : elle ralentit la boucle à court terme. Mais une
page lente, aux prix périmés, ne se classe pas et ne se partage pas. **La qualité et la
croissance vont ici dans le même sens** — ce qui est rare, et qu'il faut exploiter plutôt que
d'arbitrer.

### 8.2 Le QR en salle — l'arithmétique, et son inconnue

Le QR collé sur la table est vu par tous les convives, tous les soirs. Voici ce qu'on peut en
dire honnêtement.

> **Ceci est une arithmétique à paramètres déclarés, pas une mesure.** Les paramètres sont
> plausibles ; aucun n'a été observé.

Pour un établissement du profil d'Awa — 18 tables, 2 rotations par soirée, 4 convives par
table, 26 soirées par mois :

```
18 × 2 × 4 = 144 personnes assises par soirée
144 × 26  ≈ 3 700 personnes par mois, face à un QR portant notre nom
```

**L'inconnue est la seule chose qui compte, et elle n'est pas connue.** Le taux de scan réel
— la part de ces 3 700 personnes qui scanne effectivement — **n'a pas été mesuré et ne figure
dans aucune source fiable (NV)**. Il dépend du mode de service, de l'affichage, du réseau, de
l'habitude locale. Selon qu'il vaut 5 % ou 40 %, la boucle est marginale ou dominante.

**Conséquence opérationnelle** : le taux de scan par table est **le premier indicateur à
instrumenter chez les pilotes**, avant tout investissement dans ce canal. Tant qu'il est inconnu,
on ne bâtit aucune prévision dessus et on n'écrit nulle part « vu par des milliers de convives ».

**Ce que le QR produit à coup sûr, sans dépendre du taux de scan** : une exposition de marque
répétée auprès d'un public qui compte des restaurateurs, des serveurs et des gérants — car les
gens du métier mangent chez leurs confrères. C'est faible par exposition et significatif par
répétition. On ne le chiffre pas.

### 8.3 La mention en pied de page — et la ligne à ne pas franchir

| Ce qu'on fait | Ce qu'on ne fait pas, et pourquoi |
|---|---|
| Mention sobre « Carte propulsée par [PRODUCT_NAME] » en pied de page du menu public, **en `rel="nofollow"`** | Un lien suivi depuis des centaines de pages clientes vers notre domaine est un schéma de liens à l'échelle. Le `nofollow` rend la mention honnête : elle sert la notoriété, pas la manipulation du classement. |
| La rendre **retirable sur l'offre Groupe** (§7.3) | La rendre retirable partout — elle ne servirait plus à rien ; ou la rendre non retirable partout — un groupe qui paie a le droit de ne pas afficher notre marque chez lui. |
| Donner au gérant le lien direct vers **sa** page, à partager où il veut | Acheter des liens, en échanger, en automatiser |
| L'aider à renseigner sa fiche Google Business et à y mettre le lien du menu | Créer la fiche à sa place — c'est une donnée qui lui appartient |
| Publier des résultats chiffrés de clients **nommés et consentants** | Publier des moyennes invérifiables ou des témoignages composés |

### 8.4 Parrainage

**Le mécanisme.** Un gérant qui en amène un autre obtient **un mois offert**, et le nouveau
venu aussi. Symétrique, simple à expliquer au téléphone, et sans espèces — ce qui évite d'entrer
dans le champ de l'apport d'affaires rémunéré.

**Pourquoi c'est le bon levier ici, et pas un gadget.** L'acquisition par imitation entre pairs
est le canal le plus efficace du secteur, et il fonctionne déjà sans nous : un gérant demande à
un autre quel outil il utilise. Le parrainage ne crée pas ce comportement, **il le récompense**.

**La condition qui le rend honnête** : la récompense ne se déclenche que lorsque le filleul a
traité **sa première vraie commande** — pas à l'inscription. C'est exactement l'étape qui compte
dans le tunnel d'activation : *« tout ce qui précède est une promesse »* (`ANALYTICS.md` §4.1).
Récompenser une inscription, c'est acheter des comptes vides.

### 8.5 Revendeurs et installateurs

**Le modèle existe déjà dans la région et il est documenté** : Sagatec au Maroc s'appuie sur un
**réseau de revendeurs national** ; Akwabax en Côte d'Ivoire opère comme **intégrateur Odoo
certifié**. Ce n'est donc pas une hypothèse, c'est une pratique de marché.

**Qui sont ces gens** : les agences numériques locales, les installateurs de caisses et
d'imprimantes thermiques, les comptables et cabinets qui tiennent déjà la compta de dizaines de
restaurants. Le comptable est le plus intéressant : il a la confiance du gérant sur exactement le
sujet dont nous parlons — l'argent.

**Ce qu'on leur donne** : une commission récurrente sur l'abonnement qu'ils apportent, un accès
de démonstration, et une formation courte. **Ce qu'on ne leur donne pas** : l'exclusivité
territoriale, et l'accès aux données des établissements qu'ils ont amenés — ils sont
apporteurs, pas administrateurs (*R25* interdit de toute façon de franchir la frontière d'une
organisation).

**Quand** : pas avant d'avoir cinq clients directs installés et stables. Un revendeur qui vend un
produit qu'on ne sait pas encore déployer abîme deux réputations à la fois.

### 8.6 Les deux leviers de contenu qui apportent des liens

1. **Les gabarits téléchargeables** (`/modeles/*`) : fiche technique de plat, tableau de clôture
   de caisse, calculateur de coût matière en FCFA. **Sans formulaire** — c'est l'absence de
   formulaire qui les rend citables.
2. **Les données que nous seuls posséderons** : heures de pointe réelles par marché, ticket
   moyen par format, part des paiements mobiles dans l'encaissement. C'est le type de publication
   que la presse économique régionale reprend, et qui apporte des liens qu'on ne peut pas
   acheter. **À ne pas tenter avant d'avoir un échantillon défendable** : publier une « étude »
   sur douze restaurants abîmerait durablement notre crédibilité.

### 8.7 Ce que cette boucle ne fait pas

Elle produit de la **notoriété** et des **contacts entrants**. Elle ne produit pas de **groupes
multi-sites** : Serge n'achète pas depuis une page menu, il achète après une démonstration
accompagnée. Le segment le plus rentable reste un segment de vente directe, avec un cycle long.
**Ne pas laisser la boucle masquer l'absence de démarche commerciale sur les groupes.**

---

## 9. Objections

Les objections qu'un restaurateur ivoirien opposera réellement. Pour chacune : la réponse
honnête. **Quand l'objection est fondée, c'est dit, et on explique ce qu'on fait.**

### 9.1 « Mon serveur ne saura pas s'en servir. »

**Fondée en partie.** C'est le mode d'échec numéro un des logiciels de restauration : le
personnel contourne l'outil (`PRODUCT.md` §10.1). Ce n'est pas une question de compétence, c'est
une question de nombre de gestes : si l'outil est plus lent que le carnet au coup de feu, il sera
abandonné, et il aura raison de l'être.

**La réponse.** L'objectif est explicite et mesurable : **un serveur opérationnel en moins de dix
minutes, sans manuel** — photos des plats, grands boutons, français simple, trois gestes pour
envoyer une commande. Et le premier soir, il n'est pas obligé de changer quoi que ce soit : en
mode « le serveur saisit », l'outil remplace le carnet, pas la méthode.

**Ce qu'on ajoute au lieu d'argumenter** : « Regardez la démonstration et comptez vos gestes. Si
c'est plus long que son carnet, ne l'achetez pas. »

`[PREUVE — chronométrer la prise de commande, carnet contre produit, chez un pilote, et publier
les deux chiffres.]`

### 9.2 « Ici, internet coupe. »

**Entièrement fondée.** Les coupures de câbles sous-marins, les pannes régionales et les coupures
décidées à l'échelle nationale ont marqué 2025–2026 en Afrique de l'Ouest.

**La réponse honnête, et c'est la plus délicate du document.** Il faut distinguer deux choses que
tout le monde confond, y compris nos concurrents.

- **Ce qui continue quand le réseau tombe** : la carte déjà chargée reste consultable, et vos
  serveurs peuvent continuer à saisir — ce qui est saisi part dès que le réseau revient, sans
  doublon.
- **Ce qui ne marche pas** : tant que le réseau est coupé, **les appareils ne se voient pas entre
  eux**. Le bon saisi par le serveur n'apparaît pas sur l'écran de cuisine. Il faut alors le
  chemin de secours habituel — la voix, le papier — et l'outil rattrape ensuite.
- **Ce qu'on refuse de faire fonctionner hors ligne, volontairement** : le paiement, la clôture de
  caisse, le remboursement, la clôture de table (*A4*). Une commande envoyée hors ligne à 20 h 10
  et remontée à 20 h 40, après que la table a été payée et fermée, crée un désordre plus coûteux
  que le service qu'elle rend. Réseau absent : on encaisse en espèces et on enregistre après —
  c'est ce que le restaurant fait déjà.
- **Et l'interface ne ment pas sur l'état** : une commande en file d'attente s'affiche
  « en attente de confirmation », jamais « envoyée ». Tant qu'elle n'est pas confirmée, elle ne
  l'est pas.

**Ce qu'on ne fait pas : prétendre le contraire.** C'est exactement ce que fait le leader du
marché, et sa propre documentation le dit : *« Devices cannot sync with each other while offline,
so orders added or updated on one device do not appear on other devices »* — hors ligne, Toast ne
peut plus afficher les commandes sur les écrans de cuisine, ni même connecter un employé.
Square, lui, transfère explicitement le risque au commerçant : *« You're responsible for any
expired, declined, or disputed payments accepted while taking offline payments. »* **Nous
refusons de vendre la même promesse en la disant mieux.**

**Ce qu'on fait.** La synchronisation directe entre appareils sur le réseau du restaurant, sans
passer par internet, est **le meilleur différenciateur identifié** et **elle n'est pas livrée**
(*A8*). Elle suppose un second logiciel tournant sur place. C'est un arbitrage d'investissement
ouvert, pas une promesse. Les fondations techniques sont posées pour qu'elle soit possible sans
tout réécrire. **Le jour où elle existera, nous le dirons ; d'ici là, nous ne l'écrivons nulle
part.**

### 9.3 « C'est trop cher. »

**À qualifier avant de répondre.** « Trop cher » veut dire trois choses différentes : je n'ai pas
la trésorerie ce mois-ci · je ne vois pas ce que ça me rapporte · j'ai vu moins cher ailleurs.

**Si c'est la trésorerie.** Pas d'engagement, pas de frais d'installation, pas de matériel à
acheter, résiliable d'un mois sur l'autre. C'est une charge mensuelle, pas un investissement.

**Si c'est la valeur.** La question honnête à retourner : « à combien estimez-vous l'écart de
caisse d'un mois normal ? » S'il ne sait pas — et il ne sait presque jamais — c'est précisément
le problème que le produit résout en premier. On ne promet pas un montant récupéré : **on promet
de le rendre visible.**

**Si c'est la comparaison.** Nous sommes dans la bande locale, pas au-dessus. Et le prix affiché
est complet : utilisateurs illimités, écrans illimités, aucune commission, aucun matériel — ce
qui n'est pas le cas des offres d'apparence moins chères facturées à l'utilisateur.

### 9.4 « Je n'ai pas de tablette. »

**Pas fondée, et c'est une bonne nouvelle à annoncer.** Le téléphone du serveur est le terminal.
L'écran de cuisine peut être n'importe quelle tablette Android d'entrée de gamme : **81 % des
smartphones vendus en Afrique en 2025 coûtaient moins de 200 $**, et le produit est conçu pour
cette machine, pas pour l'exception (Omdia). Aucun matériel propriétaire (*D-021*).

**La nuance qu'il faut dire** : il vous faudra **un** appareil qui reste en cuisine. Si vous n'en
avez aucun, c'est un achat de quelques dizaines de milliers de francs, **chez le commerçant de
votre choix, pas chez nous**. Et si vous préférez commencer sans écran de cuisine, c'est
possible : le service tourne, la cuisine reçoit ses bons autrement.

### 9.5 « Et si ça tombe en panne un samedi soir ? »

**Entièrement fondée, et c'est la meilleure question qu'un gérant puisse poser.** Un logiciel de
restauration qui bloque le service est désinstallé le soir même (`PRODUCT.md` principe 2).

**La réponse en trois temps.**
1. **Il reste toujours un chemin pour servir et encaisser.** C'est un principe de conception, pas
   une option : aucune fonctionnalité n'a le droit d'être le seul chemin vers l'encaissement.
2. **Vous nous joignez sur WhatsApp**, aux heures où votre restaurant travaille — c'est-à-dire le
   samedi soir, pas du lundi au vendredi de 9 h à 17 h.
3. **L'état du service est public** sur une page dédiée : si c'est nous, vous le voyez sans
   appeler.

**Ce qu'on ne dit pas** : « ça n'arrivera pas ». `[ENGAGEMENT DE SERVICE — le délai de réponse du
support doit être écrit, tenu et mesuré. Ne pas publier de délai qu'on ne mesure pas.]`

### 9.6 « Si le client commande tout seul, mon serveur perd son pourboire. »

**Fondée, et c'est la peur la plus sous-estimée.** Le revenu du serveur dépend en partie du
contact avec le client. Un outil qui supprime ce contact sera saboté par ceux qui doivent
l'utiliser — et c'est le sabotage de l'équipe, pas le refus du gérant, qui tue le déploiement.

**La réponse.** Le client ne commande seul **que si vous le décidez**, et le réglage par défaut
est celui où **le serveur valide avant que la cuisine ne produise** (*A2*). Il garde la main sur
sa table. Le réglage peut même varier par zone : service assis en salle, autonomie en terrasse.
Aucun concurrent étudié ne permet ce basculement fin (`competitive-analysis.md` §6.3).

**Et sur le pourboire lui-même** : il est **désactivé par défaut** dans le produit (*D-027*) —
aucun encadrement légal ivoirien du pourboire n'a été trouvé, et nous n'activons pas par défaut
une collecte d'argent dont le cadre nous est inconnu. Le pourboire reste ce qu'il est
aujourd'hui : de la main à la main.

### 9.7 « Si tout est enregistré, l'administration va tout voir. »

**Objection réelle, rarement dite à voix haute, et qui décide de beaucoup de refus.**

**La réponse, qui ne doit être ni complice ni moralisatrice.**
- **Nous ne transmettons vos données à personne.** Ni à l'administration, ni à qui que ce soit.
  Ce qui est dans votre établissement vous appartient, et vous pouvez l'exporter ou l'effacer.
- **Ce n'est pas nous qui changeons votre situation fiscale.** En Côte d'Ivoire, la **facture
  normalisée électronique est obligatoire pour toutes les entreprises, sans exception de régime
  fiscal, depuis le 1ᵉʳ décembre 2025**, et **la DGI a lancé des contrôles sur l'ensemble du
  territoire à compter du 1ᵉʳ septembre 2026**. Cela s'applique avec ou sans logiciel.
- **La vraie question est celle du contrôle.** Un établissement dont les ventes sont tracées est
  en meilleure position face à un contrôle qu'un établissement tenu au carnet.
- **Et nous ne prétendons rien.** Le produit émet aujourd'hui un **ticket**, et le mot
  « facture » ne figure nulle part dans l'interface (*D-015*, *D-024*) — parce qu'en Côte
  d'Ivoire « facture » et « reçu » désignent des pièces certifiées par la DGI, et que nous ne le
  sommes pas encore.

### 9.8 « J'ai déjà essayé un logiciel. Ça n'a pas marché. »

**Souvent fondée, et c'est notre meilleure conversation.** La bonne réponse n'est pas de se
défendre, c'est de demander : *« Qu'est-ce qui s'est passé exactement ? »* — question 9 du guide
d'entretien gérant, et il est noté que la réponse vaut de l'or.

**Les trois causes qu'on entend, et ce qu'on fait de chacune :**
- *« C'était trop compliqué, personne ne l'utilisait. »* → C'est le mode d'échec que nous
  surveillons en premier. La mesure qui compte pour nous n'est pas « combien de comptes créés »
  mais **« combien d'établissements ont traité de vraies commandes cette semaine »**.
- *« Ça ne correspondait pas à ma façon de travailler. »* → C'est le principe fondateur du
  produit : le restaurant configure, le logiciel s'adapte (§4, section 7).
- *« Ils ont disparu. »* → Fondée. Voir §9.10.

### 9.9 « Mes clients ne scanneront pas. »

**Peut-être fondée, et nous ne le savons pas encore.** Le taux de scan réel n'a pas été mesuré
(§8.2). Certaines clientèles scanneront peu.

**La réponse.** C'est précisément pour cela que le produit ne repose pas sur le scan. En mode
« le serveur saisit », le QR ne sert qu'à consulter la carte, et **tout le reste du produit
fonctionne à l'identique** : la commande arrive en cuisine, la caisse est juste, la clôture
s'explique. Un restaurant peut acheter ce produit et ne jamais laisser un client commander
lui-même. **C'est la conséquence directe de notre positionnement : le QR vend, mais la valeur est
ailleurs** (*A6*).

### 9.10 « Vous êtes qui ? Vous serez encore là dans deux ans ? »

**Entièrement fondée, et nous n'avons pas de bonne réponse aujourd'hui.** Nous n'avons ni
ancienneté, ni clients à montrer, ni levée de fonds à annoncer.

**Ce qu'on peut dire, et qui est vrai :**
- **Qui nous sommes, nommément**, avec une adresse, un téléphone et des visages — ce que la
  plupart de nos concurrents locaux ne font pas (§4, section 13).
- **Vos données sortent quand vous voulez**, dans un format ouvert, y compris en partant. Vous
  n'êtes pas prisonnier de notre survie.
- **Aucun engagement de durée.** Vous arrêtez le mois où vous voulez.

**Ce qu'on ne fait pas** : promettre une longévité qu'on ne peut pas garantir, ou brandir des
investisseurs comme une preuve de solidité.

### 9.11 « Je n'ai pas le temps de tout ressaisir. »

**Fondée, et c'est le premier frein concret à l'installation**, bien avant le prix.

**La réponse.** Envoyez une photo de votre carte : nous la saisissons et nous vous rendons
l'établissement configuré. C'est l'appel à l'action de la landing (§4, section 14), et c'est un
travail que nous prenons à notre charge parce qu'il conditionne tout le reste.

`[MESURE — combien de temps prend réellement la reprise d'une carte de 60 articles ? À chronométrer
sur les trois premiers pilotes. Si c'est trop long pour être offert, le dire et le facturer —
mais ne jamais l'annoncer offert sans le savoir.]`

### 9.12 « Mes clients n'ont pas tous un smartphone, et pas toujours de forfait data. »

**Fondée, et davantage qu'on ne le croit.** En Côte d'Ivoire, le taux d'inclusion financière est
de **51 %** *(Global Findex, cité par Boldrails ; voir `payments-africa.md` §1.2)* : une moitié de
la clientèle potentielle paie en espèces. Supposer que toute une salle scanne et paie en ligne est
une erreur d'observation, pas un détail de mise en œuvre.

**La réponse, qui est une décision d'architecture et pas un argument.**
- **Le produit ne dépend pas du téléphone du client.** En mode « le serveur saisit », aucun convive
  n'a besoin d'appareil, de data, ni même de savoir ce qu'est un QR code. La commande arrive quand
  même en cuisine, la caisse est quand même juste. **C'est le mode par défaut à l'installation**
  (*A2*).
- **Les espèces sont un moyen de paiement de première classe**, pas un repli : elles ont leur fonds
  de caisse, leur rendu de monnaie, leur écart de clôture, et elles peuvent se mélanger au Mobile
  Money sur une même addition (*D-019*).
- **Une table mixte fonctionne** : sur quatre convives, deux scannent et deux ne scannent pas — la
  session de table est la même, et le serveur saisit pour ceux qui ne scannent pas.

**Ce qu'on ne dit pas** : que « tout le monde a un smartphone maintenant ». C'est faux, et le gérant
le sait mieux que nous.

### 9.13 « Je ne veux pas que mes chiffres soient sur internet. »

**Fondée comme préoccupation, et elle mérite mieux qu'une phrase rassurante.** Le gérant demande
deux choses différentes : *qui peut voir mes chiffres ?* et *qu'est-ce qui se passe si vous
disparaissez ?*

**Sur qui peut voir.** Ce qu'on peut affirmer aujourd'hui, et rien de plus — c'est la liste exacte
de `SECURITY.md` §1, reprise sans l'embellir :
- Les données de chaque organisation sont **isolées par un contrôle de portée appliqué côté
  serveur, avant toute lecture**, et vérifié par des tests automatiques.
- Les droits sont granulaires et vérifiés côté serveur ; l'interface ne fait que masquer.
- Les actions sensibles sont journalisées avec leur auteur.
- **Aucune donnée de carte bancaire** ne transite ni n'est stockée par nos soins.
- Votre manager de Marcory voit Marcory. Rien d'autre — et ce n'est pas un réglage d'affichage,
  c'est une barrière serveur (*R25*).

**Sur ce qui se passe si nous disparaissons.** Vos données sont exportables à tout moment, dans un
format ouvert, y compris en partant (§7.4). C'est la seule réponse honnête possible de la part d'une
jeune entreprise, et c'est celle qui vaut quelque chose.

**Ce qu'on ne dira jamais ici** — et c'est explicite dans `SECURITY.md` §1 : aucune certification
(ISO 27001, SOC 2, PCI-DSS), aucun engagement de disponibilité chiffré, aucune garantie de
localisation des données, aucun audit externe. **Tant que ce n'est pas vrai.** Un client qui
découvre une affirmation fausse sur ce sujet-là ne revient pas.

**L'honnêteté qui coûte** : oui, vos chiffres sont hébergés chez un prestataire, et non, nous ne
proposons pas d'installation sur un serveur qui vous appartient. Si c'est une condition pour vous,
nous ne sommes pas le bon produit aujourd'hui.

### 9.14 « Qui va former mon personnel ? Et quand un serveur part, on recommence ? »

**Fondée, et c'est un coût permanent, pas un coût d'installation.** La rotation du personnel est
élevée ; un produit qui exige une formation à chaque recrutement crée une dette qui grandit toute
seule (P10).

**Ce qu'on fait, dans l'ordre.**
1. **On installe avec vous, pendant un vrai service** — pas en salle de réunion, pas par visio.
2. **On reprend votre carte** pour que vous n'ayez rien à saisir (§9.11).
3. **Le produit s'apprend en faisant.** Un mode simulation permet à un nouveau serveur de se
   tromper sans conséquence : les commandes de démonstration ne comptent ni dans la caisse ni dans
   les chiffres (`ANALYTICS.md` §3.4).
4. **La connexion ne doit jamais être un obstacle.** Un code à usage unique par courriel est
   impraticable au coup de feu — *« personne ne va ouvrir sa boîte mail au milieu d'un coup de
   feu »* (*A1*). Le personnel de salle et de cuisine se connecte par **code PIN sur un appareil
   enrôlé par un responsable** : deux secondes, mains occupées, révocable à distance. `[À TRANCHER
   — le PIN de service est conçu au schéma mais non implémenté (A1). Tant qu'il ne l'est pas, ne
   pas l'annoncer.]`
5. **Le support répond sur WhatsApp** aux heures de service, quand la question se pose.

**L'objectif, écrit pour être mesuré, pas pour rassurer** : **un serveur opérationnel en moins de
dix minutes, sans manuel.** `[MESURE — à chronométrer au premier recrutement chez un pilote, et à
publier tel quel, même si le chiffre nous déplaît.]`

### 9.15 « Et la facture normalisée ? Mon comptable me la réclame. »

**Fondée, urgente, et nous n'y répondons pas encore.** En Côte d'Ivoire, la **facture normalisée
électronique (FNE) est obligatoire pour toutes les entreprises, sans exception de régime fiscal,
depuis le 1ᵉʳ décembre 2025**, et **la DGI a lancé des contrôles sur l'ensemble du territoire à
compter du 1ᵉʳ septembre 2026** — c'est-à-dire maintenant. Chaque facture doit être transmise au
système de la DGI, qui lui attribue un numéro normatif, un visuel et un QR code de vérification.

**La réponse honnête, en trois points.**
1. **Nous ne sommes pas raccordés à la DGI aujourd'hui.** Le produit émet un **ticket** destiné au
   client. Les mots « facture » et « reçu » ne figurent nulle part dans l'interface, parce qu'en
   Côte d'Ivoire ils désignent des pièces certifiées — le FNE et le RNE (*D-015*, *D-024*).
   Appeler « facture » ce qui n'en est pas une vous exposerait, vous, pas nous.
2. **C'est une priorité déclarée, pas une option lointaine.** Le module fiscal est conçu comme un
   module de première classe, avec une abstraction par pays (*D-020*). Ce qui bloque est nommable :
   **la spécification technique de l'API FNE n'a pas pu être obtenue** — le portail officiel
   renvoyait une erreur au moment de l'étude. On n'implémente pas une intégration dont on n'a pas
   lu le contrat.
3. **Ce que vous gagnez malgré tout, dès maintenant** : des ventes tracées, attribuées et
   exportables. Un établissement qui peut produire l'historique de ses encaissements est en
   meilleure position face à un contrôle qu'un établissement tenu au carnet.

**Ce qu'on ne dit pas** : « conforme FNE », « certifié DGI », ni une date de disponibilité. `[FNE —
obtenir la documentation d'intégration éditeur auprès de la DGI. C'est un préalable, pas une tâche
de développement (A7). Tant qu'elle n'est pas en main, aucune promesse, aucune échéance.]`

---

## 10. Ce qu'on ne dira pas

Liste opposable. Toute phrase de cette colonne trouvée sur le site, dans une brochure, dans un
message commercial ou dans une publicité est un défaut à corriger, au même titre qu'un bogue.

### 10.1 Les affirmations interdites

| Ce qu'on serait tenté d'écrire | Pourquoi c'est interdit |
|---|---|
| « Fonctionne **100 %** hors-ligne » · « Vos appareils continuent à se synchroniser sans internet » · « Le service continue quand la 4G tombe » | **Faux en l'état.** La synchronisation entre appareils sans internet n'est pas livrée (*A8*). L'écrire, c'est *« le mode hors-ligne en trompe-l'œil »* que l'étude classe parmi les pratiques à ne jamais copier — une promesse qui se brise au pire moment. **C'est l'interdit le plus important de cette liste.** |
| « Conforme FNE » · « Certifié DGI » · « Facture normalisée » | La spécification technique de l'API FNE **n'a pas pu être lue** — le portail renvoyait HTTP 503 (*A7*, *D-020*). On ne promet pas une intégration dont on n'a pas vu le contrat. Et le mot « facture » est banni de l'interface (*D-015*). |
| « Augmentez votre chiffre d'affaires de X % » · « Réduisez le vol de Y % » · « Économisez Z FCFA par mois » | Aucune mesure. Aucun client. Ces chiffres n'existent pas. |
| « Plus de 200 restaurants nous font confiance » | Faux aujourd'hui. Et quand ce sera vrai, ce sera le nombre exact, à une date. |
| « Noté 4,9/5 » · étoiles dans les résultats de recherche | Aucun avis réel. Le balisage `SoftwareApplication` avec note est explicitement écarté tant que de vrais avis n'existent pas (`seo-strategy.md` §6.6). |
| « L'IA analyse vos ventes et prédit vos ruptures » | L'IA n'est qu'un socle en V1 (`PRODUCT.md` §9). Elle ne répond que sur des données déclarées et dit qu'elle ne sait pas sinon (*R28*). Il n'y a rien à vendre. |
| « Le leader » · « la référence » · « la première solution africaine » | Invérifiable, et faux pour au moins l'une des trois. |
| « Installation en 5 minutes » · « Opérationnel en une journée » | Non mesuré. À écrire le jour où on aura chronométré trois installations réelles. |
| « Gratuit », seul | Toujours accompagné de ce qui n'y est pas. Un « gratuit » ambigu produit une déception à l'installation, ce qui coûte plus cher qu'un prospect perdu. |
| « Vos données sont chiffrées de bout en bout » | À n'écrire que si c'est exactement vrai, avec le sens technique du terme. `/securite` dit ce qui est fait, précisément, ou ne le dit pas. |
| « Certifié ISO 27001 » · « Conforme SOC 2 » · « PCI-DSS » | **Aucune certification.** `SECURITY.md` §1 l'énonce déjà comme discipline : *« ne jamais prétendre : certification, chiffrement spécifique, SLA, ISO, SOC2 si cela n'existe pas »*. |
| « Disponibilité garantie à 99,9 % » · tout engagement de niveau de service chiffré | Aucun engagement de disponibilité n'existe. En publier un qu'on ne mesure pas est une faute contractuelle autant qu'un mensonge commercial. |
| « Vos données sont hébergées en Côte d'Ivoire » (ou dans tout autre pays nommé) | **Aucune garantie de localisation des données** n'est donnée aujourd'hui (`SECURITY.md` §1). |
| « Audité par un cabinet de sécurité indépendant » | Aucun audit externe n'a eu lieu. |
| « Moins cher que Toast » · tout comparatif nommant un concurrent | À réserver au moment où l'on peut comparer honnêtement, fonctionnalité par fonctionnalité, avec une date de relevé (`seo-strategy.md` §2.7.3). Aujourd'hui, nous n'avons pas testé leurs produits. |
| « 70 % des transactions passent par Wave » et autres chiffres de marché | Ces chiffres circulent dans des blogs qui se citent les uns les autres. Uniquement avec une source primaire, datée. |
| Tout témoignage, logo, photo d'équipe, nom d'établissement non réel et non consenti | Le socle de ce document. |

### 10.2 Le cas particulier de la page `/fonctionnalites/hors-ligne`

Cette page figure au sitemap validé avec la description :
*« Le service continue quand la 4G tombe. Les commandes se synchronisent dès que le réseau
revient. »*

**La première phrase est trop forte pour ce que le produit tient aujourd'hui.** « Le service
continue » laisse entendre que la chaîne complète — salle, cuisine, caisse — reste fonctionnelle.
C'est faux en voie 1 : les appareils ne se voient pas entre eux hors ligne (*A8*).

**Formulation de remplacement proposée, à appliquer partout :**

> **Titre** : Quand le réseau lâche — [PRODUCT_NAME]
> **Description** : Vos serveurs continuent de saisir, la carte reste consultable, et rien ne se
> perd : tout part dès que le réseau revient. Nous vous disons aussi ce qui ne marche pas.

Et sur la page elle-même, un tableau en deux colonnes — **ce qui marche / ce qui ne marche pas** —
avant tout argument. C'est la page qui doit démontrer notre honnêteté, puisque c'est sur ce sujet
précis que le marché ment.

`[À METTRE À JOUR — la description validée dans seo-strategy.md §3.2 doit être corrigée en ce
sens. Signalé comme désaccord à l'auteur du sitemap.]`

> **Cette liste n'est pas propre au marketing.** `SECURITY.md` §1 pose exactement la même
> discipline pour la page `/securite`, qui doit reprendre **sans l'embellir** la liste de ce que
> nous pouvons affirmer. Les deux documents disent la même chose parce que c'est la même règle :
> *un client qui découvre une affirmation fausse ne revient pas.*

### 10.3 La règle générale

Trois questions avant toute publication d'un chiffre, d'une promesse ou d'une preuve :

1. **Est-ce que c'est vrai aujourd'hui ?** Pas « bientôt », pas « dans la feuille de route ».
2. **Est-ce que je peux le montrer ?** Une capture datée, une source primaire, un client nommé
   qui a donné son accord.
3. **Est-ce que je serais à l'aise de le relire devant le client, six mois après l'installation ?**

Si la réponse à l'une des trois est non : **placeholder, pas approximation.**

---

## 11. Plan de lancement — les 90 premiers jours

### 11.0 Trois verrous à lever avant le jour 1

Ils ne sont pas dans le plan : ils le conditionnent.

| Verrou | Pourquoi bloquant | Qui décide |
|---|---|---|
| **Le nom** | On ne met pas une landing en ligne sous `[PRODUCT_NAME]`. `Joliba` est recommandé, avec `Balani` et `Sabar` en repli ; les domaines ont été mesurés libres, mais **la liberté de marque n'a pas été vérifiée et ne l'est pas sans conseil en propriété intellectuelle** (`naming-study.md` §7). | Décision utilisateur + recherche d'antériorité OAPI |
| **Les entretiens terrain** | Le guide existe, **les entretiens ne sont pas faits**. Aucun article ne part en rédaction sans source de première main, et le prix n'est pas validé sans la question 13. | À planifier immédiatement : 5 gérants, 6 serveurs, 3 caissiers, 4 cuisiniers, 2 barmen, 10 clients |
| **Le marqueur de simulation** | La démonstration ne peut pas être mise en ligne tant que les données de démonstration peuvent polluer la caisse et les analytics (`INFORMATION_ARCHITECTURE.md`, G2). | Décision technique, prérequis de la démonstration |

### 11.1 Qui on cherche comme pilotes

**Cinq à huit établissements. Pas plus.** Au-delà, on ne peut plus être présent à chaque service,
et c'est la présence sur place qui produit la valeur de cette phase.

La composition n'est pas libre : elle doit **couvrir les axes que le produit prétend servir**,
sinon la promesse de configurabilité reste non testée.

| # | Profil recherché | Ce qu'il doit prouver |
|---|---|---|
| 1 | **Maquis, 15–25 tables, forte rotation** (le cas d'Awa) | Le cœur de cible. Mode `staff_only` au départ. |
| 2 | **Maquis ou bar avec une connexion réellement mauvaise** | Vérifie H5 et calibre honnêtement tout le discours hors-ligne (§9.2). **Celui-ci est le plus précieux et le plus inconfortable.** |
| 3 | **Restaurant de table de standing** | Contraintes opposées au maquis : service, partage d'addition, clientèle qui scanne. Mode `guest_with_approval`. |
| 4 | **Fast-food ou food court** | Mode `guest_direct` et `pre_paid` — sinon ces deux modes ne sont jamais éprouvés. |
| 5 | **Bar ou lounge à fort volume de boissons** | Le bar a un tempo différent de la cuisine ; éprouve la scission par station. |
| 6–8 | **Un groupe de 2 à 4 établissements** | Le segment le plus rentable, et le seul qui éprouve la consolidation et les droits par site. **Sans lui, `/solutions/groupes` reste une page sans preuve.** |

**Où les trouver** : le réseau direct d'abord ; les fournisseurs (boissons, viande) qui
connaissent tout le monde ; les comptables de restaurants. **Pas de démarchage à froid** : à ce
stade, un pilote se recrute par une personne qui répond de nous.

### 11.2 Ce qu'on leur demande, et ce qu'on leur donne

**Écrit, signé, court — une page. Et révocable de leur côté à tout moment.**

| On donne | On demande |
|---|---|
| **Six mois gratuits**, puis le tarif public sans rattrapage | Utiliser le produit **en service réel**, pas en test |
| **Reprise complète de la carte** par nous | Un point de 20 minutes par semaine, par téléphone ou WhatsApp |
| **Un interlocuteur joignable** pendant les services, y compris le week-end | Le droit d'**observer un service sur place**, plusieurs fois |
| **Leurs données exportables** à tout moment, y compris s'ils arrêtent | Le droit de publier des **chiffres mesurés** sur leur établissement, anonymisés par défaut |
| Prise en compte prioritaire de leurs demandes | **S'ils le veulent** : un témoignage nominatif et leur logo |

**Deux points de vigilance.**
- **Le témoignage nominatif est optionnel et le reste.** Un gérant peut accepter la mesure et
  refuser son nom ; on n'échange pas six mois gratuits contre une obligation de citation.
- **Six mois gratuits n'est pas un prix.** Un pilote gratuit ne dit rien de la disposition à
  payer. **La validation du prix passe par les entretiens (question 13), pas par les pilotes** —
  ce sont deux enquêtes différentes qu'il ne faut pas confondre.

### 11.3 Ce qu'on mesure, décidé avant de commencer

**La règle** : on relève la valeur **avant** l'installation, sinon il n'y a pas de « avant » et
aucun chiffre ne sera publiable. C'est la seule chose de tout ce plan qui ne se rattrape pas.

| Mesure | Comment | Ce qu'elle alimentera |
|---|---|---|
| **Temps de clôture de caisse**, avant et après | Chronomètre, sur 5 clôtures avant et 5 après, par établissement | L'article « Fermer sa caisse en 10 minutes au lieu de 2 heures » ; le message d'Awa (§2) |
| **Écart de caisse**, avant et après | Relevé quotidien sur 4 semaines avant, 8 semaines après | La promesse centrale du §1. **Le chiffre le plus précieux du projet.** |
| **Taux de scan par table** | Sessions ouvertes ÷ tables servies | L'inconnue du §8.2, qui décide de tout l'investissement sur la boucle de croissance |
| **Délai entre envoi et affichage au passe** | Instrumentation produit | La promesse de vitesse (§2, Ibrahim) |
| **Temps de formation d'un nouveau serveur** | Chronomètre, au premier recrutement | L'objection 9.1 |
| **Temps de reprise d'une carte** | Chronomètre, dès le premier pilote | L'objection 9.11, et la soutenabilité de l'offre de reprise |
| **Commandes réelles par semaine et par établissement** | Instrumentation produit | La *north star* candidate (`ANALYTICS.md` §4.2) |

**Ce qu'on ne mesure pas, et qu'il ne faut pas chercher à mesurer** : l'augmentation du chiffre
d'affaires. Trop de variables, échantillon trop petit, saisonnalité. Toute corrélation trouvée
sur cinq restaurants serait du bruit — et la publier abîmerait notre crédibilité plus qu'elle ne
nous servirait.

### 11.4 Le calendrier

#### Jours 1–30 — poser le terrain, ne rien publier

| | |
|---|---|
| **Terrain** | Les 30 entretiens. Relevés « avant » chez les 3 premiers pilotes. |
| **Produit** | Marqueur de simulation. Démonstration interactive, testée sur un Android d'entrée de gamme réel. |
| **Site** | `/` et `/tarifs` uniquement, plus les pages juridiques. **Rien d'autre.** |
| **Décision** | Le nom tranché et la recherche d'antériorité lancée. |
| **Ce qu'on ne fait pas** | Publier un blog, ouvrir les pages marché, recruter des revendeurs, faire de la publicité payante. |

**Pourquoi si peu de pages.** Publier douze pages sans preuve, c'est douze pages à réécrire dans
six semaines. Et une page marché qui ne coche pas trois critères est interdite (§6.3).

#### Jours 31–60 — installer, observer, corriger

| | |
|---|---|
| **Terrain** | 5 à 8 pilotes installés. Au moins deux services observés sur place par établissement. |
| **Site** | `/fonctionnalites/*` pour les fonctions **livrées** uniquement. `/solutions/maquis` et `/solutions/restaurant`. `/securite`. `/a-propos` avec de vrais noms. |
| **Contenu** | Le premier pilier, `/guides/encaissement-mobile-money-restaurant` — écrit à partir des entretiens, pas avant. |
| **Mesure** | Premiers « après » : clôture de caisse, taux de scan. |
| **Ce qu'on ne fait pas** | Publier un témoignage avant d'avoir un accord écrit. Ouvrir les pages Sénégal, Bénin, Cameroun. |

#### Jours 61–90 — remplacer les placeholders par des preuves

| | |
|---|---|
| **Preuves** | Premiers témoignages nominatifs. Premiers chiffres mesurés. **Chaque placeholder de ce document est repris un par un : rempli, ou maintenu.** |
| **Site** | Le bandeau de logos remplace le bandeau de faits — **si et seulement si** quatre établissements ont donné leur accord. `/clients`. `/integrations/wave` si l'intégration est livrée. |
| **Croissance** | Activation du menu public chez les pilotes, mesure du trafic de marque. Parrainage ouvert aux pilotes. |
| **Commercial** | Premiers rendez-vous sortants sur le segment groupe, avec une démonstration bâtie sur des données pilotes réelles. |
| **Prix** | Confirmation ou correction de l'ancre du §7.3 à partir des entretiens. |
| **Ce qu'on ne fait pas** | Recruter des revendeurs (pas avant cinq clients directs stables, §8.5). Publier une « étude de marché » sur huit restaurants. |

### 11.5 Ce qui déclenche un arrêt

Trois signaux qui doivent suspendre l'expansion commerciale plutôt que l'accélérer.

1. **Un pilote cesse d'utiliser le produit en service.** Le nombre de comptes ne veut rien dire :
   la mesure est « des commandes réelles cette semaine ». Un pilote silencieux est l'information
   la plus importante qu'on puisse recevoir, et elle doit être traitée avant d'en installer un
   sixième.
2. **Le personnel contourne l'outil** — on retrouve le carnet à côté du téléphone. C'est le mode
   d'échec numéro un ; il se corrige dans le produit, pas dans l'argumentaire.
3. **Un écart de caisse inexpliqué apparaît à cause de nous.** La confiance perdue ne revient pas.
   Tout s'arrête jusqu'à ce que ce soit compris.

---

## 12. Récapitulatif des placeholders à remplacer

Chaque ligne est une promesse faite au document, pas une intention.

| # | Placeholder | Où | Ce qui le remplace | Quand |
|---|---|---|---|---|
| 1 | Témoignages (gérante, serveur, caissière) | §2, §4 sect. 2 | Citations nominatives, accord écrit | J61–90 |
| 2 | Bandeau de logos clients | §4 sect. 2 | 4 établissements consentants, minimum | J61–90 |
| 3 | Chiffre de clôture de caisse avant/après | §2, §11.3 | Mesure sur 3 pilotes, 4+8 semaines | J61–90 |
| 4 | Écart de caisse avant/après | §2, §11.3 | Idem | J90+ |
| 5 | Taux de scan réel | §8.2 | Instrumentation produit chez les pilotes | J31–60 |
| 6 | Temps d'affichage de la carte | §2 (Aïcha) | Mesure sur appareil réel bas de gamme | J1–30 |
| 7 | Captures d'écran réelles du produit | §4 sect. 1, 5 | Produit livré, service réel | J1–60 |
| 8 | Photos de plats pour la démonstration | §5.1 | Production ou licence explicite | J1–30 |
| 9 | Section « à propos » | §4 sect. 13 | Noms, visages, ville, téléphone | J31–60 |
| 10 | Validation des prix | §7.3 | 5 entretiens gérants, question 13 | J1–30 |
| 11 | TVA applicable à la restauration | §7.6 | Confirmation d'un conseil fiscal ivoirien | avant tout prix TTC |
| 12 | Taux des opérateurs de paiement | §7.6 | Captures datées des grilles officielles | avant publication |
| 13 | Subventions publiques à la digitalisation (CI, SN, BJ, CM) | §7.7 | Recherche pays par pays | J31–60 |
| 14 | Moyen d'encaissement de notre propre abonnement | §7.7 | Décision produit | J1–30 |
| 15 | Engagement de délai du support | §9.5 | Délai mesuré, puis publié | J61–90 |
| 16 | Temps de reprise d'une carte | §9.11 | Chronométrage sur 3 pilotes | J31–60 |
| 17 | Correction de la description `/fonctionnalites/hors-ligne` | §10.2 | Reformulation validée | avant publication |
| 18 | Facturation à la chambre (hôtels) | §6.2 | Décision sur l'intégration PMS | avant `/solutions/hotel` |
| 19 | Nom du produit | §11.0 | Décision + antériorité OAPI | avant toute mise en ligne |
| 20 | PIN de service sur appareil enrôlé | §9.14 | Décision utilisateur puis implémentation (*A1*) | avant de l'annoncer |
| 21 | Spécification d'intégration FNE (DGI) | §9.15 | Documentation éditeur obtenue auprès de la DGI (*A7*) | préalable, pas une tâche de dev |
| 22 | Temps de formation d'un nouveau serveur | §9.14, §11.3 | Chronométrage au premier recrutement chez un pilote | J61–90 |

---

## 13. Désaccords et points à trancher

Signalés explicitement, conformément à §121 (*« si une décision que je propose est mauvaise :
signale-la »*).

1. **La proposition de valeur du brief est écartée en titre.** « Du scan à l'addition » met le QR
   en tête, ce que *A6* contredit, et range le produit dans la catégorie qu'il refuse. Elle est
   conservée là où elle est juste : décrire le parcours (§3, §4 sect. 5).
2. **La description de `/fonctionnalites/hors-ligne` validée au sitemap sur-promet** par rapport à
   ce que la voie 1 tient. Reformulation proposée au §10.2. **À arbitrer avec l'auteur du sitemap.**
3. **L'arbitrage hors-ligne (*A8*) est un arbitrage marketing autant que technique.** Tant que la
   voie 2 n'est pas décidée, **le meilleur différenciateur identifié par l'étude concurrentielle
   n'est pas vendable.** Ce document est écrit sans lui — et il tient sans lui, mais avec un
   avantage nettement plus mince face aux acteurs locaux qui, eux, fonctionnent déjà en mode
   réseau local.
4. **Le prix de 15 000 FCFA est une ancre construite, pas un prix validé.** Il est bâti sur les
   relevés du §7.1 et sur le choix de ne pas facturer à l'utilisateur. Il doit être confronté au
   terrain avant publication.
5. **Pas de palier intermédiaire entre 0 et 15 000 FCFA.** C'est une décision de positionnement
   assumée (§7.5) et elle coûtera probablement des conversions à court terme. L'alternative —
   vendre une carte QR payante — nous ferait rejoindre la catégorie commoditisée.
6. **La démonstration interactive est un engagement d'ingénierie, pas une page marketing.** Elle
   suppose un marqueur de simulation qui n'existe pas encore dans le modèle de données. **Si ce
   marqueur n'est pas livré, la démonstration ne se met pas en ligne** — c'est le prérequis
   bloquant de toute cette stratégie.

---

*Document de travail. Toute affirmation nouvelle doit citer sa source ou porter un placeholder.*
