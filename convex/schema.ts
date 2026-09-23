/**
 * Schéma Convex — Joliba
 *
 * Ce fichier est écrit APRÈS `DATA_MODEL.md` (§113 du brief) et doit lui rester fidèle :
 * toute table ajoutée ici sans entrée dans DATA_MODEL.md est un défaut bloquant en revue.
 *
 * Trois règles tiennent tout le reste :
 *
 *  1. PORTÉE — toute fonction publique résout la portée DEPUIS L'APPELANT avant de toucher
 *     une donnée, et tout document atteint par clé étrangère est re-vérifié contre cette
 *     portée (`order.venueId === args.venueId`). C'est CELA qui protège du franchissement
 *     de tenant, pas la forme des index.
 *     Un index n'a besoin d'un préfixe de portée que s'il est atteignable directement par
 *     un identifiant FOURNI PAR LE CLIENT sans garde préalable ; ceux-là portent la marque
 *     `SCOPE-CRITIQUE`. Les autres sont atteints après une garde, et y ajouter `venueId`
 *     n'apporterait aucune sécurité — seulement du stockage.
 *     Une table scopée par un `venueId` OBLIGATOIRE ne porte PAS `organizationId` : il se
 *     dérive de `venues.organizationId`, qui fait seul autorité. Le recopier créerait une
 *     ligne capable de se contredire elle-même — une fuite de tenant que ni index, ni
 *     garde, ni test n'attrape. Seules les tables sans venue, ou dont la venue est
 *     facultative, portent `organizationId`.
 *  2. ARGENT — un montant est un ENTIER dans l'unité mineure de sa devise, accompagné de son
 *     code devise. Le XOF a un exposant décimal de 0 : 5 000 FCFA se stocke `5000`.
 *     Aucun flottant ne touche jamais un montant.
 *  3. IMMUABILITÉ — ce qui a une conséquence financière est figé au moment de l'acte
 *     (snapshots) et ne se supprime pas (statuts, jamais `delete`).
 *
 * Better Auth détient l'authentification dans ses propres tables (composant Convex).
 * La souveraineté du tenant est ICI, pas dans Better Auth (D-016).
 */

import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";
import { venueType } from "./lib/validators";

/* ────────────────────────────────────────────────────────────────────────────
 * Validateurs partagés
 * ──────────────────────────────────────────────────────────────────────────── */

/** Montant entier en unité mineure. Voir règle 2. */
const money = v.number();

/** Traductions intégrées : toujours lues avec leur parent, jamais en table séparée. */
const i18nText = v.record(
  v.string(),
  v.object({ name: v.optional(v.string()), description: v.optional(v.string()) }),
);

const orderingMode = v.union(
  v.literal("staff_only"),
  v.literal("guest_with_approval"),
  v.literal("guest_direct"),
  v.literal("hybrid"),
);

const paymentTiming = v.union(
  v.literal("post_paid"),
  v.literal("pre_paid"),
  v.literal("per_order"),
);

const qrStrategy = v.union(
  v.literal("frictionless"),
  v.literal("table_activation"),
  v.literal("approval"),
  v.literal("presence_code"),
);

const paymentMethod = v.union(
  v.literal("cash"),
  v.literal("mobile_money"),
  v.literal("card"),
  v.literal("external_terminal"),
  v.literal("transfer"),
  v.literal("other"),
);

const actorType = v.union(
  v.literal("guest"),
  v.literal("staff"),
  /** Un appareil sans humain identifié : l'écran de cuisine (D-060). */
  v.literal("device"),
  v.literal("system"),
  v.literal("ai"),
  v.literal("platform"),
);

/** Snapshot d'un supplément choisi. Intégré à la ligne : immuable, jamais joint. */
const modifierSnapshot = v.object({
  groupName: v.string(),
  optionName: v.string(),
  priceDelta: money,
});

/** Snapshot d'une taxe au moment de la commande. Le taux du jour, pas celui d'aujourd'hui. */
const taxSnapshot = v.object({
  code: v.string(),
  label: v.string(),
  percent: v.number(),
  amount: money,
});

export default defineSchema({
  /* ══════════════════════════════════════════════════════════════════════════
   * 1. IDENTITÉ, ORGANISATIONS, ACCÈS
   * ══════════════════════════════════════════════════════════════════════════ */

  /** Miroir métier de l'utilisateur Better Auth. Alimenté par déclencheur. */
  users: defineTable({
    authId: v.string(),
    email: v.string(),
    name: v.optional(v.string()),
    avatarStorageId: v.optional(v.id("_storage")),
    /**
     * Moment où l'adresse a été PROUVÉE (code reçu par e-mail, ou Google qui l'atteste).
     * Absent = adresse non prouvée : un tel compte ne peut accepter aucune invitation, sans
     * quoi n'importe qui pourrait se faire passer pour l'invité (D-033, SECURITY.md M7).
     */
    emailVerifiedAt: v.optional(v.number()),
    locale: v.union(v.literal("fr"), v.literal("en")),
    status: v.union(v.literal("active"), v.literal("suspended")),
    lastSeenAt: v.optional(v.number()),
  })
    // Pas de clé de portée : un utilisateur préexiste à toute organisation.
    .index("by_auth", ["authId"])
    .index("by_email", ["email"]),

  /** Le tenant. Porte l'abonnement et possède les établissements. */
  organizations: defineTable({
    name: v.string(),
    slug: v.string(),
    ownerUserId: v.id("users"),
    countryCode: v.string(),
    defaultCurrency: v.string(),
    defaultLocale: v.string(),
    status: v.union(v.literal("active"), v.literal("suspended"), v.literal("archived")),
  })
    .index("by_slug", ["slug"])
    .index("by_owner", ["ownerUserId"])
    .index("by_status", ["status"]),

  /** Le pivot du contrôle d'accès : sans ligne ici, aucun accès. */
  organizationMembers: defineTable({
    organizationId: v.id("organizations"),
    /**
     * Absent pour un membre SANS COMPTE (`kind: "pin_only"`, D-060) : un serveur qui n'a pas
     * d'adresse e-mail réellement consultée travaille avec son PIN, sur un appareil enrôlé.
     * Aucun compte Better Auth n'est créé pour lui : D-043 tient toujours.
     */
    userId: v.optional(v.id("users")),
    /** Absent = `account` (les membres d'avant D-060). */
    kind: v.optional(v.union(v.literal("account"), v.literal("pin_only"))),
    /** Le nom affiché d'un membre sans compte ; un membre avec compte prend celui du compte. */
    displayName: v.optional(v.string()),
    createdByUserId: v.optional(v.id("users")),
    status: v.union(
      v.literal("invited"),
      v.literal("active"),
      v.literal("suspended"),
      v.literal("removed"),
    ),
    invitedByUserId: v.optional(v.id("users")),
    joinedAt: v.optional(v.number()),
    removedAt: v.optional(v.number()),
  })
    .index("by_org_user", ["organizationId", "userId"])
    .index("by_user", ["userId"]) // « mes organisations » — portée = l'utilisateur lui-même
    .index("by_org_status", ["organizationId", "status"]),

  organizationInvitations: defineTable({
    organizationId: v.id("organizations"),
    email: v.string(),
    roleId: v.id("roles"),
    /** Vide = rôle attribué au niveau de l'organisation entière. */
    venueIds: v.array(v.id("venues")),
    /**
     * SHA-256 du jeton, jamais le jeton en clair : une fuite de la base ne doit pas
     * donner de quoi rejoindre une organisation. Même règle que `trustedDevices`.
     */
    tokenHash: v.string(),
    status: v.union(
      v.literal("pending"),
      v.literal("accepted"),
      v.literal("expired"),
      v.literal("revoked"),
    ),
    invitedByUserId: v.id("users"),
    expiresAt: v.number(),
    acceptedByUserId: v.optional(v.id("users")),
    acceptedAt: v.optional(v.number()),
  })
    .index("by_token", ["tokenHash"]) // chemin d'acceptation : le jeton EST la portée
    .index("by_org_status", ["organizationId", "status"])
    .index("by_email", ["email"]),

  /** Un sac de permissions nommé. `organizationId` absent = modèle système. */
  roles: defineTable({
    organizationId: v.optional(v.id("organizations")),
    key: v.string(),
    label: v.string(),
    description: v.optional(v.string()),
    permissions: v.array(v.string()),
    isCustom: v.boolean(),
    archivedAt: v.optional(v.number()),
  })
    .index("by_org", ["organizationId"])
    .index("by_org_key", ["organizationId", "key"]),

  /** Qui a quel rôle, où. Rend possible « Manager de Cocody ET Serveur de Plateau ». */
  memberRoleAssignments: defineTable({
    organizationId: v.id("organizations"),
    memberId: v.id("organizationMembers"),
    roleId: v.id("roles"),
    scopeType: v.union(v.literal("organization"), v.literal("venue")),
    venueId: v.optional(v.id("venues")),
    grantedByUserId: v.id("users"),
    grantedAt: v.number(),
  })
    .index("by_member", ["memberId"]) // chemin chaud : résolution des permissions
    .index("by_org_venue", ["organizationId", "venueId"])
    .index("by_role", ["roleId"]), // impact avant modification d'un rôle

  /** Un établissement. Lu à chaque requête : on y garde le strict nécessaire. */
  venues: defineTable({
    organizationId: v.id("organizations"),
    name: v.string(),
    slug: v.string(),
    countryCode: v.string(),
    currency: v.string(),
    timezone: v.string(),
    locales: v.array(v.string()),
    venueType,
    status: v.union(
      v.literal("setup"),
      v.literal("active"),
      v.literal("paused"),
      v.literal("archived"),
    ),
    publicMenuEnabled: v.boolean(),
    onboardingCompletedSteps: v.array(v.string()),
    /**
     * Coordonnées publiques. Requises par la page de menu public et son JSON-LD
     * `Restaurant` : sans elles, la porte de sortie de T1 est inatteignable et la
     * porte de qualité avant indexation ne peut pas être évaluée. (Manque G1.)
     */
    address: v.optional(
      v.object({
        /** Facultative : beaucoup d'établissements n'ont ni rue ni numéro, le repère en tient lieu. */
        line1: v.optional(v.string()),
        line2: v.optional(v.string()),
        city: v.string(),
        district: v.optional(v.string()),
        countryCode: v.string(),
        /** Beaucoup d'adresses ouest-africaines n'ont pas de numéro de rue : le repère en tient lieu. */
        landmark: v.optional(v.string()),
      }),
    ),
    geo: v.optional(v.object({ lat: v.number(), lng: v.number() })),
    phone: v.optional(v.string()),
    publicEmail: v.optional(v.string()),
    description: v.optional(v.string()),
    /** Horaires d'ouverture, en minutes locales. Alimente aussi `openingHoursSpecification`. */
    openingHours: v.optional(
      v.array(
        v.object({
          dayOfWeek: v.number(),
          opensAtMinute: v.number(),
          closesAtMinute: v.number(),
        }),
      ),
    ),
    socialLinks: v.optional(v.record(v.string(), v.string())),
    /** Verrou de R20 : la devise se fige dès la première opération financière. */
    currencyLockedAt: v.optional(v.number()),
    /**
     * Établissement de démonstration ou de simulation. ANALYTICS.md §3.4 interdit que
     * ces données comptent dans les chiffres réels ; sans ce drapeau, l'interdiction
     * était inapplicable. Porté par la venue ET recopié sur les objets de service
     * (voir `tableSessions.isSimulation`). (Manque G2.)
     */
    isSimulation: v.boolean(),
  })
    .index("by_org", ["organizationId"])
    .index("by_slug", ["slug"])
    .index("by_org_status", ["organizationId", "status"])
    // Le plan du site public ne liste que les établissements qui ont CONSENTI.
    .index("by_public_menu", ["publicMenuEnabled"]),

  /** Configuration volumineuse, lue une fois par session puis mise en cache. */
  venueSettings: defineTable({
    venueId: v.id("venues"),
    service: v.object({
      orderingMode,
      paymentTiming,
      paymentLocations: v.array(v.string()),
      qrStrategy,
      guestDirectCategories: v.array(v.id("menuSections")),
      autoAbandonMinutes: v.number(),
    }),
    tax: v.object({
      pricesIncludeTax: v.boolean(),
      rates: v.array(
        v.object({
          code: v.string(),
          label: v.string(),
          percent: v.number(),
          appliesTo: v.array(v.string()),
        }),
      ),
      serviceChargePercent: v.optional(v.number()),
    }),
    /** Désactivé par défaut : aucun encadrement légal ivoirien du pourboire n'a été trouvé. */
    tipping: v.object({
      enabled: v.boolean(),
      mode: v.union(v.literal("free"), v.literal("percentages")),
      suggestions: v.array(v.number()),
    }),
    branding: v.object({
      logoStorageId: v.optional(v.id("_storage")),
      coverStorageId: v.optional(v.id("_storage")),
      primaryColor: v.string(),
      theme: v.union(v.literal("light"), v.literal("dark"), v.literal("system")),
    }),
    /** Reste inactif tant que la spécification FNE n'est pas en main (A7, D-020). */
    fiscal: v.object({
      regime: v.string(),
      taxId: v.optional(v.string()),
      fneEnabled: v.boolean(),
      receiptFooter: v.optional(v.string()),
    }),
    /**
     * Fournisseurs de paiement actifs, PAR ÉTABLISSEMENT. D-026 exige de pouvoir changer
     * de rail sans déploiement : sans ce bloc, la décision était inapplicable. (Manque G6.)
     */
    payments: v.object({
      enabledMethods: v.array(v.string()),
      /** Clé d'adaptateur (`cash`, `wave_ci`, …), dans l'ordre de présentation. */
      onlineProviders: v.array(
        v.object({
          providerKey: v.string(),
          isEnabled: v.boolean(),
          /** Référence marchand chez le fournisseur. JAMAIS de secret ici. */
          merchantRef: v.optional(v.string()),
          sortOrder: v.number(),
        }),
      ),
      /** Pas de montant imposé par certains agrégateurs (voir D-028). */
      amountStep: v.optional(v.number()),
    }),
    /** Canaux de notification par événement. Était documenté sans exister dans le schéma. */
    notifications: v.array(
      v.object({
        eventType: v.string(),
        channels: v.array(v.string()),
        enabled: v.boolean(),
      }),
    ),
    serviceRequestTypes: v.array(
      v.object({
        key: v.string(),
        label: v.string(),
        enabled: v.boolean(),
        cooldownSeconds: v.number(),
      }),
    ),
    tagCatalog: v.array(v.object({ key: v.string(), label: v.string() })),
  }).index("by_venue", ["venueId"]),

  /** Une tablette de cuisine n'est pas une personne : elle s'enrôle, elle ne se connecte pas. */
  /**
   * Un appareil ENRÔLÉ par un gérant (D-060). Trois sortes : `kds` (écran de production, aucun
   * humain, rattaché à un poste), `shared` (tablette de salle ou caisse, PIN), `personal`
   * (téléphone d'un employé, lié à ce membre). Le jeton d'appareil n'est jamais stocké en
   * clair ; le révoquer coupe tout, immédiatement.
   */
  trustedDevices: defineTable({
    venueId: v.id("venues"),
    label: v.string(),
    deviceType: v.union(v.literal("kds"), v.literal("shared"), v.literal("personal")),
    /** SHA-256 du jeton d'appareil. */
    tokenHash: v.string(),
    stationId: v.optional(v.id("prepStations")),
    /** Le propriétaire d'un appareil `personal` : seul lui peut s'y identifier. */
    memberId: v.optional(v.id("organizationMembers")),
    enrolledByMemberId: v.id("organizationMembers"),
    enrolledAt: v.number(),
    lastSeenAt: v.optional(v.number()),
    revokedAt: v.optional(v.number()),
    revokedByMemberId: v.optional(v.id("organizationMembers")),
    /** Échecs de PIN récents sur cet appareil, tous membres confondus (fenêtre d'une heure). */
    recentPinFailures: v.array(v.number()),
    /** Au-delà de 15 échecs en une heure : plus aucun PIN sur cet appareil jusqu'à cette heure. */
    pinSuspendedUntil: v.optional(v.number()),
  })
    .index("by_venue", ["venueId"])
    .index("by_token", ["tokenHash"]), // le hachage EST la clé d'authentification

  /** Code à usage unique qui enrôle un appareil (8 caractères, 10 minutes). */
  deviceEnrollmentCodes: defineTable({
    venueId: v.id("venues"),
    codeHash: v.string(),
    deviceType: v.union(v.literal("kds"), v.literal("shared"), v.literal("personal")),
    label: v.string(),
    stationId: v.optional(v.id("prepStations")),
    memberId: v.optional(v.id("organizationMembers")),
    createdByMemberId: v.id("organizationMembers"),
    expiresAt: v.number(),
    usedAt: v.optional(v.number()),
    deviceId: v.optional(v.id("trustedDevices")),
  })
    .index("by_code", ["codeHash"])
    .index("by_venue", ["venueId"]),

  /**
   * Le PIN d'un membre (D-060). Jamais le PIN : son HMAC-SHA256 sous un secret serveur
   * (`PIN_PEPPER`), sans quoi les 10 000 codes possibles se testeraient instantanément sur une
   * base volée. Un seul PIN par membre, valable sur tous les appareils enrôlés où il travaille.
   */
  staffCredentials: defineTable({
    organizationId: v.id("organizations"),
    memberId: v.id("organizationMembers"),
    /** Absent tant que l'employé n'a pas choisi son PIN, ou après une remise à zéro. */
    pinHash: v.optional(v.string()),
    status: v.union(
      v.literal("pending"), // en attente d'activation
      v.literal("active"),
      v.literal("disabled"), // 10 échecs depuis la dernière réussite, ou retiré par un gérant
    ),
    /** Échecs récents (fenêtre de 15 minutes), tous appareils confondus. */
    recentFailures: v.array(v.number()),
    failuresSinceSuccess: v.number(),
    lockedUntil: v.optional(v.number()),
    pinSetAt: v.optional(v.number()),
    lastUnlockAt: v.optional(v.number()),
  }).index("by_member", ["memberId"]),

  /** Code d'activation remis par un gérant : l'employé choisit ensuite son PIN lui-même. */
  activationCodes: defineTable({
    organizationId: v.id("organizations"),
    memberId: v.id("organizationMembers"),
    codeHash: v.string(),
    createdByMemberId: v.id("organizationMembers"),
    expiresAt: v.number(),
    usedAt: v.optional(v.number()),
    revokedAt: v.optional(v.number()),
  })
    .index("by_code", ["codeHash"])
    .index("by_member", ["memberId"]),

  /**
   * Une personne identifiée par son PIN sur un appareil, du déverrouillage au verrouillage.
   * Le jeton d'opérateur (10 min) désigne cette ligne ; chaque appel la revérifie. Le secret
   * de renouvellement n'est stocké que haché.
   */
  operatorSessions: defineTable({
    venueId: v.id("venues"),
    deviceId: v.id("trustedDevices"),
    memberId: v.id("organizationMembers"),
    secretHash: v.string(),
    startedAt: v.number(),
    lastActivityAt: v.number(),
    endedAt: v.optional(v.number()),
    endReason: v.optional(v.union(v.literal("locked"), v.literal("expired"), v.literal("revoked"), v.literal("replaced"))),
  })
    .index("by_device", ["deviceId"])
    .index("by_member", ["memberId"])
    .index("by_secret", ["secretHash"]),

  /** Équipe plateforme. Table à part, garde à part : jamais attribuable par un client. */
  platformAdmins: defineTable({
    userId: v.id("users"),
    permissions: v.array(v.string()),
    status: v.union(v.literal("active"), v.literal("revoked")),
  }).index("by_user", ["userId"]),

  /* ══════════════════════════════════════════════════════════════════════════
   * 2. ABONNEMENT
   * ══════════════════════════════════════════════════════════════════════════ */

  /** En base et non en code : un prix change sans livraison de logiciel. */
  plans: defineTable({
    key: v.string(),
    label: v.string(),
    prices: v.array(
      v.object({ currency: v.string(), amount: money, interval: v.string() }),
    ),
    entitlements: v.record(v.string(), v.boolean()),
    limits: v.object({
      venues: v.number(),
      staffSeats: v.number(),
      monthlyOrders: v.optional(v.number()),
    }),
    isPublic: v.boolean(),
    sortOrder: v.number(),
  })
    .index("by_key", ["key"])
    .index("by_public", ["isPublic"]),

  subscriptions: defineTable({
    organizationId: v.id("organizations"),
    planId: v.id("plans"),
    status: v.union(
      v.literal("trialing"),
      v.literal("active"),
      v.literal("past_due"),
      v.literal("grace"),
      v.literal("cancelled"),
    ),
    currentPeriodEnd: v.number(),
    trialEndsAt: v.optional(v.number()),
    /** Calculées depuis le plan + dérogations. Rétrécissent, n'élargissent jamais. */
    entitlements: v.record(v.string(), v.boolean()),
    overrides: v.optional(v.record(v.string(), v.boolean())),
    cancelledAt: v.optional(v.number()),
  })
    .index("by_org", ["organizationId"])
    .index("by_status_period", ["status", "currentPeriodEnd"]), // relances : portée = plateforme

  featureFlags: defineTable({
    key: v.string(),
    scopeType: v.union(
      v.literal("global"),
      v.literal("organization"),
      v.literal("venue"),
      v.literal("user"),
    ),
    scopeId: v.optional(v.string()),
    enabled: v.boolean(),
    rolloutPercent: v.optional(v.number()),
    note: v.optional(v.string()),
  }).index("by_key_scope", ["key", "scopeType", "scopeId"]),

  /* ══════════════════════════════════════════════════════════════════════════
   * 3. CARTE
   * ══════════════════════════════════════════════════════════════════════════ */

  menus: defineTable({
    venueId: v.id("venues"),
    name: v.string(),
    slug: v.string(),
    status: v.union(v.literal("draft"), v.literal("published"), v.literal("archived")),
    activeSchedule: v.optional(
      v.object({
        daysOfWeek: v.array(v.number()),
        startMinute: v.number(),
        endMinute: v.number(),
      }),
    ),
    sortOrder: v.number(),
    publishedVersionId: v.optional(v.id("menuPublications")),
  })
    .index("by_venue", ["venueId"])
    .index("by_venue_status", ["venueId", "status"]),

  menuSections: defineTable({
    venueId: v.id("venues"),
    menuId: v.id("menus"),
    name: v.string(),
    description: v.optional(v.string()),
    i18n: v.optional(i18nText),
    imageStorageId: v.optional(v.id("_storage")),
    sortOrder: v.number(),
    isActive: v.boolean(),
  })
    .index("by_menu_sort", ["menuId", "sortOrder"])
    .index("by_venue", ["venueId"]),

  /** La table la plus lue du produit : sa forme décide de la vitesse du menu client. */
  products: defineTable({
    venueId: v.id("venues"),
    menuSectionId: v.id("menuSections"),
    name: v.string(),
    slug: v.string(),
    description: v.optional(v.string()),
    i18n: v.optional(i18nText),
    basePrice: money,
    currency: v.string(),
    promoPrice: v.optional(money),
    promoEndsAt: v.optional(v.number()),
    taxCodes: v.array(v.string()),
    /**
     * Photos, dans l'ordre d'affichage. Chacune a sa vignette et ses dimensions : la carte
     * client réserve la place AVANT le chargement (aucun décalage de mise en page) et ne
     * télécharge que la vignette en liste — c'est le poste qui coûte le plus sur une 4G
     * bridée. Réduites dans le navigateur avant l'envoi : Convex ne transforme pas d'images.
     */
    images: v.array(
      v.object({
        storageId: v.id("_storage"),
        thumbStorageId: v.id("_storage"),
        width: v.number(),
        height: v.number(),
      }),
    ),
    prepStationId: v.optional(v.id("prepStations")),
    prepMinutes: v.optional(v.number()),
    tags: v.array(v.string()),
    /** DÉCLARÉS par le restaurant uniquement. Jamais déduits, jamais inventés (R28). */
    allergens: v.array(v.string()),
    dietary: v.object({
      vegetarian: v.optional(v.boolean()),
      vegan: v.optional(v.boolean()),
      halal: v.optional(v.boolean()),
      spicyLevel: v.optional(v.number()),
    }),
    nutrition: v.optional(v.record(v.string(), v.number())),
    isAvailable: v.boolean(),
    unavailableUntil: v.optional(v.number()),
    stockCount: v.optional(v.number()),
    /** Ancrage du futur module stock (A3). Aucune table de stock en V1. */
    recipeId: v.optional(v.string()),
    relatedProductIds: v.array(v.id("products")),
    sortOrder: v.number(),
    isActive: v.boolean(),
  })
    // SCOPE-CRITIQUE — le seul index du schéma atteint par un identifiant VENANT DU CLIENT
    // sans garde préalable : le menu public n'est pas authentifié. Il est donc préfixé par
    // `venueId`, ce qui rend la fuite structurellement impossible plutôt que dépendante
    // d'une vérification qu'un développeur pourrait oublier. Partout ailleurs, la garde
    // suffit et un préfixe n'ajouterait rien. Voir CRITIQUE.md B1.
    .index("by_venue_section_sort", ["venueId", "menuSectionId", "sortOrder"])
    .index("by_venue_active", ["venueId", "isActive"])
    .index("by_venue_station", ["venueId", "prepStationId"])
    .index("by_venue_slug", ["venueId", "slug"])
    .searchIndex("search_products", {
      searchField: "name",
      filterFields: ["venueId", "isActive"], // jamais de recherche hors portée
    }),

  productVariants: defineTable({
    venueId: v.id("venues"),
    productId: v.id("products"),
    name: v.string(),
    i18n: v.optional(i18nText),
    priceDelta: v.optional(money),
    price: v.optional(money),
    isDefault: v.boolean(),
    isAvailable: v.boolean(),
    sortOrder: v.number(),
  })
    .index("by_product_sort", ["productId", "sortOrder"])
    .index("by_venue", ["venueId"]),

  modifierGroups: defineTable({
    venueId: v.id("venues"),
    name: v.string(),
    i18n: v.optional(i18nText),
    selectionType: v.union(v.literal("single"), v.literal("multiple")),
    minSelect: v.number(),
    maxSelect: v.number(),
    isRequired: v.boolean(),
  }).index("by_venue", ["venueId"]),

  modifierOptions: defineTable({
    venueId: v.id("venues"),
    modifierGroupId: v.id("modifierGroups"),
    name: v.string(),
    i18n: v.optional(i18nText),
    priceDelta: money,
    isAvailable: v.boolean(),
    sortOrder: v.number(),
  })
    .index("by_group_sort", ["modifierGroupId", "sortOrder"])
    .index("by_venue", ["venueId"]),

  productModifierGroups: defineTable({
    venueId: v.id("venues"),
    productId: v.id("products"),
    modifierGroupId: v.id("modifierGroups"),
    sortOrder: v.number(),
    overrideRequired: v.optional(v.boolean()),
  })
    .index("by_product_sort", ["productId", "sortOrder"])
    .index("by_group", ["modifierGroupId"]),

  /** Disponibilité PROGRAMMÉE, évaluée à la lecture — jamais matérialisée par un cron (R23). */
  availabilityRules: defineTable({
    venueId: v.id("venues"),
    targetType: v.union(v.literal("product"), v.literal("section"), v.literal("menu")),
    targetId: v.string(),
    daysOfWeek: v.array(v.number()),
    startMinute: v.number(),
    endMinute: v.number(),
    effectiveFrom: v.optional(v.number()),
    effectiveTo: v.optional(v.number()),
    ruleType: v.union(v.literal("available"), v.literal("unavailable")),
    isActive: v.boolean(),
  })
    .index("by_venue_target", ["venueId", "targetType", "targetId"])
    .index("by_venue_active", ["venueId", "isActive"]),

  /** Ce que le client voit RÉELLEMENT. Rend R22 opposable. Jamais modifiée après création. */
  menuPublications: defineTable({
    venueId: v.id("venues"),
    menuId: v.id("menus"),
    version: v.number(),
    /** Arbre complet. Exclut les images (identifiants seulement) : limite de 1 Mo par document. */
    snapshot: v.any(),
    publishedByUserId: v.id("users"),
    publishedAt: v.number(),
    isCurrent: v.boolean(),
  })
    .index("by_venue_current", ["venueId", "isCurrent"])
    .index("by_menu_version", ["menuId", "version"]),

  /* ══════════════════════════════════════════════════════════════════════════
   * 4. SALLE, TABLES, QR
   * ══════════════════════════════════════════════════════════════════════════ */

  serviceAreas: defineTable({
    venueId: v.id("venues"),
    name: v.string(),
    sortOrder: v.number(),
    canvasWidth: v.number(),
    canvasHeight: v.number(),
    isActive: v.boolean(),
  }).index("by_venue_sort", ["venueId", "sortOrder"]),

  restaurantTables: defineTable({
    venueId: v.id("venues"),
    serviceAreaId: v.id("serviceAreas"),
    number: v.string(),
    label: v.optional(v.string()),
    seats: v.number(),
    shape: v.union(v.literal("square"), v.literal("round"), v.literal("rect")),
    x: v.number(),
    y: v.number(),
    width: v.number(),
    height: v.number(),
    rotation: v.optional(v.number()),
    status: v.union(
      v.literal("available"),
      v.literal("occupied"),
      v.literal("reserved"),
      v.literal("out_of_service"),
    ),
    /** Dénormalisation assumée : garantit R1 et évite N requêtes sur l'écran serveur. */
    activeSessionId: v.optional(v.id("tableSessions")),
    isActive: v.boolean(),
  })
    .index("by_venue_number", ["venueId", "number"])
    .index("by_area", ["serviceAreaId"])
    .index("by_venue_status", ["venueId", "status"])
    .index("by_active_session", ["activeSessionId"]),

  /** Le point d'entrée du produit, et sa première surface d'attaque (D-008). */
  tableQrCodes: defineTable({
    venueId: v.id("venues"),
    tableId: v.id("restaurantTables"),
    /** Opaque, non devinable, >= 128 bits d'entropie. N'est JAMAIS l'identifiant de session. */
    token: v.string(),
    version: v.number(),
    status: v.union(v.literal("active"), v.literal("revoked")),
    design: v.optional(v.record(v.string(), v.string())),
    createdByUserId: v.id("users"),
    revokedAt: v.optional(v.number()),
    lastScannedAt: v.optional(v.number()),
    scanCount: v.number(),
  })
    .index("by_token", ["token"]) // le jeton EST la clé d'entrée : portée résolue ensuite
    .index("by_table", ["tableId"])
    .index("by_venue_status", ["venueId", "status"]),

  /* ══════════════════════════════════════════════════════════════════════════
   * 5. SESSIONS DE TABLE ET INVITÉS
   * ══════════════════════════════════════════════════════════════════════════ */

  /** L'objet central du produit : l'occupation d'une table par un groupe. */
  tableSessions: defineTable({
    venueId: v.id("venues"),
    tableId: v.id("restaurantTables"),
    reference: v.string(),
    status: v.union(
      v.literal("open"),
      v.literal("ordering"),
      v.literal("billing"),
      v.literal("settling"),
      v.literal("closed"),
      v.literal("closed_with_debt"),
      v.literal("abandoned"),
    ),
    originType: v.union(v.literal("qr_scan"), v.literal("staff"), v.literal("reservation")),
    guestCount: v.optional(v.number()),
    assignedWaiterMemberId: v.optional(v.id("organizationMembers")),
    openedByMemberId: v.optional(v.id("organizationMembers")),
    openedAt: v.number(),
    closedAt: v.optional(v.number()),
    closedByMemberId: v.optional(v.id("organizationMembers")),
    /** Obligatoire si `closed_with_debt` — vérifié dans la mutation, pas ici. */
    closeReason: v.optional(v.string()),
    /**
     * PAS de totaux ici. Une version antérieure du schéma en portait six, en parallèle des
     * huit champs de `checks` — deux caches d'argent sur les mêmes faits, sans invariant
     * écrit ni testé. L'état financier d'une session se dérive de ses commandes et de ses
     * paiements (`orders.by_session`, `payments.by_check`), qui sont la source unique.
     * Pour trente tables, c'est une lecture d'index par table : le prix d'un solde qui ne
     * peut pas être faux.
     */
    currency: v.string(),
    activationCode: v.optional(v.string()),
    lastActivityAt: v.number(),
    /** Recopié depuis la venue à l'ouverture : exclut la session de tous les agrégats (G2). */
    isSimulation: v.boolean(),
    /**
     * Fusion de tables. Deux groupes qu'on réunit ne fusionnent pas leurs sessions : la
     * seconde est RATTACHÉE à la première et passe à `closed`, ses commandes et ses
     * additions restant lisibles. Sans ce champ, `table.session.transfer` promettait une
     * fusion que le schéma rendait impossible (`tableId` obligatoire, `activeSessionId`
     * mono-valué). Voir CRITIQUE.md S1.
     */
    mergedIntoSessionId: v.optional(v.id("tableSessions")),
  })
    .index("by_venue_status", ["venueId", "status"])
    .index("by_table_status", ["tableId", "status"]) // garantit R1
    .index("by_venue_openedAt", ["venueId", "openedAt"])
    .index("by_waiter", ["assignedWaiterMemberId"]),

  /** Identité légère qui rend la commande collaborative possible SANS compte. */
  guestSessions: defineTable({
    venueId: v.id("venues"),
    tableSessionId: v.id("tableSessions"),
    displayName: v.optional(v.string()),
    colorKey: v.string(),
    /** Haché. Sert uniquement à retrouver sa propre session après rechargement. */
    deviceFingerprintHash: v.optional(v.string()),
    joinedAt: v.number(),
    lastSeenAt: v.number(),
    status: v.union(v.literal("active"), v.literal("left")),
    customerProfileId: v.optional(v.id("customerProfiles")),
  })
    .index("by_session", ["tableSessionId"])
    .index("by_session_status", ["tableSessionId", "status"]),

  serviceRequests: defineTable({
    venueId: v.id("venues"),
    tableSessionId: v.id("tableSessions"),
    guestSessionId: v.optional(v.id("guestSessions")),
    type: v.string(),
    note: v.optional(v.string()),
    status: v.union(
      v.literal("open"),
      v.literal("acknowledged"),
      v.literal("resolved"),
      v.literal("cancelled"),
    ),
    createdAt: v.number(),
    acknowledgedAt: v.optional(v.number()),
    acknowledgedByMemberId: v.optional(v.id("organizationMembers")),
    resolvedAt: v.optional(v.number()),
    resolvedByMemberId: v.optional(v.id("organizationMembers")),
  })
    .index("by_venue_status_created", ["venueId", "status", "createdAt"])
    .index("by_session", ["tableSessionId"]),

  /* ══════════════════════════════════════════════════════════════════════════
   * 6. COMMANDES
   * ══════════════════════════════════════════════════════════════════════════ */

  carts: defineTable({
    venueId: v.id("venues"),
    tableSessionId: v.id("tableSessions"),
    /** Absent = panier commun à la table (mode collaboratif). */
    guestSessionId: v.optional(v.id("guestSessions")),
    status: v.union(v.literal("active"), v.literal("submitted"), v.literal("abandoned")),
    updatedAt: v.number(),
  })
    .index("by_session", ["tableSessionId"])
    .index("by_guest", ["guestSessionId"]),

  cartItems: defineTable({
    venueId: v.id("venues"),
    cartId: v.id("carts"),
    productId: v.id("products"),
    variantId: v.optional(v.id("productVariants")),
    modifierSelections: v.array(v.id("modifierOptions")),
    quantity: v.number(),
    instructions: v.optional(v.string()),
    addedByGuestSessionId: v.optional(v.id("guestSessions")),
    courseNumber: v.optional(v.number()),
    /** AFFICHAGE seulement. Le prix qui fait foi est recalculé côté serveur (R14). */
    estimatedUnitPrice: money,
  })
    .index("by_cart", ["cartId"])
    .index("by_venue", ["venueId"]),

  orders: defineTable({
    venueId: v.id("venues"),
    tableSessionId: v.id("tableSessions"),
    reference: v.string(),
    status: v.union(
      v.literal("draft"),
      v.literal("submitted"),
      v.literal("pending_payment"),
      v.literal("pending_acceptance"),
      v.literal("accepted"),
      v.literal("in_preparation"),
      v.literal("partially_ready"),
      v.literal("ready"),
      v.literal("partially_served"),
      v.literal("served"),
      v.literal("closed"),
      v.literal("rejected"),
      v.literal("cancelled"),
      v.literal("partially_cancelled"),
    ),
    channel: v.union(v.literal("guest"), v.literal("staff")),
    placedByGuestSessionId: v.optional(v.id("guestSessions")),
    placedByMemberId: v.optional(v.id("organizationMembers")),
    acceptedByMemberId: v.optional(v.id("organizationMembers")),
    acceptedAt: v.optional(v.number()),
    rejectedReason: v.optional(v.string()),
    submittedAt: v.number(),
    readyAt: v.optional(v.number()),
    servedAt: v.optional(v.number()),
    closedAt: v.optional(v.number()),
    totals: v.object({
      subtotal: money,
      discounts: money,
      tax: money,
      serviceCharge: money,
      total: money,
    }),
    currency: v.string(),
    /** Empêche la double commande sur double clic (R7). */
    idempotencyKey: v.string(),
    notes: v.optional(v.string()),
  })
    .index("by_session", ["tableSessionId"])
    .index("by_venue_status_submitted", ["venueId", "status", "submittedAt"])
    .index("by_venue_submittedAt", ["venueId", "submittedAt"])
    // Portée par établissement : une clé venue d'un autre locataire n'est ni vue ni refusée.
    .index("by_venue_idempotency", ["venueId", "idempotencyKey"]),

  /** Une ligne commandée, avec son snapshot figé (D-005, R6). Ne se supprime jamais. */
  orderItems: defineTable({
    venueId: v.id("venues"),
    orderId: v.id("orders"),
    /** Dupliqué : l'addition lit par session, pas par commande. */
    tableSessionId: v.id("tableSessions"),
    productId: v.id("products"),
    variantId: v.optional(v.id("productVariants")),
    nameSnapshot: v.string(),
    variantNameSnapshot: v.optional(v.string()),
    /** Intégré : snapshot immuable, jamais une jointure sur le chemin le plus chaud. */
    modifiers: v.array(modifierSnapshot),
    quantity: v.number(),
    unitPrice: money,
    lineTotal: money,
    taxSnapshot: v.array(taxSnapshot),
    instructions: v.optional(v.string()),
    courseNumber: v.number(),
    /** Figé : changer la station d'un produit ne rejoue pas le passé. */
    prepStationId: v.optional(v.id("prepStations")),
    status: v.union(
      v.literal("ordered"),
      v.literal("preparing"),
      v.literal("ready"),
      v.literal("served"),
      v.literal("cancelled"),
    ),
    cancelledReason: v.optional(v.string()),
    cancelledByMemberId: v.optional(v.id("organizationMembers")),
    /** À qui l'article est attribué, pour le partage d'addition (§11). */
    assignedGuestSessionIds: v.array(v.id("guestSessions")),
  })
    .index("by_order", ["orderId"])
    .index("by_session_status", ["tableSessionId", "status"])
    .index("by_venue_product", ["venueId", "productId"]),

  /** Journal métier. Append-only. Sans lui, « qu'est-ce qui a ralenti hier ? » n'a pas de réponse. */
  orderEvents: defineTable({
    venueId: v.id("venues"),
    orderId: v.id("orders"),
    type: v.string(),
    actorType,
    /** Qui, sur quel appareil, dans quelle session d'opérateur (D-060). */
    actorMemberId: v.optional(v.id("organizationMembers")),
    actorDeviceId: v.optional(v.id("trustedDevices")),
    actorOperatorSessionId: v.optional(v.id("operatorSessions")),
    payload: v.optional(v.any()),
    at: v.number(),
  })
    .index("by_order_at", ["orderId", "at"])
    .index("by_venue_type_at", ["venueId", "type", "at"]),

  orderAdjustments: defineTable({
    venueId: v.id("venues"),
    tableSessionId: v.id("tableSessions"),
    orderId: v.optional(v.id("orders")),
    checkId: v.optional(v.id("checks")),
    type: v.union(
      v.literal("discount"),
      v.literal("service_charge"),
      v.literal("fee"),
      v.literal("comp"),
    ),
    source: v.union(v.literal("manual"), v.literal("promotion"), v.literal("loyalty")),
    label: v.string(),
    amount: money,
    percent: v.optional(v.number()),
    appliedByUserId: v.id("users"),
    reason: v.optional(v.string()),
  })
    .index("by_session", ["tableSessionId"])
    .index("by_order", ["orderId"])
    .index("by_venue_type", ["venueId", "type"]),

  /**
   * Compteurs d'un établissement : la référence dite à voix haute (« A-042 », repartant chaque
   * jour de service) et celle d'une session (« TS-2026-000123 »). Un document par clé : compter
   * les commandes du jour à chaque envoi lirait un nombre de lignes qui grandit toute la
   * soirée, et Convex sérialise déjà deux incréments concurrents sur le même document.
   */
  venueCounters: defineTable({
    venueId: v.id("venues"),
    /** `order:2026-09-23`, `session:2026`. */
    key: v.string(),
    value: v.number(),
  }).index("by_venue_key", ["venueId", "key"]),

  /* ══════════════════════════════════════════════════════════════════════════
   * 7. PRODUCTION
   * ══════════════════════════════════════════════════════════════════════════ */

  prepStations: defineTable({
    venueId: v.id("venues"),
    name: v.string(),
    type: v.string(),
    sortOrder: v.number(),
    targetPrepMinutes: v.number(),
    lateThresholdMinutes: v.number(),
    soundEnabled: v.boolean(),
    isActive: v.boolean(),
  }).index("by_venue_sort", ["venueId", "sortOrder"]),

  /** Ce que la cuisine voit. Elle ne voit jamais la commande entière (R11). */
  kitchenTickets: defineTable({
    venueId: v.id("venues"),
    orderId: v.id("orders"),
    prepStationId: v.id("prepStations"),
    tableSessionId: v.id("tableSessions"),
    reference: v.string(),
    /**
     * Dénormalisé : la cuisine ne doit pas résoudre 3 relations pour afficher « Table 12 ».
     * MAIS ce champ est figé à la création du bon : un déplacement de clients ferait servir
     * le plat à la mauvaise table. Tout transfert ou toute fusion DOIT donc re-marquer les
     * bons non terminaux de la session (`kitchenTickets.by_session`), et l'écran de cuisine
     * signale visuellement un numéro qui vient de changer. Voir CRITIQUE.md S1.
     */
    tableNumber: v.string(),
    status: v.union(
      v.literal("held"),
      v.literal("queued"),
      v.literal("started"),
      v.literal("ready"),
      v.literal("recalled"),
      /**
       * Porté à table. Un état et non un simple horodatage : l'index par statut ne garde
       * ainsi en « prêt » que ce qui attend vraiment le serveur, au lieu d'accumuler tout
       * ce qui a été prêt un jour — la liste « à servir » reste courte sans filtre.
       */
      v.literal("served"),
      v.literal("cancelled"),
    ),
    courseNumber: v.number(),
    priority: v.number(),
    queuedAt: v.optional(v.number()),
    startedAt: v.optional(v.number()),
    readyAt: v.optional(v.number()),
    recalledAt: v.optional(v.number()),
    startedByMemberId: v.optional(v.id("organizationMembers")),
    readyByMemberId: v.optional(v.id("organizationMembers")),
    servedAt: v.optional(v.number()),
    servedByMemberId: v.optional(v.id("organizationMembers")),
    /** Remonté au niveau du bon : une allergie ne se lit pas en petit dans une ligne. */
    allergyFlags: v.array(v.string()),
    itemCount: v.number(),
  })
    // L'index le plus sollicité du produit : requête permanente de chaque tablette de cuisine.
    .index("by_station_status_queued", ["prepStationId", "status", "queuedAt"])
    .index("by_order", ["orderId"])
    .index("by_venue_status", ["venueId", "status"])
    .index("by_session", ["tableSessionId"]),

  kitchenTicketItems: defineTable({
    venueId: v.id("venues"),
    kitchenTicketId: v.id("kitchenTickets"),
    orderItemId: v.id("orderItems"),
    /** Dupliqué volontairement : zéro jointure sur un écran qui se rafraîchit en continu. */
    nameSnapshot: v.string(),
    variantNameSnapshot: v.optional(v.string()),
    modifiersSnapshot: v.array(v.string()),
    quantity: v.number(),
    instructions: v.optional(v.string()),
    status: v.union(
      v.literal("pending"),
      v.literal("started"),
      v.literal("ready"),
      v.literal("cancelled"),
    ),
    allergyNote: v.optional(v.string()),
  })
    .index("by_ticket", ["kitchenTicketId"])
    .index("by_order_item", ["orderItemId"]),

  /* ══════════════════════════════════════════════════════════════════════════
   * 8. ADDITIONS, PAIEMENTS, CAISSE
   * ══════════════════════════════════════════════════════════════════════════ */

  checks: defineTable({
    venueId: v.id("venues"),
    tableSessionId: v.id("tableSessions"),
    reference: v.string(),
    label: v.optional(v.string()),
    splitMode: v.union(
      v.literal("full"),
      v.literal("by_items"),
      v.literal("by_guest"),
      v.literal("by_amount"),
      v.literal("even"),
    ),
    status: v.union(
      v.literal("open"),
      v.literal("awaiting_payment"),
      v.literal("partially_paid"),
      v.literal("paid"),
      v.literal("voided"),
    ),
    subtotal: money,
    discountTotal: money,
    taxTotal: money,
    serviceCharge: money,
    tipAmount: money,
    total: money,
    paidTotal: money,
    dueTotal: money,
    currency: v.string(),
    guestSessionIds: v.optional(v.array(v.id("guestSessions"))),
    openedByUserId: v.optional(v.id("users")),
    closedAt: v.optional(v.number()),
  })
    .index("by_session", ["tableSessionId"])
    .index("by_venue_status", ["venueId", "status"])
    .index("by_venue_closedAt", ["venueId", "closedAt"]),

  /** Allocation d'une ligne à une addition, y compris PARTIELLE (plat partagé à deux). */
  checkItems: defineTable({
    venueId: v.id("venues"),
    checkId: v.id("checks"),
    orderItemId: v.id("orderItems"),
    tableSessionId: v.id("tableSessions"),
    quantityShare: v.number(),
    amount: money,
    addedAt: v.number(),
  })
    .index("by_check", ["checkId"])
    .index("by_order_item", ["orderItemId"]), // vérifie qu'une ligne n'est pas allouée deux fois

  /** Une intention n'est pas de l'argent. */
  paymentIntents: defineTable({
    venueId: v.id("venues"),
    checkId: v.id("checks"),
    tableSessionId: v.id("tableSessions"),
    provider: v.string(),
    providerRef: v.optional(v.string()),
    amount: money,
    /**
     * Montant réellement accepté par le fournisseur. Certains imposent un pas (multiple de 5)
     * et ARRONDISSENT SANS PRÉVENIR : sans ce champ, l'écart disparaît et la caisse ne tombe
     * plus juste. On arrondit soi-même au supérieur avant l'appel, et on compare au retour.
     */
    acceptedAmount: v.optional(money),
    currency: v.string(),
    status: v.union(
      v.literal("created"),
      v.literal("processing"),
      v.literal("awaiting_confirmation"),
      v.literal("succeeded"),
      v.literal("failed"),
      v.literal("expired"),
    ),
    idempotencyKey: v.string(),
    guestSessionId: v.optional(v.id("guestSessions")),
    createdByUserId: v.optional(v.id("users")),
    redirectUrl: v.optional(v.string()),
    expiresAt: v.number(),
    lastCheckedAt: v.optional(v.number()),
    failureReason: v.optional(v.string()),
  })
    .index("by_check", ["checkId"])
    .index("by_provider_ref", ["provider", "providerRef"]) // chemin du webhook
    .index("by_idempotency", ["idempotencyKey"])
    .index("by_status_expires", ["status", "expiresAt"]),

  /** De l'argent réellement reçu. La table la plus sensible du produit. Jamais supprimée. */
  payments: defineTable({
    venueId: v.id("venues"),
    checkId: v.id("checks"),
    tableSessionId: v.id("tableSessions"),
    method: paymentMethod,
    provider: v.optional(v.string()),
    providerRef: v.optional(v.string()),
    paymentIntentId: v.optional(v.id("paymentIntents")),
    amount: money,
    tipAmount: money,
    currency: v.string(),
    status: v.union(
      v.literal("succeeded"),
      v.literal("voided"),
      v.literal("refunded"),
      v.literal("partially_refunded"),
    ),
    /** QUI a encaissé — indispensable à la traçabilité de l'argent. */
    collectedByUserId: v.optional(v.id("users")),
    guestSessionId: v.optional(v.id("guestSessions")),
    cashRegisterSessionId: v.optional(v.id("cashRegisterSessions")),
    receivedAmount: v.optional(money),
    changeAmount: v.optional(money),
    idempotencyKey: v.string(),
    voidedReason: v.optional(v.string()),
    voidedByUserId: v.optional(v.id("users")),
    createdAt: v.number(),
  })
    .index("by_check", ["checkId"])
    .index("by_venue_createdAt", ["venueId", "createdAt"])
    .index("by_register_session", ["cashRegisterSessionId"])
    .index("by_venue_method_createdAt", ["venueId", "method", "createdAt"])
    .index("by_provider_ref", ["provider", "providerRef"])
    .index("by_idempotency", ["idempotencyKey"]),

  refunds: defineTable({
    venueId: v.id("venues"),
    paymentId: v.id("payments"),
    checkId: v.id("checks"),
    amount: money,
    /** Obligatoire. Vérifié dans la mutation. */
    reason: v.string(),
    status: v.union(v.literal("pending"), v.literal("succeeded"), v.literal("failed")),
    requestedByUserId: v.id("users"),
    approvedByUserId: v.optional(v.id("users")),
    provider: v.optional(v.string()),
    providerRef: v.optional(v.string()),
    idempotencyKey: v.string(),
    createdAt: v.number(),
  })
    .index("by_payment", ["paymentId"])
    .index("by_venue_createdAt", ["venueId", "createdAt"]),

  /** La table qui rend l'idempotence des webhooks possible (R16). */
  webhookEvents: defineTable({
    provider: v.string(),
    providerEventId: v.string(),
    eventType: v.string(),
    signatureValid: v.boolean(),
    payload: v.any(),
    processedAt: v.optional(v.number()),
    processingResult: v.optional(v.string()),
    relatedIntentId: v.optional(v.id("paymentIntents")),
    receivedAt: v.number(),
    replayCount: v.number(),
  })
    // Portée = le fournisseur : un webhook arrive avant qu'on sache à quel tenant il appartient.
    .index("by_provider_event", ["provider", "providerEventId"])
    .index("by_processed", ["processedAt"])
    .index("by_provider_received", ["provider", "receivedAt"]),

  cashRegisters: defineTable({
    venueId: v.id("venues"),
    name: v.string(),
    isActive: v.boolean(),
  }).index("by_venue", ["venueId"]),

  cashRegisterSessions: defineTable({
    venueId: v.id("venues"),
    cashRegisterId: v.id("cashRegisters"),
    openedByUserId: v.id("users"),
    openedAt: v.number(),
    openingFloat: money,
    /** Les cinq états de la machine d'ARCHITECTURE.md §8 — le schéma n'en portait que trois. */
    status: v.union(
      v.literal("open"),
      v.literal("counting"),
      v.literal("balanced"),
      v.literal("discrepancy"),
      v.literal("closed"),
    ),
    /** CALCULÉ depuis les paiements en espèces de la session, jamais saisi. */
    expectedAmount: v.optional(money),
    countedAmount: v.optional(money),
    discrepancy: v.optional(money),
    closedByUserId: v.optional(v.id("users")),
    closedAt: v.optional(v.number()),
    adjustedByUserId: v.optional(v.id("users")),
    adjustmentReason: v.optional(v.string()),
  })
    .index("by_register_status", ["cashRegisterId", "status"]) // au plus une session ouverte
    .index("by_venue_openedAt", ["venueId", "openedAt"]),

  cashMovements: defineTable({
    venueId: v.id("venues"),
    registerSessionId: v.id("cashRegisterSessions"),
    type: v.union(
      v.literal("sale"),
      v.literal("refund"),
      v.literal("payout"),
      v.literal("deposit"),
      v.literal("correction"),
    ),
    amount: money,
    reason: v.optional(v.string()),
    createdByUserId: v.id("users"),
    paymentId: v.optional(v.id("payments")),
    createdAt: v.number(),
  })
    .index("by_session", ["registerSessionId"])
    .index("by_venue_createdAt", ["venueId", "createdAt"]),

  /**
   * `bills` et non `receipts` : en Côte d'Ivoire « reçu » désigne le RNE (Reçu Normalisé
   * Électronique) et « facture » le FNE — deux pièces CERTIFIÉES par la DGI. Un ticket non
   * certifié ne peut porter ni l'un ni l'autre de ces noms, dans l'UI comme dans le code.
   * Une fois certifiée, la pièce porte son type dans `fiscalType` (D-015, D-020, D-024).
   */
  bills: defineTable({
    venueId: v.id("venues"),
    checkId: v.id("checks"),
    tableSessionId: v.id("tableSessions"),
    reference: v.string(),
    snapshot: v.any(),
    format: v.string(),
    /** `none` = simple ticket. `rne` = reçu certifié B2C. `fne` = facture certifiée B2B. */
    fiscalType: v.union(v.literal("none"), v.literal("rne"), v.literal("fne")),
    /** Reste `none` tant que la spécification FNE/RNE n'est pas en main (A7, D-020). */
    fiscalStatus: v.union(
      v.literal("none"),
      v.literal("pending"),
      v.literal("submitted"),
      v.literal("accepted"),
      v.literal("rejected"),
    ),
    fiscalReference: v.optional(v.string()),
    fiscalQrPayload: v.optional(v.string()),
    fiscalSubmittedAt: v.optional(v.number()),
    fiscalError: v.optional(v.string()),
    /** Renseigné en B2B seulement : le FNE exige d'identifier l'acheteur. */
    buyerTaxId: v.optional(v.string()),
    issuedAt: v.number(),
    deliveredVia: v.array(v.string()),
    storageId: v.optional(v.id("_storage")),
  })
    .index("by_check", ["checkId"])
    .index("by_venue_issuedAt", ["venueId", "issuedAt"])
    .index("by_reference", ["reference"]) // vérification publique d'une pièce
    .index("by_venue_fiscal", ["venueId", "fiscalStatus"]),

  /* ══════════════════════════════════════════════════════════════════════════
   * 9. CLIENTS, RETOURS
   * ══════════════════════════════════════════════════════════════════════════ */

  customerProfiles: defineTable({
    organizationId: v.id("organizations"),
    venueIds: v.array(v.id("venues")),
    phone: v.optional(v.string()),
    email: v.optional(v.string()),
    name: v.optional(v.string()),
    locale: v.optional(v.string()),
    firstSeenAt: v.number(),
    lastSeenAt: v.number(),
    visitCount: v.number(),
    totalSpent: money,
    tags: v.array(v.string()),
    notes: v.optional(v.string()),
    status: v.union(v.literal("active"), v.literal("anonymized")),
  })
    .index("by_org_phone", ["organizationId", "phone"])
    .index("by_org_email", ["organizationId", "email"])
    .index("by_org_lastSeen", ["organizationId", "lastSeenAt"]),

  /** La PREUVE du consentement, datée et versionnée. Append-only. */
  customerConsents: defineTable({
    organizationId: v.id("organizations"),
    customerProfileId: v.id("customerProfiles"),
    purpose: v.string(),
    granted: v.boolean(),
    source: v.string(),
    textVersion: v.string(),
    ipHash: v.optional(v.string()),
    at: v.number(),
  })
    .index("by_profile_purpose", ["customerProfileId", "purpose"])
    .index("by_org_at", ["organizationId", "at"]),

  feedback: defineTable({
    venueId: v.id("venues"),
    tableSessionId: v.optional(v.id("tableSessions")),
    guestSessionId: v.optional(v.id("guestSessions")),
    rating: v.number(),
    comment: v.optional(v.string()),
    topics: v.array(v.string()),
    isPublicRedirect: v.boolean(),
    status: v.union(v.literal("new"), v.literal("seen"), v.literal("responded")),
    respondedByUserId: v.optional(v.id("users")),
    createdAt: v.number(),
  })
    .index("by_venue_createdAt", ["venueId", "createdAt"])
    .index("by_venue_rating", ["venueId", "rating"]),

  /* ══════════════════════════════════════════════════════════════════════════
   * 10. IA
   * ══════════════════════════════════════════════════════════════════════════ */

  aiConversations: defineTable({
    organizationId: v.id("organizations"),
    venueId: v.optional(v.id("venues")),
    surface: v.union(v.literal("guest"), v.literal("manager"), v.literal("import")),
    actorType,
    userId: v.optional(v.id("users")),
    guestSessionId: v.optional(v.id("guestSessions")),
    title: v.optional(v.string()),
    status: v.union(v.literal("active"), v.literal("closed")),
    createdAt: v.number(),
  })
    .index("by_org_created", ["organizationId", "createdAt"])
    .index("by_user", ["userId"]),

  aiMessages: defineTable({
    organizationId: v.id("organizations"),
    conversationId: v.id("aiConversations"),
    role: v.union(v.literal("system"), v.literal("user"), v.literal("assistant"), v.literal("tool")),
    content: v.string(),
    toolCalls: v.optional(v.any()),
    modelKey: v.optional(v.string()),
    createdAt: v.number(),
  }).index("by_conversation_created", ["conversationId", "createdAt"]),

  /** Sans cette table, la facture IA arrive sans explication. */
  aiUsage: defineTable({
    organizationId: v.id("organizations"),
    venueId: v.optional(v.id("venues")),
    userId: v.optional(v.id("users")),
    feature: v.string(),
    provider: v.string(),
    model: v.string(),
    promptTokens: v.number(),
    completionTokens: v.number(),
    costMinor: money,
    currency: v.string(),
    latencyMs: v.number(),
    success: v.boolean(),
    errorCode: v.optional(v.string()),
    at: v.number(),
  })
    .index("by_org_at", ["organizationId", "at"])
    .index("by_feature_at", ["feature", "at"])
    .index("by_model_at", ["model", "at"]),

  /** Proposition → aperçu → validation humaine → exécution → journal (D-014). */
  aiActionProposals: defineTable({
    venueId: v.id("venues"),
    proposedByConversationId: v.id("aiConversations"),
    actionType: v.string(),
    payload: v.any(),
    preview: v.string(),
    riskLevel: v.union(v.literal("low"), v.literal("medium"), v.literal("high")),
    status: v.union(
      v.literal("pending"),
      v.literal("approved"),
      v.literal("rejected"),
      v.literal("executed"),
      v.literal("expired"),
    ),
    reviewedByUserId: v.optional(v.id("users")),
    reviewedAt: v.optional(v.number()),
    executedAt: v.optional(v.number()),
    executionResult: v.optional(v.string()),
    expiresAt: v.number(),
  })
    .index("by_venue_status", ["venueId", "status"]),

  /* ══════════════════════════════════════════════════════════════════════════
   * 11. PLATEFORME
   * ══════════════════════════════════════════════════════════════════════════ */

  /** Append-only. Ne stocke NI secret, NI jeton, NI donnée de paiement. */
  auditLogs: defineTable({
    organizationId: v.id("organizations"),
    venueId: v.optional(v.id("venues")),
    actorType,
    actorUserId: v.optional(v.id("users")),
    /** Renseignés quand le geste vient d'un PIN ou d'un appareil (D-060). */
    actorMemberId: v.optional(v.id("organizationMembers")),
    actorDeviceId: v.optional(v.id("trustedDevices")),
    action: v.string(),
    resourceType: v.string(),
    resourceId: v.optional(v.string()),
    before: v.optional(v.any()),
    after: v.optional(v.any()),
    reason: v.optional(v.string()),
    source: v.union(
      v.literal("web"),
      v.literal("api"),
      v.literal("ai"),
      v.literal("support"),
      v.literal("system"),
    ),
    ipHash: v.optional(v.string()),
    at: v.number(),
  })
    .index("by_org_at", ["organizationId", "at"])
    .index("by_venue_at", ["venueId", "at"])
    .index("by_resource", ["resourceType", "resourceId"])
    .index("by_actor_at", ["actorUserId", "at"]),

  /** Le garde-fou central : une seconde requête renvoie le premier résultat (D-010). */
  idempotencyKeys: defineTable({
    key: v.string(),
    scope: v.string(),
    organizationId: v.optional(v.id("organizations")),
    resultRef: v.optional(v.string()),
    status: v.union(v.literal("in_progress"), v.literal("completed"), v.literal("failed")),
    createdAt: v.number(),
    expiresAt: v.number(),
  })
    .index("by_key", ["key"]) // la clé EST la portée
    .index("by_expires", ["expiresAt"]),

  /** Signalement depuis l'application. NE capture jamais jeton, OTP, ni donnée de paiement. */
  bugReports: defineTable({
    organizationId: v.optional(v.id("organizations")),
    venueId: v.optional(v.id("venues")),
    userId: v.optional(v.id("users")),
    title: v.string(),
    description: v.string(),
    screenshotStorageId: v.optional(v.id("_storage")),
    route: v.string(),
    role: v.optional(v.string()),
    userAgent: v.string(),
    appVersion: v.string(),
    consoleErrors: v.optional(v.array(v.string())),
    status: v.union(
      v.literal("new"),
      v.literal("triaged"),
      v.literal("in_progress"),
      v.literal("resolved"),
      v.literal("wont_fix"),
    ),
    severity: v.optional(v.string()),
    createdAt: v.number(),
  })
    .index("by_status_created", ["status", "createdAt"])
    .index("by_org", ["organizationId"]),

  /**
   * Agrégats quotidiens précalculés. ANALYTICS.md §3.5 les promet — « on ne recalcule pas six
   * mois d'historique à chaque ouverture d'écran » — mais aucune table ne les portait.
   *
   * `businessDate` est la journée DE L'ÉTABLISSEMENT, dans sa timezone : un service ouvert à
   * 23 h et clôturé à 1 h appartient au jour où les clients se sont installés (ANALYTICS.md
   * §3.4). Recalculable : une correction tardive (remboursement, annulation) déclenche la
   * reconstruction du jour concerné, d'où `computedAt` et `sourceVersion`.
   */
  dailyMetrics: defineTable({
    venueId: v.id("venues"),
    /** `YYYY-MM-DD` dans la timezone de l'établissement. */
    businessDate: v.string(),
    metrics: v.record(v.string(), v.number()),
    breakdowns: v.optional(v.any()),
    currency: v.string(),
    computedAt: v.number(),
    sourceVersion: v.number(),
  })
    .index("by_venue_date", ["venueId", "businessDate"]),

  notificationPreferences: defineTable({
    organizationId: v.id("organizations"),
    venueId: v.optional(v.id("venues")),
    userId: v.optional(v.id("users")),
    roleKey: v.optional(v.string()),
    eventType: v.string(),
    channels: v.array(v.string()),
    enabled: v.boolean(),
  })
    .index("by_venue_event", ["venueId", "eventType"])
    .index("by_user", ["userId"]),
});
