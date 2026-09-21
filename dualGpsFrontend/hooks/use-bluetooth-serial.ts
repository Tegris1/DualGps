import { useEffect, useRef, useState } from "react";
import BluetoothClassic, {
  type BluetoothDevice,
  type BluetoothEventSubscription,
} from "react-native-bluetooth-classic";

import type { ConsoleEntry } from "@/components/settings/types";
import { ensureBluetoothConnectPermission } from "@/utils/bluetoothPermisisons";

function currentTime() {
  return new Date().toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

export function useBluetoothSerial() {
  const [devices, setDevices] = useState<BluetoothDevice[]>([]);
  const [selectedAddress, setSelectedAddress] = useState<string | null>(null);
  const [connectedDevice, setConnectedDevice] =
    useState<BluetoothDevice | null>(null);
  const [connectionMessage, setConnectionMessage] = useState(
    "Refresh to find your paired receivers.",
  );
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [consoleEntries, setConsoleEntries] = useState<ConsoleEntry[]>([]);

  const connectionRef = useRef<BluetoothDevice | null>(null);
  const dataListenerRef = useRef<BluetoothEventSubscription | null>(null);
  const consoleIdRef = useRef(0);

  useEffect(() => {
    return () => {
      dataListenerRef.current?.remove();
      void connectionRef.current?.disconnect().catch(() => undefined);
    };
  }, []);

  function addConsoleLines(rawData: string) {
    const time = currentTime();
    const entries = rawData
      .split(/\r?\n/)
      .map((message) => message.trim())
      .filter(Boolean)
      .map((message) => ({
        id: consoleIdRef.current++,
        message,
        time,
      }));

    if (entries.length) {
      setConsoleEntries((current) => [...current, ...entries].slice(-200));
    }
  }

  async function refreshDevices() {
    setIsRefreshing(true);
    setConnectionMessage("Checking Bluetooth…");

    try {
      if (!(await ensureBluetoothConnectPermission())) {
        setConnectionMessage(
          "Bluetooth permission is required to find devices.",
        );
        return;
      }

      if (!(await BluetoothClassic.isBluetoothEnabled())) {
        setConnectionMessage(
          "Bluetooth is turned off. Enable it and try again.",
        );
        return;
      }

      const pairedDevices = await BluetoothClassic.getBondedDevices();
      setDevices(pairedDevices);
      setSelectedAddress((current) =>
        current &&
        pairedDevices.some((device) => device.address === current)
          ? current
          : (pairedDevices[0]?.address ?? null),
      );
      setConnectionMessage(
        pairedDevices.length
          ? pairedDevices.length +
              " paired device" +
              (pairedDevices.length === 1 ? "" : "s") +
              " found."
          : "No paired devices found. Pair a receiver in system settings first.",
      );
    } catch (error) {
      setConnectionMessage(
        "Could not read paired devices: " + String(error),
      );
    } finally {
      setIsRefreshing(false);
    }
  }

  async function disconnect() {
    dataListenerRef.current?.remove();
    dataListenerRef.current = null;

    const device = connectionRef.current;
    connectionRef.current = null;
    setConnectedDevice(null);

    try {
      await device?.disconnect();
      setConnectionMessage("Device disconnected.");
    } catch (error) {
      setConnectionMessage("Could not disconnect: " + String(error));
    }
  }

  async function connectSelected() {
    if (!selectedAddress || isConnecting) return;
    if (connectionRef.current?.address === selectedAddress) return;

    setIsConnecting(true);
    setConnectionMessage("Connecting to receiver…");

    try {
      if (!(await ensureBluetoothConnectPermission())) {
        setConnectionMessage("Bluetooth permission is required to connect.");
        return;
      }

      if (connectionRef.current) await disconnect();

      const device = await BluetoothClassic.connectToDevice(selectedAddress, {
        delimiter: "\n",
      });
      connectionRef.current = device;
      dataListenerRef.current = device.onDataReceived(({ data }) =>
        addConsoleLines(data),
      );
      setConnectedDevice(device);
      setConnectionMessage(
        "Connected to " + (device.name ?? device.address) + ".",
      );
    } catch (error) {
      setConnectionMessage("Connection failed: " + String(error));
    } finally {
      setIsConnecting(false);
    }
  }

  const selectedDevice = devices.find(
    (device) => device.address === selectedAddress,
  );

  return {
    clearConsole: () => setConsoleEntries([]),
    connectSelected,
    connectedDevice,
    connectionMessage,
    consoleEntries,
    devices,
    disconnect,
    isConnecting,
    isRefreshing,
    refreshDevices,
    selectedAddress,
    selectedDevice,
    selectDevice: setSelectedAddress,
  };
}

export type BluetoothSerialController = ReturnType<
  typeof useBluetoothSerial
>;
