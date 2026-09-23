// Faux serveur Resend pour les tests de bout en bout : écrit chaque e-mail reçu (une ligne
// JSON par e-mail) dans le fichier passé en argument. Écoute sur 127.0.0.1:4010.
import { createServer } from "node:http";
import { appendFileSync, writeFileSync } from "node:fs";
const out = process.argv[2];
writeFileSync(out, "");
createServer((req, res) => {
  let body = "";
  req.on("data", (c) => (body += c));
  req.on("end", () => {
    appendFileSync(out, body + "\n");
    res.writeHead(200, { "content-type": "application/json" });
    res.end(JSON.stringify({ id: "test" }));
  });
}).listen(4010, "127.0.0.1");
