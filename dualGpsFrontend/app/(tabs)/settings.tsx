import { useState } from "react";
import { KeyboardAvoidingView, Platform } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import {
  BluetoothSettings,
  DebugConsole,
  EuposSettings,
  SettingsHeader,
  SettingsTabs,
  styles,
  type SettingsSection,
} from "@/components/settings";
import { useGps } from "@/lib/gps-context";

export default function SettingsScreen() {
  const [activeSection, setActiveSection] =
    useState<SettingsSection>("bluetooth");
  const { bluetooth, eupos } = useGps();

  return (
    <SafeAreaView style={styles.safeArea} edges={["top"]}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <SettingsHeader isGpsOnline={!!bluetooth.connectedDevice} />
        <SettingsTabs
          activeTab={activeSection}
          onChange={setActiveSection}
        />

        {activeSection === "bluetooth" && (
          <BluetoothSettings
            bluetooth={bluetooth}
            onOpenDebug={() => setActiveSection("debug")}
          />
        )}
        {activeSection === "eupos" && <EuposSettings controller={eupos} />}
        {activeSection === "debug" && (
          <DebugConsole
            bluetooth={bluetooth}
            onSelectDevice={() => setActiveSection("bluetooth")}
          />
        )}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
