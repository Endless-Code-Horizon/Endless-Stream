interface LogoProps {
  className?: string
  size?: 'sm' | 'md' | 'lg'
  showText?: boolean
}

export function Logo({ className = '', size = 'md', showText = true }: LogoProps) {
  const iconHeight =
    size === 'sm' ? 'h-6 sm:h-7' : size === 'lg' ? 'h-10 sm:h-12' : 'h-8 sm:h-9'
  const textSize =
    size === 'sm' ? 'text-xs tracking-wider' : size === 'lg' ? 'text-lg tracking-widest' : 'text-sm tracking-widest'

  return (
    <div className={`flex items-center gap-2.5 select-none ${className}`}>
      {/* Actual Endless Stream Metallic Mark from Assets */}
      <div className={`relative ${iconHeight} shrink-0 flex items-center`}>
        <img
          src="/endless-stream-mark.svg"
          alt="Endless Stream"
          className={`${iconHeight} w-auto object-contain drop-shadow-[0_2px_12px_rgba(255,255,255,0.2)]`}
        />
      </div>

      {showText && (
        <div className="flex flex-col leading-none">
          <span className={`font-black text-white font-sans ${textSize} uppercase tracking-wider drop-shadow-md`}>
            ENDLESS
          </span>
          <span className="text-[9px] font-semibold tracking-[0.25em] text-white/50 uppercase mt-0.5 font-mono">
            STREAM
          </span>
        </div>
      )}
    </div>
  )
}
