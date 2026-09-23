import { useEffect, useRef, useState } from "react";
import { NativeModules } from "react-native";
import BluetoothClassic, {
  type BluetoothDevice,
  type BluetoothEventSubscription,
} from "react-native-bluetooth-classic";

import type { ConsoleEntry, EuposSettings } from "@/components/settings/types";
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
  const consoleIdRef = useRef(0);
  const receiverReadyRef = useRef(false);
  const latestUsableGgaRef = useRef<string | null>(null);

  const ntripRef = useRef<NtripConnection | null>(null);
  const ntripStartingRef = useRef(false);
  const euposSettingsRef = useRef(euposSettings);
  const nextNtripAttemptAtRef = useRef(0);
  const ntripRetryDelayRef = useRef(INITIAL_NTRIP_RETRY_MS);

  useEffect(() => {
    euposSettingsRef.current = euposSettings;
    nextNtripAttemptAtRef.current = 0;
    ntripRetryDelayRef.current = INITIAL_NTRIP_RETRY_MS;
  }, [euposSettings]);

  useEffect(() => {
    let disconnectSubscription: BluetoothEventSubscription | null = null;

    if (!hasBluetoothNativeModule) {
      setConnectionMessage(BLUETOOTH_MODULE_UNAVAILABLE);
    } else {
      try {
        disconnectSubscription = BluetoothClassic.onDeviceDisconnected(
          ({ device }) => {
            if (connectionRef.current?.address !== device.address) return;

            ntripRef.current?.stop(false);
            ntripRef.current = null;
            ntripStartingRef.current = false;
            dataListenerRef.current?.remove();
            dataListenerRef.current = null;
            connectionRef.current = null;
            receiverReadyRef.current = false;
            latestUsableGgaRef.current = null;
            setConnectedDevice(null);
            setLatestFix(null);
            setGsaDop(null);
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
      disconnectSubscription?.remove();
      ntripRef.current?.stop(false);
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

  function currentNtripSettings(): NtripSettings | null {
    const settings = euposSettingsRef.current;
    const port = Number(settings.port);

    if (
      !settings.host.trim() ||
      !settings.mountpoint.trim() ||
      !settings.username.trim() ||
      !Number.isInteger(port) ||
      port < 1 ||
      port > 65535
    ) {
      return null;
    }

    return {
      host: settings.host,
      mountpoint: settings.mountpoint,
      password: settings.password,
      port,
      useTls: settings.useTls,
      username: settings.username,
    };
  }

  async function startNtrip(device: BluetoothDevice, gga: string) {
    if (
      ntripStartingRef.current ||
      ntripRef.current?.isRunning() ||
      Date.now() < nextNtripAttemptAtRef.current
    ) {
      return;
    }

    const settings = currentNtripSettings();
    if (!settings) {
      setNtripStatus({
        ...INITIAL_NTRIP_STATUS,
        state: "error",
        message: "Complete and save the ASG-EUPOS settings to start NTRIP.",
      });
      return;
    }

    ntripStartingRef.current = true;
    const connection = new NtripConnection({
      onStatus: (status) => {
        setNtripStatus(status);
        if (status.state === "streaming") {
          nextNtripAttemptAtRef.current = 0;
          ntripRetryDelayRef.current = INITIAL_NTRIP_RETRY_MS;
        }
      },
    });
    ntripRef.current = connection;

    try {
      await connection.start(settings, device, gga);
    } catch (error) {
      if (ntripRef.current === connection) {
        const delay = ntripRetryDelayRef.current;
        nextNtripAttemptAtRef.current = Date.now() + delay;
        ntripRetryDelayRef.current = Math.min(delay * 2, MAX_NTRIP_RETRY_MS);

        if (!connection.isRunning()) {
          setNtripStatus((current) => ({
            ...current,
            state: "error",
            message:
              current.state === "error"
                ? current.message
                : `Could not start NTRIP: ${String(error)}`,
          }));
        }
      }
    } finally {
      ntripStartingRef.current = false;
    }
  }

  function handleReceiverData(rawData: string, device: BluetoothDevice) {
    addConsoleLines(rawData);

    // const fix = parseGgaSentence(sentence);
    // if (!fix) continue;

    // setLatestFix(fix);

    // if (receiverReadyRef.current && ntripRef.current?.isRunning()) {
    //   ntripRef.current.updateGga(fix.sentence);
    // }

    // if (
    //   fix.quality === 0 ||
    //   fix.latitude === undefined ||
    //   fix.longitude === undefined
    // ) {
    //   continue;
    // }

    // latestUsableGgaRef.current = fix.sentence;

    // if (!receiverReadyRef.current) continue;

    // if (!ntripRef.current?.isRunning()) {
    //   void startNtrip(device, fix.sentence);
    // }

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
    ntripRef.current?.stop();
    ntripRef.current = null;
    ntripStartingRef.current = false;
    nextNtripAttemptAtRef.current = 0;
    ntripRetryDelayRef.current = INITIAL_NTRIP_RETRY_MS;
    dataListenerRef.current?.remove();
    dataListenerRef.current = null;

    const device = connectionRef.current;
    connectionRef.current = null;
    receiverReadyRef.current = false;
    latestUsableGgaRef.current = null;
    setConnectedDevice(null);
    setLatestFix(null);
    setGsaDop(null);

    try {
      await device?.disconnect();
      setConnectionMessage("Device disconnected.");
      setNtripStatus({
        ...INITIAL_NTRIP_STATUS,
        state: "disconnected",
        message: "NTRIP corrections stopped.",
      });
    } catch (error) {
      setConnectionMessage("Could not disconnect: " + String(error));
    }
  }

  async function connectSelected(address = selectedAddress) {
    if (!hasBluetoothNativeModule) {
      setConnectionMessage(BLUETOOTH_MODULE_UNAVAILABLE);
      return;
    }

    if (!address || !receiverModel || isConnecting) return;
    if (connectionRef.current?.address === address) return;

    setIsConnecting(true);
    setConnectionMessage("Connecting to receiver…");
    receiverReadyRef.current = false;
    latestUsableGgaRef.current = null;
    let device: BluetoothDevice | null = null;

    try {
      if (!(await ensureBluetoothConnectPermission())) {
        setConnectionMessage("Bluetooth permission is required to connect.");
        return;
      }

      if (connectionRef.current) await disconnect();

      const connectedDevice = await BluetoothClassic.connectToDevice(address, {
        delimiter: "\n",
      });
      device = connectedDevice;
      connectionRef.current = connectedDevice;
      dataListenerRef.current = connectedDevice.onDataReceived(({ data }) =>
        handleReceiverData(data, connectedDevice),
      );

      await configureTopcon(connectedDevice, receiverModel);
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
      ntripRef.current?.stop(false);
      ntripRef.current = null;
      dataListenerRef.current?.remove();
      dataListenerRef.current = null;
      connectionRef.current = null;
      receiverReadyRef.current = false;
      latestUsableGgaRef.current = null;
      await device?.disconnect().catch(() => undefined);
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
