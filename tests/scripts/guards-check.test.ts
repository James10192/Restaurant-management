// @vitest-environment node
/**
 * Le contrôle statique des gardes doit ÉCHOUER sur une fonction non gardée, et sur une
 * lecture faite avant la garde. Un contrôle qui ne peut pas échouer ne prouve rien.
 */

import { spawnSync } from "node:child_process";
import { describe, expect, test } from "vitest";

function run(dir?: string) {
  const args = ["scripts/check-guards.mjs", ...(dir ? [dir] : [])];
  return spawnSync(process.execPath, args, { encoding: "utf8" });
}

describe("scripts/check-guards.mjs", () => {
  test("refuse une fonction sans garde et une lecture avant la garde", () => {
    const result = run("tests/fixtures/guards");
    expect(result.status).toBe(1);
    expect(result.stderr).toContain("lectureLibre (query) : aucune garde");
    expect(result.stderr).toContain("lirePuisVerifier (mutation) : accès à ctx.db AVANT la garde");
    expect(result.stderr).not.toContain("correcte");
    expect(result.stderr).not.toContain("exemptee");
  });

  test("accepte le backend réel", () => {
    const result = run();
    expect(result.stderr).toBe("");
    expect(result.status).toBe(0);
  });
});
