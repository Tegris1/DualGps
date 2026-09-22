import { Buffer } from "buffer";

const MAX_CHUNK_BYTES = 16 * 1024 * 1024;

export class NtripChunkDecoder {
  private pending = Buffer.alloc(0);
  private remainingInChunk = 0;
  private finished = false;
  private needsChunkTerminator = false;

  reset(): void {
    this.pending = Buffer.alloc(0);
    this.remainingInChunk = 0;
    this.finished = false;
    this.needsChunkTerminator = false;
  }

  push(data: Buffer): Buffer[] {
    if (this.finished) return [];

    this.pending = Buffer.concat([this.pending, data]);
    const output: Buffer[] = [];

    while (!this.finished) {
      // Consume the CRLF after the previous chunk body.
      if (this.needsChunkTerminator) {
        if (this.pending.length < 2) break;

        if (this.pending[0] !== 13 || this.pending[1] !== 10) {
          throw new Error("Invalid separator in chunked NTRIP response");
        }

        this.pending = this.pending.subarray(2);
        this.needsChunkTerminator = false;
      }

      // Read the next hexadecimal chunk size.
      if (this.remainingInChunk === 0) {
        const lineEnd = this.pending.indexOf("\r\n");

        if (lineEnd < 0) {
          if (this.pending.length > 128) {
            throw new Error("NTRIP chunk-size line is too long");
          }
          break;
        }

        const line = this.pending.subarray(0, lineEnd).toString("ascii").trim();
        this.pending = this.pending.subarray(lineEnd + 2);

        // Ignore blank lines like the Kotlin implementation.
        if (!line) continue;

        const sizeText = line.split(";", 1)[0].trim();
        if (!/^[0-9a-fA-F]+$/.test(sizeText)) {
          throw new Error("Invalid chunk in NTRIP response");
        }

        this.remainingInChunk = Number.parseInt(sizeText, 16);

        if (
          !Number.isSafeInteger(this.remainingInChunk) ||
          this.remainingInChunk > MAX_CHUNK_BYTES
        ) {
          throw new Error("NTRIP chunk is too large");
        }

        if (this.remainingInChunk === 0) {
          this.finished = true;
          this.pending = Buffer.alloc(0);
          break;
        }
      }

      if (this.pending.length === 0) break;

      const count = Math.min(this.pending.length, this.remainingInChunk);

      output.push(Buffer.from(this.pending.subarray(0, count)));
      this.pending = this.pending.subarray(count);
      this.remainingInChunk -= count;

      if (this.remainingInChunk === 0) {
        this.needsChunkTerminator = true;
      }
    }

    return output;
  }
}
