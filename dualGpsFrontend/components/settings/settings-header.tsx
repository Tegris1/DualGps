import { Text, View } from "react-native";

import { styles } from "./styles";

export function SettingsHeader({ isGpsOnline }: { isGpsOnline: boolean }) {
  return (
    <View style={styles.header}>
      <View>
        <Text style={styles.eyebrow}>DUAL GPS</Text>
        <Text style={styles.title}>Settings</Text>
      </View>
      <View
        style={[styles.headerStatus, isGpsOnline && styles.headerStatusOnline]}
      >
        <View style={[styles.statusDot, isGpsOnline && styles.statusDotOnline]} />
        <Text style={styles.headerStatusText}>
          {isGpsOnline ? "GPS online" : "GPS offline"}
        </Text>
      </View>
    </View>
  );
}
