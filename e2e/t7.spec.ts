/**
 * Parcours de la tranche T7.a (D-160), dans un vrai navigateur : une propriétaire choisit un jaune
 * vif (#FFD100) et un logo dès la mise en route ; l'aperçu les montre avant l'enregistrement ; la
 * carte publique les affiche, et le jaune y est assez sombre pour être lu. On MESURE les contrastes
 * dans la page rendue, et on vérifie que l'aperçu et la carte réelle portent la même couleur.
 */

import { expect, test, type Frame, type Page } from "@playwright/test";
import { clientHeaders } from "./mail";
import { shot, signIn } from "./session";

const run = Date.now().toString(36);
const OWNER = `binta-${run}@maquis.test`;

async function nav(page: Page, name: string) {
  await page.getByRole("navigation", { name: "Navigation principale" }).getByRole("link", { name }).click();
}

async function tab(page: Page, name: string) {
  await page.getByRole("navigation", { name: "Carte" }).getByRole("link", { name, exact: true }).click();
}

/** Un logo PNG transparent de 400 × 200 : un disque sombre sur rien. */
async function logo(page: Page): Promise<Buffer> {
  const dataUrl = await page.evaluate(() => {
    const canvas = document.createElement("canvas");
    canvas.width = 400;
    canvas.height = 200;
    const g = canvas.getContext("2d")!;
    g.fillStyle = "#1f2937";
    g.beginPath();
    g.arc(100, 100, 80, 0, Math.PI * 2);
    g.fill();
    g.fillRect(200, 60, 160, 80);
    return canvas.toDataURL("image/png");
  });
  return Buffer.from(dataUrl.split(",")[1]!, "base64");
}

/** `--primary` tel que la page le résout, en minuscules. */
function primaryOf(target: Page | Frame): Promise<string> {
  return target.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue("--primary").trim().toLowerCase());
}

/**
 * Contraste WCAG entre deux couleurs CSS quelconques (oklch compris) : le navigateur les peint
 * sur un canevas, on relit les pixels. Aucune analyse de syntaxe de couleur à maintenir.
 */
function contrast(page: Page, a: string, b: string): Promise<number> {
  return page.evaluate(
    ([x, y]) => {
      const rgb = (color: string) => {
        const canvas = document.createElement("canvas");
        canvas.width = canvas.height = 1;
        const g = canvas.getContext("2d")!;
        g.fillStyle = color;
        g.fillRect(0, 0, 1, 1);
        return [...g.getImageData(0, 0, 1, 1).data.slice(0, 3)].map((v) => v / 255);
      };
      const lum = (c: number[]) =>
        c.map((v) => (v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4)).reduce((s, v, i) => s + v * [0.2126, 0.7152, 0.0722][i]!, 0);
      const [la, lb] = [lum(rgb(x!)), lum(rgb(y!))];
      return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
    },
    [a, b],
  );
}

test("T7.a — un jaune vif et un logo, lisibles sur la carte publique, identiques dans l'aperçu", async ({ browser }) => {
  test.setTimeout(180_000);
  const ownerContext = await browser.newContext({ extraHTTPHeaders: clientHeaders(), viewport: { width: 1440, height: 1000 } });
  const owner = await ownerContext.newPage();
  await owner.goto("/connexion");
  await signIn(owner, OWNER);
  await owner.getByRole("link", { name: "Ouvrir mon établissement" }).click();
  await owner.getByLabel("Votre nom").fill("Binta Diallo");
  await owner.getByLabel("Nom de votre restaurant ou de votre groupe").fill(`Chez Binta ${run}`);
  await owner.getByLabel("Ville").fill("Abidjan");
  await owner.getByRole("button", { name: "Ouvrir l'établissement" }).click();

  // ── La marque, dès la mise en route (D-159) ─────────────────────────────────────
  await expect(owner.getByRole("heading", { name: "Votre marque sur la carte" })).toBeVisible();
  await owner.getByLabel("Couleur de votre établissement").fill("#FFD100");
  await expect(owner.getByText("Pour rester lisible sur la carte, votre couleur sera affichée un peu plus sombre.")).toBeVisible();
  const shown = ((await owner.getByText("Affichée").locator("span.font-mono").textContent()) ?? "").trim().toLowerCase();
  expect(shown).toMatch(/^#[0-9a-f]{6}$/);
  expect(shown).not.toBe("#ffd100");

  // L'aperçu suit la saisie AVANT l'enregistrement.
  const frame = () => owner.frames().find((f) => f.url().includes("/apercu/"));
  await expect.poll(async () => {
    const f = frame();
    return f ? primaryOf(f) : null;
  }).toBe(shown);

  await owner.getByRole("button", { name: "Enregistrer la couleur" }).click();
  await expect(owner.getByText("Couleur enregistrée : la carte en ligne l'affiche déjà.")).toBeVisible();
  await owner.locator('input[type="file"][accept*="image/png"]').setInputFiles({ name: "logo.png", mimeType: "image/png", buffer: await logo(owner) });
  await expect(owner.getByText("Logo enregistré : la carte en ligne l'affiche déjà.")).toBeVisible({ timeout: 20_000 });
  await expect(owner.getByRole("img", { name: "Votre logo" })).toBeVisible();
  await shot(owner, "t7-marque");
  await owner.getByRole("button", { name: "Continuer" }).click();
  await expect(owner.getByRole("heading", { name: `Chez Binta ${run}` })).toBeVisible();

  // ── Une carte, publiée et ouverte au public ─────────────────────────────────────
  await nav(owner, "Carte");
  await owner.getByRole("button", { name: "Créer une carte" }).click();
  await owner.getByRole("dialog").getByLabel("Nom").fill("Carte");
  await owner.getByRole("dialog").getByRole("button", { name: "Créer" }).click();
  await tab(owner, "Sections");
  await owner.getByRole("button", { name: "Entrées · Plats · Desserts · Boissons" }).click();
  await tab(owner, "Produits");
  await owner.getByRole("button", { name: "Ajouter un produit" }).first().click();
  const dialog = owner.getByRole("dialog");
  await dialog.getByLabel("Nom").fill("Kedjenou de poulet");
  await dialog.getByLabel("Section").selectOption({ label: "Carte — Plats" });
  await dialog.getByLabel("Prix").fill("4 500");
  await dialog.getByRole("button", { name: "Créer le produit" }).click();
  await expect(owner.getByRole("heading", { name: "Kedjenou de poulet" })).toBeVisible();
  await tab(owner, "Carte");
  await owner.getByRole("button", { name: "Publier la carte" }).click();
  await expect(owner.getByText("Version 1 en ligne.")).toBeVisible();

  await owner.getByRole("navigation", { name: "Navigation principale" }).getByRole("button", { name: "Réglages" }).click();
  await nav(owner, "Établissement");
  await owner.getByLabel("Carte publique en ligne").click();
  const address = owner.getByLabel("Adresse de la carte publique");
  await expect(address).toHaveValue(/\/menu\/[a-z0-9-]+$/);
  const publicPath = new URL(await address.inputValue()).pathname;

  // ── Le client : la couleur affichée, lisible, et la même que dans l'aperçu ──────
  const guestContext = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, locale: "fr-FR" });
  const guest = await guestContext.newPage();
  await guest.goto(publicPath);
  await expect(guest.getByRole("heading", { level: 1, name: `Chez Binta ${run}` })).toBeVisible();
  expect(await primaryOf(guest)).toBe(shown);
  const background = await guest.evaluate(() => getComputedStyle(document.body).backgroundColor);
  // La couleur sur le fond (la section lue), et le texte clair sur la couleur (un bouton).
  expect(await contrast(guest, shown, background)).toBeGreaterThanOrEqual(4.5);
  const foreground = await guest.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue("--primary-foreground").trim());
  expect(await contrast(guest, foreground, shown)).toBeGreaterThanOrEqual(4.5);
  // Le prix est dans la couleur du texte (D-166), et « F CFA » n'est écrit qu'une fois.
  const price = guest.getByRole("button", { name: /Kedjenou de poulet/ }).getByText("4 500", { exact: true });
  const priceColor = await price.evaluate((el) => getComputedStyle(el).color);
  expect(await contrast(guest, priceColor, background)).toBeGreaterThanOrEqual(4.5);
  await expect(guest.getByText(/Prix en F\s?CFA/)).toBeVisible();
  // Le logo, à côté du nom, et sa place réservée.
  const logoImg = guest.locator("header img");
  await expect(logoImg).toBeVisible();
  expect(await logoImg.evaluate((img: HTMLImageElement) => img.complete && img.naturalWidth > 0)).toBe(true);
  await shot(guest, "t7-carte-publique");

  // Parité : l'aperçu enregistré et la carte réelle portent la même couleur.
  await nav(owner, "Apparence");
  await expect.poll(async () => {
    const f = frame();
    return f ? primaryOf(f) : null;
  }).toBe(shown);
  await shot(owner, "t7-apparence");

  // Revenir à la couleur de Joliba : la carte publique la reprend.
  await owner.getByRole("button", { name: "Revenir à la couleur de Joliba" }).click();
  await expect(owner.getByText("La carte a repris la couleur de Joliba.")).toBeVisible();
  await guest.reload();
  expect(await primaryOf(guest)).not.toBe(shown);
});
