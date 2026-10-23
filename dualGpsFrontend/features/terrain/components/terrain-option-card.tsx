import { Pressable, StyleSheet, Text } from "react-native";

import type { Terrain } from "../terrain-catalog";
import { terrainColors, terrainTypography } from "../theme";

type TerrainOptionCardProps = {
  terrain: Terrain;
  selected: boolean;
  onSelect: (id: string) => void;
};

export function TerrainOptionCard({ terrain, selected, onSelect }: TerrainOptionCardProps) {
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityLabel={terrain.filename}
      accessibilityState={{ checked: selected }}
      onPress={() => onSelect(terrain.id)}
      style={[styles.card, selected && styles.selected]}
    >
      <Text style={styles.name}>{terrain.name}</Text>
      <Text style={terrainTypography.caption}>{terrain.filename} / GLB</Text>
      <Text style={terrainTypography.link}>{selected ? "Selected" : "Select terrain"}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: { padding: 20, gap: 10, borderWidth: 2, borderColor: terrainColors.border, borderRadius: 12, backgroundColor: terrainColors.surface },
  selected: { borderColor: terrainColors.accent, backgroundColor: terrainColors.selected },
  name: { fontSize: 18, fontWeight: "600", color: terrainColors.heading },
});
