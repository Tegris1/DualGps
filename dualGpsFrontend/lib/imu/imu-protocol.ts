export const IMU_SECTIONS = ["boom", "arm", "bucket"] as const;
export type ImuSection = typeof IMU_SECTIONS[number];
export type ArmAngles = Record<ImuSection, number>;
export const IMU_MAX_AGE_MS = 1000;
export const IMU_MAX_SKEW_MS = 200;

export type ImuPacket = {
  type: "dualgps.imu";
  v: 2;
  uuid: string;
  boot: number;
  seq: number;
  ms: number;
  accel: [number, number, number]; // g
  gyro: [number, number, number]; // degrees/second
  angle: number | null; // absolute section inclination, degrees; upward positive
  calibrated: boolean;
  status: "ok" | "calibrating" | "unreliable" | "sensor-error";
};
export type ImuReading = ImuPacket & { receivedAt: number };

export function isImuUuid(value: unknown): value is string {
  return typeof value === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-5[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

export function imuUuidFromName(name: string | undefined): string | null {
  const uuid = name?.startsWith("DualGPS-IMU-") ? name.slice("DualGPS-IMU-".length) : null;
  return isImuUuid(uuid) ? uuid.toLowerCase() : null;
}

function uint32(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= 0 && value <= 0xffffffff;
}
function vector(value: unknown, limit: number): value is [number, number, number] {
  return Array.isArray(value) && value.length === 3 && value.every((n) => typeof n === "number" && Number.isFinite(n) && Math.abs(n) <= limit);
}

export function parseImuPacket(line: string): ImuPacket | null {
  if (line.length > 512) return null;
  try {
    const p: unknown = JSON.parse(line);
    if (!p || typeof p !== "object" || Array.isArray(p)) return null;
    const value = p as Record<string, unknown>;
    if (value.type !== "dualgps.imu" || value.v !== 2 || !isImuUuid(value.uuid) ||
        "id" in value || "device" in value ||
        !uint32(value.boot) || !uint32(value.seq) || !uint32(value.ms) ||
        !vector(value.accel, 4.01) || !vector(value.gyro, 511) ||
        typeof value.calibrated !== "boolean" ||
        !["ok", "calibrating", "unreliable", "sensor-error"].includes(value.status as string)) return null;
    if (value.status === "ok") {
      if (!value.calibrated || typeof value.angle !== "number" || !Number.isFinite(value.angle) || Math.abs(value.angle) > 180) return null;
    } else if (value.angle !== null) return null;
    return { ...value, uuid: value.uuid.toLowerCase() } as ImuPacket;
  } catch {
    return null;
  }
}

// One instance per Bluetooth connection. Android's newline delimiter assembles
// fragmented RFCOMM packets before this receives a line.
export class ImuStream {
  private last: ImuReading | null = null;
  error: string | null = null;

  constructor(private readonly expectedUuid: string) {}

  accept(line: string, receivedAt: number): ImuReading | null {
    const packet = parseImuPacket(line);
    if (!packet) { this.error = "Invalid IMU packet."; return null; }
    if (packet.uuid !== this.expectedUuid.toLowerCase()) {
      this.error = "Sensor UUID does not match this section's assignment. Select the correct sensor.";
      return null;
    }
    if (this.last?.boot === packet.boot) {
      const delta = (packet.seq - this.last.seq) >>> 0;
      if (delta === 0 || delta >= 0x80000000) return null;
    }
    this.error = null;
    this.last = { ...packet, receivedAt };
    return this.last;
  }
}

export function getArmAngles(readings: Record<ImuSection, ImuReading | null>, now: number): ArmAngles | null {
  const samples = IMU_SECTIONS.map((id) => readings[id]);
  if (samples.some((p) => !p || p.status !== "ok" || p.angle === null || now - p.receivedAt >= IMU_MAX_AGE_MS)) return null;
  const times = samples.map((p) => p!.receivedAt);
  if (Math.max(...times) - Math.min(...times) > IMU_MAX_SKEW_MS) return null;
  if (new Set(samples.map((p) => p!.uuid)).size !== 3) return null;
  return { boom: readings.boom!.angle!, arm: readings.arm!.angle!, bucket: readings.bucket!.angle! };
}
