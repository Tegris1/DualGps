import { expect, it, jest } from "@jest/globals";
import { act } from "react";
import { DEMO_ACCOUNT, DemoSessionProvider, useDemoSession } from "../../features/demo/session-context";

const { create } = require("react-test-renderer");

it("rejects invalid credentials, signs in locally, signs out, and forgets a remounted session", async () => {
  let session!: ReturnType<typeof useDemoSession>;
  function Probe() { session = useDemoSession(); return null; }
  const previousActEnvironment = Reflect.get(globalThis, "IS_REACT_ACT_ENVIRONMENT");
  Reflect.set(globalThis, "IS_REACT_ACT_ENVIRONMENT", true);
  const originalError = console.error;
  const errorSpy = jest.spyOn(console, "error").mockImplementation((...args) => {
    if (!String(args[0]).startsWith("react-test-renderer is deprecated")) originalError(...args);
  });
  let root: ReturnType<typeof create>;
  try {
    await act(() => { root = create(<DemoSessionProvider><Probe /></DemoSessionProvider>); });
    expect(session.isSignedIn).toBe(false);
    await act(() => { expect(session.signIn("wrong@example.com", DEMO_ACCOUNT.password)).toBe(false); });
    await act(() => { expect(session.signIn(DEMO_ACCOUNT.email, "wrong")).toBe(false); });
    expect(session.isSignedIn).toBe(false);
    await act(() => { expect(session.signIn(` ${DEMO_ACCOUNT.email.toUpperCase()} `, DEMO_ACCOUNT.password)).toBe(true); });
    expect(session.isSignedIn).toBe(true);
    await act(() => session.signOut());
    expect(session.isSignedIn).toBe(false);
    await act(() => { session.signIn(DEMO_ACCOUNT.email, DEMO_ACCOUNT.password); });
    await act(() => root.unmount());
    await act(() => { root = create(<DemoSessionProvider><Probe /></DemoSessionProvider>); });
    expect(session.isSignedIn).toBe(false);
  } finally {
    await act(() => root?.unmount());
    errorSpy.mockRestore();
    Reflect.set(globalThis, "IS_REACT_ACT_ENVIRONMENT", previousActEnvironment);
  }
});
