import type { NtripSettings } from "@/lib/gps/ntrip-protocol";

export type EuposSettings = Omit<NtripSettings, "port"> & { port: string };

export type ReceiverReleaseReason =
  | "replaced"
  | "disconnected"
  | "unexpected-disconnect"
  | "connection-failed"
  | "unmounted";

export type ConsoleEntry = {
  id: number;
  message: string;
  time: string;
};
