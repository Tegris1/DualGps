import { Buffer } from "buffer";

export class NtripChunkDecoder {
  private pending = Buffer.alloc(0);
  private remainingInChunk = 0;
  private finished = false;

  reset(): void {
    this.pending = Buffer.alloc(0);
    this.remainingInChunk = 0;
    this.finished = false;
  }

  push(data: Buffer): Buffer[] {
    // Implement the stateful chunk parser here.
    return [];
  }
}
