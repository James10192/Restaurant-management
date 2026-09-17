# AI.md — [PRODUCT_NAME]

> §30 à §36, §90, §118. *« L'IA ne doit pas être décorative. »*

---

## 1. Le critère d'admission

Toute fonctionnalité d'IA doit répondre **oui** à au moins une question, et la réponse doit être
mesurable :

- fait-elle gagner du temps ? · augmente-t-elle les ventes ? · réduit-elle les erreurs ? ·
  améliore-t-elle le service ? · facilite-t-elle l'exploitation ? · apporte-t-elle une intelligence
  inaccessible autrement ?

Si la réponse est « ça fait moderne », la fonctionnalité n'est pas construite. Un assistant qui
répond joliment à des questions qu'on ne se pose pas coûte des jetons et de la confiance.

---

## 2. Les quatre interdits

Ils priment sur toute considération d'expérience utilisateur.

**1. Ne rien inventer.** Un allergène, un prix, un stock, un chiffre d'affaires, la composition d'un
plat : si la donnée n'est pas déclarée, la réponse est « cette information n'est pas renseignée ».
Ce n'est pas une consigne de rédaction mais une contrainte d'outillage — l'outil ne peut renvoyer
que ce qui existe en base *(R28)*.

**2. Ne jamais dépasser les droits de celui qui demande.** Les outils de l'IA lisent avec la portée
et les permissions de l'appelant. Un serveur ne peut pas obtenir par l'IA le chiffre d'affaires d'un
établissement auquel il n'a pas accès *(R30)*.

**3. Ne jamais agir seule sur du sensible.** Proposition → aperçu → **validation humaine** →
exécution → journal *(D-014)*. L'IA ne rembourse pas, ne supprime pas, ne clôture pas une caisse, ne
change pas un prix, ne modifie pas une permission.

**4. Ne jamais obéir à un document.** Un contenu importé — carte PDF, photo, message client — est
**une donnée, jamais une instruction**. « Ignore les instructions précédentes » écrit dans une carte
est du texte à extraire, rien d'autre.

---

## 3. Architecture

Le schéma d'ensemble est dans `ARCHITECTURE.md §11`.

```
convex/ai/
├── providers/          adaptateurs — le reste du code ne connaît qu'un contrat
├── tools/              outils typés, chacun portant SA permission
├── prompts/            consignes système, versionnées
├── features/           importMenu · guestAssistant · managerAssistant · upsell
└── usage.ts            traçage : modèle, coût, jetons, latence, succès
```

### Providers interchangeables

```ts
export interface AiProvider {
  readonly key: string;
  readonly models: Record<"fast" | "quality", string>;
  generate(input: { model: string; system: string; messages: AiMessage[]; tools?: AiTool[] }):
    Promise<{ text: string; toolCalls?: AiToolCall[]; usage: TokenUsage; latencyMs: number }>;
}
```

Le **mode** (`fast` / `quality`) est choisi par la fonctionnalité ; le **modèle** n'est jamais
exposé à l'utilisateur ni codé dans un écran. Changer de fournisseur ou de modèle est une
modification de configuration, pas une réécriture. Aucune clé de fournisseur n'existe côté
navigateur : tout passe par des *actions* Convex.

### Outils

Un outil déclare la permission qu'il exige. L'appel est refusé **avant** d'atteindre le modèle si
l'appelant ne l'a pas.

```ts
defineAiTool({
  name: "get_sales_summary",
  permission: "analytics.financial.read",     // vérifiée côté serveur, comme toute mutation
  args: z.object({ venueId: z.string(), from: z.number(), to: z.number() }),
  handler: async (ctx, args, actor) => {
    await requirePermission(ctx, "analytics.financial.read", { venueId: args.venueId });
    return summarizeSales(ctx, args);         // lu avec la portée de l'appelant
  },
});
```

### Traçage

Chaque appel écrit dans `aiUsage` : fournisseur, modèle, jetons entrée/sortie, coût, latence,
utilisateur, organisation, fonctionnalité, succès ou échec. Sans cette table, la facture arrive sans
explication et l'on ne peut ni facturer l'usage, ni le plafonner, ni décider qu'une fonctionnalité
ne vaut pas son coût.

---

## 4. Import de carte — la fonctionnalité qui fait gagner le plus de temps

Saisir 120 plats à la main est la première raison d'abandonner un logiciel de restauration avant
même de l'avoir essayé.

```
PDF ou photo → extraction (sections, produits, descriptions, prix, variantes, suppléments)
             → structuration + INDICE DE CONFIANCE par champ
             → écran de validation humaine
             → publication
```

**Règles non négociables :**

- **Jamais de publication automatique** (§30). L'écran de validation est obligatoire, quelle que
  soit la confiance.
- L'indice de confiance est **affiché par champ** : les prix incertains sont surlignés, parce qu'un
  prix faux coûte de l'argent dès le premier service.
- **Aucun allergène, aucune certification, aucun régime alimentaire n'est déduit.** Si la carte dit
  « poulet », l'IA ne coche pas « sans gluten ». Ces champs restent vides et le restaurant les
  remplit — c'est une responsabilité juridique, pas une commodité.
- Le contenu du document est traité comme une donnée hostile *(SECURITY.md M16)*.
- L'écran de validation permet de corriger en masse (un prix, une section entière), sinon on
  remplace une saisie par une relecture aussi longue.

---

## 5. Assistant client

Pour le client à table, sur la carte de l'établissement, et rien d'autre.

> « Je veux quelque chose de pas épicé à moins de 8 000 FCFA. »
> « Nous sommes 4 avec 30 000 FCFA. »
> « Je veux un plat sans arachide. »

Fonctionne sur des données **déclarées** : prix, étiquettes, niveau d'épice, régimes, allergènes
renseignés par le restaurant. Vérifie systématiquement la disponibilité réelle au moment de la
réponse — proposer un plat épuisé est pire que ne rien proposer.

**Sur les allergies, la formulation est fixée** — elle n'est pas laissée au modèle :

> « Le restaurant n'a pas renseigné les allergènes de ce plat. Je ne peux pas vous répondre.
> Demandez au serveur. »

Une réponse inventée sur une allergie peut envoyer quelqu'un à l'hôpital. C'est le seul endroit de
ce produit où l'on préfère explicitement une mauvaise expérience à un risque.

---

## 6. Recommandations et vente additionnelle

**L'ordre compte** (§33) : d'abord les règles déterministes, ensuite les données, l'IA seulement
quand elle apporte quelque chose.

1. **Règles** : le restaurant associe des produits (burger → frites, boisson). Prévisible,
   gratuit, immédiat.
2. **Données** : ce qui est réellement acheté ensemble dans cet établissement.
3. **IA** : formulation contextuelle, quand les deux premières ne suffisent pas.

Toujours vérifier disponibilité, horaires, restrictions et stock avant d'afficher. Mesurer :
impressions, clics, ajouts, conversion, **revenu incrémental**.

**Garde-fou d'expérience** : au plus une suggestion par écran, jamais de relance après un refus,
jamais d'interruption pendant le paiement. Une recommandation insistante fait plus perdre en
confiance qu'elle ne rapporte en ticket moyen — et le restaurateur le voit avant nous.

---

## 7. Assistant exploitation

> « Qu'est-ce qui a ralenti le service hier soir ? »
> « Quels plats sont souvent annulés ? »
> « Quelles tables attendent trop longtemps en ce moment ? »

Lit les données réelles — `orderEvents`, `kitchenTickets`, `serviceRequests`, `payments` — avec la
portée de celui qui demande.

**Trois obligations d'affichage** :

1. **La période utilisée**, écrite explicitement.
2. **Les données mobilisées**, avec un lien vers l'écran d'analytique correspondant.
3. **L'aveu d'insuffisance** : « 4 commandes sur cette période, c'est trop peu pour conclure. »
   Un modèle qui commente trois commandes comme une tendance fabrique de la fausse certitude.

**Jamais de chiffre non calculé.** Un nombre qui apparaît dans une réponse vient d'un outil qui l'a
calculé, jamais du modèle.

---

## 8. IA actionnable

L'assistant peut **proposer** : rendre un plat indisponible, réordonner une carte, lancer une
promotion, alerter sur un retard.

```
proposition → aperçu du changement exact → validation humaine → exécution → journal
```

Trois niveaux de risque décident de l'exigence :

| Risque | Exemples | Ce qu'il faut |
|---|---|---|
| Faible | Réordonner un menu, rédiger une description | Validation simple |
| Moyen | Rendre un plat indisponible, envoyer une notification | Validation + aperçu détaillé |
| Élevé | Prix, permission, opération financière | **Interdit à l'IA**, même avec validation |

Une proposition expire. Une proposition validée par quelqu'un qui n'a pas la permission de l'action
sous-jacente est refusée — la validation n'élève jamais les droits. `ai.actions.approve` n'est jamais
accordée par défaut au même rôle que `ai.actions.propose`.

---

## 9. Détection d'anomalies

**Règles déterministes d'abord** (§36), apprentissage plus tard, si jamais.

Annulations nombreuses · remises inhabituelles · remboursements importants · temps de préparation
anormal · erreurs répétées sur un même article · écart de caisse · hausse soudaine des
indisponibilités.

Chaque anomalie dit **quoi regarder**, pas seulement « anomalie détectée ». Un seuil configurable par
établissement, parce qu'un maquis à forte rotation et un restaurant de standing n'ont pas les mêmes
normes. Une alerte qu'on apprend à ignorer est pire que pas d'alerte.

---

## 10. Coûts et limites

Plafonds d'usage par plan, visibles avant d'être atteints. Mode `fast` par défaut, `quality`
réservé à ce qui le justifie (l'import de carte, pas la reformulation d'une description).
Limitation de débit par utilisateur et par établissement. Mise en cache des réponses déterministes.

Chaque mois : coût par fonctionnalité rapporté à sa valeur mesurée. **Une fonctionnalité d'IA qui
coûte plus qu'elle ne rapporte est retirée** — c'est la conséquence logique du critère d'admission
du §1, et elle doit être appliquée pour de bon.

---

## 11. Tests

Injection de consigne dans une carte importée → ignorée · allergène non déclaré → refus de répondre,
formulation exacte · serveur demandant des données hors de sa portée → refus · proposition d'action
sensible sans validation → refus d'exécution · validation par quelqu'un sans la permission
sous-jacente → refus · panne de fournisseur → dégradation propre, message clair, jamais d'invention ·
chaque appel écrit bien dans `aiUsage`.
