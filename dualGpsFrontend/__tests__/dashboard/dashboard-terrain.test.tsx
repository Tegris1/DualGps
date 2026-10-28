import { expect, it, jest } from "@jest/globals";
import { act } from "react";

import { useDashboardTerrain } from "../../features/dashboard/hooks/use-dashboard-terrain";
import { TerrainProjectProvider } from "../../features/terrain/project-context";
import { clearTerrainPreviewCache } from "../../features/terrain/terrain-preview-scene";
import { DEFAULT_VIEW } from "../../features/terrain/preview-models";
import type { BucketCrossSections } from "../../features/terrain/terrain-cross-section";

jest.mock("../../assets/terrain/Original.glb", () => 11);
jest.mock("../../assets/terrain/Target.glb", () => 12);
jest.mock("../../features/terrain/terrain-preview-scene", () => ({ clearTerrainPreviewCache: jest.fn() }));

const { create } = jest.requireActual<{ create: (element: React.ReactNode) => { unmount: () => void } }>("react-test-renderer");

it("requires both selections and retries loading without losing the chosen project", async () => {
  let terrain!: ReturnType<typeof useDashboardTerrain>;
  function Probe() { terrain = useDashboardTerrain(); return null; }
  const previousActEnvironment = Reflect.get(globalThis, "IS_REACT_ACT_ENVIRONMENT");
  Reflect.set(globalThis, "IS_REACT_ACT_ENVIRONMENT", true);
  const originalError = console.error;
  const errorSpy = jest.spyOn(console, "error").mockImplementation((...args) => {
    if (!String(args[0]).startsWith("react-test-renderer is deprecated")) originalError(...args);
  });
  let root: ReturnType<typeof create>;

  try {
    await act(() => { root = create(<TerrainProjectProvider><Probe /></TerrainProjectProvider>); });
    expect(terrain.currentTerrain).toBeNull();
    expect(terrain.targetTerrain).toBeNull();
    expect(terrain.layerControls.enabled).toBe(true);
    expect(terrain.layerControls.canChangeVisibility).toBe(false);
    await act(() => terrain.layerControls.onToggle());
    expect(terrain.layerControls.visible).toBe(true);
    await act(() => terrain.layerControls.onCurrentVisibilityChange(false));
    expect(terrain.preview.showCurrent).toBe(true);
    await act(() => terrain.layerControls.onChangeCurrent());
    expect(terrain.layerControls.visible).toBe(false);
    await act(() => terrain.selection.onNext());
    expect(terrain.selection.choosingTarget).toBe(false);
    await act(() => terrain.selection.onSelect("original"));
    await act(() => terrain.selection.onNext());
    expect(terrain.selection.choosingTarget).toBe(true);
    await act(() => terrain.selection.onNext());
    expect(terrain.selection.visible).toBe(true);
    await act(() => terrain.selection.onSelect("target"));
    await act(() => terrain.selection.onNext());
    expect(terrain.selection.visible).toBe(false);
    expect(terrain.preview.loaded).toBe(false);
    expect(terrain.cameraControls.enabled).toBe(false);
    await act(() => {
      terrain.cameraControls.onToggle();
      terrain.cameraControls.onRotateLeft();
      terrain.cameraControls.onOrbit(1, 1);
    });
    expect(terrain.cameraControls.visible).toBe(false);
    expect(terrain.preview.view).toEqual(DEFAULT_VIEW);
    const onCrossSection = terrain.onCrossSection;
    const modelSection: BucketCrossSections = {
      current: [[{ distance: -1, elevation: 2 }, { distance: 1, elevation: 2 }]],
      target: [[{ distance: -1, elevation: 1 }, { distance: 1, elevation: 1 }]],
      bucket: { distance: 0, elevation: 2 },
    };
    await act(() => onCrossSection(modelSection));
    await act(() => terrain.preview.onLoaded());
    expect(terrain.preview.loaded).toBe(true);
    expect(terrain.cameraControls.enabled).toBe(true);
    expect(terrain.crossSection.comparisonLabel).toBe("+1,000 m");

    const loadedCallback = terrain.preview.onLoaded;
    const loadedScene = terrain.sceneKey;
    await act(() => terrain.cameraControls.onOrbit(0.1, 0.05));
    expect(terrain.preview.view.yaw).toBeCloseTo(DEFAULT_VIEW.yaw + 0.1);
    expect(terrain.preview.view.elevation).toBeCloseTo(DEFAULT_VIEW.elevation + 0.05);
    await act(() => terrain.cameraControls.onResetView());
    await act(() => terrain.cameraControls.onToggle());
    expect(terrain.cameraControls.visible).toBe(true);
    await act(() => terrain.cameraControls.onRotateLeft());
    expect(terrain.preview.view.yaw).toBeLessThan(DEFAULT_VIEW.yaw);
    await act(() => terrain.cameraControls.onRotateRight());
    expect(terrain.preview.view.yaw).toBeCloseTo(DEFAULT_VIEW.yaw);
    await act(() => terrain.cameraControls.onZoomIn());
    expect(terrain.preview.view.zoom).toBeLessThan(DEFAULT_VIEW.zoom);
    await act(() => terrain.cameraControls.onZoomOut());
    expect(terrain.preview.view.zoom).toBeCloseTo(DEFAULT_VIEW.zoom);
    await act(() => terrain.cameraControls.onTopView());
    expect(terrain.preview.view.elevation).toBeGreaterThan(DEFAULT_VIEW.elevation);
    await act(() => terrain.cameraControls.onResetView());
    expect(terrain.preview.view).toEqual(DEFAULT_VIEW);
    expect(terrain.preview.onLoaded).toBe(loadedCallback);
    expect(terrain.onCrossSection).toBe(onCrossSection);
    expect(terrain.sceneKey).toBe(loadedScene);
    expect(terrain.preview.loaded).toBe(true);

    await act(() => terrain.layerControls.onToggle());
    expect(terrain.layerControls.visible).toBe(true);
    expect(terrain.cameraControls.visible).toBe(false);
    expect(terrain.crossSection.model).not.toBeNull();
    expect(terrain.layerControls.canChangeVisibility).toBe(true);
    await act(() => {
      terrain.layerControls.onCurrentVisibilityChange(false);
      terrain.layerControls.onTargetVisibilityChange(false);
    });
    expect(terrain.preview.showCurrent).toBe(false);
    expect(terrain.preview.showTarget).toBe(false);
    expect(terrain.sceneKey).toBe(loadedScene);
    expect(terrain.preview.onLoaded).toBe(loadedCallback);
    await act(() => terrain.cameraControls.onResetView());
    expect(terrain.preview.showCurrent).toBe(false);
    expect(terrain.preview.showTarget).toBe(false);
    await act(() => terrain.cameraControls.onToggle());
    expect(terrain.layerControls.visible).toBe(false);

    await act(() => terrain.onSceneError());
    expect(terrain.cameraControls.enabled).toBe(false);
    expect(terrain.cameraControls.visible).toBe(false);
    expect(terrain.crossSection.model).toBeNull();
    await act(() => terrain.layerControls.onToggle());
    expect(terrain.layerControls.visible).toBe(true);
    expect(terrain.layerControls.canChangeVisibility).toBe(false);
    await act(() => terrain.layerControls.onCurrentVisibilityChange(true));
    expect(terrain.preview.showCurrent).toBe(false);

    const previousScene = terrain.sceneKey;
    await act(() => terrain.onRetry());
    expect(clearTerrainPreviewCache).toHaveBeenCalledWith(terrain.currentTerrain, terrain.targetTerrain);
    expect(terrain.sceneKey).not.toBe(previousScene);
    expect(terrain.preview.loaded).toBe(false);
    expect(terrain.cameraControls.enabled).toBe(false);
    expect(terrain.currentTerrain?.id).toBe("original");
    expect(terrain.targetTerrain?.id).toBe("target");
    await act(() => terrain.onCrossSection(modelSection));
    await act(() => terrain.preview.onLoaded());
    await act(() => onCrossSection({ ...modelSection, current: [], target: [] }));
    expect(terrain.crossSection.comparisonLabel).toBe("+1,000 m");
    expect(terrain.preview.loaded).toBe(true);
    expect(terrain.cameraControls.enabled).toBe(true);
    await act(() => terrain.onOpenSelection());
    await act(() => terrain.selection.onClose());
    expect(terrain.selection.visible).toBe(false);
    expect(terrain.preview.loaded).toBe(true);
    await act(() => terrain.layerControls.onChangeTarget());
    expect(terrain.selection.choosingTarget).toBe(true);
    expect(terrain.selection.selectedId).toBe("target");
    await act(() => terrain.selection.onNext());
    expect(terrain.selection.visible).toBe(false);
    expect(terrain.currentTerrain?.id).toBe("original");
    expect(terrain.preview.showCurrent).toBe(false);
    expect(terrain.preview.showTarget).toBe(false);
  } finally {
    await act(() => root?.unmount());
    errorSpy.mockRestore();
    Reflect.set(globalThis, "IS_REACT_ACT_ENVIRONMENT", previousActEnvironment);
  }
});
