# Vérifications de la marque Joliba

> Faites le **2026-09-23**, à la suite de l'adoption du logo (D-059). Trois points étaient ouverts :
> la tenue du logo en noir et blanc, l'antériorité de la marque, et le sens du nom.
> Ce document dit ce qui a été **mesuré**, ce qui a été **lu**, et ce qui **reste à faire par des
> personnes** — un logiciel ne remplace ni un conseil en propriété industrielle, ni un locuteur natif.

## En bref

| Point | Résultat | Suite |
|---|---|---|
| 1. Noir et blanc, ticket de caisse | ✅ **Tient** au-dessus de 32 mm (logo) et 12 mm (vagues seules) | Utiliser `joliba-logo-noir.svg`, jamais en dessous des tailles minimales |
| 2. Antériorité de la marque | 🔴 **Risque élevé** : Orange SA détient **« DJOLIBA »** à l'OAPI (Côte d'Ivoire comprise), en classes 9 et 42 — logiciels et services informatiques — jusqu'en 2030 | **Décision à prendre** (voir §2.4) ; consultation d'un conseil en PI avant tout dépôt ou lancement public |
| 3. Sens du nom | 🟡 **Nuancé** : Jòliba est bien le nom du Niger en bambara ; « le grand fleuve » n'est **pas** la glose du dictionnaire de référence | Dire « le nom mandingue du fleuve Niger », pas « signifie le grand fleuve » ; faire répondre des locuteurs au questionnaire du §3.3 |

---

## 1. Noir et blanc, impression thermique

**Méthode.** Le logo est rendu à partir de son tracé original, réduit à la résolution d'une
imprimante de tickets thermique (203 points par pouce, 8 points par millimètre), puis passé en
**un seul bit** (noir ou blanc, seuil à 50 %, sans tramage) : c'est ce que produit réellement une
imprimante thermique. Résultats : `docs/brand/tests/impression-thermique.png` (chaque carré est un
point de l'imprimante) et un ticket de 58 mm simulé, `docs/brand/tests/ticket-58mm.png`.

| Version | Largeur imprimée | Verdict |
|---|---|---|
| Logo complet | 72 mm, 48 mm, 32 mm | Net : trois vagues distinctes, lettres pleines |
| Logo complet | 20 mm | Nom lisible ; les deux vagues du bas commencent à se toucher |
| Logo + signature | 48 mm | Signature lisible |
| Logo + signature | 32 mm | Signature lisible mais crénelée — **à éviter** |
| Vagues seules | 12 mm | Correct |
| Vagues seules | 8 mm et moins | Les deux vagues du bas se confondent — **à éviter** |

**Règles d'usage.**
- Ticket : `public/brand/joliba-logo-noir.svg`, **32 mm de large au minimum** (256 points), 40 à
  48 mm conseillés sur un rouleau de 58 mm. Le « propulsé par Joliba » en pied de ticket tient à 25 mm.
- Signature « Le service qui coule de source. » : seulement à **48 mm et plus**.
- Vagues seules : **12 mm au minimum** à l'impression. À l'écran, le favicon reste lisible dès
  16 px grâce au lissage — ce que l'imprimante n'a pas.
- Fond sombre : `*-blanc.svg`. Les trois déclinaisons (couleur, noir, blanc) existent pour chaque
  version dans `public/brand/`.

## 2. Antériorité de la marque

### 2.1 Méthode

- **TMview** (réseau de l'EUIPO, 70 offices) : il couvre l'**OAPI**, l'**EUIPO**, l'**USPTO**, l'INPI
  français, l'**OMPI** (enregistrements internationaux de Madrid) et la plupart des offices nationaux.
  Recherche « contient `joliba` », puis les graphies `jeliba`, `djeliba`, `dioliba`, `yoliba`.
- **Global Brand Database de l'OMPI** (89 sources) : recherche du mot `joliba` en contre-vérification.
- Détail de l'enregistrement qui pose problème, lu dans TMview (désignations, décisions des offices).

Ce que cette méthode **ne couvre pas** : les marques non déposées mais exploitées (droits d'usage
antérieurs), les dénominations sociales et noms commerciaux au registre du commerce ivoirien
(RCCM), les noms de domaine, et l'appréciation juridique du risque de confusion — c'est le métier
d'un conseil en propriété industrielle.

### 2.2 Résultats

**`JOLIBA` à l'identique** : une seule marque au monde, française, en classe 3 (cosmétiques),
**expirée en 2014**. Rien de vivant.

**`DJOLIBA`** — c'est là qu'est le problème :

| Office | Marque | Titulaire | Classes | Statut |
|---|---|---|---|---|
| **OMPI (Madrid), n° 1547950** | DJOLIBA | **Orange SA** | **9, 37, 38, 42** | Enregistrée, valable jusqu'au 14/04/2030 |
| ↳ désignation **OAPI** | | | | **Protection accordée le 02/07/2021**, sans limitation |
| ↳ désignations Ghana, Libéria, Maroc | | | | Maroc accordé le 22/02/2024 |
| INPI France, n° 4631742 | DJOLIBA | Orange SA | 9, 37, 38, 42 | Enregistrée (dépôt du 11/03/2020) |
| OAPI | DJOLIBA A.C | Djoliba Athletic Club | 41, 43, 45 | Enregistrée (2020) |
| INPI France | HOTEL RESTAURANT DJOLIBA | Pension El Djoliba SARL | 43 | Enregistrée (2023) |

Orange emploie ce nom pour son réseau de fibre optique panafricain, lancé en 2020 dans huit pays
d'Afrique de l'Ouest, dont la Côte d'Ivoire.

**Autres graphies** : rien de vivant dans nos marchés (un `YOLIBA` en Russie, classe 42 ; un
`JELIBAN` en Russie). Les marques voisines trouvées (`Jolibaby`, `Jolibara`, `Myjolibag`…) sont
d'autres mots, dans d'autres secteurs.

### 2.3 Pourquoi c'est sérieux

- **Mêmes produits** : la classe 9 d'Orange couvre en toutes lettres « logiciels, progiciels,
  logiciels d'applications, logiciels fournis à partir d'Internet » ; la classe 42 couvre les
  services informatiques. Joliba, c'est exactement cela.
- **Même territoire** : la protection est accordée par l'OAPI, donc en Côte d'Ivoire, au Sénégal,
  au Mali, au Burkina Faso… soit tout le marché de lancement.
- **Signes très proches** : `JOLIBA` et `DJOLIBA` ne diffèrent que d'une lettre, se prononcent
  presque pareil (« dj » et « j » se confondent à l'oral), et désignent **la même chose** — le
  fleuve Niger. Proximité visuelle, phonétique et intellectuelle : les trois critères habituels.
- **Le titulaire** : Orange est l'opérateur dominant de la région, avec des moyens juridiques.

La conclusion juridique n'est pas la mienne à donner, mais le risque d'opposition, voire d'action
en contrefaçon, est **élevé** si Joliba est déposé ou exploité en classes 9 et 42 dans l'OAPI.

### 2.4 Les options

1. **Consulter un conseil en propriété industrielle agréé auprès de l'OAPI** avant toute autre
   dépense de marque (dépôt, impression, campagne). Coût faible au regard du risque.
2. **Changer de nom** tant que le produit n'est pas lancé : c'est aujourd'hui le moment le moins
   cher. Les deux replis de l'étude de nommage ont été passés au même crible dans TMview :
   - **Balani** : aucune marque dans l'OAPI ; une marque allemande en classe 9 (« Balani », 2020)
     et une « BALANI COMPUTER » espagnole en classe 35 — à faire examiner, risque faible dans nos marchés ;
   - **Sabar** : aucune marque dans l'OAPI parmi les 100 premiers résultats sur 619 ; un « SABAR »
     chinois en classe 9 — risque faible dans nos marchés, recherche à compléter.
3. **Garder Joliba et négocier une coexistence** avec Orange (accord écrit délimitant les usages).
   Possible, mais long, incertain, et c'est Orange qui fixe les conditions.

Le logo, lui, ne dépend pas du nom au-delà du mot : les vagues se réemploient sous un autre nom.

## 3. Le sens du nom

### 3.1 Ce que dit le dictionnaire de référence

**Bamadaba**, le dictionnaire bambara-français de référence (INALCO / LLACAN, hébergé par
Huma-Num), à l'entrée *Jèliba* :

> **Jèliba** — variantes : *Jòliba ; Bájoliba ; Yálìba ; Yólìba*. **n.prop. TOP, Niger (fleuve).**

Et, pour les éléments du mot :

> **jòli** (variante *jèli*) — n. 1. **sang** ; 2. progéniture ; 3. traits.
> *jèli* — n. **griot**.
> *-ba* — suffixe augmentatif (« grand »).

### 3.2 Ce qu'on peut en dire honnêtement

- ✅ **Jòliba est bien le nom du Niger** en bambara, avec plusieurs graphies. Solide.
- ⚠️ **« Le grand fleuve » n'est pas la glose du dictionnaire.** Le dictionnaire donne le mot comme
  un **nom propre**, sans le traduire. La lecture « grand fleuve » est répandue (Wikipédia, New
  World Encyclopedia…), mais la décomposition visible est *jòli* (sang) + *ba* (grand) — d'où la
  lecture populaire « fleuve de sang », titre d'un roman policier (*Djoliba, fleuve de sang*,
  Actes Sud). La forme *Bájoliba* contient bien *bá*, « fleuve », mais c'est une autre forme.
- **Conséquence pour la communication** : dire « Joliba, le nom mandingue du fleuve Niger », pas
  « Joliba signifie le grand fleuve ». La signature « Le service qui coule de source » ne dépend
  d'aucune des deux lectures : elle tient telle quelle.
- **Question ouverte** : l'écho « sang » est-il perceptible, ou neutre, pour un locuteur ? Pour un
  restaurant, c'est ce qu'il faut savoir. Seul un locuteur peut répondre.

### 3.3 Ce que je ne peux pas faire, et comment le faire vite

Je ne suis pas locuteur natif du bambara, du malinké ou du dioula : aucune recherche ne remplace
leur oreille. Cinq minutes suffisent, avec **trois à cinq personnes** (idéalement : Mali, Guinée,
nord de la Côte d'Ivoire ; au moins une personne qui travaille en restauration). Questionnaire à
envoyer par WhatsApp :

1. Quand vous entendez « Joliba », à quoi pensez-vous en premier ?
2. Comment l'écririez-vous, et comment le prononcez-vous ? (enregistrement vocal bienvenu)
3. Pour vous, le mot évoque-t-il le sang, la violence ou quelque chose de désagréable ?
4. Est-ce un nom que vous trouveriez naturel pour une application utilisée par des restaurants ?
5. Connaissez-vous « Djoliba » comme nom d'une entreprise, d'un club ou d'un produit ? Lequel ?
6. Si vous deviez l'expliquer à un client en une phrase, que diriez-vous ?

## Sources

- TMview (EUIPO) : https://www.tmdn.org/tmview/ — enregistrement international 1547950, fiche
  `WO500000001547950` ; recherche « joliba », consultées le 2026-09-23.
- OMPI, Global Brand Database : https://branddb.wipo.int/ — consultée le 2026-09-23.
- Orange, communiqué sur Djoliba : https://orange.africa-newsroom.com/press/orange-is-strengthening-its-position-as-leader-in-connectivity-in-africa-with-djoliba-the-first-panwest-african-network?lang=en
- Bamadaba, dictionnaire bambara-français : https://cormand.huma-num.fr/lexique/lexicon/j.htm (entrées *Jèliba*, *jòli*, *jèli*) et `b.htm` (*Bájoliba*).
- Wikipédia, *Niger River* : https://en.wikipedia.org/wiki/Niger_River — lecture « great river ».
- Actes Sud, *Djoliba, fleuve de sang* : https://actes-sud.fr/catalogue/romans-policiers/djoliba-fleuve-de-sang
