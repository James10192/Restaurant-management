# Étude de naming — [PRODUCT_NAME]

> Livrable **R6** (§106). Date des vérifications : **2026-09-17**.
> Objet : remplacer « QR Menu Pro », nom qui enferme le produit dans le QR et dans le menu,
> alors que le positionnement visé est **Restaurant Operating System** — coordination temps réel
> entre client, table, serveur, cuisine, bar, caisse, manager, paiement, données et IA.

---

## 1. Recommandation en une page

| | Nom | Pourquoi |
|---|---|---|
| **Principal** | **Joliba** | Mandingue : « le grand fleuve » (le Niger). Métaphore du **flux** qui traverse tout le service. 6 lettres, 3 syllabes, phonétique pure : se dit et s'écrit sans effort en français comme en anglais, et sans piège en Afrique de l'Ouest. Aucune collision logicielle ni restauration trouvée. `joliba.app` et `joliba.africa` **libres au registre** (vérifié deux fois, par deux méthodes). |
| **Repli 1** | **Balani** | Le petit balafon, et le *balani show* malien (la fête de quartier). Rythme + convivialité. `balani.app` et `balani.africa` libres au registre. Réserve : un plugin audio du même nom existe. |
| **Repli 2** | **Sabar** | Le tambour wolof qui **appelle** et rythme la fête. 5 lettres, contient « bar ». Aucune collision trouvée. `sabar.africa` libre ; `sabar.app` pris. |

**Niveau de confiance : moyen-élevé sur la disponibilité des domaines (mesurée), faible sur la
liberté de la marque (non mesurable sans conseil en PI).** Rien dans ce document ne remplace une
recherche d'antériorité OAPI/EUIPO/USPTO — voir §8.

---

## 2. Méthode, et ce qu'elle ne prouve pas

Cette étude distingue trois niveaux d'affirmation. Le brief l'exige : *une étude de naming qui ment
sur la disponibilité fait perdre de l'argent.*

### 2.1 Ce qui a été réellement mesuré

**Domaines — protocole RDAP** (`https://rdap.org/domain/<nom>`, redirections suivies) :
`HTTP 200` = enregistré, `HTTP 404` = non enregistré au registre.

Le protocole a été **calibré sur témoins connus** avant usage, et cette calibration a invalidé
deux TLD :

| TLD | Témoin | Résultat | Verdict |
|---|---|---|---|
| `.com` | `google.com` → 200 / `thisnameisdefinitelynotregistered99xyz.com` → 404 | discriminant | **fiable** |
| `.app` | `cash.app` → 200, `linear.app` → 200 | discriminant | **fiable** |
| `.africa` | `nic.africa` → 200, `google.africa` → 200 | discriminant | **fiable** |
| `.io` | `github.io` → **404**, `status.io` → **404** (or ces domaines existent) | faux négatifs | **NON fiable — aucun `.io` n'est affirmé ici** |
| `.ci` | `nic.ci` → **404** (or ce domaine existe) | faux négatifs | **NON fiable — voir 2.2** |

Un second contrôle croisé a été fait en DNS-over-HTTPS (Cloudflare) : `joliba.app` et
`joliba.africa` répondent `NXDOMAIN`, cohérent avec le RDAP 404. Témoin `orange.ci` → résout
correctement, donc la méthode DNS fonctionne.

⚠️ **« PRIS au registre » ne veut pas dire « inachetable ».** Une large part des noms courts
enregistrés sont parqués et revendables. Cela veut dire : *non disponible gratuitement chez un
registrar*, pas *hors d'atteinte*.

### 2.2 Ce qui n'a pas pu être vérifié, et qu'il ne faut donc pas croire

- **`.ci` (Côte d'Ivoire)** : hors couverture RDAP. Le DNS dit que `joliba.ci`, `balani.ci` et
  `sabar.ci` ne **résolvent pas** — ce qui signifie « non utilisé », **pas** « non enregistré ».
  → **à vérifier auprès du NIC.CI ou d'un registrar accrédité.**
- **`.io`** : méthode invalidée ci-dessus. → **à vérifier auprès d'un registrar.**
- **Marques déposées** : l'API de recherche USPTO refuse les requêtes (`HTTP 405`) ; EUIPO eSearch
  et le portail OAPI sont des applications JavaScript sans API publique interrogeable ici.
  **Aucun dépôt de marque n'est donc affirmé ni nié dans ce document.** Ce qui est rapporté
  ci-dessous, ce sont des **usages commerciaux constatés en recherche web** — ce qui est un signal
  de risque utile, mais n'est pas une recherche d'antériorité.
- **Sens dans les langues ouest-africaines** : les sens donnés proviennent de sources publiques
  citées. Ils n'ont **pas** été validés par des locuteurs natifs. Le brief demande explicitement de
  le dire plutôt que d'affirmer : **c'est dit, et c'est une étape bloquante du §8.**
- **Réseaux sociaux** (handles X/Instagram/LinkedIn) : non vérifiés.

---

## 3. Cadre de naming — six territoires

Le choix d'un territoire est un choix stratégique avant d'être esthétique : il décide de ce que la
marque raconte, et de ce qu'elle interdit plus tard.

### T1 — Hospitalité ouest-africaine (mot culturel réel)
*Akwaba, Teranga, Alafia, Diatigui, Jokko.*
**Raconte** : « recevoir » — le cœur même du métier, dans la langue du marché premier.
Chaleur immédiate, appropriation locale instantanée.
**Risque, et il est rédhibitoire ici** : ce sont des **salutations du domaine public**. Personne
ne peut les posséder, et tout le monde les utilise déjà. La recherche le confirme brutalement
(§5.1). Un nom que le client confond avec dix autres enseignes n'est pas une marque.

### T2 — Flux, fleuve, géographie
*Joliba, Bandama, Comoé, Sassandra.*
**Raconte** : ce qui **circule** — commandes, plats, encaissements, données. C'est exactement la
promesse d'un OS : un flux ininterrompu entre des postes qui, aujourd'hui, se crient dessus.
**Risque** : la métaphore est indirecte, elle demande une ligne d'explication. En revanche elle
vieillit très bien et ne se périme pas si le produit sort de la restauration.

### T3 — Rythme, instrument, coordination
*Kora, Balani, Sabar, Rondo, Cadence, Tempo.*
**Raconte** : le **coup de feu**. Un service, c'est un tempo tenu par des gens différents qui
doivent tomber juste ensemble — la définition d'un orchestre.
**Risque** : territoire très fréquenté par la tech (Cadence, Tempo, Pulse sont pris et défendus).
Et l'instrument le plus évident, la kora, est déjà une fintech panafricaine majeure (§5.1).

### T4 — Le vocabulaire du métier
*Couvert, Convive, Tablée, Salle, Passe, Mise.*
**Raconte** : la crédibilité métier. « Un couvert » est **l'unité économique du restaurant** ;
« la passe » est le point exact où cuisine et salle se rencontrent. Un restaurateur se sent
immédiatement compris.
**Risque** : ces mots sont français et **ne franchissent pas l'anglais**. « Couvert » se lit
*covert* (= secret, dissimulé) par un anglophone — un contresens désastreux pour un produit qui
vend la transparence. « Salle » est imprononçable hors du français. Et ces mots sont indisponibles
parce qu'ils appartiennent à tout le monde.

### T5 — Abstrait court, inventé
*Couvra, Ovento, Servia, Covia, Kovi, Tavio, Relia, Nakoa, Salako.*
**Raconte** : rien — et c'est le but. Le sens est versé par le produit, pas emprunté.
C'est la seule famille où l'on peut espérer un `.com` exact et une marque défendable.
**Risque** : fadeur. Un nom sans histoire coûte plus cher en marketing pour exister, et se
confond avec les centaines de SaaS en `-ia`/`-io`. Il faut qu'il **sonne** quelque part.

### T6 — Composé explicite
*TableOS, ServiceOS, Covers, Tavola.*
**Raconte** : la catégorie, sans ambiguïté. Zéro coût de pédagogie.
**Risque** : **non appropriable** (descriptif = refus de marque probable), et surtout le même
piège que « QR Menu Pro » — on remplace une prison (le QR) par une autre (la table). À écarter par
construction.

**Conclusion de cadrage.** T1 et T4 sont séduisants et perdants : ils décrivent parfaitement le
métier mais ne peuvent pas être possédés. T6 rejoue l'erreur qu'on corrige. **T2 et T3 offrent le
meilleur compromis** : ancrage ouest-africain audible, métaphore compatible « OS », et des mots
assez rares pour être appropriables. T5 sert de filet de sécurité.

---

## 4. Les 36 candidats

**Légende des notes (chacune /5)** — **C** court & mémorable · **P** prononçable FR *et* EN ·
**A** facile à dire et écrire en Afrique francophone · **O** hors-QR / hors-menu / compatible « OS » ·
**D** disponibilité (domaine mesuré + appropriabilité de marque estimée). **T** = total /25.

**Statuts domaine** : `L` = libre au registre (RDAP 404, vérifié 2026-09-17) · `P` = pris (RDAP 200) ·
`—` = non vérifié.

> ⚠️ Lorsque la colonne domaine vaut `—`, la note **D** est une **estimation** fondée sur la rareté du
> mot et les usages commerciaux constatés, **pas sur une mesure**. Ces candidats n'ayant pas atteint la
> shortlist, ils n'ont pas été mesurés. Aucune décision ne doit s'appuyer sur leur note D.

### T1 — Hospitalité ouest-africaine

| # | Nom | Sens / histoire | Pron. FR | Pron. EN | Lg | `.com`/`.app`/`.africa` | Risque de confusion | C | P | A | O | D | **T** |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 1 | **Akwaba** | « Bienvenue » en akan/baoulé (CI, Ghana) | a-kwa-ba | ah-KWAH-ba | 6 | P / **P** / **P** | **Très élevé** : eau minérale, bière, hôtel 60 Md FCFA, agence web, app CAN 2024, échangeur d'Abidjan | 4 | 5 | 5 | 3 | **1** | **18** |
| 2 | **Teranga** | « Hospitalité » en wolof (SN) | té-ran-ga | teh-RAHN-ga | 7 | P / **P** / **P** | **Très élevé** : ≥ 5 sociétés tech sénégalaises + Teranga Software (Paris) + Teranga Gold | 3 | 5 | 5 | 3 | **1** | **17** |
| 3 | **Alafia** | « Paix / bien-être », yoruba-fon *(sens non validé par natif)* | a-la-fia | ah-LAH-fee-ah | 6 | P / **P** / **P** | Élevé : usage courant comme salutation et nom d'enseigne | 3 | 4 | 5 | 2 | **1** | **15** |
| 4 | **Diatigui** | « L'hôte qui reçoit », bambara *(non validé)* | dia-ti-gui | *imprononçable* | 8 | P / — / — | Moyen | 1 | 1 | 4 | 4 | 2 | **12** |
| 5 | **Jokko** | « Lien / connexion », wolof *(non validé)* | jo-ko | JOH-koh | 5 | P / — / — | Élevé : Jokkolabs, Jokko Initiative (Orange SN) | 4 | 4 | 5 | 4 | 2 | **19** |

### T2 — Flux / fleuve

| # | Nom | Sens / histoire | Pron. FR | Pron. EN | Lg | `.com`/`.app`/`.africa` | Risque de confusion | C | P | A | O | D | **T** |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 6 | **Joliba** ★ | « Le grand fleuve » — le Niger, en mandingue/bamanan | jo-li-ba | joh-LEE-ba | 6 | P / **L** / **L** | **Faible** : une association caritative britannique (Joliba Trust) ; club de foot malien orthographié *Djoliba* | 5 | 5 | 5 | 5 | **4** | **24** |
| 7 | **Bandama** | Fleuve ivoirien | ban-da-ma | ban-DAH-ma | 7 | — | Moyen : nasale « an » fragile en anglais | 3 | 3 | 5 | 4 | 3 | **18** |
| 8 | **Comoé** | Fleuve ivoirien | ko-mo-é | *accent perdu* | 5 | — | Moyen : l'accent disparaît à l'écrit/URL | 4 | 2 | 4 | 4 | 3 | **17** |
| 9 | **Sassandra** | Fleuve ivoirien | sa-san-dra | sa-SAN-dra | 9 | — | Faible mais **trop long** | 1 | 3 | 4 | 4 | 3 | **15** |
| 10 | **Sahel** | Bande sahélienne | sa-hel | sa-HEL | 5 | — | **Élevé** : connotation sécuritaire/crise | 4 | 4 | 5 | 2 | 2 | **17** |

### T3 — Rythme / instrument

| # | Nom | Sens / histoire | Pron. FR | Pron. EN | Lg | `.com`/`.app`/`.africa` | Risque de confusion | C | P | A | O | D | **T** |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 11 | **Kora** | Harpe-luth mandingue, 21 cordes | ko-ra | KOH-ra | 4 | P / — / — | **Rédhibitoire** : *Kora* (ex-Korapay), infrastructure de paiement panafricaine — **même secteur que notre module paiement** | 5 | 5 | 5 | 5 | **0** | **20** |
| 12 | **Balani** ★ | Petit balafon ; *balani show* = la fête de quartier malienne | ba-la-ni | ba-LAH-nee | 6 | P / **L** / **L** | Faible-moyen : plugin audio « Balani » (Acousticsamples) | 4 | 5 | 5 | 4 | **4** | **22** |
| 13 | **Sabar** ★ | Tambour wolof qui **appelle** au rassemblement | sa-bar | sa-BAR | 5 | P / P / **L** | **Faible** : aucun usage logiciel trouvé | 5 | 5 | 5 | 4 | **3** | **22** |
| 14 | **Rondo** | Forme musicale où le thème revient | ron-do | RON-doh | 5 | P / P / **L** | Moyen : mot international très employé | 5 | 5 | 4 | 3 | 2 | **19** |
| 15 | **Cadence** | Le tempo tenu du service | ka-dence | KAY-dence | 7 | P / — / — | **Élevé** : Cadence Design Systems (cotée), Cadence Bank | 3 | 4 | 4 | 4 | **1** | **16** |
| 16 | **Tempo** | Le rythme | tem-po | TEM-poh | 5 | P / — / — | **Élevé** : saturé (télécoms, SaaS, énergie) | 5 | 5 | 4 | 3 | **1** | **18** |
| 17 | **Djembe** | Tambour mandingue | djem-bé | JEM-bay | 6 | — | Moyen : « dj » + accent final instable | 4 | 3 | 5 | 3 | 3 | **18** |

### T4 — Vocabulaire du métier

| # | Nom | Sens / histoire | Pron. FR | Pron. EN | Lg | `.com`/`.app`/`.africa` | Risque de confusion | C | P | A | O | D | **T** |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 18 | **Couvert** | **L'unité économique** du restaurant : « 300 couverts ce soir » | kou-vère | ⚠ *covert* = secret | 7 | P / P / **L** | **Élevé** : contresens anglais direct | 4 | **1** | 4 | 5 | 2 | **16** |
| 19 | **Convive** | Le client à table, celui qui partage le repas | kon-vive | con-VEEV | 7 | P / P / **L** | **Élevé** : Convive Brands (70+ restaurants, NY) et Convive Hospitality Consulting (TX) — **même industrie** | 3 | 3 | 3 | 4 | **1** | **14** |
| 20 | **Couvra** ★ | Forgé depuis « couvert », terminaison ouverte | kou-vra | koo-VRAH | 6 | P / **L** / **L** | Faible | 4 | 3 | 4 | 4 | **4** | **19** |
| 21 | **Tablée** | La tablée, le groupe qui mange ensemble | ta-blée | *accent perdu* | 6 | — | Moyen | 3 | 2 | 3 | 3 | 3 | **14** |
| 22 | **Salle** | « La salle », par opposition à la cuisine | sal | *imprononçable* | 5 | P / — / — | Élevé | 4 | **1** | 4 | 3 | 1 | **13** |
| 23 | **Passe** | « La passe » : le point exact cuisine ↔ salle | pass | pass (générique) | 5 | P / — / — | **Élevé** : mot générique, non appropriable | 4 | 4 | 4 | 5 | **1** | **18** |
| 24 | **Mise** | *Mise en place* — la discipline de préparation | mize | meez | 4 | P / — / — | Moyen : en français seul, « mise » = pari | 5 | 3 | 3 | 4 | 1 | **16** |
| 25 | **Tablio** | « Table » + terminaison SaaS | ta-bli-o | TAB-lee-oh | 6 | P / P / **L** | Moyen : **re-enferme dans la table** (piège « QR Menu Pro ») | 4 | 4 | 4 | 2 | 3 | **17** |
| 26 | **Konvi** | Contraction de « convive » | kon-vi | KON-vee | 5 | P / P / **L** | Moyen | 4 | 4 | 4 | 3 | 3 | **18** |

### T5 — Abstrait court, inventé

| # | Nom | Sens / histoire | Pron. FR | Pron. EN | Lg | `.com`/`.app`/`.africa` | Risque de confusion | C | P | A | O | D | **T** |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 27 | **Ovento** | Forgé, sonorité latine ouverte | o-ven-to | oh-VEN-toh | 6 | P / **L** / **L** | Faible | 4 | 4 | 4 | 4 | **4** | **20** |
| 28 | **Servia** | Racine « servir » | ser-via | SER-vee-ah | 6 | P / P / **L** | Moyen : très proche de *Servia/Serbia* | 4 | 4 | 4 | 3 | 3 | **18** |
| 29 | **Covia** | Forgé, « co- » comme coordination | ko-via | KOH-vee-ah | 5 | P / P / **L** | Moyen : proximité phonétique avec « covid » | 4 | 4 | 4 | 3 | 2 | **17** |
| 30 | **Kovi** | Forgé, très court | ko-vi | KOH-vee | 4 | P / P / **L** | Moyen : même réserve « covid » | 5 | 4 | 5 | 3 | 3 | **20** |
| 31 | **Tavio** | « Table » latinisée | ta-vio | TAH-vee-oh | 5 | P / P / **L** | Faible-moyen | 4 | 4 | 4 | 3 | 3 | **18** |
| 32 | **Relia** | Racine « relier » | ré-lia | ruh-LEE-ah | 5 | P / P / **L** | Moyen : proche de *Relia*ble, très employé | 4 | 4 | 4 | 4 | 2 | **18** |
| 33 | **Nakoa** | Forgé (par ailleurs hawaïen) | na-ko-a | na-KOH-ah | 5 | P / **L** / **L** | **Élevé** : Nakoa Technologies, Nakoa Tech, **marque USPTO Nakoa Analytic Solutions** | 5 | 5 | 5 | 4 | **1** | **20** |
| 34 | **Salako** | Prénom/patronyme yoruba lié à Ọbàtálá | sa-la-ko | sa-LAH-koh | 6 | P / **L** / **L** | **Élevé** : patronyme courant **et référence religieuse** (orisha) — récupération commerciale délicate | 4 | 5 | 5 | 3 | **2** | **19** |
| 35 | **Cadi** | Forgé — mais « cadi » = juge musulman | ka-di | KAH-dee | 4 | P / P / **L** | **Élevé** : connotation religieuse/judiciaire | 5 | 4 | 5 | 2 | 2 | **18** |
| 36 | **Tavola** | « Table » en italien | ta-vo-la | ta-VOH-la | 6 | P / P / **L** | **Élevé** : omniprésent en restauration | 4 | 5 | 4 | 2 | 2 | **17** |

### Noms écartés d'emblée (T6 et divers)

| Nom | Motif d'exclusion immédiate |
|---|---|
| **TableOS**, **ServiceOS**, **Covers** | Descriptifs → marque difficilement défendable, **et rejouent l'enfermement** qu'on corrige |
| **Presto** | Presto Automation (IA pour drive-thru) + PrestoDB — collision sectorielle directe |
| **Sika** | « Or/argent » en akan, mais Sika AG est un groupe suisse coté majeur |
| **Wari** | Opérateur de transfert d'argent majeur en Afrique de l'Ouest |
| **Baobab** | Baobab Group, microfinance présente dans plusieurs pays francophones |
| **Bolo** | En argot français, « bolos » = imbécile |
| **Yako** | En mooré (Burkina), s'emploie comme condoléances |
| **Maquis** | Parfait en CI (l'éatterie populaire), mais en France = résistance/broussailles, et illisible en anglais |
| **Gbaka**, **Woro-woro** | Trop locaux, « gb » infranchissable en anglais, connotation de désordre |
| **Kibo** | **KiboERP** est déjà un logiciel de caisse restaurant pour l'Afrique de l'Ouest |

---

## 5. Ce que la vérification a réellement changé

### 5.1 Trois éliminations qui n'étaient pas prévisibles sans chercher

1. **Kora → éliminé.** C'était, sur le papier, le meilleur nom du lot : 4 lettres, l'instrument
   mandingue le plus connu au monde, 21 cordes jouées ensemble — la métaphore exacte d'un OS qui
   coordonne. Mais *Kora* (anciennement Korapay) est une **infrastructure de paiement panafricaine**
   ([korahq.com](https://www.korahq.com/)). Notre produit encaisse de l'argent en Afrique. La
   collision n'est pas lointaine, elle est frontale.
2. **Akwaba et Teranga → déclassés.** Les deux noms « évidents » du territoire hospitalité sont
   **déjà pris de partout** : Akwaba est une eau minérale, une édition de bière, un projet hôtelier
   de 60 milliards FCFA, une agence web (`akwaba-digital-ci.com`), une app de la CAN 2024 et un
   échangeur d'Abidjan ; Teranga compte au moins cinq sociétés tech sénégalaises plus un éditeur
   parisien. `.app` et `.africa` sont pris pour les deux. **Une salutation du domaine public ne
   devient pas une marque.**
3. **Convive → déclassé.** Sémantiquement idéal, mais **Convive Brands** exploite plus de 70
   restaurants aux États-Unis et **Convive Hospitality Consulting** opère au Texas. Même industrie.

### 5.2 Le paysage concurrentiel francophone dicte une posture

Les acteurs existants en Afrique francophone se nomment **par la fonction** : *iPOS Sénégal*,
*Sen-caisse*, *DIAM POS*, *Velko POS*, *KiboERP*, *Mybe*, et **Zeat** (CI — menu QR + paiement Wave,
le concurrent le plus proche de l'ancien positionnement).

Deux enseignements :
- Le terrain « POS / caisse / ERP » est **encombré et interchangeable**. Y ajouter un nom
  descriptif, c'est disparaître.
- **Personne n'occupe le registre humain et culturel.** Un nom chaud, court, ouest-africain et
  non technique est un différenciateur immédiat — et cohérent avec un produit qui parle de service
  et d'hospitalité, pas de matériel.

C'est l'argument central en faveur de T2/T3 contre T5 : un nom inventé neutre serait défendable
juridiquement mais **rejoindrait la masse**.

---

## 6. Shortlist — 7 finalistes

### 6.1 Joliba ★ — recommandé

- **Ce qui tient.** « Le grand fleuve » (le Niger) en mandingue — langue-pont du Mali, de la Guinée,
  du Sénégal et du nord de la Côte d'Ivoire. La métaphore est juste : un service, c'est un **flux**
  qui ne doit jamais s'interrompre entre la table, la cuisine, le bar et la caisse. Six lettres,
  trois syllabes, aucun accent, aucune lettre double, aucune graphie piégeuse — on l'écrit comme on
  l'entend, ce qui est exactement le critère « Afrique francophone ». `jo-li-ba` en français,
  `joh-LEE-ba` en anglais : **aucune déformation entre les deux langues**.
- **Disponibilité mesurée (2026-09-17)** : `joliba.app` **libre**, `joliba.africa` **libre**
  (RDAP 404 + NXDOMAIN, deux méthodes concordantes). Replis `.com` **tous libres** :
  `getjoliba.com`, `jolibahq.com`, `usejoliba.com`, `jolibaos.com`, `joliba-app.com`.
  `joliba.com` est pris. `joliba.ci` ne résout pas — **statut d'enregistrement à vérifier au NIC.CI**.
- **Ce qui cloche.** (a) **Djoliba AC** est l'un des deux grands clubs omnisports du Mali : à Bamako,
  le mot évoquera d'abord le football. L'orthographe *Joliba* (sans D) écarte partiellement la
  confusion, sans l'annuler. (b) Le **Joliba Trust** est une association caritative britannique
  enregistrée (n° 1059919) active au Mali — secteur et classes différents, risque faible mais à
  faire confirmer. (c) Le sens est **opaque pour un acheteur européen ou nord-américain** : il faudra
  toujours une demi-phrase d'explication. (d) Une oreille française entendra « joli » dans *Joliba* —
  connotation douce et plutôt favorable, mais elle adoucit un produit d'exploitation.
- **Tagline.** *« Le flux de votre service. »* — variante anglaise : *« Every service, in flow. »*
- **Vieillissement hors restauration.** **Excellent.** Un fleuve ne dit ni « table », ni « menu », ni
  « restaurant ». Le nom supporte sans rupture une extension vers l'hôtellerie, les bars, la
  livraison, le retail alimentaire — voire toute activité de flux opérationnel.
- **Logotype.** Minuscules, sans empattement (Geist Sans / Inter Tight), graisse Medium, interlettrage
  légèrement négatif. Le point du `i` peut se muer en une goutte ou en un léger méandre horizontal
  sous le mot — un trait, pas un dessin. Le double `a`/`o`/`i`/`a` donne un rythme visuel régulier
  qui se tient bien en petit (favicon, écran de cuisine, ticket thermique).

### 6.2 Balani ★ — repli 1

- **Ce qui tient.** Le petit balafon — et surtout le *balani show*, la fête de quartier malienne où
  l'on danse dehors jusqu'au matin. Le nom porte donc **deux couches** : l'instrument (coordination,
  lames frappées ensemble) et la convivialité nocturne (exactement la clientèle maquis/bar/restaurant).
  `ba-la-ni` : trois syllabes ouvertes, identiques en français et en anglais.
- **Disponibilité mesurée** : `balani.app` **libre**, `balani.africa` **libre**. `getbalani.com` et
  `balanihq.com` libres. `balani.com` pris. `.ci` non vérifiable.
- **Ce qui cloche.** Un **plugin audio « Balani » (Acousticsamples)** existe — c'est du logiciel, donc
  une classe potentiellement voisine, même si le secteur (production musicale) n'a rien à voir.
  Par ailleurs la connotation « fête » peut sembler légère pour vendre un outil de gestion à un
  directeur financier.
- **Tagline.** *« Le service, en rythme. »*
- **Vieillissement.** Bon. Reste valable pour bars, clubs, événementiel ; un peu moins naturel pour
  de la restauration collective ou d'entreprise.
- **Logotype.** Bas-de-casse, graisse Semibold, largeur légèrement condensée. Les trois jambages
  `l`/`n`/`i` alignés évoquent les lames d'un balafon sans qu'on ait à les dessiner ; un simple
  alignement de trois traits d'épaisseurs croissantes suffit comme marque secondaire.

### 6.3 Sabar ★ — repli 2

- **Ce qui tient.** Le tambour wolof qui **convoque** : au Sénégal, le sabar annonce l'événement
  avant de le rythmer. Pour un produit dont le cœur est la notification temps réel entre postes,
  la métaphore est directe. Cinq lettres, deux syllabes, **contient littéralement « bar »** —
  un clin d'œil utile. Aucun usage logiciel ou restauration trouvé en recherche.
- **Disponibilité mesurée** : `sabar.africa` **libre** ; `sabar.app` **pris** ; `sabar.com` pris ;
  `getsabar.com` et `sabarhq.com` libres.
- **Ce qui cloche.** `.app` indisponible réduit les options d'une marque produit. Proximité
  phonétique avec l'arabe *ṣabr* (« patience ») — bénin, voire flatteur, mais c'est une lecture
  parasite en zone sahélienne. Enfin, hors Sénégal/Gambie, le mot n'évoque rien de précis.
- **Tagline.** *« Quand ça appelle, tout le monde entend. »*
- **Vieillissement.** Correct. Neutre vis-à-vis de la restauration, donc extensible ; mais moins
  évocateur que Joliba une fois sorti du champ « appel/notification ».
- **Logotype.** Capitales basses ou petites capitales, graisse Bold, très serré. Mot court et
  symétrique (`s-a-b-a-r`) : il supporte un traitement typographique appuyé, sans ornement.

### 6.4 Couvra — l'option enracinée dans le métier français

- **Ce qui tient.** Forgé depuis **« couvert »**, l'unité de compte du restaurateur. Le clin d'œil
  est immédiat pour un professionnel francophone, et la forme inventée est **appropriable**, ce que
  « Couvert » n'est pas. `couvra.app` et `couvra.africa` sont **tous deux libres**.
- **Ce qui cloche.** La suite `ou-vr` reste inconfortable pour un anglophone (`koo-VRAH`), et le nom
  n'existe dans aucune langue : il faudra tout lui donner. Il traîne aussi, de loin, l'ombre de
  *covert*.
- **Tagline.** *« Chaque couvert, maîtrisé. »*
- **Vieillissement.** Moyen — la racine renvoie au repas, donc l'extension hors restauration
  demanderait un effort.
- **Logotype.** Bas-de-casse, empattements fins (Fraunces, Source Serif) pour assumer l'origine
  française et le registre table ; le `v` central peut porter une légère accentuation.

### 6.5 Couvert — pourquoi il est écarté malgré son évidence

Le meilleur nom métier possible en français, et **injouable en anglais** : *covert* signifie
« secret, dissimulé ». Vendre la transparence opérationnelle sous un nom qui dit « caché » est une
faute de positionnement, pas un détail. `couvert.africa` est libre, `.app` et `.com` sont pris, et
le mot appartient de toute façon au domaine public. **Tagline** qu'on perd, et elle était bonne :
*« On compte en couverts. »* — **Logotype** : serif classique, très haut de gamme. À conserver
éventuellement comme **nom de fonctionnalité** (le module de comptage des couverts), pas comme marque.

### 6.6 Convive — écarté pour collision d'industrie

Sémantiquement juste (celui qui partage le repas), phonétiquement acceptable dans les deux langues.
Mais **Convive Brands** (plus de 70 restaurants, New York) et **Convive Hospitality Consulting**
(Texas) occupent déjà le nom **dans l'hospitalité**. Pour un éditeur qui vendra aux États-Unis,
c'est un risque de marque sérieux, pas une coïncidence lointaine.
**Tagline** perdue : *« Tout tourne autour du convive. »*

### 6.7 Akwaba — écarté pour saturation, à ne pas rouvrir

Le nom que tout le monde proposera en Côte d'Ivoire, et c'est précisément le problème : eau
minérale, bière, complexe hôtelier, agence web, application officielle de la CAN 2024, échangeur
routier d'Abidjan. `.app` et `.africa` pris. **Impossible à posséder, impossible à défendre.**
Chaleureux, immédiat, et sans aucune valeur d'actif.
**Tagline** perdue : *« Bienvenue à table. »*

---

## 7. Recommandation finale

**Nom principal : `Joliba`.** Il est le seul candidat à obtenir 4 ou 5 sur **tous** les critères du
brief simultanément : court, mémorable, identique à l'oreille en français et en anglais, écrit sans
piège par un serveur à Abidjan comme par un investisseur à Paris, totalement libre du QR et du menu,
porteur d'une métaphore (le flux) qui grandit avec l'ambition « OS » au lieu de la brider — et
**seul candidat dont le paquet de domaines a été mesuré libre** sur `.app`, `.africa` et cinq
variantes `.com`.

**Replis, dans l'ordre : `Balani`, puis `Sabar`.** Même territoire culturel, même facilité
d'élocution, disponibilité mesurée voisine. *Balani* si l'on veut assumer la convivialité et la
fête ; *Sabar* si l'on veut assumer l'appel et la coordination — au prix du `.app`.

**Si le conseil en PI bloque les trois** : `Couvra` est le filet, parce qu'il est forgé, donc
défendable, et que ses deux domaines clés sont libres.

### Niveau de confiance, énoncé franchement

| Affirmation | Confiance | Fondement |
|---|---|---|
| `joliba.app` / `joliba.africa` non enregistrés au 2026-09-17 | **Élevée** | RDAP (méthode calibrée sur témoins) + NXDOMAIN concordant |
| `getjoliba.com`, `jolibahq.com`, `usejoliba.com`, `jolibaos.com` non enregistrés | **Élevée** | RDAP `.com`, TLD calibré |
| Aucun éditeur de logiciel restaurant/POS nommé Joliba | **Moyenne** | Recherche web ciblée, absence de résultat — une absence n'est pas une preuve |
| « Joliba » = « grand fleuve » en mandingue | **Moyenne-élevée** | Sources concordantes (Britannica, Wikipédia, Joliba Trust) — **non validé par un locuteur natif** |
| Le nom est **libre de droits** en classes 9/35/42 à l'OAPI, l'EUIPO et l'USPTO | **AUCUNE** | **Non vérifié. Non vérifiable sans conseil en PI.** Voir §8 |
| `joliba.ci` disponible | **AUCUNE** | RDAP ne couvre pas `.ci`. Ne pas le supposer |
| Handles sociaux `@joliba` disponibles | **AUCUNE** | Non vérifié |

---

## 8. Procédure de décision — dans cet ordre, avant de figer

L'ordre compte : chaque étape est moins chère que la suivante et peut l'annuler.

**Étape 1 — Validation linguistique et culturelle (coût ≈ 0, bloquant).**
Faire lire les trois finalistes à des locuteurs natifs de **bambara/malinké, wolof, baoulé, nouchi
ivoirien, ewe et yoruba**, en posant une seule question : *« Ce mot évoque-t-il quelque chose de
désagréable, de grossier, de religieux ou de politique ? »* Cette étude **n'a pas pu faire cette
vérification** et ne doit pas être prise pour elle. Test complémentaire à faire sur le terrain :
dicter le nom au téléphone et vérifier qu'il s'écrit correctement du premier coup.

**Étape 2 — Recherche d'antériorité OAPI (prioritaire).**
La Côte d'Ivoire **n'a pas de dépôt national** : la protection passe par l'**OAPI**, office unique
de **17 États** (Bénin, Burkina Faso, Cameroun, Centrafrique, Comores, Congo, Côte d'Ivoire, Gabon,
Guinée, Guinée-Bissau, Guinée Équatoriale, Mali, Mauritanie, Niger, Sénégal, Tchad, Togo), siège à
Yaoundé, issu de l'Accord de Bangui (1977, révisé en 1999 puis 2015). Un dépôt unique vaut
simultanément dans les 17. Demander la recherche d'antériorité **avant** tout dépôt, en
**classes 9** (logiciel), **35** (gestion commerciale) et **42** (SaaS) — et vérifier l'exposition
en **classe 43** (services de restauration), d'où venaient les collisions *Convive*.
Ordres de grandeur rapportés par des sources spécialisées, **à confirmer auprès d'un mandataire
agréé** : protection 10 ans renouvelable, délai d'enregistrement ≈ 6 mois, délai d'opposition
6 mois après publication au Bulletin officiel, coût de dépôt ≈ 500 000 FCFA.

**Étape 3 — Antériorités EUIPO et USPTO.**
Indispensable si une levée de fonds ou une expansion hors zone OAPI est envisagée. C'est là que
*Nakoa* (marque USPTO constatée) et *Convive* auraient été arrêtés. À confier au même conseil.

**Étape 4 — Réservation défensive des domaines, le jour de la validation juridique.**
Ne pas réserver avant l'étape 2 (on paie pour un nom qu'on peut perdre), ne pas attendre après
(les recherches publiques laissent des traces exploitables par les revendeurs). Panier minimum :
`joliba.app`, `joliba.africa`, `getjoliba.com`, `jolibahq.com`, `usejoliba.com`.
**Faire vérifier en parallèle par le registrar** : `joliba.ci` (via NIC.CI) et `joliba.io`, dont le
statut **n'est pas établi par cette étude**. Tenter une offre sur `joliba.com` s'il est parqué.

**Étape 5 — Handles sociaux.** X, Instagram, LinkedIn, TikTok, GitHub, npm — non vérifiés ici.

**Étape 6 — Décision et remplacement du placeholder.** Une seule PR mécanique (§9).

---

## 9. En attendant — ne pas ralentir l'implémentation (§106)

Le code, les documents et les schémas continuent d'employer le marqueur **`[PRODUCT_NAME]`**, sans
exception. Cette étude **n'est pas bloquante** pour les phases 3 à 8.

Règles à tenir pour que le remplacement final reste une opération triviale :

- Un **seul** littéral, `[PRODUCT_NAME]`, jamais de variante (`ProductName`, `PRODUCT_NAME`,
  `product-name`) — une seule forme se remplace en une commande, cinq formes se remplacent à la main.
- **Aucun nom de table, de champ Convex, de route, de paquet npm, de dépôt, de bucket ou de
  variable d'environnement** ne doit contenir le nom du produit. Ce sont les seuls endroits où un
  renommage coûte une migration plutôt qu'un `sed`.
- Contrôle avant la décision : `grep -rn "QR Menu Pro"` doit rendre **zéro** résultat ;
  `grep -rn "\[PRODUCT_NAME\]"` doit rendre **toutes** les occurrences visibles par l'utilisateur.
- Le nom retenu n'entre dans le dépôt que par **une PR dédiée**, sans autre changement, une fois
  l'étape 4 franchie.

---

## 10. Sources consultées (2026-09-17)

**Disponibilité des domaines** — RDAP via [rdap.org](https://rdap.org/), calibré sur témoins ;
contrôle croisé DNS-over-HTTPS [cloudflare-dns.com](https://cloudflare-dns.com/dns-query).

**Collisions de marques et d'usages**
- Kora / ex-Korapay — [korahq.com](https://www.korahq.com/) · [Wikipedia](https://en.wikipedia.org/wiki/Kora_(Fintech_company))
- Akwaba (usages en Côte d'Ivoire) — [Digital Africa](https://resilient.digital-africa.co/blog/2024/04/10/akwaba-ci-100-made-in-cote-divoire/) · [akwaba-digital-ci.com](https://www.akwaba-digital-ci.com/) · [Sika Finance (projet hôtelier)](https://www.sikafinance.com/marches/cote-d-ivoire-akwaba-un-projet-hotelier-de-60-milliards-fcfa_38117)
- Teranga (sociétés tech) — [teranga-tech.com](https://teranga-tech.com/) · [PitchBook — Teranga Software](https://pitchbook.com/profiles/company/435236-50)
- Convive — [convivehc.com](https://convivehc.com/) · [ZoomInfo — Convive Brands](https://www.zoominfo.com/c/convive-brands/1323327911)
- Nakoa — [uspto.report TM 97829778](https://uspto.report/TM/97829778) · [nakoatech.com](https://www.nakoatech.com/)
- Balani (plugin audio) — [KVR Audio](https://www.kvraudio.com/marketplace/balani-by-acousticsamples)
- Joliba Trust — [Charity Commission n° 1059919](https://register-of-charities.charitycommission.gov.uk/charity-details/?subid=0&regid=1059919) · [jolibatrust.org.uk](https://www.jolibatrust.org.uk/about-us)
- Djoliba AC — [Wikipédia](https://fr.wikipedia.org/wiki/Djoliba_Athletic_Club)

**Sens des noms**
- Joliba / Niger — [Britannica](https://www.britannica.com/place/Niger-River) · [Wikipedia](https://en.wikipedia.org/wiki/Niger_River)
- Balafon / balani show — [Wikipedia](https://en.wikipedia.org/wiki/Balafon) · [Sahel Sounds](https://sahelsounds.com/2014/03/balanishowtakeover/)
- Sabar — [Wikipedia](https://en.wikipedia.org/wiki/Sabar)
- Salako — [YorubaName](https://www.yorubaname.com/entries/Sa%CC%80la%CC%80k%E1%BB%8D%CD%81) · [Wikipedia](https://en.wikipedia.org/wiki/S%C3%A0l%C3%A0k%E1%BB%8D%CC%81)

**Paysage concurrentiel**
- Afrique francophone — [Zeat (CI)](https://zeatapp.com/logiciel-restaurant-cote-divoire/) · [DIAM POS](https://www.diampos.net/) · [Sen-caisse](https://www.sen-caisse.com/) · [KiboERP](https://kiboerp.com/erp/restaurant) · [iPOS Sénégal](https://ipos-sn.com/)
- International — [Forbes Advisor — Best Restaurant POS 2026](https://www.forbes.com/advisor/business/software/best-restaurant-pos-systems/)

**Propriété intellectuelle**
- OAPI — [Direction générale du Trésor (FR)](https://www.tresor.economie.gouv.fr/Pays/CI/la-propriete-intellectuelle-dans-l-espace-oapi) · [EU IP Helpdesk — fiche OAPI](https://intellectual-property-helpdesk.ec.europa.eu/system/files/2021-10/IP%20OAPI%20Fiche_0_0_0.pdf)
