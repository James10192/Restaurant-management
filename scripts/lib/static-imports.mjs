/**
 * La fermeture des imports STATIQUES d'un script construit — Joliba
 *
 * Le manifeste de TanStack Start liste pour chaque route quelques fichiers à précharger, pas
 * tout ce qu'ils importent à leur tour : un module partagé importé par un composant de route
 * n'y figure pas, et pourtant le téléphone le télécharge avant d'afficher la page. On suit donc
 * les imports, dans le code minifié : `from"./x.js"` et `import"./x.js"`. Un `import("./x.js")`
 * est dynamique — chargé plus tard, s'il l'est — et n'est pas suivi.
 */

import { posix } from "node:path";

const STATIC_IMPORT = /(?:\bfrom|\bimport)\s*["']([^"']+\.js)["']/g;

/** Les chemins que `code`, servi à `asset` (ex. `/assets/a.js`), importe statiquement. */
export function staticImports(asset, code) {
  const out = [];
  for (const [, spec] of code.matchAll(STATIC_IMPORT)) {
    out.push(spec.startsWith("/") ? spec : posix.join(posix.dirname(asset), spec));
  }
  return out;
}

/** Tous les scripts atteints depuis `starts` par imports statiques, départs compris. */
export function staticClosure(starts, read) {
  const seen = new Set();
  const queue = [...starts];
  while (queue.length > 0) {
    const asset = queue.pop();
    if (seen.has(asset)) continue;
    seen.add(asset);
    queue.push(...staticImports(asset, read(asset)));
  }
  return seen;
}
