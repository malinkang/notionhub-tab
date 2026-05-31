import type APlayer from "aplayer"
import type { APlayerAudio, APlayerOptions } from "aplayer"

import "aplayer/dist/APlayer.min.css"

import { Minimize2, Music2, RefreshCw } from "lucide-react"
import React, { useCallback, useEffect, useRef, useState } from "react"
import { createPortal } from "react-dom"

import {
  getNotionMusicTracks,
  refreshMusicTrack,
  type MusicTrack
} from "../lib/music"
import { useNewTabSettings } from "../lib/settingsStore"

type APlayerConstructor = new (options: APlayerOptions) => APlayer
const EMPTY_LYRIC_URL =
  "data:text/plain;charset=utf-8,%5B00%3A00.00%5D%E6%9A%82%E6%97%A0%E6%AD%8C%E8%AF%8D"
const LYRIC_LEAD_SECONDS = 0.45

function getTrackKey(track: MusicTrack): string {
  return track.id || track.notionUrl || track.url
}

function toAPlayerAudio(track: MusicTrack): APlayerAudio {
  return {
    name: track.name,
    artist: track.artist,
    url: track.url,
    cover: track.cover,
    lrc: track.lrc || EMPTY_LYRIC_URL
  }
}

function revokeTrackObjectUrls(tracks: MusicTrack[]) {
  tracks.forEach((track) => {
    if (track.url?.startsWith("blob:")) {
      URL.revokeObjectURL(track.url)
    }
  })
}

function syncLyricWithLead(player: any) {
  const currentTime = player?.audio?.currentTime
  if (!player?.lrc || typeof currentTime !== "number") return
  player.lrc.update(currentTime + LYRIC_LEAD_SECONDS)
}

function cancelAPlayerAutoSkip(player: any, index: number) {
  // APlayer schedules skipForward() on audio errors; its private timer is
  // cleared by the listswitch event, so trigger it before refreshing the URL.
  player?.events?.trigger?.("listswitch", { index })
}

function resolveAPlayerConstructor(value: unknown): APlayerConstructor | null {
  const seen = new Set<unknown>()
  const candidates: unknown[] = [value, (window as any).APlayer]

  while (candidates.length > 0) {
    const candidate = candidates.shift()
    if (!candidate || seen.has(candidate)) continue
    seen.add(candidate)

    if (typeof candidate === "function") {
      return candidate as APlayerConstructor
    }

    if (typeof candidate === "object") {
      const record = candidate as { default?: unknown; APlayer?: unknown }
      candidates.push(record.default, record.APlayer)
    }
  }

  return null
}

async function loadAPlayer(): Promise<APlayerConstructor> {
  const originalLog = console.log
  console.log = (...args: unknown[]) => {
    if (typeof args[0] === "string" && args[0].includes("APlayer")) return
    originalLog(...args)
  }

  try {
    const mod = await import("aplayer")
    const APlayerClass = resolveAPlayerConstructor(mod)
    if (!APlayerClass) {
      throw new Error("APlayer constructor not found")
    }

    return APlayerClass
  } finally {
    console.log = originalLog
  }
}

export default function MusicPlayer() {
  const [settings] = useNewTabSettings()
  const [tracks, setTracks] = useState<MusicTrack[]>([])
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState("")
  const [initializing, setInitializing] = useState(false)
  const [playerReady, setPlayerReady] = useState(false)
  const [loadingMore, setLoadingMore] = useState(false)
  const [nextCursor, setNextCursor] = useState<string | null>(null)
  const [playlistVersion, setPlaylistVersion] = useState(0)
  const [isExpanded, setIsExpanded] = useState(false)
  const containerRef = useRef<HTMLDivElement | null>(null)
  const playerRef = useRef<APlayer | null>(null)
  const loadingMoreRef = useRef(false)
  const nextCursorRef = useRef<string | null>(null)
  const tracksRef = useRef<MusicTrack[]>([])
  const refreshingTrackIdsRef = useRef(new Set<string>())
  const retriedTrackIdsRef = useRef(new Set<string>())

  const enabled = settings?.showMusicPlayer ?? false
  const hasTracks = tracks.length > 0
  const showStatusCard =
    Boolean(message) ||
    (loading && !hasTracks) ||
    (initializing && !playerReady)
  const musicBlurSetting = Math.max(settings?.musicPlayerBgBlur ?? 24, 0)
  const glassBlur = musicBlurSetting * 2
  const hasGlassBg = musicBlurSetting > 0
  const glassBgAlpha = Math.max(0, (musicBlurSetting / 40) * 0.06)
  const glassStyle = {
    "--nh-glass-blur": `${glassBlur}px`,
    "--nh-music-bg-alpha": glassBgAlpha,
    "--nh-music-border-alpha": hasGlassBg ? 0.14 : 0,
    "--nh-music-shadow-alpha": hasGlassBg ? 0.28 : 0,
    "--nh-music-glass-display": hasGlassBg ? "block" : "none"
  } as React.CSSProperties
  const playerShellStyle = {
    backgroundColor: `rgba(255, 255, 255, ${glassBgAlpha})`,
    borderColor: `rgba(255, 255, 255, ${hasGlassBg ? 0.14 : 0})`,
    boxShadow: hasGlassBg ? "0 18px 60px rgba(0, 0, 0, 0.28)" : "none",
    backdropFilter: hasGlassBg ? `blur(${glassBlur}px)` : undefined,
    WebkitBackdropFilter: hasGlassBg ? `blur(${glassBlur}px)` : undefined
  } as React.CSSProperties
  const glassCardStyle = {
    backgroundColor: `rgba(255, 255, 255, ${glassBgAlpha})`,
    borderColor: `rgba(255, 255, 255, ${hasGlassBg ? 0.14 : 0})`,
    boxShadow: hasGlassBg ? undefined : "none",
    backdropFilter: hasGlassBg ? `blur(${glassBlur}px)` : undefined,
    WebkitBackdropFilter: hasGlassBg ? `blur(${glassBlur}px)` : undefined
  } as React.CSSProperties

  useEffect(() => {
    tracksRef.current = tracks
  }, [tracks])

  useEffect(() => {
    nextCursorRef.current = nextCursor
  }, [nextCursor])

  useEffect(() => {
    loadingMoreRef.current = loadingMore
  }, [loadingMore])

  useEffect(() => {
    if (!enabled) return

    const player = containerRef.current?.querySelector<HTMLElement>(".aplayer")
    if (!player) return

    const transparentNodes =
      containerRef.current?.querySelectorAll<HTMLElement>(
        ".aplayer-body, .aplayer-info, .aplayer-list, .aplayer-list ol"
      ) ?? []

    player.style.setProperty(
      "background",
      `rgba(255, 255, 255, ${glassBgAlpha})`,
      "important"
    )
    player.style.setProperty(
      "border-color",
      `rgba(255, 255, 255, ${hasGlassBg ? 0.14 : 0})`,
      "important"
    )
    player.style.setProperty("box-shadow", "none", "important")
    player.style.setProperty("backdrop-filter", "none", "important")
    player.style.setProperty("-webkit-backdrop-filter", "none", "important")

    transparentNodes.forEach((node) => {
      node.style.setProperty("background", "transparent", "important")
    })
  }, [enabled, glassBgAlpha, glassBlur, hasGlassBg, playerReady])

  const loadTracks = async (forceRefresh = false) => {
    setLoading(true)
    setMessage("")
    setInitializing(false)
    setNextCursor(null)
    try {
      const result = await getNotionMusicTracks({
        forceRefresh
      })
      revokeTrackObjectUrls(tracksRef.current)
      retriedTrackIdsRef.current.clear()
      setTracks(result.tracks)
      setNextCursor(result.nextCursor ?? null)
      setPlaylistVersion((version) => version + 1)
      setMessage(result.status === "ready" ? "" : result.message || "")
    } catch (error) {
      console.warn("[NotionHub NewTab] Failed to load music player:", error)
      setTracks([])
      setNextCursor(null)
      setMessage("读取 Notion 音乐库失败，稍后再试。")
    } finally {
      setLoading(false)
    }
  }

  const loadMoreTracks = useCallback(async () => {
    if (loadingMoreRef.current || !nextCursorRef.current) return

    loadingMoreRef.current = true
    setLoadingMore(true)

    try {
      let cursor = nextCursorRef.current
      let appendedTracks: MusicTrack[] = []
      let next: string | null = cursor

      while (cursor && appendedTracks.length === 0) {
        const result = await getNotionMusicTracks({
          cursor
        })
        next = result.nextCursor ?? null

        const existingKeys = new Set(tracksRef.current.map(getTrackKey))
        appendedTracks = result.tracks.filter(
          (track) => !existingKeys.has(getTrackKey(track))
        )

        cursor = next
        if (result.status === "error") {
          setMessage(result.message || "加载更多音乐失败，稍后再试。")
          break
        }
      }

      setNextCursor(next)
      nextCursorRef.current = next

      if (appendedTracks.length > 0) {
        playerRef.current?.addAudio(appendedTracks.map(toAPlayerAudio))
        setTracks((currentTracks) => {
          const existingKeys = new Set(currentTracks.map(getTrackKey))
          const uniqueTracks = appendedTracks.filter(
            (track) => !existingKeys.has(getTrackKey(track))
          )

          return [...currentTracks, ...uniqueTracks]
        })
      }
    } catch (error) {
      console.warn("[NotionHub NewTab] Failed to load more music:", error)
      setMessage("加载更多音乐失败，稍后再试。")
    } finally {
      loadingMoreRef.current = false
      setLoadingMore(false)
    }
  }, [])

  const refreshCurrentTrackAfterError = useCallback(async () => {
    const player = playerRef.current as any
    const currentIndex = Number(player?.list?.index ?? 0)
    const currentTrack = tracksRef.current[currentIndex]

    cancelAPlayerAutoSkip(player, currentIndex)

    if (!currentTrack?.id) return
    if (refreshingTrackIdsRef.current.has(currentTrack.id)) return

    if (retriedTrackIdsRef.current.has(currentTrack.id)) {
      setMessage("这首歌的音频链接刷新后仍无法播放，请稍后重试。")
      return
    }

    refreshingTrackIdsRef.current.add(currentTrack.id)
    retriedTrackIdsRef.current.add(currentTrack.id)

    try {
      const refreshedTrack = await refreshMusicTrack(currentTrack.id)
      if (!refreshedTrack?.url) {
        throw new Error("Refreshed track has no audio url")
      }

      const refreshedAudio = toAPlayerAudio(refreshedTrack)
      const updatedTracks = tracksRef.current.map((track) =>
        track.id === refreshedTrack.id ? refreshedTrack : track
      )

      tracksRef.current = updatedTracks
      setTracks(updatedTracks)
      setMessage("")

      if (Array.isArray(player?.list?.audios)) {
        player.list.audios[currentIndex] = {
          ...player.list.audios[currentIndex],
          ...refreshedAudio
        }
      }
      if (Array.isArray(player?.options?.audio)) {
        player.options.audio[currentIndex] = {
          ...player.options.audio[currentIndex],
          ...refreshedAudio
        }
      }

      if (player?.audio) {
        player.audio.src = refreshedTrack.url
        player.audio.load?.()
      }

      window.setTimeout(() => {
        player?.play?.()
      }, 150)
    } catch (error) {
      console.warn("[NotionHub NewTab] Failed to refresh expired audio:", error)
      setMessage("音频链接刷新失败，请点击重新加载后再试。")
    } finally {
      refreshingTrackIdsRef.current.delete(currentTrack.id)
    }
  }, [])

  useEffect(() => {
    if (!enabled) return
    loadTracks()
  }, [enabled])

  useEffect(() => {
    let cancelled = false
    const container = containerRef.current

    playerRef.current?.destroy()
    playerRef.current = null
    setPlayerReady(false)
    setInitializing(false)

    if (!enabled || !container || !hasTracks) return

    async function bootPlayer() {
      setInitializing(true)
      setMessage("")

      try {
        const APlayerClass = await loadAPlayer()
        if (cancelled || !container) return

        playerRef.current = new APlayerClass({
          container,
          audio: tracks.map(toAPlayerAudio),
          autoplay: false,
          fixed: false,
          mini: false,
          theme: "#22c55e",
          loop: "all",
          order: "random",
          preload: "metadata",
          volume: 0.7,
          mutex: true,
          lrcType: 3,
          listFolded: true,
          listMaxHeight: "220px"
        })

        const player = playerRef.current as any
        player?.on?.("error", () => {
          void refreshCurrentTrackAfterError()
        })
        player?.on?.("timeupdate", () => {
          syncLyricWithLead(player)
        })

        setPlayerReady(true)
        setInitializing(false)
      } catch (error) {
        console.warn("[NotionHub NewTab] Failed to boot music player:", error)
        if (!cancelled) {
          setPlayerReady(false)
          setInitializing(false)
          setMessage("音乐播放器初始化失败，请刷新页面后重试。")
        }
      }
    }

    void bootPlayer()

    return () => {
      cancelled = true
      playerRef.current?.destroy()
      playerRef.current = null
      revokeTrackObjectUrls(tracks)
    }
  }, [enabled, hasTracks, playlistVersion, refreshCurrentTrackAfterError])

  useEffect(() => {
    if (!enabled || !playerReady) return

    const list = containerRef.current?.querySelector(".aplayer-list ol")
    if (!list) return

    const handleScroll = () => {
      const distanceToBottom =
        list.scrollHeight - list.scrollTop - list.clientHeight
      if (distanceToBottom < 32) {
        void loadMoreTracks()
      }
    }

    list.addEventListener("scroll", handleScroll, { passive: true })
    return () => list.removeEventListener("scroll", handleScroll)
  }, [enabled, loadMoreTracks, playerReady])

  if (!enabled) return null

  const containerClassName =
    "notionhub-music-player fixed bottom-6 left-6 z-40 w-[min(440px,calc(100vw-2rem))] text-left"
  const collapsedButton =
    !isExpanded && typeof document !== "undefined"
      ? createPortal(
          <button
            type="button"
            className="fixed bottom-6 left-6 z-50 flex h-12 w-12 items-center justify-center rounded-xl text-white/80 transition-all duration-300 ease-out hover:bg-white/20 hover:text-white active:scale-95"
            aria-label="展开音乐播放器"
            onClick={() => setIsExpanded(true)}>
            {loading ? (
              <RefreshCw className="animate-spin drop-shadow" size={20} />
            ) : (
              <Music2 className="drop-shadow" size={24} />
            )}
          </button>,
          document.body
        )
      : null

  return (
    <div className={containerClassName} style={glassStyle}>
      {collapsedButton}
      {isExpanded && showStatusCard ? (
        <div
          className="flex min-h-[66px] items-center gap-3 rounded-2xl border border-white/15 px-4 py-3 text-white shadow-2xl"
          style={glassCardStyle}>
          {(loading && !hasTracks) || (initializing && !playerReady) ? (
            <RefreshCw className="animate-spin text-white/70" size={18} />
          ) : (
            <Music2 className="text-white/70" size={18} />
          )}
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium">
              {loading && !hasTracks
                ? "正在读取 Notion 音乐库..."
                : initializing
                  ? `已读取 ${tracks.length} 首，正在初始化播放器...`
                  : message}
            </p>
            {!loading && !initializing && (
              <button
                type="button"
                className="mt-1 text-xs text-white/60 transition-colors hover:text-white"
                onClick={() => loadTracks(true)}>
                重新加载
              </button>
            )}
          </div>
        </div>
      ) : null}
      <div
        className={
          hasTracks
            ? "relative rounded-2xl border overflow-hidden notionhub-music-player-shell"
            : "hidden"
        }
        style={{
          ...playerShellStyle,
          display: isExpanded ? undefined : "none"
        }}>
        <button
          type="button"
          className="absolute right-3 top-3 z-20 flex h-8 w-8 items-center justify-center rounded-full border border-white/15 bg-black/20 text-white/70 backdrop-blur-md transition-colors hover:bg-white/15 hover:text-white"
          aria-label="收起音乐播放器"
          onClick={() => setIsExpanded(false)}>
          <Minimize2 size={16} />
        </button>
        <div ref={containerRef} />
      </div>
    </div>
  )
}
