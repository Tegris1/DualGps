import { afterAll, afterEach, beforeAll, beforeEach, expect, it, jest } from "@jest/globals";
import { act } from "react";
import BluetoothClassic, { type BluetoothDevice } from "react-native-bluetooth-classic";

import { useBluetoothSerial } from "../../hooks/use-bluetooth-serial";
import { DEFAULT_EUPOS_SETTINGS } from "../../lib/gps/eupos-settings";
import { NtripConnection, type NtripConnectionCallbacks, type NtripState } from "../../lib/gps/ntrip-connection";
import { configureTopcon } from "../../lib/gps/receiver-profiles";
import { ensureBluetoothConnectPermission } from "../../utils/bluetoothPermisisons";
import { gga, gsa } from "../fixtures/nmea";

jest.mock("react-native", () => ({ NativeModules: { RNBluetoothClassic: {} } }));
jest.mock("react-native-bluetooth-classic", () => ({
  __esModule: true,
  default: { onDeviceDisconnected: jest.fn(), connectToDevice: jest.fn() },
}));
jest.mock("../../lib/gps/ntrip-connection", () => ({ NtripConnection: jest.fn() }));
jest.mock("../../lib/gps/receiver-profiles", () => ({ configureTopcon: jest.fn() }));
jest.mock("../../utils/bluetoothPermisisons", () => ({ ensureBluetoothConnectPermission: jest.fn() }));

const { create } = require("react-test-renderer");
let root: ReturnType<typeof create> | null;
let controller!: ReturnType<typeof useBluetoothSerial>;
let receiver: ReturnType<typeof makeReceiver>;
let sessions: ReturnType<typeof makeNtrip>[];
let disconnected: (device: BluetoothDevice) => void;
const disconnectSubscription = { remove: jest.fn() };
const settings = { ...DEFAULT_EUPOS_SETTINGS, username: "operator", password: "secret" };
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

function Probe() {
  controller = useBluetoothSerial(settings);
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
  jest.mocked(ensureBluetoothConnectPermission).mockReset().mockResolvedValue(true);
  jest.mocked(configureTopcon).mockReset().mockResolvedValue(undefined);
  jest.mocked(BluetoothClassic.connectToDevice).mockReset().mockResolvedValue(device());
  jest.mocked(BluetoothClassic.onDeviceDisconnected).mockImplementation((listener) => {
    disconnected = (value) => listener({ device: value } as unknown as Parameters<typeof listener>[0]);
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
