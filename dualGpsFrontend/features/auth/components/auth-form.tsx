import { KeyboardAvoidingView, Platform, StyleSheet, View } from "react-native";
import { Button, Text, TextInput, useTheme } from "react-native-paper";

type AuthFormProps = {
  isSignUp: boolean;
  username: string;
  email: string;
  password: string;
  error: string | null;
  isSubmitting: boolean;
  onUsernameChange: (value: string) => void;
  onEmailChange: (value: string) => void;
  onPasswordChange: (value: string) => void;
  onSubmit: () => void;
  onToggleMode: () => void;
};

export function AuthForm({
  isSignUp,
  username,
  email,
  password,
  error,
  isSubmitting,
  onUsernameChange,
  onEmailChange,
  onPasswordChange,
  onSubmit,
  onToggleMode,
}: AuthFormProps) {
  const theme = useTheme();

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
            onChangeText={onUsernameChange}
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
          onChangeText={onEmailChange}
        />
        <TextInput
          placeholder="********"
          label="Password"
          secureTextEntry
          mode="outlined"
          style={styles.input}
          value={password}
          onChangeText={onPasswordChange}
        />

        {error && (
          <Text accessibilityRole="alert" style={{ color: theme.colors.error }}>
            {error}
          </Text>
        )}

        <Button
          mode="contained"
          style={styles.button}
          loading={isSubmitting}
          disabled={isSubmitting}
          onPress={onSubmit}
        >
          {isSignUp ? "Create Account" : "Sign In"}
        </Button>

        <Button
          mode="text"
          disabled={isSubmitting}
          onPress={onToggleMode}
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
