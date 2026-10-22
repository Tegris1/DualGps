import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { useRef } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";

import { GnssSolutionDetails } from "@/components/gps/gnss-solution-details";
import type { BluetoothSerialController } from "@/hooks/use-bluetooth-serial";

import { SectionIntro } from "./settings-controls";
import { styles } from "./styles";
import { SettingsCard } from "./settings-card";

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
    ntripStatus,
  } = bluetooth;

  return (
    <ScrollView
      contentContainerStyle={styles.debugContent}
      keyboardShouldPersistTaps="handled"
      nestedScrollEnabled
      showsVerticalScrollIndicator={false}
      style={styles.flex}
    >
      <SettingsCard title="GNSS solution" caption="Position and fix quality reported by the receiver">
        <GnssSolutionDetails
          latestFix={latestFix}
          gsaDop={gsaDop}
          latestLine={latestLine}
          style={{ marginTop: 14 }}
        />
      </SettingsCard>
      <SettingsCard title="NTRIP corrections">
        <View style={{ gap: 7, marginTop: 14 }}>
          <Text>State: {ntripStatus.state}</Text>

          <Text>Message: {ntripStatus.message ?? "—"}</Text>

          <Text>Correction bytes received: {ntripStatus.bytesReceived}</Text>

          <Text>
            Bytes written to receiver: {ntripStatus.bytesSentToReceiver}
          </Text>

          <Text>Valid RTCM frames: {ntripStatus.rtcm.validFrames}</Text>

          <Text>Invalid RTCM frames: {ntripStatus.rtcm.invalidFrames}</Text>

          <Text>
            Last RTCM message: {ntripStatus.rtcm.lastMessageType ?? "—"}
          </Text>

          <Text>
            Last GGA written:{" "}
            {ntripStatus.lastGgaSentAt
              ? new Date(ntripStatus.lastGgaSentAt).toLocaleTimeString()
              : "Not sent yet"}
          </Text>
        </View>
      </SettingsCard>
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
