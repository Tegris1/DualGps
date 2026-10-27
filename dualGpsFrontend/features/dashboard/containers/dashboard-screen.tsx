import { DashboardCameraControls } from "../components/dashboard-camera-controls";
import { DashboardToolbar } from "../components/dashboard-toolbar";
import { DashboardView } from "../components/dashboard-view";
import { useDashboard } from "../hooks/use-dashboard";
import { useDashboardTerrain } from "../hooks/use-dashboard-terrain";
import { DashboardTerrainPanel } from "./dashboard-terrain-panel";

export function DashboardScreen({ onSignOut }: { onSignOut: () => void }) {
  const data = useDashboard();
  const terrain = useDashboardTerrain();
  const camera = terrain.cameraControls;

  return (
    <DashboardView
      data={data}
      terrain={<DashboardTerrainPanel controller={terrain} cameraControls={<DashboardCameraControls {...camera} />} />}
      toolbar={<DashboardToolbar cameraEnabled={camera.enabled} cameraControlsVisible={camera.visible} onToggleCameraControls={camera.onToggle} onResetView={camera.onResetView} />}
      focusTerrain={camera.visible}
      onSignOut={onSignOut}
    />
  );
}
