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
import { getEuposSaveFeedback } from "@/features/gps/presentation/eupos-feedback";
import { useReceiverControls } from "@/features/gps/hooks/use-receiver-controls";

export default function SettingsScreen() {
  const [activeSection, setActiveSection] =
    useState<SettingsSection>("bluetooth");
  const { eupos } = useGps();
  const receiver = useReceiverControls();
  const { connection } = receiver;

  return (
    <SafeAreaView style={styles.safeArea} edges={["top"]}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <SettingsHeader isGpsOnline={connection.isConnected} />
        <SettingsTabs
          activeTab={activeSection}
          onChange={setActiveSection}
        />

        {activeSection === "bluetooth" && (
          <BluetoothSettings
            devices={receiver.devices}
            selectedAddress={receiver.selectedAddress}
            connectedAddress={connection.connectedAddress}
            receiverModel={receiver.receiverModel}
            profileDisabled={!connection.canSelectProfile}
            deviceSelectionDisabled={!connection.canSelectDevice}
            isConnected={connection.isConnected}
            isRefreshing={receiver.isRefreshing}
            connectAction={connection.connectAction}
            connectionBanner={connection.connectionBanner}
            ntripBanner={connection.isConnected ? receiver.ntrip.banner : null}
            onRefresh={receiver.onRefresh}
            onSelectDevice={receiver.onSelectDevice}
            onSelectReceiverModel={receiver.onSelectReceiverModel}
            onConnect={receiver.onConnect}
            onDisconnect={receiver.onDisconnect}
            onOpenDebug={() => setActiveSection("debug")}
          />
        )}
        {activeSection === "eupos" && (
          <EuposSettings
            settings={eupos.settings}
            isSaving={eupos.isSaving}
            saveFeedback={getEuposSaveFeedback(eupos.saveResult)}
            onChange={eupos.update}
            onSave={eupos.save}
          />
        )}
        {activeSection === "debug" && (
          <DebugConsole
            isConnected={connection.isConnected}
            deviceName={connection.deviceName}
            connectionAction={connection.connectionAction}
            showDevicePrompt={connection.showDevicePrompt}
            latestFix={receiver.latestFix}
            gsaDop={receiver.gsaDop}
            latestLine={receiver.latestLine}
            ntripDetails={receiver.ntrip.details}
            consoleEntries={receiver.consoleEntries}
            onConnectionAction={receiver.onConnectionAction}
            onClearConsole={receiver.onClearConsole}
            onSelectDevice={() => setActiveSection("bluetooth")}
          />
        )}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
