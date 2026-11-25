import { AuthProvider, useAuth } from "@/features/auth/auth-context";
import { OfflineSessionProvider, useOfflineSession } from "@/features/auth/offline-session-context";
import type { UserRole } from "@/features/auth/session-role";
import { TerrainProjectProvider, useTerrainProject } from "@/features/terrain/project-context";
import { terrainColors } from "@/features/terrain/theme";
import { Stack } from "expo-router";
import { ActivityIndicator, StyleSheet, View } from "react-native";

const OFFLINE_MODE = process.env.EXPO_PUBLIC_OFFLINE_MODE === "true";

function AppNavigator({ offlineSignedIn = false, hasCurrentTerrain = false, role = null }:
  { offlineSignedIn?: boolean; hasCurrentTerrain?: boolean; role?: UserRole | null }) {
  return (
    <Stack>
      <Stack.Protected guard={OFFLINE_MODE && !offlineSignedIn}>
        <Stack.Screen name="offline-login" options={{ headerShown: false }} />
      </Stack.Protected>
      <Stack.Protected guard={OFFLINE_MODE && offlineSignedIn}>
        <Stack.Screen name="current-terrain" options={{ headerShown: false }} />
      </Stack.Protected>
      <Stack.Protected guard={OFFLINE_MODE && offlineSignedIn && hasCurrentTerrain}>
        <Stack.Screen name="target-terrain" options={{ headerShown: false }} />
      </Stack.Protected>
      <Stack.Protected guard={OFFLINE_MODE && offlineSignedIn}>
        <Stack.Screen name="terrain-preview" options={{ headerShown: false }} />
      </Stack.Protected>
      <Stack.Protected guard={!OFFLINE_MODE && role === null}>
        <Stack.Screen name="auth" options={{ headerShown: false }} />
      </Stack.Protected>
      <Stack.Protected guard={!OFFLINE_MODE && role === "ARCHITECT"}>
        <Stack.Screen name="terrain-files" options={{ headerShown: false }} />
      </Stack.Protected>
      <Stack.Protected guard={!OFFLINE_MODE && (role === "OPERATOR" || role === "ADMIN")}>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="modal" />
      </Stack.Protected>
    </Stack>
  );
}

export default function RootLayout() {
  if (OFFLINE_MODE) return <OfflineSessionProvider><OfflineApp /></OfflineSessionProvider>;

  return (
    <AuthProvider>
      <OnlineApp />
    </AuthProvider>
  );
}

function OfflineApp() {
  const { isSignedIn } = useOfflineSession();
  // A fresh project per session prevents selection leaking across sign-outs.
  return <TerrainProjectProvider key={String(isSignedIn)}><OfflineNavigation signedIn={isSignedIn} /></TerrainProjectProvider>;
}

function OfflineNavigation({ signedIn }: { signedIn: boolean }) {
  const { currentTerrain } = useTerrainProject();
  return <AppNavigator offlineSignedIn={signedIn} hasCurrentTerrain={!!currentTerrain} />;
}

function OnlineApp() {
  const { user, isLoadingUser } = useAuth();

  if (isLoadingUser) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator color={terrainColors.primary} accessibilityLabel="Restoring session" />
      </View>
    );
  }

  return <AppNavigator role={user?.role ?? null} />;
}

const styles = StyleSheet.create({
  loading: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: terrainColors.background },
});
