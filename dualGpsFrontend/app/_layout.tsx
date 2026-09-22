import { AuthProvider, useAuth } from "@/lib/auth-context";
import { GpsProvider } from "@/lib/gps-context";
import {
  Stack,
  useNavigationContainerRef,
  useRouter,
  useSegments,
} from "expo-router";
import { useEffect } from "react";

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
        <Stack>
          <Stack.Screen
            name="(tabs)"
            options={{
              headerShown: false,
            }}
          />
        </Stack>
      </RouteGuard>
    </GpsProvider>
  );
}
