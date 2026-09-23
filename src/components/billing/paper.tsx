import { useEffect, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";

/**
 * La pièce papier : note de table (avant paiement, sans numéro) ou ticket (après, numéroté).
 *
 * Jamais « reçu » ni « facture » : ces mots désignent des pièces CERTIFIÉES par la DGI (D-024).
 * Toute pièce porte « Document interne — ne vaut pas reçu fiscal ». Mise en page pour 80 mm, sans
 * rien promettre du matériel (ARCHITECTURE.md §13) : c'est l'impression du navigateur.
 */

export type PaperLine = { name: string; quantity: number; amount: number; note?: string | null };

export type PaperDoc = {
  /** « Note — non payée », « Ticket T-2026-000001 », « Avoir AV-2026-000001 ». */
  title: string;
  duplicate?: boolean;
  seller: { name: string; legalName?: string; address?: string; taxId?: string; rccm?: string };
  tableNumber: string | null;
  at: number;
  timezone: string;
  lines: PaperLine[];
  totals: { label: string; amount: number; strong?: boolean }[];
  payments: { label: string; amount: number }[];
  servedBy?: string | null;
  notice: string;
};

export const BILL_NOTICE = "Document interne — ne vaut pas reçu fiscal";

function quantityLabel(q: number): string {
  if (Number.isInteger(q)) return String(q);
  if (Math.abs(q - 0.5) < 1e-9) return "½";
  return q.toLocaleString("fr-FR", { maximumFractionDigits: 2 });
}

export function Paper({ doc, money }: { doc: PaperDoc; money: (amount: number) => string }) {
  const when = new Intl.DateTimeFormat("fr-FR", { timeZone: doc.timezone, dateStyle: "short", timeStyle: "short" }).format(new Date(doc.at));
  return (
    <article className="mx-auto flex w-full max-w-[74mm] flex-col gap-2 bg-white p-2 font-mono text-[10pt] leading-snug text-black">
      <header className="flex flex-col items-center gap-0.5 text-center">
        <p className="text-[12pt] font-bold">{doc.seller.name}</p>
        {doc.seller.legalName ? <p>{doc.seller.legalName}</p> : null}
        {doc.seller.address ? <p>{doc.seller.address}</p> : null}
        {doc.seller.taxId ? <p>NCC {doc.seller.taxId}</p> : null}
        {doc.seller.rccm ? <p>RCCM {doc.seller.rccm}</p> : null}
      </header>
      <p className="border-y border-dashed border-black py-1 text-center font-bold">
        {doc.title}
        {doc.duplicate ? " — DUPLICATA" : ""}
      </p>
      <p>
        {when}
        {doc.tableNumber ? ` · Table ${doc.tableNumber}` : ""}
        {doc.servedBy ? ` · ${doc.servedBy}` : ""}
      </p>
      <ul className="flex flex-col gap-0.5">
        {doc.lines.map((l, i) => (
          <li key={i} className="flex justify-between gap-2">
            <span className="min-w-0">
              {quantityLabel(l.quantity)} × {l.name}
              {l.note ? <span className="block pl-3">{l.note}</span> : null}
            </span>
            <span className="shrink-0 tabular-nums">{money(l.amount)}</span>
          </li>
        ))}
      </ul>
      <dl className="flex flex-col gap-0.5 border-t border-dashed border-black pt-1">
        {doc.totals.map((t) => (
          <div key={t.label} className={t.strong ? "flex justify-between text-[12pt] font-bold" : "flex justify-between"}>
            <dt>{t.label}</dt>
            <dd className="tabular-nums">{money(t.amount)}</dd>
          </div>
        ))}
      </dl>
      {doc.payments.length > 0 ? (
        <dl className="flex flex-col gap-0.5 border-t border-dashed border-black pt-1">
          {doc.payments.map((p, i) => (
            <div key={i} className="flex justify-between">
              <dt>{p.label}</dt>
              <dd className="tabular-nums">{money(p.amount)}</dd>
            </div>
          ))}
        </dl>
      ) : null}
      <p className="border-t border-dashed border-black pt-1 text-center text-[8pt]">{doc.notice}</p>
    </article>
  );
}

/**
 * Imprime `doc` : la pièce est rendue hors de l'arbre de l'application, et seule elle part au
 * papier (voir `app.css`, `.joliba-print-root`). Rien ne s'imprime tant que `doc` est nul.
 */
export function PrintJob({ doc, money, onDone }: { doc: PaperDoc | null; money: (amount: number) => string; onDone: () => void }) {
  const [root, setRoot] = useState<HTMLElement | null>(null);
  useEffect(() => {
    const el = document.createElement("div");
    el.className = "joliba-print-root hidden print:block";
    document.body.appendChild(el);
    setRoot(el);
    return () => el.remove();
  }, []);
  useEffect(() => {
    if (!doc || !root) return;
    const done = () => {
      document.body.classList.remove("joliba-printing");
      window.removeEventListener("afterprint", done);
      onDone();
    };
    document.body.classList.add("joliba-printing");
    window.addEventListener("afterprint", done);
    // Laisse le portail se peindre avant d'ouvrir la boîte d'impression.
    const timer = window.setTimeout(() => window.print(), 50);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener("afterprint", done);
      document.body.classList.remove("joliba-printing");
    };
  }, [doc, root, onDone]);
  if (!root || !doc) return null;
  return createPortal(<Paper doc={doc} money={money} />, root);
}

export function PaperPreview({ children }: { children: ReactNode }) {
  return <div className="rounded-md border bg-white p-2 shadow-sm">{children}</div>;
}
