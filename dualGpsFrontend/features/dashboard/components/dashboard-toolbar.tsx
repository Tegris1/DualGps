import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { Pressable, Text, View } from "react-native";

import { dashboardColors, dashboardStyles as styles } from "../styles";

type Props = {
  cameraEnabled: boolean;
  cameraControlsVisible: boolean;
  onToggleCameraControls: () => void;
  onResetView: () => void;
  layersEnabled: boolean;
  layerControlsVisible: boolean;
  onToggleLayerControls: () => void;
  menuVisible: boolean;
  onOpenMenu: () => void;
  compact?: boolean;
};

export function DashboardToolbar({ cameraEnabled, cameraControlsVisible, onToggleCameraControls, onResetView, layersEnabled, layerControlsVisible, onToggleLayerControls, menuVisible, onOpenMenu, compact = false }: Props) {
  const items = [
    { label: "Widok", icon: "open-with", disabled: !cameraEnabled, hint: cameraEnabled ? "Kamera 3D" : "Wczytaj teren", expanded: cameraControlsVisible, onPress: onToggleCameraControls },
    { label: "Warstwy", icon: "layers", disabled: !layersEnabled, hint: "Powierzchnie 3D", expanded: layerControlsVisible, onPress: onToggleLayerControls },
    { label: "Reset", icon: "restart-alt", disabled: !cameraEnabled, hint: cameraEnabled ? "Reset kamery" : "Wczytaj teren", onPress: onResetView },
    { label: "Menu", icon: "menu", disabled: false, hint: "Nawigacja i konto", expanded: menuVisible, onPress: onOpenMenu },
  ] as const;

  return (
    <View style={styles.toolbar}>
      {items.map((item) => (
        <Pressable
          key={item.label}
          accessibilityRole="button"
          accessibilityState={{ disabled: item.disabled, ...("expanded" in item ? { expanded: item.expanded } : {}) }}
          accessibilityLabel={item.label}
          accessibilityHint={item.hint}
          disabled={item.disabled}
          onPress={"onPress" in item ? item.onPress : undefined}
          style={({ pressed }) => [styles.toolbarItem, compact && styles.compactToolbarItem, item.disabled && styles.toolbarDisabled, "expanded" in item && item.expanded && styles.toolbarActive, pressed && styles.pressed]}
        >
          <MaterialIcons name={item.icon} size={compact ? 18 : 22} color={dashboardColors.yellow} />
          <Text style={styles.toolbarLabel}>{item.label}</Text>
          {!compact && <Text style={styles.toolbarNote}>{item.hint}</Text>}
        </Pressable>
      ))}
    </View>
  );
}
