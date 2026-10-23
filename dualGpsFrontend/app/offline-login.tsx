import { useState } from "react";
import { KeyboardAvoidingView, Platform, StyleSheet, Text, TextInput } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { OFFLINE_ACCOUNT, useOfflineSession } from "@/features/auth/offline-session-context";
import { TerrainButton } from "@/features/terrain/components/terrain-button";
import { TerrainHeader } from "@/features/terrain/components/terrain-header";
import { terrainColors, terrainTypography } from "@/features/terrain/theme";

export default function OfflineLogin() {
  const { signIn } = useOfflineSession();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  function submit() {
    setError(signIn(email, password) ? "" : "Incorrect email or password.");
  }
  return (
    <SafeAreaView style={styles.screen}>
      <StatusBar style="dark" />
      <KeyboardAvoidingView style={styles.content} behavior={Platform.OS === "ios" ? "padding" : "height"}>
        <TerrainHeader title="Sign in" description="Explore current and target terrain." />
        <Text style={styles.label}>Email</Text>
        <TextInput accessibilityLabel="Email" style={styles.input}
          value={email} onChangeText={setEmail} keyboardType="email-address"
          autoCapitalize="none" autoCorrect={false} autoComplete="off" />
        <Text style={styles.label}>Password</Text>
        <TextInput accessibilityLabel="Password" style={styles.input}
          value={password} onChangeText={setPassword} secureTextEntry
          autoCapitalize="none" autoCorrect={false} autoComplete="off"
          returnKeyType="go" onSubmitEditing={submit} />
        {!!error && <Text accessibilityRole="alert" style={styles.error}>{error}</Text>}
        <TerrainButton label="Sign in" onPress={submit} />
        <Text style={terrainTypography.caption}>Offline account</Text>
        <Text selectable style={styles.credentials}>{OFFLINE_ACCOUNT.email}{"\n"}{OFFLINE_ACCOUNT.password}</Text>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: terrainColors.background },
  content: { flex: 1, justifyContent: "center", padding: 24, gap: 12 },
  label: { fontSize: 14, fontWeight: "600", color: terrainColors.controlText },
  input: { minHeight: 48, padding: 12, borderWidth: 1, borderColor: terrainColors.border, borderRadius: 8, color: terrainColors.text, backgroundColor: terrainColors.surface },
  error: { color: terrainColors.error, fontSize: 14 },
  credentials: { fontSize: 14, color: terrainColors.controlText, lineHeight: 22 },
});
