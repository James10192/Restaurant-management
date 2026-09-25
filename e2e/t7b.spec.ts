/**
 * La mise en service (T7.b) dans un vrai navigateur : l'accueil montre l'avancement, le tableau
 * mène aux vrais écrans, les modes de service se confirment, une étape se saute puis se reprend.
 * Que chaque étape se DÉRIVE des données (carte publiée, table, scan) est prouvé côté serveur,
 * dans `tests/convex/onboarding.test.ts`.
 */

import { expect, test, type Browser, type Page } from "@playwright/test";
import { clientHeaders } from "./mail";
import { openVenue, shot, signIn, skipBrandStep } from "./session";

const run = Date.now().toString(36);
const OWNER = `mise-en-service-${run}@maquis.test`;
const EDITOR = `carte-${run}@maquis.test`;

const phone = (browser: Browser) =>
  browser.newContext({ extraHTTPHeaders: clientHeaders(), viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });

/** La propriétaire invite une responsable de la carte ; renvoie le lien d'invitation. */
async function inviteMenuEditor(owner: Page): Promise<string> {
  await owner.goto("/app/team");
  await owner.getByRole("button", { name: "Inviter un membre" }).click();
  await owner.getByLabel("Adresse e-mail").fill(EDITOR);
  await owner.getByLabel("Rôle").selectOption({ label: "Responsable de la carte" });
  await owner.getByRole("button", { name: "Envoyer l'invitation" }).click();
  const link = await owner.getByLabel("Lien d'invitation").inputValue();
  await owner.getByRole("button", { name: "Terminé" }).click();
  return link;
}

test("la propriétaire suit sa mise en service depuis l'accueil", async ({ browser }) => {
  const page = await (await phone(browser)).newPage();
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  await page.goto("/connexion");
  await signIn(page, OWNER);
  await openVenue(page, "Awa Koné", "Maquis Awa");
  await skipBrandStep(page, "Maquis Awa");

  // ── L'accueil dit où en est la mise en service ──
  const card = page.locator("[data-onboarding-card]");
  await expect(card.getByText("Mise en service : 1 étape sur 7")).toBeVisible();
  await shot(page, "t7b-00-accueil");
  await card.getByRole("link", { name: "Continuer la mise en service" }).click();
  await expect(page.getByRole("heading", { name: "Maquis Awa", level: 1 })).toBeVisible();
  await expect(page.locator("[data-onboarding-count]")).toHaveText("1 étape sur 7");
  await expect(page.locator('[data-onboarding-step="identity"]')).toHaveAttribute("data-state", "done");
  await shot(page, "t7b-01-tableau");

  // ── Les modes de service ne se prouvent pas : on les confirme ──
  const service = page.locator('[data-onboarding-step="service"]');
  await service.getByRole("button", { name: "C'est bon" }).click();
  await expect(service).toHaveAttribute("data-state", "done");
  await expect(page.locator("[data-onboarding-count]")).toHaveText("2 étapes sur 7");

  // ── Une étape se saute, et se reprend ──
  const team = page.locator('[data-onboarding-step="team"]');
  await team.getByRole("button", { name: "Plus tard" }).click();
  await expect(team).toHaveAttribute("data-state", "skipped");
  await shot(page, "t7b-02-etape-sautee");
  await team.getByRole("button", { name: "Reprendre" }).click();
  await expect(team).toHaveAttribute("data-state", "todo");

  // ── « Continuer » ouvre le vrai écran de l'étape suivante : la carte ──
  await page.getByRole("link", { name: /^Continuer : créer la carte/ }).click();
  await expect(page).toHaveURL(/\/app\/menu\/products/);

  // ── Une responsable de la carte voit le tableau : ses étapes ouvertes, les autres grisées ──
  const link = await inviteMenuEditor(page);
  const editor = await (await phone(browser)).newPage();
  await editor.goto(new URL(link).pathname);
  await editor.getByRole("link", { name: "Se connecter pour accepter" }).click();
  await signIn(editor, EDITOR);
  await editor.getByLabel("Votre nom").fill("Mariam Traoré");
  await editor.getByRole("button", { name: "Accepter l'invitation" }).click();
  await expect(editor.locator("[data-onboarding-card]")).toBeVisible();
  await editor.goto("/app/onboarding");
  // Les tables : pas son droit, et pas encore faites.
  const greyed = editor.locator('[data-onboarding-step="tables"]');
  await expect(greyed.getByText("À faire par Awa Koné.")).toBeVisible();
  await expect(greyed.getByRole("button")).toHaveCount(0);
  await expect(editor.locator('[data-onboarding-step="menu"]').getByRole("link", { name: "Ouvrir" })).toBeVisible();
  await shot(editor, "t7b-03-etapes-grisees");

  // ── Ouvrir SON restaurant reste possible, même membre de celui d'un autre ──
  await editor.getByRole("link", { name: "Ouvrir un autre restaurant" }).click();
  await expect(editor.getByRole("heading", { name: "Ouvrir mon établissement" })).toBeVisible();

  expect(errors).toEqual([]);
});
