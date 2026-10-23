import { useRouter } from "expo-router";
import { Pressable, Text } from "react-native";

import { useOfflineSession } from "@/features/auth/offline-session-context";
import { TerrainSelectionScreen } from "@/features/terrain/components/terrain-selection-screen";
import { useTerrainProject } from "@/features/terrain/project-context";
import { TERRAIN_CATALOG } from "@/features/terrain/terrain-catalog";
import { terrainTypography } from "@/features/terrain/theme";

export default function TargetTerrainSelection() {
  const { currentTerrain, targetTerrain, selectTargetTerrain } = useTerrainProject();
  const { signOut } = useOfflineSession();
  const router = useRouter();

  if (!currentTerrain) return null;

  return (
    <TerrainSelectionScreen
      title="Choose target terrain"
      description="Select the design surface for the comparison."
      terrains={TERRAIN_CATALOG.filter(
        (terrain) => terrain.role === "target" && terrain.asset !== currentTerrain.asset,
      )}
      selectedId={targetTerrain?.id ?? null}
      onSelect={selectTargetTerrain}
      onSignOut={signOut}
      nextLabel="Open preview"
      onNext={() => router.push("/terrain-preview")}
    >
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Change current terrain"
        onPress={() => router.navigate("/current-terrain")}
      >
        <Text style={terrainTypography.link}>Current surface: {currentTerrain.filename} / Change</Text>
      </Pressable>
    </TerrainSelectionScreen>
  );
}
