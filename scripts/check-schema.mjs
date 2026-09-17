#!/usr/bin/env node
/**
 * Contrôles structurels du schéma Convex — [PRODUCT_NAME]
 *
 *   node scripts/check-schema.mjs
 *
 * HISTOIRE DE CE FICHIER, parce qu'elle explique sa forme.
 * Une première version affirmait vérifier « la règle de portée » en portant une liste de
 * tables dérogatoires si large qu'elle couvrait tout le schéma : elle ne vérifiait rien, et
 * la synthèse s'appuyait dessus pour écrire « règle de portée respectée ». Une vérification
 * qui ne peut pas échouer est pire que pas de vérification — elle transforme une affirmation
 * en fait.
 *
 * Ce script ne contrôle donc plus que des propriétés RÉFUTABLES :
 *   1. aucun nom d'index en double dans une table (erreur d'exécution Convex) ;
 *   2. aucune limite Convex dépassée (32 index/table, 16 champs/index) ;
 *   3. aucune table à `venueId` obligatoire ne recopie `organizationId` (invariant du judo) ;
 *   4. tout index marqué SCOPE-CRITIQUE commence bien par une clé de portée, OU sa requête
 *      est signalée comme devant vérifier la portée (le commentaire est alors obligatoire) ;
 *   5. toute table du schéma est documentée dans DATA_MODEL.md, et réciproquement.
 */
import { readFileSync } from "node:fs";

const src = readFileSync("convex/schema.ts", "utf8");
const doc = readFileSync("DATA_MODEL.md", "utf8");

const blocks = src.split(/\n {2}(?=\w+: defineTable\()/);
const tables = [];
for (const b of blocks) {
  const m = b.match(/^(\w+): defineTable\(/);
  if (!m) continue;
  tables.push({
    name: m[1],
    body: b,
    indexes: [...b.matchAll(/\.index\("([^"]+)",\s*\[([^\]]*)\]/g)].map((x) => ({
      name: x[1],
      fields: x[2].split(",").map((f) => f.trim().replace(/"/g, "")).filter(Boolean),
      // La marque ne vaut que pour l'index qui la suit IMMÉDIATEMENT : sinon un commentaire
      // couvrirait tous les index voisins, et la vérification redeviendrait creuse.
      scopeCritical: /SCOPE-CRITIQUE[\s\S]*?$/.test(
        b.slice(Math.max(0, x.index - 600), x.index).split(/\.index\(/).pop() ?? "",
      ),
    })),
    searchIndexes: [...b.matchAll(/\.searchIndex\("([^"]+)"/g)].map((x) => x[1]),
    hasRequiredVenue: /venueId: v\.id\("venues"\)/.test(b),
    hasRequiredOrg: /organizationId: v\.id\("organizations"\)/.test(b),
  });
}

const errors = [];
const SCOPE_KEYS = new Set(["organizationId", "venueId"]);

for (const t of tables) {
  const names = [...t.indexes.map((i) => i.name), ...t.searchIndexes];
  const dup = names.filter((n, i) => names.indexOf(n) !== i);
  if (dup.length) errors.push(`${t.name} : nom d'index en double → ${[...new Set(dup)].join(", ")}`);
  if (names.length > 32) errors.push(`${t.name} : ${names.length} index (plafond Convex : 32)`);
  for (const i of t.indexes) {
    if (i.fields.length > 16) errors.push(`${t.name}.${i.name} : ${i.fields.length} champs (plafond : 16)`);
    if (i.scopeCritical && !SCOPE_KEYS.has(i.fields[0])) {
      errors.push(
        `${t.name}.${i.name} : marqué SCOPE-CRITIQUE mais commence par « ${i.fields[0]} ». ` +
          `Soit il est préfixé par une clé de portée, soit la requête vérifie la portée AVANT — et le dit.`,
      );
    }
  }
  // Le judo : une table scopée par une venue obligatoire ne recopie pas l'organisation.
  if (t.hasRequiredVenue && t.hasRequiredOrg) {
    errors.push(
      `${t.name} : porte organizationId ALORS QUE venueId est obligatoire. ` +
        `L'organisation se dérive de la venue ; la recopier crée une ligne capable de se contredire.`,
    );
  }
  // Toute table doit être documentée.
  if (!doc.includes(`\`${t.name}\``)) {
    errors.push(`${t.name} : absente de DATA_MODEL.md — une table non documentée est un défaut bloquant.`);
  }
}

const totalIndexes = tables.reduce((n, t) => n + t.indexes.length, 0);
const scopeCritical = tables.flatMap((t) => t.indexes.filter((i) => i.scopeCritical).map((i) => `${t.name}.${i.name}`));
const maxIdx = tables.reduce((a, t) => (t.indexes.length > a.indexes.length ? t : a), tables[0]);

console.log(`Tables                     : ${tables.length}`);
console.log(`Index                      : ${totalIndexes} (max ${maxIdx.indexes.length} sur « ${maxIdx.name} », plafond 32)`);
console.log(`Index de recherche         : ${tables.reduce((n, t) => n + t.searchIndexes.length, 0)}`);
console.log(`Index SCOPE-CRITIQUE       : ${scopeCritical.length ? scopeCritical.join(", ") : "aucun"}`);
console.log(`Tables portant organizationId : ${tables.filter((t) => t.hasRequiredOrg).length} (venue absente ou facultative)`);

if (errors.length) {
  console.error(`\n✗ ${errors.length} problème(s) :`);
  for (const e of errors) console.error(`    ${e}`);
  process.exit(1);
}
console.log("\n✓ Aucun doublon, aucune limite dépassée, aucune recopie d'organisation, toutes les tables documentées.");
