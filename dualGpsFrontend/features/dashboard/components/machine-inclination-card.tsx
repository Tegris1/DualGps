import { Text, View } from "react-native";

import { dashboardStyles as styles } from "../styles";
import type { DashboardViewModel } from "../types";

export function MachineInclinationCard({ pitch, roll }: Pick<DashboardViewModel, "pitch" | "roll">) {
  return (
    <View style={[styles.summaryCard, styles.inclinationCard]}>
      <Text style={styles.cardTitle}>NACHYLENIE KOPARKI</Text>
      <View style={styles.inclinationContent}>
        <View style={styles.level} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
          <View style={styles.levelHorizontal} />
          <View style={styles.levelVertical} />
          <View style={styles.levelDot} />
        </View>
        <View style={styles.inclinationValues}>
          <Text style={styles.inclinationText}><Text style={styles.bold}>Wzdłuż </Text>{pitch}</Text>
          <Text style={styles.inclinationText}><Text style={styles.bold}>W poprzek </Text>{roll}</Text>
        </View>
      </View>
    </View>
  );
}
