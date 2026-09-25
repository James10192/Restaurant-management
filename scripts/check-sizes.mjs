#!/usr/bin/env node
/**
 * L'axe 6 de la revue thermo-nucléaire, rendu mécanique — Joliba
 *
 *     node scripts/check-sizes.mjs [base=origin/main]
 *
 * Compare les fichiers TypeScript modifiés depuis `base` (arbre de travail compris) à leur version
 * de base, et refuse :
 *   1. un fichier que ce diff fait passer au-delà de 1000 lignes, ou qu'il agrandit alors qu'il
 *      y était déjà ;
 *   2. une fonction (déclaration, fonction fléchée nommée, méthode, `handler` Convex) que ce diff
 *      CRÉE ou ALLONGE au-delà de 80 lignes.
 *
 * Le seuil est DIFFÉRENTIEL, comme dans la revue : la dette existante est connue, ce contrôle
 * empêche seulement qu'elle grossisse. Un contrôle qu'une machine applique n'a pas à consommer
 * l'attention d'un relecteur (`.claude/skills/thermo-review/SKILL.md`, axe 6).
 *
 * Exemptés, et pourquoi :
 *  - les fichiers générés (`convex/_generated`, `src/routeTree.gen.ts`) : personne ne les écrit ;
 *  - `convex/schema.ts` : un catalogue de tables, qui grandit d'une table par besoin ; son
 *    découpage casserait la lecture d'un seul coup d'œil que `check:schema` suppose ;
 *  - `tests/convex/isolation.test.ts` : un cas par fonction publique, qu'il vérifie lui-même.
 * Les FONCTIONS de ces fichiers restent contrôlées, sauf dans les fichiers générés.
 */

import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import ts from "typescript";

const FILE_LIMIT = 1000;
const FUNCTION_LIMIT = 80;
const GENERATED = [/^convex\/_generated\//, /^src\/routeTree\.gen\.ts$/];
const FILE_SIZE_EXEMPT = new Set(["convex/schema.ts", "tests/convex/isolation.test.ts"]);

const base = process.argv[2] ?? "origin/main";
const git = (...args) => execFileSync("git", args, { encoding: "utf8", maxBuffer: 64 * 1024 * 1024, stdio: ["ignore", "pipe", "ignore"] });

let mergeBase;
try {
  mergeBase = git("merge-base", base, "HEAD").trim();
} catch {
  console.error(`check-sizes : base « ${base} » introuvable. Faites un \`git fetch\`, ou passez la base en argument.`);
  process.exit(2);
}

// L'arbre de travail contre la base : en local, ce qu'on s'apprête à commiter compte ; en CI,
// l'arbre de travail EST le commit.
const changed = git("diff", "--name-only", "--diff-filter=ACMR", mergeBase)
  .split("\n")
  .filter((f) => /\.(ts|tsx|mjs)$/.test(f) && !GENERATED.some((re) => re.test(f)));

function source(ref, file) {
  try {
    return git("show", `${ref}:${file}`);
  } catch {
    return null; // fichier nouveau
  }
}

function lineCount(text) {
  return text.split("\n").length - (text.endsWith("\n") ? 1 : 0);
}

/** Les fonctions nommées d'un fichier, avec leur longueur en lignes. Nom = chemin (`Composant.sousFonction`). */
function functions(file, text) {
  const kind = file.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS;
  const sf = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true, kind);
  const out = new Map();
  const lines = (node) => sf.getLineAndCharacterOfPosition(node.getEnd()).line - sf.getLineAndCharacterOfPosition(node.getStart(sf)).line + 1;
  const isFn = (n) => n && (ts.isArrowFunction(n) || ts.isFunctionExpression(n));

  function visit(node, path) {
    let name = null;
    if ((ts.isFunctionDeclaration(node) || ts.isMethodDeclaration(node)) && node.name) name = node.name.getText(sf);
    else if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && isFn(node.initializer)) name = node.name.text;
    else if (ts.isPropertyAssignment(node) && isFn(node.initializer)) {
      // `export const create = mutation({ handler: async (ctx) => … })` → « create.handler »
      name = node.name.getText(sf);
    }
    const next = name ? [...path, name] : ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) ? [...path, node.name.text] : path;
    if (name) {
      const key = next.join(".");
      // Deux homonymes au même niveau : le second prend un suffixe, pour ne pas écraser le premier.
      const unique = out.has(key) ? `${key}#${out.size}` : key;
      out.set(unique, { lines: lines(node), line: sf.getLineAndCharacterOfPosition(node.getStart(sf)).line + 1 });
    }
    ts.forEachChild(node, (child) => visit(child, next));
  }
  visit(sf, []);
  return out;
}

const problems = [];
for (const file of changed) {
  if (!existsSync(file)) continue;
  const head = readFileSync(file, "utf8");
  const before = source(mergeBase, file);

  if (!FILE_SIZE_EXEMPT.has(file)) {
    const now = lineCount(head);
    const was = before === null ? 0 : lineCount(before);
    if (now > FILE_LIMIT && (was <= FILE_LIMIT || now > was)) {
      problems.push(`${file} : ${was} → ${now} lignes. ${was > FILE_LIMIT ? "Déjà au-delà de 1000 : le nouveau code va dans un module à part." : "Il franchit 1000 lignes : décomposer d'abord."}`);
    }
  }

  const fnsNow = functions(file, head);
  const fnsBefore = before === null ? new Map() : functions(file, before);
  for (const [name, { lines, line }] of fnsNow) {
    if (lines <= FUNCTION_LIMIT) continue;
    const was = fnsBefore.get(name)?.lines;
    if (was === undefined || lines > was) {
      problems.push(`${file}:${line} ${name} : ${was === undefined ? "créée à" : `${was} → `}${lines} lignes (au-delà de ${FUNCTION_LIMIT}). Extraire une fonction ou un composant nommé.`);
    }
  }
}

if (problems.length > 0) {
  console.error(`✗ Tailles (axe 6 de la revue thermo-nucléaire), contre ${base} :\n`);
  for (const p of problems) console.error(`  - ${p}`);
  console.error("\nLa dette existante n'est pas comptée : seul ce que ce diff crée ou allonge l'est.");
  process.exit(1);
}
console.log(`✓ Tailles : ${changed.length} fichier(s) comparé(s) à ${base}, aucune fonction ni aucun fichier n'a franchi sa limite.`);
