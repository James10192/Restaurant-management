/**
 * Composer un plat avant de l'ajouter au panier — Joliba (T2, D-061)
 *
 * Rendu DANS la fiche plat, seulement sur la carte de table : la carte publique n'en télécharge
 * rien. Variante, options, quantité, précision pour la cuisine, puis « Ajouter · prix ».
 *
 * La validité et le prix affiché viennent de la MÊME fonction pure que celle du serveur
 * (`convex/lib/ordering.ts`, `priceLine`) : ce que l'écran annonce est ce que Convex calculera,
 * disponibilité en direct comprise. Le prix reste « estimé » : Convex seul fait foi (R14).
 */

import { MinusIcon, PlusIcon } from "lucide-react";
import { useMemo, useState, type ReactNode } from "react";
import type { GuestMenu, GuestProduct, LiveAvailability } from "../../../convex/lib/guestMenu";
import { formatMoney, type CurrencyCode } from "../../../convex/lib/money";
import { ORDER_LIMITS, priceLine, type LineProblemCode } from "../../../convex/lib/ordering";
import { Button } from "~/components/ui/button";
import { ButtonGroup, ButtonGroupText } from "~/components/ui/button-group";
import { Checkbox } from "~/components/ui/checkbox";
import { DrawerClose, DrawerFooter } from "~/components/ui/drawer";
import { Field, FieldContent, FieldDescription, FieldLabel, FieldLegend, FieldSet, FieldTitle } from "~/components/ui/field";
import { RadioGroup, RadioGroupItem } from "~/components/ui/radio-group";
import { Textarea } from "~/components/ui/textarea";
import { availabilityIndex } from "~/lib/guest/availability";
import type { AddResult, DishChoice } from "~/lib/guest/cart";
import { localized, type GuestLocale, type GuestText } from "~/lib/guest/i18n";
import { ORDER_TEXT } from "~/lib/guest/order-text";

export type DishOrderFormProps = {
  menu: GuestMenu;
  sectionId: string;
  product: GuestProduct;
  live: LiveAvailability;
  timeZone: string;
  currency: string;
  now: number;
  locale: GuestLocale;
  t: GuestText;
  /** Le haut de la fiche (photo, nom, description) et son bas (allergènes), déjà rendus. */
  top: ReactNode;
  bottom: ReactNode;
  onAdd: (choice: DishChoice, productName: string) => AddResult;
  onDone: () => void;
};

function money(amount: number, currency: string) {
  return formatMoney({ amount, currency: currency as CurrencyCode });
}

function problemText(code: LineProblemCode, o: (typeof ORDER_TEXT)["fr"]): string {
  if (code === "ITEM_UNAVAILABLE" || code === "VARIANT_UNAVAILABLE" || code === "OPTION_UNAVAILABLE" || code === "PRODUCT_NOT_FOUND") return o.unavailable;
  if (code === "VARIANT_REQUIRED") return o.chooseVariant;
  return o.completeChoices;
}

export default function DishOrderForm(props: DishOrderFormProps) {
  const { product, locale, t, currency } = props;
  const o = ORDER_TEXT[locale];
  const defaultVariant = product.variants.length > 1 ? (product.variants.find((v) => v.isDefault) ?? product.variants[0])?.id : undefined;
  const [variantId, setVariantId] = useState<string | undefined>(defaultVariant);
  const [chosen, setChosen] = useState<Record<string, string[]>>({});
  const [quantity, setQuantity] = useState(1);
  const [instructions, setInstructions] = useState("");
  const [full, setFull] = useState<"full" | "locked" | null>(null);

  const optionIds = useMemo(() => product.modifierGroups.flatMap((g) => chosen[g.id] ?? []), [product, chosen]);

  // Le même calcul que Convex : prix, variante obligatoire, bornes des groupes, disponibilité.
  const priced = useMemo(
    () =>
      priceLine(
        { productId: product.id, ...(variantId ? { variantId } : {}), optionIds, quantity, instructions, courseNumber: 1 },
        0,
        new Map([[product.id, { menu: props.menu, sectionId: props.sectionId, product }]]),
        props.live,
        props.now,
        props.timeZone,
      ),
    [product, variantId, optionIds, quantity, instructions, props.menu, props.sectionId, props.live, props.now, props.timeZone],
  );
  const problem = "problem" in priced ? problemText(priced.problem.code, o) : null;
  const index = useMemo(() => availabilityIndex(props.live, props.now, props.timeZone), [props.live, props.now, props.timeZone]);
  const variantOk = (id: string) => index.variant(id);
  const optionOk = (id: string) => index.option(id);

  const toggle = (groupId: string, optionId: string, on: boolean, max: number) => {
    setChosen((prev) => {
      const current = prev[groupId] ?? [];
      if (!on) return { ...prev, [groupId]: current.filter((id) => id !== optionId) };
      // Un groupe à un seul choix remplace ; sinon on ajoute dans la limite du groupe.
      if (max === 1) return { ...prev, [groupId]: [optionId] };
      return current.length >= max ? prev : { ...prev, [groupId]: [...current, optionId] };
    });
  };

  const add = () => {
    if ("problem" in priced) return;
    const result = props.onAdd(
      {
        productId: product.id,
        ...(variantId ? { variantId } : {}),
        optionIds,
        quantity,
        ...(instructions.trim() ? { instructions: instructions.trim() } : {}),
      },
      localized(product, locale).name,
    );
    if (result === true) props.onDone();
    else setFull(result);
  };

  return (
    <>
      <div className="min-h-0 flex-1 overflow-y-auto px-4 pt-4">
        {props.top}

        {product.variants.length > 1 ? (
          <FieldSet className="mt-5">
            <FieldLegend variant="label">{o.chooseVariant}</FieldLegend>
            <RadioGroup value={variantId ?? ""} onValueChange={setVariantId}>
              {product.variants.map((v) => {
                const id = `v-${v.id}`;
                return (
                  <FieldLabel key={v.id} htmlFor={id}>
                    <Field orientation="horizontal" data-disabled={!variantOk(v.id) || undefined}>
                      <RadioGroupItem value={v.id} id={id} disabled={!variantOk(v.id)} />
                      <FieldContent>
                        <FieldTitle>
                          {localized(v, locale).name}
                          {variantOk(v.id) ? null : ` — ${t.soldOut}`}
                        </FieldTitle>
                      </FieldContent>
                      <span className="text-sm tabular-nums text-muted-foreground">{money(v.price, currency)}</span>
                    </Field>
                  </FieldLabel>
                );
              })}
            </RadioGroup>
          </FieldSet>
        ) : null}

        {product.modifierGroups.map((group) => {
          const max = group.selectionType === "single" ? 1 : group.maxSelect;
          const current = chosen[group.id] ?? [];
          const gt = localized(group, locale);
          const hint = `${group.isRequired ? `${t.required} · ` : ""}${t.chooseUpTo(max)}`;
          const price = (delta: number) =>
            delta !== 0 ? (
              <span className="text-sm tabular-nums text-muted-foreground">
                {delta > 0 ? "+ " : "− "}
                {money(Math.abs(delta), currency)}
              </span>
            ) : null;
          return (
            <FieldSet key={group.id} className="mt-5">
              <FieldLegend variant="label">
                {gt.name}
                <span className="ml-2 font-normal text-muted-foreground">{hint}</span>
              </FieldLegend>
              {max === 1 && group.isRequired ? (
                <RadioGroup value={current[0] ?? ""} onValueChange={(id) => toggle(group.id, id, true, 1)}>
                  {group.options.map((opt) => {
                    const id = `o-${group.id}-${opt.id}`;
                    const ok = optionOk(opt.id);
                    return (
                      <FieldLabel key={opt.id} htmlFor={id}>
                        <Field orientation="horizontal" data-disabled={!ok || undefined}>
                          <RadioGroupItem value={opt.id} id={id} disabled={!ok} />
                          <FieldContent>
                            <FieldTitle>
                              {localized(opt, locale).name}
                              {ok ? null : ` — ${t.soldOut}`}
                            </FieldTitle>
                          </FieldContent>
                          {price(opt.priceDelta)}
                        </Field>
                      </FieldLabel>
                    );
                  })}
                </RadioGroup>
              ) : (
                <div data-slot="checkbox-group" className="flex flex-col gap-3">
                  {group.options.map((opt) => {
                    const id = `o-${group.id}-${opt.id}`;
                    const checked = current.includes(opt.id);
                    const ok = optionOk(opt.id) && (checked || max === 1 || current.length < max);
                    return (
                      <FieldLabel key={opt.id} htmlFor={id}>
                        <Field orientation="horizontal" data-disabled={!ok || undefined}>
                          <Checkbox id={id} checked={checked} disabled={!ok} onCheckedChange={(on) => toggle(group.id, opt.id, on === true, max)} />
                          <FieldContent>
                            <FieldTitle>
                              {localized(opt, locale).name}
                              {optionOk(opt.id) ? null : ` — ${t.soldOut}`}
                            </FieldTitle>
                          </FieldContent>
                          {price(opt.priceDelta)}
                        </Field>
                      </FieldLabel>
                    );
                  })}
                </div>
              )}
            </FieldSet>
          );
        })}

        <Field className="mt-5">
          <FieldLabel htmlFor={`note-${product.id}`}>{o.instructions}</FieldLabel>
          <Textarea
            id={`note-${product.id}`}
            value={instructions}
            maxLength={ORDER_LIMITS.instructions}
            rows={2}
            onChange={(e) => setInstructions(e.target.value)}
          />
          <FieldDescription>{o.instructionsHint(ORDER_LIMITS.instructions)}</FieldDescription>
        </Field>

        {props.bottom}
      </div>
      {/* Quantité et ajout sur une seule ligne : le pied du tiroir reste court, les choix restent visibles.
          Le tiroir se ferme d'un glissement, d'un appui à côté ou avec Échap. */}
      <DrawerFooter className="gap-2 border-t pt-3">
        {problem || full ? (
          <p role="status" className="text-sm text-muted-foreground">
            {full === "locked" ? o.cartLocked : full ? o.cartFull : problem}
          </p>
        ) : null}
        <div className="flex items-center gap-2">
          <ButtonGroup aria-label={o.quantity}>
            <Button type="button" variant="outline" size="icon-lg" className="size-12" aria-label={o.less} disabled={quantity <= 1} onClick={() => setQuantity((q) => Math.max(1, q - 1))}>
              <MinusIcon />
            </Button>
            <ButtonGroupText className="min-w-10 justify-center tabular-nums" aria-live="polite">
              {quantity}
            </ButtonGroupText>
            <Button
              type="button"
              variant="outline"
              size="icon-lg"
              className="size-12"
              aria-label={o.more}
              disabled={quantity >= ORDER_LIMITS.quantity}
              onClick={() => setQuantity((q) => Math.min(ORDER_LIMITS.quantity, q + 1))}
            >
              <PlusIcon />
            </Button>
          </ButtonGroup>
          <Button type="button" size="lg" className="h-12 min-w-0 flex-1" disabled={"problem" in priced || full !== null} onClick={add}>
            <span className="truncate">{"line" in priced ? o.addToCart(money(priced.line.lineTotal, currency)) : t.add}</span>
          </Button>
        </div>
        <DrawerClose asChild>
          <Button type="button" variant="ghost" size="lg" className="h-10">
            {t.close}
          </Button>
        </DrawerClose>
      </DrawerFooter>
    </>
  );
}
