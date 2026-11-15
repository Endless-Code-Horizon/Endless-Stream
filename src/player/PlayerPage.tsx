import { useRef, useCallback } from 'react'
import { useParams, useSearchParams, useNavigate } from 'react-router-dom'
import { useStreams, useMeta } from '@/data'
import { useProfileStore } from '@/profiles/profileStore'
import { useProgressStore } from '@/profiles/progressStore'
import { VideoPlayer } from './VideoPlayer'
import { LoomBoxLoading } from './LoomBoxLoading'
import type { MediaType } from '@/types'

export function PlayerPage() {
  const { type, id } = useParams<{ type: string; id: string }>()
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()

  const mediaType = (type === 'series' ? 'series' : 'movie') as MediaType
  const mediaId = id || ''
  const seasonParam = searchParams.get('s')
  const episodeParam = searchParams.get('e')
  const episodeRef =
    seasonParam && episodeParam
      ? { season: Number(seasonParam), episode: Number(episodeParam) }
      : undefined

  const activeProfile = useProfileStore((s) => s.getActiveProfile())
  const { getProgress, saveProgress } = useProgressStore()

  const { data: media } = useMeta(mediaType, mediaId)
  const { data: streams, loading: streamsLoading } = useStreams(
    mediaType,
    mediaId,
    episodeRef
  )

  // Subtitle string for Top Centered Title
  const currentEpisode = episodeRef && media?.seasons
    ? media.seasons
        .find((s) => s.season === episodeRef.season)
        ?.episodes.find((e) => e.episode === episodeRef.episode)
    : null

  const displaySubtitle = episodeRef
    ? `Season ${episodeRef.season}, Episode ${episodeRef.episode}${currentEpisode?.title ? ` · ${currentEpisode.title}` : ''}`
    : media?.year
    ? `${media.year} · 4K Ultra HD`
    : undefined

  // Calculate expected runtime duration in seconds from metadata (e.g. 52m = 3120s)
  const expectedDuration = media?.runtime
    ? media.runtime * 60
    : mediaType === 'series'
    ? 50 * 60
    : 105 * 60

  // Saved resume time: if user previously finished, was within last 30s, or > 90% through, start clean from 0
  const savedProgress = activeProfile
    ? getProgress(activeProfile.id, mediaId, episodeRef)
    : null
  const rawStartTime = savedProgress ? savedProgress.currentTime : 0
  const effectiveSavedDuration =
    savedProgress?.duration && savedProgress.duration > 10
      ? savedProgress.duration
      : expectedDuration

  const isFinished =
    !rawStartTime ||
    rawStartTime <= 0 ||
    rawStartTime >= effectiveSavedDuration - 30 ||
    rawStartTime >= effectiveSavedDuration * 0.9

  const startTime = isFinished ? 0 : rawStartTime

  const lastSavedRef = useRef<number>(0)

  // Save progress periodically (throttled to once every 5 seconds)
  const handleTimeUpdate = useCallback((currentTime: number, duration: number) => {
    if (!activeProfile || duration <= 0) return
    const now = Date.now()
    if (now - lastSavedRef.current < 5000) return
    lastSavedRef.current = now

    // If watched to > 90% or within last 30s, mark completed by clearing progress
    if (currentTime >= duration - 30 || currentTime >= duration * 0.9) {
      removeProgress(activeProfile.id, mediaId, episodeRef)
      return
    }

    saveProgress(activeProfile.id, {
      mediaId,
      mediaType,
      title: media?.title || 'Unknown Title',
      poster: media?.poster,
      backdrop: media?.backdrop,
      currentTime,
      duration,
      episode: episodeRef,
    })
  }, [activeProfile, mediaId, mediaType, media?.title, media?.poster, media?.backdrop, episodeRef, saveProgress, removeProgress])

  const handleEnded = useCallback(() => {
    if (activeProfile) {
      removeProgress(activeProfile.id, mediaId, episodeRef)
    }
  }, [activeProfile, mediaId, episodeRef, removeProgress])

  if (streamsLoading) {
    return (
      <div className="relative w-screen h-screen bg-black overflow-hidden flex flex-col items-center justify-center select-none text-white">
        <LoomBoxLoading
          title="Connecting to Stream Chunks"
          subtitle={media?.title || 'Resolving P2P Torrent Swarm'}
          onCancel={() => navigate(-1)}
        />
      </div>
    )
  }

  return (
    <VideoPlayer
      key={`${mediaId}-${episodeRef?.season || 1}-${episodeRef?.episode || 1}-${streams[0]?.url || 'default'}`}
      sources={streams}
      startTime={startTime}
      expectedDuration={expectedDuration}
      title={media?.title}
      subtitle={displaySubtitle}
      mediaType={mediaType}
      mediaId={mediaId}
      episodeRef={episodeRef}
      onBack={() => navigate(-1)}
      onTimeUpdate={handleTimeUpdate}
      onEnded={handleEnded}
    />
  )
}
