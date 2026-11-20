import { useState } from "react";
import { ScrollView, Text, View, Pressable } from "react-native";

import { ActionButton, InfoBanner, PrimaryButton, SectionIntro } from "@/components/ui/form-controls";
import { ReceiverDeviceList } from "@/features/gps/components/receiver-device-list";
import { SettingsCard } from "@/features/gps/components/settings/settings-card";
import { styles } from "@/features/gps/components/settings/styles";
import { IMU_SECTIONS, imuUuidFromName, type ImuSection } from "@/lib/imu/imu-protocol";
import type { ArmImuController } from "./use-arm-imus";

const labels = { boom: "Boom / Wysięgnik", arm: "Arm / Ramię", bucket: "Bucket / Łyżka" };

export function ImuSettings({ controller }: { controller: ArmImuController }) {
  const [section, setSection] = useState<ImuSection>("boom");
  const sensor = controller.sensors.find((value) => value.section === section)!;
  const devices = sensor.devices.filter((device) => {
    const uuid = imuUuidFromName(device.name);
    return uuid && !controller.sensors.some((other) => other.section !== section && other.binding?.uuid === uuid);
  });
  const canConnect = sensor.assignmentReady && !sensor.isConnecting && !sensor.connectedDevice && devices.some((device) => device.address === sensor.selectedAddress);
  const reading = sensor.reading;
  const status = !sensor.connectedDevice ? "Disconnected" : sensor.error ?? (!sensor.fresh ? "Waiting for current sensor data"
    : reading?.status === "calibrating" ? "Keep the arm still while the gyroscope calibrates"
    : reading?.status === "sensor-error" ? "MPU6050 not responding; check the sensor wiring"
    : reading?.status === "unreliable" ? "Inclination temporarily unavailable"
    : `Inclination: ${reading!.angle!.toFixed(1)}°`);

  return (
    <ScrollView style={styles.page} contentContainerStyle={styles.content}>
      <SectionIntro icon="sensors" title="Arm IMU sensors" description="Select a section, then assign any paired ESP32 sensor by its UUID. All boards use the same firmware." />
      <View style={styles.actionRow} accessibilityRole="radiogroup" accessibilityLabel="Arm section">
        {IMU_SECTIONS.map((id) => <Pressable key={id} accessibilityRole="radio" accessibilityLabel={id}
          accessibilityState={{ checked: section === id }} onPress={() => setSection(id)}
          style={[styles.tab, section === id && styles.tabActive]}>
          <Text style={[styles.tabLabel, section === id && styles.tabLabelActive]}>{id}</Text>
        </Pressable>)}
      </View>
      {controller.assignmentError && <InfoBanner variant="error" message={controller.assignmentError} />}
      <SettingsCard title={labels[section]} caption={sensor.binding ? `Assigned UUID: ${sensor.binding.uuid}` : "No sensor assigned"}>
        <Text>{status}</Text>
        {reading && <>
          <Text selectable>Sensor UUID: {reading.uuid}</Text>
          <Text>Acceleration [g]: {reading.accel.map((value) => value.toFixed(3)).join(", ")}</Text>
          <Text>Gyroscope [°/s]: {reading.gyro.map((value) => value.toFixed(2)).join(", ")}</Text>
        </>}
      </SettingsCard>
      <SettingsCard title="Paired sensors" caption="Choose a UUID for this section. Sensors assigned to other sections are hidden.">
        <ReceiverDeviceList devices={devices} selectedAddress={sensor.selectedAddress}
          connectedAddress={sensor.connectedDevice?.address} disabled={sensor.isConnecting}
          onSelect={sensor.selectDevice} />
      </SettingsCard>
      <ActionButton icon="refresh" label={sensor.isRefreshing ? "Refreshing…" : "Refresh sensors"}
        onPress={() => { if (!sensor.isRefreshing) void sensor.refreshDevices(); }} />
      <InfoBanner variant={sensor.error ? "error" : "info"} message={sensor.error ?? sensor.connectionMessage} />
      {sensor.connectedDevice || sensor.isConnecting ? <ActionButton danger icon="link-off"
        label={sensor.isConnecting ? "Cancel IMU connection" : "Disconnect IMU"} onPress={() => { void sensor.disconnect(); }} />
        : <PrimaryButton icon="bluetooth-connected" label="Assign and connect IMU" disabled={!canConnect}
          onPress={() => { if (canConnect) void sensor.connectSelected(); }} />}
      {sensor.binding && !sensor.connectedDevice && !sensor.isConnecting && <ActionButton icon="link-off"
        label="Clear assignment" onPress={() => { void sensor.clearAssignment(); }} />}
      <Text>{controller.pose ? "Three sensors ready — arm visualization is live." : "The arm needs three fresh, calibrated sensor readings."}</Text>
    </ScrollView>
  );
}
