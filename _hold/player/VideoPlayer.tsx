import { useEffect, useRef, useState, useCallback, useMemo } from 'react'
import type { StreamSource, MediaType, EpisodeRef } from '@/types'
import { useUIStore } from '@/app/uiStore'
import { LoomBoxLoading } from './LoomBoxLoading'
import { ScreenOrientation } from '@capacitor/screen-orientation'
import { Capacitor } from '@capacitor/core'
import {
  isExoPlayerSupported,
  exoLoad,
  exoPlay,
  exoPause,
  exoSeekTo,
  exoSetVolume,
  exoGetStatus,
  exoGetAudioTracks,
  exoSetAudioTrack,
  exoDestroy,
} from './exoPlayerBridge'

export interface AudioTrackItem {
  id: string | number
  label: string
  language: string
  channels?: number
  selected: boolean
}

interface VideoPlayerProps {
  sources: StreamSource[]
  startTime?: number
  expectedDuration?: number
  title?: string
  subtitle?: string
  mediaType?: MediaType
  mediaId?: string
  episodeRef?: EpisodeRef
  onBack?: () => void
  onTimeUpdate?: (currentTime: number, duration: number) => void
  onEnded?: () => void
  onError?: (err: string) => void
}

interface OpenSubItem {
  id: string
  url: string
  lang: string
  subtitleFileName?: string
  releaseGroup?: string
  fpsMilli?: number
}

interface ParsedCue {
  start: number
  end: number
  text: string
}

interface CleanStreamInfo {
  resolution: string
  quality: string
  hdr: string[]
  audio: string[]
  seeders?: number
  size?: string
  cleanTitle: string
}

interface SwarmStats {
  infoHash: string
  ready: boolean
  fileName?: string
  fileSize?: number
  peers: number
  downloadSpeed: number
  uploadSpeed: number
  downloaded: number
}

function formatSpeed(bytesPerSec: number): string {
  if (!bytesPerSec || bytesPerSec <= 0) return '0 KB/s'
  if (bytesPerSec >= 1024 * 1024) {
    return `${(bytesPerSec / (1024 * 1024)).toFixed(1)} MB/s`
  }
  return `${Math.round(bytesPerSec / 1024)} KB/s`
}

function formatBytes(bytes: number): string {
  if (!bytes || bytes <= 0) return '0 MB'
  if (bytes >= 1024 * 1024 * 1024) {
    return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`
  }
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function parseStreamClean(src: StreamSource, fallbackTitle = 'Movie'): CleanStreamInfo {
  const raw = `${src.filename || ''} ${src.label || ''}`

  // Resolution
  let resolution = '1080p'
  if (/2160p|4k|uhd/i.test(raw)) resolution = '4K UHD'
  else if (/1080p|fhd/i.test(raw)) resolution = '1080p FHD'
  else if (/720p|hd\b/i.test(raw)) resolution = '720p HD'
  else if (/480p|sd\b/i.test(raw)) resolution = 'SD'

  // Quality
  let quality = 'WEB-DL'
  if (/remux/i.test(raw)) quality = 'REMUX'
  else if (/bluray|bdrip/i.test(raw)) quality = 'BluRay'
  else if (/web-dl|webrip/i.test(raw)) quality = 'WEB-DL'
  else if (/hdrip|dvdrip/i.test(raw)) quality = 'HDRip'
  else if (/hdtv/i.test(raw)) quality = 'HDTV'

  // HDR
  const hdr: string[] = []
  if (/dv\b|dolby\s*vision/i.test(raw)) hdr.push('DV')
  if (/hdr10\+/i.test(raw)) hdr.push('HDR10+')
  else if (/hdr\b/i.test(raw)) hdr.push('HDR')

  // Audio
  const audio: string[] = []
  if (/atmos/i.test(raw)) audio.push('Atmos')
  if (/dts-hd(\.ma)?/i.test(raw)) audio.push('DTS-HD')
  else if (/dts/i.test(raw)) audio.push('DTS')
  if (/ddp5\.1|e-ac-?3/i.test(raw)) audio.push('5.1')

  // Seeders
  let seeders = src.seeders
  if (seeders === undefined) {
    const m = raw.match(/[👤👥]\s*(\d+)/) || raw.match(/seeds?:\s*(\d+)/i)
    if (m) seeders = parseInt(m[1], 10)
  }

  // Size
  let size = src.size
  if (!size) {
    const m = raw.match(/[💾]\s*([\d.]+\s*(?:GB|MB|TB))/i) || raw.match(/([\d.]+\s*(?:GB|MB))\b/i)
    if (m) size = m[1].trim()
  }

  // Clean release title (strip leading [P2P] or tracker noise)
  let cleanTitle = (src.filename || src.label || fallbackTitle)
    .replace(/^\[P2P\]\s*/i, '')
    .replace(/^(?:Provider|Stream|Addon)\s*[-·]\s*/i, '')
    .replace(/^4k\s*DV\s*\|\s*HDR10\+\s*-\s*/i, '')
    .replace(/\s*⚙️[^\n]*/g, '')
    .replace(/\s*👤\s*\d+[^\n]*/g, '')
    .replace(/\s*💾\s*[\d.]+\s*(?:GB|MB)[^\n]*/g, '')
    .replace(/\s*Multi Audio[^\n]*/gi, '')
    .replace(/[-_.]+/g, ' ')
    .trim()

  return {
    resolution,
    quality,
    hdr,
    audio,
    seeders,
    size,
    cleanTitle,
  }
}

// Format stream name with resolution and peers: e.g. "1080p 16P", "720p 90P", "4K 100P"
function formatStreamPill(resolution: string, peers?: number): string {
  let res = '1080p'
  if (/4k|2160p/i.test(resolution)) res = '4K'
  else if (/1080p|fhd/i.test(resolution)) res = '1080p'
  else if (/720p|hd\b/i.test(resolution)) res = '720p'
  else if (/480p|sd\b/i.test(resolution)) res = '480p'
  else res = resolution.split(' ')[0] || '1080p'

  const peerCount = typeof peers === 'number' && peers >= 0 ? peers : 0
  return `${res} ${peerCount}P`
}

// Convert SRT / WebVTT timestamp "00:01:20,500" or "01:20.500" into seconds
function parseTime(str: string): number {
  if (!str) return 0
  const clean = str.replace(',', '.').trim()
  const parts = clean.split(':')
  if (parts.length === 3) {
    const [h, m, s] = parts
    return (parseFloat(h) || 0) * 3600 + (parseFloat(m) || 0) * 60 + (parseFloat(s) || 0)
  }
  if (parts.length === 2) {
    const [m, s] = parts
    return (parseFloat(m) || 0) * 60 + (parseFloat(s) || 0)
  }
  return parseFloat(clean) || 0
}

// Parse raw SRT file content into timed subtitle cues
function parseSRT(srtContent: string): ParsedCue[] {
  const cues: ParsedCue[] = []
  const blocks = srtContent.replace(/\r\n/g, '\n').replace(/\r/g, '\n').trim().split(/\n\n+/)

  for (const block of blocks) {
    const lines = block.split('\n')
    if (lines.length < 2) continue
    const timeIdx = lines[0].includes('-->') ? 0 : 1
    const timeLine = lines[timeIdx]
    if (!timeLine || !timeLine.includes('-->')) continue

    const [startStr, endStr] = timeLine.split('-->')
    const start = parseTime(startStr)
    const end = parseTime(endStr)
    const text = lines.slice(timeIdx + 1).join('\n').replace(/<[^>]+>/g, '').trim()

    if (!isNaN(start) && !isNaN(end) && text) {
      cues.push({ start, end, text })
    }
  }

  return cues
}

const LANGUAGE_LABELS: Record<string, string> = {
  eng: 'English',
  en: 'English',
  spa: 'Spanish',
  es: 'Spanish',
  fre: 'French',
  fra: 'French',
  fr: 'French',
  ita: 'Italian',
  it: 'Italian',
  ger: 'German',
  deu: 'German',
  de: 'German',
  por: 'Portuguese',
  pt: 'Portuguese',
  rus: 'Russian',
  ru: 'Russian',
  hin: 'Hindi',
  hi: 'Hindi',
  chi: 'Chinese',
  zho: 'Chinese',
  zh: 'Chinese',
  jpn: 'Japanese',
  ja: 'Japanese',
  kor: 'Korean',
  ko: 'Korean',
  ara: 'Arabic',
  ar: 'Arabic',
}

export function VideoPlayer({
  sources,
  startTime = 0,
  expectedDuration,
  title,
  subtitle,
  mediaType = 'movie',
  mediaId,
  episodeRef,
  onBack,
  onTimeUpdate,
  onEnded,
  onError,
}: VideoPlayerProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const videoRef = useRef<HTMLVideoElement>(null)
  const hideTimerRef = useRef<number | null>(null)
  const scrubRailRef = useRef<HTMLDivElement>(null)
  const subtitleDropdownRef = useRef<HTMLDivElement>(null)
  const userPausedRef = useRef(false)
  const hasStartedRef = useRef(false)
  const hasUnlockedPlaybackRef = useRef(false)
  const lastLoadedUrlRef = useRef<string | null>(null)

  const [sourceIndex, setSourceIndex] = useState(0)
  const currentSource = sources[sourceIndex] || sources[0]
  const currentCleanInfo = useMemo(
    () => (currentSource ? parseStreamClean(currentSource, title) : null),
    [currentSource?.url, currentSource?.filename, currentSource?.label, title]
  )
  const isP2P = Boolean(currentSource?.url?.includes('/stream/'))

  const defaultDuration =
    expectedDuration && expectedDuration > 60
      ? expectedDuration
      : mediaType === 'series'
      ? 50 * 60
      : 105 * 60

  const [isPlaying, setIsPlaying] = useState(false)
  const [isMuted, setIsMuted] = useState(false)
  const [volume, setVolume] = useState(1)
  const [currentTime, setCurrentTime] = useState<number>(startTime || 0)
  const [duration, setDuration] = useState(defaultDuration)
  const [buffered, setBuffered] = useState(0)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [controlsVisible, setControlsVisible] = useState(true)
  const [isScrubbing, setIsScrubbing] = useState(false)

  const isScrubbingRef = useRef<boolean>(false)
  isScrubbingRef.current = isScrubbing
  const scrubTargetRef = useRef<number>(startTime || 0)

  // Dynamic synchronized duration:
  // Prefer the actual video element duration whenever it has loaded (> 10s and finite).
  // Fall back to expectedDuration or media defaults until metadata arrives or for chunked P2P.
  const displayDuration =
    videoRef.current?.duration && isFinite(videoRef.current.duration) && videoRef.current.duration > 10
      ? videoRef.current.duration
      : duration > 10
      ? duration
      : expectedDuration && expectedDuration > 10
      ? expectedDuration
      : mediaType === 'series'
      ? 3000
      : 6300

  useEffect(() => {
    if (expectedDuration && expectedDuration > 60) {
      setDuration((prev) => (prev <= 60 || prev === 3000 || prev === 6300 ? expectedDuration : prev))
    }
  }, [expectedDuration])

  // Subtitles States & Styling
  const [subtitlesList, setSubtitlesList] = useState<OpenSubItem[]>([])
  const [selectedSubId, setSelectedSubId] = useState<string>('off')
  const [activeCues, setActiveCues] = useState<ParsedCue[]>([])
  const [subtitleMenuOpen, setSubtitleMenuOpen] = useState(false)
  const [subTab, setSubTab] = useState<'tracks' | 'style'>('tracks')
  const [subFontSize, setSubFontSize] = useState<'sm' | 'md' | 'lg' | 'xl'>('md')
  const [subColor, setSubColor] = useState<'white' | 'yellow' | 'cyan' | 'green'>('white')
  const [subBoxStyle, setSubBoxStyle] = useState<'box' | 'glow'>('box')
  const [subOffset, setSubOffset] = useState<number>(0)

  // Audio Tracks State
  const audioDropdownRef = useRef<HTMLDivElement>(null)
  const [audioTracks, setAudioTracks] = useState<AudioTrackItem[]>([])
  const [selectedAudioTrack, setSelectedAudioTrack] = useState<string | number>(0)
  const [audioMenuOpen, setAudioMenuOpen] = useState(false)

  // Mobile 3-Dot Menu & Screen Orientation States
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [mobileTab, setMobileTab] = useState<'audio' | 'subtitles' | 'streams'>('audio')
  const [isLandscape, setIsLandscape] = useState(false)

  // Screen Rotation Toggle (Landscape / Portrait)
  const toggleOrientation = useCallback(async () => {
    try {
      if (Capacitor.isNativePlatform()) {
        const current = await ScreenOrientation.orientation()
        if (current.type.includes('portrait')) {
          await ScreenOrientation.lock({ orientation: 'landscape' })
          setIsLandscape(true)
        } else {
          await ScreenOrientation.unlock()
          setIsLandscape(false)
        }
      } else if (screen.orientation && screen.orientation.lock) {
        if (screen.orientation.type.includes('portrait')) {
          await screen.orientation.lock('landscape').catch(() => {})
          setIsLandscape(true)
        } else {
          screen.orientation.unlock()
          setIsLandscape(false)
        }
      } else {
        setIsLandscape((prev) => !prev)
      }
    } catch {
      setIsLandscape((prev) => !prev)
    }
  }, [])

  // Unlock orientation and cleanup ExoPlayer on unmount, and set transparency on Android
  useEffect(() => {
    const isExo = isExoPlayerSupported()
    if (isExo) {
      document.body.style.backgroundColor = 'transparent'
      document.documentElement.style.backgroundColor = 'transparent'
    }

    return () => {
      if (Capacitor.isNativePlatform()) {
        ScreenOrientation.unlock().catch(() => {})
      } else if (screen.orientation && screen.orientation.unlock) {
        try {
          screen.orientation.unlock()
        } catch {}
      }
      if (isExo) {
        document.body.style.backgroundColor = '#0a0a0a'
        document.documentElement.style.backgroundColor = '#0a0a0a'
        exoDestroy()
      }
    }
  }, [])

  // Refresh and detect available audio tracks (ExoPlayer on Android, HTML5 audioTracks on Desktop)
  const refreshAudioTracks = useCallback(async () => {
    if (isExoPlayerSupported()) {
      const nativeTracks = await exoGetAudioTracks()
      if (nativeTracks && nativeTracks.length > 0) {
        const items: AudioTrackItem[] = nativeTracks.map((t) => ({
          id: t.index,
          label: t.label || `Audio Track ${t.index + 1}`,
          language: t.language,
          channels: t.channels,
          selected: t.isSelected,
        }))
        setAudioTracks(items)
        const active = items.find((i) => i.selected)
        if (active) setSelectedAudioTrack(active.id)
        return
      }
    }

    const video = videoRef.current as any
    if (video && video.audioTracks && video.audioTracks.length > 0) {
      const list: AudioTrackItem[] = []
      for (let i = 0; i < video.audioTracks.length; i++) {
        const track = video.audioTracks[i]
        list.push({
          id: i,
          label: track.label || LANGUAGE_LABELS[track.language] || `Audio Track ${i + 1}`,
          language: track.language || 'und',
          selected: track.enabled,
        })
      }
      setAudioTracks(list)
      const active = list.find((i) => i.selected)
      if (active) setSelectedAudioTrack(active.id)
    } else {
      const streamAudio = currentCleanInfo?.audio?.[0] || 'Stereo'
      setAudioTracks([
        { id: 0, label: `Original Audio (${streamAudio})`, language: 'en', selected: true },
      ])
      setSelectedAudioTrack(0)
    }
  }, [currentCleanInfo?.audio])

  // Select an audio track
  const handleSelectAudioTrack = async (trackId: string | number) => {
    setSelectedAudioTrack(trackId)
    if (isExoPlayerSupported()) {
      await exoSetAudioTrack(Number(trackId))
      setAudioTracks((prev) =>
        prev.map((t) => ({ ...t, selected: t.id === trackId }))
      )
      return
    }

    const video = videoRef.current as any
    if (video && video.audioTracks) {
      for (let i = 0; i < video.audioTracks.length; i++) {
        video.audioTracks[i].enabled = i === Number(trackId)
      }
    }
    setAudioTracks((prev) =>
      prev.map((t) => ({ ...t, selected: t.id === trackId }))
    )
  }

  // Torrent Streams Drawer State
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [drawerFilter, setDrawerFilter] = useState<'all' | '4k' | '1080p'>('all')

  const [centerRipple, setCenterRipple] = useState<'play' | 'pause' | 'backward' | 'forward' | null>(null)
  const [playbackError, setPlaybackError] = useState<string | null>(null)
  const [swarmStats, setSwarmStats] = useState<SwarmStats | null>(null)
  const [isPrebuffering, setIsPrebuffering] = useState<boolean>(isP2P)
  const [prebufferProgress, setPrebufferProgress] = useState<number>(0)

  // Reset states ONLY when changing source URL
  useEffect(() => {
    if (!currentSource?.url || lastLoadedUrlRef.current === currentSource.url) return
    lastLoadedUrlRef.current = currentSource.url

    const isTorrent = Boolean(currentSource.url.includes('/stream/'))
    hasUnlockedPlaybackRef.current = false
    setIsPrebuffering(isTorrent)
    setPrebufferProgress(0)
    setPlaybackError(null)
    userPausedRef.current = false
    hasStartedRef.current = false

    // Load native ExoPlayer on Android APK
    if (isExoPlayerSupported() && currentSource.url) {
      exoLoad(currentSource.url, (startTimeRef.current || 0) * 1000, true).then(() => {
        setIsPlaying(true)
        setTimeout(() => {
          refreshAudioTracks()
        }, 1200)
      })
    }
  }, [currentSource?.url])

  // Native status polling for ExoPlayer (Android)
  useEffect(() => {
    if (!isExoPlayerSupported()) return
    let active = true

    const interval = setInterval(async () => {
      if (!active) return
      const status = await exoGetStatus()
      if (!status) return

      if (!isScrubbingRef.current) {
        setCurrentTime(status.currentTime)
      }
      if (status.duration > 10) {
        setDuration(status.duration)
      }
      setIsPlaying(status.isPlaying)
      setBuffered(status.buffered)
      if (status.currentTime > 0 || !status.isBuffering) {
        setIsPrebuffering(false)
      }
      if (onTimeUpdateRef.current) {
        onTimeUpdateRef.current(status.currentTime, status.duration || displayDuration)
      }
      if (status.duration > 0 && status.currentTime >= status.duration - 1) {
        if (onEndedRef.current) onEndedRef.current()
      }
    }, 400)

    return () => {
      active = false
      clearInterval(interval)
    }
  }, [displayDuration])

  // Fetch OpenSubtitles from Stremio OpenSubtitles v3 Addon
  useEffect(() => {
    if (!mediaId || !mediaId.trim()) return

    let cancelled = false
    const idParam =
      mediaType === 'series' && episodeRef
        ? `${mediaId}:${episodeRef.season}:${episodeRef.episode}`
        : mediaId

    const fetchSubtitles = async () => {
      try {
        const res = await fetch(`https://opensubtitles-v3.strem.io/subtitles/${mediaType}/${idParam}.json`)
        if (!res.ok) return
        const data = (await res.json()) as { subtitles?: OpenSubItem[] }
        if (!cancelled && data.subtitles && Array.isArray(data.subtitles)) {
          // Sort: English first, then by language
          const sorted = [...data.subtitles].sort((a, b) => {
            const isAEng = a.lang.startsWith('en')
            const isBEng = b.lang.startsWith('en')
            if (isAEng && !isBEng) return -1
            if (!isAEng && isBEng) return 1
            return a.lang.localeCompare(b.lang)
          })
          setSubtitlesList(sorted.slice(0, 40))
        }
      } catch {
        // quiet ignore
      }
    }

    fetchSubtitles()
    return () => {
      cancelled = true
    }
  }, [mediaId, mediaType, episodeRef?.season, episodeRef?.episode])

  // Load and parse selected subtitle track
  const handleSelectSubtitle = async (sub: OpenSubItem | 'off') => {
    if (sub === 'off') {
      setSelectedSubId('off')
      setActiveCues([])
      return
    }

    setSelectedSubId(sub.id)
    try {
      // Use proxy or direct URL
      const proxyUrl = `/subtitles-proxy?url=${encodeURIComponent(sub.url)}`
      const res = await fetch(proxyUrl).catch(() => fetch(sub.url))
      if (!res.ok) return
      const srtText = await res.text()
      const cues = parseSRT(srtText)
      setActiveCues(cues)
    } catch (err) {
      console.warn('Subtitle parse error:', err)
    }
  }

  // Active Subtitle Cue computed from currentTime + sync offset
  const activeCue = activeCues.find(
    (c) =>
      currentTime >= c.start + subOffset &&
      currentTime <= c.end + subOffset
  )

  // Poll swarm stats when playing a local P2P stream
  useEffect(() => {
    if (!currentSource || !currentSource.url.includes('/stream/')) {
      setSwarmStats(null)
      setIsPrebuffering(false)
      return
    }

    const infoHashMatch = currentSource.url.match(/\/stream\/([a-fA-F0-9]+)/)
    if (!infoHashMatch) return

    const infoHash = infoHashMatch[1]
    let active = true

    // Safety fallback: Never keep the prebuffering gate open for longer than 6 seconds
    const safetyTimeout = setTimeout(() => {
      if (active) {
        setIsPrebuffering(false)
        const video = videoRef.current
        if (video && video.paused && !userPausedRef.current) {
          video.play().then(() => setIsPlaying(true)).catch(() => {})
        }
      }
    }, 6000)

    const fetchStats = async () => {
      try {
        const res = await fetch(`/stats/${infoHash}`)
        if (res.ok && active) {
          const data: SwarmStats = await res.json()
          setSwarmStats(data)

          const video = videoRef.current
          const downloadedBytes = data.downloaded || 0
          const minRequiredBytes = 8 * 1024 * 1024 // 8MB buffer

          let bufferedSeconds = 0
          try {
            if (video && video.buffered && video.buffered.length > 0) {
              const lastIdx = video.buffered.length - 1
              bufferedSeconds = Math.max(0, video.buffered.end(lastIdx) - (video.currentTime || 0))
            }
          } catch {}

          let percent = 0
          if (!data.ready) {
            const peerCount = typeof data.peers === 'number' && data.peers > 0 ? data.peers : (currentCleanInfo?.seeders || 0)
            const peerBonus = Math.min(25, peerCount * 4)
            const downloadBonus = downloadedBytes > 0 ? Math.min(25, Math.round((downloadedBytes / (2 * 1024 * 1024)) * 25)) : 0
            percent = Math.max(15, peerBonus + downloadBonus)
          } else {
            const bytesPercent = Math.min(100, Math.round((downloadedBytes / minRequiredBytes) * 100))
            const timePercent = Math.min(100, Math.round((bufferedSeconds / 2.0) * 100))
            percent = Math.max(35, bytesPercent, timePercent)
          }

          setPrebufferProgress(percent)

          // Finish prebuffering gate once enough data is ready or video is ready to play
          if (
            percent >= 100 ||
            bufferedSeconds >= 1.5 ||
            (video && video.readyState >= 2) ||
            downloadedBytes >= minRequiredBytes ||
            (video && (video.currentTime || 0) > 0.5)
          ) {
            hasUnlockedPlaybackRef.current = true
            setIsPrebuffering(false)
            if (!hasStartedRef.current && !userPausedRef.current) {
              hasStartedRef.current = true
              if (video && video.paused) {
                video.play().then(() => setIsPlaying(true)).catch(() => {})
              }
            }
          }
        }
      } catch {}
    }

    fetchStats()
    const timer = setInterval(fetchStats, 1000)

    return () => {
      active = false
      clearTimeout(safetyTimeout)
      clearInterval(timer)
    }
  }, [currentSource?.url])

  // Time formatter
  const formatTime = (secs: number) => {
    if (isNaN(secs) || secs < 0) return '00:00'
    const h = Math.floor(secs / 3600)
    const m = Math.floor((secs % 3600) / 60)
    const s = Math.floor(secs % 60)
    if (h > 0) {
      return `${h}:${m < 10 ? '0' : ''}${m}:${s < 10 ? '0' : ''}${s}`
    }
    return `${m < 10 ? '0' : ''}${m}:${s < 10 ? '0' : ''}${s}`
  }

  const triggerRipple = (type: 'play' | 'pause' | 'backward' | 'forward') => {
    setCenterRipple(type)
    setTimeout(() => {
      setCenterRipple(null)
    }, 600)
  }

  // Auto-hide controls timer
  const resetHideTimer = useCallback(() => {
    setControlsVisible(true)
    if (hideTimerRef.current) window.clearTimeout(hideTimerRef.current)
    hideTimerRef.current = window.setTimeout(() => {
      const isActuallyPlaying = videoRef.current ? !videoRef.current.paused : isPlaying
      if (isActuallyPlaying && !subtitleMenuOpen && !audioMenuOpen && !mobileMenuOpen && !isScrubbing && !drawerOpen) {
        setControlsVisible(false)
      }
    }, 3500)
  }, [isPlaying, subtitleMenuOpen, audioMenuOpen, mobileMenuOpen, isScrubbing, drawerOpen])

  // Helper to accurately resolve target seek timestamp from click / touch X position
  const getTimeFromClientX = useCallback(
    (clientX: number) => {
      const rail = scrubRailRef.current
      const video = videoRef.current
      const vDur = video?.duration
      const maxDuration = vDur && isFinite(vDur) && vDur > 10 ? vDur : displayDuration

      if (!rail || !maxDuration || maxDuration <= 0) return 0
      const rect = rail.getBoundingClientRect()
      if (rect.width <= 0) return 0
      const pos = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width))
      return pos * maxDuration
    },
    [displayDuration]
  )

  // Native Seamless Seeking: operates reliably within buffer, ExoPlayer, and over HTTP range requests
  const seekToTime = useCallback(
    (targetTime: number) => {
      if (isExoPlayerSupported()) {
        exoSeekTo(targetTime * 1000)
        setCurrentTime(targetTime)
        return
      }

      const video = videoRef.current
      if (!video) return

      const vDur = video.duration
      const maxDuration = vDur && isFinite(vDur) && vDur > 10 ? vDur : displayDuration
      const clampedTarget = Math.max(0, Math.min(Math.max(0, maxDuration - 1), targetTime))

      try {
        video.currentTime = clampedTarget
        setCurrentTime(clampedTarget)
        hasUnlockedPlaybackRef.current = true
        setIsPrebuffering(false)
      } catch (err) {
        console.warn('Seek error:', err)
      }
    },
    [displayDuration]
  )

  // Fluid scrub mover: while dragging, update the knob position and timestamp smoothly without flooding FFmpeg
  const handleScrubMove = useCallback(
    (clientX: number) => {
      const targetTime = getTimeFromClientX(clientX)
      scrubTargetRef.current = targetTime
      setCurrentTime(targetTime)
    },
    [getTimeFromClientX]
  )

  // Fluid scrub committer: only seeks video stream once upon pointer release
  const handleScrubEnd = useCallback(
    (clientX?: number) => {
      if (typeof clientX === 'number') {
        scrubTargetRef.current = getTimeFromClientX(clientX)
      }
      setIsScrubbing(false)
      isScrubbingRef.current = false
      seekToTime(scrubTargetRef.current)
      resetHideTimer()
    },
    [getTimeFromClientX, seekToTime, resetHideTimer]
  )

  // Direct click on rail seeks immediately
  const handleRailClick = useCallback(
    (clientX: number) => {
      const targetTime = getTimeFromClientX(clientX)
      scrubTargetRef.current = targetTime
      seekToTime(targetTime)
      resetHideTimer()
    },
    [getTimeFromClientX, seekToTime, resetHideTimer]
  )

  // Global pointer/mouse/touch listeners to prevent timeline sticking during drag
  useEffect(() => {
    if (!isScrubbing) return

    const handleWindowMouseMove = (e: MouseEvent) => {
      handleScrubMove(e.clientX)
    }

    const handleWindowMouseUp = (e: MouseEvent) => {
      handleScrubEnd(e.clientX)
    }

    const handleWindowTouchMove = (e: TouchEvent) => {
      if (e.touches.length > 0) {
        handleScrubMove(e.touches[0].clientX)
      }
    }

    const handleWindowTouchEnd = (e: TouchEvent) => {
      const clientX = e.changedTouches.length > 0 ? e.changedTouches[0].clientX : undefined
      handleScrubEnd(clientX)
    }

    window.addEventListener('mousemove', handleWindowMouseMove)
    window.addEventListener('mouseup', handleWindowMouseUp)
    window.addEventListener('touchmove', handleWindowTouchMove)
    window.addEventListener('touchend', handleWindowTouchEnd)

    return () => {
      window.removeEventListener('mousemove', handleWindowMouseMove)
      window.removeEventListener('mouseup', handleWindowMouseUp)
      window.removeEventListener('touchmove', handleWindowTouchMove)
      window.removeEventListener('touchend', handleWindowTouchEnd)
    }
  }, [isScrubbing, handleScrubMove, handleScrubEnd])

  // Ensure controls hide gracefully when drawers, menus, or scrubbing close
  useEffect(() => {
    if (!drawerOpen && !subtitleMenuOpen && !isScrubbing) {
      resetHideTimer()
    }
  }, [drawerOpen, subtitleMenuOpen, isScrubbing, resetHideTimer])

  const handleMouseMove = () => {
    resetHideTimer()
  }

  const togglePlayPause = () => {
    if (isExoPlayerSupported()) {
      if (isPlaying) {
        userPausedRef.current = true
        exoPause()
        setIsPlaying(false)
        triggerRipple('pause')
      } else {
        userPausedRef.current = false
        hasStartedRef.current = true
        exoPlay()
        setIsPlaying(true)
        triggerRipple('play')
      }
      return
    }

    const video = videoRef.current
    if (!video) return
    if (video.paused) {
      userPausedRef.current = false
      hasStartedRef.current = true
      video
        .play()
        .then(() => {
          setIsPlaying(true)
          triggerRipple('play')
        })
        .catch(() => {
          video.muted = true
          setIsMuted(true)
          video.play().then(() => setIsPlaying(true)).catch(() => {})
        })
    } else {
      userPausedRef.current = true
      video.pause()
      setIsPlaying(false)
      triggerRipple('pause')
    }
  }

  const seekBackward = () => {
    const video = videoRef.current
    const current = video && isFinite(video.currentTime) ? video.currentTime : currentTime
    const target = Math.max(0, current - 10)
    seekToTime(target)
    triggerRipple('backward')
    resetHideTimer()
  }

  const seekForward = () => {
    const video = videoRef.current
    const vDur = video?.duration
    const maxDuration = vDur && isFinite(vDur) && vDur > 10 ? vDur : displayDuration
    const current = video && isFinite(video.currentTime) ? video.currentTime : currentTime
    const target = Math.min(Math.max(0, maxDuration - 1), current + 10)
    seekToTime(target)
    triggerRipple('forward')
    resetHideTimer()
  }

  // Mobile touch & desktop surface tap handler: single tap toggles controls, double tap rewinds/forwards 10s
  const lastTapRef = useRef<{ time: number; x: number }>({ time: 0, x: 0 })
  const handleSurfaceClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const now = Date.now()
    const rect = e.currentTarget.getBoundingClientRect()
    const xRatio = (e.clientX - rect.left) / rect.width

    if (now - lastTapRef.current.time < 320) {
      // Double tap detected
      if (xRatio < 0.35) {
        seekBackward()
        resetHideTimer()
      } else if (xRatio > 0.65) {
        seekForward()
        resetHideTimer()
      } else {
        togglePlayPause()
        resetHideTimer()
      }
      lastTapRef.current = { time: 0, x: 0 }
    } else {
      lastTapRef.current = { time: now, x: e.clientX }
      if (controlsVisible) {
        setControlsVisible(false)
      } else {
        resetHideTimer()
      }
    }
  }

  const toggleMute = () => {
    if (isExoPlayerSupported()) {
      const nextMuted = !isMuted
      setIsMuted(nextMuted)
      exoSetVolume(nextMuted ? 0 : (volume || 1))
      return
    }
    const video = videoRef.current
    if (!video) return
    const nextMuted = !video.muted
    video.muted = nextMuted
    if (!nextMuted && video.volume === 0) {
      video.volume = 0.8
      setVolume(0.8)
    }
    setIsMuted(nextMuted)
  }

  const handleVolumeChange = (newVol: number) => {
    const clamped = Math.max(0, Math.min(1, newVol))
    setVolume(clamped)
    if (isExoPlayerSupported()) {
      exoSetVolume(clamped)
      return
    }
    const video = videoRef.current
    if (!video) return
    video.volume = clamped
    if (clamped === 0) {
      video.muted = true
      setIsMuted(true)
    } else if (video.muted) {
      video.muted = false
      setIsMuted(false)
    }
  }

  const toggleFullscreen = () => {
    const container = containerRef.current
    if (!container) return
    if (!document.fullscreenElement) {
      container.requestFullscreen().then(() => setIsFullscreen(true)).catch(() => {})
    } else {
      document.exitFullscreen().then(() => setIsFullscreen(false)).catch(() => {})
    }
  }

  // Click outside subtitle or audio menu
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        subtitleDropdownRef.current &&
        !subtitleDropdownRef.current.contains(e.target as Node)
      ) {
        setSubtitleMenuOpen(false)
      }
      if (
        audioDropdownRef.current &&
        !audioDropdownRef.current.contains(e.target as Node)
      ) {
        setAudioMenuOpen(false)
      }
    }
    window.addEventListener('mousedown', handleClickOutside)
    return () => window.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // Fullscreen change listener
  useEffect(() => {
    const onFullscreenChange = () => {
      setIsFullscreen(Boolean(document.fullscreenElement))
    }
    document.addEventListener('fullscreenchange', onFullscreenChange)
    return () => document.removeEventListener('fullscreenchange', onFullscreenChange)
  }, [])

  // Keyboard Shortcuts (Space, J, L, M, F, Esc, S, C, A, R)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return
      }

      switch (e.key.toLowerCase()) {
        case ' ':
        case 'k':
          e.preventDefault()
          togglePlayPause()
          resetHideTimer()
          break
        case 'arrowleft':
        case 'j':
          e.preventDefault()
          seekBackward()
          resetHideTimer()
          break
        case 'arrowright':
        case 'l':
          e.preventDefault()
          seekForward()
          resetHideTimer()
          break
        case 'm':
          e.preventDefault()
          toggleMute()
          resetHideTimer()
          break
        case 'f':
          e.preventDefault()
          toggleFullscreen()
          resetHideTimer()
          break
        case 's':
          e.preventDefault()
          setDrawerOpen((prev) => !prev)
          break
        case 'c':
          e.preventDefault()
          setSubtitleMenuOpen((prev) => !prev)
          resetHideTimer()
          break
        case 'a':
          e.preventDefault()
          setAudioMenuOpen((prev) => !prev)
          resetHideTimer()
          break
        case 'r':
          e.preventDefault()
          toggleOrientation()
          resetHideTimer()
          break
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [resetHideTimer, toggleOrientation])

  // Stable refs for callbacks so video.load() is NEVER triggered by time updates
  const onTimeUpdateRef = useRef(onTimeUpdate)
  onTimeUpdateRef.current = onTimeUpdate

  const onErrorRef = useRef(onError)
  onErrorRef.current = onError

  const onEndedRef = useRef(onEnded)
  onEndedRef.current = onEnded

  const startTimeRef = useRef(startTime)

  // Sync mute state without resetting video stream
  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.muted = isMuted
    }
  }, [isMuted])

  // Native Video Event Wiring - ONLY runs when stream URL changes!
  useEffect(() => {
    const video = videoRef.current
    if (!video || !currentSource) return

    setPlaybackError(null)
    video.defaultMuted = false

    const onLoadedMetadata = () => {
      const vDur = video.duration
      let activeDur = displayDuration
      if (vDur && isFinite(vDur) && vDur > 10) {
        setDuration(vDur)
        activeDur = vDur
      }

      // Only seek to startTime if it's genuinely within the valid playable range
      // (must NOT be within the last 30s or >= 90% of duration)
      const isFinished =
        !startTimeRef.current ||
        startTimeRef.current <= 0 ||
        startTimeRef.current >= activeDur - 30 ||
        startTimeRef.current >= activeDur * 0.9

      if (!isFinished) {
        try {
          video.currentTime = startTimeRef.current
          setCurrentTime(startTimeRef.current)
        } catch {}
      } else {
        video.currentTime = 0
        setCurrentTime(0)
      }

      if (!userPausedRef.current) {
        hasStartedRef.current = true
        video
          .play()
          .then(() => setIsPlaying(true))
          .catch(() => {
            video.muted = true
            setIsMuted(true)
            video.play().then(() => setIsPlaying(true)).catch(() => {})
          })
      }

      refreshAudioTracks()
    }

    const onCanPlay = () => {
      hasUnlockedPlaybackRef.current = true
      setIsPrebuffering(false)
    }

    const onPlaying = () => {
      hasUnlockedPlaybackRef.current = true
      setIsPrebuffering(false)
      setIsPlaying(true)
    }

    const onTimeUpdateHandler = () => {
      const vTime = video.currentTime || 0
      const current = vTime
      const vDur = video.duration
      let activeDur = displayDuration

      if (vDur && isFinite(vDur) && vDur > 10) {
        activeDur = vDur
        if (Math.abs(duration - vDur) > 2) {
          setDuration(vDur)
        }
      }

      if (!isScrubbingRef.current) {
        setCurrentTime(current)
      }
      if (vTime > 0.5) {
        hasUnlockedPlaybackRef.current = true
        setIsPrebuffering(false)
      }
      if (onTimeUpdateRef.current) {
        onTimeUpdateRef.current(current, activeDur)
      }
      if (video.buffered && video.buffered.length > 0) {
        const rawBuf = video.buffered.end(video.buffered.length - 1)
        setBuffered(rawBuf)
      }
    }

    const onPlayHandler = () => setIsPlaying(true)
    const onPauseHandler = () => setIsPlaying(false)
    const onEndedHandler = () => {
      setIsPlaying(false)
      if (onEndedRef.current) onEndedRef.current()
    }

    const onErrorHandler = () => {
      const err = video.error
      if (err && err.code === 1) return
      const msg = 'Unable to decode media stream.'
      setPlaybackError(msg)
      if (onErrorRef.current) onErrorRef.current(msg)
    }

    const onVolumeChangeHandler = () => {
      setIsMuted(video.muted)
      setVolume(video.volume)
    }

    video.addEventListener('loadedmetadata', onLoadedMetadata)
    video.addEventListener('canplay', onCanPlay)
    video.addEventListener('playing', onPlaying)
    video.addEventListener('timeupdate', onTimeUpdateHandler)
    video.addEventListener('volumechange', onVolumeChangeHandler)
    video.addEventListener('play', onPlayHandler)
    video.addEventListener('pause', onPauseHandler)
    video.addEventListener('ended', onEndedHandler)
    video.addEventListener('error', onErrorHandler)

    video.load()

    return () => {
      video.removeEventListener('loadedmetadata', onLoadedMetadata)
      video.removeEventListener('canplay', onCanPlay)
      video.removeEventListener('playing', onPlaying)
      video.removeEventListener('timeupdate', onTimeUpdateHandler)
      video.removeEventListener('volumechange', onVolumeChangeHandler)
      video.removeEventListener('play', onPlayHandler)
      video.removeEventListener('pause', onPauseHandler)
      video.removeEventListener('ended', onEndedHandler)
      video.removeEventListener('error', onErrorHandler)
    }
  }, [currentSource?.url])

  // Filter drawer streams
  const filteredSources = sources.filter((s) => {
    const info = parseStreamClean(s, title)
    if (drawerFilter === '4k') return info.resolution.includes('4K')
    if (drawerFilter === '1080p') return info.resolution.includes('1080p')
    return true
  })

  if (!sources || sources.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-screen w-screen bg-[#0a0a0a] text-white p-8 text-center select-none animate-in fade-in duration-300">
        <div className="w-16 h-16 rounded-2xl bg-white/10 flex items-center justify-center mb-5 text-2xl border border-white/20 shadow-2xl">
          ⚡
        </div>
        <p className="text-2xl font-bold text-white mb-2">No Stream Sources Available</p>
        <p className="text-sm text-white/60 max-w-md leading-relaxed mb-6">
          This title was loaded from a catalog. To stream this content, install a Stremio stream add-on in the Addon Manager.
        </p>
        <div className="flex items-center gap-3">
          {onBack && (
            <button
              type="button"
              onClick={onBack}
              className="px-6 py-2.5 rounded-full bg-white/10 hover:bg-white/20 text-white font-medium text-sm transition-all cursor-pointer"
            >
              Go Back
            </button>
          )}
          <button
            type="button"
            onClick={() => {
              if (onBack) onBack()
              useUIStore.getState().openAddonModal()
            }}
            className="px-6 py-2.5 rounded-full bg-white text-black hover:bg-neutral-200 font-bold text-sm transition-all shadow-xl cursor-pointer"
          >
            Manage Addons
          </button>
        </div>
      </div>
    )
  }

  // Dynamic subtitle style classes
  const fontClass =
    subFontSize === 'sm'
      ? 'text-sm sm:text-base'
      : subFontSize === 'lg'
      ? 'text-xl sm:text-2xl'
      : subFontSize === 'xl'
      ? 'text-2xl sm:text-3xl'
      : 'text-base sm:text-xl'

  const colorClass =
    subColor === 'yellow'
      ? 'text-yellow-300'
      : subColor === 'cyan'
      ? 'text-cyan-300'
      : subColor === 'green'
      ? 'text-emerald-300'
      : 'text-white'

  const progressPercent =
    displayDuration > 0 && isFinite(displayDuration)
      ? Math.min(100, Math.max(0, (currentTime / displayDuration) * 100))
      : 0
  const bufferedPercent =
    displayDuration > 0 && isFinite(displayDuration)
      ? Math.min(100, Math.max(0, (buffered / displayDuration) * 100))
      : 0

  const initialVideoSrc = currentSource?.url || undefined

  return (
    <div
      ref={containerRef}
      onMouseMove={handleMouseMove}
      className={`relative w-screen h-screen ${isExoPlayerSupported() ? 'bg-transparent' : 'bg-black'} overflow-hidden select-none cursor-default group`}
      tabIndex={0}
      aria-label="Video Player"
    >
      {/* Video Element (hidden if ExoPlayer native backend is driving playback) */}
      <video
        ref={videoRef}
        src={isExoPlayerSupported() ? undefined : initialVideoSrc}
        className={
          isExoPlayerSupported()
            ? 'hidden'
            : 'w-full h-full object-contain bg-black'
        }
        playsInline
      />

      {/* Interactive Tap / Gesture Surface for Mobile & Desktop */}
      <div
        className="absolute inset-0 z-10 cursor-pointer"
        onClick={handleSurfaceClick}
      />

      {/* Prominent Center Play/Pause Button when Controls are Visible (Netflix/Apple TV+ Mobile Standard) */}
      {controlsVisible && !isPrebuffering && !playbackError && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-20 animate-in fade-in zoom-in-95 duration-200">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation()
              togglePlayPause()
              resetHideTimer()
            }}
            className="pointer-events-auto w-14 h-14 sm:w-18 sm:h-18 rounded-full bg-black/60 hover:bg-black/80 backdrop-blur-xl border border-white/20 text-white flex items-center justify-center transition-all hover:scale-110 active:scale-90 shadow-2xl cursor-pointer"
            aria-label={isPlaying ? 'Pause' : 'Play'}
          >
            {isPlaying ? (
              <svg className="w-6 h-6 sm:w-8 sm:h-8 fill-current" viewBox="0 0 24 24">
                <path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z" />
              </svg>
            ) : (
              <svg className="w-6 h-6 sm:w-8 sm:h-8 fill-current ml-1" viewBox="0 0 24 24">
                <path d="M8 5v14l11-7z" />
              </svg>
            )}
          </button>
        </div>
      )}

      {/* BitTorrent Pre-Buffering Gate Overlay (Living Creature Loom Box Line Effect) */}
      {isPrebuffering && !hasUnlockedPlaybackRef.current && currentTime <= 1 && !playbackError && (
        <div className="absolute inset-0 bg-black/80 backdrop-blur-xl flex flex-col items-center justify-center p-4 z-30 animate-in fade-in duration-300">
          <LoomBoxLoading
            title={title || 'Buffering Stream Chunks'}
            subtitle={
              subtitle ||
              (currentCleanInfo
                ? `${formatStreamPill(
                    currentCleanInfo.resolution,
                    swarmStats?.peers ?? currentCleanInfo.seeders
                  )} · ${currentCleanInfo.quality}`
                : undefined)
            }
            progress={prebufferProgress}
            speed={formatSpeed(swarmStats?.downloadSpeed || 0)}
            peers={swarmStats?.peers ?? currentCleanInfo?.seeders ?? 0}
            downloaded={formatBytes(swarmStats?.downloaded || 0)}
            total="8 MB"
            onChooseOther={() => setDrawerOpen(true)}
            otherCount={sources.length}
            onCancel={onBack}
          />
        </div>
      )}

      {/* Codec / Playback Fallback Overlay */}
      {playbackError && (
        <div className="absolute inset-0 bg-black/90 backdrop-blur-2xl flex flex-col items-center justify-center p-6 text-center z-30 animate-in fade-in duration-200">
          <div className="w-14 h-14 rounded-2xl bg-white/10 border border-white/20 flex items-center justify-center text-2xl mb-4 shadow-xl">
            <svg className="w-7 h-7 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="12" />
              <line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
          </div>
          <h3 className="text-lg font-bold text-white mb-2">Stream Source Unavailable</h3>
          <p className="text-xs text-white/60 max-w-sm mb-6 leading-relaxed">
            This stream codec could not be decoded directly by the browser. Please choose another stream source from the torrent swarm.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-3">
            <button
              type="button"
              onClick={() => {
                setPlaybackError(null)
                setDrawerOpen(true)
              }}
              className="px-6 py-2.5 rounded-full bg-white text-black hover:bg-neutral-200 active:scale-95 text-xs font-bold transition-all shadow-lg cursor-pointer"
            >
              Choose Another Stream ({sources.length})
            </button>
            {onBack && (
              <button
                type="button"
                onClick={onBack}
                className="px-5 py-2.5 rounded-full bg-white/10 hover:bg-white/20 active:scale-95 text-white text-xs font-medium border border-white/15 transition-all cursor-pointer"
              >
                Go Back
              </button>
            )}
          </div>
        </div>
      )}

      {/* Living In-Player Subtitle Overlay (Rendered gracefully with live styling) */}
      {activeCue && (
        <div
          className={`absolute ${
            controlsVisible ? 'bottom-28 sm:bottom-32' : 'bottom-12 sm:bottom-16'
          } left-1/2 -translate-x-1/2 z-25 text-center max-w-[85vw] sm:max-w-[75vw] pointer-events-none transition-all duration-200 ${fontClass} ${colorClass} font-semibold`}
        >
          <span
            className={`inline-block whitespace-pre-line leading-relaxed ${
              subBoxStyle === 'box'
                ? 'bg-black/75 px-4 py-1.5 rounded-2xl backdrop-blur-md shadow-2xl border border-white/10'
                : 'drop-shadow-[0_2px_4px_rgba(0,0,0,0.95)] [text-shadow:0_2px_10px_rgba(0,0,0,0.9)]'
            }`}
          >
            {activeCue.text}
          </span>
        </div>
      )}

      {/* Ripple Animation Indicator in Center */}
      {centerRipple && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-20">
          <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-full bg-black/70 backdrop-blur-md border border-white/20 flex items-center justify-center text-white shadow-2xl animate-ping opacity-85">
            {centerRipple === 'play' && (
              <svg className="w-8 h-8 fill-current ml-1" viewBox="0 0 24 24">
                <path d="M8 5v14l11-7z" />
              </svg>
            )}
            {centerRipple === 'pause' && (
              <svg className="w-8 h-8 fill-current" viewBox="0 0 24 24">
                <path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z" />
              </svg>
            )}
            {centerRipple === 'backward' && (
              <div className="flex flex-col items-center">
                <svg className="w-8 h-8 fill-none stroke-current stroke-2" viewBox="0 0 24 24">
                  <path d="M12 4V1L8 5l4 4V6a6 6 0 1 1-6 6H4a8 8 0 1 0 8-8z" />
                </svg>
                <span className="text-[10px] font-bold font-mono -mt-1">10s</span>
              </div>
            )}
            {centerRipple === 'forward' && (
              <div className="flex flex-col items-center">
                <svg className="w-8 h-8 fill-none stroke-current stroke-2" viewBox="0 0 24 24">
                  <path d="M12 4V1l4 4-4 4V6a6 6 0 1 0 6 6h2a8 8 0 1 1-8-8z" />
                </svg>
                <span className="text-[10px] font-bold font-mono -mt-1">10s</span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* TOP HEADER: Centered Title + Back Navigation */}
      <div
        className={`absolute top-0 left-0 right-0 z-30 transition-opacity duration-300 pointer-events-none ${
          controlsVisible ? 'opacity-100' : 'opacity-0'
        }`}
      >
        <div className="relative flex items-center justify-between px-4 sm:px-8 py-5 sm:py-6 bg-gradient-to-b from-black/80 via-black/40 to-transparent">
          {/* Back Button */}
          <div className="pointer-events-auto">
            {onBack && (
              <button
                type="button"
                onClick={onBack}
                className="w-9 h-9 sm:w-11 sm:h-11 rounded-full bg-[#181818]/80 hover:bg-[#252525]/90 backdrop-blur-xl border border-white/15 text-white flex items-center justify-center transition-all hover:scale-105 active:scale-95 shadow-xl cursor-pointer"
                title="Go Back (Esc)"
                aria-label="Back"
              >
                <svg className="w-5 h-5 fill-none stroke-current stroke-2" viewBox="0 0 24 24">
                  <path d="M19 12H5M12 19l-7-7 7-7" />
                </svg>
              </button>
            )}
          </div>

          {/* Top Centered Content Title & Subtitle */}
          <div className="absolute left-1/2 -translate-x-1/2 text-center max-w-[200px] sm:max-w-xl pointer-events-auto px-2">
            <h1 className="text-xs sm:text-base md:text-lg font-bold text-white tracking-wide font-sans drop-shadow-md truncate">
              {title || 'Now Playing'}
            </h1>
            {subtitle && (
              <p className="text-[10px] sm:text-xs text-white/60 font-medium tracking-normal truncate mt-0.5">
                {subtitle}
              </p>
            )}
          </div>

          <div className="w-8 h-8 sm:w-11 sm:h-11 pointer-events-none" />
        </div>
      </div>

      {/* BOTTOM CONTROL CAPSULE: Living Apple TV+ Bar */}
      <div
        className={`absolute bottom-0 left-0 right-0 z-30 transition-opacity duration-300 pointer-events-none ${
          controlsVisible ? 'opacity-100' : 'opacity-0'
        }`}
      >
        <div className="px-2.5 sm:px-8 pb-3 sm:pb-8 pt-12 sm:pt-16 bg-gradient-to-t from-black/95 via-black/60 to-transparent flex flex-col items-center">
          {/* Timeline Scrubber */}
          <div className="w-full max-w-4xl px-1 sm:px-2 mb-2 sm:mb-3 pointer-events-auto">
            <div
              ref={scrubRailRef}
              onClick={(e) => {
                e.stopPropagation()
                handleRailClick(e.clientX)
              }}
              onMouseDown={(e) => {
                e.stopPropagation()
                setIsScrubbing(true)
                isScrubbingRef.current = true
                handleScrubMove(e.clientX)
              }}
              onTouchStart={(e) => {
                e.stopPropagation()
                setIsScrubbing(true)
                isScrubbingRef.current = true
                if (e.touches.length > 0) handleScrubMove(e.touches[0].clientX)
              }}
              className="relative w-full h-2 sm:h-1.5 hover:h-2.5 bg-white/20 rounded-full cursor-pointer transition-all duration-200 group/timeline flex items-center"
            >
              <div
                className="absolute left-0 top-0 bottom-0 bg-white/30 rounded-full pointer-events-none"
                style={{ width: `${bufferedPercent}%` }}
              />
              <div
                className="absolute left-0 top-0 bottom-0 bg-white rounded-full pointer-events-none"
                style={{ width: `${progressPercent}%` }}
              />
              <div
                className="absolute w-3.5 h-3.5 bg-white rounded-full shadow-lg scale-100 sm:scale-0 sm:group-hover/timeline:scale-100 transition-transform duration-150 pointer-events-none"
                style={{
                  left: `${progressPercent}%`,
                  transform: 'translateX(-50%)',
                }}
              />
            </div>
          </div>

          {/* Living Glass Control Bar */}
          <nav className="pointer-events-auto relative flex items-center justify-between w-full max-w-4xl bg-[#181818]/90 hover:bg-[#1e1e1e]/95 backdrop-blur-3xl border border-white/15 rounded-full px-2 sm:px-5 py-1.5 sm:py-2 shadow-[0_20px_50px_rgba(0,0,0,0.85),0_0_20px_rgba(255,255,255,0.05)] transition-all">
            {/* LEFT CONTROLS: Play/Pause, 10s Rewind/Forward, Volume, Time */}
            <div className="flex items-center gap-1 sm:gap-2">
              <button
                type="button"
                onClick={togglePlayPause}
                className="w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-white text-black flex items-center justify-center transition-all hover:scale-105 active:scale-95 shadow-lg cursor-pointer"
                title={isPlaying ? 'Pause (Space)' : 'Play (Space)'}
                aria-label={isPlaying ? 'Pause' : 'Play'}
              >
                {isPlaying ? (
                  <svg className="w-3.5 h-3.5 sm:w-4 sm:h-4 fill-current" viewBox="0 0 24 24">
                    <path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z" />
                  </svg>
                ) : (
                  <svg className="w-3.5 h-3.5 sm:w-4 sm:h-4 fill-current ml-0.5" viewBox="0 0 24 24">
                    <path d="M8 5v14l11-7z" />
                  </svg>
                )}
              </button>

              <button
                type="button"
                onClick={seekBackward}
                className="w-7 h-7 sm:w-10 sm:h-10 rounded-full bg-white/10 hover:bg-white/20 active:scale-95 text-white flex items-center justify-center transition-all hover:scale-105 cursor-pointer"
                title="10s Backward (J)"
                aria-label="10 seconds backward"
              >
                <svg className="w-3.5 h-3.5 sm:w-5 sm:h-5 fill-none stroke-current stroke-2" viewBox="0 0 24 24">
                  <path d="M12 4V1L8 5l4 4V6a6 6 0 1 1-6 6H4a8 8 0 1 0 8-8z" />
                  <text x="12" y="15" textAnchor="middle" fill="currentColor" stroke="none" fontSize="7" fontWeight="bold" fontFamily="sans-serif">10</text>
                </svg>
              </button>

              <button
                type="button"
                onClick={seekForward}
                className="w-7 h-7 sm:w-10 sm:h-10 rounded-full bg-white/10 hover:bg-white/20 active:scale-95 text-white flex items-center justify-center transition-all hover:scale-105 cursor-pointer"
                title="10s Forward (L)"
                aria-label="10 seconds forward"
              >
                <svg className="w-3.5 h-3.5 sm:w-5 sm:h-5 fill-none stroke-current stroke-2" viewBox="0 0 24 24">
                  <path d="M12 4V1l4 4-4 4V6a6 6 0 1 0 6 6h2a8 8 0 1 1-8-8z" />
                  <text x="12" y="15" textAnchor="middle" fill="currentColor" stroke="none" fontSize="7" fontWeight="bold" fontFamily="sans-serif">10</text>
                </svg>
              </button>

              <div className="flex items-center gap-1 group/volume">
                <button
                  type="button"
                  onClick={toggleMute}
                  className="w-7 h-7 sm:w-10 sm:h-10 rounded-full bg-white/10 hover:bg-white/20 active:scale-95 text-white flex items-center justify-center transition-all hover:scale-105 cursor-pointer"
                  title={isMuted ? 'Unmute (M)' : 'Mute (M)'}
                  aria-label={isMuted ? 'Unmute' : 'Mute'}
                >
                  {isMuted || volume === 0 ? (
                    <svg className="w-4 h-4 sm:w-5 sm:h-5 fill-current" viewBox="0 0 24 24">
                      <path d="M16.5 12c0-1.77-1.02-3.29-2.5-4.03v2.21l2.45 2.45c.03-.2.05-.41.05-.63zm2.5 0c0 .94-.2 1.82-.54 2.64l1.51 1.51C20.63 14.91 21 13.5 21 12c0-4.28-2.99-7.86-7-8.77v2.06c2.89.86 5 3.54 5 6.71zM4.27 3L3 4.27 7.73 9H3v6h4l5 5v-6.73l4.25 4.25c-.67.52-1.42.93-2.25 1.18v2.06c1.38-.31 2.63-.95 3.69-1.81L19.73 21 21 19.73l-9-9L4.27 3zM12 4L9.91 6.09 12 8.18V4z" />
                    </svg>
                  ) : (
                    <svg className="w-4 h-4 sm:w-5 sm:h-5 fill-current" viewBox="0 0 24 24">
                      <path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z" />
                    </svg>
                  )}
                </button>

                <input
                  type="range"
                  min={0}
                  max={1}
                  step={0.05}
                  value={isMuted ? 0 : volume}
                  onChange={(e) => handleVolumeChange(Number(e.target.value))}
                  className="hidden sm:block w-0 group-hover/volume:w-16 sm:group-hover/volume:w-20 transition-all duration-300 accent-white cursor-pointer opacity-0 group-hover/volume:opacity-100 h-1 bg-white/20 rounded-lg"
                  aria-label="Volume"
                />
              </div>

              <div className="text-[10px] sm:text-xs md:text-sm font-medium font-mono text-white/80 tabular-nums ml-0.5 sm:ml-1 whitespace-nowrap">
                <span>{formatTime(currentTime)}</span>
                <span className="text-white/40 mx-0.5 sm:mx-1">/</span>
                <span className="text-white/50">{formatTime(displayDuration)}</span>
              </div>
            </div>

            {/* RIGHT CONTROLS: Desktop Multi-Button Bar + Mobile Clean 3-Dot Group */}
            <div className="flex items-center gap-1.5 sm:gap-2.5">
              {/* DESKTOP ONLY: Streams Selector, Audio Tracks, OpenSubtitles, Rotate & Fullscreen */}
              <div className="hidden sm:flex items-center gap-2">
                {/* Streams Button */}
                <button
                  type="button"
                  onClick={() => setDrawerOpen(!drawerOpen)}
                  className={`h-10 px-3.5 rounded-full flex items-center gap-1.5 transition-all hover:scale-105 active:scale-95 cursor-pointer ${
                    drawerOpen
                      ? 'bg-white text-black font-bold shadow-xl'
                      : 'bg-white/10 hover:bg-white/20 text-white'
                  }`}
                  title="Available Streams (S)"
                  aria-label="Stream Sources"
                  aria-expanded={drawerOpen}
                >
                  <svg className="w-4 h-4 fill-none stroke-current stroke-2" viewBox="0 0 24 24">
                    <path d="M4 11a9 9 0 0 1 9 9M4 4a16 16 0 0 1 16 16" />
                    <circle cx="5" cy="19" r="1" />
                  </svg>
                  <span className="text-xs font-semibold tracking-wide font-mono">
                    {currentCleanInfo
                      ? formatStreamPill(
                          currentCleanInfo.resolution,
                          swarmStats?.peers ?? currentCleanInfo.seeders
                        )
                      : 'Streams'}
                  </span>
                </button>

                {/* Desktop Audio Tracks Popover Menu */}
                <div className="relative" ref={audioDropdownRef}>
                  <button
                    type="button"
                    onClick={() => setAudioMenuOpen(!audioMenuOpen)}
                    className={`w-10 h-10 rounded-full flex items-center justify-center transition-all hover:scale-105 active:scale-95 cursor-pointer ${
                      audioMenuOpen
                        ? 'bg-white text-black font-bold shadow-lg'
                        : 'bg-white/10 hover:bg-white/20 text-white'
                    }`}
                    title="Audio Tracks (A)"
                    aria-label="Audio Tracks"
                  >
                    <svg className="w-4 h-4 fill-current" viewBox="0 0 24 24">
                      <path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z" />
                    </svg>
                  </button>

                  {audioMenuOpen && (
                    <div className="absolute right-0 bottom-14 w-72 max-h-64 overflow-y-auto bg-[#161618]/95 backdrop-blur-2xl border border-white/20 rounded-3xl shadow-2xl p-2 z-50 text-white animate-in fade-in zoom-in-95 duration-150">
                      <div className="px-3 py-2 border-b border-white/10 text-xs font-bold text-white/60 uppercase tracking-wider flex items-center justify-between">
                        <span>Audio Tracks</span>
                        <span className="text-[10px] font-mono bg-white/10 px-2 py-0.5 rounded-full">{audioTracks.length}</span>
                      </div>
                      <div className="py-1 divide-y divide-white/5">
                        {audioTracks.map((trk) => {
                          const isSelected = trk.selected || trk.id === selectedAudioTrack
                          return (
                            <button
                              key={trk.id}
                              type="button"
                              onClick={() => {
                                handleSelectAudioTrack(trk.id)
                                setAudioMenuOpen(false)
                              }}
                              className={`w-full flex items-center justify-between px-3 py-2.5 text-xs rounded-xl transition-colors cursor-pointer text-left ${
                                isSelected ? 'bg-white/15 text-white font-bold' : 'text-white/70 hover:bg-white/10'
                              }`}
                            >
                              <div className="truncate pr-2">
                                <span className="font-semibold">{trk.label}</span>
                                {trk.language && trk.language !== 'und' && (
                                  <span className="ml-2 text-[10px] uppercase font-mono px-1.5 py-0.5 rounded bg-white/10 text-white/60">
                                    {trk.language}
                                  </span>
                                )}
                              </div>
                              {isSelected && <span className="text-white font-bold shrink-0">✓</span>}
                            </button>
                          )
                        })}
                      </div>
                    </div>
                  )}
                </div>

                {/* Subtitles & Styling Popover Menu (CC) */}
                <div className="relative" ref={subtitleDropdownRef}>
                  <button
                    type="button"
                    onClick={() => setSubtitleMenuOpen(!subtitleMenuOpen)}
                    className={`w-10 h-10 rounded-full flex items-center justify-center transition-all hover:scale-105 active:scale-95 cursor-pointer ${
                      selectedSubId !== 'off'
                        ? 'bg-white text-black font-bold shadow-lg'
                        : 'bg-white/10 hover:bg-white/20 text-white'
                    }`}
                    title="Subtitles & Styling (C)"
                    aria-label="Subtitles"
                    aria-expanded={subtitleMenuOpen}
                  >
                    <svg className="w-5 h-5 fill-current" viewBox="0 0 24 24">
                      <path d="M19 4H5c-1.11 0-2 .9-2 2v12c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm-8 7H9.5v-.5h-2v3h2V13H11v1c0 .55-.45 1-1 1H7c-.55 0-1-.45-1-1v-4c0-.55.45-1 1-1h3c.55 0 1 .45 1 1v1zm7 0h-1.5v-.5h-2v3h2V13H18v1c0 .55-.45 1-1 1h-3c-.55 0-1-.45-1-1v-4c0-.55.45-1 1-1h3c.55 0 1 .45 1 1v1z" />
                    </svg>
                  </button>

                  {subtitleMenuOpen && (
                    <div className="absolute right-0 bottom-14 w-80 max-h-96 overflow-y-auto bg-[#161618]/95 backdrop-blur-2xl border border-white/20 rounded-3xl shadow-2xl overflow-hidden z-50 animate-in fade-in zoom-in-95 duration-150 text-white">
                      {/* Subtitle Tabs Header */}
                      <div className="flex items-center border-b border-white/10 bg-white/[0.02]">
                        <button
                          type="button"
                          onClick={() => setSubTab('tracks')}
                          className={`flex-1 py-2.5 text-xs font-semibold text-center transition-colors cursor-pointer ${
                            subTab === 'tracks'
                              ? 'text-white border-b-2 border-white font-bold bg-white/5'
                              : 'text-white/50 hover:text-white'
                          }`}
                        >
                          Subtitles ({subtitlesList.length})
                        </button>
                        <button
                          type="button"
                          onClick={() => setSubTab('style')}
                          className={`flex-1 py-2.5 text-xs font-semibold text-center transition-colors cursor-pointer ${
                            subTab === 'style'
                              ? 'text-white border-b-2 border-white font-bold bg-white/5'
                              : 'text-white/50 hover:text-white'
                          }`}
                        >
                          Styling & Sync
                        </button>
                      </div>

                      {/* Tab 1: Tracks List */}
                      {subTab === 'tracks' ? (
                        <div className="max-h-64 overflow-y-auto py-1 divide-y divide-white/5">
                          <button
                            type="button"
                            onClick={() => handleSelectSubtitle('off')}
                            className={`w-full flex items-center justify-between px-4 py-2 text-xs transition-colors cursor-pointer ${
                              selectedSubId === 'off'
                                ? 'bg-white/15 text-white font-bold'
                                : 'text-white/70 hover:text-white hover:bg-white/10'
                            }`}
                          >
                            <span>Off</span>
                            {selectedSubId === 'off' && <span className="text-white">✓</span>}
                          </button>

                          {subtitlesList.map((sub) => {
                            const isSelected = selectedSubId === sub.id
                            const langName = LANGUAGE_LABELS[sub.lang] || sub.lang.toUpperCase()
                            const tag = sub.releaseGroup || (sub.subtitleFileName?.includes('SDH') ? 'SDH' : '')

                            return (
                              <button
                                key={sub.id}
                                type="button"
                                onClick={() => handleSelectSubtitle(sub)}
                                className={`w-full flex items-center justify-between px-4 py-2.5 text-xs transition-colors cursor-pointer text-left ${
                                  isSelected
                                    ? 'bg-white/15 text-white font-bold'
                                    : 'text-white/70 hover:text-white hover:bg-white/10'
                                }`}
                              >
                                <div className="truncate pr-2">
                                  <span className="font-semibold">{langName}</span>
                                  {tag && (
                                    <span className="ml-2 text-[10px] px-1.5 py-0.5 rounded bg-white/10 text-white/60 font-mono">
                                      {tag}
                                    </span>
                                  )}
                                </div>
                                {isSelected && <span className="text-white shrink-0 font-bold">✓</span>}
                              </button>
                            )
                          })}
                        </div>
                      ) : (
                        /* Tab 2: Subtitle Styling & Sync Adjustment */
                        <div className="p-4 space-y-3.5 text-xs">
                          {/* Font Size */}
                          <div>
                            <p className="text-[11px] text-white/50 mb-1.5 font-medium">Text Size</p>
                            <div className="grid grid-cols-4 gap-1.5">
                              {(['sm', 'md', 'lg', 'xl'] as const).map((sz) => (
                                <button
                                  key={sz}
                                  type="button"
                                  onClick={() => setSubFontSize(sz)}
                                  className={`py-1 rounded-xl font-bold uppercase transition-all cursor-pointer ${
                                    subFontSize === sz
                                      ? 'bg-white text-black'
                                      : 'bg-white/5 hover:bg-white/10 text-white/70 border border-white/10'
                                  }`}
                                >
                                  {sz}
                                </button>
                              ))}
                            </div>
                          </div>

                          {/* Text Color */}
                          <div>
                            <p className="text-[11px] text-white/50 mb-1.5 font-medium">Text Color</p>
                            <div className="flex items-center gap-2">
                              {[
                                { id: 'white', bg: 'bg-white' },
                                { id: 'yellow', bg: 'bg-yellow-400' },
                                { id: 'cyan', bg: 'bg-sky-400' },
                                { id: 'green', bg: 'bg-emerald-400' },
                              ].map((c) => (
                                <button
                                  key={c.id}
                                  type="button"
                                  onClick={() => setSubColor(c.id as any)}
                                  className={`w-7 h-7 rounded-full ${c.bg} transition-all cursor-pointer flex items-center justify-center ${
                                    subColor === c.id ? 'ring-2 ring-white ring-offset-2 ring-offset-black scale-110' : 'opacity-80 hover:opacity-100'
                                  }`}
                                />
                              ))}
                            </div>
                          </div>

                          {/* Box Style */}
                          <div>
                            <p className="text-[11px] text-white/50 mb-1.5 font-medium">Backdrop Style</p>
                            <div className="grid grid-cols-2 gap-2">
                              <button
                                type="button"
                                onClick={() => setSubBoxStyle('box')}
                                className={`py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                                  subBoxStyle === 'box'
                                    ? 'bg-white text-black font-bold'
                                    : 'bg-white/5 hover:bg-white/10 text-white/70 border border-white/10'
                                }`}
                              >
                                Translucent Box
                              </button>
                              <button
                                type="button"
                                onClick={() => setSubBoxStyle('glow')}
                                className={`py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                                  subBoxStyle === 'glow'
                                    ? 'bg-white text-black font-bold'
                                    : 'bg-white/5 hover:bg-white/10 text-white/70 border border-white/10'
                                }`}
                              >
                                Text Shadow Only
                              </button>
                            </div>
                          </div>

                          {/* Timing Offset Sync */}
                          <div>
                            <div className="flex items-center justify-between mb-1.5">
                              <p className="text-[11px] text-white/50 font-medium">Audio Sync Offset</p>
                              <span className="font-mono text-white/80 font-bold">
                                {subOffset > 0 ? `+${subOffset.toFixed(1)}s` : `${subOffset.toFixed(1)}s`}
                              </span>
                            </div>
                            <div className="flex items-center gap-1.5">
                              <button
                                type="button"
                                onClick={() => setSubOffset((o) => parseFloat((o - 0.5).toFixed(1)))}
                                className="flex-1 py-1 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-semibold transition-all cursor-pointer"
                              >
                                -0.5s
                              </button>
                              <button
                                type="button"
                                onClick={() => setSubOffset(0)}
                                className="px-3 py-1 rounded-xl bg-white/5 hover:bg-white/10 text-white/60 text-xs font-medium transition-all cursor-pointer"
                              >
                                Reset
                              </button>
                              <button
                                type="button"
                                onClick={() => setSubOffset((o) => parseFloat((o + 0.5).toFixed(1)))}
                                className="flex-1 py-1 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-semibold transition-all cursor-pointer"
                              >
                                +0.5s
                              </button>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Rotate Screen Button (Desktop/Tablet) */}
                <button
                  type="button"
                  onClick={toggleOrientation}
                  className="w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 active:scale-95 text-white flex items-center justify-center transition-all hover:scale-105 cursor-pointer"
                  title="Rotate Screen (R)"
                  aria-label="Rotate Screen"
                >
                  <svg className="w-4 h-4 fill-none stroke-current stroke-2" viewBox="0 0 24 24">
                    <path d="M4 12a8 8 0 0 1 14.93-4M20 12a8 8 0 0 1-14.93 4" />
                    <polyline points="20 4 20 8 16 8" />
                    <polyline points="4 20 4 16 8 16" />
                  </svg>
                </button>

                {/* Fullscreen Button */}
                <button
                  type="button"
                  onClick={toggleFullscreen}
                  className="w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 active:scale-95 text-white flex items-center justify-center transition-all hover:scale-105 cursor-pointer"
                  title={isFullscreen ? 'Exit Fullscreen (F)' : 'Fullscreen (F)'}
                  aria-label={isFullscreen ? 'Exit Fullscreen' : 'Fullscreen'}
                >
                  {isFullscreen ? (
                    <svg className="w-5 h-5 fill-current" viewBox="0 0 24 24">
                      <path d="M5 16h3v3h2v-5H5v2zm3-8H5v2h5V5H8v3zm6 11h2v-3h3v-2h-5v5zm2-11V5h-2v5h5V8h-3z" />
                    </svg>
                  ) : (
                    <svg className="w-5 h-5 fill-current" viewBox="0 0 24 24">
                      <path d="M7 14H5v5h5v-2H7v-3zm-2-4h2V7h3V5H5v5zm12 7h-3v2h5v-5h-2v3zM14 5v2h3v3h2V5h-5z" />
                    </svg>
                  )}
                </button>
              </div>

              {/* MOBILE ONLY: Quick Rotate & Sleek 3-Dot Options Capsule */}
              <div className="sm:hidden flex items-center gap-1.5">
                {/* Rotate Screen Button (Mobile) */}
                <button
                  type="button"
                  onClick={toggleOrientation}
                  className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 active:scale-95 text-white flex items-center justify-center transition-all cursor-pointer"
                  title="Rotate Screen"
                  aria-label="Rotate Screen"
                >
                  <svg className="w-4 h-4 fill-none stroke-current stroke-2" viewBox="0 0 24 24">
                    <path d="M4 12a8 8 0 0 1 14.93-4M20 12a8 8 0 0 1-14.93 4" />
                    <polyline points="20 4 20 8 16 8" />
                    <polyline points="4 20 4 16 8 16" />
                  </svg>
                </button>

                {/* 3-Dot Menu Button (Mobile) */}
                <button
                  type="button"
                  onClick={() => setMobileMenuOpen(true)}
                  className={`w-8 h-8 rounded-full flex items-center justify-center transition-all active:scale-95 cursor-pointer ${
                    mobileMenuOpen
                      ? 'bg-white text-black font-bold shadow-lg'
                      : 'bg-white/10 hover:bg-white/20 text-white'
                  }`}
                  title="Playback Options"
                  aria-label="Playback Options"
                  aria-expanded={mobileMenuOpen}
                >
                  <svg className="w-4 h-4 fill-current" viewBox="0 0 24 24">
                    <circle cx="5" cy="12" r="2" />
                    <circle cx="12" cy="12" r="2" />
                    <circle cx="19" cy="12" r="2" />
                  </svg>
                </button>
              </div>
            </div>
          </nav>
        </div>
      </div>

      {/* MOBILE 3-DOT PLAYBACK SHEET: Beautifully organized Audio Tracks, Subtitles, Streams & Rotation */}
      {mobileMenuOpen && (
        <div
          className="fixed inset-0 z-50 bg-black/75 backdrop-blur-md flex justify-end items-end sm:hidden animate-in fade-in duration-200"
          onClick={(e) => {
            if (e.target === e.currentTarget) setMobileMenuOpen(false)
          }}
        >
          <div className="relative w-full max-h-[82vh] bg-[#141416]/98 backdrop-blur-3xl border-t border-white/20 rounded-t-3xl shadow-[0_-10px_40px_rgba(0,0,0,0.9)] flex flex-col text-white animate-in slide-in-from-bottom duration-300">
            {/* Notch */}
            <div className="pt-3 pb-1 flex justify-center">
              <div className="w-10 h-1 bg-white/25 rounded-full" />
            </div>

            {/* Header */}
            <div className="px-5 py-3 border-b border-white/10 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-sm font-bold text-white tracking-wide">Playback Options</span>
              </div>
              <button
                type="button"
                onClick={() => setMobileMenuOpen(false)}
                className="w-7 h-7 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white text-xs font-bold"
                aria-label="Close"
              >
                ✕
              </button>
            </div>

            {/* Segmented Control Tabs */}
            <div className="flex items-center border-b border-white/10 bg-white/[0.03] p-1.5 gap-1 mx-4 my-2.5 rounded-2xl">
              <button
                type="button"
                onClick={() => setMobileTab('audio')}
                className={`flex-1 py-2 text-xs font-bold rounded-xl flex items-center justify-center gap-1.5 transition-all ${
                  mobileTab === 'audio' ? 'bg-white text-black shadow-md' : 'text-white/60 hover:text-white'
                }`}
              >
                <svg className="w-3.5 h-3.5 fill-current" viewBox="0 0 24 24">
                  <path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z" />
                </svg>
                <span>Audio ({audioTracks.length})</span>
              </button>

              <button
                type="button"
                onClick={() => setMobileTab('subtitles')}
                className={`flex-1 py-2 text-xs font-bold rounded-xl flex items-center justify-center gap-1.5 transition-all ${
                  mobileTab === 'subtitles' ? 'bg-white text-black shadow-md' : 'text-white/60 hover:text-white'
                }`}
              >
                <svg className="w-3.5 h-3.5 fill-current" viewBox="0 0 24 24">
                  <path d="M19 4H5c-1.11 0-2 .9-2 2v12c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm-8 7H9.5v-.5h-2v3h2V13H11v1c0 .55-.45 1-1 1H7c-.55 0-1-.45-1-1v-4c0-.55.45-1 1-1h3c.55 0 1 .45 1 1v1zm7 0h-1.5v-.5h-2v3h2V13H18v1c0 .55-.45 1-1 1h-3c-.55 0-1-.45-1-1v-4c0-.55.45-1 1-1h3c.55 0 1 .45 1 1v1z" />
                </svg>
                <span>Subtitles</span>
              </button>

              <button
                type="button"
                onClick={() => setMobileTab('streams')}
                className={`flex-1 py-2 text-xs font-bold rounded-xl flex items-center justify-center gap-1.5 transition-all ${
                  mobileTab === 'streams' ? 'bg-white text-black shadow-md' : 'text-white/60 hover:text-white'
                }`}
              >
                <svg className="w-3.5 h-3.5 fill-none stroke-current stroke-2" viewBox="0 0 24 24">
                  <path d="M4 11a9 9 0 0 1 9 9M4 4a16 16 0 0 1 16 16" />
                  <circle cx="5" cy="19" r="1" />
                </svg>
                <span>Streams ({sources.length})</span>
              </button>
            </div>

            {/* Tab Body */}
            <div className="flex-1 overflow-y-auto px-4 py-2">
              {/* Tab 1: Audio Tracks */}
              {mobileTab === 'audio' && (
                <div className="space-y-1 divide-y divide-white/5">
                  {audioTracks.map((trk) => {
                    const isSelected = trk.selected || trk.id === selectedAudioTrack
                    return (
                      <button
                        key={trk.id}
                        type="button"
                        onClick={() => handleSelectAudioTrack(trk.id)}
                        className={`w-full flex items-center justify-between p-3 rounded-2xl text-left transition-all ${
                          isSelected ? 'bg-white/15 text-white font-bold' : 'text-white/70 hover:bg-white/5'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center text-white/80">
                            <svg className="w-4 h-4 fill-current" viewBox="0 0 24 24">
                              <path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z" />
                            </svg>
                          </div>
                          <div>
                            <p className="text-xs font-semibold">{trk.label}</p>
                            {trk.language && (
                              <p className="text-[10px] text-white/50 uppercase font-mono">{trk.language}</p>
                            )}
                          </div>
                        </div>
                        {isSelected && <span className="text-white font-bold text-sm">✓</span>}
                      </button>
                    )
                  })}
                </div>
              )}

              {/* Tab 2: Subtitles */}
              {mobileTab === 'subtitles' && (
                <div className="space-y-2">
                  <button
                    type="button"
                    onClick={() => handleSelectSubtitle('off')}
                    className={`w-full flex items-center justify-between p-3 rounded-2xl text-left transition-all ${
                      selectedSubId === 'off' ? 'bg-white/15 text-white font-bold' : 'text-white/70 hover:bg-white/5'
                    }`}
                  >
                    <span className="text-xs font-semibold">Subtitles Off</span>
                    {selectedSubId === 'off' && <span className="text-white font-bold">✓</span>}
                  </button>

                  <div className="divide-y divide-white/5">
                    {subtitlesList.map((sub) => {
                      const isSelected = selectedSubId === sub.id
                      const langName = LANGUAGE_LABELS[sub.lang] || sub.lang.toUpperCase()
                      const tag = sub.releaseGroup || (sub.subtitleFileName?.includes('SDH') ? 'SDH' : '')

                      return (
                        <button
                          key={sub.id}
                          type="button"
                          onClick={() => handleSelectSubtitle(sub)}
                          className={`w-full flex items-center justify-between p-3 rounded-2xl text-left transition-all ${
                            isSelected ? 'bg-white/15 text-white font-bold' : 'text-white/70 hover:bg-white/5'
                          }`}
                        >
                          <div className="truncate pr-2">
                            <span className="text-xs font-semibold">{langName}</span>
                            {tag && (
                              <span className="ml-2 text-[10px] px-1.5 py-0.5 rounded bg-white/10 text-white/60 font-mono">
                                {tag}
                              </span>
                            )}
                          </div>
                          {isSelected && <span className="text-white font-bold text-sm shrink-0">✓</span>}
                        </button>
                      )
                    })}
                  </div>
                </div>
              )}

              {/* Tab 3: Streams */}
              {mobileTab === 'streams' && (
                <div className="space-y-2">
                  {filteredSources.map((src, idx) => {
                    const info = parseStreamClean(src, title)
                    const realIndex = sources.indexOf(src)
                    const isSelected = realIndex >= 0 ? realIndex === sourceIndex : idx === sourceIndex

                    return (
                      <div
                        key={idx}
                        onClick={() => {
                          setSourceIndex(realIndex >= 0 ? realIndex : idx)
                          setPlaybackError(null)
                          setMobileMenuOpen(false)
                        }}
                        className={`flex items-center justify-between p-3 rounded-2xl transition-all cursor-pointer border ${
                          isSelected
                            ? 'bg-white/[0.14] border-white/40 shadow-lg'
                            : 'bg-white/[0.03] hover:bg-white/[0.07] border-white/10'
                        }`}
                      >
                        <div className="space-y-1 pr-2 min-w-0">
                          <div className="flex items-center gap-1.5">
                            <span
                              className={`text-[9px] font-bold px-1.5 py-0.5 rounded font-mono ${
                                info.resolution.includes('4K')
                                  ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30'
                                  : 'bg-white/15 text-white/90 border border-white/20'
                              }`}
                            >
                              {formatStreamPill(info.resolution, info.seeders)}
                            </span>
                            <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded bg-white/10 text-white/70">
                              {info.quality}
                            </span>
                          </div>
                          <p className="text-xs font-medium text-white/90 leading-snug break-words whitespace-normal py-0.5">
                            {info.cleanTitle}
                          </p>
                        </div>
                        <div className="shrink-0">
                          {isSelected ? (
                            <span className="px-2.5 py-1 rounded-full bg-white text-black text-[10px] font-bold">
                              Active
                            </span>
                          ) : (
                            <span className="w-7 h-7 rounded-full bg-white/10 text-white/80 flex items-center justify-center text-xs">
                              ▶
                            </span>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>

            {/* Quick Rotate to Horizontal View Button */}
            <div className="p-3 border-t border-white/10 bg-black/40">
              <button
                type="button"
                onClick={() => {
                  toggleOrientation()
                  setMobileMenuOpen(false)
                }}
                className="w-full py-2.5 rounded-2xl bg-white/10 hover:bg-white/20 active:scale-98 text-white font-semibold text-xs flex items-center justify-center gap-2 transition-all cursor-pointer"
              >
                <svg className="w-4 h-4 fill-none stroke-current stroke-2" viewBox="0 0 24 24">
                  <path d="M4 12a8 8 0 0 1 14.93-4M20 12a8 8 0 0 1-14.93 4" />
                  <polyline points="20 4 20 8 16 8" />
                  <polyline points="4 20 4 16 8 16" />
                </svg>
                <span>{isLandscape ? 'Switch to Vertical View' : 'Rotate to Horizontal View'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MINIMALIST LIVING CREATURE TORRENT PANEL (No Messy Description, Responsive Mobile Bottom Sheet / Desktop Drawer) */}
      {drawerOpen && (
        <div
          className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex justify-end items-end sm:items-stretch animate-in fade-in duration-200"
          onClick={(e) => {
            if (e.target === e.currentTarget) setDrawerOpen(false)
          }}
        >
          <div className="relative w-full sm:w-[380px] md:w-[420px] max-h-[85vh] sm:max-h-full sm:h-full bg-[#141416]/96 backdrop-blur-3xl border-t sm:border-t-0 sm:border-l border-white/15 rounded-t-3xl sm:rounded-none shadow-[0_0_60px_rgba(0,0,0,0.95)] flex flex-col text-white animate-in slide-in-from-bottom sm:slide-in-from-right duration-300">
            {/* Mobile Drag Indicator Bar */}
            <div className="sm:hidden pt-3 pb-1 flex justify-center">
              <div className="w-12 h-1 bg-white/30 rounded-full" />
            </div>

            {/* Header */}
            <div className="px-5 py-4 border-b border-white/10 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-6 h-6 rounded-lg bg-white/10 border border-white/20 flex items-center justify-center p-0.5 overflow-hidden">
                  <img
                    src="/endless-stream-icon.svg"
                    alt="Endless Stream"
                    className="w-full h-full object-contain"
                  />
                </div>
                <h2 className="text-sm font-bold tracking-tight text-white font-sans uppercase">
                  Endless Streams
                </h2>
                <span className="text-[10px] font-mono font-semibold px-2 py-0.5 rounded-full bg-white/10 text-white/70 border border-white/15">
                  {sources.length} sources
                </span>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setDrawerOpen(false)}
                  className="w-7 h-7 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white text-xs font-bold transition-all cursor-pointer border border-white/15"
                  aria-label="Close"
                >
                  ✕
                </button>
              </div>
            </div>

            {/* Filter Pills */}
            <div className="flex items-center gap-1.5 px-5 py-2.5 border-b border-white/10 bg-white/[0.02]">
              {(
                [
                  { id: 'all', label: 'All' },
                  { id: '4k', label: '4K UHD' },
                  { id: '1080p', label: '1080p' },
                ] as const
              ).map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setDrawerFilter(tab.id)}
                  className={`px-3 py-1 rounded-full text-xs font-semibold transition-all cursor-pointer ${
                    drawerFilter === tab.id
                      ? 'bg-white text-black shadow-md'
                      : 'bg-white/5 hover:bg-white/10 text-white/60 border border-white/10'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Clean Stream List */}
            <div className="flex-1 overflow-y-auto px-4 py-3 space-y-2">
              {filteredSources.map((src, idx) => {
                const info = parseStreamClean(src, title)
                const realIndex = sources.indexOf(src)
                const isSelected = realIndex >= 0 ? realIndex === sourceIndex : idx === sourceIndex

                return (
                  <div
                    key={idx}
                    onClick={() => {
                      setSourceIndex(realIndex >= 0 ? realIndex : idx)
                      setPlaybackError(null)
                      setDrawerOpen(false)
                    }}
                    className={`group flex items-center justify-between p-3 rounded-2xl transition-all cursor-pointer border ${
                      isSelected
                        ? 'bg-white/[0.14] border-white/40 shadow-[0_0_20px_rgba(255,255,255,0.08)]'
                        : 'bg-white/[0.03] hover:bg-white/[0.07] border-white/10 hover:border-white/25'
                    }`}
                  >
                    {/* Left: Badges + Clean Title + Seeders/Size */}
                    <div className="space-y-1 pr-2 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span
                          className={`text-[9px] font-bold px-1.5 py-0.5 rounded font-mono ${
                            info.resolution.includes('4K')
                              ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30'
                              : 'bg-white/15 text-white/90 border border-white/20'
                          }`}
                        >
                          {formatStreamPill(info.resolution, info.seeders)}
                        </span>

                        <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded bg-white/10 text-white/70">
                          {info.quality}
                        </span>

                        {info.hdr.map((h) => (
                          <span
                            key={h}
                            className="text-[9px] font-semibold px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-300"
                          >
                            {h}
                          </span>
                        ))}
                      </div>

                      <p className="text-xs font-medium text-white/90 leading-snug break-words whitespace-normal py-0.5">
                        {info.cleanTitle}
                      </p>

                      <p className="text-[10px] text-white/40 font-mono">
                        {info.seeders !== undefined && (
                          <span className="text-emerald-400 font-semibold">{info.seeders}P</span>
                        )}
                        {info.seeders !== undefined && info.size && <span className="mx-1">·</span>}
                        {info.size && <span>{info.size}</span>}
                      </p>
                    </div>

                    {/* Right: Clean Play Pill */}
                    <div className="shrink-0">
                      {isSelected ? (
                        <span className="px-2.5 py-1 rounded-full bg-white text-black text-[11px] font-bold shadow-md">
                          Playing
                        </span>
                      ) : (
                        <span className="w-8 h-8 rounded-full bg-white/10 group-hover:bg-white group-hover:text-black text-white/80 flex items-center justify-center text-xs transition-all">
                          ▶
                        </span>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
