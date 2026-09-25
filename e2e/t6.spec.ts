/**
 * La porte de sortie de la tranche T6 : « le gérant comprend ». Dans un vrai navigateur, contre un
 * vrai backend :
 *  - pendant le service, la tour de contrôle (`/app/service`) montre le bon en cuisine, puis EN
 *    RETARD quand l'heure passe le seuil du poste — sans recharger : le retard se juge sur l'écran
 *    (D-135), d'où l'horloge de Playwright qu'on avance au lieu d'attendre 25 minutes ;
 *  - prêt, il passe dans « À servir » ; servi, il disparaît ;
 *  - le rapport ouvre sur la journée, et le jour vit dans l'adresse ;
 *  - « Données » répond aux questions : ce qui se vend, où le service coince (avec l'effectif de
 *    chaque délai), l'argent ;
 *  - les réglages sont rangés sous « Réglages », replié.
 */

import { execFileSync } from "node:child_process";
import { expect, test, type Browser, type Page } from "@playwright/test";
import { clientHeaders } from "./mail";
import { shot, signIn } from "./session";

const run = Date.now().toString(36);
const OWNER = `chiffres-${run}@maquis.test`;
const env = { ...process.env, CONVEX_AGENT_MODE: "anonymous" };
const TABLE = "10";

test.describe.configure({ mode: "serial" });
test.setTimeout(240_000);

test.beforeAll(() => {
  execFileSync("node", ["scripts/seed-demo.mjs"], { env, encoding: "utf8", stdio: ["ignore", "pipe", "inherit"] });
});

async function ownerPage(browser: Browser): Promise<Page> {
  const ctx = await browser.newContext({ extraHTTPHeaders: clientHeaders(), viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  const page = await ctx.newPage();
  // L'horloge du navigateur, sous contrôle : le retard d'un bon se voit sans attendre.
  await page.clock.install();
  await page.goto("/connexion");
  await page.waitForLoadState("networkidle");
  await signIn(page, OWNER);
  await page.waitForURL(/\/app/);
  execFileSync("pnpm", ["exec", "convex", "run", "devSeed:joinDemo", JSON.stringify({ email: OWNER })], { env, encoding: "utf8" });
  return page;
}

test("le gérant voit le service en direct, puis comprend sa journée", async ({ browser }) => {
  const page = await ownerPage(browser);
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(String(e)));

  // ── Une commande part en cuisine ──
  await page.goto("/app/service");
  await page.getByRole("button", { name: new RegExp(`^Table ${TABLE},`) }).click();
  await page.getByRole("textbox", { name: /Couverts/ }).fill("2");
  await page.getByRole("textbox", { name: /Couverts/ }).press("Enter");
  await expect(page.getByRole("heading", { name: `Table ${TABLE}` })).toBeVisible();
  await page.getByRole("button", { name: /^Commander/ }).click();
  await page.getByLabel("Chercher un plat").fill("alloco");
  await page.getByRole("button", { name: /^Alloco/ }).click();
  await page.getByRole("button", { name: /^Vérifier/ }).click();
  await page.getByRole("button", { name: "Envoyer" }).click();
  await expect(page.getByText(/^(Envoyée|En cuisine)$/).first()).toBeVisible({ timeout: 20_000 });
  await expect(page.getByText(/En attente d'envoi/)).toHaveCount(0, { timeout: 20_000 });

  // ── La tour de contrôle : « En cuisine », puis en retard quand l'heure passe le seuil ──
  await page.goto("/app/service");
  await page.getByRole("tab", { name: /[Cc]uisine/ }).click();
  const ticket = page.locator("[data-kitchen-ticket]").filter({ hasText: `Table ${TABLE}` });
  await expect(ticket).toBeVisible();
  await expect(ticket.getByText("En retard")).toHaveCount(0);
  await page.clock.fastForward("25:00");
  await expect(ticket.getByText("En retard")).toBeVisible({ timeout: 20_000 });
  await expect(page.getByRole("tab", { name: /[Cc]uisine.*en retard/ })).toBeVisible();
  await shot(page, "t6-01-en-cuisine-en-retard");
  // L'horloge revient à l'heure du serveur : 25 minutes d'avance, le client croit sa connexion (et
  // sa session) expirée, passe « hors ligne » et garde les gestes de cuisine pour lui. La suite se
  // joue à l'heure vraie.
  await page.clock.setSystemTime(new Date());
  await page.reload();

  // ── Prêt, puis servi ──
  await page.goto("/app/cuisine");
  const card = page.locator("[data-slot=card]").filter({ hasText: `Table ${TABLE}` }).first();
  await card.getByRole("button", { name: "Commencer" }).click();
  await card.getByRole("button", { name: "Prêt" }).click();
  await page.goto("/app/service");
  await page.getByRole("tab", { name: /À servir/ }).click();
  const ready = page.locator("[data-slot=item]").filter({ hasText: `Table ${TABLE}` });
  await expect(ready).toBeVisible({ timeout: 20_000 });
  await shot(page, "t6-02-a-servir");
  await ready.getByRole("button", { name: "Servi" }).click();
  await expect(ready).toHaveCount(0, { timeout: 20_000 });
  await page.getByRole("tab", { name: /[Cc]uisine/ }).click();
  await expect(ticket).toHaveCount(0);

  // ── Le rapport ouvre sur la journée ; le jour vit dans l'adresse ──
  await page.goto("/app/rapport");
  await expect(page.locator("[data-day-comparison]")).toBeVisible({ timeout: 20_000 });
  await expect(page.locator("[data-day-comparison]").getByText("Commandes")).toBeVisible();
  const today = await page.getByLabel("Jour", { exact: true }).inputValue();
  await page.getByRole("button", { name: "Jour précédent" }).click();
  await expect(page).toHaveURL(/jour=\d{4}-\d{2}-\d{2}/);
  await shot(page, "t6-03-rapport-journee");

  // ── Données : les questions du gérant ──
  await page.goto(`/app/analytics?du=${today}&au=${today}`);
  await expect(page.getByRole("heading", { name: "Données" })).toBeVisible({ timeout: 20_000 });
  await expect(page.getByRole("heading", { name: "Ce qui se vend" })).toBeVisible();
  await expect(page.locator("[data-top-products]").getByText(/Alloco/)).toBeVisible();
  const delays = page.locator("[data-delays]");
  await expect(delays.getByText(/Prêt → servi/)).toBeVisible();
  // Un délai se lit avec son effectif (D-143).
  await expect(delays.locator("[data-slot=item]").filter({ hasText: "Commencé → prêt" }).getByText(/sur \d+ bons?/)).toBeVisible();
  await expect(delays.locator("[data-slot=item]").filter({ hasText: "Prêt → servi" }).getByText(/sur \d+ bons?/)).toBeVisible();
  await expect(page.getByRole("heading", { name: "L'argent tombe-t-il juste ?" })).toBeVisible();
  await shot(page, "t6-04-donnees");
  await page.getByRole("radio", { name: "7 jours", exact: true }).click();
  await expect(page).toHaveURL(/du=\d{4}-\d{2}-\d{2}&au=/);
  await expect(page.getByText(/· 7 jours$/)).toBeVisible();

  // ── Les réglages, rangés : la navigation du service reste courte ──
  await page.getByRole("button", { name: "Afficher ou masquer le menu" }).click();
  const nav = page.getByRole("navigation", { name: "Navigation principale" });
  await expect(nav.getByRole("link", { name: "Données" })).toBeVisible();
  await expect(nav.getByRole("link", { name: "Établissement" })).toHaveCount(0);
  await nav.getByRole("button", { name: "Réglages" }).click();
  await expect(nav.getByRole("link", { name: "Établissement" })).toBeVisible();
  await shot(page, "t6-05-navigation");

  expect(errors).toEqual([]);
});
