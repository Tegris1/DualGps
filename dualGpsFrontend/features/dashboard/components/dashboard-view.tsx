import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { StatusBar } from "expo-status-bar";
import { Pressable, ScrollView, Text, View, useWindowDimensions } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { dashboardColors, dashboardStyles as styles } from "../styles";
import type { DashboardViewModel } from "../types";
import { BucketCrossSection } from "./bucket-cross-section";
import { DashboardToolbar } from "./dashboard-toolbar";
import { HeightDifferenceCard } from "./height-difference-card";
import { MachineInclinationCard } from "./machine-inclination-card";
import { SensorStatusCard } from "./sensor-status-card";

type DashboardViewProps = {
  data: DashboardViewModel;
  onSignOut: () => void;
};

export function DashboardView({ data, onSignOut }: DashboardViewProps) {
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
          <View style={styles.workspacePanel}>
            <Text style={styles.panelHeading}>TEREN 3D</Text>
            <View style={styles.placeholder}>
              <MaterialIcons name="terrain" size={52} color={dashboardColors.muted} />
              <Text style={styles.placeholderText}>Miejsce na podgląd terenu i koparki.</Text>
            </View>
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
