/**
 * Appareils enrôlés et PIN de service, pour les tests (D-060).
 *
 * Tout passe par le chemin réel : le gérant fait apparaître un code, l'appareil l'échange contre
 * son jeton, l'employé active son PIN puis s'identifie ; le jeton d'opérateur obtenu est relu
 * pour en tirer le sujet que Convex verrait.
 */

import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import { OPERATOR_ISSUER, type Session, type T } from "./setup";

export async function enrollDevice(
  t: T,
  manager: Session,
  venueId: Id<"venues">,
  options: { deviceType: "kds" | "shared" | "personal"; label?: string; stationId?: Id<"prepStations">; memberId?: Id<"organizationMembers"> },
) {
  const { code } = await manager.as.mutation(api.devices.createEnrollment, {
    venueId,
    label: options.label ?? "Tablette",
    deviceType: options.deviceType,
    ...(options.stationId ? { stationId: options.stationId } : {}),
    ...(options.memberId ? { memberId: options.memberId } : {}),
  });
  const enrolled = await t.mutation(api.devices.enroll, { code });
  if (!enrolled.ok) throw new Error(`enrôlement refusé : ${enrolled.reason}`);
  return { deviceToken: enrolled.deviceToken, deviceId: enrolled.deviceId };
}

export async function pinMember(
  manager: Session,
  organizationId: Id<"organizations">,
  roleId: Id<"roles">,
  venueIds: Id<"venues">[],
  displayName: string,
) {
  return manager.as.mutation(api.staff.createPinMember, { organizationId, displayName, roleId, venueIds });
}

/** Le sujet porté par un jeton d'opérateur : ce que Convex lit après vérification. */
export function subjectOf(token: string): string {
  const payload = token.split(".")[1]!.replace(/-/g, "+").replace(/_/g, "/");
  return (JSON.parse(atob(payload)) as { sub: string }).sub;
}

/** Active le PIN avec le code, puis s'identifie : renvoie le client « comme cet opérateur ». */
export async function activateAndUnlock(t: T, deviceToken: string, code: string, pin: string) {
  const activated = await t.mutation(api.operators.activate, { deviceToken, code, pin });
  if (!activated.ok) throw new Error(`activation refusée : ${activated.reason}`);
  return unlockAs(t, deviceToken, activated.memberId, pin);
}

export async function unlockAs(t: T, deviceToken: string, memberId: Id<"organizationMembers">, pin: string) {
  const unlocked = await t.action(api.operators.unlock, { deviceToken, memberId, pin });
  if (!unlocked.ok) throw new Error(`déverrouillage refusé : ${unlocked.reason}`);
  const subject = subjectOf(unlocked.token);
  return {
    ...unlocked,
    sessionId: subject.slice(3) as Id<"operatorSessions">,
    as: t.withIdentity({ issuer: OPERATOR_ISSUER, subject }),
  };
}

export function asDevice(t: T, deviceId: Id<"trustedDevices">) {
  return t.withIdentity({ issuer: OPERATOR_ISSUER, subject: `dev:${deviceId}` });
}
