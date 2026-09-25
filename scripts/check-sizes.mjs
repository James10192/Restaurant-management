#!/usr/bin/env node
/**
 * L'axe 6 de la revue thermo-nucléaire, rendu mécanique — Joliba
 *
 *     node scripts/check-sizes.mjs [base=origin/main]
 *
 * Compare l'arbre de travail (fichiers non suivis compris) à la base, et refuse :
 *   1. un fichier que ce diff fait passer au-delà de 1000 lignes, ou qu'il agrandit alors qu'il
 *      y était déjà ;
 *   2. une fonction nommée que ce diff CRÉE ou ALLONGE au-delà de 80 lignes.
 *
 * Le seuil est DIFFÉRENTIEL, comme dans la revue : la dette existante est connue (une centaine de
 * fonctions dépassent déjà 80 lignes), ce contrôle empêche seulement qu'elle grossisse. Un
 * contrôle qu'une machine applique n'a pas à consommer l'attention d'un relecteur
 * (`.claude/skills/thermo-review/SKILL.md`, axe 6).
 *
 * DÉPLACER N'EST PAS CRÉER. Le remède que ce contrôle prescrit — sortir une fonction longue dans
 * un module à part, découper un fichier — ne doit pas être refusé par lui. Donc :
 *  - les renommages de fichier sont suivis (`git diff -M`) : la base se lit sous l'ancien chemin ;
 *  - une fonction se compare d'abord à son homonyme du même fichier, puis à la plus longue
 *    homonyme de TOUS les fichiers de base touchés (supprimés compris) : une fonction déplacée
 *    sans s'allonger passe.
 * Renommer une fonction longue la fait paraître créée : c'est voulu, le nom est ce qui la suit.
 *
 * Ce qui est mesuré : déclarations de fonction, méthodes, fonctions fléchées affectées à un nom,
 * propriétés-fonctions (`handler` d'une fonction Convex), `export default function`, et les
 * rappels de `test`, `it` et `describe`, nommés par leur libellé. Une fonction anonyme passée à
 * autre chose n'a pas de nom stable d'une version à l'autre : elle n'est pas mesurée.
 *
 * Exemptés de la limite de FICHIER (leurs fonctions restent mesurées), et pourquoi :
 *  - `convex/schema.ts` : un catalogue de tables, qui grandit d'une table par besoin ;
 *  - `tests/convex/isolation.test.ts` : un cas par fonction publique, qu'il vérifie lui-même.
 * Les fichiers générés (`convex/_generated`, `src/routeTree.gen.ts`) ne sont pas lus.
 */

import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import ts from "typescript";

const FILE_LIMIT = 1000;
const FUNCTION_LIMIT = 80;
const CODE = /\.(ts|tsx|mjs)$/;
const GENERATED = [/^convex\/_generated\//, /^src\/routeTree\.gen\.ts$/];
const FILE_SIZE_EXEMPT = new Set(["convex/schema.ts", "tests/convex/isolation.test.ts"]);
const TEST_CALLS = new Set(["test", "it", "describe"]);

const base = process.argv[2] ?? "origin/main";
const git = (...args) => execFileSync("git", args, { encoding: "utf8", maxBuffer: 64 * 1024 * 1024, stdio: ["ignore", "pipe", "ignore"] });

let mergeBase;
try {
  mergeBase = git("merge-base", base, "HEAD").trim();
} catch {
  console.error(`check-sizes : base « ${base} » introuvable. Faites un \`git fetch\`, ou passez la base en argument.`);
  process.exit(2);
}

const isCode = (f) => CODE.test(f) && !GENERATED.some((re) => re.test(f));

// Fichier courant → son chemin dans la base (null s'il est nouveau) ; et les fichiers de base touchés.
const pathInBase = new Map();
const touchedInBase = new Set();
for (const line of git("diff", "-M", "--name-status", mergeBase).split("\n").filter(Boolean)) {
  const [status, a, b] = line.split("\t");
  if (status.startsWith("R")) {
    if (isCode(a)) touchedInBase.add(a);
    if (isCode(b)) pathInBase.set(b, a);
  } else if (status === "D") {
    if (isCode(a)) touchedInBase.add(a);
  } else if (isCode(a)) {
    pathInBase.set(a, status === "A" ? null : a);
    if (status !== "A") touchedInBase.add(a);
  }
}
// Un fichier nouveau, pas encore ajouté à l'index, est mesuré aussi.
for (const f of git("ls-files", "--others", "--exclude-standard").split("\n").filter(Boolean)) {
  if (isCode(f) && !pathInBase.has(f)) pathInBase.set(f, null);
}

function baseSource(file) {
  try {
    return git("show", `${mergeBase}:${file}`);
  } catch {
    return null;
  }
}

function lineCount(text) {
  return text.split("\n").length - (text.endsWith("\n") ? 1 : 0);
}

/** Les fonctions nommées d'un texte, avec leur longueur. Nom = chemin (`Composant.sousFonction`). */
function functions(file, text) {
  const kind = file.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS;
  const sf = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true, kind);
  const out = new Map();
  const seen = new Map();
  const lineOf = (pos) => sf.getLineAndCharacterOfPosition(pos).line;
  const isFn = (n) => n !== undefined && (ts.isArrowFunction(n) || ts.isFunctionExpression(n));

  function nameOf(node) {
    if ((ts.isFunctionDeclaration(node) || ts.isMethodDeclaration(node)) && node.name) return node.name.getText(sf);
    if (ts.isFunctionDeclaration(node)) return "default";
    if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && isFn(node.initializer)) return node.name.text;
    if (ts.isPropertyAssignment(node) && isFn(node.initializer)) return node.name.getText(sf);
    // test("libellé", () => …) : le libellé est le nom.
    const call = node.parent;
    if (isFn(node) && call && ts.isCallExpression(call) && ts.isIdentifier(call.expression) && TEST_CALLS.has(call.expression.text)) {
      const label = call.arguments[0];
      if (label && ts.isStringLiteralLike(label)) return `${call.expression.text}(${label.text})`;
    }
    return null;
  }

  function visit(node, path) {
    const name = nameOf(node);
    const scope = name !== null ? [...path, name] : ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) ? [...path, node.name.text] : path;
    if (name !== null) {
      const key = scope.join(".");
      // Homonymes au même niveau : un compteur PAR NOM, pour qu'une fonction ajoutée ailleurs ne
      // décale pas la clé des autres.
      const n = (seen.get(key) ?? 0) + 1;
      seen.set(key, n);
      out.set(n === 1 ? key : `${key}#${n}`, { lines: lineOf(node.getEnd()) - lineOf(node.getStart(sf)) + 1, line: lineOf(node.getStart(sf)) + 1 });
    }
    ts.forEachChild(node, (child) => visit(child, scope));
  }
  visit(sf, []);
  return out;
}

// Toutes les fonctions de la base touchée, par nom : une fonction déplacée retrouve son passé.
const beforeAnywhere = new Map();
const beforeByFile = new Map();
for (const file of touchedInBase) {
  const text = baseSource(file);
  if (text === null) continue;
  const fns = functions(file, text);
  beforeByFile.set(file, fns);
  for (const [name, { lines }] of fns) beforeAnywhere.set(name, Math.max(beforeAnywhere.get(name) ?? 0, lines));
}

const problems = [];
for (const [file, oldPath] of pathInBase) {
  if (!existsSync(file)) continue;
  const head = readFileSync(file, "utf8");
  const before = oldPath === null ? null : baseSource(oldPath);

  if (!FILE_SIZE_EXEMPT.has(file)) {
    const now = lineCount(head);
    const was = before === null ? 0 : lineCount(before);
    if (now > FILE_LIMIT && (was <= FILE_LIMIT || now > was)) {
      problems.push(`${file} : ${was} → ${now} lignes. ${was > FILE_LIMIT ? "Déjà au-delà de 1000 : le nouveau code va dans un module à part." : "Il franchit 1000 lignes : décomposer d'abord."}`);
    }
  }

  const sameFile = oldPath === null ? new Map() : (beforeByFile.get(oldPath) ?? new Map());
  for (const [name, { lines, line }] of functions(file, head)) {
    if (lines <= FUNCTION_LIMIT) continue;
    const was = sameFile.get(name)?.lines ?? beforeAnywhere.get(name);
    if (was === undefined || lines > was) {
      problems.push(`${file}:${line} ${name} : ${was === undefined ? "créée à " : `${was} → `}${lines} lignes (au-delà de ${FUNCTION_LIMIT}). Extraire une fonction ou un composant nommé.`);
    }
  }
}

if (problems.length > 0) {
  console.error(`✗ Tailles (axe 6 de la revue thermo-nucléaire), contre ${base} :\n`);
  for (const p of problems) console.error(`  - ${p}`);
  console.error("\nLa dette existante n'est pas comptée : seul ce que ce diff crée ou allonge l'est.");
  process.exit(1);
}
console.log(`✓ Tailles : ${pathInBase.size} fichier(s) comparé(s) à ${base}, aucune fonction ni aucun fichier n'a franchi sa limite.`);
