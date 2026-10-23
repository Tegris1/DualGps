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
import type { ConnectionAction, ReceiverDevice, StatusBanner } from "@/features/gps/presentation/types";
import type { ReceiverModel } from "@/lib/gps/receiver-profiles";

import {
  ActionButton,
  InfoBanner,
  PrimaryButton,
  SectionIntro,
} from "./settings-controls";
import { styles } from "./styles";
import { SettingsCard } from "./settings-card";

type BluetoothSettingsProps = {
  devices: readonly ReceiverDevice[];
  selectedAddress: string | null;
  connectedAddress: string | null;
  receiverModel: ReceiverModel | null;
  profileDisabled: boolean;
  deviceSelectionDisabled: boolean;
  isConnected: boolean;
  isRefreshing: boolean;
  connectAction: ConnectionAction;
  connectionBanner: StatusBanner;
  ntripBanner: StatusBanner | null;
  onRefresh: () => void;
  onSelectDevice: (address: string) => void;
  onSelectReceiverModel: (model: ReceiverModel) => void;
  onConnect: () => void;
  onDisconnect: () => void;
  onOpenDebug: () => void;
};

export function BluetoothSettings({
  devices,
  selectedAddress,
  connectedAddress,
  receiverModel,
  profileDisabled,
  deviceSelectionDisabled,
  isConnected,
  isRefreshing,
  connectAction,
  connectionBanner,
  ntripBanner,
  onRefresh,
  onSelectDevice,
  onSelectReceiverModel,
  onConnect,
  onDisconnect,
  onOpenDebug,
}: BluetoothSettingsProps) {
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
          disabled={profileDisabled}
          onChange={onSelectReceiverModel}
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
            onPress={onRefresh}
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
          connectedAddress={connectedAddress}
          disabled={deviceSelectionDisabled}
          onSelect={onSelectDevice}
        />
      </SettingsCard>

      <InfoBanner
        variant={connectionBanner.variant}
        message={connectionBanner.message}
      />

      {ntripBanner && (
        <InfoBanner
          variant={ntripBanner.variant}
          message={ntripBanner.message}
        />
      )}

      {isConnected ? (
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
            onPress={onDisconnect}
          />
        </View>
      ) : (
        <PrimaryButton
          disabled={connectAction.disabled}
          loading={connectAction.loading}
          icon="bluetooth-connected"
          label={connectAction.label}
          onPress={onConnect}
        />
      )}
    </ScrollView>
  );
}
