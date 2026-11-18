/**
 * The image a user starts image-to-image from, checked before any model call: the format and
 * the pixel size are read from the file header (PNG, JPEG, WebP), so a file that only claims
 * to be an image is refused. No image library: only the header bytes are read.
 *
 * Limits: MAX_SOURCE_BYTES keeps the base64 request body under the Lambda request payload
 * limit (6 MB) through CloudFront. The pixel limits (64 px per side, 9,437,184 pixels) are the
 * values the Stability AI image services document; whether SD3.5 Large on Bedrock has exactly
 * the same limits was not checked, so the model may still refuse an image inside them.
 */
export const MAX_SOURCE_BYTES = 3 * 1024 * 1024;
export const MIN_SIDE = 64;
export const MAX_PIXELS = 9_437_184;

export type SourceFormat = 'png' | 'jpeg' | 'webp';

export class SourceImageError extends Error {}

export interface SourceImage {
  format: SourceFormat;
  width: number;
  height: number;
  bytes: number;
}

function pngSize(b: Uint8Array): [number, number] | null {
  const sig = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
  if (b.length < 24 || !sig.every((v, i) => b[i] === v)) return null;
  const view = new DataView(b.buffer, b.byteOffset, b.byteLength);
  return [view.getUint32(16), view.getUint32(20)];
}

function jpegSize(b: Uint8Array): [number, number] | null {
  if (b.length < 4 || b[0] !== 0xff || b[1] !== 0xd8) return null;
  let i = 2;
  while (i + 9 < b.length) {
    if (b[i] !== 0xff) return null;
    const marker = b[i + 1];
    if (marker === 0xd8 || marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) { i += 2; continue; }
    const len = (b[i + 2] << 8) | b[i + 3];
    // Start-of-frame markers carry the size; DHT (C4), JPG (C8) and DAC (CC) do not.
    if (marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc) {
      return [(b[i + 7] << 8) | b[i + 8], (b[i + 5] << 8) | b[i + 6]];
    }
    i += 2 + len;
  }
  return null;
}

function webpSize(b: Uint8Array): [number, number] | null {
  const tag = (o: number) => String.fromCharCode(b[o], b[o + 1], b[o + 2], b[o + 3]);
  if (b.length < 30 || tag(0) !== 'RIFF' || tag(8) !== 'WEBP') return null;
  const chunk = tag(12);
  if (chunk === 'VP8X') {
    return [1 + (b[24] | (b[25] << 8) | (b[26] << 16)), 1 + (b[27] | (b[28] << 8) | (b[29] << 16))];
  }
  if (chunk === 'VP8 ') {
    return [(b[26] | (b[27] << 8)) & 0x3fff, (b[28] | (b[29] << 8)) & 0x3fff];
  }
  if (chunk === 'VP8L' && b[20] === 0x2f) {
    const bits = b[21] | (b[22] << 8) | (b[23] << 16) | (b[24] << 24);
    return [(bits & 0x3fff) + 1, ((bits >>> 14) & 0x3fff) + 1];
  }
  return null;
}

/** Decode and check a base64 source image. Throws SourceImageError naming the problem. */
export function checkSourceImage(base64: string): SourceImage & { data: Uint8Array } {
  const clean = (base64 || '').replace(/^data:image\/[a-z]+;base64,/i, '').replace(/\s/g, '');
  if (!clean) throw new SourceImageError('the source image is empty');
  if (!/^[A-Za-z0-9+/]+={0,2}$/.test(clean)) throw new SourceImageError('the source image is not base64');
  if (Math.floor((clean.length * 3) / 4) > MAX_SOURCE_BYTES + 3) {
    throw new SourceImageError(`the source image is larger than ${MAX_SOURCE_BYTES / 1024 / 1024} MB`);
  }
  const data = Uint8Array.from(Buffer.from(clean, 'base64'));
  if (data.length > MAX_SOURCE_BYTES) throw new SourceImageError(`the source image is larger than ${MAX_SOURCE_BYTES / 1024 / 1024} MB`);
  const found: [SourceFormat, [number, number] | null][] = [['png', pngSize(data)], ['jpeg', jpegSize(data)], ['webp', webpSize(data)]];
  const hit = found.find(([, size]) => size);
  if (!hit) throw new SourceImageError('the source image is not a PNG, JPEG or WebP file');
  const [format, [width, height]] = hit as [SourceFormat, [number, number]];
  if (width < MIN_SIDE || height < MIN_SIDE) throw new SourceImageError(`each side of the source image must be at least ${MIN_SIDE} pixels (${width}x${height})`);
  if (width * height > MAX_PIXELS) throw new SourceImageError(`the source image has more than ${MAX_PIXELS} pixels (${width}x${height})`);
  return { format, width, height, bytes: data.length, data };
}
