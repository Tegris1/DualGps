import { afterAll, afterEach, beforeAll, expect, it, jest } from "@jest/globals";
import { act } from "react";

import { useTerrainPreview } from "../../features/terrain/hooks/use-terrain-preview";
import { DEFAULT_VIEW } from "../../features/terrain/preview-models";

const { create } = require("react-test-renderer");
let root: ReturnType<typeof create>;
let preview!: ReturnType<typeof useTerrainPreview>;
const previousActEnvironment = Reflect.get(globalThis, "IS_REACT_ACT_ENVIRONMENT");
const originalError = console.error;
let errorSpy: ReturnType<typeof jest.spyOn>;

function Probe({ currentId = "current-a", targetId = "target-a" }: {
  currentId?: string | null; targetId?: string | null;
}) {
  preview = useTerrainPreview(currentId, targetId);
  return null;
}

beforeAll(() => {
  Reflect.set(globalThis, "IS_REACT_ACT_ENVIRONMENT", true);
  errorSpy = jest.spyOn(console, "error").mockImplementation((...args) => {
    if (!String(args[0]).startsWith("react-test-renderer is deprecated")) originalError(...args);
  });
});

afterEach(async () => { await act(() => root?.unmount()); });
afterAll(() => {
  errorSpy.mockRestore();
  Reflect.set(globalThis, "IS_REACT_ACT_ENVIRONMENT", previousActEnvironment);
});

it("tracks loading for the selected pair and keeps the loading callback stable across display changes", async () => {
  await act(() => { root = create(<Probe />); });
  expect(preview.loaded).toBe(false);
  const firstPair = preview.modelPair;
  const firstOnLoaded = preview.onLoaded;
  await act(() => firstOnLoaded());
  expect(preview.loaded).toBe(true);
  await act(() => {
    preview.onCurrentVisibilityChange(false);
    preview.onRotateLeft();
  });
  expect(preview.onLoaded).toBe(firstOnLoaded);
  expect(preview.modelPair).toBe(firstPair);
  expect(preview.loaded).toBe(true);

  await act(() => root.update(<Probe currentId="current-b" />));
  expect(preview.modelPair).not.toBe(firstPair);
  expect(preview.loaded).toBe(false);
  expect(preview.onLoaded).not.toBe(firstOnLoaded);
  await act(() => firstOnLoaded());
  expect(preview.loaded).toBe(false);
  await act(() => preview.onLoaded());
  expect(preview.loaded).toBe(true);
  await act(() => root.update(<Probe currentId="current-b" targetId={null} />));
  expect(preview.loaded).toBe(false);
});

it("keeps zoom within its limits and resets the camera without changing layer visibility", async () => {
  await act(() => { root = create(<Probe />); });
  await act(() => preview.onLoaded());
  await act(() => {
    preview.onCurrentVisibilityChange(false);
    for (let step = 0; step < 30; step++) preview.onZoomIn();
  });
  expect(preview.view.zoom).toBe(0.4);
  await act(() => {
    for (let step = 0; step < 30; step++) preview.onZoomOut();
  });
  expect(preview.view.zoom).toBe(3);
  await act(() => preview.onResetView());
  expect(preview.view).toEqual(DEFAULT_VIEW);
  expect(preview.showCurrent).toBe(false);
  expect(preview.showTarget).toBe(true);
  expect(preview.loaded).toBe(true);
});
