/**
 * Tâches programmées — Joliba (D-120, D-121, D-141)
 *
 *  - toutes les 2 minutes, le rattrapage : les paiements en ligne en attente sont revérifiés
 *    chez le fournisseur (un webhook peut se perdre), les remboursements en suspens rejoués ;
 *  - chaque matin à 06:00 UTC, le rapprochement avec le relevé du fournisseur : J-1, puis J-2 ;
 *  - chaque nuit, le ré-encodage des clés Wave sous la clé maîtresse en cours (sans effet hors
 *    rotation) ;
 *  - toutes les heures, la clôture des jours de service (D-141).
 */

import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";

const crons = cronJobs();

crons.interval("paiements en ligne : rattrapage", { minutes: 2 }, internal.onlinePayments.sweep, {});
crons.daily("paiements en ligne : rapprochement", { hourUTC: 6, minuteUTC: 0 }, internal.onlinePayments.reconcileAll, {});

crons.daily("paiements en ligne : re-encodage des secrets", { hourUTC: 3, minuteUTC: 17 }, internal.paymentAccounts.resealAll, {});

// Les chiffres : J-1 se clôt une heure après la fin de son jour de service, J-2 se recalcule le
// lendemain (D-141). Horaire, parce que chaque établissement a son fuseau et son heure de début.
crons.hourly("analytique : cloture des jours", { minuteUTC: 23 }, internal.analytics.closeDays, {});

export default crons;
