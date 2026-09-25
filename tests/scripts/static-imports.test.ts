// @vitest-environment node
/**
 * La fermeture des imports statiques, sur laquelle repose `check-guest-bundle` : un fichier que
 * le manifeste ne liste pas, mais qu'un fichier listé importe (même de loin), part quand même dans
 * le téléphone. Un import dynamique, lui, ne part que plus tard, s'il part.
 */

import { describe, expect, test } from "vitest";
import { staticClosure, staticImports } from "../../scripts/lib/static-imports.mjs";

describe("scripts/lib/static-imports.mjs", () => {
  test("lit les imports statiques du code minifié, pas les dynamiques", () => {
    const code = 'import{a as b}from"./x-1.js";import"./side.js";const l=()=>import("./later.js");export{b};';
    expect(staticImports("/assets/r.js", code)).toEqual(["/assets/x-1.js", "/assets/side.js"]);
  });

  test("suit A → B → C, s'arrête aux cycles, n'entre pas dans un import dynamique", () => {
    const chunks: Record<string, string> = {
      "/assets/a.js": 'import{f}from"./b.js";import("./late.js");',
      "/assets/b.js": 'import"./c.js";import{g}from"./a.js";',
      "/assets/c.js": "export const k=.4122214708;",
      "/assets/late.js": "export const z=1;",
    };
    const reached = staticClosure(["/assets/a.js"], (asset) => chunks[asset] ?? "");
    expect([...reached].sort()).toEqual(["/assets/a.js", "/assets/b.js", "/assets/c.js"]);
  });
});
