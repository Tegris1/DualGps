import { expect, it, jest } from "@jest/globals";
import { act } from "react";
import { PanResponder, type GestureResponderEvent, type PanResponderCallbacks, type PanResponderGestureState } from "react-native";

import { useTerrainPreview } from "../../features/terrain/hooks/use-terrain-preview";
import { useTerrainRotation } from "../../features/terrain/hooks/use-terrain-rotation";
import { DEFAULT_VIEW } from "../../features/terrain/preview-models";

const { create } = jest.requireActual<{
  create: (element: React.ReactNode) => { update: (element: React.ReactNode) => void; unmount: () => void };
}>("react-test-renderer");

it("captures loaded single-finger drags, orbits incrementally, clamps elevation, and keeps handlers stable", async () => {
  let callbacks!: PanResponderCallbacks;
  const responderSpy = jest.spyOn(PanResponder, "create").mockImplementation((config) => {
    callbacks = config;
    return { panHandlers: {} };
  });
  let preview!: ReturnType<typeof useTerrainPreview>;
  function Probe({ enabled = true }: { enabled?: boolean }) {
    preview = useTerrainPreview("current", "target");
    useTerrainRotation(enabled, preview.onOrbit);
    return null;
  }
  const event = {} as GestureResponderEvent;
  const gesture = (dx: number, dy: number, touches = 1): PanResponderGestureState => ({
    dx, dy, numberActiveTouches: touches, stateID: 1, moveX: 0, moveY: 0, x0: 0, y0: 0, vx: 0, vy: 0, _accountsForMovesUpTo: 0,
  });
  const previousActEnvironment = Reflect.get(globalThis, "IS_REACT_ACT_ENVIRONMENT");
  Reflect.set(globalThis, "IS_REACT_ACT_ENVIRONMENT", true);
  const originalError = console.error;
  const errorSpy = jest.spyOn(console, "error").mockImplementation((...args) => {
    if (!String(args[0]).startsWith("react-test-renderer is deprecated")) originalError(...args);
  });
  let root: ReturnType<typeof create> | undefined;

  try {
    await act(() => { root = create(<Probe enabled={false} />); });
    expect(callbacks.onMoveShouldSetPanResponderCapture?.(event, gesture(20, 0))).toBe(false);
    await act(() => root?.update(<Probe />));
    expect(callbacks.onStartShouldSetPanResponder?.(event, gesture(0, 0))).toBe(false);
    expect(callbacks.onMoveShouldSetPanResponderCapture?.(event, gesture(2, 2))).toBe(false);
    expect(callbacks.onMoveShouldSetPanResponderCapture?.(event, gesture(20, 0, 2))).toBe(false);
    expect(callbacks.onMoveShouldSetPanResponderCapture?.(event, gesture(20, 0))).toBe(true);
    const stableCallbacks = callbacks;
    const loadedCallback = preview.onLoaded;
    callbacks.onPanResponderGrant?.(event, gesture(8, 8));
    await act(() => callbacks.onPanResponderMove?.(event, gesture(28, 18)));
    expect(preview.view.yaw).toBeCloseTo(DEFAULT_VIEW.yaw + 0.16);
    expect(preview.view.elevation).toBeCloseTo(DEFAULT_VIEW.elevation - 0.08);
    await act(() => callbacks.onPanResponderMove?.(event, gesture(38, 28)));
    expect(preview.view.yaw).toBeCloseTo(DEFAULT_VIEW.yaw + 0.24);
    expect(callbacks).toBe(stableCallbacks);
    expect(preview.onLoaded).toBe(loadedCallback);
    await act(() => callbacks.onPanResponderMove?.(event, gesture(38, -10000)));
    expect(preview.view.elevation).toBeLessThan(Math.PI / 2);
    await act(() => callbacks.onPanResponderMove?.(event, gesture(38, 10000)));
    expect(preview.view.elevation).toBeGreaterThan(0);
    const beforeMultitouch = preview.view;
    await act(() => callbacks.onPanResponderMove?.(event, gesture(200, 200, 2)));
    expect(preview.view).toEqual(beforeMultitouch);
    await act(() => preview.onResetView());
    expect(preview.view).toEqual(DEFAULT_VIEW);
  } finally {
    if (root) await act(() => root?.unmount());
    responderSpy.mockRestore();
    errorSpy.mockRestore();
    Reflect.set(globalThis, "IS_REACT_ACT_ENVIRONMENT", previousActEnvironment);
  }
});
