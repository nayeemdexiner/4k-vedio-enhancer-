/**
 * VideoEnhance Studio - Types & Definitions
 */

export interface MediaSourceInfo {
  id: string;
  name: string;
  size: number;
  mimeType: string;
  width: number;
  height: number;
  duration: number; // in seconds
  fps: number;
  codec: string;
  audioCodec?: string;
  audioChannels?: number;
  audioSampleRate?: number;
  hasAudio: boolean;
  bitrateKbps?: number;
  isVFR?: boolean;
  aspectRatio: string;
  fileSignatureHex?: string;
  signatureVerified?: boolean;
  blobUrl: string;
  rawFile?: File;
}

export type ResolutionTarget = 
  | 'source' 
  | '480p' 
  | '720p' 
  | '1080p' 
  | '1440p' 
  | '4k' 
  | '8k' 
  | '16k';

export type FpsTarget = 'source' | 30 | 60 | 120;

export interface ResolutionDefinition {
  id: ResolutionTarget;
  label: string;
  nominalHeight: number;
  nominalWidth16x9: number;
  tag: string;
}

export const RESOLUTION_DEFINITIONS: Record<ResolutionTarget, ResolutionDefinition> = {
  source: {
    id: 'source',
    label: 'Source',
    nominalHeight: 0,
    nominalWidth16x9: 0,
    tag: '1:1 Original'
  },
  '480p': {
    id: '480p',
    label: '480p',
    nominalHeight: 480,
    nominalWidth16x9: 854,
    tag: 'SD'
  },
  '720p': {
    id: '720p',
    label: '720p',
    nominalHeight: 720,
    nominalWidth16x9: 1280,
    tag: 'HD'
  },
  '1080p': {
    id: '1080p',
    label: '1080p',
    nominalHeight: 1080,
    nominalWidth16x9: 1920,
    tag: 'Full HD'
  },
  '1440p': {
    id: '1440p',
    label: '1440p/2K',
    nominalHeight: 1440,
    nominalWidth16x9: 2560,
    tag: '2K QHD'
  },
  '4k': {
    id: '4k',
    label: '4K UHD',
    nominalHeight: 2160,
    nominalWidth16x9: 3840,
    tag: 'Ultra HD'
  },
  '8k': {
    id: '8k',
    label: '8K',
    nominalHeight: 4320,
    nominalWidth16x9: 7680,
    tag: '8K UHD'
  },
  '16k': {
    id: '16k',
    label: '16K',
    nominalHeight: 8640,
    nominalWidth16x9: 15360,
    tag: '16K Ultra'
  }
};

export interface EnhancementConfig {
  resolution: ResolutionTarget;
  fps: FpsTarget;
  smudgeReduction: number;        // 0 - 100
  denoiseStrength: number;        // 0 - 100
  sharpenStrength: number;        // 0 - 100
  brightnessAdjustment: number;   // -50 to +50
  contrastEnhancement: number;    // 0 - 100
  saturationAdjustment: number;   // 0 - 100 (50 is neutral)
  preserveAudio: boolean;
}

export interface RenderProgress {
  currentFrame: number;
  totalFrames: number;
  percentage: number;
  fpsSpeed: number;
  currentResolution: string;
  stageMessage: string;
}

export type ValidationStatus = 'NOT_RUN' | 'RUNNING' | 'PASS' | 'FAIL' | 'NOT_SUPPORTED';

export interface ValidationCheckItem {
  id: string;
  number: number;
  name: string;
  description: string;
  status: ValidationStatus;
  measuredValue?: string | number;
  expectedValue?: string | number;
  details?: string;
  critical: boolean;
}

export interface ValidationReport {
  overallStatus?: ValidationStatus;
  passedCount?: number;
  failedCount?: number;
  totalChecks?: number;
  canDownload?: boolean;
  isValid: boolean;
  actualWidth: number;
  actualHeight: number;
  actualFps: number;
  actualDuration: number;
  fileSizeBytes: number;
  mimeType: string;
  details: string[];
  checks?: ValidationCheckItem[];
  summary?: string;
  checkedAt?: string;
}

export interface ProcessedVideoResult {
  blob: Blob;
  blobUrl: string;
  fileName: string;
  width: number;
  height: number;
  fps: number;
  duration: number;
  sizeBytes: number;
  mimeType: string;
  validation: ValidationReport;
}

export interface JobRecord {
  id: string;
  createdAt: string;
  updatedAt: string;
  status: 'idle' | 'rendering_frames' | 'completed' | 'failed' | 'cancelled';
  progress: number;
  stage: string;
  source: MediaSourceInfo;
  config: EnhancementConfig;
  outputMediaUrl?: string;
  outputFileName?: string;
  outputSize?: number;
  outputWidth?: number;
  outputHeight?: number;
  outputFps?: number;
  outputDuration?: number;
  outputHasAudio?: boolean;
  validationReport?: ValidationReport;
  error?: string;
}
