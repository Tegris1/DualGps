import { DashboardCameraControls } from "../components/dashboard-camera-controls";
import { DashboardLayerControls } from "../components/dashboard-layer-controls";
import { DashboardMenu } from "../components/dashboard-menu";
import { DashboardToolbar } from "../components/dashboard-toolbar";
import { DashboardView } from "../components/dashboard-view";
import { TerrainCrossSectionPanel } from "../components/terrain-cross-section-panel";
import { useDashboardLayout } from "../hooks/use-dashboard-layout";
import { useDashboardTerrain } from "../hooks/use-dashboard-terrain";
import { useDashboardMenu, type DashboardMenuActions } from "../hooks/use-dashboard-menu";
import type { DashboardViewModel } from "../types";
import { DashboardTerrainPanel } from "./dashboard-terrain-panel";

export function DashboardScreen({ data, isActive = true, ...actions }: DashboardMenuActions & { data: DashboardViewModel; isActive?: boolean }) {
  const layout = useDashboardLayout();
  const terrain = useDashboardTerrain();
  const camera = terrain.cameraControls;
  const layers = terrain.layerControls;
  const menu = useDashboardMenu({
    ...actions,
    onOpenView: camera.onOpen,
    onOpenLayers: layers.onOpen,
    onResetView: () => { camera.onResetView(); camera.onClose(); },
  });
  function returnToMenu() {
    camera.onClose();
    menu.onOpen();
  }

  return (
    <DashboardView
      data={data}
      layout={layout}
      crossSection={<TerrainCrossSectionPanel section={terrain.crossSection} compact={layout.compact} plotHeight={layout.plotHeight} />}
      terrain={
        <DashboardTerrainPanel isActive={isActive} compact={layout.compact} controller={terrain} controls={<>
          <DashboardCameraControls {...camera} onClose={returnToMenu} />
          <DashboardLayerControls {...layers} onClose={returnToMenu} />
        </>} />
      }
      toolbar={<DashboardToolbar
        compact={layout.compact}
        onOpenConnectionSetup={menu.onOpenConnectionSetup}
        onOpenSettings={menu.onOpenSettings}
        onSignOut={menu.onSignOut}
        menuVisible={menu.visible}
        onOpenMenu={menu.onOpen}
      />}
      focusTerrain={camera.visible || layers.visible}
      menu={<DashboardMenu {...menu} cameraEnabled={camera.enabled} layersEnabled={layers.enabled} />}
    />
  );
}
