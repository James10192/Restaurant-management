/**
 * Catalogue des permissions — Joliba
 *
 * SOURCE DE VÉRITÉ. Il vit dans le code, pas en base (décision D-002) :
 *
 *  - une permission naît avec la fonctionnalité qu'elle protège, et meurt avec elle,
 *    dans le même commit ;
 *  - le type `Permission` n'existerait pas si le catalogue était une table — une
 *    permission inexistante ne compilerait plus ;
 *  - une table imposerait une migration à chaque livraison, et créerait une seconde
 *    source de vérité à tenir synchronisée.
 *
 * Ce sont les RÔLES qui sont des données : ils appartiennent à l'organisation, qui les
 * compose librement à partir de ce catalogue (table `roles`).
 *
 * Convention de nommage : `domaine.action[.qualifier]`, minuscules, `snake_case` pour les
 * qualifieurs composés, domaine au SINGULIER. Jamais d'espace, jamais de tiret.
 *
 * Voir PERMISSIONS.md — les deux doivent rester alignés (un test le vérifie).
 */

export type PermissionScope = "organization" | "venue";

export type PermissionMeta = {
  /** Libellé affiché dans l'écran de composition des rôles. */
  label: string;
  /** Regroupement dans l'interface. */
  group: string;
  /** Portée dans laquelle la permission s'évalue. */
  scope: PermissionScope;
  /** Action à conséquence financière, juridique ou irréversible : attribution prudente. */
  sensitive?: boolean;
  /** Écrit systématiquement dans `auditLogs`. */
  audited?: boolean;
  /** Exige un motif écrit de la part de l'acteur. */
  requiresReason?: boolean;
  /**
   * Utilisable sous PIN, sur un appareil enrôlé (D-060). Plafond et non octroi : sous PIN,
   * les droits sont ceux du rôle ∩ ces permissions-là. Jamais une permission sensible, de
   * portée organisation, d'équipe ou de réglage (vérifié par un test).
   */
  pin?: boolean;
};

export const PERMISSIONS = {
  /* ── Organisation ────────────────────────────────────────────────────── */
  "organization.manage": { label: "Gérer l'organisation", group: "Organisation", scope: "organization", sensitive: true, audited: true },
  "organization.billing.manage": { label: "Gérer l'abonnement et la facturation", group: "Organisation", scope: "organization", sensitive: true, audited: true },
  "organization.analytics.read": { label: "Voir les analytics consolidées", group: "Organisation", scope: "organization" },
  "venue.create": { label: "Créer un établissement", group: "Organisation", scope: "organization", audited: true },

  /* ── Établissement ───────────────────────────────────────────────────── */
  "venue.read": { label: "Voir l'établissement", group: "Établissement", scope: "venue", pin: true },
  "venue.manage": { label: "Configurer l'établissement", group: "Établissement", scope: "venue", audited: true },
  // Séparée de `venue.manage` : changer le mode de service change le fonctionnement
  // de tout le restaurant (qui commande, quand on paie, où l'on paie).
  "venue.settings.service": { label: "Changer le mode de service", group: "Établissement", scope: "venue", sensitive: true, audited: true },

  /* ── Carte ───────────────────────────────────────────────────────────── */
  "menu.read": { label: "Voir la carte", group: "Carte", scope: "venue", pin: true },
  "menu.edit": { label: "Modifier la carte", group: "Carte", scope: "venue" },
  "menu.publish": { label: "Publier la carte", group: "Carte", scope: "venue", audited: true },
  // Séparée de `menu.edit` : changer un prix est un acte financier.
  "menu.price.edit": { label: "Modifier les prix", group: "Carte", scope: "venue", sensitive: true, audited: true },
  // Séparée des deux précédentes : c'est un GESTE DE SERVICE. Un chef de rang doit
  // pouvoir signaler une rupture sans pouvoir toucher aux prix.
  "menu.availability.toggle": { label: "Rendre un plat disponible ou non", group: "Carte", scope: "venue", pin: true },

  /* ── Salle et tables ─────────────────────────────────────────────────── */
  "table.read": { label: "Voir les tables", group: "Salle", scope: "venue", pin: true },
  "table.manage": { label: "Gérer les tables et le plan de salle", group: "Salle", scope: "venue" },
  "table.session.open": { label: "Ouvrir une table", group: "Salle", scope: "venue", pin: true },
  "table.session.close": { label: "Clôturer une table", group: "Salle", scope: "venue", audited: true, pin: true },
  // Séparée de `table.session.close` : clôturer une table SUR LAQUELLE IL RESTE UN DÛ,
  // c'est renoncer à de l'argent. R2 exigeait « permission + motif » sans qu'aucune
  // permission de ce nom existe — tout serveur aurait pu le faire. (Manque G3.)
  "table.session.close_with_debt": { label: "Clôturer une table avec un impayé", group: "Salle", scope: "venue", sensitive: true, audited: true, requiresReason: true },
  "table.session.transfer": { label: "Déplacer, fusionner ou scinder des tables", group: "Salle", scope: "venue", audited: true, pin: true },
  "table.qr.manage": { label: "Gérer les QR codes", group: "Salle", scope: "venue", audited: true },

  /* ── Commandes ───────────────────────────────────────────────────────── */
  "order.read": { label: "Voir les commandes", group: "Commandes", scope: "venue", pin: true },
  "order.create": { label: "Créer une commande", group: "Commandes", scope: "venue", pin: true },
  "order.accept": { label: "Accepter une commande client", group: "Commandes", scope: "venue", pin: true },
  "order.modify": { label: "Modifier une commande avant production", group: "Commandes", scope: "venue", pin: true },
  // Séparée : modifier après départ en production coûte des denrées déjà engagées.
  "order.modify.after_fire": { label: "Modifier une commande après envoi en production", group: "Commandes", scope: "venue", sensitive: true, audited: true, requiresReason: true },
  "order.cancel": { label: "Annuler une commande", group: "Commandes", scope: "venue", sensitive: true, audited: true, requiresReason: true },
  "order.discount.apply": { label: "Appliquer une remise", group: "Commandes", scope: "venue", sensitive: true, audited: true, requiresReason: true },
  "order.course.fire": { label: "Déclencher un service en attente", group: "Commandes", scope: "venue", pin: true },
  // Porter à table est un geste distinct de la saisie : un commis de salle sert sans prendre
  // de commande. Séparée de `order.modify`, qui ne concerne que l'avant-production.
  "order.serve": { label: "Marquer des plats servis", group: "Commandes", scope: "venue", pin: true },

  /* ── Production ──────────────────────────────────────────────────────── */
  "kitchen.read": { label: "Voir l'écran de production", group: "Production", scope: "venue", pin: true },
  "kitchen.ticket.update": { label: "Démarrer, marquer prêt, rappeler un bon", group: "Production", scope: "venue", pin: true },
  "kitchen.manage": { label: "Configurer les stations", group: "Production", scope: "venue" },

  /* ── Service ─────────────────────────────────────────────────────────── */
  "service_request.read": { label: "Voir les demandes clients", group: "Service", scope: "venue", pin: true },
  "service_request.handle": { label: "Prendre en charge une demande client", group: "Service", scope: "venue", pin: true },

  /* ── Encaissement ────────────────────────────────────────────────────── */
  "payment.read": { label: "Voir les paiements", group: "Encaissement", scope: "venue", pin: true },
  "payment.collect": { label: "Encaisser", group: "Encaissement", scope: "venue", audited: true, pin: true },
  "payment.refund": { label: "Rembourser", group: "Encaissement", scope: "venue", sensitive: true, audited: true, requiresReason: true },
  "payment.void": { label: "Annuler un paiement saisi par erreur", group: "Encaissement", scope: "venue", sensitive: true, audited: true, requiresReason: true },
  "check.manage": { label: "Créer, scinder et fusionner des additions", group: "Encaissement", scope: "venue", pin: true },
  // Renvoyer un ticket à un client qui l'a perdu : ce n'est pas lire un paiement, c'est
  // ré-émettre une pièce — et l'envoyer quelque part. D'où une permission à part.
  "bill.reissue": { label: "Ré-émettre ou renvoyer un ticket", group: "Encaissement", scope: "venue", audited: true },
  // Sous PIN (T3) : le caissier sur la tablette partagée. Ouvrir SA PROPRE pochette relève
  // de `payment.collect` ; `cash_register.open`/`close` servent aux tiroirs et au comptage de la
  // pochette d'un autre. Rembourser, annuler un paiement, corriger un écart : compte seulement
  // (D-060 — jamais le PIN d'un gérant tapé sur un appareil partagé).
  "cash_register.open": { label: "Ouvrir une session de caisse", group: "Encaissement", scope: "venue", audited: true, pin: true },
  // Clôturer AVEC un écart constaté relève de `cash_register.close` : l'écart est une
  // donnée, pas une faute. Seule sa CORRECTION exige `cash_register.adjust`. Sans cette
  // distinction, un caissier ne pouvait pas fermer sa caisse un soir d'écart. (Manque G4.)
  "cash_register.close": { label: "Clôturer une session de caisse, écart compris", group: "Encaissement", scope: "venue", audited: true, pin: true },
  "cash_register.adjust": { label: "Corriger un écart de caisse", group: "Encaissement", scope: "venue", sensitive: true, audited: true, requiresReason: true },
  // Le rapport de fin de service est la promesse de T3 (« qu'est-ce qui est entré, par qui ») :
  // il ne dépend pas du module d'analyses financières, qu'un plan peut retirer.
  "report.service_day.read": { label: "Lire le rapport de fin de service", group: "Encaissement", scope: "venue", sensitive: true },

  /* ── Clients ─────────────────────────────────────────────────────────── */
  "customer.read": { label: "Voir les clients", group: "Clients", scope: "venue" },
  "customer.manage": { label: "Gérer les clients", group: "Clients", scope: "venue", audited: true },
  "loyalty.manage": { label: "Gérer la fidélité", group: "Clients", scope: "venue" },
  "reservation.read": { label: "Voir les réservations", group: "Clients", scope: "venue" },
  "reservation.manage": { label: "Gérer les réservations", group: "Clients", scope: "venue" },

  /* ── Stock (différé en V1, catalogue réservé) ────────────────────────── */
  "inventory.read": { label: "Voir le stock", group: "Stock", scope: "venue" },
  "inventory.manage": { label: "Gérer le stock", group: "Stock", scope: "venue" },
  "inventory.count": { label: "Effectuer un inventaire", group: "Stock", scope: "venue", audited: true },
  "inventory.waste.declare": { label: "Déclarer une perte", group: "Stock", scope: "venue", audited: true, requiresReason: true },

  /* ── Équipe ──────────────────────────────────────────────────────────── */
  "team.read": { label: "Voir l'équipe", group: "Équipe", scope: "venue" },
  "team.manage": { label: "Inviter et gérer l'équipe", group: "Équipe", scope: "venue", sensitive: true, audited: true },
  "permissions.manage": { label: "Gérer les rôles et les permissions", group: "Équipe", scope: "organization", sensitive: true, audited: true },
  "device.manage": { label: "Enrôler et révoquer un appareil", group: "Équipe", scope: "venue", sensitive: true, audited: true },

  /* ── Données ─────────────────────────────────────────────────────────── */
  "analytics.read": { label: "Voir les analytics", group: "Données", scope: "venue" },
  "analytics.financial.read": { label: "Voir les données financières", group: "Données", scope: "venue", sensitive: true },
  "audit.read": { label: "Consulter le journal d'audit", group: "Données", scope: "venue" },
  // Séparée : un export est une surface d'exfiltration, pas une simple lecture.
  "export.data": { label: "Exporter les données", group: "Données", scope: "venue", sensitive: true, audited: true },

  /* ── IA ──────────────────────────────────────────────────────────────── */
  "ai.use": { label: "Utiliser l'assistant", group: "IA", scope: "venue" },
  "ai.actions.propose": { label: "Demander une action à l'assistant", group: "IA", scope: "venue" },
  // JAMAIS accordée par défaut au même rôle que `ai.actions.propose` : c'est cette
  // séparation qui empêche l'IA d'agir seule (D-014).
  "ai.actions.approve": { label: "Valider une action proposée par l'IA", group: "IA", scope: "venue", sensitive: true, audited: true },
} as const satisfies Record<string, PermissionMeta>;

export type Permission = keyof typeof PERMISSIONS;

/**
 * Permissions de la PLATEFORME. Jamais attribuables par une organisation, jamais
 * présentes dans un rôle client : elles vivent dans `platformAdmins` et passent par
 * une garde distincte (`requirePlatformAdmin`). Le filtrage se fait À L'ÉCRITURE
 * d'un rôle, pas seulement dans l'interface.
 */
export const PLATFORM_PERMISSIONS = {
  "platform.organizations.read": { label: "Voir les organisations", group: "Plateforme", scope: "organization" },
  "platform.organizations.manage": { label: "Gérer les organisations", group: "Plateforme", scope: "organization", sensitive: true, audited: true },
  "platform.impersonate": { label: "Accéder au contexte d'un client", group: "Plateforme", scope: "organization", sensitive: true, audited: true, requiresReason: true },
  "platform.support.manage": { label: "Gérer le support", group: "Plateforme", scope: "organization" },
  "platform.flags.manage": { label: "Gérer les drapeaux de fonctionnalité", group: "Plateforme", scope: "organization", audited: true },
  "platform.incidents.manage": { label: "Gérer les incidents", group: "Plateforme", scope: "organization" },
  "platform.audit.read": { label: "Consulter l'audit plateforme", group: "Plateforme", scope: "organization" },
} as const satisfies Record<string, PermissionMeta>;

export type PlatformPermission = keyof typeof PLATFORM_PERMISSIONS;

export const ALL_PERMISSIONS = Object.keys(PERMISSIONS) as Permission[];

export function isPermission(value: string): value is Permission {
  return value in PERMISSIONS;
}

/** Une permission plateforme dans un rôle client est refusée à l'écriture. */
export function isPlatformPermission(value: string): boolean {
  return value.startsWith("platform.");
}

/**
 * `satisfies` conserve les types littéraux : l'union résultante n'expose pas les
 * propriétés absentes de chaque entrée. On repasse donc par `PermissionMeta` pour
 * lire un champ optionnel — sans perdre le typage strict des CLÉS, qui est ce qui
 * compte ici.
 */
/** Les permissions utilisables sous PIN (D-060). */
export const PIN_PERMISSIONS: ReadonlySet<Permission> = new Set(
  (Object.entries(PERMISSIONS) as [Permission, PermissionMeta][]).filter(([, m]) => m.pin === true).map(([p]) => p),
);

export function permissionMeta(p: Permission): PermissionMeta {
  return PERMISSIONS[p] as PermissionMeta;
}

export function permissionsRequiringReason(values: readonly string[]): string[] {
  return values.filter((v) => isPermission(v) && permissionMeta(v).requiresReason === true);
}

/**
 * Modèles de rôles copiés dans chaque organisation à sa création. Ce sont des POINTS
 * DE DÉPART : l'organisation les modifie ensuite librement. Ce ne sont pas des
 * constantes du logiciel, et aucun code ne doit tester un nom de rôle.
 */
export const ROLE_TEMPLATES = {
  owner: { label: "Propriétaire", permissions: ALL_PERMISSIONS },

  organization_admin: {
    label: "Administrateur",
    permissions: ALL_PERMISSIONS.filter((p) => p !== "organization.billing.manage"),
  },

  venue_manager: {
    label: "Responsable d'établissement",
    permissions: [
      "venue.read", "venue.manage", "venue.settings.service",
      "menu.read", "menu.edit", "menu.publish", "menu.price.edit", "menu.availability.toggle",
      "table.read", "table.manage", "table.session.open", "table.session.close",
      "table.session.close_with_debt", "table.session.transfer", "table.qr.manage",
      "order.read", "order.create", "order.accept", "order.modify", "order.modify.after_fire",
      "order.cancel", "order.discount.apply", "order.course.fire", "order.serve",
      "kitchen.read", "kitchen.ticket.update", "kitchen.manage",
      "service_request.read", "service_request.handle",
      "payment.read", "payment.collect", "payment.refund", "payment.void", "check.manage", "bill.reissue",
      "cash_register.open", "cash_register.close", "cash_register.adjust", "report.service_day.read",
      "customer.read", "customer.manage", "reservation.read", "reservation.manage",
      "team.read", "team.manage", "device.manage",
      "analytics.read", "analytics.financial.read", "audit.read", "export.data",
      "ai.use", "ai.actions.propose", "ai.actions.approve",
    ],
  },

  floor_manager: {
    label: "Chef de rang",
    permissions: [
      "venue.read", "menu.read", "menu.availability.toggle",
      "table.read", "table.session.open", "table.session.close", "table.session.close_with_debt",
      "table.session.transfer",
      "order.read", "order.create", "order.accept", "order.modify", "order.modify.after_fire",
      "order.cancel", "order.discount.apply", "order.course.fire", "order.serve",
      "kitchen.read", "service_request.read", "service_request.handle",
      "payment.read", "payment.collect", "check.manage",
      "customer.read", "team.read", "analytics.read", "ai.use",
    ],
  },

  // Volontairement SANS `payment.collect` : dans beaucoup d'établissements le serveur
  // encaisse, dans d'autres non. C'est exactement pourquoi c'est une permission et non
  // un rôle — le restaurant coche la case, sans qu'on touche au logiciel.
  waiter: {
    label: "Serveur",
    permissions: [
      "venue.read", "menu.read",
      "table.read", "table.session.open", "table.session.close",
      "order.read", "order.create", "order.accept", "order.modify", "order.course.fire", "order.serve",
      "kitchen.read", "service_request.read", "service_request.handle",
      "check.manage", "payment.read",
    ],
  },

  cashier: {
    label: "Caissier",
    permissions: [
      "venue.read", "menu.read", "table.read", "order.read",
      "check.manage", "bill.reissue", "payment.read", "payment.collect",
      "cash_register.open", "cash_register.close",
    ],
  },

  kitchen: {
    label: "Cuisine",
    permissions: ["venue.read", "menu.read", "menu.availability.toggle", "kitchen.read", "kitchen.ticket.update", "order.read"],
  },

  bar: {
    label: "Bar",
    permissions: ["venue.read", "menu.read", "menu.availability.toggle", "kitchen.read", "kitchen.ticket.update", "order.read"],
  },

  menu_manager: {
    label: "Responsable de la carte",
    permissions: ["venue.read", "menu.read", "menu.edit", "menu.publish", "menu.price.edit", "menu.availability.toggle"],
  },

  // Aucune écriture. Un comptable lit et exporte, il ne modifie rien.
  accountant: {
    label: "Comptable",
    permissions: ["venue.read", "payment.read", "report.service_day.read", "analytics.read", "analytics.financial.read", "audit.read", "export.data"],
  },

  analyst: {
    label: "Analyste",
    permissions: ["venue.read", "analytics.read", "analytics.financial.read"],
  },

  support: {
    label: "Support",
    permissions: ["venue.read", "menu.read", "table.read", "order.read", "payment.read", "service_request.read", "customer.read"],
  },
} as const satisfies Record<string, { label: string; permissions: readonly string[] }>;

export type RoleTemplateKey = keyof typeof ROLE_TEMPLATES;
