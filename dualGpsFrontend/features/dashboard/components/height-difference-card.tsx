import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { Text, View } from "react-native";

import { dashboardStyles as styles } from "../styles";
import type { DashboardViewModel } from "../types";

type Props = Pick<DashboardViewModel, "heightDifference" | "heightDescription" | "heightDirection">;

export function HeightDifferenceCard({ heightDifference, heightDescription, heightDirection }: Props) {
  const icon = heightDirection === "down" ? "arrow-downward" : heightDirection === "up" ? "arrow-upward" : "horizontal-rule";

  return (
    <View style={[styles.summaryCard, styles.heightCard]}>
      <Text style={[styles.cardTitle, styles.lightText]}>RÓŻNICA DO PROJEKTU</Text>
      <View style={styles.heightValueRow}>
        <MaterialIcons name={icon} size={42} color="#ffffff" />
        <Text style={styles.heightValue}>{heightDifference}</Text>
      </View>
      <Text style={styles.heightDescription}>{heightDescription}</Text>
    </View>
  );
}
