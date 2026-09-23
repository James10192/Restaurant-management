/**
 * Parcours de la tranche T0, dans un vrai navigateur, contre un vrai backend :
 * une propriétaire ouvre son établissement, invite un serveur, et le serveur ne voit
 * que ce que son rôle permet.
 */

import { expect, test, type Page } from "@playwright/test";
import { clientHeaders, lastEmailTo, mailCount } from "./mail";

const run = Date.now().toString(36);
const OWNER = `awa-${run}@maquis.test`;
const WAITER = `koffi-${run}@maquis.test`;
const SHOTS = process.env.E2E_SCREENSHOTS;

async function shot(page: Page, name: string) {
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/${name}.png`, fullPage: true });
}

async function signIn(page: Page, email: string) {
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

test("T0 — ouvrir, inviter, cloisonner", async ({ browser }) => {
  // ── Propriétaire ────────────────────────────────────────────────────────────────
  const ownerContext = await browser.newContext({ extraHTTPHeaders: clientHeaders() });
  const owner = await ownerContext.newPage();
  await owner.goto("/connexion");
  await shot(owner, "connexion");
  await signIn(owner, OWNER);

  await expect(owner.getByRole("heading", { name: /aucune organisation/ })).toBeVisible();
  await owner.getByRole("link", { name: "Ouvrir mon établissement" }).click();
  await owner.getByLabel("Votre nom").fill("Awa Koné");
  await owner.getByLabel("Nom de votre restaurant ou de votre groupe").fill("Maquis Awa");
  await owner.getByLabel("Ville").fill("Abidjan");
  await shot(owner, "onboarding");
  await owner.getByRole("button", { name: "Ouvrir l'établissement" }).click();
  await expect(owner.getByRole("heading", { name: "Maquis Awa" })).toBeVisible();
  await shot(owner, "accueil-proprietaire");

  // Invitation d'un serveur, portée : cet établissement.
  await owner.getByRole("navigation", { name: "Navigation principale" }).getByRole("link", { name: "Équipe" }).click();
  await expect(owner.getByText("Vous êtes seul pour l'instant")).toBeVisible();
  await owner.getByRole("button", { name: "Inviter un membre" }).click();
  await owner.getByLabel("Adresse e-mail").fill(WAITER);
  await owner.getByLabel("Rôle").selectOption({ label: "Serveur" });
  await owner.getByRole("button", { name: "Envoyer l'invitation" }).click();
  const linkField = owner.getByLabel("Lien d'invitation");
  await expect(linkField).toBeVisible();
  const link = await linkField.inputValue();
  expect(link).toMatch(/\/invitation\/[A-Za-z0-9_-]{40,}$/);
  await owner.getByRole("button", { name: "Terminé" }).click();
  await expect(owner.getByRole("dialog")).toHaveCount(0);
  await expect(owner.getByRole("region", { name: "Invitations en attente" }).getByText(WAITER, { exact: true })).toBeVisible();
  await shot(owner, "equipe-invitation-en-attente");

  // L'e-mail d'invitation contient le même lien.
  const invitationMail = await lastEmailTo(WAITER, 0);
  expect(invitationMail.text).toContain(link);

  // ── Serveur ─────────────────────────────────────────────────────────────────────
  const waiterContext = await browser.newContext({ extraHTTPHeaders: clientHeaders(), viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  const waiter = await waiterContext.newPage();
  await waiter.goto(new URL(link).pathname);
  await expect(waiter.getByText("Maquis Awa")).toBeVisible();
  await shot(waiter, "invitation-deconnecte");
  await waiter.getByRole("link", { name: "Se connecter pour accepter" }).click();
  await signIn(waiter, WAITER);
  await expect(waiter).toHaveURL(/\/invitation\//);
  await waiter.getByLabel("Votre nom").fill("Koffi Yao");
  await waiter.getByRole("button", { name: "Accepter l'invitation" }).click();
  await expect(waiter.getByRole("heading", { name: "Maquis Awa" })).toBeVisible();
  await shot(waiter, "accueil-serveur-mobile");

  // Le serveur n'a ni l'équipe, ni les rôles, ni les réglages : ni dans la navigation
  // (réduite à l'accueil, elle n'est même pas affichée)…
  await expect(waiter.getByRole("navigation", { name: "Navigation principale" })).toHaveCount(0);
  await expect(waiter.getByRole("link", { name: "Rôles" })).toHaveCount(0);
  await expect(waiter.getByRole("link", { name: "Équipe" })).toHaveCount(0);
  // …ni par l'URL directe.
  await waiter.goto("/app/roles");
  await expect(waiter.getByText("Accès non autorisé")).toBeVisible();
  await shot(waiter, "roles-refuse-mobile");

  // ── Retour propriétaire : le serveur apparaît, avec son rôle et sa portée ─────────
  await owner.reload();
  await expect(owner.getByText("Koffi Yao")).toBeVisible();
  await expect(owner.getByText("Serveur · Maquis Awa")).toBeVisible();
  await shot(owner, "equipe-avec-serveur");

  // Le propriétaire donne l'encaissement au rôle Serveur, avec un motif.
  await owner.goto("/app/roles");
  await owner.getByRole("link", { name: /^Serveur/ }).click();
  await owner.getByRole("checkbox", { name: "Encaisser" }).click();
  await owner.getByLabel("Motif de la modification").fill("Les serveurs encaissent en salle chez nous.");
  await owner.getByRole("button", { name: "Enregistrer le rôle" }).click();
  await expect(owner.getByText("Rôle enregistré.")).toBeVisible();
  await shot(owner, "role-serveur");

  // Mon compte : l'appareil courant est listé.
  await owner.goto("/app/account");
  await expect(owner.getByText("Cet appareil")).toBeVisible();
  await shot(owner, "compte-appareils");

  await ownerContext.close();
  await waiterContext.close();
});
