#!/usr/bin/env node
/**
 * Vérifie que le catalogue de permissions (convex/lib/permissions.ts) et sa
 * documentation (PERMISSIONS.md) disent la même chose, et que les modèles de rôles
 * ne citent aucune permission inexistante.
 *
 * PERMISSIONS.md §9 promet ce contrôle. Un document qui promet un test et ne le
 * fournit pas est un document qui ment — d'où ce fichier.
 *
 *   node scripts/check-permissions-sync.mjs
 */
import { readFileSync } from "node:fs";

const code = readFileSync("convex/lib/permissions.ts", "utf8");
const doc = readFileSync("PERMISSIONS.md", "utf8");

const KNOWN_PREFIX = [
  "organization.", "venue.", "menu.", "table.", "order.", "kitchen.", "service_request.",
  "payment.", "check.", "cash_register.", "customer.", "loyalty.", "reservation.",
  "inventory.", "team.", "permissions.", "device.", "analytics.", "audit.", "export.",
  "bill.", "report.",
  "ai.", "platform.",
];
const looksLikePermission = (p) => KNOWN_PREFIX.some((prefix) => p.startsWith(prefix));

const inCode = new Set([...code.matchAll(/^ {2}"([a-z_]+(?:\.[a-z_]+)+)":/gm)].map((m) => m[1]));
const inDoc = new Set(
  [...doc.matchAll(/`([a-z_]+(?:\.[a-z_]+)+)`/g)].map((m) => m[1]).filter(looksLikePermission),
);

const missingFromDoc = [...inCode].filter((p) => !inDoc.has(p)).sort();
const missingFromCode = [...inDoc].filter((p) => !inCode.has(p)).sort();

// Les modèles de rôles ne doivent citer que des permissions métier existantes.
const rolesBlock = code.split("ROLE_TEMPLATES")[1] ?? "";
const businessPermissions = new Set([...inCode].filter((p) => !p.startsWith("platform.")));
const unknownInRoles = [...new Set([...rolesBlock.matchAll(/"([a-z_]+(?:\.[a-z_]+)+)"/g)].map((m) => m[1]))]
  .filter((p) => !businessPermissions.has(p))
  .sort();

let failed = false;
const fail = (title, items) => {
  failed = true;
  console.error(`\n✗ ${title} (${items.length}) :`);
  for (const i of items) console.error(`    ${i}`);
};

if (missingFromDoc.length) fail("Dans le code mais absentes de PERMISSIONS.md", missingFromDoc);
if (missingFromCode.length) fail("Documentées mais absentes du catalogue", missingFromCode);
if (unknownInRoles.length) fail("Modèles de rôles citant une permission inexistante", unknownInRoles);

if (failed) {
  console.error("\nUne permission existe dans le code OU dans la documentation, jamais dans un seul des deux.");
  process.exit(1);
}

console.log(`✓ ${inCode.size} permissions — catalogue et documentation alignés, modèles de rôles valides.`);
