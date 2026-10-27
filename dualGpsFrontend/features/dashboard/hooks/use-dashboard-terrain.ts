import { useCallback, useLayoutEffect, useMemo, useRef, useState } from "react";

import { useTerrainPreview } from "@/features/terrain/hooks/use-terrain-preview";
import { useTerrainProject } from "@/features/terrain/project-context";
import { TERRAIN_CATALOG } from "@/features/terrain/terrain-catalog";
import { clearTerrainPreviewCache } from "@/features/terrain/terrain-preview-scene";
import type { BucketCrossSections } from "@/features/terrain/terrain-cross-section";

import { getTerrainCrossSectionPresentation, type TerrainSectionState } from "../presentation/terrain-cross-section";

export function useDashboardTerrain() {
  const { currentTerrain, targetTerrain, selectCurrentTerrain, selectTargetTerrain } = useTerrainProject();
  const preview = useTerrainPreview(currentTerrain?.id ?? null, targetTerrain?.id ?? null);
  const [step, setStep] = useState<"current" | "target" | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [activePanel, setActivePanel] = useState<"camera" | "layers" | null>(null);
  const [failedScene, setFailedScene] = useState<string | null>(null);
  const sceneKey = `${preview.modelPair}:${attempt}`;
  const activeScene = useRef(sceneKey);
  const [sectionSnapshot, setSectionSnapshot] = useState<{ sceneKey: string; data: BucketCrossSections } | null>(null);
  useLayoutEffect(() => { activeScene.current = sceneKey; }, [sceneKey]);
  const onCrossSection = useCallback((data: BucketCrossSections) => {
    if (activeScene.current === sceneKey) setSectionSnapshot({ sceneKey, data });
  }, [sceneKey]);
  const sectionState: TerrainSectionState = !currentTerrain || !targetTerrain ? "unselected"
    : failedScene === sceneKey ? "error"
    : !preview.loaded || sectionSnapshot?.sceneKey !== sceneKey ? "loading" : "ready";
  const sectionData = sectionSnapshot?.sceneKey === sceneKey ? sectionSnapshot.data : null;
  const crossSection = useMemo(() => getTerrainCrossSectionPresentation(sectionData, sectionState), [sectionData, sectionState]);
  const cameraEnabled = preview.loaded && failedScene !== sceneKey && step === null;
  const choosingTarget = step === "target";
  const options = TERRAIN_CATALOG.filter((terrain) => choosingTarget
    ? terrain.role === "target" && terrain.asset !== currentTerrain?.asset
    : terrain.role === "current");
  const selectedId = (choosingTarget ? targetTerrain : currentTerrain)?.id ?? null;

  function retry() {
    if (!currentTerrain || !targetTerrain) return;
    clearTerrainPreviewCache(currentTerrain, targetTerrain);
    setActivePanel(null);
    preview.onReload();
    setAttempt((value) => value + 1);
  }

  function next() {
    if (!options.some((terrain) => terrain.id === selectedId)) return;
    setStep(choosingTarget ? null : "target");
  }

  function openSelection(selectionStep: "current" | "target") {
    setActivePanel(null);
    setStep(selectionStep === "target" && !currentTerrain ? "current" : selectionStep);
  }

  return {
    currentTerrain,
    targetTerrain,
    preview,
    sceneKey,
    crossSection,
    onCrossSection,
    onSceneError: () => {
      setFailedScene(sceneKey);
      setActivePanel((panel) => panel === "camera" ? null : panel);
    },
    onRetry: retry,
    onOpenSelection: () => openSelection("current"),
    cameraControls: {
      enabled: cameraEnabled,
      visible: activePanel === "camera" && cameraEnabled,
      onToggle: () => { if (cameraEnabled) setActivePanel((panel) => panel === "camera" ? null : "camera"); },
      onClose: () => setActivePanel(null),
      onRotateLeft: () => { if (cameraEnabled) preview.onRotateLeft(); },
      onRotateRight: () => { if (cameraEnabled) preview.onRotateRight(); },
      onZoomIn: () => { if (cameraEnabled) preview.onZoomIn(); },
      onZoomOut: () => { if (cameraEnabled) preview.onZoomOut(); },
      onTopView: () => { if (cameraEnabled) preview.onTopView(); },
      onResetView: () => { if (cameraEnabled) preview.onResetView(); },
    },
    layerControls: {
      enabled: step === null,
      visible: activePanel === "layers" && step === null,
      canChangeVisibility: cameraEnabled,
      currentFilename: currentTerrain?.filename ?? null,
      targetFilename: targetTerrain?.filename ?? null,
      showCurrent: preview.showCurrent,
      showTarget: preview.showTarget,
      onToggle: () => { if (step === null) setActivePanel((panel) => panel === "layers" ? null : "layers"); },
      onClose: () => setActivePanel(null),
      onCurrentVisibilityChange: (visible: boolean) => { if (cameraEnabled) preview.onCurrentVisibilityChange(visible); },
      onTargetVisibilityChange: (visible: boolean) => { if (cameraEnabled) preview.onTargetVisibilityChange(visible); },
      onChangeCurrent: () => openSelection("current"),
      onChangeTarget: () => openSelection("target"),
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
