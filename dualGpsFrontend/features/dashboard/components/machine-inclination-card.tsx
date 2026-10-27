import { Text, View } from "react-native";

import { dashboardStyles as styles } from "../styles";
import type { DashboardViewModel } from "../types";

export function MachineInclinationCard({ pitch, roll, compact = false }: Pick<DashboardViewModel, "pitch" | "roll"> & { compact?: boolean }) {
  return (
    <View style={[styles.summaryCard, styles.inclinationCard, compact && styles.compactSummaryCard]}>
      <Text style={[styles.cardTitle, compact && styles.compactCardTitle]}>NACHYLENIE KOPARKI</Text>
      <View style={[styles.inclinationContent, compact && styles.compactInclinationContent]}>
        <View style={[styles.level, compact && styles.compactLevel]} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
          <View style={[styles.levelHorizontal, compact && styles.compactLevelHorizontal]} />
          <View style={[styles.levelVertical, compact && styles.compactLevelVertical]} />
          <View style={styles.levelDot} />
        </View>
        <View style={styles.inclinationValues}>
          <Text style={[styles.inclinationText, compact && styles.compactInclinationText]}><Text style={styles.bold}>Wzdłuż </Text>{pitch}</Text>
          <Text style={[styles.inclinationText, compact && styles.compactInclinationText]}><Text style={styles.bold}>W poprzek </Text>{roll}</Text>
        </View>
      </View>
    </View>
  );
}
