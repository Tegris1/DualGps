import { useState } from "react";
import { KeyboardAvoidingView, Platform, Pressable, StyleSheet, Text, TextInput } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { DEMO_ACCOUNT, useDemoSession } from "@/features/demo/session-context";

export default function DemoLogin() {
  const { signIn } = useDemoSession();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  function submit() {
    setError(signIn(email, password) ? "" : "Incorrect demo email or password.");
  }
  return (
    <SafeAreaView style={styles.screen}>
      <StatusBar style="dark" />
      <KeyboardAvoidingView style={styles.content} behavior={Platform.OS === "ios" ? "padding" : "height"}>
        <Text style={styles.eyebrow}>DUAL GPS / DEMO</Text>
        <Text style={styles.title}>Sign in to the demo</Text>
        <Text style={styles.caption}>Explore current and target terrain.</Text>
        <Text style={styles.label}>Email</Text>
        <TextInput accessibilityLabel="Demo email" style={styles.input}
          value={email} onChangeText={setEmail} keyboardType="email-address"
          autoCapitalize="none" autoCorrect={false} autoComplete="off" />
        <Text style={styles.label}>Password</Text>
        <TextInput accessibilityLabel="Demo password" style={styles.input}
          value={password} onChangeText={setPassword} secureTextEntry
          autoCapitalize="none" autoCorrect={false} autoComplete="off"
          returnKeyType="go" onSubmitEditing={submit} />
        {!!error && <Text accessibilityRole="alert" style={styles.error}>{error}</Text>}
        <Pressable accessibilityRole="button" onPress={submit}
          style={({ pressed }) => [styles.button, pressed && { opacity: 0.7 }]}>
          <Text style={styles.buttonText}>Sign in</Text>
        </Pressable>
        <Text style={styles.caption}>Offline presentation account</Text>
        <Text selectable style={styles.credentials}>{DEMO_ACCOUNT.email}{"\n"}{DEMO_ACCOUNT.password}</Text>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#f8fafc" },
  content: { flex: 1, justifyContent: "center", padding: 24, gap: 12 },
  eyebrow: { fontSize: 11, fontWeight: "700", letterSpacing: 2, color: "#64748b" },
  title: { fontSize: 28, fontWeight: "700", color: "#0f172a" },
  caption: { fontSize: 14, color: "#64748b" },
  label: { fontSize: 14, fontWeight: "600", color: "#334155" },
  input: { minHeight: 48, padding: 12, borderWidth: 1, borderColor: "#cbd5e1", borderRadius: 8, color: "#0f172a", backgroundColor: "white" },
  error: { color: "#b91c1c", fontSize: 14 },
  button: { minHeight: 48, alignItems: "center", justifyContent: "center", borderRadius: 8, backgroundColor: "#0e7490" },
  buttonText: { color: "white", fontWeight: "700", fontSize: 16 },
  credentials: { fontSize: 14, color: "#334155", lineHeight: 22 },
});
