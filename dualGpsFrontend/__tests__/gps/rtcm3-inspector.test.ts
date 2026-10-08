import { describe, expect, it } from '@jest/globals';
import { Buffer } from 'buffer';

import { Rtcm3Inspector } from '../../lib/gps/rtcm3-inspector';

// Synthetic framing fixtures, not complete semantic RTCM messages. CRCs were
// calculated independently using BigInt polynomial long division (0x1864CFB),
// cross-checked against CRC24Q('123456789') = 0xCDE703, and frozen here.
const frame1005 = Buffer.from('d300063ed0000180ff2f7f02', 'hex');
const frame1077 = Buffer.from('d3000443500001c2b2d5', 'hex');

describe('RTCM 3 stream inspection', () => {
  it('validates a fixed CRC fixture and extracts the message type', () => {
    const inspector = new Rtcm3Inspector();
    inspector.accept(frame1005);
    expect(inspector.getStats()).toEqual({ validFrames: 1, invalidFrames: 0, lastMessageType: 1005 });
  });

  it('handles every possible split within a frame', () => {
    for (let split = 0; split <= frame1005.length; split++) {
      const inspector = new Rtcm3Inspector();
      inspector.accept(frame1005.subarray(0, split));
      inspector.accept(frame1005.subarray(split));
      expect(inspector.getStats()).toEqual({ validFrames: 1, invalidFrames: 0, lastMessageType: 1005 });
    }
  });

  it('ignores leading noise and counts consecutive byte-fragmented frames', () => {
    const inspector = new Rtcm3Inspector();
    const stream = Buffer.concat([Buffer.from([0, 0xff, 13, 10]), frame1005, frame1077]);
    for (const byte of stream) inspector.accept(Buffer.from([byte]));
    expect(inspector.getStats()).toEqual({ validFrames: 2, invalidFrames: 0, lastMessageType: 1077 });
  });

  it.each([3, frame1005.length - 1])('detects corruption at byte %i and recovers for the next frame', (index) => {
    const corrupted = Buffer.from(frame1005);
    corrupted[index] ^= 1;
    const inspector = new Rtcm3Inspector();
    inspector.accept(Buffer.concat([corrupted, frame1077]));
    expect(inspector.getStats()).toEqual({ validFrames: 1, invalidFrames: 1, lastMessageType: 1077 });
  });

  it.each(['d3fc02', 'd30000', 'd30001'])('rejects invalid reserved bits or payload length: %s', (header) => {
    const inspector = new Rtcm3Inspector();
    inspector.accept(Buffer.concat([Buffer.from(header, 'hex'), frame1005]));
    expect(inspector.getStats()).toEqual({ validFrames: 1, invalidFrames: 1, lastMessageType: 1005 });
  });

  it('does not count an incomplete frame as valid or invalid', () => {
    const inspector = new Rtcm3Inspector();
    inspector.accept(frame1005.subarray(0, -1));
    expect(inspector.getStats()).toEqual({ validFrames: 0, invalidFrames: 0 });
  });

  it('reset clears statistics and buffered partial frames', () => {
    const inspector = new Rtcm3Inspector();
    inspector.accept(frame1005);
    inspector.accept(frame1077.subarray(0, 4));
    inspector.reset();
    expect(inspector.getStats()).toEqual({ validFrames: 0, invalidFrames: 0 });
    inspector.accept(frame1077);
    expect(inspector.getStats()).toEqual({ validFrames: 1, invalidFrames: 0, lastMessageType: 1077 });
  });
});
