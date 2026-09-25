# Avant toute fusion et tout déploiement — Joliba

## Quand s'active

Dès qu'un travail qui touche du code (`convex/`, `src/`, `scripts/`, `e2e/`, `tests/`,
`vite.config.ts`, la CI) s'approche d'une fusion vers `main` ou d'un déploiement.

## La règle

1. **`pnpm check` est vert**, et la CI de la pull request aussi. Il comprend désormais
   `check:sizes` : aucun fichier au-delà de 1000 lignes, aucune fonction ni aucun cas de test
   créé ou allongé au-delà de 80, contre la base. Après `pnpm build`,
   `node scripts/check-guest-bundle.mjs` : le calcul de couleur hors des pages client.
2. **Les parcours de bout en bout touchés passent** (`pnpm test:e2e`, voir `e2e/README.md`),
   et un parcours nouveau accompagne une fonctionnalité nouvelle.
3. **La revue thermo-nucléaire rend `PASS`** — le skill `/thermo-review`, en sous-agent, sur
   `origin/main...HEAD`. Après un `BLOCK`, on corrige puis on relance la revue **sur la plage des
   corrections** ; ses constats nouveaux comptent autant que les anciens.
4. **Toute route client touchée est remesurée** (`scripts/measure-guest.mjs`), la mesure publiée
   dans `docs/perf/`, et tout écart de script attribué fichier par fichier.
5. **Les décisions `D-xxx` et les documents décrivent ce que fait le code.** Une migration de
   données est lancée au déploiement et notée dans `docs/ROADMAP.md`.

## Ce qui n'attend pas le verdict

Sur une branche de travail, **le commit et la poussée** : le hook de fin de tour exige un arbre
propre et poussé. On commit, on dit que la revue tourne, et le verdict s'applique dans un commit
de suite. Ce qui reste interdit : fusionner ou déployer sans `PASS`, laisser un `BLOCK` sans
correction, ouvrir une pull request sans que l'utilisateur l'ait demandée.

## Exemptions de la revue

Documentation seule ; configuration seule ; suppressions pures ; diff de moins de cinq lignes
dans un seul fichier. Elles se constatent, elles ne se décident pas.
