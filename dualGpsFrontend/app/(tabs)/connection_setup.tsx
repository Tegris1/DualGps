import { useEffect, useRef, useState } from "react";
import { Button, Pressable, Text, View } from "react-native";
import BluetoothClassic, {
  type BluetoothDevice,
  type BluetoothEventSubscription,
} from "react-native-bluetooth-classic";
import {
  fixLabel,
  parseGgaSentence,
  parseGsaSentence,
  type GgaFix,
  type GsaDop,
} from "@/lib/gps/nmea";
import { ensureBluetoothConnectPermission } from "@/utils/bluetoothPermisisons";

export default function ConnectionSetup() {
  const [devices, setDevices] = useState<BluetoothDevice[]>([]);
  const [status, setStatus] = useState("Not connected");
  const [latestLine, setLatestLine] = useState("");
  const [latestFix, setLatestFix] = useState<GgaFix | null>(null);
  const [gsaDop, setGsaDop] = useState<GsaDop | null>(null);
  const connection = useRef<BluetoothDevice | null>(null);
  const listener = useRef<BluetoothEventSubscription | null>(null);

  async function findPairedDevices() {
    try {
      if (!(await ensureBluetoothConnectPermission())) {
        console.log("Bluetooth permission not granted.");
        return;
      }
      if (!BluetoothClassic.isBluetoothEnabled()) {
        console.log("Bluetooth is not enabled."); //////////////////////
        return;
      }
      setDevices(await BluetoothClassic.getBondedDevices());
    } catch (error) {
      console.error("Error finding paired devices:", error);
    }
  }

  async function connect(address: string) {
    if (connection.current) return; //?

    try {
      if (!(await ensureBluetoothConnectPermission())) {
        console.log("Bluetooth permission not granted.");
        return;
      }
      setStatus("Connecting...");
      setLatestFix(null);
      setLatestLine("");
      const device = await BluetoothClassic.connectToDevice(address, {
        delimiter: "\n",
      }); //?
      connection.current = device;
      listener.current = device.onDataReceived((data) => {
        for (const line of data.data.split(/\r?\n/)) {
          const sentence = line.trim();
          if (!sentence) continue;
          setLatestLine(sentence);
          const fix = parseGgaSentence(sentence);
          if (fix) setLatestFix(fix);

          const dop = parseGsaSentence(sentence);
          if (dop) setGsaDop(dop);
        }
      }); //?
      setStatus("Connected to " + device.name);
    } catch (error) {
      console.error("Error connecting to device:", error);
      setStatus("Failed to connect: " + String(error));
    }
  }

  async function disconnect() {
    listener.current?.remove();
    listener.current = null;

    const device = connection.current;
    connection.current = null;
    setLatestFix(null);

    if (device) await device.disconnect(); // tc

    setStatus("Disconnected");
  }

  useEffect(() => {
    return () => {
      listener.current?.remove();
      void connection.current?.disconnect().catch((error) => {});
    };
  }, []);

  return (
    <View style={{ flex: 1, padding: 20, gap: 12 }}>
      <Button title="Find paired GPS receivers" onPress={findPairedDevices} />

      {devices.map((device) => (
        <Pressable
          key={device.address}
          onPress={() => void connect(device.address)}
        >
          <Text>
            {device.name ?? "Unnamed device"} — {device.address}
          </Text>
        </Pressable>
      ))}

      <Text>{status}</Text>
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
