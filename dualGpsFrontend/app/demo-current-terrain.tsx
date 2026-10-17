import { useRouter } from "expo-router";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { useDemoProject } from "@/features/demo/project-context";
import { useDemoSession } from "@/features/demo/session-context";
import { TERRAIN_CATALOG } from "@/features/demo/terrain-catalog";

export default function CurrentTerrainSelection() {
  const { currentTerrain, selectCurrentTerrain } = useDemoProject();
  const { signOut } = useDemoSession();
  const router = useRouter();
  return (
    <SafeAreaView style={styles.screen}>
      <StatusBar style="dark" />
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.row}>
          <Text style={styles.caption}>DUAL GPS / DEMO</Text>
          <Pressable accessibilityRole="button" onPress={signOut} hitSlop={10}><Text style={styles.link}>Sign out</Text></Pressable>
        </View>
        <Text style={styles.title}>Choose current terrain</Text>
        <Text style={styles.caption}>Select the existing surface to compare with the target design.</Text>
        {TERRAIN_CATALOG.filter((terrain) => terrain.role === "current").map((terrain) => (
          <Pressable key={terrain.id} accessibilityRole="radio"
            accessibilityLabel={terrain.filename} accessibilityState={{ checked: currentTerrain?.id === terrain.id }}
            onPress={() => selectCurrentTerrain(terrain.id)}
            style={[styles.card, currentTerrain?.id === terrain.id && styles.selected]}>
            <Text style={styles.name}>{terrain.name}</Text>
            <Text style={styles.caption}>{terrain.filename} / GLB</Text>
            <Text style={styles.link}>{currentTerrain?.id === terrain.id ? "Selected" : "Select terrain"}</Text>
          </Pressable>
        ))}
        <Pressable accessibilityRole="button" accessibilityState={{ disabled: !currentTerrain }}
          disabled={!currentTerrain} onPress={() => router.push("/demo-target-terrain")}
          style={[styles.button, !currentTerrain && styles.disabled]}>
          <Text style={styles.buttonText}>Choose target terrain</Text>
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
