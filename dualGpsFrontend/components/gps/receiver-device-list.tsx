import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { Pressable, StyleSheet, Text, View } from "react-native";

type ReceiverDevice = { address: string; name?: string | null };

type ReceiverDeviceListProps = {
  devices: readonly ReceiverDevice[];
  selectedAddress: string | null;
  connectedAddress?: string | null;
  disabled?: boolean;
  onSelect: (address: string) => void;
};

export function ReceiverDeviceList({
  devices,
  selectedAddress,
  connectedAddress,
  disabled = false,
  onSelect,
}: ReceiverDeviceListProps) {
  if (devices.length === 0) {
    return (
      <View style={styles.emptyState}>
        <MaterialIcons name="devices" size={34} color="#94A3B8" />
        <Text style={styles.emptyStateTitle}>No devices loaded</Text>
        <Text style={styles.emptyStateText}>
          Refresh the list to check receivers already paired with this device.
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.deviceList}>
      {devices.map((device) => {
        const selected = device.address === selectedAddress;
        const connected = device.address === connectedAddress;
        const name = device.name ?? "Unnamed receiver";

        return (
          <Pressable
            key={device.address}
            accessibilityRole="button"
            accessibilityLabel={`${name}, ${device.address}`}
            accessibilityState={{ selected, disabled }}
            disabled={disabled}
            onPress={() => onSelect(device.address)}
            style={({ pressed }) => [
              styles.deviceRow,
              selected && styles.deviceRowSelected,
              disabled && styles.disabled,
              pressed && styles.pressed,
            ]}
          >
            <View style={[styles.deviceIcon, selected && styles.deviceIconSelected]}>
              <MaterialIcons name="gps-fixed" size={22} color={selected ? "#0284C7" : "#64748B"} />
            </View>
            <View style={styles.deviceDetails}>
              <Text style={styles.deviceName}>{name}</Text>
              <Text style={styles.deviceAddress}>{device.address}</Text>
            </View>
            {connected ? (
              <View style={styles.connectedBadge}>
                <View style={styles.connectedBadgeDot} />
                <Text style={styles.connectedBadgeText}>Connected</Text>
              </View>
            ) : (
              <MaterialIcons
                name={selected ? "radio-button-checked" : "radio-button-unchecked"}
                size={22}
                color={selected ? "#0EA5E9" : "#CBD5E1"}
              />
            )}
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  emptyState: { alignItems: "center", paddingBottom: 12, paddingHorizontal: 20, paddingTop: 28 },
  emptyStateTitle: { color: "#334155", fontSize: 14, fontWeight: "700", marginTop: 8 },
  emptyStateText: { color: "#94A3B8", fontSize: 12, lineHeight: 18, marginTop: 4, textAlign: "center" },
  deviceList: { gap: 8, marginTop: 16 },
  deviceRow: {
    alignItems: "center", borderColor: "#E2E8F0", borderRadius: 12, borderWidth: 1,
    flexDirection: "row", padding: 12,
  },
  deviceRowSelected: { backgroundColor: "#F0F9FF", borderColor: "#7DD3FC" },
  deviceIcon: {
    alignItems: "center", backgroundColor: "#F1F5F9", borderRadius: 10,
    height: 40, justifyContent: "center", width: 40,
  },
  deviceIconSelected: { backgroundColor: "#E0F2FE" },
  deviceDetails: { flex: 1, marginHorizontal: 11 },
  deviceName: { color: "#1E293B", fontSize: 14, fontWeight: "700" },
  deviceAddress: { color: "#94A3B8", fontSize: 11, marginTop: 3 },
  connectedBadge: {
    alignItems: "center", backgroundColor: "#ECFDF5", borderRadius: 12,
    flexDirection: "row", gap: 5, paddingHorizontal: 8, paddingVertical: 5,
  },
  connectedBadgeDot: { backgroundColor: "#10B981", borderRadius: 3, height: 6, width: 6 },
  connectedBadgeText: { color: "#047857", fontSize: 10, fontWeight: "800" },
  disabled: { opacity: 0.45 },
  pressed: { opacity: 0.72 },
});
