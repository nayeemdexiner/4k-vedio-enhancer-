import React from 'react';
import { Sliders, Video } from 'lucide-react';

interface HeaderProps {
  onOpenSettings?: () => void;
}

export const Header: React.FC<HeaderProps> = ({ onOpenSettings }) => {
  return (
    <header className="border-b border-zinc-800 bg-black/95 backdrop-blur-md text-white sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo & Identity */}
          <div className="flex items-center space-x-3.5">
            {/* Custom Modern 4K Logo */}
            <div className="relative group flex items-center justify-center">
              <div className="absolute -inset-1 bg-gradient-to-r from-amber-500 via-rose-500 to-violet-600 rounded-lg blur-sm opacity-40 group-hover:opacity-75 transition duration-300" />
              <div className="relative w-9 h-9 rounded-lg bg-zinc-950 border border-zinc-700/80 flex items-center justify-center shadow-inner">
                <Video className="w-4 h-4 text-white" />
                <span className="absolute -bottom-1 -right-1 px-1 py-0.2 bg-white text-[9px] font-black text-black rounded font-mono leading-none tracking-tighter shadow">
                  4K
                </span>
              </div>
            </div>

            <div className="flex flex-col">
              <div className="flex items-center space-x-2">
                <h1 className="font-sans font-extrabold tracking-tight text-base sm:text-lg text-white">
                  4K Video Exporter
                </h1>
                <span className="hidden sm:inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-mono font-bold bg-zinc-800 border border-zinc-700 text-zinc-300">
                  PRO ULTRA
                </span>
              </div>
              <span className="hidden sm:block text-[11px] text-zinc-400 font-mono tracking-tight">
                WebGL2 Master Upscaling &amp; De-Smudge Engine
              </span>
            </div>
          </div>

          {/* Right Action Area */}
          <div className="flex items-center space-x-3">
            {/* Rounded Curved White 'About Dev' Button */}
            <a
              href="https://muhammadnayeem.qzz.io/"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center px-4 py-1.5 rounded-full bg-white text-black hover:bg-zinc-200 text-xs font-bold tracking-tight shadow-sm transition-all duration-150 cursor-pointer active:scale-95"
              title="About Developer"
            >
              About Dev
            </a>

            {/* Device Hardware Settings Modal Trigger */}
            {onOpenSettings && (
              <button
                onClick={onOpenSettings}
                className="p-2 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-900 border border-transparent hover:border-zinc-800 transition-colors cursor-pointer"
                title="Device Capabilities &amp; Engine Settings"
                aria-label="Settings"
              >
                <Sliders className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>
      </div>
    </header>
  );
};
