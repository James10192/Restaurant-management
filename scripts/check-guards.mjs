#!/usr/bin/env node
/**
 * Toute fonction Convex PUBLIQUE commence par une garde — Joliba (PERMISSIONS.md §9)
 *
 * Propriétés vérifiées, pour chaque `query`, `mutation` et `action` exportée hors de
 * `convex/lib`, `convex/_generated` et des fichiers d'infrastructure :
 *
 *  1. le corps appelle une garde (`requireUser`, `requireOrganizationMember`,
 *     `requireVenueAccess`, `requirePermission`, `requirePlatformAdmin`, `getCurrentUser`,
 *     et pour le service `requireServiceActor`, `requireServiceMutation`, `requireDevice`) ;
 *  2. cette garde intervient AVANT le premier accès `ctx.db` — lire puis vérifier, c'est
 *     avoir déjà lu ;
 *  3. seule exception admise : un commentaire `// garde : <raison>` qui dit pourquoi la
 *     fonction n'en a pas besoin (le jeton EST la portée, garde déléguée…), placé DANS le
 *     corps du `handler`. L'exception est donc visible en revue, jamais implicite.
 *
 * Les commentaires et les chaînes sont effacés avant la recherche : un
 * `// requireUser(ctx)` oublié, ou le texte « requireUser( » dans un message, ne vaut
 * pas garde. Les positions sont conservées (effacement par des espaces), si bien que
 * l'ordre garde / `ctx.db` reste celui du code réel.
 *
 * Ce contrôle est statique : il prouve la présence et l'ordre, pas la justesse de la
 * portée. La justesse, ce sont les tests d'isolation (`tests/isolation.test.ts`).
 */

import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const ROOT = new URL("..", import.meta.url).pathname;
// Un dossier peut être passé en argument : c'est ainsi que le test du contrôle lui-même
// vérifie qu'il ÉCHOUE sur une fonction non gardée (un contrôle qui ne peut pas échouer
// ne prouve rien).
const CONVEX = process.argv[2] ? join(process.cwd(), process.argv[2]) : join(ROOT, "convex");
const SKIP_DIRS = new Set(["lib", "_generated"]);
/** Infrastructure : routes HTTP et déclencheurs Better Auth, sans fonction publique métier. */
const SKIP_FILES = new Set(["schema.ts", "http.ts", "auth.config.ts", "convex.config.ts"]);
const GUARDS = [
  "requireUser(",
  "requireOrganizationMember(",
  "requireVenueAccess(",
  "requirePermission(",
  "requirePlatformAdmin(",
  "getCurrentUser(",
  "requireServiceActor(",
  "requireServiceMutation(",
  "requireDevice(",
];
const PUBLIC = /export const (\w+)\s*=\s*(query|mutation|action)\(/g;

/**
 * Remplace commentaires et littéraux de chaîne par des espaces, en gardant les retours à
 * la ligne. Lexeur minimal, suffisant pour du TypeScript de fonctions Convex : il ne
 * cherche pas à reconnaître les expressions régulières littérales, absentes de ces fichiers.
 */
function blankCommentsAndStrings(source) {
  let out = "";
  let i = 0;
  const blank = (text) => text.replace(/[^\n]/g, " ");
  while (i < source.length) {
    const c = source[i];
    const next = source[i + 1];
    if (c === "/" && next === "/") {
      const end = source.indexOf("\n", i);
      const stop = end < 0 ? source.length : end;
      out += blank(source.slice(i, stop));
      i = stop;
    } else if (c === "/" && next === "*") {
      const end = source.indexOf("*/", i + 2);
      const stop = end < 0 ? source.length : end + 2;
      out += blank(source.slice(i, stop));
      i = stop;
    } else if (c === '"' || c === "'" || c === "`") {
      let j = i + 1;
      while (j < source.length && source[j] !== c) {
        if (source[j] === "\\") j++;
        j++;
      }
      out += c + blank(source.slice(i + 1, j)) + (j < source.length ? c : "");
      i = j + 1;
    } else {
      out += c;
      i++;
    }
  }
  return out;
}

/** Position de l'accolade qui ferme celle ouverte en `open` (source déjà effacée). */
function matchingBrace(source, open) {
  let depth = 0;
  for (let i = open; i < source.length; i++) {
    if (source[i] === "{") depth++;
    else if (source[i] === "}" && --depth === 0) return i;
  }
  return -1;
}

function files(dir) {
  const out = [];
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) {
      if (!SKIP_DIRS.has(name)) out.push(...files(path));
    } else if (name.endsWith(".ts") && !SKIP_FILES.has(name) && !name.endsWith(".test.ts")) {
      out.push(path);
    }
  }
  return out;
}

const failures = [];
let checked = 0;

for (const file of files(CONVEX)) {
  const raw = readFileSync(file, "utf8");
  const source = blankCommentsAndStrings(raw);
  const matches = [...source.matchAll(PUBLIC)];
  for (let i = 0; i < matches.length; i++) {
    const m = matches[i];
    const start = m.index;
    const end = i + 1 < matches.length ? matches[i + 1].index : source.length;
    const where = `${relative(ROOT, file)} › ${m[1]} (${m[2]})`;
    checked++;

    const handlerAt = source.slice(start, end).search(/\bhandler\s*[:(]/);
    if (handlerAt < 0) {
      failures.push(`${where} : aucun handler reconnu`);
      continue;
    }
    // Le corps du handler s'arrête à SON accolade fermante, pas à l'export suivant : sinon
    // un commentaire posé au-dessus de la fonction d'après serait compté pour celle-ci.
    // On part de la flèche, pas de la première accolade : une annotation de retour
    // (`Promise<{ link: string }>`) en contient une. Une forme non reconnue ÉCHOUE — mieux
    // vaut un contrôle qui refuse qu'un contrôle qui laisse passer.
    const arrow = source.indexOf("=>", start + handlerAt);
    const bodyStart = arrow < 0 ? -1 : source.slice(arrow + 2).search(/\S/) + arrow + 2;
    let open = -1;
    let close = -1;
    if (arrow >= 0 && arrow < end && source[bodyStart] === "{") {
      open = bodyStart;
      close = matchingBrace(source, open);
    }
    if (open < 0 || close < 0 || close > end) {
      failures.push(`${where} : corps du handler illisible (attendu : handler: async (ctx, …) => { … })`);
      continue;
    }
    const handlerBody = source.slice(open, close + 1);
    // L'exemption se lit dans le texte d'origine, mais seulement dans ce corps : un
    // commentaire posé au-dessus de l'export, ou dans `args`, n'exempte rien.
    if (/\/\/\s*garde\s*:\s*\S/.test(raw.slice(open, close + 1))) continue;

    const guardAt = Math.min(...GUARDS.map((g) => handlerBody.indexOf(g)).filter((p) => p >= 0));
    if (!Number.isFinite(guardAt)) {
      failures.push(`${where} : aucune garde`);
      continue;
    }
    const dbAt = handlerBody.indexOf("ctx.db");
    if (dbAt >= 0 && dbAt < guardAt) {
      failures.push(`${where} : accès à ctx.db AVANT la garde`);
    }
  }
}

if (failures.length > 0) {
  console.error(`✗ ${failures.length} fonction(s) publique(s) sans garde valable :`);
  for (const f of failures) console.error(`  - ${f}`);
  process.exit(1);
}
console.log(`✓ ${checked} fonctions publiques, toutes gardées (ou exemptées explicitement).`);
