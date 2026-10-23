import type { ReactNode } from "react";
import { StatusBar } from "expo-status-bar";
import { ScrollView, StyleSheet } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import type { Terrain } from "../terrain-catalog";
import { TerrainOptionCard } from "./terrain-option-card";
import { TerrainButton } from "./terrain-button";
import { TerrainHeader } from "./terrain-header";
import { terrainColors } from "../theme";

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
        <TerrainHeader title={title} description={description} onSignOut={onSignOut} style={styles.header} />
        {children}
        {terrains.map((terrain) => (
          <TerrainOptionCard
            key={terrain.id}
            terrain={terrain}
            selected={selectedId === terrain.id}
            onSelect={onSelect}
          />
        ))}
        <TerrainButton
          label={nextLabel}
          disabled={!canContinue}
          onPress={onNext}
        />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: terrainColors.background },
  content: { flexGrow: 1, padding: 24, gap: 20 },
  header: { gap: 20 },
});
