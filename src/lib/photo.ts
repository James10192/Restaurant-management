/**
 * Réduction des photos AVANT l'envoi — Joliba
 *
 * Une photo de téléphone pèse 3 à 6 Mo ; la carte d'un client en 4G n'en veut pas. On la
 * réduit ici, dans le navigateur du restaurateur : une grande image (1280 px au plus long)
 * pour la fiche, et une vignette (256 px, ≤ 20 Ko) pour la liste — affichée à 112 px, elle
 * reste nette sur un écran de densité 2 (D-166). Le serveur vérifie ensuite la
 * signature du fichier et son poids (`convex/products.ts`, `imageProblem`) — cette étape ne
 * remplace pas le contrôle, elle évite d'envoyer des mégaoctets pour se les voir refuser.
 *
 * WebP d'abord ; JPEG si le navigateur ne sait pas encoder le WebP (anciens Safari).
 */

const FULL = { edge: 1280, maxBytes: 600_000 };
const THUMB = { edge: 256, maxBytes: 20_000 };
const QUALITIES = [0.82, 0.74, 0.66, 0.58, 0.5, 0.42];

export type ReducedPhoto = { full: Blob; thumb: Blob; width: number; height: number };

export class PhotoError extends Error {}

async function encode(canvas: HTMLCanvasElement, maxBytes: number): Promise<Blob> {
  for (const type of ["image/webp", "image/jpeg"]) {
    for (const quality of QUALITIES) {
      const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, type, quality));
      // Un navigateur qui ne sait pas encoder le type demandé renvoie du PNG : on passe au suivant.
      if (!blob || blob.type !== type) break;
      if (blob.size <= maxBytes) return blob;
    }
  }
  throw new PhotoError("Cette photo reste trop lourde une fois réduite. Essayez une photo moins détaillée.");
}

function draw(source: ImageBitmap, edge: number): HTMLCanvasElement {
  const scale = Math.min(1, edge / Math.max(source.width, source.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(source.width * scale));
  canvas.height = Math.max(1, Math.round(source.height * scale));
  const context = canvas.getContext("2d");
  if (!context) throw new PhotoError("Votre navigateur ne permet pas de préparer la photo.");
  context.imageSmoothingQuality = "high";
  context.drawImage(source, 0, 0, canvas.width, canvas.height);
  return canvas;
}

export async function reducePhoto(file: File): Promise<ReducedPhoto> {
  if (!/^image\/(jpeg|png|webp|heic|heif)$/.test(file.type)) {
    throw new PhotoError("Choisissez une photo (JPEG, PNG ou WebP).");
  }
  let bitmap: ImageBitmap;
  try {
    // `from-image` : la photo prise téléphone en main est redressée selon son orientation EXIF.
    bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
  } catch {
    throw new PhotoError("Cette photo n'a pas pu être lue. Enregistrez-la en JPEG, puis réessayez.");
  }
  try {
    if (Math.min(bitmap.width, bitmap.height) < 64) throw new PhotoError("Cette image est trop petite pour une carte.");
    const full = draw(bitmap, FULL.edge);
    return {
      full: await encode(full, FULL.maxBytes),
      thumb: await encode(draw(bitmap, THUMB.edge), THUMB.maxBytes),
      width: full.width,
      height: full.height,
    };
  } finally {
    bitmap.close();
  }
}

/**
 * Le logo de l'établissement (D-153) : 256 px au plus long, 20 Ko au plus, et sa TRANSPARENCE
 * gardée — WebP d'abord, PNG sinon, jamais JPEG (qui la perd). Un SVG est refusé : il peut porter
 * du script. Le serveur relit la signature et les dimensions (`convex/branding.ts`, `logoInfo`).
 */
export async function reduceLogo(file: File): Promise<Blob> {
  if (!/^image\/(jpeg|png|webp)$/.test(file.type)) {
    throw new PhotoError("Choisissez une image PNG, WebP ou JPEG. Le SVG n'est pas accepté.");
  }
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
  } catch {
    throw new PhotoError("Cette image n'a pas pu être lue. Enregistrez-la en PNG, puis réessayez.");
  }
  try {
    const canvas = draw(bitmap, 256);
    if (Math.min(canvas.width, canvas.height) < 16) throw new PhotoError("Ce logo est trop étroit : recadrez-le plus près du dessin.");
    for (const quality of QUALITIES) {
      const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/webp", quality));
      if (!blob || blob.type !== "image/webp") break;
      if (blob.size <= 20_000) return blob;
    }
    const png = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/png"));
    if (png && png.size <= 20_000) return png;
    throw new PhotoError("Ce logo reste trop lourd une fois réduit. Essayez une version plus simple, sur fond transparent.");
  } finally {
    bitmap.close();
  }
}

/** Dépose un fichier à l'adresse d'envoi Convex, renvoie son identifiant de stockage. */
export async function uploadBlob(url: string, blob: Blob): Promise<string> {
  const response = await fetch(url, { method: "POST", headers: { "Content-Type": blob.type }, body: blob });
  if (!response.ok) throw new PhotoError("L'envoi de la photo a échoué. Vérifiez la connexion, puis réessayez.");
  return ((await response.json()) as { storageId: string }).storageId;
}
