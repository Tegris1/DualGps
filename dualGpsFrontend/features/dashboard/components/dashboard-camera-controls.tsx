import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { dashboardColors, dashboardStyles } from "../styles";

type Props = {
  visible: boolean;
  onClose: () => void;
  onRotateLeft: () => void;
  onRotateRight: () => void;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onTopView: () => void;
};

export function DashboardCameraControls({ visible, onClose, onRotateLeft, onRotateRight, onZoomIn, onZoomOut, onTopView }: Props) {
  if (!visible) return null;

  const actions = [
    { label: "Obrót w lewo", icon: "rotate-left", onPress: onRotateLeft },
    { label: "Obrót w prawo", icon: "rotate-right", onPress: onRotateRight },
    { label: "Z góry", icon: "map", onPress: onTopView },
    { label: "Przybliż", icon: "zoom-in", onPress: onZoomIn },
    { label: "Oddal", icon: "zoom-out", onPress: onZoomOut },
  ] as const;

  return (
    <View style={styles.panel}>
      <View style={styles.header}>
        <Text style={styles.title}>KAMERA TERENU 3D</Text>
        <Pressable accessibilityRole="button" accessibilityLabel="Zamknij sterowanie kamerą" onPress={onClose} style={styles.closeButton}>
          <MaterialIcons name="close" size={22} color={dashboardColors.ink} />
        </Pressable>
      </View>
      <View style={styles.actions}>
        {actions.map((action) => (
          <Pressable key={action.label} accessibilityRole="button" onPress={action.onPress} style={({ pressed }) => [styles.action, pressed && dashboardStyles.pressed]}>
            <MaterialIcons name={action.icon} size={24} color={dashboardColors.ink} />
            <Text style={styles.label}>{action.label}</Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  panel: { gap: 6, padding: 10, backgroundColor: "#e2ebf0", borderRadius: 4 },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 },
  title: { flexShrink: 1, color: dashboardColors.ink, fontSize: 11, fontWeight: "700" },
  closeButton: { minHeight: 44, minWidth: 44, alignItems: "center", justifyContent: "center" },
  actions: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  action: { flexBasis: "30%", flexGrow: 1, minWidth: 85, minHeight: 64, padding: 8, alignItems: "center", justifyContent: "center", gap: 6, backgroundColor: "#ffffff", borderRadius: 4 },
  label: { color: dashboardColors.ink, fontSize: 11, fontWeight: "600", textAlign: "center" },
});
