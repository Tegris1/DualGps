import { Component, type ErrorInfo, type ReactNode } from "react";
import { View } from "react-native";

import { TerrainPreviewScene } from "@/features/terrain/terrain-preview-scene";

import { DashboardTerrainPicker } from "../components/dashboard-terrain-picker";
import { TerrainPanelError, TerrainPanelLoading, TerrainPanelView } from "../components/terrain-panel-view";
import type { useDashboardTerrain } from "../hooks/use-dashboard-terrain";

class TerrainSceneBoundary extends Component<{ children: ReactNode; fallback: ReactNode; onError: () => void }, { failed: boolean }> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("Dashboard terrain preview failed:", error, info.componentStack);
    this.props.onError();
  }

  render() {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}

type Props = {
  controller: ReturnType<typeof useDashboardTerrain>;
  cameraControls: ReactNode;
};

export function DashboardTerrainPanel({ controller, cameraControls }: Props) {
  const { currentTerrain, targetTerrain, preview, sceneKey, onSceneError, onRetry, onOpenSelection, selection } = controller;

  return (
    <>
      <TerrainPanelView currentFilename={currentTerrain?.filename ?? null} targetFilename={targetTerrain?.filename ?? null} onChooseTerrains={onOpenSelection} cameraControls={cameraControls}>
        {currentTerrain && targetTerrain ? (
          <TerrainSceneBoundary key={sceneKey} fallback={<TerrainPanelError onRetry={onRetry} />} onError={onSceneError}>
            <View style={{ flex: 1, minHeight: 220 }}>
              <TerrainPreviewScene
                currentTerrain={currentTerrain}
                targetTerrain={targetTerrain}
                view={preview.view}
                showCurrent={preview.showCurrent}
                showTarget={preview.showTarget}
                onLoaded={preview.onLoaded}
              />
              {!preview.loaded && <TerrainPanelLoading />}
            </View>
          </TerrainSceneBoundary>
        ) : null}
      </TerrainPanelView>
      <DashboardTerrainPicker {...selection} />
    </>
  );
}
