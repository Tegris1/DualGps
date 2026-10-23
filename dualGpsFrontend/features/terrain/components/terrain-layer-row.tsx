import { Pressable, StyleSheet, Switch, Text, View } from "react-native";

import { terrainColors, terrainTypography } from "../theme";

type TerrainLayerRowProps = {
  title: string;
  filename: string;
  color: string;
  visible: boolean;
  onVisibilityChange: (visible: boolean) => void;
  onChangeTerrain: () => void;
};

export function TerrainLayerRow({
  title, filename, color, visible, onVisibilityChange, onChangeTerrain,
}: TerrainLayerRowProps) {
  const label = title.toLowerCase();
  return (
    <View style={styles.row}>
      <View style={[styles.dot, { backgroundColor: color }]} />
      <View style={styles.copy}>
        <Text style={styles.title}>{title}</Text>
        <Pressable accessibilityRole="button" accessibilityLabel={`Change ${label}`} onPress={onChangeTerrain}>
          <Text style={styles.caption}>{filename} / Change</Text>
        </Pressable>
      </View>
      <Switch accessibilityLabel={`Show ${label}`} value={visible} onValueChange={onVisibilityChange} />
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", gap: 10 },
  dot: { width: 10, height: 10, borderRadius: 5 },
  copy: { flex: 1 },
  title: { fontSize: 14, fontWeight: "600", color: terrainColors.heading },
  caption: { ...terrainTypography.caption, fontSize: 12 },
});
