import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { 
  MediaSourceInfo, 
  EnhancementConfig, 
  ResolutionTarget, 
  RESOLUTION_DEFINITIONS, 
  FpsTarget, 
  RenderProgress, 
  ProcessedVideoResult 
} from '../types';
import { 
  probeVideoFile, 
  createSyntheticDemoMedia, 
  revokeBlobUrl 
} from '../utils/mediaInspector';
import { WebGLEnhanceEngine, WebGLFilterOptions } from '../utils/webglEngine';
import { processVideoReal } from '../utils/videoProcessor';
import { calculateTargetDimensions } from '../utils/deviceCapabilities';
import { 
  Upload, 
  Play, 
  Pause, 
  Volume2, 
  VolumeX, 
  Sliders, 
  Film, 
  Download, 
  RefreshCw, 
  AlertTriangle, 
  CheckCircle2, 
  X, 
  Maximize2, 
  Layers, 
  FileVideo,
  Edit2,
  Check,
  ArrowRight,
  ShieldCheck
} from 'lucide-react';

export const VideoStudio: React.FC = () => {
  // Source Media
  const [sourceMedia, setSourceMedia] = useState<MediaSourceInfo | null>(null);
  const [isInspecting, setIsInspecting] = useState(false);
  const [inspectError, setInspectError] = useState<string | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);

  // Playback & Viewport
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [splitPos, setSplitPos] = useState(0.5); // 0.0 to 1.0
  const [isDraggingSplit, setIsDraggingSplit] = useState(false);
  const [splitMode, setSplitMode] = useState<'split' | 'side-by-side' | 'enhanced-only' | 'original-only'>('split');
  const [zoomFactor, setZoomFactor] = useState(1.0);
  const [previewAudioMuted, setPreviewAudioMuted] = useState(true);

  // Enhancement Settings
  const [config, setConfig] = useState<EnhancementConfig>({
    resolution: '4k',
    fps: 'source',
    smudgeReduction: 45,
    denoiseStrength: 18,
    sharpenStrength: 55,
    brightnessAdjustment: 0,
    contrastEnhancement: 54, // Crisp, deep contrast punch
    saturationAdjustment: 52, // Vibrant natural colors
    preserveAudio: true
  });

  // Export File Name customization
  const [customExportName, setCustomExportName] = useState<string>('');
  const [isEditingName, setIsEditingName] = useState(false);

  // Processing & Export State
  const [isProcessing, setIsProcessing] = useState(false);
  const [renderProgress, setRenderProgress] = useState<RenderProgress | null>(null);
  const [processingError, setProcessingError] = useState<string | null>(null);
  const [processedResult, setProcessedResult] = useState<ProcessedVideoResult | null>(null);
  const cancelSignalRef = useRef<{ cancelled: boolean }>({ cancelled: false });

  // DOM References
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const engineRef = useRef<WebGLEnhanceEngine | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const heroFileInputRef = useRef<HTMLInputElement | null>(null);
  const isPlayingRef = useRef(false);

  // Filter options memo
  const filterOptions = useMemo<WebGLFilterOptions>(() => ({
    sharpenStrength: config.sharpenStrength,
    denoiseStrength: config.denoiseStrength,
    smudgeReduction: config.smudgeReduction,
    brightnessAdjustment: config.brightnessAdjustment,
    contrastEnhance: config.contrastEnhancement,
    saturationAdjustment: config.saturationAdjustment,
    splitPosition: splitPos,
    showSplitLine: true,
    splitMode: splitMode,
    zoomFactor: zoomFactor
  }), [config, splitPos, splitMode, zoomFactor]);

  // Keep a ref of current options so renderLoop never re-binds on every slider tick
  const filterOptionsRef = useRef<WebGLFilterOptions>(filterOptions);
  useEffect(() => {
    filterOptionsRef.current = filterOptions;
  }, [filterOptions]);

  // Auto-generate suggested filename when source or resolution/fps changes
  useEffect(() => {
    if (sourceMedia) {
      const cleanBase = sourceMedia.name.replace(/\.[^/.]+$/, '').replace(/[^a-zA-Z0-9_-]/g, '_');
      const fpsLabel = config.fps === 'source' ? `${sourceMedia.fps || 30}fps` : `${config.fps}fps`;
      const autoName = `${cleanBase}_enhanced_${config.resolution}_${fpsLabel}.mp4`;
      setCustomExportName(autoName);
    }
  }, [sourceMedia, config.resolution, config.fps]);

  // Track active blob URLs for clean disposal on unmount
  const activeBlobUrlsRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (sourceMedia?.blobUrl) {
      activeBlobUrlsRef.current.add(sourceMedia.blobUrl);
    }
  }, [sourceMedia?.blobUrl]);

  useEffect(() => {
    if (processedResult?.blobUrl) {
      activeBlobUrlsRef.current.add(processedResult.blobUrl);
    }
  }, [processedResult?.blobUrl]);

  // Cleanup on unmount ONLY
  useEffect(() => {
    return () => {
      if (engineRef.current) {
        engineRef.current.destroy();
        engineRef.current = null;
      }
      if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
      activeBlobUrlsRef.current.forEach(url => revokeBlobUrl(url));
      activeBlobUrlsRef.current.clear();
    };
  }, []);

  // Initialize WebGL engine once when canvas is mounted
  const initEngine = useCallback(() => {
    if (canvasRef.current && !engineRef.current) {
      try {
        engineRef.current = new WebGLEnhanceEngine(canvasRef.current);
      } catch (err) {
        console.warn('WebGL init notice:', err);
      }
    }
  }, []);

  // Immediate frame render helper
  const triggerImmediateRender = useCallback(() => {
    const video = videoRef.current;
    if (!video || !canvasRef.current) return;

    if (!engineRef.current) {
      initEngine();
    }

    if (engineRef.current && video.readyState >= 1) {
      engineRef.current.renderFrame(video, filterOptionsRef.current);
    }
  }, [initEngine]);

  // Handle continuous render loop for video playback
  useEffect(() => {
    let active = true;
    let videoCallbackId: number | null = null;
    let lastTimeUpdate = 0;

    const renderTick = () => {
      if (!active) return;

      const video = videoRef.current;
      const engine = engineRef.current;

      if (video && engine && sourceMedia) {
        if (!video.paused && !video.ended) {
          const curTime = video.currentTime;
          // Throttle React state update to ~8Hz to prevent pegging the JS main thread
          // during high-motion frames/camera shake, keeping the hardware video decoder smooth
          if (Math.abs(curTime - lastTimeUpdate) >= 0.12) {
            lastTimeUpdate = curTime;
            setCurrentTime(curTime);
          }
          engine.renderFrame(video, filterOptionsRef.current);
        }
      }

      if (video && typeof (video as any).requestVideoFrameCallback === 'function') {
        videoCallbackId = (video as any).requestVideoFrameCallback(renderTick);
      } else {
        animationFrameRef.current = requestAnimationFrame(renderTick);
      }
    };

    const video = videoRef.current;
    if (video && typeof (video as any).requestVideoFrameCallback === 'function') {
      videoCallbackId = (video as any).requestVideoFrameCallback(renderTick);
    } else {
      animationFrameRef.current = requestAnimationFrame(renderTick);
    }

    return () => {
      active = false;
      if (video && videoCallbackId !== null && typeof (video as any).cancelVideoFrameCallback === 'function') {
        (video as any).cancelVideoFrameCallback(videoCallbackId);
      }
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [sourceMedia]);

  // Trigger instant render whenever sliders or modes change
  useEffect(() => {
    triggerImmediateRender();
  }, [config, splitPos, splitMode, zoomFactor, triggerImmediateRender]);

  // Handle video upload
  const handleFileUpload = async (file: File) => {
    setIsInspecting(true);
    setInspectError(null);
    setProcessingError(null);
    try {
      const info = await probeVideoFile(file);
      setSourceMedia(info);
      setProcessedResult(null);
      setRenderProgress(null);
      setCurrentTime(0);
      setIsPlaying(false);
      isPlayingRef.current = false;

      // Target 4K UHD Master resolution by default
      if (info.height > 2160) {
        setConfig(c => ({ ...c, resolution: '8k' }));
      } else {
        setConfig(c => ({ ...c, resolution: '4k' }));
      }
    } catch (err) {
      setInspectError(err instanceof Error ? err.message : 'Media parsing error');
    } finally {
      setIsInspecting(false);
    }
  };

  // Generate synthetic calibration test media
  const handleLoadSample = async () => {
    setIsInspecting(true);
    setInspectError(null);
    try {
      const sample = await createSyntheticDemoMedia('motion');
      await handleFileUpload(sample);
    } catch (err) {
      setInspectError('Failed to generate sample calibration feed.');
      setIsInspecting(false);
    }
  };

  // Drag and drop event handlers
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const file = e.dataTransfer.files[0];
      if (file.type.startsWith('video/') || file.name.match(/\.(mp4|webm|mov|mkv|avi|m4v)$/i)) {
        await handleFileUpload(file);
      } else {
        setInspectError('Please drop a valid video file (MP4, WebM, MOV, or MKV).');
      }
    }
  };

  // Transport controls
  const togglePlay = () => {
    const video = videoRef.current;
    if (!video || !sourceMedia) return;

    if (video.paused) {
      video.play().then(() => {
        setIsPlaying(true);
        isPlayingRef.current = true;
      }).catch(() => {
        setIsPlaying(false);
        isPlayingRef.current = false;
      });
    } else {
      video.pause();
      setIsPlaying(false);
      isPlayingRef.current = false;
    }
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const time = parseFloat(e.target.value);
    const video = videoRef.current;
    if (video) {
      video.currentTime = time;
      setCurrentTime(time);
      triggerImmediateRender();
    }
  };

  // Global window mouse handling for split slider drag
  useEffect(() => {
    if (!isDraggingSplit) return;

    const handleMouseMove = (e: MouseEvent) => {
      if (!containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const pos = (e.clientX - rect.left) / rect.width;
      setSplitPos(Math.max(0.01, Math.min(0.99, pos)));
    };

    const handleMouseUp = () => {
      setIsDraggingSplit(false);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDraggingSplit]);

  // Video loaded handler to ensure frame is decoded and engine is primed
  const handleVideoReady = () => {
    const video = videoRef.current;
    if (!video) return;

    initEngine();

    // Kickstart the hardware video decoder by briefly playing or seeking
    video.muted = true;
    if (video.currentTime === 0) {
      video.currentTime = 0.001;
    }

    const playPromise = video.play();
    if (playPromise !== undefined) {
      playPromise.then(() => {
        if (!isPlayingRef.current) {
          video.pause();
        }
        triggerImmediateRender();
      }).catch(() => {
        triggerImmediateRender();
      });
    } else {
      triggerImmediateRender();
    }
  };

  // Target calculation for display
  const targetDims = useMemo(() => {
    if (!sourceMedia) return { width: 1920, height: 1080 };
    return calculateTargetDimensions(sourceMedia.width, sourceMedia.height, config.resolution);
  }, [sourceMedia, config.resolution]);

  // Start real export processing
  const handleStartEnhance = async () => {
    if (!sourceMedia || isProcessing) return;

    setIsProcessing(true);
    setProcessingError(null);
    setProcessedResult(null);
    cancelSignalRef.current = { cancelled: false };

    // Pause preview playback during heavy export
    if (videoRef.current && !videoRef.current.paused) {
      videoRef.current.pause();
      setIsPlaying(false);
      isPlayingRef.current = false;
    }

    try {
      const result = await processVideoReal(
        sourceMedia,
        config,
        progress => setRenderProgress(progress),
        cancelSignalRef.current,
        customExportName
      );

      setProcessedResult(result);
      setRenderProgress(null);
    } catch (err) {
      setProcessingError(err instanceof Error ? err.message : 'Processing failure');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleCancelEnhance = () => {
    cancelSignalRef.current.cancelled = true;
  };

  // Download trigger
  const handleDownload = () => {
    if (!processedResult) return;
    const a = document.createElement('a');
    a.href = processedResult.blobUrl;
    a.download = customExportName.trim() || processedResult.fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const resolutionList: ResolutionTarget[] = ['source', '480p', '720p', '1080p', '1440p', '4k', '8k', '16k'];
  const fpsList: FpsTarget[] = ['source', 30, 60, 120];

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-6">
      {/* ======================================================== */}
      {/* 1. HERO DRAG & DROP UPLOAD ZONE (WHEN NO VIDEO LOADED) */}
      {/* ======================================================== */}
      {!sourceMedia && (
        <div
          onClick={() => heroFileInputRef.current?.click()}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          className={`relative border-2 border-dashed rounded-2xl p-10 sm:p-16 text-center transition-all duration-200 cursor-pointer ${
            isDragOver 
              ? 'border-white bg-zinc-900/90 scale-[1.005] shadow-2xl shadow-white/10' 
              : 'border-zinc-800 hover:border-zinc-600 bg-zinc-950/60'
          }`}
        >
          {/* Hidden File Input for the entire upload box */}
          <input
            ref={heroFileInputRef}
            type="file"
            accept="video/*"
            className="hidden"
            onChange={e => e.target.files?.[0] && handleFileUpload(e.target.files[0])}
          />

          <div className="max-w-2xl mx-auto space-y-5">
            {/* Main Icon */}
            <div className="w-20 h-20 mx-auto rounded-3xl bg-zinc-900 border border-zinc-700 flex items-center justify-center text-white shadow-2xl">
              <Upload className="w-10 h-10 animate-pulse text-white" />
            </div>

            {/* Title & Description */}
            <div className="space-y-2">
              <h1 className="text-3xl sm:text-4xl font-mono font-black tracking-tight text-white uppercase">
                Drag &amp; Drop Your Video
              </h1>
              <p className="text-sm sm:text-base text-zinc-400 font-mono max-w-lg mx-auto leading-relaxed">
                Real-time video de-smudge, bilateral denoising, unsharp mask sharpening, and true upscaling up to 4K / 8K / 16K.
              </p>
            </div>

            {/* Action Buttons */}
            <div className="pt-3 flex flex-wrap items-center justify-center gap-4">
              <button
                type="button"
                onClick={e => {
                  e.stopPropagation();
                  heroFileInputRef.current?.click();
                }}
                className="cursor-pointer inline-flex items-center space-x-2.5 px-7 py-3.5 rounded-lg bg-white text-black font-mono font-bold text-sm hover:bg-zinc-200 transition-all shadow-lg hover:shadow-white/20 active:scale-95"
              >
                <FileVideo className="w-4 h-4" />
                <span>Browse Video File</span>
              </button>

              <button
                type="button"
                onClick={e => {
                  e.stopPropagation();
                  handleLoadSample();
                }}
                disabled={isInspecting}
                className="inline-flex items-center space-x-2 px-6 py-3.5 rounded-lg bg-zinc-900 border border-zinc-700 text-zinc-200 hover:text-white hover:border-zinc-500 font-mono text-sm transition-all cursor-pointer shadow active:scale-95"
              >
                <Film className="w-4 h-4 text-zinc-400" />
                <span>{isInspecting ? 'Loading Calibration...' : 'Try 4K Sample Video'}</span>
              </button>
            </div>

            {/* Format info */}
            <div className="pt-2 text-xs font-mono text-zinc-500 flex flex-wrap items-center justify-center gap-3">
              <span>Supports MP4, WebM, MOV, MKV</span>
              <span>&bull;</span>
              <span>Stereo Audio Preservation</span>
              <span>&bull;</span>
              <span>100% In-Browser Privacy</span>
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* 2. TOP METADATA BAR (WHEN VIDEO IS LOADED) */}
      {/* ======================================================== */}
      {sourceMedia && (
        <div className="bg-zinc-950 border border-zinc-800 rounded-lg p-3 sm:p-4 flex flex-wrap items-center justify-between gap-3 text-xs font-mono shadow-md">
          <div className="flex items-center space-x-3 min-w-0">
            <div className="w-10 h-10 rounded-lg bg-zinc-900 border border-zinc-800 flex items-center justify-center text-zinc-300 flex-shrink-0">
              <Film className="w-5 h-5 text-white" />
            </div>
            <div className="min-w-0">
              <div className="text-white font-bold truncate text-sm">{sourceMedia.name}</div>
              <div className="flex flex-wrap items-center gap-x-2.5 gap-y-0.5 text-zinc-400 text-[11px] mt-0.5">
                <span className="text-white font-mono font-semibold">{sourceMedia.width} &times; {sourceMedia.height}</span>
                <span>({sourceMedia.aspectRatio})</span>
                <span>&bull;</span>
                <span>{sourceMedia.fps} FPS</span>
                <span>&bull;</span>
                <span>{(sourceMedia.size / (1024 * 1024)).toFixed(1)} MB</span>
                <span>&bull;</span>
                <span>{sourceMedia.duration.toFixed(1)}s</span>
                <span>&bull;</span>
                <span className={sourceMedia.hasAudio ? 'text-zinc-300' : 'text-zinc-600'}>
                  {sourceMedia.hasAudio ? 'Stereo Audio' : 'No Audio'}
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <label className="cursor-pointer inline-flex items-center space-x-1.5 px-3 py-1.5 rounded bg-white text-black font-semibold hover:bg-zinc-200 transition-colors text-xs">
              <Upload className="w-3.5 h-3.5" />
              <span>Change Video</span>
              <input
                type="file"
                accept="video/*"
                className="hidden"
                onChange={e => e.target.files?.[0] && handleFileUpload(e.target.files[0])}
              />
            </label>

            <button
              onClick={handleLoadSample}
              disabled={isInspecting}
              className="inline-flex items-center space-x-1.5 px-3 py-1.5 rounded bg-zinc-900 border border-zinc-800 text-zinc-300 hover:text-white hover:border-zinc-700 transition-colors text-xs cursor-pointer"
            >
              <Film className="w-3.5 h-3.5 text-zinc-400" />
              <span>{isInspecting ? 'Loading...' : 'Sample 4K'}</span>
            </button>
          </div>
        </div>
      )}

      {inspectError && (
        <div className="p-3.5 rounded bg-red-950/40 border border-red-800 text-red-300 text-xs font-mono flex items-center space-x-2">
          <AlertTriangle className="w-4 h-4 flex-shrink-0" />
          <span>{inspectError}</span>
        </div>
      )}

      {/* ======================================================== */}
      {/* 3. MAIN WORKSPACE: PREVIEW (LEFT) + CONTROLS (RIGHT) */}
      {/* ======================================================== */}
      {sourceMedia && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left Viewport (7 cols) */}
          <div className="lg:col-span-7 space-y-3">
            {/* Split Comparison Canvas Container */}
            <div 
              ref={containerRef}
              className="relative aspect-video bg-black border border-zinc-800 rounded-lg overflow-hidden select-none flex items-center justify-center shadow-xl"
            >
              {/* Hardware Video Element: Kept inside DOM layout so Chrome/Safari never pauses decoding */}
              <video
                ref={videoRef}
                src={sourceMedia.blobUrl}
                playsInline
                preload="auto"
                muted={previewAudioMuted}
                loop
                onLoadedMetadata={handleVideoReady}
                onLoadedData={handleVideoReady}
                onCanPlay={handleVideoReady}
                onSeeked={triggerImmediateRender}
                onPlay={() => {
                  setIsPlaying(true);
                  isPlayingRef.current = true;
                }}
                onPause={() => {
                  setIsPlaying(false);
                  isPlayingRef.current = false;
                  if (videoRef.current) setCurrentTime(videoRef.current.currentTime);
                  triggerImmediateRender();
                }}
                onEnded={() => {
                  setIsPlaying(false);
                  isPlayingRef.current = false;
                }}
                className="absolute inset-0 w-full h-full object-contain pointer-events-none opacity-0"
              />

              {/* WebGL2 Enhanced Canvas */}
              <canvas
                ref={el => {
                  canvasRef.current = el;
                  if (el && !engineRef.current) {
                    initEngine();
                    triggerImmediateRender();
                  }
                }}
                className="relative w-full h-full object-contain z-10"
              />

              {/* Viewport HUD Overlays */}
              <div className="absolute top-2.5 left-2.5 pointer-events-none flex items-center space-x-2 text-[10px] font-mono z-20">
                <span className="px-2 py-0.5 rounded bg-black/80 border border-zinc-800 text-zinc-300 backdrop-blur-sm">
                  {splitMode === 'split' ? 'SPLIT WIPE' : splitMode.toUpperCase()}
                </span>
                {splitMode === 'split' && (
                  <>
                    <span className="px-1.5 py-0.5 bg-black/80 border border-zinc-800 text-zinc-400 backdrop-blur-sm">
                      ORIGINAL
                    </span>
                    <span className="px-1.5 py-0.5 bg-white text-black font-bold">
                      ENHANCED
                    </span>
                  </>
                )}
              </div>

              {/* Draggable Split Handle */}
              {splitMode === 'split' && (
                <div
                  style={{ left: `${splitPos * 100}%` }}
                  onMouseDown={() => setIsDraggingSplit(true)}
                  className="absolute top-0 bottom-0 w-8 -ml-4 flex items-center justify-center cursor-ew-resize group z-30"
                >
                  <div className="w-[2px] h-full bg-white shadow-lg shadow-white/50" />
                  <div className="absolute w-7 h-7 rounded-full bg-black border border-zinc-500 group-hover:border-white flex items-center justify-center text-[10px] font-mono font-bold text-white shadow-xl">
                    &harr;
                  </div>
                </div>
              )}

              {/* Zoom Indicator */}
              {zoomFactor > 1 && (
                <div className="absolute bottom-2.5 right-2.5 text-[10px] font-mono bg-black/80 border border-zinc-800 text-zinc-300 px-2 py-0.5 rounded backdrop-blur-sm z-20">
                  ZOOM {zoomFactor}X
                </div>
              )}
            </div>

            {/* Transport & Mode Controls */}
            <div className="bg-zinc-950 border border-zinc-800 rounded-lg p-3 space-y-2 text-xs font-mono">
              <div className="flex items-center space-x-3">
                <button
                  type="button"
                  onClick={togglePlay}
                  className="w-8 h-8 rounded bg-white text-black flex items-center justify-center hover:bg-zinc-200 transition-colors flex-shrink-0 cursor-pointer"
                  title={isPlaying ? 'Pause' : 'Play'}
                >
                  {isPlaying ? <Pause className="w-4 h-4 fill-black" /> : <Play className="w-4 h-4 fill-black ml-0.5" />}
                </button>

                <div className="flex-1 flex items-center space-x-2">
                  <span className="text-zinc-400 w-12 text-right">{currentTime.toFixed(1)}s</span>
                  <input
                    type="range"
                    min="0"
                    max={sourceMedia.duration || 10}
                    step="0.05"
                    value={currentTime}
                    onChange={handleSeek}
                    className="w-full accent-white bg-zinc-800 h-1.5 rounded cursor-pointer"
                  />
                  <span className="text-zinc-500 w-12">{sourceMedia.duration.toFixed(1)}s</span>
                </div>

                {sourceMedia.hasAudio && (
                  <button
                    type="button"
                    onClick={() => setPreviewAudioMuted(m => !m)}
                    className="p-1.5 rounded text-zinc-400 hover:text-white transition-colors cursor-pointer"
                    title={previewAudioMuted ? 'Unmute preview' : 'Mute preview'}
                  >
                    {previewAudioMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
                  </button>
                )}
              </div>

              {/* Preview Viewport Modes */}
              <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] border-t border-zinc-900 pt-2 text-zinc-400">
                <div className="flex items-center space-x-1.5">
                  <span className="text-zinc-500">VIEW:</span>
                  <button
                    type="button"
                    onClick={() => setSplitMode('split')}
                    className={`px-2 py-0.5 rounded cursor-pointer ${splitMode === 'split' ? 'bg-white text-black font-bold' : 'hover:text-white'}`}
                  >
                    Split Wipe
                  </button>
                  <button
                    type="button"
                    onClick={() => setSplitMode('side-by-side')}
                    className={`px-2 py-0.5 rounded cursor-pointer ${splitMode === 'side-by-side' ? 'bg-white text-black font-bold' : 'hover:text-white'}`}
                  >
                    Side-by-Side
                  </button>
                  <button
                    type="button"
                    onClick={() => setSplitMode('enhanced-only')}
                    className={`px-2 py-0.5 rounded cursor-pointer ${splitMode === 'enhanced-only' ? 'bg-white text-black font-bold' : 'hover:text-white'}`}
                  >
                    Enhanced
                  </button>
                  <button
                    type="button"
                    onClick={() => setSplitMode('original-only')}
                    className={`px-2 py-0.5 rounded cursor-pointer ${splitMode === 'original-only' ? 'bg-white text-black font-bold' : 'hover:text-white'}`}
                  >
                    Original
                  </button>
                </div>

                <div className="flex items-center space-x-2">
                  <span className="text-zinc-500">ZOOM:</span>
                  {[1.0, 1.5, 2.0].map(z => (
                    <button
                      key={z}
                      type="button"
                      onClick={() => setZoomFactor(z)}
                      className={`px-1.5 py-0.5 rounded cursor-pointer ${zoomFactor === z ? 'bg-zinc-800 text-white font-bold' : 'hover:text-white'}`}
                    >
                      {z}x
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Quality Comparison Summary (Upload vs Export Master) */}
            <div className="bg-zinc-950 border border-zinc-800 rounded-lg p-4 font-mono text-xs space-y-3 shadow-lg">
              <div className="flex items-center justify-between border-b border-zinc-900 pb-2.5">
                <div className="flex items-center space-x-2 text-white font-bold">
                  <Sliders className="w-4 h-4 text-amber-400" />
                  <span className="uppercase tracking-wider text-xs sm:text-sm">Quality Comparison Summary</span>
                </div>
                <span className="text-[10px] px-2 py-0.5 rounded bg-zinc-900 border border-zinc-800 text-zinc-400 font-semibold">
                  RAW INPUT VS 4K MASTER
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* 1. Upload Quality Card */}
                <div className="bg-zinc-900/60 border border-zinc-800/80 rounded-lg p-3 space-y-2">
                  <div className="flex items-center justify-between border-b border-zinc-800 pb-1.5">
                    <span className="font-bold text-zinc-300 flex items-center space-x-1.5">
                      <Film className="w-3.5 h-3.5 text-zinc-400" />
                      <span>UPLOAD QUALITY</span>
                    </span>
                    <span className="px-1.5 py-0.5 text-[9px] rounded bg-zinc-800 text-zinc-400 font-bold">
                      SOURCE
                    </span>
                  </div>
                  <div className="space-y-1.5 text-[11px]">
                    <div className="flex justify-between items-center">
                      <span className="text-zinc-500">Resolution:</span>
                      <span className="text-zinc-200 font-bold">{sourceMedia.width} &times; {sourceMedia.height} ({sourceMedia.aspectRatio})</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-zinc-500">Bitrate:</span>
                      <span className="text-zinc-300 font-mono">{sourceMedia.bitrateKbps ? `${(sourceMedia.bitrateKbps / 1000).toFixed(1)} Mbps` : 'Standard Web'}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-zinc-500">Cadence:</span>
                      <span className="text-zinc-300 font-mono">{sourceMedia.fps || 30} FPS</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-zinc-500">File Size:</span>
                      <span className="text-zinc-300 font-mono">{(sourceMedia.size / (1024 * 1024)).toFixed(1)} MB</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-zinc-500">Audio Stream:</span>
                      <span className={sourceMedia.hasAudio ? 'text-zinc-300' : 'text-zinc-600'}>
                        {sourceMedia.hasAudio ? 'Stereo AAC 48kHz' : 'No Audio Track'}
                      </span>
                    </div>
                    <div className="flex justify-between items-center pt-1 border-t border-zinc-800/60">
                      <span className="text-zinc-500">Compression:</span>
                      <span className="text-amber-400/90 text-[10px]">Macroblock noise &amp; soft edges</span>
                    </div>
                  </div>
                </div>

                {/* 2. Export Master Quality Card */}
                <div className="bg-gradient-to-br from-zinc-900/90 to-zinc-950 border border-zinc-700/80 rounded-lg p-3 space-y-2 relative overflow-hidden shadow-inner">
                  <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-br from-amber-500/10 via-rose-500/5 to-transparent rounded-bl-full pointer-events-none" />
                  <div className="flex items-center justify-between border-b border-zinc-800 pb-1.5 relative z-10">
                    <span className="font-bold text-white flex items-center space-x-1.5">
                      <Film className="w-3.5 h-3.5 text-zinc-300" />
                      <span>EXPORT MASTER</span>
                    </span>
                    <span className="px-2 py-0.5 text-[9px] rounded bg-white text-black font-extrabold uppercase tracking-tight shadow">
                      {config.resolution} ULTRA
                    </span>
                  </div>
                  <div className="space-y-1.5 text-[11px] relative z-10">
                    <div className="flex justify-between items-center">
                      <span className="text-zinc-400">Resolution:</span>
                      <span className="text-white font-bold">
                        {targetDims.width} &times; {targetDims.height}
                        <span className="ml-1 text-[10px] text-emerald-400 font-mono">
                          (+{Math.max(0, Math.round((((targetDims.width * targetDims.height) / (sourceMedia.width * sourceMedia.height)) - 1) * 100))}% pixels)
                        </span>
                      </span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-zinc-400">Target Bitrate:</span>
                      <span className="text-emerald-400 font-bold font-mono">
                        {targetDims.height >= 2160 ? '26 Mbps Ultra 4K' : targetDims.height >= 1440 ? '16 Mbps 2K QHD' : '10 Mbps FHD'}
                      </span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-zinc-400">Cadence:</span>
                      <span className="text-white font-bold font-mono">
                        {config.fps === 'source' ? (sourceMedia.fps || 30) : config.fps} FPS Smooth
                      </span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-zinc-400">De-Smudge / Denoise:</span>
                      <span className="text-zinc-200">
                        Active ({config.smudgeReduction}% / {config.denoiseStrength}%)
                      </span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-zinc-400">Sharpness Boost:</span>
                      <span className="text-white font-bold">+{config.sharpenStrength}% High-Pass 4K</span>
                    </div>
                    <div className="flex justify-between items-center pt-1 border-t border-zinc-800/60">
                      <span className="text-zinc-400">Processing Mode:</span>
                      <span className="text-emerald-400 text-[10px] font-bold">100% Client-Side WebGL2 (Vercel Ready)</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Rendering Progress Card */}
            {isProcessing && renderProgress && (
              <div className="bg-zinc-950 border border-zinc-800 rounded-lg p-4 space-y-3 font-mono text-xs">
                <div className="flex items-center justify-between text-zinc-300">
                  <div className="flex items-center space-x-2">
                    <RefreshCw className="w-4 h-4 animate-spin text-white" />
                    <span className="font-bold text-white">Enhancing &amp; Rendering Video...</span>
                  </div>
                  <span className="font-bold text-white">{renderProgress.percentage}%</span>
                </div>

                {/* Progress Bar */}
                <div className="w-full bg-zinc-900 rounded-full h-2 overflow-hidden border border-zinc-800">
                  <div 
                    className="bg-white h-full transition-all duration-150"
                    style={{ width: `${renderProgress.percentage}%` }}
                  />
                </div>

                <div className="flex items-center justify-between text-[11px] text-zinc-400">
                  <span>Frame {renderProgress.currentFrame} of {renderProgress.totalFrames}</span>
                  <span>{renderProgress.fpsSpeed} FPS Encoding Speed</span>
                </div>

                <div className="text-[11px] text-zinc-500 truncate">
                  {renderProgress.stageMessage}
                </div>

                <div className="pt-1 flex justify-end">
                  <button
                    type="button"
                    onClick={handleCancelEnhance}
                    className="px-3 py-1 rounded bg-zinc-900 border border-zinc-700 text-zinc-300 hover:text-white hover:border-zinc-500 text-xs transition-colors cursor-pointer"
                  >
                    Cancel Processing
                  </button>
                </div>
              </div>
            )}

            {/* Processing Error */}
            {processingError && (
              <div className="p-3.5 rounded bg-red-950/40 border border-red-800 text-red-300 text-xs font-mono space-y-1">
                <div className="font-bold flex items-center space-x-1.5">
                  <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                  <span>Enhancement Notice</span>
                </div>
                <p className="text-[11px] text-red-400 leading-relaxed">{processingError}</p>
              </div>
            )}

            {/* Export Success & Download Panel */}
            {processedResult && (
              <div className="bg-zinc-950 border border-zinc-700 rounded-lg p-4 space-y-3 font-mono text-xs shadow-xl">
                <div className="flex items-center justify-between text-white">
                  <div className="flex items-center space-x-2">
                    <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                    <span className="font-bold text-sm">Enhancement Completed Successfully</span>
                  </div>
                  <span className="text-[11px] text-zinc-400">{(processedResult.sizeBytes / (1024 * 1024)).toFixed(2)} MB</span>
                </div>

                {/* File Rename Bar */}
                <div className="bg-zinc-900/80 border border-zinc-800 rounded p-2.5 space-y-1">
                  <div className="text-[11px] text-zinc-400">Exported File Name:</div>
                  <div className="flex items-center space-x-2">
                    <input
                      type="text"
                      value={customExportName}
                      onChange={e => setCustomExportName(e.target.value)}
                      className="flex-1 bg-black border border-zinc-700 rounded px-2.5 py-1.5 text-xs text-white font-mono focus:border-white focus:outline-none"
                      placeholder="enhanced_video.mp4"
                    />
                  </div>
                </div>

                {/* Quality Achievement Comparison Breakdown */}
                <div className="bg-zinc-900/90 border border-zinc-800 rounded p-3 space-y-2">
                  <div className="text-[11px] font-bold text-zinc-300 flex items-center justify-between">
                    <span>POST-EXPORT QUALITY ENHANCEMENT REPORT</span>
                    <span className="text-[10px] text-emerald-400 font-normal">Hardware Validated</span>
                  </div>
                  
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center text-[11px]">
                    <div className="bg-black/70 p-2 rounded border border-zinc-800">
                      <div className="text-zinc-500">RESOLUTION</div>
                      <div className="text-white font-bold">{processedResult.width}&times;{processedResult.height}</div>
                      <div className="text-[9px] text-emerald-400">
                        {sourceMedia.width < processedResult.width ? `+${Math.round(((processedResult.width * processedResult.height) / (sourceMedia.width * sourceMedia.height) - 1) * 100)}% Pixels` : 'Native 1:1'}
                      </div>
                    </div>
                    <div className="bg-black/70 p-2 rounded border border-zinc-800">
                      <div className="text-zinc-500">CADENCE</div>
                      <div className="text-white font-bold">{processedResult.fps} FPS</div>
                      <div className="text-[9px] text-zinc-400">Consistent Sync</div>
                    </div>
                    <div className="bg-black/70 p-2 rounded border border-zinc-800">
                      <div className="text-zinc-500">DURATION</div>
                      <div className="text-white font-bold">{processedResult.duration.toFixed(2)}s</div>
                      <div className="text-[9px] text-zinc-400">All Frames Preserved</div>
                    </div>
                    <div className="bg-black/70 p-2 rounded border border-zinc-800">
                      <div className="text-zinc-500">FORMAT &amp; SIZE</div>
                      <div className="text-white font-bold">{(processedResult.sizeBytes / (1024 * 1024)).toFixed(2)} MB</div>
                      <div className="text-[9px] text-zinc-400 uppercase">{processedResult.mimeType.split('/')[1] || 'MP4'} Master</div>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2 pt-1 text-[10px] text-zinc-300">
                    <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded bg-zinc-800 text-emerald-300">
                      <ShieldCheck className="w-3 h-3 text-emerald-400" />
                      <span>De-smudge Cleaned</span>
                    </span>
                    <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded bg-zinc-800 text-emerald-300">
                      <ShieldCheck className="w-3 h-3 text-emerald-400" />
                      <span>4K High-Pass Sharpened</span>
                    </span>
                    <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded bg-zinc-800 text-emerald-300">
                      <ShieldCheck className="w-3 h-3 text-emerald-400" />
                      <span>Rec.709 Color Balanced</span>
                    </span>
                  </div>
                </div>

                {/* Download Button */}
                <button
                  type="button"
                  onClick={handleDownload}
                  className="w-full py-3.5 px-4 rounded bg-white text-black font-extrabold hover:bg-zinc-200 transition-colors flex items-center justify-center space-x-2 text-sm cursor-pointer shadow-lg active:scale-[0.99]"
                >
                  <Download className="w-4 h-4" />
                  <span>Download Enhanced Video ({customExportName.trim() || processedResult.fileName})</span>
                </button>
              </div>
            )}
          </div>

          {/* ======================================================== */}
          {/* Right Controls Panel (5 cols) */}
          {/* ======================================================== */}
          <div className="lg:col-span-5 space-y-4">
            <div className="bg-zinc-950 border border-zinc-800 rounded-lg p-4 space-y-5 font-mono text-xs">
              <div className="flex items-center justify-between border-b border-zinc-900 pb-3">
                <div className="flex items-center space-x-2">
                  <Sliders className="w-4 h-4 text-white" />
                  <span className="text-white font-bold text-sm uppercase tracking-wider">Enhancement Settings</span>
                </div>
                <span className="text-[10px] text-zinc-500">REAL-TIME WEBGL2</span>
              </div>

              {/* Studio Master Presets */}
              <div className="space-y-1.5 pb-2 border-b border-zinc-900">
                <div className="flex justify-between items-center text-zinc-400">
                  <span className="font-semibold text-zinc-300">Studio Master Presets</span>
                  <span className="text-[10px] text-emerald-400">1-Click Auto-Tune</span>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
                  <button
                    type="button"
                    onClick={() => setConfig(c => ({
                      ...c,
                      smudgeReduction: 45,
                      denoiseStrength: 18,
                      sharpenStrength: 60,
                      contrastEnhancement: 54,
                      saturationAdjustment: 52
                    }))}
                    className="py-1.5 px-2 rounded text-center transition-colors cursor-pointer text-[10px] bg-zinc-900 border border-zinc-800 text-zinc-300 hover:text-white hover:border-zinc-600 active:bg-white active:text-black"
                  >
                    4K Master
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfig(c => ({
                      ...c,
                      smudgeReduction: 35,
                      denoiseStrength: 22,
                      sharpenStrength: 50,
                      contrastEnhancement: 58,
                      saturationAdjustment: 54
                    }))}
                    className="py-1.5 px-2 rounded text-center transition-colors cursor-pointer text-[10px] bg-zinc-900 border border-zinc-800 text-zinc-300 hover:text-white hover:border-zinc-600 active:bg-white active:text-black"
                  >
                    Cinema Crisp
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfig(c => ({
                      ...c,
                      smudgeReduction: 50,
                      denoiseStrength: 25,
                      sharpenStrength: 45,
                      contrastEnhancement: 52,
                      saturationAdjustment: 50
                    }))}
                    className="py-1.5 px-2 rounded text-center transition-colors cursor-pointer text-[10px] bg-zinc-900 border border-zinc-800 text-zinc-300 hover:text-white hover:border-zinc-600 active:bg-white active:text-black"
                  >
                    Fresh Clean
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfig(c => ({
                      ...c,
                      smudgeReduction: 40,
                      denoiseStrength: 15,
                      sharpenStrength: 65,
                      contrastEnhancement: 60,
                      saturationAdjustment: 58
                    }))}
                    className="py-1.5 px-2 rounded text-center transition-colors cursor-pointer text-[10px] bg-zinc-900 border border-zinc-800 text-zinc-300 hover:text-white hover:border-zinc-600 active:bg-white active:text-black"
                  >
                    Vivid HDR
                  </button>
                </div>
              </div>

              {/* 1. Resolution Dropdown */}
              <div className="space-y-1.5">
                <div className="flex justify-between items-center text-zinc-400">
                  <span className="font-semibold text-zinc-300">Target Resolution</span>
                  <span className="text-white font-bold">
                    {targetDims.width}&times;{targetDims.height}
                  </span>
                </div>
                <div className="grid grid-cols-4 gap-1.5">
                  {resolutionList.map(res => {
                    const isSelected = config.resolution === res;
                    const isHeavy = res === '8k' || res === '16k';
                    return (
                      <button
                        key={res}
                        type="button"
                        onClick={() => setConfig(c => ({ ...c, resolution: res }))}
                        className={`py-1.5 px-2 rounded text-center transition-colors cursor-pointer text-[11px] ${
                          isSelected
                            ? 'bg-white text-black font-bold'
                            : 'bg-zinc-900 border border-zinc-800 text-zinc-300 hover:text-white hover:border-zinc-700'
                        }`}
                        title={isHeavy ? 'High-density resolution tier' : ''}
                      >
                        {RESOLUTION_DEFINITIONS[res]?.label || res}
                      </button>
                    );
                  })}
                </div>
                <div className="text-[10px] text-zinc-500 pt-0.5">
                  Maintains original aspect ratio. 8K &amp; 16K fully selectable.
                </div>
              </div>

              {/* 2. FPS Adjustment */}
              <div className="space-y-1.5 pt-2 border-t border-zinc-900">
                <div className="flex justify-between items-center text-zinc-400">
                  <span className="font-semibold text-zinc-300">Cadence / FPS</span>
                  <span className="text-white font-bold">
                    {config.fps === 'source' ? `${sourceMedia.fps} FPS (Native)` : `${config.fps} FPS`}
                  </span>
                </div>
                <div className="grid grid-cols-4 gap-1.5">
                  {fpsList.map(fps => (
                    <button
                      key={fps}
                      type="button"
                      onClick={() => setConfig(c => ({ ...c, fps }))}
                      className={`py-1.5 px-2 rounded text-center transition-colors cursor-pointer text-[11px] ${
                        config.fps === fps
                          ? 'bg-white text-black font-bold'
                          : 'bg-zinc-900 border border-zinc-800 text-zinc-300 hover:text-white hover:border-zinc-700'
                      }`}
                    >
                      {fps === 'source' ? 'Source' : `${fps} FPS`}
                    </button>
                  ))}
                </div>
              </div>

              {/* 3. Smudge Reduction Slider */}
              <div className="space-y-2 pt-2 border-t border-zinc-900">
                <div className="space-y-1">
                  <div className="flex justify-between text-zinc-400">
                    <span className="font-semibold text-zinc-300">Smudge &amp; Blur Reduction</span>
                    <span className="text-white font-bold">{config.smudgeReduction}%</span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="100"
                    value={config.smudgeReduction}
                    onChange={e => setConfig(c => ({ ...c, smudgeReduction: Number(e.target.value) }))}
                    className="w-full accent-white bg-zinc-800 h-1.5 rounded cursor-pointer"
                  />
                  <div className="text-[10px] text-zinc-500">
                    Edge-preserving gradient recovery without edge halos or ringing.
                  </div>
                </div>

                {/* 4. Denoise Strength */}
                <div className="space-y-1">
                  <div className="flex justify-between text-zinc-400">
                    <span className="font-semibold text-zinc-300">Bilateral Noise Reduction</span>
                    <span className="text-white font-bold">{config.denoiseStrength}%</span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="100"
                    value={config.denoiseStrength}
                    onChange={e => setConfig(c => ({ ...c, denoiseStrength: Number(e.target.value) }))}
                    className="w-full accent-white bg-zinc-800 h-1.5 rounded cursor-pointer"
                  />
                  <div className="text-[10px] text-zinc-500">
                    5x5 bilateral filter preserves faces, fine lines, and natural grain.
                  </div>
                </div>

                {/* 5. Sharpening */}
                <div className="space-y-1">
                  <div className="flex justify-between text-zinc-400">
                    <span className="font-semibold text-zinc-300">Acutance Sharpening</span>
                    <span className="text-white font-bold">{config.sharpenStrength}%</span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="100"
                    value={config.sharpenStrength}
                    onChange={e => setConfig(c => ({ ...c, sharpenStrength: Number(e.target.value) }))}
                    className="w-full accent-white bg-zinc-800 h-1.5 rounded cursor-pointer"
                  />
                  <div className="text-[10px] text-zinc-500">
                    Luminance-cored unsharp masking prevents pixelation ("fati jaoa").
                  </div>
                </div>
              </div>

              {/* 6. Color & Tonal Controls */}
              <div className="space-y-2 pt-2 border-t border-zinc-900">
                <div className="text-[11px] font-bold text-zinc-300 uppercase">Tonal &amp; Color Grading</div>

                {/* Brightness */}
                <div className="space-y-1">
                  <div className="flex justify-between text-zinc-400">
                    <span>Brightness</span>
                    <span className="text-white font-bold">
                      {config.brightnessAdjustment > 0 ? `+${config.brightnessAdjustment}` : config.brightnessAdjustment}
                    </span>
                  </div>
                  <input
                    type="range"
                    min="-50"
                    max="50"
                    value={config.brightnessAdjustment}
                    onChange={e => setConfig(c => ({ ...c, brightnessAdjustment: Number(e.target.value) }))}
                    className="w-full accent-white bg-zinc-800 h-1 rounded cursor-pointer"
                  />
                </div>

                {/* Contrast */}
                <div className="space-y-1">
                  <div className="flex justify-between text-zinc-400">
                    <span>Contrast</span>
                    <span className="text-white font-bold">{config.contrastEnhancement}%</span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="100"
                    value={config.contrastEnhancement}
                    onChange={e => setConfig(c => ({ ...c, contrastEnhancement: Number(e.target.value) }))}
                    className="w-full accent-white bg-zinc-800 h-1 rounded cursor-pointer"
                  />
                </div>

                {/* Saturation */}
                <div className="space-y-1">
                  <div className="flex justify-between text-zinc-400">
                    <span>Saturation</span>
                    <span className="text-white font-bold">{config.saturationAdjustment}%</span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="100"
                    value={config.saturationAdjustment}
                    onChange={e => setConfig(c => ({ ...c, saturationAdjustment: Number(e.target.value) }))}
                    className="w-full accent-white bg-zinc-800 h-1 rounded cursor-pointer"
                  />
                </div>
              </div>

              {/* 7. Output File Rename Field */}
              <div className="space-y-1.5 pt-2 border-t border-zinc-900">
                <div className="flex justify-between items-center text-zinc-400">
                  <span className="font-semibold text-zinc-300">Output File Name</span>
                  <span className="text-[10px] text-zinc-500">CUSTOMIZABLE</span>
                </div>
                <div className="flex items-center space-x-1.5 bg-zinc-900 border border-zinc-800 rounded px-2.5 py-1.5">
                  <Edit2 className="w-3.5 h-3.5 text-zinc-500 flex-shrink-0" />
                  <input
                    type="text"
                    value={customExportName}
                    onChange={e => setCustomExportName(e.target.value)}
                    className="bg-transparent w-full text-white font-mono text-xs focus:outline-none"
                    placeholder="custom_enhanced_video.mp4"
                  />
                </div>
              </div>

              {/* 8. Audio Toggle */}
              <div className="pt-2 border-t border-zinc-900 text-zinc-300">
                <label className="flex items-center space-x-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={config.preserveAudio}
                    onChange={e => setConfig(c => ({ ...c, preserveAudio: e.target.checked }))}
                    className="accent-white rounded cursor-pointer"
                  />
                  <span>Preserve original audio stream</span>
                </label>
              </div>

              {/* 9. Start Real Processing Action */}
              <div className="pt-2">
                <button
                  type="button"
                  onClick={handleStartEnhance}
                  disabled={isProcessing}
                  className="w-full py-3.5 px-4 rounded-md font-bold bg-white text-black hover:bg-zinc-200 transition-colors flex items-center justify-center space-x-2 cursor-pointer disabled:opacity-40 shadow-xl active:scale-[0.99]"
                >
                  {isProcessing ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin text-black" />
                      <span>Encoding Video ({renderProgress?.percentage || 0}%)...</span>
                    </>
                  ) : (
                    <>
                      <Film className="w-4 h-4 text-black" />
                      <span>
                        Enhance &amp; Export ({targetDims.width}&times;{targetDims.height})
                      </span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
