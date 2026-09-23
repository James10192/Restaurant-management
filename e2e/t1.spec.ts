/**
 * Parcours de la tranche T1, dans un vrai navigateur, contre un vrai backend : une
 * propriétaire compose sa carte, la publie, pose une table, imprime son QR ; un client scanne
 * et lit la carte ; la cuisine coupe un plat et la carte du client change sans rechargement ;
 * un QR régénéré rend l'ancien inutilisable.
 */

import { expect, test, type Page } from "@playwright/test";
import { clientHeaders } from "./mail";
import { shot, signIn } from "./session";

const run = Date.now().toString(36);
const OWNER = `mariam-${run}@maquis.test`;

async function nav(page: Page, name: string) {
  await page.getByRole("navigation", { name: "Navigation principale" }).getByRole("link", { name }).click();
}

async function tab(page: Page, name: string) {
  await page.getByRole("navigation", { name: "Carte" }).getByRole("link", { name, exact: true }).click();
}

/** Une vraie photo PNG de 800 × 600, dessinée par le navigateur. */
async function photo(page: Page): Promise<Buffer> {
  const dataUrl = await page.evaluate(() => {
    const canvas = document.createElement("canvas");
    canvas.width = 800;
    canvas.height = 600;
    const g = canvas.getContext("2d")!;
    const grad = g.createLinearGradient(0, 0, 800, 600);
    grad.addColorStop(0, "#b3541e");
    grad.addColorStop(1, "#f4d35e");
    g.fillStyle = grad;
    g.fillRect(0, 0, 800, 600);
    return canvas.toDataURL("image/png");
  });
  return Buffer.from(dataUrl.split(",")[1]!, "base64");
}

test("T1 — composer, publier, imprimer, scanner, couper un plat", async ({ browser }) => {
  test.setTimeout(180_000);
  const ownerContext = await browser.newContext({ extraHTTPHeaders: clientHeaders() });
  const owner = await ownerContext.newPage();
  await owner.goto("/connexion");
  await signIn(owner, OWNER);
  await owner.getByRole("link", { name: "Ouvrir mon établissement" }).click();
  await owner.getByLabel("Votre nom").fill("Mariam Traoré");
  await owner.getByLabel("Nom de votre restaurant ou de votre groupe").fill(`Chez Mariam ${run}`);
  await owner.getByLabel("Ville").fill("Abidjan");
  await owner.getByRole("button", { name: "Ouvrir l'établissement" }).click();
  await expect(owner.getByRole("heading", { name: `Chez Mariam ${run}` })).toBeVisible();

  // ── Une carte, ses sections ─────────────────────────────────────────────────────
  await nav(owner, "Carte");
  await expect(owner.getByRole("heading", { name: "Votre carte est vide" })).toBeVisible();
  await owner.getByRole("button", { name: "Créer une carte" }).click();
  await owner.getByRole("dialog").getByLabel("Nom").fill("Carte");
  await owner.getByRole("dialog").getByRole("button", { name: "Créer" }).click();
  await expect(owner.getByText("Cette carte n'a jamais été publiée")).toBeVisible();

  await tab(owner, "Sections");
  await owner.getByRole("button", { name: "Entrées · Plats · Desserts · Boissons" }).click();
  await expect(owner.getByLabel("Nom de la section")).toHaveCount(4);

  // ── Deux produits, dont un avec photo ───────────────────────────────────────────
  await tab(owner, "Produits");
  await owner.getByRole("button", { name: "Ajouter un produit" }).first().click();
  let dialog = owner.getByRole("dialog");
  await dialog.getByLabel("Nom").fill("Poulet braisé");
  await dialog.getByLabel("Section").selectOption({ label: "Carte — Plats" });
  await dialog.getByLabel("Prix").fill("3 500");
  await dialog.getByRole("button", { name: "Créer le produit" }).click();
  await expect(owner.getByRole("heading", { name: "Poulet braisé" })).toBeVisible();
  await owner.getByRole("textbox", { name: "Description (facultatif)" }).fill("Demi-poulet mariné, braisé au feu de bois, attiéké.");
  await owner.getByRole("button", { name: "Enregistrer", exact: true }).click();
  await expect(owner.getByText("Enregistré. Visible des clients à la prochaine publication.")).toBeVisible();
  await owner.locator('input[type="file"]').setInputFiles({ name: "poulet.png", mimeType: "image/png", buffer: await photo(owner) });
  await expect(owner.getByRole("img", { name: "Photo 1" })).toBeVisible({ timeout: 20_000 });
  await shot(owner, "t1-fiche-produit");

  await owner.getByRole("link", { name: "Produits" }).first().click();
  await owner.getByRole("button", { name: "Ajouter un produit" }).first().click();
  dialog = owner.getByRole("dialog");
  await dialog.getByLabel("Nom").fill("Bissap");
  await dialog.getByLabel("Section").selectOption({ label: "Carte — Boissons" });
  await dialog.getByLabel("Prix").fill("500");
  await dialog.getByRole("button", { name: "Créer le produit" }).click();
  await expect(owner.getByRole("heading", { name: "Bissap" })).toBeVisible();

  // ── Publier ─────────────────────────────────────────────────────────────────────
  await tab(owner, "Carte");
  await expect(owner.getByText("2 produits prêts à être publiés")).toBeVisible();
  await owner.getByRole("button", { name: "Publier la carte" }).click();
  await expect(owner.getByText("Version 1 en ligne.")).toBeVisible();
  await expect(owner.getByText("Ce que voient les clients est à jour.")).toBeVisible();
  await shot(owner, "t1-carte-publiee");

  // ── Une zone, une table, son QR ─────────────────────────────────────────────────
  await nav(owner, "Salle");
  await owner.getByRole("button", { name: "Créer la zone « Salle »" }).click();
  await owner.getByRole("button", { name: "Ajouter une table" }).first().click();
  dialog = owner.getByRole("dialog");
  await dialog.getByLabel("Numéro").fill("7");
  await dialog.getByRole("button", { name: "Ajouter la table" }).click();
  await owner.getByRole("button", { name: "Table 7, 4 places" }).click();
  await expect(owner.getByText(/Version 1 · créé le/)).toBeVisible();
  await shot(owner, "t1-plan-de-salle");
  await owner.getByRole("link", { name: "Imprimer les QR" }).click();
  const qr = owner.getByRole("img", { name: "QR de la table 7" });
  await expect(qr).toBeVisible();
  const scanUrl = (await qr.getAttribute("data-qr-value"))!;
  expect(scanUrl).toMatch(/\/r\/[a-z0-9-]+\/t\/[A-Za-z0-9_-]{22}$/);
  await shot(owner, "t1-planche-qr");

  // ── Le client scanne ────────────────────────────────────────────────────────────
  const guestContext = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, locale: "fr-FR" });
  const guest = await guestContext.newPage();
  await guest.goto(new URL(scanUrl).pathname);
  // Le jeton quitte l'adresse aussitôt : il ne reste ni dans l'historique ni dans un partage.
  await expect(guest).toHaveURL(/\/r\/[a-z0-9-]+\/table$/);
  await expect(guest.getByText("Table 7")).toBeVisible();
  const dish = guest.getByRole("button", { name: /Poulet braisé/ });
  await expect(dish).toBeVisible();
  await expect(dish).toContainText("3");
  await shot(guest, "t1-client-carte");

  // ── La cuisine coupe le poulet ; la carte du client suit, sans rechargement ──────
  await nav(owner, "Carte");
  await tab(owner, "Disponibilité");
  await owner.getByRole("switch", { name: "Poulet braisé disponible" }).click();
  await owner.getByRole("button", { name: "Ce soir" }).click();
  await expect(owner.getByRole("heading", { name: "Indisponibles (1)" })).toBeVisible();
  await expect(guest.getByRole("button", { name: /Poulet braisé/ })).toContainText("Épuisé", { timeout: 10_000 });
  await shot(guest, "t1-client-epuise");

  // ── Le QR est régénéré : l'ancien ne vaut plus rien ─────────────────────────────
  await nav(owner, "Salle");
  await owner.getByRole("button", { name: "Table 7, 4 places" }).click();
  await owner.getByRole("button", { name: "Révoquer et régénérer" }).click();
  await expect(owner.getByText("Les QR imprimés pour cette table ne fonctionneront plus.")).toBeVisible();
  await owner.getByRole("dialog").getByRole("button", { name: "Révoquer et régénérer" }).click();
  await expect(owner.getByText(/Version 2 · créé le/)).toBeVisible();

  const stranger = await (await browser.newContext()).newPage();
  await stranger.goto(new URL(scanUrl).pathname);
  await expect(stranger).toHaveURL(/\/indisponible\?raison=invalid$/);
  // Et le client déjà attablé avec l'ancien laissez-passer est renvoyé au scan.
  await guest.reload();
  await expect(guest.getByRole("heading", { name: "Scannez le QR code de votre table" })).toBeVisible();
});
