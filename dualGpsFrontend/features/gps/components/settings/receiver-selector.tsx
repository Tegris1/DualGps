import { Pressable, Text, View } from "react-native";

import type { ReceiverSlot } from "@/features/gps/types";

import { styles } from "./styles";

export function ReceiverSelector({ value, onChange }: {
  value: ReceiverSlot;
  onChange: (slot: ReceiverSlot) => void;
}) {
  return (
    <View style={styles.tabs} accessibilityRole="radiogroup" accessibilityLabel="GPS receiver">
      {([1, 2] as const).map((slot) => (
        <Pressable
          key={slot}
          accessibilityRole="radio"
          accessibilityLabel={`GPS ${slot}`}
          accessibilityState={{ checked: value === slot }}
          onPress={() => onChange(slot)}
          style={({ pressed }) => [styles.tab, value === slot && styles.tabActive, pressed && styles.pressed]}
        >
          <Text style={[styles.tabLabel, value === slot && styles.tabLabelActive]}>GPS {slot}</Text>
        </Pressable>
      ))}
    </View>
  );
}
