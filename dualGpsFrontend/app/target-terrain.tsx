import { useRouter } from "expo-router";
import { Pressable, StyleSheet, Text } from "react-native";

import { useOfflineSession } from "@/features/auth/offline-session-context";
import { TerrainSelectionScreen } from "@/features/demo/components/terrain-selection-screen";
import { useTerrainProject } from "@/features/demo/project-context";
import { TERRAIN_CATALOG } from "@/features/demo/terrain-catalog";

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
        <Text style={styles.link}>Current surface: {currentTerrain.filename} / Change</Text>
      </Pressable>
    </TerrainSelectionScreen>
  );
}

const styles = StyleSheet.create({
  link: { fontSize: 14, color: "#0e7490", fontWeight: "600" },
});
