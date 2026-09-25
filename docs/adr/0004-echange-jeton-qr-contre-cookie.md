# ADR 0004 — Le scan échange le jeton contre un cookie, puis redirige sans secret

**Statut** : accepté · **Date** : 2026-09-17

## Contexte

Le QR collé sur une table est le point d'entrée du produit et sa première surface d'attaque. Deux
menaces réelles : la photographie du QR, qui circule ensuite sur WhatsApp ; et la fuite du jeton par
l'URL — historique du navigateur, partage, journaux serveur, outils d'analytique, en-tête `Referer`.

## Décision

Le jeton du QR **n'est jamais un identifiant de session**. Le scan l'échange contre une session
signée déposée en cookie `httpOnly`, `Secure`, `SameSite=Lax`, puis **redirige en 302 vers une URL
sans secret**.

## Conséquences

Le jeton disparaît de l'historique, du partage, des journaux, de l'analytique et du référent. C'est
la **seule** mesure qui supprime le problème ; toutes les autres (en-tête `noindex`,
`Referrer-Policy`, exclusion du sitemap, rotation) ne font que le limiter — elles restent en place,
par-dessus.

Conséquence contre-intuitive : **on ne met pas `Disallow: /r/` dans `robots.txt`**. Interdire
l'exploration empêcherait Google de *voir* le `noindex`, et l'URL pourrait être indexée sans extrait.

Ce que cela ne règle pas, et qu'on écrit : en mode `frictionless`, une photo de QR permet de
rejoindre une session ouverte. C'est un choix du restaurant parmi quatre modes, présenté avec sa
conséquence. On ne prétend pas que le mode le plus fluide est aussi le plus sûr.
