import { DashboardCameraControls } from "../components/dashboard-camera-controls";
import { DashboardLayerControls } from "../components/dashboard-layer-controls";
import { DashboardMenu } from "../components/dashboard-menu";
import { DashboardToolbar } from "../components/dashboard-toolbar";
import { DashboardView } from "../components/dashboard-view";
import { useDashboard } from "../hooks/use-dashboard";
import { useDashboardTerrain } from "../hooks/use-dashboard-terrain";
import { useDashboardMenu, type DashboardMenuActions } from "../hooks/use-dashboard-menu";
import { DashboardTerrainPanel } from "./dashboard-terrain-panel";

export function DashboardScreen(actions: DashboardMenuActions) {
  const data = useDashboard();
  const terrain = useDashboardTerrain();
  const camera = terrain.cameraControls;
  const layers = terrain.layerControls;
  const menu = useDashboardMenu(actions);

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
        menuVisible={menu.visible}
        onOpenMenu={menu.onOpen}
      />}
      focusTerrain={camera.visible || layers.visible}
      menu={<DashboardMenu {...menu} />}
    />
  );
}
