/**
 * Apparence de la carte (T7.a) : la couleur saisie et celle affichée, le logo et sa garde.
 */

import { describe, expect, test } from "vitest";
import { api, internal } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import { logoInfo, MAX_LOGO_BYTES } from "../../convex/branding";
import { hexToRgb, worstContrast } from "../../convex/lib/brand";
import { restaurantWithMenu } from "./catalogFixtures";
import { expectCode } from "./setup";

/** Un en-tête PNG minimal aux dimensions voulues, complété jusqu'à `size` octets. */
function png(width: number, height: number, size = 200): Uint8Array<ArrayBuffer> {
  const bytes = new Uint8Array(size);
  bytes.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13, 0x49, 0x48, 0x44, 0x52]);
  new DataView(bytes.buffer).setUint32(16, width);
  new DataView(bytes.buffer).setUint32(20, height);
  return bytes;
}

/** Un WebP sans perte (VP8L) aux dimensions voulues. */
function webpLossless(width: number, height: number): Uint8Array<ArrayBuffer> {
  const bytes = new Uint8Array(120);
  const ascii = (at: number, text: string) => [...text].forEach((c, i) => (bytes[at + i] = c.charCodeAt(0)));
  ascii(0, "RIFF");
  ascii(8, "WEBP");
  ascii(12, "VP8L");
  bytes[20] = 0x2f;
  const bits = (width - 1) | ((height - 1) << 14);
  new DataView(bytes.buffer).setUint32(21, bits, true);
  return bytes;
}

describe("logoInfo : ce que dit le FICHIER, pas le navigateur", () => {
  test("lit les dimensions d'un PNG et d'un WebP sans perte", () => {
    expect(logoInfo(png(256, 128))).toEqual({ width: 256, height: 128 });
    expect(logoInfo(webpLossless(200, 64))).toEqual({ width: 200, height: 64 });
  });

  test("refuse JPEG, SVG, un logo trop grand ou trop lourd", () => {
    const jpeg = new Uint8Array(200);
    jpeg.set([0xff, 0xd8, 0xff, 0xe0]);
    expect(logoInfo(jpeg)).toBeNull();
    expect(logoInfo(new TextEncoder().encode(`<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>`.padEnd(100)))).toBeNull();
    expect(logoInfo(png(1024, 1024))).toBeNull();
    expect(logoInfo(png(8, 8))).toBeNull();
    expect(logoInfo(png(256, 256, MAX_LOGO_BYTES + 1))).toBeNull();
  });
});

describe("couleur de marque", () => {
  test("un nouvel établissement n'a pas de couleur : la carte garde celle de Joliba", async () => {
    const r = await restaurantWithMenu();
    const state = await r.owner.as.query(api.branding.get, { venueId: r.cocody });
    expect(state.color).toBeNull();
    expect(state.logo).toBeNull();
  });

  test("un jaune vif est enregistré tel que saisi, et affiché assez sombre pour être lu", async () => {
    const r = await restaurantWithMenu();
    const saved = await r.owner.as.mutation(api.branding.setColor, { venueId: r.cocody, color: "#FFD100" });
    expect(saved).toMatchObject({ input: "#ffd100", adjusted: true });
    const state = await r.owner.as.query(api.branding.get, { venueId: r.cocody });
    expect(state.color?.input).toBe("#ffd100");
    expect(worstContrast(hexToRgb(state.color!.primary))).toBeGreaterThanOrEqual(4.5);

    // La carte publique ne reçoit QUE la couleur résolue.
    await r.owner.as.mutation(api.publications.publish, { venueId: r.cocody, menuId: r.menuId });
    await r.t.run((ctx) => ctx.db.patch(r.cocody, { publicMenuEnabled: true }));
    const page = await r.t.query(api.guest.publicMenu, { venueSlug: "cocody" });
    expect(page?.venue.brand).toEqual({ primary: state.color!.primary, logo: null });
    expect(JSON.stringify(page)).not.toContain("#ffd100");

    // Revenir à Joliba efface les deux.
    await r.owner.as.mutation(api.branding.setColor, { venueId: r.cocody, color: null });
    expect((await r.owner.as.query(api.branding.get, { venueId: r.cocody })).color).toBeNull();
  });

  test("une saisie qui n'est pas une couleur est refusée, et l'apparence exige venue.manage", async () => {
    const r = await restaurantWithMenu();
    await expectCode(r.owner.as.mutation(api.branding.setColor, { venueId: r.cocody, color: "#fff;}body{" }), "INVALID_ARGUMENT");
    await expectCode(r.editor.as.mutation(api.branding.setColor, { venueId: r.cocody, color: "#044e5a" }), "FORBIDDEN");
    await expectCode(r.waiter.as.query(api.branding.get, { venueId: r.cocody }), "FORBIDDEN");
  });

  test("chaque changement est journalisé", async () => {
    const r = await restaurantWithMenu();
    await r.owner.as.mutation(api.branding.setColor, { venueId: r.cocody, color: "#b00020" });
    const logs = await r.t.run((ctx) => ctx.db.query("auditLogs").collect());
    expect(logs.find((l) => l.action === "venue.branding.color")?.after).toEqual({ primaryColor: "#b00020", resolvedPrimary: "#b00020" });
  });

  test("la migration retire la couleur semée et le thème, jamais une couleur choisie", async () => {
    const r = await restaurantWithMenu();
    const settingsOf = (venueId: Id<"venues">) =>
      r.t.run(async (ctx) => (await ctx.db.query("venueSettings").withIndex("by_venue", (q) => q.eq("venueId", venueId)).unique())!);
    const seeded = await settingsOf(r.cocody);
    await r.t.run((ctx) => ctx.db.patch(seeded._id, { branding: { primaryColor: "#0B6478", theme: "light" } }));
    await r.owner.as.mutation(api.branding.setColor, { venueId: r.plateau, color: "#b00020" });
    const chosen = await settingsOf(r.plateau);
    await r.t.run((ctx) => ctx.db.patch(chosen._id, { branding: { ...chosen.branding, theme: "light" } }));

    await r.t.mutation(internal.migrations.resetSeededBranding, {});
    expect((await settingsOf(r.cocody)).branding).toEqual({});
    expect((await settingsOf(r.plateau)).branding).toEqual({ primaryColor: "#b00020", resolvedPrimary: "#b00020" });
    expect(await r.t.mutation(internal.migrations.resetSeededBranding, {})).toEqual({ updated: 0 });
  });
});

describe("logo", () => {
  const jpeg = () => {
    const bytes = new Uint8Array(10 * 1024);
    bytes.set([0xff, 0xd8, 0xff, 0xe0]);
    return new Blob([bytes]);
  };

  test("posé, montré sur la carte, remplacé : l'ancien fichier part", async () => {
    const r = await restaurantWithMenu();
    const store = (bytes: Uint8Array<ArrayBuffer>) => r.t.run((ctx) => ctx.storage.store(new Blob([bytes])));
    const first = await store(png(256, 128));
    expect(await r.owner.as.action(api.branding.setLogo, { venueId: r.cocody, storageId: first })).toEqual({ ok: true });
    expect((await r.owner.as.query(api.branding.get, { venueId: r.cocody })).logo).toMatchObject({ width: 256, height: 128 });

    const second = await store(webpLossless(128, 128));
    expect(await r.owner.as.action(api.branding.setLogo, { venueId: r.cocody, storageId: second })).toEqual({ ok: true });
    expect(await r.t.run((ctx) => ctx.db.system.get(first))).toBeNull();

    await r.owner.as.mutation(api.publications.publish, { venueId: r.cocody, menuId: r.menuId });
    await r.t.run((ctx) => ctx.db.patch(r.cocody, { publicMenuEnabled: true }));
    const page = await r.t.query(api.guest.publicMenu, { venueSlug: "cocody" });
    expect(page?.venue.brand.logo).toMatchObject({ width: 128, height: 128 });

    await r.owner.as.mutation(api.branding.removeLogo, { venueId: r.cocody });
    expect(await r.t.run((ctx) => ctx.db.system.get(second))).toBeNull();
    expect((await r.owner.as.query(api.branding.get, { venueId: r.cocody })).logo).toBeNull();
  });

  test("un fichier refusé est effacé et le refus renvoyé", async () => {
    const r = await restaurantWithMenu();
    const svg = await r.t.run((ctx) => ctx.storage.store(new Blob(["<svg><script>alert(1)</script></svg>".padEnd(100)])));
    expect(await r.owner.as.action(api.branding.setLogo, { venueId: r.cocody, storageId: svg })).toMatchObject({ ok: false });
    expect(await r.t.run((ctx) => ctx.db.system.get(svg))).toBeNull();
  });

  test("garde croisée : la photo d'un plat ne devient pas un logo, ni l'inverse (D-154)", async () => {
    const r = await restaurantWithMenu();
    const photo = await r.t.run((ctx) => ctx.storage.store(jpeg()));
    const thumb = await r.t.run((ctx) => ctx.storage.store(jpeg()));
    await r.owner.as.action(api.products.addImage, {
      venueId: r.cocody,
      productId: r.products.poulet,
      storageId: photo,
      thumbStorageId: thumb,
      width: 1200,
      height: 900,
    });
    // Un refus efface le fichier : la garde passe AVANT, la photo du plat reste.
    await expectCode(r.owner.as.action(api.branding.setLogo, { venueId: r.cocody, storageId: photo }), "INVALID_ARGUMENT");
    expect(await r.t.run((ctx) => ctx.db.system.get(photo))).not.toBeNull();

    const logo = await r.t.run((ctx) => ctx.storage.store(new Blob([png(256, 128)])));
    await r.owner.as.action(api.branding.setLogo, { venueId: r.plateau, storageId: logo });
    await expectCode(
      r.owner.as.action(api.products.addImage, {
        venueId: r.cocody,
        productId: r.products.poisson,
        storageId: logo,
        thumbStorageId: await r.t.run((ctx) => ctx.storage.store(jpeg())),
        width: 1200,
        height: 900,
      }),
      "INVALID_ARGUMENT",
    );
    // Le logo d'un établissement ne devient pas celui d'un autre.
    await expectCode(r.owner.as.action(api.branding.setLogo, { venueId: r.cocody, storageId: logo }), "INVALID_ARGUMENT");
  });

  test("sans venue.manage, aucun fichier n'est touché", async () => {
    const r = await restaurantWithMenu();
    const file = await r.t.run((ctx) => ctx.storage.store(new Blob([png(256, 128)])));
    await expectCode(r.editor.as.action(api.branding.setLogo, { venueId: r.cocody, storageId: file }), "FORBIDDEN");
    expect(await r.t.run((ctx) => ctx.db.system.get(file))).not.toBeNull();
  });
});
