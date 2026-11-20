import * as Device from "expo-device";
import { Platform } from "react-native";

import { AuthApiError } from "./auth-errors";

export { AuthApiError } from "./auth-errors";

const REQUEST_TIMEOUT_MS = 10_000;

export type LoginRequest = {
  email: string;
  password: string;
};

export type RegisterRequest = LoginRequest & {
  username: string;
  firstName?: string;
  lastName?: string;
  birthDate?: string;
  phoneNumber?: string;
  loyaltyProgram?: boolean;
};

export type AuthTokenResponse = {
  token: string;
};

export type RegisteredUser = {
  id: number;
  username: string;
  email: string;
  currency: string;
  points: number;
  firstName: string | null;
  lastName: string | null;
  birthDate: string | null;
  phoneNumber: string | null;
  customerNumber: string;
  loyaltyProgram: boolean;
  cancelledReservationsCount: number;
  reservationBlockedUntil: string | null;
  role: "USER" | "EMPLOYEE" | "SECRETARY" | "ADMIN";
};

function getApiBaseUrl(): string {
  const isAndroidEmulator = Platform.OS === "android" && !Device.isDevice;
  const apiUrl = (
    isAndroidEmulator
      ? process.env.EXPO_PUBLIC_API_URL_EMULATOR
      : process.env.EXPO_PUBLIC_API_URL_DEVICE
  )?.trim();

  if (!apiUrl) {
    throw new AuthApiError("configuration");
  }

  return apiUrl.replace(/\/+$/, "");
}

async function parseResponse(response: Response): Promise<unknown> {
  const responseText = await response.text();

  if (!responseText) {
    return null;
  }

  try {
    return JSON.parse(responseText) as unknown;
  } catch {
    return responseText;
  }
}

async function request(path: string, body: unknown): Promise<{ body: unknown; status: number }> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(`${getApiBaseUrl()}${path}`, {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    const responseBody = await parseResponse(response);

    if (!response.ok) {
      throw new AuthApiError("http", response.status, responseBody);
    }

    return { body: responseBody, status: response.status };
  } catch (error) {
    if (error instanceof AuthApiError) {
      throw error;
    }

    if (error instanceof Error && error.name === "AbortError") {
      throw new AuthApiError("timeout", null, error);
    }

    throw new AuthApiError("network", null, error);
  } finally {
    clearTimeout(timeoutId);
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

export async function login(credentials: LoginRequest): Promise<AuthTokenResponse> {
  const { body, status } = await request("/api/auth/login", credentials);
  if (!isRecord(body) || typeof body.token !== "string" || !body.token.trim()) {
    throw new AuthApiError("invalid-response", status, body);
  }
  return { token: body.token };
}

export async function register(user: RegisterRequest): Promise<RegisteredUser> {
  const { body, status } = await request("/api/auth/register", user);
  if (!isRecord(body)) throw new AuthApiError("invalid-response", status, body);
  const registeredUser = { ...body } as RegisteredUser & { password?: unknown };

  delete registeredUser.password;
  return registeredUser;
}

export const authApi = {
  login,
  register,
};
