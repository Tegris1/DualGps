import { Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from "react-native";

import { terrainTypography } from "../theme";

type TerrainHeaderProps = {
  title: string;
  description: string;
  onSignOut?: () => void;
  compact?: boolean;
  style?: StyleProp<ViewStyle>;
};

export function TerrainHeader({ title, description, onSignOut, compact = false, style }: TerrainHeaderProps) {
  return (
    <View style={[styles.header, compact && styles.compact, style]}>
      <View style={styles.row}>
        <Text style={terrainTypography.eyebrow}>DUAL GPS</Text>
        {onSignOut && (
          <Pressable accessibilityRole="button" onPress={onSignOut} hitSlop={10}>
            <Text style={terrainTypography.link}>Sign out</Text>
          </Pressable>
        )}
      </View>
      <Text style={[terrainTypography.title, compact && styles.compactTitle]}>{title}</Text>
      <Text style={[terrainTypography.caption, compact && styles.compactCaption]}>{description}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  header: { gap: 12 },
  row: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  compact: { gap: 5 },
  compactTitle: { fontSize: 26 },
  compactCaption: { fontSize: 12 },
});
