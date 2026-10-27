import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { Text, View } from "react-native";

import { dashboardColors, dashboardStyles as styles } from "../styles";

// Reserve these positions until camera, layer and menu actions are integrated.
const items = [
  { label: "Widok", icon: "open-with" },
  { label: "Warstwy", icon: "layers" },
  { label: "Reset", icon: "restart-alt" },
  { label: "Menu", icon: "menu" },
] as const;

export function DashboardToolbar() {
  return (
    <View style={styles.toolbar}>
      {items.map((item) => (
        <View key={item.label} style={styles.toolbarItem} accessible accessibilityRole="button" accessibilityState={{ disabled: true }} accessibilityLabel={`${item.label}, wkrótce`}>
          <MaterialIcons name={item.icon} size={22} color={dashboardColors.yellow} />
          <Text style={styles.toolbarLabel}>{item.label}</Text>
          <Text style={styles.toolbarNote}>Wkrótce</Text>
        </View>
      ))}
    </View>
  );
}
