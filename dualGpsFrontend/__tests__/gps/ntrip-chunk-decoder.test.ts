import { describe, expect, it } from '@jest/globals';
import { Buffer } from 'buffer';

import { NtripChunkDecoder } from '../../lib/gps/ntrip-chunk-decoder';

const payload = Buffer.from([0xd3, 0, 0xff, 13, 10, 0x80, 1]);
const response = Buffer.concat([
  Buffer.from('3;extension=value\r\n'), payload.subarray(0, 3),
  Buffer.from('\r\n4\r\n'), payload.subarray(3), Buffer.from('\r\n0\r\n\r\n'),
]);

describe('NTRIP chunk decoding', () => {
  it('preserves binary payload bytes and removes chunk framing', () => {
    expect(Buffer.concat(new NtripChunkDecoder().push(response))).toEqual(payload);
  });

  it('decodes identically at every possible two-packet split', () => {
    for (let split = 0; split <= response.length; split++) {
      const decoder = new NtripChunkDecoder();
      const output = [...decoder.push(response.subarray(0, split)), ...decoder.push(response.subarray(split))];
      expect(Buffer.concat(output)).toEqual(payload);
    }
  });

  it('handles headers, payload and separators arriving one byte at a time', () => {
    const decoder = new NtripChunkDecoder();
    const output = Array.from(response).flatMap((byte) => decoder.push(Buffer.from([byte])));
    expect(Buffer.concat(output)).toEqual(payload);
  });

  it.each(['xyz\r\n', '-1\r\n', '1g\r\n', '1000001\r\n', 'FFFFFFFFFFFFFFFF\r\n'])
    ('rejects malformed or oversized chunk sizes: %j', (input) => {
      expect(() => new NtripChunkDecoder().push(Buffer.from(input))).toThrow();
    });

  it('rejects a missing CRLF after the chunk body', () => {
    expect(() => new NtripChunkDecoder().push(Buffer.from('1\r\naXX')))
      .toThrow('Invalid separator');
  });

  it('bounds incomplete chunk-size headers', () => {
    expect(() => new NtripChunkDecoder().push(Buffer.from('f'.repeat(129))))
      .toThrow('too long');
  });

  it('ignores additional data after the terminating chunk', () => {
    const decoder = new NtripChunkDecoder();
    decoder.push(response);
    expect(decoder.push(response)).toEqual([]);
  });

  it.each([Buffer.from('A'), Buffer.from('8\r\npartial'), response])
    ('reset discards partial or completed response state', (previous) => {
      const decoder = new NtripChunkDecoder();
      decoder.push(previous);
      decoder.reset();
      expect(Buffer.concat(decoder.push(response))).toEqual(payload);
    });
});
