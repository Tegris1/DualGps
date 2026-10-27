import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { Pressable, StyleSheet, Switch, Text, View } from "react-native";

import { terrainColors } from "@/features/terrain/theme";

import { dashboardColors, dashboardStyles } from "../styles";

type Props = {
  visible: boolean;
  canChangeVisibility: boolean;
  currentFilename: string | null;
  targetFilename: string | null;
  showCurrent: boolean;
  showTarget: boolean;
  onClose: () => void;
  onCurrentVisibilityChange: (visible: boolean) => void;
  onTargetVisibilityChange: (visible: boolean) => void;
  onChangeCurrent: () => void;
  onChangeTarget: () => void;
};

export function DashboardLayerControls({ visible, canChangeVisibility, currentFilename, targetFilename, showCurrent, showTarget, onClose, onCurrentVisibilityChange, onTargetVisibilityChange, onChangeCurrent, onChangeTarget }: Props) {
  if (!visible) return null;

  const layers = [
    { title: "Pomiar", filename: currentFilename, color: terrainColors.currentTerrain, shown: showCurrent, onVisibilityChange: onCurrentVisibilityChange, onChoose: onChangeCurrent, canChoose: true },
    { title: "Projekt", filename: targetFilename, color: terrainColors.accent, shown: showTarget, onVisibilityChange: onTargetVisibilityChange, onChoose: onChangeTarget, canChoose: currentFilename !== null },
  ];

  return (
    <View style={styles.panel}>
      <View style={styles.header}>
        <Text style={styles.title}>WARSTWY TERENU 3D</Text>
        <Pressable accessibilityRole="button" accessibilityLabel="Zamknij warstwy" onPress={onClose} style={styles.closeButton}>
          <MaterialIcons name="close" size={22} color={dashboardColors.ink} />
        </Pressable>
      </View>
      {layers.map((layer) => (
        <View key={layer.title} style={styles.layer}>
          <View style={[styles.swatch, { backgroundColor: layer.color }]} />
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`${layer.filename ? "Zmień" : "Wybierz"} warstwę: ${layer.title}`}
            accessibilityState={{ disabled: !layer.canChoose }}
            disabled={!layer.canChoose}
            onPress={layer.onChoose}
            style={({ pressed }) => [styles.selection, !layer.canChoose && styles.disabled, pressed && dashboardStyles.pressed]}
          >
            <Text style={styles.layerTitle}>{layer.title}</Text>
            <Text style={styles.filename}>{layer.filename ?? "Nie wybrano"} · {layer.filename ? "Zmień" : "Wybierz"}</Text>
          </Pressable>
          <Switch
            accessibilityLabel={`Pokaż warstwę: ${layer.title}`}
            disabled={!canChangeVisibility}
            value={layer.shown}
            onValueChange={layer.onVisibilityChange}
            trackColor={{ false: "#b5c5ce", true: "#6b98a8" }}
          />
        </View>
      ))}
      <Text style={styles.note}>
        {!canChangeVisibility ? "Wybierz i wczytaj oba modele, aby zmieniać widoczność."
          : !showCurrent && !showTarget ? "Obie powierzchnie są ukryte. Koparka i siatka pozostają widoczne."
          : "Widoczność dotyczy podglądu 3D. Przekrój pozostaje przykładowy."}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  panel: { gap: 8, padding: 10, backgroundColor: "#e2ebf0", borderRadius: 4 },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 },
  title: { flexShrink: 1, color: dashboardColors.ink, fontSize: 11, fontWeight: "700" },
  closeButton: { minHeight: 44, minWidth: 44, alignItems: "center", justifyContent: "center" },
  layer: { flexDirection: "row", alignItems: "center", gap: 10, padding: 8, backgroundColor: "#ffffff", borderRadius: 4 },
  swatch: { width: 10, height: 10, borderRadius: 5 },
  selection: { flex: 1, minHeight: 44, justifyContent: "center", gap: 4 },
  layerTitle: { fontSize: 12, fontWeight: "700", color: dashboardColors.ink },
  filename: { fontSize: 11, color: dashboardColors.muted },
  disabled: { opacity: 0.5 },
  note: { fontSize: 10, lineHeight: 15, color: dashboardColors.muted },
});
