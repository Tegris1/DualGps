import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { TerrainButton } from "@/features/terrain/components/terrain-button";
import type { Terrain } from "@/features/terrain/terrain-catalog";

import { dashboardColors } from "../styles";

type Props = {
  visible: boolean;
  choosingTarget: boolean;
  options: readonly Terrain[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onNext: () => void;
  onBack: () => void;
  onClose: () => void;
};

export function DashboardTerrainPicker({ visible, choosingTarget, options, selectedId, onSelect, onNext, onBack, onClose }: Props) {
  const canContinue = options.some((terrain) => terrain.id === selectedId);

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <SafeAreaView style={styles.screen}>
        <ScrollView contentContainerStyle={styles.content}>
          <View style={styles.header}>
            <Text style={styles.step}>{choosingTarget ? "KROK 2 / 2" : "KROK 1 / 2"}</Text>
            <Pressable accessibilityRole="button" onPress={onClose} style={styles.closeButton}>
              <Text style={styles.link}>Zamknij</Text>
            </Pressable>
          </View>
          <Text style={styles.title}>{choosingTarget ? "Wybierz projekt" : "Wybierz teren pomiarowy"}</Text>
          <Text style={styles.description}>{choosingTarget ? "Wskaż powierzchnię projektową do porównania." : "Wskaż model istniejącej powierzchni."}</Text>
          {options.map((terrain) => (
            <Pressable key={terrain.id} accessibilityRole="radio" accessibilityState={{ checked: selectedId === terrain.id }} onPress={() => onSelect(terrain.id)} style={[styles.option, selectedId === terrain.id && styles.selected]}>
              <Text style={styles.optionTitle}>{terrain.filename}</Text>
              <Text style={styles.link}>{selectedId === terrain.id ? "Wybrano" : "Wybierz"}</Text>
            </Pressable>
          ))}
          {!options.length && <Text style={styles.description}>Brak dostępnych modeli.</Text>}
          <TerrainButton label={choosingTarget ? "Otwórz podgląd" : "Dalej: wybierz projekt"} disabled={!canContinue} onPress={onNext} />
          {choosingTarget && <TerrainButton variant="secondary" label="Zmień teren pomiarowy" onPress={onBack} style={styles.backButton} />}
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#f5f8fa" },
  content: { flexGrow: 1, padding: 24, gap: 20 },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  step: { color: dashboardColors.muted, fontSize: 12, fontWeight: "700" },
  closeButton: { minHeight: 44, justifyContent: "center", paddingHorizontal: 8 },
  link: { color: dashboardColors.ink, fontSize: 13, fontWeight: "700" },
  title: { fontSize: 26, fontWeight: "700", color: dashboardColors.ink },
  description: { color: dashboardColors.muted, fontSize: 14, lineHeight: 21 },
  option: { padding: 20, gap: 12, borderWidth: 2, borderColor: "#d4e1e8", borderRadius: 8, backgroundColor: "#ffffff" },
  selected: { borderColor: dashboardColors.ink, backgroundColor: "#e6eef3" },
  optionTitle: { color: dashboardColors.ink, fontSize: 18, fontWeight: "700" },
  backButton: { flex: 0 },
});
