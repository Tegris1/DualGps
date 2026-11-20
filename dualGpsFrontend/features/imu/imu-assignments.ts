import { IMU_SECTIONS, isImuUuid, type ImuSection } from "@/lib/imu/imu-protocol";

export const IMU_ASSIGNMENTS_KEY = "dualgps.imu-assignments.v2";
export type ImuBinding = { uuid: string; address: string };
export type ImuBindings = Partial<Record<ImuSection, ImuBinding>>;
type Storage = { getItem: (key: string) => Promise<string | null>; setItem: (key: string, value: string) => Promise<void> };
export class ImuAssignmentConflict extends Error {}

export function parseImuBindings(value: string | null): ImuBindings {
  if (!value) return {};
  const stored: unknown = JSON.parse(value);
  if (!stored || typeof stored !== "object" || Array.isArray(stored)) throw new Error("Invalid IMU assignments.");
  const bindings: ImuBindings = {};
  const uuids = new Set<string>(), addresses = new Set<string>();
  for (const section of IMU_SECTIONS) {
    const item = (stored as Record<string, unknown>)[section];
    if (item === undefined) continue;
    if (!item || typeof item !== "object") throw new Error("Invalid IMU assignment.");
    const { uuid, address } = item as Record<string, unknown>;
    if (!isImuUuid(uuid) || typeof address !== "string" || !address.trim() || address.length > 128) throw new Error("Invalid IMU identity.");
    const normalized = { uuid: uuid.toLowerCase(), address: address.trim() };
    if (uuids.has(normalized.uuid) || addresses.has(normalized.address.toUpperCase())) throw new Error("Duplicate IMU assignment.");
    uuids.add(normalized.uuid); addresses.add(normalized.address.toUpperCase());
    bindings[section] = normalized;
  }
  return bindings;
}

// Serialize assignment writes so two sections cannot claim the same UUID while
// a previous save is pending. Only successful writes update the live mapping.
export class ImuAssignments {
  bindings: ImuBindings = {};
  private queue: Promise<unknown> = Promise.resolve();
  private restorePromise: Promise<ImuBindings> | null = null;

  constructor(private readonly storage: Storage) {}

  restore() {
    this.restorePromise ??= this.storage.getItem(IMU_ASSIGNMENTS_KEY).then((value) => {
      this.bindings = parseImuBindings(value);
      return this.bindings;
    });
    return this.restorePromise.then(() => this.bindings);
  }

  assign(section: ImuSection, binding: ImuBinding | null): Promise<ImuBindings> {
    const operation = this.queue.then(async () => {
      if (binding) {
        const owner = IMU_SECTIONS.find((id) => id !== section && (
          this.bindings[id]?.uuid === binding.uuid.toLowerCase() ||
          this.bindings[id]?.address.toUpperCase() === binding.address.toUpperCase()
        ));
        if (owner) throw new ImuAssignmentConflict(`This sensor is assigned to ${owner}. Clear that assignment first.`);
      }
      const next = { ...this.bindings };
      if (binding) next[section] = binding;
      else delete next[section];
      const normalized = parseImuBindings(JSON.stringify(next));
      await this.storage.setItem(IMU_ASSIGNMENTS_KEY, JSON.stringify(normalized));
      this.bindings = normalized;
      return normalized;
    });
    this.queue = operation.catch(() => undefined);
    return operation;
  }
}
