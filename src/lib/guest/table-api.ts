/**
 * Les gestes du client à table, côté navigateur — Joliba
 *
 * Un POST sur l'adresse même de la table : c'est la seule où le cookie du laissez-passer
 * accompagne la requête (voir `table-actions.server.ts`). Aucun client Convex n'est chargé
 * pour cela : un `fetch` suffit, et pèse zéro octet de plus sur la 4G du client.
 */

import type { FunctionReturnType } from "convex/server";
import type { api } from "../../../convex/_generated/api";

export type Presence = NonNullable<FunctionReturnType<typeof api.guestService.presence>>;
export type SaveCartResult = FunctionReturnType<typeof api.guestService.saveCart>;
export type SubmitCartResult = FunctionReturnType<typeof api.guestService.submitCart>;
export type RequestServiceResult = FunctionReturnType<typeof api.guestService.requestService>;
export type EnterCodeResult = FunctionReturnType<typeof api.guestService.enterCode>;
export type SubmitLinesResult = FunctionReturnType<typeof api.guestService.submitLines>;
export type SubmitFeedbackResult = FunctionReturnType<typeof api.guestService.submitFeedback>;

export type WireLine = { productId: string; variantId?: string; optionIds: string[]; quantity: number; instructions?: string };

export type TableAction =
  | { action: "presence"; guestKey: string }
  | { action: "saveCart"; guestKey: string; lines: WireLine[] }
  | { action: "submitCart"; guestKey: string; idempotencyKey: string }
  | { action: "requestService"; guestKey: string; type: string }
  | { action: "enterCode"; guestKey: string; code: string }
  | { action: "submitLines"; guestKey: string; idempotencyKey: string; lines: WireLine[] }
  | { action: "submitFeedback"; guestKey: string; rating: number; comment?: string; topics: string[] };

type Results = {
  presence: Presence;
  saveCart: SaveCartResult;
  submitCart: SubmitCartResult;
  requestService: RequestServiceResult;
  enterCode: EnterCodeResult;
  submitLines: SubmitLinesResult;
  submitFeedback: SubmitFeedbackResult;
};

type ResultOf<A extends TableAction["action"]> = Results[A];

/** `no_pass` : le laissez-passer n'est plus valable, il faut rescanner. `network` : pas de réponse. */
export type TableCallError = "no_pass" | "network" | "unavailable";

export type TableCall<T> = { ok: true; value: T } | { ok: false; error: TableCallError };

export async function callTable<A extends TableAction>(action: A, signal?: AbortSignal): Promise<TableCall<ResultOf<A["action"]>>> {
  let response: Response;
  try {
    response = await fetch(window.location.pathname, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(action),
      credentials: "same-origin",
      cache: "no-store",
      ...(signal ? { signal } : {}),
    });
  } catch {
    return { ok: false, error: "network" };
  }
  if (response.status === 401) return { ok: false, error: "no_pass" };
  if (!response.ok) return { ok: false, error: "unavailable" };
  try {
    const body = (await response.json()) as { result?: ResultOf<A["action"]> };
    return body.result === undefined ? { ok: false, error: "unavailable" } : { ok: true, value: body.result };
  } catch {
    return { ok: false, error: "unavailable" };
  }
}
