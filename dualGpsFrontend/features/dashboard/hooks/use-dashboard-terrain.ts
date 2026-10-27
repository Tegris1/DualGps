import { useState } from "react";

import { useTerrainPreview } from "@/features/terrain/hooks/use-terrain-preview";
import { useTerrainProject } from "@/features/terrain/project-context";
import { TERRAIN_CATALOG } from "@/features/terrain/terrain-catalog";
import { clearTerrainPreviewCache } from "@/features/terrain/terrain-preview-scene";

export function useDashboardTerrain() {
  const { currentTerrain, targetTerrain, selectCurrentTerrain, selectTargetTerrain } = useTerrainProject();
  const preview = useTerrainPreview(currentTerrain?.id ?? null, targetTerrain?.id ?? null);
  const [step, setStep] = useState<"current" | "target" | null>(null);
  const [attempt, setAttempt] = useState(0);
  const choosingTarget = step === "target";
  const options = TERRAIN_CATALOG.filter((terrain) => choosingTarget
    ? terrain.role === "target" && terrain.asset !== currentTerrain?.asset
    : terrain.role === "current");
  const selectedId = (choosingTarget ? targetTerrain : currentTerrain)?.id ?? null;

  function retry() {
    if (!currentTerrain || !targetTerrain) return;
    clearTerrainPreviewCache(currentTerrain, targetTerrain);
    preview.onReload();
    setAttempt((value) => value + 1);
  }

  function next() {
    if (!options.some((terrain) => terrain.id === selectedId)) return;
    setStep(choosingTarget ? null : "target");
  }

  return {
    currentTerrain,
    targetTerrain,
    preview,
    sceneKey: `${preview.modelPair}:${attempt}`,
    onRetry: retry,
    onOpenSelection: () => setStep("current"),
    selection: {
      visible: step !== null,
      choosingTarget,
      options,
      selectedId,
      onSelect: choosingTarget ? selectTargetTerrain : selectCurrentTerrain,
      onNext: next,
      onBack: () => setStep("current"),
      onClose: () => setStep(null),
    },
  };
}
