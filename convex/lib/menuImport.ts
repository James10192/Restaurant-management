/**
 * Import de carte (CSV) — Joliba
 *
 * PUR et partagé : l'écran s'en sert pour l'aperçu (erreurs ligne par ligne AVANT d'envoyer),
 * le serveur le rejoue sur ce qu'il reçoit — on ne fait jamais confiance à un aperçu.
 *
 * Le format est celui qu'un restaurateur produit réellement : un tableur enregistré en CSV,
 * avec `;` comme séparateur quand le tableur est en français, des prix écrits « 2 500 F ».
 * Colonnes reconnues (casse et accents indifférents) :
 *
 *     section ; nom ; description ; prix ; allergènes ; étiquettes
 *
 * `section` et `nom` et `prix` sont obligatoires. Plusieurs allergènes ou étiquettes se
 * séparent par une virgule ou une barre verticale.
 */

import { ALLERGENS, isAllergen } from "./allergens";
import { currencyExponent, isSupportedCurrency } from "./money";

export const IMPORT_MAX_ROWS = 500;

export type ImportRow = {
  line: number;
  section: string;
  name: string;
  description?: string;
  price: number;
  allergens: string[];
  tags: string[];
};

export type ImportError = { line: number; message: string };

/** Lecture CSV (RFC 4180) : guillemets, guillemets doublés, retours à la ligne dans un champ. */
export function parseCsv(text: string): string[][] {
  const source = text.replace(/^\uFEFF/, "");
  const firstLine = source.split(/\r?\n/, 1)[0] ?? "";
  const delimiter = (firstLine.match(/;/g)?.length ?? 0) >= (firstLine.match(/,/g)?.length ?? 0) ? ";" : ",";
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;
  for (let i = 0; i < source.length; i++) {
    const c = source[i]!;
    if (quoted) {
      if (c === '"') {
        if (source[i + 1] === '"') {
          field += '"';
          i++;
        } else quoted = false;
      } else field += c;
    } else if (c === '"' && field === "") quoted = true;
    else if (c === delimiter) {
      row.push(field);
      field = "";
    } else if (c === "\n" || c === "\r") {
      if (c === "\r" && source[i + 1] === "\n") i++;
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else field += c;
  }
  if (field !== "" || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows.filter((r) => r.some((cell) => cell.trim() !== ""));
}

function normalizeHeader(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z]/g, "");
}

const HEADERS: Record<string, keyof Omit<ImportRow, "line">> = {
  section: "section",
  categorie: "section",
  rubrique: "section",
  nom: "name",
  produit: "name",
  plat: "name",
  description: "description",
  prix: "price",
  tarif: "price",
  allergenes: "allergens",
  etiquettes: "tags",
  tags: "tags",
};

/**
 * Un prix écrit par un humain, en unité mineure. « 2 500 F », « 2.500 », « 2500 FCFA »
 * → 2500 en XOF. Le franc CFA n'a pas de centimes : « 2 500,50 » est refusé plutôt
 * qu'arrondi en silence. Renvoie `null` si ce n'est pas un prix.
 */
export function parsePrice(raw: string, currency: string): number | null {
  if (!isSupportedCurrency(currency)) return null;
  const exponent = currencyExponent(currency);
  const text = raw
    .replace(/fcfa|cfa|xof|xaf|eur|€|\$|f\b|francs?/gi, "")
    .replace(/[\s\u00a0\u202f]/g, "");
  if (!/^\d[\d.,]*$/.test(text)) return null;
  // Séparateur décimal : le DERNIER « , » ou « . » suivi de 1 ou 2 chiffres en fin de chaîne.
  const decimal = text.match(/[.,](\d{1,2})$/);
  let whole = text;
  let fraction = "";
  if (decimal) {
    whole = text.slice(0, decimal.index);
    fraction = decimal[1]!;
  }
  if (!/^\d{1,3}([.,]?\d{3})*$/.test(whole) && !/^\d+$/.test(whole)) return null;
  const units = Number(whole.replace(/[.,]/g, ""));
  if (exponent === 0) {
    if (fraction !== "" && Number(fraction) !== 0) return null;
    return units;
  }
  return units * 10 ** exponent + Number(fraction.padEnd(exponent, "0").slice(0, exponent));
}

const ALLERGEN_BY_LABEL = new Map<string, string>(
  Object.entries(ALLERGENS).flatMap(([key, labels]) => [
    [normalizeHeader(key), key],
    [normalizeHeader(labels.fr), key],
    [normalizeHeader(labels.en), key],
  ]),
);

function splitList(value: string | undefined): string[] {
  return (value ?? "")
    .split(/[|,]/)
    .map((s) => s.trim())
    .filter(Boolean);
}

/** Du tableau brut aux lignes, avec les erreurs ligne par ligne (numérotées comme dans le tableur). */
export function rowsFromCsv(text: string, currency: string): { rows: ImportRow[]; errors: ImportError[] } {
  const table = parseCsv(text);
  const errors: ImportError[] = [];
  if (table.length === 0) return { rows: [], errors: [{ line: 1, message: "Le fichier est vide." }] };
  const header = table[0]!.map((h) => HEADERS[normalizeHeader(h)]);
  for (const required of ["section", "name", "price"] as const) {
    if (!header.includes(required)) {
      const label = { section: "section", name: "nom", price: "prix" }[required];
      errors.push({ line: 1, message: `Colonne « ${label} » introuvable sur la première ligne.` });
    }
  }
  if (errors.length > 0) return { rows: [], errors };
  if (table.length - 1 > IMPORT_MAX_ROWS) {
    return { rows: [], errors: [{ line: 1, message: `Pas plus de ${IMPORT_MAX_ROWS} produits par import.` }] };
  }
  const rows: ImportRow[] = [];
  for (let i = 1; i < table.length; i++) {
    const line = i + 1;
    const cells: Partial<Record<keyof Omit<ImportRow, "line">, string>> = {};
    table[i]!.forEach((cell, index) => {
      const key = header[index];
      if (key) cells[key] = cell.trim();
    });
    const errorsBefore = errors.length;
    const section = cells.section ?? "";
    const name = cells.name ?? "";
    if (!section) errors.push({ line, message: "Section manquante." });
    if (!name) errors.push({ line, message: "Nom manquant." });
    const price = parsePrice(cells.price ?? "", currency);
    if (price === null) {
      errors.push({
        line,
        message: `Prix illisible : « ${cells.price ?? ""} ».${currencyExponent(currency as never) === 0 ? " Le franc CFA n'a pas de centimes." : ""}`,
      });
    }
    const allergens: string[] = [];
    for (const label of splitList(cells.allergens)) {
      const key = ALLERGEN_BY_LABEL.get(normalizeHeader(label));
      if (!key || !isAllergen(key)) errors.push({ line, message: `Allergène inconnu : « ${label} ».` });
      else if (!allergens.includes(key)) allergens.push(key);
    }
    // Une ligne qui porte une seule erreur n'est pas importée à moitié : un allergène
    // illisible omis en silence ferait disparaître une information de sécurité.
    if (errors.length === errorsBefore && price !== null) {
      rows.push({
        line,
        section,
        name,
        ...(cells.description ? { description: cells.description } : {}),
        price,
        allergens,
        tags: splitList(cells.tags),
      });
    }
  }
  return { rows, errors };
}
