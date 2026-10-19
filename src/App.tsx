/**
 * VideoEnhance Studio - Master Application Container
 * Minimal, clean, black-and-white video enhancement workspace
 */

import React, { useState } from 'react';
import { Header } from './components/Header';
import { VideoStudio } from './components/VideoStudio';
import { detectDeviceHardware } from './utils/deviceCapabilities';
import { X, Cpu, Info } from 'lucide-react';

export default function App() {
  const [showSettings, setShowSettings] = useState(false);
  const hardware = detectDeviceHardware();

  return (
    <div className="min-h-screen bg-black text-white font-sans selection:bg-white selection:text-black flex flex-col">
      {/* Header */}
      <Header onOpenSettings={() => setShowSettings(true)} />

      {/* Main Studio Workspace */}
      <main className="flex-1">
        <VideoStudio />
      </main>

      {/* Minimal Footer */}
      <footer className="border-t border-zinc-900 bg-zinc-950 py-3.5 px-4 sm:px-8 text-zinc-500 font-mono text-xs">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <span className="text-[11px] text-zinc-400 font-bold tracking-wider">
            4K VIDEO EXPORTER
          </span>
          <span className="text-[11px] text-zinc-600">
            Hardware Accelerated Video Processing
          </span>
        </div>
      </footer>

      {/* Minimal Settings & Hardware Specs Modal */}
      {showSettings && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-zinc-950 border border-zinc-800 rounded-lg max-w-md w-full p-4 space-y-4 font-mono text-xs">
            <div className="flex items-center justify-between border-b border-zinc-800 pb-2">
              <div className="flex items-center space-x-2 text-white font-bold">
                <Cpu className="w-4 h-4" />
                <span>DEVICE CAPABILITIES &amp; LIMITS</span>
              </div>
              <button
                onClick={() => setShowSettings(false)}
                className="text-zinc-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-2 text-zinc-300 text-[11px]">
              <div className="flex justify-between p-2 rounded bg-zinc-900 border border-zinc-800">
                <span className="text-zinc-400">WebGL2 Acceleration:</span>
                <span className="text-white font-bold">{hardware.webgl2Available ? 'Supported' : 'Fallback'}</span>
              </div>
              <div className="flex justify-between p-2 rounded bg-zinc-900 border border-zinc-800">
                <span className="text-zinc-400">Max Texture Size:</span>
                <span className="text-white font-bold">{hardware.maxTextureSize}px</span>
              </div>
              <div className="flex justify-between p-2 rounded bg-zinc-900 border border-zinc-800">
                <span className="text-zinc-400">Browser Video Encoder:</span>
                <span className="text-white font-bold">{hardware.supportedMime}</span>
              </div>
              <div className="flex justify-between p-2 rounded bg-zinc-900 border border-zinc-800">
                <span className="text-zinc-400">Direct In-Browser 4K:</span>
                <span className="text-white font-bold">{hardware.canEncode4K ? 'Supported' : 'Limited by GPU'}</span>
              </div>
            </div>

            <div className="p-3 bg-zinc-900/60 rounded border border-zinc-800 text-[11px] text-zinc-400 leading-relaxed">
              <div className="flex items-center space-x-1.5 text-zinc-300 font-bold mb-1">
                <Info className="w-3.5 h-3.5" />
                <span>8K &amp; 16K Processing Note:</span>
              </div>
              <span>
                Resolutions up to 4K are processed directly in your browser. 8K and 16K selections exceeding browser memory ceilings require an external CUDA GPU render worker to avoid browser crashes.
              </span>
            </div>

            <div className="flex justify-end pt-1">
              <button
                onClick={() => setShowSettings(false)}
                className="px-4 py-1.5 rounded bg-white text-black font-semibold text-xs hover:bg-zinc-200"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
