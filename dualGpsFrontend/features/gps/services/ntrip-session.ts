import type { BluetoothDevice } from "react-native-bluetooth-classic";

import { toNtripSettings } from "../eupos-settings";
import { NtripConnection, type NtripConnectionStatus } from "@/lib/gps/ntrip-connection";
import type { NtripSettings } from "@/lib/gps/ntrip-protocol";
import type { EuposSettings, ReceiverReleaseReason } from "../types";

export const INITIAL_NTRIP_STATUS: NtripConnectionStatus = {
  state: "idle",
  message: "Waiting for a valid GGA position from the receiver.",
  bytesReceived: 0,
  bytesSentToReceiver: 0,
  rtcm: { validFrames: 0, invalidFrames: 0 },
};

const INITIAL_RETRY_MS = 2_000;
const MAX_RETRY_MS = 30_000;

// Owns correction orchestration for one receiver. Socket/framing/write handling
// remains inside NtripConnection; this class only manages readiness and retries.
export class NtripSession {
  private active = false;
  private receiver: BluetoothDevice | null = null;
  private receiverReady = false;
  private latestGga: string | null = null;
  private connection: NtripConnection | null = null;
  private starting = false;
  private retryTimer: ReturnType<typeof setTimeout> | null = null;
  private retryDelay = INITIAL_RETRY_MS;
  private status = INITIAL_NTRIP_STATUS;

  constructor(
    private settings: EuposSettings,
    private readonly onStatus: (status: NtripConnectionStatus) => void,
  ) {}

  activate() {
    this.active = true;
  }

  setSettings(settings: EuposSettings) {
    this.settings = settings;
    this.retryDelay = INITIAL_RETRY_MS;
  }

  attachReceiver = (device: BluetoothDevice) => {
    if (!this.active) return;
    this.receiver = device;
    this.receiverReady = false;
    this.latestGga = null;
  };

  receiverConfigured = (device: BluetoothDevice) => {
    if (!this.active || this.receiver !== device) return;
    this.receiverReady = true;
    this.emit(INITIAL_NTRIP_STATUS);
    if (this.latestGga) void this.start(device, this.latestGga);
  };

  acceptGga(device: BluetoothDevice, gga: string) {
    if (!this.active || this.receiver !== device) return;
    this.latestGga = gga;
    if (!this.receiverReady) return;
    if (this.connection?.isRunning()) this.connection.updateGga(gga);
    else void this.start(device, gga);
  }

  releaseReceiver(reason: ReceiverReleaseReason) {
    this.receiver = null;
    this.receiverReady = false;
    this.latestGga = null;
    this.stopConnection();
    this.retryDelay = INITIAL_RETRY_MS;

    if (reason === "unmounted") return;
    if (reason === "replaced") {
      this.emit(INITIAL_NTRIP_STATUS);
    } else {
      this.emit({
        ...INITIAL_NTRIP_STATUS,
        state: reason === "connection-failed" ? "error" : "disconnected",
        message: reason === "connection-failed" ? "Receiver connection failed."
          : reason === "unexpected-disconnect" ? "NTRIP corrections stopped because Bluetooth disconnected."
          : "NTRIP corrections stopped.",
      });
    }
  }

  dispose() {
    this.active = false;
    this.releaseReceiver("unmounted");
  }

  private emit(status: NtripConnectionStatus) {
    if (!this.active) return;
    this.status = status;
    this.onStatus(status);
  }

  private clearRetry() {
    if (this.retryTimer !== null) clearTimeout(this.retryTimer);
    this.retryTimer = null;
  }

  private stopConnection() {
    this.clearRetry();
    const connection = this.connection;
    // Invalidate callbacks before stopping, including a pending start rejection.
    this.connection = null;
    this.starting = false;
    connection?.stop(false);
  }

  private async start(device: BluetoothDevice, gga: string) {
    if (!this.active || this.receiver !== device || !this.receiverReady || this.starting
      || this.connection?.isRunning() || this.retryTimer !== null) return;

    let settings: NtripSettings;
    try {
      settings = toNtripSettings(this.settings);
    } catch {
      this.emit({ ...INITIAL_NTRIP_STATUS, state: "error", message: "Complete the ASG-EUPOS settings to start NTRIP." });
      return;
    }

    this.starting = true;
    const connection: NtripConnection = new NtripConnection({
      onStatus: (status) => {
        if (!this.active || this.connection !== connection) return;
        this.emit(status);
        if (status.state === "streaming" && status.bytesReceived > 0) {
          this.clearRetry();
          this.retryDelay = INITIAL_RETRY_MS;
        } else if (status.state === "error" || status.state === "disconnected") {
          this.scheduleRetry();
        }
      },
    });
    this.connection = connection;

    try {
      await connection.start(settings, device, gga);
    } catch (error) {
      if (!this.active || this.connection !== connection) return;
      this.emit({
        ...this.status,
        state: "error", message: error instanceof Error ? error.message : String(error),
      });
      this.scheduleRetry();
    } finally {
      if (this.connection === connection) this.starting = false;
    }
  }

  private scheduleRetry() {
    const device = this.receiver;
    if (!this.active || !device || !this.receiverReady || this.retryTimer !== null) return;

    const delay = this.retryDelay;
    this.retryDelay = Math.min(delay * 2, MAX_RETRY_MS);
    this.retryTimer = setTimeout(() => {
      this.retryTimer = null;
      if (!this.active || this.receiver !== device || !this.receiverReady || this.connection?.isRunning()) return;
      if (this.starting) {
        this.scheduleRetry();
        return;
      }
      if (this.latestGga) void this.start(device, this.latestGga);
    }, delay);
  }
}
