import { useEffect, useState } from "react";

/** L'heure, rafraîchie toutes les `everyMs` : les minutes d'attente avancent à l'écran sans requête. */
export function useMinuteClock(everyMs = 15_000): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), everyMs);
    return () => clearInterval(id);
  }, [everyMs]);
  return now;
}

/** « depuis 4 min », « à l'instant ». */
export function waitedLabel(ms: number, withSince = true): string {
  const minutes = Math.floor(Math.max(0, ms) / 60_000);
  if (minutes < 1) return "à l'instant";
  const text = minutes < 60 ? `${minutes} min` : `${Math.floor(minutes / 60)} h ${String(minutes % 60).padStart(2, "0")}`;
  return withSince ? `depuis ${text}` : text;
}

/** « 12:07 » pour un chronomètre de cuisine. */
export function elapsed(ms: number): string {
  const total = Math.floor(Math.max(0, ms) / 1000);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}
