#!/usr/bin/env node
/**
 * Mesure de la carte client — Joliba (porte de sortie de T1, DESIGN.md §5)
 *
 * Chromium, profil « Android d'entrée de gamme en 4G bridée » : 1,6 Mbit/s descendant,
 * 750 kbit/s montant, 300 ms de latence, processeur ralenti 6 fois, écran 360 × 740 à 2×.
 * Chaque essai part d'un navigateur VIDE (ni cache, ni service worker) : c'est le premier
 * scan d'un client, le cas le plus défavorable.
 *
 * Ce que ce script NE remplace PAS : le test sur un vrai téléphone (DESIGN.md §12, point 6).
 * Un processeur ralenti par logiciel n'a ni la dalle, ni le processeur graphique, ni la
 * mémoire d'un téléphone à 100 $. Ce chiffre borne ; l'appareil réel tranche.
 *
 *     node scripts/measure-guest.mjs <adresse de scan> [essais=20]
 *     → une ligne JSON par essai sur stderr, le résumé (médiane, 75e centile) sur stdout
 */

import { chromium } from "@playwright/test";

const [target, runsArg] = process.argv.slice(2);
if (!target) {
  console.error("Usage : node scripts/measure-guest.mjs <adresse de scan> [essais]");
  process.exit(1);
}
const RUNS = Number(runsArg ?? 20);
const NETWORK = { offline: false, latency: 300, downloadThroughput: (1.6e6 / 8) | 0, uploadThroughput: (750e3 / 8) | 0 };
const CPU_SLOWDOWN = 6;

const browser = await chromium.launch(process.env.PLAYWRIGHT_CHROMIUM_PATH ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH } : {});
const results = [];

for (let i = 0; i < RUNS; i++) {
  const context = await browser.newContext({ viewport: { width: 360, height: 740 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, locale: "fr-FR" });
  const page = await context.newPage();
  const cdp = await context.newCDPSession(page);
  await cdp.send("Network.enable");
  await cdp.send("Network.emulateNetworkConditions", NETWORK);
  await cdp.send("Emulation.setCPUThrottlingRate", { rate: CPU_SLOWDOWN });

  // Octets réellement transférés, par type, jusqu'au premier affichage utile.
  const types = new Map();
  const bytes = { document: 0, script: 0, stylesheet: 0, image: 0, font: 0, other: 0 };
  cdp.on("Network.responseReceived", (e) => types.set(e.requestId, e.type));
  cdp.on("Network.loadingFinished", (e) => {
    const t = (types.get(e.requestId) ?? "Other").toLowerCase();
    const key = t in bytes ? t : "other";
    bytes[key] += e.encodedDataLength;
  });

  await page.addInitScript(() => {
    window.__lcp = 0;
    new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) window.__lcp = entry.startTime;
    }).observe({ type: "largest-contentful-paint", buffered: true });
  });

  const start = Date.now();
  await page.goto(target, { waitUntil: "commit", timeout: 120_000 });
  // Garde-fou : le premier plat, avec son prix, est bien là. Le chiffre retenu est la première
  // peinture (FCP) : le HTML rendu au serveur porte déjà la carte, le premier affichage EST la carte.
  await page.getByRole("button").filter({ hasText: /CFA|€/ }).first().waitFor({ state: "visible", timeout: 30_000 });
  await page.waitForLoadState("load", { timeout: 120_000 });
  await page.waitForTimeout(1000);
  const metrics = await page.evaluate(() => {
    const nav = performance.getEntriesByType("navigation")[0];
    const fcp = performance.getEntriesByName("first-contentful-paint")[0];
    return {
      url: location.pathname,
      ttfb: nav ? Math.round(nav.responseStart) : null,
      fcp: fcp ? Math.round(fcp.startTime) : null,
      lcp: Math.round(window.__lcp),
      domContentLoaded: nav ? Math.round(nav.domContentLoadedEventEnd) : null,
      load: nav ? Math.round(nav.loadEventEnd) : null,
    };
  });
  const run = { run: i + 1, ...metrics, wall: Date.now() - start, kb: Object.fromEntries(Object.entries(bytes).map(([k, v]) => [k, Math.round(v / 1024)])) };
  console.error(JSON.stringify(run));
  results.push(run);
  await context.close();
}
await browser.close();

function quantile(values, q) {
  const sorted = values.filter((v) => typeof v === "number").sort((a, b) => a - b);
  if (sorted.length === 0) return null;
  const pos = (sorted.length - 1) * q;
  const lo = Math.floor(pos);
  const hi = Math.ceil(pos);
  return Math.round(sorted[lo] + (sorted[hi] - sorted[lo]) * (pos - lo));
}
const summary = {};
for (const key of ["ttfb", "fcp", "lcp", "domContentLoaded", "load"]) {
  const values = results.map((r) => r[key]);
  summary[key] = { median: quantile(values, 0.5), p75: quantile(values, 0.75), max: quantile(values, 1) };
}
summary.kb = Object.fromEntries(Object.keys(results[0].kb).map((k) => [k, quantile(results.map((r) => r.kb[k]), 0.5)]));
console.log(JSON.stringify({ runs: RUNS, profile: { ...NETWORK, cpuSlowdown: CPU_SLOWDOWN, viewport: "360x740@2x" }, summary }, null, 2));
