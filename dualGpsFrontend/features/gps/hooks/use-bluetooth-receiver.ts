import { useCallback, useEffect, useRef, useState } from "react";
import { NativeModules } from "react-native";
import BluetoothClassic, { type BluetoothDevice, type BluetoothEventSubscription } from "react-native-bluetooth-classic";

import { configureTopcon, type ReceiverModel } from "@/lib/gps/receiver-profiles";
import type { ReceiverReleaseReason } from "@/features/gps/types";
import { ensureBluetoothConnectPermission } from "@/features/gps/bluetooth-permissions";

const BLUETOOTH_MODULE_UNAVAILABLE = "Bluetooth Classic is unavailable on this device.";
const hasBluetoothNativeModule = NativeModules.RNBluetoothClassic != null;

type ReceiverLifecycleCallbacks = {
  onAttached: (device: BluetoothDevice) => void;
  onReady: (device: BluetoothDevice) => void;
  onData: (data: string, device: BluetoothDevice) => void;
  onReleased: (reason: ReceiverReleaseReason) => void;
};

export function useBluetoothReceiver({ onAttached, onReady, onData, onReleased }: ReceiverLifecycleCallbacks) {
  const [devices, setDevices] = useState<BluetoothDevice[]>([]);
  const [selectedAddress, setSelectedAddress] = useState<string | null>(null);
  const [connectedDevice, setConnectedDevice] = useState<BluetoothDevice | null>(null);
  const [connectionMessage, setConnectionMessage] = useState("Refresh to find your paired receivers.");
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [receiverModel, setReceiverModel] = useState<ReceiverModel | null>(null);

  const connectionRef = useRef<BluetoothDevice | null>(null);
  const dataListenerRef = useRef<BluetoothEventSubscription | null>(null);
  const mountedRef = useRef(false);
  const connectionAttemptRef = useRef<object | null>(null);
  const receiverSessionRef = useRef<object | null>(null);
  const latestOperationRef = useRef<object | null>(null);

  const releaseReceiverSession = useCallback((reason: ReceiverReleaseReason, cancelPendingConnection = true) => {
    if (cancelPendingConnection) connectionAttemptRef.current = null;
    latestOperationRef.current = null;
    receiverSessionRef.current = null;
    const device = connectionRef.current;
    connectionRef.current = null;
    const listener = dataListenerRef.current;
    dataListenerRef.current = null;

    onReleased(reason);
    listener?.remove();
    if (mountedRef.current) {
      setConnectedDevice(null);
      if (cancelPendingConnection) setIsConnecting(false);
    }
    return device;
  }, [onReleased]);

  useEffect(() => {
    mountedRef.current = true;
    let disconnectSubscription: BluetoothEventSubscription | null = null;

    if (!hasBluetoothNativeModule) {
      setConnectionMessage(BLUETOOTH_MODULE_UNAVAILABLE);
    } else {
      try {
        disconnectSubscription = BluetoothClassic.onDeviceDisconnected(({ device }) => {
          if (!mountedRef.current || connectionRef.current?.address !== device.address) return;
          releaseReceiverSession("unexpected-disconnect");
          setConnectionMessage("Bluetooth receiver disconnected unexpectedly.");
        });
      } catch (error) {
        setConnectionMessage(`${BLUETOOTH_MODULE_UNAVAILABLE} ${String(error)}`);
      }
    }

    return () => {
      mountedRef.current = false;
      disconnectSubscription?.remove();
      const device = releaseReceiverSession("unmounted");
      void device?.disconnect().catch(() => undefined);
    };
  }, [releaseReceiverSession]);

  async function refreshDevices() {
    if (!hasBluetoothNativeModule) {
      setConnectionMessage(BLUETOOTH_MODULE_UNAVAILABLE);
      return;
    }
    setIsRefreshing(true);
    setConnectionMessage("Checking Bluetooth…");

    try {
      if (!(await ensureBluetoothConnectPermission())) {
        setConnectionMessage("Bluetooth permission is required to find devices.");
        return;
      }
      if (!(await BluetoothClassic.isBluetoothEnabled())) {
        setConnectionMessage("Bluetooth is turned off. Enable it and try again.");
        return;
      }
      const pairedDevices = await BluetoothClassic.getBondedDevices();
      setDevices(pairedDevices);
      setSelectedAddress((current) => current && pairedDevices.some((device) => device.address === current)
        ? current : (pairedDevices[0]?.address ?? null));
      setConnectionMessage(pairedDevices.length
        ? `${pairedDevices.length} paired device${pairedDevices.length === 1 ? "" : "s"} found.`
        : "No paired devices found. Pair a receiver in system settings first.");
    } catch (error) {
      setConnectionMessage("Could not read paired devices: " + String(error));
    } finally {
      setIsRefreshing(false);
    }
  }

  async function disconnect() {
    const device = releaseReceiverSession("disconnected");
    const operation = {};
    latestOperationRef.current = operation;
    if (mountedRef.current) setConnectionMessage("Device disconnected.");
    try {
      await device?.disconnect();
    } catch (error) {
      if (mountedRef.current && latestOperationRef.current === operation) {
        setConnectionMessage("Could not disconnect: " + String(error));
      }
    }
  }

  async function connectSelected(address = selectedAddress) {
    if (!hasBluetoothNativeModule) {
      setConnectionMessage(BLUETOOTH_MODULE_UNAVAILABLE);
      return;
    }
    if (!mountedRef.current || !address || !receiverModel || connectionAttemptRef.current) return;
    if (connectionRef.current?.address === address) return;

    const attempt = {};
    connectionAttemptRef.current = attempt;
    latestOperationRef.current = attempt;
    const isCurrentAttempt = () => mountedRef.current && connectionAttemptRef.current === attempt;
    setIsConnecting(true);
    setConnectionMessage("Connecting to receiver…");
    let device: BluetoothDevice | null = null;

    try {
      const permitted = await ensureBluetoothConnectPermission();
      if (!isCurrentAttempt()) return;
      if (!permitted) {
        setConnectionMessage("Bluetooth permission is required to connect.");
        return;
      }

      // Keep this attempt active while releasing the previous receiver.
      const previousDevice = releaseReceiverSession("replaced", false);
      await previousDevice?.disconnect();
      if (!isCurrentAttempt()) return;

      const connectedDevice = await BluetoothClassic.connectToDevice(address, { delimiter: "\n" });
      device = connectedDevice;
      if (!isCurrentAttempt()) {
        await device.disconnect().catch(() => undefined);
        return;
      }
      connectionRef.current = connectedDevice;
      receiverSessionRef.current = attempt;
      onAttached(connectedDevice);
      dataListenerRef.current = connectedDevice.onDataReceived(({ data }) => {
        if (mountedRef.current && receiverSessionRef.current === attempt) onData(data, connectedDevice);
      });

      await configureTopcon(connectedDevice, receiverModel, isCurrentAttempt);
      if (!isCurrentAttempt()) return;
      setConnectedDevice(connectedDevice);
      setConnectionMessage("Connected to " + (connectedDevice.name ?? connectedDevice.address) + ".");
      onReady(connectedDevice);
    } catch (error) {
      if (!isCurrentAttempt()) return;
      const failedDevice = releaseReceiverSession("connection-failed", false) ?? device;
      setConnectionMessage("Connection failed: " + String(error));
      await failedDevice?.disconnect().catch(() => undefined);
    } finally {
      if (isCurrentAttempt()) {
        connectionAttemptRef.current = null;
        setIsConnecting(false);
      }
    }
  }

  return {
    devices,
    selectedAddress,
    selectedDevice: devices.find((device) => device.address === selectedAddress),
    connectedDevice,
    connectionMessage,
    isRefreshing,
    isConnecting,
    receiverModel,
    selectReceiverModel: setReceiverModel,
    selectDevice: setSelectedAddress,
    refreshDevices,
    connectSelected,
    disconnect,
  };
}
