import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { dashboardColors, dashboardStyles } from "../styles";

type Props = {
  visible: boolean;
  onClose: () => void;
  onOpenConnectionSetup?: () => void;
  onOpenSettings?: () => void;
  onSignOut: () => void;
};

export function DashboardMenu({ visible, onClose, onOpenConnectionSetup, onOpenSettings, onSignOut }: Props) {
  const actions = [
    { title: "Połączenie z odbiornikiem", description: "Wybór odbiornika i połączenie Bluetooth", icon: "bluetooth", onPress: onOpenConnectionSetup },
    { title: "Ustawienia", description: "Bluetooth, ASG-EUPOS i diagnostyka", icon: "settings", onPress: onOpenSettings },
    { title: "Wyloguj", description: "Zakończ bieżącą sesję", icon: "logout", onPress: onSignOut },
  ] as const;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <Pressable accessibilityRole="button" accessibilityLabel="Zamknij menu" onPress={onClose} style={StyleSheet.absoluteFillObject} />
        <SafeAreaView edges={["bottom", "left", "right"]} style={styles.sheet} accessibilityViewIsModal onAccessibilityEscape={onClose}>
          <ScrollView contentContainerStyle={styles.content}>
            <View style={styles.header}>
              <Text style={styles.title} accessibilityRole="header">MENU</Text>
              <Pressable accessibilityRole="button" accessibilityLabel="Zamknij menu" onPress={onClose} style={styles.closeButton}>
                <MaterialIcons name="close" size={26} color="#ffffff" />
              </Pressable>
            </View>
            {actions.filter((action) => action.onPress !== undefined).map((action) => (
              <Pressable key={action.title} accessibilityRole="button" onPress={action.onPress} style={({ pressed }) => [styles.action, pressed && dashboardStyles.pressed]}>
                <MaterialIcons name={action.icon} size={28} color={dashboardColors.yellow} />
                <View style={styles.copy}>
                  <Text style={styles.actionTitle}>{action.title}</Text>
                  <Text style={styles.description}>{action.description}</Text>
                </View>
                <MaterialIcons name="chevron-right" size={24} color="#d4e1e8" />
              </Pressable>
            ))}
          </ScrollView>
        </SafeAreaView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, justifyContent: "flex-end", backgroundColor: "#00000088" },
  sheet: { maxHeight: "90%", width: "100%", maxWidth: 620, alignSelf: "center", backgroundColor: dashboardColors.background, borderTopLeftRadius: 16, borderTopRightRadius: 16 },
  content: { padding: 20, gap: 12 },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 12 },
  title: { color: "#ffffff", fontSize: 16, fontWeight: "800", letterSpacing: 1 },
  closeButton: { minHeight: 44, minWidth: 44, justifyContent: "center", alignItems: "center" },
  action: { minHeight: 76, padding: 14, flexDirection: "row", alignItems: "center", gap: 14, borderRadius: 6, backgroundColor: dashboardColors.toolbar },
  copy: { flex: 1, gap: 5 },
  actionTitle: { color: "#ffffff", fontSize: 14, fontWeight: "700" },
  description: { color: "#d4e1e8", fontSize: 12, lineHeight: 18 },
});
