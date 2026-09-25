import { describe, expect, it } from "vitest";
import { brandThemeCss } from "../../convex/lib/brandTheme";
import {
  hexToRgb,
  JOLIBA_BRAND,
  normalizeHex,
  oklchToRgb,
  resolveBrandColor,
  rgbToHex,
  rgbToOklch,
  worstContrast,
} from "../../convex/lib/brand";

/** Écart de teinte en degrés, sur le cercle. */
function hueGap(a: number, b: number): number {
  const d = Math.abs(a - b) % 360;
  return d > 180 ? 360 - d : d;
}

describe("resolveBrandColor (D-150)", () => {
  it("laisse intacte une couleur déjà lisible, dont celle de Joliba", () => {
    const joliba = resolveBrandColor(JOLIBA_BRAND);
    expect(joliba).toMatchObject({ input: JOLIBA_BRAND, primary: JOLIBA_BRAND, adjusted: false });
    expect(joliba.contrast).toBeGreaterThanOrEqual(4.5);
    expect(resolveBrandColor("#B00020")).toMatchObject({ primary: "#b00020", adjusted: false });
  });

  it("assombrit un jaune vif sans jamais le refuser, et le garde jaune", () => {
    const yellow = resolveBrandColor("#FFD100");
    expect(yellow.adjusted).toBe(true);
    expect(worstContrast(hexToRgb(yellow.primary))).toBeGreaterThanOrEqual(4.5);
    const [, c, h] = rgbToOklch(hexToRgb(yellow.primary));
    expect(c).toBeGreaterThan(0.05);
    expect(hueGap(h, rgbToOklch(hexToRgb("#ffd100"))[2])).toBeLessThan(6);
  });

  it("normalise la saisie et refuse ce qui n'est pas une couleur", () => {
    expect(normalizeHex(" #ABC ")).toBe("#aabbcc");
    expect(normalizeHex("#0B6478")).toBe("#0b6478");
    for (const bad of ["red", "#12345", "#1234567", "0b6478", "#gg0000", "#fff;}body{"]) {
      expect(normalizeHex(bad)).toBeNull();
      expect(() => resolveBrandColor(bad)).toThrow();
    }
  });

  // La grille : 24 teintes × 9 luminosités × 3 saturations. Chaque couleur ressort lisible,
  // avec sa teinte, et jamais plus claire qu'à l'entrée.
  it("tient les trois paires sur toute une grille de teintes et de luminosités", () => {
    let checked = 0;
    for (let h = 0; h < 360; h += 15) {
      for (const l of [0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 0.97]) {
        for (const c of [0.03, 0.1, 0.2]) {
          const hex = rgbToHex(oklchToRgb(l, c, h));
          const result = resolveBrandColor(hex);
          const shown = hexToRgb(result.primary);
          expect(worstContrast(shown), `${hex} → ${result.primary}`).toBeGreaterThanOrEqual(4.5);
          const [lIn, cIn, hIn] = rgbToOklch(hexToRgb(hex));
          const [lOut, cOut, hOut] = rgbToOklch(shown);
          expect(lOut).toBeLessThanOrEqual(lIn + 0.01);
          // La teinte n'a de sens que si la couleur est colorée à l'entrée comme à la sortie.
          if (cIn > 0.02 && cOut > 0.02) expect(hueGap(hIn, hOut), `${hex} → ${result.primary}`).toBeLessThan(8);
          if (!result.adjusted) expect(result.primary).toBe(hex);
          checked++;
        }
      }
    }
    expect(checked).toBe(24 * 9 * 3);
  });
});

describe("brandThemeCss (D-152)", () => {
  it("n'émet que des jetons construits à partir d'un hexadécimal validé", () => {
    expect(brandThemeCss("#044e5a")).toBe(":root{--primary:#044e5a;--ring:#044e5a;--primary-foreground:#fafafa}");
    expect(() => brandThemeCss("#044e5a}body{display:none")).toThrow();
    expect(() => brandThemeCss("red")).toThrow();
  });
});
