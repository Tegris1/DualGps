import { Buffer } from "buffer";

const RTCM3_PREAMBLE = 0xd3;
const RTCM_HEADER_LENGTH = 3;
const RTCM_CRC_LENGTH = 3;
const RTCM_MIN_PAYLOAD_LENGTH = 2;
const RTCM_MAX_FRAME_LENGTH = 1_030;
const RTCM_CRC24Q_POLYNOMIAL = 0x1864cfb;

export type RtcmStats = {
  validFrames: number;
  invalidFrames: number;
  lastMessageType?: number;
};

export class Rtcm3Inspector {
  private readonly frame = Buffer.alloc(RTCM_MAX_FRAME_LENGTH);
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
        if (value === RTCM3_PREAMBLE) {
          this.frame[0] = value;
          this.frameLength = 1;
        }
        continue;
      }

      this.frame[this.frameLength] = value;
      this.frameLength += 1;

      if (this.frameLength === RTCM_HEADER_LENGTH) {
        const reservedBits = this.frame[1] & 0xfc;
        const payloadLength = ((this.frame[1] & 0x03) << 8) | this.frame[2];

        this.expectedLength =
          RTCM_HEADER_LENGTH + payloadLength + RTCM_CRC_LENGTH;

        if (
          reservedBits !== 0 ||
          payloadLength < RTCM_MIN_PAYLOAD_LENGTH ||
          this.expectedLength > this.frame.length
        ) {
          this.stats.invalidFrames += 1;
          this.restartIfPreamble(value);
          continue;
        }
      }

      if (this.expectedLength > 0 && this.frameLength === this.expectedLength) {
        const crcOffset = this.expectedLength - RTCM_CRC_LENGTH;
        const expectedCrc =
          (this.frame[crcOffset] << 16) |
          (this.frame[crcOffset + 1] << 8) |
          this.frame[crcOffset + 2];

        if (this.crc24q(crcOffset) === expectedCrc) {
          this.stats.validFrames += 1;
          this.stats.lastMessageType =
            (this.frame[RTCM_HEADER_LENGTH] << 4) |
            (this.frame[RTCM_HEADER_LENGTH + 1] >> 4);
        } else {
          this.stats.invalidFrames += 1;
        }

        this.frameLength = 0;
        this.expectedLength = 0;
      }
    }
  }

  getStats(): RtcmStats {
    return { ...this.stats };
  }

  private restartIfPreamble(value: number): void {
    if (value === RTCM3_PREAMBLE) {
      this.frame[0] = value;
      this.frameLength = 1;
    } else {
      this.frameLength = 0;
    }

    this.expectedLength = 0;
  }

  private crc24q(length: number): number {
    let crc = 0;

    for (let index = 0; index < length; index += 1) {
      crc ^= this.frame[index] << 16;

      for (let bit = 0; bit < 8; bit += 1) {
        crc <<= 1;

        if ((crc & 0x1000000) !== 0) {
          crc ^= RTCM_CRC24Q_POLYNOMIAL;
        }
      }
    }

    return crc & 0xffffff;
  }
}
