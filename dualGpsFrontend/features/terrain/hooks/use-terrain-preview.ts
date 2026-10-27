import { useCallback, useState } from "react";

import { DEFAULT_VIEW } from "../preview-models";

const ROTATION_STEP = Math.PI / 8;
const ZOOM_STEP = 1.2;
const MIN_ZOOM = 0.4;
const MAX_ZOOM = 3;

export function useTerrainPreview(currentTerrainId: string | null, targetTerrainId: string | null) {
  const [view, setView] = useState(DEFAULT_VIEW);
  const [showCurrent, setShowCurrent] = useState(true);
  const [showTarget, setShowTarget] = useState(true);
  const [loadedPair, setLoadedPair] = useState<string | null>(null);
  const modelPair = JSON.stringify([currentTerrainId, targetTerrainId]);
  const loaded = currentTerrainId !== null && targetTerrainId !== null && loadedPair === modelPair;
  // The scene's loading/disposal effect depends on this callback. Keep it stable
  // while camera and visibility controls change for the same model pair.
  const onLoaded = useCallback(() => setLoadedPair(modelPair), [modelPair]);
  const onReload = useCallback(() => setLoadedPair(null), []);

  function rotateLeft() {
    setView((value) => ({ ...value, yaw: value.yaw - ROTATION_STEP }));
  }

  function rotateRight() {
    setView((value) => ({ ...value, yaw: value.yaw + ROTATION_STEP }));
  }

  function zoomIn() {
    setView((value) => ({ ...value, zoom: Math.max(MIN_ZOOM, value.zoom / ZOOM_STEP) }));
  }

  function zoomOut() {
    setView((value) => ({ ...value, zoom: Math.min(MAX_ZOOM, value.zoom * ZOOM_STEP) }));
  }

  return {
    modelPair,
    view,
    showCurrent,
    showTarget,
    loaded,
    onLoaded,
    onReload,
    onCurrentVisibilityChange: setShowCurrent,
    onTargetVisibilityChange: setShowTarget,
    onRotateLeft: rotateLeft,
    onRotateRight: rotateRight,
    onZoomIn: zoomIn,
    onZoomOut: zoomOut,
    onResetView: () => setView(DEFAULT_VIEW),
    onTopView: () => setView({ ...DEFAULT_VIEW, elevation: Math.PI / 2 - 0.001 }),
  };
}
