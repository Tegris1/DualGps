import { StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { terrainColors, terrainTypography } from "../theme";
import { TerrainButton } from "./terrain-button";

type TerrainPreviewErrorViewProps = {
  message: string;
  onRetry: () => void;
  onSignOut: () => void;
};

export function TerrainPreviewErrorView({ message, onRetry, onSignOut }: TerrainPreviewErrorViewProps) {
  return (
    <SafeAreaView style={styles.screen}>
      <Text style={styles.title}>Could not load terrain preview</Text>
      <Text style={styles.caption}>{message}</Text>
      <View style={styles.controls}>
        <TerrainButton variant="secondary" label="Retry" onPress={onRetry} />
        <TerrainButton variant="secondary" label="Sign out" onPress={onSignOut} />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: terrainColors.background, justifyContent: "center", padding: 24, gap: 16 },
  title: { ...terrainTypography.title, fontSize: 26 },
  caption: { ...terrainTypography.caption, fontSize: 12 },
  controls: { flexDirection: "row", gap: 8 },
});
