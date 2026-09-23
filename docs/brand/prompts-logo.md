# Prompts — logo et slogan de Joliba

> **Logo adopté le 2026-09-23 (D-059)** : fichiers d'origine dans `docs/brand/source/`, versions
> vectorielles dans `public/brand/`, favicon dans `public/favicon.svg`, couleur **#044E5A**.

> Prompts prêts à coller dans un générateur d'images (Midjourney, Ideogram, DALL·E, Recraft…)
> ou dans un assistant de rédaction. Ils sont en anglais quand ils visent un générateur d'images,
> parce que ces outils suivent mieux l'anglais ; chaque prompt est expliqué en français.
>
> Faits sur lesquels ils s'appuient, et leurs limites : voir `docs/research/naming-study.md`.
> « Joliba » désigne le fleuve Niger en mandingue (« le grand fleuve »). Ce sens vient de sources
> publiques ; il **n'a pas encore été validé par des locuteurs natifs** — étape à faire avant tout
> dépôt de marque ou campagne.

## Ce que le logo doit raconter

- **Le nom** : Joliba, le grand fleuve. Un fleuve, c'est un **flux qui ne s'arrête pas** et qui
  relie des rives, des villes, des gens.
- **L'application** : le système d'exploitation du restaurant. Elle fait circuler, sans rupture,
  ce qui se passe entre la table, le serveur, la cuisine, le bar, la caisse et le gérant.
  Aujourd'hui ces postes se crient dessus ; demain l'information coule d'elle-même.
- **Le lien entre les deux** : un service réussi est un fleuve tranquille. Le logo doit évoquer
  le **mouvement continu** et la **liaison**, pas la nourriture.

À éviter : couverts, toque, assiette, bol fumant (on vend un logiciel, pas un plat) ; masques,
motifs « africains » génériques, kente ou bogolan décoratifs (cliché, et ce n'est pas le sujet) ;
dégradés multicolores, effets 3D, reflets ; tout ce qui ne tient pas en 16 × 16 px.

---

## Prompt 1 — Le logo (symbole + nom)

**Pourquoi ce prompt** : il décrit l'idée (deux ou trois courants qui ondulent et se rejoignent,
comme un fleuve et ses affluents, ou comme les postes d'un restaurant qui convergent), impose un
tracé géométrique simple, lisible en tout petit, et une typographie sobre.

```
Minimal vector logo for "Joliba", a restaurant operating system software from West Africa.
The name means "the great river" (the Niger river) in Mandinka.
Symbol: two or three smooth parallel wave lines that flow and merge into one continuous stream,
evoking a river and its tributaries converging — a metaphor for orders flowing seamlessly
between table, kitchen, bar and cashier. Geometric, balanced, built on a simple grid,
rounded line caps, consistent stroke width.
Wordmark: "Joliba" in a clean modern geometric sans-serif, medium weight, generous letter
spacing, lowercase or title case, symbol placed to the left of the wordmark.
Flat design, solid single color on white background, no gradient, no shadow, no 3D,
no food, no cutlery, no chef hat, no tribal pattern, no mask.
Must remain legible as a 16x16 favicon and as a mobile app icon.
Professional SaaS brand, calm, trustworthy, premium, timeless.
--no gradient, cutlery, food, 3d, text other than Joliba
```

(Retirer la ligne `--no …` si l'outil n'est pas Midjourney.)

### Variante A — icône d'application seule

```
App icon for "Joliba", a restaurant management software. Rounded square, single solid deep
color background, white symbol centered: two or three smooth wave lines flowing and merging
into one stream, like a great river with tributaries. Flat vector, geometric, thick consistent
strokes, generous padding, no text, no gradient, no shadow, readable at 48x48 pixels.
```

### Variante B — trois pistes de couleur

Ajouter à la fin du prompt 1 l'une de ces lignes, pour comparer :

```
Color: deep river teal (#0B6478) on white.
Color: warm laterite ochre (#B5651D) on off-white.
Color: near-black ink (#171717) on white, monochrome.
```

La troisième s'accorde d'emblée avec l'interface actuelle (thème `neutral` de shadcn/ui).
Une fois la couleur choisie, elle devient la couleur `--primary` du thème shadcn — un réglage de
thème officiel, pas un composant maison.

---

## Prompt 2 — Logo avec slogan (le nom et l'application expliqués)

**Pourquoi ce prompt** : il produit le logo accompagné d'une ligne de signature qui dit en une
phrase ce qu'est Joliba. Les générateurs d'images écrivent souvent mal le texte : Ideogram ou
Recraft sont les plus fiables pour cela. Remplacer `<SLOGAN>` par l'une des propositions
ci-dessous (ou par le résultat du prompt 3).

```
Horizontal brand lockup for "Joliba", a restaurant operating system from West Africa.
Left: minimal flat vector symbol of two or three smooth wave lines flowing and merging into
one continuous stream, like the Niger river ("Joliba" means "the great river" in Mandinka).
Right: the wordmark "Joliba" in a clean geometric sans-serif, medium weight.
Below the wordmark, a smaller tagline in regular weight, exact text: "<SLOGAN>".
Single solid color on white, flat, no gradient, no shadow, no food, no cutlery,
no decorative pattern. Premium, calm, modern SaaS brand. Text must be spelled exactly.
```

### Propositions de slogan

Chaque ligne relie le nom (le fleuve, le flux) à ce que fait l'application.

| Français | English | Ce qu'il dit |
|---|---|---|
| Le service qui coule de source. | Service that flows. | Le jeu de mots porte à la fois le fleuve et la fluidité du service |
| De la table à la caisse, tout circule. | From table to till, everything flows. | Nomme les deux bouts de la chaîne |
| Le grand fleuve de votre restaurant. | The great river of your restaurant. | Traduit directement le nom |
| Chaque commande trouve son cours. | Every order finds its course. | Le fleuve qui guide, la commande qui arrive où elle doit |
| Tout votre restaurant, d'un seul courant. | Your whole restaurant, one flow. | La promesse de l'OS : un seul outil au lieu de dix |

Ma recommandation : **« Le service qui coule de source. »** — court, naturel en français,
compréhensible sans explication, et le nom Joliba lui donne sa profondeur pour qui le connaît.

---

## Prompt 3 — Trouver d'autres slogans (assistant de rédaction)

**Pourquoi ce prompt** : il donne à l'assistant le contexte exact et les contraintes, pour qu'il
propose des signatures au lieu de formules creuses.

```
Tu es concepteur-rédacteur pour une marque de logiciel.
Produit : Joliba, le système d'exploitation du restaurant pour l'Afrique francophone
(Côte d'Ivoire d'abord). Il fait circuler en temps réel les commandes, les plats et les
paiements entre le client à table (qui scanne un QR), le serveur, la cuisine, le bar,
la caisse et le gérant. Il marche sur un téléphone d'entrée de gamme et une 4G instable.
Nom : « Joliba » est le nom mandingue du fleuve Niger, « le grand fleuve ». Métaphore :
un service réussi est un flux ininterrompu, comme un fleuve.
Cible : propriétaires et gérants de maquis, restaurants et hôtels, 1 à 40 tables.
Ton : calme, sûr, concret, chaleureux sans folklore. Pas de superlatifs, pas de jargon
technique, pas de promesse chiffrée.
Donne 15 slogans en français (6 mots au plus), chacun avec sa version anglaise et une
phrase qui explique comment il relie le nom (le fleuve) à ce que fait l'application.
Classe-les du plus clair au plus audacieux. Signale ceux qui pourraient être mal compris.
```

---

## Avant d'adopter un logo

1. Vérifier qu'il reste lisible en 16 px (favicon), 48 px (icône) et en noir et blanc (ticket
   de caisse imprimé).
2. Faire une recherche d'antériorité de marque (OAPI, EUIPO, USPTO) : le nom n'a été vérifié
   que pour les domaines (voir `naming-study.md` §8).
3. Faire valider le sens de « Joliba » par des locuteurs mandingues.
4. ~~Remplacer la marque provisoire `JolibaMark` et le `favicon.svg`~~ — fait (D-059).
