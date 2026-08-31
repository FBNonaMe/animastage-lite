"use strict";

const AVI_HEADER_BYTES = 224;
const AVI_INDEX_ENTRY_BYTES = 16;
const AVI_RIFF_LIMIT = 0xfffffff0;

const align4 = (value) => (value + 3) & ~3;

class BinaryWriter {
  constructor(size) {
    this.bytes = new Uint8Array(size);
    this.view = new DataView(this.bytes.buffer);
    this.offset = 0;
  }

  fourcc(value) {
    if (typeof value !== "string" || value.length !== 4) {
      throw new TypeError("AVI FourCC must contain exactly four characters");
    }
    for (let i = 0; i < 4; i++) this.bytes[this.offset++] = value.charCodeAt(i) & 0xff;
  }

  u16(value) {
    this.view.setUint16(this.offset, value >>> 0, true);
    this.offset += 2;
  }

  i16(value) {
    this.view.setInt16(this.offset, value | 0, true);
    this.offset += 2;
  }

  u32(value) {
    this.view.setUint32(this.offset, Number(value) >>> 0, true);
    this.offset += 4;
  }
}

export function getUncompressedAviLayout(width, height, frameCount) {
  const w = Math.max(1, Math.floor(Number(width) || 0));
  const h = Math.max(1, Math.floor(Number(height) || 0));
  const frames = Math.max(1, Math.floor(Number(frameCount) || 0));
  const rowStride = align4(w * 3);
  const frameBytes = rowStride * h;
  const frameChunkBytes = 8 + frameBytes;
  const indexBytes = 8 + frames * AVI_INDEX_ENTRY_BYTES;
  const totalBytes = AVI_HEADER_BYTES + frames * frameChunkBytes + indexBytes;
  return {
    width: w,
    height: h,
    frameCount: frames,
    rowStride,
    frameBytes,
    frameChunkBytes,
    headerBytes: AVI_HEADER_BYTES,
    indexBytes,
    totalBytes,
    fitsClassicAvi: totalBytes <= AVI_RIFF_LIMIT,
  };
}

export function estimateUncompressedAviBytes(width, height, frameCount) {
  return getUncompressedAviLayout(width, height, frameCount).totalBytes;
}

export function getMaxClassicAviFrames(width, height) {
  const one = getUncompressedAviLayout(width, height, 1);
  const fixedBytes = AVI_HEADER_BYTES + 8;
  const bytesPerFrame = one.frameChunkBytes + AVI_INDEX_ENTRY_BYTES;
  return Math.max(
    1,
    Math.floor((AVI_RIFF_LIMIT - fixedBytes) / bytesPerFrame),
  );
}

export function getUncompressedAviSegments(width, height, frameCount) {
  const total = Math.max(1, Math.floor(Number(frameCount) || 0));
  const maxFrames = getMaxClassicAviFrames(width, height);
  const segments = [];
  for (let remaining = total; remaining > 0;) {
    const frames = Math.min(maxFrames, remaining);
    segments.push(frames);
    remaining -= frames;
  }
  return segments;
}

function makeAviHeader(layout, fps) {
  const rate = Math.max(1, Math.round(Number(fps) || 30));
  const frameMicros = Math.round(1_000_000 / rate);
  const moviListSize = 4 + layout.frameCount * layout.frameChunkBytes;
  const writer = new BinaryWriter(AVI_HEADER_BYTES);

  writer.fourcc("RIFF");
  writer.u32(layout.totalBytes - 8);
  writer.fourcc("AVI ");

  writer.fourcc("LIST");
  writer.u32(192);
  writer.fourcc("hdrl");

  writer.fourcc("avih");
  writer.u32(56);
  writer.u32(frameMicros);
  writer.u32(layout.frameBytes * rate);
  writer.u32(0);
  writer.u32(0x10); // AVIF_HASINDEX
  writer.u32(layout.frameCount);
  writer.u32(0);
  writer.u32(1);
  writer.u32(layout.frameBytes);
  writer.u32(layout.width);
  writer.u32(layout.height);
  writer.u32(0);
  writer.u32(0);
  writer.u32(0);
  writer.u32(0);

  writer.fourcc("LIST");
  writer.u32(116);
  writer.fourcc("strl");

  writer.fourcc("strh");
  writer.u32(56);
  writer.fourcc("vids");
  writer.fourcc("DIB ");
  writer.u32(0);
  writer.u16(0);
  writer.u16(0);
  writer.u32(0);
  writer.u32(1);
  writer.u32(rate);
  writer.u32(0);
  writer.u32(layout.frameCount);
  writer.u32(layout.frameBytes);
  writer.u32(0xffffffff);
  writer.u32(0);
  writer.i16(0);
  writer.i16(0);
  writer.i16(layout.width);
  writer.i16(layout.height);

  writer.fourcc("strf");
  writer.u32(40);
  writer.u32(40);
  writer.u32(layout.width);
  writer.u32(layout.height);
  writer.u16(1);
  writer.u16(24);
  writer.u32(0); // BI_RGB
  writer.u32(layout.frameBytes);
  writer.u32(0);
  writer.u32(0);
  writer.u32(0);
  writer.u32(0);

  writer.fourcc("LIST");
  writer.u32(moviListSize);
  writer.fourcc("movi");

  if (writer.offset !== AVI_HEADER_BYTES) {
    throw new Error(`internal AVI header size mismatch: ${writer.offset}`);
  }
  return writer.bytes;
}

function makeFrameHeader(frameBytes) {
  const writer = new BinaryWriter(8);
  writer.fourcc("00db");
  writer.u32(frameBytes);
  return writer.bytes;
}

function makeAviIndex(layout) {
  const writer = new BinaryWriter(layout.indexBytes);
  writer.fourcc("idx1");
  writer.u32(layout.frameCount * AVI_INDEX_ENTRY_BYTES);
  for (let i = 0; i < layout.frameCount; i++) {
    writer.fourcc("00db");
    writer.u32(0x10); // AVIIF_KEYFRAME
    writer.u32(4 + i * layout.frameChunkBytes);
    writer.u32(layout.frameBytes);
  }
  return writer.bytes;
}

export class MemoryAviSink {
  constructor() {
    this.chunks = [];
    this.bytesWritten = 0;
    this.closed = false;
    this.aborted = false;
  }

  async write(chunk) {
    if (this.closed || this.aborted) throw new Error("AVI sink is not writable");
    const bytes = chunk instanceof Uint8Array ? chunk : new Uint8Array(chunk);
    const copy = bytes.slice();
    this.chunks.push(copy);
    this.bytesWritten += copy.byteLength;
  }

  async close() {
    this.closed = true;
  }

  async abort() {
    this.aborted = true;
    this.chunks.length = 0;
    this.bytesWritten = 0;
  }

  toBlob() {
    if (!this.closed || this.aborted) throw new Error("AVI sink is not finalized");
    return new Blob(this.chunks, { type: "video/x-msvideo" });
  }
}

// Chromium may invalidate a FileSystemWritableFileStream while a long GPU
// render yields between frames (InvalidStateError: cached interface state
// changed). Keep the durable byte offset outside that transient stream and
// reopen the same user-approved handle without truncating already written AVI
// data. Every write is positional, so a retry can never duplicate a chunk.
export class RecoverableFileAviSink {
  constructor(handle, { maxRetries = 2 } = {}) {
    if (!handle || typeof handle.createWritable !== "function") {
      throw new TypeError("recoverable AVI sink requires a file handle");
    }
    this.handle = handle;
    this.maxRetries = Math.max(0, Math.floor(Number(maxRetries) || 0));
    this.stream = null;
    this.position = 0;
    this.closed = false;
    this.aborted = false;
    this.reopenCount = 0;
  }

  async _open() {
    if (this.closed || this.aborted) throw new Error("AVI sink is not writable");
    this.stream = await this.handle.createWritable({ keepExistingData: true });
    this.reopenCount++;
  }

  async _discardStream() {
    const stale = this.stream;
    this.stream = null;
    try { await stale?.abort?.(); } catch (_) {}
  }

  async write(chunk) {
    const bytes = chunk instanceof Uint8Array ? chunk : new Uint8Array(chunk);
    let lastError = null;
    for (let attempt = 0; attempt <= this.maxRetries; attempt++) {
      try {
        if (!this.stream) await this._open();
        await this.stream.write({
          type: "write",
          position: this.position,
          data: bytes,
        });
        this.position += bytes.byteLength;
        return;
      } catch (error) {
        lastError = error;
        await this._discardStream();
      }
    }
    throw lastError || new Error("AVI file write failed");
  }

  async close() {
    if (this.closed) return;
    if (!this.stream) await this._open();
    await this.stream.truncate(this.position);
    await this.stream.close();
    this.stream = null;
    this.closed = true;
  }

  async abort(reason) {
    if (this.closed || this.aborted) return;
    this.aborted = true;
    const stale = this.stream;
    this.stream = null;
    try { await stale?.abort?.(reason); } catch (_) {}
  }
}

export class UncompressedAviWriter {
  constructor({ width, height, fps = 30, frameCount, sink }) {
    if (!sink || typeof sink.write !== "function") {
      throw new TypeError("AVI writer requires a writable sink");
    }
    this.layout = getUncompressedAviLayout(width, height, frameCount);
    if (!this.layout.fitsClassicAvi) {
      const gib = (this.layout.totalBytes / 1024 ** 3).toFixed(2);
      throw new RangeError(
        `Uncompressed AVI would be ${gib} GiB. Classic AVI is limited to 4 GiB; shorten the range or lower the resolution.`,
      );
    }
    if (this.layout.width > 32767 || this.layout.height > 32767) {
      throw new RangeError("AVI dimensions exceed the 16-bit stream header");
    }
    this.fps = Math.max(1, Math.round(Number(fps) || 30));
    this.sink = sink;
    this.framesWritten = 0;
    this.started = false;
    this.finalized = false;
    this._frameHeader = makeFrameHeader(this.layout.frameBytes);
    this._bgr = new Uint8Array(this.layout.frameBytes);
    this._canvas = null;
    this._context = null;
  }

  async start() {
    if (this.started) return;
    await this.sink.write(makeAviHeader(this.layout, this.fps));
    this.started = true;
  }

  _convertRgbaToBottomUpBgr(rgba) {
    const { width, height, rowStride, frameBytes } = this.layout;
    if (!rgba || rgba.length !== width * height * 4) {
      throw new RangeError("RGBA frame dimensions do not match the AVI stream");
    }
    if (this._bgr.length !== frameBytes) this._bgr = new Uint8Array(frameBytes);
    this._bgr.fill(0);
    for (let y = 0; y < height; y++) {
      let src = (height - 1 - y) * width * 4;
      let dst = y * rowStride;
      for (let x = 0; x < width; x++) {
        this._bgr[dst++] = rgba[src + 2];
        this._bgr[dst++] = rgba[src + 1];
        this._bgr[dst++] = rgba[src];
        src += 4;
      }
    }
    return this._bgr;
  }

  async addFrameRGBA(rgba) {
    if (!this.started) await this.start();
    if (this.finalized) throw new Error("AVI writer is already finalized");
    if (this.framesWritten >= this.layout.frameCount) {
      throw new RangeError("AVI received more frames than declared");
    }
    const bgr = this._convertRgbaToBottomUpBgr(rgba);
    await this.sink.write(this._frameHeader);
    await this.sink.write(bgr);
    this.framesWritten++;
  }

  async addCanvas(canvas) {
    if (!canvas) throw new TypeError("AVI frame canvas is required");
    const { width, height } = this.layout;
    if (!this._canvas && typeof document !== "undefined") {
      this._canvas = document.createElement("canvas");
      this._context = this._canvas.getContext("2d", {
        alpha: false,
        willReadFrequently: true,
      });
    }
    if (!this._canvas || !this._context) {
      throw new Error("Canvas readback is unavailable in this environment");
    }
    if (this._canvas.width !== width || this._canvas.height !== height) {
      this._canvas.width = width;
      this._canvas.height = height;
    }
    this._context.drawImage(canvas, 0, 0, width, height);
    const frame = this._context.getImageData(0, 0, width, height);
    await this.addFrameRGBA(frame.data);
  }

  async finalize() {
    if (this.finalized) return;
    if (!this.started) await this.start();
    if (this.framesWritten !== this.layout.frameCount) {
      throw new Error(
        `AVI frame count mismatch: wrote ${this.framesWritten}, expected ${this.layout.frameCount}`,
      );
    }
    await this.sink.write(makeAviIndex(this.layout));
    await this.sink.close?.();
    this.finalized = true;
  }

  async abort(reason) {
    if (this.finalized) return;
    await this.sink.abort?.(reason);
    this.finalized = true;
  }

  get diagnostics() {
    return {
      ...this.layout,
      fps: this.fps,
      framesWritten: this.framesWritten,
      started: this.started,
      finalized: this.finalized,
    };
  }
}

/**
 * Long uncompressed renders are split into independently playable AVI 1.0
 * parts before any RIFF chunk reaches 4 GiB. No pixels are recompressed and
 * there is no missing/duplicated frame at a boundary.
 */
export class SegmentedUncompressedAviWriter {
  constructor({
    width,
    height,
    fps = 30,
    frameCount,
    createSink,
    maxFramesPerSegment = null,
  }) {
    if (typeof createSink !== "function") {
      throw new TypeError("segmented AVI writer requires createSink");
    }
    this.width = Math.max(1, Math.floor(Number(width) || 0));
    this.height = Math.max(1, Math.floor(Number(height) || 0));
    this.fps = Math.max(1, Math.round(Number(fps) || 30));
    this.frameCount = Math.max(1, Math.floor(Number(frameCount) || 0));
    const safeMax = getMaxClassicAviFrames(this.width, this.height);
    const requestedMax = maxFramesPerSegment == null
      ? safeMax
      : Math.max(1, Math.floor(Number(maxFramesPerSegment) || 1));
    this.maxFramesPerSegment = Math.min(safeMax, requestedMax);
    this.segmentFrames = [];
    for (let remaining = this.frameCount; remaining > 0;) {
      const frames = Math.min(this.maxFramesPerSegment, remaining);
      this.segmentFrames.push(frames);
      remaining -= frames;
    }
    this.createSink = createSink;
    this.framesWritten = 0;
    this.segmentIndex = -1;
    this.current = null;
    this.finalized = false;
    this.aborted = false;
    this.completedSegments = [];
  }

  async _startSegment(index) {
    const frames = this.segmentFrames[index];
    if (!frames) throw new Error("AVI segment index is out of range");
    const sink = await this.createSink({
      index,
      part: index + 1,
      partCount: this.segmentFrames.length,
      frameCount: frames,
    });
    this.current = new UncompressedAviWriter({
      width: this.width,
      height: this.height,
      fps: this.fps,
      frameCount: frames,
      sink,
    });
    this.segmentIndex = index;
    await this.current.start();
  }

  async _ensureWritableSegment() {
    if (this.finalized || this.aborted) {
      throw new Error("segmented AVI writer is not writable");
    }
    if (!this.current) {
      await this._startSegment(0);
      return;
    }
    if (this.current.framesWritten < this.current.layout.frameCount) return;
    await this.current.finalize();
    this.completedSegments.push(this.current.diagnostics);
    await this._startSegment(this.segmentIndex + 1);
  }

  async addFrameRGBA(rgba) {
    if (this.framesWritten >= this.frameCount) {
      throw new RangeError("segmented AVI received more frames than declared");
    }
    await this._ensureWritableSegment();
    await this.current.addFrameRGBA(rgba);
    this.framesWritten++;
  }

  async addCanvas(canvas) {
    if (this.framesWritten >= this.frameCount) {
      throw new RangeError("segmented AVI received more frames than declared");
    }
    await this._ensureWritableSegment();
    await this.current.addCanvas(canvas);
    this.framesWritten++;
  }

  async finalize() {
    if (this.finalized) return;
    if (this.framesWritten !== this.frameCount) {
      throw new Error(
        `AVI frame count mismatch: wrote ${this.framesWritten}, expected ${this.frameCount}`,
      );
    }
    if (this.current && !this.current.finalized) {
      await this.current.finalize();
      this.completedSegments.push(this.current.diagnostics);
    }
    this.finalized = true;
  }

  async abort(reason) {
    if (this.finalized || this.aborted) return;
    this.aborted = true;
    await this.current?.abort?.(reason);
  }

  get diagnostics() {
    const segments = [
      ...this.completedSegments,
      ...(this.current && !this.current.finalized
        ? [this.current.diagnostics]
        : []),
    ];
    return {
      width: this.width,
      height: this.height,
      fps: this.fps,
      frameCount: this.frameCount,
      framesWritten: this.framesWritten,
      partCount: this.segmentFrames.length,
      completedPartCount: this.completedSegments.length,
      totalBytes: segments.reduce(
        (sum, segment) => sum + (segment.totalBytes || 0),
        0,
      ),
      finalized: this.finalized,
      aborted: this.aborted,
    };
  }
}
