import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";

import type { PreviewView } from "../preview-models";
import type { Terrain } from "../terrain-catalog";
import { TerrainPreviewScene } from "../terrain-preview-scene";
import { terrainColors, terrainTypography } from "../theme";
import { TerrainButton } from "./terrain-button";
import { TerrainHeader } from "./terrain-header";
import { TerrainLayerRow } from "./terrain-layer-row";

type TerrainPreviewViewProps = {
  currentTerrain: Terrain;
  targetTerrain: Terrain;
  modelPair: string;
  view: PreviewView;
  showCurrent: boolean;
  showTarget: boolean;
  loaded: boolean;
  onLoaded: () => void;
  onCurrentVisibilityChange: (visible: boolean) => void;
  onTargetVisibilityChange: (visible: boolean) => void;
  onRotateLeft: () => void;
  onRotateRight: () => void;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onResetView: () => void;
  onTopView: () => void;
  onChangeCurrentTerrain: () => void;
  onChangeTargetTerrain: () => void;
  onSignOut: () => void;
};

export function TerrainPreviewView({
  currentTerrain,
  targetTerrain,
  modelPair,
  view,
  showCurrent,
  showTarget,
  loaded,
  onLoaded,
  onCurrentVisibilityChange,
  onTargetVisibilityChange,
  onRotateLeft,
  onRotateRight,
  onZoomIn,
  onZoomOut,
  onResetView,
  onTopView,
  onChangeCurrentTerrain,
  onChangeTargetTerrain,
  onSignOut,
}: TerrainPreviewViewProps) {
  return (
    <SafeAreaView style={styles.screen}>
      <StatusBar style="dark" />
      <TerrainHeader
        title="Terrain preview"
        description="Current surface, target design and excavator"
        onSignOut={onSignOut}
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
            <ActivityIndicator color={terrainColors.accent} />
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
          color={terrainColors.currentTerrain}
          visible={showCurrent}
          onVisibilityChange={onCurrentVisibilityChange}
          onChangeTerrain={onChangeCurrentTerrain}
        />
        <TerrainLayerRow
          title="Target terrain"
          filename={targetTerrain.filename}
          color={terrainColors.accent}
          visible={showTarget}
          onVisibilityChange={onTargetVisibilityChange}
          onChangeTerrain={onChangeTargetTerrain}
        />
        <View style={styles.controls}>
          <TerrainButton variant="secondary" label="Rotate left" disabled={!loaded} onPress={onRotateLeft} />
          <TerrainButton variant="secondary" label="Reset view" disabled={!loaded} onPress={onResetView} />
          <TerrainButton variant="secondary" label="Rotate right" disabled={!loaded} onPress={onRotateRight} />
        </View>
        <View style={styles.controls}>
          <TerrainButton variant="secondary" label="Zoom in" disabled={!loaded} onPress={onZoomIn} />
          <TerrainButton variant="secondary" label="Top view" disabled={!loaded} onPress={onTopView} />
          <TerrainButton variant="secondary" label="Zoom out" disabled={!loaded} onPress={onZoomOut} />
        </View>
        <Text style={styles.note}>Target lines remain visible through the current surface.</Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: terrainColors.background },
  header: { padding: 20 },
  caption: { ...terrainTypography.caption, fontSize: 12 },
  viewport: { flex: 1, minHeight: 180, backgroundColor: terrainColors.previewBackground },
  loading: { ...StyleSheet.absoluteFillObject, backgroundColor: terrainColors.previewBackground, alignItems: "center", justifyContent: "center", gap: 12 },
  sceneLabel: { position: "absolute", left: 16, top: 16, backgroundColor: "#ffffffdd", padding: 8, borderRadius: 6 },
  sceneLabelText: { fontSize: 10, fontWeight: "700", color: "#475569", letterSpacing: 1 },
  panel: { padding: 16, gap: 10 },
  controls: { flexDirection: "row", gap: 8 },
  note: { fontSize: 11, color: terrainColors.muted, textAlign: "center" },
});
