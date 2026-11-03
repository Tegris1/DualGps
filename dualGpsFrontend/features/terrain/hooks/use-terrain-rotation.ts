import { useMemo, useRef } from "react";
import { PanResponder } from "react-native";

const DRAG_THRESHOLD = 6;
const RADIANS_PER_PIXEL = 0.008;

export function useTerrainRotation(enabled: boolean, onOrbit: (yaw: number, elevation: number) => void) {
  const previous = useRef({ dx: 0, dy: 0 });

  return useMemo(() => PanResponder.create({
    onStartShouldSetPanResponder: () => false,
    onMoveShouldSetPanResponderCapture: (_, gesture) => enabled && gesture.numberActiveTouches === 1
      && Math.hypot(gesture.dx, gesture.dy) >= DRAG_THRESHOLD,
    onPanResponderGrant: (_, gesture) => { previous.current = { dx: gesture.dx, dy: gesture.dy }; },
    onPanResponderMove: (_, gesture) => {
      const dx = gesture.dx - previous.current.dx;
      const dy = gesture.dy - previous.current.dy;
      previous.current = { dx: gesture.dx, dy: gesture.dy };
      if (enabled && gesture.numberActiveTouches === 1) onOrbit(dx * RADIANS_PER_PIXEL, -dy * RADIANS_PER_PIXEL);
    },
    onPanResponderRelease: () => { previous.current = { dx: 0, dy: 0 }; },
    onPanResponderTerminate: () => { previous.current = { dx: 0, dy: 0 }; },
    onPanResponderTerminationRequest: () => false,
    onShouldBlockNativeResponder: () => true,
  }), [enabled, onOrbit]);
}
