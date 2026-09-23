#!/usr/bin/env node
/**
 * Fabrique la paire de clés des jetons d'opérateur (convex/lib/operatorJwt.ts).
 *
 *   node scripts/operator-keys.mjs            affiche les deux valeurs
 *   node scripts/operator-keys.mjs --apply    les pose sur le déploiement Convex courant
 *
 * La clé privée ne s'affiche que dans ce terminal et ne s'écrit dans aucun fichier.
 */
import { execFileSync } from "node:child_process";
import { webcrypto } from "node:crypto";

const { privateKey, publicKey } = await webcrypto.subtle.generateKey({ name: "ECDSA", namedCurve: "P-256" }, true, ["sign", "verify"]);
const kid = `op-${new Date().toISOString().slice(0, 10)}-${Math.random().toString(36).slice(2, 8)}`;
const priv = { ...(await webcrypto.subtle.exportKey("jwk", privateKey)), kid, alg: "ES256", use: "sig" };
const pub = await webcrypto.subtle.exportKey("jwk", publicKey);
const jwks = { keys: [{ kty: pub.kty, crv: pub.crv, x: pub.x, y: pub.y, kid, alg: "ES256", use: "sig" }] };

if (process.argv.includes("--apply")) {
  const run = (name, value) => execFileSync("pnpm", ["exec", "convex", "env", "set", name, value], { stdio: ["ignore", "ignore", "inherit"] });
  run("OPERATOR_JWT_PRIVATE_KEY", JSON.stringify(priv));
  run("OPERATOR_JWKS", JSON.stringify(jwks));
  console.log(`Clés posées (kid ${kid}). Redéployez pour que la configuration d'authentification les lise.`);
} else {
  console.log(`OPERATOR_JWT_PRIVATE_KEY=${JSON.stringify(priv)}`);
  console.log(`OPERATOR_JWKS=${JSON.stringify(jwks)}`);
}
