import { afterEach, beforeEach, expect, it, jest } from "@jest/globals";
import type { BluetoothDevice } from "react-native-bluetooth-classic";

import { configureTopcon, TOPCON_SETUP_COMMANDS } from "../../lib/gps/receiver-profiles";

beforeEach(() => { jest.useFakeTimers(); });
afterEach(() => { jest.clearAllTimers(); jest.useRealTimers(); });

it("preserves the complete Topcon setup when no cancellation callback is supplied", async () => {
  const write = jest.fn<() => Promise<boolean>>().mockResolvedValue(true);
  const device = { write } as unknown as BluetoothDevice;
  const configured = configureTopcon(device, "topcon");
  await jest.advanceTimersByTimeAsync(TOPCON_SETUP_COMMANDS.length * 100);
  await configured;
  expect(write.mock.calls).toEqual(TOPCON_SETUP_COMMANDS.map((command) => [`${command}\r\n`, "ascii"]));
});

it("stops remaining setup commands when cancellation occurs during the delay", async () => {
  let active = true;
  const write = jest.fn<() => Promise<boolean>>().mockResolvedValue(true);
  const device = { write } as unknown as BluetoothDevice;
  const configured = configureTopcon(device, "topcon", () => active);
  await jest.advanceTimersByTimeAsync(1);
  expect(write).toHaveBeenCalledTimes(1);
  active = false;
  await jest.advanceTimersByTimeAsync(1000);
  await configured;
  expect(write).toHaveBeenCalledTimes(1);
});

it("stops after a pending native write completes for a cancelled session", async () => {
  let active = true;
  let finishWrite!: (written: boolean) => void;
  const write = jest.fn(() => new Promise<boolean>((resolve) => { finishWrite = resolve; }));
  const device = { write } as unknown as BluetoothDevice;
  const configured = configureTopcon(device, "topcon", () => active);
  active = false;
  finishWrite(true);
  await configured;
  expect(write).toHaveBeenCalledTimes(1);
  expect(jest.getTimerCount()).toBe(0);
});

it("does not send configuration commands for an already cancelled attempt or a Kolida profile", async () => {
  const write = jest.fn<() => Promise<boolean>>().mockResolvedValue(true);
  const device = { write } as unknown as BluetoothDevice;
  await configureTopcon(device, "topcon", () => false);
  await configureTopcon(device, "kolida");
  expect(write).not.toHaveBeenCalled();
});
