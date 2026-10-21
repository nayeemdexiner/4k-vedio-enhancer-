/**
 * VideoEnhance Studio - Robust WebM Duration Patcher
 * 
 * Uses the industry-standard fix-webm-duration engine to properly parse EBML
 * and inject seekable duration metadata without corrupting SeekHead, Tracks, or Cluster offsets.
 */

import fixWebmDuration from 'fix-webm-duration';

export async function patchWebmDuration(blob: Blob, durationSeconds: number): Promise<Blob> {
  if (!blob || !blob.type.includes('webm')) {
    return blob;
  }

  try {
    const durationMs = Math.max(100, Math.round(durationSeconds * 1000));
    return await new Promise<Blob>((resolve) => {
      // Fix WebM duration asynchronously via EBML tree rewrite
      fixWebmDuration(blob, durationMs, (fixedBlob: Blob) => {
        if (fixedBlob && fixedBlob.size > 0) {
          resolve(fixedBlob);
        } else {
          resolve(blob);
        }
      });
    });
  } catch (err) {
    console.warn('WebM duration patch notice:', err);
    return blob;
  }
}
