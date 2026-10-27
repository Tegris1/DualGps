import { useWindowDimensions } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

export function useDashboardLayout() {
  const { width, height, fontScale } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const usableWidth = width - insets.left - insets.right;
  const usableHeight = height - insets.top - insets.bottom;
  const wide = usableWidth / fontScale >= 700;
  const compact = wide && usableHeight < 600 && fontScale <= 1.15;
  const plotHeight = compact ? Math.max(60, Math.min(140, usableHeight - 300)) : 160;

  return { wide, compact, plotHeight, workspaceHeight: plotHeight + 80 };
}

export type DashboardLayout = ReturnType<typeof useDashboardLayout>;
