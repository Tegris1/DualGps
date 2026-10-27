import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { Text, View } from "react-native";

import { dashboardStyles as styles } from "../styles";
import type { DashboardViewModel } from "../types";

type Props = Pick<DashboardViewModel, "heightDifference" | "heightDescription" | "heightDirection"> & { compact?: boolean };

export function HeightDifferenceCard({ heightDifference, heightDescription, heightDirection, compact = false }: Props) {
  const icon = heightDirection === "down" ? "arrow-downward" : heightDirection === "up" ? "arrow-upward" : "horizontal-rule";

  return (
    <View style={[styles.summaryCard, styles.heightCard, compact && styles.compactSummaryCard]}>
      <Text style={[styles.cardTitle, compact && styles.compactCardTitle, styles.lightText]}>RÓŻNICA DO PROJEKTU · DEMO</Text>
      <View style={styles.heightValueRow}>
        <MaterialIcons name={icon} size={compact ? 30 : 42} color="#ffffff" />
        <Text style={[styles.heightValue, compact && styles.compactHeightValue]}>{heightDifference}</Text>
      </View>
      <Text style={styles.heightDescription}>{heightDescription}</Text>
    </View>
  );
}
