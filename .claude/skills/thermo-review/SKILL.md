---
name: thermo-review
description: Revue thermo-nucléaire d'un diff Joliba — « fallait-il l'écrire, et fallait-il le faire ainsi ? ». Verdict PASS ou BLOCK, en sous-agent, obligatoire avant toute fusion et tout déploiement qui touche du code.
---

# Revue thermo-nucléaire — Joliba

Adaptée de la version KLASSCI (`KLASSCIv2/.claude/skills/thermo-review`), elle-même tirée du
skill `thermo-nuclear-code-quality-review` de
[`cursor/plugins`](https://github.com/cursor/plugins/blob/main/cursor-team-kit/skills/thermo-nuclear-code-quality-review/SKILL.md).
L'ambition et la barre d'approbation sont les mêmes. Ce qui change : la pile (TanStack Start,
React 19, TypeScript strict, Convex, Better Auth, Tailwind v4, shadcn/ui), les sources de vérité
de Joliba, et les détecteurs, tirés des défauts réellement rencontrés de T0 à T7.

## Ce que cette revue cherche — et ce qu'elle ne cherche pas

| Revue | Question posée | Sortie |
|---|---|---|
| `pnpm check` + CI | **Les invariants tiennent-ils ?** Types, gardes, montants, schéma, permissions, tailles, tests | Vert ou rouge |
| Revue adverse (agent `critique-transversale`) | **La décision est-elle la bonne ?** Avant d'écrire | Arbitrages, `D-xxx` |
| **Thermo-nucléaire** | **Fallait-il l'écrire — et fallait-il le faire ainsi ?** Après avoir écrit | **Verdict `PASS` / `BLOCK`** |

La thermo ne remplace ni la CI ni la revue adverse. **Un contrôle qu'une machine applique ne
consomme pas l'attention d'un relecteur** : ce que `pnpm check` refuse déjà (voir « Ce que les
machines vérifient » plus bas), la revue ne le cherche pas — elle vérifie seulement que personne
ne l'a contourné.

> Le défaut le plus coûteux de ce dépôt n'a jamais été un plantage. C'est du code qui s'exécute,
> qui ne lève rien, et qui sert une valeur fausse, à la mauvaise personne, ou à personne.

## L'ambition, avant tout le reste : le coup de judo

C'est l'axe **0**, et il prime sur les autres. Cherche la reformulation qui fait **disparaître**
des branches, des modes, des auxiliaires, des couches — plutôt que celle qui les range mieux. Le
repère : **la bonne solution paraît évidente après coup.**

Sur ce dépôt, le coup de judo prend presque toujours l'une de ces formes :

- **Ça existe déjà.** `grep` avant d'écrire une ligne. `convex/lib/` porte quarante modules : une
  règle métier y a souvent déjà sa fonction.
- **Le canal est déjà là.** Vécu en T7.a : l'aperçu recevait le logo par `postMessage` alors que
  la requête réactive du cadre le portait déjà — un canal, un validateur et un repli supprimés.
- **Le besoin réel était plus petit.** Reformule ce que la proposition cherche à obtenir **sans
  reprendre son vocabulaire**.
- **Le helper canonique existe.** Un auxiliaire fait sur mesure à côté de l'un d'eux est un `BLOCK` :

  | Besoin | Canonique |
  |---|---|
  | Afficher un montant | `formatMoney` (`convex/lib/money.ts`) — seule exception : `formatListDigits`, pour la liste de la carte client (D-166) |
  | Calculer sur un montant | `money`, `add`, `subtract`, `splitEvenly`, `percentOf`, `roundUpToStep` — entiers, exposant dérivé (ADR 0003) |
  | Garder une fonction publique | `requirePermission`, `requireOrganizationMember`, `requireServiceActor`… (`convex/lib/guards.ts`) |
  | Refuser proprement | `invalid`, `forbidden` (`convex/lib/errors.ts`) |
  | Tracer un acte | `writeAudit` (`convex/lib/audit.ts`) |
  | Ce que voit le client | `publicVenue`, `loadPublishedMenus`, `loadLiveAvailability` (`convex/lib/guestMenu.ts`) |
  | Un fichier envoyé par le navigateur | `assertFreshUnusedFiles` (`convex/lib/uploads.ts`) |
  | La couleur d'un restaurant | `resolveBrandColor` (`convex/lib/brand.ts`) ; dans une page client, `brandThemeCss` (`brandTheme.ts`) |
  | Le jour de service | `serviceDayOf`, `dayWindow` (`convex/lib/analytics.ts`, `serviceDay.ts`) |
  | Un geste hors ligne | la file d'envoi (`src/lib/outbox.ts`) et `ageMs` (D-164) |
  | Un bouton qui attend, un champ de formulaire | `PendingButton`, `FormField` (`src/components/app/`) |
  | L'établissement courant et ses droits | `useWorkspace` |

**Une complexité qu'on garde alors qu'un coup de judo visible la supprimerait est un bloquant
présumé**, pas une remarque.

## Quand elle est obligatoire

Avant **toute fusion et tout déploiement** qui touche du code (`.claude/rules/avant-fusion.md`).

**Sur une branche de travail, le commit n'attend pas le verdict.** Le hook de fin de tour exige
un arbre propre et poussé ; faire porter le blocage sur le commit mettrait ces deux exigences en
contradiction. On commit, on dit que la revue tourne, et **le verdict s'applique dans un commit de
suite, avant la fusion**. Ce qui reste interdit : fusionner ou déployer sans `PASS`, et laisser un
`BLOCK` sans correction.

```bash
git fetch origin main
git diff origin/main...HEAD --stat     # la plage à donner au sous-agent
```

Après un `BLOCK` corrigé, **la revue se relance sur le nouveau diff** (la plage des corrections),
et ses constats nouveaux comptent autant que les anciens.

## Exemptions

Quatre cas, et seulement ceux-là : documentation seule ; configuration seule ; suppressions pures ;
diff de **moins de cinq lignes dans un seul fichier**. Une exemption se constate, elle ne se
décide pas. En cas de doute, la revue a lieu.

## Running it yourself, as an agent

En **sous-agent**, pour que le contexte du diff ne pollue pas la session qui vient d'écrire le
code — et surtout pour qu'elle ne soit pas relue par celui qui l'a écrite.

```
Agent(
  subagent_type: "general-purpose",
  description:   "Revue thermo-nucléaire",
  run_in_background: true,
  prompt: <le gabarit ci-dessous, avec la plage réelle>
)
```

### Gabarit de brief

> Tu es un relecteur adverse sur le dépôt Joliba (`/home/user/Restaurant-management`) : un
> logiciel de restaurant multi-établissements pour l'Afrique de l'Ouest francophone — TanStack
> Start, React 19, TypeScript strict, Convex, Better Auth, Tailwind v4, shadcn/ui ; interface en
> français, téléphones d'entrée de gamme, 4G instable.
>
> **Plage à relire :** `git diff <base>...HEAD` (lis le diff ET les fichiers entiers qu'il touche —
> un diff ne montre pas ce qui manque).
>
> Ta question n'est pas « est-ce que ça marche ». C'est **« fallait-il l'écrire, et fallait-il le
> faire ainsi ? »**. Lis en entier `.claude/skills/thermo-review/SKILL.md` avant de commencer, et
> les décisions `D-xxx` de `docs/DECISION_LOG.md` que le diff dit appliquer.
>
> **Commence par l'axe 0 — le coup de judo.** Puis les axes 1 à 15.
>
> Les documents de conception (`PRODUCT.md`, `ARCHITECTURE.md`, `DATA_MODEL.md`, `PERMISSIONS.md`,
> `PAYMENTS.md`, `SECURITY.md`, `DESIGN.md`), les ADR (`docs/adr/`) et les décisions `accepté` de
> `docs/DECISION_LOG.md` font autorité. Contredire une décision acceptée sans la réviser est un
> `BLOCK`.
>
> **Tu as le droit et le devoir d'utiliser :** la recherche internet (axe 9 : toute affirmation
> sur le monde extérieur porte sa source) ; les commandes en lecture seule (`git`, `grep`,
> `pnpm -s typecheck`, `pnpm -s test`, `pnpm -s check`) ; l'agent `critique-transversale` pour un
> second angle sur un parcours entier.
>
> Tu ne démarres ni serveur ni parcours de bout en bout. Pour les axes 10 et 12, **exige la preuve
> plutôt que de la produire** : dis quelle capture (`E2E_SCREENSHOTS`), quel parcours
> (`e2e/tN.spec.ts`) ou quelle mesure (`scripts/measure-guest.mjs`) manque, et sur quel écran.
>
> **Contraintes :** `fichier:ligne` pour chaque constat ; si tu n'as pas lu, ne l'affirme pas. Pas
> d'objection fabriquée : un faux positif apprend à ignorer les verdicts. Peu de constats à forte
> conviction. Tu as le droit de conclure « cette partie est juste, n'y touchez pas ». Lecture
> seule : tu n'écris, ne commites ni ne pousses rien.
>
> **Rends un verdict `PASS` ou `BLOCK`**, puis les constats classés, chacun avec sa correction.

### Si le sous-agent est indisponible

**Dis-le clairement** et fais la revue toi-même contre les mêmes standards. La sauter en silence
n'est jamais acceptable.

---

## Partie A — Ce que le code fait de faux

### 1. Ce qui est écrit et jamais lu

Pour chaque champ, colonne, argument, valeur de retour ou réglage **ajouté**, prouve qu'il a un
lecteur :

```bash
grep -rn "nomDuChamp" convex/ src/ tests/ e2e/ | grep -v _generated
```

Un seul résultat — celui qui l'écrit — est un `BLOCK`. Vécu en T7.a : `branding.get` calculait
`contrast` et `adjusted`, et rien dans `src/` ne les lisait.

Même axe, autre face : **le code non atteint**. Une permission au catalogue sans garde qui la
demande ; une branche d'un validateur que rien n'envoie ; une route que la navigation n'atteint
jamais.

### 2. La seconde source de vérité

Le diff introduit-il un second endroit qui répond à une question déjà répondue ailleurs ? Deux
calculs du même total, deux façons de dire « aujourd'hui » (D-164 les a réunies dans `todayOf`),
un écran qui **recalcule** ce que le serveur a enregistré (T7.a : l'écran Apparence refaisait
`resolveBrandColor` au lieu de relire `resolvedPrimary` — l'écran et la carte en ligne auraient
divergé au premier changement d'algorithme).

Deux sources ne se contredisent pas tout de suite. Elles divergent, et personne ne les compare.

### 3. La valeur en dur

Le test : **deux restaurants peuvent-ils légitimement vouloir une valeur différente ici ?** Si oui,
c'est un réglage d'établissement (`venueSettings`), avec un défaut prudent (`venueDefaults.ts`).
Un taux de taxe, un délai d'abandon, un plafond par ligne, une heure de début de journée : réglages.

**L'argent a ses propres pièges**, tous déjà rencontrés ou évités de justesse :

- **Un `* 100`** sur un montant : le franc CFA a un exposant **0**. Le facteur se dérive
  (`scaleFactor`), il ne s'écrit jamais (ADR 0003, PAYMENTS.md §2).
- **Un montant flottant**, un `Math.round` sur un montant, un montant sans sa devise.
- **Le zéro confondu avec l'absence.** Un prix nul est une valeur (l'eau offerte existe) ; un
  supplément à 0 F n'affiche rien, mais existe.

```bash
grep -nE '\* ?100\b|/ ?100\b|toFixed\(|parseFloat' <fichiers du diff>
grep -nE '\?\?\s*[0-9]|\|\|\s*[0-9]|> 0\b' <fichiers du diff>
```

Chaque `?? 0`, chaque `|| 0`, chaque `> 0` en filtre : **le code veut-il dire « absent » ou « nul » ?**

### 4. Le repli silencieux

Un `catch` vide, un `?? défaut` sur une configuration introuvable, un `return null` qui masque
une erreur, une requête qui s'exécute avant que la session soit établie et affiche « session
expirée » (vécu en T7.a, sur l'aperçu). **Un rattrapage qui dégrade l'affichage doit se voir** :
un état d'erreur explicite, ou un `log` (`convex/lib/log.ts`) — jamais le silence.

Sa version typée est tout aussi coûteuse : `any`, une assertion `as` qui fait taire le compilateur
au lieu de rendre la frontière explicite, une optionnalité ajoutée pour éviter de trancher.

### 5. L'état à moitié écrit

**Une mutation Convex est une transaction ; une action ne l'est pas.** Une action qui enchaîne
deux `runMutation` peut laisser la base entre les deux. La forme sûre existe et le dépôt l'emploie
(`products.addImage`, `branding.setLogo`) : la garde en requête AVANT toute lecture de fichier,
**une seule** mutation qui rejoue la garde et écrit, et le refus **renvoyé** plutôt que levé
quand il doit effacer (une écriture qui lève est annulée, l'effacement compris).

Même question pour la carte client et la file hors ligne : si l'appel part deux fois (double
appui, réponse perdue puis rejouée), que reste-t-il ? T4 et T5 l'ont rendu vérifiable : « rien de
perdu, rien en double ». Un geste nouveau qui n'est pas idempotent est un `BLOCK`.

Et le cloisonnement : **l'organisation A ne lit, n'écrit ni n'efface rien de B** — fichiers de
stockage compris. Vécu en T7.a : une garde limitée à l'organisation laissait poser, puis effacer
au remplacement, le logo encore frais d'un autre restaurant ; un index global l'a fermée.

---

## Partie B — Ce que le code coûte à lire

### 6. Le fichier qui enfle, la fonction qui s'allonge

**Rendu mécanique : `pnpm check:sizes`** (`scripts/check-sizes.mjs`, et la CI sur chaque pull
request). Il refuse, contre la base :

- un fichier que le diff fait passer au-delà de **1000 lignes**, ou qu'il agrandit alors qu'il y
  était déjà ;
- une fonction, un composant, une méthode ou un `handler` Convex que le diff **crée ou allonge**
  au-delà de **80 lignes**.

Le seuil est différentiel : la dette existante est connue (`MenuView`, `Onboarding`, les gros
écrans de gestion), ce contrôle empêche qu'elle grossisse. Le remède est gratuit : une fonction
nommée, un composant nommé, un module à part — jamais « ranger ».

Ce qui reste au relecteur : que la décomposition **ne déplace pas la complexité sans la réduire**
(axe 0), et qu'elle se fasse dans **la bonne couche** — une règle métier dans `convex/lib/`, pas
dans un composant ; un composant partagé dans `src/components/`, pas dans une route.

### 7. La branche greffée

Une condition ponctuelle insérée au milieu d'un flux qui ne la concernait pas. Un booléen en
paramètre qui fait de la fonction deux fonctions. Un mode nullable. **Ce n'est pas du style, c'est
un défaut de conception** : la logique doit vivre derrière sa propre abstraction.

Et son inverse : **unifier ce qui doit rester séparé.** La carte de table (`/r/…/table`, qui
commande) et la carte publique (`/menu/…`, qui ne commande pas) partagent `MenuView` mais pas leur
commande : `ordering` est absent de la seconde, et rien de la composition d'un plat n'y est
téléchargé.

### 8. L'emballage qui n'emballe rien

Un composant qui ne fait que passer ses props, un hook qui enveloppe un `useQuery`, une
abstraction écrite pour deux cas dont le second est hypothétique. **Qu'est-ce qu'un lecteur
comprend mieux grâce à elle ?** Si rien, on la supprime.

---

## Partie C — Ce que le produit vaut

### 9. Pertinence — est-ce seulement vrai ?

Joliba est adossé à des réalités extérieures : la DGI ivoirienne (RNE, FNE), les fournisseurs de
paiement (Wave), les réseaux et les téléphones réels, le travail d'une salle un soir de week-end.
**Une décision qui repose sur une affirmation extérieure porte sa source**, dans le code ou dans
la décision `D-xxx`. Vécu : D-015 disait que le produit émet des « reçus » ; D-024 l'a corrigé —
« reçu » désigne le RNE, une pièce certifiée.

Sans source : aller la chercher, ou **marquer l'hypothèse comme non vérifiée**. Une recherche qui
n'aboutit pas se dit.

### 10. La carte client, et la preuve

**Le budget de la carte client est opposable** (DESIGN.md §5) : première image utile ≤ 1,8 s en 4G
bridée, HTML + CSS ≤ 40 Ko, JavaScript avant interaction ≤ 120 Ko, images au-dessus de la ligne de
flottaison ≤ 180 Ko. Tout diff qui touche une route client (`/r/…`, `/menu/…`) ou ce qu'elles
importent **exige** :

- une mesure `scripts/measure-guest.mjs`, rejouée et publiée dans `docs/perf/` ;
- **l'attribution** de tout écart de script, fichier par fichier, contre le build de la base. Vécu
  en T7.a : +5 Ko inexpliqués venaient d'un module partagé entre le `head()` d'une page client et
  un écran de gestion — tout le calcul OKLCH était entré dans le paquet commun. **Un import dans
  `head()` ou dans une route client est un import pour chaque client.**

Pour tout écran : **une capture réelle** (`E2E_SCREENSHOTS`), pas une maquette ; les six états
(chargement, vide, erreur, partiel, hors ligne, succès) ; 390 px de large sans défilement
horizontal ; des cibles de 56 px sous le doigt (DESIGN §11) ; shadcn/ui officiel, rien de refait à
la main ; la couleur du restaurant **seulement** sur le « + » et la section lue (D-166).

**Le test qui tranche :** un serveur qui n'a jamais vu cet écran, un plateau à la main, sait-il
quoi faire en dix secondes ?

### 11. La répartition du travail

> Qui détient l'information **au moment exact où elle existe** ? C'est là qu'elle doit être
> saisie, une fois, par cette personne.

Le client compose son panier, le serveur le reprend au lieu de le ressaisir (T2) ; la cuisine
touche un bon, la salle le voit sans qu'on crie (T2) ; le gérant règle son apparence dans l'écran
qui montre la vraie carte, pas dans un formulaire à l'aveugle (T7.a). Un écran dont la seule
fonction est de **ressaisir ce qu'un autre savait déjà** est une dette déguisée en produit.

### 12. Fluidité

- **L'état vit dans l'adresse** quand il doit survivre : le plat ouvert (`?plat=`), l'étape d'un
  parcours (`?etape=marque` — vécu en T7.a : un état local disparaissait au changement
  d'organisation). **Puis-je envoyer l'écran exact que je regarde ?**
- **Hors ligne n'est pas un cas d'erreur** (ADR 0006) : un geste de service part dans la file et
  arrive au retour du réseau. Un geste qui exige le réseau le dit avant l'appui.
- **Un appui produit un effet visible tout de suite** : sur une 4G lente, un appui sans effet fait
  appuyer deux fois — d'où le squelette de fiche (D-166) et les boutons verrouillés pendant
  l'envoi (une seconde organisation créée par un double appui, vécu en T7.a).
- **Modales** pour une décision unitaire ; un parcours à étapes a sa route.

---

## Partie D — Ce qui passe sans être relu

### 13. Le commentaire

Ce dépôt commente le **pourquoi**, abondamment : c'est sa mémoire. D'où le risque. Sur chaque
commentaire **ajouté ou voisin d'une ligne modifiée** :

1. **Est-il encore vrai après ce diff ?** Vécu en T7.a : « l'aperçu reçoit le logo en cours »,
   devenu faux dès que le logo n'est plus passé par le canal. Un commentaire qui décrit le
   comportement d'avant est un `BLOCK`.
2. **Dit-il pourquoi, ou répète-t-il quoi ?**
3. **Affirme-t-il l'invérifiable ?** C'est l'axe 9 dans un commentaire.

### 14. Le message de commit — et le journal des décisions

La question qui ne se pose qu'en revue : **le message affirme-t-il quelque chose que le diff ne
fait pas ?** « corrige X » alors que X reste. `BLOCK` — il ferme l'enquête future.

Même question, plus lourde ici, pour **`docs/DECISION_LOG.md`** : une décision `D-xxx` qui décrit
ce que le code ne fait pas (vécu : D-167(1) affirmait « l'écran relit ce qui est enregistré »
alors qu'il recalculait). Une décision est crue sans être vérifiée — c'est sa fonction. Qu'elle
soit fausse est donc un `BLOCK`, et la correction se fait dans le même geste que le code.

Corollaire : **ce qui est mis en index a-t-il été relu ?** `git add -A` embarque aussi les
résidus (`test-results/`, une capture, un `.env`).

### 15. La documentation qui périme

`DATA_MODEL.md`, `PERMISSIONS.md`, `DESIGN.md`, `docs/ROADMAP.md`, les ADR. Si le diff change un
schéma, une permission, un parcours ou une règle de rendu, le document qui le décrit change **dans
le même geste**. `check:schema` et `check:permissions` le vérifient pour les tables et le catalogue
de permissions ; pour le reste, c'est au relecteur. Un document de conception qui décrit la cible
d'origine doit dire, là où le code en diffère, quelle décision fait foi (DESIGN.md §5.0).

---

## Ce que les machines vérifient déjà

Ne le cherche pas à la main ; vérifie seulement que la CI est verte et qu'il n'a pas été
contourné :

| Contrôle | Ce qu'il refuse |
|---|---|
| `pnpm typecheck` | TypeScript strict |
| `check:guards` | une fonction publique sans garde, ou une garde placée après un accès `ctx.db` |
| `tests/convex/isolation.test.ts` | une fonction publique sans cas d'isolation multi-tenant |
| `check:money` | les invariants de montant (exposant, division sans perte, chiffres de liste = `formatMoney`) |
| `check:schema` | index en double, limites Convex, recopie d'organisation, table non documentée |
| `check:permissions` | une permission présente dans le code OU dans la doc, pas dans les deux |
| `check:sizes` | un fichier au-delà de 1000 lignes, une fonction créée ou allongée au-delà de 80 |
| CI « Generated Convex files are committed » | `convex/_generated` non régénéré |
| `pnpm test:e2e` | les parcours T0 à T7 |

## Les détecteurs Joliba

Défauts récurrents, chacun déjà survenu. Chaque ligne est un `BLOCK`.

| Détecteur | Repère |
|---|---|
| « reçu » ou « facture » dans l'interface avant certification | D-024 : c'est un **ticket** (`bills` dans le code) |
| Un montant affiché sans `formatMoney` | la liste de la carte client seule a `formatListDigits` |
| Une requête Convex dont le résultat doit **suivre l'heure** et qui lit `Date.now()` | une requête ne se recalcule qu'à la prochaine écriture, pas quand l'heure passe : son résultat reste figé. Deux formes sûres : renvoyer les faits et laisser le rendu calculer (`guestMenu.ts`, la disponibilité), ou recevoir l'heure de l'écran, arrondie (D-162). Lire `Date.now()` pour dater un résultat qu'une écriture rafraîchira reste permis — douze requêtes le font |
| Un geste de service qui ne passe pas par la file hors ligne | ADR 0006, D-164 |
| Une requête avant la session établie | `useAuthStatus().isAuthenticated`, sinon « session expirée » |
| Un état de parcours en `useState` qui doit survivre à un changement d'organisation ou à un rechargement | l'adresse (`validateSearch`) |
| Un module importé par `head()` ou une route client qui en tire un gros | isoler la partie utile (`brandTheme.ts`) ; attribuer l'écart |
| Un `Suspense fallback={null}` sur une action de l'utilisateur | un squelette à la forme de ce qui arrive |
| Un fichier de stockage accepté sans `assertFreshUnusedFiles` | et, s'il s'efface au remplacement, un index global |
| Une page qui se laisse encadrer | seule `/apercu/**` le fait, par Joliba seulement (`vite.config.ts`) |
| Du CSS injecté construit à partir d'une saisie | seulement à partir de nombres ou d'un hexadécimal revalidé (D-152) |
| Un champ de schéma rendu obligatoire alors que des documents existent | `v.optional` + migration idempotente (`convex/migrations.ts`), lancée au déploiement et notée dans la ROADMAP |
| `scripts/e2e-env.sh` pointé ailleurs que sur un backend local anonyme | il détourne les e-mails et les paiements |
| Un secret, un OTP, un PIN ou une donnée de carte journalisés ou stockés | SECURITY.md |
| Un composant d'interface refait à la main | shadcn/ui officiel (`src/components/ui/`) |
| Une bibliothèque ajoutée sans version épinglée ni lecture de sa documentation officielle | `package.json` |

## Le ton

Direct, sérieux, exigeant. Jamais brutal — mais **ne transforme pas un problème de
maintenabilité majeur en suggestion polie.** Quelques formulations qui portent :

- « il y a un coup de judo ici : reformulé ainsi, ce canal disparaît. »
- « cet écran recalcule ce que le serveur a enregistré — on relit plutôt ? »
- « ce module entre dans le paquet de chaque client pour une fonction de trois lignes. »
- « ça marche, mais la décision D-xxx décrit autre chose. L'un des deux ment. »

## Le verdict

```
VERDICT : PASS | BLOCK
Plage    : origin/main...HEAD  (N fichiers, +X / -Y)

BLOQUANTS  (n)
  [axe] fichier:ligne — constat en une phrase
        → correction proposée

À CORRIGER AVANT FUSION  (n)
REMARQUES  (n)
JUSTE, NE PAS TOUCHER  (n)
```

**Ordre de priorité**, contraignant : régression structurelle ; coup de judo manqué ; croissance
en branches ; frontières et types ; cloisonnement, argent, hors ligne ; budget de la carte
client ; ergonomie et répartition du travail ; commentaires, messages et décisions ; détail.

> **Au-delà de cinq bloquants, la revue est probablement mal cadrée.** Soit le diff est trop large
> — demande qu'il soit scindé —, soit un seul défaut de conception produit les autres : nomme-le.

## La barre d'approbation

Ne rends pas `PASS` au motif que le comportement semble correct. La barre :

- aucune régression structurelle, aucune fuite entre organisations ;
- aucune simplification décisive manquée alors qu'elle était visible ;
- aucune seconde source de vérité, aucun auxiliaire doublant un canonique ;
- aucun état à moitié écrit, aucun geste non idempotent ;
- aucun écart de performance de la carte client non mesuré ou non attribué ;
- aucune affirmation extérieure sans source ni marquage ;
- aucun écran sans capture réelle ;
- aucun commentaire, message de commit ou décision `D-xxx` qui dise quelque chose de faux.

## Après un `BLOCK`

On ne fusionne pas, on ne déploie pas. On corrige, **puis on relance la revue sur le nouveau
diff**. Un bloquant ne se discute pas : il se corrige, ou il se retire du diff. Si le constat est
faux, on le prouve par `fichier:ligne`.

## Voir aussi

- `.claude/rules/avant-fusion.md` — ce qui rend cette revue obligatoire
- `.claude/hooks/completude-check.sh` — le garde-fou de fin de tâche qui la rappelle
- `scripts/check-sizes.mjs` — l'axe 6, rendu mécanique
- `docs/DECISION_LOG.md` · `docs/adr/` · `docs/perf/` — ce qui fait foi, et ce qui a été mesuré
- Version KLASSCI : `KLASSCIv2/.claude/skills/thermo-review/SKILL.md`
