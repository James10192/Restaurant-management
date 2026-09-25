/**
 * La porte de sortie de la tranche T5 : « régler depuis la table, par Wave, sans qu'un franc se
 * perde ni se compte deux fois ». Dans un vrai navigateur, contre un vrai backend et le VRAI
 * adaptateur Wave de Joliba, qui parle au faux Wave de `e2e/wave-sink.mjs` (D-125) :
 *  - le gérant branche Wave : clé, adresse du webhook collée « chez Wave », secret, test de la
 *    connexion, événement de test signé reçu, puis activation ;
 *  - deux convives commandent ; le premier règle SES articles, le second tout le reste, chacun
 *    en passant par la page de paiement Wave puis en revenant à la table ;
 *  - le serveur voit les deux paiements arriver sur l'addition, sans recharger, et plus rien à
 *    payer ;
 *  - le même webhook rejoué est accepté sans rien doubler ; un webhook falsifié est refusé ;
 *  - le rapprochement du lendemain retrouve les deux paiements au relevé Wave.
 */

import { execFileSync } from "node:child_process";
import { expect, test, type Browser, type BrowserContext, type Page } from "@playwright/test";
import { clientHeaders } from "./mail";
import { shot, signIn } from "./session";

const run = Date.now().toString(36);
const OWNER = `wave-${run}@maquis.test`;
const env = { ...process.env, CONVEX_AGENT_MODE: "anonymous" };
const SEND = /^Envoyer — part directement en cuisine/;
const WAVE = "http://127.0.0.1:4020";

let scanPath = "";

test.describe.configure({ mode: "serial" });
test.setTimeout(300_000);

test.beforeAll(() => {
  const out = execFileSync("node", ["scripts/seed-demo.mjs"], { env, encoding: "utf8", stdio: ["ignore", "pipe", "inherit"] });
  scanPath = (JSON.parse(out.trim().split("\n").pop()!) as { scanPath: string }).scanPath;
  // Le restaurant de démonstration est une simulation : aucune tablée n'y paie en ligne. On l'en
  // sort AVANT d'ouvrir la table, qui hérite du mode à son ouverture.
  execFileSync("pnpm", ["exec", "convex", "run", "devSeed:leaveSimulation", "{}"], { env, encoding: "utf8" });
});

async function wave<T>(path: string, body?: unknown): Promise<T> {
  const res = await fetch(`${WAVE}${path}`, body === undefined ? {} : { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  return (await res.json()) as T;
}

function mobile(browser: Browser): Promise<BrowserContext> {
  return browser.newContext({ extraHTTPHeaders: clientHeaders(), viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
}

async function ownerPage(browser: Browser): Promise<Page> {
  const page = await (await browser.newContext({ extraHTTPHeaders: clientHeaders(), viewport: { width: 1280, height: 900 } })).newPage();
  await page.goto("/connexion");
  await page.waitForLoadState("networkidle");
  await signIn(page, OWNER);
  await page.waitForURL(/\/app/);
  execFileSync("pnpm", ["exec", "convex", "run", "devSeed:joinDemo", JSON.stringify({ email: OWNER })], { env, encoding: "utf8" });
  return page;
}

/** Un convive scanne, ajoute un plat, saisit le code et envoie en cuisine. */
async function guestOrders(browser: Browser, dish: string, code: string): Promise<Page> {
  const page = await (await mobile(browser)).newPage();
  await page.goto(scanPath);
  await page.waitForURL(/\/table/);
  await page.getByRole("button", { name: "Appeler", exact: true }).waitFor();
  await page.getByRole("button", { name: new RegExp(dish) }).first().click();
  await page.getByRole("dialog").getByRole("button", { name: /^Ajouter ·/ }).click();
  await page.getByRole("button", { name: /Mon panier/ }).click();
  await page.getByLabel("Code de la table").focus();
  await page.keyboard.insertText(code);
  await page.getByRole("dialog").getByRole("button", { name: SEND }).click({ timeout: 20_000 });
  await expect(page.getByText(/envoyée en cuisine\.$/).first()).toBeVisible({ timeout: 20_000 });
  await page.keyboard.press("Escape");
  return page;
}

/** Régler depuis la table : le tiroir, la page Wave, le retour. */
async function payWithWave(page: Page, choice: RegExp) {
  await page.getByRole("button", { name: "Régler", exact: true }).click();
  const drawer = page.getByRole("dialog");
  await drawer.getByRole("radio", { name: choice }).click();
  // Un double appui ne crée qu'une session chez Wave.
  await drawer.getByRole("button", { name: /^Payer .+ avec Wave$/ }).dblclick();
  await page.waitForURL(/127\.0\.0\.1:4020\/checkout\//);
  await page.getByRole("button", { name: "Payer" }).click();
  await page.waitForURL(/\/table/);
  await expect(page.getByRole("dialog").getByText("Paiement reçu")).toBeVisible({ timeout: 30_000 });
  // L'adresse de retour ne garde pas `?paiement=retour` : un rechargement ne rejoue rien.
  expect(page.url()).not.toContain("paiement=");
}

test("régler par Wave depuis la table : rien de perdu, rien en double, tout au relevé", async ({ browser }) => {
  const staff = await ownerPage(browser);
  const errors: string[] = [];
  staff.on("pageerror", (e) => errors.push(String(e)));

  // ── Le gérant branche Wave ──
  await staff.goto("/app/settings/payments");
  const card = staff.locator("[data-wave-settings]");
  await expect(card).toBeVisible();
  await card.getByLabel("1. Clé d'API").fill(`wave_ci_prod_cle_e2e_${run}`);
  await card.getByLabel("3. Secret du webhook").fill("wave_ci_prod_WHS_secret_e2e_demo");
  await card.getByRole("button", { name: "Enregistrer les clés" }).click();
  await expect(staff.getByText("Enregistré et chiffré.")).toBeVisible();
  // Rien de ce qui a été collé ne se relit : seuls les quatre derniers caractères.
  await expect(card.getByLabel("1. Clé d'API")).toHaveValue("");
  await expect(card.getByLabel("1. Clé d'API")).toHaveAttribute("placeholder", new RegExp(`se termine par ${run.slice(-4)}$`));
  const webhookUrl = await card.getByLabel("2. Adresse du webhook, à coller chez Wave").inputValue();
  expect(webhookUrl).toMatch(/\/webhooks\/wave\/[A-Za-z0-9_-]{20,}$/);
  // « Chez Wave » : l'adresse et le secret du webhook.
  await wave("/__test/config", { webhookUrl, secret: "wave_ci_prod_WHS_secret_e2e_demo" });

  // Pas d'activation tant que rien n'est prouvé.
  await expect(card.getByRole("button", { name: "Proposer aux clients" })).toBeDisabled();
  await card.getByRole("button", { name: "Tester la connexion" }).click();
  await expect(card.getByText(/Droit « Solde » : oui/)).toBeVisible({ timeout: 20_000 });
  expect((await wave<{ status: number }>("/__test/test-event", {})).status).toBe(200);
  await expect(card.locator("[data-test-event=received]")).toBeVisible({ timeout: 20_000 });
  await card.getByRole("button", { name: "Proposer aux clients" }).click();
  await expect(staff.getByText("Paiement en ligne activé.")).toBeVisible();
  await shot(staff, "t5-01-wave-branche");

  // ── Commande directe, table 12 ──
  await staff.goto("/app/settings/devices");
  await staff.getByRole("radio", { name: /Le client envoie directement en cuisine/ }).click();
  await expect(staff.getByText("Mode de commande enregistré.")).toBeVisible();
  await staff.goto("/app/service");
  await staff.getByRole("button", { name: /^Table 12,/ }).click();
  await staff.getByRole("textbox", { name: /Couverts/ }).fill("2");
  await staff.getByRole("textbox", { name: /Couverts/ }).press("Enter");
  await expect(staff.getByRole("heading", { name: "Table 12" })).toBeVisible();
  const codeCell = staff.locator("[data-table-code]");
  await expect(codeCell).toHaveText(/^\d{4}$/);
  const code = (await codeCell.textContent())!.trim();

  const first = await guestOrders(browser, "Alloco", code);
  const second = await guestOrders(browser, "Gombo frit", code);
  for (const g of [first, second]) g.on("pageerror", (e) => errors.push(String(e)));

  // ── Le premier règle ses articles, le second le reste de la table ──
  const createsBefore = (await wave<{ creates: number }>("/__test/state")).creates;
  await payWithWave(first, /^Mes articles/);
  await shot(first, "t5-02-paiement-recu", false);
  expect((await wave<{ creates: number }>("/__test/state")).creates).toBe(createsBefore + 1);
  await payWithWave(second, /^Tout le reste de la table/);
  expect((await wave<{ creates: number }>("/__test/state")).creates).toBe(createsBefore + 2);

  // ── Le serveur voit les deux paiements, sans recharger ──
  await staff.getByRole("tab", { name: "Addition" }).click();
  const online = staff.getByRole("button", { name: "Actions sur le paiement En ligne — Wave" });
  await expect(online).toHaveCount(2, { timeout: 30_000 });
  await expect(staff.getByText("Reste à payer", { exact: true }).locator("xpath=following-sibling::*[1]")).toHaveText("0 F CFA");
  await expect(staff.getByText("payé depuis la table").first()).toBeVisible();
  await expect(staff.getByText("Relevé à venir").first()).toBeVisible();
  await shot(staff, "t5-03-addition-reglee");

  // ── Le même webhook rejoué ne double rien ; un webhook falsifié est refusé ──
  expect((await wave<{ status: number }>("/__test/replay", {})).status).toBe(200);
  expect((await wave<{ status: number }>("/__test/forged", {})).status).toBe(401);
  await staff.waitForTimeout(1_500);
  await expect(online).toHaveCount(2);

  // ── Le rapprochement du lendemain retrouve les deux paiements au relevé Wave ──
  execFileSync("pnpm", ["exec", "convex", "run", "onlinePayments:reconcileAll", JSON.stringify({ now: Date.now() + 86_400_000 })], { env, encoding: "utf8" });
  await expect(staff.getByText("Vu au relevé Wave")).toHaveCount(2, { timeout: 30_000 });
  await staff.goto("/app/settings/payments");
  await expect(staff.locator("[data-wave-settings]").getByText(/2 rapprochés/)).toBeVisible({ timeout: 20_000 });
  await shot(staff, "t5-04-rapprochement");

  expect(errors).toEqual([]);
});
