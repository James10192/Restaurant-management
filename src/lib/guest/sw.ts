import { useEffect } from "react";

/**
 * Cercle 1 du hors-ligne (A4) : la carte déjà vue reste lisible sans réseau. Le service
 * worker (`public/sw.js`) ne touche QUE la carte et ses fichiers ; l'application du personnel
 * n'est jamais servie depuis un cache.
 */
export function useServiceWorker() {
  useEffect(() => {
    if (!("serviceWorker" in navigator) || import.meta.env.DEV) return;
    void navigator.serviceWorker.register("/sw.js", { scope: "/" }).catch(() => {
      /* sans service worker, la carte fonctionne en ligne comme avant */
    });
  }, []);
}
