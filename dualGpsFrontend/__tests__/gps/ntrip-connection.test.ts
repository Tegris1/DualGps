import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { Buffer } from 'buffer';
import type { BluetoothDevice } from 'react-native-bluetooth-classic';
import TcpSocket from 'react-native-tcp-socket';

import { NtripConnection, type NtripConnectionStatus } from '../../lib/gps/ntrip-connection';
import type { NtripSettings } from '../../lib/gps/ntrip-protocol';
import { gga } from '../fixtures/nmea';

jest.mock('react-native-tcp-socket', () => ({
  __esModule: true,
  default: { createConnection: jest.fn(), connectTLS: jest.fn() },
}));

const settings: NtripSettings = {
  host: 'caster.example.com', port: 2101, mountpoint: 'STREAM',
  username: 'user', password: 'pass', useTls: false,
};
const headers = Buffer.from('HTTP/1.1 200 OK\r\n\r\n');

function createSocket() {
  const listeners = new Map<string, (data?: Buffer | Error) => void>();
  return {
    on: jest.fn((event: string, listener: (data?: Buffer | Error) => void) => {
      listeners.set(event, listener);
    }),
    write: jest.fn((_data: string | Buffer, _encoding: string, callback: (error?: Error) => void) => {
      callback();
      return true;
    }),
    setKeepAlive: jest.fn(), setNoDelay: jest.fn(),
    pause: jest.fn(), resume: jest.fn(), destroy: jest.fn(),
    removeAllListeners: jest.fn(() => listeners.clear()),
    emit: (event: string, data?: Buffer | Error) => listeners.get(event)?.(data),
    listener: (event: string) => listeners.get(event),
  };
}

describe('NTRIP connection lifecycle', () => {
  let socket: ReturnType<typeof createSocket>;
  let connected: () => void;
  let connection: NtripConnection;
  let write: ReturnType<typeof jest.fn<(data: Buffer) => Promise<boolean>>>;
  let receiver: BluetoothDevice;
  let onStatus: ReturnType<typeof jest.fn<(status: NtripConnectionStatus) => void>>;
  let onError: ReturnType<typeof jest.fn<(error: Error) => void>>;

  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(1000);
    jest.clearAllMocks();
    socket = createSocket();
    connected = () => {};
    jest.mocked(TcpSocket.createConnection).mockImplementation((_options, callback) => {
      connected = callback;
      return socket as unknown as ReturnType<typeof TcpSocket.createConnection>;
    });
    jest.mocked(TcpSocket.connectTLS).mockImplementation((_options, callback) => {
      connected = callback ?? (() => {});
      return socket as unknown as ReturnType<typeof TcpSocket.connectTLS>;
    });
    write = jest.fn<(data: Buffer) => Promise<boolean>>().mockResolvedValue(true);
    receiver = { write } as unknown as BluetoothDevice;
    onStatus = jest.fn<(status: NtripConnectionStatus) => void>();
    onError = jest.fn<(error: Error) => void>();
    connection = new NtripConnection({ onStatus, onError });
  });

  afterEach(() => {
    connection.stop(false);
    jest.useRealTimers();
  });

  async function startStreaming() {
    const started = connection.start(settings, receiver, gga());
    connected();
    socket.emit('data', headers);
    await started;
  }

  it.each([false, true])('uses the configured TCP/TLS transport (TLS: %s)', async (useTls) => {
    const started = connection.start({ ...settings, useTls }, receiver, gga());
    const factory = useTls ? TcpSocket.connectTLS : TcpSocket.createConnection;
    expect(factory).toHaveBeenCalledWith(
      expect.objectContaining({ host: settings.host, port: 2101, connectTimeout: 15000 }),
      expect.any(Function),
    );
    connected();
    expect(socket.write).toHaveBeenCalledWith(expect.stringContaining('GET /STREAM HTTP/1.1'), 'ascii', expect.any(Function));
    socket.emit('data', headers);
    await started;
    expect(connection.isRunning()).toBe(true);
  });

  it('handles fragmented headers and forwards the attached payload unchanged', async () => {
    const started = connection.start(settings, receiver, gga());
    connected();
    socket.emit('data', Buffer.from('HTTP/1.1 200 OK\r\nX-Example: test\r\n'));
    expect(write).not.toHaveBeenCalled();
    const payload = Buffer.from([0xd3, 0, 0xff, 0x80, 13, 10]);
    socket.emit('data', Buffer.concat([Buffer.from('\r\n'), payload]));
    await started;
    await jest.advanceTimersByTimeAsync(1);
    expect(write).toHaveBeenCalledTimes(1);
    expect(write).toHaveBeenCalledWith(payload);
  });

  it('decodes headers when the runtime returns plain Uint8Arrays from Buffer.subarray', async () => {
    const prototype = Buffer.prototype as { subarray: (start?: number, end?: number) => Buffer };
    const subarray = jest.spyOn(prototype, 'subarray').mockImplementation(function (
      this: Buffer, start?: number, end?: number,
    ) {
      return new Uint8Array(this.buffer, this.byteOffset, this.byteLength)
        .subarray(start, end) as Buffer;
    });
    try {
      const started = connection.start(settings, receiver, gga()).catch((error: Error) => error);
      connected();
      const payload = Buffer.from([0xd3, 0, 0xff, 0x80]);
      socket.emit('data', Buffer.concat([headers, payload]));
      expect(await started).toBeUndefined();
      await jest.advanceTimersByTimeAsync(1);
      expect(onError).not.toHaveBeenCalled();
      expect(write).toHaveBeenCalledWith(payload);
    } finally {
      subarray.mockRestore();
    }
  });

  it('removes HTTP chunk framing before forwarding binary correction bytes', async () => {
    const started = connection.start(settings, receiver, gga());
    connected();
    socket.emit('data', Buffer.from('HTTP/1.1 200 OK\r\nTransfer-Encoding: chunked\r\n\r\n'));
    await started;
    socket.emit('data', Buffer.from('3\r\n'));
    socket.emit('data', Buffer.from([0xd3, 0, 0xff]));
    socket.emit('data', Buffer.from('\r\n0\r\n\r\n'));
    await jest.advanceTimersByTimeAsync(1);
    expect(write).toHaveBeenCalledWith(Buffer.from([0xd3, 0, 0xff]));
  });

  it('serializes Bluetooth writes and resumes socket reads after the queue drains', async () => {
    await startStreaming();
    let releaseFirst: (value: boolean) => void = () => {};
    write.mockImplementationOnce(() => new Promise<boolean>((resolve) => { releaseFirst = resolve; }));
    for (let byte = 0; byte < 64; byte++) socket.emit('data', Buffer.from([byte]));
    await jest.advanceTimersByTimeAsync(1);
    expect(write).toHaveBeenCalledTimes(1);
    expect(socket.pause).toHaveBeenCalled();
    expect(socket.resume).not.toHaveBeenCalled();
    releaseFirst(true);
    await jest.advanceTimersByTimeAsync(1);
    expect(write).toHaveBeenCalledTimes(64);
    expect(Buffer.concat(write.mock.calls.map(([data]) => data)))
      .toEqual(Buffer.from(Array.from({ length: 64 }, (_, index) => index)));
    expect(socket.resume).toHaveBeenCalled();
  });

  it('sends the latest GGA periodically and stops timers on disconnect', async () => {
    await startStreaming();
    const updated = gga({ 1: '123520' });
    connection.updateGga(updated);
    await jest.advanceTimersByTimeAsync(5000);
    expect(socket.write).toHaveBeenLastCalledWith(`${updated}\r\n`, 'ascii', expect.any(Function));
    connection.stop();
    const calls = socket.write.mock.calls.length;
    expect(jest.getTimerCount()).toBe(0);
    await jest.advanceTimersByTimeAsync(60000);
    expect(socket.write).toHaveBeenCalledTimes(calls);
    expect(socket.removeAllListeners).toHaveBeenCalled();
    expect(socket.destroy).toHaveBeenCalled();
    expect(connection.isRunning()).toBe(false);
  });

  it('rejects establishment if the socket never connects', async () => {
    const started = connection.start(settings, receiver, gga());
    const rejected = expect(started).rejects.toThrow('establishment timed out');
    await jest.advanceTimersByTimeAsync(15000);
    await rejected;
    expect(socket.destroy).toHaveBeenCalled();
    expect(jest.getTimerCount()).toBe(0);
  });

  it('rejects an incomplete header response after the header timeout', async () => {
    const started = connection.start(settings, receiver, gga());
    const rejected = expect(started).rejects.toThrow('complete headers');
    connected();
    socket.emit('data', Buffer.from('HTTP/1.1 200 OK\r\n'));
    await jest.advanceTimersByTimeAsync(15000);
    await rejected;
    expect(write).not.toHaveBeenCalled();
  });

  it('stops if the caster sends no corrections for 30 seconds', async () => {
    await startStreaming();
    await jest.advanceTimersByTimeAsync(30000);
    expect(onError).toHaveBeenCalledWith(expect.objectContaining({ message: expect.stringContaining('30 seconds') }));
    expect(connection.isRunning()).toBe(false);
    expect(jest.getTimerCount()).toBe(0);
  });

  it('rejects caster authentication errors before writing any corrections', async () => {
    const started = connection.start(settings, receiver, gga());
    const rejected = expect(started).rejects.toThrow('username or password');
    connected();
    socket.emit('data', Buffer.from('HTTP/1.1 401 Unauthorized\r\n\r\n'));
    await rejected;
    expect(write).not.toHaveBeenCalled();
    expect(connection.isRunning()).toBe(false);
  });

  it('stops and reports a receiver that rejects a correction write', async () => {
    await startStreaming();
    write.mockResolvedValueOnce(false);
    socket.emit('data', Buffer.from([0xd3]));
    await jest.advanceTimersByTimeAsync(1);
    expect(onError).toHaveBeenCalledWith(expect.objectContaining({ message: expect.stringContaining('rejected an RTCM write') }));
    expect(connection.isRunning()).toBe(false);
  });

  it('rejects a pending start when explicitly stopped', async () => {
    const started = connection.start(settings, receiver, gga());
    const rejected = expect(started).rejects.toThrow('was stopped');
    connection.stop();
    await rejected;
    expect(jest.getTimerCount()).toBe(0);
  });

  it('ignores stale socket callbacks after starting a new session', async () => {
    await startStreaming();
    const oldData = socket.listener('data');
    const oldError = socket.listener('error');
    const oldConnected = connected;
    socket = createSocket();
    await startStreaming();
    oldData?.(Buffer.from([0xd3]));
    oldError?.(new Error('Old connection failed'));
    oldConnected();
    await jest.advanceTimersByTimeAsync(1);
    expect(write).not.toHaveBeenCalled();
    expect(onError).not.toHaveBeenCalled();
    expect(connection.isRunning()).toBe(true);
  });
});
