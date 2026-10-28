import { Text, View } from "react-native";

import { dashboardStyles as styles } from "../styles";
import type { DashboardViewModel } from "../types";

export function SensorStatusCard({ imuSummary, imus, gnss, compact = false }: Pick<DashboardViewModel, "imuSummary" | "imus" | "gnss"> & { compact?: boolean }) {
  return (
    <View style={[styles.summaryCard, styles.sensorCard, compact && styles.compactSummaryCard]}>
      <Text style={[styles.cardTitle, compact && styles.compactCardTitle]}>IMU: {imuSummary} / GNSS</Text>
      <View style={[styles.sensorGrid, compact && styles.compactSensorGrid]}>
        {imus.map((sensor) => (
          <View key={sensor.id} style={[styles.sensorCell, compact && styles.compactSensorCell]} accessible accessibilityLabel={`${sensor.label}: ${sensor.statusText}`}>
            <View style={styles.sensorDot} />
            <Text style={[styles.sensorLabel, compact && styles.compactSensorLabel]}>{sensor.label}: {sensor.statusText}</Text>
          </View>
        ))}
      </View>
      <View style={styles.gnssRow}>
        {gnss.map((sensor) => (
          <View key={sensor.id} style={styles.gnssSensor} accessible accessibilityLabel={`${sensor.label}: ${sensor.statusText}. ${sensor.details ?? ""}`}>
            <Text style={[styles.gnssLabel, compact && styles.compactSensorLabel, sensor.tone === "success" ? styles.gnssSuccess : sensor.tone === "warning" ? styles.gnssWarning : styles.gnssMuted]}>{sensor.label}: {sensor.statusText}</Text>
            {sensor.source === "receiver" && <Text style={[styles.sensorSource, compact && styles.compactSensorSource]}>ODBIORNIK</Text>}
            {sensor.details && <Text style={[styles.sensorSource, compact && styles.compactSensorSource]}>{sensor.details}</Text>}
          </View>
        ))}
      </View>
    </View>
  );
}
