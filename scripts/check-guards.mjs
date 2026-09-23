#!/usr/bin/env node
/**
 * Toute fonction Convex PUBLIQUE commence par une garde — Joliba (PERMISSIONS.md §9)
 *
 * Propriétés vérifiées, pour chaque `query`, `mutation` et `action` exportée hors de
 * `convex/lib`, `convex/_generated` et des fichiers d'infrastructure :
 *
 *  1. le corps appelle une garde (`requireUser`, `requireOrganizationMember`,
 *     `requireVenueAccess`, `requirePermission`, `requirePlatformAdmin`, `getCurrentUser`) ;
 *  2. cette garde intervient AVANT le premier accès `ctx.db` — lire puis vérifier, c'est
 *     avoir déjà lu ;
 *  3. seule exception admise : un commentaire `// garde : <raison>` qui dit pourquoi la
 *     fonction n'en a pas besoin (le jeton EST la portée, garde déléguée…). L'exception
 *     est donc visible en revue, jamais implicite.
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
];
const PUBLIC = /export const (\w+)\s*=\s*(query|mutation|action)\(/g;

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
  const source = readFileSync(file, "utf8");
  const matches = [...source.matchAll(PUBLIC)];
  for (let i = 0; i < matches.length; i++) {
    const m = matches[i];
    const start = m.index;
    const end = i + 1 < matches.length ? matches[i + 1].index : source.length;
    const body = source.slice(start, end);
    const where = `${relative(ROOT, file)} › ${m[1]} (${m[2]})`;
    checked++;

    if (/\/\/\s*garde\s*:/.test(body)) continue;

    const guardAt = Math.min(...GUARDS.map((g) => body.indexOf(g)).filter((p) => p >= 0));
    if (!Number.isFinite(guardAt)) {
      failures.push(`${where} : aucune garde`);
      continue;
    }
    const dbAt = body.indexOf("ctx.db");
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
