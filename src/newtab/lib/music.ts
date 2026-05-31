import {
  getNotionPropertyFileUrl,
  getNotionPropertyText,
  queryNotionSource,
  type NotionPage
} from "./api"
import {
  defaultSettings,
  newTabStorage,
  type NewTabSettings
} from "./settingsStore"

const MUSIC_CACHE_KEY = "notionhub_tab_music_cache"
const MUSIC_CACHE_TTL_MS = 10 * 60 * 1000

export type MusicTrack = {
  id: string
  name: string
  artist: string
  url: string
  cover?: string
  lrc?: string
  notionUrl?: string
}

export type MusicLibraryResult = {
  tracks: MusicTrack[]
  status: "ready" | "missing_notion" | "empty" | "error"
  message?: string
  hasMore?: boolean
  nextCursor?: string | null
}

type MusicCache = {
  version: 1
  tokenHash: string
  databaseId: string
  mapping: string
  savedAt: number
  expiresAt: number
  result: MusicLibraryResult
}

type GetNotionMusicTracksOptions = {
  forceRefresh?: boolean
  cursor?: string | null
}

async function getSettings(): Promise<NewTabSettings> {
  const stored = await newTabStorage.get<Partial<NewTabSettings>>(
    "notionhub_tab_settings"
  )
  return { ...defaultSettings, ...(stored || {}) }
}

function hashText(value: string) {
  let hash = 0
  for (let i = 0; i < value.length; i += 1) {
    hash = (hash << 5) - hash + value.charCodeAt(i)
    hash |= 0
  }
  return String(Math.abs(hash))
}

function getMappingKey(settings: NewTabSettings) {
  return [
    settings.musicTitleProperty,
    settings.musicAudioProperty,
    settings.musicLyricsProperty,
    settings.musicCoverProperty,
    settings.musicArtistProperty
  ].join(":")
}

export async function clearMusicPlayerCache(): Promise<boolean> {
  await newTabStorage.remove(MUSIC_CACHE_KEY)
  return true
}

function isValidCache(
  cache: MusicCache | null | undefined,
  settings: NewTabSettings
): cache is MusicCache {
  return Boolean(
    cache &&
      cache.version === 1 &&
      cache.tokenHash === hashText(settings.musicNotionToken || "") &&
      cache.databaseId === settings.musicNotionDatabaseId &&
      cache.mapping === getMappingKey(settings) &&
      cache.expiresAt > Date.now() &&
      Array.isArray(cache.result?.tracks)
  )
}

async function getCachedResult(settings: NewTabSettings) {
  const cache = await newTabStorage.get<MusicCache>(MUSIC_CACHE_KEY)
  return isValidCache(cache, settings) ? cache.result : null
}

async function setCachedResult(
  settings: NewTabSettings,
  result: MusicLibraryResult
) {
  const savedAt = Date.now()
  await newTabStorage.set(MUSIC_CACHE_KEY, {
    version: 1,
    tokenHash: hashText(settings.musicNotionToken || ""),
    databaseId: settings.musicNotionDatabaseId,
    mapping: getMappingKey(settings),
    savedAt,
    expiresAt: savedAt + MUSIC_CACHE_TTL_MS,
    result
  } satisfies MusicCache)
}

function getPageCover(page: NotionPage): string {
  const cover = page.cover
  if (!cover) return ""
  if (cover.type === "external") return cover.external?.url || ""
  if (cover.type === "file") return cover.file?.url || ""
  return cover.external?.url || cover.file?.url || ""
}

function mapMusicTrack(
  page: NotionPage,
  settings: NewTabSettings
): MusicTrack | null {
  const properties = page.properties || {}
  const audio = getNotionPropertyFileUrl(
    properties[settings.musicAudioProperty || ""]
  )
  if (!audio) return null

  const title =
    getNotionPropertyText(properties[settings.musicTitleProperty || ""]) ||
    "Untitled"
  const artist = getNotionPropertyText(
    properties[settings.musicArtistProperty || ""]
  )
  const lrc = getNotionPropertyFileUrl(
    properties[settings.musicLyricsProperty || ""]
  )
  const cover =
    getNotionPropertyFileUrl(properties[settings.musicCoverProperty || ""]) ||
    getPageCover(page)

  return {
    id: page.id,
    name: title,
    artist,
    url: audio,
    cover: cover || undefined,
    lrc: lrc || undefined,
    notionUrl: page.url || `https://www.notion.so/${page.id.replace(/-/g, "")}`
  }
}

export async function getNotionMusicTracks(
  options: GetNotionMusicTracksOptions = {}
): Promise<MusicLibraryResult> {
  try {
    const settings = await getSettings()

    if (
      !settings.musicNotionToken ||
      !settings.musicNotionDatabaseId ||
      !settings.musicAudioProperty ||
      !settings.musicTitleProperty
    ) {
      return {
        tracks: [],
        status: "missing_notion",
        message: "请先配置 Notion 音乐数据库和字段映射。"
      }
    }

    if (!options.forceRefresh && !options.cursor) {
      const cached = await getCachedResult(settings)
      if (cached) return cached
    }

    const response = await queryNotionSource(
      settings.musicNotionToken,
      settings.musicNotionDatabaseId,
      {
        page_size: 50,
        start_cursor: options.cursor || undefined
      }
    )
    const tracks = (response.results || [])
      .map((page) => mapMusicTrack(page, settings))
      .filter(Boolean) as MusicTrack[]
    const result: MusicLibraryResult = {
      tracks,
      status: tracks.length > 0 ? "ready" : "empty",
      message: tracks.length > 0 ? undefined : "没有找到包含音频文件的歌曲。",
      hasMore: response.has_more,
      nextCursor: response.next_cursor || null
    }

    if (!options.cursor) {
      await setCachedResult(settings, result)
    }

    return result
  } catch (error) {
    console.warn("[NotionHub Tab] Failed to load music:", error)
    return {
      tracks: [],
      status: "error",
      message: "读取 Notion 音乐库失败，请检查配置。"
    }
  }
}

export async function refreshMusicTrack(
  id: string
): Promise<MusicTrack | null> {
  const settings = await getSettings()
  if (!settings.musicNotionToken || !settings.musicNotionDatabaseId) {
    return null
  }

  const response = await fetch(`https://api.notion.com/v1/pages/${id}`, {
    headers: {
      Authorization: `Bearer ${settings.musicNotionToken}`,
      "Notion-Version": "2025-09-03"
    }
  })

  if (!response.ok) return null

  return mapMusicTrack((await response.json()) as NotionPage, settings)
}
