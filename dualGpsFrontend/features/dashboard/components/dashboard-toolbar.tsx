import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { Pressable, Text, View } from "react-native";

import { dashboardColors, dashboardStyles as styles } from "../styles";

type Props = {
  onOpenConnectionSetup?: () => void;
  onOpenSettings?: () => void;
  onSignOut: () => void;
  menuVisible: boolean;
  onOpenMenu: () => void;
  compact?: boolean;
};

export function DashboardToolbar({ onOpenConnectionSetup, onOpenSettings, onSignOut, menuVisible, onOpenMenu, compact = false }: Props) {
  const items = [
    { label: "Połączenie", icon: "bluetooth", disabled: false, hint: "Odbiornik GPS", onPress: onOpenConnectionSetup },
    { label: "Ustawienia", icon: "settings", disabled: false, hint: "Konfiguracja", onPress: onOpenSettings },
    { label: "Wyloguj", icon: "logout", disabled: false, hint: "Zakończ sesję", onPress: onSignOut },
    { label: "Menu", icon: "menu", disabled: false, hint: "Nawigacja i konto", expanded: menuVisible, onPress: onOpenMenu },
  ] as const;

  return (
    <View style={styles.toolbar}>
      {items.filter((item) => item.onPress !== undefined).map((item) => (
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
