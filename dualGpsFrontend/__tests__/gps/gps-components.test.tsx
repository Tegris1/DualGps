import { afterAll, afterEach, beforeAll, expect, it, jest } from "@jest/globals";
import { act, type ReactElement } from "react";
import { Text } from "react-native";
import type { BluetoothDevice } from "react-native-bluetooth-classic";

import ConnectionSetup from "../../app/(tabs)/connection_setup";
import { GnssSolutionDetails } from "../../components/gps/gnss-solution-details";
import { ReceiverDeviceList } from "../../components/gps/receiver-device-list";
import { ReceiverProfileSelector } from "../../components/gps/receiver-profile-selector";
import { BluetoothSettings } from "../../components/settings/bluetooth-settings";
import { DebugConsole } from "../../components/settings/debug-console";
import type { BluetoothSerialController } from "../../hooks/use-bluetooth-serial";
import type { GgaFix } from "../../lib/gps/nmea";

jest.mock("@expo/vector-icons/MaterialIcons", () => "MaterialIcons");
jest.mock("../../lib/gps-context", () => ({ useGps: () => ({ bluetooth: mockBluetooth }) }));

const { create } = require("react-test-renderer");
let root: ReturnType<typeof create>;
let mockBluetooth: BluetoothSerialController;
const previousActEnvironment = Reflect.get(globalThis, "IS_REACT_ACT_ENVIRONMENT");
const originalError = console.error;
let errorSpy: ReturnType<typeof jest.spyOn>;

beforeAll(() => {
  Reflect.set(globalThis, "IS_REACT_ACT_ENVIRONMENT", true);
  errorSpy = jest.spyOn(console, "error").mockImplementation((...args) => {
    if (!String(args[0]).startsWith("react-test-renderer is deprecated")) originalError(...args);
  });
});

afterEach(async () => {
  await act(() => root?.unmount());
});

afterAll(() => {
  errorSpy.mockRestore();
  Reflect.set(globalThis, "IS_REACT_ACT_ENVIRONMENT", previousActEnvironment);
});

async function render(element: ReactElement) {
  await act(() => { root = create(element); });
}

function textContent(value: unknown): string {
  if (Array.isArray(value)) return value.map(textContent).join("");
  return typeof value === "string" || typeof value === "number" ? String(value) : "";
}

function readings(): string[] {
  return root.root.findAllByType(Text).map((node: any) => textContent(node.props.children));
}

function action(label: string) {
  return root.root.find((node: any) =>
    node.props.accessibilityLabel === label && typeof node.props.onPress === "function",
  );
}

function fix(overrides: Partial<GgaFix> = {}): GgaFix {
  return { sentence: "$GPGGA", receivedAt: 0, quality: 4, ...overrides };
}

function controller(overrides: Partial<BluetoothSerialController> = {}): BluetoothSerialController {
  const device = { address: "AA", name: "Test receiver" } as BluetoothDevice;
  return {
    devices: [device], selectedAddress: "AA", selectedDevice: device, connectedDevice: null,
    receiverModel: "topcon", connectionMessage: "Ready", isConnecting: false, isRefreshing: false,
    latestFix: null, gsaDop: null, latestLine: "", consoleEntries: [],
    ntripStatus: {
      state: "idle", bytesReceived: 0, bytesSentToReceiver: 0,
      rtcm: { validFrames: 0, invalidFrames: 0 },
    },
    connectSelected: jest.fn(async () => {}), disconnect: jest.fn(async () => {}),
    refreshDevices: jest.fn(async () => {}), selectDevice: jest.fn(),
    selectReceiverModel: jest.fn(), clearConsole: jest.fn(),
    ...overrides,
  };
}

it("shows missing readings without units and makes sentence and UTC rows optional", async () => {
  await render(<GnssSolutionDetails latestFix={null} gsaDop={null} />);
  expect(readings()).toEqual([
    "Fix: Waiting for GGA", "Latitude: —", "Longitude: —", "Altitude (MSL): —",
    "Satellites: —", "HDOP: —", "VDOP: —", "PDOP: —",
  ]);
  await act(() => root.update(<GnssSolutionDetails latestFix={null} gsaDop={null} latestLine="" showUtc />));
  expect(readings()).toEqual(expect.arrayContaining(["UTC: —", "Last sentence: —"]));
});

it("formats measurements consistently, keeps zero values, and prefers GGA HDOP", async () => {
  await render(
    <GnssSolutionDetails
      latestFix={fix({ latitude: 0, longitude: -12.345678912, altitude: 0, satellites: 0, hdop: 0, utcTime: "123456" })}
      gsaDop={{ receivedAt: 0, hdop: 1.5, vdop: 0, pdop: 0 }}
      latestLine="$GPGGA"
      showUtc
    />,
  );
  expect(readings()).toEqual([
    "Fix: RTK FIXED (4)", "Latitude: 0.00000000°", "Longitude: -12.34567891°", "Altitude (MSL): 0.000 m",
    "Satellites: 0", "HDOP: 0", "VDOP: 0", "PDOP: 0", "UTC: 123456", "Last sentence: $GPGGA",
  ]);
});

it("falls back to GSA HDOP while GGA is missing or has no HDOP", async () => {
  const gsaDop = { receivedAt: 0, hdop: 1.25 };
  await render(<GnssSolutionDetails latestFix={null} gsaDop={gsaDop} />);
  expect(readings()).toContain("HDOP: 1.25");
  await act(() => root.update(<GnssSolutionDetails latestFix={fix()} gsaDop={gsaDop} />));
  expect(readings()).toContain("HDOP: 1.25");
});

it("reports profile selection, calls the supplied action, and exposes disabled state and Kolida guidance", async () => {
  const onChange = jest.fn();
  await render(<ReceiverProfileSelector value="topcon" onChange={onChange} />);
  expect(action("Topcon").props.accessibilityState.checked).toBe(true);
  expect(action("Kolida").props.accessibilityState.checked).toBe(false);
  await act(() => action("Kolida").props.onPress());
  expect(onChange).toHaveBeenCalledWith("kolida");
  await act(() => root.update(<ReceiverProfileSelector value="kolida" disabled onChange={onChange} />));
  expect(action("Topcon").props.disabled).toBe(true);
  expect(action("Kolida").props.accessibilityState).toEqual({ checked: true, disabled: true });
  expect(readings().some((line) => line.includes("configure NMEA output and RTCM 3 input"))).toBe(true);
});

it("shows empty receivers, unnamed devices, selection, connection badges, and device actions", async () => {
  const onSelect = jest.fn();
  await render(<ReceiverDeviceList devices={[]} selectedAddress={null} onSelect={onSelect} />);
  expect(readings()).toContain("No devices loaded");
  const devices = [{ address: "AA", name: "Receiver" }, { address: "BB" }];
  await act(() => root.update(
    <ReceiverDeviceList devices={devices} selectedAddress="BB" connectedAddress="AA" onSelect={onSelect} />,
  ));
  expect(readings()).toEqual(expect.arrayContaining(["Connected", "Unnamed receiver", "BB"]));
  expect(action("Receiver, AA").props.accessibilityState.selected).toBe(false);
  expect(action("Unnamed receiver, BB").props.accessibilityState.selected).toBe(true);
  await act(() => action("Unnamed receiver, BB").props.onPress());
  expect(onSelect).toHaveBeenCalledWith("BB");
  await act(() => root.update(<ReceiverDeviceList devices={devices} selectedAddress="BB" disabled onSelect={onSelect} />));
  expect(action("Unnamed receiver, BB").props.disabled).toBe(true);
});

it.each(["setup", "settings"] as const)("preserves the %s screen's device action", async (screen) => {
  mockBluetooth = controller();
  await render(screen === "setup" ? <ConnectionSetup /> : <BluetoothSettings bluetooth={mockBluetooth} onOpenDebug={() => {}} />);
  await act(() => action("Test receiver, AA").props.onPress());
  expect(mockBluetooth.selectDevice).toHaveBeenCalledWith("AA");
  if (screen === "setup") {
    expect(mockBluetooth.connectSelected).toHaveBeenCalledWith("AA");
  } else {
    expect(mockBluetooth.connectSelected).not.toHaveBeenCalled();
    const connectButton = root.root.find((node: any) => node.props.label === "Connect selected device");
    await act(() => connectButton.props.onPress());
    expect(mockBluetooth.connectSelected).toHaveBeenCalledWith();
  }
});

it("requires a profile before setup connects and disables profile changes on a connected receiver", async () => {
  mockBluetooth = controller({ receiverModel: null });
  await render(<ConnectionSetup />);
  expect(action("Test receiver, AA").props.disabled).toBe(true);
  await act(() => action("Topcon").props.onPress());
  expect(mockBluetooth.selectReceiverModel).toHaveBeenCalledWith("topcon");
  const device = mockBluetooth.devices[0];
  await act(() => root.update(<BluetoothSettings bluetooth={controller({ connectedDevice: device })} onOpenDebug={() => {}} />));
  expect(action("Topcon").props.disabled).toBe(true);
  expect(action("Kolida").props.disabled).toBe(true);
});

it("uses the same fallback readings in setup and the debug console, with UTC available in setup", async () => {
  mockBluetooth = controller({ latestFix: fix({ utcTime: "123456" }), gsaDop: { receivedAt: 0, hdop: 1.25 } });
  await render(<ConnectionSetup />);
  expect(readings()).toEqual(expect.arrayContaining(["HDOP: 1.25", "UTC: 123456"]));
  await act(() => root.update(<DebugConsole bluetooth={mockBluetooth} onSelectDevice={() => {}} />));
  expect(readings()).toContain("HDOP: 1.25");
  expect(readings()).not.toContain("UTC: 123456");
});
