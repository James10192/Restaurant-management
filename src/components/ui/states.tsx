import { useEffect, useState, type ComponentProps, type ReactNode } from "react";
import { CircleAlert, Inbox, Lock, WifiOff } from "lucide-react";
import { cn } from "../../lib/cn";
import { GlyphShape } from "./badge";
import { Button } from "./button";
import { Spinner } from "./spinner";

/*
 * Les six états obligatoires de chaque écran — DESIGN.md §9.7 et §10.
 * Anatomie commune : glyphe 32 px (jamais une illustration), titre 20 px/600 qui dit
 * ce qui se passe, corps 15 px `ink-2` qui dit pourquoi, une action primaire et au plus
 * une secondaire. Centrés dans la zone concernée, pas dans la page entière.
 * Textes sobres : pas d'exclamation, pas de ton enjoué.
 */

type HeadingLevel = "h2" | "h3" | "p";

type StateLayoutProps = Omit<ComponentProps<"div">, "title"> & {
  glyph: ReactNode;
  title: ReactNode;
  description?: ReactNode;
  /** Action primaire (un `Button`). */
  action?: ReactNode;
  /** Au plus une action secondaire. */
  secondaryAction?: ReactNode;
  titleAs?: HeadingLevel;
};

function StateLayout({
  glyph,
  title,
  description,
  action,
  secondaryAction,
  titleAs: Title = "h2",
  className,
  children,
  ...props
}: StateLayoutProps) {
  return (
    <div
      className={cn(
        "flex w-full flex-col items-center justify-center gap-3 px-(--pad-card) py-10 text-center",
        className,
      )}
      {...props}
    >
      <div aria-hidden="true" className="flex size-8 items-center justify-center [&_svg]:size-8">
        {glyph}
      </div>
      <Title className="text-title-lg text-ink">{title}</Title>
      {description ? <div className="max-w-[60ch] text-body text-ink-2">{description}</div> : null}
      {children}
      {action || secondaryAction ? (
        <div className="mt-2 flex flex-wrap items-center justify-center gap-2">
          {action}
          {secondaryAction}
        </div>
      ) : null}
    </div>
  );
}

/** Glyphe dessiné de R-D3, pour un fait accompli ou un vide qui est une bonne nouvelle. */
function DoneGlyph() {
  return <GlyphShape glyph="●" className="size-7 text-success-600" />;
}

type CommonStateProps = Omit<StateLayoutProps, "glyph" | "title"> & {
  title?: ReactNode;
  /** Remplace le glyphe par défaut (une icône Lucide, 32 px). */
  icon?: ReactNode;
};

/* -------------------------------------------------------------------------- */
/* Chargement — §10.1                                                          */
/* -------------------------------------------------------------------------- */

export type LoadingStateProps = Omit<ComponentProps<"div">, "title"> & {
  /**
   * Squelette à la forme réelle du contenu (mêmes hauteurs, mêmes rayons). Sans lui,
   * un indicateur discret et le mot « Chargement… ».
   */
  children?: ReactNode;
  /** Sous ce délai, rien ne s'affiche : un squelette qui clignote 200 ms dérange plus qu'il n'aide. */
  delay?: number;
  /** Au-delà, le squelette cède la place au message de réseau lent. */
  slowAfter?: number;
  onRetry?: () => void;
  /** Chemin de contournement proposé quand le réseau est lent (R-D8). */
  slowAction?: ReactNode;
  /** Texte lu par les lecteurs d'écran. */
  label?: string;
};

export function LoadingState({
  children,
  delay = 300,
  slowAfter = 2000,
  onRetry,
  slowAction,
  label = "Chargement",
  className,
  ...props
}: LoadingStateProps) {
  const [phase, setPhase] = useState<"waiting" | "visible" | "slow">(
    delay > 0 ? "waiting" : "visible",
  );

  useEffect(() => {
    const show = window.setTimeout(
      () => setPhase((current) => (current === "waiting" ? "visible" : current)),
      delay,
    );
    const slow = slowAfter > 0 ? window.setTimeout(() => setPhase("slow"), slowAfter) : undefined;
    return () => {
      window.clearTimeout(show);
      if (slow !== undefined) window.clearTimeout(slow);
    };
  }, [delay, slowAfter]);

  return (
    <div
      role="status"
      aria-busy={phase !== "slow"}
      className={cn("w-full", className)}
      {...props}
    >
      <span className="sr-only">{label}</span>
      {phase === "visible"
        ? (children ?? (
            <div
              aria-hidden="true"
              className="flex items-center justify-center gap-2 py-10 text-body text-ink-3"
            >
              <Spinner decorative size="sm" />
              Chargement…
            </div>
          ))
        : null}
      {phase === "slow" ? (
        <StateLayout
          glyph={<Spinner decorative size="lg" className="text-ink-3" />}
          title="Le réseau est lent"
          description="On continue d'essayer."
          action={
            onRetry ? (
              <Button variant="secondary" onClick={onRetry}>
                Réessayer
              </Button>
            ) : undefined
          }
          secondaryAction={slowAction}
        />
      ) : null}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Vide — §10.2                                                                */
/* -------------------------------------------------------------------------- */

export type EmptyStateProps = CommonStateProps & {
  /**
   * `positive` : un vide qui est une bonne nouvelle (« Aucune commande en retard »).
   * Glyphe ● vert, et aucune action — un bouton y inventerait un problème (§10.2).
   */
  tone?: "neutral" | "positive";
};

export function EmptyState({
  title = "Rien à afficher pour l'instant",
  icon,
  tone = "neutral",
  action,
  secondaryAction,
  ...props
}: EmptyStateProps) {
  const positive = tone === "positive";
  return (
    <StateLayout
      glyph={positive ? <DoneGlyph /> : (icon ?? <Inbox className="text-ink-3" strokeWidth={1.75} />)}
      title={title}
      action={positive ? undefined : action}
      secondaryAction={positive ? undefined : secondaryAction}
      {...props}
    />
  );
}

/* -------------------------------------------------------------------------- */
/* Erreur — §10.3                                                              */
/* -------------------------------------------------------------------------- */

export type ErrorStateProps = CommonStateProps & {
  onRetry?: () => void;
  retryLabel?: string;
  /** Nouvel essai en cours : le bouton passe en « Nouvel essai… » et ne se clique pas deux fois. */
  retrying?: boolean;
  /**
   * Identifiant de trace, affiché en monospace et copiable. Obligatoire pour une
   * erreur sur une action financière (§10.3).
   */
  traceId?: string;
};

export function ErrorState({
  title = "Le contenu n'a pas pu être chargé",
  description = "Vérifiez la connexion, puis réessayez.",
  icon,
  onRetry,
  retryLabel = "Réessayer",
  retrying,
  traceId,
  action,
  secondaryAction,
  children,
  ...props
}: ErrorStateProps) {
  return (
    <StateLayout
      role="status"
      glyph={icon ?? <CircleAlert className="text-danger-600" strokeWidth={1.75} />}
      title={title}
      description={description}
      action={
        action ??
        (onRetry ? (
          <Button onClick={onRetry} loading={retrying ?? false} loadingText="Nouvel essai…">
            {retryLabel}
          </Button>
        ) : undefined)
      }
      secondaryAction={secondaryAction ?? (traceId ? <CopyTraceButton traceId={traceId} /> : undefined)}
      {...props}
    >
      {traceId ? (
        <p className="text-label text-ink-3 in-data-[density=guest]:text-body">
          Référence : <code className="font-mono text-ink-2 select-all">{traceId}</code>
        </p>
      ) : null}
      {children}
    </StateLayout>
  );
}

function CopyTraceButton({ traceId }: { traceId: string }) {
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!copied) return;
    const reset = window.setTimeout(() => setCopied(false), 2000);
    return () => window.clearTimeout(reset);
  }, [copied]);

  async function copy() {
    try {
      await navigator.clipboard.writeText(traceId);
      setCopied(true);
    } catch {
      // Presse-papiers refusé (contexte non sécurisé) : la référence reste sélectionnable à la main.
    }
  }

  return (
    <Button variant="quiet" onClick={copy}>
      {copied ? "Référence copiée" : "Copier la référence"}
    </Button>
  );
}

/* -------------------------------------------------------------------------- */
/* Hors ligne — §10.5                                                          */
/* -------------------------------------------------------------------------- */

export type OfflineStateProps = CommonStateProps;

/**
 * Action impossible sans réseau (cercle 3). La description dit ce qu'il reste à faire
 * à la main et comment ce sera rattrapé (R-D8) — la remplacer par le cas réel.
 * Annoncé d'autorité : la perte de connexion est la seule exception admise (§12.1).
 */
export function OfflineState({
  title = "Connexion perdue",
  description = "Cette action demande le réseau. Elle redeviendra possible dès son retour.",
  icon,
  ...props
}: OfflineStateProps) {
  return (
    <StateLayout
      role="alert"
      glyph={icon ?? <WifiOff className="text-warning-600" strokeWidth={1.75} />}
      title={title}
      description={description}
      {...props}
    />
  );
}

/* -------------------------------------------------------------------------- */
/* Permission refusée — §10.4                                                  */
/* -------------------------------------------------------------------------- */

/** « de » élidé devant une voyelle : « d'encaisser », « d'Akwaba ». */
function de(word: string): string {
  return /^[aeiouyàâäéèêëîïôöùûü]/i.test(word) ? `d'${word}` : `de ${word}`;
}

export type PermissionDeniedStateProps = CommonStateProps & {
  /** Rôle de la personne, tel qu'affiché dans l'équipe : « Serveur ». */
  role?: string;
  /** Ce qui est refusé, à l'infinitif : « encaisser », « consulter le chiffre d'affaires ». */
  permission?: string;
  /** Établissement concerné : un gérant multi-sites doit savoir où il se trouve. */
  venue?: string;
  /**
   * Qui contacter : « Awa Traoré, gérante ». Par défaut, « un responsable » de
   * l'établissement.
   */
  contact?: string;
};

/**
 * Un droit manquant, pas une panne (§10.4). On nomme le rôle, l'établissement et à qui
 * s'adresser ; on ne révèle rien de ce qui existe derrière. Ne se rencontre que par une
 * URL directe ou un droit retiré en cours de service : ailleurs, l'action est masquée.
 */
export function PermissionDeniedState({
  title = "Accès non autorisé",
  role,
  permission,
  venue,
  contact,
  description,
  icon,
  ...props
}: PermissionDeniedStateProps) {
  const refusal =
    role && permission
      ? `Votre rôle (${role}) ne permet pas ${de(permission)}.`
      : role
        ? `Votre rôle (${role}) ne donne pas accès à cette page.`
        : "Votre rôle ne donne pas accès à cette page.";

  const whom = contact ? (
    <strong className="font-semibold text-ink">{contact}</strong>
  ) : venue ? (
    <>
      un responsable {de(venue).startsWith("d'") ? "d'" : "de "}
      <strong className="font-semibold text-ink">{venue}</strong>
    </>
  ) : (
    "un responsable"
  );

  return (
    <StateLayout
      glyph={icon ?? <Lock className="text-ink-3" strokeWidth={1.75} />}
      title={title}
      description={
        description ?? (
          <>
            {refusal} Demandez ce droit à {whom}.
          </>
        )
      }
      {...props}
    />
  );
}

/* -------------------------------------------------------------------------- */
/* Succès — §10.6                                                              */
/* -------------------------------------------------------------------------- */

export type SuccessStateProps = CommonStateProps & {
  /**
   * La preuve : les faits réels renvoyés par le serveur, en chiffres tabulaires.
   * « 20 000 F · 20:41 · Espèces · Mariam » (§10.6).
   */
  details?: ReactNode;
};

/** Un fait, pas une fête : ni confettis, ni coche animée, ni son. */
export function SuccessState({
  title = "Enregistré",
  details,
  icon,
  children,
  ...props
}: SuccessStateProps) {
  return (
    <StateLayout role="status" glyph={icon ?? <DoneGlyph />} title={title} {...props}>
      {details ? <p className="num text-body text-ink">{details}</p> : null}
      {children}
    </StateLayout>
  );
}
