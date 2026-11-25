import { Buffer } from "buffer";

export type UserRole = "ARCHITECT" | "OPERATOR" | "ADMIN";

export function getSessionRole(token: string): UserRole | null {
  const parts = token.split(".");
  if (parts.length !== 3 || parts.some((part) => !part)) return null;

  try {
    const payload = Buffer.from(parts[1].replace(/-/g, "+").replace(/_/g, "/"), "base64").toString("utf8");
    const claims = JSON.parse(payload) as { roles?: unknown } | null;
    const roles = claims?.roles;
    if (!Array.isArray(roles) || roles.length !== 1) return null;
    const [role] = roles;
    return role === "ARCHITECT" || role === "OPERATOR" || role === "ADMIN" ? role : null;
  } catch {
    return null;
  }
}
