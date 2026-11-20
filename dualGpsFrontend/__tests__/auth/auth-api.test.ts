import { afterAll, afterEach, beforeEach, expect, it, jest } from "@jest/globals";

import { authApi, AuthApiError } from "../../features/auth/api/auth-api";

jest.mock("expo-device", () => ({ isDevice: true }));
jest.mock("react-native", () => ({ Platform: { OS: "android" } }));

const previousApiUrl = process.env.EXPO_PUBLIC_API_URL_DEVICE;
let fetchSpy: jest.SpiedFunction<typeof fetch>;
const credentials = { email: "operator@example.com", password: "secret" };

function response(body: unknown, status = 200): Response {
  return { ok: status >= 200 && status < 300, status, text: async () => JSON.stringify(body) } as Response;
}

beforeEach(() => {
  jest.useFakeTimers();
  process.env.EXPO_PUBLIC_API_URL_DEVICE = "http://localhost:8080/";
  fetchSpy = jest.spyOn(globalThis, "fetch").mockResolvedValue(response({ token: "token" }));
});

afterEach(() => {
  fetchSpy.mockRestore();
  jest.useRealTimers();
});

afterAll(() => {
  if (previousApiUrl === undefined) delete process.env.EXPO_PUBLIC_API_URL_DEVICE;
  else process.env.EXPO_PUBLIC_API_URL_DEVICE = previousApiUrl;
});

it("posts credentials to the configured endpoint and clears the timeout after success", async () => {
  expect(await authApi.login(credentials)).toEqual({ token: "token" });
  expect(fetchSpy).toHaveBeenCalledWith("http://localhost:8080/api/auth/login", expect.objectContaining({
    method: "POST", body: JSON.stringify(credentials), signal: expect.any(AbortSignal),
  }));
  expect(jest.getTimerCount()).toBe(0);
});

it.each([
  [401, "Invalid credentials"],
  [400, { email: "Invalid email", password: "Too short" }],
  [409, { error: "Email already registered" }],
  [500, { message: "Internal diagnostics", trace: "server trace" }],
])("retains HTTP %i and its original response details", async (status, body) => {
  fetchSpy.mockResolvedValueOnce(response(body, status));
  await expect(authApi.login(credentials)).rejects.toMatchObject({ kind: "http", status, details: body });
  expect(jest.getTimerCount()).toBe(0);
});

it("preserves a non-JSON failure body without converting it into display text", async () => {
  fetchSpy.mockResolvedValueOnce({ ok: false, status: 502, text: async () => "upstream diagnostics" } as Response);
  await expect(authApi.login(credentials)).rejects.toMatchObject({
    kind: "http", status: 502, details: "upstream diagnostics",
  });
});

it("distinguishes missing configuration from network failures", async () => {
  delete process.env.EXPO_PUBLIC_API_URL_DEVICE;
  await expect(authApi.login(credentials)).rejects.toMatchObject({ kind: "configuration", status: null });
  expect(fetchSpy).not.toHaveBeenCalled();

  process.env.EXPO_PUBLIC_API_URL_DEVICE = "http://localhost:8080";
  const cause = new Error("Native connection diagnostics");
  fetchSpy.mockRejectedValueOnce(cause);
  await expect(authApi.login(credentials)).rejects.toMatchObject({ kind: "network", details: cause });
  expect(jest.getTimerCount()).toBe(0);
});

it("aborts timed-out requests and retains the abort cause", async () => {
  const cause = new Error("Native abort diagnostics");
  cause.name = "AbortError";
  fetchSpy.mockImplementationOnce((_url, options) => new Promise((_resolve, reject) => {
    options?.signal?.addEventListener("abort", () => reject(cause));
  }));
  const assertion = expect(authApi.login(credentials)).rejects.toMatchObject({
    kind: "timeout", status: null, details: cause,
  });
  await jest.advanceTimersByTimeAsync(10_000);
  await assertion;
  expect(jest.getTimerCount()).toBe(0);
});

it.each([null, [], {}, { token: "" }, { token: "   " }, { token: 42 }, "invalid"])(
  "rejects invalid successful login responses %j before session persistence", async (body) => {
    fetchSpy.mockResolvedValueOnce(response(body));
    await expect(authApi.login(credentials)).rejects.toMatchObject({
      kind: "invalid-response", status: 200, details: body,
    });
  },
);

it("removes the password from a successful registration response and rejects unusable responses", async () => {
  const user = { id: 1, username: "operator", email: credentials.email };
  fetchSpy.mockResolvedValueOnce(response({ ...user, password: "server-secret" }));
  expect(await authApi.register({ ...credentials, username: "operator" })).toEqual(user);
  fetchSpy.mockResolvedValueOnce(response(null));
  await expect(authApi.register({ ...credentials, username: "operator" })).rejects.toBeInstanceOf(AuthApiError);
});
