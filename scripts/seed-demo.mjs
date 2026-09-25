#!/usr/bin/env node
/**
 * Charge le restaurant de démonstration sur le backend Convex LOCAL — Joliba
 *
 * Photos : générées dans Chromium (dégradés et bruit, pour que la compression pèse comme une
 * vraie photo), au format que produira l'écran d'envoi : une grande image (1280 px, WebP) et
 * une vignette (480 px). Puis `convex/devSeed.ts` crée l'établissement, la carte publiée, une
 * table et son QR, et ce script affiche l'adresse de scan.
 *
 * Refuse de tourner contre autre chose qu'un backend local anonyme.
 *
 *     node scripts/seed-demo.mjs            → une ligne JSON { venueSlug, token, scanPath }
 */

import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { chromium } from "@playwright/test";

const env = readFileSync(".env.local", "utf8");
if (!/^CONVEX_DEPLOYMENT=anonymous:/m.test(env)) {
  console.error("Refusé : .env.local ne désigne pas un backend Convex local anonyme.");
  process.exit(1);
}

const PHOTOS = 30;

function convexRun(fn, args) {
  const out = execFileSync("pnpm", ["exec", "convex", "run", fn, JSON.stringify(args)], {
    env: { ...process.env, CONVEX_AGENT_MODE: "anonymous" },
    encoding: "utf8",
    stdio: ["ignore", "pipe", "inherit"],
  });
  return JSON.parse(out);
}

const browser = await chromium.launch(process.env.PLAYWRIGHT_CHROMIUM_PATH ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH } : {});
const page = await browser.newPage();
const images = await page.evaluate(async (count) => {
  async function draw(seed, width, height) {
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const g = canvas.getContext("2d");
    const hue = (seed * 47) % 360;
    const grad = g.createRadialGradient(width * 0.45, height * 0.5, 10, width / 2, height / 2, width * 0.7);
    grad.addColorStop(0, `hsl(${hue} 55% 55%)`);
    grad.addColorStop(0.6, `hsl(${(hue + 30) % 360} 45% 35%)`);
    grad.addColorStop(1, `hsl(${(hue + 60) % 360} 30% 15%)`);
    g.fillStyle = grad;
    g.fillRect(0, 0, width, height);
    // Un « plat » et du grain : sans détail, une image pèserait dix fois moins qu'une photo.
    g.fillStyle = `hsl(${(hue + 180) % 360} 40% 60% / 0.8)`;
    g.beginPath();
    g.ellipse(width / 2, height / 2, width * 0.3, height * 0.28, 0, 0, Math.PI * 2);
    g.fill();
    const pixels = g.getImageData(0, 0, width, height);
    let state = seed * 9301 + 49297;
    for (let i = 0; i < pixels.data.length; i += 4) {
      state = (state * 1103515245 + 12345) & 0x7fffffff;
      const noise = (state % 48) - 24;
      pixels.data[i] += noise;
      pixels.data[i + 1] += noise;
      pixels.data[i + 2] += noise;
    }
    g.putImageData(pixels, 0, 0);
    // Le même plafond que l'envoi réel : 600 Ko la photo, 20 Ko la vignette (D-166).
    const cap = width <= 256 ? 20_000 : 600_000;
    for (const quality of [0.72, 0.6, 0.5, 0.4, 0.3]) {
      const blob = await new Promise((resolve) => canvas.toBlob(resolve, "image/webp", quality));
      if (blob.size <= cap) return blob;
    }
    throw new Error("Image de démonstration trop lourde");
  }
  const toBase64 = async (blob) => {
    const bytes = new Uint8Array(await blob.arrayBuffer());
    let s = "";
    for (const b of bytes) s += String.fromCharCode(b);
    return btoa(s);
  };
  const out = [];
  for (let i = 0; i < count; i++) {
    out.push({ full: await toBase64(await draw(i + 1, 1280, 960)), thumb: await toBase64(await draw(i + 1, 256, 192)) });
  }
  return out;
}, PHOTOS);
await browser.close();

const urls = convexRun("devSeed:uploadUrls", { count: PHOTOS * 2 });
const upload = async (url, base64) => {
  const response = await fetch(url, { method: "POST", headers: { "Content-Type": "image/webp" }, body: Buffer.from(base64, "base64") });
  if (!response.ok) throw new Error(`Envoi refusé : ${response.status}`);
  return (await response.json()).storageId;
};
const stored = [];
for (const [i, image] of images.entries()) {
  stored.push({
    storageId: await upload(urls[i * 2], image.full),
    thumbStorageId: await upload(urls[i * 2 + 1], image.thumb),
    width: 1280,
    height: 960,
  });
}
const sizes = images.map((i) => Math.round((i.thumb.length * 3) / 4 / 1024));
const result = convexRun("devSeed:demoRestaurant", { images: stored });
console.log(JSON.stringify({ ...result, scanPath: `/r/${result.venueSlug}/t/${result.token}`, thumbKb: { min: Math.min(...sizes), max: Math.max(...sizes) } }));
