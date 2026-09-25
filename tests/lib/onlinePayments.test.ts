/**
 * Le paiement en ligne, sans base — T5 (D-111, D-117, D-118).
 *
 * La signature Wave est vérifiée contre le vecteur de test OFFICIEL de https://docs.wave.com/webhook :
 * même secret, même corps, même horodatage, même signature attendue. Si ce test casse, c'est notre
 * vérification qui a changé, pas Wave.
 */

import { afterEach, describe, expect, test, vi } from "vitest";
import { parseProviderAmount, toProviderAmount } from "../../convex/lib/money";
import { readWaveEvent, readWaveSession } from "../../convex/lib/providers/wave";
import { openSecret, sealSecret, sealedVersion, secretBoxConfigured } from "../../convex/lib/secretBox";
import { parseSignatureHeader, signatureHeader, verifyWaveSignature, waveSignature } from "../../convex/lib/waveSignature";

const DOC_SECRET = "wave_sn_WHS_xz4m6g8rjs9bshxy05xj4khcvjv7j3hcp4fbpvv6met0zdrjvezg";
const DOC_TIMESTAMP = 1667920421;
const DOC_BODY =
  '{"id": "AE_ijzo7oGgrlM7", "type": "checkout.session.completed", "data": {"id": "cos-1b01sghpg100j", "amount": "100", "checkout_status": "complete", "client_reference": null, "currency": "XOF", "error_url": "https://example.com/error", "last_payment_error": null, "business_name": "Annas Apiaries", "payment_status": "succeeded", "success_url": "https://example.com/success", "wave_launch_url": "https://pay.wave.com/c/cos-1b01sghpg100j?a=100&c=XOF&m=Annas%20Apiaries", "when_completed": "2022-11-08T15:05:45Z", "when_created": "2022-11-08T15:05:32Z", "when_expires": "2022-11-09T15:05:32Z", "transaction_id": "TCN4Y4ZC3FM"}}';
const DOC_SIGNATURE = "53c971695230e9c51b1030d673eee76e70bbcdf8a7c5b8c1d44e0b8b1329647b";
const AT_DOC = DOC_TIMESTAMP * 1000 + 30_000;

describe("la signature Wave (vecteur officiel)", () => {
  test("le HMAC de l'horodatage collé au corps brut donne la signature de la documentation", async () => {
    expect(await waveSignature(DOC_SECRET, DOC_TIMESTAMP, DOC_BODY)).toBe(DOC_SIGNATURE);
  });

  test("webhook authentique : accepté", async () => {
    const header = `t=${DOC_TIMESTAMP},v1=${DOC_SIGNATURE}`;
    expect(await verifyWaveSignature({ header, body: DOC_BODY, secrets: [DOC_SECRET], now: AT_DOC })).toEqual({ ok: true });
  });

  test("webhook falsifié : un octet du corps changé, un autre secret, pas d'en-tête — refusé", async () => {
    const header = `t=${DOC_TIMESTAMP},v1=${DOC_SIGNATURE}`;
    const forged = DOC_BODY.replace('"amount": "100"', '"amount": "900"');
    expect(await verifyWaveSignature({ header, body: forged, secrets: [DOC_SECRET], now: AT_DOC })).toEqual({ ok: false, reason: "bad_signature" });
    expect(await verifyWaveSignature({ header, body: DOC_BODY, secrets: ["wave_sn_WHS_un_autre_restaurant_0000000000"], now: AT_DOC })).toEqual({ ok: false, reason: "bad_signature" });
    expect(await verifyWaveSignature({ header: null, body: DOC_BODY, secrets: [DOC_SECRET], now: AT_DOC })).toEqual({ ok: false, reason: "missing_signature" });
    // Le mode « secret partagé » de Wave (Authorization: Bearer) n'est pas une signature : refusé.
    expect(await verifyWaveSignature({ header: `Bearer ${DOC_SECRET}`, body: DOC_BODY, secrets: [DOC_SECRET], now: AT_DOC })).toEqual({ ok: false, reason: "missing_signature" });
  });

  test("webhook périmé : au-delà de 5 minutes, dans un sens comme dans l'autre", async () => {
    const header = `t=${DOC_TIMESTAMP},v1=${DOC_SIGNATURE}`;
    expect(await verifyWaveSignature({ header, body: DOC_BODY, secrets: [DOC_SECRET], now: DOC_TIMESTAMP * 1000 + 6 * 60_000 })).toEqual({ ok: false, reason: "stale" });
    expect(await verifyWaveSignature({ header, body: DOC_BODY, secrets: [DOC_SECRET], now: DOC_TIMESTAMP * 1000 - 6 * 60_000 })).toEqual({ ok: false, reason: "stale" });
  });

  test("rotation : plusieurs v1, plusieurs secrets — un seul valable suffit", async () => {
    const header = `t=${DOC_TIMESTAMP},v1=${"0".repeat(64)},v1=${DOC_SIGNATURE}`;
    expect(parseSignatureHeader(header)!.signatures).toHaveLength(2);
    expect(await verifyWaveSignature({ header, body: DOC_BODY, secrets: ["wave_sn_WHS_nouveau_secret_pas_encore_utilise", DOC_SECRET], now: AT_DOC })).toEqual({ ok: true });
  });

  test("ce que nous signons se vérifie (faux serveur, requêtes signées)", async () => {
    const header = await signatureHeader("secret-du-faux-wave-000000", 1_700_000_000, "{}");
    expect(await verifyWaveSignature({ header, body: "{}", secrets: ["secret-du-faux-wave-000000"], now: 1_700_000_000_000 })).toEqual({ ok: true });
  });
});

describe("l'événement et la session Wave, relus", () => {
  test("l'exemple de la documentation : payé, 100 XOF, transaction, lien", () => {
    const event = readWaveEvent(DOC_BODY)!;
    expect(event).toMatchObject({ eventId: "AE_ijzo7oGgrlM7", kind: "session_completed" });
    expect(event.session).toMatchObject({ providerRef: "cos-1b01sghpg100j", status: "succeeded", amount: 100, currency: "XOF", transactionId: "TCN4Y4ZC3FM", reference: null });
    expect(event.session!.paidAt).toBe(Date.parse("2022-11-08T15:05:45Z"));
  });

  test("statuts : ouverte, expirée, essai échoué (non terminal)", () => {
    const base = { id: "cos-x", currency: "XOF", amount: "5000" };
    expect(readWaveSession({ ...base, checkout_status: "open", payment_status: "processing" }).status).toBe("pending");
    expect(readWaveSession({ ...base, checkout_status: "expired", payment_status: "cancelled" }).status).toBe("expired");
    expect(readWaveSession({ ...base, checkout_status: "open", payment_status: "cancelled", last_payment_error: { code: "insufficient-funds", message: "…" } })).toMatchObject({
      status: "failed_attempt",
      lastErrorCode: "insufficient-funds",
    });
  });

  test("un corps qui n'est pas du JSON, ou sans identifiant, est refusé", () => {
    expect(readWaveEvent("pas du json")).toBeNull();
    expect(readWaveEvent('{"type":"checkout.session.completed"}')).toBeNull();
    expect(readWaveEvent('{"id":"EV_1","type":"test.test_event"}')).toMatchObject({ kind: "test", session: null });
  });
});

describe("les montants d'un fournisseur, sans flottant", () => {
  test("XOF : une chaîne sans décimale ; relue avec ou sans « .00 »", () => {
    expect(toProviderAmount(12000, "XOF")).toBe("12000");
    expect(toProviderAmount(1250, "EUR")).toBe("12.50");
    expect(parseProviderAmount("12000", "XOF")).toBe(12000);
    expect(parseProviderAmount("12000.00", "XOF")).toBe(12000);
    expect(parseProviderAmount("12.5", "EUR")).toBe(1250);
  });

  test("un demi-franc, un nombre flottant, une valeur négative ou vide : refusés, jamais arrondis", () => {
    expect(parseProviderAmount("12000.5", "XOF")).toBeNull();
    expect(parseProviderAmount(12000.5, "XOF")).toBeNull();
    expect(parseProviderAmount("-100", "XOF")).toBeNull();
    expect(parseProviderAmount("", "XOF")).toBeNull();
    expect(parseProviderAmount("1e3", "XOF")).toBeNull();
  });
});

describe("les secrets chiffrés (D-117)", () => {
  afterEach(() => vi.unstubAllEnvs());
  const key = () => {
    const raw = new Uint8Array(32);
    crypto.getRandomValues(raw);
    return btoa(String.fromCharCode(...raw));
  };

  test("chiffré, relu ; deux chiffrements du même secret diffèrent ; jamais le clair dans le chiffré", async () => {
    vi.stubEnv("PAYMENT_SECRETS_KEY", key());
    expect(secretBoxConfigured()).toBe(true);
    const where = { accountId: "compte_a", field: "apiKey" as const };
    const a = await sealSecret("wave_ci_prod_secret_de_test_123456", where);
    const b = await sealSecret("wave_ci_prod_secret_de_test_123456", where);
    expect(a).not.toBe(b);
    expect(a).not.toContain("secret_de_test");
    expect(await openSecret(a, where)).toBe("wave_ci_prod_secret_de_test_123456");
  });

  test("déplacé vers un autre compte ou un autre champ, ou altéré : refusé", async () => {
    vi.stubEnv("PAYMENT_SECRETS_KEY", key());
    const sealed = await sealSecret("wave_ci_prod_secret_de_test_123456", { accountId: "compte_a", field: "apiKey" });
    await expect(openSecret(sealed, { accountId: "compte_b", field: "apiKey" })).rejects.toThrow();
    await expect(openSecret(sealed, { accountId: "compte_a", field: "webhookSecret" })).rejects.toThrow();
    const tampered = sealed.slice(0, -2) + (sealed.endsWith("A") ? "BB" : "AA");
    await expect(openSecret(tampered, { accountId: "compte_a", field: "apiKey" })).rejects.toThrow();
  });

  test("rotation : l'ancienne clé ouvre encore ses chiffrés, la nouvelle chiffre", async () => {
    const old = key();
    vi.stubEnv("PAYMENT_SECRETS_KEY", old);
    const where = { accountId: "compte_a", field: "webhookSecret" as const };
    const before = await sealSecret("wave_sn_WHS_ancien", where);
    vi.stubEnv("PAYMENT_SECRETS_KEY", key());
    vi.stubEnv("PAYMENT_SECRETS_KEY_VERSION", "2");
    vi.stubEnv("PAYMENT_SECRETS_KEY_PREVIOUS", old);
    expect(await openSecret(before, where)).toBe("wave_sn_WHS_ancien");
    expect(sealedVersion(await sealSecret("wave_sn_WHS_nouveau", where))).toBe(2);
    vi.stubEnv("PAYMENT_SECRETS_KEY_PREVIOUS", "");
    await expect(openSecret(before, where)).rejects.toThrow();
  });

  test("sans clé maîtresse, on ne chiffre pas", async () => {
    vi.stubEnv("PAYMENT_SECRETS_KEY", "");
    expect(secretBoxConfigured()).toBe(false);
    await expect(sealSecret("x", { accountId: "a", field: "apiKey" })).rejects.toThrow();
  });
});
