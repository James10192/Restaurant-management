import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { useMutation, useQuery } from "convex/react";
import { CircleCheck, CircleDashed, CircleSlash, LifeBuoy } from "lucide-react";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { GROUP_LABELS, STEP_META, type OnboardingStep } from "../../../convex/lib/onboarding";
import { EmptyState, LoadingState } from "~/components/app/states";
import { PendingButton } from "~/components/app/pending-button";
import { Alert, AlertDescription } from "~/components/ui/alert";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { Item, ItemActions, ItemContent, ItemDescription, ItemGroup, ItemMedia, ItemTitle } from "~/components/ui/item";
import { Progress } from "~/components/ui/progress";
import { describeError } from "~/lib/errors";

/*
 * Le tableau de mise en service (INFORMATION_ARCHITECTURE §5.1, D-176). Chaque étape ouvre le VRAI
 * écran de réglage : pas de formulaire jetable, qui divergerait du premier.
 */

/** L'écran qu'ouvre chaque étape. */
export const STEP_ROUTE = {
  identity: "/app/settings/venue",
  service: "/app/settings/devices",
  menu: "/app/menu/products",
  publish: "/app/menu",
  tables: "/app/floor",
  qr: "/app/floor/print",
  team: "/app/team",
} as const satisfies Record<OnboardingStep, string>;

/** Le canal d'aide réel (§5.1 : WhatsApp). Sans numéro configuré, pas de bouton qui ne mène nulle part. */
const SUPPORT_WHATSAPP = (import.meta.env.VITE_SUPPORT_WHATSAPP as string | undefined)?.replace(/\D/g, "") || null;

type BoardData = NonNullable<ReturnType<typeof useOnboardingProgress>>;
type Step = BoardData["steps"][number];

/** « 1 étape sur 7 », « 3 étapes sur 7 ». */
export function stepsCount(done: number, total: number): string {
  return `${done} étape${done > 1 ? "s" : ""} sur ${total}`;
}

export function useOnboardingProgress(venueId: Id<"venues"> | undefined) {
  return useQuery(api.onboarding.progress, venueId ? { venueId } : "skip");
}

export function ProgressBoard({ venueId }: { venueId: Id<"venues"> }) {
  const progress = useOnboardingProgress(venueId);
  if (progress === undefined) return <LoadingState />;
  if (progress === null) {
    return (
      <EmptyState
        title={<h1>La mise en service revient à votre responsable</h1>}
        description="Votre rôle ne comprend aucune de ses étapes. Tout ce qui vous concerne est déjà dans le menu."
        action={
          <Button asChild>
            <Link to="/app">Retour à l'accueil</Link>
          </Button>
        }
      />
    );
  }
  const groups = Object.keys(GROUP_LABELS) as (keyof typeof GROUP_LABELS)[];
  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
      <BoardHeader progress={progress} venueId={venueId} />
      {groups.map((group) => (
        <section key={group} aria-labelledby={`onboarding-${group}`} className="flex flex-col gap-3">
          <h2 id={`onboarding-${group}`} className="text-sm font-medium text-muted-foreground">
            {GROUP_LABELS[group]}
          </h2>
          <ItemGroup className="gap-2">
            {progress.steps
              .filter((s) => STEP_META[s.key].group === group)
              .map((s) => (
                <StepRow key={s.key} step={s} venueId={venueId} />
              ))}
          </ItemGroup>
        </section>
      ))}
    </div>
  );
}

function BoardHeader({ progress, venueId }: { progress: BoardData; venueId: Id<"venues"> }) {
  const requestHelp = useMutation(api.onboarding.requestHelp);
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight">{progress.venueName}</h1>
        <p className="text-muted-foreground">Mise en service. Rien n'est bloquant : chaque étape peut attendre.</p>
      </div>
      <div className="flex flex-col gap-2">
        <p className="text-sm font-medium" data-onboarding-count>
          {stepsCount(progress.doneCount, progress.total)}
        </p>
        <Progress value={(progress.doneCount / progress.total) * 100} aria-label="Avancement de la mise en service" />
      </div>
      <div className="flex flex-wrap gap-2">
        {progress.next ? (
          <Button asChild size="lg">
            <Link to={STEP_ROUTE[progress.next]}>Continuer : {STEP_META[progress.next].label.toLowerCase()}</Link>
          </Button>
        ) : progress.complete ? (
          <Alert>
            <CircleCheck />
            <AlertDescription>Tout est prêt. Les étapes sautées restent ici, si vous voulez y revenir.</AlertDescription>
          </Alert>
        ) : null}
        {SUPPORT_WHATSAPP ? (
          <Button asChild variant="outline" size="lg">
            <a href={`https://wa.me/${SUPPORT_WHATSAPP}`} target="_blank" rel="noreferrer" onClick={() => void requestHelp({ venueId })}>
              <LifeBuoy data-icon="inline-start" />
              Demander de l'aide
            </a>
          </Button>
        ) : null}
      </div>
    </div>
  );
}

const STATE_ICON = { done: CircleCheck, skipped: CircleSlash, todo: CircleDashed } as const;
const STATE_LABEL = { done: "Fait", skipped: "Sautée", todo: "À faire" } as const;

function StepRow({ step, venueId }: { step: Step; venueId: Id<"venues"> }) {
  const meta = STEP_META[step.key];
  const Icon = STATE_ICON[step.state];
  return (
    <Item variant="outline" role="listitem" data-onboarding-step={step.key} data-state={step.state} className={step.allowed ? undefined : "opacity-60"}>
      <ItemMedia variant="icon">
        <Icon aria-hidden="true" className={step.state === "done" ? "text-primary" : "text-muted-foreground"} />
      </ItemMedia>
      <ItemContent className="min-w-48">
        <ItemTitle className="line-clamp-none">
          {meta.label}
          <Badge variant={step.state === "done" ? "default" : "secondary"}>{STATE_LABEL[step.state]}</Badge>
        </ItemTitle>
        <ItemDescription>
          {step.allowed ? `${meta.why} Environ ${meta.minutes} min.` : whoCanText(step)}
        </ItemDescription>
      </ItemContent>
      {step.allowed && step.state !== "done" ? <StepActions step={step} venueId={venueId} /> : null}
    </Item>
  );
}

function whoCanText(step: Step): string {
  if (step.whoCan.length === 0) return "Personne dans l'établissement n'a ce droit pour l'instant.";
  const others = step.othersCount > 0 ? ` et ${step.othersCount} autre${step.othersCount > 1 ? "s" : ""}` : "";
  return `À faire par ${step.whoCan.join(", ")}${others}.`;
}

function StepActions({ step, venueId }: { step: Step; venueId: Id<"venues"> }) {
  const confirm = useMutation(api.onboarding.confirmStep);
  const skip = useMutation(api.onboarding.skipStep);
  const [busy, setBusy] = useState<"confirm" | "skip" | null>(null);
  const [error, setError] = useState<string | null>(null);
  async function run(kind: "confirm" | "skip", action: () => Promise<unknown>) {
    setBusy(kind);
    setError(null);
    try {
      await action();
    } catch (e) {
      setError(describeError(e).message);
    } finally {
      setBusy(null);
    }
  }
  const skipped = step.state === "skipped";
  return (
    <ItemActions className="w-full flex-wrap sm:w-auto">
      <Button asChild variant={skipped ? "outline" : "default"} size="sm">
        <Link to={STEP_ROUTE[step.key]}>{step.key === "service" ? "Vérifier" : "Ouvrir"}</Link>
      </Button>
      {step.key === "service" && !skipped ? (
        <PendingButton size="sm" variant="outline" pending={busy === "confirm"} pendingText="…" onClick={() => void run("confirm", () => confirm({ venueId, step: step.key }))}>
          C'est bon
        </PendingButton>
      ) : null}
      {step.key !== "identity" ? (
        <PendingButton size="sm" variant="ghost" pending={busy === "skip"} pendingText="…" onClick={() => void run("skip", () => skip({ venueId, step: step.key, skipped: !skipped }))}>
          {skipped ? "Reprendre" : "Plus tard"}
        </PendingButton>
      ) : null}
      {error ? <p role="alert" className="w-full text-sm text-destructive">{error}</p> : null}
    </ItemActions>
  );
}
