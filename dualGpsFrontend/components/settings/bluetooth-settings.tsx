import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  Text,
  View,
} from "react-native";

import { ReceiverDeviceList } from "@/components/gps/receiver-device-list";
import { ReceiverProfileSelector } from "@/components/gps/receiver-profile-selector";
import type { BluetoothSerialController } from "@/hooks/use-bluetooth-serial";

import {
  ActionButton,
  InfoBanner,
  PrimaryButton,
  SectionIntro,
} from "./settings-controls";
import { styles } from "./styles";
import { SettingsCard } from "./settings-card";

export function BluetoothSettings({
  bluetooth,
  onOpenDebug,
}: {
  bluetooth: BluetoothSerialController;
  onOpenDebug: () => void;
}) {
  const {
    connectedDevice,
    connectionMessage,
    connectSelected,
    devices,
    disconnect,
    isConnecting,
    isRefreshing,
    ntripStatus,
    receiverModel,
    refreshDevices,
    selectedAddress,
    selectedDevice,
    selectDevice,
    selectReceiverModel,
  } = bluetooth;

  return (
    <ScrollView
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      <SectionIntro
        icon="bluetooth-searching"
        title="Bluetooth receiver"
        description="Select a paired GNSS receiver to start a serial connection."
      />

      <SettingsCard
        title="Receiver profile"
        caption="Select the receiver before connecting so its serial port is configured correctly."
      >
        <ReceiverProfileSelector
          value={receiverModel}
          disabled={!!connectedDevice}
          onChange={selectReceiverModel}
        />
      </SettingsCard>

      <SettingsCard
        title="Paired devices"
        caption="Classic Bluetooth devices"
        headerAction={
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Refresh paired devices"
            disabled={isRefreshing}
            onPress={() => void refreshDevices()}
            style={({ pressed }) => [
              styles.refreshButton,
              pressed && styles.pressed,
            ]}
          >
            {isRefreshing ? (
              <ActivityIndicator size="small" color="#0284C7" />
            ) : (
              <MaterialIcons name="refresh" size={20} color="#0284C7" />
            )}
            <Text style={styles.refreshButtonText}>Refresh</Text>
          </Pressable>
        }
      >
        <ReceiverDeviceList
          devices={devices}
          selectedAddress={selectedAddress}
          connectedAddress={connectedDevice?.address}
          onSelect={selectDevice}
        />
      </SettingsCard>

      <InfoBanner
        variant={connectedDevice ? "success" : "info"}
        message={connectionMessage}
      />

      {!!connectedDevice && (
        <InfoBanner
          variant={ntripStatus.state === "streaming" ? "success" : ntripStatus.state === "error" ? "error" : "info"}
          message={
            ntripStatus.state === "streaming"
              ? `${ntripStatus.message ?? "NTRIP corrections active"} ${ntripStatus.rtcm.validFrames} valid RTCM frames, ${ntripStatus.bytesSentToReceiver} bytes forwarded.`
              : (ntripStatus.message ?? "NTRIP is not connected.")
          }
        />
      )}

      {connectedDevice ? (
        <View style={styles.actionRow}>
          <ActionButton
            icon="terminal"
            label="Open console"
            onPress={onOpenDebug}
          />
          <ActionButton
            danger
            icon="link-off"
            label="Disconnect"
            onPress={() => void disconnect()}
          />
        </View>
      ) : (
        <PrimaryButton
          disabled={!selectedDevice || !receiverModel || isConnecting}
          loading={isConnecting}
          icon="bluetooth-connected"
          label={isConnecting ? "Connecting…" : "Connect selected device"}
          onPress={() => void connectSelected()}
        />
      )}
    </ScrollView>
  );
}
