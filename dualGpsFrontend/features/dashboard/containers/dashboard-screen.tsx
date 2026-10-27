import { DashboardCameraControls } from "../components/dashboard-camera-controls";
import { DashboardLayerControls } from "../components/dashboard-layer-controls";
import { DashboardToolbar } from "../components/dashboard-toolbar";
import { DashboardView } from "../components/dashboard-view";
import { useDashboard } from "../hooks/use-dashboard";
import { useDashboardTerrain } from "../hooks/use-dashboard-terrain";
import { DashboardTerrainPanel } from "./dashboard-terrain-panel";

export function DashboardScreen({ onSignOut }: { onSignOut: () => void }) {
  const data = useDashboard();
  const terrain = useDashboardTerrain();
  const camera = terrain.cameraControls;
  const layers = terrain.layerControls;

  return (
    <DashboardView
      data={data}
      terrain={
        <DashboardTerrainPanel controller={terrain} controls={<>
          <DashboardCameraControls {...camera} />
          <DashboardLayerControls {...layers} />
        </>} />
      }
      toolbar={<DashboardToolbar
        cameraEnabled={camera.enabled}
        cameraControlsVisible={camera.visible}
        onToggleCameraControls={camera.onToggle}
        onResetView={camera.onResetView}
        layersEnabled={layers.enabled}
        layerControlsVisible={layers.visible}
        onToggleLayerControls={layers.onToggle}
      />}
      focusTerrain={camera.visible || layers.visible}
      onSignOut={onSignOut}
    />
  );
}
