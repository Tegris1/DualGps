import { useRouter } from "expo-router";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { useDemoProject } from "@/features/demo/project-context";
import { useDemoSession } from "@/features/demo/session-context";
import { TERRAIN_CATALOG } from "@/features/demo/terrain-catalog";

export default function TargetTerrainSelection() {
  const { currentTerrain, targetTerrain, selectTargetTerrain } = useDemoProject();
  const { signOut } = useDemoSession();
  const router = useRouter();
  if (!currentTerrain) return null;
  return (
    <SafeAreaView style={styles.screen}>
      <StatusBar style="dark" />
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.row}>
          <Text style={styles.caption}>DUAL GPS / DEMO</Text>
          <Pressable accessibilityRole="button" onPress={signOut} hitSlop={10}><Text style={styles.link}>Sign out</Text></Pressable>
        </View>
        <Text style={styles.title}>Choose target terrain</Text>
        <Text style={styles.caption}>Select the design surface for the comparison.</Text>
        <Pressable accessibilityRole="button" accessibilityLabel="Change current terrain"
          onPress={() => router.navigate("/demo-current-terrain")}>
          <Text style={styles.link}>Current surface: {currentTerrain.filename} / Change</Text>
        </Pressable>
        {TERRAIN_CATALOG.filter((terrain) => terrain.role === "target" && terrain.asset !== currentTerrain.asset).map((terrain) => (
          <Pressable key={terrain.id} accessibilityRole="radio"
            accessibilityLabel={terrain.filename} accessibilityState={{ checked: targetTerrain?.id === terrain.id }}
            onPress={() => selectTargetTerrain(terrain.id)}
            style={[styles.card, targetTerrain?.id === terrain.id && styles.selected]}>
            <Text style={styles.name}>{terrain.name}</Text>
            <Text style={styles.caption}>{terrain.filename} / GLB</Text>
            <Text style={styles.link}>{targetTerrain?.id === terrain.id ? "Selected" : "Select terrain"}</Text>
          </Pressable>
        ))}
        <Pressable accessibilityRole="button" accessibilityState={{ disabled: !targetTerrain }}
          disabled={!targetTerrain} onPress={() => router.push("/demo-preview")}
          style={[styles.button, !targetTerrain && styles.disabled]}>
          <Text style={styles.buttonText}>Open preview</Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#f8fafc" },
  content: { flexGrow: 1, padding: 24, gap: 20 },
  row: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  title: { fontSize: 28, fontWeight: "700", color: "#0f172a" },
  caption: { fontSize: 14, color: "#64748b" },
  name: { fontSize: 18, fontWeight: "600", color: "#1e293b" },
  link: { fontSize: 14, color: "#0e7490", fontWeight: "600" },
  card: { padding: 20, gap: 10, borderWidth: 2, borderColor: "#cbd5e1", borderRadius: 12, backgroundColor: "white" },
  selected: { borderColor: "#0891b2", backgroundColor: "#ecfeff" },
  button: { minHeight: 48, alignItems: "center", justifyContent: "center", borderRadius: 8, backgroundColor: "#0e7490" },
  buttonText: { color: "white", fontWeight: "700", fontSize: 16 },
  disabled: { opacity: 0.4 },
});
