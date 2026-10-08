import { describe, expect, it } from '@jest/globals';

import {
  buildNtripRequest, normalizeGga, ntripStatusMessage, parseNtripHeaders,
  successfulNtripStatus, validateNtripSettings, type NtripSettings,
} from '../../lib/gps/ntrip-protocol';

const settings: NtripSettings = {
  host: 'caster.example.com', port: 2101, mountpoint: 'STREAM',
  username: 'user', password: 'pass', useTls: false,
};

describe('NTRIP settings and requests', () => {
  it('builds an authenticated request with a normalized mountpoint and CRLF framing', () => {
    const request = buildNtripRequest({ ...settings, mountpoint: ' /STREAM ' });
    expect(request.startsWith('GET /STREAM HTTP/1.1\r\n')).toBe(true);
    expect(request).toContain('Host: caster.example.com:2101\r\n');
    expect(request).toContain('Authorization: Basic dXNlcjpwYXNz\r\n');
    expect(request).toContain('Ntrip-Version: Ntrip/2.0\r\n');
    expect(request.endsWith('\r\n\r\n')).toBe(true);
    expect(request).not.toContain('user:pass');
  });

  it('normalizes settings without modifying the input or password', () => {
    const input = { ...settings, host: ' caster.example.com ', username: ' user ', mountpoint: ' //STREAM ', password: ' pass ' };
    expect(validateNtripSettings(input)).toEqual({ ...settings, password: ' pass ' });
    expect(input.host).toBe(' caster.example.com ');
  });

  it.each([0, -1, 65536, 2101.5, NaN, Infinity])('rejects invalid port %s', (port) => {
    expect(() => validateNtripSettings({ ...settings, port })).toThrow('port');
  });

  it.each([1, 65535])('accepts boundary port %i', (port) => {
    expect(validateNtripSettings({ ...settings, port }).port).toBe(port);
  });

  it.each([
    { host: '' }, { username: ' ' }, { mountpoint: '/' }, { mountpoint: 'bad stream' },
    { host: 'caster\r\nInjected: value' }, { username: 'user\nInjected' },
    { password: 'pass\rInjected' }, { mountpoint: 'STREAM\r\nInjected' },
  ])('rejects missing fields and request injection: %j', (override) => {
    expect(() => validateNtripSettings({ ...settings, ...override })).toThrow();
  });

  it('normalizes outgoing GGA to exactly one CRLF terminator', () => {
    expect(normalizeGga(' $GPGGA,example*00\r\n ')).toBe('$GPGGA,example*00\r\n');
  });
});

describe('NTRIP responses', () => {
  it.each(['ICY 200 OK', 'HTTP/1.0 200 OK', 'HTTP/1.1 200 OK'])('accepts %s', (status) => {
    expect(successfulNtripStatus(status)).toBe(true);
  });

  it.each(['', 'HTTP/1.1 401 Unauthorized', 'HTTP/1.1 403 Forbidden', 'HTTP/1.1 404 Not Found', 'SOURCETABLE 200 OK'])
    ('rejects unsuccessful stream response %s', (status) => {
      expect(successfulNtripStatus(status)).toBe(false);
    });

  it('parses case-insensitive headers and retains colons in values', () => {
    expect(parseNtripHeaders('HTTP/1.1 200 OK\r\nTransfer-Encoding: chunked\r\nX-Source: host:2101\r\nInvalid line\r\n\r\n'))
      .toEqual({ statusLine: 'HTTP/1.1 200 OK', headers: { 'transfer-encoding': 'chunked', 'x-source': 'host:2101' } });
  });

  it.each([
    ['HTTP/1.1 401 Unauthorized', 'username or password'],
    ['HTTP/1.1 403 Forbidden', 'denied access'],
    ['HTTP/1.1 404 Not Found', 'mountpoint was not found'],
    ['SOURCETABLE 200 OK', 'source table'], ['', 'empty response'],
    ['HTTP/1.1 500 Server Error', 'HTTP/1.1 500 Server Error'],
  ])('explains caster errors for %s', (status, message) => {
    expect(ntripStatusMessage(status)).toContain(message);
  });
});
