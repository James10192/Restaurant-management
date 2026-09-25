/**
 * SECURITY.md M6 : après trois mauvais codes, le code est INVALIDÉ — pas seulement ralenti.
 * Le bon code, saisi ensuite, doit être refusé.
 */

import { expect, test } from "@playwright/test";
import { clientHeaders, lastEmailTo, mailCount } from "./mail";

test("trois mauvais codes invalident le code", async ({ request, baseURL }) => {
  const email = `essais-${Date.now().toString(36)}@maquis.test`;
  const headers = { Origin: baseURL!, ...clientHeaders() };
  const before = mailCount();
  const sent = await request.post("/api/auth/email-otp/send-verification-otp", { headers, data: { email, type: "sign-in" } });
  expect(sent.status()).toBe(200);
  const code = /(\d{6})/.exec((await lastEmailTo(email, before)).subject)![1]!;
  const wrong = code === "000000" ? "111111" : "000000";

  // Chaque essai est bien TRAITÉ et refusé comme code invalide — pas rejeté en amont
  // (origine, format), ce qui rendrait le refus final sans valeur de preuve.
  for (let i = 0; i < 3; i++) {
    const attempt = await request.post("/api/auth/sign-in/email-otp", { headers, data: { email, otp: wrong } });
    expect(attempt.ok()).toBe(false);
    expect(((await attempt.json()) as { code?: string }).code).toBe("INVALID_OTP");
  }
  const late = await request.post("/api/auth/sign-in/email-otp", { headers, data: { email, otp: code } });
  expect(late.ok(), "le bon code doit être refusé une fois les essais épuisés").toBe(false);
  expect(((await late.json()) as { code?: string }).code).toBe("TOO_MANY_ATTEMPTS");
});
