import { useState } from 'react'
import { useProfileStore, AVATAR_OPTIONS } from './profileStore'
import { AvatarPicker } from './AvatarPicker'
import type { Profile } from '@/types'

export function ProfileScreen() {
  const { profiles, selectProfile, createProfile, updateProfile, deleteProfile } = useProfileStore()
  const [isAdding, setIsAdding] = useState(false)
  const [editingProfile, setEditingProfile] = useState<Profile | null>(null)
  const [isManaging, setIsManaging] = useState(false)

  // Form fields
  const [name, setName] = useState('')
  const [avatar, setAvatar] = useState('lion')

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) return
    createProfile(name, avatar)
    setName('')
    setIsAdding(false)
  }

  const handleEdit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!editingProfile || !name.trim()) return
    updateProfile(editingProfile.id, name, avatar)
    setEditingProfile(null)
  }

  const openAdd = () => {
    setName('')
    setAvatar('lion')
    setIsAdding(true)
  }

  const openEdit = (profile: Profile) => {
    setEditingProfile(profile)
    setName(profile.name)
    setAvatar(profile.avatar || 'lion')
  }

  const getAvatarImage = (id: string) => {
    const opt = AVATAR_OPTIONS.find((a) => a.id === id)
    return opt ? opt.image : '/avatars/lion.jpg'
  }

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white flex flex-col items-center justify-center p-6 select-none relative overflow-hidden">
      {/* Subtle Ambient Apple-style Backdrop Glow */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[700px] bg-white/[0.03] rounded-full blur-[160px] pointer-events-none" />

      {/* Brand Metallic Logo at Top */}
      <div className="absolute top-8 left-8 md:top-10 md:left-12">
        <img
          src="/logo.svg"
          alt="Endless Stream"
          className="h-10 md:h-12 w-auto object-contain drop-shadow-xl"
        />
      </div>

      <h1 className="text-3xl sm:text-5xl font-bold mb-12 text-center tracking-tight text-white drop-shadow-md">
        {isManaging ? 'Manage Profiles' : "Who's watching?"}
      </h1>

      {/* Profiles Grid */}
      <div className="flex flex-wrap items-center justify-center gap-6 md:gap-10 max-w-4xl z-10">
        {profiles.map((profile) => {
          const avatarUrl = getAvatarImage(profile.avatar)
          return (
            <div
              key={profile.id}
              className="group flex flex-col items-center cursor-pointer relative"
              onClick={() => {
                if (isManaging) {
                  openEdit(profile)
                } else {
                  selectProfile(profile.id)
                }
              }}
            >
              {/* 1:1 Circular Avatar Card */}
              <div className="relative aspect-square w-24 h-24 sm:w-28 sm:h-28 md:w-36 md:h-36 rounded-full overflow-hidden bg-black/80 border-2 border-white/20 shadow-2xl transition-all duration-300 group-hover:scale-105 group-hover:ring-4 group-hover:ring-white group-hover:border-transparent group-hover:shadow-black">
                <img
                  src={avatarUrl}
                  alt={profile.name}
                  className="w-full h-full object-cover"
                />

                {/* Edit overlay icon in Manage mode */}
                {isManaging && (
                  <div className="absolute inset-0 bg-black/60 flex items-center justify-center backdrop-blur-xs">
                    <span className="text-xl sm:text-2xl">✏️</span>
                  </div>
                )}
              </div>

              <span className="mt-4 text-white/70 group-hover:text-white font-medium text-base md:text-lg tracking-wide transition-colors">
                {profile.name}
              </span>

              {/* Delete Badge Button in Manage Mode */}
              {isManaging && profiles.length > 1 && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation()
                    deleteProfile(profile.id)
                  }}
                  className="absolute -top-2 -right-2 bg-red-600 hover:bg-red-700 text-white rounded-full w-7 h-7 flex items-center justify-center text-xs font-bold shadow-xl border-2 border-[#0a0a0a] transition-transform hover:scale-110 cursor-pointer"
                  title="Delete Profile"
                >
                  ✕
                </button>
              )}
            </div>
          )
        })}

        {/* Add Profile Card */}
        {profiles.length < 6 && (
          <div
            onClick={openAdd}
            className="group flex flex-col items-center cursor-pointer"
          >
            <div className="aspect-square w-24 h-24 sm:w-28 sm:h-28 md:w-36 md:h-36 rounded-full border-2 border-dashed border-white/20 hover:border-white/50 bg-white/[0.02] flex items-center justify-center text-4xl text-white/40 group-hover:text-white group-hover:scale-105 transition-all duration-300">
              +
            </div>
            <span className="mt-4 text-white/50 group-hover:text-white font-medium text-base md:text-lg">
              Add Profile
            </span>
          </div>
        )}
      </div>

      {/* Manage Profiles Toggle Button */}
      <div className="mt-16 z-10">
        <button
          type="button"
          onClick={() => setIsManaging(!isManaging)}
          className={`px-7 py-2.5 tracking-wider uppercase text-xs font-bold rounded-full transition-all duration-200 cursor-pointer ${
            isManaging
              ? 'bg-white text-black shadow-lg font-extrabold'
              : 'border border-white/20 text-white/70 hover:text-white hover:border-white hover:bg-white/5'
          }`}
        >
          {isManaging ? 'Done' : 'Manage Profiles'}
        </button>
      </div>

      {/* Add Profile Modal */}
      {isAdding && (
        <div className="fixed inset-0 bg-black/85 backdrop-blur-md flex items-center justify-center p-4 z-50 animate-in fade-in duration-200">
          <div className="bg-[#181818] rounded-2xl p-7 max-w-lg w-full border border-white/10 shadow-2xl">
            <h2 className="text-2xl font-bold mb-4 tracking-tight">Create Profile</h2>
            <form onSubmit={handleCreate} className="space-y-5">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-white/60 mb-2">
                  Profile Name
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Alex, MovieBuff"
                  maxLength={16}
                  className="w-full bg-[#242424] text-white px-4 py-2.5 rounded-xl border border-white/15 focus:outline-none focus:ring-2 focus:ring-white text-base"
                  autoFocus
                />
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-white/60 mb-2">
                  Choose Avatar
                </label>
                <AvatarPicker selected={avatar} onSelect={setAvatar} />
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-white/10">
                <button
                  type="button"
                  onClick={() => setIsAdding(false)}
                  className="px-5 py-2 text-white/60 hover:text-white font-medium text-sm transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!name.trim()}
                  className="px-6 py-2.5 bg-white text-black hover:bg-white/90 font-bold text-sm rounded-full transition-transform active:scale-95 disabled:opacity-50 shadow-lg cursor-pointer"
                >
                  Save Profile
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Profile Modal */}
      {editingProfile && (
        <div className="fixed inset-0 bg-black/85 backdrop-blur-md flex items-center justify-center p-4 z-50 animate-in fade-in duration-200">
          <div className="bg-[#181818] rounded-2xl p-7 max-w-lg w-full border border-white/10 shadow-2xl">
            <h2 className="text-2xl font-bold mb-4 tracking-tight">Edit Profile</h2>
            <form onSubmit={handleEdit} className="space-y-5">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-white/60 mb-2">
                  Profile Name
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  maxLength={16}
                  className="w-full bg-[#242424] text-white px-4 py-2.5 rounded-xl border border-white/15 focus:outline-none focus:ring-2 focus:ring-white text-base"
                  autoFocus
                />
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-white/60 mb-2">
                  Choose Avatar
                </label>
                <AvatarPicker selected={avatar} onSelect={setAvatar} />
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-white/10">
                <button
                  type="button"
                  onClick={() => setEditingProfile(null)}
                  className="px-5 py-2 text-white/60 hover:text-white font-medium text-sm transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!name.trim()}
                  className="px-6 py-2.5 bg-white text-black hover:bg-white/90 font-bold text-sm rounded-full transition-transform active:scale-95 disabled:opacity-50 shadow-lg cursor-pointer"
                >
                  Update Profile
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
