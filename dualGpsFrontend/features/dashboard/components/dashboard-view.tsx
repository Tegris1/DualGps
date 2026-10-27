import type { ReactNode } from "react";
import { StatusBar } from "expo-status-bar";
import { Pressable, ScrollView, Text, View, useWindowDimensions } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { dashboardStyles as styles } from "../styles";
import type { DashboardViewModel } from "../types";
import { BucketCrossSection } from "./bucket-cross-section";
import { DashboardToolbar } from "./dashboard-toolbar";
import { HeightDifferenceCard } from "./height-difference-card";
import { MachineInclinationCard } from "./machine-inclination-card";
import { SensorStatusCard } from "./sensor-status-card";

type DashboardViewProps = {
  data: DashboardViewModel;
  terrain: ReactNode;
  onSignOut: () => void;
};

export function DashboardView({ data, terrain, onSignOut }: DashboardViewProps) {
  const { width, fontScale } = useWindowDimensions();
  const layout = width / fontScale >= 720 ? styles.row : styles.column;

  return (
    <SafeAreaView style={styles.screen} edges={["top", "left", "right"]}>
      <StatusBar style="light" />
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <Text style={styles.brand}>DUAL GPS</Text>
          <View style={styles.headerActions}>
            <Text style={styles.demoBadge}>{data.sourceLabel}</Text>
            <Pressable accessibilityRole="button" onPress={onSignOut} style={({ pressed }) => [styles.signOutButton, pressed && styles.pressed]}>
              <Text style={styles.signOut}>Wyloguj</Text>
            </Pressable>
          </View>
        </View>
        <View style={[styles.summary, layout]}>
          <HeightDifferenceCard heightDifference={data.heightDifference} heightDescription={data.heightDescription} heightDirection={data.heightDirection} />
          <MachineInclinationCard pitch={data.pitch} roll={data.roll} />
          <SensorStatusCard imuSummary={data.imuSummary} imus={data.imus} gnss={data.gnss} />
        </View>
        <View style={[styles.workspace, layout]}>
          <View style={[styles.workspacePanel, styles.terrainPanel]}>
            {terrain}
          </View>
          <View style={[styles.workspacePanel, styles.crossSectionPanel]}>
            <Text style={styles.panelHeading}>PRZEKRÓJ PRZEZ ŁYŻKĘ</Text>
            <BucketCrossSection model={data.crossSection} heightDifference={data.heightDifference} />
          </View>
        </View>
        <DashboardToolbar />
      </ScrollView>
    </SafeAreaView>
  );
}
