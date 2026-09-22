import { Button, Pressable, Text, View } from "react-native";

import { useGps } from "@/lib/gps-context";
import { fixLabel } from "@/lib/gps/nmea";

export default function ConnectionSetup() {
  const { bluetooth } = useGps();
  const {
    connectSelected,
    connectionMessage,
    devices,
    disconnect,
    gsaDop,
    latestFix,
    latestLine,
    ntripStatus,
    receiverModel,
    refreshDevices,
    selectDevice,
    selectReceiverModel,
  } = bluetooth;

  async function connect(address: string) {
    selectDevice(address);
    await connectSelected(address);
  }

  return (
    <View style={{ flex: 1, padding: 20, gap: 12 }}>
      <Button
        title="Find paired GPS receivers"
        onPress={() => void refreshDevices()}
      />

      {!receiverModel && (
        <View style={{ flexDirection: "row", gap: 8 }}>
          <View style={{ flex: 1 }}>
            <Button
              title="Use Topcon"
              onPress={() => selectReceiverModel("topcon")}
            />
          </View>
          <View style={{ flex: 1 }}>
            <Button
              title="Use Kolida"
              onPress={() => selectReceiverModel("kolida")}
            />
          </View>
        </View>
      )}

      {devices.map((device) => (
        <Pressable
          key={device.address}
          disabled={!receiverModel}
          onPress={() => void connect(device.address)}
        >
          <Text>
            {device.name ?? "Unnamed device"} — {device.address}
          </Text>
        </Pressable>
      ))}

      {!receiverModel && (
        <Text>Select a receiver profile before connecting.</Text>
      )}
      <Text>{connectionMessage}</Text>
      <Text>NTRIP: {ntripStatus.message ?? ntripStatus.state}</Text>
      <Text>Latest data: {latestLine || "Nothing received yet"}</Text>
      <Text>
        GPS fix: {latestFix ? fixLabel(latestFix.quality) : "Waiting for GGA"}
      </Text>
      {latestFix && (
        <View>
          <Text>Latitude: {latestFix.latitude?.toFixed(8) ?? "—"}°</Text>
          <Text>Longitude: {latestFix.longitude?.toFixed(8) ?? "—"}°</Text>
          <Text>Altitude (MSL): {latestFix.altitude?.toFixed(3) ?? "—"} m</Text>
          <Text>Satellites: {latestFix.satellites ?? "—"}</Text>
          <Text>HDOP: {latestFix.hdop ?? "—"}</Text>
          <Text>VDOP: {gsaDop?.vdop ?? "—"}</Text>
          <Text>PDOP: {gsaDop?.pdop ?? "—"}</Text>
          <Text>UTC: {latestFix.utcTime ?? "—"}</Text>
        </View>
      )}
      <Button title="Disconnect" onPress={() => void disconnect()} />
    </View>
  );
}
