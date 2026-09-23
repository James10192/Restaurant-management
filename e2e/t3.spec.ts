/**
 * Parcours de la tranche T3 — la porte de sortie, dans un vrai navigateur :
 *  - une addition réglée en deux fois (espèces avec monnaie rendue, puis Wave), le ticket émis,
 *    la table clôturée, et une clôture de caisse qui TOMBE JUSTE ;
 *  - un écart provoqué volontairement : la caisse est comptée à 200 F de moins, clôturée avec
 *    son motif, et l'écart remonte au rapport de fin de service avec son auteur et ce motif.
 *
 * Le restaurant de démonstration (`scripts/seed-demo.mjs`) fournit la carte ; `devSeed:joinDemo`
 * y rattache le compte du test comme propriétaire.
 */

import { execFileSync } from "node:child_process";
import { expect, test, type Page } from "@playwright/test";
import { clientHeaders } from "./mail";
import { shot, signIn } from "./session";

const run = Date.now().toString(36);
const OWNER = `caisse-${run}@maquis.test`;
const env = { ...process.env, CONVEX_AGENT_MODE: "anonymous" };

function convexRun(fn: string, args: unknown): string {
  return execFileSync("pnpm", ["exec", "convex", "run", fn, JSON.stringify(args)], { env, encoding: "utf8" });
}

test.describe.configure({ mode: "serial" });
test.setTimeout(240_000);

test.beforeAll(() => {
  execFileSync("node", ["scripts/seed-demo.mjs"], { env, encoding: "utf8", stdio: ["ignore", "pipe", "inherit"] });
});

/** Ouvre la table, commande des plats simples (sans option), les envoie. */
async function orderAt(page: Page, table: string, dishes: { search: string; name: RegExp }[]) {
  await page.goto("/app/service");
  await page.getByRole("button", { name: new RegExp(`^Table ${table},`) }).click();
  await page.getByRole("textbox", { name: /Couverts/ }).press("Enter");
  await expect(page.getByRole("heading", { name: `Table ${table}` })).toBeVisible();
  await page.getByRole("button", { name: /^Commander/ }).click();
  for (const d of dishes) {
    await page.getByLabel("Chercher un plat").fill(d.search);
    await page.getByRole("button", { name: d.name }).click();
  }
  await page.getByRole("button", { name: /^Vérifier/ }).click();
  await page.getByRole("button", { name: "Envoyer" }).click();
  await expect(page.getByText(/En attente d'envoi/)).toHaveCount(0, { timeout: 20_000 });
}

/** La cuisine prépare le bon de la table, le serveur le porte : la table peut ensuite se clôturer. */
async function cookAndServe(page: Page, table: string) {
  await page.goto("/app/cuisine");
  await expect(page.getByText(`Table ${table}`).first()).toBeVisible();
  await page.getByRole("button", { name: "Commencer" }).first().click();
  await page.getByRole("button", { name: "Prêt" }).first().click();
  await expect(page.getByText("Prêts, en attente du serveur")).toBeVisible({ timeout: 20_000 });
  await page.goto("/app/service");
  await page.getByRole("tab", { name: /À servir/ }).click();
  await page.getByRole("button", { name: "Servi" }).first().click();
  await expect(page.getByText("Rien à porter")).toBeVisible({ timeout: 20_000 });
  await page.getByRole("tab", { name: /Tables/ }).click();
  await page.getByRole("button", { name: new RegExp(`^Table ${table},`) }).click();
}

async function openBill(page: Page) {
  await page.getByRole("tab", { name: "Addition" }).click();
  await expect(page.getByText("Reste à payer", { exact: true })).toBeVisible();
}

test("encaisser en deux fois, ticket, clôture de caisse juste ; puis un écart provoqué remonte au rapport", async ({ browser }) => {
  const ctx = await browser.newContext({ extraHTTPHeaders: clientHeaders(), viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  const page = await ctx.newPage();
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  await page.goto("/connexion");
  await page.waitForLoadState("networkidle");
  await signIn(page, OWNER);
  await page.waitForURL(/\/app/);
  convexRun("devSeed:joinDemo", { email: OWNER });

  // Réglages : l'établissement reçoit du Wave.
  await page.goto("/app/settings/payments");
  await expect(page.getByRole("heading", { name: "Encaissement" })).toBeVisible();
  await page.getByLabel("Ajouter un portefeuille").fill("Wave");
  await page.getByRole("button", { name: "Ajouter" }).first().click();
  await page.getByRole("button", { name: "Enregistrer" }).click();
  await expect(page.getByText("Réglages d'encaissement enregistrés.")).toBeVisible();
  await shot(page, "t3-01-reglages");

  // Table 3 : Alloco (1 000) + Soda (700) + Dêguê (1 000) = 2 700.
  await orderAt(page, "3", [
    { search: "alloco", name: /^Alloco/ },
    { search: "soda", name: /^Soda/ },
    { search: "degue", name: /Dêguê/ },
  ]);
  await cookAndServe(page, "3");
  await openBill(page);
  await expect(page.getByText(/2\s?700/).first()).toBeVisible();
  await shot(page, "t3-02-addition");

  // 1 000 en espèces : le client donne 2 000, on rend 1 000. Aucune caisse ouverte : on l'ouvre d'un geste.
  await page.getByRole("button", { name: "Encaisser" }).click();
  await page.getByLabel("Montant encaissé").fill("1000");
  await page.getByLabel("Remis par le client").fill("2000");
  await expect(page.getByText("Aucune caisse ouverte")).toBeVisible();
  await expect(page.getByRole("button", { name: "Continuer" })).toBeDisabled();
  await page.getByLabel("Fonds de départ").fill("5000");
  await shot(page, "t3-03-ouvrir-caisse");
  await page.getByRole("button", { name: "Ouvrir", exact: true }).click();
  await expect(page.getByText("La caisse est ouverte.")).toBeVisible();
  await page.getByRole("button", { name: "Continuer" }).click();
  await expect(page.getByText("Rendre en espèces")).toBeVisible();
  await shot(page, "t3-04-confirmer");
  await page.getByRole("button", { name: "Confirmer l'encaissement" }).click();
  await expect(page.getByText(/Encaissé\. Reste 1\s?700/)).toBeVisible();

  // Le reste par Wave.
  await page.getByRole("button", { name: "Encaisser" }).click();
  await page.getByRole("radio", { name: "Mobile Money" }).click();
  await page.getByRole("button", { name: "Continuer" }).click();
  await expect(page.getByText("Encaisser en Wave")).toBeVisible();
  await page.getByRole("button", { name: "Confirmer l'encaissement" }).click();
  await expect(page.getByText("Addition soldée.")).toBeVisible();
  await shot(page, "t3-05-soldee");

  // Le ticket : numéroté, « Document interne ». On le regarde tel qu'il part au papier.
  await page.getByRole("button", { name: "Ticket" }).click();
  await expect(page.getByText(/ticket T-\d{4}-000001/)).toBeVisible();
  await page.emulateMedia({ media: "print" });
  await expect(page.getByText("Document interne — ne vaut pas reçu fiscal")).toBeVisible();
  await shot(page, "t3-06-ticket-imprime");
  await page.emulateMedia({ media: "screen" });

  // La table se clôt : elle est soldée.
  await page.getByRole("button", { name: "Clôturer" }).click();
  await page.getByRole("alertdialog").getByRole("button", { name: "Clôturer" }).click();
  await expect(page.getByText("Table 3 clôturée.")).toBeVisible();

  // Fin de service, première caisse : attendu 5 000 + 1 000 = 6 000. Comptage à l'aveugle.
  await page.goto("/app/service/caisse");
  await expect(page.getByText("Caisse principale")).toBeVisible();
  await page.getByRole("button", { name: "Commencer le comptage" }).click();
  await page.getByRole("alertdialog").getByRole("button", { name: "Commencer" }).click();
  await expect(page.getByText("Comptage en cours")).toBeVisible();
  await expect(page.getByText("Attendu", { exact: true })).toHaveCount(0);
  await page.getByRole("button", { name: "Saisir le compté" }).click();
  await page.getByLabel("Total compté").fill("6000");
  await shot(page, "t3-07-compter");
  await page.getByRole("button", { name: "Valider le compté" }).click();
  await expect(page.getByText("La caisse tombe juste.")).toBeVisible();
  await page.getByRole("button", { name: "Clôturer", exact: true }).click();
  await expect(page.getByText(/clôturée : la caisse tombe juste/)).toBeVisible();
  await shot(page, "t3-08-caisse-juste");

  // L'écart provoqué : nouvelle caisse, un Soda payé 700 en espèces, compté 500.
  await page.getByRole("button", { name: "Ouvrir Caisse principale" }).click();
  // Le fonds proposé : ce qui restait au dernier comptage. On repart de zéro.
  await expect(page.getByLabel("Fonds de départ")).toHaveValue(/6\s?000/);
  await page.getByLabel("Fonds de départ").fill("0");
  await page.getByRole("button", { name: "Ouvrir", exact: true }).click();
  await expect(page.getByText("Caisse principale : ouverte.")).toBeVisible();
  await orderAt(page, "4", [{ search: "soda", name: /^Soda/ }]);
  await cookAndServe(page, "4");
  await openBill(page);
  await page.getByRole("button", { name: "Encaisser" }).click();
  await page.getByRole("button", { name: "Continuer" }).click();
  await page.getByRole("button", { name: "Confirmer l'encaissement" }).click();
  await expect(page.getByText("Addition soldée.")).toBeVisible();
  await page.getByRole("button", { name: "Clôturer" }).click();
  await page.getByRole("alertdialog").getByRole("button", { name: "Clôturer" }).click();
  await expect(page.getByText("Table 4 clôturée.")).toBeVisible();

  await page.goto("/app/service/caisse");
  await page.getByRole("button", { name: "Commencer le comptage" }).click();
  await page.getByRole("alertdialog").getByRole("button", { name: "Commencer" }).click();
  await page.getByRole("button", { name: "Saisir le compté" }).click();
  await page.getByLabel("Total compté").fill("500");
  await page.getByRole("button", { name: "Valider le compté" }).click();
  await expect(page.getByText(/Écart de .?200/)).toBeVisible();
  await expect(page.getByText("Attendu", { exact: true })).toBeVisible();
  await shot(page, "t3-09-ecart");
  await page.getByRole("button", { name: "Clôturer avec l'écart" }).click();
  await page.getByLabel("Motif").fill("Pièce de 200 perdue au comptoir");
  await page.getByRole("button", { name: "Clôturer", exact: true }).click();
  await expect(page.getByText(/Caisse principale clôturée\./)).toBeVisible();

  // Le rapport : l'écart, son auteur et son motif.
  await page.goto("/app/rapport");
  await expect(page.getByRole("heading", { name: "Fin de service" })).toBeVisible();
  await expect(page.getByText(/motif : Pièce de 200 perdue au comptoir/)).toBeVisible();
  await expect(page.getByText(/Écart .?200/)).toBeVisible();
  await expect(page.getByText("Juste", { exact: true })).toBeVisible();
  await expect(page.getByText("Wave", { exact: true })).toBeVisible();
  await shot(page, "t3-10-rapport");

  expect(errors).toEqual([]);
});
