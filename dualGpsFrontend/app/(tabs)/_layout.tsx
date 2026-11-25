import { useAuth } from "@/features/auth/auth-context";
import { GpsProvider } from "@/features/gps/gps-context";
import { TerrainProjectProvider } from "@/features/terrain/project-context";
import { Tabs } from "expo-router";

export default function TabLayout() {
  const { user } = useAuth();

  return (
    <GpsProvider key={user?.email}>
      <TerrainProjectProvider>
        <Tabs tabBar={() => null} screenOptions={{ headerShown: false }}>
          <Tabs.Screen name="index" />
          <Tabs.Screen name="settings" />
        </Tabs>
      </TerrainProjectProvider>
    </GpsProvider>
  );
}
