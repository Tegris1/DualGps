import type { BucketCrossSections } from "@/features/terrain/terrain-cross-section";

import { createSegmentCrossSectionModel } from "../cross-section";

export type TerrainSectionState = "unselected" | "loading" | "error" | "ready";

export function getTerrainCrossSectionPresentation(data: BucketCrossSections | null, state: TerrainSectionState) {
  const model = state === "ready" && data ? createSegmentCrossSectionModel(data) : null;
  const difference = model?.heightDifference ?? null;
  const roundedDifference = difference === null ? null : Number(difference.toFixed(3));
  const comparisonLabel = roundedDifference === null ? "—"
    : `${roundedDifference > 0 ? "+" : roundedDifference < 0 ? "−" : ""}${Math.abs(roundedDifference).toFixed(3).replace(".", ",")} m`;
  const emptyMessages: Record<TerrainSectionState, string> = {
    unselected: "Wybierz teren pomiarowy i projekt, aby zobaczyć przekrój.",
    loading: "Ładowanie przekroju modeli…",
    error: "Przekrój niedostępny. Ponów ładowanie terenu 3D.",
    ready: "Brak przecięcia modeli w płaszczyźnie łyżki.",
  };

  return {
    model,
    comparisonLabel,
    sourceLabel: "PRZEKRÓJ MODELU · m",
    elevationLabel: "Wysokość względem łyżki [m]",
    distanceLabel: "Odległość od łyżki [m]",
    emptyMessage: emptyMessages[state],
    comparisonNote: model?.comparison === "ambiguous" ? "Kilka powierzchni projektu pod łyżką — brak jednoznacznej różnicy."
      : model?.comparison === "missing" ? "Brak powierzchni projektu pod łyżką."
      : "",
  };
}
