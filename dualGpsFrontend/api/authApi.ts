import * as Device from "expo-device";
import { Platform } from "react-native";

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

export class AuthApiError extends Error {
  readonly status: number | null;
  readonly details: unknown;

  constructor(message: string, status: number | null, details?: unknown) {
    super(message);
    this.name = "AuthApiError";
    this.status = status;
    this.details = details;
  }
}

function getApiBaseUrl(): string {
  const isAndroidEmulator = Platform.OS === "android" && !Device.isDevice;
  const apiUrl = (
    isAndroidEmulator
      ? process.env.EXPO_PUBLIC_API_URL_EMULATOR
      : process.env.EXPO_PUBLIC_API_URL_DEVICE
  )?.trim();

  if (!apiUrl) {
    throw new AuthApiError("API URL is not configured in .env.", null);
  }

  return apiUrl.replace(/\/+$/, "");
}

function getErrorMessage(body: unknown, status: number): string {
  if (typeof body === "string" && body.trim()) {
    return body;
  }

  if (body && typeof body === "object") {
    const errorBody = body as Record<string, unknown>;

    if (typeof errorBody.message === "string") {
      return errorBody.message;
    }

    if (typeof errorBody.error === "string") {
      return errorBody.error;
    }

    const validationMessages = Object.values(errorBody).filter(
      (value): value is string => typeof value === "string",
    );

    if (validationMessages.length > 0) {
      return validationMessages.join("\n");
    }
  }

  return `Authentication request failed (${status}).`;
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

async function request<T>(path: string, body: unknown): Promise<T> {
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
      throw new AuthApiError(
        getErrorMessage(responseBody, response.status),
        response.status,
        responseBody,
      );
    }

    return responseBody as T;
  } catch (error) {
    if (error instanceof AuthApiError) {
      throw error;
    }

    if (error instanceof Error && error.name === "AbortError") {
      throw new AuthApiError("The authentication request timed out.", null);
    }

    throw new AuthApiError(
      "Could not connect to the authentication server.",
      null,
      error,
    );
  } finally {
    clearTimeout(timeoutId);
  }
}

export function login(credentials: LoginRequest): Promise<AuthTokenResponse> {
  return request<AuthTokenResponse>("/api/auth/login", credentials);
}

export async function register(user: RegisterRequest): Promise<RegisteredUser> {
  const registeredUser = await request<RegisteredUser & { password?: string }>(
    "/api/auth/register",
    user,
  );

  delete registeredUser.password;
  return registeredUser;
}

export const authApi = {
  login,
  register,
};
