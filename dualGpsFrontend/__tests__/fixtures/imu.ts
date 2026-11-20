import type { ImuPacket, ImuSection } from "../../lib/imu/imu-protocol";

const devices = { boom: "AABBCCDDEE01", arm: "AABBCCDDEE02", bucket: "AABBCCDDEE03" };
export function imuPacket(id: ImuSection, overrides: Partial<ImuPacket> = {}): ImuPacket {
  return {
    type: "dualgps.imu", v: 1, id, device: devices[id], boot: 123456, seq: 42, ms: 2100,
    accel: [0.866, 0, 0.5], gyro: [0, 0, 0], angle: 60, calibrated: true, status: "ok",
    ...overrides,
  };
}
