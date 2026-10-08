import { Buffer } from "buffer";
import type { BluetoothDevice } from "react-native-bluetooth-classic";
import TcpSocket from "react-native-tcp-socket";

import { NtripChunkDecoder } from "./ntrip-chunk-decoder";
import {
  buildNtripRequest,
  normalizeGga,
  successfulNtripStatus,
  ntripStatusMessage,
  parseNtripHeaders,
  validateNtripSettings,
  type NtripSettings,
} from "./ntrip-protocol";
import { Rtcm3Inspector, type RtcmStats } from "./rtcm3-inspector";

type TcpClient = ReturnType<typeof TcpSocket.createConnection>;

const CONNECT_TIMEOUT_MS = 15_000;
const HEADER_TIMEOUT_MS = 15_000;
const CORRECTION_TIMEOUT_MS = 30_000;

const GGA_INTERVAL_MS = 5_000;
const MAX_HEADER_BYTES = 64 * 1024;
const MAX_PENDING_BLUETOOTH_WRITES = 64;
const RESUME_BLUETOOTH_WRITES_AT = 16;
const STATUS_THROTTLE_MS = 250;

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
  lastGgaSentAt?: number;
};

export type NtripConnectionCallbacks = {
  onStatus?: (status: NtripConnectionStatus) => void;
  onError?: (error: Error) => void;
};

export class NtripConnection {
  private socket: TcpClient | null = null;
  private receiver: BluetoothDevice | null = null;
  private latestGga: string | null = null;
  private lastGgaSentAt: number | undefined;
  private ggaTimer: ReturnType<typeof setInterval> | null = null;
  private running = false;

  private readTimer: ReturnType<typeof setTimeout> | null = null;

  private headerBuffer = Buffer.alloc(0);
  private headersComplete = false;
  private chunked = false;

  private bluetoothWriteQueue = Promise.resolve();

  private readonly chunkDecoder = new NtripChunkDecoder();
  private readonly rtcmInspector = new Rtcm3Inspector();

  private generation = 0;
  private bytesReceived = 0;
  private bytesSentToReceiver = 0;
  private pendingBluetoothWrites = 0;
  private lastStatusAt = 0;
  private rejectStart: ((error: Error) => void) | null = null;

  constructor(private readonly callbacks: NtripConnectionCallbacks = {}) {}

  isRunning(): boolean {
    return this.running;
  }

  async start(
    settings: NtripSettings,
    receiver: BluetoothDevice,
    initialGga: string,
  ): Promise<void> {
    this.stop(false);

    const normalizedSettings = validateNtripSettings(settings);
    const normalizedGga = normalizeGga(initialGga);
    const generation = ++this.generation;

    this.receiver = receiver;
    this.latestGga = normalizedGga;
    this.lastGgaSentAt = undefined;
    this.running = true;
    this.headerBuffer = Buffer.alloc(0);
    this.headersComplete = false;
    this.chunked = false;
    this.bytesReceived = 0;
    this.bytesSentToReceiver = 0;
    this.pendingBluetoothWrites = 0;
    this.bluetoothWriteQueue = Promise.resolve();
    this.chunkDecoder.reset();
    this.rtcmInspector.reset();
    this.emitStatus("connecting", "Connecting to the NTRIP caster…", true);

    await new Promise<void>((resolve, reject) => {
      let startSettled = false;

      const settleStarted = () => {
        if (startSettled) return;
        startSettled = true;
        this.rejectStart = null;
        resolve();
      };

      const fail = (reason: unknown) => {
        this.fail(this.asError(reason), generation);
      };

      this.rejectStart = (error) => {
        if (startSettled) return;
        startSettled = true;
        this.rejectStart = null;
        reject(error);
      };

      try {
        const options = {
          host: normalizedSettings.host,
          port: normalizedSettings.port,
          connectTimeout: CONNECT_TIMEOUT_MS,
        };

        let socket: TcpClient;

        this.armReadTimer(
          CONNECT_TIMEOUT_MS,
          "NTRIP connection establishment timed out",
          generation,
        );

        const onConnected = () => {
          if (!this.isCurrent(generation)) return;

          try {
            socket.setKeepAlive(true);
            socket.setNoDelay(true);

            this.armReadTimer(
              HEADER_TIMEOUT_MS,
              "NTRIP caster did not return complete headers within 15 seconds",
              generation,
            );

            socket.write(
              buildNtripRequest(normalizedSettings),
              "ascii",
              (error) => {
                if (error) fail(error);
              },
            );
          } catch (error) {
            fail(error);
          }
        };

        socket = normalizedSettings.useTls
          ? TcpSocket.connectTLS(options, onConnected)
          : TcpSocket.createConnection(options, onConnected);

        this.socket = socket;

        socket.on("data", (data) => {
          if (!this.isCurrent(generation)) return;

          try {
            const bytes = Buffer.isBuffer(data)
              ? data
              : Buffer.from(data, "binary");
            const started = this.acceptSocketData(bytes, generation);

            if (started) settleStarted();
          } catch (error) {
            fail(error);
          }
        });

        socket.on("error", fail);
        // socket.on("timeout", () =>
        //   fail(new Error("NTRIP connection timed out")),
        // );
        socket.on("close", () => {
          if (!this.isCurrent(generation)) return;

          const error = new Error(
            this.headersComplete
              ? "NTRIP caster closed the correction stream"
              : "NTRIP connection closed before a response was received",
          );
          fail(error);
        });
      } catch (error) {
        fail(error);
      }
    });
  }

  private armReadTimer(
    timeoutMs: number,
    message: string,
    generation: number,
  ): void {
    if (!this.isCurrent(generation)) return;

    this.clearReadTimer();

    this.readTimer = setTimeout(() => {
      this.readTimer = null;
      this.fail(new Error(message), generation);
    }, timeoutMs);
  }

  private clearReadTimer(): void {
    if (this.readTimer !== null) {
      clearTimeout(this.readTimer);
      this.readTimer = null;
    }
  }

  updateGga(gga: string): void {
    this.latestGga = normalizeGga(gga);
    this.lastGgaSentAt = Date.now();
  }

  stop(notify = true): void {
    const wasRunning = this.running || this.socket !== null;
    const rejectStart = this.rejectStart;
    this.rejectStart = null;

    this.running = false;
    this.generation += 1;
    this.clearGgaTimer();
    this.clearReadTimer();

    const socket = this.socket;
    this.socket = null;
    socket?.removeAllListeners();
    socket?.destroy();

    this.receiver = null;
    this.latestGga = null;
    this.lastGgaSentAt = undefined;
    this.headerBuffer = Buffer.alloc(0);
    this.headersComplete = false;
    this.chunked = false;
    rejectStart?.(new Error("NTRIP connection was stopped"));

    if (notify && wasRunning) {
      this.emitStatus("disconnected", "NTRIP corrections stopped.", true);
    }
  }

  private acceptSocketData(data: Buffer, generation: number): boolean {
    let payload = data;
    let started = false;

    if (!this.headersComplete) {
      this.headerBuffer = Buffer.concat([this.headerBuffer, data]);

      if (this.headerBuffer.length > MAX_HEADER_BYTES) {
        throw new Error("NTRIP response headers are too large");
      }

      const headerEnd = this.findHeaderEnd(this.headerBuffer);
      if (headerEnd === null) return false;

      // Decode on the Buffer itself: Hermes can return a plain Uint8Array
      // from subarray(), whose toString() produces comma-separated numbers.
      const headerText = this.headerBuffer.toString(
        "latin1", 0, headerEnd.headerLength,
      );
      const response = parseNtripHeaders(headerText);

      if (!successfulNtripStatus(response.statusLine)) {
        throw new Error(ntripStatusMessage(response.statusLine));
      }

      this.headersComplete = true;
      // Start waiting for the first correction bytes.
      this.armReadTimer(
        CORRECTION_TIMEOUT_MS,
        "No NTRIP correction data received for 30 seconds",
        generation,
      );

      this.chunked = (response.headers["transfer-encoding"] ?? "")
        .toLowerCase()
        .split(",")
        .some((encoding) => encoding.trim() === "chunked");
      payload = Buffer.from(
        this.headerBuffer.subarray(headerEnd.payloadOffset),
      );
      this.headerBuffer = Buffer.alloc(0);
      this.sendLatestGga(generation);
      this.startGgaTimer(generation);
      this.emitStatus("streaming", "Receiving NTRIP corrections.", true);
      started = true;
    }

    if (payload.length > 0) {
      const chunks = this.chunked ? this.chunkDecoder.push(payload) : [payload];
      for (const chunk of chunks) {
        this.forwardRtcm(chunk, generation);
      }
    }

    return started;
  }

  private startGgaTimer(generation: number): void {
    this.clearGgaTimer();

    this.ggaTimer = setInterval(() => {
      if (!this.isCurrent(generation)) return;

      try {
        this.sendLatestGga(generation);
      } catch (error) {
        if (this.isCurrent(generation)) {
          this.fail(this.asError(error), generation);
        }
      }
    }, GGA_INTERVAL_MS);
  }

  private findHeaderEnd(data: Buffer): {
    headerLength: number;
    payloadOffset: number;
  } | null {
    const fullHeaderEnd = data.indexOf("\r\n\r\n");

    if (fullHeaderEnd < 0) return null;

    return {
      headerLength: fullHeaderEnd,
      payloadOffset: fullHeaderEnd + 4,
    };
  }

  private forwardRtcm(data: Buffer, generation: number): void {
    if (data.length === 0 || !this.isCurrent(generation)) return;

    const receiver = this.receiver;
    if (!receiver) throw new Error("Bluetooth receiver is not connected");

    const bytes = Buffer.from(data);
    this.bytesReceived += bytes.length;
    this.rtcmInspector.accept(bytes);
    this.pendingBluetoothWrites += 1;

    if (this.pendingBluetoothWrites >= MAX_PENDING_BLUETOOTH_WRITES) {
      this.socket?.pause();
    }

    this.bluetoothWriteQueue = this.bluetoothWriteQueue
      .then(async () => {
        if (!this.isCurrent(generation)) return;

        const written = await receiver.write(bytes);
        if (!written) {
          throw new Error("Bluetooth receiver rejected an RTCM write");
        }

        this.armReadTimer(
          CORRECTION_TIMEOUT_MS,
          "No NTRIP correction data received for 30 seconds",
          generation,
        );

        this.bytesSentToReceiver += bytes.length;
        this.emitStatus("streaming", "Receiving NTRIP corrections.");
      })
      .catch((error) => {
        if (this.isCurrent(generation)) {
          this.fail(this.asError(error), generation);
        }
      })
      .finally(() => {
        if (this.generation !== generation) return;

        this.pendingBluetoothWrites = Math.max(
          0,
          this.pendingBluetoothWrites - 1,
        );

        if (
          this.isCurrent(generation) &&
          this.pendingBluetoothWrites <= RESUME_BLUETOOTH_WRITES_AT
        ) {
          this.socket?.resume();
        }
      });

    this.emitStatus("streaming", "Receiving NTRIP corrections.");
  }

  private sendLatestGga(generation: number): void {
    if (
      !this.isCurrent(generation) ||
      !this.headersComplete ||
      !this.socket ||
      !this.latestGga
    ) {
      return;
    }

    this.socket.write(this.latestGga, "ascii", (error) => {
      if (!this.isCurrent(generation)) return;

      if (error) {
        this.fail(error, generation);
        return;
      }

      this.lastGgaSentAt = Date.now();
      this.emitStatus("streaming", undefined, true);
    });
  }

  private clearGgaTimer(): void {
    if (this.ggaTimer) {
      clearInterval(this.ggaTimer);
      this.ggaTimer = null;
    }
  }

  private fail(error: Error, generation: number): void {
    if (!this.isCurrent(generation)) return;

    const status = this.createStatus("error", error.message);
    const rejectStart = this.rejectStart;
    this.rejectStart = null;

    this.stop(false);

    rejectStart?.(error);
    this.callbacks.onError?.(error);
    this.callbacks.onStatus?.(status);
  }

  private isCurrent(generation: number): boolean {
    return this.running && this.generation === generation;
  }

  private emitStatus(state: NtripState, message?: string, force = false): void {
    const now = Date.now();
    if (!force && now - this.lastStatusAt < STATUS_THROTTLE_MS) return;

    this.lastStatusAt = now;
    this.callbacks.onStatus?.(this.createStatus(state, message));
  }

  private createStatus(
    state: NtripState,
    message?: string,
  ): NtripConnectionStatus {
    return {
      state,
      message,
      bytesReceived: this.bytesReceived,
      bytesSentToReceiver: this.bytesSentToReceiver,
      rtcm: this.rtcmInspector.getStats(),
    };
  }

  private asError(error: unknown): Error {
    return error instanceof Error ? error : new Error(String(error));
  }
}
