import { useState } from "react";
import { useMutation } from "convex/react";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { IMPORT_MAX_ROWS, rowsFromCsv, type ImportError, type ImportRow } from "../../../convex/lib/menuImport";
import { Alert, AlertDescription } from "~/components/ui/alert";
import { Button } from "~/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "~/components/ui/dialog";
import { describeError } from "~/lib/errors";
import { formatPrice } from "./shared";

const MAX_FILE_BYTES = 1_000_000;

/**
 * Import d'un tableur. L'aperçu relit le fichier avec les MÊMES règles que le serveur, ligne
 * par ligne, AVANT l'envoi : une erreur se corrige dans le tableur, pas après coup.
 */
export function ImportDialog({
  open,
  onOpenChange,
  venueId,
  menuId,
  currency,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  venueId: Id<"venues">;
  menuId: Id<"menus">;
  currency: string;
}) {
  const apply = useMutation(api.menuImport.apply);
  const [parsed, setParsed] = useState<{ file: string; rows: ImportRow[]; errors: ImportError[] } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<{ products: number; sections: number } | null>(null);

  function reset() {
    setParsed(null);
    setError(null);
    setDone(null);
  }

  async function read(file: File) {
    reset();
    if (file.size > MAX_FILE_BYTES) {
      setError("Ce fichier dépasse 1 Mo. Un fichier de carte pèse d'ordinaire quelques kilo-octets : vérifiez qu'il s'agit bien d'un CSV.");
      return;
    }
    const text = await file.text();
    setParsed({ file: file.name, ...rowsFromCsv(text, currency) });
  }

  async function submit() {
    if (!parsed || parsed.rows.length === 0) return;
    setBusy(true);
    setError(null);
    try {
      setDone(await apply({ venueId, menuId, rows: parsed.rows }));
      setParsed(null);
    } catch (e) {
      setError(describeError(e).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (busy) return;
        if (!next) reset();
        onOpenChange(next);
      }}
    >
      <DialogContent className="w-[min(720px,94vw)]" showCloseButton>
        <DialogHeader>
          <DialogTitle>Importer un tableur</DialogTitle>
          <DialogDescription>
            Un fichier CSV, une ligne par produit. Colonnes : section, nom, prix — et, si vous voulez, description,
            allergènes, étiquettes. Les produits arrivent dans le brouillon : rien n'est visible des clients avant de
            publier.
          </DialogDescription>
        </DialogHeader>

        <div className="mt-4 flex flex-col gap-4">
          <label className="flex flex-col gap-1.5 text-label text-ink">
            Fichier
            <input
              type="file"
              accept=".csv,text/csv"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) void read(file);
              }}
              className="text-body text-ink-2 file:mr-3 file:h-11 file:rounded-sm file:border file:border-line-control file:bg-surface file:px-4 file:text-label file:text-ink"
            />
          </label>
          <p className="text-label text-ink-3">
            Exemple de première ligne : <code className="rounded-xs bg-surface-2 px-1">section;nom;description;prix;allergènes</code>
            . Jusqu'à {IMPORT_MAX_ROWS} produits par fichier.
          </p>

          {parsed ? (
            <div className="flex flex-col gap-3">
              <p className="text-body text-ink" role="status">
                {parsed.file} : {parsed.rows.length} produit{parsed.rows.length > 1 ? "s" : ""} prêt{parsed.rows.length > 1 ? "s" : ""}
                {parsed.errors.length > 0 ? `, ${parsed.errors.length} ligne${parsed.errors.length > 1 ? "s" : ""} à corriger` : ""}.
              </p>
              {parsed.errors.length > 0 ? (
                <Alert variant="warning">
                  <AlertDescription>
                    <p className="mb-2">Ces lignes ne seront pas importées. Corrigez-les dans le tableur, puis rechargez le fichier.</p>
                    <ul className="max-h-40 list-disc overflow-y-auto pl-5">
                      {parsed.errors.slice(0, 50).map((e, i) => (
                        <li key={i}>
                          Ligne {e.line} : {e.message}
                        </li>
                      ))}
                    </ul>
                  </AlertDescription>
                </Alert>
              ) : null}
              {parsed.rows.length > 0 ? (
                <div className="max-h-64 overflow-auto rounded-sm border border-line">
                  <table className="w-full text-left text-label">
                    <thead className="sticky top-0 bg-surface-2 text-ink-2">
                      <tr>
                        <th className="px-3 py-2 font-medium">Ligne</th>
                        <th className="px-3 py-2 font-medium">Section</th>
                        <th className="px-3 py-2 font-medium">Nom</th>
                        <th className="px-3 py-2 text-right font-medium">Prix</th>
                      </tr>
                    </thead>
                    <tbody>
                      {parsed.rows.slice(0, 100).map((row) => (
                        <tr key={row.line} className="border-t border-line">
                          <td className="px-3 py-2 text-ink-3 tabular-nums">{row.line}</td>
                          <td className="px-3 py-2 text-ink-2">{row.section}</td>
                          <td className="px-3 py-2 text-ink">{row.name}</td>
                          <td className="px-3 py-2 text-right text-ink tabular-nums">{formatPrice(row.price, currency)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : null}
            </div>
          ) : null}

          {done ? (
            <Alert variant="success">
              <AlertDescription>
                {done.products} produit{done.products > 1 ? "s" : ""} ajouté{done.products > 1 ? "s" : ""} au brouillon
                {done.sections > 0 ? `, dans ${done.sections} section${done.sections > 1 ? "s" : ""}` : ""}. Publiez la carte
                pour les montrer aux clients.
              </AlertDescription>
            </Alert>
          ) : null}
          {error ? (
            <Alert variant="danger">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          ) : null}
        </div>

        <DialogFooter>
          <Button variant="quiet" onClick={() => onOpenChange(false)} disabled={busy}>
            {done ? "Fermer" : "Annuler"}
          </Button>
          {parsed && parsed.rows.length > 0 ? (
            <Button onClick={() => void submit()} loading={busy} loadingText="Import…">
              Importer {parsed.rows.length} produit{parsed.rows.length > 1 ? "s" : ""}
            </Button>
          ) : null}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
