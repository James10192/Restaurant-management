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
  return (
    <svg viewBox={`0 0 ${count} ${count}`} width={size} height={size} role="img" aria-label={title} shapeRendering="crispEdges" data-qr-value={value}>
      <rect width={count} height={count} fill="#fff" />
      <path d={path} fill="#000" />
    </svg>
  );
}
