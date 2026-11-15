import { AVATAR_OPTIONS } from './profileStore'

interface AvatarPickerProps {
  selected: string
  onSelect: (avatarId: string) => void
}

export function AvatarPicker({ selected, onSelect }: AvatarPickerProps) {
  const selectedOption =
    AVATAR_OPTIONS.find((a) => a.id === selected) || AVATAR_OPTIONS[0]

  return (
    <div className="flex flex-col items-center py-2 select-none w-full">
      {/* Big Circular Avatar Preview with Ambient Apple Glow */}
      <div className="relative mx-auto w-28 h-28 sm:w-36 sm:h-36 mb-4 group">
        <div className="absolute -inset-2 rounded-full bg-gradient-to-tr from-cyan-500/25 via-white/40 to-blue-500/20 blur-xl opacity-75 group-hover:opacity-100 transition-opacity pointer-events-none" />
        <div className="relative w-full h-full rounded-full overflow-hidden border-2 border-white/60 shadow-2xl bg-black/90 ring-4 ring-white/15">
          <img
            key={selectedOption.id}
            src={selectedOption.image}
            alt={selectedOption.label}
            className="w-full h-full object-cover animate-in fade-in zoom-in-95 duration-300"
          />
        </div>
      </div>

      {/* Selected Avatar Label */}
      <p className="text-sm font-bold text-white tracking-wide mb-4">
        {selectedOption.label}
      </p>

      {/* Uncropped Full Avatar Grid - All 6 avatars clearly visible with zero clipping */}
      <div className="grid grid-cols-6 gap-2 sm:gap-3.5 w-full max-w-md px-1 justify-items-center">
        {AVATAR_OPTIONS.map((opt) => {
          const isSelected = selected === opt.id
          return (
            <button
              key={opt.id}
              type="button"
              onClick={() => onSelect(opt.id)}
              className={`group flex flex-col items-center gap-1 transition-all duration-300 cursor-pointer outline-none ${
                isSelected ? 'scale-110' : 'hover:scale-105 opacity-60 hover:opacity-100'
              }`}
              title={opt.label}
              aria-label={`Select ${opt.label} avatar`}
            >
              <div
                className={`w-11 h-11 sm:w-14 sm:h-14 rounded-full overflow-hidden transition-all duration-300 bg-black/80 ${
                  isSelected
                    ? 'ring-3 ring-white shadow-[0_0_20px_rgba(255,255,255,0.6)] border-2 border-white'
                    : 'border border-white/25 hover:border-white/60'
                }`}
              >
                <img
                  src={opt.image}
                  alt={opt.label}
                  className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-300"
                />
              </div>
            </button>
          )
        })}
      </div>
    </div>
  )
}
