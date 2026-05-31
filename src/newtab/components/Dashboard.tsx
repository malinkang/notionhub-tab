import React, { useCallback, useEffect, useRef, useState } from "react"

import { getNotionBackgroundImage } from "../lib/api"
import appleVideos from "../lib/appleVideos.json"
import {
  newTabStorage,
  SYSTEM_FONT_STACK,
  useNewTabSettings,
  type BackgroundFrequency
} from "../lib/settingsStore"
import Clock from "./Clock"
import HighlightQuote from "./HighlightQuote"
import MusicPlayer from "./MusicPlayer"
import SettingsPanel from "./SettingsPanel"

const getAppleProxyUrl = (url: string) =>
  url.replace("https://sylvan.apple.com", "https://api-services.20220129.xyz")

const BACKGROUND_CACHE_KEY = "notionhub_newtab_background_cache_v3"
const BACKGROUND_MEDIA_CACHE_NAME = "notionhub-newtab-background-media-v1"
const MEDIA_PRELOAD_TIMEOUT = 8000
const BACKGROUND_FALLBACK_COLOR = "#05070b"
const BACKGROUND_FALLBACK_LAYERS =
  "radial-gradient(circle at 18% 12%, rgba(56, 189, 248, 0.2), transparent 34%), radial-gradient(circle at 82% 18%, rgba(245, 158, 11, 0.14), transparent 28%), linear-gradient(135deg, #05070b 0%, #111827 48%, #020617 100%)"
const ENABLE_BACKGROUND_DEBUG = false

type BackgroundMediaCache = {
  cacheKey: string
  image: string | null
  video: string | null
  videoFallback: string | null
  videoPoster: string | null
  lastChangedAt: number
}

type BackgroundCacheStore = {
  entries: Record<string, BackgroundMediaCache>
}

type BingImageItem = {
  url?: string
  urlbase?: string
}

type UnsplashPhoto = {
  urls?: {
    full?: string
    regular?: string
    raw?: string
  }
}

type PixabayImage = {
  largeImageURL?: string
  webformatURL?: string
}

type PixabayVideo = {
  videos?: {
    large?: { url?: string }
    medium?: { url?: string }
    small?: { url?: string }
  }
}

function logBackgroundDecision(
  message: string,
  details?: Record<string, unknown>
) {
  if (!ENABLE_BACKGROUND_DEBUG) return
  const payload = details ? JSON.stringify(details, null, 2) : "{}"
  console.info(`[NotionHub NewTab Background] ${message}\n${payload}`)
}

function normalizeBackgroundFrequency(frequency?: string): BackgroundFrequency {
  return ["tabs", "hour", "period", "day", "pause"].includes(frequency || "")
    ? (frequency as BackgroundFrequency)
    : "hour"
}

function getDaylightPeriod(time = Date.now()) {
  const date = new Date(time)
  const mins = date.getHours() * 60 + date.getMinutes()
  const sunrise = 7 * 60
  const sunset = 21 * 60

  if (mins <= sunrise - 60) return "night"
  if (mins <= sunrise + 60) return "noon"
  if (mins <= sunset - 60) return "day"
  if (mins <= sunset + 60) return "evening"
  return "night"
}

function hashString(value: string) {
  let hash = 0
  for (let i = 0; i < value.length; i += 1) {
    hash = (hash << 5) - hash + value.charCodeAt(i)
    hash |= 0
  }
  return Math.abs(hash)
}

function getFrequencyBucket(frequency: BackgroundFrequency, time = Date.now()) {
  const date = new Date(time)
  const day = `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}`

  switch (frequency) {
    case "day":
      return day
    case "hour":
      return `${day}-${date.getHours()}`
    case "period":
      return `${day}-${getDaylightPeriod(time)}`
    case "pause":
      return "pause"
    case "tabs":
    default:
      return `${time}-${Math.random()}`
  }
}

function pickBackgroundItem<T>(items: T[], seed?: string) {
  if (!items.length) return undefined
  if (!seed) return items[Math.floor(Math.random() * items.length)]

  return items[hashString(seed) % items.length]
}

function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs = MEDIA_PRELOAD_TIMEOUT
) {
  return new Promise<T | null>((resolve) => {
    const timer = window.setTimeout(() => resolve(null), timeoutMs)

    promise
      .then((value) => resolve(value))
      .catch(() => resolve(null))
      .finally(() => window.clearTimeout(timer))
  })
}

async function warmBrowserMediaCache(url: string | null) {
  if (!url || !("caches" in window)) return

  try {
    const cache = await caches.open(BACKGROUND_MEDIA_CACHE_NAME)
    const request = new Request(url, {
      cache: "force-cache",
      credentials: "omit",
      mode: "cors"
    })
    const cached = await cache.match(request)
    if (cached) return

    const response = await fetch(request)
    if (response.ok) {
      await cache.put(request, response.clone())
    }
  } catch {
    // Some third-party media hosts do not allow CORS fetches. Element preloading
    // below still warms the normal browser cache and keeps the current background visible.
  }
}

function preloadImage(url: string | null) {
  if (!url) return Promise.resolve(true)

  warmBrowserMediaCache(url)

  return withTimeout(
    new Promise<boolean>((resolve, reject) => {
      const img = new Image()
      img.decoding = "async"
      img.onload = () => resolve(true)
      img.onerror = () => reject(new Error("Image preload failed"))
      img.src = url
    })
  )
}

function preloadVideo(url: string | null) {
  if (!url) return Promise.resolve(true)

  return withTimeout(
    new Promise<boolean>((resolve, reject) => {
      const video = document.createElement("video")
      let settled = false
      const cleanup = () => {
        video.removeAttribute("src")
        video.load()
        video.remove()
      }
      const done = () => {
        if (settled) return
        settled = true
        cleanup()
        resolve(true)
      }

      video.preload = "auto"
      video.muted = true
      video.playsInline = true
      video.oncanplay = done
      video.onloadeddata = done
      video.onerror = () => {
        if (settled) return
        settled = true
        cleanup()
        reject(new Error("Video preload failed"))
      }
      video.src = url
      video.load()
    })
  )
}

function needsBackgroundChange(
  frequency: BackgroundFrequency,
  lastChangedAt?: number
) {
  if (!lastChangedAt) return true

  const now = new Date()
  const last = new Date(lastChangedAt)

  switch (frequency) {
    case "day":
      return (
        now.getDate() !== last.getDate() ||
        now.getMonth() !== last.getMonth() ||
        now.getFullYear() !== last.getFullYear()
      )
    case "hour":
      return (
        now.getDate() !== last.getDate() ||
        now.getMonth() !== last.getMonth() ||
        now.getFullYear() !== last.getFullYear() ||
        now.getHours() !== last.getHours()
      )
    case "tabs":
      return true
    case "period":
      return getDaylightPeriod() !== getDaylightPeriod(lastChangedAt)
    case "pause":
      return false
    default:
      return false
  }
}

function readWindowBackgroundCache(): BackgroundCacheStore | null {
  try {
    const raw = window.localStorage.getItem(BACKGROUND_CACHE_KEY)
    return raw ? (JSON.parse(raw) as BackgroundCacheStore) : null
  } catch (error) {
    console.warn(
      "[NotionHub NewTab Background] failed to read localStorage cache",
      error
    )
    return null
  }
}

function writeWindowBackgroundCache(cacheStore: BackgroundCacheStore) {
  try {
    window.localStorage.setItem(
      BACKGROUND_CACHE_KEY,
      JSON.stringify(cacheStore)
    )
  } catch (error) {
    console.warn(
      "[NotionHub NewTab Background] failed to write localStorage cache",
      error
    )
  }
}

function getBackgroundImageLayers(image: string | null) {
  if (!image) return BACKGROUND_FALLBACK_LAYERS

  return [
    "linear-gradient(rgba(3, 7, 18, 0.1), rgba(3, 7, 18, 0.24))",
    `url(${JSON.stringify(image)})`,
    BACKGROUND_FALLBACK_LAYERS
  ].join(", ")
}

export default function Dashboard() {
  const [settings, setSettings] = useNewTabSettings()
  const [isSettingsOpen, setIsSettingsOpen] = useState(false)
  const [bgImage, setBgImage] = useState<string | null>(null)
  const [bgVideo, setBgVideo] = useState<string | null>(null)
  const [bgVideoFallback, setBgVideoFallback] = useState<string | null>(null)
  const [bgVideoPoster, setBgVideoPoster] = useState<string | null>(null)
  const [isVideoReady, setIsVideoReady] = useState(false)
  const lastRefreshTriggerRef = useRef<number | undefined>(undefined)
  const currentBackgroundRef = useRef<{
    image: string | null
    video: string | null
    videoFallback: string | null
    videoPoster: string | null
  }>({
    image: null,
    video: null,
    videoFallback: null,
    videoPoster: null
  })

  const refreshBackground = useCallback(() => {
    setSettings((prev) => {
      if (!prev) return prev

      return {
        ...prev,
        backgroundRefreshTrigger: Math.max(
          Date.now(),
          (prev.backgroundRefreshTrigger || 0) + 1
        )
      }
    })
  }, [setSettings])

  // Apply theme
  useEffect(() => {
    if (!settings) return

    if (
      settings.theme === "dark" ||
      (settings.theme === "system" &&
        window.matchMedia("(prefers-color-scheme: dark)").matches)
    ) {
      document.documentElement.setAttribute("data-theme", "dark")
      document.documentElement.classList.add("dark")
    } else {
      document.documentElement.setAttribute("data-theme", "light")
      document.documentElement.classList.remove("dark")
    }
  }, [settings?.theme])

  useEffect(() => {
    if (!settings) return

    if (!["image", "video"].includes(settings.backgroundType as string)) {
      setSettings((prev) => ({
        ...prev!,
        backgroundType: "image",
        backgroundProvider: "unsplash",
        backgroundSearchQuery: prev?.backgroundSearchQuery || "wallpaper"
      }))
      return
    }

    const isOldDimmedDefault =
      settings.backgroundProvider === "bing" &&
      settings.blurIntensity === 10 &&
      settings.brightness === 60

    if (!isOldDimmedDefault) return

    setSettings((prev) => ({
      ...prev!,
      blurIntensity: 0,
      brightness: 100
    }))
  }, [
    settings?.backgroundType,
    settings?.backgroundProvider,
    settings?.backgroundSearchQuery,
    settings?.blurIntensity,
    settings?.brightness,
    setSettings
  ])

  // Fetch and reuse background media according to Bonjourr-style frequency rules.
  useEffect(() => {
    if (!settings) {
      setBgImage(null)
      setBgVideo(null)
      setBgVideoFallback(null)
      setBgVideoPoster(null)
      setIsVideoReady(false)
      return
    }

    const provider =
      settings.backgroundType === "video"
        ? settings.backgroundProvider === "pixabay"
          ? "pixabay"
          : "apple"
        : ["bing", "unsplash", "pixabay", "notion"].includes(
              settings.backgroundProvider
            )
          ? settings.backgroundProvider
          : "bing"
    const query =
      provider === "apple" || provider === "bing"
        ? ""
        : settings.backgroundSearchQuery || "wallpaper"
    const width = window.screen.width * window.devicePixelRatio
    const height = window.screen.height * window.devicePixelRatio
    const cacheKey = [
      settings.backgroundType,
      provider,
      query,
      provider === "notion" ? settings.backgroundNotionDatabaseId : "",
      provider === "notion" ? settings.backgroundNotionImageSource : "",
      provider === "notion" ? settings.backgroundNotionFilesProperty : ""
    ].join(":")
    const frequency = normalizeBackgroundFrequency(settings.backgroundFrequency)
    const refreshTrigger = settings.backgroundRefreshTrigger || 0
    const previousRefreshTrigger = lastRefreshTriggerRef.current
    const shouldForceRefresh =
      previousRefreshTrigger !== undefined &&
      refreshTrigger !== previousRefreshTrigger
    lastRefreshTriggerRef.current = refreshTrigger

    let cancelled = false
    let timer: ReturnType<typeof setTimeout> | undefined

    const applyBackgroundMedia = async (media: BackgroundMediaCache) => {
      if (cancelled) return

      const nextImage = media.image || media.videoPoster
      const hasVisibleBackground = Boolean(
        currentBackgroundRef.current.image || currentBackgroundRef.current.video
      )
      const isSameVideo =
        Boolean(media.video) &&
        media.video === currentBackgroundRef.current.video

      await Promise.all([
        nextImage !== currentBackgroundRef.current.image
          ? preloadImage(nextImage)
          : Promise.resolve(true),
        media.videoPoster !== currentBackgroundRef.current.videoPoster
          ? preloadImage(media.videoPoster)
          : Promise.resolve(true)
      ])

      if (cancelled) return

      if (media.video && !isSameVideo && !hasVisibleBackground) {
        currentBackgroundRef.current = {
          image: nextImage,
          video: media.video,
          videoFallback: media.videoFallback,
          videoPoster: media.videoPoster
        }

        setBgImage(nextImage)
        setBgVideo(media.video)
        setBgVideoFallback(media.videoFallback)
        setBgVideoPoster(media.videoPoster)
        setIsVideoReady(false)
        return
      }

      await Promise.all([
        media.video !== currentBackgroundRef.current.video
          ? preloadVideo(media.video)
          : Promise.resolve(true)
      ])

      if (cancelled) return

      currentBackgroundRef.current = {
        image: nextImage,
        video: media.video,
        videoFallback: media.videoFallback,
        videoPoster: media.videoPoster
      }

      setBgImage(nextImage)
      setBgVideo(media.video)
      setBgVideoFallback(media.videoFallback)
      setBgVideoPoster(media.videoPoster)
      setIsVideoReady(isSameVideo)
    }

    const createMediaCache = (
      media: Omit<BackgroundMediaCache, "cacheKey" | "lastChangedAt">
    ): BackgroundMediaCache => ({
      cacheKey,
      lastChangedAt: Date.now(),
      ...media
    })

    const frequencyBucket = getFrequencyBucket(frequency)
    const stableSelectionSeed =
      frequency === "tabs"
        ? undefined
        : `${cacheKey}:${frequency}:${frequencyBucket}:${refreshTrigger}`

    const fetchFreshBackground = async () => {
      if (provider === "bing" && settings.backgroundType === "image") {
        try {
          const res = await fetch(
            "https://www.bing.com/HPImageArchive.aspx?format=js&idx=0&n=8&mkt=zh-CN"
          )
          const data = await res.json()
          const images: BingImageItem[] = Array.isArray(data?.images)
            ? data.images
            : []
          const image = pickBackgroundItem(images, stableSelectionSeed)
          const path = image?.urlbase ? `${image.urlbase}_UHD.jpg` : image?.url

          if (path) {
            return createMediaCache({
              image: new URL(path, "https://www.bing.com").toString(),
              video: null,
              videoFallback: null,
              videoPoster: null
            })
          }
        } catch (err) {
          console.error("Failed to fetch Bing background:", err)
        }

        return createMediaCache({
          image:
            "https://images.unsplash.com/photo-1472214103451-9374bd1c798e?q=80&w=2560&auto=format&fit=crop",
          video: null,
          videoFallback: null,
          videoPoster: null
        })
      }

      if (provider === "apple" && settings.backgroundType === "video") {
        const collection = appleVideos as any[]
        const item = pickBackgroundItem(collection, stableSelectionSeed)
        if (!item) return null

        const previewImage = item.previewImage || null
        logBackgroundDecision("selected fresh Apple video", {
          appleVideoId: item.id,
          appleVideoUrl: item.url,
          frequency,
          frequencyBucket,
          selectionMode: stableSelectionSeed
            ? "stable-by-frequency"
            : "random-per-tab"
        })

        return createMediaCache({
          image: previewImage,
          video: getAppleProxyUrl(item.url),
          videoFallback: item.url,
          videoPoster: previewImage
        })
      }

      if (provider === "unsplash" && settings.backgroundType === "image") {
        if (!settings.unsplashAccessKey) return null

        try {
          const res = await fetch(
            `https://api.unsplash.com/search/photos?query=${encodeURIComponent(query)}&per_page=30&orientation=landscape&client_id=${encodeURIComponent(settings.unsplashAccessKey)}`
          )
          const data = await res.json()
          const collection: UnsplashPhoto[] = Array.isArray(data?.results)
            ? data.results
            : []
          const item = pickBackgroundItem(collection, stableSelectionSeed)
          const src = item?.urls?.full || item?.urls?.regular || item?.urls?.raw

          if (src) {
            return createMediaCache({
              image: src,
              video: null,
              videoFallback: null,
              videoPoster: null
            })
          }
        } catch (err) {
          console.error("Failed to fetch Unsplash background:", err)
        }

        return null
      }

      if (provider === "pixabay") {
        if (!settings.pixabayApiKey) return null

        try {
          const endpoint =
            settings.backgroundType === "video"
              ? "https://pixabay.com/api/videos/"
              : "https://pixabay.com/api/"
          const params = new URLSearchParams({
            key: settings.pixabayApiKey,
            q: query,
            per_page: "30",
            safesearch: "true"
          })
          if (settings.backgroundType === "image") {
            params.set("image_type", "photo")
            params.set("orientation", "horizontal")
          }

          const res = await fetch(`${endpoint}?${params.toString()}`)
          const data = await res.json()
          const collection = Array.isArray(data?.hits) ? data.hits : []
          const item = pickBackgroundItem(collection, stableSelectionSeed)

          if (settings.backgroundType === "video") {
            const videoItem = item as PixabayVideo | undefined
            const src =
              videoItem?.videos?.large?.url ||
              videoItem?.videos?.medium?.url ||
              videoItem?.videos?.small?.url
            if (src) {
              return createMediaCache({
                image: null,
                video: src,
                videoFallback: null,
                videoPoster: null
              })
            }
          } else {
            const imageItem = item as PixabayImage | undefined
            const src = imageItem?.largeImageURL || imageItem?.webformatURL
            if (src) {
              return createMediaCache({
                image: src,
                video: null,
                videoFallback: null,
                videoPoster: null
              })
            }
          }
        } catch (err) {
          console.error("Failed to fetch Pixabay background:", err)
        }

        return null
      }

      if (provider === "notion" && settings.backgroundType === "image") {
        if (
          !settings.backgroundNotionToken ||
          !settings.backgroundNotionDatabaseId
        ) {
          return null
        }

        try {
          const image = await getNotionBackgroundImage(
            settings.backgroundNotionToken,
            settings.backgroundNotionDatabaseId,
            settings.backgroundNotionImageSource,
            settings.backgroundNotionFilesProperty
          )

          if (image) {
            return createMediaCache({
              image,
              video: null,
              videoFallback: null,
              videoPoster: null
            })
          }
        } catch (err) {
          console.error("Failed to fetch Notion background:", err)
        }

        return null
      }

      if (settings.backgroundType === "image") {
        return createMediaCache({
          image:
            "https://images.unsplash.com/photo-1472214103451-9374bd1c798e?q=80&w=2560&auto=format&fit=crop",
          video: null,
          videoFallback: null,
          videoPoster: null
        })
      }

      return null
    }

    const loadBackground = async () => {
      const chromeCacheStore = await newTabStorage
        .get<BackgroundCacheStore>(BACKGROUND_CACHE_KEY)
        .catch(() => null)
      const localCacheStore = readWindowBackgroundCache()
      const cacheStore = chromeCacheStore || localCacheStore || { entries: {} }
      const cacheSource = chromeCacheStore
        ? "chrome-storage"
        : localCacheStore
          ? "window-localStorage"
          : "empty"
      const cached = cacheStore.entries?.[cacheKey]
      const needsChange = needsBackgroundChange(
        frequency,
        cached?.lastChangedAt
      )
      const shouldReuse =
        !shouldForceRefresh && cached?.cacheKey === cacheKey && !needsChange

      logBackgroundDecision("cache decision", {
        backgroundType: settings.backgroundType,
        provider,
        rawFrequency: settings.backgroundFrequency,
        frequency,
        cacheKey,
        cacheSource,
        cacheKeys: Object.keys(cacheStore.entries || {}),
        hasCachedEntry: Boolean(cached),
        cachedLastChangedAt: cached?.lastChangedAt
          ? new Date(cached.lastChangedAt).toISOString()
          : null,
        shouldForceRefresh,
        needsChange,
        shouldReuse,
        cachedVideo: cached?.video || null,
        cachedImage: cached?.image || null
      })

      if (shouldReuse) {
        logBackgroundDecision("using cached background", {
          cacheKey,
          cachedVideo: cached.video,
          cachedImage: cached.image
        })
        await applyBackgroundMedia(cached)
        return
      }

      timer = setTimeout(async () => {
        logBackgroundDecision("fetching fresh background", {
          cacheKey,
          provider,
          frequency,
          frequencyBucket,
          selectionMode: stableSelectionSeed
            ? "stable-by-frequency"
            : "random-per-tab",
          reason: shouldForceRefresh
            ? "manual refresh"
            : cached
              ? "frequency changed"
              : "cache miss"
        })
        const media = await fetchFreshBackground()
        if (!media || cancelled) return

        await applyBackgroundMedia(media)
        const nextCacheStore = {
          ...cacheStore,
          entries: {
            ...cacheStore.entries,
            [cacheKey]: media
          }
        }
        writeWindowBackgroundCache(nextCacheStore)
        await newTabStorage.set(BACKGROUND_CACHE_KEY, nextCacheStore)
        logBackgroundDecision("stored fresh background", {
          cacheKey,
          cacheSource: "chrome-storage+window-localStorage",
          lastChangedAt: new Date(media.lastChangedAt).toISOString(),
          video: media.video,
          image: media.image
        })
      }, 800)
    }

    loadBackground()

    return () => {
      cancelled = true
      if (timer) clearTimeout(timer)
    }
  }, [
    settings?.backgroundType,
    settings?.backgroundProvider,
    settings?.backgroundSearchQuery,
    settings?.backgroundFrequency,
    settings?.backgroundRefreshTrigger,
    settings?.unsplashAccessKey,
    settings?.pixabayApiKey,
    settings?.backgroundNotionToken,
    settings?.backgroundNotionDatabaseId,
    settings?.backgroundNotionImageSource,
    settings?.backgroundNotionFilesProperty
  ])

  if (!settings) return null

  const globalFontFamily =
    settings.globalFontFamily || settings.highlightFont || SYSTEM_FONT_STACK
  const globalFontWeight = settings.globalFontWeight || "300"
  const globalFontSize = settings.globalFontSize || 16
  const globalTextShadow =
    settings.globalTextShadow === undefined ? 0.5 : settings.globalTextShadow
  const interfaceFontStyle = {
    "--nh-font-family": globalFontFamily,
    "--nh-font-weight": globalFontWeight,
    "--nh-font-weight-clock": globalFontWeight,
    "--nh-font-size": `${globalFontSize}px`,
    "--nh-text-shadow-alpha": String(globalTextShadow)
  } as React.CSSProperties

  const bgStyle: React.CSSProperties = {
    backgroundColor: BACKGROUND_FALLBACK_COLOR,
    backgroundImage: getBackgroundImageLayers(bgImage),
    backgroundSize: "cover",
    backgroundPosition: "center"
  }
  const mediaBrightness = (settings.brightness || 100) / 100
  const mediaBlur = settings.blurIntensity || 0
  const mediaFilter = `brightness(${mediaBrightness})${
    mediaBlur > 0 ? ` blur(${mediaBlur}px)` : ""
  }`
  const videoFadeMs = Math.max(0, (settings.fadeInTime ?? 60) * 10)

  return (
    <div
      className="min-h-screen flex flex-col relative transition-colors duration-500 overflow-hidden"
      style={bgStyle}>
      {/* Background Media */}
      {bgVideo && (
        <video
          className="absolute inset-0 w-full h-full object-cover z-0"
          src={bgVideo}
          poster={bgVideoPoster || undefined}
          autoPlay
          loop
          muted={settings.muteVideo}
          playsInline
          preload="auto"
          onCanPlay={() => {
            setIsVideoReady(true)
          }}
          onError={() => {
            if (bgVideoFallback && bgVideo !== bgVideoFallback) {
              setBgVideo(bgVideoFallback)
              setBgVideoFallback(null)
              setIsVideoReady(false)
              return
            }
            setBgVideo(null)
            setBgVideoFallback(null)
            setIsVideoReady(false)
          }}
          style={{
            filter: mediaFilter,
            opacity: isVideoReady ? 1 : 0,
            transform: mediaBlur > 0 ? "scale(1.03)" : undefined,
            transition: `opacity ${videoFadeMs}ms ease-in-out`,
            willChange: "filter, opacity, transform"
          }}
        />
      )}

      {/* Dark overlay to make white text pop out. Image filters stay on the overlay; video filters are applied directly to the media. */}
      {!bgVideo && bgImage && (
        <div
          className="absolute inset-0 bg-black/20 z-0 pointer-events-none"
          style={{
            backdropFilter: `blur(${mediaBlur}px) brightness(${mediaBrightness})`,
            WebkitBackdropFilter: `blur(${mediaBlur}px) brightness(${mediaBrightness})`
          }}></div>
      )}
      {bgVideo && (
        <div className="absolute inset-0 bg-black/20 z-0 pointer-events-none"></div>
      )}

      <div className="absolute bottom-6 right-6 z-50">
        <button
          type="button"
          onClick={() => setIsSettingsOpen(true)}
          className={`group flex items-center justify-center w-12 h-12 rounded-xl transition-all duration-300 ease-out 
            ${
              settings.backgroundType === "image" ||
              settings.backgroundType === "video"
                ? "text-white/80 hover:text-white hover:bg-white/20 hover:backdrop-blur-md"
                : "text-base-content/50 hover:text-base-content hover:bg-base-200/50"
            }`}>
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="24"
            height="24"
            viewBox="0 0 52.83 52.9"
            className="transition-transform duration-300 ease-out group-hover:rotate-45"
            style={
              settings.backgroundType === "image" ||
              settings.backgroundType === "video"
                ? { filter: "drop-shadow(0px 1px 6px rgba(0,0,0,0.6))" }
                : {}
            }>
            <path
              fill="currentColor"
              d="M29.73 52.57c-.26-.2-.93-1.41-1.48-2.71-1.1-2.57-1.42-2.93-2.42-2.68-.51.13-.89.66-1.67 2.36-1.2 2.59-1.6 3.11-2.4 3.11-1.1 0-1.35-.58-1.51-3.48-.13-2.38-.23-2.78-.73-3.2-.32-.25-.7-.46-.84-.46s-1.25.95-2.46 2.12c-1.22 1.16-2.38 2.11-2.59 2.11-.52 0-1.25-.86-1.25-1.49 0-.28.3-1.56.67-2.84 1.12-3.84.46-4.31-3.47-2.54-2.15.98-2.6 1.1-3.16.83-1.08-.49-.85-1.45.93-3.9 1.72-2.37 1.91-3.07 1-3.66-.5-.3-1.06-.33-3.2-.11-2.9.29-3.27.22-3.6-.64-.33-.89.05-1.37 2.2-2.83 1.07-.72 2.14-1.5 2.38-1.74 1.1-1.1.16-1.97-2.97-2.78C.38 27.33-.28 26.82.1 25.72c.23-.64.53-.79 2.97-1.42 1.5-.4 2.9-.85 3.1-1.03.77-.63.46-1.54-.84-2.44-2.35-1.62-3.8-2.85-3.8-3.21 0-.2.22-.64.5-.97.48-.6.5-.6 3.35-.3 2.56.29 2.9.27 3.34-.12.27-.24.48-.64.48-.89 0-.24-.7-1.5-1.58-2.8-.88-1.29-1.59-2.53-1.59-2.77 0-.48.8-1.3 1.27-1.3.17 0 1.43.56 2.8 1.24 2.22 1.1 2.59 1.2 3.19.93.84-.38.86-.96.13-3.82-.68-2.68-.61-3.42.36-3.76.68-.24.87-.12 2.91 1.91 1.2 1.2 2.37 2.17 2.6 2.17.88 0 1.26-.89 1.54-3.7C21.13.59 21.4 0 22.44 0c.67 0 1.17.71 2.24 3.23 1.48 3.46 2.38 3.5 3.98.14C29.95.65 30.26.27 31.2.27c1 0 1.19.46 1.38 3.53.09 1.44.3 2.78.46 2.98.68.82 1.61.4 3.7-1.62 1.12-1.1 2.18-1.98 2.35-1.98.17 0 .54.12.82.27.7.38.66 1.39-.2 4.23-.68 2.3-.68 2.38-.21 2.9.66.74 1.06.68 3.67-.53 2.43-1.12 3.04-1.25 3.55-.74.64.64.3 1.64-1.3 3.84-1.28 1.78-1.57 2.35-1.44 2.88.23.9.9 1.09 3.14.86 3.25-.32 3.57-.29 4.05.44.38.6.39.72.03 1.27-.22.34-1.35 1.24-2.52 2-.16.77-2.17 1.6-2.23 1.85-.25.92.26 1.59 1.44 1.9 3.93 1.02 4.7 1.33 4.86 1.96.3 1.24-.22 1.63-3.05 2.28-4.1.92-4.48 1.93-1.54 3.95 3.15 2.17 3.63 2.89 2.59 3.84-.48.43-.74.45-3.34.15-2.55-.28-2.85-.27-3.3.14-.28.25-.5.65-.5.88 0 .24.7 1.49 1.58 2.78.87 1.29 1.59 2.56 1.59 2.83s-.31.69-.69.93c-.67.44-.74.42-3.3-.83-2.3-1.14-2.68-1.25-3.28-.98-.84.38-.87 1.09-.13 3.74.71 2.56.62 3.5-.36 3.84-.7.25-.86.14-2.88-1.91-3.1-3.16-3.7-2.93-4.14 1.52-.21 2.1-.39 2.85-.74 3.11-.58.43-.93.42-1.53-.01zm.75-10.23c1.12-.29 2.78-.91 3.68-1.39a20.16 20.16 0 0 0 6.23-5.87c1.16-2.37 2.24-4.33 2.02-6.9l-7.43-.07c-6.82-.07-7.46-.03-7.85.4-.77.86-7.08 12.01-7.08 12.51 0 1.57 6.34 2.37 10.43 1.32zm-9.73-9.13c1.96-3.4 3.53-6.38 3.53-6.75 0-1.03-6.91-12.82-7.57-12.91-.74-.11-3.68 3.05-4.8 5.16a16.98 16.98 0 0 0-.02 15.46c1.12 2.1 4.08 5.3 4.8 5.2.39-.06 1.5-1.76 4.06-6.16zm21.18-12.13A17 17 0 0 0 30.1 10.42c-3.53-.89-9.8-.02-10 1.38-.08.5 6.05 11.48 7.03 12.61.38.43 1.02.46 7.84.4l7.43-.07c.19-1.27-.1-2.6-.48-3.67z"
            />
          </svg>
        </button>
      </div>

      <main
        className="notionhub-newtab-interface flex-1 w-full z-10 relative"
        style={interfaceFontStyle}>
        <div className="absolute top-[35%] left-1/2 -translate-x-1/2 -translate-y-1/2 text-center flex flex-col items-center justify-center w-full">
          <div className="flex flex-col items-center justify-center w-full overflow-visible">
            <Clock onClick={refreshBackground} />
          </div>
          <div className="w-full flex flex-col items-center justify-start mt-32">
            {settings.showHighlights && <HighlightQuote />}
          </div>
        </div>
      </main>

      <MusicPlayer />

      <SettingsPanel
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
      />
    </div>
  )
}
