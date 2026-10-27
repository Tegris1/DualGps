import { Text, View } from "react-native";

import { dashboardStyles as styles } from "../styles";
import type { DashboardViewModel } from "../types";

export function SensorStatusCard({ imuSummary, imus, gnss }: Pick<DashboardViewModel, "imuSummary" | "imus" | "gnss">) {
  return (
    <View style={[styles.summaryCard, styles.sensorCard]}>
      <Text style={styles.cardTitle}>IMU: {imuSummary} / GNSS</Text>
      <View style={styles.sensorGrid}>
        {imus.map((sensor) => (
          <View key={sensor.id} style={styles.sensorCell} accessible accessibilityLabel={`${sensor.label}: ${sensor.statusText}`}>
            <View style={[styles.sensorDot, !sensor.available && styles.unavailableDot]} />
            <Text style={styles.sensorLabel}>{sensor.label}: {sensor.statusText}</Text>
          </View>
        ))}
      </View>
      <View style={styles.gnssRow}>
        {gnss.map((sensor) => <Text key={sensor.id} style={styles.gnssLabel}>{sensor.label}: {sensor.statusText}</Text>)}
      </View>
    </View>
  );
}
