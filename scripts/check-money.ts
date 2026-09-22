/**
 * Contrôles de la logique des montants — Joliba
 *
 * Exécutable sans dépendance de test :
 *     node --experimental-strip-types scripts/check-money.ts
 *
 * Ces contrôles deviendront des tests Vitest en tranche T0 (voir docs/ROADMAP.md).
 * Ils existent DÈS MAINTENANT parce que PAYMENTS.md affirme deux choses qu'il vaut
 * mieux prouver que promettre : que le franc CFA ne se multiplie pas par 100, et
 * qu'une division d'addition ne perd pas une unité.
 */
import { fromDecimal, scaleFactor, splitEvenly, sum, roundUpToStep, percentOf, formatMoney, money, add } from "../convex/lib/money.ts";

let fails = 0;
const check = (label: string, got: unknown, want: unknown) => {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  if (!ok) fails++;
  console.log(`${ok ? "✓" : "✗"} ${label}\n    obtenu ${JSON.stringify(got)}${ok ? "" : `\n    attendu ${JSON.stringify(want)}`}`);
};

console.log("— Le piège du franc CFA —");
check("scaleFactor(XOF) vaut 1, pas 100", scaleFactor("XOF"), 1);
check("5000 FCFA saisis → 5000 stockés (et NON 500000)", fromDecimal(5000, "XOF").amount, 5000);
check("12,50 EUR saisis → 1250 stockés", fromDecimal(12.5, "EUR").amount, 1250);

console.log("\n— Division d'une addition sans perdre une unité —");
const split3 = splitEvenly(money(10000, "XOF"), 3);
check("10 000 XOF à 3 → somme exacte", sum(split3, "XOF").amount, 10000);
check("10 000 XOF à 3 → le reste va sur la première part", split3.map(m => m.amount), [3334, 3333, 3333]);
const split7 = splitEvenly(money(35000, "XOF"), 7);
check("35 000 XOF à 7 → parts égales", split7.map(m => m.amount), [5000,5000,5000,5000,5000,5000,5000]);
check("1 XOF à 3 → personne ne paie une unité fantôme", splitEvenly(money(1, "XOF"), 3).map(m => m.amount), [1, 0, 0]);

console.log("\n— Arrondi au pas d'un fournisseur (toujours au supérieur) —");
check("5001 avec pas de 5 → 5005, jamais 5000", roundUpToStep(money(5001, "XOF"), 5).amount, 5005);
check("5000 avec pas de 5 → inchangé", roundUpToStep(money(5000, "XOF"), 5).amount, 5000);

console.log("\n— Taxes —");
check("TVA 18 % sur 5000 XOF", percentOf(money(5000, "XOF"), 18).amount, 900);

console.log("\n— Garde-fous —");
try { add(money(1000, "XOF"), money(10, "EUR")); console.log("✗ addition de devises différentes acceptée"); fails++; }
catch { console.log("✓ addition de devises différentes refusée"); }
try { money(12.5, "XOF"); console.log("✗ montant non entier accepté"); fails++; }
catch { console.log("✓ montant non entier refusé"); }

console.log("\n— Formatage —");
console.log("   XOF :", formatMoney(money(35000, "XOF")));
console.log("   EUR :", formatMoney(money(1250, "EUR"), "fr-FR"));

console.log(`\n${fails === 0 ? "✓ TOUS LES CONTRÔLES PASSENT" : `✗ ${fails} ÉCHEC(S)`}`);
process.exit(fails === 0 ? 0 : 1);
