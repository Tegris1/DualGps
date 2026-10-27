import { expect, it, jest } from "@jest/globals";
import { act } from "react";

import { useDashboardTerrain } from "../../features/dashboard/hooks/use-dashboard-terrain";
import { TerrainProjectProvider } from "../../features/terrain/project-context";
import { clearTerrainPreviewCache } from "../../features/terrain/terrain-preview-scene";
import { DEFAULT_VIEW } from "../../features/terrain/preview-models";

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
    await act(() => terrain.onOpenSelection());
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
    });
    expect(terrain.cameraControls.visible).toBe(false);
    expect(terrain.preview.view).toEqual(DEFAULT_VIEW);
    await act(() => terrain.preview.onLoaded());
    expect(terrain.preview.loaded).toBe(true);
    expect(terrain.cameraControls.enabled).toBe(true);

    const loadedCallback = terrain.preview.onLoaded;
    const loadedScene = terrain.sceneKey;
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
    expect(terrain.sceneKey).toBe(loadedScene);
    expect(terrain.preview.loaded).toBe(true);

    await act(() => terrain.onSceneError());
    expect(terrain.cameraControls.enabled).toBe(false);
    expect(terrain.cameraControls.visible).toBe(false);

    const previousScene = terrain.sceneKey;
    await act(() => terrain.onRetry());
    expect(clearTerrainPreviewCache).toHaveBeenCalledWith(terrain.currentTerrain, terrain.targetTerrain);
    expect(terrain.sceneKey).not.toBe(previousScene);
    expect(terrain.preview.loaded).toBe(false);
    expect(terrain.cameraControls.enabled).toBe(false);
    expect(terrain.currentTerrain?.id).toBe("original");
    expect(terrain.targetTerrain?.id).toBe("target");
    await act(() => terrain.preview.onLoaded());
    expect(terrain.preview.loaded).toBe(true);
    expect(terrain.cameraControls.enabled).toBe(true);
    await act(() => terrain.onOpenSelection());
    await act(() => terrain.selection.onClose());
    expect(terrain.selection.visible).toBe(false);
    expect(terrain.preview.loaded).toBe(true);
  } finally {
    await act(() => root?.unmount());
    errorSpy.mockRestore();
    Reflect.set(globalThis, "IS_REACT_ACT_ENVIRONMENT", previousActEnvironment);
  }
});
