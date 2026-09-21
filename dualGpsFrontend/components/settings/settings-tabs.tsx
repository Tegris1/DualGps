import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { Pressable, Text, View } from "react-native";

import type { SettingsSection } from "./types";
import { styles } from "./styles";

const tabs: {
  key: SettingsSection;
  label: string;
  icon: keyof typeof MaterialIcons.glyphMap;
}[] = [
  { key: "bluetooth", label: "Bluetooth", icon: "bluetooth" },
  { key: "eupos", label: "ASG-EUPOS", icon: "dns" },
  { key: "debug", label: "Debug", icon: "terminal" },
];

export function SettingsTabs({
  activeTab,
  onChange,
}: {
  activeTab: SettingsSection;
  onChange: (tab: SettingsSection) => void;
}) {
  return (
    <View style={styles.tabs}>
      {tabs.map((tab) => {
        const active = activeTab === tab.key;
        return (
          <Pressable
            key={tab.key}
            accessibilityRole="tab"
            accessibilityState={{ selected: active }}
            onPress={() => onChange(tab.key)}
            style={({ pressed }) => [
              styles.tab,
              active && styles.tabActive,
              pressed && styles.pressed,
            ]}
          >
            <MaterialIcons
              name={tab.icon}
              size={18}
              color={active ? "#F8FAFC" : "#64748B"}
            />
            <Text
              numberOfLines={1}
              style={[styles.tabLabel, active && styles.tabLabelActive]}
            >
              {tab.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}
