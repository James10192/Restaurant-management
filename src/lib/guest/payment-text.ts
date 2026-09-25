/**
 * Textes du paiement à table — Joliba (T5)
 *
 * Téléchargés avec le tiroir « Régler », jamais avec la carte (D-058). Français et anglais.
 */

import type { GuestLocale } from "./i18n";

const fr = {
  title: "Régler l'addition",
  description: "Par Wave, depuis votre téléphone. Le montant est calculé par le restaurant.",
  choose: "Que réglez-vous ?",
  remainder: "Tout le reste de la table",
  remainderHint: "Ce qui n'a pas encore été payé à cette table.",
  myItems: "Mes articles",
  myItemsHint: "Les plats et boissons commandés depuis ce téléphone.",
  pay: (amount: string) => `Payer ${amount} avec Wave`,
  opening: "Ouverture de Wave…",
  inProgress: (amount: string) => `Paiement de ${amount} en cours`,
  inProgressText: "Finissez le paiement dans Wave. Le restaurant le verra dès que Wave l'aura confirmé.",
  continueWave: "Continuer dans Wave",
  check: "J'ai payé : vérifier",
  checking: "Vérification auprès de Wave…",
  notYet: "Wave n'a pas encore confirmé ce paiement. Cela peut prendre une minute.",
  notYetLong: "Si Wave indique que c'est payé, montrez l'écran de Wave au serveur : il le vérifiera.",
  paid: "Paiement reçu",
  paidText: "Le restaurant voit votre paiement. Merci !",
  failedAttempt: "Le dernier essai n'a pas abouti (solde insuffisant ?). Vous pouvez réessayer dans Wave.",
  closedText: "Ce paiement n'a pas abouti : rien n'a été prélevé. Vous pouvez recommencer.",
  returnError: "Le paiement n'a pas abouti. Rien n'a été prélevé ; vous pouvez réessayer.",
  nothingDue: "Il n'y a rien à régler pour l'instant.",
  inProgressElsewhere: "Quelqu'un d'autre à la table est en train de régler cette addition.",
  unavailable: "Le paiement en ligne est indisponible pour le moment. Réglez auprès du serveur.",
  codeRequired: "Entrez d'abord le code de la table pour pouvoir régler depuis votre téléphone.",
  rateLimited: "Trop d'essais. Patientez quelques minutes, ou réglez auprès du serveur.",
  offline: "Pas de réseau : le paiement en ligne attend le retour de la connexion.",
  orCash: "Vous pouvez aussi régler en espèces ou en Mobile Money auprès du serveur.",
};

type PaymentText = typeof fr;

const en: PaymentText = {
  title: "Pay the bill",
  description: "With Wave, from your phone. The amount is calculated by the restaurant.",
  choose: "What are you paying?",
  remainder: "Everything left at the table",
  remainderHint: "What has not been paid yet at this table.",
  myItems: "My items",
  myItemsHint: "The dishes and drinks ordered from this phone.",
  pay: (amount: string) => `Pay ${amount} with Wave`,
  opening: "Opening Wave…",
  inProgress: (amount: string) => `Payment of ${amount} in progress`,
  inProgressText: "Finish the payment in Wave. The restaurant will see it as soon as Wave confirms it.",
  continueWave: "Continue in Wave",
  check: "I paid: check",
  checking: "Checking with Wave…",
  notYet: "Wave has not confirmed this payment yet. It can take a minute.",
  notYetLong: "If Wave shows it as paid, show the Wave screen to your waiter: they will check it.",
  paid: "Payment received",
  paidText: "The restaurant can see your payment. Thank you!",
  failedAttempt: "The last attempt did not go through (low balance?). You can try again in Wave.",
  closedText: "This payment did not go through: nothing was charged. You can start again.",
  returnError: "The payment did not go through. Nothing was charged; you can try again.",
  nothingDue: "There is nothing to pay right now.",
  inProgressElsewhere: "Someone else at the table is paying this bill.",
  unavailable: "Online payment is unavailable right now. Please pay your waiter.",
  codeRequired: "Enter the table code first to pay from your phone.",
  rateLimited: "Too many attempts. Wait a few minutes, or pay your waiter.",
  offline: "No network: online payment waits for the connection to come back.",
  orCash: "You can also pay your waiter in cash or Mobile Money.",
};

export const PAYMENT_TEXT: Record<GuestLocale, PaymentText> = { fr, en };
export type { PaymentText };
