import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  Text,
  View,
} from "react-native";

import type { BluetoothSerialController } from "@/hooks/use-bluetooth-serial";

import {
  ActionButton,
  InfoBanner,
  PrimaryButton,
  SectionIntro,
} from "./settings-controls";
import { styles } from "./styles";

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
    refreshDevices,
    selectedAddress,
    selectedDevice,
    selectDevice,
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

      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <View>
            <Text style={styles.cardTitle}>Paired devices</Text>
            <Text style={styles.cardCaption}>Classic Bluetooth devices</Text>
          </View>
          <Pressable
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
        </View>

        {devices.length === 0 ? (
          <View style={styles.emptyState}>
            <MaterialIcons name="devices" size={34} color="#94A3B8" />
            <Text style={styles.emptyStateTitle}>No devices loaded</Text>
            <Text style={styles.emptyStateText}>
              Tap Refresh to check receivers already paired with this device.
            </Text>
          </View>
        ) : (
          <View style={styles.deviceList}>
            {devices.map((device) => {
              const selected = device.address === selectedAddress;
              const connected = device.address === connectedDevice?.address;

              return (
                <Pressable
                  key={device.address}
                  onPress={() => selectDevice(device.address)}
                  style={({ pressed }) => [
                    styles.deviceRow,
                    selected && styles.deviceRowSelected,
                    pressed && styles.pressed,
                  ]}
                >
                  <View
                    style={[
                      styles.deviceIcon,
                      selected && styles.deviceIconSelected,
                    ]}
                  >
                    <MaterialIcons
                      name="gps-fixed"
                      size={22}
                      color={selected ? "#0284C7" : "#64748B"}
                    />
                  </View>
                  <View style={styles.deviceDetails}>
                    <Text style={styles.deviceName}>
                      {device.name ?? "Unnamed receiver"}
                    </Text>
                    <Text style={styles.deviceAddress}>{device.address}</Text>
                  </View>
                  {connected ? (
                    <View style={styles.connectedBadge}>
                      <View style={styles.connectedBadgeDot} />
                      <Text style={styles.connectedBadgeText}>Connected</Text>
                    </View>
                  ) : (
                    <MaterialIcons
                      name={
                        selected
                          ? "radio-button-checked"
                          : "radio-button-unchecked"
                      }
                      size={22}
                      color={selected ? "#0EA5E9" : "#CBD5E1"}
                    />
                  )}
                </Pressable>
              );
            })}
          </View>
        )}
      </View>

      <InfoBanner
        positive={!!connectedDevice}
        message={connectionMessage}
      />

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
          disabled={!selectedDevice || isConnecting}
          loading={isConnecting}
          icon="bluetooth-connected"
          label={isConnecting ? "Connecting…" : "Connect selected device"}
          onPress={() => void connectSelected()}
        />
      )}
    </ScrollView>
  );
}
