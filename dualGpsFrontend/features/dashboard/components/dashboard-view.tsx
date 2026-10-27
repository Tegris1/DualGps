import { useEffect, useRef, type ReactNode } from "react";
import { StatusBar } from "expo-status-bar";
import { ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { dashboardStyles as styles } from "../styles";
import type { DashboardViewModel } from "../types";
import type { DashboardLayout } from "../hooks/use-dashboard-layout";
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
  layout: DashboardLayout;
};

export function DashboardView({ data, terrain, toolbar, focusTerrain, menu, layout }: DashboardViewProps) {
  const direction = layout.wide ? styles.row : styles.column;
  const { compact } = layout;
  const scroll = useRef<ScrollView>(null);
  const terrainOffset = useRef(0);

  useEffect(() => {
    if (focusTerrain) scroll.current?.scrollTo({ y: terrainOffset.current, animated: true });
  }, [focusTerrain]);

  return (
    <SafeAreaView style={styles.screen}>
      <StatusBar style="light" />
      <ScrollView ref={scroll} contentContainerStyle={[styles.content, compact && styles.compactContent]}>
        <View style={[styles.header, compact && styles.compactHeader]}>
          <Text style={styles.brand}>DUAL GPS</Text>
          <Text style={styles.demoBadge}>{data.sourceLabel}</Text>
        </View>
        <View style={[styles.summary, direction]}>
          <HeightDifferenceCard compact={compact} heightDifference={data.heightDifference} heightDescription={data.heightDescription} heightDirection={data.heightDirection} />
          <MachineInclinationCard compact={compact} pitch={data.pitch} roll={data.roll} />
          <SensorStatusCard compact={compact} imuSummary={data.imuSummary} imus={data.imus} gnss={data.gnss} />
        </View>
        <View style={[styles.workspace, direction]} onLayout={(event) => { terrainOffset.current = event.nativeEvent.layout.y; }}>
          <View style={[
            styles.workspacePanel,
            styles.terrainPanel,
            compact && [styles.compactWorkspacePanel, { minHeight: layout.workspaceHeight }],
            focusTerrain && (compact ? styles.compactTerrainPanelExpanded : styles.terrainPanelExpanded),
          ]}>
            {terrain}
          </View>
          <View style={[styles.workspacePanel, styles.crossSectionPanel, compact && [styles.compactWorkspacePanel, { minHeight: layout.workspaceHeight }]]}>
            <Text style={[styles.panelHeading, compact && styles.compactCardTitle]}>PRZEKRÓJ PRZEZ ŁYŻKĘ{compact ? " · DEMO [m]" : ""}</Text>
            <BucketCrossSection compact={compact} plotHeight={layout.plotHeight} model={data.crossSection} heightDifference={data.heightDifference} />
          </View>
        </View>
      </ScrollView>
      <View style={[styles.toolbarContainer, compact && styles.compactToolbarContainer]}>{toolbar}</View>
      {menu}
    </SafeAreaView>
  );
}
