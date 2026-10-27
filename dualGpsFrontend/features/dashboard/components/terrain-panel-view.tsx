import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import type { ReactNode } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";

import { dashboardColors, dashboardStyles } from "../styles";

type Props = {
  currentFilename: string | null;
  targetFilename: string | null;
  onChooseTerrains: () => void;
  children?: ReactNode;
  controls?: ReactNode;
  compact?: boolean;
};

export function TerrainPanelView({ currentFilename, targetFilename, onChooseTerrains, children, controls, compact = false }: Props) {
  return (
    <View style={[styles.panel, compact && styles.compactPanel]}>
      <View style={[styles.header, compact && styles.overlayHeader]}>
        <Text style={[dashboardStyles.panelHeading, compact && styles.overlayTitle]}>TEREN 3D · DEMO</Text>
        <Pressable accessibilityRole="button" onPress={onChooseTerrains} style={({ pressed }) => [styles.chooseButton, pressed && dashboardStyles.pressed]}>
          <Text style={styles.chooseLabel}>{children ? "Zmień teren" : "Wybierz teren"}</Text>
        </Pressable>
      </View>
      <View style={[styles.viewport, compact && styles.compactViewport]}>
        {children ?? (
          <View style={[styles.message, compact && styles.compactMessage]}>
            <MaterialIcons name="terrain" size={compact ? 28 : 46} color={dashboardColors.muted} />
            <Text style={styles.caption}>Wybierz teren pomiarowy i projekt, aby zobaczyć modele 3D.</Text>
          </View>
        )}
      </View>
      {controls}
      {!compact && <Text style={styles.caption}>
        {currentFilename ? `Pomiar: ${currentFilename}` : "Pomiar: nie wybrano"}{"\n"}
        {targetFilename ? `Projekt: ${targetFilename}` : "Projekt: nie wybrano"}
      </Text>}
      {!compact && <Text style={styles.demoNote}>Położenie koparki jest przykładowe. Wskaźniki i przekrój korzystają z danych demonstracyjnych.</Text>}
    </View>
  );
}

export function TerrainPanelLoading() {
  return (
    <View style={styles.loading} pointerEvents="none" accessibilityLiveRegion="polite">
      <ActivityIndicator color={dashboardColors.ink} />
      <Text style={styles.caption}>Ładowanie modeli terenu…</Text>
    </View>
  );
}

export function TerrainPanelError({ onRetry, compact = false }: { onRetry: () => void; compact?: boolean }) {
  return (
    <View style={[styles.message, compact && styles.compactMessage]} accessibilityLiveRegion="polite">
      {!compact && <MaterialIcons name="error-outline" size={36} color={dashboardColors.red} />}
      <Text style={styles.caption}>Nie udało się wczytać podglądu terenu.</Text>
      <Pressable accessibilityRole="button" onPress={onRetry} style={styles.retryButton}>
        <Text style={styles.chooseLabel}>Spróbuj ponownie</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  panel: { flex: 1, gap: 10 },
  header: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: 8 },
  chooseButton: { minHeight: 44, justifyContent: "center", paddingHorizontal: 8 },
  chooseLabel: { color: dashboardColors.ink, fontSize: 12, fontWeight: "700" },
  viewport: { flex: 1, minHeight: 220, backgroundColor: "#edf2f6", overflow: "hidden" },
  message: { flex: 1, minHeight: 220, alignItems: "center", justifyContent: "center", padding: 18, gap: 12 },
  caption: { fontSize: 11, lineHeight: 17, color: dashboardColors.muted },
  demoNote: { fontSize: 10, lineHeight: 15, color: dashboardColors.muted },
  loading: { ...StyleSheet.absoluteFillObject, backgroundColor: "#edf2f6", alignItems: "center", justifyContent: "center", gap: 10 },
  retryButton: { minHeight: 44, justifyContent: "center", paddingHorizontal: 16, backgroundColor: "#e0e9ee", borderRadius: 4 },
  compactPanel: { gap: 4 },
  compactViewport: { minHeight: 120 },
  compactMessage: { minHeight: 120, padding: 8, paddingTop: 44, gap: 4 },
  overlayHeader: { position: "absolute", top: 0, left: 4, right: 4, zIndex: 2 },
  overlayTitle: { fontSize: 10, padding: 3, backgroundColor: "#ffffffdd" },
});
