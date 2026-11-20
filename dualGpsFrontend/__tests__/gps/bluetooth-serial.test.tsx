import { afterAll, afterEach, beforeAll, beforeEach, expect, it, jest } from "@jest/globals";
import { act } from "react";
import BluetoothClassic, { type BluetoothDevice } from "react-native-bluetooth-classic";

import { useBluetoothSerial } from "../../features/gps/hooks/use-bluetooth-serial";
import { GpsProvider, useGps } from "../../features/gps/gps-context";
import type { EuposSettings } from "../../features/gps/types";
import { DEFAULT_EUPOS_SETTINGS } from "../../features/gps/eupos-settings";
import { NtripConnection, type NtripConnectionCallbacks, type NtripState } from "../../lib/gps/ntrip-connection";
import { configureTopcon } from "../../lib/gps/receiver-profiles";
import { ensureBluetoothConnectPermission } from "../../features/gps/bluetooth-permissions";
import { gga, gsa } from "../fixtures/nmea";
import { imuPacket, IMU_TEST_UUIDS } from "../fixtures/imu";

jest.mock("react-native", () => ({ NativeModules: { RNBluetoothClassic: {} } }));
jest.mock("react-native-bluetooth-classic", () => ({
  __esModule: true,
  default: {
    onDeviceDisconnected: jest.fn(), connectToDevice: jest.fn(),
    isBluetoothEnabled: jest.fn(), getBondedDevices: jest.fn(),
  },
}));
jest.mock("../../lib/gps/ntrip-connection", () => ({ NtripConnection: jest.fn() }));
jest.mock("../../lib/gps/receiver-profiles", () => ({ configureTopcon: jest.fn() }));
jest.mock("../../features/gps/bluetooth-permissions", () => ({ ensureBluetoothConnectPermission: jest.fn() }));
jest.mock("../../lib/secure-storage", () => ({ createSecureStorage: () => mockImuStorage }));
jest.mock("../../features/gps/hooks/use-eupos-settings", () => ({
  useEuposSettings: (slot: number) => ({ settings: slot === 2 ? mockSecondProviderSettings : mockProviderSettings }),
}));

const { create } = require("react-test-renderer");
let root: ReturnType<typeof create> | null;
let controller!: ReturnType<typeof useBluetoothSerial>;
let receiver: ReturnType<typeof makeReceiver>;
let sessions: ReturnType<typeof makeNtrip>[];
let disconnected: (device: BluetoothDevice) => void;
let disconnectListeners: ((device: BluetoothDevice) => void)[];
const disconnectSubscription = { remove: jest.fn() };
const settings = { ...DEFAULT_EUPOS_SETTINGS, username: "operator", password: "secret" };
const mockProviderSettings = settings;
const mockSecondProviderSettings = { ...settings, username: "second-operator", mountpoint: "SECOND" };
const mockImuStorage = {
  getItem: jest.fn<(key: string) => Promise<string | null>>().mockResolvedValue(null),
  setItem: jest.fn<(key: string, value: string) => Promise<void>>().mockResolvedValue(undefined),
};
const previousActEnvironment = Reflect.get(globalThis, "IS_REACT_ACT_ENVIRONMENT");
const originalError = console.error;
let errorSpy: ReturnType<typeof jest.spyOn>;

function deferred<Value>() {
  let resolve!: (value: Value) => void;
  let reject!: (reason: Error) => void;
  const promise = new Promise<Value>((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}

function makeReceiver(address = "AA") {
  type Listener = Parameters<BluetoothDevice["onDataReceived"]>[0];
  const listeners: Listener[] = [];
  const subscription = { remove: jest.fn() };
  return {
    address, name: `Receiver ${address}`, subscription,
    disconnect: jest.fn<() => Promise<boolean>>().mockResolvedValue(true),
    onDataReceived: jest.fn((listener: Listener) => { listeners.push(listener); return subscription; }),
    emit: (data: string, listenerIndex = listeners.length - 1) => {
      listeners[listenerIndex]?.({ data } as Parameters<Listener>[0]);
    },
  };
}

function device(value = receiver) {
  return value as unknown as BluetoothDevice;
}

function makeNtrip(callbacks: NtripConnectionCallbacks = {}) {
  let running = false;
  return {
    start: jest.fn(async () => { running = true; }),
    stop: jest.fn(() => { running = false; }),
    isRunning: jest.fn(() => running),
    updateGga: jest.fn(),
    emitStatus: (state: NtripState, bytesReceived = 0) => {
      running = state === "connecting" || state === "streaming";
      callbacks.onStatus?.({ state, bytesReceived, bytesSentToReceiver: 0, rtcm: { validFrames: 0, invalidFrames: 0 } });
    },
  };
}

function Probe({ euposSettings = settings }: { euposSettings?: EuposSettings }) {
  controller = useBluetoothSerial(euposSettings);
  return null;
}

async function mount() {
  await act(async () => { root = create(<Probe />); });
  await act(() => controller.selectReceiverModel("topcon"));
}

async function connect(value = receiver) {
  jest.mocked(BluetoothClassic.connectToDevice).mockResolvedValueOnce(device(value));
  await act(async () => { await controller.connectSelected(value.address); });
}

beforeAll(() => {
  Reflect.set(globalThis, "IS_REACT_ACT_ENVIRONMENT", true);
  errorSpy = jest.spyOn(console, "error").mockImplementation((...args) => {
    if (!String(args[0]).startsWith("react-test-renderer is deprecated")) originalError(...args);
  });
});

beforeEach(() => {
  jest.useFakeTimers();
  jest.clearAllMocks();
  root = null;
  receiver = makeReceiver();
  sessions = [];
  mockImuStorage.getItem.mockReset().mockResolvedValue(null);
  mockImuStorage.setItem.mockReset().mockResolvedValue(undefined);
  disconnectListeners = [];
  jest.mocked(ensureBluetoothConnectPermission).mockReset().mockResolvedValue(true);
  jest.mocked(configureTopcon).mockReset().mockResolvedValue(undefined);
  jest.mocked(BluetoothClassic.connectToDevice).mockReset().mockResolvedValue(device());
  jest.mocked(BluetoothClassic.isBluetoothEnabled).mockReset().mockResolvedValue(true);
  jest.mocked(BluetoothClassic.getBondedDevices).mockReset().mockResolvedValue([device()]);
  jest.mocked(BluetoothClassic.onDeviceDisconnected).mockImplementation((listener) => {
    disconnectListeners.push((value) => listener({ device: value } as unknown as Parameters<typeof listener>[0]));
    disconnected = (value) => disconnectListeners.forEach((callback) => callback(value));
    return disconnectSubscription as ReturnType<typeof BluetoothClassic.onDeviceDisconnected>;
  });
  jest.mocked(NtripConnection).mockImplementation((callbacks) => {
    const session = makeNtrip(callbacks);
    sessions.push(session);
    return session as unknown as jest.Mocked<NtripConnection>;
  });
});

afterEach(async () => {
  await act(() => root?.unmount());
  jest.clearAllTimers();
  jest.useRealTimers();
});

afterAll(() => {
  errorSpy.mockRestore();
  Reflect.set(globalThis, "IS_REACT_ACT_ENVIRONMENT", previousActEnvironment);
});

it.each([false, true])("clears receiver data and corrections on manual disconnect (native failure: %s)", async (fails) => {
  await mount();
  await connect();
  await act(async () => receiver.emit(`${gga()}\n${gsa()}`));
  expect(controller.latestFix).not.toBeNull();
  expect(controller.gsaDop).not.toBeNull();
  if (fails) receiver.disconnect.mockRejectedValueOnce(new Error("Native disconnect failed"));
  await act(async () => { await controller.disconnect(); });
  expect(receiver.subscription.remove).toHaveBeenCalledTimes(1);
  expect(receiver.disconnect).toHaveBeenCalledTimes(1);
  expect(sessions[0].stop).toHaveBeenCalledWith(false);
  expect(controller.connectedDevice).toBeNull();
  expect(controller.latestFix).toBeNull();
  expect(controller.gsaDop).toBeNull();
  expect(controller.latestLine).toBe("");
  expect(controller.ntripStatus.state).toBe("disconnected");
  expect(controller.connectionMessage).toContain(fails ? "Could not disconnect" : "Device disconnected");
});

it("ignores other receivers and releases the current session on unexpected disconnection", async () => {
  await mount();
  await connect();
  await act(async () => receiver.emit(gga()));
  await act(() => disconnected(device(makeReceiver("BB"))));
  expect(controller.connectedDevice).toBe(device());
  await act(() => disconnected(device()));
  expect(controller.connectedDevice).toBeNull();
  expect(controller.latestFix).toBeNull();
  expect(controller.latestLine).toBe("");
  expect(controller.connectionMessage).toContain("unexpectedly");
  expect(controller.ntripStatus.state).toBe("disconnected");
  expect(receiver.subscription.remove).toHaveBeenCalledTimes(1);
  expect(receiver.disconnect).not.toHaveBeenCalled();
  await act(() => disconnected(device()));
  expect(receiver.subscription.remove).toHaveBeenCalledTimes(1);
});

it("cleans up a failed receiver configuration and allows a fresh connection", async () => {
  await mount();
  jest.mocked(configureTopcon).mockImplementationOnce(async () => {
    receiver.emit(`${gga()}\n${gsa()}`);
    throw new Error("Configuration rejected");
  });
  await connect();
  expect(receiver.subscription.remove).toHaveBeenCalledTimes(1);
  expect(receiver.disconnect).toHaveBeenCalledTimes(1);
  expect(controller.latestFix).toBeNull();
  expect(controller.gsaDop).toBeNull();
  expect(controller.latestLine).toBe("");
  expect(controller.isConnecting).toBe(false);
  expect(controller.ntripStatus.state).toBe("error");
  expect(controller.connectionMessage).toContain("Configuration rejected");
  expect(sessions).toHaveLength(0);
  await connect();
  expect(controller.connectedDevice).toBe(device());
});

it("removes both listeners and cancels correction retries on unmount", async () => {
  await mount();
  await connect();
  await act(async () => receiver.emit(gga()));
  await act(() => sessions[0].emitStatus("error"));
  await act(() => { root.unmount(); root = null; });
  expect(disconnectSubscription.remove).toHaveBeenCalledTimes(1);
  expect(receiver.subscription.remove).toHaveBeenCalledTimes(1);
  expect(receiver.disconnect).toHaveBeenCalledTimes(1);
  expect(sessions[0].stop).toHaveBeenCalledWith(false);
  await act(async () => {
    receiver.emit(gga());
    await jest.advanceTimersByTimeAsync(60_000);
  });
  expect(sessions).toHaveLength(1);
});

it("cancels a pending permission request before opening a native connection", async () => {
  await mount();
  const permission = deferred<boolean>();
  jest.mocked(ensureBluetoothConnectPermission).mockReturnValueOnce(permission.promise);
  let pending!: Promise<void>;
  await act(async () => { pending = controller.connectSelected("AA"); });
  await act(async () => { await controller.disconnect(); });
  await act(async () => { permission.resolve(true); await pending; });
  expect(BluetoothClassic.connectToDevice).not.toHaveBeenCalled();
  expect(controller.isConnecting).toBe(false);
  expect(controller.connectedDevice).toBeNull();
});

it.each(["disconnect", "unmount"])("closes a late native connection after %s", async (action) => {
  await mount();
  const nativeConnection = deferred<BluetoothDevice>();
  jest.mocked(BluetoothClassic.connectToDevice).mockReturnValueOnce(nativeConnection.promise);
  let pending!: Promise<void>;
  await act(async () => { pending = controller.connectSelected("AA"); });
  if (action === "disconnect") await act(async () => { await controller.disconnect(); });
  else await act(() => { root.unmount(); root = null; });
  await act(async () => { nativeConnection.resolve(device()); await pending; });
  expect(receiver.disconnect).toHaveBeenCalledTimes(1);
  expect(receiver.onDataReceived).not.toHaveBeenCalled();
  expect(configureTopcon).not.toHaveBeenCalled();
  expect(controller.connectedDevice).toBeNull();
});

it("does not restore a receiver when configuration finishes after an unexpected disconnect", async () => {
  await mount();
  const configuration = deferred<void>();
  jest.mocked(configureTopcon).mockReturnValueOnce(configuration.promise);
  let pending!: Promise<void>;
  await act(async () => { pending = controller.connectSelected("AA"); });
  await act(() => { receiver.emit(gga()); disconnected(device()); });
  await act(async () => { configuration.resolve(); await pending; });
  expect(controller.connectedDevice).toBeNull();
  expect(controller.isConnecting).toBe(false);
  expect(controller.latestFix).toBeNull();
  expect(sessions).toHaveLength(0);
  expect(controller.ntripStatus.state).toBe("disconnected");
});

it("allows only one connection attempt when calls arrive before React rerenders", async () => {
  await mount();
  await act(async () => {
    await Promise.all([controller.connectSelected("AA"), controller.connectSelected("BB")]);
  });
  expect(BluetoothClassic.connectToDevice).toHaveBeenCalledTimes(1);
  expect(BluetoothClassic.connectToDevice).toHaveBeenCalledWith("AA", { delimiter: "\n" });
});

it("ignores an old data listener even when reconnecting to the same native device object", async () => {
  await mount();
  await connect();
  await act(async () => { await controller.disconnect(); });
  await connect();
  await act(async () => receiver.emit(gga(), 0));
  expect(controller.latestLine).toBe("");
  expect(sessions).toHaveLength(0);
  await act(async () => receiver.emit(gga(), 1));
  expect(controller.latestFix).not.toBeNull();
  expect(sessions).toHaveLength(1);
});

it("does not let an old disconnect failure overwrite a newer connection", async () => {
  await mount();
  await connect();
  const nativeDisconnect = deferred<boolean>();
  receiver.disconnect.mockReturnValueOnce(nativeDisconnect.promise);
  let pending!: Promise<void>;
  await act(async () => { pending = controller.disconnect(); });
  const nextReceiver = makeReceiver("BB");
  await connect(nextReceiver);
  await act(async () => { nativeDisconnect.reject(new Error("Old disconnect failed")); await pending; });
  expect(controller.connectedDevice).toBe(device(nextReceiver));
  expect(controller.connectionMessage).toBe("Connected to Receiver BB.");
});

it("does not let a cancelled configuration failure release a newer session", async () => {
  await mount();
  const configuration = deferred<void>();
  jest.mocked(configureTopcon).mockReturnValueOnce(configuration.promise);
  let pending!: Promise<void>;
  await act(async () => { pending = controller.connectSelected("AA"); });
  await act(async () => { await controller.disconnect(); });
  const nextReceiver = makeReceiver("BB");
  await connect(nextReceiver);
  await act(async () => { configuration.reject(new Error("Old configuration failed")); await pending; });
  expect(nextReceiver.disconnect).not.toHaveBeenCalled();
  expect(controller.connectedDevice).toBe(device(nextReceiver));
  expect(controller.isConnecting).toBe(false);
});

it("backs off correction retries, resets after streaming, and cancels them on disconnect", async () => {
  await mount();
  await connect();
  await act(async () => receiver.emit(gga()));
  await act(() => sessions[0].emitStatus("error"));
  await act(async () => { await jest.advanceTimersByTimeAsync(1999); });
  expect(sessions).toHaveLength(1);
  await act(async () => { await jest.advanceTimersByTimeAsync(1); });
  expect(sessions).toHaveLength(2);
  await act(() => sessions[1].emitStatus("error"));
  await act(async () => { await jest.advanceTimersByTimeAsync(3999); });
  expect(sessions).toHaveLength(2);
  await act(async () => { await jest.advanceTimersByTimeAsync(1); });
  expect(sessions).toHaveLength(3);
  await act(() => sessions[2].emitStatus("streaming", 100));
  await act(() => sessions[2].emitStatus("error"));
  await act(async () => { await jest.advanceTimersByTimeAsync(2000); });
  expect(sessions).toHaveLength(4);
  await act(() => sessions[3].emitStatus("error"));
  await act(async () => { await controller.disconnect(); });
  await act(async () => { await jest.advanceTimersByTimeAsync(60_000); });
  expect(sessions).toHaveLength(4);
  await connect();
  expect(sessions).toHaveLength(4);
});

it("caches an early usable position and starts corrections only after receiver configuration completes", async () => {
  await mount();
  const configuration = deferred<void>();
  jest.mocked(configureTopcon).mockImplementationOnce(() => {
    receiver.emit(gga());
    return configuration.promise;
  });
  let pending!: Promise<void>;
  await act(async () => { pending = controller.connectSelected("AA"); });
  expect(controller.latestFix).not.toBeNull();
  expect(controller.connectedDevice).toBeNull();
  expect(sessions).toHaveLength(0);
  await act(async () => { configuration.resolve(); await pending; });
  expect(sessions).toHaveLength(1);
  expect(sessions[0].start).toHaveBeenCalledWith(expect.objectContaining({ username: "operator" }), device(), gga());
});

it("keeps an unexpected disconnection authoritative when it occurs while starting corrections from an early position", async () => {
  await mount();
  jest.mocked(configureTopcon).mockImplementationOnce(async () => { receiver.emit(gga()); });
  jest.mocked(NtripConnection).mockImplementationOnce((callbacks) => {
    const session = makeNtrip(callbacks);
    session.start.mockImplementationOnce(async () => { disconnected(device()); });
    sessions.push(session);
    return session as unknown as jest.Mocked<NtripConnection>;
  });
  await connect();
  expect(controller.connectedDevice).toBeNull();
  expect(controller.latestFix).toBeNull();
  expect(controller.isConnecting).toBe(false);
  expect(controller.connectionMessage).toContain("unexpectedly");
  expect(controller.ntripStatus.state).toBe("disconnected");
  expect(sessions[0].stop).toHaveBeenCalledWith(false);
});

it("uses updated settings on retry without restarting Bluetooth or replacing its listeners", async () => {
  await mount();
  await connect();
  await act(async () => receiver.emit(gga()));
  await act(() => sessions[0].emitStatus("error"));
  await act(() => root.update(<Probe euposSettings={{ ...settings, host: "new.caster.example.com", username: "new-operator" }} />));
  expect(BluetoothClassic.onDeviceDisconnected).toHaveBeenCalledTimes(1);
  expect(receiver.onDataReceived).toHaveBeenCalledTimes(1);
  expect(receiver.subscription.remove).not.toHaveBeenCalled();
  expect(receiver.disconnect).not.toHaveBeenCalled();
  await act(async () => { await jest.advanceTimersByTimeAsync(2000); });
  expect(sessions).toHaveLength(2);
  expect(sessions[1].start).toHaveBeenCalledWith(expect.objectContaining({
    host: "new.caster.example.com", username: "new-operator",
  }), device(), gga());
});

it("caps correction retry delays at 30 seconds", async () => {
  await mount();
  await connect();
  await act(async () => receiver.emit(gga()));
  for (const delay of [2000, 4000, 8000, 16000, 30000, 30000]) {
    const count = sessions.length;
    await act(() => sessions[count - 1].emitStatus("error"));
    await act(async () => { await jest.advanceTimersByTimeAsync(delay - 1); });
    expect(sessions).toHaveLength(count);
    await act(async () => { await jest.advanceTimersByTimeAsync(1); });
    expect(sessions).toHaveLength(count + 1);
  }
});

it("ignores old correction statuses and pending start failures after reconnecting the same receiver", async () => {
  await mount();
  const establishment = deferred<void>();
  jest.mocked(NtripConnection).mockImplementationOnce((callbacks) => {
    const session = makeNtrip(callbacks);
    session.start.mockImplementationOnce(() => establishment.promise);
    sessions.push(session);
    return session as unknown as jest.Mocked<NtripConnection>;
  });
  await connect();
  await act(async () => receiver.emit(gga()));
  await act(async () => { await controller.disconnect(); });
  await connect();
  await act(async () => receiver.emit(gga()));
  await act(() => sessions[1].emitStatus("streaming", 100));
  await act(async () => {
    sessions[0].emitStatus("error");
    establishment.reject(new Error("Old start failure"));
  });
  expect(controller.ntripStatus.state).toBe("streaming");
  expect(controller.ntripStatus.bytesReceived).toBe(100);
  await act(async () => { await jest.advanceTimersByTimeAsync(60_000); });
  expect(sessions).toHaveLength(2);
});

it("preserves correction counters when a pending start rejects after reporting status", async () => {
  await mount();
  const establishment = deferred<void>();
  jest.mocked(NtripConnection).mockImplementationOnce((callbacks) => {
    const session = makeNtrip(callbacks);
    session.start.mockImplementationOnce(() => establishment.promise);
    sessions.push(session);
    return session as unknown as jest.Mocked<NtripConnection>;
  });
  await connect();
  await act(async () => receiver.emit(gga()));
  await act(() => sessions[0].emitStatus("error", 128));
  await act(async () => { establishment.reject(new Error("Start failed")); });
  expect(controller.ntripStatus.state).toBe("error");
  expect(controller.ntripStatus.bytesReceived).toBe(128);
  await act(async () => { await jest.advanceTimersByTimeAsync(2000); });
  expect(sessions).toHaveLength(2);
});

it("retains paired-device selection on refresh and falls back when that receiver disappears", async () => {
  await mount();
  const secondDevice = device(makeReceiver("BB"));
  jest.mocked(BluetoothClassic.getBondedDevices).mockResolvedValue([device(), secondDevice]);
  await act(async () => { await controller.refreshDevices(); });
  expect(controller.selectedAddress).toBe("AA");
  await act(() => controller.selectDevice("BB"));
  await act(async () => { await controller.refreshDevices(); });
  expect(controller.selectedDevice).toBe(secondDevice);
  jest.mocked(BluetoothClassic.getBondedDevices).mockResolvedValue([device()]);
  await act(async () => { await controller.refreshDevices(); });
  expect(controller.selectedAddress).toBe("AA");
  expect(controller.isRefreshing).toBe(false);
});

it.each(["permission", "disabled"])("finishes refresh safely when Bluetooth is unavailable: %s", async (reason) => {
  await mount();
  if (reason === "permission") jest.mocked(ensureBluetoothConnectPermission).mockResolvedValue(false);
  else jest.mocked(BluetoothClassic.isBluetoothEnabled).mockResolvedValue(false);
  await act(async () => { await controller.refreshDevices(); });
  expect(controller.isRefreshing).toBe(false);
  expect(controller.connectionMessage).toContain(reason === "permission" ? "permission is required" : "turned off");
  expect(BluetoothClassic.getBondedDevices).not.toHaveBeenCalled();
});

it("shares one provider-owned session across consumers and preserves it when one consumer unmounts", async () => {
  let first!: ReturnType<typeof useBluetoothSerial>;
  let second!: ReturnType<typeof useBluetoothSerial>;
  function FirstConsumer() { first = useGps().bluetooth; return null; }
  function SecondConsumer() { second = useGps().bluetooth; return null; }
  function SharedGps({ showSecond = true }: { showSecond?: boolean }) {
    return <GpsProvider><FirstConsumer />{showSecond && <SecondConsumer />}</GpsProvider>;
  }
  await act(() => { root = create(<SharedGps />); });
  await act(() => first.selectReceiverModel("topcon"));
  await act(async () => { await first.connectSelected("AA"); });
  await act(async () => receiver.emit(gga()));
  expect(first).toBe(second);
  expect(second.connectedDevice).toBe(device());
  expect(BluetoothClassic.onDeviceDisconnected).toHaveBeenCalledTimes(5);
  expect(BluetoothClassic.connectToDevice).toHaveBeenCalledTimes(1);
  expect(receiver.onDataReceived).toHaveBeenCalledTimes(1);
  expect(sessions).toHaveLength(1);
  await act(() => root.update(<SharedGps showSecond={false} />));
  expect(receiver.disconnect).not.toHaveBeenCalled();
  expect(receiver.subscription.remove).not.toHaveBeenCalled();
  expect(sessions[0].stop).not.toHaveBeenCalled();
  await act(() => { root.unmount(); root = null; });
  expect(receiver.disconnect).toHaveBeenCalledTimes(1);
  expect(receiver.subscription.remove).toHaveBeenCalledTimes(1);
  expect(disconnectSubscription.remove).toHaveBeenCalledTimes(5);
  expect(sessions[0].stop).toHaveBeenCalledTimes(1);
});

it("keeps two receivers' positions, GGA updates, caster settings, retries and disconnections independent", async () => {
  const other = makeReceiver("BB");
  let gps!: ReturnType<typeof useGps>;
  function Consumer() { gps = useGps(); return null; }
  await act(() => { root = create(<GpsProvider><Consumer /></GpsProvider>); });
  await act(() => {
    gps.bluetooth.selectReceiverModel("topcon");
    gps.secondBluetooth.selectReceiverModel("kolida");
  });
  jest.mocked(BluetoothClassic.connectToDevice).mockImplementation(async (address) => device(address === "AA" ? receiver : other));
  await act(async () => {
    await Promise.all([gps.bluetooth.connectSelected("AA"), gps.secondBluetooth.connectSelected("BB")]);
  });
  const firstGga = gga({ 6: "4" });
  const secondGga = gga({ 6: "5", 2: "4907.038" });
  await act(async () => { receiver.emit(firstGga); other.emit(secondGga); });
  expect(sessions).toHaveLength(2);
  expect(sessions[0].start).toHaveBeenCalledWith(expect.objectContaining({ username: "operator" }), device(), firstGga);
  expect(sessions[1].start).toHaveBeenCalledWith(expect.objectContaining({ username: "second-operator", mountpoint: "SECOND" }), device(other), secondGga);
  expect(gps.bluetooth.latestFix?.quality).toBe(4);
  expect(gps.secondBluetooth.latestFix?.quality).toBe(5);
  expect(gps.bluetooth.latestFix?.latitude).not.toBe(gps.secondBluetooth.latestFix?.latitude);
  const updatedGga = gga({ 1: "123520", 6: "4" });
  await act(async () => other.emit(updatedGga));
  expect(sessions[1].updateGga).toHaveBeenLastCalledWith(updatedGga);
  expect(sessions[0].updateGga).not.toHaveBeenCalled();
  await act(() => sessions[1].emitStatus("error"));
  await act(async () => { await jest.advanceTimersByTimeAsync(2000); });
  expect(sessions).toHaveLength(3);
  expect(sessions[2].start).toHaveBeenCalledWith(expect.anything(), device(other), updatedGga);
  expect(sessions[0].stop).not.toHaveBeenCalled();
  await act(() => disconnected(device(other)));
  expect(gps.secondBluetooth.latestFix).toBeNull();
  expect(gps.secondBluetooth.connectedDevice).toBeNull();
  expect(gps.bluetooth.connectedDevice).toBe(device());
  expect(gps.bluetooth.latestFix?.quality).toBe(4);
  expect(sessions[2].stop).toHaveBeenCalled();
  expect(sessions[0].stop).not.toHaveBeenCalled();
  await act(async () => { await gps.secondBluetooth.connectSelected("BB"); other.emit(secondGga); });
  await act(() => { root.unmount(); root = null; });
  expect(receiver.disconnect).toHaveBeenCalledTimes(1);
  expect(other.disconnect).toHaveBeenCalledTimes(1);
  expect(sessions[0].stop).toHaveBeenCalledTimes(1);
  expect(sessions[3].stop).toHaveBeenCalledTimes(1);
});

it("reserves a device across both slots until a cancelled native connection has finished closing", async () => {
  let gps!: ReturnType<typeof useGps>;
  function Consumer() { gps = useGps(); return null; }
  await act(() => { root = create(<GpsProvider><Consumer /></GpsProvider>); });
  await act(() => {
    gps.bluetooth.selectReceiverModel("topcon");
    gps.secondBluetooth.selectReceiverModel("topcon");
  });
  const pending = deferred<BluetoothDevice>();
  jest.mocked(BluetoothClassic.connectToDevice).mockReturnValueOnce(pending.promise);
  let connecting!: Promise<void>;
  await act(async () => { connecting = gps.bluetooth.connectSelected("AA"); });
  await act(async () => { await gps.secondBluetooth.connectSelected("aa"); });
  expect(BluetoothClassic.connectToDevice).toHaveBeenCalledTimes(1);
  expect(gps.secondBluetooth.connectionMessage).toContain("already assigned");
  await act(async () => { await gps.bluetooth.disconnect(); });
  await act(async () => { await gps.secondBluetooth.connectSelected("AA"); });
  expect(BluetoothClassic.connectToDevice).toHaveBeenCalledTimes(1);
  await act(async () => { pending.resolve(device()); await connecting; });
  expect(receiver.disconnect).toHaveBeenCalledTimes(1);
  await act(async () => { await gps.secondBluetooth.connectSelected("AA"); });
  expect(BluetoothClassic.connectToDevice).toHaveBeenCalledTimes(2);
  expect(gps.secondBluetooth.connectedDevice).toBe(device());
  expect(gps.bluetooth.connectedDevice).toBeNull();
});

it("receives three assigned UUIDs, rejects mismatches, expires poses and cleans up without sending GNSS commands", async () => {
  let gps!: ReturnType<typeof useGps>;
  const hardware = [makeReceiver("IMU1"), makeReceiver("IMU2"), makeReceiver("IMU3")];
  hardware.forEach((item, index) => { item.name = `DualGPS-IMU-${IMU_TEST_UUIDS[(["boom", "arm", "bucket"] as const)[index]]}`; });
  function Consumer() { gps = useGps(); return null; }
  await act(() => { root = create(<GpsProvider><Consumer /></GpsProvider>); });
  jest.mocked(BluetoothClassic.connectToDevice).mockImplementation(async (address) => device(hardware.find((item) => item.address === address)!));
  jest.mocked(BluetoothClassic.getBondedDevices).mockResolvedValue(hardware.map((item) => device(item)));
  await act(async () => { await Promise.all(gps.imus.sensors.map((sensor) => sensor.refreshDevices())); });
  await act(async () => {
    await Promise.all(gps.imus.sensors.map((sensor, index) => sensor.connectSelected(hardware[index].address)));
  });
  expect(configureTopcon).not.toHaveBeenCalled();
  expect(NtripConnection).not.toHaveBeenCalled();
  await act(() => hardware[0].emit(JSON.stringify(imuPacket("arm"))));
  expect(gps.imus.sensors[0].error).toContain("UUID does not match");
  expect(gps.imus.pose).toBeNull();
  await act(() => {
    hardware.forEach((item, index) => item.emit(JSON.stringify(imuPacket((["boom", "arm", "bucket"] as const)[index]))));
  });
  expect(gps.imus.pose).toEqual({ boom: 60, arm: 60, bucket: 60 });
  await act(() => disconnected(device(hardware[1])));
  expect(gps.imus.sensors[1].reading).toBeNull();
  expect(gps.imus.sensors[0].reading?.uuid).toBe(IMU_TEST_UUIDS.boom);
  expect(gps.imus.pose).toBeNull();
  await act(async () => { await gps.imus.sensors[1].connectSelected("IMU2"); });
  await act(() => hardware[1].emit(JSON.stringify(imuPacket("arm"))));
  expect(gps.imus.pose).not.toBeNull();
  await act(async () => { await jest.advanceTimersByTimeAsync(1000); });
  expect(gps.imus.pose).toBeNull();
  expect(gps.imus.sensors.every((sensor) => !sensor.fresh)).toBe(true);
  await act(() => { root.unmount(); root = null; });
  expect(hardware.every((item) => item.disconnect.mock.calls.length === 1)).toBe(true);
  expect(hardware[0].subscription.remove).toHaveBeenCalledTimes(1);
  expect(NtripConnection).not.toHaveBeenCalled();
});

it("restores an arbitrary UUID-to-section choice and requires clearing it before assigning the same board elsewhere", async () => {
  let gps!: ReturnType<typeof useGps>;
  const binding = { uuid: IMU_TEST_UUIDS.bucket, address: "CC" };
  mockImuStorage.getItem.mockResolvedValue(JSON.stringify({ boom: binding }));
  const board = makeReceiver("CC");
  board.name = `DualGPS-IMU-${binding.uuid}`;
  jest.mocked(BluetoothClassic.getBondedDevices).mockResolvedValue([device(board)]);
  jest.mocked(BluetoothClassic.connectToDevice).mockResolvedValue(device(board));
  function Consumer() { gps = useGps(); return null; }
  await act(async () => { root = create(<GpsProvider><Consumer /></GpsProvider>); });
  expect(gps.imus.sensors[0].binding).toEqual(binding);
  expect(gps.imus.sensors[0].selectedAddress).toBe("CC");
  await act(async () => { await Promise.all(gps.imus.sensors.map((sensor) => sensor.refreshDevices())); });
  await act(async () => { await gps.imus.sensors[0].connectSelected(); });
  await act(() => board.emit(JSON.stringify(imuPacket("bucket", { angle: 75 }))));
  expect(gps.imus.sensors[0].reading?.angle).toBe(75);
  await act(async () => { await gps.imus.sensors[1].connectSelected("CC"); });
  expect(gps.imus.sensors[1].error).toContain("assigned to boom");
  expect(BluetoothClassic.connectToDevice).toHaveBeenCalledTimes(1);
  await act(async () => { await gps.imus.sensors[0].disconnect(); });
  await act(async () => { await gps.imus.sensors[0].clearAssignment(); });
  expect(gps.imus.sensors[0].binding).toBeNull();
  await act(async () => { await gps.imus.sensors[1].connectSelected("CC"); });
  await act(() => board.emit(JSON.stringify(imuPacket("bucket", { angle: -25 }))));
  expect(gps.imus.sensors[1].reading?.angle).toBe(-25);
  expect(gps.imus.sensors[0].reading).toBeNull();
  expect(JSON.parse(mockImuStorage.setItem.mock.calls.at(-1)![1])).toEqual({ arm: binding });
});

it("does not open Bluetooth when assignment persistence fails, and supports retry and cancellation during saving", async () => {
  let gps!: ReturnType<typeof useGps>;
  const board = makeReceiver("DD");
  board.name = `DualGPS-IMU-${IMU_TEST_UUIDS.boom}`;
  jest.mocked(BluetoothClassic.getBondedDevices).mockResolvedValue([device(board)]);
  jest.mocked(BluetoothClassic.connectToDevice).mockResolvedValue(device(board));
  function Consumer() { gps = useGps(); return null; }
  await act(async () => { root = create(<GpsProvider><Consumer /></GpsProvider>); });
  await act(async () => { await gps.imus.sensors[0].refreshDevices(); });
  mockImuStorage.setItem.mockRejectedValueOnce(new Error("Storage unavailable"));
  await act(async () => { await gps.imus.sensors[0].connectSelected("DD"); });
  expect(gps.imus.sensors[0].error).toContain("Could not save IMU assignment");
  expect(BluetoothClassic.connectToDevice).not.toHaveBeenCalled();
  const pending = deferred<void>();
  mockImuStorage.setItem.mockReturnValueOnce(pending.promise);
  let connecting!: Promise<void>;
  await act(async () => { connecting = gps.imus.sensors[0].connectSelected("DD"); });
  expect(gps.imus.sensors[0].isConnecting).toBe(true);
  await act(async () => { await gps.imus.sensors[0].disconnect(); });
  await act(async () => { pending.resolve(); await connecting; });
  expect(BluetoothClassic.connectToDevice).not.toHaveBeenCalled();
  await act(async () => { await gps.imus.sensors[0].connectSelected("DD"); });
  expect(gps.imus.sensors[0].connectedDevice).toBe(device(board));
});
