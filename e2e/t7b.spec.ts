/**
 * La mise en service (T7.b) dans un vrai navigateur : l'accueil montre l'avancement, le tableau
 * mène aux vrais écrans, les modes de service se confirment, une étape se saute puis se reprend.
 * Que chaque étape se DÉRIVE des données (carte publiée, table, scan) est prouvé côté serveur,
 * dans `tests/convex/onboarding.test.ts`.
 */

import { expect, test } from "@playwright/test";
import { clientHeaders } from "./mail";
import { openVenue, shot, signIn, skipBrandStep } from "./session";

const run = Date.now().toString(36);
const OWNER = `mise-en-service-${run}@maquis.test`;

test("la propriétaire suit sa mise en service depuis l'accueil", async ({ browser }) => {
  const ctx = await browser.newContext({ extraHTTPHeaders: clientHeaders(), viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  const page = await ctx.newPage();
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  await page.goto("/connexion");
  await signIn(page, OWNER);
  await openVenue(page, "Awa Koné", "Maquis Awa");
  await skipBrandStep(page, "Maquis Awa");

  // ── L'accueil dit où en est la mise en service ──
  const card = page.locator("[data-onboarding-card]");
  await expect(card.getByText("Mise en service : 1 étape sur 7")).toBeVisible();
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

  expect(errors).toEqual([]);
});
