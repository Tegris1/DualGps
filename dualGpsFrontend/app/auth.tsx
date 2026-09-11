import { useAuth } from "@/lib/auth-context";
import { useRouter } from "expo-router";
import { useState } from "react";
import { KeyboardAvoidingView, Platform, StyleSheet, View } from "react-native";
import { Button, Text, TextInput, useTheme } from "react-native-paper";

export default function AuthScreen() {
  const [isSignUp, setIsSignUp] = useState<boolean>(false);
  const [username, setUsername] = useState<string>("");
  const [email, setEmail] = useState<string>("");
  const [password, setPassword] = useState<string>("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const theme = useTheme();
  const router = useRouter();

  const { signIn, signUp } = useAuth();

  const handleAuth = async () => {
    if (isSignUp && !username.trim()) {
      setError("Please enter a username.");
      return;
    }

    if (!email || !password) {
      setError("Please fill in both email and password fields.");
      return;
    }

    if (password.length < 6) {
      setError("Password must be at least 6 characters long.");
      return;
    }
    setError(null);
    setIsSubmitting(true);

    const authError = isSignUp
      ? await signUp(username, email, password)
      : await signIn(email, password);

    setIsSubmitting(false);

    if (authError) {
      setError(authError);
    } else {
      router.replace("/");
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      style={styles.container}
    >
      <View style={styles.content}>
        <Text style={styles.title} variant="headlineMedium">
          {isSignUp ? "Create Account" : "Sign In"}
        </Text>

        {isSignUp && (
          <TextInput
            label="Username"
            placeholder="username"
            autoCapitalize="none"
            autoCorrect={false}
            mode="outlined"
            style={styles.input}
            value={username}
            onChangeText={setUsername}
          />
        )}

        <TextInput
          placeholder="eg@domain.com"
          label="Email"
          autoCapitalize="none"
          keyboardType="email-address"
          mode="outlined"
          style={styles.input}
          value={email}
          onChangeText={setEmail}
        />
        <TextInput
          placeholder="********"
          label="Password"
          secureTextEntry
          mode="outlined"
          style={styles.input}
          value={password}
          onChangeText={setPassword}
        />

        {error && <Text style={{ color: theme.colors.error }}>{error}</Text>}

        <Button
          mode="contained"
          style={styles.button}
          loading={isSubmitting}
          disabled={isSubmitting}
          onPress={handleAuth}
        >
          {isSignUp ? "Create Account" : "Sign In"}
        </Button>

        <Button
          mode="text"
          disabled={isSubmitting}
          onPress={() => {
            setIsSignUp((currentValue) => !currentValue);
            setError(null);
          }}
          style={styles.switchButton}
        >
          {isSignUp
            ? "Already have an account? Sign In"
            : "Don't have an account? Sign Up"}
        </Button>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f5f5f5",
  },
  content: {
    flex: 1,
    padding: 16,
    justifyContent: "center",
  },
  title: {
    fontSize: 24,
    fontWeight: "bold",
    marginBottom: 32,
    textAlign: "center",
  },
  input: {
    marginBottom: 16,
  },
  button: {
    marginTop: 16,
  },
  switchButton: {
    marginTop: 16,
    alignSelf: "center",
  },
});
