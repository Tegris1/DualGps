import { Pressable, StyleSheet, Text } from "react-native";

import type { Terrain } from "../terrain-catalog";

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
      <Text style={styles.caption}>{terrain.filename} / GLB</Text>
      <Text style={styles.link}>{selected ? "Selected" : "Select terrain"}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: { padding: 20, gap: 10, borderWidth: 2, borderColor: "#cbd5e1", borderRadius: 12, backgroundColor: "white" },
  selected: { borderColor: "#0891b2", backgroundColor: "#ecfeff" },
  name: { fontSize: 18, fontWeight: "600", color: "#1e293b" },
  caption: { fontSize: 14, color: "#64748b" },
  link: { fontSize: 14, color: "#0e7490", fontWeight: "600" },
});
