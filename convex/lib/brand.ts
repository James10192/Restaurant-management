/**
 * Couleur de marque d'un établissement — Joliba (D-150, D-151, D-152)
 *
 * Le restaurant choisit UNE couleur. Nous ne la refusons jamais : nous la rendons lisible. On
 * garde sa teinte et sa saturation (OKLCH), et on baisse sa luminosité jusqu'à ce que trois
 * paires tiennent 4,5:1 (WCAG AA, texte courant) :
 *
 *   1. la couleur posée sur le fond de la carte (un lien, un onglet actif) ;
 *   2. le texte clair posé sur la couleur (un bouton) ;
 *   3. le même texte à 80 % d'opacité sur la couleur (une ligne secondaire dans un bouton).
 *
 * Quand la saturation d'origine n'existe plus à la luminosité retenue (un jaune vif assombri
 * sort de l'espace sRGB), on réduit la saturation juste assez pour y rentrer. La teinte, elle,
 * ne bouge jamais : un jaune reste un jaune moutarde, jamais un vert.
 *
 * Fonction PURE, sans dépendance : appelée à l'enregistrement, côté serveur. On stocke la
 * saisie ET le résultat ; la page client ne fait aucun calcul.
 */

// Pas de ré-export d'ici : une page client qui importerait le thème par ce module tirerait tout
// le calcul OKLCH dans le paquet de chaque client (D-166). Elle importe `brandTheme` directement.
import { BRAND_FOREGROUND, HEX_PATTERN } from "./brandTheme";

/** La couleur Joliba (D-059), quand l'établissement n'en a choisi aucune (D-151). */
export const JOLIBA_BRAND = "#044e5a";

/** Le fond de la carte client (`--background`). Le texte posé sur la couleur vient de `brandTheme`. */
const BACKGROUND = "#ffffff";
const MIN_CONTRAST = 4.5;

export type BrandColor = {
  /** Ce que le restaurant a saisi, en minuscules. */
  input: string;
  /** La couleur réellement affichée. Égale à `input` quand rien n'a dû être ajusté. */
  primary: string;
  /** Vrai quand la couleur a été assombrie ou désaturée pour rester lisible. */
  adjusted: boolean;
  /** Le plus faible des trois contrastes, arrondi au centième : ce que l'écran montre. */
  contrast: number;
};

/** Ce que l'écran relit d'une couleur enregistrée : la saisie, l'affichée, et si elles diffèrent. */
export type StoredBrandColor = Pick<BrandColor, "input" | "primary" | "adjusted">;

/** `#ABC`, `#aabbcc`, avec ou sans espaces : une forme canonique, ou null si ce n'en est pas une. */
export function normalizeHex(raw: string): string | null {
  const value = raw.trim().toLowerCase();
  const short = /^#([0-9a-f])([0-9a-f])([0-9a-f])$/.exec(value);
  if (short) return `#${short[1]}${short[1]}${short[2]}${short[2]}${short[3]}${short[3]}`;
  return HEX_PATTERN.test(value) ? value : null;
}

export function resolveBrandColor(raw: string): BrandColor {
  const input = normalizeHex(raw);
  if (!input) throw new Error(`Couleur invalide : ${raw}`);
  const original = hexToRgb(input);
  if (worstContrast(original) >= MIN_CONTRAST) {
    return { input, primary: input, adjusted: false, contrast: round2(worstContrast(original)) };
  }
  const [l0, c0, h] = rgbToOklch(original);
  // La luminosité descend par pas fins : le premier palier qui tient est le plus proche de
  // l'intention. Au pire, près du noir, les trois paires tiennent toujours (21:1 à L = 0).
  for (let l = Math.min(l0, 1); l >= 0; l -= 0.002) {
    const rgb = inGamut(l, c0, h);
    if (worstContrast(rgb) >= MIN_CONTRAST) {
      const primary = rgbToHex(rgb);
      // L'arrondi à l'octet peut faire perdre une fraction : on revérifie sur ce qui sera affiché.
      if (worstContrast(hexToRgb(primary)) >= MIN_CONTRAST) {
        return { input, primary, adjusted: true, contrast: round2(worstContrast(hexToRgb(primary))) };
      }
    }
  }
  return { input, primary: "#000000", adjusted: true, contrast: round2(worstContrast([0, 0, 0])) };
}

/** Contraste WCAG entre deux couleurs sRGB (composantes 0–1). */
export function contrastRatio(a: Rgb, b: Rgb): number {
  const la = luminance(a);
  const lb = luminance(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

export function worstContrast(color: Rgb): number {
  const background = hexToRgb(BACKGROUND);
  const foreground = hexToRgb(BRAND_FOREGROUND);
  // Le navigateur mélange l'opacité dans l'espace sRGB encodé : c'est ce mélange qu'on mesure.
  const fade = (f: number, c: number) => 0.8 * f + 0.2 * c;
  const faded: Rgb = [fade(foreground[0], color[0]), fade(foreground[1], color[1]), fade(foreground[2], color[2])];
  return Math.min(contrastRatio(color, background), contrastRatio(foreground, color), contrastRatio(faded, color));
}

// —— Conversions (Björn Ottosson, « A perceptual color space for image processing », 2020) ——

export type Rgb = [number, number, number];

export function hexToRgb(hex: string): Rgb {
  const n = Number.parseInt(hex.slice(1), 16);
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
}

export function rgbToHex(rgb: Rgb): string {
  return `#${rgb.map((c) => Math.round(clamp01(c) * 255).toString(16).padStart(2, "0")).join("")}`;
}

function luminance([r, g, b]: Rgb): number {
  return 0.2126 * toLinear(r) + 0.7152 * toLinear(g) + 0.0722 * toLinear(b);
}

function toLinear(c: number): number {
  return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
}

function fromLinear(c: number): number {
  return c <= 0.0031308 ? 12.92 * c : 1.055 * c ** (1 / 2.4) - 0.055;
}

export function rgbToOklch(rgb: Rgb): [number, number, number] {
  const [r, g, b] = rgb.map(toLinear) as Rgb;
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  const L = 0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s;
  const A = 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s;
  const B = 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s;
  const C = Math.hypot(A, B);
  const H = C < 1e-9 ? 0 : (Math.atan2(B, A) * 180) / Math.PI;
  return [L, C, (H + 360) % 360];
}

/** OKLCH vers sRGB linéaire NON borné : hors de [0, 1], la couleur n'existe pas à l'écran. */
function oklchToLinear(L: number, C: number, H: number): Rgb {
  const a = C * Math.cos((H * Math.PI) / 180);
  const b = C * Math.sin((H * Math.PI) / 180);
  const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s = (L - 0.0894841775 * a - 1.291485548 * b) ** 3;
  return [
    4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
  ];
}

export function oklchToRgb(L: number, C: number, H: number): Rgb {
  return oklchToLinear(L, C, H).map((c) => fromLinear(clamp01(c))) as Rgb;
}

/** La plus forte saturation ≤ `C` qui existe en sRGB à cette luminosité et cette teinte. */
function inGamut(L: number, C: number, H: number): Rgb {
  const fits = (c: number) => oklchToLinear(L, c, H).every((x) => x >= -1e-6 && x <= 1 + 1e-6);
  if (fits(C)) return oklchToRgb(L, C, H);
  let lo = 0;
  let hi = C;
  for (let i = 0; i < 24; i++) {
    const mid = (lo + hi) / 2;
    if (fits(mid)) lo = mid;
    else hi = mid;
  }
  return oklchToRgb(L, lo, H);
}

function clamp01(c: number): number {
  return Math.min(1, Math.max(0, c));
}

function round2(n: number): number {
  return Math.floor(n * 100) / 100;
}
