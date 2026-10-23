import { Pressable, StyleSheet, Text, type StyleProp, type ViewStyle } from "react-native";

import { terrainColors } from "../theme";

type TerrainButtonProps = {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  variant?: "primary" | "secondary";
  style?: StyleProp<ViewStyle>;
};

export function TerrainButton({ label, onPress, disabled = false, variant = "primary", style }: TerrainButtonProps) {
  const secondary = variant === "secondary";
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        secondary ? styles.secondary : styles.primary,
        style,
        pressed && styles.pressed,
        disabled && styles.disabled,
      ]}
    >
      <Text style={secondary ? styles.secondaryText : styles.primaryText}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: { alignItems: "center", justifyContent: "center", borderRadius: 8 },
  primary: { minHeight: 48, backgroundColor: terrainColors.primary },
  primaryText: { color: terrainColors.surface, fontWeight: "700", fontSize: 16 },
  secondary: { flex: 1, minHeight: 44, paddingHorizontal: 8, backgroundColor: terrainColors.control },
  secondaryText: { color: terrainColors.controlText, fontWeight: "600", fontSize: 12 },
  pressed: { opacity: 0.7 },
  disabled: { opacity: 0.4 },
});
