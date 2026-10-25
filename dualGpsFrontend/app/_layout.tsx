import { AuthProvider, useAuth } from "@/lib/auth-context";
import { GpsProvider } from "@/lib/gps-context";
import {
  Stack,
  useNavigationContainerRef,
  useRouter,
  useSegments,
} from "expo-router";
import { useEffect } from "react";

const DEMO_MODE = process.env.EXPO_PUBLIC_DEMO_MODE === "true";

function AppNavigator() {
  return (
    <Stack>
      <Stack.Protected guard={DEMO_MODE}>
        <Stack.Screen name="demo-preview" options={{ headerShown: false }} />
      </Stack.Protected>
      <Stack.Protected guard={!DEMO_MODE}>
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
  if (DEMO_MODE) return <AppNavigator />;

  return (
    <AuthProvider>
      <GpsApp />
    </AuthProvider>
  );
}

function GpsApp() {
  const { user } = useAuth();

  return (
    <GpsProvider key={user?.email ?? "signed-out"}>
      <RouteGuard>
        <AppNavigator />
      </RouteGuard>
    </GpsProvider>
  );
}
