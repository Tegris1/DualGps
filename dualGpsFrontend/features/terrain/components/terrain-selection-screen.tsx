import type { ReactNode } from "react";
import { StatusBar } from "expo-status-bar";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import type { Terrain } from "../terrain-catalog";
import { TerrainOptionCard } from "./terrain-option-card";

type TerrainSelectionScreenProps = {
  title: string;
  description: string;
  terrains: readonly Terrain[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onSignOut: () => void;
  nextLabel: string;
  onNext: () => void;
  children?: ReactNode;
};

export function TerrainSelectionScreen({
  title,
  description,
  terrains,
  selectedId,
  onSelect,
  onSignOut,
  nextLabel,
  onNext,
  children,
}: TerrainSelectionScreenProps) {
  const canContinue = terrains.some((terrain) => terrain.id === selectedId);

  return (
    <SafeAreaView style={styles.screen}>
      <StatusBar style="dark" />
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.row}>
          <Text style={styles.caption}>DUAL GPS</Text>
          <Pressable accessibilityRole="button" onPress={onSignOut} hitSlop={10}>
            <Text style={styles.link}>Sign out</Text>
          </Pressable>
        </View>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.caption}>{description}</Text>
        {children}
        {terrains.map((terrain) => (
          <TerrainOptionCard
            key={terrain.id}
            terrain={terrain}
            selected={selectedId === terrain.id}
            onSelect={onSelect}
          />
        ))}
        <Pressable
          accessibilityRole="button"
          accessibilityState={{ disabled: !canContinue }}
          disabled={!canContinue}
          onPress={onNext}
          style={[styles.button, !canContinue && styles.disabled]}
        >
          <Text style={styles.buttonText}>{nextLabel}</Text>
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
  link: { fontSize: 14, color: "#0e7490", fontWeight: "600" },
  button: { minHeight: 48, alignItems: "center", justifyContent: "center", borderRadius: 8, backgroundColor: "#0e7490" },
  buttonText: { color: "white", fontWeight: "700", fontSize: 16 },
  disabled: { opacity: 0.4 },
});
