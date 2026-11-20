import { useCallback, useEffect, useRef, useState } from "react";
import { NativeModules } from "react-native";
import BluetoothClassic, { type BluetoothDevice, type BluetoothEventSubscription } from "react-native-bluetooth-classic";

import { configureTopcon, type ReceiverModel } from "@/lib/gps/receiver-profiles";
import type { ReceiverReleaseReason } from "@/features/gps/types";
import { ensureBluetoothConnectPermission } from "@/features/gps/bluetooth-permissions";
import type { ReceiverAssignments } from "@/features/gps/services/receiver-assignments";

const BLUETOOTH_MODULE_UNAVAILABLE = "Bluetooth Classic is unavailable on this device.";
const hasBluetoothNativeModule = NativeModules.RNBluetoothClassic != null;

type ReceiverLifecycleCallbacks = {
  onAttached: (device: BluetoothDevice) => void;
  onReady: (device: BluetoothDevice) => void;
  onData: (data: string, device: BluetoothDevice) => void;
  onReleased: (reason: ReceiverReleaseReason) => void;
  assignments?: ReceiverAssignments;
  configureDevice?: (device: BluetoothDevice, isActive: () => boolean) => Promise<void>;
};

type ReleasedReceiver = { device: BluetoothDevice | null; releaseAddress: (() => void) | null };

async function disconnectReceiver({ device, releaseAddress }: ReleasedReceiver) {
  try {
    await device?.disconnect();
  } finally {
    releaseAddress?.();
  }
}

export function useBluetoothReceiver({ onAttached, onReady, onData, onReleased, assignments, configureDevice }: ReceiverLifecycleCallbacks) {
  const [devices, setDevices] = useState<BluetoothDevice[]>([]);
  const [selectedAddress, setSelectedAddress] = useState<string | null>(null);
  const [connectedDevice, setConnectedDevice] = useState<BluetoothDevice | null>(null);
  const [connectionMessage, setConnectionMessage] = useState("Refresh to find your paired receivers.");
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [receiverModel, setReceiverModel] = useState<ReceiverModel | null>(null);

  const connectionRef = useRef<BluetoothDevice | null>(null);
  const releaseAddressRef = useRef<(() => void) | null>(null);
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
    const releaseAddress = releaseAddressRef.current;
    releaseAddressRef.current = null;
    const listener = dataListenerRef.current;
    dataListenerRef.current = null;

    onReleased(reason);
    listener?.remove();
    if (mountedRef.current) {
      setConnectedDevice(null);
      if (cancelPendingConnection) setIsConnecting(false);
    }
    return { device, releaseAddress };
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
          releaseReceiverSession("unexpected-disconnect").releaseAddress?.();
          setConnectionMessage("Bluetooth receiver disconnected unexpectedly.");
        });
      } catch (error) {
        setConnectionMessage(`${BLUETOOTH_MODULE_UNAVAILABLE} ${String(error)}`);
      }
    }

    return () => {
      mountedRef.current = false;
      disconnectSubscription?.remove();
      const released = releaseReceiverSession("unmounted");
      void disconnectReceiver(released).catch(() => undefined);
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
    const released = releaseReceiverSession("disconnected");
    const operation = {};
    latestOperationRef.current = operation;
    if (mountedRef.current) setConnectionMessage("Device disconnected.");
    try {
      await disconnectReceiver(released);
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
    if (!mountedRef.current || !address || (!receiverModel && !configureDevice) || connectionAttemptRef.current) return;
    if (connectionRef.current?.address === address) return;

    const releaseAddress = assignments?.reserve(address);
    if (assignments && !releaseAddress) {
      setConnectionMessage("This device is already assigned to another receiver or IMU.");
      return;
    }
    let reservationTransferred = false;
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
      const previous = releaseReceiverSession("replaced", false);
      await disconnectReceiver(previous);
      if (!isCurrentAttempt()) return;

      const connectedDevice = await BluetoothClassic.connectToDevice(address, { delimiter: "\n" });
      device = connectedDevice;
      if (!isCurrentAttempt()) {
        await device.disconnect().catch(() => undefined);
        return;
      }
      connectionRef.current = connectedDevice;
      releaseAddressRef.current = releaseAddress ?? null;
      reservationTransferred = true;
      receiverSessionRef.current = attempt;
      onAttached(connectedDevice);
      dataListenerRef.current = connectedDevice.onDataReceived(({ data }) => {
        if (mountedRef.current && receiverSessionRef.current === attempt) onData(data, connectedDevice);
      });

      if (configureDevice) await configureDevice(connectedDevice, isCurrentAttempt);
      else if (receiverModel) await configureTopcon(connectedDevice, receiverModel, isCurrentAttempt);
      if (!isCurrentAttempt()) return;
      setConnectedDevice(connectedDevice);
      setConnectionMessage("Connected to " + (connectedDevice.name ?? connectedDevice.address) + ".");
      onReady(connectedDevice);
    } catch (error) {
      if (!isCurrentAttempt()) return;
      const failed = releaseReceiverSession("connection-failed", false);
      setConnectionMessage("Connection failed: " + String(error));
      await disconnectReceiver({ ...failed, device: failed.device ?? device }).catch(() => undefined);
    } finally {
      if (!reservationTransferred) releaseAddress?.();
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
