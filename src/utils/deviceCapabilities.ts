/**
 * VideoEnhance Studio - Device Capability & Geometry Utilities
 */

import { ResolutionTarget, RESOLUTION_DEFINITIONS } from '../types';

export interface DeviceHardwareProfile {
  maxTextureSize: number;
  webgl2Available: boolean;
  canEncode4K: boolean;
  canEncode8K: boolean;
  canEncode16K: boolean;
  supportedMime: string;
}

export function detectDeviceHardware(): DeviceHardwareProfile {
  let maxTextureSize = 2048;
  let webgl2Available = false;

  try {
    const canvas = document.createElement('canvas');
    const gl = canvas.getContext('webgl2') || canvas.getContext('webgl');
    if (gl) {
      webgl2Available = Boolean(canvas.getContext('webgl2'));
      maxTextureSize = gl.getParameter(gl.MAX_TEXTURE_SIZE) || 4096;
    }
  } catch (e) {
    console.warn('GPU capability detection notice:', e);
  }

  const mediaRecSupported = typeof window !== 'undefined' && typeof window.MediaRecorder !== 'undefined';
  let supportedMime = 'video/webm';
  if (mediaRecSupported) {
    const candidateMimes = [
      'video/mp4;codecs=avc1.4d4033,mp4a.40.2', // H.264 Main Profile Level 5.1 (Up to 4K 60fps)
      'video/mp4;codecs=avc1.640033,mp4a.40.2', // H.264 High Profile Level 5.1
      'video/mp4',
      'video/webm;codecs=vp9,opus',              // Hardware-accelerated VP9 (smooth 4K, zero stutter)
      'video/webm;codecs=vp9',
      'video/webm;codecs=vp8,opus',
      'video/webm;codecs=vp8',
      'video/webm'
    ];
    for (const mime of candidateMimes) {
      if (MediaRecorder.isTypeSupported(mime)) {
        supportedMime = mime;
        break;
      }
    }
  }

  // Capability thresholds based on GPU texture ceilings and browser encoder limits
  const canEncode4K = maxTextureSize >= 3840;
  // Browser MediaRecorder implementations have max profile limits (typically Level 5.1/5.2, max 4K @ 60fps)
  const canEncode8K = maxTextureSize >= 7680;
  const canEncode16K = maxTextureSize >= 15360;

  return {
    maxTextureSize,
    webgl2Available,
    canEncode4K,
    canEncode8K,
    canEncode16K,
    supportedMime
  };
}

/**
 * Calculates output dimensions preserving original aspect ratio (never stretching)
 */
export function calculateTargetDimensions(
  sourceWidth: number,
  sourceHeight: number,
  resolution: ResolutionTarget
): { width: number; height: number; scaleFactor: number } {
  if (sourceWidth <= 0 || sourceHeight <= 0) {
    return { width: 1920, height: 1080, scaleFactor: 1 };
  }

  const aspectRatio = sourceWidth / sourceHeight;

  if (resolution === 'source') {
    return {
      width: ensureEven(sourceWidth),
      height: ensureEven(sourceHeight),
      scaleFactor: 1
    };
  }

  const def = RESOLUTION_DEFINITIONS[resolution];
  let targetWidth = 0;
  let targetHeight = 0;

  if (sourceWidth >= sourceHeight) {
    // Landscape or square orientation: nominalHeight is vertical, width = height * aspectRatio
    targetHeight = def.nominalHeight;
    targetWidth = Math.round(targetHeight * aspectRatio);
  } else {
    // Portrait / vertical mobile orientation (TikTok, Reels, Shorts):
    // The long dimension (height) matches nominalWidth16x9 (e.g. 3840 for 4K, 1920 for 1080p)
    // and width = height * aspectRatio (e.g. 3840 * (9/16) = 2160 for 4K)
    targetHeight = def.nominalWidth16x9 || Math.round(def.nominalHeight * (16 / 9));
    targetWidth = Math.round(targetHeight * aspectRatio);
  }

  const evenWidth = ensureEven(targetWidth);
  const evenHeight = ensureEven(targetHeight);
  const scaleFactor = Math.max(evenWidth / sourceWidth, evenHeight / sourceHeight);

  return {
    width: evenWidth,
    height: evenHeight,
    scaleFactor
  };
}

function ensureEven(num: number): number {
  return num % 2 === 0 ? num : num + 1;
}
