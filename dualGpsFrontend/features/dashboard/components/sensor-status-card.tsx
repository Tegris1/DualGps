import { Text, View } from "react-native";

import { dashboardStyles as styles } from "../styles";
import type { DashboardViewModel } from "../types";

export function SensorStatusCard({ imuSummary, imus, gnss, compact = false }: Pick<DashboardViewModel, "imuSummary" | "imus" | "gnss"> & { compact?: boolean }) {
  return (
    <View style={[styles.summaryCard, styles.sensorCard, compact && styles.compactSummaryCard]}>
      <Text style={[styles.cardTitle, compact && styles.compactCardTitle]}>IMU: {imuSummary} · DEMO / GNSS</Text>
      <View style={[styles.sensorGrid, compact && styles.compactSensorGrid]}>
        {imus.map((sensor) => (
          <View key={sensor.id} style={[styles.sensorCell, compact && styles.compactSensorCell]} accessible accessibilityLabel={`${sensor.label}: ${sensor.statusText}, dane przykładowe`}>
            <View style={[styles.sensorDot, styles.demoSensorDot]} />
            <Text style={[styles.sensorLabel, compact && styles.compactSensorLabel]}>{sensor.label}: {sensor.statusText}</Text>
          </View>
        ))}
      </View>
      <View style={styles.gnssRow}>
        {gnss.map((sensor) => (
          <View key={sensor.id} style={styles.gnssSensor} accessible accessibilityLabel={`${sensor.label}: ${sensor.statusText}. ${sensor.source === "demo" ? "Dane przykładowe" : "Status odbiornika"}. ${sensor.details ?? ""}`}>
            <Text style={[styles.gnssLabel, compact && styles.compactSensorLabel, sensor.tone === "success" ? styles.gnssSuccess : sensor.tone === "warning" ? styles.gnssWarning : styles.gnssMuted]}>{sensor.label}: {sensor.statusText}</Text>
            <Text style={[styles.sensorSource, compact && styles.compactSensorSource]}>{sensor.source === "demo" ? "DEMO" : "ODBIORNIK"}</Text>
            {sensor.details && <Text style={[styles.sensorSource, compact && styles.compactSensorSource]}>{sensor.details}</Text>}
          </View>
        ))}
      </View>
    </View>
  );
}
