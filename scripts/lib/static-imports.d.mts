/** Types de `static-imports.mjs`, pour que ses tests restent sous TypeScript strict. */
export function staticImports(asset: string, code: string): string[];
export function staticClosure(starts: Iterable<string>, read: (asset: string) => string): Set<string>;
