export type AuthApiErrorKind = "configuration" | "network" | "timeout" | "http" | "invalid-response";

export class AuthApiError extends Error {
  constructor(
    readonly kind: AuthApiErrorKind,
    readonly status: number | null = null,
    readonly details?: unknown,
  ) {
    super(`Authentication API ${kind} failure${status === null ? "" : ` (${status})`}`);
    this.name = "AuthApiError";
  }
}
