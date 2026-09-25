import { useState } from "react";
import { useMutation } from "convex/react";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { IMPORT_MAX_ROWS, rowsFromCsv, type ImportError, type ImportRow } from "../../../convex/lib/menuImport";
import { CircleAlert, CircleCheck, TriangleAlert, Upload } from "lucide-react";
import { FormField } from "~/components/app/form-field";
import { PendingButton } from "~/components/app/pending-button";
import {
  ResponsiveDialog,
  ResponsiveDialogContent,
  ResponsiveDialogDescription,
  ResponsiveDialogFooter,
  ResponsiveDialogHeader,
  ResponsiveDialogTitle,
} from "~/components/app/responsive-dialog";
import { Alert, AlertDescription, AlertTitle } from "~/components/ui/alert";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "~/components/ui/table";
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
    <ResponsiveDialog
      open={open}
      onOpenChange={(next) => {
        if (busy) return;
        if (!next) reset();
        onOpenChange(next);
      }}
    >
      <ResponsiveDialogContent className="sm:max-w-2xl">
        <ResponsiveDialogHeader>
          <ResponsiveDialogTitle>Importer un tableur</ResponsiveDialogTitle>
          <ResponsiveDialogDescription>
            Un fichier CSV, une ligne par produit. Colonnes : section, nom, prix — et, si vous voulez, description, allergènes, étiquettes.
            Les produits arrivent dans le brouillon : rien n'est visible des clients avant de publier.
          </ResponsiveDialogDescription>
        </ResponsiveDialogHeader>

        <div className="flex min-w-0 flex-col gap-4">
          <FormField
            label="Fichier"
            description={
              <>
                Exemple de première ligne : <code className="rounded bg-muted px-1 font-mono">section;nom;description;prix;allergènes</code>
                . Jusqu'à {IMPORT_MAX_ROWS} produits par fichier.
              </>
            }
          >
            <Input
              type="file"
              accept=".csv,text/csv"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) void read(file);
              }}
            />
          </FormField>

          {parsed ? (
            <div className="flex min-w-0 flex-col gap-3">
              <p className="text-sm font-medium" role="status">
                {parsed.file} : {parsed.rows.length} produit{parsed.rows.length > 1 ? "s" : ""} prêt{parsed.rows.length > 1 ? "s" : ""}
                {parsed.errors.length > 0 ? `, ${parsed.errors.length} ligne${parsed.errors.length > 1 ? "s" : ""} à corriger` : ""}.
              </p>
              {parsed.errors.length > 0 ? (
                <Alert>
                  <TriangleAlert />
                  <AlertTitle>Ces lignes ne seront pas importées</AlertTitle>
                  <AlertDescription>
                    <p>Corrigez-les dans le tableur, puis rechargez le fichier.</p>
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
                <div className="max-h-64 overflow-auto rounded-lg border">
                  <Table>
                    <TableHeader className="bg-muted/50">
                      <TableRow>
                        <TableHead className="w-16">Ligne</TableHead>
                        <TableHead>Section</TableHead>
                        <TableHead>Nom</TableHead>
                        <TableHead className="text-right">Prix</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {parsed.rows.slice(0, 100).map((row) => (
                        <TableRow key={row.line}>
                          <TableCell className="text-muted-foreground tabular-nums">{row.line}</TableCell>
                          <TableCell className="text-muted-foreground">{row.section}</TableCell>
                          <TableCell className="font-medium">{row.name}</TableCell>
                          <TableCell className="text-right tabular-nums">{formatPrice(row.price, currency)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              ) : null}
            </div>
          ) : null}

          {done ? (
            <Alert>
              <CircleCheck />
              <AlertTitle>Import terminé</AlertTitle>
              <AlertDescription>
                {done.products} produit{done.products > 1 ? "s" : ""} ajouté{done.products > 1 ? "s" : ""} au brouillon
                {done.sections > 0 ? `, dans ${done.sections} section${done.sections > 1 ? "s" : ""}` : ""}. Publiez la carte pour les
                montrer aux clients.
              </AlertDescription>
            </Alert>
          ) : null}
          {error ? (
            <Alert variant="destructive">
              <CircleAlert />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          ) : null}
        </div>

        <ResponsiveDialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={busy}>
            {done ? "Fermer" : "Annuler"}
          </Button>
          {parsed && parsed.rows.length > 0 ? (
            <PendingButton onClick={() => void submit()} pending={busy} pendingText="Import…">
              <Upload data-icon="inline-start" />
              Importer {parsed.rows.length} produit{parsed.rows.length > 1 ? "s" : ""}
            </PendingButton>
          ) : null}
        </ResponsiveDialogFooter>
      </ResponsiveDialogContent>
    </ResponsiveDialog>
  );
}
