import { expect, type Page } from "@playwright/test";
import { lastEmailTo, mailCount } from "./mail";

const SHOTS = process.env.E2E_SCREENSHOTS;

export async function shot(page: Page, name: string) {
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/${name}.png`, fullPage: true });
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
  await page.getByRole("textbox", { name: /Chiffre 1/ }).focus();
  await page.keyboard.insertText(code!);
}
