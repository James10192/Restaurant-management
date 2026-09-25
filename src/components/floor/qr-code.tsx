import { useMemo } from "react";
import { encode } from "uqr";

/**
 * Un QR en SVG vectoriel : net à toute taille d'impression, sans image intermédiaire.
 * Correction d'erreur « Q » (25 %) : un QR posé sur une table se tache, se raye et se plie.
 */
export function QrCode({ value, size, title }: { value: string; size: string; title: string }) {
  const { path, count } = useMemo(() => {
    const qr = encode(value, { ecc: "Q", border: 2 });
    let d = "";
    qr.data.forEach((row, y) => {
      row.forEach((dark, x) => {
        if (dark) d += `M${x} ${y}h1v1h-1z`;
      });
    });
    return { path: d, count: qr.size };
  }, [value]);
  // `data-qr-value` : la même information que le dessin, lisible par un test sans décodeur.
  // Noir sur blanc, et jamais les couleurs du thème : c'est le contraste que lisent les
  // téléphones, y compris quand l'interface passe en sombre. Seule exception aux jetons.
  return (
    <svg viewBox={`0 0 ${count} ${count}`} width={size} height={size} role="img" aria-label={title} shapeRendering="crispEdges" className="shrink-0" data-qr-value={value}>
      <rect width={count} height={count} fill="white" />
      <path d={path} fill="black" />
    </svg>
  );
}
