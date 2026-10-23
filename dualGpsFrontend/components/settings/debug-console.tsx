import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { useRef } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";

import { GnssSolutionDetails } from "@/components/gps/gnss-solution-details";
import type { ConnectionAction, DiagnosticRow } from "@/features/gps/presentation/types";
import type { GgaFix, GsaDop } from "@/lib/gps/nmea";
import type { ConsoleEntry } from "@/lib/gps/types";

import { SectionIntro } from "./settings-controls";
import { styles } from "./styles";
import { SettingsCard } from "./settings-card";

type DebugConsoleProps = {
  isConnected: boolean;
  deviceName: string;
  connectionAction: ConnectionAction;
  showDevicePrompt: boolean;
  latestFix: GgaFix | null;
  gsaDop: GsaDop | null;
  latestLine: string;
  ntripDetails: readonly DiagnosticRow[];
  consoleEntries: readonly ConsoleEntry[];
  onConnectionAction: () => void;
  onClearConsole: () => void;
  onSelectDevice: () => void;
};

export function DebugConsole({
  isConnected,
  deviceName,
  connectionAction,
  showDevicePrompt,
  latestFix,
  gsaDop,
  latestLine,
  ntripDetails,
  consoleEntries,
  onConnectionAction,
  onClearConsole,
  onSelectDevice,
}: DebugConsoleProps) {
  const consoleRef = useRef<ScrollView>(null);

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
          {ntripDetails.map(({ label, value }) => (
            <Text key={label}>{label}: {value}</Text>
          ))}
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
              isConnected && styles.connectionIndicatorOnline,
            ]}
          />
          <View style={styles.debugDeviceCopy}>
            <Text style={styles.debugDeviceLabel}>DATA SOURCE</Text>
            <Text style={styles.debugDeviceName} numberOfLines={1}>
              {deviceName}
            </Text>
          </View>
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={connectionAction.label}
          disabled={connectionAction.disabled}
          onPress={onConnectionAction}
          style={({ pressed }) => [
            styles.compactButton,
            connectionAction.disabled && styles.buttonDisabled,
            pressed && styles.pressed,
          ]}
        >
          <Text style={styles.compactButtonText}>
            {connectionAction.label}
          </Text>
        </Pressable>
      </View>

      {showDevicePrompt && (
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
                isConnected && styles.consoleLiveDotActive,
              ]}
            />
            <Text style={styles.consoleTitle}>
              {isConnected ? "LIVE STREAM" : "STREAM PAUSED"}
            </Text>
          </View>
          <Pressable
            disabled={!consoleEntries.length}
            hitSlop={8}
            onPress={onClearConsole}
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
