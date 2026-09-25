/**
 * Le registre des fournisseurs en ligne — Joliba (D-111, D-125)
 *
 * Un seul fournisseur réel en T5 : Wave Côte d'Ivoire. Le « faux fournisseur » n'est PAS un
 * adaptateur de ce registre : c'est un faux SERVEUR Wave (tests et bout en bout), contre lequel
 * tourne le vrai adaptateur. Rien de factice ne peut donc être choisi en production.
 *
 * `WAVE_API_URL` désigne ce faux serveur. Elle n'est honorée que sur un backend LOCAL avec
 * `JOLIBA_FAKE_PAYMENTS=1` : ailleurs, l'adresse de Wave est celle de sa documentation, et une
 * variable mal posée sur un déploiement réel ne détourne rien.
 */

import { createWaveProvider } from "./wave";
import type { OnlinePaymentProvider, ProviderKey, ProviderSecrets } from "./types";

export const WAVE_API_BASE = "https://api.wave.com";

export const PROVIDER_LABEL: Record<ProviderKey, string> = { wave_ci: "Wave" };

export function isProviderKey(value: string): value is ProviderKey {
  return value === "wave_ci";
}

/** Le backend est-il le backend local des tests ? Même garde que la démonstration (D-053). */
export function isLocalBackend(): boolean {
  const url = process.env.CONVEX_CLOUD_URL;
  if (!url) return false;
  try {
    const host = new URL(url).hostname;
    return host === "127.0.0.1" || host === "localhost";
  } catch {
    return false;
  }
}

export function fakePaymentsAllowed(): boolean {
  return process.env.JOLIBA_FAKE_PAYMENTS === "1" && isLocalBackend();
}

export function waveBaseUrl(): string {
  const override = process.env.WAVE_API_URL;
  return override && fakePaymentsAllowed() ? override.replace(/\/+$/, "") : WAVE_API_BASE;
}

export function createProvider(key: ProviderKey, secrets: ProviderSecrets): OnlinePaymentProvider {
  switch (key) {
    case "wave_ci":
      return createWaveProvider(secrets, waveBaseUrl());
  }
}
