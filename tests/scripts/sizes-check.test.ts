// @vitest-environment node
/**
 * Le contrôle des tailles doit ÉCHOUER sur ce qu'il interdit, et LAISSER PASSER ce qu'il prescrit
 * — sortir une fonction longue dans un module à part, renommer un fichier. Un contrôle qui ne peut
 * pas échouer ne prouve rien ; un contrôle qui refuse son propre remède apprend à le contourner.
 *
 * Chaque cas part d'un dépôt git jetable : une base, puis une modification.
 */

import { execFileSync, spawnSync } from "node:child_process";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { afterEach, describe, expect, test } from "vitest";

const SCRIPT = resolve("scripts/check-sizes.mjs");
const repos: string[] = [];

function fn(name: string, lines: number) {
  const body = Array.from({ length: lines - 2 }, (_, i) => `  const v${i} = ${i};`).join("\n");
  return `export function ${name}() {\n${body}\n}\n`;
}

function repo(files: Record<string, string>) {
  const dir = mkdtempSync(join(tmpdir(), "check-sizes-"));
  repos.push(dir);
  const git = (...args: string[]) => execFileSync("git", ["-c", "user.name=t", "-c", "user.email=t@t", ...args], { cwd: dir, stdio: "pipe" });
  git("init", "-q", "-b", "base");
  write(dir, files);
  git("add", "-A");
  git("commit", "-qm", "base");
  git("checkout", "-qb", "travail");
  return { dir, git };
}

function write(dir: string, files: Record<string, string>) {
  for (const [path, text] of Object.entries(files)) {
    mkdirSync(dirname(join(dir, path)), { recursive: true });
    writeFileSync(join(dir, path), text);
  }
}

function check(dir: string) {
  return spawnSync(process.execPath, [SCRIPT, "base"], { cwd: dir, encoding: "utf8" });
}

afterEach(() => {
  for (const dir of repos.splice(0)) rmSync(dir, { recursive: true, force: true });
});

describe("scripts/check-sizes.mjs", () => {
  test("refuse une fonction longue allongée, et une fonction longue créée dans un fichier non suivi", () => {
    const { dir } = repo({ "src/a.ts": fn("longue", 90) });
    write(dir, { "src/a.ts": fn("longue", 95), "src/nouveau.ts": fn("neuve", 85) });
    const result = check(dir);
    expect(result.status).toBe(1);
    expect(result.stderr).toContain("src/a.ts:1 longue : 90 → 95 lignes");
    expect(result.stderr).toContain("src/nouveau.ts:1 neuve : créée à 85 lignes");
  });

  test("laisse passer une fonction longue DÉPLACÉE dans un autre module, et un fichier renommé", () => {
    const { dir, git } = repo({ "src/gros.ts": fn("longue", 90) + fn("autre", 90), "src/b.ts": fn("seule", 90) });
    // La fonction longue sort dans un module à part, sans s'allonger ; l'autre fichier est renommé.
    write(dir, { "src/gros.ts": fn("autre", 90), "src/extrait.ts": fn("longue", 90) });
    git("mv", "src/b.ts", "src/renomme.ts");
    const result = check(dir);
    expect(result.stderr).toBe("");
    expect(result.status).toBe(0);
  });

  test("une fonction longue renommée paraît créée : le nom est ce qui la suit", () => {
    const { dir } = repo({ "src/a.ts": fn("ancien", 90) });
    write(dir, { "src/a.ts": fn("nouveau", 90) });
    const result = check(dir);
    expect(result.status).toBe(1);
    expect(result.stderr).toContain("nouveau : créée à 90 lignes");
  });

  test("mesure les rappels de test par leur libellé", () => {
    const { dir } = repo({ "tests/a.test.ts": 'import { test } from "vitest";\n' });
    const body = Array.from({ length: 90 }, (_, i) => `  const v${i} = ${i};`).join("\n");
    write(dir, { "tests/a.test.ts": `import { test } from "vitest";\ntest("un cas trop long", () => {\n${body}\n});\n` });
    const result = check(dir);
    expect(result.status).toBe(1);
    expect(result.stderr).toContain("test(un cas trop long) : créée à 92 lignes");
  });

  test("refuse un fichier qui franchit 1000 lignes", () => {
    const { dir } = repo({ "src/b.ts": "export const x = 1;\n" });
    write(dir, { "src/b.ts": Array.from({ length: 1001 }, (_, i) => `export const x${i} = ${i};`).join("\n") + "\n" });
    const result = check(dir);
    expect(result.status).toBe(1);
    expect(result.stderr).toContain("src/b.ts : 1 → 1001 lignes");
  });

  test("une fonction longue restée en place ne couvre pas une nouvelle du même nom ailleurs", () => {
    // Le cas Convex : `create.handler` existe déjà, long, dans orders.ts ; tips.ts en crée un autre.
    const { dir } = repo({ "src/orders.ts": fn("handler", 150) + "export const y = 0;\n" });
    write(dir, { "src/orders.ts": fn("handler", 150) + "export const y = 1;\n", "src/tips.ts": fn("handler", 140) });
    const result = check(dir);
    expect(result.status).toBe(1);
    expect(result.stderr).toContain("src/tips.ts:1 handler : créée à 140 lignes");
  });

  test("un test ajouté dans un describe déjà long passe : describe n'est qu'un conteneur", () => {
    const tests = (n: number) => Array.from({ length: n }, (_, i) => `  test("cas ${i}", () => {\n    expect(${i}).toBe(${i});\n  });`).join("\n");
    const suite = (n: number) => `import { describe, expect, test } from "vitest";\ndescribe("la file", () => {\n${tests(n)}\n});\n`;
    const { dir } = repo({ "tests/a.test.ts": suite(30) });
    write(dir, { "tests/a.test.ts": suite(31) });
    const result = check(dir);
    expect(result.stderr).toBe("");
    expect(result.status).toBe(0);
  });

  test("sort en erreur, sans rien affirmer, quand la base est introuvable", () => {
    const { dir } = repo({ "src/a.ts": "export const x = 1;\n" });
    const result = spawnSync(process.execPath, [SCRIPT, "pas-de-base"], { cwd: dir, encoding: "utf8" });
    expect(result.status).toBe(2);
  });
});
