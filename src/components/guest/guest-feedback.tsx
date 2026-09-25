/**
 * L'avis après le repas — Joliba (D-105)
 *
 * Proposé dans les six heures qui suivent la clôture, à un convive qui était à la tablée, une
 * fois. Une note, des thèmes pris dans une liste fermée, un mot facultatif. Aucune coordonnée
 * n'est demandée, et l'écran rappelle de ne pas en mettre.
 *
 * L'avis va au restaurant et à lui seul : aucun renvoi vers un site d'avis public selon la note
 * (les avis « filtrés » sont interdits par Google, et trompent les autres clients).
 */

import { StarIcon } from "lucide-react";
import { useState } from "react";
import { Alert, AlertDescription } from "~/components/ui/alert";
import { Button } from "~/components/ui/button";
import { Drawer, DrawerClose, DrawerContent, DrawerDescription, DrawerFooter, DrawerHeader, DrawerTitle } from "~/components/ui/drawer";
import { Field, FieldDescription, FieldLabel, FieldLegend, FieldSet } from "~/components/ui/field";
import { Spinner } from "~/components/ui/spinner";
import { Textarea } from "~/components/ui/textarea";
import { ToggleGroup, ToggleGroupItem } from "~/components/ui/toggle-group";
import type { OrderText } from "~/lib/guest/order-text";
import { callTable } from "~/lib/guest/table-api";

const COMMENT_MAX = 500;

export function GuestFeedback({
  open,
  onOpenChange,
  guestKey,
  topics,
  online,
  o,
  onDone,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  guestKey: string;
  topics: readonly string[];
  online: boolean;
  o: OrderText;
  onDone: () => void;
}) {
  const [rating, setRating] = useState<number | null>(null);
  const [chosen, setChosen] = useState<string[]>([]);
  const [comment, setComment] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    if (rating === null) return setError(o.chooseRating);
    if (!online) return setError(o.offlineSend);
    setBusy(true);
    setError(null);
    try {
      const res = await callTable({
        action: "submitFeedback",
        guestKey,
        rating,
        ...(comment.trim() ? { comment: comment.trim() } : {}),
        topics: chosen,
      });
      if (!res.ok) return setError(res.error === "no_pass" ? o.noPass : o.networkError);
      const r = res.value;
      if (r.ok) return onDone();
      setError(r.reason === "not_eligible" ? o.feedbackTooLate : r.reason === "invalid_pass" ? o.noPass : o.networkError);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="mx-auto max-w-2xl">
        <DrawerHeader className="text-left">
          <DrawerTitle className="text-xl font-semibold tracking-tight">{o.feedbackTitle}</DrawerTitle>
          <DrawerDescription>{o.feedbackDescription}</DrawerDescription>
        </DrawerHeader>
        <div className="flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto px-4 pb-2">
          <FieldSet>
            <FieldLegend variant="label">{o.ratingLabel}</FieldLegend>
            <ToggleGroup
              type="single"
              variant="outline"
              spacing={1}
              value={rating === null ? "" : String(rating)}
              onValueChange={(v) => {
                setRating(v ? Number(v) : null);
                setError(null);
              }}
            >
              {[1, 2, 3, 4, 5].map((n) => (
                <ToggleGroupItem key={n} value={String(n)} aria-label={o.rating(n)} className="size-12">
                  <StarIcon className={rating !== null && n <= rating ? "fill-current" : undefined} />
                </ToggleGroupItem>
              ))}
            </ToggleGroup>
          </FieldSet>
          <FieldSet>
            <FieldLegend variant="label">{o.topicsLabel}</FieldLegend>
            <ToggleGroup type="multiple" variant="outline" spacing={1} className="flex-wrap" value={chosen} onValueChange={setChosen}>
              {topics.map((t) => (
                <ToggleGroupItem key={t} value={t} className="h-10 px-3">
                  {o.topics[t] ?? t}
                </ToggleGroupItem>
              ))}
            </ToggleGroup>
          </FieldSet>
          <Field>
            <FieldLabel htmlFor="feedback-comment">{o.commentLabel}</FieldLabel>
            <Textarea id="feedback-comment" rows={3} maxLength={COMMENT_MAX} value={comment} onChange={(e) => setComment(e.target.value)} />
            <FieldDescription>{o.commentHint}</FieldDescription>
          </Field>
          {error ? (
            <Alert variant="destructive" role="alert">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          ) : null}
        </div>
        <DrawerFooter>
          <Button type="button" size="lg" className="h-12" disabled={busy} onClick={() => void submit()}>
            {busy ? <Spinner data-icon="inline-start" /> : null}
            {o.feedbackSend}
          </Button>
          <DrawerClose asChild>
            <Button type="button" variant="outline" size="lg" className="h-11">
              {o.close}
            </Button>
          </DrawerClose>
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  );
}
