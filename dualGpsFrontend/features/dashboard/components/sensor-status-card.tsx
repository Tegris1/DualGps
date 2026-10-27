import { Text, View } from "react-native";

import { dashboardStyles as styles } from "../styles";
import type { DashboardViewModel } from "../types";

export function SensorStatusCard({ imuSummary, imus, gnss }: Pick<DashboardViewModel, "imuSummary" | "imus" | "gnss">) {
  return (
    <View style={[styles.summaryCard, styles.sensorCard]}>
      <Text style={styles.cardTitle}>IMU: {imuSummary} · DEMO / GNSS</Text>
      <View style={styles.sensorGrid}>
        {imus.map((sensor) => (
          <View key={sensor.id} style={styles.sensorCell} accessible accessibilityLabel={`${sensor.label}: ${sensor.statusText}, dane przykładowe`}>
            <View style={[styles.sensorDot, styles.demoSensorDot]} />
            <Text style={styles.sensorLabel}>{sensor.label}: {sensor.statusText}</Text>
          </View>
        ))}
      </View>
      <View style={styles.gnssRow}>
        {gnss.map((sensor) => (
          <View key={sensor.id} style={styles.gnssSensor} accessible accessibilityLabel={`${sensor.label}: ${sensor.statusText}. ${sensor.source === "demo" ? "Dane przykładowe" : "Status odbiornika"}. ${sensor.details ?? ""}`}>
            <Text style={[styles.gnssLabel, sensor.tone === "success" ? styles.gnssSuccess : sensor.tone === "warning" ? styles.gnssWarning : styles.gnssMuted]}>{sensor.label}: {sensor.statusText}</Text>
            <Text style={styles.sensorSource}>{sensor.source === "demo" ? "DEMO" : "ODBIORNIK"}</Text>
            {sensor.details && <Text style={styles.sensorSource}>{sensor.details}</Text>}
          </View>
        ))}
      </View>
    </View>
  );
}
