/**
 * Parcours de la tranche T2, dans un vrai navigateur, contre un vrai backend :
 *  - le serveur ouvre une table, saisit une commande (options, tailles, service retenu), la
 *    cuisine la prépare, le serveur la porte et envoie la suite ; puis tout recommence SANS
 *    RÉSEAU, et la commande part au retour de la connexion (D-062) ;
 *  - le client compose un panier à table et le montre ; le serveur l'importe (D-061) ;
 *  - une tablette partagée est enrôlée, une serveuse sans compte active son PIN, s'identifie,
 *    commande ; un écran de cuisine enrôlé reçoit le bon ; la tablette révoquée retombe sur
 *    l'enrôlement (D-060).
 *
 * Le restaurant de démonstration (`scripts/seed-demo.mjs`) fournit la carte publiée ;
 * `devSeed:joinDemo` y rattache le compte du test et pose huit tables.
 */

import { execFileSync } from "node:child_process";
import { expect, test, type Browser, type Page } from "@playwright/test";
import { clientHeaders } from "./mail";
import { shot, signIn } from "./session";

const run = Date.now().toString(36);
const OWNER = `service-${run}@maquis.test`;
const env = { ...process.env, CONVEX_AGENT_MODE: "anonymous" };

function convexRun(fn: string, args: unknown): string {
  return execFileSync("pnpm", ["exec", "convex", "run", fn, JSON.stringify(args)], { env, encoding: "utf8" });
}

let scanPath = "";

test.describe.configure({ mode: "serial" });
test.setTimeout(240_000);

test.beforeAll(() => {
  const out = execFileSync("node", ["scripts/seed-demo.mjs"], { env, encoding: "utf8", stdio: ["ignore", "pipe", "inherit"] });
  scanPath = (JSON.parse(out.trim().split("\n").pop()!) as { scanPath: string }).scanPath;
});

async function ownerPage(browser: Browser, mobile = true): Promise<Page> {
  const ctx = await browser.newContext({
    extraHTTPHeaders: clientHeaders(),
    ...(mobile ? { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true } : {}),
  });
  const page = await ctx.newPage();
  await page.goto("/connexion");
  await page.waitForLoadState("networkidle");
  await signIn(page, OWNER);
  await page.waitForURL(/\/app/);
  convexRun("devSeed:joinDemo", { email: OWNER });
  return page;
}

async function codeFrom(page: Page, label: string): Promise<string> {
  const input = page.getByRole("textbox", { name: label });
  await expect(input).toHaveValue(/^[A-Z2-9]{4}-[A-Z2-9]{4}$/);
  return input.inputValue();
}

test("le service : saisir, préparer, porter, envoyer la suite, et sans réseau", async ({ browser }) => {
  const page = await ownerPage(browser);
  const ctx = page.context();
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(String(e)));

  await page.goto("/app/service");
  await expect(page.getByRole("heading", { name: "Service" })).toBeVisible();
  await shot(page, "t2-01-salle");

  await page.getByRole("button", { name: /^Table 1,/ }).click();
  const guests = page.getByRole("textbox", { name: /Couverts/ });
  await guests.fill("3");
  await guests.press("Enter");
  await expect(page.getByRole("heading", { name: "Table 1" })).toBeVisible();

  await page.getByRole("button", { name: /^Commander/ }).click();
  await page.getByLabel("Chercher un plat").fill("poulet br");
  await page.getByRole("button", { name: /Poulet braisé/ }).click();
  await page.getByLabel("Attiéké").check();
  await page.getByRole("button", { name: /^Ajouter ·/ }).click();
  await page.getByLabel("Chercher un plat").fill("biss");
  await page.getByRole("button", { name: /Bissap/ }).click();
  await page.getByLabel("1 L").check();
  await page.getByRole("button", { name: "Un de plus" }).click();
  await page.getByRole("button", { name: /^Ajouter ·/ }).click();
  await page.getByRole("radio", { name: "Service 3" }).click();
  await page.getByLabel("Chercher un plat").fill("degue");
  await page.getByRole("button", { name: /Dêguê/ }).click();
  await shot(page, "t2-02-saisie");
  await page.getByRole("button", { name: /^Vérifier/ }).click();
  // Le prix estimé suit la carte : 3 500 + 2 × 1 500 + 1 000.
  await expect(page.getByText(/7\s?500/).first()).toBeVisible();
  await shot(page, "t2-03-verifier");
  await page.getByRole("button", { name: "Envoyer" }).click();
  await expect(page.getByRole("button", { name: "Envoyer le service 3" })).toBeVisible({ timeout: 20_000 });
  await expect(page.getByText(/Attend l'appel/)).toBeVisible();
  await shot(page, "t2-04-table");

  // La cuisine
  await page.goto("/app/cuisine");
  await expect(page.getByText("Table 1").first()).toBeVisible();
  await shot(page, "t2-05-cuisine");
  await page.getByRole("button", { name: "Commencer" }).first().click();
  await page.getByRole("button", { name: "Prêt" }).first().click();
  await expect(page.getByText("Prêts, en attente du serveur")).toBeVisible({ timeout: 20_000 });

  // Porter, puis envoyer la suite
  await page.goto("/app/service");
  await page.getByRole("tab", { name: /À servir/ }).click();
  await page.getByRole("button", { name: "Servi" }).first().click();
  await expect(page.getByText("Rien à porter")).toBeVisible({ timeout: 20_000 });
  await page.getByRole("tab", { name: /Tables/ }).click();
  await page.getByRole("button", { name: /^Table 1,/ }).click();
  await page.getByRole("button", { name: "Envoyer le service 3" }).click();
  await expect(page.getByRole("button", { name: /service 3/ })).toHaveCount(0, { timeout: 20_000 });

  // Sans réseau : ouvrir la table 2 et y commander ; tout part au retour de la connexion.
  await page.getByRole("button", { name: "Retour aux tables" }).click();
  await ctx.setOffline(true);
  // L'application doit avoir CONSTATÉ la coupure avant le geste : sinon l'ouverture part par la
  // liaison encore ouverte, et le test mesure une course au lieu de la file hors ligne.
  await expect(page.getByText("Hors ligne")).toBeVisible();
  await page.getByRole("button", { name: /^Table 2,/ }).click();
  await page.getByRole("textbox", { name: /Couverts/ }).press("Enter");
  await expect(page.getByText("Ouverture en attente du réseau")).toBeVisible();
  await page.getByRole("button", { name: /^Commander/ }).click();
  await page.getByLabel("Chercher un plat").fill("soda");
  await page.getByRole("button", { name: /Soda/ }).click();
  await page.getByRole("button", { name: /^Vérifier/ }).click();
  await page.getByRole("button", { name: "Envoyer" }).click();
  await expect(page.getByText(/En attente d'envoi/)).toBeVisible();
  await expect(page.getByText("Hors ligne")).toBeVisible();
  // Sans réseau, pas de clôture.
  await expect(page.getByRole("button", { name: "Clôturer" })).toHaveCount(0);
  await shot(page, "t2-06-hors-ligne");
  await ctx.setOffline(false);
  // La coupure simulée ne ferme pas la liaison déjà ouverte : Convex ne s'en aperçoit qu'au
  // battement de cœur suivant, et la file retente toutes les 15 s d'ici là.
  await expect(page.getByText(/1 × Soda/)).toBeVisible({ timeout: 90_000 });
  await expect(page.getByText(/En attente d'envoi/)).toHaveCount(0, { timeout: 90_000 });
  await shot(page, "t2-07-retour-reseau");

  expect(errors).toEqual([]);
});

test("le client compose, montre ; le serveur importe", async ({ browser }) => {
  const guestCtx = await browser.newContext({ extraHTTPHeaders: clientHeaders(), viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  const guest = await guestCtx.newPage();
  const page = await ownerPage(browser);

  // Le serveur ouvre la table 12, celle du QR.
  await page.goto("/app/service");
  await page.getByRole("button", { name: /^Table 12,/ }).click();
  await page.getByRole("textbox", { name: /Couverts/ }).press("Enter");
  await expect(page.getByRole("heading", { name: "Table 12" })).toBeVisible();

  await guest.goto(scanPath);
  await guest.waitForURL(/\/table/);
  // La barre de commande se charge après la carte : c'est le signe que la page est vivante.
  await guest.getByRole("button", { name: "Appeler", exact: true }).waitFor();
  const dialog = () => guest.getByRole("dialog");
  await guest.getByRole("button", { name: /Brochettes de bœuf/ }).first().click();
  await dialog().getByText("Alloco", { exact: true }).click();
  await dialog().getByRole("button", { name: /^Ajouter ·/ }).click();
  await guest.getByRole("button", { name: /Mon panier/ }).click();
  await dialog().getByRole("button", { name: "Montrer au serveur" }).click();
  await expect(dialog().getByText("Panier prêt — montrez-le à votre serveur")).toBeVisible();
  await shot(guest, "t2-08-client-panier");

  await expect(page.getByText(/Panier préparé par les clients/)).toBeVisible({ timeout: 20_000 });
  await shot(page, "t2-09-serveur-panier");
  // Le panier rejoint la saisie du serveur : il relit, puis envoie comme d'habitude (D-061).
  await page.getByRole("button", { name: "Reprendre dans ma saisie" }).click();
  await page.getByRole("button", { name: /^Vérifier \(1\)/ }).click();
  await expect(page.getByText("Alloco")).toBeVisible();
  await page.getByRole("button", { name: "Envoyer" }).click();
  await expect(page.getByText(/1 × Brochettes de bœuf/)).toBeVisible({ timeout: 20_000 });
  await expect(page.getByText(/Panier préparé par les clients/)).toHaveCount(0);

  // Le client retrouve sa commande, reprise par le serveur, dans « Mes commandes » (D-101).
  await guest.keyboard.press("Escape");
  await guest.getByRole("button", { name: /Mes commandes/ }).click({ timeout: 20_000 });
  await expect(dialog().getByText("Pris par votre serveur")).toBeVisible({ timeout: 20_000 });
  await expect(dialog().getByText(/Brochettes de bœuf/)).toBeVisible();
  await shot(guest, "t2-09b-client-pris", false);
});

test("appareils : tablette partagée avec PIN, écran de cuisine, révocation", async ({ browser }) => {
  const page = await ownerPage(browser, false);
  const errors: string[] = [];

  await page.goto("/app/team");
  await page.getByRole("button", { name: "Ajouter un membre sans compte (PIN)" }).click();
  await page.getByLabel("Nom").fill("Awa Koné");
  await page.getByLabel("Rôle").selectOption({ label: "Serveur" });
  await page.getByRole("button", { name: "Ajouter et obtenir un code" }).click();
  const activation = await codeFrom(page, "Code d'activation");
  await page.getByRole("button", { name: "Terminé" }).click();

  await page.goto("/app/settings/devices");
  await page.getByRole("button", { name: "Ajouter un appareil" }).click();
  await page.getByLabel("Appareil partagé").check();
  await page.getByLabel("Nom de l'appareil").fill("Tablette salle");
  await page.getByRole("button", { name: "Obtenir un code" }).click();
  const salle = await codeFrom(page, "Code d'enrôlement");
  await page.getByRole("button", { name: "Terminé" }).click();

  const tablet = await (await browser.newContext({ extraHTTPHeaders: clientHeaders(), viewport: { width: 820, height: 1180 }, hasTouch: true })).newPage();
  tablet.on("pageerror", (e) => errors.push(String(e)));
  await tablet.goto("/appareil");
  await tablet.getByLabel("Code d'enrôlement").fill(salle);
  await tablet.getByRole("button", { name: "Enrôler" }).click();
  await tablet.getByRole("button", { name: "Activer mon PIN" }).click();
  await tablet.getByLabel("Code d'activation").fill(activation);
  // Un PIN trop simple est refusé.
  await tablet.getByLabel("Nouveau PIN (4 chiffres)").fill("1234");
  await tablet.getByLabel("Le même, encore une fois").fill("1234");
  await tablet.getByRole("button", { name: "Enregistrer mon PIN" }).click();
  await expect(tablet.getByRole("alert").filter({ hasNotText: /^$/ }).first()).toBeVisible();
  await tablet.getByLabel("Nouveau PIN (4 chiffres)").fill("4826");
  await tablet.getByLabel("Le même, encore une fois").fill("4826");
  await tablet.getByRole("button", { name: "Enregistrer mon PIN" }).click();
  await expect(tablet.getByText("PIN enregistré")).toBeVisible();
  await tablet.getByRole("button", { name: "Continuer" }).click();
  await shot(tablet, "t2-10-verrou");
  await tablet.getByRole("button", { name: /Awa Koné/ }).click();
  for (const d of "1357") await tablet.getByRole("button", { name: d, exact: true }).click();
  await expect(tablet.getByText(/PIN incorrect/)).toBeVisible();
  for (const d of "4826") await tablet.getByRole("button", { name: d, exact: true }).click();
  await expect(tablet.getByRole("heading", { name: "Service" })).toBeVisible({ timeout: 20_000 });

  await tablet.getByRole("button", { name: /^Table 3,/ }).click();
  await tablet.getByRole("textbox", { name: /Couverts/ }).press("Enter");
  await tablet.getByRole("button", { name: /^Commander/ }).click();
  await tablet.getByLabel("Chercher un plat").fill("brochettes");
  await tablet.getByRole("button", { name: /Brochettes de bœuf/ }).click();
  await tablet.getByLabel("Alloco").check();
  await tablet.getByRole("button", { name: /^Ajouter ·/ }).click();
  await tablet.getByRole("button", { name: /^Vérifier/ }).click();
  await tablet.getByRole("button", { name: "Envoyer" }).click();
  // La commande est au nom de la personne identifiée, pas de l'appareil.
  await expect(tablet.getByText(/Awa Koné/).first()).toBeVisible();
  await shot(tablet, "t2-11-tablette-table");
  await tablet.getByRole("button", { name: "Retour aux tables" }).click();
  await tablet.getByRole("button", { name: "Verrouiller" }).click();
  await expect(tablet.getByText("touchez votre nom")).toBeVisible();

  await page.goto("/app/settings/devices");
  await page.getByRole("button", { name: "Ajouter un appareil" }).click();
  await page.getByLabel("Écran de cuisine").check();
  await page.getByLabel("Nom de l'appareil").fill("Écran cuisine");
  await page.getByLabel("Poste affiché").selectOption({ label: "Cuisine" });
  await page.getByRole("button", { name: "Obtenir un code" }).click();
  const kdsCode = await codeFrom(page, "Code d'enrôlement");
  await page.getByRole("button", { name: "Terminé" }).click();

  const kds = await (await browser.newContext({ extraHTTPHeaders: clientHeaders(), viewport: { width: 1280, height: 800 } })).newPage();
  kds.on("pageerror", (e) => errors.push(String(e)));
  await kds.goto("/appareil");
  await kds.getByLabel("Code d'enrôlement").fill(kdsCode);
  await kds.getByRole("button", { name: "Enrôler" }).click();
  await expect(kds.getByText("Table 3", { exact: true })).toBeVisible({ timeout: 20_000 });
  await shot(kds, "t2-12-ecran-cuisine");
  await kds.getByRole("button", { name: "Prêt" }).first().click();
  await expect(kds.getByText("Prêts, en attente du serveur")).toBeVisible({ timeout: 20_000 });

  await page.goto("/app/settings/devices");
  await page.getByRole("listitem").filter({ hasText: "Tablette salle" }).getByRole("button", { name: "Révoquer" }).click();
  await page.getByRole("alertdialog").getByRole("button", { name: /Révoquer/ }).click();
  await expect(tablet.getByText(/retiré par un gérant/)).toBeVisible({ timeout: 20_000 });

  expect(errors).toEqual([]);
});
