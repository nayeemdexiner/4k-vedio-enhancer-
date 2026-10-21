/**
 * VideoEnhance Studio - Robust EBML WebM Duration Patcher
 * 
 * Injects or updates explicit duration metadata into WebM containers produced by MediaRecorder.
 * Browser MediaRecorder leaves Duration at 0 / undefined or omits the tag,
 * which causes media players and mobile gallery apps to stall, freeze, or disable seeking.
 */

export async function patchWebmDuration(blob: Blob, durationSeconds: number): Promise<Blob> {
  if (!blob.type.includes('webm')) {
    return blob;
  }

  try {
    const buffer = await blob.arrayBuffer();
    const bytes = new Uint8Array(buffer);
    const durationMs = Math.max(100, durationSeconds * 1000);

    // Search for Segment Info element (0x1549A966) in the first 8KB
    const maxSearch = Math.min(bytes.length - 12, 8192);
    let infoOffset = -1;

    for (let i = 0; i < maxSearch; i++) {
      if (
        bytes[i] === 0x15 &&
        bytes[i + 1] === 0x49 &&
        bytes[i + 2] === 0xa9 &&
        bytes[i + 3] === 0x66
      ) {
        infoOffset = i;
        break;
      }
    }

    if (infoOffset === -1) {
      return blob;
    }

    // Read Info length VINT
    const sizeByte = bytes[infoOffset + 4];
    let vintLen = 1;
    let infoLen = 0;

    if ((sizeByte & 0x80) !== 0) {
      vintLen = 1;
      infoLen = sizeByte & 0x7f;
    } else if ((sizeByte & 0x40) !== 0) {
      vintLen = 2;
      infoLen = ((sizeByte & 0x3f) << 8) | bytes[infoOffset + 5];
    } else if ((sizeByte & 0x20) !== 0) {
      vintLen = 3;
      infoLen = ((sizeByte & 0x1f) << 16) | (bytes[infoOffset + 5] << 8) | bytes[infoOffset + 6];
    } else {
      return blob;
    }

    const contentStart = infoOffset + 4 + vintLen;
    const contentEnd = Math.min(bytes.length, contentStart + infoLen);

    // 1. Check if Duration element (0x4489) already exists inside Segment Info
    for (let i = contentStart; i < contentEnd - 3; i++) {
      if (bytes[i] === 0x44 && bytes[i + 1] === 0x89) {
        const floatLen = bytes[i + 2] & 0x0f;
        const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
        if (floatLen === 4 && i + 7 <= bytes.length) {
          view.setFloat32(i + 3, durationMs, false);
          return new Blob([bytes], { type: blob.type });
        } else if (floatLen === 8 && i + 11 <= bytes.length) {
          view.setFloat64(i + 3, durationMs, false);
          return new Blob([bytes], { type: blob.type });
        }
      }
    }

    // 2. If Duration tag is missing (standard in Chromium output), INSERT it into Segment Info
    const durTag = new Uint8Array(11);
    durTag[0] = 0x44; // ID byte 1
    durTag[1] = 0x89; // ID byte 2
    durTag[2] = 0x88; // Length: 8-byte float64
    const durView = new DataView(durTag.buffer);
    durView.setFloat64(3, durationMs, false);

    const newBytes = new Uint8Array(bytes.length + 11);
    // Copy bytes up to contentStart
    newBytes.set(bytes.subarray(0, contentStart), 0);
    // Insert duration element
    newBytes.set(durTag, contentStart);
    // Copy remaining bytes
    newBytes.set(bytes.subarray(contentStart), contentStart + 11);

    // Update Segment Info length in newBytes
    const newInfoLen = infoLen + 11;
    if (vintLen === 1 && newInfoLen < 127) {
      newBytes[infoOffset + 4] = 0x80 | newInfoLen;
    } else if (vintLen === 2) {
      newBytes[infoOffset + 4] = 0x40 | (newInfoLen >> 8);
      newBytes[infoOffset + 5] = newInfoLen & 0xff;
    } else if (vintLen === 3) {
      newBytes[infoOffset + 4] = 0x20 | (newInfoLen >> 16);
      newBytes[infoOffset + 5] = (newInfoLen >> 8) & 0xff;
      newBytes[infoOffset + 6] = newInfoLen & 0xff;
    }

    return new Blob([newBytes], { type: blob.type });
  } catch (err) {
    console.warn('WebM duration patch notice:', err);
    return blob;
  }
}
