/**
 * Le contrat d'un fournisseur de paiement EN LIGNE — Joliba (D-110, D-111)
 *
 * Révise PAYMENTS.md §3 : l'espèce et les moyens déclarés au comptoir ne passent pas par ce
 * contrat (ils sont synchrones et transactionnels, `applyPayment`). Celui-ci ne décrit que ce qui
 * passe par le réseau : créer une session de paiement, la relire, l'expirer, la rembourser, lire
 * le relevé d'un jour.
 *
 * Un adaptateur se construit PAR COMPTE (`createProvider(compte, secrets)`) : chaque restaurant
 * a sa propre clé chez le fournisseur. Il ne connaît ni les additions, ni les tables, ni la base.
 */

export type ProviderKey = "wave_ci";

export type ProviderSecrets = {
  apiKey: string;
  /** Facultative : certaines clés Wave exigent que chaque requête soit signée. */
  requestSigningSecret?: string;
};

/**
 * `pending` : ouverte, pas encore payée · `succeeded` : payée · `expired` : plus payable ·
 * `failed_attempt` : un essai a échoué (solde insuffisant…) — non terminal tant que la session
 * est ouverte.
 */
export type SessionStatus = "pending" | "succeeded" | "expired" | "failed_attempt";

export type ProviderSession = {
  providerRef: string;
  /** Notre référence, telle que le fournisseur la rend. */
  reference: string | null;
  status: SessionStatus;
  /** En unité mineure ; `null` si le fournisseur a rendu un montant illisible. */
  amount: number | null;
  currency: string;
  launchUrl: string | null;
  transactionId: string | null;
  paidAt: number | null;
  expiresAt: number | null;
  /** Code d'erreur du dernier essai (« insufficient-funds »), jamais un message libre. */
  lastErrorCode: string | null;
};

export type ProviderTransaction = {
  transactionId: string;
  kind: "checkout" | "checkout_refund" | "other";
  /** Variation du solde, en unité mineure : négative pour un remboursement. */
  amount: number;
  fee: number;
  currency: string;
  providerRef: string | null;
  reference: string | null;
  at: number;
};

export type ProviderErrorCode = "unreachable" | "unauthorized" | "rate_limited" | "not_found" | "conflict" | "rejected" | "invalid_response";

/** Une erreur du fournisseur, sans jamais porter la clé, le corps envoyé ni la réponse brute. */
export class ProviderError extends Error {
  constructor(
    readonly code: ProviderErrorCode,
    readonly status: number | null = null,
    readonly providerCode: string | null = null,
  ) {
    super(`Fournisseur de paiement : ${code}${status ? ` (HTTP ${status})` : ""}${providerCode ? ` ${providerCode}` : ""}`);
  }
}

export type ProviderCapabilities = {
  partialRefund: boolean;
  sandbox: boolean;
  currencies: readonly string[];
};

export interface OnlinePaymentProvider {
  readonly key: ProviderKey;
  readonly capabilities: ProviderCapabilities;
  /** Le montant est celui du SERVEUR (R14). Aucune donnée du payeur n'est transmise (D-127). */
  initialize(input: { amount: number; currency: string; reference: string; successUrl: string; errorUrl: string }): Promise<ProviderSession>;
  /** Retrouver une session créée dont la réponse s'est perdue (D-119). */
  findByReference(reference: string): Promise<ProviderSession[]>;
  /** C'est CE retour qui fait foi, jamais la redirection du client (R15). */
  verify(providerRef: string): Promise<ProviderSession>;
  /** `already_final` : payée ou expirée entre-temps. */
  expire(providerRef: string): Promise<"expired" | "already_final">;
  /** Remboursement TOTAL chez Wave (D-123). Idempotent chez le fournisseur. */
  refund(providerRef: string): Promise<void>;
  /** Le relevé d'un jour UTC, toutes pages lues (D-121). */
  transactionsOfDay(dayUtc: string): Promise<ProviderTransaction[]>;
  /** La clé répond-elle, et a-t-elle le droit « Solde » ? */
  testConnection(): Promise<{ balanceAccess: boolean }>;
}
