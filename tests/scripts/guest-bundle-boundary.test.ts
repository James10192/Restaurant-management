// @vitest-environment node
/**
 * La frontière du paquet de la carte client (D-166, D-167).
 *
 * Tout ce qu'une route client importe — y compris dans son `head()` — part dans le téléphone de
 * chaque client, en 4G bridée. Le calcul OKLCH de `convex/lib/brand.ts` y était entré une fois,
 * par un module partagé avec l'écran Apparence : +1 Ko de script que personne n'avait vu. Le thème
 * vit désormais dans `brandTheme.ts` ; ce test empêche qu'on retourne importer `brand.ts` depuis la
 * carte client.
 */

import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, test } from "vitest";

/** Ce que la carte client charge : ses routes, ses composants, ses bibliothèques. */
const GUEST = [
  ...readdirSync("src/routes")
    .filter((f) => /^(r\.|menu\.|_auth\.apercu\.)/.test(f))
    .map((f) => join("src/routes", f)),
  ...["src/components/guest", "src/lib/guest"].flatMap((dir) => readdirSync(dir).map((f) => join(dir, f))),
];

const FORBIDDEN = /from\s+["'][^"']*\/lib\/brand["']/;

describe("paquet de la carte client", () => {
  test("il y a bien des fichiers à contrôler", () => {
    expect(GUEST.filter((f) => f.startsWith("src/routes")).length).toBeGreaterThanOrEqual(4);
  });

  test("aucun fichier de la carte client n'importe le calcul de couleur (convex/lib/brand)", () => {
    const offenders = GUEST.filter((f) => FORBIDDEN.test(readFileSync(f, "utf8")));
    expect(offenders).toEqual([]);
  });

  test("le motif attrape bien l'import interdit, et laisse passer brandTheme", () => {
    expect(FORBIDDEN.test('import { resolveBrandColor } from "../../convex/lib/brand";')).toBe(true);
    expect(FORBIDDEN.test('import { brandThemeCss } from "../../convex/lib/brandTheme";')).toBe(false);
  });
});
