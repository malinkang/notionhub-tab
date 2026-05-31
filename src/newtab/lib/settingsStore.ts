import { Storage } from "@plasmohq/storage"
import { useStorage } from "@plasmohq/storage/hook"

export const newTabStorage = new Storage({
  area: "local"
})

export const SYSTEM_FONT_STACK =
  "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif"

export type Theme = "light" | "dark" | "system"
export type BackgroundType = "image" | "video"
export type BackgroundFrequency = "tabs" | "hour" | "period" | "day" | "pause"
export type BackgroundProvider =
  | "apple"
  | "bing"
  | "unsplash"
  | "pixabay"
  | "notion"
export type NotionImageSource = "cover" | "files"
export type NotesSource = "notion" | "weread"

export interface NewTabSettings {
  theme: Theme

  backgroundType: BackgroundType
  backgroundProvider: BackgroundProvider
  backgroundSearchQuery: string
  backgroundFrequency: BackgroundFrequency
  backgroundRefreshTrigger: number
  backgroundOpacity: number
  muteVideo: boolean
  blurIntensity: number
  brightness: number
  fadeInTime: number
  textureOverlay: string
  unsplashAccessKey: string
  pixabayApiKey: string
  backgroundNotionToken: string
  backgroundNotionDatabaseId: string
  backgroundNotionImageSource: NotionImageSource
  backgroundNotionFilesProperty: string

  showMusicPlayer: boolean
  musicPlayerBgBlur: number
  enableAudioCache: boolean
  musicNotionToken: string
  musicNotionDatabaseId: string
  musicTitleProperty: string
  musicAudioProperty: string
  musicLyricsProperty: string
  musicCoverProperty: string
  musicArtistProperty: string

  timeEnable: boolean
  timeShowSeconds: boolean
  time12HourFormat: boolean
  timeDateFormat: string
  timeClockSize: number
  timeWorldClock: boolean
  timeTimezone: string
  timeDisplay: string

  showHighlights: boolean
  notesSource: NotesSource
  notesNotionToken: string
  notesNotionDatabaseId: string
  notesContentProperty: string
  notesTitleProperty: string
  notesSourceProperty: string
  notesDateProperty: string
  notesCoverProperty: string
  wereadApiKey: string
  highlightAlign: "left" | "center" | "right"
  highlightWidth: number
  highlightBgOpacity: number
  highlightBgBlur: number
  showHighlightCover: boolean
  showHighlightBg: boolean
  highlightFont: string

  globalFontFamily: string
  globalFontWeight: string
  globalFontSize: number
  globalTextShadow: number
}

export const defaultSettings: NewTabSettings = {
  theme: "system",

  backgroundType: "video",
  backgroundProvider: "apple",
  backgroundSearchQuery: "wallpaper",
  backgroundFrequency: "hour",
  backgroundRefreshTrigger: 0,
  backgroundOpacity: 100,
  muteVideo: true,
  blurIntensity: 0,
  brightness: 100,
  fadeInTime: 60,
  textureOverlay: "none",
  unsplashAccessKey: "",
  pixabayApiKey: "",
  backgroundNotionToken: "",
  backgroundNotionDatabaseId: "",
  backgroundNotionImageSource: "cover",
  backgroundNotionFilesProperty: "",

  showMusicPlayer: false,
  musicPlayerBgBlur: 24,
  enableAudioCache: true,
  musicNotionToken: "",
  musicNotionDatabaseId: "",
  musicTitleProperty: "",
  musicAudioProperty: "",
  musicLyricsProperty: "",
  musicCoverProperty: "",
  musicArtistProperty: "",

  timeEnable: true,
  timeShowSeconds: true,
  time12HourFormat: false,
  timeDateFormat: "cn",
  timeClockSize: 1,
  timeWorldClock: false,
  timeTimezone: "auto",
  timeDisplay: "all",

  showHighlights: false,
  notesSource: "notion",
  notesNotionToken: "",
  notesNotionDatabaseId: "",
  notesContentProperty: "",
  notesTitleProperty: "",
  notesSourceProperty: "",
  notesDateProperty: "",
  notesCoverProperty: "",
  wereadApiKey: "",
  highlightAlign: "left",
  highlightWidth: 672,
  highlightBgOpacity: 5,
  highlightBgBlur: 24,
  showHighlightCover: true,
  showHighlightBg: true,
  highlightFont: SYSTEM_FONT_STACK,

  globalFontFamily: SYSTEM_FONT_STACK,
  globalFontWeight: "300",
  globalFontSize: 16,
  globalTextShadow: 0.5
}

export function useNewTabSettings() {
  return useStorage<NewTabSettings>(
    {
      key: "notionhub_tab_settings",
      instance: newTabStorage
    },
    defaultSettings
  )
}
