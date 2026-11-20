import { AuthProvider, useAuth } from "@/features/auth/auth-context";
import { GpsProvider } from "@/features/gps/gps-context";
import { OfflineSessionProvider, useOfflineSession } from "@/features/auth/offline-session-context";
import { TerrainProjectProvider, useTerrainProject } from "@/features/terrain/project-context";
import {
  Stack,
  useNavigationContainerRef,
  useRouter,
  useSegments,
} from "expo-router";
import { useEffect } from "react";

const OFFLINE_MODE = process.env.EXPO_PUBLIC_OFFLINE_MODE === "true";

function AppNavigator({ offlineSignedIn = false, hasCurrentTerrain = false }:
  { offlineSignedIn?: boolean; hasCurrentTerrain?: boolean }) {
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
      <Stack.Protected guard={!OFFLINE_MODE}>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="auth" />
        <Stack.Screen name="modal" />
      </Stack.Protected>
    </Stack>
  );
}

function RouteGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { user, isLoadingUser } = useAuth();
  const segments = useSegments();

  const navigationRef = useNavigationContainerRef();

  useEffect(() => {
    const inAuthGroup = segments[0] === "auth";
    const redirectToAuth = () => {
      if (navigationRef.isReady() && !user && !inAuthGroup && !isLoadingUser) {
        router.replace("/auth");
      } else if (
        navigationRef.isReady() &&
        user &&
        inAuthGroup &&
        !isLoadingUser
      ) {
        router.replace("/");
      }
    };

    const unsubscribe = navigationRef.addListener("ready", redirectToAuth);
    redirectToAuth();

    return unsubscribe;
  }, [isLoadingUser, navigationRef, router, segments, user]);
  return <>{children}</>;
}

export default function RootLayout() {
  if (OFFLINE_MODE) return <OfflineSessionProvider><OfflineApp /></OfflineSessionProvider>;

  return (
    <AuthProvider>
      <GpsApp />
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

function GpsApp() {
  const { user } = useAuth();

  return (
    <GpsProvider key={user?.email ?? "signed-out"}>
      <TerrainProjectProvider>
        <RouteGuard>
          <AppNavigator />
        </RouteGuard>
      </TerrainProjectProvider>
    </GpsProvider>
  );
}
