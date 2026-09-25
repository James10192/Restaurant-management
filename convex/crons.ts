/**
 * Tâches programmées — Joliba (D-120, D-121)
 *
 *  - toutes les 2 minutes, le rattrapage : les paiements en ligne en attente sont revérifiés
 *    chez le fournisseur (un webhook peut se perdre), les remboursements en suspens rejoués ;
 *  - chaque matin à 06:00 UTC, le rapprochement avec le relevé du fournisseur : J-1, puis J-2.
 */

import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";

const crons = cronJobs();

crons.interval("paiements en ligne : rattrapage", { minutes: 2 }, internal.onlinePayments.sweep, {});
crons.daily("paiements en ligne : rapprochement", { hourUTC: 6, minuteUTC: 0 }, internal.onlinePayments.reconcileAll, {});

export default crons;
