import { Buffer } from "buffer";
import type { BluetoothDevice } from "react-native-bluetooth-classic";
import TcpSocket from "react-native-tcp-socket";

import { NtripChunkDecoder } from "./ntrip-chunk-decoder";
import {
  buildNtripRequest,
  normalizeGga,
  successfulNtripStatus,
  type NtripSettings,
} from "./ntrip-protocol";
import { Rtcm3Inspector, type RtcmStats } from "./rtcm3-inspector";

type TcpClient = ReturnType<typeof TcpSocket.createConnection>;

export type NtripState =
  | "idle"
  | "connecting"
  | "streaming"
  | "error"
  | "disconnected";

export type NtripConnectionStatus = {
  state: NtripState;
  message?: string;
  bytesReceived: number;
  bytesSentToReceiver: number;
  rtcm: RtcmStats;
};

export type NtripConnectionCallbacks = {
  onStatus?: (status: NtripConnectionStatus) => void;
  onError?: (error: Error) => void;
};

export class NtripConnection {
  private socket: TcpClient | null = null;
  private reciever: BluetoothDevice | null = null;
  private latestGga: string | null = null;
  private ggaTimer: ReturnType<typeof setInterval> | null = null;
  private running = false;

  private headerBuffer = Buffer.alloc(0);
  private headersComplete = false;
  private chunked = false;

  private bluetoothWriteQueue = Promise.resolve();

  private readonly chunkDecoder = new NtripChunkDecoder();
  private readonly rtcmInspector = new Rtcm3Inspector();

  constructor(private readonly callbacks: NtripConnectionCallbacks = {}) {}

  isRunning(): boolean {
    return this.running;
  }

  async start(
    settings: NtripSettings,
    reciever: BluetoothDevice,
    initialGga: string,
  ): Promise<void> {
    // Implement the logic to start the NTRIP connection here.
  }

  updateGga(gga: string): void {
    this.latestGga = normalizeGga(gga);
  }

  stop(): void {
    this.running = false;
    this.socket?.destroy();
  }
}
