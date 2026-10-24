import { afterAll, afterEach, beforeAll, expect, it, jest } from "@jest/globals";
import { act } from "react";

import { useReceiverDiagnostics } from "../../features/gps/hooks/use-receiver-diagnostics";
import { gga, gsa } from "../fixtures/nmea";

const { create } = require("react-test-renderer");
let root: ReturnType<typeof create>;
let diagnostics!: ReturnType<typeof useReceiverDiagnostics>;
const previousActEnvironment = Reflect.get(globalThis, "IS_REACT_ACT_ENVIRONMENT");
const originalError = console.error;
let errorSpy: ReturnType<typeof jest.spyOn>;

function Probe() {
  diagnostics = useReceiverDiagnostics();
  return null;
}

beforeAll(() => {
  Reflect.set(globalThis, "IS_REACT_ACT_ENVIRONMENT", true);
  errorSpy = jest.spyOn(console, "error").mockImplementation((...args) => {
    if (!String(args[0]).startsWith("react-test-renderer is deprecated")) originalError(...args);
  });
});

afterEach(async () => { await act(() => root?.unmount()); });
afterAll(() => {
  errorSpy.mockRestore();
  Reflect.set(globalThis, "IS_REACT_ACT_ENVIRONMENT", previousActEnvironment);
});

it("updates GNSS readings and returns only usable GGA sentences in receive order", async () => {
  await act(() => { root = create(<Probe />); });
  const first = gga();
  const second = gga({ 1: "123520" });
  const invalid = first.slice(0, -2) + "ZZ";
  let positions: string[] = [];
  await act(() => {
    positions = diagnostics.acceptData(` ${first}\r\n${gsa()}\n${gga({ 6: "0" })}\n${invalid}\n${second}\n\n`);
  });
  expect(positions).toEqual([first, second]);
  expect(diagnostics.latestFix?.sentence).toBe(second);
  expect(diagnostics.gsaDop?.pdop).toBe(1.8);
  expect(diagnostics.latestLine).toBe(second);
  expect(diagnostics.consoleEntries).toHaveLength(5);
  expect(diagnostics.consoleEntries[0].message).toBe(first);
});

it("bounds the console across batched packets and keeps IDs unique after clearing", async () => {
  await act(() => { root = create(<Probe />); });
  await act(() => {
    diagnostics.acceptData(Array.from({ length: 200 }, (_, index) => `line-${index}`).join("\n"));
    diagnostics.acceptData(Array.from({ length: 5 }, (_, index) => `line-${index + 200}`).join("\n"));
  });
  expect(diagnostics.consoleEntries).toHaveLength(200);
  expect(diagnostics.consoleEntries[0]).toMatchObject({ id: 5, message: "line-5" });
  expect(diagnostics.consoleEntries[199]).toMatchObject({ id: 204, message: "line-204" });
  await act(() => diagnostics.clearConsole());
  expect(diagnostics.consoleEntries).toHaveLength(0);
  await act(() => { diagnostics.acceptData("next line"); });
  expect(diagnostics.consoleEntries[0]).toMatchObject({ id: 205, message: "next line", time: expect.any(String) });
});

it("clears console history separately from readings and preserves history when a receiver is released", async () => {
  await act(() => { root = create(<Probe />); });
  await act(() => { diagnostics.acceptData(`${gga()}\n${gsa()}`); });
  const fix = diagnostics.latestFix;
  await act(() => diagnostics.clearConsole());
  expect(diagnostics.consoleEntries).toHaveLength(0);
  expect(diagnostics.latestFix).toBe(fix);
  await act(() => { diagnostics.acceptData(gga()); });
  await act(() => diagnostics.resetReadings());
  expect(diagnostics.latestFix).toBeNull();
  expect(diagnostics.gsaDop).toBeNull();
  expect(diagnostics.latestLine).toBe("");
  expect(diagnostics.consoleEntries).toHaveLength(1);
});
