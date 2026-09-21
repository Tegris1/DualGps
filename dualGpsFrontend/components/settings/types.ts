export type SettingsSection = "bluetooth" | "eupos" | "debug";

export type ConsoleEntry = {
  id: number;
  message: string;
  time: string;
};

export type EuposSettings = {
  username: string;
  password: string;
  host: string;
  port: string;
  mountpoint: string;
  useTls: boolean;
};
