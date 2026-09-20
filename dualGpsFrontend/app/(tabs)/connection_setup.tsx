import { useEffect, useRef, useState } from "react";
import { Button, Pressable, Text, View } from "react-native";
import BluetoothClassic, {
  type BluetoothDevice,
  type BluetoothEventSubscription,
} from "react-native-bluetooth-classic";
import { ensureBluetoothConnectPermission } from "@/utils/bluetoothPermisisons";

export default function ConnectionSetup() {
  const [devices, setDevices] = useState<BluetoothDevice[]>([]);
  const [status, setStatus] = useState("Not connected");
  const [latestLine, setLatestLine] = useState("");
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
      const device = await BluetoothClassic.connectToDevice(address, {
        delimiter: "\n",
      }); //?
      connection.current = device;
      listener.current = device.onDataReceived((data) => {
        setLatestLine(data.data.trim());
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

    if (device) await device.disconnect(); // Shouldnt this be in a try catch block?

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
      <Button title="Disconnect" onPress={() => void disconnect()} />
    </View>
  );
}
