import { expect, type Page } from "@playwright/test";
import { lastEmailTo, mailCount } from "./mail";

const SHOTS = process.env.E2E_SCREENSHOTS;

export async function shot(page: Page, name: string, fullPage = true) {
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/${name}.png`, fullPage });
}

/** Connexion par code à usage unique, lu dans le faux serveur de courrier. */
export async function signIn(page: Page, email: string) {
  const before = mailCount();
  await page.getByLabel("Adresse e-mail").fill(email);
  await page.getByRole("button", { name: "Recevoir mon code" }).click();
  await expect(page).toHaveURL(/\/auth\/otp/);
  await expect(page.getByText(email)).toBeVisible();
  const mail = await lastEmailTo(email, before);
  const code = /(\d{6})/.exec(mail.subject)?.[1];
  expect(code, "le code doit figurer dans l'objet de l'e-mail").toBeTruthy();
  await shot(page, `otp-${email.split("@")[0]}`);
  // Collage d'un code complet, comme depuis l'e-mail.
  await page.getByLabel("Code de connexion").focus();
  await page.keyboard.insertText(code!);
}

/**
 * La mise en route, jusqu'à l'étape « Votre marque » (D-159) : le formulaire rempli, envoyé, et
 * l'étape de marque affichée. Le parcours choisit ensuite : régler sa marque, ou continuer.
 */
export async function openVenue(page: Page, person: string, venue: string, onForm?: () => Promise<void>) {
  await page.getByRole("link", { name: "Ouvrir mon établissement" }).click();
  await page.getByLabel("Votre nom").fill(person);
  await page.getByLabel("Nom de votre restaurant ou de votre groupe").fill(venue);
  await page.getByLabel("Ville").fill("Abidjan");
  await onForm?.();
  await page.getByRole("button", { name: "Ouvrir l'établissement" }).click();
  await expect(page.getByRole("heading", { name: "Votre marque sur la carte" })).toBeVisible();
}

/** Passe l'étape de marque et arrive sur l'accueil de l'établissement. */
export async function skipBrandStep(page: Page, venue: string) {
  await page.getByRole("button", { name: "Continuer" }).click();
  await expect(page.getByRole("heading", { name: venue })).toBeVisible();
}
