import { afterAll, afterEach, beforeAll, beforeEach, expect, it, jest } from "@jest/globals";
import { act } from "react";
import { Button, Text, TextInput } from "react-native-paper";

import AuthScreen from "../../app/auth";
import { AuthApiError } from "../../features/auth/api/auth-errors";
import type { AuthFailure } from "../../features/auth/errors";
import { useAuth } from "../../features/auth/auth-context";

jest.mock("../../features/auth/auth-context", () => ({ useAuth: jest.fn() }));
jest.mock("react-native-paper", () => ({
  Button: "PaperButton", Text: "PaperText", TextInput: "PaperTextInput",
  useTheme: () => ({ colors: { error: "red" } }),
}));

const { create } = require("react-test-renderer");
let root: ReturnType<typeof create>;
const signIn = jest.fn<(email: string, password: string) => Promise<AuthFailure | null>>();
const signUp = jest.fn<(username: string, email: string, password: string) => Promise<AuthFailure | null>>();
const previousActEnvironment = Reflect.get(globalThis, "IS_REACT_ACT_ENVIRONMENT");
const originalError = console.error;
let errorSpy: ReturnType<typeof jest.spyOn>;

beforeAll(() => {
  Reflect.set(globalThis, "IS_REACT_ACT_ENVIRONMENT", true);
  errorSpy = jest.spyOn(console, "error").mockImplementation((...args) => {
    if (!String(args[0]).startsWith("react-test-renderer is deprecated")) originalError(...args);
  });
});

beforeEach(() => {
  signIn.mockReset().mockResolvedValue(null);
  signUp.mockReset().mockResolvedValue(null);
  jest.mocked(useAuth).mockReturnValue({
    user: null, token: null, isLoadingUser: false, signIn, signUp,
    signOut: jest.fn(async () => {}),
  });
});

afterEach(async () => {
  await act(() => root?.unmount());
});

afterAll(() => {
  errorSpy.mockRestore();
  Reflect.set(globalThis, "IS_REACT_ACT_ENVIRONMENT", previousActEnvironment);
});

async function render() {
  await act(() => { root = create(<AuthScreen />); });
}

function input(label: string) {
  return root.root.findAllByType(TextInput).find((node: any) => node.props.label === label);
}

function submitButton() {
  return root.root.findAllByType(Button).find((node: any) => node.props.mode === "contained");
}

function switchButton() {
  return root.root.findAllByType(Button).find((node: any) => node.props.mode === "text");
}

function errors() {
  return root.root.findAllByType(Text).filter((node: any) => node.props.accessibilityRole === "alert")
    .map((node: any) => node.props.children);
}

async function enterCredentials() {
  await act(() => {
    input("Email").props.onChangeText(" Operator@Example.com ");
    input("Password").props.onChangeText(" secret ");
  });
}

it("displays validation failures without attempting authentication", async () => {
  await render();
  expect(input("Username")).toBeUndefined();
  expect(input("Password").props.secureTextEntry).toBe(true);
  await act(async () => { await submitButton().props.onPress(); });
  expect(errors()).toEqual(["Please fill in both email and password fields."]);
  expect(signIn).not.toHaveBeenCalled();
  expect(signUp).not.toHaveBeenCalled();
  expect(submitButton().props.loading).toBe(false);
});

it("switches modes, clears old errors, retains fields, and submits sign-up through the session action", async () => {
  await render();
  await enterCredentials();
  await act(() => switchButton().props.onPress());
  expect(submitButton().props.children).toBe("Create Account");
  await act(async () => { await submitButton().props.onPress(); });
  expect(errors()).toEqual(["Please enter a username."]);
  expect(signUp).not.toHaveBeenCalled();
  await act(() => switchButton().props.onPress());
  expect(errors()).toEqual([]);
  expect(input("Email").props.value).toBe(" Operator@Example.com ");
  expect(input("Password").props.value).toBe(" secret ");
  await act(() => switchButton().props.onPress());
  await act(() => input("Username").props.onChangeText(" operator "));
  await act(async () => { await submitButton().props.onPress(); });
  expect(signUp).toHaveBeenCalledWith(" operator ", " Operator@Example.com ", " secret ");
  expect(signIn).not.toHaveBeenCalled();
  expect(errors()).toEqual([]);
});

it.each([false, true])("shows session errors and allows a successful retry (sign-up: %s)", async (isSignUp) => {
  const action = isSignUp ? signUp : signIn;
  action.mockResolvedValueOnce({ kind: "api", error: new AuthApiError("http", 401, "Authentication was rejected.") });
  await render();
  await enterCredentials();
  if (isSignUp) {
    await act(() => switchButton().props.onPress());
    await act(() => input("Username").props.onChangeText("operator"));
  }
  await act(async () => { await submitButton().props.onPress(); });
  expect(errors()).toEqual(["Authentication was rejected."]);
  expect(submitButton().props.disabled).toBe(false);
  await act(async () => { await submitButton().props.onPress(); });
  expect(action).toHaveBeenCalledTimes(2);
  expect(errors()).toEqual([]);
  expect(submitButton().props.loading).toBe(false);
});

it("blocks duplicate submissions and mode changes while a request is pending", async () => {
  let finishSignIn!: (error: AuthFailure | null) => void;
  signIn.mockImplementationOnce(() => new Promise((resolve) => { finishSignIn = resolve; }));
  await render();
  await enterCredentials();
  let submission!: Promise<void>;
  await act(() => {
    const submit = submitButton().props.onPress;
    submission = submit();
    void submit();
    switchButton().props.onPress();
  });
  expect(signIn).toHaveBeenCalledTimes(1);
  expect(signIn).toHaveBeenCalledWith(" Operator@Example.com ", " secret ");
  expect(submitButton().props.loading).toBe(true);
  expect(submitButton().props.disabled).toBe(true);
  expect(switchButton().props.disabled).toBe(true);
  expect(input("Username")).toBeUndefined();
  await act(async () => { finishSignIn(null); await submission; });
  expect(submitButton().props.loading).toBe(false);
  expect(switchButton().props.disabled).toBe(false);
});

it.each([false, true])("recovers from unexpected failures without leaving submission stuck (sign-up: %s)", async (isSignUp) => {
  const action = isSignUp ? signUp : signIn;
  action.mockRejectedValueOnce(new Error("Unexpected failure"));
  await render();
  await enterCredentials();
  if (isSignUp) {
    await act(() => switchButton().props.onPress());
    await act(() => input("Username").props.onChangeText("operator"));
  }
  await act(async () => { await submitButton().props.onPress(); });
  expect(errors()).toEqual(["An unexpected authentication error occurred."]);
  expect(submitButton().props.loading).toBe(false);
  expect(submitButton().props.disabled).toBe(false);
  await act(async () => { await submitButton().props.onPress(); });
  expect(errors()).toEqual([]);
});
