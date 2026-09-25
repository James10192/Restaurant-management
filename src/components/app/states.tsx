import { useEffect, useState, type ReactNode } from "react";
import { CircleAlert, CircleCheck, Inbox, Lock, WifiOff } from "lucide-react";
import { Button } from "~/components/ui/button";
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "~/components/ui/empty";
import { Spinner } from "~/components/ui/spinner";
import { PendingButton } from "~/components/app/pending-button";

/*
 * Les états d'un écran (chargement, vide, erreur, hors ligne, refus, succès), tous montés
 * sur le composant `Empty` de shadcn/ui. Aucun style propre : seulement la composition.
 */

type StateProps = {
  title?: ReactNode;
  description?: ReactNode;
  icon?: ReactNode;
  action?: ReactNode;
  secondaryAction?: ReactNode;
  children?: ReactNode;
  className?: string;
  role?: "status" | "alert";
};

function StateLayout({ title, description, icon, action, secondaryAction, children, className, role }: StateProps) {
  return (
    <Empty className={className} role={role}>
      <EmptyHeader>
        {icon ? <EmptyMedia variant="icon">{icon}</EmptyMedia> : null}
        {title ? <EmptyTitle>{title}</EmptyTitle> : null}
        {description ? <EmptyDescription>{description}</EmptyDescription> : null}
      </EmptyHeader>
      {children || action || secondaryAction ? (
        <EmptyContent>
          {children}
          {action || secondaryAction ? (
            <div className="flex flex-wrap justify-center gap-2">
              {action}
              {secondaryAction}
            </div>
          ) : null}
        </EmptyContent>
      ) : null}
    </Empty>
  );
}

/**
 * Rien pendant 300 ms (un indicateur qui clignote dérange plus qu'il n'aide), puis un
 * indicateur, puis au bout de 2 s le message de réseau lent.
 */
export function LoadingState({
  children,
  delay = 300,
  slowAfter = 2000,
  onRetry,
  slowAction,
  label = "Chargement",
  className,
}: {
  children?: ReactNode;
  delay?: number;
  slowAfter?: number;
  onRetry?: () => void;
  slowAction?: ReactNode;
  label?: string;
  className?: string;
}) {
  const [phase, setPhase] = useState<"waiting" | "visible" | "slow">(delay > 0 ? "waiting" : "visible");
  useEffect(() => {
    const show = window.setTimeout(() => setPhase((p) => (p === "waiting" ? "visible" : p)), delay);
    const slow = slowAfter > 0 ? window.setTimeout(() => setPhase("slow"), slowAfter) : undefined;
    return () => {
      window.clearTimeout(show);
      if (slow !== undefined) window.clearTimeout(slow);
    };
  }, [delay, slowAfter]);

  return (
    <div role="status" aria-busy={phase !== "slow"} className={className ?? "w-full"}>
      <span className="sr-only">{label}</span>
      {phase === "visible"
        ? (children ?? (
            <div aria-hidden="true" className="flex items-center justify-center gap-2 py-10 text-sm text-muted-foreground">
              <Spinner />
              Chargement…
            </div>
          ))
        : null}
      {phase === "slow" ? (
        <StateLayout
          icon={<Spinner />}
          title="Le réseau est lent"
          description="On continue d'essayer."
          action={
            onRetry ? (
              <Button variant="outline" onClick={onRetry}>
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

/** Un vide `positive` est une bonne nouvelle : aucune action, un bouton y inventerait un problème. */
export function EmptyState({
  title = "Rien à afficher pour l'instant",
  tone = "neutral",
  icon,
  action,
  secondaryAction,
  ...props
}: StateProps & { tone?: "neutral" | "positive" }) {
  const positive = tone === "positive";
  return (
    <StateLayout
      title={title}
      icon={positive ? <CircleCheck /> : (icon ?? <Inbox />)}
      action={positive ? undefined : action}
      secondaryAction={positive ? undefined : secondaryAction}
      {...props}
    />
  );
}

export function ErrorState({
  title = "Le contenu n'a pas pu être chargé",
  description = "Vérifiez la connexion, puis réessayez.",
  onRetry,
  retryLabel = "Réessayer",
  retrying = false,
  traceId,
  action,
  secondaryAction,
  children,
  ...props
}: StateProps & { onRetry?: () => void; retryLabel?: string; retrying?: boolean; traceId?: string }) {
  return (
    <StateLayout
      role="status"
      icon={<CircleAlert />}
      title={title}
      description={description}
      action={
        action ??
        (onRetry ? (
          <PendingButton onClick={onRetry} pending={retrying} pendingText="Nouvel essai…">
            {retryLabel}
          </PendingButton>
        ) : undefined)
      }
      secondaryAction={secondaryAction ?? (traceId ? <CopyTraceButton traceId={traceId} /> : undefined)}
      {...props}
    >
      {traceId ? (
        <p className="text-sm text-muted-foreground">
          Référence : <code className="font-mono select-all">{traceId}</code>
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
  return (
    <Button
      variant="ghost"
      onClick={() => {
        navigator.clipboard.writeText(traceId).then(
          () => setCopied(true),
          () => undefined,
        );
      }}
    >
      {copied ? "Référence copiée" : "Copier la référence"}
    </Button>
  );
}

export function OfflineState({
  title = "Connexion perdue",
  description = "Cette action demande le réseau. Elle redeviendra possible dès son retour.",
  ...props
}: StateProps) {
  return <StateLayout role="alert" icon={<WifiOff />} title={title} description={description} {...props} />;
}

/** « de » élidé devant une voyelle : « d'encaisser », « d'Akwaba ». */
function de(word: string): string {
  return /^[aeiouyàâäéèêëîïôöùûü]/i.test(word) ? `d'${word}` : `de ${word}`;
}

/**
 * Un droit manquant, pas une panne : on nomme le rôle, l'établissement et à qui
 * s'adresser, sans rien révéler de ce qui existe derrière.
 */
export function PermissionDeniedState({
  title = "Accès non autorisé",
  role,
  permission,
  venue,
  contact,
  description,
  ...props
}: StateProps & { role?: string; permission?: string; venue?: string; contact?: string }) {
  const refusal =
    role && permission
      ? `Votre rôle (${role}) ne permet pas ${de(permission)}.`
      : role
        ? `Votre rôle (${role}) ne donne pas accès à cette page.`
        : "Votre rôle ne donne pas accès à cette page.";
  const whom = contact ? (
    <strong>{contact}</strong>
  ) : venue ? (
    <>
      un responsable {de(venue).startsWith("d'") ? "d'" : "de "}
      <strong>{venue}</strong>
    </>
  ) : (
    "un responsable"
  );
  return (
    <StateLayout
      icon={<Lock />}
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

export function SuccessState({ title = "Enregistré", details, children, ...props }: StateProps & { details?: ReactNode }) {
  return (
    <StateLayout role="status" icon={<CircleCheck />} title={title} {...props}>
      {details ? <p className="text-sm tabular-nums">{details}</p> : null}
      {children}
    </StateLayout>
  );
}
