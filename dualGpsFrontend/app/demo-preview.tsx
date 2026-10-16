import { useCallback, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Switch, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import type { ErrorBoundaryProps } from "expo-router";
import { StatusBar } from "expo-status-bar";

import { CURRENT_COLOR, DEFAULT_VIEW, TARGET_COLOR } from "@/features/demo/preview-models";
import { clearTerrainPreviewCache, TerrainPreviewScene } from "@/features/demo/terrain-preview-scene";

export function ErrorBoundary({ error, retry }: ErrorBoundaryProps) {
  return (
    <SafeAreaView style={[styles.screen, styles.error]}>
      <Text style={styles.title}>Could not load terrain preview</Text>
      <Text style={styles.caption}>{error.message}</Text>
      <View style={styles.controls}>
        <Control label="Retry" onPress={() => {
          clearTerrainPreviewCache();
          void retry();
        }} />
      </View>
    </SafeAreaView>
  );
}

function Control({ label, onPress, disabled = false }: {
  label: string; onPress: () => void; disabled?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [styles.button, pressed && styles.pressed, disabled && styles.disabled]}
    >
      <Text style={styles.buttonText}>{label}</Text>
    </Pressable>
  );
}

export default function TerrainPreview() {
  const [view, setView] = useState(DEFAULT_VIEW);
  const [showCurrent, setShowCurrent] = useState(true);
  const [showTarget, setShowTarget] = useState(true);
  const [loaded, setLoaded] = useState(false);
  const onLoaded = useCallback(() => setLoaded(true), []);

  return (
    <SafeAreaView style={styles.screen}>
      <StatusBar style="dark" />
      <View style={styles.header}>
        <Text style={styles.eyebrow}>DUAL GPS / DEMO</Text>
        <Text style={styles.title}>Terrain preview</Text>
        <Text style={styles.caption}>Current surface and target design</Text>
      </View>
      <View style={styles.viewport}>
        <TerrainPreviewScene
          view={view}
          showCurrent={showCurrent}
          showTarget={showTarget}
          onLoaded={onLoaded}
        />
        {!loaded && (
          <View style={styles.loading}>
            <ActivityIndicator color={TARGET_COLOR} />
            <Text style={styles.caption}>Loading terrain models...</Text>
          </View>
        )}
        <View pointerEvents="none" style={styles.sceneLabel}>
          <Text style={styles.sceneLabelText}>3D OVERVIEW</Text>
        </View>
      </View>
      <View style={styles.panel}>
        <View style={styles.layer}>
          <View style={[styles.dot, { backgroundColor: CURRENT_COLOR }]} />
          <View style={styles.layerCopy}>
            <Text style={styles.layerTitle}>Current terrain</Text>
            <Text style={styles.caption}>Original.glb</Text>
          </View>
          <Switch accessibilityLabel="Show current terrain" value={showCurrent} onValueChange={setShowCurrent} />
        </View>
        <View style={styles.layer}>
          <View style={[styles.dot, { backgroundColor: TARGET_COLOR }]} />
          <View style={styles.layerCopy}>
            <Text style={styles.layerTitle}>Target terrain</Text>
            <Text style={styles.caption}>Target.glb / wireframe overlay</Text>
          </View>
          <Switch accessibilityLabel="Show target terrain" value={showTarget} onValueChange={setShowTarget} />
        </View>
        <View style={styles.controls}>
          <Control label="Rotate left" disabled={!loaded}
            onPress={() => setView((value) => ({ ...value, yaw: value.yaw - Math.PI / 8 }))} />
          <Control label="Reset view" disabled={!loaded} onPress={() => setView(DEFAULT_VIEW)} />
          <Control label="Rotate right" disabled={!loaded}
            onPress={() => setView((value) => ({ ...value, yaw: value.yaw + Math.PI / 8 }))} />
        </View>
        <View style={styles.controls}>
          <Control label="Zoom in" disabled={!loaded}
            onPress={() => setView((value) => ({ ...value, zoom: Math.max(0.4, value.zoom / 1.2) }))} />
          <Control label="Top view" disabled={!loaded}
            onPress={() => setView({ ...DEFAULT_VIEW, elevation: Math.PI / 2 - 0.001 })} />
          <Control label="Zoom out" disabled={!loaded}
            onPress={() => setView((value) => ({ ...value, zoom: Math.min(3, value.zoom * 1.2) }))} />
        </View>
        <Text style={styles.note}>Target lines remain visible through the current surface.</Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#f8fafc" },
  header: { padding: 20, gap: 5 },
  eyebrow: { fontSize: 11, fontWeight: "700", letterSpacing: 2, color: "#64748b" },
  title: { fontSize: 26, fontWeight: "700", color: "#0f172a" },
  caption: { fontSize: 12, color: "#64748b" },
  viewport: { flex: 1, minHeight: 180, backgroundColor: "#edf2f6" },
  loading: { ...StyleSheet.absoluteFillObject, backgroundColor: "#edf2f6", alignItems: "center", justifyContent: "center", gap: 12 },
  sceneLabel: { position: "absolute", left: 16, top: 16, backgroundColor: "#ffffffdd", padding: 8, borderRadius: 6 },
  sceneLabelText: { fontSize: 10, fontWeight: "700", color: "#475569", letterSpacing: 1 },
  panel: { padding: 16, gap: 10 },
  layer: { flexDirection: "row", alignItems: "center", gap: 10 },
  layerCopy: { flex: 1 },
  layerTitle: { fontSize: 14, fontWeight: "600", color: "#1e293b" },
  dot: { width: 10, height: 10, borderRadius: 5 },
  controls: { flexDirection: "row", gap: 8 },
  button: { flex: 1, minHeight: 44, justifyContent: "center", alignItems: "center", paddingHorizontal: 8, borderRadius: 8, backgroundColor: "#e2e8f0" },
  buttonText: { fontSize: 12, fontWeight: "600", color: "#334155" },
  pressed: { opacity: 0.6 },
  disabled: { opacity: 0.4 },
  note: { fontSize: 11, color: "#64748b", textAlign: "center" },
  error: { justifyContent: "center", padding: 24, gap: 16 },
});
