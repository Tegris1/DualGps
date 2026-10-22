import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { Pressable, StyleSheet, Text, View } from "react-native";

import type { ReceiverModel } from "@/lib/gps/receiver-profiles";

type ReceiverProfileSelectorProps = {
  value: ReceiverModel | null;
  disabled?: boolean;
  onChange: (model: ReceiverModel) => void;
};

export function ReceiverProfileSelector({ value, disabled = false, onChange }: ReceiverProfileSelectorProps) {
  return (
    <View>
      <View accessibilityRole="radiogroup" accessibilityLabel="Receiver profile" style={styles.profileRow}>
        {(["topcon", "kolida"] as const).map((model) => {
          const selected = value === model;
          return (
            <Pressable
              key={model}
              accessibilityRole="radio"
              accessibilityLabel={model === "topcon" ? "Topcon" : "Kolida"}
              accessibilityState={{ checked: selected, disabled }}
              disabled={disabled}
              onPress={() => onChange(model)}
              style={({ pressed }) => [
                styles.profileButton,
                selected && styles.profileButtonSelected,
                disabled && styles.disabled,
                pressed && styles.pressed,
              ]}
            >
              <MaterialIcons
                name={selected ? "radio-button-checked" : "radio-button-unchecked"}
                size={20}
                color={selected ? "#0284C7" : "#64748B"}
              />
              <Text style={[styles.profileButtonText, selected && styles.profileButtonTextSelected]}>
                {model === "topcon" ? "Topcon" : "Kolida"}
              </Text>
            </Pressable>
          );
        })}
      </View>
      {value === "kolida" && (
        <Text style={styles.profileHint}>
          Kolida automatic setup is not implemented; configure NMEA output and RTCM 3 input on the receiver first.
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  profileRow: { flexDirection: "row", gap: 8, marginTop: 14 },
  profileButton: {
    alignItems: "center", borderColor: "#CBD5E1", borderRadius: 10, borderWidth: 1,
    flex: 1, flexDirection: "row", gap: 8, justifyContent: "center", minHeight: 44,
  },
  profileButtonSelected: { backgroundColor: "#F0F9FF", borderColor: "#7DD3FC" },
  profileButtonText: { color: "#475569", fontSize: 13, fontWeight: "700" },
  profileButtonTextSelected: { color: "#0369A1" },
  profileHint: { color: "#64748B", fontSize: 12, lineHeight: 18, marginTop: 10 },
  disabled: { opacity: 0.45 },
  pressed: { opacity: 0.72 },
});
