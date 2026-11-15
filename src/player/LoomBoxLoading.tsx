import React from 'react'

interface LoomBoxLoadingProps {
  title?: string
  subtitle?: string
  progress?: number
  speed?: string
  peers?: number
  downloaded?: string
  total?: string
  onCancel?: () => void
  onChooseOther?: () => void
  otherCount?: number
}

export function LoomBoxLoading({
  title = 'Buffering Stream Chunks',
  subtitle,
  progress,
  speed,
  peers,
  downloaded,
  total = '8 MB',
  onCancel,
  onChooseOther,
  otherCount,
}: LoomBoxLoadingProps) {
  return (
    <div className="relative w-full max-w-sm mx-auto flex flex-col items-center justify-center p-4 sm:p-6 text-center select-none z-30 animate-in fade-in duration-300">
      {/* Living Creature Loom Box Container */}
      <div className="relative w-full max-w-xs sm:max-w-sm rounded-3xl bg-[#0c0c0e]/90 backdrop-blur-2xl border border-white/15 p-5 sm:p-6 shadow-[0_20px_60px_rgba(0,0,0,0.9),0_0_30px_rgba(255,255,255,0.04)] animate-loom-box overflow-hidden">
        {/* Holographic Living Laser Line Scan Frame */}
        <div className="relative w-full h-28 rounded-2xl bg-black/60 border border-white/10 overflow-hidden mb-5 flex items-center justify-center">
          {/* Subtle grid background */}
          <div
            className="absolute inset-0 opacity-20"
            style={{
              backgroundImage:
                'linear-gradient(to right, rgba(255,255,255,0.1) 1px, transparent 1px), linear-gradient(to bottom, rgba(255,255,255,0.1) 1px, transparent 1px)',
              backgroundSize: '16px 16px',
            }}
          />

          {/* Living Creature Ambient Core Glow */}
          <div className="absolute w-24 h-24 rounded-full bg-gradient-to-tr from-cyan-500/20 via-blue-500/20 to-purple-500/20 blur-xl animate-pulse" />

          {/* Sweeping Vertical Laser Scan Line */}
          <div className="absolute inset-x-0 h-10 bg-gradient-to-b from-transparent via-cyan-400/25 to-transparent pointer-events-none animate-loom-scan" />

          {/* Sweeping Horizontal Laser Beam */}
          <div className="absolute inset-y-0 w-16 bg-gradient-to-r from-transparent via-white/30 to-transparent pointer-events-none animate-loom-hscan" />

          {/* Scanner Center: Minimalist Holographic Core (No Sun Icon) */}
          <div className="relative z-10 flex flex-col items-center justify-center pointer-events-none">
            {typeof progress === 'number' ? (
              <span className="text-2xl font-mono font-black text-cyan-300 tracking-wider drop-shadow-[0_0_15px_rgba(56,189,248,0.9)]">
                {progress}%
              </span>
            ) : (
              <div className="w-2.5 h-2.5 rounded-full bg-cyan-400 shadow-[0_0_15px_rgba(56,189,248,1)] animate-ping" />
            )}
          </div>

          {/* Living Corner Brackets */}
          <div className="absolute top-2 left-2 w-2 h-2 border-t-2 border-l-2 border-white/40" />
          <div className="absolute top-2 right-2 w-2 h-2 border-t-2 border-r-2 border-white/40" />
          <div className="absolute bottom-2 left-2 w-2 h-2 border-b-2 border-l-2 border-white/40" />
          <div className="absolute bottom-2 right-2 w-2 h-2 border-b-2 border-r-2 border-white/40" />
        </div>

        {/* Title & Subtitle */}
        <div className="space-y-1 mb-4">
          <div className="flex items-center justify-center gap-2">
            <span className="w-2 h-2 rounded-full bg-cyan-400 animate-ping" />
            <h3 className="text-sm sm:text-base font-bold text-white tracking-wide font-sans">
              {title}
            </h3>
          </div>
          {subtitle && (
            <p className="text-xs text-white/60 font-medium truncate max-w-[280px] mx-auto">
              {subtitle}
            </p>
          )}
        </div>

        {/* Glowing Laser Progress Line (if progress is provided) */}
        {typeof progress === 'number' && (
          <div className="w-full mb-4">
            <div className="w-full h-1.5 rounded-full bg-white/10 overflow-hidden border border-white/10 p-[0.5px]">
              <div
                className="h-full rounded-full bg-gradient-to-r from-cyan-400 via-blue-500 to-indigo-400 transition-all duration-300 shadow-[0_0_10px_rgba(56,189,248,0.7)]"
                style={{ width: `${Math.max(4, Math.min(100, progress))}%` }}
              />
            </div>
          </div>
        )}

        {/* Telemetry Pills */}
        {(speed || peers !== undefined || downloaded) && (
          <div className="flex items-center justify-center gap-2 mb-4 text-[11px] font-mono text-white/70">
            {speed && (
              <span className="px-2.5 py-0.5 rounded-full bg-white/5 border border-white/10 text-cyan-300">
                {speed}
              </span>
            )}
            {peers !== undefined && (
              <span className="px-2.5 py-0.5 rounded-full bg-white/5 border border-white/10 text-emerald-300">
                {peers}P
              </span>
            )}
            {downloaded && (
              <span className="px-2.5 py-0.5 rounded-full bg-white/5 border border-white/10 text-purple-300">
                {downloaded} / {total}
              </span>
            )}
          </div>
        )}

        {/* Action Controls */}
        {(onChooseOther || onCancel) && (
          <div className="flex items-center justify-center gap-2 pt-2 border-t border-white/10">
            {onChooseOther && (
              <button
                type="button"
                onClick={onChooseOther}
                className="px-4 py-1.5 rounded-full bg-white/10 hover:bg-white/20 active:scale-95 text-white text-xs font-semibold border border-white/15 transition-all cursor-pointer"
              >
                Choose Stream {otherCount !== undefined ? `(${otherCount})` : ''}
              </button>
            )}
            {onCancel && (
              <button
                type="button"
                onClick={onCancel}
                className="px-4 py-1.5 rounded-full bg-white/5 hover:bg-white/10 active:scale-95 text-white/60 hover:text-white text-xs font-medium border border-white/5 transition-all cursor-pointer"
              >
                Cancel
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
