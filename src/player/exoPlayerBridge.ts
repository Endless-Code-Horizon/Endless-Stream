import { Capacitor, registerPlugin } from '@capacitor/core'

export interface NativeAudioTrack {
  index: number
  id: string
  label: string
  language: string
  channels: number
  isSelected: boolean
}

export interface NativeStatus {
  currentTime: number
  duration: number
  isPlaying: boolean
  isBuffering: boolean
  buffered: number
}

interface ExoPlayerPluginInterface {
  isAvailable(): Promise<{ available: boolean; engine: string }>
  load(options: { url: string; positionMs?: number; autoPlay?: boolean }): Promise<{ success: boolean }>
  play(): Promise<void>
  pause(): Promise<void>
  seekTo(options: { positionMs: number }): Promise<void>
  setVolume(options: { volume: number }): Promise<void>
  getStatus(): Promise<NativeStatus>
  getAudioTracks(): Promise<{ tracks: NativeAudioTrack[] }>
  setAudioTrack(options: { index: number }): Promise<void>
  destroy(): Promise<void>
  addListener(eventName: string, listenerFunc: (data: any) => void): Promise<any>
}

const ExoPlayer = registerPlugin<ExoPlayerPluginInterface>('ExoPlayerPlugin')

export const isExoPlayerSupported = (): boolean => {
  return Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'android'
}

export async function exoLoad(url: string, positionMs = 0, autoPlay = true): Promise<boolean> {
  if (!isExoPlayerSupported()) return false
  try {
    const res = await ExoPlayer.load({ url, positionMs, autoPlay })
    return Boolean(res.success)
  } catch (err) {
    console.warn('[ExoPlayerBridge] Load failed:', err)
    return false
  }
}

export async function exoPlay(): Promise<void> {
  if (!isExoPlayerSupported()) return
  try {
    await ExoPlayer.play()
  } catch {}
}

export async function exoPause(): Promise<void> {
  if (!isExoPlayerSupported()) return
  try {
    await ExoPlayer.pause()
  } catch {}
}

export async function exoSeekTo(positionMs: number): Promise<void> {
  if (!isExoPlayerSupported()) return
  try {
    await ExoPlayer.seekTo({ positionMs })
  } catch {}
}

export async function exoSetVolume(volume: number): Promise<void> {
  if (!isExoPlayerSupported()) return
  try {
    await ExoPlayer.setVolume({ volume })
  } catch {}
}

export async function exoGetStatus(): Promise<NativeStatus | null> {
  if (!isExoPlayerSupported()) return null
  try {
    return await ExoPlayer.getStatus()
  } catch {
    return null
  }
}

export async function exoGetAudioTracks(): Promise<NativeAudioTrack[]> {
  if (!isExoPlayerSupported()) return []
  try {
    const res = await ExoPlayer.getAudioTracks()
    return res.tracks || []
  } catch {
    return []
  }
}

export async function exoSetAudioTrack(index: number): Promise<void> {
  if (!isExoPlayerSupported()) return
  try {
    await ExoPlayer.setAudioTrack({ index })
  } catch {}
}

export async function exoDestroy(): Promise<void> {
  if (!isExoPlayerSupported()) return
  try {
    await ExoPlayer.destroy()
  } catch {}
}
