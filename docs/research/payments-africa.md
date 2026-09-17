# Paiements — Afrique francophone (Côte d'Ivoire d'abord)

> Étude préalable à la conception du module paiement du Restaurant OS.
> Cible n°1 : **Côte d'Ivoire**. Cibles suivantes : Sénégal, Bénin, Cameroun, Burkina, Mali, Togo.
> Internationalisation ensuite (zone EUR/USD, Nigeria, Maroc).
>
> **Date de consultation de toutes les sources : 2026-09-17.**
> Toutes les URL ci-dessous ont été consultées à cette date. Les tarifs, couvertures
> pays et règles fiscales bougent vite dans cette région : **toute donnée de ce document
> doit être revérifiée avant d'être engagée contractuellement.**

---

## 0. Comment lire ce document

Chaque affirmation factuelle porte un niveau de preuve :

| Marque | Signification |
|---|---|
| ✅ | **Vérifié** sur la documentation officielle du fournisseur ou un texte officiel, URL citée |
| ⚠️ | **Source secondaire** (presse spécialisée, blog d'intégrateur, agrégateur d'avis) — plausible, non officiel |
| ❌ | **Non vérifié — à confirmer** : je n'ai pas pu accéder à la source, ou aucune source publique trouvée |

**Trois sources n'ont pas pu être atteintes depuis l'environnement de recherche** et sont donc
citées uniquement via extraits de moteur de recherche, ce qui est signalé à chaque fois :

- `docs.cinetpay.com` — refusé par le proxy sortant (502 sur le CONNECT). Contourné par le
  SDK PHP officiel sur GitHub (✅) et par des extraits de recherche citant la doc (⚠️).
- `www.fne.dgi.gouv.ci` — échec de négociation TLS + HTTP 503. **C'est la source officielle
  ivoirienne sur la facture normalisée** ; son inaccessibilité est la principale limite de
  la section 7.
- `paystack.com/ci/pricing` — HTTP 403 (protection anti-bot). Contourné par le centre d'aide
  Paystack (✅) et des tiers (⚠️).

---

## 1. Moyens de paiement réels en restauration

### 1.1 Vue d'ensemble

Le point de départ n'est pas « quelle API brancher » mais **où l'argent change de main**.
En restauration ivoirienne, trois lieux d'encaissement coexistent et n'ont pas les mêmes
contraintes techniques :

| Lieu | Qui tient l'appareil | Contrainte dominante |
|---|---|---|
| **Comptoir / caisse** | le caissier | vitesse, file d'attente, rendu de monnaie |
| **En salle, à table** | le serveur, avec son téléphone | pas de TPE, réseau data instable, l'appareil appartient parfois au serveur |
| **En ligne** (click & collect, livraison) | le client, seul | pas de recours humain si ça échoue |

Cette distinction commande l'architecture : un paiement « à table » ne peut pas dépendre
d'une redirection navigateur sur le téléphone du **client**, alors qu'un paiement en ligne
le peut.

### 1.2 Espèces

Toujours le moyen dominant en restauration de rue et de quartier.

- ⚠️ La Côte d'Ivoire compte **environ 17,5 millions de comptes mobile money enregistrés**
  et un taux d'inclusion financière de **51 %** (Global Findex, cité par
  [Boldrails, *Best Payment Gateways in Côte d'Ivoire 2026*](https://boldrails.com/blog/best-payment-gateways-cote-divoire),
  publié le 11 juillet 2026). Un taux d'inclusion de 51 % signifie mécaniquement qu'une
  moitié de la clientèle potentielle paie en espèces.
- **Conséquence produit** : les espèces ne sont pas « l'absence de provider ». Elles doivent
  être un `PaymentProvider` à part entière (voir §5.8), sinon le domaine métier se remplit
  de `if (method === 'cash')` et la réconciliation de caisse devient un cas particulier.
- **Contraintes opérationnelles** : fonds de caisse, rendu de monnaie, écart de caisse en
  fin de service, et **arrondi** (voir §7.4).

### 1.3 Mobile Money — le cœur du sujet

✅ Les quatre émetteurs présents en Côte d'Ivoire et acceptés par les passerelles :
**Orange Money, MTN MoMo, Moov Money, Wave**
(liste confirmée côté Paystack pour la CI — *Wave, Orange, MTN* — dans
[Paystack, *Pay with Mobile Money*](https://support.paystack.com/en/articles/2128386) ;
et *Orange Money, MTN Mobile Money, Moov Money* dans
[mctaba, *Payment Methods Available on Paystack in Côte d'Ivoire*](https://www.mctaba.com/learn/paystack/payment-methods-available-on-paystack-in-cote-d-ivoire)).

> ⚠️ **Divergence de sources à lever** : le centre d'aide Paystack liste *Wave / Orange / MTN*
> pour la CI, un tiers liste *Orange / MTN / Moov*. Moov est donc incertain chez Paystack.
> À confirmer auprès du support avant de s'engager sur la couverture.

**Dynamique du marché** :

- ⚠️ Wave est arrivé en avril 2021 et a cassé les prix ; dans les deux mois suivant son
  lancement, la part de marché d'Orange aurait reculé de 8,7 % et celle de MTN de 1,7 %
  ([MicroSave, *Price Wars And Agent Motivation in Rural Areas of Côte d'Ivoire*](https://www.microsave.net/2022/05/24/price-wars-and-agent-motivation-in-rural-areas-of-cote-divoire/)).
- ⚠️ Orange Money reste le plus gros opérateur en nombre d'utilisateurs, MTN autour de 30 %
  ([mctaba](https://www.mctaba.com/learn/paystack/payment-methods-available-on-paystack-in-cote-d-ivoire)).
- ⚠️ Au T1 2026, le marché télécom ivoirien a pesé 351,2 milliards FCFA, tiré par le mobile
  money et la data — **mais les données de Wave ne sont pas incluses dans le jeu de données
  du régulateur** ([Capmad, T1 2026](https://www.capmad.com/post/driven-by-mobile-money-cote-divoires-telecom-market-reaches-351-billion-cfa-francs-in-q1-2026)).
  C'est une limite importante : les statistiques officielles ARTCI **sous-estiment
  structurellement** le poids réel de Wave, parce que Wave n'est pas un opérateur télécom.
- ⚠️ À l'échelle mondiale, les **paiements marchands sont le cas d'usage qui croît le plus
  vite (+42 %, 155 Md$)** et dépassent désormais les décaissements en masse ; l'Afrique de
  l'Ouest a progressé de 34 % pour approcher 500 Md$ de valeur transigée en 2025
  ([GSMA, *State of the Industry Report on Mobile Money 2026*](https://www.gsma.com/sotir/),
  chiffres relayés par [Connecting Africa](https://www.connectingafrica.com/mobile-money/-1-4t-flowed-through-mobile-money-in-sub-saharan-africa-in-2025-gsma)).
  ⚠️ Attention : les 155 Md$ sont un **total mondial**, pas ouest-africain.

**Contraintes opérationnelles propres au mobile money**, qui pèsent lourd en salle :

1. **Le paiement est asynchrone et confirmé côté client.** Le client reçoit une invite
   (USSD, notification, ou bascule vers l'app) et tape son code. ✅ Paystack décrit le flux :
   *« they will receive a prompt on the mobile device attached to their number. The prompt
   will ask them to confirm the payment via an OTP sent to the device »*, et pour Wave
   *« Click on "Open Wave app" → This will automatically redirect you to your Wave app »*
   ([Paystack](https://support.paystack.com/en/articles/2128386)).
   → **L'addition ne peut pas être clôturée de façon synchrone.** Le serveur encaisse,
   puis attend. Le produit doit gérer un état d'attente visible en salle.
2. **Le remboursement n'est pas garanti au niveau du rail.** ✅ Wave (CGU) :
   *« cancellation of that transfer and/or a refund of a previously settled mobile money
   transfer will not be possible »* ([Wave, Terms](https://www.wave.com/en/terms_gm/)).
   ⚠️ Orange Money : un transfert validé ne peut plus être annulé, seul le **destinataire**
   peut rembourser ([Orange Money Europe, aide](https://www.orangemoney.eu/en-help)).
   → **Mais** l'API marchande de Wave expose bien un remboursement marchand
   (`POST /v1/checkout/sessions/:id/refund`, ✅ [docs.wave.com/checkout](https://docs.wave.com/checkout)).
   Ne pas confondre *annulation d'un transfert P2P* (impossible) et *remboursement d'un
   encaissement marchand* (possible, selon le provider). Cette distinction doit être portée
   par les **capabilities** du provider (§5.3), pas supposée.
3. **Pas de paiement récurrent.** ✅ *« It's currently not possible for customers to make
   recurring payments with the Pay with Mobile Money payment channel »*
   ([Paystack](https://support.paystack.com/en/articles/2128386)).
   → Aucun « compte client à débiter automatiquement », pas de tokenisation mobile money.
4. **Le QR au comptoir est le mode d'encaissement réel le plus répandu** pour les petits
   commerces, parce qu'il ne demande qu'un smartphone
   (⚠️ [kkiapay, *Encaisser par QR code mobile money*](https://kkiapay.me/encaisser-qr-code-mobile-money/)).

### 1.4 Cartes bancaires

- ⚠️ Le réseau interbancaire régional **GIM-UEMOA** est opérationnel depuis le 15 juin 2007 ;
  il place et maintient les TPE interbancaires chez les commerçants accepteurs
  ([GIM-UEMOA, FAQ](https://www.gim-uemoa.org/fr/faq)).
- ⚠️ L'ordre de grandeur cité par GIM-UEMOA est d'environ **3 000 DAB/GAB et 2 000 commerces
  agréés** sur toute la zone UEMOA ([GTBank CI](https://www.gtbankci.com/personal-banking/cards/gim-uemoa-mastercard/gim-uemoa-mastercard)).
  2 000 commerces acceptant la carte **sur huit pays** : l'acceptation carte physique en
  restauration est marginale hors hôtellerie et restauration haut de gamme d'Abidjan.
- ✅ Coût : Paystack facture **3,2 % carte locale / 3,8 % carte internationale** en CI
  (⚠️ chiffres relayés par [mctaba](https://www.mctaba.com/learn/paystack/payment-methods-available-on-paystack-in-cote-d-ivoire) —
  la page officielle `paystack.com/ci/pricing` étant inaccessible, 403). Soit **~2 à 3 fois
  le coût du mobile money**.
- ⚠️ Djamo émet des cartes Visa prépayées grand public utilisables en TPE
  ([Djamo](https://www.djamo.com/ci/apprendre/comment-payer-via-un-tpe-avec-sa-carte-djamo/)),
  ce qui élargit le parc de porteurs — mais côté acceptation, ❌ **aucune API marchande
  publique Djamo trouvée**.

**Conclusion carte** : à traiter comme un moyen **secondaire mais non optionnel** (clientèle
expatriée, hôtels, notes de frais, livraison en ligne), jamais comme le rail principal.

### 1.5 TPE bancaire externe (hors du système)

Cas très fréquent et souvent oublié à la conception : le restaurant possède déjà un TPE de
sa banque, **non connecté** au logiciel de caisse. Le caissier tape le montant à la main sur
le TPE, puis enregistre « payé par carte » dans le logiciel.

→ Le produit doit modéliser un moyen de paiement **« hors ligne / attesté »** :
montant saisi, référence de ticket TPE optionnelle, **aucune vérification automatique
possible**. C'est une source d'écart de caisse majeure (§11.2) et cela impose que le
`PaymentProvider` sache déclarer `verifiable: false`.

### 1.6 Virement bancaire

Usage réel : facturation d'entreprises (séminaires, cantine d'entreprise, traiteur), pas le
service quotidien.

- ✅ Hub2 expose le virement bancaire mais *« requires KYB (Know Your Business) registration »*
  ([docs.hub2.io](https://docs.hub2.io/integration/en/payments/payments_integration)).
- Rapprochement manuel ou semi-automatique, délai J+1 à J+3. À traiter comme un
  encaissement **différé** rattaché à une facture, pas à une addition de service.

### 1.7 Synthèse — priorité d'implémentation

| Rang | Moyen | Pourquoi |
|---|---|---|
| 1 | **Espèces** | Toujours majoritaire, et c'est ce qui rend l'abstraction honnête |
| 2 | **Mobile Money** (Wave, Orange, MTN, Moov) | Le vrai rail électronique, coût 1–2 % |
| 3 | **TPE externe attesté** | Existe déjà chez le client, zéro intégration, fort risque d'écart |
| 4 | **Carte via PSP** (en ligne + éventuellement en salle) | Clientèle spécifique, coût 3–4 % |
| 5 | **Virement** | B2B, différé |

---

## 2. Contexte réglementaire — ce qui contraint le choix du PSP

Cette section n'était pas demandée explicitement, mais **elle change la recommandation** :
en zone UEMOA on ne choisit pas un PSP seulement sur ses tarifs et sa doc.

### 2.1 Agrément obligatoire (BCEAO)

- ✅ **Instruction n°001-01-2024 du 23 janvier 2024** relative aux services de paiement dans
  l'UMOA ([texte BCEAO, PDF](https://www.bceao.int/sites/default/files/inline-files/Instruction-No001-01-2024_relative_aux_services_de_paiement_dans_l-UMOA.pdf)).
- ⚠️ **Depuis le 1er mai 2025, offrir des services de paiement dans l'Union sans agrément est
  illégal** ([finself.ci](https://finself.ci/demande-d-agrement-prestataire-de-service-de-paiement/)).
- ✅ Au **28 février 2026**, la BCEAO a agréé 31 nouveaux établissements dont **9 en Côte
  d'Ivoire** : *SYCA, TOUCHPOINT Financial Services, FIRSTCOM Global Payments, JULAYA Côte
  d'Ivoire, DJAMO Côte d'Ivoire, FEEXPAY Côte d'Ivoire, CINETPAY AFRICA, PAYMETRUST Côte
  d'Ivoire, DUNYA Digital Payment Côte d'Ivoire*
  ([Direction Générale du Trésor et de la Comptabilité Publique, Côte d'Ivoire](https://tresor.gouv.ci/tres/espace-uemoa-monnaie-electronique-la-bceao-agree-31-nouveaux-etablissements-dont-09-en-cote-divoire/)).

> **Conséquence directe** : ni PayDunya, ni Hub2, ni Semoa, ni Paystack ne figurent sur cette
> liste d'**établissements de paiement ivoiriens**. Cela ne signifie pas qu'ils opèrent
> illégalement — ils peuvent opérer sous un autre statut, dans un autre pays, ou via un
> partenaire agréé — mais ❌ **le statut réglementaire exact de chaque PSP en Côte d'Ivoire
> reste à vérifier au cas par cas avant contractualisation.** C'est une question à poser par
> écrit à chaque fournisseur.

### 2.2 PI-SPI : interopérabilité obligatoire au 30 juin 2026

- ✅ La BCEAO a lancé officiellement la **Plateforme Interopérable du Système de Paiement
  Instantané (PI-SPI)** le **30 septembre 2025**
  ([BCEAO](https://www.bceao.int/fr/content/lancement-officiel-de-la-plateforme-interoperable-du-systeme-de-paiement-instantane-pi-spi)).
- ✅ **Au plus tard le 30 juin 2026**, tous les établissements (banques, EME, établissements
  de paiement, SFD) doivent être connectés à PI-SPI
  ([communiqué BCEAO](https://www.bceao.int/fr/communique-presse/connexion-la-plateforme-interoperable-du-systeme-de-paiement-instantane-pi-spi-de) ;
  relayé par [Agence Ecofin](https://www.agenceecofin.com/actualites-finance/0304-137266-uemoa-l-interoperabilite-des-paiements-devient-obligatoire-au-30-juin-2026)).
- ⚠️ Au 2 avril 2026, 80 participants étaient connectés (59 banques, 9 EME, 11 SFD,
  **1 seul établissement de paiement**).

**Ce que ça veut dire pour le produit** : à terme, l'interopérabilité pourrait réduire la
valeur d'un agrégateur multi-rails, puisqu'un seul point d'entrée pourrait toucher tous les
émetteurs. **Ce n'est pas encore le cas aujourd'hui**, mais c'est un argument fort pour que
l'architecture reste capable de **remplacer un provider sans toucher au domaine** (§5) :
le paysage va bouger dans les 12 mois.

---

## 3. Agrégateurs / PSP à considérer

### 3.1 CinetPay 🇨🇮

Abidjan. Le plus installé de l'écosystème ivoirien.

- **Couverture** ✅ (SDK PHP officiel) : Afrique de l'Ouest — Côte d'Ivoire, Burkina, Mali,
  Sénégal, Togo, Bénin, Niger (XOF) ; Afrique centrale — Cameroun, Tchad, Congo, Gabon, RDC
  (XAF/CDF) ; plus Guinée (GNF), Guinée équatoriale, RCA
  ([README cinetpay-php-sdk](https://github.com/cinetpay/cinetpay-php-sdk/blob/master/README.md)).
- **Endpoints** ✅ : sandbox `https://api.cinetpay.net`, production `https://api.cinetpay.co`
  (même source).
- **Moyens** : mobile money multi-opérateurs (canaux nommés `OM_CI`, `OM_SN`, `MTN_CM`…),
  cartes, wallets. Le paramètre `channels` permet de restreindre l'univers affiché
  (⚠️ [docs.cinetpay.com/api/1.0-fr/checkout/initialisation](https://docs.cinetpay.com/api/1.0-fr/checkout/initialisation),
  lu via extraits de recherche, domaine bloqué par le proxy).
- **Contraintes de montant** ⚠️ — **très importantes pour la conception** :
  minimums **100 XOF, 100 XAF, 1000 GNF, 1 USD, 100 CDF** ; et **le montant doit être un
  multiple de 5**, sauf en USD, *« les montants ne respectant pas cette condition sont
  arrondis au multiple de 5 inférieur »* (même source).
  → Le provider **modifie le montant**. Cela impose de distinguer `montant demandé` et
  `montant réellement encaissé` dans le modèle (§7.4).
- **Webhooks** ✅ : notification signée par un **HMAC-SHA256 dans l'en-tête `x-token`**,
  calculé sur la concaténation ordonnée de `cpm_site_id + cpm_trans_id + cpm_trans_date +
  cpm_amount + cpm_currency + signature + payment_method + cel_phone_num + cpm_phone_prefixe
  + cpm_language + cpm_version + cpm_payment_config + cpm_page_action + cpm_custom +
  cpm_designation + cpm_error_message`
  (⚠️ [docs HMAC](https://docs.cinetpay.com/api/1.0-en/checkout/hmac), via extraits).
  ⚠️ **Signature sur une concaténation non délimitée** : c'est un schéma fragile
  (ambiguïté de concaténation), et il n'y a **pas d'horodatage signé** → pas de protection
  anti-rejeu native. À compenser côté applicatif (§6.3).
- **Doctrine officielle du fournisseur** ✅ et excellente :
  *« A webhook is only a signal inviting your backend to verify a transaction »*
  ([README SDK](https://github.com/cinetpay/cinetpay-php-sdk/blob/master/README.md)).
  Le SDK recommande `hash_equals()` pour comparer le token, une requête de vérification
  directe, et une **déduplication par `transaction_id`**. C'est exactement le modèle
  retenu en §6.
- **SDK** ✅ : PHP, Android, iOS, JS/TS, Go, Flutter ([github.com/cinetpay](https://github.com/cinetpay)).
- **Sandbox** ✅ (domaine `api.cinetpay.net` dédié).
- **Agrément** ✅ : **CINETPAY AFRICA** figure parmi les 9 établissements de paiement agréés
  en Côte d'Ivoire ([Trésor CI](https://tresor.gouv.ci/tres/espace-uemoa-monnaie-electronique-la-bceao-agree-31-nouveaux-etablissements-dont-09-en-cote-divoire/)).
- **Frais** ❌ **non publics.** La page produit annonce l'absence de frais mensuels et une
  facturation à la commission, avec des tarifs dégressifs sur devis
  ([cinetpay.com](https://cinetpay.com/products/payments), page renvoyant 403 en accès direct).
  ⚠️ Un tiers estime « ~2,5 %+ » ([Boldrails](https://boldrails.com/blog/best-payment-gateways-cote-divoire)) —
  **à traiter comme une estimation, pas un tarif**.
- **Règlement** ⚠️ : « sous 24 h après demande depuis le back-office marchand » selon le site ;
  un tiers indique ~24 à 72 h ([Boldrails](https://boldrails.com/blog/best-payment-gateways-cote-divoire)).

> ### ⚠️ Risque de contrepartie à documenter — incident de règlement 2025/2026
>
> Ce point ne relève pas de la technique mais **conditionne le choix**, parce qu'un
> restaurant vit sur sa trésorerie quotidienne.
>
> - ✅ En **septembre 2025**, CinetPay a subi une **cyberattaque coordonnée** touchant ses
>   opérations en Côte d'Ivoire, au Togo et au Burkina Faso. Le DG Daniel Dindji le confirme
>   publiquement : *« En septembre 2025, CinetPay a été la cible d'une cyberattaque coordonnée
>   affectant nos opérations en Côte d'Ivoire, au Togo et au Burkina Faso »*, avec
>   *« un impact ponctuel sur notre trésorerie, entraînant des retards de reversement auprès
>   de certains partenaires marchands »*
>   ([Financial Afrik, entretien du 25 mars 2026](https://www.financialafrik.com/2026/03/25/entretien-exclusif-avec-daniel-dindji-directeur-general-de-cinetpay/)).
> - ⚠️ Selon TechCabal (1er février 2026), l'arriéré dépassait **1 M$**, dont plus de
>   **655 millions FCFA (~1,2 M$) dus au seul partenaire DPay**, avec mises en demeure en
>   novembre puis le 18 décembre 2025, et **aucun remboursement effectif à la date de
>   l'article** ([TechCabal](https://techcabal.com/2026/02/01/cinetpay-cyberattack/)).
> - ✅ **Position de CinetPay (mars 2026)** : *« la grande majorité des partenaires impactés a
>   déjà été remboursée »*, plan de remboursement structuré en cours pour le reste, audit
>   indépendant (Capvalue), cloisonnement des trésoreries par pays, détection de fraude temps
>   réel, MFA, certification ISO 27001 et renouvellement PCI-DSS, budget sécurité triplé
>   ([Financial Afrik](https://www.financialafrik.com/2026/03/25/entretien-exclusif-avec-daniel-dindji-directeur-general-de-cinetpay/)).
>
> **Lecture honnête** : l'incident est avéré et reconnu par l'entreprise ; l'ampleur exacte et
> l'état final du remboursement reposent sur des déclarations contradictoires (DPay vs
> CinetPay) et ❌ **n'ont pas pu être vérifiés de façon indépendante**. CinetPay reste
> opérationnel, agréé, et techniquement le mieux couvert de la liste.
> La conclusion produit n'est pas « éliminer CinetPay », c'est :
> **ne pas faire reposer 100 % de l'encaissement d'un restaurant sur un seul PSP**, et
> **surveiller activement le délai de reversement** (§6.7 — la réconciliation sert aussi à ça).

### 3.2 Wave 🇸🇳🇨🇮

- **Couverture** ⚠️ : Sénégal, Côte d'Ivoire, Ouganda, Mali, Burkina Faso, Gambie
  ([API Evangelist](https://github.com/api-evangelist/wave-mobile-money)).
- **Moyens** : **Wave uniquement** (rail propriétaire). Pas de carte, pas d'Orange/MTN/Moov.
- **Checkout API** ✅ — `POST https://api.wave.com/v1/checkout/sessions`
  ([docs.wave.com/checkout](https://docs.wave.com/checkout)) :
  - requis : `amount` (string), `currency` (ISO 4217 3 lettres), `success_url`, `error_url` ;
  - optionnels : `client_reference` (≤ 255 car., *« A unique string which can be used to
    correlate the checkout session and subsequent payment with your system »*),
    `restrict_payer_mobile` (verrouille la session sur un numéro Wave donné),
    `aggregated_merchant_id` ;
  - **expiration par défaut : 30 minutes** ; endpoint d'expiration manuelle
    `POST /v1/checkout/sessions/:id/expire`.
- **Remboursement** ✅ — `POST /v1/checkout/sessions/:id/refund`, **idempotent par
  construction** : *« If you try to refund a checkout twice, no additional transaction will
  be created »* (même source). C'est la garantie la plus explicite trouvée sur tout le panel.
- **Webhooks signés** ✅ — la meilleure documentation de la région
  ([docs.wave.com/webhook](https://docs.wave.com/webhook)) :
  - événements : `checkout.session.completed`, `checkout.session.payment_failed`,
    `b2b.payment_received`, `b2b.payment_failed`, `merchant.payment_received`,
    `test.test_event` ;
  - en-tête **`Wave-Signature`**, format `t=<timestamp>,v1=<hmac>` — plusieurs `v1`
    possibles pendant une rotation de clé ;
  - **HMAC-SHA256 sur `timestamp + body brut`** :
    `hash_hmac("sha256", $timestamp . $webhook_body, $wave_webhook_secret)` ;
  - rejeu : rejeter au-delà de **5 minutes** ;
  - **retries jusqu'à 3 jours** si l'endpoint ne répond pas 2xx ;
  - ✅ **déduplication explicitement documentée** : utiliser le champ `id` de l'événement,
    *« Wave may send the same event multiple times due to network issues or retries »*.
  - ⚠️ Attention documentée : utiliser le **corps brut**, ne jamais re-sérialiser le JSON.
- **Sandbox** ❌ — **aucun environnement de test documenté** dans la référence API. Il existe
  un `test.test_event` pour valider l'endpoint webhook, ce qui n'est pas un sandbox.
  C'est la principale faiblesse d'intégration de Wave.
- **Frais marchand** ⚠️ : **~1 %** sur encaissement par QR, gratuit pour le client, contre
  1,5–2,5 % chez les opérateurs télécom ([Boldrails](https://boldrails.com/blog/orange-money-vs-wave) ;
  [iambeezy](https://blog.iambeezy.app/fr/recevoir-paiement-wave-cote-ivoire-2026/)).
  ✅ La grille officielle publiée par Wave CI est une **grille de commissionnement des agents**
  par paliers journaliers, pas un tarif marchand
  ([wave.com, Commissions Wave Côte d'Ivoire](https://www.wave.com/2022/05/commission_sf_wave_ci.html)) —
  donc **le 1 % marchand n'est pas confirmé par une source officielle Wave** et doit être
  contractualisé par écrit.
- **Prérequis** ⚠️ : entités juridiques **distinctes par pays**, clés API distinctes,
  onboarding distinct — *une clé Sénégal ne fonctionne pas en Côte d'Ivoire* ; onboarding
  annoncé à 3–14 jours, clé `secret_xxx` récupérée au dashboard
  ([Kolonell](https://kolonell.com/en/blog/wave-business-api-integration-guide-2026-en)).
  Justificatif d'activité (registre de commerce) requis pour passer en compte Business.
- ⚠️ Wave Digital Finance serait le premier fintech à obtenir une **licence EME** de la BCEAO
  pour la zone ([Boldrails](https://boldrails.com/blog/best-payment-gateways-cote-divoire)) — ❌ à confirmer sur source BCEAO.

### 3.3 Paystack 🇳🇬 (groupe Stripe)

- **Couverture** ⚠️ : Nigeria, Afrique du Sud, Ghana, Kenya, **Côte d'Ivoire**
  ([Paystack, Countries](https://paystack.com/countries)) ; expansion annoncée en mai 2025
  vers Côte d'Ivoire, Égypte et Rwanda **en accès anticipé / bêta privée**
  ([Paystack Blog](https://paystack.com/blog/company-news/civ-rwanda-egypt-beta)).
  ❌ **Statut GA exact en Côte d'Ivoire à confirmer** (bêta vs disponibilité générale) —
  c'est la question bloquante avant de le choisir comme rail n°1.
  ✅ Le Virtual Terminal a été étendu à la Côte d'Ivoire ([Paystack Blog](https://paystack.com/blog/product/virtual-terminal-expansion)),
  ce qui indique une activité produit réelle sur le marché.
  **Sénégal : non listé.**
- **Moyens** ✅ : mobile money (**Wave, Orange, MTN** en CI), cartes Visa/Mastercard
  ([Paystack](https://support.paystack.com/en/articles/2128386)).
- **Frais** ⚠️ : **1,95 % mobile money** ✅ (*« The charge per transaction via this channel is
  1.95 % »*, [Paystack](https://support.paystack.com/en/articles/2128386)) ;
  **3,2 % carte locale / 3,8 % carte internationale** ⚠️
  ([mctaba](https://www.mctaba.com/learn/paystack/payment-methods-available-on-paystack-in-cote-d-ivoire)).
- **Règlement** ⚠️ : **J+1 ouvré** automatique vers le compte bancaire ivoirien, en XOF.
- **Doc développeur** ✅ : la meilleure de la liste (référence API publique, webhooks signés,
  clés test/live, SDK nombreux) — [paystack.com/docs](https://paystack.com/docs/api/).
- **Prérequis** ⚠️ : immatriculation **RCCM**, **numéro de contribuable DGI**, KYC
  ([mctaba](https://www.mctaba.com/learn/paystack/payment-methods-available-on-paystack-in-cote-d-ivoire)).
- **Agrément CI** ❌ : Paystack **ne figure pas** dans la liste des 9 établissements de
  paiement agréés en CI (§2.1). À éclaircir.

### 3.4 Stripe — **à écarter pour l'Afrique de l'Ouest**

- ⚠️ **Stripe n'opère pas directement en Afrique.** Les services de marque Stripe passent par
  l'infrastructure Paystack au Ghana, Kenya, Nigeria, Afrique du Sud et Côte d'Ivoire
  ([ngwaspenn](https://ngwaspenn.com/stripe-supported-countries-africa/) ;
  [Dodo Payments](https://dodopayments.com/blogs/stripe-supported-countries-alternatives)).
- ⚠️ Point à ne pas confondre : *« Using Paystack in Nigeria is not the same as having a
  Stripe account »* — dashboard, API, tarifs et onboarding distincts.
- ✅ Stripe reste **pertinent comme référence de conception** (§5, §7) et pour une
  internationalisation ultérieure hors Afrique ([stripe.com/global](https://stripe.com/global)).

### 3.5 Hub2 🇨🇮 — le meilleur modèle d'API régional

- **Couverture** ⚠️ : Bénin, Burkina, Cameroun, Côte d'Ivoire, Guinée, Mali, Niger, Sénégal,
  Togo — **9 pays**, XOF/XAF/USD/EUR ([hub2.io](https://www.hub2.io/fr/international-money-transfer-api/)).
  **C'est la meilleure correspondance avec la feuille de route pays du produit.**
- **Modèle** ✅ — `PaymentIntent`, calqué sur Stripe
  ([docs.hub2.io](https://docs.hub2.io/integration/en/payments/payments_integration)) :
  1. `POST https://api.hub2.io/payment-intents`
  2. `POST https://api.hub2.io/payment-intents/{id}/payments`
  3. authentification client optionnelle (OTP)
  4. traitement chez l'opérateur
  5. `GET https://api.hub2.io/payments/{id}/status`
- **Séparation intent / tentative** ✅ : c'est exactement la structure dont un OS restaurant a
  besoin — **une addition peut avoir plusieurs tentatives de paiement** (code refusé, solde
  insuffisant, client qui recommence) sans dupliquer l'encaissement.
- **Auth** ✅ : en-têtes `ApiKey`, `MerchantId`, **`Environment`** → **sandbox documenté**.
- **Webhooks** ✅ recommandés (*« Register to `payment` or `payment_intents` related events »*),
  polling possible mais **rate-limité (HTTP 429)**.
  ❌ **Signature des webhooks non documentée** dans la page consultée — à vérifier.
- **Contrainte** ✅ : caractères autorisés dans les références —
  *« letters, numbers, hyphen, underscore, dot and space »*.
- **Frais** ❌ non publics.

### 3.6 PayDunya 🇸🇳

- **Couverture** ⚠️ : Bénin, Burkina, Côte d'Ivoire, Mali, Sénégal, Togo — **6 pays UEMOA**
  ([Pandore](https://pandore.co/en/paiement-en-ligne-uemoa-les-meilleures-solutions-en-2025/)).
- **APIs** ✅ documentées et variées : paiement HTTP/JSON, **PSR** (paiement sans redirection),
  **DMP** (demande de paiement par SMS/e-mail), **SOFTPAY** (carte, *réservé aux entreprises
  certifiées PCI-DSS*), PUSH/déboursement, AIRTIME
  ([developers.paydunya.com](https://developers.paydunya.com/)).
  ✅ Le **PSR** est intéressant pour la salle : pas de redirection navigateur.
- **Sandbox** ✅ (clés de test documentées).
- **Frais** ❌ **non extractibles** : la page tarifs officielle affiche la grille **sous forme
  d'image** (`new-fees-sept-2026.png`), illisible en texte
  ([paydunya.com/service-fees](https://paydunya.com/service-fees)). Elle indique seulement
  *« Pas de frais d'abonnement ni d'installation requis »* et une offre sur mesure au-delà de
  100 000 000 FCFA de flux mensuel.
  ⚠️ Estimations tierces : 1,5 % à 3 % selon pays et volume
  ([Pandore](https://pandore.co/en/les-frais-de-transactions-de-5-fintechs-en-afrique/)).
- **Agrément CI** ❌ non vérifié.

### 3.7 Flutterwave 🇳🇬

- **Mobile money francophone** ✅ : `POST https://api.flutterwave.com/v3/charges?type=mobile_money_franco`,
  champs requis `tx_ref`, `amount` (**≥ 100**), `currency` (**XOF ou XAF uniquement**),
  `email`, `phone_number` ; réponse initiale `pending` avec
  `meta.authorization.mode = "redirecturl"`
  ([developer.flutterwave.com](https://developer.flutterwave.com/v3.0/reference/charge-via-francophone-mobile-money)).
- **Couverture francophone** ✅ : *« supports payment from Cameroon, Cote d'Ivoire, Mali and
  Senegal »*, le champ `country` mentionnant aussi BF (même source). Couverture plus étroite
  que CinetPay ou Hub2 sur la zone.
- **Frais** ⚠️ : 2,6 %–4,8 % sur carte en ligne selon pays
  ([bilixe](https://bilixe.com/listing/flutterwave/)) — ❌ tarif mobile money francophone non trouvé.
- **Doc** ✅ bonne, SDK nombreux, sandbox.
- **Réserve** : acteur anglophone, la zone francophone n'est pas son cœur de marché.

### 3.8 KkiaPay 🇧🇯 / FedaPay 🇧🇯

Deux acteurs béninois, pertinents pour la **phase 2** (Bénin/Togo), pas pour la CI d'abord.

- **KkiaPay** ✅ : mobile money, carte, **Wave**, doc développeur publique
  ([docs.kkiapay.me](https://docs.kkiapay.me/v1)), webhooks documentés
  ([webhook](https://docs.kkiapay.me/v1/tableau-de-bord/webhook)). Marque d'Open SI SAS (Bénin).
- **FedaPay** ✅ : cycle de transaction explicite *Pending → Approved*, sandbox recommandé,
  webhooks requis ([docs.fedapay.com](https://docs.fedapay.com/integration-api/fr/collects-management-fr)).
  ✅ **Paiement sans redirection** disponible pour MTN Bénin, Moov Bénin, Moov Togo et
  **MTN Côte d'Ivoire** — utile en salle.
- **Frais** ❌ non vérifiés pour les deux.

### 3.9 Bizao — ❌ **à retirer de la liste**

⚠️ **Bizao SAS est en liquidation judiciaire.** Ouverture d'un redressement le **4 mars 2025**
(cessation des paiements fixée au 14 février 2025), puis **liquidation judiciaire prononcée le
27 mai 2025** par le Tribunal des Activités Économiques de Paris, publiée au BODACC le
12 juin 2025, mandataire Selafa MJA
([Launch Base Africa](https://launchbaseafrica.com/2025/06/18/french-court-orders-compulsory-liquidation-of-ivorian-founded-fintech-bizao/) ;
[CIO Mag](https://cio-mag.com/bizao-plateforme-de-paiement-digital-en-afrique-entre-en-procedure-de-redressement-judiciaire/) ;
[Pappers, société 850323635](https://www.pappers.fr/entreprise/bizao-850323635)).
Le portail développeur `dev.bizao.com` **ne résout plus** (DNS inexistant au 2026-09-17).
❌ Le sort exact des **filiales africaines** n'est pas établi.
→ **Ne pas intégrer.** Mentionné ici pour que la question soit close.

### 3.10 Semoa 🇹🇬

- **Couverture** ⚠️ : Bénin, Côte d'Ivoire, Guinée, Togo. Produits **CashPay** (encaissement)
  et **Semoa Pro** (décaissement) ([semoa-group.com](https://www.semoa-group.com/)).
- ⚠️ CashPay intègre le mobile money togolais et la carte via la passerelle Orabank ;
  extensions PrestaShop/WooCommerce ([documentation](https://semoa-group.com/documentation/)),
  [code PrestaShop sur GitHub](https://github.com/semoa-togo/cashpay_prestashop).
- **Frais** ⚠️ 1,5 % à 3 % ([Pandore](https://pandore.co/en/les-frais-de-transactions-de-5-fintechs-en-afrique/)).
- **Verdict** : profil plutôt e-commerce/Togo, à revoir en phase Togo/Bénin.

### 3.11 Rails opérateurs en direct

**Orange Money Web Payment** ⚠️ — service disponible aux marchands *« starting with Mali,
Cameroon, Cote d'Ivoire, Senegal, Madagascar, Botswana, Guinea Conakry, Guinea Bissau,
Sierra Leone, RD Congo and Central African Republique »*
([developer.orange.com/apis/om-webpay](https://developer.orange.com/apis/om-webpay)).
Flux : le client demande un **mot de passe temporaire via USSD** avec son code secret Orange
Money, puis le saisit sur l'écran de paiement. Prérequis : compte marchand Orange Money,
**souscription en boutique Orange dans le pays d'activité**, commerçant officiellement
enregistré et conforme KYA. ❌ Détails techniques (OAuth2, endpoints, callback) **non
vérifiés** : la page technique n'était pas accessible.

**MTN MoMo API (Collections)** ✅ — portail `https://momodeveloper.mtn.com/`, sandbox
`https://sandbox.momodeveloper.mtn.com`. ⚠️ **L'en-tête `X-Reference-Id` (UUID v4) sert de
clé d'idempotence** ; `Ocp-Apim-Subscription-Key` porte l'abonnement produit
([MTN Developer Portal](https://momodeveloper.mtn.com/API-collections) ;
[gist d'intégration](https://gist.github.com/chaiwa-berian/5294fdf1360247cf4561c95c8fa740d4)).

**Wave Business API** — voir §3.2.

> **Position recommandée sur les rails directs** : ils offrent le meilleur coût unitaire mais
> multiplient les contrats, les KYC, les réconciliations et les modes de panne.
> Pour un éditeur de logiciel, **un rail direct (Wave) + un agrégateur** est le bon compromis.
> Quatre rails directs, non.

---

## 4. Tableau comparatif

Légende : ✅ vérifié · ⚠️ source secondaire · ❌ non vérifié / absent.

| Provider | Pays | Moyens | Webhooks signés ? | Sandbox ? | Frais publics | Règlement | Doc | Verdict |
|---|---|---|---|---|---|---|---|---|
| **Wave** | SN, CI, UG, ML, BF, GM ⚠️ | Wave seul | ✅ **Oui** — `Wave-Signature`, `t=…,v1=…`, HMAC-SHA256(ts+body), tolérance 5 min, retries 3 j, dédup par `id` | ❌ **Non documenté** (seulement `test.test_event`) | ❌ non officiel (⚠️ ~1 % marchand) | ❌ non documenté | ✅ **Excellente** | ⭐ **Rail n°1 CI.** Contrat le plus sûr, coût le plus bas, mono-rail |
| **CinetPay** | 15+ pays AO/AC ✅ | OM, MTN, Moov, Wave⁽¹⁾, cartes, wallets | ⚠️ Oui — `x-token` HMAC-SHA256 sur concaténation, **sans horodatage** | ✅ `api.cinetpay.net` | ❌ sur devis (⚠️ ~2,5 %+) | ⚠️ 24–72 h | ⚠️ Bonne (bloquée au proxy), **SDK excellents** ✅ | ⭐ **Meilleure couverture.** Agréé BCEAO ✅. **Risque de contrepartie à surveiller** (§3.1) |
| **Hub2** | BJ, BF, CM, CI, GN, ML, NE, SN, TG ⚠️ | Mobile money, virement | ⚠️ Événements oui, **signature ❌ non documentée** | ✅ en-tête `Environment` | ❌ | ❌ | ✅ Bonne, modèle `PaymentIntent` | ⭐ **Meilleur modèle d'API + meilleure couverture feuille de route.** Rail n°2 candidat |
| **Paystack** | NG, ZA, GH, KE, **CI** ⚠️ (bêta ❌) | Wave, OM, MTN, cartes ✅ | ✅ Oui (standard Paystack) | ✅ clés test/live | ✅ **1,95 % MM** ; ⚠️ 3,2 %/3,8 % carte | ⚠️ **J+1 ouvré** | ✅ **La meilleure** | ⭐ Rail n°2 candidat **si le statut GA en CI est confirmé** |
| **PayDunya** | BJ, BF, CI, ML, SN, TG ⚠️ | Mobile money, carte (PCI-DSS requis), DMP, **PSR** | ⚠️ à vérifier | ✅ | ❌ **grille en image** | ❌ | ✅ Bonne, riche | Solide pour SN/BJ. Tarifs opaques |
| **Flutterwave** | CM, CI, ML, SN (franco) ✅ | Mobile money franco (XOF/XAF), cartes | ✅ Oui (standard FLW) | ✅ | ⚠️ 2,6–4,8 % carte | ❌ | ✅ Bonne | Couverture franco étroite, acteur anglophone |
| **KkiaPay** | BJ + AO franco ⚠️ | Mobile money, carte, Wave | ✅ documentés | ⚠️ | ❌ | ❌ | ✅ Bonne | Phase Bénin/Togo |
| **FedaPay** | BJ, TG, **CI (MTN)** ✅ | Mobile money, carte, **sans redirection** ✅ | ⚠️ requis, détails à vérifier | ✅ | ❌ | ❌ | ✅ Bonne | Phase Bénin/Togo |
| **Semoa** | BJ, CI, GN, TG ⚠️ | Mobile money TG, carte (Orabank) | ❌ | ❌ | ⚠️ 1,5–3 % | ❌ | ⚠️ Modeste | Phase Togo |
| **Orange Money Web Payment** | ML, CM, CI, SN, MG, … ✅ | Orange Money seul | ❌ non vérifié | ❌ non vérifié | ❌ | ❌ | ⚠️ Overview public, technique ❌ | Rail direct. Onboarding **en boutique**. Lourd |
| **MTN MoMo API** | Multi-pays MTN ✅ | MTN MoMo seul | ⚠️ à vérifier | ✅ sandbox public | ❌ | ❌ | ✅ Portail public | Rail direct. **`X-Reference-Id` = idempotence** ⚠️ |
| **Stripe** | ❌ **pas en direct en Afrique** ⚠️ | — | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ **Écarter** pour l'AO. Garder comme **référence de conception** |
| **Bizao** | — | — | — | — | — | — | ❌ portail éteint | ❌ **Liquidation judiciaire 27 mai 2025** ⚠️. **Ne pas intégrer** |

⁽¹⁾ Wave via CinetPay : ❌ non confirmé sur la doc officielle CinetPay, à vérifier.

---

## 5. Architecture recommandée — l'abstraction `PaymentProvider`

### 5.1 Le principe directeur

> **Le domaine métier ne connaît que des encaissements. Il ne connaît aucun fournisseur.**

Concrètement : le mot `wave`, `cinetpay` ou `orange` ne doit apparaître **nulle part** dans
`Order`, `Bill`, `Shift`, `CashDrawer`. Un `grep -rn "cinetpay" src/domain/` doit rendre zéro
ligne. Si ce n'est pas le cas, l'abstraction a fui.

Trois raisons pratiques, pas théoriques :

1. **Le paysage bouge en ce moment même** — PI-SPI au 30 juin 2026 (§2.2), agréments BCEAO en
   cours d'attribution (§2.1), un acteur régional liquidé en 2025 (§3.9), un autre en incident
   de règlement (§3.1). Un couplage au fournisseur est une dette à échéance connue.
2. **Chaque pays de la feuille de route change le mix de providers.** Le Bénin ne se sert pas
   comme la Côte d'Ivoire.
3. **Les espèces doivent passer par la même porte.** C'est le point le plus souvent raté.

### 5.2 Les types de base

```ts
// ─── Identité ────────────────────────────────────────────────────────────────
export type ProviderId = string & { readonly __brand: "ProviderId" };
export type PaymentId  = string & { readonly __brand: "PaymentId" };
export type CurrencyCode = "XOF" | "XAF" | "EUR" | "USD" | "NGN" | "MAD" | (string & {});

/** Montant en unités mineures ISO 4217. Voir §7 : en XOF l'exposant est 0. */
export interface Money {
  readonly minor: bigint;
  readonly currency: CurrencyCode;
}

export type PaymentMethod =
  | "cash"
  | "mobile_money"
  | "card"
  | "bank_transfer"
  | "external_terminal";   // TPE de la banque, hors du système

/** Émetteur concret, quand il est connu. Sert au reporting, jamais au routage métier. */
export type Operator =
  | "wave" | "orange_money" | "mtn_momo" | "moov_money"
  | "visa" | "mastercard" | "gim_uemoa"
  | (string & {});
```

### 5.3 Les capabilities — là où vivent les particularités des fournisseurs

C'est la pièce qui évite les `if (provider === "cinetpay")` disséminés. Chaque fait découvert
en §3 devient **une donnée**, pas une branche de code.

```ts
export interface AmountConstraints {
  readonly min?: Money;
  readonly max?: Money;
  /** Pas du montant accepté. CinetPay XOF => 5n. Wave => 1n. */
  readonly granularityMinor: bigint;
  /**
   * Ce que fait le FOURNISSEUR d'un montant non conforme.
   * CinetPay : "down" — il arrondit au multiple de 5 inférieur, sans nous demander.
   * => on doit donc arrondir NOUS-MÊMES avant d'appeler, sinon on encaisse moins que dû.
   */
  readonly providerRounding: "reject" | "down" | "up" | "none";
}

export interface ProviderCapabilities {
  readonly countries: readonly string[];        // ISO 3166-1 alpha-2
  readonly currencies: readonly CurrencyCode[];
  readonly methods: readonly PaymentMethod[];
  readonly operators: readonly Operator[];

  /** false = on ne peut PAS confirmer côté serveur (espèces, TPE externe attesté). */
  readonly verifiable: boolean;

  readonly webhooks:
    | { readonly kind: "none" }
    | {
        readonly kind: "signed";
        /** Wave: true (t=… dans Wave-Signature). CinetPay: false (pas d'horodatage signé). */
        readonly timestamped: boolean;
        readonly replayWindowSec?: number;      // Wave: 300
        /** Wave expose event.id. CinetPay: non => dédup par (provider, txId, hash). */
        readonly hasEventId: boolean;
      }
    | { readonly kind: "unsigned" };

  readonly sandbox: boolean;                    // Wave: false. CinetPay/Hub2/Paystack: true.
  readonly refund: "none" | "full" | "partial";
  /** Wave documente explicitement un refund idempotent. Ne jamais le supposer ailleurs. */
  readonly refundIsIdempotent: boolean;
  readonly reconciliation: boolean;
  readonly amounts: AmountConstraints;
  readonly sessionTtlSec?: number;              // Wave: 1800
  readonly supportsRecurring: boolean;          // mobile money: false
}
```

### 5.4 L'interface — les six opérations

```ts
export interface ProviderCtx {
  readonly tenantId: string;
  readonly countryCode: string;
  readonly logger: Logger;
  readonly now: () => Date;
  /** Secrets résolus par tenant ET par pays (Wave: clé SN ≠ clé CI). */
  readonly secrets: SecretResolver;
}

export interface PaymentProvider {
  readonly id: ProviderId;
  readonly capabilities: ProviderCapabilities;

  /** 1. Crée l'intention côté fournisseur. Doit être idempotent sur input.idempotencyKey. */
  initialize(input: InitializeInput, ctx: ProviderCtx): Promise<InitializeResult>;

  /** 2. LA SEULE source de vérité autorisée à faire avancer l'état. Serveur à serveur. */
  verify(ref: ProviderRef, ctx: ProviderCtx): Promise<PaymentSnapshot>;

  /** 3. Authentifie et décode une notification entrante. Ne décide JAMAIS de l'état final. */
  webhook(req: RawWebhookRequest, ctx: ProviderCtx): Promise<WebhookOutcome>;

  /** 4. Remboursement total ou partiel. */
  refund(input: RefundInput, ctx: ProviderCtx): Promise<RefundSnapshot>;

  /** 5. Lecture légère, pour le polling. Peut être la même chose que verify() selon le PSP. */
  status(ref: ProviderRef, ctx: ProviderCtx): Promise<PaymentStatus>;

  /** 6. Journal des règlements du fournisseur, pour la clôture et le rapprochement. */
  reconciliation(window: DateWindow, ctx: ProviderCtx): AsyncIterable<SettlementLine>;
}
```

**Pourquoi `verify` et `status` sont deux choses différentes.** Ce n'est pas de la
redondance : Hub2 expose réellement un `GET /payments/{id}/status` distinct du cycle de
paiement ✅, et ce même Hub2 **rate-limite le polling (HTTP 429)** ✅. `status()` est donc
l'appel bon marché qu'on peut passer toutes les 3 secondes pendant que le serveur attend
devant le client ; `verify()` est l'appel autoritaire, plus coûteux, qui a le droit d'écrire
en base. Les confondre conduit soit à se faire rate-limiter, soit à écrire en base à chaque
tick.

### 5.5 Les entrées et sorties

```ts
export interface InitializeInput {
  readonly paymentId: PaymentId;
  /** Déterministe, dérivée de paymentId + tentative. Voir §6.2. */
  readonly idempotencyKey: string;
  readonly amount: Money;
  readonly method: PaymentMethod;
  readonly operator?: Operator;
  readonly customer?: { readonly phone?: string; readonly email?: string; readonly name?: string };
  /** Non vide seulement pour les providers à redirection. */
  readonly returnUrls?: { readonly success: string; readonly error: string };
  readonly description: string;
  readonly metadata: Readonly<Record<string, string>>;
}

export interface InitializeResult {
  readonly ref: ProviderRef;
  /**
   * Le montant que le FOURNISSEUR a réellement retenu.
   * Peut différer de input.amount (CinetPay arrondit au multiple de 5 inférieur).
   */
  readonly acceptedAmount: Money;
  readonly action:
    | { readonly kind: "none" }                                  // espèces
    | { readonly kind: "redirect"; readonly url: string }        // Wave, CinetPay
    | { readonly kind: "deep_link"; readonly url: string }       // app Wave
    | { readonly kind: "display_qr"; readonly payload: string }
    | { readonly kind: "await_push" }                            // OTP/USSD : MTN, Orange
    | { readonly kind: "manual_attestation" };                   // TPE externe
  readonly expiresAt?: Date;
}

export interface ProviderRef {
  readonly providerId: ProviderId;
  /** Notre référence, envoyée au fournisseur (Wave: client_reference, CinetPay: transaction_id). */
  readonly localRef: string;
  /** La référence du fournisseur, connue après initialize(). */
  readonly remoteRef?: string;
}

export interface PaymentSnapshot {
  readonly ref: ProviderRef;
  readonly status: PaymentStatus;
  readonly amount: Money;              // montant confirmé encaissé
  readonly fee?: Money;                // si le fournisseur le communique
  readonly operator?: Operator;
  readonly payerMasked?: string;       // "+225 07 ** ** 42"
  readonly occurredAt?: Date;
  readonly failureCode?: string;
  readonly raw: unknown;               // toujours conservé pour l'audit
}

export type WebhookOutcome =
  | { readonly kind: "rejected"; readonly reason: "bad_signature" | "stale" | "unparseable" }
  | { readonly kind: "ignored"; readonly eventType: string }
  | {
      readonly kind: "accepted";
      /** Identifiant d'événement du fournisseur s'il existe (Wave: event.id). */
      readonly eventId: string | null;
      readonly eventType: string;
      readonly ref: ProviderRef;
      /**
       * Niveau de confiance — issu directement de ce qui a été mesuré en §3.
       *  "attested"  : signé + horodaté + frais (Wave)
       *  "signed"    : signé sans horodatage (CinetPay)
       *  "hint"      : non signé
       * Aucun de ces niveaux n'autorise à écrire l'état final sans verify() (§6.3).
       */
      readonly trust: "attested" | "signed" | "hint";
      readonly hintedStatus?: PaymentStatus;
    };
```

### 5.6 Le schéma d'états

```
                                    initialize()
        ┌─────────┐    ok     ┌────────────┐
        │ CREATED │──────────►│  PENDING   │◄────────────┐
        └────┬────┘           └─────┬──────┘             │ retry / nouvelle
             │ refus capability     │                    │ tentative sur la
             │ ou montant invalide  │                    │ MÊME addition
             ▼                      │                    │
        ┌─────────┐                 │              ┌─────┴──────┐
        │ REJECTED│                 │              │ UNRESOLVED │
        └─────────┘                 │              └─────┬──────┘
                                    │                    ▲     │ verify()
     ┌──────────────┬───────────────┼────────────┐       │     │
     ▼              ▼               ▼            ▼       │     ▼
┌──────────┐  ┌──────────┐   ┌──────────┐  ┌─────────┐   │  (SUCCEEDED
│SUCCEEDED │  │  FAILED  │   │ EXPIRED  │  │CANCELLED│   │   ou FAILED)
└────┬─────┘  └──────────┘   └──────────┘  └─────────┘   │
     │                                                   │
     │ refund()                        timeout / réseau ──┘
     ▼
┌────────────────────┐        ┌──────────┐
│ PARTIALLY_REFUNDED │───────►│ REFUNDED │
└────────────────────┘        └──────────┘
```

```ts
export type PaymentStatus =
  | "CREATED" | "PENDING" | "SUCCEEDED" | "FAILED"
  | "EXPIRED" | "CANCELLED" | "REJECTED"
  | "PARTIALLY_REFUNDED" | "REFUNDED"
  | "UNRESOLVED";
```

**`UNRESOLVED` est l'état le plus important de ce schéma**, et c'est celui qu'on oublie quand
on copie un modèle conçu pour des cartes en Europe. Il signifie : *« le client a peut-être
payé, on ne le sait pas »*. En mobile money ouest-africain c'est un état **fréquent** — le
réseau data du restaurant tombe, l'opérateur met 40 secondes à répondre, la session Wave
expire au bout de 30 minutes ✅ pendant que le client cherche son téléphone.

Trois règles qui découlent de cet état :

1. **`UNRESOLVED` ne bloque jamais le service.** Le serveur doit pouvoir rendre la table,
   imprimer la note et passer au client suivant. L'encaissement se résout tout seul.
2. **`UNRESOLVED` n'est jamais terminal.** Une boucle de réconciliation le rattrape (§6.6).
3. **`UNRESOLVED` ne déclenche aucun effet de bord** (pas d'impression de reçu, pas de
   décrément de stock, pas de clôture de table).

Les transitions sont gardées par une machine à états qui **rejette explicitement** tout saut
illégal — c'est ce qui rend le rejeu de webhook sûr (§6.5).

### 5.7 Brancher deux fournisseurs sans toucher au métier

```ts
// ─── Le domaine ne voit que ceci ─────────────────────────────────────────────
export interface CollectPaymentCommand {
  readonly billId: string;
  readonly amount: Money;
  readonly method: PaymentMethod;
  readonly operator?: Operator;
  readonly customer?: { phone?: string };
}

// ─── Le routeur : la SEULE brique qui connaît les noms des fournisseurs ──────
export interface ProviderRouter {
  /** Choisit un provider parmi ceux enregistrés, à partir des seules capabilities. */
  select(cmd: CollectPaymentCommand, ctx: ProviderCtx): PaymentProvider;
}

export class CapabilityRouter implements ProviderRouter {
  constructor(
    private readonly registry: ReadonlyMap<ProviderId, PaymentProvider>,
    /** Préférences par tenant/pays, stockées en base. PAS dans le code. */
    private readonly policy: RoutingPolicyStore,
  ) {}

  select(cmd: CollectPaymentCommand, ctx: ProviderCtx): PaymentProvider {
    const eligible = [...this.registry.values()].filter((p) =>
      p.capabilities.countries.includes(ctx.countryCode) &&
      p.capabilities.currencies.includes(cmd.amount.currency) &&
      p.capabilities.methods.includes(cmd.method) &&
      (cmd.operator === undefined || p.capabilities.operators.includes(cmd.operator)) &&
      fitsAmount(cmd.amount, p.capabilities.amounts),
    );
    if (eligible.length === 0) throw new NoEligibleProviderError(cmd, ctx.countryCode);
    // Ordre de préférence lu en base : coût, fiabilité observée, choix du restaurateur.
    return this.policy.rank(ctx.tenantId, eligible)[0];
  }
}
```

Ajouter Hub2 à côté de Wave se réduit alors à trois gestes, **dont aucun ne touche au
domaine** :

1. écrire `Hub2Provider implements PaymentProvider` (un fichier, isolé) ;
2. l'enregistrer dans la `registry` (une ligne de câblage) ;
3. insérer sa ligne de préférence dans `RoutingPolicyStore` (**une ligne en base, pas un
   déploiement**).

Et retirer CinetPay en urgence un lundi matin, si son délai de reversement dérive à nouveau,
devient **une mise à jour de ligne en base** — pas un correctif à déployer en pleine
affluence. C'est précisément le scénario documenté en §3.1 ; l'architecture doit y répondre
sans héroïsme.

### 5.8 Les deux providers qu'on oublie toujours

```ts
/** Espèces. Pas de réseau. Mais c'est un provider, pas un cas particulier. */
export class CashProvider implements PaymentProvider {
  readonly capabilities: ProviderCapabilities = {
    countries: ["*"], currencies: ["*"], methods: ["cash"], operators: [],
    verifiable: false,
    webhooks: { kind: "none" },
    sandbox: true,
    refund: "partial", refundIsIdempotent: true,
    reconciliation: true,           // le rapprochement se fait contre le tiroir-caisse
    amounts: { granularityMinor: 5n, providerRounding: "none" }, // §7.4
    supportsRecurring: false,
  };
  async initialize(i: InitializeInput): Promise<InitializeResult> {
    return { ref: { providerId: this.id, localRef: i.paymentId },
             acceptedAmount: i.amount, action: { kind: "none" } };
  }
  async verify(): Promise<PaymentSnapshot> { /* SUCCEEDED dès l'encaissement attesté */ }
  // reconciliation() lit les mouvements du tiroir de la session de caisse.
}

/** TPE de la banque, non connecté. Encaissement ATTESTÉ par un humain. */
export class ExternalTerminalProvider implements PaymentProvider {
  readonly capabilities = { /* … */ verifiable: false, webhooks: { kind: "none" } } as const;
  // Aucune vérification possible => ces encaissements sont marqués et comptés à part
  // dans la clôture (§11.2). C'est le principal vecteur d'écart de caisse.
}
```

Modéliser les espèces comme un provider a un effet concret : la clôture de service, le
rapprochement et le calcul d'écart s'écrivent **une seule fois**, pour tous les moyens de
paiement. Sinon la logique de caisse se dédouble et les deux moitiés divergent.

### 5.9 Quel fournisseur brancher **en premier** en Côte d'Ivoire

**Ordre recommandé : `CashProvider` → `WaveProvider (CI)` → un agrégateur.**

**Provider n°0 — `CashProvider`, dès le premier sprint.** Ce n'est pas une formalité :
c'est ce qui valide que l'abstraction tient. Si `CashProvider` entre proprement dans
l'interface à six opérations, elle est bonne. S'il faut la tordre, elle est mauvaise — et il
vaut mieux le découvrir avant d'avoir écrit trois adaptateurs HTTP. Et, sur le terrain, c'est
le moyen de paiement **majoritaire** (§1.2).

**Provider n°1 électronique — Wave Côte d'Ivoire (Checkout API).** Quatre raisons, toutes
adossées à ce qui a été vérifié :

1. **C'est le seul fournisseur de la région dont le contrat technique couvre les quatre
   garanties dont ce module a besoin, et les documente.** ✅ Webhooks signés HMAC-SHA256
   **horodatés** avec fenêtre de rejeu de 5 minutes ; **identifiant d'événement** explicitement
   destiné à la déduplication ; **remboursement idempotent** garanti par écrit ; **politique de
   retry de 3 jours** annoncée. Aucun autre fournisseur du panel ne documente ces quatre points.
   Pour un module de paiement, c'est plus précieux qu'une couverture large.
2. **Le coût le plus bas** du marché ivoirien (⚠️ ~1 %, contre 1,95 % chez Paystack ✅ et
   ~2,5 % estimé chez CinetPay ⚠️). Sur une marge de restauration, l'écart est réel.
3. **Base d'utilisateurs et usage QR au comptoir** déjà installés en Côte d'Ivoire (§1.3).
4. **Argument d'architecture, pas de confort** : Wave est **mono-rail**. Il ne couvre ni
   Orange, ni MTN, ni Moov, ni la carte. Commencer par lui **interdit** de bâcler
   l'abstraction — le second fournisseur n'est pas une éventualité lointaine, il est
   obligatoire dès le jalon suivant. Commencer par un agrégateur qui couvre tout ferait
   exactement l'inverse : l'abstraction resterait théorique jusqu'au jour où il faudrait en
   changer dans l'urgence.

   ⚠️ **À accepter en connaissance de cause** : Wave **ne documente aucun sandbox**. Il faut
   donc prévoir dès le départ un `FakeWaveProvider` conforme au contrat (rejouant les
   payloads réels capturés) pour les tests — ce qui est de toute façon la bonne pratique, mais
   ici ce n'est pas optionnel.

**Provider n°2 — l'agrégateur, dans le même cycle**, pour couvrir Orange / MTN / Moov / carte :

- **Paystack CI** si — et seulement si — ✅ la **disponibilité générale en Côte d'Ivoire est
  confirmée** (aujourd'hui annoncée en accès anticipé, ❌ statut GA non vérifié). Meilleure
  documentation du panel, 1,95 % mobile money ✅, règlement J+1 ouvré ⚠️, couverture
  Wave+Orange+MTN ✅.
- **Hub2** sinon, et probablement **de toute façon** à moyen terme : modèle `PaymentIntent`
  séparant l'intention des tentatives ✅ — exactement la forme d'une addition de restaurant —
  sandbox par en-tête ✅, et **9 pays qui recouvrent toute la feuille de route produit** ⚠️.
  Réserve : ❌ signature des webhooks non documentée, à lever avant de signer.

**CinetPay** : écrire l'adaptateur (la couverture pays est la meilleure du panel ✅ et
l'agrément BCEAO est acquis ✅), **mais ne pas en faire le rail unique d'un restaurant**, et
instrumenter le délai de reversement comme une métrique de production — voir §3.1.

**Ce que cette recommandation n'est pas** : un classement définitif. Les deux inconnues qui
peuvent la renverser sont (a) le statut GA de Paystack en CI et (b) le tarif marchand Wave
réellement contractualisé. Les deux se lèvent par un courriel, pas par une recherche
documentaire.

---

## 6. Idempotence, webhooks et réconciliation

### 6.1 Les quatre scénarios à couvrir

| # | Scénario | Ce qui arrive sans protection |
|---|---|---|
| 1 | Le serveur double-clique « Encaisser » | Deux sessions de paiement, le client paie deux fois |
| 2 | Le même webhook arrive deux fois | L'addition est créditée deux fois, la caisse est fausse |
| 3 | Le client a payé, le webhook n'arrive pas (ou tard) | L'addition reste ouverte, le client part, litige |
| 4 | On veut rejouer un webhook pour déboguer | Effets de bord relancés : reçu réimprimé, stock décrémenté |

Les quatre ont la même réponse de fond : **l'état du paiement est une fonction de la vérité
côté fournisseur, jamais du nombre de fois où un message est arrivé.**

### 6.2 La clé d'idempotence

Deux clés distinctes, à ne pas confondre.

**(a) Clé côté client → notre API.** Protège le scénario 1.

```ts
/**
 * Fournie par le POS. Doit être STABLE tant que l'utilisateur n'a pas
 * explicitement relancé une NOUVELLE tentative.
 *   billId   : l'addition
 *   attempt  : incrémenté seulement par un geste utilisateur délibéré
 *              ("Réessayer"), jamais par un re-render ni un retry réseau.
 */
function clientIdempotencyKey(billId: string, attempt: number, amount: Money): string {
  return sha256([
    "v1", billId, String(attempt),
    String(amount.minor), amount.currency,
  ].join("|"));
}
```

Côté serveur :

```sql
CREATE TABLE idempotency_keys (
  key             TEXT PRIMARY KEY,
  tenant_id       TEXT        NOT NULL,
  endpoint        TEXT        NOT NULL,
  request_hash    TEXT        NOT NULL,   -- empreinte du corps normalisé
  state           TEXT        NOT NULL,   -- 'in_flight' | 'completed'
  response_status INT,
  response_body   JSONB,
  payment_id      TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at      TIMESTAMPTZ NOT NULL
);
```

Algorithme, dans une transaction :

```
1. INSERT ... ON CONFLICT DO NOTHING  avec state='in_flight'
2. Si insertion refusée (clé déjà présente) :
     a. request_hash différent        -> 422 IDEMPOTENCY_KEY_REUSE
        (même clé, corps différent = bug appelant, on ne devine pas)
     b. state='completed'             -> renvoyer la réponse mémorisée, à l'identique
     c. state='in_flight'             -> 409 + Retry-After
                                         (une requête jumelle est en cours)
3. Sinon : exécuter, puis passer state='completed' et mémoriser la réponse.
```

**(b) Clé côté nous → fournisseur.** Protège des doublons lors de nos propres retries HTTP.
Elle doit être **déterministe**, jamais un UUID tiré au hasard à chaque tentative — sinon le
retry crée une seconde session chez le fournisseur.

| Fournisseur | Champ porteur | Vérifié |
|---|---|---|
| Wave | `client_reference` (≤ 255 car.) | ✅ [docs.wave.com/checkout](https://docs.wave.com/checkout) |
| CinetPay | `transaction_id` (dédup recommandée par le SDK) | ✅ [SDK PHP](https://github.com/cinetpay/cinetpay-php-sdk/blob/master/README.md) |
| MTN MoMo | **`X-Reference-Id` (UUID v4) — sert de clé d'idempotence** | ⚠️ [portail MTN](https://momodeveloper.mtn.com/API-collections) |
| Hub2 | référence du `PaymentIntent` — ⚠️ jeu de caractères restreint : *« letters, numbers, hyphen, underscore, dot and space »* | ✅ [docs.hub2.io](https://docs.hub2.io/integration/en/payments/payments_integration) |

```ts
/** Déterministe, stable à travers tous les retours réseau d'une même tentative. */
function providerIdempotencyKey(paymentId: PaymentId, attempt: number): string {
  // Jeu de caractères volontairement restreint : compatible Hub2, Wave et CinetPay.
  return `pay-${paymentId}-${attempt}`.slice(0, 120);
}
```

### 6.3 La règle d'or des webhooks

> **Un webhook est un signal, pas une source de vérité.**
> Il déclenche un `verify()`. Il n'écrit jamais l'état final directement.

Ce n'est pas une position d'école : c'est la doctrine écrite du fournisseur le plus installé
de la zone. ✅ *« A webhook is only a signal inviting your backend to verify a transaction »*
([SDK PHP CinetPay](https://github.com/cinetpay/cinetpay-php-sdk/blob/master/README.md)).

Elle est d'autant plus nécessaire que **la qualité de signature varie fortement** dans la
région, et c'est mesuré :

| Fournisseur | Signature | Horodatage signé | ID d'événement | `trust` |
|---|---|---|---|---|
| Wave ✅ | HMAC-SHA256(`ts` + body brut), en-tête `Wave-Signature: t=…,v1=…` | **Oui**, fenêtre 5 min | **Oui** (`event.id`) | `attested` |
| CinetPay ⚠️ | HMAC-SHA256 en-tête `x-token`, sur concaténation ordonnée de 16 champs | **Non** | Non | `signed` |
| Hub2 ❌ | non documenté | — | — | `hint` |

Même pour Wave — le cas le plus favorable — la recommandation reste d'appeler `verify()`.
Le coût est un aller-retour HTTP ; le bénéfice est qu'un seul chemin de code écrit l'état,
donc un seul chemin à tester et à auditer.

Deux pièges documentés à respecter :

- ✅ **Signer le corps brut.** *« Use the raw request body as-is and do not parse and
  re-serialize the JSON — even a small formatting difference like whitespace or key ordering
  will cause verification to fail »* ([docs.wave.com/webhook](https://docs.wave.com/webhook)).
  Le middleware doit donc conserver le `Buffer` brut **avant** tout parseur JSON.
- ✅ **Comparer en temps constant** (`hash_equals`, `crypto.timingSafeEqual`) — recommandé par
  le SDK CinetPay.

### 6.4 Stocker les événements

```sql
CREATE TABLE webhook_events (
  id                 UUID PRIMARY KEY,
  provider_id        TEXT        NOT NULL,
  -- Identifiant d'événement du fournisseur, s'il existe (Wave: event.id).
  provider_event_id  TEXT,
  -- Repli quand le fournisseur n'en fournit pas (CinetPay) :
  --   sha256(provider | localRef | eventType | payloadCanonique)
  dedupe_key         TEXT        NOT NULL,
  event_type         TEXT        NOT NULL,
  payment_id         TEXT,
  local_ref          TEXT,
  trust              TEXT        NOT NULL,  -- attested | signed | hint
  signature_valid    BOOLEAN     NOT NULL,
  headers            JSONB       NOT NULL,
  raw_body           BYTEA       NOT NULL,  -- corps BRUT, jamais re-sérialisé
  received_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  processing_state   TEXT        NOT NULL,  -- received|processed|ignored|rejected|failed
  processed_at       TIMESTAMPTZ,
  attempts           INT         NOT NULL DEFAULT 0,
  last_error         TEXT,
  replay_of          UUID REFERENCES webhook_events(id)
);

-- La déduplication est une contrainte de base, pas un if dans le code applicatif.
CREATE UNIQUE INDEX webhook_events_dedupe
  ON webhook_events (provider_id, dedupe_key)
  WHERE replay_of IS NULL;

CREATE INDEX webhook_events_unprocessed
  ON webhook_events (processing_state, received_at)
  WHERE processing_state IN ('received', 'failed');
```

Points de conception à ne pas rogner :

1. **Persister d'abord, répondre `200`, traiter ensuite.** Le fournisseur ne doit jamais
   attendre notre logique métier. ✅ Wave retente jusqu'à 3 jours sur non-2xx — un traitement
   lent se transforme en tempête de retries.
2. **Conserver `raw_body` en binaire.** C'est la seule preuve permettant de revérifier une
   signature a posteriori, et la seule base d'un rejeu honnête.
3. **`dedupe_key` porte une contrainte d'unicité.** Le scénario 2 est alors bloqué par la base,
   pas par une intention.

### 6.5 Rejouer un webhook sans dégât

Le rejeu est nécessaire (incident, bug corrigé, migration). Il est sûr **à trois conditions**,
et seulement à celles-là :

```ts
async function replayWebhook(eventId: string, actor: Actor): Promise<ReplayResult> {
  const original = await repo.getEvent(eventId);

  // (1) Re-vérifier la signature sur le corps BRUT conservé.
  //     Un événement dont la signature ne se revalide pas ne se rejoue jamais.
  const provider = registry.get(original.providerId);
  const outcome = await provider.webhook(
    { headers: original.headers, rawBody: original.rawBody },
    ctx,
  );
  if (outcome.kind === "rejected" && outcome.reason === "bad_signature") {
    throw new ReplayRefusedError("signature invalide au rejeu");
  }

  // (2) Tracer le rejeu comme un NOUVEL événement lié à l'original.
  //     L'historique n'est pas réécrit : on voit qui a rejoué, quand.
  const replayId = await repo.insertReplay({ replayOf: eventId, actor });

  // (3) Repasser par EXACTEMENT le même chemin que le traitement normal.
  //     Pas de chemin "spécial rejeu" : ce serait un second code à maintenir.
  return processPaymentEvent(replayId);
}
```

**Ce qui rend le rejeu inoffensif n'est pas le rejeu lui-même, c'est la machine à états.**
`processPaymentEvent` appelle `verify()`, obtient `SUCCEEDED`, et tente la transition. Si le
paiement est **déjà** `SUCCEEDED`, la transition `SUCCEEDED → SUCCEEDED` est un **no-op
explicite** : elle ne réémet aucun événement de domaine.

```ts
const LEGAL: Record<PaymentStatus, readonly PaymentStatus[]> = {
  CREATED:            ["PENDING", "REJECTED", "CANCELLED"],
  PENDING:            ["SUCCEEDED", "FAILED", "EXPIRED", "CANCELLED", "UNRESOLVED"],
  UNRESOLVED:         ["SUCCEEDED", "FAILED", "EXPIRED"],
  SUCCEEDED:          ["PARTIALLY_REFUNDED", "REFUNDED"],
  PARTIALLY_REFUNDED: ["PARTIALLY_REFUNDED", "REFUNDED"],
  REFUNDED: [], FAILED: [], EXPIRED: [], CANCELLED: [], REJECTED: [],
};

function transition(cur: PaymentStatus, next: PaymentStatus): "applied" | "noop" {
  if (cur === next) return "noop";                      // rejeu : silencieux
  if (!LEGAL[cur].includes(next)) throw new IllegalTransitionError(cur, next);
  return "applied";
}
```

> **Corollaire à graver** : les effets de bord (impression du reçu, certification fiscale
> §8, décrément de stock, fermeture de table, notification) sont **déclenchés par une
> transition `applied`**, jamais par la réception d'un message. C'est cette seule règle qui
> transforme « rejouer un webhook » d'une opération risquée en une opération banale.

### 6.6 « Paiement réussi mais webhook en retard » — le cas le plus fréquent

C'est le scénario 3, et en mobile money ouest-africain **il n'est pas exceptionnel** : il
fait partie du fonctionnement normal. Le produit doit donc le traiter comme un chemin nominal,
pas comme une exception.

**Quatre filets, du plus rapide au plus lent :**

```
t+0s     Le client confirme sur son téléphone.
         ┌──────────────────────────────────────────────────────────────┐
t+2..30s │ FILET 1 — Polling actif via status()                         │
         │ Le POS interroge notre API pendant que le serveur attend      │
         │ devant le client. Backoff 2s→3s→5s→8s, plafond ~60 s.        │
         │ ⚠️ status() et non verify() : Hub2 rate-limite (HTTP 429) ✅  │
         └──────────────────────────────────────────────────────────────┘
t+?      ┌──────────────────────────────────────────────────────────────┐
         │ FILET 2 — Webhook                                            │
         │ Arrive quand il arrive. Déclenche verify(). Souvent le        │
         │ premier à répondre ; parfois le dernier.                      │
         └──────────────────────────────────────────────────────────────┘
t+60s    ┌──────────────────────────────────────────────────────────────┐
         │ FILET 3 — Le service continue                                 │
         │ Le paiement passe en UNRESOLVED. La table est rendue,          │
         │ l'addition reste "en attente d'encaissement".                 │
         │ RIEN NE BLOQUE LE RESTAURANT.                                 │
         └──────────────────────────────────────────────────────────────┘
t+1..15m ┌──────────────────────────────────────────────────────────────┐
         │ FILET 4 — Balayage de rattrapage                              │
         │ Tâche périodique : tout PENDING/UNRESOLVED plus vieux que N,   │
         │ verify(). Backoff exponentiel, abandon à l'expiration          │
         │ annoncée par le fournisseur (Wave : 30 min ✅).                │
         └──────────────────────────────────────────────────────────────┘
J+1      ┌──────────────────────────────────────────────────────────────┐
         │ FILET 5 — Réconciliation de règlement (§6.7)                  │
         │ Compare notre journal au journal du fournisseur.               │
         │ Rattrape tout ce que les quatre premiers ont manqué.           │
         └──────────────────────────────────────────────────────────────┘
```

```ts
async function sweepUnresolved(ctx: ProviderCtx): Promise<void> {
  const stale = await repo.findPayments({
    status: ["PENDING", "UNRESOLVED"],
    olderThanSec: 45,
    notAttemptedSinceSec: backoff(/* attempts */),
    limit: 200,
  });
  for (const p of stale) {
    const provider = registry.get(p.providerId);
    // verify() est la seule autorité. Toujours le même chemin d'écriture.
    const snap = await provider.verify(p.ref, ctx);
    await applySnapshot(p, snap);             // passe par transition()
    if (snap.status === "PENDING" && isExpired(p, provider)) {
      await applyStatus(p, "EXPIRED");
    }
  }
}
```

**Le cas inverse, à ne pas négliger** : « le webhook dit réussi, la vérification dit échoué ».
La vérification gagne, **toujours**. Et l'écart est journalisé comme une alerte de sécurité :
c'est la signature d'un webhook forgé, ou d'un bug du fournisseur — les deux méritent un
humain.

### 6.7 Le cycle de réconciliation

Trois niveaux, de la seconde au jour.

**Niveau 1 — Par transaction (temps réel).** `verify()` après chaque signal. Vérifier que
`snapshot.amount` **égale** le montant attendu ; un montant différent ne fait pas avancer
l'état, il lève une alerte (c'est notamment ainsi qu'on attrape l'arrondi au multiple de 5 de
CinetPay ⚠️ et toute altération).

**Niveau 2 — Clôture de service (fin de shift).** Pour chaque provider : somme de nos
`SUCCEEDED` de la session vs somme des encaissements du fournisseur ; pour `CashProvider` :
comptage physique du tiroir vs théorique = **écart de caisse**, nominatif et daté (§11.2).

**Niveau 3 — Règlement (J+1 et plus).** C'est l'opération `reconciliation()` :

```ts
export interface SettlementLine {
  readonly providerRef: string;
  readonly localRef?: string;          // notre référence, si le fournisseur la restitue
  readonly gross: Money;
  readonly fee: Money;
  readonly net: Money;
  readonly occurredAt: Date;
  readonly settledAt?: Date;
  readonly status: "settled" | "pending" | "reversed";
}

type ReconciliationFinding =
  | { kind: "matched";            paymentId: PaymentId; feeDelta: Money }
  | { kind: "missing_locally";    line: SettlementLine }   // il a encaissé, pas nous → grave
  | { kind: "missing_remotely";   paymentId: PaymentId }   // nous oui, lui non → très grave
  | { kind: "amount_mismatch";    paymentId: PaymentId; expected: Money; actual: Money }
  | { kind: "unexpected_reversal"; paymentId: PaymentId }
  | { kind: "settlement_overdue"; paymentId: PaymentId; ageHours: number };
```

Le dernier cas mérite d'exister à part : ⚠️ en 2025-2026, des marchands ivoiriens ont attendu
des mois leur reversement (§3.1). **`settlement_overdue` est la métrique qui aurait donné
l'alerte en quelques jours plutôt qu'en quelques mois.** Elle doit remonter au tableau de
bord du restaurateur, pas seulement dans un log.

---

## 7. Montants et devises

### 7.1 Le fait vérifié : XOF n'a pas de sous-unité

✅ **Le franc CFA (XOF) a un exposant décimal ISO 4217 de 0.** Il figure dans la liste des
devises « Exponent 0 (No decimals) » aux côtés de BIF, DJF, GNF, ISK, JPY, KMF, KRW, PYG,
RWF, UGX, VND, VUV, **XAF**, XOF, XPF
([Adyen, *Currency codes and minor units*](https://docs.adyen.com/development-resources/currency-codes) ;
[Datatrans, *Currency Codes and Minor Units*](https://docs.datatrans.ch/docs/currency-codes) ;
[ISO 4217 — Wikipédia](https://en.wikipedia.org/wiki/ISO_4217)).

✅ Confirmé côté implémentation par Stripe : les devises à zéro décimale se transmettent sans
multiplication — *« For the following zero-decimal currencies, the charge and the amount are
the same, without requiring multiplication. For example, to charge 500 JPY, provide an amount
value of 500 »* ([docs.stripe.com/currencies](https://docs.stripe.com/currencies)).

### 7.2 Le bug à 100× que cette règle évite

Le réflexe « on stocke toujours en centimes, donc on multiplie par 100 » est **faux en XOF** et
produit une erreur d'un facteur 100 — dans le sens d'une **surfacturation du client**.

```
Addition : 12 500 FCFA
  Règle naïve "toujours ×100"  →  amount = 1 250 000
  En XOF (exposant 0)          →  le fournisseur lit 1 250 000 FCFA
                                  soit 100× le prix du repas.
```

Ce piège est assez répandu pour avoir son propre article :
⚠️ [*XOF has no minor unit, and "always store money in cents" overcharges by 100x*](https://dev.to/catidegla/xof-has-no-minor-unit-and-always-store-money-in-cents-overcharges-by-100x-3fhk).

Le symétrique existe aussi : un code qui divise par 100 à l'affichage montrerait « 125,00 F »
pour 12 500 F. Dans les deux sens, **le facteur 100 doit venir de la devise, jamais d'une
constante.**

### 7.3 La règle de stockage retenue

> **Tout montant est un entier d'unités mineures ISO 4217, accompagné de son code devise.
> Le facteur d'échelle est dérivé de l'exposant de la devise — jamais écrit en dur.
> Aucun `float`, nulle part, jamais.**

```ts
/** Table de référence. Exposant ISO 4217. Source de vérité unique. */
const CURRENCY_EXPONENT = {
  XOF: 0, XAF: 0, GNF: 0, JPY: 0, KMF: 0, RWF: 0, // zéro décimale
  EUR: 2, USD: 2, NGN: 2, MAD: 2, GHS: 2, KES: 2, ZAR: 2,
  TND: 3, // trois décimales — existe, et casse les modèles "0 ou 2"
} as const satisfies Record<string, 0 | 2 | 3>;

export function exponentOf(c: CurrencyCode): number {
  const e = (CURRENCY_EXPONENT as Record<string, number>)[c];
  if (e === undefined) throw new UnknownCurrencyError(c);  // échouer, ne pas supposer 2
  return e;
}

/** 12 500 FCFA -> { minor: 12500n, currency: "XOF" }
 *  10,99 EUR   -> { minor:  1099n, currency: "EUR" }  */
export function money(minor: bigint | number, currency: CurrencyCode): Money {
  const v = typeof minor === "bigint" ? minor : BigInt(minor);
  if (typeof minor === "number" && !Number.isSafeInteger(minor)) {
    throw new PrecisionError(minor);
  }
  return Object.freeze({ minor: v, currency });
}
```

**Schéma base de données**

```sql
-- Un montant = DEUX colonnes, toujours côte à côte, jamais une seule.
amount_minor  BIGINT  NOT NULL,       -- surtout PAS NUMERIC(10,2) ni DOUBLE
amount_currency CHAR(3) NOT NULL,

CONSTRAINT amount_non_negative CHECK (amount_minor >= 0)
```

Le choix de `BIGINT` plutôt que `NUMERIC(n,2)` est délibéré : `NUMERIC(n,2)` **encode
l'hypothèse « 2 décimales » dans le schéma**, ce qui est faux pour XOF et pour TND.
Côté TypeScript, `bigint` plutôt que `number` : un restaurant ne dépassera jamais
`Number.MAX_SAFE_INTEGER`, mais `bigint` **interdit à la compilation** de mélanger un montant
avec un nombre ordinaire — ce qui est précisément l'erreur qu'on cherche à rendre impossible.
Coût à assumer : sérialisation JSON explicite aux frontières (`toString()`).

**Formatage**

```ts
export function formatMoney(m: Money, locale = "fr-CI"): string {
  const exp = exponentOf(m.currency);
  const value = Number(m.minor) / 10 ** exp;
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency: m.currency,
    minimumFractionDigits: exp,
    maximumFractionDigits: exp,       // clé : Intl mettrait 2 décimales par défaut
  }).format(value);
}
// formatMoney({ minor: 12500n, currency: "XOF" })  -> "12 500 F CFA"
// formatMoney({ minor:  1099n, currency: "EUR" })  -> "10,99 €"
```

⚠️ `Intl.NumberFormat` connaît déjà l'exposant de XOF, mais **`minimumFractionDigits` /
`maximumFractionDigits` doivent être posés explicitement** : dès qu'un appelant passe des
options partielles, le repli à 2 décimales réapparaît. C'est une des rares lignes où la
redondance est la bonne réponse.

### 7.4 Arrondi et granularité — le point que XOF rend incontournable

Deux contraintes distinctes se cumulent en zone XOF :

**(a) Contrainte fournisseur.** ⚠️ CinetPay : montant **multiple de 5** en XOF, et *« les
montants ne respectant pas cette condition sont arrondis au multiple de 5 inférieur »*
([docs CinetPay](https://docs.cinetpay.com/api/1.0-fr/checkout/initialisation), via extraits).
Minimum **100 XOF**.
✅ Flutterwave : minimum **100** en XOF/XAF
([docs Flutterwave](https://developer.flutterwave.com/v3.0/reference/charge-via-francophone-mobile-money)).

> **Le fournisseur peut réduire le montant sans nous prévenir.** Sur une addition de
> 12 503 F, CinetPay encaisserait 12 500 F et le restaurant perdrait 3 F silencieusement.
> C'est faible à l'unité, mais c'est un écart de réconciliation permanent — donc du bruit
> qui masquera un jour un vrai problème.

**La réponse est structurelle, pas cosmétique** : `InitializeResult.acceptedAmount` (§5.5)
est un champ distinct du montant demandé, et l'arrondi est fait **par nous, avant l'appel**,
via les capabilities :

```ts
/** Arrondi AU SUPÉRIEUR vers la granularité du fournisseur : jamais encaisser moins que dû. */
export function fitToProviderGranularity(amount: Money, c: AmountConstraints): Money {
  const step = c.granularityMinor;
  if (step <= 1n) return amount;
  const rem = amount.minor % step;
  if (rem === 0n) return amount;
  return money(amount.minor + (step - rem), amount.currency);
}
// 12 503 XOF, step 5n -> 12 505 XOF, et l'écart de +2 F est une ligne EXPLICITE
// de l'addition ("arrondi"), visible par le client et par le comptable.
```

**(b) Contrainte de calcul.** La TVA sur un montant sans sous-unité tombe rarement juste :
`12 500 / 1,18 = 10 593,22…`. Trois règles :

1. **Calculer en interne avec des chiffres de garde** (decimal, ou entiers ×10⁴), jamais en
   `float`.
2. **Arrondir une seule fois, au niveau du document**, pas ligne à ligne — sinon la somme des
   lignes arrondies ne fait plus le total.
3. **Matérialiser la différence d'arrondi** sur une ligne dédiée quand elle est non nulle. Un
   écart caché est un écart qu'on retrouvera à la clôture sans savoir d'où il vient.

❌ **Non vérifié** : la pratique commerciale ivoirienne de l'arrondi au multiple de 5 F en
espèces (rareté des pièces de 1 F et 2 F) est couramment évoquée mais **je n'ai trouvé aucune
source officielle BCEAO ou DGI**. À confirmer sur le terrain avant d'en faire un défaut
produit — d'où le `granularityMinor: 5n` posé sur `CashProvider` en §5.8, **configurable par
tenant** et non codé en dur.

### 7.5 Faire coexister XOF, EUR, USD, NGN, MAD

| Devise | Exposant ✅ | 10 unités = | Remarque |
|---|---|---|---|
| **XOF** | **0** | `10n` | Zone UEMOA. Parité fixe à l'EUR |
| **XAF** | **0** | `10n` | Zone CEMAC (Cameroun). Même parité, **code différent** |
| EUR | 2 | `1000n` | |
| USD | 2 | `1000n` | |
| NGN | 2 | `1000n` | Nigeria |
| MAD | 2 | `1000n` | Maroc |
| TND | **3** | `10000n` | Cité pour mémoire : prouve qu'un booléen « a des décimales » ne suffit pas |

**Trois règles d'hygiène multidevise :**

1. **Ne jamais additionner deux `Money` de devises différentes.** L'opération doit lever une
   exception, pas convertir implicitement.
   ```ts
   export function add(a: Money, b: Money): Money {
     if (a.currency !== b.currency) throw new CurrencyMismatchError(a.currency, b.currency);
     return money(a.minor + b.minor, a.currency);
   }
   ```
2. **XOF et XAF ne se mélangent pas**, malgré une parité identique à l'euro. Un restaurant
   ivoirien et un restaurant camerounais n'ont pas la même devise comptable.
3. **Un taux de change appliqué est figé dans la transaction** (taux, source, horodatage) :
   une conversion recalculée plus tard donne un autre résultat et casse la réconciliation.

---

## 8. Fiscalité et reçus — la facture normalisée

> ⚠️ **Limite majeure de cette section** : le portail officiel `www.fne.dgi.gouv.ci` n'a pas
> pu être atteint depuis l'environnement de recherche (échec TLS, puis HTTP 503), y compris
> le document `FNE-procedureapi.pdf` qui décrit la procédure d'interfaçage par API. Tout ce
> qui suit repose donc sur des **sources secondaires spécialisées et de la presse**, jamais
> sur le texte de la DGI lui-même. **Aucune ligne de code fiscal ne doit être écrite avant
> d'avoir lu la documentation officielle de la DGI.**

### 8.1 Côte d'Ivoire — FNE et RNE

**Base légale** ⚠️ :
- annexe fiscale à la loi de finances 2025, en vigueur au **10 janvier 2025** ;
- **arrêté n°0337 du 9 mai 2025** du Ministre des Finances et du Budget, fixant les modalités
  de mise en œuvre des systèmes **FNE et RNE** ;
- adossés aux **articles 384, 385 et suivants du CGI** et aux **articles 144 et suivants du
  Livre des Procédures Fiscales**
  ([CleoERP](https://cleoerp.com/fr/blog/fne-cote-divoire-guide-pratique-pme-2026) ;
  [Edicom](https://edicomgroup.com/blog/mandatory-e-invoicing-works-ivory-coast)).

**Calendrier** ⚠️ :

| Date | Événement |
|---|---|
| 24 février 2025 | Inscription obligatoire sur la plateforme |
| 21 juillet 2025 | Lancement officiel (Sofitel Abidjan Hôtel Ivoire) |
| **1er décembre 2025** | **Émission FNE obligatoire — régime normal (RNI)**, puis RME (11 déc.) et Entreprenant (22 déc.) |
| 25 février 2026 | 52 000+ entreprises inscrites |
| **1er septembre 2026** | **Début des contrôles informatiques FNE et RNE par la DGI** |

Sources : [Edicom](https://edicomgroup.com/blog/mandatory-e-invoicing-works-ivory-coast),
[CleoERP](https://cleoerp.com/fr/blog/fne-cote-divoire-guide-pratique-pme-2026),
[Yeclo](https://www.yeclo.com/facture-normalisee-electronique-en-cote-divoire-la-dgi-lance-des-controles-le-1er-septembre/),
[KOACI](https://www.koaci.com/article/2026/08/26/cote-divoire/economie/cote-divoire-operation-de-controle-de-la-facturation-normalisee-electronique-a-partir-du-1er-septembre-voici-les-entreprises-visees_199883.html).

⚠️ **L'obligation ne dépend pas de l'assujettissement à la TVA** : toutes les entreprises sont
concernées, y compris non assujetties
([Pulse CI](https://www.pulse.ci/article/facture-normalisee-electronique-fne-tout-ce-qui-change-pour-les-entreprises-ivoiriennes-en-2026-2026022802421220085)).
⚠️ La réforme est contestée par les commerçants (la FENACCI a demandé la suspension des
contrôles du 1er septembre) — le calendrier peut donc encore bouger
([KOACI](https://www.koaci.com/article/2026/08/30/cote-divoire/societe/cote-divoire-facturation-normalisee-electronique-la-fenacci-exige-la-suspension-des-controles-des-le-1er-septembre-et-rappelle-au-gouvernement-sa-promesse-de-concertation_200026.html)).

### 8.2 Le point décisif : **modèle de clearance**

⚠️ *« Invoices can only be delivered to customers once they have been authorized by the DGI »*
([Edicom](https://edicomgroup.com/blog/mandatory-e-invoicing-works-ivory-coast)).
⚠️ *« La facture doit être validée avant d'être remise au client »*
([CleoERP](https://cleoerp.com/fr/blog/fne-cote-divoire-guide-pratique-pme-2026)).

Une FNE conforme porte **cinq éléments** ⚠️ :

1. un **QR code** de certification, vérifiable depuis n'importe quel smartphone ;
2. le **visuel officiel FNE** ;
3. une **numérotation fiscale unique, générée en temps réel par la DGI** ;
4. un **sceau fiscal électronique** ;
5. une **signature électronique authentifiée**.

**Conséquence d'architecture, et elle est lourde** : trois des cinq éléments ne peuvent pas
être produits hors ligne. **Le document remis au client dépend d'un appel réseau à la DGI.**
Un logiciel de caisse qui suppose pouvoir imprimer seul est structurellement non conforme.

### 8.3 FNE vs RNE — et ce que ça change pour un restaurant

C'est **le point le plus important de cette section** pour ce produit.

| | **FNE** — Facture Normalisée Électronique | **RNE** — Reçu Numérique/Normalisé Électronique |
|---|---|---|
| Objet | Facturation commerciale, B2B, transactions formelles | **Ventes au détail B2C, paiement comptant / au comptoir** |
| Émission | Plateforme web, API/ERP, application FNE | **TPE / terminal, ou application RNE** |
| Nature | Facture | **« ticket de caisse dématérialisé »** |

⚠️ *« Le RNE est un document spécifiquement destiné aux reçus avec paiement en espèces ou
paiement au comptoir »* ; il est *« généré au point de vente via des terminaux ou
l'application RNE officielle »* et concerne *« les boutiques de détail, restaurants et
entreprises vendant aux consommateurs »*
([CleoERP](https://cleoerp.com/fr/blog/fne-cote-divoire-guide-pratique-pme-2026) ;
[Edicom](https://edicomgroup.com/blog/mandatory-e-invoicing-works-ivory-coast)).
⚠️ Pour les entreprises au **régime du forfait**, le RNE est émis via des terminaux physiques
appelés **TERNE**.

> **Un restaurant émet donc principalement des RNE, pas des FNE.** Et il émet des FNE quand il
> facture une entreprise (séminaire, cantine, traiteur). **Le produit doit gérer les deux.**

### 8.4 Ce que le produit a le droit d'appeler « reçu » et « facture »

C'est une question de responsabilité, pas de vocabulaire.

| Document | Ce que le produit peut en dire | Conditions |
|---|---|---|
| Ticket imprimé non certifié | **« Note »**, **« Ticket »**, **« Addition »**, *Bill*, *Order summary* | Toujours. Doit porter une mention claire du type *« Document interne — ne vaut pas reçu fiscal »* |
| Ticket certifié par la DGI | **« Reçu »** / **RNE** | Uniquement s'il porte numéro fiscal DGI + sceau + QR ⚠️ |
| Facture certifiée | **« Facture »** / **FNE** | Idem, et jamais avant validation DGI ⚠️ |

**Règle d'ingénierie** : dans le code, le document non certifié ne s'appelle **jamais**
`Invoice` ni `Receipt`. Il s'appelle `Bill` ou `Ticket`. Le jour où un développeur nommera un
type `Invoice` pour un document non certifié, un libellé « Facture » finira par s'afficher
devant un contrôleur de la DGI. Le nommage **est** la mesure de conformité.

### 8.5 L'abstraction fiscale — ne jamais coder en dur la règle ivoirienne

```ts
/** Ce que le domaine produit. Aucune notion de pays, aucune notion de DGI. */
export interface FiscalizableDocument {
  readonly kind: "sale" | "refund" | "void";
  readonly channel: "counter" | "table" | "online" | "b2b";
  readonly lines: readonly FiscalLine[];
  readonly totals: FiscalTotals;
  readonly payments: readonly { method: PaymentMethod; amount: Money }[];
  readonly buyer?: { taxId?: string; name?: string; address?: string };  // B2B
  readonly issuedAt: Date;
}

/** Ce que la juridiction rend. Les cinq éléments ivoiriens deviennent des champs optionnels. */
export interface FiscalStamp {
  readonly jurisdiction: string;            // "CI", "BJ", "SN", …
  readonly documentType: string;            // "FNE" | "RNE" | "MECEF" | "NONE"
  readonly fiscalNumber?: string;
  readonly seal?: string;
  readonly qrPayload?: string;
  readonly verificationUrl?: string;
  readonly certifiedAt?: Date;
  readonly raw: unknown;
}

export interface FiscalProvider {
  readonly jurisdiction: string;
  /** La juridiction impose-t-elle une validation AVANT remise au client ? */
  readonly requiresClearance: boolean;
  /** Le document non certifié peut-il être remis provisoirement ? (mode dégradé) */
  readonly allowsDeferredCertification: boolean;

  certify(doc: FiscalizableDocument, ctx: FiscalCtx): Promise<FiscalStamp>;
  /** Annulation / avoir — une transaction fiscalisée ne se supprime pas, elle se contre-passe. */
  cancel(stamp: FiscalStamp, reason: string, ctx: FiscalCtx): Promise<FiscalStamp>;
  /** Le libellé légal que l'UI a le droit d'afficher. Jamais une chaîne codée en dur ailleurs. */
  documentLabel(doc: FiscalizableDocument, locale: string): string;
}

/** Défaut pour toute juridiction sans obligation : le produit fonctionne sans fiscalisation. */
export class NoopFiscalProvider implements FiscalProvider {
  readonly jurisdiction = "*";
  readonly requiresClearance = false;
  readonly allowsDeferredCertification = true;
  async certify(): Promise<FiscalStamp> {
    return { jurisdiction: "*", documentType: "NONE", raw: null };
  }
  documentLabel() { return "Ticket"; }        // jamais "Facture"
}

/** Côte d'Ivoire. Un fichier, isolé, remplaçable. */
export class CiFneProvider implements FiscalProvider {
  readonly jurisdiction = "CI";
  readonly requiresClearance = true;          // ⚠️ modèle de clearance
  readonly allowsDeferredCertification = false; // ❌ à confirmer auprès de la DGI (§8.6)
  // RNE si channel ∈ {counter, table}, FNE si channel === "b2b" — décidé ICI, pas dans le domaine.
}
```

**Le test de qualité de cette abstraction** : ouvrir un restaurant au **Bénin** (§8.7) ne doit
demander qu'un `BjMecefProvider` et **zéro modification** de `Order`, `Bill` ou du module
paiement. Si le mot « FNE » apparaît hors de `CiFneProvider`, l'abstraction a fui.

### 8.6 Intégration technique — ce qui reste à établir

⚠️ Trois voies d'intégration existent : plateforme web (saisie manuelle), **API** vers l'ERP
ou le logiciel de facturation, et terminaux / application RNE
([CleoERP](https://cleoerp.com/fr/blog/fne-cote-divoire-guide-pratique-pme-2026)).
⚠️ L'API serait **REST en POST**, et une **procédure d'interfaçage par API (mai 2025)** est
publiée par la DGI : [`FNE-procedureapi.pdf`](https://www.fne.dgi.gouv.ci/documents/FNE-procedureapi.pdf)
— **❌ document non consultable depuis cet environnement.**

**❌ Cinq questions ouvertes, toutes bloquantes pour la conception :**

1. **L'éditeur de logiciel doit-il être agréé par la DGI ?** ⚠️ Des « éditeurs de solutions
   FNE » validés par la DGI sont mentionnés ([Kompto](https://kompto.com/GuideFNE)), sans que
   le caractère obligatoire de cet agrément soit établi. **C'est la question n°1** : elle
   décide si le produit peut certifier lui-même ou doit passer par un tiers agréé.
2. **Quelle authentification, quels endpoints, quel schéma de données ?** Non établis.
3. **Quel comportement en mode hors ligne ?** ⚠️ Des éditeurs annoncent une file d'attente
   locale synchronisée au retour du réseau — mais **rien n'indique que la DGI l'autorise**.
   Or un restaurant ivoirien perd son réseau. **Question n°2 par ordre d'importance.**
4. **Quelles mentions exactes, quel format de QR ?** Non établis.
5. **Quelle procédure d'annulation / avoir ?** Non établie.

**Sanctions** ⚠️ : rejet fiscal (la facture papier ne donne plus droit à déduction chez le
client), **perte de l'Attestation de Régularité Fiscale** — donc blocage de l'accès aux
marchés publics — et exposition accrue au contrôle
([CleoERP](https://cleoerp.com/fr/blog/fne-cote-divoire-guide-pratique-pme-2026) ;
[Pulse CI](https://www.pulse.ci/article/facture-normalisee-electronique-fne-tout-ce-qui-change-pour-les-entreprises-ivoiriennes-en-2026-2026022802421220085)).
⚠️ **Conservation : 6 à 10 ans** ([Edicom](https://edicomgroup.com/blog/mandatory-e-invoicing-works-ivory-coast)).

⚠️ **Secteurs exemptés** (à ne pas confondre avec la restauration, qui **n'en fait pas partie**) :
concessionnaires d'eau et d'électricité, compagnies aériennes, pharmacies, poste, banques,
assurances, stations-service (carburant seulement), entreprises non résidentes sans
installation professionnelle en Côte d'Ivoire.

### 8.7 Les autres pays de la feuille de route

**🇧🇯 Bénin — e-MECeF.** Le plus abouti de la région, et un excellent banc d'essai de
l'abstraction. ⚠️ Chaque facture est transmise **en temps réel** au serveur de la DGI, qui
renvoie un **NIM (Numéro d'Identification MECeF)** et un **QR code** ; *« Only once this step
is completed does the invoice become legally valid »*. Obligation étendue au régime TPS depuis
le 1er juillet 2021, couvrant IS, BIC, TPS et TVA
([Edicom Bénin](https://edicomgroup.com/blog/electronic-invoicing-benin-facture-normalisee) ;
portail officiel [e-mecef.impots.bj](https://e-mecef.impots.bj/) ;
[gouv.bj](https://www.gouv.bj/article/522/tout-savoir-sur-les-factures-normalisees-au-benin/)).
→ **Même forme que la CI** : clearance, numéro, QR. L'abstraction §8.5 couvre les deux.

**🇸🇳 Sénégal.** ⚠️ Digitalisation progressive par la **DGID** depuis 2024 pour les
contribuables au réel ; seuil de chiffre d'affaires souvent cité autour de **50 M FCFA** ;
conformité OHADA et suivi numérique des ventes
([Kolonell](https://kolonell.com/fr/blog/facturation-electronique-senegal-outils-2026)).
❌ **Aucune source officielle DGID consultée** — statut d'obligation à établir.

**🇨🇲 Cameroun.** ⚠️ Obligation de factures normalisées et sécurisées mentionnée, ❌ **aucune
source officielle consultée**. À instruire séparément (zone CEMAC, devise XAF, autre
administration).

**🇧🇫🇲🇱🇹🇬 Burkina, Mali, Togo.** ❌ **Non instruits** dans cette étude.

---

## 9. TVA, taxes et service charge

### 9.1 Les taux ivoiriens

✅ **TVA : taux normal 18 %, taux réduit 9 %.** *« VAT is a non-cumulative tax levied on the
sale of goods and services at the rate of 18 % »*, avec un taux réduit de 9 %
([PwC, *Ivory Coast — Corporate — Other taxes*](https://taxsummaries.pwc.com/ivory-coast/corporate/other-taxes),
page révisée le **9 septembre 2026**).

✅ **Le taux réduit de 9 % vise une liste limitative de PRODUITS** : lait (hors yaourts et
autres produits laitiers), laits infantiles et préparations alimentaires composées pour
nourrissons, riz de luxe, viandes importées hors CEDEAO, et pâtes alimentaires 100 % semoule
de blé dur (même source).

> **Conclusion pour la restauration** : les prestations de restauration **ne figurent pas**
> dans la liste du taux réduit → **taux normal 18 %**.
> ⚠️ **C'est une déduction par exclusion, pas une citation.** PwC ne traite pas explicitement
> la restauration. **À faire confirmer par un conseil fiscal ivoirien** avant de figer un
> défaut produit. Noter aussi la subtilité vicieuse : un restaurant vend des **produits**
> (bouteille d'eau à emporter) autant que des **prestations** — les deux peuvent ne pas suivre
> le même régime.

⚠️ **Et la liste bouge.** L'annexe fiscale 2026 (loi n°2025-987 du 19 décembre 2025, en
vigueur le 5 janvier 2026) puis l'**ordonnance n°2026-03 du 7 janvier 2026** ont basculé
certains biens du taux normal au taux réduit de 9 % à compter du **17 janvier 2026** —
aliments pour animaux, fibres de jute et sisal, intrants d'engrais
([Deloitte](https://blog.avocats.deloitte.fr/cote-divoire-les-principales-mesures-de-la-loi-de-finances-pour-2026/) ;
[Agence Ecofin](https://www.agenceecofin.com/actualites-agro/1901-134944-elevage-la-cote-d-ivoire-applique-desormais-une-tva-de-9-aux-aliments-pour-animaux)).

> **Cette instabilité est l'argument technique central de la section** : un taux de TVA n'est
> pas une constante, c'est **une donnée versionnée dans le temps**. Voir §9.4.

### 9.2 Les autres prélèvements

**AIRSI — Acompte d'Impôt sur le Revenu du Secteur Informel.** ⚠️ Taux standard **5 %**,
taux particuliers **2 %, 1,5 % et 0,2 %** selon les produits. Prélevé par un vendeur au
régime réel sur ses ventes à un acheteur **non soumis au régime réel** ; déductible de
l'impôt général sur le revenu de la même année. Hors champ notamment : ventes à des entreprises
au régime réel, à l'État et aux collectivités
([LinkedIn — analyse fiscale](https://www.linkedin.com/pulse/fiscalite-en-cote-divoire-acompte-dimp%C3%B4t-sur-revenu-du-bakary-diakit%C3%A9) ;
[Scribd — *Comprendre l'AIRSI*](https://www.scribd.com/document/488159155/AIRSI)).

> **Pertinence pour un restaurant** : l'AIRSI le concerne surtout **en amont** (ses achats
> auprès de fournisseurs informels — marché, maraîchers), et non sur ses ventes à des
> particuliers. ❌ **Aucune source officielle DGI consultée** ; toutes les sources trouvées sont
> secondaires. **À faire valider par un fiscaliste.**

✅ **Taxe sur les opérations bancaires : 10 %**, cumulative, sur les services bancaires rendus,
**entièrement déductible de la TVA collectée**
([PwC](https://taxsummaries.pwc.com/ivory-coast/corporate/other-taxes)).
→ Peut impacter le **coût réel des frais PSP**, si ceux-ci y sont soumis. ❌ À vérifier : les
commissions d'un établissement de paiement agréé entrent-elles dans l'assiette de cette taxe ?
⚠️ CinetPay indique que ses frais affichés sont **hors taxes**
([CGU CinetPay](https://cinetpay.com/legal/cgu-services)).

✅ Autres taxes relevées, sans effet direct en restauration : taxe spéciale de 3 % sur les
télécommunications ; communication audiovisuelle 20 000 XOF/heure de publicité diffusée par
des chaînes étrangères ; taxe sur les jeux 7 % (même source PwC).

❌ **Non trouvé** : taxe de séjour / taxe touristique applicable à la restauration, taxe
spécifique restauration, taxe communale sur les débits de boissons. **À instruire.**

### 9.3 Prix TTC ou HT — la question qu'on ne doit pas trancher dans le code

En restauration africaine francophone, **le prix affiché au menu est le prix payé**, TTC. Le
client lit « Attiéké poisson — 3 500 F » et donne 3 500 F.

Mais le même produit facturé à une entreprise pour un séminaire s'exprime souvent en HT.

**Donc le produit doit gérer les deux, et la seule décision saine est de choisir un
stockage canonique unique** :

> **Stocker le prix catalogue en TTC** (c'est ce que le restaurateur saisit et ce que le client
> voit) **et dériver le HT**, plutôt que l'inverse.

Raison : dériver le TTC depuis un HT arrondi produit des prix de menu absurdes (3 499 F), et
oblige le restaurateur à faire de l'arithmétique inverse pour obtenir un prix rond. Le sens
de dérivation doit suivre le sens de la saisie humaine.

```ts
export interface TaxRate {
  readonly code: string;            // "TVA_CI_STD"
  readonly label: string;           // "TVA 18 %"
  readonly jurisdiction: string;    // "CI"
  /** Points de base : 18 % -> 1800. Jamais un float. */
  readonly rateBps: number;
  readonly includedInPrice: boolean;   // true = prix catalogue TTC
  readonly validFrom: Date;            // §9.4 : un taux est daté
  readonly validTo?: Date;
}

/** Extraction depuis un prix TTC. Arrondi au niveau du DOCUMENT, pas de la ligne (§7.4). */
export function splitFromGross(gross: Money, rateBps: number): { net: Money; tax: Money } {
  const d = 10_000n + BigInt(rateBps);
  // Arrondi au demi supérieur, en entiers — jamais de Math.round sur un float.
  const net = (gross.minor * 10_000n + d / 2n) / d;
  return {
    net: money(net, gross.currency),
    tax: money(gross.minor - net, gross.currency),   // la taxe absorbe le reste : Σ = total exact
  };
}
```

Le détail qui compte : **la taxe est calculée par différence**, pas indépendamment. C'est ce
qui garantit `net + tax === gross` à l'unité près, toujours, sans ligne d'ajustement fantôme.

### 9.4 Modéliser plusieurs taxes — et le temps

Trois exigences, dans l'ordre de difficulté :

1. **Plusieurs taxes par ligne.** Un cocktail peut porter TVA + un droit d'accise ✅ (la CI
   applique des droits d'accise sur les boissons — PwC). Donc `taxes: TaxRate[]`, jamais
   `taxRate: number`.
2. **Taxes cumulatives ou en cascade.** ✅ La taxe sur les opérations bancaires est explicitement
   *« cumulative »*. Le moteur doit savoir composer, pas seulement additionner.
3. **Les taux sont datés.** Démontré en §9.1 : la CI a modifié sa liste de taux réduits en
   janvier 2026, avec effet au 17 janvier 2026. **Un ticket réimprimé six mois plus tard doit
   afficher le taux en vigueur au moment de la vente**, pas le taux courant.

```ts
export interface TaxEngine {
  /** Le taux est résolu POUR UNE DATE. Jamais "le taux actuel". */
  resolve(item: MenuItem, ctx: { jurisdiction: string; at: Date; channel: Channel }): readonly TaxRate[];
  compute(lines: readonly OrderLine[], at: Date): FiscalTotals;
}
```

> **Règle absolue** : `18` n'apparaît nulle part dans le code. Le taux vit en base, daté, par
> juridiction, éditable sans déploiement. Le seul endroit où un taux ivoirien peut être écrit
> est un **jeu de données de démarrage** (`seed`), clairement identifié comme tel.

### 9.5 Service charge

❌ **Non vérifié** : je n'ai trouvé **aucune source** établissant l'existence d'un « service
compris » obligatoire, d'un pourcentage usuel, ou d'un encadrement légal du service charge en
restauration ivoirienne.

Ce qui peut néanmoins être affirmé sur le plan de la conception, indépendamment du droit :
**le service charge et le pourboire ne sont pas la même chose et ne doivent pas partager le
même champ.**

| | Service charge | Pourboire (§10) |
|---|---|---|
| Nature | **Imposé** par l'établissement | **Volontaire**, décidé par le client |
| Montant | Connu avant la commande | Connu au paiement |
| Assiette TVA | ⚠️ **Probablement incluse** — ❌ à confirmer | ❌ à confirmer |
| Modélisation | `OrderLine` de type `service_charge`, taxable | Ligne de paiement distincte, hors total commande |

```ts
export interface ServiceChargeRule {
  readonly enabled: boolean;                 // désactivé par défaut
  readonly basis: "percentage" | "fixed";
  readonly valueBps?: number;
  readonly fixed?: Money;
  readonly appliesTo: readonly Channel[];    // souvent : salle oui, à emporter non
  readonly minGuests?: number;               // usage courant : groupes ≥ 6
  readonly taxable: boolean;                 // ❌ à confirmer pour la CI
  readonly labelOnBill: string;              // doit être VISIBLE sur la note
}
```

**Défaut produit recommandé : désactivé.** Une option activable est une décision du
restaurateur ; une option activée par défaut est une décision que l'éditeur prend à sa place —
et qui, si elle est fiscalement incorrecte, l'engage.

---

## 10. Pourboires

### 10.1 Ce qui est établi, et ce qui ne l'est pas

⚠️ La pratique existe : les pourboires en Côte d'Ivoire se situeraient **entre 1 000 et
5 000 FCFA**, donnés selon la qualité du service
([Femmexpat](https://www.femmexpat.com/expatriation/pourboires-dans-le-monde-guide-des-bonnes-manieres/)).

❌ **Non vérifié, malgré recherche** :
- l'existence d'une pratique du **« service compris »** en restauration ivoirienne ;
- un **pourcentage usuel** (les 15–20 % nord-américains ne sont manifestement pas la norme,
  les montants cités étant forfaitaires) ;
- tout **encadrement légal** du pourboire en droit du travail ivoirien (propriété, répartition,
  déclaration, assiette sociale) ;
- le **traitement TVA** d'un pourboire volontaire.

**Ce dernier point mérite d'être dit clairement** : dans beaucoup de juridictions, un pourboire
réellement volontaire et remis au personnel est hors du champ de la TVA, alors qu'un service
charge imposé y entre. ❌ **Je n'ai pas pu vérifier que c'est le cas en Côte d'Ivoire.** Le
produit ne doit donc pas coder d'hypothèse.

### 10.2 Ce que le pourboire implique côté produit

**Contrainte technique dominante, et elle est décisive** : en mobile money, **le client paie
un montant exact, fixé à l'avance**. Il n'existe aucun équivalent de la pré-autorisation carte
que l'on ajuste au moment de la capture.

> **Donc le pourboire doit être choisi AVANT la création de l'intention de paiement**, pas
> après. Un écran « ajouter un pourboire ? » placé après le paiement est inutilisable sur le
> rail principal du marché.

```ts
export interface TipPolicy {
  readonly enabled: boolean;
  readonly promptAt: "before_payment";         // la seule valeur viable en mobile money
  /** Montants FORFAITAIRES, pas des pourcentages : c'est l'usage observé (1 000–5 000 F) ⚠️ */
  readonly suggestions: readonly Money[];
  readonly allowCustom: boolean;
  readonly allowRoundUp: boolean;              // "arrondir à 13 000 F" : geste naturel
  readonly attribution: "server" | "pool" | "house";
  /** ❌ à confirmer en CI. Faux par défaut = choix prudent, pas choix informé. */
  readonly taxable: boolean;
}
```

**Cinq règles de conception :**

1. **Le pourboire est une ligne distincte, hors du total de la commande.** Il ne doit modifier
   ni le chiffre d'affaires, ni l'assiette de taxe, tant que §10.1 n'est pas levé.
2. **Il est attribué nominativement** au serveur au moment de l'encaissement. Sans cela, aucune
   répartition honnête n'est possible, et le pourboire devient un vecteur de conflit interne.
3. **L'arrondi supérieur est le geste le plus naturel** dans une devise sans sous-unité :
   12 300 → 13 000 se comprend sans calcul. À proposer en premier, avant les montants fixes.
4. **Le pourboire en espèces existe et échappe au système.** Ne pas prétendre le mesurer ; ne
   pas bâtir de rémunération variable sur un total de pourboires forcément incomplet.
5. **Le pourboire encaissé électroniquement arrive sur le compte du restaurant, pas du
   serveur.** Il crée donc une **dette de l'établissement envers son personnel** — donc une
   ligne de suivi, et un moment de reversement. ❌ Les obligations légales associées (délai,
   charges sociales, mentions sur le bulletin de paie) **ne sont pas établies** et doivent
   l'être avant d'activer la fonctionnalité.

**Défaut produit recommandé : désactivé**, pour la même raison qu'en §9.5.

---

## 11. Risques et fraudes

### 11.1 Remboursement abusif

**Le risque.** Un employé rembourse une vente réelle payée en espèces, garde l'argent, et le
système montre une transaction annulée régulière.

**Ce qui l'aggrave dans ce contexte** : ⚠️ le remboursement mobile money n'est souvent pas
possible au niveau du rail (§1.3). Le « remboursement » se fait donc **en espèces sortant du
tiroir**, sans trace côté fournisseur. C'est le scénario le plus dangereux du produit.

**Parades :**

- **Aucun remboursement anonyme** : identité, motif obligatoire (liste fermée + texte libre),
  horodatage, appareil.
- **Seuil de double validation** : au-delà d'un montant ou d'un délai post-vente configurables,
  approbation d'un responsable — **sur son propre compte**, pas « le gérant tape son code sur
  la caisse du serveur ».
- **Le remboursement ne supprime jamais la vente** : il crée une **transaction de sens inverse**
  liée. Le journal est append-only. ⚠️ C'est aussi une exigence fiscale plausible en régime de
  clearance (§8.5, `FiscalProvider.cancel`).
- **Détection statistique** : taux de remboursement par employé, par heure, par moyen de
  paiement. Un serveur à 6 % de remboursements quand la maison est à 0,5 % se voit sans
  enquête.
- **Remboursement d'une vente mobile money vers un moyen différent** (donc en espèces) :
  toujours signalé, jamais silencieux.

### 11.2 Écart de caisse

**Sources principales, par ordre de fréquence** : erreur de rendu de monnaie, vente non
enregistrée, **TPE externe attesté sans rapprochement** (§1.5), remboursement fictif (§11.1).

**Parades :**

- **Session de caisse nominative** : ouverture avec fonds de caisse déclaré, fermeture avec
  comptage physique. Un tiroir, un responsable, une plage horaire.
- **Comptage à l'aveugle** : l'employé saisit le montant compté **avant** que le système
  n'affiche le théorique. Sinon on ne mesure plus rien — on mesure la capacité à recopier.
- **Écart par moyen de paiement**, jamais un écart global : un écart de 5 000 F sur les
  espèces et de −5 000 F sur le TPE externe n'est pas « zéro écart », c'est une erreur de
  ventilation qui masque peut-être deux erreurs distinctes.
- **Les encaissements `verifiable: false`** (espèces, TPE externe) sont **comptés et présentés
  séparément** : ce sont les seuls que le système ne peut pas prouver.
- **Aucun écart n'est effacé.** Il est expliqué, justifié, conservé.

### 11.3 Double encaissement

**Le risque.** Le client paie, l'écran ne confirme pas (§6.6), le serveur redemande. Le client
paie deux fois. C'est un incident de **relation client**, et il détruit la confiance envers le
logiciel en une fois.

**Parades, par ordre d'efficacité :**

- **Clé d'idempotence stable** (§6.2), pas régénérée à chaque rendu d'écran.
- **Une seule intention active par addition** : tant qu'un paiement est `PENDING` ou
  `UNRESOLVED`, l'interface refuse d'en créer un second et propose « vérifier l'état ».
- ✅ **`restrict_payer_mobile`** chez Wave verrouille la session sur un numéro
  ([docs.wave.com/checkout](https://docs.wave.com/checkout)) — utile pour empêcher qu'un lien
  traîne et soit payé par quelqu'un d'autre.
- **Détection de sur-encaissement** : si la somme des `SUCCEEDED` dépasse le total de
  l'addition, alerte immédiate et procédure de remboursement, sans attendre la clôture.
- **Écran d'attente explicite** côté serveur : *« Paiement en cours de confirmation — ne pas
  redemander »*, avec l'état visible. Une grande partie des doubles encaissements vient de
  l'absence de réponse visuelle, pas d'une faille technique.

### 11.4 Paiement partiel non réconcilié

**Le risque.** Une table partage l'addition en quatre ; trois paiements réussissent, le
quatrième reste `UNRESOLVED`. La table est libérée, l'addition reste ouverte pour 3 500 F.

**Parades :**

- **Le paiement partiel est un cas nominal**, modélisé dès le départ : une addition a *n*
  paiements, et `Σ payments ≤ total` est un invariant.
- **Le reste dû est toujours calculé, jamais stocké** — un champ `remaining` dénormalisé
  finira par diverger.
- **Une addition partiellement réglée ne se ferme pas silencieusement.** Elle apparaît dans la
  clôture de service comme *« à résoudre »*, avec la table, l'heure et le serveur.
- **Le filet 5** (§6.6) rattrape le retardataire ; s'il a effectivement payé, l'addition se
  solde toute seule, avant la clôture comptable.

### 11.5 Collusion serveur / client

**Le risque.** Le serveur encaisse en espèces, annule la commande avant envoi en cuisine, ou
applique une remise à un complice. Perte invisible côté trésorerie, visible seulement au stock.

**Parades :**

- **Les remises sont un objet, pas une saisie libre** : motifs fermés, plafonds par rôle,
  traçabilité nominative.
- **L'annulation après envoi en cuisine est un événement à part**, toujours motivé, toujours
  visible dans le rapport de service — parce qu'elle a consommé de la matière.
- **Rapprochement ventes / stock** : c'est le seul contrôle qui attrape une vente jamais
  enregistrée. 40 bouteilles sorties, 34 vendues.
- **Statistiques comportementales** : annulations et remises par employé, part des espèces par
  employé à service comparable, ventes juste avant la clôture de session.
- **Journal inviolable** : append-only, horodaté, avec appareil et session. Rien ne se modifie
  a posteriori, tout se contre-passe.

### 11.6 Risques propres au fournisseur

| Risque | Mitigation |
|---|---|
| **Retard de reversement** ⚠️ (§3.1) | Métrique `settlement_overdue` (§6.7) exposée au restaurateur, **seuil d'alerte**, et capacité à basculer de provider **par configuration en base** (§5.7) |
| **Webhook forgé** | Signature vérifiée, corps brut, comparaison en temps constant, et surtout **`verify()` systématique** (§6.3) |
| **Rejeu de webhook** | Contrainte d'unicité en base + fenêtre d'horodatage quand le fournisseur la fournit ✅ (Wave : 5 min) |
| **Panne du fournisseur** | Routage multi-provider (§5.7), repli sur espèces, et surtout : `UNRESOLVED` ne bloque pas le service (§5.6) |
| **Fuite de secrets** | Secrets **par tenant et par pays** (✅ une clé Wave SN ne vaut pas en CI), jamais dans le dépôt, rotation prévue — ✅ Wave gère plusieurs `v1` en parallèle précisément pour la rotation |
| **Données de carte** | **Ne jamais stocker, ni transmettre, ni journaliser un PAN, un CVV ou une piste.** Redirection ou champ hébergé, exclusivement. ✅ PayDunya réserve d'ailleurs son API carte directe (SOFTPAY) aux entreprises **certifiées PCI-DSS** ([doc](https://developers.paydunya.com/doc/FR/softpay)) — c'est le signal qu'il ne faut pas s'engager sur ce terrain |

---

## 12. Ce qui n'a pas pu être vérifié

Récapitulatif des lacunes, par ordre d'impact sur la conception.

### Bloquant avant d'écrire du code

| # | Point | Pourquoi c'est bloquant |
|---|---|---|
| 1 | **Spécification technique de l'API FNE/RNE de la DGI** (`fne.dgi.gouv.ci` inaccessible) | Décide de la forme de `CiFneProvider`, et donc du parcours d'encaissement |
| 2 | **L'éditeur de logiciel doit-il être agréé par la DGI ?** | Décide si le produit peut certifier lui-même ou doit dépendre d'un tiers |
| 3 | **Mode hors ligne autorisé en FNE/RNE ?** | Un restaurant perd son réseau. Si la clearance est stricte, le produit doit refuser d'imprimer — décision majeure |
| 4 | **Statut GA de Paystack en Côte d'Ivoire** (bêta ou disponibilité générale) | Décide du fournisseur n°2 |
| 5 | **Tarif marchand Wave en CI** (le 1 % n'est pas confirmé par une source officielle Wave) | Décide de l'économie du fournisseur n°1 |

### À lever avant la mise en production

| # | Point |
|---|---|
| 6 | **Tarifs officiels** de CinetPay, Hub2, PayDunya (grille en image), Flutterwave mobile money franco, KkiaPay, FedaPay, Semoa |
| 7 | **Signature des webhooks Hub2** — non documentée sur la page consultée |
| 8 | **Statut réglementaire BCEAO** de Paystack, Hub2, PayDunya, Flutterwave en Côte d'Ivoire (aucun sur la liste des 9 établissements de paiement agréés) |
| 9 | **Résolution effective** de l'arriéré de reversement CinetPay (déclarations contradictoires DPay / CinetPay) |
| 10 | **Délais de règlement** contractuels de chaque PSP (aucun n'est documenté publiquement de façon fiable) |
| 11 | **TVA applicable à la restauration en CI** — déduite par exclusion, jamais citée explicitement |
| 12 | **AIRSI** — seules des sources secondaires trouvées, aucune source DGI |
| 13 | **Assiette TVA du service charge et du pourboire** en CI |
| 14 | **Licence EME de Wave** auprès de la BCEAO (source secondaire uniquement) |
| 15 | **Moov Money est-il supporté par Paystack CI ?** — sources contradictoires |
| 16 | **Commissions PSP soumises à la taxe de 10 % sur opérations bancaires ?** |

### Hors périmètre de cette étude

| # | Point |
|---|---|
| 17 | **Pourboire** : usage du « service compris », pourcentage usuel, encadrement légal, régime social — aucune source fiable trouvée |
| 18 | **Arrondi au multiple de 5 F en espèces** — pratique évoquée, aucune source officielle |
| 19 | **Obligations e-facture au Sénégal, Cameroun, Burkina, Mali, Togo** — non instruites ou sources secondaires uniquement |
| 20 | **Sort des filiales africaines de Bizao** après la liquidation de la maison mère |
| 21 | **Taxes locales/communales** applicables à la restauration en CI |
| 22 | **Détails techniques Orange Money Web Payment** (OAuth, endpoints, callback) |
| 23 | **Impact opérationnel de PI-SPI** sur les intégrations PSP après le 30 juin 2026 |

---

## 13. Décisions proposées (candidates à des ADR)

| # | Décision | Renvoi |
|---|---|---|
| **D1** | Les montants sont des **entiers d'unités mineures ISO 4217** + code devise. Facteur d'échelle dérivé de l'exposant, jamais écrit en dur. `BIGINT` en base, `bigint` en TS. **Aucun `float`.** | §7.3 |
| **D2** | Le domaine ne connaît **aucun nom de fournisseur**. Routage par **capabilities**, préférences **en base**. | §5.1, §5.7 |
| **D3** | **Les espèces et le TPE externe sont des `PaymentProvider`**, pas des cas particuliers. | §5.8 |
| **D4** | **Un webhook déclenche `verify()`. Il n'écrit jamais l'état final.** | §6.3 |
| **D5** | Double idempotence : **clé client stable** + **clé fournisseur déterministe**. | §6.2 |
| **D6** | `UNRESOLVED` est un état de première classe. **Il ne bloque jamais le service.** | §5.6, §6.6 |
| **D7** | Les effets de bord sont déclenchés par une **transition d'état appliquée**, jamais par la réception d'un message. C'est ce qui rend le rejeu sûr. | §6.5 |
| **D8** | Réconciliation à trois niveaux, dont une métrique **`settlement_overdue`** exposée au restaurateur. | §6.7 |
| **D9** | **Abstraction fiscale par juridiction**, `NoopFiscalProvider` par défaut. Aucune règle ivoirienne hors de `CiFneProvider`. | §8.5 |
| **D10** | Dans le code, un document non certifié s'appelle **`Bill`/`Ticket`**, jamais `Invoice` ni `Receipt`. | §8.4 |
| **D11** | Les **taux de taxe sont des données datées** en base, par juridiction. `18` n'apparaît pas dans le code. | §9.4 |
| **D12** | Prix catalogue **stocké TTC**, HT dérivé, taxe calculée **par différence**. | §9.3 |
| **D13** | **Pourboire et service charge désactivés par défaut**, et pourboire demandé **avant** la création du paiement. | §9.5, §10.2 |
| **D14** | **Aucune donnée de carte** n'est stockée, transmise ou journalisée. Redirection ou champ hébergé uniquement. | §11.6 |
| **D15** | Ordre de branchement : **`CashProvider` → Wave CI → agrégateur** (Paystack CI si GA confirmé, sinon Hub2). CinetPay implémenté mais **jamais en rail unique**. | §5.9 |

---

## Sources

Toutes consultées le **2026-09-17**.

**Fournisseurs — documentation officielle**
- Wave — [Business API](https://docs.wave.com/business) · [Checkout API](https://docs.wave.com/checkout) · [Webhooks](https://docs.wave.com/webhook) · [Commissions CI](https://www.wave.com/2022/05/commission_sf_wave_ci.html) · [CGU](https://www.wave.com/en/terms_gm/)
- CinetPay — [SDK PHP officiel](https://github.com/cinetpay/cinetpay-php-sdk/blob/master/README.md) · [GitHub](https://github.com/cinetpay) · [CGU services](https://cinetpay.com/legal/cgu-services) · doc (⚠️ bloquée au proxy) : [initialisation](https://docs.cinetpay.com/api/1.0-fr/checkout/initialisation), [HMAC](https://docs.cinetpay.com/api/1.0-en/checkout/hmac), [notification](https://docs.cinetpay.com/api/1.0-fr/checkout/notification)
- Hub2 — [Intégration paiements](https://docs.hub2.io/integration/en/payments/payments_integration) · [Pay-In API](https://www.hub2.io/hub2-pay-in-api/)
- Paystack — [Pay with Mobile Money](https://support.paystack.com/en/articles/2128386) · [Countries](https://paystack.com/countries) · [Bêta CI/Rwanda/Égypte](https://paystack.com/blog/company-news/civ-rwanda-egypt-beta) · [Virtual Terminal](https://paystack.com/blog/product/virtual-terminal-expansion) · [API](https://paystack.com/docs/api/)
- PayDunya — [Doc développeur](https://developers.paydunya.com/) · [SOFTPAY](https://developers.paydunya.com/doc/FR/softpay) · [Tarifs](https://paydunya.com/service-fees)
- Flutterwave — [Mobile money francophone](https://developer.flutterwave.com/v3.0/reference/charge-via-francophone-mobile-money)
- KkiaPay — [Doc](https://docs.kkiapay.me/v1) · [Webhook](https://docs.kkiapay.me/v1/tableau-de-bord/webhook)
- FedaPay — [Gestion des collectes](https://docs.fedapay.com/integration-api/fr/collects-management-fr)
- Orange — [Orange Money Web Payment](https://developer.orange.com/apis/om-webpay)
- MTN — [MoMo Developer Portal](https://momodeveloper.mtn.com/API-collections)
- Semoa — [Documentation](https://semoa-group.com/documentation/) · [CashPay](https://semoa-group.com/semoa-group/cashpay/)
- Stripe — [Currencies](https://docs.stripe.com/currencies) · [Global](https://stripe.com/global)

**Devises**
- [Adyen — Currency codes and minor units](https://docs.adyen.com/development-resources/currency-codes) · [Datatrans](https://docs.datatrans.ch/docs/currency-codes) · [ISO 4217 (Wikipédia)](https://en.wikipedia.org/wiki/ISO_4217) · [XOF has no minor unit (dev.to)](https://dev.to/catidegla/xof-has-no-minor-unit-and-always-store-money-in-cents-overcharges-by-100x-3fhk)

**Réglementation**
- BCEAO — [Instruction n°001-01-2024 (PDF)](https://www.bceao.int/sites/default/files/inline-files/Instruction-No001-01-2024_relative_aux_services_de_paiement_dans_l-UMOA.pdf) · [Lancement PI-SPI](https://www.bceao.int/fr/content/lancement-officiel-de-la-plateforme-interoperable-du-systeme-de-paiement-instantane-pi-spi) · [Connexion PI-SPI](https://www.bceao.int/fr/communique-presse/connexion-la-plateforme-interoperable-du-systeme-de-paiement-instantane-pi-spi-de) · [EME](https://www.bceao.int/fr/content/etablissements-de-monnaie-electronique)
- [Trésor CI — 31 agréments dont 9 en CI](https://tresor.gouv.ci/tres/espace-uemoa-monnaie-electronique-la-bceao-agree-31-nouveaux-etablissements-dont-09-en-cote-divoire/) · [Agence Ecofin — interopérabilité au 30 juin 2026](https://www.agenceecofin.com/actualites-finance/0304-137266-uemoa-l-interoperabilite-des-paiements-devient-obligatoire-au-30-juin-2026) · [finself.ci — agrément PSP](https://finself.ci/demande-d-agrement-prestataire-de-service-de-paiement/)
- GIM-UEMOA — [FAQ](https://www.gim-uemoa.org/fr/faq) · [Monétique interbancaire (BCEAO)](https://www.bceao.int/fr/content/monetique-interbancaire-regionale)

**Fiscalité**
- PwC — [Ivory Coast, Corporate, Other taxes](https://taxsummaries.pwc.com/ivory-coast/corporate/other-taxes) *(révisé le 09/09/2026)*
- Deloitte — [Loi de finances CI 2026](https://blog.avocats.deloitte.fr/cote-divoire-les-principales-mesures-de-la-loi-de-finances-pour-2026/)
- FNE/RNE — [Edicom CI](https://edicomgroup.com/blog/mandatory-e-invoicing-works-ivory-coast) · [CleoERP](https://cleoerp.com/fr/blog/fne-cote-divoire-guide-pratique-pme-2026) · [Kompto](https://kompto.com/GuideFNE) · [Pulse CI](https://www.pulse.ci/article/facture-normalisee-electronique-fne-tout-ce-qui-change-pour-les-entreprises-ivoiriennes-en-2026-2026022802421220085) · [Yeclo](https://www.yeclo.com/facture-normalisee-electronique-en-cote-divoire-la-dgi-lance-des-controles-le-1er-septembre/) · [KOACI — contrôles](https://www.koaci.com/article/2026/08/26/cote-divoire/economie/cote-divoire-operation-de-controle-de-la-facturation-normalisee-electronique-a-partir-du-1er-septembre-voici-les-entreprises-visees_199883.html) · [KOACI — FENACCI](https://www.koaci.com/article/2026/08/30/cote-divoire/societe/cote-divoire-facturation-normalisee-electronique-la-fenacci-exige-la-suspension-des-controles-des-le-1er-septembre-et-rappelle-au-gouvernement-sa-promesse-de-concertation_200026.html)
- ⚠️ **Inaccessibles** : [portail FNE DGI](https://www.fne.dgi.gouv.ci/) · [procédure API FNE (PDF)](https://www.fne.dgi.gouv.ci/documents/FNE-procedureapi.pdf)
- Bénin — [Edicom](https://edicomgroup.com/blog/electronic-invoicing-benin-facture-normalisee) · [e-MECeF officiel](https://e-mecef.impots.bj/) · [gouv.bj](https://www.gouv.bj/article/522/tout-savoir-sur-les-factures-normalisees-au-benin/)
- Sénégal — [Kolonell](https://kolonell.com/fr/blog/facturation-electronique-senegal-outils-2026)
- AIRSI — [analyse LinkedIn](https://www.linkedin.com/pulse/fiscalite-en-cote-divoire-acompte-dimp%C3%B4t-sur-revenu-du-bakary-diakit%C3%A9) · [Scribd](https://www.scribd.com/document/488159155/AIRSI)

**Marché**
- [GSMA — State of the Industry Mobile Money 2026](https://www.gsma.com/sotir/) · [Connecting Africa](https://www.connectingafrica.com/mobile-money/-1-4t-flowed-through-mobile-money-in-sub-saharan-africa-in-2025-gsma)
- [MicroSave — Price wars, Côte d'Ivoire](https://www.microsave.net/2022/05/24/price-wars-and-agent-motivation-in-rural-areas-of-cote-divoire/) · [Capmad — T1 2026](https://www.capmad.com/post/driven-by-mobile-money-cote-divoires-telecom-market-reaches-351-billion-cfa-francs-in-q1-2026) · [TriplePundit — Wave CI](https://triplepundit.com/2025/wave-mobile-money-cote-divoire/)
- [Boldrails — Gateways CI 2026](https://boldrails.com/blog/best-payment-gateways-cote-divoire) · [Boldrails — Orange Money vs Wave](https://boldrails.com/blog/orange-money-vs-wave) · [Kolonell — Wave Business API](https://kolonell.com/en/blog/wave-business-api-integration-guide-2026-en) · [Pandore — UEMOA](https://pandore.co/en/paiement-en-ligne-uemoa-les-meilleures-solutions-en-2025/) · [Pandore — frais fintechs](https://pandore.co/en/les-frais-de-transactions-de-5-fintechs-en-afrique/) · [mctaba — Paystack CI](https://www.mctaba.com/learn/paystack/payment-methods-available-on-paystack-in-cote-d-ivoire) · [kkiapay — QR marchand](https://kkiapay.me/encaisser-qr-code-mobile-money/)

**Incidents**
- CinetPay — [TechCabal, 01/02/2026](https://techcabal.com/2026/02/01/cinetpay-cyberattack/) · [Financial Afrik, entretien du DG, 25/03/2026](https://www.financialafrik.com/2026/03/25/entretien-exclusif-avec-daniel-dindji-directeur-general-de-cinetpay/) · [Socialnetlink](https://www.socialnetlink.org/2026/02/06/apres-une-cyberattaque-cinetpay-doit-plus-dun-milliard-de-francs-cfa-a-des-partenaires-selon-d-pay/)
- Bizao — [Launch Base Africa — liquidation](https://launchbaseafrica.com/2025/06/18/french-court-orders-compulsory-liquidation-of-ivorian-founded-fintech-bizao/) · [CIO Mag — redressement](https://cio-mag.com/bizao-plateforme-de-paiement-digital-en-afrique-entre-en-procedure-de-redressement-judiciaire/) · [Pappers](https://www.pappers.fr/entreprise/bizao-850323635)

---

*Document de recherche — `docs/research/payments-africa.md`. Sources consultées le 2026-09-17.
Les tarifs, couvertures et règles fiscales de cette région évoluent vite : revérifier avant
tout engagement contractuel ou toute écriture de code fiscal.*
