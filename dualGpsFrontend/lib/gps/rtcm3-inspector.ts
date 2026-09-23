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

  accept(data: Buffer): void {}

  getStats(): RtcmStats {
    return { ...this.stats };
  }
}
