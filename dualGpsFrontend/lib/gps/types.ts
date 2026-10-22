import type { NtripSettings } from "./ntrip-protocol";

export type EuposSettings = Omit<NtripSettings, "port"> & { port: string };

export type ConsoleEntry = {
  id: number;
  message: string;
  time: string;
};
