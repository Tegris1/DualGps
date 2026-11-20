import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { Pressable, StyleSheet, Text } from "react-native";

type Props = {
  onPress: () => void;
  accessibilityLabel?: string;
  color?: string;
};

export function ReturnButton({ onPress, accessibilityLabel = "Powrót do pulpitu", color = "#12364b" }: Props) {
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={accessibilityLabel} onPress={onPress} style={({ pressed }) => [styles.button, pressed && styles.pressed]}>
      <MaterialIcons name="arrow-back" size={22} color={color} />
      <Text style={[styles.label, { color }]}>Powrót</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: { alignSelf: "flex-start", minHeight: 44, paddingHorizontal: 16, flexDirection: "row", alignItems: "center", gap: 8 },
  label: { color: "#12364b", fontSize: 14, fontWeight: "700" },
  pressed: { opacity: 0.65 },
});
