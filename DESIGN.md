---
name: "Joliba"
description: "Système de design du Restaurant Operating System. Deux dialectes — Salle et Exploitation — sur un socle de jetons unique."
northStar: "Rendre le service visible."
density: [guest, ops, kds]
colors:
  # — Accent. Pétrole : la seule couleur de marque. Froide, donc jamais en
  #   concurrence avec la nourriture (chaude) ni avec un statut.
  accent-50: "#EDF6F9"
  accent-100: "#D3E9F0"
  accent-300: "#6FBBD1"
  accent-500: "#0F7E97"
  accent-600: "#0B6478"
  accent-700: "#08505F"
  accent-800: "#063E4A"
  accent-900: "#052F3A"
  # — Neutres grège (gris chaud). Flattent la photo de plat, se distinguent
  #   des gris froids de tous les SaaS.
  ink: "#1B1714"
  ink-2: "#4E4741"
  ink-3: "#6B635C"
  ink-4: "#786F68"
  ink-disabled: "#8A817A"
  line: "#E4DED7"
  line-2: "#D3CCC4"
  line-control: "#8A817A"
  surface: "#FFFFFF"
  surface-2: "#F4F0EB"
  bg: "#FAF8F5"
  # — Sémantiques. Chacune a un rôle unique et un seul.
  success-50: "#E9F6EE"
  success-600: "#0E7A44"
  success-700: "#0B5C34"
  warning-50: "#FBF2E1"
  warning-600: "#9A5B05"
  warning-700: "#774604"
  danger-50: "#FCEDEA"
  danger-600: "#BC2C1A"
  danger-700: "#941F11"
  # — Rampe sombre (KDS par défaut, Salle et Exploitation sur préférence).
  dark-bg: "#14120F"
  dark-surface: "#1E1B17"
  dark-surface-2: "#2A2620"
  dark-line: "#3B352E"
  dark-line-control: "#7A6F63"
  dark-ink: "#F7F4F0"
  dark-ink-2: "#C2BAB1"
  dark-ink-3: "#968D84"
  dark-accent: "#3FA8C4"
  dark-success: "#4FBE7C"
  dark-warning: "#E0A23C"
  dark-danger: "#F2705C"
  # — Pastilles pleines du KDS : texte encre sur fond vif, lisibles à un mètre.
  kds-ontime: "#8ED9F0"
  kds-soon: "#F2C062"
  kds-late: "#FF9E8C"
typography:
  family: "Archivo Variable (latin, axe wght 400–700, woff2) + pile système"
  mono: "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace (0 octet)"
  display:  { size: "clamp(2.25rem, 6vw, 4rem)", weight: 700, lh: 1.05, tracking: "-0.03em" }
  title-2xl: { size: "30px", weight: 700, lh: 1.15, tracking: "-0.02em" }
  title-xl: { size: "24px", weight: 700, lh: 1.20, tracking: "-0.015em" }
  title-lg: { size: "20px", weight: 600, lh: 1.30, tracking: "-0.01em" }
  title-md: { size: "17px", weight: 600, lh: 1.40, tracking: "0" }
  body:     { size: "15px", weight: 400, lh: 1.55, tracking: "0" }
  label:    { size: "13px", weight: 500, lh: 1.40, tracking: "0" }
  micro:    { size: "11px", weight: 600, lh: 1.35, tracking: "0.01em" }
radius:
  xs: "4px"
  sm: "8px"
  md: "12px"
  lg: "18px"
  full: "9999px"
spacing: { "0.5": "2px", "1": "4px", "1.5": "6px", "2": "8px", "3": "12px", "4": "16px", "5": "20px", "6": "24px", "8": "32px", "10": "40px", "12": "48px", "16": "64px" }
elevation:
  e1: "0 1px 2px rgba(27,23,20,.06), 0 8px 20px -12px rgba(27,23,20,.16)"
  e2: "0 12px 32px -8px rgba(27,23,20,.24)"
motion:
  fast: "120ms"
  base: "160ms"
  sheet: "220ms"
  ease-out: "cubic-bezier(.2,.8,.2,1)"
  ease-in-out: "cubic-bezier(.4,0,.2,1)"
breakpoints: { base: "360px", sm: "380px", md: "600px", lg: "900px", xl: "1280px", "2xl": "1600px" }
targets:
  guest: { tap: "56px", control: "52px" }
  ops:   { tap: "44px", control: "44px", row: "44px" }
  kds:   { tap: "72px", control: "64px", row: "72px" }
components:
  button-primary:   { bg: "{colors.accent-600}", fg: "{colors.surface}", radius: "{radius.sm}", height: "var(--control-h)", padx: "20px" }
  button-secondary: { bg: "{colors.surface}", fg: "{colors.ink}", border: "1px {colors.line-control}", radius: "{radius.sm}", height: "var(--control-h)" }
  button-quiet:     { bg: "transparent", fg: "{colors.ink-2}", radius: "{radius.sm}", height: "var(--control-h)" }
  button-danger:    { bg: "{colors.surface}", fg: "{colors.danger-600}", border: "1px {colors.danger-600}", radius: "{radius.sm}" }
  field:            { bg: "{colors.surface}", fg: "{colors.ink}", border: "1px {colors.line-control}", radius: "{radius.sm}", height: "var(--control-h)", padx: "12px" }
  status-badge:     { bg: "{colors.surface-2}", fg: "{colors.ink}", radius: "{radius.xs}", height: "24px", padx: "8px", glyph: "requis" }
  card-dish:        { bg: "{colors.surface}", radius: "{radius.lg}", shadow: "{elevation.e1}", photo: "4:3" }
  card-ticket:      { bg: "{colors.dark-surface}", radius: "{radius.md}", shadow: "none", border: "2px" }
  sheet:            { bg: "{colors.surface}", radius: "{radius.lg} {radius.lg} 0 0", shadow: "{elevation.e2}", maxHeight: "85vh" }
  side-panel:       { bg: "{colors.surface}", width: "420px", shadow: "{elevation.e2}", scrim: "none" }
---

# Système de design — Joliba

> ⚠️ **Mise à jour du 2026-09-23 (D-058).** L'interface est désormais construite **uniquement avec
> les composants officiels de shadcn/ui** (preset Nova, base Radix, thème `neutral`, police Geist,
> icônes Lucide), à la demande du propriétaire. En conséquence :
> - **caducs** : les jetons de couleur et de typographie maison (§2.1, §2.2, §2.4 — Pétrole, Grège,
>   Archivo) et les spécifications visuelles des composants (§9) ; la source de vérité visuelle est
>   `components.json`, `src/styles/app.css` et `src/components/ui/` tels que générés par la CLI shadcn ;
> - **toujours en vigueur** : les huit règles nommées (§4, R-D1 à R-D8), les états d'écran (§10),
>   le budget de performance de la carte client et les exigences d'accessibilité.
> Le front-matter ci-dessus est conservé pour l'historique ; il ne pilote plus le code.
>
> **Marque (D-059)** : logo et favicon dans `public/brand/` et `public/favicon.svg`, couleur **#044E5A**
> posée comme `--primary` du thème shadcn. Sources et prompts : `docs/brand/`.

> Ce document est **opposable**. Chaque valeur qu'il contient est justifiée par un usage réel :
> une cuisine bruyante, un coup de feu à dix-neuf heures, un téléphone Android à 100 $ sur une 4G
> qui tombe. Une valeur sans justification n'a pas sa place ici et doit être retirée.
>
> Références permanentes : `PRODUCT.md` (vision, personas, principes, terminologie),
> `ARCHITECTURE.md` §9 et §12 (surfaces, temps réel, hors ligne, erreurs typées),
> `docs/DECISION_LOG.md` (désaccords et décisions), `docs/research/competitive-analysis.md`
> §7 et §8 (contraintes africaines, pratiques à ne pas copier).
>
> **D-013 s'applique à ce fichier** : aucune identité visuelle n'est reprise de `filon`.
> Ce qui en vient est la **forme** du document — front-matter lisible par machine, règles nommées,
> spécification composant par composant, Do/Don't exécutables. Rien d'autre.

---

## 1. North star créatif

### La phrase

> **« Rendre le service visible. »**
> *Côté salle, cette visibilité s'appelle hospitalité. Côté cuisine, caisse et exploitation, elle
> s'appelle instrument.*

### Pourquoi ce n'est pas « Hospitality × Operational Precision »

La formule du brief est juste sur le fond : elle nomme les deux qualités que le produit doit tenir
en même temps. Mais **elle ne tranche pas**, et ces deux qualités entrent en conflit à chaque écran.
Le client veut de l'air et des photos ; la cuisine veut quatorze bons sur une dalle de dix pouces.
Une étoile polaire qui dit « les deux » ne sert à rien le jour où il faut choisir.

« Rendre le service visible » nomme la **fonction**, pas les qualités. Et cette fonction arbitre :

- Le §1 de `PRODUCT.md` décrit la chaîne du service comme une suite de flèches qui sont, aujourd'hui,
  *« une voix qui crie, un carnet, ou un aller-retour »*. Le produit n'invente pas cette chaîne :
  **il la rend visible.** C'est littéralement ce qu'il vend.
- Les dix douleurs du §4 sont, sans exception, des **défauts de visibilité** : la commande qu'on ne
  voit pas arriver (P1), l'argent qu'on ne voit pas entrer (P2), le client qui ne voit pas où en est
  son plat (P3), le serveur qui ne voit pas que c'est prêt (P4), le gérant qui ne voit sa soirée que
  le lendemain (P5), le produit épuisé qu'on continue de vendre (P8).
- L'hospitalité et la précision deviennent alors **deux dialectes d'une même fonction**, pas deux
  exigences à négocier : à Aïcha, on rend visible *l'attente qui se réduit* ; à Ibrahim, on rend
  visible *l'ordre de production*. Le vocabulaire visuel diffère, l'intention est la même.

### Le test de revue qu'elle produit

Pour tout élément d'interface, une seule question : **« qu'est-ce que ceci rend visible ? »**

Si la réponse est « rien », l'élément sort. C'est ce qui élimine, sans discussion et sans débat de
goût, le dégradé violet, l'orbe lumineux, le faux tableau de bord en trois dimensions, le bento sans
logique, la bordure latérale épaisse et colorée, et le mur de cartes génériques que le §117 interdit.
Aucun de ces éléments ne rend quoi que ce soit visible. Ils occupent de la place et des octets sur
un appareil qui n'en a pas.

### Les cinq caractères qui en découlent

1. **Le statut avant l'esthétique.** Ce qui change est ce qui doit se voir en premier. Le décor est
   ce qui ne change jamais — donc ce qui ne mérite pas d'attention.
2. **Une couleur froide de marque sur un monde chaud.** La nourriture est rouge, orange, brune, dorée.
   Un accent chaud se noierait dans les photos et se confondrait avec « attention » ou « danger ».
   Le Pétrole est la seule couleur que le contenu ne produit jamais : quand on la voit, c'est
   l'interface qui parle.
3. **Deux densités, un socle.** Mêmes jetons, réglages opposés (§67, `PRODUCT.md` principe 5,
   `ARCHITECTURE.md` §9 règle 4). Un même bouton, deux échelles — jamais deux bibliothèques.
4. **La légèreté est une contrainte de conception, pas d'optimisation.** 81 % des smartphones vendus
   en Afrique en 2025 sont sous 200 $. Une ombre douce, une police de plus, une animation de
   parallaxe se paient en images par seconde sur l'appareil de la personne qui décide d'acheter.
5. **Aucun matériel propriétaire** (*D-021*). Le système doit être beau sur une tablette à 60 € et
   sur le téléphone personnel d'un serveur. Il n'a pas le droit de supposer un écran calibré.

---

## 2. Jetons

Tous les jetons sont ci-dessous **prêts à coller**. Deux blocs : `@theme` pour ce que Tailwind v4
transforme en utilitaires, `:root` pour ce qui reste une variable CSS lue à la main (densité,
profondeurs, durées composées).

### 2.1 Couleur — rôles et ratios calculés

Les ratios ci-dessous sont **calculés** sur les valeurs exactes, formule WCAG 2.x
(luminance relative sRGB). Ils ne sont pas estimés. Un test unitaire les recalcule à chaque
construction (§12.3) : si un jeton bouge et casse un seuil, la construction échoue.

#### Accent — Pétrole (`#0B6478`, teinte ≈ 195°)

| Jeton | Hex | vs blanc | vs noir | Rôle exact |
|---|---|---|---|---|
| `accent-50` | `#EDF6F9` | 1,10 | 19,15 | Fond de sélection, fond d'un bloc d'aide |
| `accent-100` | `#D3E9F0` | 1,26 | 16,68 | Fond de puce active, surlignage de recherche |
| `accent-300` | `#6FBBD1` | 2,16 | 9,70 | Trait de graphique sur fond clair, décor de séparation |
| `accent-500` | `#0F7E97` | **4,72** | 4,45 | Icône informative, texte ≥ 20 px, remplissage en mode sombre |
| `accent-600` | `#0B6478` | **6,76** | 3,11 | **Action principale (texte blanc dessus), lien, anneau de focus, sélection** |
| `accent-700` | `#08505F` | **9,04** | 2,32 | Survol de l'action principale, texte d'accent sur `accent-50` (**8,24**) |
| `accent-800` | `#063E4A` | 11,69 | 1,80 | Pression (`:active`) |
| `accent-900` | `#052F3A` | 14,25 | 1,47 | En-tête de facture imprimée, aplats de marque |

> **Pourquoi un bleu-vert et pas un indigo, un violet ou un orange.** Trois raisons mesurables.
> (a) Aucun plat n'est de cette couleur : l'accent ne se confondra jamais avec le contenu
> photographique, qui occupe 60 % de l'écran client. (b) Sa teinte (195°) est à plus de 50° du vert
> de réussite (145°) : un deutéranope les distingue encore, ce que ne permettrait pas un accent vert
> ou turquoise. (c) Les bleus profonds saturés tiennent sur les dalles à faible gamut et à angle de
> vue étroit des tablettes d'entrée de gamme, là où un pastel se délave.

#### Neutres — Grège (gris chaud)

| Jeton | Hex | vs blanc | vs `bg` | Rôle exact |
|---|---|---|---|---|
| `ink` | `#1B1714` | **17,81** | 16,80 | Texte principal, chiffres, titres |
| `ink-2` | `#4E4741` | **9,12** | 8,61 | Texte secondaire, description de plat, métadonnée |
| `ink-3` | `#6B635C` | **5,89** | 5,56 | Libellé de colonne, unité, horodatage |
| `ink-4` | `#786F68` | **4,92** | 4,64 | Texte d'aide, indication de saisie (*plancher AA*) |
| `ink-disabled` | `#8A817A` | 3,82 | 3,60 | **Désactivé uniquement.** Interdit pour une information |
| `line` | `#E4DED7` | 1,34 | 1,26 | Séparateur, bordure de carte (décoratif) |
| `line-2` | `#D3CCC4` | 1,59 | 1,50 | Séparateur appuyé, quadrillage de tableau |
| `line-control` | `#8A817A` | **3,82** | 3,60 | **Bordure de champ, de case, de bouton secondaire** (1.4.11 : ≥ 3) |
| `surface` | `#FFFFFF` | 1,00 | 1,06 | Carte, panneau, champ |
| `surface-2` | `#F4F0EB` | 1,13 | 1,07 | En-tête de tableau, survol de ligne, zone en retrait |
| `bg` | `#FAF8F5` | 1,06 | 1,00 | Fond d'application |

> **Pourquoi un neutre chaud et non un gris froid.** Un gris froid renvoie la photo de plat vers le
> bleu par contraste simultané : un poulet braisé sur du zinc paraît grisé. Le grège fait l'inverse,
> il pousse les rouges et les dorés. C'est le même raisonnement que le papier crème des cartes
> imprimées. Effet secondaire utile : cela nous distingue immédiatement du gris ardoise employé par
> l'ensemble des produits SaaS, `filon` compris.

#### Sémantiques — un rôle, un seul

| Jeton | Hex | vs blanc | Texte sur `-50` | Rôle exact — et rien d'autre |
|---|---|---|---|---|
| `success-600` | `#0E7A44` | **5,40** | `success-700` sur `success-50` : **7,28** | Prêt, servi, payé, publié, encaissé, en ligne |
| `warning-600` | `#9A5B05` | **5,42** | `warning-700` sur `warning-50` : **7,10** | Bientôt dû, paiement partiel, stock bas, à vérifier |
| `danger-600` | `#BC2C1A` | **5,98** | `danger-700` sur `danger-50` : **7,49** | En retard, refusé, annulé, écart de caisse, destructif |

Texte blanc sur `success-600` : **5,40** · sur `warning-600` : **5,42** · sur `danger-600` : **5,98**
· sur `accent-600` : **6,76**. Les quatre remplissages acceptent donc du texte blanc à 15 px.

#### Rampe sombre

| Jeton | Hex | vs `dark-bg` | vs `dark-surface` | Rôle |
|---|---|---|---|---|
| `dark-ink` | `#F7F4F0` | **17,05** | **15,64** | Texte principal |
| `dark-ink-2` | `#C2BAB1` | **9,75** | **8,95** | Texte secondaire |
| `dark-ink-3` | `#968D84` | **5,73** | **5,26** | Métadonnée |
| `dark-line` | `#3B352E` | 1,54 | 1,42 | Séparateur décoratif |
| `dark-line-control` | `#7A6F63` | **3,81** | **3,50** | Bordure de champ (1.4.11) |
| `dark-accent` | `#3FA8C4` | **6,78** | **6,22** | Action, lien, anneau de focus |
| `dark-success` | `#4FBE7C` | **8,00** | **7,34** | Prêt, payé |
| `dark-warning` | `#E0A23C` | **8,37** | **7,68** | Bientôt dû |
| `dark-danger` | `#F2705C` | **6,45** | **5,92** | En retard, erreur |
| `dark-bg` | `#14120F` | — | — | Fond |
| `dark-surface` | `#1E1B17` | 1,09 | — | Carte, bon |
| `dark-surface-2` | `#2A2620` | 1,24 | 1,14 | Zone en retrait |

> Le fond sombre n'est **pas noir pur** (`#14120F` et non `#000000`). Sur les dalles OLED, du blanc
> pur sur du noir pur produit un halo (« halation ») qui fatigue à une heure du matin ; sur les
> dalles LCD bon marché, le noir pur est de toute façon rendu en gris et les bordures disparaissent.
> Un charbon chaud règle les deux cas.

#### Pastilles pleines du KDS

Lues **debout, à un mètre**, dans une cuisine. Ce sont des aplats vifs portant du texte encre —
et non l'inverse — parce qu'un aplat clair sur fond sombre est perçu plus grand et plus net à
distance que du texte coloré sur fond sombre.

| Jeton | Hex | Texte `#14120F` dessus | Emploi |
|---|---|---|---|
| `kds-ontime` | `#8ED9F0` | **11,87** | Bandeau « à l'heure » |
| `kds-soon` | `#F2C062` | **11,12** | Bandeau « bientôt dû » |
| `kds-late` | `#FF9E8C` | **9,37** | Bandeau « en retard » et « critique » |

> Ces trois valeurs sont **plus claires** que leurs équivalents `dark-*`. C'est volontaire : elles ne
> portent pas du texte de lecture mais un mot unique en capitales, à 20 px, vu à un mètre. Le
> confort de lecture longue n'y a aucun intérêt ; la détection périphérique, si.

### 2.2 Typographie

**Une seule fonte téléchargée. C'est une décision de performance, pas de goût.**

| | Famille | Coût réseau | Emploi |
|---|---|---|---|
| Interface (tout) | **Archivo Variable** — latin, **axe `wght` seul (400–700)**, `woff2` | **budget dur : ≤ 40 Ko**, un seul fichier | Tout le produit et le site |
| Codes opaques | Pile monospace **système** | **0 octet** | Jeton de table, référence de transaction, identifiant de trace |

**Pourquoi Archivo.** Hauteur d'x très élevée et ouvertures larges — c'est ce qui décide de la
lisibilité à un mètre et sur une dalle bas de gamme, bien plus que la « personnalité ». Grotesque
neutre, donc elle ne se met pas en travers d'une carte de restaurant tout en restant disciplinée
dans un tableau dense. Couverture latine étendue : les diacritiques françaises (é, è, ê, ç, à, ù)
sont dessinées, pas composées. Un axe de chasse existe si l'on a un jour besoin de condenser une
colonne — mais **il n'est pas livré** aujourd'hui, parce qu'il coûte des octets pour un besoin non
avéré.

**Pourquoi aucune fonte monospace téléchargée.** Les montants, minuteurs et compteurs ont besoin de
**chiffres de même chasse**, pas d'une seconde famille. `font-variant-numeric: tabular-nums` le
donne gratuitement. Une fonte mono, c'est 25 à 35 Ko de plus sur le chemin critique du menu client —
soit environ un quart du budget total d'images au-dessus de la ligne de flottaison, dépensé pour une
texture. Sur une 4G instable, c'est indéfendable.

> **Vérification obligatoire à l'intégration** : contrôler que le fichier Archivo livré expose bien
> `tnum`. S'il ne l'expose pas, forcer `font-feature-settings: "tnum" 1` ; si l'alignement reste
> faux, basculer **les seules colonnes de montants** sur la pile monospace système. On ne télécharge
> pas une police pour régler ce problème.

**Chargement — la règle qui protège le menu client.**

1. La coquille du menu client est rendue côté serveur et **peinte avec la pile système**, sans
   attendre quoi que ce soit.
2. Archivo est déclarée avec `font-display: swap` et une `@font-face` de repli **ajustée
   métriquement** (`size-adjust`, `ascent-override`, `descent-override`) calibrée sur la pile
   système, pour que l'échange ne provoque **aucun décalage de mise en page**.
3. `<link rel="preload" as="font" crossorigin>` **uniquement** sur le menu client et l'application ;
   jamais sur le blog, où la lecture commence avant la fonte.
4. Si le budget de 40 Ko est dépassé au moment de l'intégration, **on retire la fonte, pas le
   budget.**

**Échelle — fixe dans l'application, fluide en marketing.**

| Rôle | Taille | Interligne | Graisse | Où |
|---|---|---|---|---|
| `display` | `clamp(2.25rem, 6vw, 4rem)` | 1,05 | 700 | **Site public seulement.** Jamais dans un écran produit |
| `title-2xl` | 30 px | 1,15 | 700 | Nom de l'établissement (Salle), en-tête de station (KDS) |
| `title-xl` | 24 px | 1,20 | 700 | Titre d'écran, nom d'article sur un bon KDS |
| `title-lg` | 20 px | 1,30 | 600 | Titre de section, nom de plat en grille, mot de gravité KDS |
| `title-md` | 17 px | 1,40 | 600 | Nom de plat en liste, en-tête de carte Ops, prix |
| `body` | 15 px | 1,55 | 400 | Corps. **Plancher absolu du texte informatif** |
| `label` | 13 px | 1,40 | 500 | Libellé de colonne, badge, métadonnée de tableau |
| `micro` | 11 px | 1,35 | 600 | **Unité ou compteur collé à une valeur plus grande, exclusivement** |

Deux planchers, tenus en revue :

- **Salle : rien sous 15 px.** Le client lit un téléphone tenu bas, dans une lumière incertaine,
  parfois avec une vue qui n'est plus de vingt ans. Le prix et le nom du plat sont à 17 px.
- **Exploitation : rien sous 13 px**, et 13 px est réservé aux *libellés*, jamais aux *valeurs*.
- **KDS : rien sous 16 px.** Voir §7.
- `micro` (11 px) **est interdit pour toute information nécessaire à une décision**. Il ne sert
  qu'aux unités (« F », « min », « ×3 ») collées à une valeur plus grande. C'est exactement le
  « microtexte illisible » que le §117 proscrit, et la seule échappatoire admise est celle-là.

**Longueur de ligne** : 60 à 75 caractères pour un paragraphe. Une description de plat qui dépasse
trois lignes est tronquée avec un « Voir plus » qui ouvre la fiche — pas un `text-overflow` muet.

### 2.3 Espacement, rayons, élévation, mouvement, ruptures, profondeurs

**Espacement — grille de 4 px.** `2 · 4 · 6 · 8 · 12 · 16 · 20 · 24 · 32 · 40 · 48 · 64`.
Rien entre. Un espacement qui n'est pas sur la grille est un bogue visuel, pas une nuance.

**Rayons** — quatre, chacun avec un sens :

| Jeton | Valeur | Ce que ça signifie |
|---|---|---|
| `xs` | 4 px | Objet minuscule et dense : badge, pastille, cellule sélectionnée |
| `sm` | 8 px | Contrôle : bouton, champ, case, onglet |
| `md` | 12 px | Conteneur de travail : carte Ops, bon KDS, bloc de tableau |
| `lg` | 18 px | Objet d'hospitalité : carte de plat, bottom sheet, grande photo |
| `full` | 9999 px | Objet rond par nature : avatar, puce de filtre, pastille de convive |

Le saut de 12 à 18 est la **frontière de dialecte** : ce qui est arrondi à 18 px appartient à la
Salle, ce qui est arrondi à 12 px appartient à l'Exploitation. On le lit sans y penser.

**Élévation — deux niveaux, pas trois.**

| Jeton | Ombre | Quand |
|---|---|---|
| `e1` | `0 1px 2px rgba(27,23,20,.06), 0 8px 20px -12px rgba(27,23,20,.16)` | Objet autonome qui se détache à peine du fond : carte de plat, ligne en cours de glissement |
| `e2` | `0 12px 32px -8px rgba(27,23,20,.24)` | Ce qui flotte réellement au-dessus : bottom sheet, panneau latéral, menu, palette ⌘K, modale |

Deux interdits qui en découlent :

- **Une section ordinaire n'a pas d'ombre.** Elle a un fond et une bordure d'un pixel. Point.
- **Jamais bordure décorative + ombre diffuse sur le même composant.** C'est le signe visuel le plus
  fiable d'une interface non conçue.
- **Le KDS n'a aucune ombre, à aucun niveau.** Sur une dalle bon marché en lumière de cuisine, une
  ombre diffuse devient une bouillie grise qui mange la bordure. La séparation des bons se fait par
  **fond + bordure de 2 px + espacement**, ce qui survit à un mauvais écran et à un angle de vue.

**Mouvement — 120 à 220 ms, et il explique toujours une transition.**

| Jeton | Durée | Courbe | Emploi |
|---|---|---|---|
| `m-fast` | 120 ms | `ease-out` | Survol, pression, apparition d'un anneau de focus |
| `m-base` | 160 ms | `ease-out` | Changement de statut, apparition d'un badge, entrée d'une ligne dans une file |
| `m-sheet` | 220 ms | `ease-out` | Bottom sheet, panneau latéral, modale |
| — | **0** | — | **Changement d'état d'un bon KDS. Jamais animé.** Une cuisine ne regarde pas une transition, elle lit un état |

Règles fermes : **aucune animation permanente** (pas de pulsation, pas de scintillement, pas de
respiration). Aucune animation d'entrée sur une liste de plus de dix éléments — le décalage en
cascade coûte des images par seconde sur un appareil d'entrée de gamme et ne rend rien visible.
Aucune parallaxe.

`prefers-reduced-motion: reduce` → toutes les durées à **1 ms** (pas 0, pour ne pas casser les
écouteurs de `transitionend`), les déplacements deviennent des apparitions, et **les glissements
deviennent des changements instantanés**.

**Points de rupture — on conçoit à 360 px.**

| Jeton | Valeur | Appareil réel visé |
|---|---|---|
| `base` | **360 px** | Android d'entrée de gamme. **C'est la largeur de conception, pas un cas limite** |
| `sm` | 380 px | Milieu de gamme |
| `md` | 600 px | Grande phablette, petite tablette en portrait |
| `lg` | 900 px | **Tablette en paysage — KDS et caisse basculent ici** |
| `xl` | 1280 px | Poste de gérant |
| `2xl` | 1600 px | Plan de salle large, tour de contrôle |

Contrainte de recette : **rien ne déborde horizontalement à 320 px.** On ne conçoit pas pour 320,
mais on ne casse pas à 320 non plus.

**Profondeurs z — une échelle, huit crans, aucune valeur inventée en cours de route.**

| Jeton | Valeur | Couche |
|---|---|---|
| `z-base` | 0 | Contenu |
| `z-sticky` | 10 | En-tête collant, en-tête de tableau, barre de station KDS |
| `z-dock` | 20 | Barre de navigation basse et panier persistant (Salle) |
| `z-scrim` | 40 | Voile |
| `z-overlay` | 50 | Bottom sheet, modale, panneau latéral |
| `z-popover` | 60 | Menu, liste de saisie semi-automatique, palette ⌘K, infobulle |
| `z-toast` | 70 | Notification éphémère, bandeau d'annulation |
| `z-system` | 80 | Bandeau d'état durable : hors ligne, mode simulation, caisse non ouverte |
| `z-skip` | 100 | Lien d'évitement au clavier |

Un `z-index` écrit en dur dans un composant est un défaut de revue.

### 2.4 Les jetons, prêts à coller (Tailwind v4)

```css
/* app.css */
@import "tailwindcss";

/* Mode sombre piloté par attribut : la station, le compte ou le système le posent. */
@custom-variant dark (&:where([data-theme="dark"], [data-theme="dark"] *));

@theme {
  /* ---------- Couleur : accent (Pétrole) ---------- */
  --color-accent-50:  #EDF6F9;
  --color-accent-100: #D3E9F0;
  --color-accent-300: #6FBBD1;
  --color-accent-500: #0F7E97;
  --color-accent-600: #0B6478;
  --color-accent-700: #08505F;
  --color-accent-800: #063E4A;
  --color-accent-900: #052F3A;

  /* ---------- Couleur : neutres grège ---------- */
  --color-ink:          #1B1714;
  --color-ink-2:        #4E4741;
  --color-ink-3:        #6B635C;
  --color-ink-4:        #786F68;
  --color-ink-disabled: #8A817A;
  --color-line:         #E4DED7;
  --color-line-2:       #D3CCC4;
  --color-line-control: #8A817A;
  --color-surface:      #FFFFFF;
  --color-surface-2:    #F4F0EB;
  --color-bg:           #FAF8F5;

  /* ---------- Couleur : sémantiques ---------- */
  --color-success-50:  #E9F6EE;
  --color-success-600: #0E7A44;
  --color-success-700: #0B5C34;
  --color-warning-50:  #FBF2E1;
  --color-warning-600: #9A5B05;
  --color-warning-700: #774604;
  --color-danger-50:   #FCEDEA;
  --color-danger-600:  #BC2C1A;
  --color-danger-700:  #941F11;

  /* ---------- Couleur : rampe sombre ---------- */
  --color-dark-bg:           #14120F;
  --color-dark-surface:      #1E1B17;
  --color-dark-surface-2:    #2A2620;
  --color-dark-line:         #3B352E;
  --color-dark-line-control: #7A6F63;
  --color-dark-ink:          #F7F4F0;
  --color-dark-ink-2:        #C2BAB1;
  --color-dark-ink-3:        #968D84;
  --color-dark-accent:       #3FA8C4;
  --color-dark-success:      #4FBE7C;
  --color-dark-warning:      #E0A23C;
  --color-dark-danger:       #F2705C;

  /* ---------- Couleur : pastilles pleines KDS ---------- */
  --color-kds-ontime: #8ED9F0;
  --color-kds-soon:   #F2C062;
  --color-kds-late:   #FF9E8C;

  /* ---------- Typographie ---------- */
  --font-sans: "Archivo Variable", "Archivo", system-ui, -apple-system,
               "Segoe UI", Roboto, "Helvetica Neue", sans-serif;
  --font-mono: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;

  --text-display:   clamp(2.25rem, 6vw, 4rem);
  --text-display--line-height: 1.05;
  --text-display--letter-spacing: -0.03em;
  --text-display--font-weight: 700;

  --text-title-2xl: 30px;  --text-title-2xl--line-height: 1.15;
  --text-title-2xl--letter-spacing: -0.02em;  --text-title-2xl--font-weight: 700;

  --text-title-xl:  24px;  --text-title-xl--line-height: 1.2;
  --text-title-xl--letter-spacing: -0.015em;  --text-title-xl--font-weight: 700;

  --text-title-lg:  20px;  --text-title-lg--line-height: 1.3;
  --text-title-lg--letter-spacing: -0.01em;   --text-title-lg--font-weight: 600;

  --text-title-md:  17px;  --text-title-md--line-height: 1.4;
  --text-title-md--font-weight: 600;

  --text-body:      15px;  --text-body--line-height: 1.55;
  --text-label:     13px;  --text-label--line-height: 1.4;
  --text-label--font-weight: 500;
  --text-micro:     11px;  --text-micro--line-height: 1.35;
  --text-micro--font-weight: 600;  --text-micro--letter-spacing: 0.01em;

  /* ---------- Rayons ---------- */
  --radius-xs:   4px;
  --radius-sm:   8px;
  --radius-md:  12px;
  --radius-lg:  18px;
  --radius-full: 9999px;

  /* ---------- Élévation : deux niveaux ---------- */
  --shadow-e1: 0 1px 2px rgb(27 23 20 / 0.06), 0 8px 20px -12px rgb(27 23 20 / 0.16);
  --shadow-e2: 0 12px 32px -8px rgb(27 23 20 / 0.24);

  /* ---------- Courbes ---------- */
  --ease-out-soft:  cubic-bezier(0.2, 0.8, 0.2, 1);
  --ease-in-out-soft: cubic-bezier(0.4, 0, 0.2, 1);

  /* ---------- Points de rupture ---------- */
  --breakpoint-sm:  380px;
  --breakpoint-md:  600px;
  --breakpoint-lg:  900px;
  --breakpoint-xl:  1280px;
  --breakpoint-2xl: 1600px;
}

:root {
  /* ---------- Durées ---------- */
  --m-fast:  120ms;
  --m-base:  160ms;
  --m-sheet: 220ms;

  /* ---------- Profondeurs ---------- */
  --z-base: 0;    --z-sticky: 10;  --z-dock: 20;    --z-scrim: 40;
  --z-overlay: 50; --z-popover: 60; --z-toast: 70;  --z-system: 80;
  --z-skip: 100;

  /* ---------- Densité : réglage par défaut = ops ---------- */
  --tap:       44px;  /* cible tactile minimale — jamais franchie vers le bas */
  --control-h: 44px;  /* hauteur de bouton, champ, sélection */
  --row-h:     44px;  /* hauteur de ligne de tableau */
  --pad-x:     12px;  /* rembourrage horizontal d'un contrôle */
  --pad-card:  16px;  /* rembourrage intérieur d'un conteneur */
  --gap:        8px;  /* écart entre éléments frères */
  --font-base: 15px;
  --icon:      20px;
  --stroke:    1.75;

  /* ---------- Voile ---------- */
  --scrim: rgb(27 23 20 / 0.44);
}

/* La densité est un attribut posé sur la racine de la surface, jamais un thème séparé. */
[data-density="guest"] {
  --tap: 56px; --control-h: 52px; --row-h: auto;
  --pad-x: 16px; --pad-card: 20px; --gap: 16px;
  --font-base: 17px; --icon: 24px; --stroke: 1.75;
}
[data-density="ops"] {
  --tap: 44px; --control-h: 44px; --row-h: 44px;
  --pad-x: 12px; --pad-card: 16px; --gap: 8px;
  --font-base: 15px; --icon: 20px; --stroke: 1.75;
}
[data-density="kds"] {
  --tap: 72px; --control-h: 64px; --row-h: 72px;
  --pad-x: 16px; --pad-card: 16px; --gap: 12px;
  --font-base: 20px; --icon: 28px; --stroke: 2;
}

/* Bascule sombre : on réaffecte les rôles, on ne renomme rien. */
[data-theme="dark"] {
  --color-bg:           var(--color-dark-bg);
  --color-surface:      var(--color-dark-surface);
  --color-surface-2:    var(--color-dark-surface-2);
  --color-line:         var(--color-dark-line);
  --color-line-2:       var(--color-dark-line-control);
  --color-line-control: var(--color-dark-line-control);
  --color-ink:          var(--color-dark-ink);
  --color-ink-2:        var(--color-dark-ink-2);
  --color-ink-3:        var(--color-dark-ink-3);
  --color-ink-4:        var(--color-dark-ink-3);
  --color-accent-600:   var(--color-dark-accent);
  --color-success-600:  var(--color-dark-success);
  --color-warning-600:  var(--color-dark-warning);
  --color-danger-600:   var(--color-dark-danger);
  --scrim: rgb(0 0 0 / 0.60);
}

@layer base {
  html { font-family: var(--font-sans); -webkit-text-size-adjust: 100%; }
  body { background: var(--color-bg); color: var(--color-ink); font-size: var(--font-base); }

  /* Valeurs mesurables : chasse fixe, toujours. */
  .num, td.num, [data-num] { font-variant-numeric: tabular-nums; font-feature-settings: "tnum" 1; }

  /* Focus : double anneau, visible aussi bien sur fond clair que sur un aplat coloré. */
  :focus-visible {
    outline: 2px solid var(--color-accent-600);
    outline-offset: 2px;
    box-shadow: 0 0 0 4px var(--color-surface);
  }

  @media (prefers-reduced-motion: reduce) {
    *, *::before, *::after {
      animation-duration: 1ms !important;
      animation-iteration-count: 1 !important;
      transition-duration: 1ms !important;
      scroll-behavior: auto !important;
    }
  }

  /* Impression : toujours clair, jamais d'aplat sombre. */
  @media print {
    :root, [data-theme="dark"] {
      --color-bg: #FFFFFF; --color-surface: #FFFFFF; --color-surface-2: #FFFFFF;
      --color-ink: #000000; --color-ink-2: #000000; --color-line: #999999;
    }
    [data-print-hide] { display: none !important; }
  }
}
```

---

## 3. Mode sombre — où il sert, où il nuit

Le mode sombre n'est pas une option de confort à cocher partout. C'est un réglage
**d'environnement physique**. La question n'est jamais « le veut-on ? » mais « dans quelle lumière
cet écran est-il regardé, et pendant combien d'heures ? ».

| Surface | Défaut | Bascule | Pourquoi |
|---|---|---|---|
| **KDS (cuisine, bar)** | **Sombre** | Réglage **de station**, pas de compte | L'écran est allumé six heures d'affilée dans le champ de vision d'Ibrahim. Une dalle blanche de dix pouces au passe est une lampe. Sur fond sombre, les trois bandeaux de gravité deviennent des marques vives détectables en vision périphérique — c'est exactement ce qu'on veut d'un KDS. **Et le réglage appartient à la station** : la tablette est partagée, elle n'a pas de compte personnel (*A1*) |
| **Salle (client)** | **Préférence système** | Bouton dans le pied de page | Le téléphone d'Aïcha est souvent déjà en sombre le soir, et une page blanche plein écran à vingt-deux heures est agressive et consomme de la batterie en OLED — or elle a « peu de batterie ». Le fond sombre **flatte** la photo de plat, comme une carte imprimée sur papier noir |
| **Serveur (téléphone)** | **Préférence système** | Suit le système | Koffi travaille dans une salle qui s'assombrit au fil du service. Son téléphone est personnel : son réglage système est le bon signal |
| **Caisse** | **Clair** | Sombre disponible pour un comptoir de bar nocturne | Mariam compare des billets, des pièces et des tickets papier avec l'écran. Le clair est le même monde que le papier. La clôture est lue, relue et parfois imprimée |
| **Manager / analytics** | **Clair** | Sombre disponible | Un tableau exporté, imprimé ou montré à un comptable est clair. Le sombre existe pour le confort, pas pour la restitution |
| **Site public (marketing, blog, menus publics)** | **Clair uniquement** | Aucune | Un thème de plus, c'est un thème de plus à tenir, et surtout du CSS de plus sur la surface dont le premier affichage compte le plus (SEO, réseau faible). Le bénéfice ne paie pas le coût |

### Trois règles qui s'appliquent quel que soit le thème

1. **Les photos de plats ne sont jamais assombries, filtrées, ni recouvertes d'un dégradé.** En mode
   sombre, la carte de plat garde un fond `dark-surface` et la photo garde ses couleurs d'origine.
   Un plat dont on a modifié la couleur est un plat qu'on décrit faussement (*`PRODUCT.md`
   principe 6 : rien d'inventé*).
2. **Le budget de contraste ne baisse pas d'un thème à l'autre.** Les ratios de la rampe sombre
   (§2.1) sont tous ≥ 4,5 pour le texte et ≥ 3 pour les bordures de contrôle. Les deux thèmes
   passent le même test automatisé.
3. **L'impression et l'export sont toujours clairs** (`@media print` ci-dessus). On n'imprime pas un
   fond noir : ça vide une cartouche et ça rend un ticket illisible.

---

## 4. Les huit règles nommées

Ces règles sont **opposables en revue**. On les cite par leur nom dans un commentaire de relecture,
et la réponse attendue est une correction, pas un débat. Chacune dit ce qu'elle interdit et donne un
exemple qu'on peut vérifier à l'œil.

### R-D1 — La règle du regard unique

> **Chaque écran déclare une question et une action.**

Si l'on ne sait pas dire, en une phrase, ce que l'utilisateur doit regarder en premier et ce qu'il
doit faire ensuite, l'écran n'est pas conçu (`PRODUCT.md` principe 7).

**Interdit** : deux actions primaires de même poids visuel dans une même vue ; un écran dont le
titre ne dit pas la question (« Tableau de bord » ne dit rien, « Ce qui est en retard » dit tout).

**Exemple.** Sur un bon KDS, la question est *« est-ce prêt ? »*. `Prêt` est le seul bouton plein.
`Rappeler` est un bouton discret. `Annuler la ligne` vit dans un menu de dépassement. Trois actions,
un seul poids visuel dominant.

### R-D2 — La règle du geste compté

> **Trois gestes maximum, depuis l'écran d'accueil du rôle, pour toute action du service.**

Koffi *« n'utilisera jamais quelque chose qui demande plus de trois gestes »*. Ce n'est pas une
préférence, c'est le mode d'échec numéro un des logiciels de restauration : le personnel les
contourne (`PRODUCT.md` §10.1, *A1*).

Les quatre parcours qui doivent tenir en trois gestes, mesurés au chronomètre en recette :
ajouter un article connu à une table · marquer un bon prêt · encaisser en espèces le compte juste ·
signaler une rupture de stock.

**Interdit** : une confirmation modale sur le chemin nominal du service ; un sélecteur de quantité
qui demande d'ouvrir un menu pour mettre « 2 » ; un retour à la liste après chaque ajout.

### R-D3 — La règle du statut à trois signaux

> **Couleur + forme + mot. Jamais moins.**

C'est l'exigence WCAG 1.4.1, mais la raison ici est plus prosaïque : les dalles bon marché ont un
gamut étroit, la cuisine a un éclairage jaune, et huit pour cent des hommes distinguent mal le rouge
du vert.

| Statut | Forme | Couleur | Mot |
|---|---|---|---|
| En attente | `○` cercle vide | neutre | « En attente » |
| En préparation | `◐` disque à moitié | ambre | « En préparation » |
| Prêt | `●` disque plein | vert | « Prêt » |
| En retard | `▲` triangle | rouge | « En retard » |
| Annulé | `✕` croix | neutre barré | « Annulé » |

**Interdit** : une pastille ronde colorée seule ; deux statuts qui ne diffèrent que par la teinte ;
une ligne de tableau dont le seul indice d'anomalie est un fond rosé.

### R-D4 — La règle de la densité honnête

> **La densité se gagne sur les marges, jamais sur les cibles.**

Le piège évident, quand on nous demande une vue « dense », est de réduire les boutons. C'est
exactement l'inverse de ce qu'il faut faire : `PRODUCT.md` §5 demande de la densité *d'information*,
pas de la miniaturisation de l'interaction.

La densité s'obtient sur : le rembourrage horizontal, l'écart entre frères, la taille du texte, la
suppression des bordures verticales, la fusion de colonnes. **Jamais** sur : la hauteur de cible, la
zone cliquable, l'anneau de focus.

**Plancher absolu** : 44 px en Exploitation, 56 px en Salle, 72 px sur le KDS. Une cible peut être
visuellement plus petite que sa zone active (un `×` de 24 px dans une zone de 44 px) — c'est la
seule façon admise de « réduire » un contrôle.

**Interdit** : un bouton d'action de 32 px dans une ligne de tableau ; deux cibles adjacentes sans
au moins 8 px entre elles.

### R-D5 — La règle de l'état réel

> **L'interface n'affiche jamais un état que le serveur n'a pas confirmé.**

Directement issue de `ARCHITECTURE.md` §12 et du §71 du brief : *« jamais "commande envoyée" tant
que le serveur n'a pas confirmé »*. Trois états, trois rendus **visuellement distincts**, pas trois
nuances du même :

| État | Rendu | Ce que l'utilisateur peut faire |
|---|---|---|
| **Envoi…** | Bouton figé, libellé « Envoi… », indicateur circulaire de 16 px **dans le bouton** | Attendre. Le bouton n'est pas cliquable deux fois (*R7*, *D-010*) |
| **En attente de confirmation** | Bande `warning-50`, icône `◐`, libellé « En attente de confirmation — reprise dès le retour du réseau » | Voir la file, l'annuler tant qu'elle n'est pas partie |
| **Envoyé** | Bande `success-50`, icône `●`, horodatage réel renvoyé par le serveur | Suivre |

**Interdit** : le rendu optimiste sur une commande, un paiement ou une clôture ; une coche verte
posée avant la réponse ; un horodatage calculé côté client.

### R-D6 — La règle du montant vérifiable

> **Un montant s'affiche entier, en chiffres tabulaires, avec sa devise, à côté de ce qui l'explique.**

*« L'argent ne se devine pas »* (`PRODUCT.md` principe 3). Un montant qui ne se vérifie pas d'un
coup d'œil est un montant qu'on soupçonne — et P2 dit que c'est exactement ce qui fait perdre la
confiance.

- Jamais d'abréviation : `12 500 F`, jamais `12,5 k`.
- Jamais d'arrondi à l'affichage. L'entier est stocké en unité mineure (*D-004*) et affiché tel quel.
- Chiffres tabulaires **toujours**, pour que les colonnes s'alignent et qu'un zéro de trop se voie.
- Un total est toujours à un geste de son détail.
- Un écart s'affiche **même quand il vaut zéro** : « Écart : 0 F » est une information ; un vide
  n'en est pas une.
- Un montant négatif (remboursement, geste commercial) porte son signe **et** son mot, jamais
  seulement une couleur rouge.

**Interdit** : un total sans détail atteignable ; un montant en police proportionnelle dans une
colonne ; une devise sous-entendue.

### R-D7 — La règle de la photo qui nourrit

> **Une photo n'est affichée que si elle est réellement celle du plat.**

La photo est le contenu principal de la Salle. C'est aussi ce qui coûte le plus cher en octets sur
une 4G instable. Elle doit donc rendre un service exact.

**Interdit** : une photo de banque d'images ; une icône d'assiette générique en guise de repli ; un
cadre gris vide ; un assombrissement pour poser du texte par-dessus ; un `alt` vide ou « photo de ».

**Repli** : un bloc typographique dessiné (initiale du plat en grège sur `surface-2`), et si une
section compte **moins de 40 % de plats photographiés**, la section entière bascule en **liste sans
image**. Mieux vaut une belle liste qu'une grille majoritairement vide.

### R-D8 — La règle du chemin de secours

> **Aucun écran d'exploitation ne se retrouve sans action possible.**

*« Le service ne s'arrête pas parce que le logiciel hésite »* (`PRODUCT.md` principe 2). Un écran
d'erreur qui ne propose que « Réessayer » abandonne Mariam avec un client qui attend.

Hors ligne, permission manquante, erreur serveur, imprimante morte : l'écran dit **ce qu'il reste à
faire à la main**, et comment ce sera enregistré ensuite.

**Exemple.** Réseau coupé pendant un encaissement (cercle 3 de *A4*, jamais hors ligne) :

> **Connexion perdue — le paiement ne peut pas être enregistré maintenant.**
> Encaissez en espèces et notez le montant. Dès le retour du réseau, ouvrez la table et saisissez le
> paiement : l'horodatage de la saisie sera conservé.
> `[ Réessayer ]` `[ Voir la table ]`

**Interdit** : un écran d'erreur sans issue ; un message technique brut ; un blocage silencieux.

---

## 5. Système Salle (`guest`)

`data-density="guest"` · `components/guest/` · routes `/r/:venueSlug/t/:token` et `/menu/:venueSlug`

**Contexte physique.** Téléphone tenu à une main, souvent d'une seule, à table, dans une lumière
variable, avec du bruit et de la conversation autour. Batterie basse. Réseau moyen. **Aucun compte,
jamais** — ni pour consulter, ni pour commander (`PRODUCT.md` §7.1).

**Budget de performance, opposable.** Première image utile du menu ≤ **1,8 s** sur Android
d'entrée de gamme en 4G bridée à 1,6 Mbit/s avec 300 ms de latence. HTML + CSS critiques ≤ **40 Ko**
compressés. Images au-dessus de la ligne de flottaison ≤ **180 Ko** au total. JavaScript avant
interaction ≤ **120 Ko** compressés. **Un dépassement est un défaut bloquant, pas une dette.**

### 5.0 L'apparence du restaurant (T7.a, D-149 à D-167)

La carte client porte **la couleur et le logo du restaurant, et rien d'autre** : ni gabarit, ni
police, ni mode sombre par établissement.

- **La couleur** est celle que le restaurant saisit, rendue lisible à l'enregistrement : même
  teinte, clarté OKLCH abaissée jusqu'à 4,5:1 sur trois paires (couleur sur fond, texte clair sur
  couleur, ce texte à 80 %). Elle arrive dans la page par un `<style>` sur `:root`
  (`--primary`, `--ring`), sans JavaScript. Sans couleur choisie, c'est celle de Joliba.
- **Elle ne marque que deux choses** : le « + » d'ajout et la section qu'on lit (D-166). Le nom, les
  prix, les titres restent dans la couleur du texte : une couleur vive ne doit pas crier partout.
- **Le logo** : 48 px, sur une pastille blanche bordée d'un filet, à gauche du nom ; PNG ou WebP de
  256 px au plus, 20 Ko au plus, sans SVG.
- **Le nom** en casse normale, gras, 28–32 px ; les titres de section en 20 px gras, sur un filet
  fin, sans rang. Sections et cartes publiées sont **soulignées**, jamais remplies.
- **La devise est écrite une fois** (« Prix en F CFA ») au-dessus de la liste ; chaque prix de la
  liste n'affiche que ses chiffres. La fiche, le panier et toute pièce gardent le montant complet.
- **L'écran Apparence** (Réglages › Apparence, et l'étape « Votre marque » de la mise en route) montre
  la vraie carte dans un cadre de 390 px, qui suit la saisie avant l'enregistrement.

> Ce qui suit (§5.1 et au-delà) décrit la cible d'origine. Là où la carte livrée en diffère — lignes
> de plat plutôt que grille, prix en couleur du texte —, c'est UI.7 (D-161) et D-166 qui font foi.

### 5.1 Carte produit (`DishCard`)

Deux formes, jamais trois.

**Forme A — grille (section avec photos)**

```
┌──────────────────────────┐  largeur : 1 colonne < 600 px, 2 colonnes ≥ 600 px
│                          │  photo 4:3, radius lg (18px) en haut seulement
│      photo 4:3           │  fond de repli = couleur dominante extraite (7 octets)
│                          │  jamais de voile, jamais de texte par-dessus
├──────────────────────────┤
│ Poulet braisé      17 px │  nom 17px/600 ink · prix 17px/600 ink, aligné à droite, tabulaire
│ Riz, alloco, piment      │  description 15px/400 ink-2, 2 lignes max, puis « Voir plus »
│ ⚠ Arachide · 🌶 Piquant   │  marqueurs 13px/500, pastille surface-2, radius full
│                     ┌──┐ │  bouton « + » 56×56 px, accent-600, coin bas-droit
└─────────────────────┴──┘ │
```

- Conteneur : `surface`, `radius-lg`, `shadow-e1`, bordure `line` de 1 px.
- **Toute la carte est cliquable** et ouvre le bottom sheet de détail. Le `+` est un raccourci qui
  ajoute la variante par défaut **sans ouvrir le sheet** — c'est le geste de R-D2 pour Aïcha qui
  recommande un Coca.
- Si l'article n'a **aucune option obligatoire**, `+` ajoute directement. Sinon, `+` ouvre le sheet
  avec le focus sur la première option.

**Forme B — liste (section sans photos, ou < 40 % de photos, R-D7)**

Ligne de 72 px : vignette 1:1 de 56 px **si elle existe**, nom 17 px, description sur une ligne
tronquée, prix aligné à droite, `+` de 44 px. Pas d'ombre, séparateur `line` de 1 px.

**États obligatoires de la carte**

| État | Rendu |
|---|---|
| Disponible | Tel que ci-dessus |
| **Indisponible** | Photo à 55 % d'opacité, **ruban `surface-2` en travers portant le mot « Épuisé »**, prix conservé, `+` remplacé par un texte `ink-3` « Épuisé ». La carte reste cliquable pour lire la composition. *Jamais masquée* : un plat qui disparaît donne l'impression d'une carte pauvre |
| Déjà au panier | Badge `accent-100` / `accent-700` « ×2 » à la place du `+`, et un `−` apparaît. Les deux font 44 px |
| Nouveau | Puce `accent-50` / `accent-700` « Nouveau ». Une seule puce par carte, jamais deux |
| Chargement | Squelette **à la forme exacte** de la carte, ≤ 2 s (voir §10) |

> **R10 se joue ici.** Un article devenu indisponible pendant qu'il est au panier est signalé
> **avant** l'envoi : bandeau `warning` en tête du panier, ligne concernée barrée, et le bouton
> « Envoyer » devient « Retirer et envoyer ». Jamais une découverte après coup.

### 5.2 Détail en bottom sheet (`DishSheet`)

**Bottom sheet, pas modale.** Le pouce est en bas de l'écran ; une modale centrée oblige à changer
de prise. Voir §9.3 pour l'arbitrage général.

- Hauteur : `max-content`, plafonnée à **85 vh**. Rayon `lg` en haut seulement. `shadow-e2`.
- Poignée de **32 × 4 px**, `line-2`, centrée, à 8 px du bord — elle annonce le glissement.
- Photo en tête, plein format 4:3, **non rognée**, sans texte dessus.
- Fermeture par : glissement vers le bas, bouton `×` de **44 × 44 px** en haut à droite, tap sur le
  voile, touche `Échap`.
- **Le pied du sheet est collant** : prix récapitulé à gauche (tabulaire, 20 px), bouton
  « Ajouter — 3 500 F » à droite, hauteur 52 px, `accent-600`. Le montant est **dans le libellé** :
  R-D6, on ne fait pas deviner ce qu'on ajoute.
- Variantes et suppléments : cases et boutons radio de **52 px**, libellé à gauche, supplément de
  prix à droite (`+ 500 F`, tabulaire, `ink-2`). Une option à 0 F n'affiche **rien** — pas « + 0 F ».
- Instruction libre : champ de texte, 3 lignes, 240 caractères, avec le compteur **seulement après
  200** (un compteur permanent est du bruit).
- Le sheet **piège le focus**, restitue le focus à la carte d'origine, et pose `aria-modal`.

### 5.3 Panier persistant (`CartDock`)

C'est l'objet qui porte la promesse du produit côté client : **on voit ce qu'on a composé, tout le
temps.**

- **Barre collante en bas**, `z-dock`, au-dessus de la barre de navigation basse, hauteur **64 px**.
- Contenu : `● 3 articles` à gauche (pastille `accent-600`, chiffre blanc), **total tabulaire à
  droite**, chevron. Toute la barre est cliquable.
- Elle **n'apparaît pas** quand le panier est vide. Elle n'est jamais une bulle flottante ronde :
  une bulle cache du contenu et ne dit pas le total.
- Au tap : sheet du panier — lignes modifiables (`−` / quantité / `+`, tous à 44 px), sous-total,
  taxes si l'établissement les affiche, **total en 24 px tabulaire**, puis l'action d'envoi.
- **Le libellé du bouton d'envoi dépend du mode de service (*D-011*)**, il n'est jamais générique :

| Mode (`Axe 1` × `Axe 2`) | Libellé | Ce qui suit |
|---|---|---|
| `guest_direct` + `post_paid` | **« Envoyer en cuisine »** | R-D5 : Envoi… → Envoyé |
| `guest_with_approval` | **« Envoyer au serveur »** | État « En attente de validation », nom du serveur affiché dès qu'il prend la main (*A2*) |
| `staff_only` | **« Appeler le serveur »** | Le panier devient une note que le serveur reprend |
| `pre_paid` (quel que soit l'axe 1) | **« Payer et envoyer — 12 500 F »** | *R8* : aucun bon de production avant confirmation |

- Le bouton est **désactivé pendant l'envoi** et porte une clé d'idempotence : un double tap ne crée
  qu'une commande (*R7*, *D-010*).

### 5.4 Barre de navigation basse (`GuestTabBar`)

- Hauteur **56 px** + zone de sécurité, `z-dock`, fond `surface`, bordure haute `line`.
- **Trois destinations, jamais plus** : **Carte** · **Ma commande** · **Addition**. Un quatrième
  onglet est le signe qu'une destination n'a pas sa place là.
- Chaque onglet : icône 24 px + **libellé 11 px toujours visible**. Un onglet sans libellé est une
  devinette. La cible fait 56 px de large minimum.
- Actif : icône et libellé en `accent-600`, **plus un trait de 3 px en haut de l'onglet**
  (couleur + forme, R-D3).
- **Badge** sur « Ma commande » quand un état change (plat prêt), sur « Addition » quand un montant
  est dû. Le badge porte un chiffre, pas un point.
- Bouton unique de demande de service, **flottant à droite au-dessus de la barre**, 56 px, rond,
  `surface` + bordure `line-control` : au tap, un sheet de trois choix de **56 px** — *Appeler le
  serveur* · *Apporter de l'eau* · *Demander l'addition* (P3 : « ne jamais devoir lever la main »).

### 5.5 États de commande (`OrderTimeline`)

Ce que la cliente doit obtenir, c'est *savoir*. La ligne de temps est la réponse de P3.

```
●━━━━━━━━●━━━━━━━━◐- - - - - ○- - - - - ○
Envoyée   Reçue    En cuisine  Prête    Servie
19:42     19:42    19:43
```

- Étapes atteintes : disque plein `success-600`, trait plein. Étape en cours : disque à moitié
  `warning-600`, **libellé en gras**. Étapes à venir : cercle vide `line-2`, trait pointillé.
  (Couleur + forme + mot : R-D3.)
- **Horodatage réel** sous chaque étape atteinte, renvoyé par le serveur (R-D5). Jamais de compte à
  rebours estimé côté client : une promesse de temps qu'on ne tient pas est pire que pas de promesse.
- `partially_ready` (*R12*) a son propre rendu : **« Prêt : entrée · En cuisine : plat »**, par
  service (`course`), pas un statut global flou.
- À l'état `Prête`, le libellé change de ton et devient une information utile :
  **« Prêt — votre serveur arrive »**. Pas une notification, pas un son : la cliente est à table.
- Une commande annulée reste visible, barrée, avec son motif (*R9*). Elle ne disparaît jamais.

### 5.6 Partage d'addition (`SplitSheet`)

Différenciateur identifié (`competitive-analysis.md` §6.4 : *« rien dans le panel ne gère le partage
collaboratif en temps réel »*). Trois modes, un seul écran, bascule par onglets de 44 px.

| Mode | Interaction | Quand c'est le bon |
|---|---|---|
| **Par article** | Chaque ligne porte une rangée de pastilles de convives ; on tape la sienne pour se l'attribuer. Une ligne peut être partagée à plusieurs : le montant se divise et s'affiche en dessous, tabulaire | Quatre personnes, chacune a mangé autre chose |
| **Par personne** | Curseur de 2 à 12 parts, montant par part calculé **côté serveur** (*R14*), reste affecté à la première part (jamais perdu au centime) | On partage en parts égales |
| **Par montant** | Pavé numérique, montant libre plafonné au reste dû | Quelqu'un paie « ce qu'il peut » |

**Comment on distingue les convives — et pourquoi pas par la couleur.**
Une pastille ronde de 36 px portant **l'initiale** du convive, fond `surface-2`, texte `ink`. Le
convive **soi-même** est le seul mis en avant : fond `accent-600`, texte blanc, et le mot « Vous »
sous la pastille.

C'est délibéré. Attribuer une couleur par convive aurait créé six à douze teintes en concurrence
avec les trois couleurs sémantiques, sur un écran où l'on parle d'argent — et aurait été illisible
pour un daltonien. **L'initiale est un signe de forme, pas de couleur** (R-D3).

**Temps réel.** Plusieurs téléphones sur la même addition : l'attribution d'un convive apparaît chez
les autres en `m-base`, **sans déplacer la mise en page** (le montant change, la ligne ne bouge pas).
Une ligne déjà payée est verrouillée : fond `success-50`, `●` et le mot « Payé par K. ».
Une ligne en cours de paiement par quelqu'un d'autre est verrouillée aussi, avec « En cours — M. ».

**Paiement mixte (*D-019*).** Le pied affiche toujours **trois nombres** : `Total` · `Déjà réglé` ·
`Reste à payer`, en 20 px tabulaire, le reste en gras. Le reste peut être réglé en espèces auprès du
serveur, en Mobile Money, ou en ligne — et les trois cohabitent sur la même addition. Chaque
paiement reçu apparaît en ligne avec son moyen, son montant et son heure.
**La somme allouée ne peut jamais dépasser le dû** (*R17*) : le champ est plafonné, pas corrigé
après coup.

---

## 6. Système Exploitation (`ops`)

`data-density="ops"` · `components/ops/` · routes `/app/*`

**Contexte physique.** Trois appareils très différents pour un même système : le **téléphone du
serveur** (360 px, une main, en marchant), la **tablette de la caisse** (900–1280 px, posée), le
**poste du gérant** (1280 px et plus, clavier et souris). Le même composant doit tenir les trois.

**Ce qui change par rapport à la Salle** : le texte descend à 15 px, les écarts à 8 px, les rayons à
12 px, les ombres disparaissent presque, les libellés se raccourcissent. **Ce qui ne change pas** :
les cibles restent à 44 px (R-D4), le contraste reste identique, les six états restent obligatoires.

### 6.1 Plan de salle (`FloorMap`)

C'est la page d'accueil du serveur et du gérant pendant le service. Elle répond à
*« où faut-il aller maintenant ? »*.

**Objet Table** — carré de **88 × 88 px** (≥ 900 px) ou **72 × 72 px** (téléphone), `radius-md`,
positionné selon la zone (`serviceArea`).

```
┌────────────┐   ligne 1 : numéro de table, 24px/700, tabulaire
│    12      │   ligne 2 : couverts + durée d'occupation, 13px, ink-3
│  4p · 38′  │   ligne 3 : montant en cours, 15px/600 tabulaire — ou rien si 0
│  14 500 F  │
│▲           │   coin haut-gauche : glyphe de statut (R-D3), 16px
└────────────┘   bordure : 2px, couleur du statut
```

| Statut de session | Fond | Bordure | Glyphe | Mot au survol |
|---|---|---|---|---|
| Libre | `surface` | `line` 1 px | — | « Libre » |
| Occupée, rien à faire | `surface` | `line-control` 2 px | `●` | « Occupée · 38 min » |
| **Attend quelque chose** (plat prêt, demande) | `warning-50` | `warning-600` 2 px | `◐` | « Plat prêt à porter » |
| **En retard** (demande > seuil, commande > seuil) | `danger-50` | `danger-600` 2 px | `▲` | « Demande depuis 6 min » |
| Addition demandée | `accent-50` | `accent-600` 2 px | `◆` | « Addition demandée » |
| Fermée aujourd'hui | `surface-2` | `line` 1 px | `✕` | « Clôturée 20:14 » |

- **Un seul statut affiché à la fois**, par ordre de gravité décroissante. Une table qui est à la
  fois « plat prêt » et « addition demandée » affiche le plus urgent, et le nombre `2` dans un badge.
- **Ce n'est pas un éditeur.** Le plan est en lecture ; l'édition des positions est un mode distinct,
  atteint par un bouton explicite, avec une grille visible et une sauvegarde manuelle.
- **Sur téléphone** (< 900 px), le plan n'est pas « écrasé » : il devient la **liste de tables**
  (§6.2), avec un sélecteur de zone en haut. C'est une recomposition, pas une réduction.
- Zoom : molette et pincement, entre 50 % et 150 %. Un bouton « Ajuster » ramène à la vue complète.
  Jamais de plan qui déborde sans possibilité de tout voir.

### 6.2 Liste de tables (`TableList`)

La forme du plan de salle sur téléphone, et la vue par défaut du serveur.

Ligne de **72 px** (plus haute que la ligne de tableau standard : on la touche en marchant) :

```
┌───────────────────────────────────────────────────┐
│ ▲  Table 12 · Terrasse              14 500 F   ›  │  72px
│    4 couverts · 38 min · Koffi                    │
│    Plat prêt depuis 4 min                         │  ← ligne d'action, couleur du statut
└───────────────────────────────────────────────────┘
```

- **Tri par urgence, pas par numéro.** C'est le point entier de l'écran : ce qui attend le plus
  longtemps remonte. Le numéro de table est une identité, pas un ordre de travail.
- Filtres en haut, puces de **44 px** : *Mes tables* (défaut) · *Toutes* · *Attendent* · *Libres*.
  La puce active est `accent-600` plein, **avec le compte** : « Attendent (3) ».
- Glissement horizontal facultatif (voir §7.4 pour la doctrine des gestes) : vers la droite →
  « Prendre en charge », vers la gauche → « Demander l'addition ». **Chaque geste a aussi un bouton**
  dans la fiche de la table. Aucun geste n'est le seul chemin.
- La ligne d'action (`Plat prêt depuis 4 min`) porte la couleur du statut **et** son glyphe en tête
  de ligne. Jamais le fond de la ligne entière en couleur : au coup de feu, six lignes colorées ne
  hiérarchisent plus rien.

### 6.3 Fil de commandes (`OrderFeed`)

Vue du gérant et du serveur : ce qui circule, en ce moment.

- **Flux inversé chronologique**, groupé par table, `row-h` 44 px par ligne d'article.
- L'en-tête de groupe est collant (`z-sticky`) : `Table 12 · Commande #48 · 19:42 · Koffi`.
- Une nouvelle commande **entre par le haut** en `m-base`, sans déplacer ce que l'utilisateur est en
  train de lire : si le fil n'est pas en haut, un bandeau apparaît — **« 3 nouvelles commandes ↑ »**,
  cliquable. On ne vole jamais le défilement de quelqu'un.
- Chaque ligne : glyphe de statut · nom d'article (15 px/500) · modificateurs (13 px `ink-2`, sur une
  seconde ligne si nécessaire) · quantité (tabulaire, à droite) · montant (tabulaire).
- Les **allergies déclarées** portent un fond `danger-50`, le glyphe `⚠` et le mot. Jamais en
  italique, jamais en petit.
- Filtre par station, par service (`course`), par statut. Les filtres actifs sont affichés en puces
  **supprimables individuellement** — et « Effacer les filtres » existe toujours.

### 6.4 Tableaux denses (`DataTable`)

Pour les cartes, les produits, l'équipe, les paiements, les sessions de caisse, les journaux.

| Élément | Valeur | Pourquoi |
|---|---|---|
| Hauteur de ligne | **44 px** | Le plancher de cible (R-D4). On ne descend pas |
| Rembourrage horizontal | 12 px | La densité se prend ici |
| En-tête | 40 px, collant, `surface-2`, texte `label` 13 px/500 `ink-3` | On sait toujours quelle colonne on lit |
| Séparateurs | Horizontaux 1 px `line`. **Aucune bordure verticale** | Les bordures verticales font du bruit et n'aident jamais |
| Survol | Fond `surface-2` | — |
| Sélection | Fond `accent-50` **+ liseré gauche de 3 px `accent-600`** | Couleur + forme (R-D3) |
| Colonnes de montants | Alignées à droite, tabulaires | R-D6 |
| Colonnes de dates | Alignées à gauche, tabulaires, format court `17 sept. 19:42` | — |
| Première colonne | Identité de la ligne, `ink`, 15 px/500 | — |
| Dernière colonne | **L'action suivante**, pas un menu `⋯` seul | R-D1 |

**Tri, filtre, pagination.** L'en-tête triable porte un chevron **visible en permanence à l'état
neutre** (opacité 40 %) — sinon on ne sait pas qu'une colonne est triable. Pagination : 50 lignes,
avec le total réel (« 1–50 sur 312 »), pas un défilement infini sur un écran d'exploitation où l'on
cherche une ligne précise.

**Sous 900 px, le tableau n'est pas comprimé : il devient une liste.** C'est exactement l'interdit
du §117 (« tableaux desktop écrasés sur mobile »).

> **Le test à passer avant de coder un tableau** : *nommer les trois champs qui survivent sur
> téléphone.* Si on ne sait pas les nommer, le tableau n'est pas conçu, et la version mobile sera
> un défilement horizontal — c'est-à-dire un échec.

La ligne mobile fait 72 px : **identité en gras**, deux à trois métadonnées sur une seconde ligne,
**l'action suivante** à droite. Ni carte empilée, ni défilement horizontal, ni colonne repliée
derrière un « + ».

### 6.5 Barre de commandes (`CommandBar`, ⌘K)

- Ouverture : `⌘K` / `Ctrl K`, **et un bouton visible de 44 px dans l'en-tête** — Koffi est sur un
  téléphone, il n'a pas de clavier. Un raccourci clavier n'est jamais le seul chemin.
- Panneau centré, largeur 560 px (ou pleine largeur sous 600 px), `shadow-e2`, `z-popover`.
- Champ de recherche de 52 px en tête, focus automatique, indication de saisie :
  **« Table, commande, article, ou une action… »**.
- **Les verbes d'abord.** On tape « prêt » et on obtient « Marquer prêt : Table 12 — Poulet braisé »,
  pas une page d'aide. Résultats groupés, en-têtes de groupe de 13 px `ink-3` :
  *Aller à* · *Faire* · *Chercher*.
- **Sept résultats visibles au maximum**, le reste au défilement. Chaque résultat affiche son
  raccourci s'il en a un, en pile monospace système, `ink-3`.
- Navigation : `↑` `↓`, `Entrée` exécute, `Échap` ferme, `Tab` complète la première suggestion.
- **Aucune action financière ni destructive n'est exécutée directement depuis la palette.** Elle
  **amène à l'écran de confirmation** avec le contexte déjà rempli. Une palette est un accélérateur
  de navigation, pas un raccourci pour rembourser 20 000 F par erreur de frappe.
- Elle n'affiche que ce que l'appelant a le droit de faire (*D-003*, l'UI masque, le serveur décide).
  Une action sans permission n'apparaît pas — elle n'apparaît pas *grisée*, ce qui révélerait
  l'existence d'une fonction.

### 6.6 Formulaires (`Form`)

| Règle | Détail |
|---|---|
| **Une colonne** | Toujours. Deux colonnes ne servent qu'à faire tenir un formulaire mal découpé sur un écran large |
| **Libellé au-dessus** | Jamais à gauche (casse à 360 px), jamais seulement en indication de saisie (elle disparaît à la frappe) |
| Hauteur de champ | `var(--control-h)` = 44 px, `radius-sm`, bordure 1 px `line-control` (3,82:1) |
| Aide | Sous le champ, 13 px `ink-4` (4,92:1), **avant** la saisie, pas après l'erreur |
| **Validation** | **À la sortie du champ (`blur`), jamais à chaque frappe.** Une erreur qui apparaît pendant qu'on tape accuse avant d'avoir fini |
| Erreur | Bordure `danger-600` 2 px + glyphe `⚠` dans le champ + message 13 px `danger-700` en dessous. Trois signaux (R-D3) |
| Champ obligatoire | Les **optionnels** sont marqués « (facultatif) ». Marquer les obligatoires par un astérisque quand ils sont la majorité est du bruit |
| Enregistrement | **Bouton explicite**, collant en bas sur mobile. Pas d'enregistrement automatique sur des données d'argent ou de carte : on doit pouvoir abandonner |
| Bouton pendant l'envoi | Figé, libellé « Enregistrement… », clé d'idempotence (R-D5, *D-010*) |
| Après l'envoi | **La preuve est dans l'écran** : la ligne apparaît, la valeur change. Le toast, s'il existe, est en plus — jamais à la place (§9.7) |
| Montants | Champ à chiffres tabulaires, alignés à droite, devise en suffixe fixe **hors du champ**, `inputmode="numeric"` |
| Un formulaire long | Se découpe en sections avec titres — **pas en assistant multi-étapes**, sauf si chaque étape dépend réellement de la précédente (onboarding, clôture de caisse) |

---

## 7. Système KDS (`kds`)

`data-density="kds"` · `data-theme="dark"` par défaut · abonnement temps réel **scopé à la station**
(`ARCHITECTURE.md` §12) · aucun polling

**Contexte physique, à relire avant chaque décision de cette section.** Tablette d'entrée de gamme
(10 pouces, 1280 × 800, dalle médiocre, angle de vue étroit), fixée au mur ou posée au passe.
**Mains mouillées ou grasses.** Bruit permanent. Chaleur. Éclairage jaune ou contre-jour.
**Lecture debout, à environ un mètre.** Ibrahim *« doit voir en une seconde ce qui part
maintenant »* et il *« déteste les écrans lents »*.

Trois conséquences qui gouvernent tout le reste :

1. **Aucune ombre, aucune animation, aucun dégradé.** Un changement d'état est **instantané**.
2. **Aucun geste obligatoire.** Un doigt mouillé altère la capacitance : le glissement rate ou
   déclenche autre chose. Toute action a un bouton.
3. **Aucun élément décoratif.** Chaque pixel de cette dalle doit rendre visible un bon, un temps,
   ou une modification.

### 7.1 Carte de bon (`TicketCard`)

Un bon de production (`kitchenTicket`) = la part d'une commande destinée à **une** station (*R11*).
Largeur de colonne fixe **320 px**, quatre colonnes sur 1280 px, gouttière de 12 px.

```
┌────────────────────────────────────────┐  bordure 2px (4px si en retard)
│████████ EN RETARD ████████ 08px████████│  bandeau plein de gravité (§7.3)
├────────────────────────────────────────┤
│  T12          #48          ⏱ 12:04     │  table 32px/700 · n° 20px · minuteur 36px tabulaire
│  Koffi · Entrée                        │  17px ink-3
├────────────────────────────────────────┤
│  2 ×  Poulet braisé                    │  quantité 32px/700 · nom 24px/700
│       Bien cuit · sans piment          │  modificateur 18px/600 kds-soon
│       ⚠ ARACHIDE                       │  allergène 18px/700, aplat kds-late, texte encre
│                                        │
│  1 ×  Alloco                           │
├────────────────────────────────────────┤
│  [        PRÊT        ]      [ ⋯ ]     │  bouton 72px de haut · menu 72×72px
└────────────────────────────────────────┘
```

| Élément | Taille | Pourquoi cette valeur |
|---|---|---|
| Numéro de table | **32 px / 700** | C'est le premier repère cherché. Il doit être lisible de biais |
| Minuteur | **36 px / 700, tabulaire** | Le plus gros élément de la carte : c'est lui qui décide de l'ordre du travail |
| Quantité | **32 px / 700** | Confondre 1 et 2 refait une assiette. Elle est plus grosse que le nom |
| Nom d'article | **24 px / 700** | Plancher de confort à un mètre (voir ci-dessous) |
| Modificateur | **18 px / 600**, couleur `kds-soon` | C'est ce qu'on oublie. Il est coloré pour attirer, et jamais en gris |
| Allergène | **18 px / 700 sur aplat `kds-late`** (9,37:1) | *R28*, et une erreur ici est médicale |
| Bouton principal | **72 px de haut, pleine largeur** | Une main mouillée vise mal |
| Plancher absolu | **16 px** | Rien, sur un KDS, n'a le droit d'être plus petit |

> **D'où viennent 24 px et 36 px.** Sur une dalle de 10 pouces en 1280 × 800 (≈ 150 ppi), un
> caractère de 24 px a une hauteur de capitale d'environ **3 mm**. À un mètre, c'est le seuil du
> confort de lecture rapide ; en dessous, on se penche. Le minuteur à 36 px monte à ≈ 4,5 mm, ce qui
> le rend lisible **sans le regarder directement** — en vision périphérique, pendant qu'on dresse.
>
> **Le test de recette, et il est physique** : *se tenir debout à un mètre de la tablette, en
> cuisine, lumière allumée, et lire un bon sans se pencher.* Si on se penche, la taille est fausse.
> Ce test passe avant la mise en service d'une station. Aucune capture d'écran ne le remplace.

**Densité contre lisibilité — l'arbitrage.** Quatre colonnes de 320 px tiennent 1280 px. Chaque
colonne montre un bon **entier** ; on ne tronque jamais une liste d'articles. Un bon de plus de
six articles passe en **deux colonnes fusionnées (640 px)** avec les articles sur deux colonnes
internes, et porte la mention « Grande table ». Mieux vaut occuper deux places que de cacher une
ligne.

### 7.2 Minuteur (`TicketTimer`)

- Format `MM:SS` sous dix minutes, `MM min` au-delà. Chiffres tabulaires : la largeur ne bouge pas,
  donc le chiffre ne « saute » pas d'une seconde à l'autre — un chiffre qui saute attire l'œil pour
  rien, dix fois par minute, sur quatorze bons.
- **Il compte depuis l'horodatage serveur du bon**, jamais depuis l'arrivée dans le navigateur. Une
  tablette qui s'est rendormie ne doit pas repartir de zéro.
- Mise à jour **toutes les secondes**, par une seule horloge partagée pour tout l'écran (un
  `requestAnimationFrame` limité, pas quatorze `setInterval`) — c'est une décision de batterie et
  d'images par seconde sur une tablette à 60 €.
- Après « Démarrer », un **second minuteur** apparaît sous le premier, en 20 px : temps de
  préparation écoulé. Le premier reste le temps total depuis l'envoi, parce que c'est lui que le
  client attend.
- **Aucun compte à rebours.** On compte ce qui s'est écoulé, qui est un fait. On ne promet pas un
  temps restant, qui serait une invention (`PRODUCT.md` principe 6).

### 7.3 Gravité du retard (`TicketSeverity`)

Quatre niveaux, calculés contre le **temps cible de la station** (réglage d'établissement, pas une
constante).

| Niveau | Seuil | Bandeau | Bordure | Minuteur | Mot | Position dans la file |
|---|---|---|---|---|---|---|
| **À l'heure** | 0 → 60 % | `kds-ontime`, **4 px** | `dark-line-control` 2 px | 36 px `dark-ink` | — | Ordre d'arrivée |
| **Bientôt dû** | 60 → 100 % | `kds-soon`, **8 px** | `dark-warning` 2 px | 36 px `dark-warning` | « BIENTÔT » | Ordre d'arrivée |
| **En retard** | 100 → 150 % | `kds-late`, **8 px** + mot en encre | `dark-danger` 4 px | **40 px** `dark-danger` | « EN RETARD » | **Remonte en tête** |
| **Critique** | > 150 % | `kds-late`, **12 px** + mot en encre | `dark-danger` 4 px | **40 px** `dark-danger` | « CRITIQUE » | **Première place, épinglée** |

**Cinq signaux simultanés** : la couleur, l'épaisseur du bandeau, l'épaisseur de la bordure, la
taille du minuteur, le mot en toutes lettres — **et la position dans la file**, qui est le plus fort
de tous parce qu'il se lit sans lire.

> **Aucun clignotement, sur aucun niveau.** Trois raisons, dans l'ordre : un clignotement permanent
> est une animation décorative déguisée (§69 et §117 l'interdisent) ; WCAG 2.2.2 exige un moyen de
> l'arrêter dès qu'il dure plus de cinq secondes, et un KDS en rush dure des heures ; et surtout,
> une cuisine où quatre bons clignotent est une cuisine où plus rien n'attire l'œil. **La remontée
> en tête de file fait le travail, mieux et gratuitement.**

### 7.4 Gestes — et pourquoi il n'y en a aucun d'obligatoire

**Doctrine.** Chaque action du KDS a un **bouton**. Les gestes sont des accélérateurs facultatifs,
pour la main sèche d'un chef de partie qui connaît l'écran.

| Geste | Action | Garde-fou |
|---|---|---|
| Tap sur le bouton `PRÊT` (72 px) | Marquer prêt | Le chemin normal |
| Glissement horizontal sur le bon | Marquer prêt | **Seuil à 40 % de la largeur** de la carte. En dessous, la carte revient. Ce seuil élevé est délibéré : c'est ce qui empêche un frôlement de manche de valider un bon |
| Appui long (600 ms) | Ouvrir le détail (composition, notes, commande complète) | Sans déplacement du doigt |
| Tap sur le menu `⋯` (72 × 72 px) | Rappeler (*R13*), signaler une rupture, voir la commande | Jamais d'action destructive en premier dans le menu |
| Double tap | **Rien. Jamais.** | Un doigt mouillé produit des doubles contacts involontaires |

**Annulation — l'affordance la plus importante de l'écran.**
Après **toute** action de bon, un **bandeau de 72 px en bas de l'écran, pleine largeur**, pendant
**5 secondes** : « Table 12 marqué prêt — **ANNULER** ». Bouton d'annulation de 72 px.

Ce n'est **pas** un toast. Un toast dans une cuisine est un texte de 13 px dans un coin, pendant que
la personne regarde une assiette. Le bandeau occupe une place qu'on ne peut pas manquer, et il
disparaît tout seul. C'est l'application directe de l'interdit du §117 : *le toast n'est jamais
l'unique retour d'une action critique.*

Le rappel (`recall`, *R13*) reste possible après les 5 secondes : **le journal garde les deux
gestes**, la carte revient dans la file avec la mention « Rappelé · 20:41 » et son minuteur
d'origine.

### 7.5 Sons

Les yeux d'Ibrahim sont sur le passe, pas sur l'écran. Le son est le seul canal disponible — et le
plus facile à rendre insupportable.

| Événement | Son | Volume | Répétition |
|---|---|---|---|
| Nouveau bon | **Deux tons descendants, ≈ 880 → 660 Hz, 250 ms** | Réglable par station, 5 crans, mémorisé sur l'appareil | **Une fois. Jamais.** |
| Passage en « En retard » | **Un ton grave unique, ≈ 440 Hz, 400 ms** | Idem | **Une fois** |
| Tout le reste | **Aucun son** | — | — |

**Pourquoi des médiums et non un bip aigu.** Une cuisine est bruyante dans les aigus — vaisselle,
extracteur, minuteurs de four. Un bip aigu y est masqué, et c'est exactement la fréquence qu'emploie
déjà chaque appareil de la pièce : on ne saurait pas d'où il vient. Deux tons descendants dans le
médium se détachent d'un fond large bande et s'identifient comme « l'écran ».

**Règles fermes.**

- **Un son par événement. Jamais de son répétitif ni de rappel périodique.** Un son qu'on ne peut
  pas faire taire est un son qu'on débranche — et on débranche l'écran avec.
- Le muet est un réglage de station **de premier niveau**, pas enfoui dans des préférences.
- **Muet ⇒ repli visuel obligatoire** : un bandeau `kds-ontime` de 48 px en haut de l'écran,
  « 2 nouveaux bons », qui reste jusqu'à ce qu'un des deux soit démarré. Un canal qu'on coupe doit
  être remplacé, pas simplement perdu.
- Le son est déclenché par l'arrivée **confirmée par le serveur**, jamais par un rendu optimiste
  (R-D5). Un son pour rien détruit la confiance dans le son.

### 7.6 En-tête de station

Barre collante de **64 px**, `z-sticky`, fond `dark-surface`, séparateur bas 1 px :

`GRILLADES` (20 px/700) · `● 7 en cours` · `◐ 2 bientôt` · `▲ 1 en retard` · `⏱ moy. 9 min` ·
`[ ⚙ ]` (72 × 72 px)

- Le compteur de retard porte **couleur + glyphe + chiffre** (R-D3).
- La moyenne est sur **les 30 derniers bons**, pas sur la journée : elle doit refléter le rush en
  cours, sinon elle ne sert à rien.
- Les réglages (`⚙`) tiennent en une page à gros contrôles : **thème clair/sombre**, volume, temps
  cible, colonnes affichées, filtre par service (`course`). Pas de sous-menus.
- **Aucune session humaine sur cet écran** : c'est un appareil enrôlé (*A1*), révocable à distance.
  L'en-tête affiche donc la station, jamais un nom de personne.

---

## 8. Système Caisse (`ops`, variante)

Tablette posée ou poste fixe. **Le tactile reste prioritaire** même quand un clavier est présent :
Mariam encaisse debout, souvent d'une main, l'autre tenant des billets.

**Ce que Mariam doit obtenir** : *« une clôture qui s'explique, et un écart qu'elle peut
justifier »*. Tout l'écran est ordonné par cette phrase.

### 8.1 Addition (`CheckPanel`)

Disposition à deux colonnes au-dessus de 900 px, une colonne en dessous.

**Colonne gauche — les lignes** (`row-h` 44 px) : nom d'article, quantité, montant tabulaire à
droite. Les lignes déjà réglées passent en `ink-3` avec le glyphe `●` et le mot « Réglé ».
**Elles ne disparaissent pas** : une addition doit se relire en entier.

**Colonne droite — le pied, collant :**

```
Sous-total                          32 500 F     17px tabulaire
Remise (motif obligatoire)         − 2 000 F     danger-700, signe explicite
TVA 18 %                             5 490 F     si l'établissement l'affiche
─────────────────────────────────────────────
TOTAL                               35 990 F     30px/700 tabulaire
Déjà réglé                          20 000 F     success-700
RESTE À PAYER                       15 990 F     30px/700, encadré 2px accent-600
```

- Les trois nombres du bas sont **toujours** affichés, même quand « Déjà réglé » vaut 0 (R-D6).
- Chaque paiement reçu est une ligne : moyen · montant · heure · **qui a encaissé**. C'est la
  réponse directe à P2 (*« un serveur qui encaisse sans enregistrer »*) et à *R27*.
- Une addition ne se clôture pas s'il reste un dû (*R2*), sauf geste explicite : la modale demande
  un **motif d'au moins un mot**, la permission est vérifiée côté serveur, et l'action est
  journalisée avec son acteur.
- **Le mot « facture » n'apparaît nulle part** (*D-015*, *D-024*). Ce qui est remis au client
  s'appelle **ticket**. Le code dit `bills`.

### 8.2 Partage côté caisse (`SplitPanel`)

Même modèle que §5.6, vu de l'autre côté du comptoir. Trois différences :

1. **Le serveur peut attribuer pour un convive** qui n'a pas de téléphone — pastille « Espèces » au
   lieu d'une initiale.
2. **Le paiement mixte est la norme, pas l'exception** (*D-019*). Le panneau de paiement empile les
   moyens : `+ Ajouter un moyen` reste actif tant qu'il reste un dû.
3. **Le reste se recalcule côté serveur à chaque ajout** (*R14*, *R17*). Le champ de montant est
   **plafonné** au reste — pas corrigé après validation, ce qui laisserait croire une seconde que
   c'est accepté.

### 8.3 Pavé de paiement (`PaymentPad`)

```
┌───────────────────────────────┬──────────────────────────┐
│  RESTE À PAYER   15 990 F     │   7    8    9            │  touches 72×72px
│                               │   4    5    6            │  écart 8px
│  Reçu            20 000 F     │   1    2    3            │
│  ──────────────────────────   │   0   00    ⌫            │
│  À RENDRE         4 010 F     │                          │
│  40px/700 success-700         │  [10 000][5 000][2 000]  │  billets XOF réels
│                               │  [1 000 ][ 500 ][ APPOINT]│
├───────────────────────────────┴──────────────────────────┤
│  Espèces │ Wave │ Orange Money │ Carte │ + Autre         │  onglets 56px
├──────────────────────────────────────────────────────────┤
│  [            ENCAISSER  20 000 F            ]           │  64px, accent-600
└──────────────────────────────────────────────────────────┘
```

- **À rendre est le plus gros nombre de l'écran (40 px).** C'est la seule chose que Mariam regarde
  au moment de rendre la monnaie, et une erreur ici se voit le soir à la clôture.
- **Les raccourcis de billets sont les coupures réelles du franc CFA** : 10 000, 5 000, 2 000,
  1 000, 500. Plus une touche « APPOINT » qui pose le montant exact. Ce ne sont pas des valeurs
  décoratives : ce sont les six gestes qui couvrent la quasi-totalité des encaissements en espèces.
  *Ces coupures sont un réglage de devise, pas une constante* — une instance en XAF, GHS ou NGN a
  les siennes.
- **L'espèce est le premier onglet** (*D-025* : « espèces d'abord », vrai `PaymentProvider`).
  Ce n'est pas un repli, c'est le moyen majoritaire.
- Clavier physique, quand il existe : chiffres, `Entrée` encaisse, `Échap` annule, `+` ajoute un
  moyen, `F1`–`F6` posent les coupures. **Aucun de ces raccourcis n'est le seul chemin** (R-D4).
- Paiement en ligne : l'écran affiche **« En attente de confirmation »** et **n'encaisse pas** tant
  que le serveur n'a pas vérifié (*R15*, R-D5). Une redirection réussie n'est pas un paiement.
- `acceptedAmount` (*D-028*) : si le fournisseur a arrondi, **les deux montants sont affichés**
  — « Envoyé 15 990 F · Accepté 15 985 F · Écart −5 F ». On ne masque jamais un écart : il
  réapparaîtrait à la clôture, sans explication.

### 8.4 Clôture de caisse (`CashCloseFlow`)

C'est le seul assistant multi-étapes assumé du produit : chaque étape dépend réellement de la
précédente, et l'ordre protège contre l'auto-suggestion.

**Étape 1 — Compter.** Le système **n'affiche pas encore l'attendu**. Grille de saisie par coupure,
champs de 64 px, chiffres tabulaires, total cumulé en 30 px en bas.

> **Pourquoi masquer l'attendu.** Si l'on affiche « attendu : 247 500 F » avant le comptage, on
> compte jusqu'à ce que ça tombe juste. Masquer l'attendu est une décision de contrôle interne, pas
> d'ergonomie — et elle est le fondement de *R21*.

**Étape 2 — Comparer.** Trois nombres, à parts égales, de 30 px :

```
      ATTENDU              COMPTÉ                ÉCART
     247 500 F           246 000 F          − 1 500 F
                                            ▲ Manquant
```

- L'écart est **toujours** affiché, y compris à zéro (« Écart : 0 F · ● Conforme »).
- Un écart négatif est `danger-700` avec le glyphe `▲` et le mot « Manquant » ; positif,
  `warning-700`, `◆`, « Excédent ». Jamais la couleur seule (R-D3).
- Le détail de l'attendu est **dépliable sur place** : ouverture de fonds, encaissements en espèces,
  sorties, entrées. Un écart qu'on ne peut pas décomposer est un écart qu'on ne peut pas justifier.

**Étape 3 — Expliquer.** Champ de motif, **obligatoire dès que l'écart n'est pas nul**, minimum un
mot. Motifs fréquents proposés en puces de 44 px (« Rendu de monnaie », « Erreur de saisie »,
« Sortie non enregistrée ») — **et un champ libre qui reste obligatoire si aucune puce ne convient**.

**Étape 4 — Clôturer.** Récapitulatif complet, puis un bouton unique. La clôture est
**irréversible** : *R18* et *R21*. La modale le dit en une phrase — « Cette clôture ne pourra plus
être modifiée. Une correction se fera par une écriture. » — et ne demande **pas** de retaper un mot.

**Hors ligne : jamais** (cercle 3 de *A4*). L'écran affiche le message de R-D8 et propose de
compter quand même **en local, sans enregistrer**, pour ne pas faire recompter Mariam au retour du
réseau. Le brouillon est marqué « Non enregistré », en clair, tant qu'il ne l'est pas.

---

## 9. Composants partagés

`components/ui/` — **ces composants ne savent rien du métier** (`ARCHITECTURE.md` §9, règle 3).
Ils ne connaissent ni commande, ni addition, ni bon de production. Ils changent d'échelle par la
densité, jamais par une variante métier.

### 9.1 Bouton (`Button`)

Cinq variantes, une hiérarchie stricte. **Une seule action primaire par vue** (R-D1).

| Variante | Fond | Texte | Bordure | Quand — et seulement quand |
|---|---|---|---|---|
| `primary` | `accent-600` | blanc (6,76:1) | — | **L'action de l'écran.** Une par vue |
| `secondary` | `surface` | `ink` (17,81:1) | 1 px `line-control` (3,82:1) | Action réelle mais non principale |
| `quiet` | transparent | `ink-2` (9,12:1) | — | Action tertiaire, action de ligne dans un tableau |
| `danger` | `surface` | `danger-600` (5,98:1) | 1 px `danger-600` | Destructif **avant** confirmation |
| `danger-solid` | `danger-600` | blanc (5,98:1) | — | **Uniquement** le bouton de confirmation d'une modale destructive |

- Hauteur `var(--control-h)` : 52 px (Salle), 44 px (Exploitation), 64 px (KDS).
- Rayon `sm`. Rembourrage horizontal 20 px. Icône optionnelle de 20 px à **gauche** du libellé.
- Un bouton **n'est jamais seulement une icône**, sauf pour trois actions universelles —
  fermer, retour, plus — et alors il porte un `aria-label` et fait au minimum `var(--tap)`.
- **Le libellé est un verbe à l'infinitif, au contexte.** « Envoyer en cuisine », pas « OK ».
  « Encaisser 20 000 F », pas « Valider ». Un libellé qui ne dit pas ce qui va se passer est
  un défaut.

**Les sept états, tous obligatoires :**

| État | Rendu |
|---|---|
| `default` | Tel que ci-dessus |
| `hover` | Un cran plus foncé (`accent-700`), `m-fast` |
| `focus-visible` | Anneau 2 px `accent-600`, décalage 2 px, **plus un anneau blanc de 4 px** — visible même posé sur un aplat coloré |
| `active` | `accent-800`, **aucun déplacement ni changement d'échelle** (un bouton qui rétrécit sous un doigt mouillé disparaît sous le doigt) |
| `disabled` | Fond `surface-2`, texte `ink-disabled`, `cursor: not-allowed`. **La raison est toujours dite à côté**, jamais seulement par le grisé |
| `loading` | Libellé remplacé par « Envoi… », indicateur circulaire de 16 px à gauche, **largeur figée** (pas de saut de mise en page), non cliquable |
| `success` (transitoire) | Glyphe `●` + libellé court, 1,5 s, **puis retour au repos**. Uniquement si la preuve n'est pas ailleurs à l'écran |

### 9.2 Champ (`Field`) et Sélection (`Select`)

**Champ** — hauteur `var(--control-h)`, `radius-sm`, fond `surface`, bordure 1 px `line-control`
(3,82:1, satisfait 1.4.11), texte `ink` 15 px, indication de saisie `ink-4` (4,92:1).
Focus : bordure `accent-600` 2 px + anneau, **sans aucun déplacement de mise en page** (la bordure
passe de 1 à 2 px en compensant par le rembourrage). Erreur : bordure `danger-600` 2 px + glyphe
`⚠` à droite dans le champ + message `danger-700` 13 px en dessous.

**Sélection** — trois formes, choisies par le nombre d'options :

| Options | Forme | Pourquoi |
|---|---|---|
| 2 à 4 | **Groupe de boutons segmenté**, chaque segment ≥ `var(--tap)` | Tout est visible, un geste |
| 5 à 12 | **Liste déroulante native** (`<select>`) | Le sélecteur natif d'Android est plus rapide, plus accessible et **coûte 0 octet** de JavaScript. Sur un appareil d'entrée de gamme, c'est décisif |
| > 12 | **Liste de saisie semi-automatique** avec recherche, `z-popover`, lignes de `var(--tap)` | Une liste de 300 produits ne se parcourt pas |

Multi-sélection : cases à cocher dans une liste, **jamais** un champ à puces qui se réorganise à la
saisie. Sélection unique obligatoire : boutons radio, et **aucun n'est présélectionné** quand le
choix engage de l'argent.

### 9.3 Modale, bottom sheet, panneau latéral — lequel, et quand

C'est l'arbitrage qui produit le plus de mauvaises interfaces. Le §117 interdit *« une modale pour
chaque action »*. Voici la règle, sans zone grise.

| | **Bottom sheet** | **Panneau latéral** | **Modale** |
|---|---|---|---|
| **Quand** | Choisir ou composer, sur téléphone | Consulter ou modifier **sans perdre la liste** | **Une décision qui engage, et qui ne peut pas attendre** |
| **Largeur** | 100 % | 420 px (480 px si formulaire) | 480 px, plafonnée à 90 vw |
| **Voile** | Oui, `scrim` | **Aucun** | Oui, `scrim` |
| **Le fond reste utilisable** | Non | **Oui** | Non |
| **Fermeture** | Glissement bas, `×`, voile, `Échap` | `×`, `Échap`, ou ouvrir un autre élément | **Uniquement** un des deux boutons, ou `Échap` |
| **Exemples** | Détail d'un plat, options, partage, demande de service | Détail d'une commande pendant qu'on lit le fil ; fiche produit pendant qu'on lit la carte ; historique d'une table | Annuler une commande partie en production ; corriger un écart de caisse ; rembourser ; retirer un membre de l'équipe ; clôturer une session avec un dû |
| **Seuil** | < 900 px | ≥ 900 px | Toutes tailles |

**Le panneau latéral n'a pas de voile — c'est son intérêt entier.** Le gérant compare deux commandes
en cliquant l'une puis l'autre dans la liste ; le panneau change de contenu sans se fermer. Poser un
voile, ce serait en faire une modale large et perdre exactement ce qu'on cherchait.

**Anatomie d'une modale.** Titre = **la question** (« Annuler cette commande ? »). Corps = **la
conséquence, en une phrase, avec les faits** (« La commande #48 est en cuisine depuis 6 minutes.
2 articles seront retirés de l'addition. »). Deux boutons : `quiet` à gauche pour renoncer,
`danger-solid` **ou** `primary` à droite, **jamais deux boutons pleins**. Si l'action exige un
motif (*R9*, *R21*), le champ est **dans** la modale et le bouton reste désactivé tant qu'il est
vide — avec la raison affichée.

> **R-D-modale : « Une modale coûte une décision. »** Créer un produit, ajouter une table, modifier
> un prix : ce sont des **pages** ou des **panneaux**. Ce ne sont pas des modales. Une modale qui
> n'interrompt rien d'important a appris à l'utilisateur à cliquer « Confirmer » sans lire — et le
> jour où ça compte, il cliquera aussi.

### 9.4 Tableau

Spécifié en §6.4. Deux rappels de portée générale : **aucune bordure verticale** ; **sous 900 px, un
tableau devient une liste de lignes**, jamais un défilement horizontal.

### 9.5 Badge de statut (`StatusBadge`)

L'implémentation de R-D3. **Trois signaux, non négociables.**

- Hauteur 24 px (Exploitation) / 28 px (Salle) / 32 px (KDS), `radius-xs`, rembourrage 8 px.
- Composition : **glyphe** (12 px) + **libellé** (13 px/500). Fond `*-50`, texte `*-700` — chaque
  couple est vérifié à plus de 7:1 (§2.1).
- Le glyphe est un **caractère dessiné**, pas une icône décorative : `○` `◐` `●` `▲` `◆` `✕`.
  Il reste lisible à 12 px sur une dalle médiocre, là où une icône à trait fin s'efface.
- **Interdit** : un badge sans libellé ; un badge qui n'existe qu'en couleur de fond de ligne ;
  deux badges côte à côte pour le même objet (on affiche le plus grave et un compteur).

### 9.6 Notification

Trois formes, trois durées de vie. **Choisir la mauvaise est un défaut de revue.**

| Forme | Durée | z | Quand |
|---|---|---|---|
| **Toast** | 5 s, auto | `z-toast` | Confirmation **non critique et réversible** : « Filtre enregistré », « Article dupliqué ». 72 px de haut, bas de l'écran, une action au plus |
| **Bandeau d'annulation** | 5 s, auto | `z-toast` | Après une action **réversible mais conséquente** : bon marqué prêt, ligne supprimée d'un panier. Pleine largeur, 72 px, bouton « ANNULER » de `var(--tap)` |
| **Bandeau système** | **Tant que l'état dure** | `z-system` | État durable : hors ligne, mode simulation, caisse non ouverte, carte non publiée, abonnement expiré. En haut, 44 px, fond sémantique, texte + action |

> **L'interdit du §117, écrit en règle** : *une action critique ne se confirme jamais par un toast
> seul.* Un encaissement, un envoi en production, une clôture laissent une **trace persistante dans
> l'écran** — la ligne change d'état, le montant apparaît, le bon quitte la file. Le toast, s'il
> existe, vient en plus. Si l'on ne sait pas dire quelle trace persistante l'action laisse, l'écran
> n'est pas conçu.

Une notification n'apparaît **jamais** au-dessus de l'action qui vient de la déclencher. Le bandeau
système décale le contenu (il ne le recouvre pas) : sinon il masque la première ligne d'un tableau
pendant tout le service.

### 9.7 Les composants d'état

Un composant par état, partagé, jamais réécrit au cas par cas — voir §10 pour ce que chacun dit.
`EmptyState` · `ErrorState` · `ForbiddenState` · `OfflineState` · `LoadingState` · `SuccessState`.

Anatomie commune : **glyphe 32 px** (jamais une illustration : c'est des octets pour rien) ·
**titre 20 px/600** qui dit *ce qui se passe* · **corps 15 px `ink-2`, deux lignes maximum** qui dit
*pourquoi* · **une action primaire** et au plus une secondaire. Centré verticalement dans la zone
concernée — **pas dans la page entière** : un tableau vide dans un écran plein n'efface pas l'écran.

---

## 10. Les six états obligatoires de chaque écran

**Aucun écran n'est livrable tant que les six ne sont pas dessinés et atteignables.** Ce n'est pas
une liste de contrôle de fin de projet : c'est la définition de « terminé ». Les quatre derniers
sont ceux qu'on oublie, et ce sont ceux qu'un restaurant rencontre un vendredi soir.

### 10.1 Chargement

**Ce que l'écran doit dire** : que ça arrive, et à quoi ça va ressembler.

| Attente | Rendu |
|---|---|
| < 300 ms | **Rien.** Un squelette qui clignote 200 ms est plus désagréable qu'une attente |
| 300 ms – 2 s | **Squelette à la forme réelle du contenu** : mêmes hauteurs, mêmes colonnes, mêmes rayons. Fond `surface-2`, aucune animation de balayage (c'est du calcul pour rien sur un appareil d'entrée de gamme) |
| > 2 s | Le squelette **est remplacé** par un message : « Le réseau est lent. On continue d'essayer. » + `[ Réessayer ]` + un chemin de contournement |
| Donnée déjà en cache | **Aucun squelette.** Le menu hors ligne (cercle 1 de *A4*) s'affiche **immédiatement**, avec un bandeau système « Hors ligne — carte du 17 sept. 18:02 » |

**Interdits** : le squelette interminable (§117) ; l'indicateur circulaire en plein écran ; un
squelette qui n'a pas la forme du contenu (il ment sur ce qui arrive) ; un squelette qui remplace
une donnée **déjà affichée** lors d'un rafraîchissement — dans ce cas, l'ancienne valeur reste et un
indicateur discret de 16 px apparaît dans l'en-tête.

### 10.2 Vide

**Ce que l'écran doit dire** : que c'est normal, et quoi faire maintenant.

Distinguer **trois vides**, parce qu'ils appellent trois réponses opposées :

| Vide | Titre | Action |
|---|---|---|
| **Rien n'a jamais existé** | « Aucun produit dans cette carte » | `[ Ajouter un produit ]` — l'action primaire. Plus une porte de sortie utile : `[ Importer depuis un fichier ]` |
| **Un filtre a tout masqué** | « Aucune table ne correspond à ces filtres » | `[ Effacer les filtres ]`, **et le rappel du filtre en cause** : « Filtre actif : Terrasse » |
| **C'est vide et c'est une bonne nouvelle** | « Aucune commande en retard » | **Aucune action.** Un glyphe `●` `success-600` et rien d'autre. Un écran vide qui propose une action invente un problème |

**Interdits** : une illustration décorative ; un texte enjoué (« Oups, rien ici ! ») ; un vide qui
ne distingue pas ces trois cas.

**Les quatre vides réels du produit**, écrits en toutes lettres pour qu'ils ne soient pas improvisés :

| Écran | Titre | Corps | Action primaire |
|---|---|---|---|
| **Carte sans produit** | « Aucun produit dans cette carte » | « Ajoutez vos plats, ou importez-les depuis un fichier. La carte reste invisible aux clients tant qu'elle n'est pas publiée. » | `[ Ajouter un produit ]` · `[ Importer ]` |
| **KDS sans bon** | « Rien à préparer » | « Les nouveaux bons arrivent ici automatiquement. » **Glyphe `●` `dark-success`, 32 px.** Le minuteur moyen de la station reste affiché en en-tête | **Aucune.** Ibrahim n'a rien à faire : c'est l'information |
| **Plan de salle sans table** | « Aucune table dans cette zone » | « Créez vos tables pour générer leurs QR. » | `[ Ajouter une table ]` |
| **Caisse sans session ouverte** | « La caisse n'est pas ouverte » | « Déclarez le fonds de caisse pour commencer à encaisser. » | `[ Ouvrir la caisse ]` |

> **Sur le CTA d'un état vide.** Deux des quatre ci-dessus en portent un, et c'est la règle : un vide
> dit ce qu'il faut faire. **La seule exception est le vide qui est une bonne nouvelle** — un KDS sans
> bon, aucune commande en retard, aucun écart de caisse. Y placer un bouton inventerait un problème
> et apprendrait à Ibrahim que cet écran demande toujours quelque chose. Si l'on hésite, la question
> est : *l'utilisateur a-t-il un travail à faire ici ?* Si non, pas de bouton.

### 10.3 Erreur

**Ce que l'écran doit dire** : ce qui a échoué, si c'est grave, et comment continuer.

L'erreur est **typée** (`ConvexError` avec un code, `ARCHITECTURE.md` §12). L'interface **ne montre
jamais** le code brut, mais elle en dépend pour dire la bonne chose :

| Code | Titre | Corps | Actions |
|---|---|---|---|
| `ITEM_UNAVAILABLE` | « Poulet braisé n'est plus disponible » | « La cuisine vient de le signaler. Le reste de votre commande est intact. » | `[ Retirer et envoyer ]` · `[ Voir la carte ]` |
| `TABLE_CLOSED` | « Cette table a été clôturée » | « Le service s'est terminé à 20:14. » | `[ Ouvrir une nouvelle session ]` |
| `PERMISSION_DENIED` | voir §10.4 | | |
| Inattendue | « L'enregistrement n'a pas abouti » | « Rien n'a été modifié. Vous pouvez réessayer. » **+ identifiant de trace en pile monospace, copiable** | `[ Réessayer ]` · `[ Copier la référence ]` |

**« Rien n'a été modifié » n'est écrit que si c'est vrai.** Si l'on ne sait pas, on écrit ce qu'on
sait : « L'état n'a pas pu être confirmé. Rechargez la table avant de recommencer. » Mentir ici
produit un double encaissement.

**Interdits** : un message technique brut ; « Une erreur est survenue » sans suite ; une erreur qui
efface la saisie de l'utilisateur ; une erreur sur une action financière sans identifiant de trace
(*R27*, §92).

### 10.4 Permission refusée

**Ce que l'écran doit dire** : que c'est un droit manquant, pas une panne, et à qui le demander.

**Le cas le plus fréquent — Koffi n'a pas le droit d'encaisser.** Il ne voit tout simplement pas le
bouton « Encaisser » sur la fiche de sa table : il voit à la place l'action qu'il *peut* faire,
`[ Demander l'addition à la caisse ]`. R-D1 et R-D8 s'appliquent ensemble — l'écran reste utile, et
il n'apprend jamais l'existence d'une porte fermée.

**L'écran de refus ne se rencontre donc que par une URL directe ou un droit retiré en cours de
service** — par exemple Koffi qui a gardé l'onglet « Caisse » ouvert quand le gérant lui a repris
`payment.record` :

> **Accès non autorisé**
> Votre rôle (*Serveur*) ne permet plus d'encaisser sur **Maquis du Plateau**.
> Le montant dû est inchangé. Adressez la table à la caisse, ou demandez ce droit à un responsable.
> `[ Retour au plan de salle ]` · `[ Voir la table 12 ]`

Second exemple, pour montrer que la formule tient aussi sur une lecture :

> **Accès non autorisé**
> Votre rôle (*Serveur*) ne permet pas de consulter le chiffre d'affaires de l'établissement.
> Demandez ce droit à un responsable de **Maquis du Plateau**.
> `[ Retour au plan de salle ]`

- **L'UI masque, le serveur décide** (*D-003*). Une action sans permission **n'apparaît pas**.
  Cet écran ne se rencontre que par une URL directe ou un droit retiré en cours de session.
- **On nomme le rôle et l'établissement**, parce que Serge a quatre sites et que son manager de
  Marcory doit comprendre qu'il est au bon endroit avec le mauvais droit — ou l'inverse.
- **On ne révèle pas ce qui existe derrière.** Pas d'aperçu flouté, pas de chiffre grisé, pas de
  « Passez au plan supérieur pour voir ». La frontière d'organisation ne fuit pas (*R25*).
- `billing` **restreint, n'accorde jamais** (`ARCHITECTURE.md` §2) : un droit bloqué par
  l'abonnement dit « Cette fonctionnalité n'est pas incluse dans votre offre », ce qui est un
  message **différent** — et il propose une action commerciale, pas un contournement.

### 10.5 Hors ligne

**Ce que l'écran doit dire** : dans lequel des trois cercles on se trouve (*A4*,
`ARCHITECTURE.md` §12). C'est le seul état qui a trois rendus distincts.

| Cercle | Rendu | Texte |
|---|---|---|
| **1 — Lecture** | Bandeau système `warning`, 44 px, contenu **entièrement utilisable** | « Hors ligne — carte du 17 sept. 18:02. Les prix affichés sont ceux de cette version. » |
| **2 — File d'écriture** | Bandeau système + **chaque élément en attente porte son propre état** `◐` « En attente de confirmation » | « Hors ligne — 3 gestes en attente. Ils partiront au retour du réseau. » `[ Voir la file ]` |
| **3 — Refus explicite** | L'action est **bloquée**, avec le chemin manuel (R-D8) | « Connexion perdue — le paiement ne peut pas être enregistré maintenant. Encaissez en espèces et notez le montant ; saisissez-le au retour du réseau. » |

- **« En attente de confirmation » n'est jamais rendu comme « Envoyé »** (R-D5) : glyphe différent,
  couleur différente, mot différent. C'est le §71 mot pour mot.
- Au retour du réseau, rejeu ordonné. **En cas de conflit, l'état serveur gagne et l'utilisateur est
  prévenu** — par un bandeau persistant, pas un toast : « 1 geste n'a pas pu être appliqué : la
  table 12 était déjà clôturée. » `[ Voir ]`
- La file est **consultable et videable à la main**. Une file opaque est une file qu'on n'ose plus
  utiliser.

### 10.6 Succès

**Ce que l'écran doit dire** : ce qui s'est réellement passé, avec sa preuve.

- **La preuve est un changement d'état visible dans l'écran**, pas une notification (§9.6).
  Le bon quitte la file. La ligne passe en `● Payé`. Le montant « Reste à payer » tombe à 0 F.
- **Un succès financier affiche toujours son montant et son horodatage serveur.** « Encaissé
  20 000 F · 20:41 · Espèces · Mariam ». Quatre faits, parce que P2 dit que la confiance se perd
  sur les encaissements non attribués.
- **Pas de confettis, pas de coche animée en plein écran, pas de son côté client.** Un succès est un
  fait, pas une fête — et Aïcha est à table avec trois personnes.
- Succès **suivi d'une suite naturelle** : après un encaissement, l'action primaire de l'écran
  devient `[ Clôturer la table ]`. R-D1 s'applique aussi à l'après.

---

## 11. Iconographie et photographie

### 11.1 Icônes

- **Lucide**, déjà présent avec shadcn. Une seule bibliothèque : deux jeux d'icônes dans un produit
  se voient immédiatement.
- Tailles : **20 px** (Exploitation) · **24 px** (Salle) · **28 px** (KDS). Épaisseur de trait
  1,75 px, **2 px sur le KDS** (un trait fin s'efface sur une dalle médiocre à un mètre).
- **Une icône ne remplace jamais un libellé nécessaire.** Les seules exceptions, universelles :
  fermer, retour, plus. Elles portent un `aria-label`.
- Une icône **informative** (statut, alerte) atteint 3:1 contre son fond (WCAG 1.4.11). Une icône
  **décorative** porte `aria-hidden="true"` et n'a aucune exigence de contraste — mais alors elle
  doit justifier sa présence (north star : que rend-elle visible ?).
- **Les statuts utilisent des glyphes dessinés** (`○ ◐ ● ▲ ◆ ✕`), pas des icônes (§9.5).

### 11.2 Photographie — le contenu principal de la Salle

La photo de plat est **ce que le client regarde**, et **ce qui coûte le plus cher** sur une 4G
instable. Les deux se tiennent : une belle photo mal servie fait fermer l'onglet.

**Ratios — trois, pas plus :**

| Ratio | Emploi | Pourquoi |
|---|---|---|
| **4:3** | Carte de plat en grille | Le plat est rond dans une assiette ronde : le 4:3 le cadre sans le décapiter, contrairement au 16:9. C'est aussi le ratio natif de la plupart des téléphones — le restaurateur n'a rien à recadrer |
| **1:1** | Vignette en liste (56 px), ligne de panier, résultat de recherche | Un carré tient dans une ligne sans en changer la hauteur |
| **16:9** | Bandeau d'en-tête d'établissement, **un seul par page** | C'est du décor, donc c'est plafonné |

**Formats et poids — budget opposable :**

- **AVIF** en premier, **WebP** en repli, **JPEG** en dernier. `<picture>` avec `srcset`.
- Largeurs servies : **160 / 320 / 640 / 960**. Rien au-dessus : personne ne regarde un plat en
  1920 px sur un téléphone, et le restaurateur téléverse souvent un fichier de 4 Mo.
- **≤ 45 Ko** pour une carte 4:3 servie en 640 px. **≤ 180 Ko** pour l'ensemble des images
  au-dessus de la ligne de flottaison. Un dépassement est un défaut bloquant.
- `width` et `height` **toujours** posés en attributs : aucun décalage de mise en page pendant le
  chargement (une carte qui saute pendant qu'on vise le `+` fait commander le mauvais plat).
- `loading="lazy"` partout **sauf les deux premières** cartes ; `decoding="async"`.
- **LQIP = une couleur dominante**, extraite au téléversement et stockée avec le produit.
  Sept octets dans le HTML. **Pas de miniature floutée en base64** : c'est 300 à 800 octets par
  image, soit plus que ce qu'on économise.
- La **compression est faite au téléversement, côté serveur**, jamais à l'affichage. Le restaurateur
  téléverse ce qu'il a ; c'est notre travail de le rendre servable.

**Règles de fond (R-D7) :**

- **Jamais de photo de banque d'images.** Un plat qui n'est pas le plat est un mensonge sur la carte.
- **Jamais de voile ni de dégradé sur une photo pour y poser du texte.** Le texte vit **sous** la
  photo. C'est aussi ce qui garantit que le contraste du prix ne dépend pas de la photo du jour.
- **Repli sans photo** : bloc `surface-2` au bon ratio, **initiale du plat** en `title-2xl` `ink-3`
  centrée, et le nom de la section en `label` en dessous. Aucune icône d'assiette, aucun appareil
  photo barré, aucun cadre vide.
- **Seuil de bascule de section** : moins de 40 % des plats photographiés ⇒ la section entière passe
  en **liste sans image** (§5.1, forme B). Une grille aux trois quarts vide fait paraître le
  restaurant pauvre ; une liste soignée, non.
- `alt` = **le nom du plat**, rien d'autre. Ni « photo de », ni la description : un lecteur d'écran
  lit déjà le nom juste après.
- **Orientation et recadrage** : recadrage centré par défaut, avec un point focal ajustable à
  l'import. Un plat décapité par un recadrage automatique est le défaut le plus fréquent des cartes
  numériques.

---

## 12. Accessibilité — la liste, et comment on la vérifie

**Cible : WCAG 2.2 AA au minimum** (§68), avec **une exigence au-dessus de AA** : les cibles
tactiles suivent 2.5.5 (AAA, 44 px) et non 2.5.8 (AA, 24 px), parce que c'est le brief qui le
demande et parce qu'une main mouillée le demande plus encore.

### 12.1 La liste de vérification

| # | Critère | Seuil | Où c'est déjà réglé |
|---|---|---|---|
| 1 | Contraste du texte (1.4.3) | ≥ **4,5:1** ; ≥ 3:1 au-delà de 24 px ou 19 px gras | §2.1 — tous les jetons de texte calculés |
| 2 | Contraste hors texte (1.4.11) | ≥ **3:1** pour bordures de contrôle, glyphes de statut, anneaux de focus | `line-control` 3,82 · `dark-line-control` 3,81 |
| 3 | Taille de cible (2.5.5 AAA) | ≥ **44 px** ; 56 px Salle ; **72 px KDS** | R-D4, jetons `--tap` |
| 4 | Espacement des cibles | ≥ **8 px** entre deux cibles adjacentes | R-D4 |
| 5 | Focus visible (2.4.7, 2.4.11) | Anneau 2 px + décalage 2 px + anneau blanc 4 px ; **jamais masqué par un élément collant** | `:focus-visible` global |
| 6 | Ordre de focus (2.4.3) | Ordre de tabulation = ordre de lecture ; piège de focus **uniquement** en modale ; **retour du focus** au déclencheur | §9.3 |
| 7 | Tout au clavier (2.1.1) | **Exploitation et Caisse : 100 %.** Aucune action accessible seulement à la souris ou par un geste | §6.5, §7.4 |
| 8 | Pas de piège clavier (2.1.2) | `Échap` ferme toute surcouche | §9.3 |
| 9 | **Jamais la couleur seule** (1.4.1) | Couleur + forme + mot | R-D3, §9.5 |
| 10 | Mouvement réduit (2.3.3) | `prefers-reduced-motion` → 1 ms, glissements ⇒ instantané | §2.3 |
| 11 | Pas de clignotement (2.3.1, 2.2.2) | **Aucun clignotement nulle part**, y compris KDS critique | §7.3 |
| 12 | Zoom texte 200 % (1.4.4) | Aucune perte de contenu ni de fonction | Échelle en px + mise en page fluide |
| 13 | Espacement du texte (1.4.12) | Interligne 1,5×, mots 0,16em : rien n'est tronqué | Pas de hauteur fixe sur un bloc de texte |
| 14 | Orientation libre (1.3.4) | **Portrait et paysage** — un KDS mural peut être en portrait | §7 |
| 15 | Étiquettes (2.4.6, 3.3.2) | Libellé visible au-dessus, jamais l'indication de saisie seule | §6.6 |
| 16 | Identification des erreurs (3.3.1, 3.3.3) | Message texte + glyphe + suggestion de correction | §6.6, §10.3 |
| 17 | **Aide cohérente (3.2.6 — nouveau en 2.2)** | Le même accès à l'aide, à la même place, sur toutes les pages d'une surface | Pied de la Salle ; `⌘K` en Exploitation |
| 18 | **Authentification accessible (3.3.8 — nouveau en 2.2)** | Aucun test cognitif ; l'OTP se **colle** ; le PIN accepte le collage | *A1* |
| 19 | **Focus non masqué (2.4.11 — nouveau en 2.2)** | Aucune barre collante ne recouvre l'élément focalisé | `scroll-margin` sur les cibles focalisables |
| 20 | **Glissement annulable (2.5.2) et alternative au geste (2.5.1)** | Tout geste a un bouton ; tout glissement s'annule en revenant en arrière | §6.2, §7.4 |
| 21 | Langue (3.1.1) | `lang="fr"`, et `lang` sur les noms de plats d'une autre langue | — |
| 22 | Régions et titres | Un `<h1>` par écran, repères ARIA, **lien d'évitement** (`z-skip`) | — |
| 23 | Annonces temps réel | Changement de statut annoncé en `aria-live="polite"` ; **jamais `assertive`** sauf perte de connexion | §10.5 |

### 12.2 Ce qui est explicitement hors périmètre, et pourquoi c'est dit

Le mode contraste forcé de Windows (`forced-colors`) n'est **pas** une cible de la V1 : aucune
surface du produit ne tourne sur un poste Windows où il est activé. **On le note ici pour que ce
soit une décision, pas un oubli** — et parce que le jour où un gérant l'utilise, on saura qu'on ne
l'a jamais testé.

### 12.3 Comment on teste — six contrôles, dont trois automatiques

1. **Test unitaire sur les jetons (automatique, bloquant).** Le plus important, parce que c'est le
   seul qui empêche la dérive dans six mois. Il recalcule les ratios **depuis le fichier de jetons**
   et échoue si un couple descend sous son seuil. Pas de capture d'écran, pas d'appréciation.

   ```ts
   // tests/tokens/contrast.test.ts
   const PAIRES = [
     ["ink",          "bg",          4.5], ["ink-2",   "bg",         4.5],
     ["ink-3",        "bg",          4.5], ["ink-4",   "surface",    4.5],
     ["accent-600",   "surface",     4.5], ["surface", "accent-600", 4.5],
     ["accent-700",   "accent-50",   4.5], ["success-700", "success-50", 4.5],
     ["warning-700",  "warning-50",  4.5], ["danger-700",  "danger-50",  4.5],
     ["line-control", "surface",     3.0], ["line-control", "bg",        3.0],
     ["dark-ink",     "dark-bg",     4.5], ["dark-ink-3",  "dark-surface", 4.5],
     ["dark-accent",  "dark-surface",4.5], ["dark-line-control", "dark-surface", 3.0],
     ["dark-bg",      "kds-ontime",  4.5], ["dark-bg", "kds-soon", 4.5],
     ["dark-bg",      "kds-late",    4.5],
   ] as const;

   test.each(PAIRES)("%s sur %s ≥ %s:1", (avant, arriere, seuil) => {
     expect(contraste(jetons[avant], jetons[arriere])).toBeGreaterThanOrEqual(seuil);
   });
   ```

2. **`axe-core` en intégration continue (automatique, bloquant).** Sur les routes rendues, avec les
   six états de chaque écran (§10) montés en scénario. Un écran dont l'état d'erreur n'est pas
   testable est un écran dont l'état d'erreur n'existe pas.

3. **Vérification des tailles de cible (automatique).** Un test de rendu qui mesure les boîtes
   englobantes de tous les éléments interactifs et échoue sous `--tap`. C'est la seule façon
   d'empêcher un bouton de 32 px de revenir par une classe utilitaire.

4. **Parcours au clavier seul (manuel, recette de version).** Six parcours d'Exploitation, sans
   souris, sans toucher l'écran : prendre une commande · marquer prêt · encaisser · clôturer une
   caisse · inviter un membre · publier une carte. Si un parcours est impossible, la version ne sort
   pas.

5. **Test physique à un mètre (manuel, avant mise en service d'une station).** Décrit en §7.1. En
   cuisine, debout, lumière réelle. Il ne se simule pas.

6. **Test sur appareil réel (manuel, à chaque version).** Un Android d'entrée de gamme — **pas un
   émulateur, qui ment sur le processeur graphique et sur la dalle** — en 4G bridée à 1,6 Mbit/s
   avec 300 ms de latence. On mesure la première image utile du menu client contre le budget de
   §5. Plus TalkBack sur le parcours client complet, et VoiceOver sur le même parcours en iOS.

---

## 13. Do / Don't

Vingt paires. Chacune est vérifiable à l'œil ou par un `grep` — aucune n'est une intention.

| # | ✅ Do | ❌ Don't |
|---|---|---|
| 1 | Poser **une question et une action** par écran, et l'écrire dans le titre | Intituler un écran « Tableau de bord » et y déposer douze indicateurs parce qu'ils existent |
| 2 | Gagner la densité sur les **marges, le texte et les séparateurs** | Réduire un bouton à 32 px pour faire tenir une colonne de plus |
| 3 | Donner à tout statut **couleur + forme + mot** | Poser une pastille ronde colorée et considérer que c'est lisible |
| 4 | Écrire **« En attente de confirmation »** tant que le serveur n'a pas répondu | Afficher « Commande envoyée » en optimiste et corriger après |
| 5 | Afficher les montants **entiers, tabulaires, avec leur devise** | Écrire `12,5 k` ou arrondir à l'affichage |
| 6 | Afficher l'écart de caisse **même quand il vaut zéro** | Masquer une ligne parce qu'elle est nulle |
| 7 | Employer le **Pétrole** pour l'action, la sélection et le focus — moins de 10 % de l'écran | Introduire un second accent, ou colorer un fond de ligne entier « pour distinguer » |
| 8 | Servir **AVIF/WebP en 4 largeurs**, avec `width`/`height` et un LQIP d'une couleur | Servir le fichier de 4 Mo téléversé par le restaurateur |
| 9 | Replier un plat sans photo sur un **bloc typographique dessiné** | Afficher une icône d'assiette générique ou une photo de banque d'images |
| 10 | Basculer une section en **liste** quand moins de 40 % des plats ont une photo | Garder une grille aux trois quarts occupée par des replis |
| 11 | Transformer un tableau en **liste de lignes** sous 900 px | Écraser un tableau desktop, ou le faire défiler horizontalement |
| 12 | Réserver la **modale** aux décisions qui engagent | Ouvrir une modale pour créer un produit ou ajouter une table |
| 13 | Utiliser un **panneau latéral sans voile** pour consulter sans perdre la liste | Poser un voile sur un panneau latéral et en refaire une modale |
| 14 | Laisser une **trace persistante** après une action critique | Confirmer un encaissement par un toast qui disparaît en 5 s |
| 15 | Doubler tout geste par un **bouton**, et offrir 5 s d'annulation | Faire du glissement l'unique chemin — surtout avec des mains mouillées |
| 16 | Dire, hors ligne, **ce qu'il reste à faire à la main** | Afficher « Une erreur est survenue » avec un seul bouton « Réessayer » |
| 17 | **Masquer** ce que l'utilisateur n'a pas le droit de faire | Griser une action ou flouter un chiffre : cela révèle ce qui existe |
| 18 | Charger **une seule fonte**, en latin, ≤ 40 Ko, avec un repli ajusté métriquement | Ajouter une police d'affichage, ou une mono, « pour le caractère » |
| 19 | Animer **120–220 ms**, uniquement pour expliquer une transition | Faire clignoter, pulser, respirer ou défiler en parallaxe quoi que ce soit |
| 20 | Retirer tout élément qui ne rend **rien** de visible | Ajouter un dégradé violet, un orbe, un bento sans logique, une bordure latérale colorée épaisse, un faux tableau de bord en trois dimensions |

---

## 14. Ce qui n'est pas tranché ici

Écrit pour qu'on le surveille, dans l'esprit de `PRODUCT.md` §10 et du Decision Log.

| Sujet | Pourquoi ce n'est pas tranché | Où ça se décidera |
|---|---|---|
| **Nom, logotype, voix de marque** | `Joliba` n'est pas arrêté (*Partie C, question 1*). Les jetons n'en dépendent pas ; l'identité verbale, si | `docs/research/naming-study.md` |
| **Archivo, confirmée ou remplacée** | Le poids réel du fichier livré et la présence de `tnum` se vérifient sur le fichier, pas sur une fiche produit. Si le budget de 40 Ko est dépassé, on retire la fonte | Intégration, §2.2 |
| **KDS clair ou sombre par défaut** | *H4* n'est pas vérifiée. Une cuisine carrelée en plein jour pourrait renverser la conclusion | Entretiens cuisine (`field-research-guide.md`) |
| **Fréquence et volume des sons** | 880/660 Hz est un raisonnement sur le masquage, pas une mesure. Une cuisine réelle peut démentir | Mesure sur place |
| **Mode sombre côté Salle** | Défendable par la batterie et le confort nocturne ; à confronter à de vrais clients devant de vraies photos de plats | Test utilisateur |
| **Densité « ops » sur le téléphone du serveur** | *H3* suppose l'appareil personnel. Si c'est une tablette partagée, la densité Exploitation à 360 px doit être rejouée | Entretiens serveurs |
| **État visuel de la voie 2 (*A8*)** | Si le relais local d'établissement est retenu, il faut un **quatrième état de synchronisation** — « confirmé localement, pas encore au nuage » — qui n'existe pas dans R-D5 et qu'on ne peut pas dessiner avant la décision | *Partie C, question 9* |
| **Rendu de la Facture Normalisée** | Le portail DGI répondait 503 ; le visuel FNE, le numéro normatif et le QR de vérification ont un format imposé qu'on n'a pas lu (*A7*, *D-020*) | Spécification éditeur DGI |
| **Marque blanche** | Si un restaurant peut retirer la mention (*question 8*), il faut prévoir la substitution du logotype et vérifier le contraste de **sa** couleur, pas de la nôtre | *Partie C, question 8* |
