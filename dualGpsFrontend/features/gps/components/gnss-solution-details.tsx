import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from "react-native";

import { fixLabel, type GgaFix, type GsaDop } from "@/lib/gps/nmea";

type GnssSolutionDetailsProps = {
  latestFix: GgaFix | null;
  gsaDop: GsaDop | null;
  latestLine?: string;
  showUtc?: boolean;
  style?: StyleProp<ViewStyle>;
};

function formatMeasurement(value: number | undefined, decimals: number, unit: string) {
  return value === undefined ? "—" : `${value.toFixed(decimals)}${unit}`;
}

export function GnssSolutionDetails({
  latestFix,
  gsaDop,
  latestLine,
  showUtc = false,
  style,
}: GnssSolutionDetailsProps) {
  return (
    <View style={[styles.details, style]}>
      <Text>
        Fix: {latestFix ? `${fixLabel(latestFix.quality)} (${latestFix.quality})` : "Waiting for GGA"}
      </Text>
      <Text>Latitude: {formatMeasurement(latestFix?.latitude, 8, "°")}</Text>
      <Text>Longitude: {formatMeasurement(latestFix?.longitude, 8, "°")}</Text>
      <Text>Altitude (MSL): {formatMeasurement(latestFix?.altitude, 3, " m")}</Text>
      <Text>Satellites: {latestFix?.satellites ?? "—"}</Text>
      <Text>HDOP: {latestFix?.hdop ?? gsaDop?.hdop ?? "—"}</Text>
      <Text>VDOP: {gsaDop?.vdop ?? "—"}</Text>
      <Text>PDOP: {gsaDop?.pdop ?? "—"}</Text>
      {showUtc && <Text>UTC: {latestFix?.utcTime ?? "—"}</Text>}
      {latestLine !== undefined && <Text>Last sentence: {latestLine || "—"}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  details: { gap: 7 },
});
