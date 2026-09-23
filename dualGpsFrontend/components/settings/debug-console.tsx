import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { useRef } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";

import type { BluetoothSerialController } from "@/hooks/use-bluetooth-serial";

import { SectionIntro } from "./settings-controls";
import { styles } from "./styles";

import { fixLabel } from "@/lib/gps/nmea";

export function DebugConsole({
  bluetooth,
  onSelectDevice,
}: {
  bluetooth: BluetoothSerialController;
  onSelectDevice: () => void;
}) {
  const consoleRef = useRef<ScrollView>(null);
  const {
    clearConsole,
    connectedDevice,
    connectSelected,
    consoleEntries,
    disconnect,
    gsaDop,
    isConnecting,
    latestFix,
    latestLine,
    selectedDevice,
  } = bluetooth;

  return (
    <ScrollView
      contentContainerStyle={styles.debugContent}
      keyboardShouldPersistTaps="handled"
      nestedScrollEnabled
      showsVerticalScrollIndicator={false}
      style={styles.flex}
    >
      <View style={styles.card}>
        <Text style={styles.cardTitle}>GNSS solution</Text>
        <Text style={styles.cardCaption}>
          Position and fix quality reported by the receiver
        </Text>

        <View style={{ gap: 7, marginTop: 14 }}>
          <Text>
            Fix:{" "}
            {latestFix
              ? `${fixLabel(latestFix.quality)} (${latestFix.quality})`
              : "Waiting for GGA"}
          </Text>

          <Text>
            Latitude:{" "}
            {latestFix?.latitude !== undefined
              ? `${latestFix.latitude.toFixed(8)}°`
              : "—"}
          </Text>

          <Text>
            Longitude:{" "}
            {latestFix?.longitude !== undefined
              ? `${latestFix.longitude.toFixed(8)}°`
              : "—"}
          </Text>

          <Text>
            Altitude:{" "}
            {latestFix?.altitude !== undefined
              ? `${latestFix.altitude.toFixed(3)} m`
              : "—"}
          </Text>

          <Text>Satellites: {latestFix?.satellites ?? "—"}</Text>
          <Text>HDOP: {latestFix?.hdop ?? gsaDop?.hdop ?? "—"}</Text>
          <Text>VDOP: {gsaDop?.vdop ?? "—"}</Text>
          <Text>PDOP: {gsaDop?.pdop ?? "—"}</Text>
          <Text>Last sentence: {latestLine || "—"}</Text>
        </View>
      </View>
      <SectionIntro
        icon="terminal"
        title="Serial monitor"
        description="Inspect raw NMEA and serial messages from the receiver."
      />

      <View style={styles.debugDeviceBar}>
        <View style={styles.debugDeviceInfo}>
          <View
            style={[
              styles.connectionIndicator,
              connectedDevice && styles.connectionIndicatorOnline,
            ]}
          />
          <View style={styles.debugDeviceCopy}>
            <Text style={styles.debugDeviceLabel}>DATA SOURCE</Text>
            <Text style={styles.debugDeviceName} numberOfLines={1}>
              {connectedDevice
                ? (connectedDevice.name ?? connectedDevice.address)
                : selectedDevice
                  ? (selectedDevice.name ?? selectedDevice.address)
                  : "No device selected"}
            </Text>
          </View>
        </View>
        <Pressable
          disabled={!connectedDevice && (!selectedDevice || isConnecting)}
          onPress={() =>
            void (connectedDevice ? disconnect() : connectSelected())
          }
          style={({ pressed }) => [
            styles.compactButton,
            !connectedDevice && !selectedDevice && styles.buttonDisabled,
            pressed && styles.pressed,
          ]}
        >
          <Text style={styles.compactButtonText}>
            {connectedDevice
              ? "Disconnect"
              : isConnecting
                ? "Connecting…"
                : "Connect"}
          </Text>
        </Pressable>
      </View>

      {!selectedDevice && !connectedDevice && (
        <Pressable onPress={onSelectDevice} style={styles.selectDevicePrompt}>
          <MaterialIcons name="bluetooth-searching" size={20} color="#0284C7" />
          <Text style={styles.selectDevicePromptText}>
            Select a Bluetooth device first
          </Text>
          <MaterialIcons name="chevron-right" size={20} color="#0284C7" />
        </Pressable>
      )}

      <View style={styles.consoleCard}>
        <View style={styles.consoleHeader}>
          <View style={styles.consoleTitleRow}>
            <View
              style={[
                styles.consoleLiveDot,
                connectedDevice && styles.consoleLiveDotActive,
              ]}
            />
            <Text style={styles.consoleTitle}>
              {connectedDevice ? "LIVE STREAM" : "STREAM PAUSED"}
            </Text>
          </View>
          <Pressable
            disabled={!consoleEntries.length}
            hitSlop={8}
            onPress={clearConsole}
          >
            <Text
              style={[
                styles.clearButtonText,
                !consoleEntries.length && styles.clearButtonDisabled,
              ]}
            >
              Clear
            </Text>
          </Pressable>
        </View>

        <ScrollView
          contentContainerStyle={styles.consoleBody}
          nestedScrollEnabled
          onContentSizeChange={() =>
            consoleRef.current?.scrollToEnd({ animated: true })
          }
          ref={consoleRef}
          showsVerticalScrollIndicator={false}
        >
          {consoleEntries.length ? (
            consoleEntries.map((entry) => (
              <View key={entry.id} style={styles.consoleLine}>
                <Text style={styles.consoleTime}>{entry.time}</Text>
                <Text selectable style={styles.consoleMessage}>
                  {entry.message}
                </Text>
              </View>
            ))
          ) : (
            <View style={styles.consoleEmpty}>
              <Text style={styles.consolePrompt}>&gt;_</Text>
              <Text style={styles.consoleEmptyTitle}>
                Waiting for serial data
              </Text>
              <Text style={styles.consoleEmptyText}>
                Connect a receiver to display incoming messages here.
              </Text>
            </View>
          )}
        </ScrollView>
      </View>

      <View style={styles.consoleFooter}>
        <Text style={styles.consoleFooterText}>
          {consoleEntries.length} lines buffered
        </Text>
        <Text style={styles.consoleFooterText}>Last 200 lines retained</Text>
      </View>
    </ScrollView>
  );
}
