import { Buffer } from "buffer";

export type NtripSettings = {
  host: string;
  port: number;
  mountpoint: string;
  username: string;
  password: string;
  useTls: boolean;
};

export function buildNtripRequest(settings: NtripSettings): string {
  const mountpoint = settings.mountpoint.trim().replace(/^\/+/, "");
  const credentials = Buffer.from(
    `${settings.username}:${settings.password}`,
    "utf8",
  ).toString("base64");

  return [
    `GET /${mountpoint} HTTP/1.1`,
    `Host: ${settings.host}:${settings.port}`,
    "Ntrip-Version: Ntrip/2.0", //
    "User-Agent: NTRIP DualGps/1.0",
    `Authorization: Basic ${credentials}`,
    "Accept: */*",
    "Connection: close",
    "",
    "",
  ].join("\r\n");
}

export function normalizeGga(sentence: string): string {
  return `${sentence.trim()}\r\n`;
}

export function successfulNtripStatus(status: string): boolean {
  const normalized = status.toUpperCase();

  return (
    normalized.startsWith("ICY 200") ||
    normalized.startsWith("HTTP/1.0 200") ||
    normalized.startsWith("HTTP/1.1 200")
  );
}

export type NtripResponseHeaders = {
  statusLine: string;
  headers: Record<string, string>;
};

export function validateNtripSettings(settings: NtripSettings): NtripSettings {
  const host = validateHeaderValue(settings.host, "host");
  const username = validateHeaderValue(settings.username, "username");
  const mountpoint = settings.mountpoint.trim().replace(/^\/+/, "");

  if (!mountpoint || /\s/.test(mountpoint)) {
    throw new Error("NTRIP mountpoint is invalid");
  }

  if (/[\r\n]/.test(settings.password)) {
    throw new Error("NTRIP password contains an invalid line break");
  }

  if (
    !Number.isInteger(settings.port) ||
    settings.port < 1 ||
    settings.port > 65535
  ) {
    throw new Error("NTRIP port must be between 1 and 65535");
  }

  return {
    ...settings,
    host,
    username,
    mountpoint,
  };
}

function validateHeaderValue(value: string, label: string): string {
  const result = value.trim();

  if (!result || /[\r\n]/.test(result)) {
    throw new Error(`NTRIP ${label} is invalid`);
  }

  return result;
}

export function parseNtripHeaders(text: string): NtripResponseHeaders {
  const lines = text.split("\r\n");
  const statusLine = lines[0]?.trim() ?? "";
  const headers: Record<string, string> = {};

  for (const line of lines.slice(1)) {
    const separator = line.indexOf(":");
    if (separator <= 0) continue;

    const name = line.slice(0, separator).trim().toLowerCase();
    const value = line.slice(separator + 1).trim();
    headers[name] = value;
  }

  return { statusLine, headers };
}

export function ntripStatusMessage(statusLine: string): string {
  if (statusLine.includes("401")) {
    return "ASG-EUPOS rejected the username or password (HTTP 401)";
  }

  if (statusLine.includes("403")) {
    return "ASG-EUPOS denied access to this stream (HTTP 403)";
  }

  if (statusLine.includes("404")) {
    return "The NTRIP mountpoint was not found (HTTP 404)";
  }

  if (/^SOURCETABLE/i.test(statusLine)) {
    return "The caster returned its source table, wrong mountpoint";
  }

  if (!statusLine.trim()) {
    return "The NTRIP caster returned an empty response";
  }

  return `NTRIP connection failed: ${statusLine}`;
}
