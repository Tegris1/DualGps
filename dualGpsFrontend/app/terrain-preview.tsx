import { useCallback, useState } from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { type ErrorBoundaryProps, useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";

import { TerrainButton } from "@/features/terrain/components/terrain-button";
import { TerrainHeader } from "@/features/terrain/components/terrain-header";
import { TerrainLayerRow } from "@/features/terrain/components/terrain-layer-row";
import { terrainColors, terrainTypography } from "@/features/terrain/theme";
import { CURRENT_COLOR, DEFAULT_VIEW, TARGET_COLOR } from "@/features/terrain/preview-models";
import { clearTerrainPreviewCache, TerrainPreviewScene } from "@/features/terrain/terrain-preview-scene";
import { useOfflineSession } from "@/features/auth/offline-session-context";
import { useTerrainProject } from "@/features/terrain/project-context";

export function ErrorBoundary({ error, retry }: ErrorBoundaryProps) {
  const { signOut } = useOfflineSession();
  const { currentTerrain, targetTerrain } = useTerrainProject();
  return (
    <SafeAreaView style={[styles.screen, styles.error]}>
      <Text style={styles.title}>Could not load terrain preview</Text>
      <Text style={styles.caption}>{error.message}</Text>
      <View style={styles.controls}>
        <TerrainButton variant="secondary" label="Retry" onPress={() => {
          if (currentTerrain && targetTerrain) clearTerrainPreviewCache(currentTerrain, targetTerrain);
          void retry();
        }} />
        <TerrainButton variant="secondary" label="Sign out" onPress={signOut} />
      </View>
    </SafeAreaView>
  );
}

export default function TerrainPreview() {
  const { signOut } = useOfflineSession();
  const { currentTerrain, targetTerrain } = useTerrainProject();
  const router = useRouter();
  const [view, setView] = useState(DEFAULT_VIEW);
  const [showCurrent, setShowCurrent] = useState(true);
  const [showTarget, setShowTarget] = useState(true);
  const [loadedPair, setLoadedPair] = useState<string | null>(null);
  const modelPair = JSON.stringify([currentTerrain?.id, targetTerrain?.id]);
  const loaded = loadedPair === modelPair;
  const onLoaded = useCallback(() => setLoadedPair(modelPair), [modelPair]);
  if (!currentTerrain || !targetTerrain) return null;

  return (
    <SafeAreaView style={styles.screen}>
      <StatusBar style="dark" />
      <TerrainHeader
        title="Terrain preview"
        description="Current surface, target design and excavator"
        onSignOut={signOut}
        compact
        style={styles.header}
      />
      <View style={styles.viewport}>
        <TerrainPreviewScene
          key={modelPair}
          currentTerrain={currentTerrain}
          targetTerrain={targetTerrain}
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
        <TerrainLayerRow
          title="Current terrain"
          filename={currentTerrain.filename}
          color={CURRENT_COLOR}
          visible={showCurrent}
          onVisibilityChange={setShowCurrent}
          onChangeTerrain={() => router.navigate("/current-terrain")}
        />
        <TerrainLayerRow
          title="Target terrain"
          filename={targetTerrain.filename}
          color={TARGET_COLOR}
          visible={showTarget}
          onVisibilityChange={setShowTarget}
          onChangeTerrain={() => router.navigate("/target-terrain")}
        />
        <View style={styles.controls}>
          <TerrainButton variant="secondary" label="Rotate left" disabled={!loaded}
            onPress={() => setView((value) => ({ ...value, yaw: value.yaw - Math.PI / 8 }))} />
          <TerrainButton variant="secondary" label="Reset view" disabled={!loaded} onPress={() => setView(DEFAULT_VIEW)} />
          <TerrainButton variant="secondary" label="Rotate right" disabled={!loaded}
            onPress={() => setView((value) => ({ ...value, yaw: value.yaw + Math.PI / 8 }))} />
        </View>
        <View style={styles.controls}>
          <TerrainButton variant="secondary" label="Zoom in" disabled={!loaded}
            onPress={() => setView((value) => ({ ...value, zoom: Math.max(0.4, value.zoom / 1.2) }))} />
          <TerrainButton variant="secondary" label="Top view" disabled={!loaded}
            onPress={() => setView({ ...DEFAULT_VIEW, elevation: Math.PI / 2 - 0.001 })} />
          <TerrainButton variant="secondary" label="Zoom out" disabled={!loaded}
            onPress={() => setView((value) => ({ ...value, zoom: Math.min(3, value.zoom * 1.2) }))} />
        </View>
        <Text style={styles.note}>Target lines remain visible through the current surface.</Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: terrainColors.background },
  header: { padding: 20 },
  title: { ...terrainTypography.title, fontSize: 26 },
  caption: { ...terrainTypography.caption, fontSize: 12 },
  viewport: { flex: 1, minHeight: 180, backgroundColor: terrainColors.previewBackground },
  loading: { ...StyleSheet.absoluteFillObject, backgroundColor: terrainColors.previewBackground, alignItems: "center", justifyContent: "center", gap: 12 },
  sceneLabel: { position: "absolute", left: 16, top: 16, backgroundColor: "#ffffffdd", padding: 8, borderRadius: 6 },
  sceneLabelText: { fontSize: 10, fontWeight: "700", color: "#475569", letterSpacing: 1 },
  panel: { padding: 16, gap: 10 },
  controls: { flexDirection: "row", gap: 8 },
  note: { fontSize: 11, color: terrainColors.muted, textAlign: "center" },
  error: { justifyContent: "center", padding: 24, gap: 16 },
});
