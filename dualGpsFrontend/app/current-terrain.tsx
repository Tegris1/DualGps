import { useRouter } from "expo-router";

import { useOfflineSession } from "@/features/auth/offline-session-context";
import { TerrainSelectionScreen } from "@/features/terrain/components/terrain-selection-screen";
import { useTerrainProject } from "@/features/terrain/project-context";
import { TERRAIN_CATALOG } from "@/features/terrain/terrain-catalog";

export default function CurrentTerrainSelection() {
  const { currentTerrain, selectCurrentTerrain } = useTerrainProject();
  const { signOut } = useOfflineSession();
  const router = useRouter();

  return (
    <TerrainSelectionScreen
      title="Choose current terrain"
      description="Select the existing surface to compare with the target design."
      terrains={TERRAIN_CATALOG.filter((terrain) => terrain.role === "current")}
      selectedId={currentTerrain?.id ?? null}
      onSelect={selectCurrentTerrain}
      onSignOut={signOut}
      nextLabel="Choose target terrain"
      onNext={() => router.push("/target-terrain")}
    />
  );
}
