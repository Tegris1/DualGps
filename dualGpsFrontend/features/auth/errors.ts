import { AuthApiError } from "@/features/auth/api/auth-errors";

export type AuthFailure =
  | { kind: "api"; error: AuthApiError }
  | { kind: "persistence"; cause: unknown }
  | { kind: "unexpected"; cause: unknown };

export function toAuthFailure(error: unknown): AuthFailure {
  return error instanceof AuthApiError
    ? { kind: "api", error }
    : { kind: "unexpected", cause: error };
}
