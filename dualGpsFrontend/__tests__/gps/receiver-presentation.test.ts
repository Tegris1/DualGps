import { expect, it } from "@jest/globals";

import { getNtripPresentation } from "../../features/gps/presentation/ntrip-status";
import { getReceiverPresentation } from "../../features/gps/presentation/receiver-state";
import type { NtripConnectionStatus, NtripState } from "../../lib/gps/ntrip-connection";

const receiver = {
  connectedDevice: null, selectedDevice: undefined, receiverModel: "topcon" as const,
  isConnecting: false, connectionMessage: "Ready",
};

it("allows setup to choose a receiver while keeping direct Connect disabled until a device is selected", () => {
  const state = getReceiverPresentation(receiver);
  expect(state.canConnectToDevice).toBe(true);
  expect(state.connectAction.disabled).toBe(true);
  expect(state.connectionAction.disabled).toBe(true);
  expect(state.showDevicePrompt).toBe(true);
  expect(state.deviceName).toBe("No device selected");
});

it("prefers the connected receiver over another selection and keeps Disconnect available", () => {
  const state = getReceiverPresentation({
    ...receiver, selectedDevice: { address: "BB", name: "Selected receiver" },
    connectedDevice: { address: "AA", name: null },
  });
  expect(state.deviceName).toBe("AA");
  expect(state.connectedAddress).toBe("AA");
  expect(state.canSelectProfile).toBe(false);
  expect(state.connectAction.disabled).toBe(true);
  expect(state.connectionAction).toEqual({ label: "Disconnect", disabled: false, loading: false });
  expect(state.connectionBanner).toEqual({ variant: "success", message: "Ready" });
});

it.each<[NtripState, string, string]>([
  ["idle", "info", "Waiting for a valid GGA position from the receiver."],
  ["connecting", "info", "Connecting to the NTRIP caster."],
  ["disconnected", "info", "NTRIP is disconnected."],
  ["error", "error", "NTRIP connection failed."],
])("provides a consistent %s fallback and severity", (state, variant, message) => {
  const status: NtripConnectionStatus = {
    state, bytesReceived: 0, bytesSentToReceiver: 0, rtcm: { validFrames: 0, invalidFrames: 0 },
  };
  const presentation = getNtripPresentation(status);
  expect(presentation.banner).toEqual({ variant, message });
  expect(presentation.details).toContainEqual({ label: "Message", value: message });
  expect(presentation.details).toContainEqual({ label: "Last GGA written", value: "Not sent yet" });
});

it("preserves zero-valued counters, message types, and timestamps in streaming diagnostics", () => {
  const presentation = getNtripPresentation({
    state: "streaming", bytesReceived: 0, bytesSentToReceiver: 0,
    rtcm: { validFrames: 0, invalidFrames: 0, lastMessageType: 0 }, lastGgaSentAt: 0,
  });
  expect(presentation.banner).toEqual({
    variant: "success", message: "NTRIP corrections active 0 valid RTCM frames, 0 bytes forwarded.",
  });
  expect(presentation.details).toContainEqual({ label: "Correction bytes received", value: 0 });
  expect(presentation.details).toContainEqual({ label: "Last RTCM message", value: 0 });
  expect(presentation.details).toContainEqual({ label: "Last GGA written", value: new Date(0).toLocaleTimeString() });
});
