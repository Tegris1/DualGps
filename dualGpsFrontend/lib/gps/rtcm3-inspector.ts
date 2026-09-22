import { Buffer } from "buffer";

export type RtcmStats = {
  validFrames: number;
  invalidFrames: number;
  lastMessageType?: number;
};

export class Rtcm3Inspector {
  private frame = Buffer.alloc(1030);
  private frameLength = 0;
  private expectedLength = 0;

  private stats: RtcmStats = {
    validFrames: 0,
    invalidFrames: 0,
  };

  reset(): void {
    this.frameLength = 0;
    this.expectedLength = 0;
    this.stats = {
      validFrames: 0,
      invalidFrames: 0,
    };
  }

  accept(data: Buffer): void {
    for (const value of data) {
      if (this.frameLength === 0) {
        if (value === 0xd3) {
          this.frame[0] = value;
          this.frameLength = 1;
        }
        continue;
      }

      this.frame[this.frameLength] = value;
      this.frameLength += 1;

      if (this.frameLength === 3) {
        const reservedBits = this.frame[1] & 0xfc;
        const payloadLength = ((this.frame[1] & 0x03) << 8) | this.frame[2];

        this.expectedLength = 3 + payloadLength + 3;

        if (
          reservedBits !== 0 ||
          payloadLength < 2 ||
          this.expectedLength > this.frame.length
        ) {
          this.stats.invalidFrames += 1;
          this.restartIfPreamble(value);
          continue;
        }
      }

      if (this.expectedLength > 0 && this.frameLength === this.expectedLength) {
        const crcOffset = this.expectedLength - 3;

        const expectedCrc =
          (this.frame[crcOffset] << 16) |
          (this.frame[crcOffset + 1] << 8) |
          this.frame[crcOffset + 2];

        const actualCrc = this.crc24q(this.frame, crcOffset);

        if (actualCrc === expectedCrc) {
          this.stats.validFrames += 1;
          this.stats.lastMessageType =
            (this.frame[3] << 4) | ((this.frame[4] & 0xf0) >> 4);
        } else {
          this.stats.invalidFrames += 1;
        }

        this.frameLength = 0;
        this.expectedLength = 0;
      }
    }
  }

  private restartIfPreamble(value: number): void {
    if (value === 0xd3) {
      this.frame[0] = value;
      this.frameLength = 1;
    } else {
      this.frameLength = 0;
    }

    this.expectedLength = 0;
  }

  private crc24q(data: Buffer, length: number): number {
    let crc = 0;

    for (let index = 0; index < length; index += 1) {
      crc ^= data[index] << 16;

      for (let bit = 0; bit < 8; bit += 1) {
        crc <<= 1;

        if ((crc & 0x1000000) !== 0) {
          crc ^= 0x1864cfb;
        }
      }
    }

    return crc & 0xffffff;
  }

  getStats(): RtcmStats {
    return { ...this.stats };
  }
}
