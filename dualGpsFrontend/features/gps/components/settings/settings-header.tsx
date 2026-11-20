import { Text, View } from "react-native";

import { ReturnButton } from "@/components/ui/return-button";
import { controlPanelColors as colors } from "@/constants/control-panel-colors";

import { styles } from "./styles";

export function SettingsHeader({ isGpsOnline, onReturn }: { isGpsOnline: boolean; onReturn?: () => void }) {
  return (
    <View style={styles.headerWrapper}>
      {onReturn && <ReturnButton onPress={onReturn} color={colors.yellow} />}
      <View style={styles.header}>
        <View>
          <Text style={styles.eyebrow}>DUAL GPS</Text>
          <Text style={styles.title}>Ustawienia</Text>
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
    </View>
  );
}
