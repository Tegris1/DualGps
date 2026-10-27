import { useEffect, useRef, type ReactNode } from "react";
import { StatusBar } from "expo-status-bar";
import { ScrollView, Text, View, useWindowDimensions } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { dashboardStyles as styles } from "../styles";
import type { DashboardViewModel } from "../types";
import { BucketCrossSection } from "./bucket-cross-section";
import { HeightDifferenceCard } from "./height-difference-card";
import { MachineInclinationCard } from "./machine-inclination-card";
import { SensorStatusCard } from "./sensor-status-card";

type DashboardViewProps = {
  data: DashboardViewModel;
  terrain: ReactNode;
  toolbar: ReactNode;
  focusTerrain: boolean;
  menu: ReactNode;
};

export function DashboardView({ data, terrain, toolbar, focusTerrain, menu }: DashboardViewProps) {
  const { width, fontScale } = useWindowDimensions();
  const layout = width / fontScale >= 720 ? styles.row : styles.column;
  const scroll = useRef<ScrollView>(null);
  const terrainOffset = useRef(0);

  useEffect(() => {
    if (focusTerrain) scroll.current?.scrollTo({ y: terrainOffset.current, animated: true });
  }, [focusTerrain]);

  return (
    <SafeAreaView style={styles.screen}>
      <StatusBar style="light" />
      <ScrollView ref={scroll} contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <Text style={styles.brand}>DUAL GPS</Text>
          <Text style={styles.demoBadge}>{data.sourceLabel}</Text>
        </View>
        <View style={[styles.summary, layout]}>
          <HeightDifferenceCard heightDifference={data.heightDifference} heightDescription={data.heightDescription} heightDirection={data.heightDirection} />
          <MachineInclinationCard pitch={data.pitch} roll={data.roll} />
          <SensorStatusCard imuSummary={data.imuSummary} imus={data.imus} gnss={data.gnss} />
        </View>
        <View style={[styles.workspace, layout]} onLayout={(event) => { terrainOffset.current = event.nativeEvent.layout.y; }}>
          <View style={[styles.workspacePanel, styles.terrainPanel, focusTerrain && styles.terrainPanelExpanded]}>
            {terrain}
          </View>
          <View style={[styles.workspacePanel, styles.crossSectionPanel]}>
            <Text style={styles.panelHeading}>PRZEKRÓJ PRZEZ ŁYŻKĘ</Text>
            <BucketCrossSection model={data.crossSection} heightDifference={data.heightDifference} />
          </View>
        </View>
      </ScrollView>
      <View style={styles.toolbarContainer}>{toolbar}</View>
      {menu}
    </SafeAreaView>
  );
}
