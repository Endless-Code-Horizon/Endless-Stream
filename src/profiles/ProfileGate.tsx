import type { ReactNode } from 'react'
import { useProfileStore } from './profileStore'
import { ProfileScreen } from './ProfileScreen'

export function ProfileGate({ children }: { children: ReactNode }) {
  const activeProfileId = useProfileStore((s) => s.activeProfileId)

  if (!activeProfileId) {
    return <ProfileScreen />
  }

  return <>{children}</>
}
