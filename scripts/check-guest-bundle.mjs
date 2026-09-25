#!/usr/bin/env node
/**
 * La frontière du paquet de la carte client, vérifiée sur ce qui part vraiment — Joliba
 *
 *     pnpm build && node scripts/check-guest-bundle.mjs
 *
 * Le calcul de couleur OKLCH (`convex/lib/brand.ts`) sert l'écran Apparence et le serveur. Il
 * n'a rien à faire dans le téléphone d'un client en 4G bridée : il y était entré une fois, par un
 * module partagé avec le `head()` des pages client, sans qu'aucune relecture le voie (D-166).
 *
 * Plutôt que de deviner par quels imports il pourrait revenir — le `head`, le `loader` ou le
 * `validateSearch` de N'IMPORTE QUELLE route partent dans l'entrée commune, un import peut être
 * transitif —, on lit le build : le manifeste de TanStack Start dit quels fichiers chaque route
 * charge d'office, et aucun de ceux des pages client ne doit contenir une constante du calcul.
 *
 * Pages client : l'entrée commune (`__root__`), le menu public, la carte de table et l'aperçu,
 * avec leurs routes parentes. Ce qui se charge plus tard par import dynamique n'est pas couvert :
 * c'est ce que remesure `scripts/measure-guest.mjs`.
 */

import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

/** Une constante de la matrice sRGB → LMS d'OKLab, que le minifieur garde telle quelle. */
const MARKER = "4122214708";
const GUEST_ROUTE = /^\/(menu\/|r\/|_auth\/apercu\/)/;
const ROOTS = [".output", ".vercel/output"];

function* walk(dir) {
  let entries;
  try {
    entries = readdirSync(dir);
  } catch {
    return;
  }
  for (const name of entries) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) yield* walk(path);
    else yield path;
  }
}

const files = ROOTS.flatMap((root) => [...walk(root)]);
// Deux builds peuvent coexister (node-server et Vercel) : on lit le plus récent.
const manifestFile = files
  .filter((f) => /_tanstack-start-manifest_v-[^/]*\.mjs$/.test(f))
  .sort((a, b) => statSync(b).mtimeMs - statSync(a).mtimeMs)[0];
if (!manifestFile) {
  console.error("check-guest-bundle : aucun build trouvé (.output ou .vercel/output). Lancez `pnpm build` d'abord.");
  process.exit(2);
}
const { tsrStartManifest } = await import(pathToFileURL(manifestFile).href);
const { routes } = tsrStartManifest();

// Où vivent les fichiers publics : le dossier qui contient le script d'entrée.
const entry = routes.__root__.scripts?.[0]?.attrs?.src;
const buildRoot = ROOTS.find((root) => manifestFile.startsWith(`${root}/`));
const entryFile = entry && files.find((f) => f.startsWith(`${buildRoot}/`) && f.endsWith(entry) && !f.includes("/server/") && !f.includes(".func/"));
if (!entryFile) {
  console.error(`check-guest-bundle : script d'entrée « ${entry} » introuvable dans le build.`);
  process.exit(2);
}
const publicDir = entryFile.slice(0, -entry.length);
const read = (asset) => readFileSync(join(publicDir, asset), "utf8");

// Le détecteur doit encore détecter : si la constante disparaît du build (réécrite par le
// minifieur, calcul déplacé), ce contrôle ne prouverait plus rien.
const carriers = readdirSync(join(publicDir, "assets")).filter((f) => f.endsWith(".js") && read(`/assets/${f}`).includes(MARKER));
if (carriers.length === 0) {
  console.error(`check-guest-bundle : la constante ${MARKER} n'est plus dans aucun script. Choisir un autre marqueur du calcul.`);
  process.exit(2);
}

// Une page client charge aussi ce que chargent ses routes parentes.
const parentOf = new Map();
for (const [id, route] of Object.entries(routes)) for (const child of route.children ?? []) parentOf.set(child, id);
const guestRoutes = new Set(["__root__"]);
for (const id of Object.keys(routes).filter((id) => GUEST_ROUTE.test(id))) {
  for (let r = id; r; r = parentOf.get(r)) guestRoutes.add(r);
}

const problems = [];
for (const id of guestRoutes) {
  const route = routes[id];
  const assets = new Set([...(route.preloads ?? []), ...(route.scripts ?? []).map((s) => s.attrs?.src).filter(Boolean)]);
  for (const asset of assets) if (read(asset).includes(MARKER)) problems.push(`${id} charge ${asset}, qui contient le calcul de couleur OKLCH`);
}

if (problems.length > 0) {
  console.error("✗ Paquet de la carte client (D-166) :\n");
  for (const p of problems) console.error(`  - ${p}`);
  console.error("\nLes pages client importent le thème depuis convex/lib/brandTheme, jamais depuis convex/lib/brand.");
  process.exit(1);
}
console.log(`✓ Paquet client : ${guestRoutes.size} route(s) contrôlée(s), le calcul de couleur ne vit que dans ${carriers.join(", ")}.`);
