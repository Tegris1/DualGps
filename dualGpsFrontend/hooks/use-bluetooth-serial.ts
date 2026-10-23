import { useCallback, useEffect, useRef, useState } from "react";
import { NativeModules } from "react-native";
import BluetoothClassic, {
  type BluetoothDevice,
  type BluetoothEventSubscription,
} from "react-native-bluetooth-classic";

import { toNtripSettings } from "@/lib/gps/eupos-settings";
import type { ConsoleEntry, EuposSettings } from "@/lib/gps/types";
import { ensureBluetoothConnectPermission } from "@/utils/bluetoothPermisisons";

import {
  parseGgaSentence,
  parseGsaSentence,
  type GgaFix,
  type GsaDop,
} from "@/lib/gps/nmea";
import {
  NtripConnection,
  type NtripConnectionStatus,
} from "@/lib/gps/ntrip-connection";
import type { NtripSettings } from "@/lib/gps/ntrip-protocol";
import {
  configureTopcon,
  type ReceiverModel,
} from "@/lib/gps/receiver-profiles";

const INITIAL_NTRIP_STATUS: NtripConnectionStatus = {
  state: "idle",
  message: "Waiting for a valid GGA position from the receiver.",
  bytesReceived: 0,
  bytesSentToReceiver: 0,
  rtcm: { validFrames: 0, invalidFrames: 0 },
};

const INITIAL_NTRIP_RETRY_MS = 2_000;
const MAX_NTRIP_RETRY_MS = 30_000;
const BLUETOOTH_MODULE_UNAVAILABLE =
  "Bluetooth Classic is unavailable on this device.";

const hasBluetoothNativeModule = NativeModules.RNBluetoothClassic != null;

function currentTime() {
  return new Date().toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

export function useBluetoothSerial(euposSettings: EuposSettings) {
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
  const [latestLine, setLatestLine] = useState("");
  const [latestFix, setLatestFix] = useState<GgaFix | null>(null);
  const [gsaDop, setGsaDop] = useState<GsaDop | null>(null);
  const [receiverModel, setReceiverModel] = useState<ReceiverModel | null>(
    null,
  );
  const [ntripStatus, setNtripStatus] =
    useState<NtripConnectionStatus>(INITIAL_NTRIP_STATUS);

  const connectionRef = useRef<BluetoothDevice | null>(null);
  const dataListenerRef = useRef<BluetoothEventSubscription | null>(null);
  const mountedRef = useRef(false);
  const connectionAttemptRef = useRef<object | null>(null);
  const receiverSessionRef = useRef<object | null>(null);
  const latestOperationRef = useRef<object | null>(null);
  const consoleIdRef = useRef(0);
  const receiverReadyRef = useRef(false);
  const latestUsableGgaRef = useRef<string | null>(null);
  const ntripRetryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const ntripRef = useRef<NtripConnection | null>(null);
  const ntripStartingRef = useRef(false);
  const euposSettingsRef = useRef(euposSettings);
  const ntripRetryDelayRef = useRef(INITIAL_NTRIP_RETRY_MS);

  const clearNtripRetry = useCallback(() => {
    if (ntripRetryTimerRef.current !== null) {
      clearTimeout(ntripRetryTimerRef.current);
      ntripRetryTimerRef.current = null;
    }
  }, []);

  const stopNtripSession = useCallback(() => {
    clearNtripRetry();

    const connection = ntripRef.current;
    ntripRef.current = null;
    ntripStartingRef.current = false;

    connection?.stop(false);
  }, [clearNtripRetry]);

  const releaseReceiverSession = useCallback((cancelPendingConnection = true) => {
    if (cancelPendingConnection) connectionAttemptRef.current = null;
    latestOperationRef.current = null;
    receiverSessionRef.current = null;

    const device = connectionRef.current;
    connectionRef.current = null;
    receiverReadyRef.current = false;
    latestUsableGgaRef.current = null;

    const listener = dataListenerRef.current;
    dataListenerRef.current = null;
    stopNtripSession();
    ntripRetryDelayRef.current = INITIAL_NTRIP_RETRY_MS;
    listener?.remove();

    if (mountedRef.current) {
      setConnectedDevice(null);
      setLatestFix(null);
      setGsaDop(null);
      setLatestLine("");
      if (cancelPendingConnection) setIsConnecting(false);
    }

    return device;
  }, [stopNtripSession]);

  useEffect(() => {
    euposSettingsRef.current = euposSettings;
    ntripRetryDelayRef.current = INITIAL_NTRIP_RETRY_MS;
  }, [euposSettings]);

  useEffect(() => {
    mountedRef.current = true;
    let disconnectSubscription: BluetoothEventSubscription | null = null;

    if (!hasBluetoothNativeModule) {
      setConnectionMessage(BLUETOOTH_MODULE_UNAVAILABLE);
    } else {
      try {
        disconnectSubscription = BluetoothClassic.onDeviceDisconnected(
          ({ device }) => {
            if (!mountedRef.current || connectionRef.current?.address !== device.address) return;

            releaseReceiverSession();
            setConnectionMessage(
              "Bluetooth receiver disconnected unexpectedly.",
            );
            setNtripStatus({
              ...INITIAL_NTRIP_STATUS,
              state: "disconnected",
              message:
                "NTRIP corrections stopped because Bluetooth disconnected.",
            });
          },
        );
      } catch (error) {
        setConnectionMessage(
          `${BLUETOOTH_MODULE_UNAVAILABLE} ${String(error)}`,
        );
      }
    }

    return () => {
      mountedRef.current = false;
      disconnectSubscription?.remove();
      const device = releaseReceiverSession();
      void device?.disconnect().catch(() => undefined);
    };
  }, [releaseReceiverSession]);

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

  function currentNtripSettings(): NtripSettings | null {
    try {
      return toNtripSettings(euposSettingsRef.current);
    } catch {
      return null;
    }
  }

  async function startNtrip(device: BluetoothDevice, gga: string) {
    if (
      connectionRef.current !== device ||
      !receiverReadyRef.current ||
      ntripStartingRef.current ||
      ntripRef.current?.isRunning() ||
      ntripRetryTimerRef.current !== null
    ) {
      return;
    }

    const settings = currentNtripSettings();

    if (!settings) {
      setNtripStatus({
        ...INITIAL_NTRIP_STATUS,
        state: "error",
        message: "Complete the ASG-EUPOS settings to start NTRIP.",
      });
      return;
    }

    ntripStartingRef.current = true;

    const connection: NtripConnection = new NtripConnection({
      onStatus: (status) => {
        if (ntripRef.current !== connection) return;

        setNtripStatus(status);

        if (status.state === "streaming" && status.bytesReceived > 0) {
          clearNtripRetry();
          ntripRetryDelayRef.current = INITIAL_NTRIP_RETRY_MS;
        } else if (
          status.state === "error" ||
          status.state === "disconnected"
        ) {
          scheduleNtripRetry();
        }
      },
    });

    ntripRef.current = connection;

    try {
      await connection.start(settings, device, gga);
    } catch (error) {
      if (ntripRef.current !== connection) return;

      const message = error instanceof Error ? error.message : String(error);

      setNtripStatus((current) => ({
        ...current,
        state: "error",
        message,
      }));

      scheduleNtripRetry();
    } finally {
      if (ntripRef.current === connection) {
        ntripStartingRef.current = false;
      }
    }
  }

  function scheduleNtripRetry(): void {
    const device = connectionRef.current;

    if (
      !device ||
      !receiverReadyRef.current ||
      ntripRetryTimerRef.current !== null
    ) {
      return;
    }

    const delay = ntripRetryDelayRef.current;
    ntripRetryDelayRef.current = Math.min(delay * 2, MAX_NTRIP_RETRY_MS);

    ntripRetryTimerRef.current = setTimeout(() => {
      ntripRetryTimerRef.current = null;

      // Ignore a retry belonging to a previous Bluetooth session.
      if (
        connectionRef.current !== device ||
        !receiverReadyRef.current ||
        ntripRef.current?.isRunning()
      ) {
        return;
      }

      if (ntripStartingRef.current) {
        scheduleNtripRetry();
        return;
      }

      const gga = latestUsableGgaRef.current;

      if (gga) {
        void startNtrip(device, gga);
      }
      // Without a usable GGA, the receiver listener will start NTRIP
      // when the next usable position arrives.
    }, delay);
  }

  function handleReceiverData(rawData: string, device: BluetoothDevice) {
    addConsoleLines(rawData);

    for (const line of rawData.split(/\r?\n/)) {
      const sentence = line.trim();
      if (!sentence) continue;

      setLatestLine(sentence);
      const dop = parseGsaSentence(sentence);
      if (dop) setGsaDop(dop);

      const fix = parseGgaSentence(sentence);
      if (fix) setLatestFix(fix);
      if (
        !fix ||
        fix.quality === 0 ||
        fix.latitude === undefined ||
        fix.longitude === undefined
      ) {
        continue;
      }

      latestUsableGgaRef.current = fix.sentence;
      if (!receiverReadyRef.current) continue;

      if (ntripRef.current?.isRunning()) {
        ntripRef.current.updateGga(fix.sentence);
      } else {
        void startNtrip(device, fix.sentence);
      }
    }
  }

  async function refreshDevices() {
    if (!hasBluetoothNativeModule) {
      setConnectionMessage(BLUETOOTH_MODULE_UNAVAILABLE);
      return;
    }

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
        current && pairedDevices.some((device) => device.address === current)
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
      setConnectionMessage("Could not read paired devices: " + String(error));
    } finally {
      setIsRefreshing(false);
    }
  }

  async function disconnect() {
    const device = releaseReceiverSession();
    const operation = {};
    latestOperationRef.current = operation;
    if (mountedRef.current) {
      setConnectionMessage("Device disconnected.");
      setNtripStatus({
        ...INITIAL_NTRIP_STATUS,
        state: "disconnected",
        message: "NTRIP corrections stopped.",
      });
    }

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
      const previousDevice = releaseReceiverSession(false);
      setNtripStatus(INITIAL_NTRIP_STATUS);
      await previousDevice?.disconnect();
      if (!isCurrentAttempt()) return;

      const connectedDevice = await BluetoothClassic.connectToDevice(address, {
        delimiter: "\n",
      });
      device = connectedDevice;
      if (!isCurrentAttempt()) {
        await device.disconnect().catch(() => undefined);
        return;
      }
      connectionRef.current = connectedDevice;
      receiverSessionRef.current = attempt;
      dataListenerRef.current = connectedDevice.onDataReceived(({ data }) => {
        if (mountedRef.current && receiverSessionRef.current === attempt) {
          handleReceiverData(data, connectedDevice);
        }
      });

      await configureTopcon(connectedDevice, receiverModel, isCurrentAttempt);
      if (!isCurrentAttempt()) return;
      receiverReadyRef.current = true;
      setConnectedDevice(connectedDevice);
      setNtripStatus(INITIAL_NTRIP_STATUS);
      setConnectionMessage(
        "Connected to " +
          (connectedDevice.name ?? connectedDevice.address) +
          ".",
      );

      if (latestUsableGgaRef.current) {
        void startNtrip(connectedDevice, latestUsableGgaRef.current);
      }
    } catch (error) {
      if (!isCurrentAttempt()) return;
      const failedDevice = releaseReceiverSession(false) ?? device;
      setConnectionMessage("Connection failed: " + String(error));
      setNtripStatus({ ...INITIAL_NTRIP_STATUS, state: "error", message: "Receiver connection failed." });
      await failedDevice?.disconnect().catch(() => undefined);
    } finally {
      if (isCurrentAttempt()) {
        connectionAttemptRef.current = null;
        setIsConnecting(false);
      }
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
    latestFix,
    latestLine,
    ntripStatus,
    receiverModel,
    refreshDevices,
    selectedAddress,
    selectedDevice,
    selectReceiverModel: setReceiverModel,
    selectDevice: setSelectedAddress,
    gsaDop,
  };
}

export type BluetoothSerialController = ReturnType<typeof useBluetoothSerial>;
