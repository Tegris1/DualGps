import { useCallback, useEffect, useRef, useState } from "react";

import { useBluetoothReceiver } from "@/features/gps/hooks/use-bluetooth-receiver";
import type { ReceiverAssignments } from "@/features/gps/services/receiver-assignments";
import { getArmAngles, ImuStream, imuUuidFromName, IMU_MAX_AGE_MS, type ImuReading, type ImuSection } from "@/lib/imu/imu-protocol";
import { createSecureStorage } from "@/lib/secure-storage";
import { ImuAssignments, ImuAssignmentConflict, type ImuBinding, type ImuBindings } from "./imu-assignments";

const noConfiguration = async () => {};
const onReady = () => {};

function useImuBindings() {
  const [store] = useState(() => new ImuAssignments(createSecureStorage("local")));
  const [bindings, setBindings] = useState<ImuBindings>({});
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const mounted = useRef(false);
  const restored = useRef(false);
  useEffect(() => {
    mounted.current = true;
    let active = true;
    void store.restore().then((value) => { if (active) setBindings(value); })
      .catch(() => { if (active) setError("Could not restore IMU assignments. Select and save your sensors again."); })
      .finally(() => { if (active) { restored.current = true; setReady(true); } });
    return () => { active = false; mounted.current = false; restored.current = false; };
  }, [store]);
  const update = useCallback(async (section: ImuSection, binding: ImuBinding | null) => {
    if (!restored.current) throw new Error("Wait for IMU assignments to load.");
    const value = await store.assign(section, binding);
    if (mounted.current) { setBindings(value); setError(null); }
  }, [store]);
  return { bindings, ready, error, update };
}

function useImuSensor(section: ImuSection, assignments: ReceiverAssignments, saved: ReturnType<typeof useImuBindings>) {
  const expectedUuid = useRef("");
  const stream = useRef(new ImuStream(""));
  const [reading, setReading] = useState<ImuReading | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const request = useRef<object | null>(null);
  const reset = useCallback(() => {
    stream.current = new ImuStream(expectedUuid.current);
    setReading(null);
    setError(null);
  }, []);
  useEffect(() => () => { request.current = null; }, []);
  const onData = useCallback((data: string) => {
    for (const line of data.split(/\r?\n/).filter((value) => value.trim())) {
      const next = stream.current.accept(line, Date.now());
      setError(stream.current.error);
      if (next) setReading(next);
      else if (stream.current.error) setReading(null);
    }
  }, []);
  const receiver = useBluetoothReceiver({
    onAttached: reset, onReady, onData, onReleased: reset, assignments, configureDevice: noConfiguration,
  });
  const binding = saved.bindings[section] ?? null;
  const boundAddress = binding?.address;
  const selectDevice = receiver.selectDevice;
  useEffect(() => { if (boundAddress) selectDevice(boundAddress); }, [boundAddress, selectDevice]);

  async function connectSelected(address = receiver.selectedAddress) {
    if (!saved.ready || request.current || receiver.isConnecting || receiver.connectedDevice) return;
    const device = receiver.devices.find((item) => item.address === address);
    const uuid = imuUuidFromName(device?.name);
    if (!address || !uuid) { setError("Select a paired sensor with UUID firmware v2."); return; }
    const operation = {};
    request.current = operation;
    setSaving(true); setError(null);
    try {
      await saved.update(section, { uuid, address });
      if (request.current !== operation) return;
      expectedUuid.current = uuid;
      await receiver.connectSelected(address);
    } catch (cause) {
      if (request.current === operation) setError(cause instanceof ImuAssignmentConflict ? cause.message : "Could not save IMU assignment. Please try again.");
    } finally {
      if (request.current === operation) { request.current = null; setSaving(false); }
    }
  }

  async function disconnect() {
    request.current = null; setSaving(false);
    await receiver.disconnect();
  }

  async function clearAssignment() {
    if (!saved.ready || request.current || receiver.isConnecting || receiver.connectedDevice) return;
    const operation = {};
    request.current = operation;
    setSaving(true);
    try {
      await saved.update(section, null);
      if (request.current !== operation) return;
      expectedUuid.current = "";
      selectDevice(null); reset();
    } catch {
      if (request.current === operation) setError("Could not clear the saved IMU assignment. Please try again.");
    } finally {
      if (request.current === operation) { request.current = null; setSaving(false); }
    }
  }

  return { ...receiver, section, reading, error, binding, assignmentReady: saved.ready,
    isConnecting: saving || receiver.isConnecting, connectSelected, disconnect, clearAssignment };
}

export function useArmImus(assignments: ReceiverAssignments) {
  const saved = useImuBindings();
  const boom = useImuSensor("boom", assignments, saved);
  const arm = useImuSensor("arm", assignments, saved);
  const bucket = useImuSensor("bucket", assignments, saved);
  const [clock, setClock] = useState(Date.now);
  const anyConnected = !!(boom.connectedDevice || arm.connectedDevice || bucket.connectedDevice);
  useEffect(() => {
    if (!anyConnected) return;
    const timer = setInterval(() => setClock(Date.now()), 100);
    return () => clearInterval(timer);
  }, [anyConnected]);
  const now = Math.max(clock, Date.now());
  const sensors = [boom, arm, bucket].map((sensor) => ({
    ...sensor,
    fresh: !!sensor.connectedDevice && !!sensor.reading && now - sensor.reading.receivedAt < IMU_MAX_AGE_MS,
  }));
  const readings = Object.fromEntries(sensors.map((sensor) => [sensor.section, sensor.fresh ? sensor.reading : null])) as Record<ImuSection, ImuReading | null>;
  return { sensors, pose: getArmAngles(readings, now), assignmentError: saved.error };
}

export type ArmImuController = ReturnType<typeof useArmImus>;
