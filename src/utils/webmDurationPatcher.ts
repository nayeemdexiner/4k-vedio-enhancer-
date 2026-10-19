/**
 * VideoEnhance Studio - EBML WebM Duration Patcher
 * 
 * Injects explicit duration metadata into WebM containers produced by MediaRecorder.
 * Browser MediaRecorder leaves Duration at 0 / undefined, causing media players
 * and mobile gallery apps to stall, freeze, or disable seeking.
 */

export async function patchWebmDuration(blob: Blob, durationSeconds: number): Promise<Blob> {
  if (!blob.type.includes('webm')) {
    return blob;
  }

  try {
    const buffer = await blob.arrayBuffer();
    const view = new DataView(buffer);
    const bytes = new Uint8Array(buffer);

    // Search for Segment Info element (0x1549A966) in the first 4KB
    const maxSearch = Math.min(bytes.length - 12, 4096);
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

    // Search for Duration element (0x4489) inside Segment Info
    const infoSearchEnd = Math.min(bytes.length - 8, infoOffset + 500);
    let durationOffset = -1;

    for (let i = infoOffset + 4; i < infoSearchEnd; i++) {
      if (bytes[i] === 0x44 && bytes[i + 1] === 0x89) {
        durationOffset = i;
        break;
      }
    }

    const durationMs = durationSeconds * 1000;

    if (durationOffset !== -1) {
      // Duration tag found: check size descriptor
      const sizeByte = bytes[durationOffset + 2];
      const floatLen = sizeByte & 0x0f; // typically 4 or 8

      if (floatLen === 4 && durationOffset + 7 <= bytes.length) {
        view.setFloat32(durationOffset + 3, durationMs, false);
        return new Blob([buffer], { type: blob.type });
      } else if (floatLen === 8 && durationOffset + 11 <= bytes.length) {
        view.setFloat64(durationOffset + 3, durationMs, false);
        return new Blob([buffer], { type: blob.type });
      }
    }

    return blob;
  } catch {
    return blob;
  }
}
