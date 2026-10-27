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
  const [viewControlsOpen, setViewControlsOpen] = useState(false);
  const [failedScene, setFailedScene] = useState<string | null>(null);
  const sceneKey = `${preview.modelPair}:${attempt}`;
  const cameraEnabled = preview.loaded && failedScene !== sceneKey && step === null;
  const choosingTarget = step === "target";
  const options = TERRAIN_CATALOG.filter((terrain) => choosingTarget
    ? terrain.role === "target" && terrain.asset !== currentTerrain?.asset
    : terrain.role === "current");
  const selectedId = (choosingTarget ? targetTerrain : currentTerrain)?.id ?? null;

  function retry() {
    if (!currentTerrain || !targetTerrain) return;
    clearTerrainPreviewCache(currentTerrain, targetTerrain);
    setViewControlsOpen(false);
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
    sceneKey,
    onSceneError: () => {
      setFailedScene(sceneKey);
      setViewControlsOpen(false);
    },
    onRetry: retry,
    onOpenSelection: () => {
      setViewControlsOpen(false);
      setStep("current");
    },
    cameraControls: {
      enabled: cameraEnabled,
      visible: viewControlsOpen && cameraEnabled,
      onToggle: () => { if (cameraEnabled) setViewControlsOpen((value) => !value); },
      onClose: () => setViewControlsOpen(false),
      onRotateLeft: () => { if (cameraEnabled) preview.onRotateLeft(); },
      onRotateRight: () => { if (cameraEnabled) preview.onRotateRight(); },
      onZoomIn: () => { if (cameraEnabled) preview.onZoomIn(); },
      onZoomOut: () => { if (cameraEnabled) preview.onZoomOut(); },
      onTopView: () => { if (cameraEnabled) preview.onTopView(); },
      onResetView: () => { if (cameraEnabled) preview.onResetView(); },
    },
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
