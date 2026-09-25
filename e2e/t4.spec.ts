/**
 * La porte de sortie de la tranche T4 : « une table de quatre, quatre appareils, aucune commande
 * perdue ni dupliquée ». Dans un vrai navigateur, contre un vrai backend :
 *  - l'établissement passe en commande directe ; le serveur ouvre la table et lit son code ;
 *  - quatre téléphones scannent le même QR ; trois saisissent le code, le quatrième montre son
 *    panier et le serveur l'admet depuis la fiche de la table ;
 *  - les quatre envoient EN MÊME TEMPS ; la réponse d'un envoi est coupée après être passée, et
 *    le nouvel essai retrouve la même commande ; un double appui n'envoie qu'une fois ;
 *  - il y a exactement une commande par envoi, chacune au nom de son convive ; la cuisine passe
 *    un plat à prêt, et SEUL le téléphone concerné le lit ;
 *  - un cinquième téléphone, sans le code, ne peut pas envoyer.
 */

import { execFileSync } from "node:child_process";
import { expect, test, type Browser, type BrowserContext, type Page } from "@playwright/test";
import { clientHeaders } from "./mail";
import { shot, signIn } from "./session";

const run = Date.now().toString(36);
const OWNER = `direct-${run}@maquis.test`;
const env = { ...process.env, CONVEX_AGENT_MODE: "anonymous" };
const SEND = /^Envoyer — part directement en cuisine/;

let scanPath = "";

test.describe.configure({ mode: "serial" });
test.setTimeout(300_000);

test.beforeAll(() => {
  const out = execFileSync("node", ["scripts/seed-demo.mjs"], { env, encoding: "utf8", stdio: ["ignore", "pipe", "inherit"] });
  scanPath = (JSON.parse(out.trim().split("\n").pop()!) as { scanPath: string }).scanPath;
});

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

/** Un téléphone à table : il scanne, attend la barre de commande, ajoute un plat, ouvre le panier. */
async function guestWith(browser: Browser, dish: string): Promise<Page> {
  const page = await (await mobile(browser)).newPage();
  await page.goto(scanPath);
  await page.waitForURL(/\/table/);
  await page.getByRole("button", { name: "Appeler", exact: true }).waitFor();
  await page.getByRole("button", { name: new RegExp(dish) }).first().click();
  await page.getByRole("dialog").getByRole("button", { name: /^Ajouter ·/ }).click();
  await page.getByRole("button", { name: /Mon panier/ }).click();
  return page;
}

async function enterCode(page: Page, code: string) {
  await page.getByLabel("Code de la table").focus();
  await page.keyboard.insertText(code);
}

async function myOrders(page: Page) {
  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: /Mes commandes/ }).click();
  return page.getByRole("dialog");
}

test("quatre téléphones, une table : rien de perdu, rien en double", async ({ browser }) => {
  const staff = await ownerPage(browser);
  const errors: string[] = [];

  // L'établissement passe en commande directe, avec le code de la table.
  await staff.goto("/app/settings/devices");
  await staff.getByRole("radio", { name: /Le client envoie directement en cuisine/ }).click();
  await expect(staff.getByText("Mode de commande enregistré.")).toBeVisible();

  // Le serveur ouvre la table 12, celle du QR, et lit le code.
  await staff.goto("/app/service");
  await staff.getByRole("button", { name: /^Table 12,/ }).click();
  await staff.getByRole("textbox", { name: /Couverts/ }).fill("4");
  await staff.getByRole("textbox", { name: /Couverts/ }).press("Enter");
  await expect(staff.getByRole("heading", { name: "Table 12" })).toBeVisible();
  const codeCell = staff.locator("[data-table-code]");
  await expect(codeCell).toHaveText(/^\d{4}$/);
  const code = (await codeCell.textContent())!.trim();
  await shot(staff, "t4-01-code-serveur");

  // Trois convives saisissent le code, l'un après l'autre : ils seront les convives 1, 2, 3.
  const dishes = ["Alloco", "Garba", "Riz gras", "Dêguê"];
  const guests: Page[] = [];
  for (const dish of dishes.slice(0, 3)) {
    const g = await guestWith(browser, dish);
    g.on("pageerror", (e) => errors.push(String(e)));
    await enterCode(g, code);
    await expect(g.getByRole("dialog").getByRole("button", { name: SEND })).toBeVisible({ timeout: 20_000 });
    guests.push(g);
  }
  // Un convive admis voit le code, pour le donner à ceux qui le rejoignent.
  await expect(guests[0]!.getByRole("dialog").locator("[data-table-code]")).toHaveText(code);
  await shot(guests[0]!, "t4-02-client-admis", false);

  // Le quatrième n'a pas le code : il montre son panier, et le serveur l'admet de la fiche.
  const fourth = await guestWith(browser, dishes[3]!);
  fourth.on("pageerror", (e) => errors.push(String(e)));
  await expect(fourth.getByText("Entrez le code de la table")).toBeVisible();
  await fourth.getByRole("dialog").getByRole("button", { name: "Montrer au serveur" }).click();
  // Le téléphone dit « Vous êtes le convive 4 » ; la carte du panier montré le dit aussi : le
  // serveur admet le bon téléphone, depuis son panier.
  await expect(fourth.getByText(/Vous êtes le convive 4/)).toBeVisible({ timeout: 20_000 });
  await expect(staff.getByRole("button", { name: "Admettre (convive 4)" })).toBeVisible({ timeout: 20_000 });
  await shot(staff, "t4-03-telephones");
  await staff.getByRole("button", { name: "Admettre (convive 4)" }).click();
  await expect(staff.locator("[data-guest='4']").getByText("Admis par le personnel")).toBeVisible();
  await expect(fourth.getByRole("dialog").getByRole("button", { name: SEND })).toBeVisible({ timeout: 20_000 });
  guests.push(fourth);

  // La réponse de l'envoi du convive 2 est coupée APRÈS être passée au serveur.
  let cut = true;
  await guests[1]!.route("**/table", async (route) => {
    const body = route.request().postData() ?? "";
    if (cut && route.request().method() === "POST" && body.includes('"submitLines"')) {
      cut = false;
      await route.fetch();
      // La page a pu lâcher la requête pendant ce temps : elle est alors déjà close.
      await route.abort("connectionreset").catch(() => {});
      return;
    }
    await route.continue();
  });

  // Les quatre envoient en même temps.
  await Promise.all(guests.map((g) => g.getByRole("dialog").getByRole("button", { name: SEND }).click()));

  // Trois voient leur commande partie ; le deuxième, sans réponse, garde son panier figé.
  for (const g of [guests[0]!, guests[2]!, guests[3]!]) {
    await expect(g.getByText(/envoyée en cuisine\.$/).first()).toBeVisible({ timeout: 20_000 });
  }
  const second = guests[1]!;
  await expect(second.getByRole("dialog").getByRole("button", { name: "Réessayer l'envoi" })).toBeVisible({ timeout: 20_000 });
  await expect(second.getByRole("dialog").getByRole("button", { name: "Un de plus" })).toBeDisabled();
  await shot(second, "t4-04-envoi-sans-reponse", false);
  await second.unroute("**/table");
  // Deux issues légitimes, et la course entre elles est réelle : le convive réessaie (le serveur
  // reconnaît la clé d'envoi et répond sans doublon), ou la relecture périodique tranche avant
  // son doigt — « Votre envoi était bien arrivé » — et le bouton disparaît sous le clic. Le
  // décompte des commandes, plus bas, vérifie qu'aucune des deux n'en crée une seconde.
  await second
    .getByRole("dialog")
    .getByRole("button", { name: "Réessayer l'envoi" })
    .click({ timeout: 5_000 })
    .catch(() => {});
  await expect(second.getByText(/envoyée en cuisine\.$|Votre envoi était bien arrivé/).first()).toBeVisible({ timeout: 20_000 });

  // Un double appui sur un nouvel envoi du convive 1 n'envoie qu'une commande.
  const first = guests[0]!;
  await first.keyboard.press("Escape");
  await first.getByRole("button", { name: /Gombo frit/ }).first().click();
  await first.getByRole("dialog").getByRole("button", { name: /^Ajouter ·/ }).click();
  await first.getByRole("button", { name: /Mon panier/ }).click();
  await first.getByRole("dialog").getByRole("button", { name: SEND }).dblclick();
  await expect(first.getByText(/envoyée en cuisine\.$/).first()).toBeVisible({ timeout: 20_000 });

  // Côté serveur : cinq commandes, pas une de plus, chacune au nom de son convive.
  await staff.reload();
  await expect(staff.getByText("Commande du client", { exact: false })).toHaveCount(5, { timeout: 20_000 });
  // Chaque commande porte son convive sur SA ligne (pas seulement dans la liste des téléphones).
  for (const [i, dish] of dishes.entries()) {
    const card = staff.locator("[data-slot='card']").filter({ hasText: new RegExp(`1 × ${dish}`) });
    await expect(card).toHaveCount(1);
    await expect(card.getByText(new RegExp(`Convive ${i + 1}\\b`))).toBeVisible();
  }
  await shot(staff, "t4-05-serveur-commandes");

  // Chaque téléphone ne voit que ses propres commandes.
  const counts = [2, 1, 1, 1];
  for (const [i, g] of guests.entries()) {
    const d = await myOrders(g);
    await expect(d.locator("[data-reference]")).toHaveCount(counts[i]!, { timeout: 20_000 });
  }
  // L'onglet « La table » montre tout ce qui est parti, « Vous » pour ses propres plats.
  const tableTab = guests[3]!.getByRole("dialog");
  await tableTab.getByRole("tab", { name: "La table" }).click();
  await expect(tableTab.getByText(/× Alloco/)).toBeVisible();
  await expect(tableTab.getByText("Convive 1").first()).toBeVisible();
  await expect(tableTab.getByText("Vous").first()).toBeVisible();
  await shot(guests[3]!, "t4-06-la-table", false);
  await tableTab.getByRole("tab", { name: "Mes commandes" }).click();

  // La cuisine passe le riz gras (convive 3) à prêt : seul son téléphone le lit.
  await staff.goto("/app/cuisine");
  const ticket = staff.locator("[data-slot='card']").filter({ hasText: "Riz gras" });
  await ticket.getByRole("button", { name: "Commencer" }).click();
  await ticket.getByRole("button", { name: "Prêt" }).click();
  await expect(guests[2]!.getByRole("dialog").getByText("Prêt — on vous l'apporte")).toBeVisible({ timeout: 30_000 });
  await shot(guests[2]!, "t4-07-pret", false);
  for (const g of [guests[0]!, guests[1]!, guests[3]!]) {
    await expect(g.getByRole("dialog").getByText("Prêt — on vous l'apporte")).toHaveCount(0);
  }

  // Un cinquième téléphone, sans le code (une photo du QR suffit à scanner), n'envoie rien.
  const intruder = await guestWith(browser, "Salade avocat");
  intruder.on("pageerror", (e) => errors.push(String(e)));
  await expect(intruder.getByText("Entrez le code de la table")).toBeVisible();
  await expect(intruder.getByRole("dialog").getByRole("button", { name: SEND })).toHaveCount(0);
  await enterCode(intruder, code === "0000" ? "1111" : "0000");
  await expect(intruder.getByText("Ce n'est pas le bon code")).toBeVisible({ timeout: 20_000 });
  await expect(intruder.getByRole("dialog").getByRole("button", { name: SEND })).toHaveCount(0);
  await shot(intruder, "t4-08-sans-code", false);

  // Fin du repas : tout est préparé et servi, la table se clôt (ici avec un impayé, pour aller
  // vite) ; un convive note.
  await staff.goto("/app/cuisine");
  await expect(staff.getByText(/\d+ bons? en cours/)).toBeVisible({ timeout: 20_000 });
  for (const action of ["Commencer", "Prêt"]) {
    for (let guard = 0; guard < 20; guard++) {
      const buttons = staff.getByRole("button", { name: action, exact: true });
      if ((await buttons.count()) === 0) break;
      const before = await buttons.count();
      await buttons.first().click();
      await expect(buttons).toHaveCount(before - 1, { timeout: 20_000 });
    }
  }
  await staff.goto("/app/service");
  await staff.getByRole("tab", { name: /À servir/ }).click();
  for (let guard = 0; guard < 20; guard++) {
    const serve = staff.getByRole("button", { name: "Servi", exact: true });
    if ((await serve.count()) === 0) break;
    await serve.first().click();
    await staff.waitForTimeout(500);
  }
  await expect(staff.getByText("Rien à porter")).toBeVisible({ timeout: 30_000 });
  await staff.getByRole("tab", { name: /Tables/ }).click();
  await staff.getByRole("button", { name: /^Table 12,/ }).click();
  await staff.getByRole("button", { name: "Clôturer" }).click();
  await staff.getByRole("alertdialog").getByRole("button", { name: "Clôturer avec un impayé" }).click();
  await staff.getByLabel("Motif").fill("Essai de bout en bout, table libérée");
  await staff.getByRole("button", { name: "Clôturer avec l'impayé" }).click();
  await expect(staff.getByText("Table 12 clôturée avec un impayé.")).toBeVisible();
  await first.keyboard.press("Escape");
  await expect(first.getByRole("button", { name: "Donner mon avis" })).toBeVisible({ timeout: 40_000 });
  await shot(first, "t4-09-barre-apres-cloture", false);
  await first.getByRole("button", { name: "Donner mon avis" }).click();
  const review = first.getByRole("dialog");
  await review.getByRole("radio", { name: "2 sur 5" }).click();
  await review.getByRole("button", { name: "Attente" }).click();
  await review.getByLabel("Un mot (facultatif)").fill("Le gombo a tardé.");
  await shot(first, "t4-10-avis", false);
  await review.getByRole("button", { name: "Envoyer mon avis" }).click();
  await expect(first.getByText("Merci pour votre avis.")).toBeVisible();
  // Le téléphone sans code n'a rien à noter : il n'a pas prouvé sa présence.
  await intruder.reload();
  await intruder.getByRole("button", { name: "Appeler", exact: true }).waitFor();
  await expect(intruder.getByRole("button", { name: "Donner mon avis" })).toHaveCount(0);
  await staff.goto("/app/feedback");
  await expect(staff.getByText("« Le gombo a tardé. »")).toBeVisible();
  await expect(staff.getByText("Attente")).toBeVisible();
  await shot(staff, "t4-11-avis-gerant");

  expect(errors).toEqual([]);
});
