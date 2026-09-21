import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import type { ComponentProps } from "react";
import {
  ActivityIndicator,
  Pressable,
  Text,
  TextInput,
  View,
} from "react-native";

import { styles } from "./styles";

type IconName = keyof typeof MaterialIcons.glyphMap;

export function SectionIntro({
  icon,
  title,
  description,
}: {
  icon: IconName;
  title: string;
  description: string;
}) {
  return (
    <View style={styles.sectionIntro}>
      <View style={styles.sectionIcon}>
        <MaterialIcons name={icon} size={24} color="#0EA5E9" />
      </View>
      <View style={styles.sectionIntroText}>
        <Text style={styles.sectionTitle}>{title}</Text>
        <Text style={styles.sectionDescription}>{description}</Text>
      </View>
    </View>
  );
}

export function FormField({
  icon,
  label,
  ...props
}: ComponentProps<typeof TextInput> & {
  icon: IconName;
  label: string;
}) {
  return (
    <View style={styles.formGroup}>
      <Text style={styles.label}>{label}</Text>
      <View style={styles.inputShell}>
        <MaterialIcons name={icon} size={20} color="#64748B" />
        <TextInput
          autoCapitalize="none"
          autoCorrect={false}
          placeholderTextColor="#94A3B8"
          style={styles.input}
          {...props}
        />
      </View>
    </View>
  );
}

export function InfoBanner({
  positive,
  message,
}: {
  positive: boolean;
  message: string;
}) {
  return (
    <View style={styles.infoBanner}>
      <MaterialIcons
        name={positive ? "check-circle" : "info-outline"}
        size={20}
        color={positive ? "#059669" : "#64748B"}
      />
      <Text style={styles.infoBannerText}>{message}</Text>
    </View>
  );
}

export function PrimaryButton({
  disabled,
  loading,
  icon,
  label,
  onPress,
}: {
  disabled?: boolean;
  loading?: boolean;
  icon: IconName;
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      disabled={disabled || loading}
      onPress={onPress}
      style={({ pressed }) => [
        styles.primaryButton,
        (disabled || loading) && styles.buttonDisabled,
        pressed && styles.pressed,
      ]}
    >
      {loading ? (
        <ActivityIndicator size="small" color="#FFFFFF" />
      ) : (
        <MaterialIcons name={icon} size={20} color="#FFFFFF" />
      )}
      <Text style={styles.primaryButtonText}>{label}</Text>
    </Pressable>
  );
}

export function ActionButton({
  danger,
  icon,
  label,
  onPress,
}: {
  danger?: boolean;
  icon: IconName;
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        danger ? styles.dangerButton : styles.secondaryButton,
        pressed && styles.pressed,
      ]}
    >
      <MaterialIcons
        name={icon}
        size={19}
        color={danger ? "#DC2626" : "#0F172A"}
      />
      <Text
        style={danger ? styles.dangerButtonText : styles.secondaryButtonText}
      >
        {label}
      </Text>
    </Pressable>
  );
}
