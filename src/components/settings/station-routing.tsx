import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import { ChevronDown, CircleAlert } from "lucide-react";
import { toast } from "sonner";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { EmptyState, LoadingState } from "~/components/app/states";
import { Alert, AlertDescription } from "~/components/ui/alert";
import { Button } from "~/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "~/components/ui/card";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "~/components/ui/collapsible";
import { Item, ItemActions, ItemContent, ItemDescription, ItemGroup, ItemTitle } from "~/components/ui/item";
import { NativeSelect, NativeSelectOption } from "~/components/ui/native-select";
import { Spinner } from "~/components/ui/spinner";
import { describeError } from "~/lib/errors";

type Station = FunctionReturnType<typeof api.stations.list>[number];
type SectionRoute = FunctionReturnType<typeof api.stations.routing>[number];
type Product = SectionRoute["products"][number];

const DEFAULT = "default";
const MIXED = "mixed";

function toValue(stationId: SectionRoute["stationId"]): string {
  if (stationId === null) return DEFAULT;
  return stationId;
}

/**
 * « Boissons → Bar » en un geste, et l'exception produit par produit. Le routage vaut pour les
 * commandes suivantes : les bons déjà partis gardent leur poste.
 */
export function StationRouting({
  venueId,
  stations,
}: {
  venueId: Id<"venues">;
  stations: Station[];
}) {
  const routing = useQuery(api.stations.routing, { venueId });
  const routeSection = useMutation(api.stations.routeSection);
  const routeProduct = useMutation(api.stations.routeProduct);
  const [pending, setPending] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const active = stations.filter((s) => s.isActive);
  const defaultStation = active.find((s) => s.isDefault) ?? null;


  const options = (
    <>
      <NativeSelectOption value={DEFAULT}>Poste par défaut{defaultStation ? ` (${defaultStation.name})` : ""}</NativeSelectOption>
      {active.map((s) => (
        <NativeSelectOption key={s._id} value={s._id}>
          {s.name}
        </NativeSelectOption>
      ))}
    </>
  );

  async function onSection(section: SectionRoute, value: string) {
    if (value === MIXED) return;
    setError(null);
    setPending(section.sectionId);
    try {
      const count = await routeSection({
        venueId,
        sectionId: section.sectionId,
        stationId: value === DEFAULT ? null : (value as Id<"prepStations">),
      });
      toast.success(`${section.sectionName} : ${count} produit${count > 1 ? "s" : ""} routé${count > 1 ? "s" : ""}.`);
    } catch (e) {
      setError(describeError(e).message);
    } finally {
      setPending(null);
    }
  }

  async function onProduct(product: Product, value: string) {
    if (!value) return;
    setError(null);
    setPending(product._id);
    try {
      await routeProduct({ venueId, productId: product._id, stationId: value === DEFAULT ? null : (value as Id<"prepStations">) });
      toast.success(`${product.name} routé.`);
    } catch (e) {
      setError(describeError(e).message);
    } finally {
      setPending(null);
    }
  }

  if (routing === undefined) return <LoadingState />;
  if (routing.length === 0) {
    return (
      <EmptyState
        className="border"
        title={<h2>Aucune section à router</h2>}
        description="Créez d'abord les sections de votre carte : elles apparaîtront ici avec leur poste."
      />
    );
  }

  const menus = [...new Set(routing.map((r) => r.menuName))];

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-muted-foreground">
        Le changement vaut pour les prochaines commandes : les bons déjà envoyés restent sur leur poste.
      </p>
      {error ? (
        <Alert variant="destructive">
          <CircleAlert />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}
      {menus.map((menuName) => (
        <Card key={menuName}>
          <CardHeader>
            <CardTitle>{menuName}</CardTitle>
            {menus.length > 1 ? <CardDescription>Carte</CardDescription> : null}
          </CardHeader>
          <CardContent>
            <ItemGroup className="gap-3">
              {routing
                .filter((r) => r.menuName === menuName)
                .map((section) => {
                  const sectionValue = section.stationId === MIXED ? MIXED : toValue(section.stationId);
                  const sectionProducts = section.products;
                  const selectId = `route-section-${section.sectionId}`;
                  return (
                    <Collapsible key={section.sectionId} asChild>
                      <Item variant="outline" role="listitem" className="flex-wrap">
                        <ItemContent className="min-w-0">
                          <ItemTitle>
                            <label htmlFor={selectId}>{section.sectionName}</label>
                          </ItemTitle>
                          <ItemDescription>
                            {section.productCount} produit{section.productCount > 1 ? "s" : ""}
                            {section.stationId === MIXED ? " · répartis sur plusieurs postes" : ""}
                          </ItemDescription>
                        </ItemContent>
                        <ItemActions className="flex-wrap">
                          {pending === section.sectionId ? <Spinner aria-label="Enregistrement…" /> : null}
                          <NativeSelect
                            id={selectId}
                            size="sm"
                            value={sectionValue}
                            disabled={pending !== null || section.productCount === 0}
                            onChange={(e) => void onSection(section, e.target.value)}
                          >
                            {section.stationId === MIXED ? (
                              <NativeSelectOption value={MIXED} disabled>
                                Plusieurs postes
                              </NativeSelectOption>
                            ) : null}
                            {options}
                          </NativeSelect>
                          {sectionProducts.length > 0 ? (
                            <CollapsibleTrigger asChild>
                              <Button variant="ghost" size="sm" className="group/trigger">
                                Par produit
                                <ChevronDown
                                  data-icon="inline-end"
                                  aria-hidden="true"
                                  className="transition-transform group-data-[state=open]/trigger:rotate-180"
                                />
                              </Button>
                            </CollapsibleTrigger>
                          ) : null}
                        </ItemActions>
                        {sectionProducts.length > 0 ? (
                          <CollapsibleContent className="basis-full">
                            <ItemGroup className="gap-2 pt-2">
                              {sectionProducts.map((product) => {
                                const productValue =
                                  toValue(product.stationId);
                                const productSelectId = `route-product-${product._id}`;
                                return (
                                  <Item key={product._id} size="sm" variant="muted" role="listitem">
                                    <ItemContent className="min-w-0">
                                      <ItemTitle className="max-w-full truncate">
                                        <label htmlFor={productSelectId}>{product.name}</label>
                                      </ItemTitle>
                                    </ItemContent>
                                    <ItemActions>
                                      {pending === product._id ? <Spinner aria-label="Enregistrement…" /> : null}
                                      <NativeSelect
                                        id={productSelectId}
                                        size="sm"
                                        value={productValue}
                                        disabled={pending !== null}
                                        onChange={(e) => void onProduct(product, e.target.value)}
                                      >
                                        {productValue === "" ? (
                                          <NativeSelectOption value="" disabled>
                                            Choisir un poste
                                          </NativeSelectOption>
                                        ) : null}
                                        {options}
                                      </NativeSelect>
                                    </ItemActions>
                                  </Item>
                                );
                              })}
                            </ItemGroup>
                          </CollapsibleContent>
                        ) : null}
                      </Item>
                    </Collapsible>
                  );
                })}
            </ItemGroup>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
