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
