/**
 * Les étapes de la mise en service — Joliba (INFORMATION_ARCHITECTURE §5.1, D-176)
 *
 * Sept étapes en quatre groupes. Chacune porte la permission de l'écran qu'elle ouvre : sans
 * elle, l'étape s'affiche grisée avec qui peut la faire, jamais masquée — la masquer donnerait
 * une progression fausse.
 *
 * L'état d'une étape se DÉRIVE des données (`convex/onboarding.ts`) : une carte dépubliée repasse
 * « à faire » d'elle-même. Ne se stocke que ce qui ne se dérive pas — la confirmation des modes de
 * service (les valeurs par défaut existent, rien ne distingue « vu » de « jamais regardé ») et les
 * étapes sautées.
 */

import { v } from "convex/values";
import type { Permission } from "./permissions";

export const ONBOARDING_STEPS = ["identity", "service", "menu", "publish", "tables", "qr", "team"] as const;
export type OnboardingStep = (typeof ONBOARDING_STEPS)[number];

export const onboardingStep = v.union(...ONBOARDING_STEPS.map((s) => v.literal(s)));

type StepMeta = {
  group: "venue" | "menu" | "floor" | "team";
  label: string;
  /** Ce que l'étape débloque, dit au restaurateur. */
  why: string;
  permission: Permission;
  /** Le temps réaliste qu'elle prend. */
  minutes: number;
};

export const STEP_META: Record<OnboardingStep, StepMeta> = {
  identity: { group: "venue", label: "Identité de l'établissement", why: "Nom, type, fuseau et devise.", permission: "venue.manage", minutes: 2 },
  service: { group: "venue", label: "Comment vous travaillez", why: "Qui saisit la commande : votre équipe, ou le client.", permission: "venue.settings.service", minutes: 3 },
  menu: { group: "menu", label: "Créer la carte", why: "Vos plats, vos prix.", permission: "menu.edit", minutes: 20 },
  publish: { group: "menu", label: "Publier la carte", why: "Le QR devient utile.", permission: "menu.publish", minutes: 1 },
  tables: { group: "floor", label: "Créer les tables", why: "Chaque table reçoit son QR.", permission: "table.manage", minutes: 5 },
  qr: { group: "floor", label: "Premier client scanné", why: "Imprimez vos QR : l'étape se coche au premier scan.", permission: "table.qr.manage", minutes: 10 },
  team: { group: "team", label: "Inviter un collègue", why: "Le service tourne à plusieurs.", permission: "team.manage", minutes: 2 },
};

export const GROUP_LABELS: Record<StepMeta["group"], string> = {
  venue: "Votre établissement",
  menu: "Votre carte",
  floor: "Votre salle",
  team: "Votre équipe",
};

/** Seuls les modes de service se confirment : c'est la seule étape qu'aucune donnée ne prouve. */
export const CONFIRMABLE_STEPS: readonly OnboardingStep[] = ["service"];

/** L'identité est faite dès la création : elle ne se saute pas. */
export const SKIPPABLE_STEPS: readonly OnboardingStep[] = ONBOARDING_STEPS.filter((s) => s !== "identity");
