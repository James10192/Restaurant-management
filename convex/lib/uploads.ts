/**
 * Fichiers envoyés par le navigateur — Joliba
 *
 * Les identifiants de fichier viennent du navigateur : rien ne dit qu'ils désignent le fichier
 * qu'il vient d'envoyer. On n'accepte donc qu'un fichier RÉCENT, qui n'est ni le logo d'aucun
 * établissement (toutes organisations confondues, par index), ni la photo d'un plat de
 * l'organisation (D-154). Sinon on pourrait s'approprier, ou faire effacer par un refus ou un
 * remplacement, le fichier d'un autre, voire celui d'une carte en ligne.
 */

import type { Id } from "../_generated/dataModel";
import { invalid } from "./errors";
import type { ReadCtx, VenueActor } from "./guards";

/** Un fichier fraîchement envoyé : au-delà, ce n'est plus « celui qu'on vient de choisir ». */
export const FRESH_UPLOAD_MS = 60 * 60 * 1000;

export async function assertFreshUnusedFiles(ctx: ReadCtx, actor: VenueActor, ids: Id<"_storage">[]) {
  const now = Date.now();
  for (const id of ids) {
    const file = await ctx.db.system.get(id);
    if (!file || now - file._creationTime > FRESH_UPLOAD_MS) throw invalid("Ce fichier n'a pas été envoyé à l'instant. Choisissez-le à nouveau.");
  }
  // Le logo d'un établissement, dans N'IMPORTE QUELLE organisation : il est effacé quand on le
  // remplace, un autre ne doit jamais pouvoir le prendre puis le faire effacer.
  for (const id of ids) {
    const owner = await ctx.db
      .query("venueSettings")
      .withIndex("by_logo", (q) => q.eq("branding.logo.storageId", id))
      .first();
    if (owner) throw invalid("Ce fichier est déjà le logo d'un établissement.");
  }
  const venues = await ctx.db
    .query("venues")
    .withIndex("by_org", (q) => q.eq("organizationId", actor.organization._id))
    .collect();
  const wanted = new Set<string>(ids);
  for (const venue of venues) {
    const products = await ctx.db
      .query("products")
      .withIndex("by_venue_section_sort", (q) => q.eq("venueId", venue._id))
      .collect();
    for (const p of products) {
      if (p.images.some((image) => wanted.has(image.storageId) || wanted.has(image.thumbStorageId))) {
        throw invalid("Cette photo est déjà utilisée par un autre produit.");
      }
    }
  }
}
