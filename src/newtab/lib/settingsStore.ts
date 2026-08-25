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
  | "local"
export type DockModuleId =
  | "home"
  | "memos"
  | "movies"
  | "books"
  | "sports"

export interface DockModuleInfo {
  id: DockModuleId
  name: string
  iconName: string
  description: string
  defaultEnabled: boolean
}

export const DOCK_AVAILABLE_MODULES: DockModuleInfo[] = [
  {
    id: "home",
    name: "首页",
    iconName: "Home",
    description: "极简时钟与问候语",
    defaultEnabled: true
  },
  {
    id: "memos",
    name: "随笔",
    iconName: "PenLine",
    description: "个人动态、灵感碎片与随笔",
    defaultEnabled: true
  },
  {
    id: "movies",
    name: "观影",
    iconName: "Clapperboard",
    description: "豆瓣/Trakt 影视海报瀑布流",
    defaultEnabled: true
  },
  {
    id: "books",
    name: "书架",
    iconName: "Library",
    description: "微信读书与豆瓣书架",
    defaultEnabled: true
  },
  {
    id: "sports",
    name: "运动",
    iconName: "Flame",
    description: "Keep 运动打卡看板",
    defaultEnabled: true
  }
]

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

  enableMediaCache: boolean
  localFolderName?: string
  localFolderMediaCount?: number

  showDock: boolean
  enabledDockModules: DockModuleId[]
  dockCustomLabels?: Record<string, string>

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

  // 观影画廊设置
  moviesNotionToken?: string
  moviesNotionDatabaseId?: string
  moviesCoverProperty?: string
  moviesTitleProperty?: string
  moviesRatingProperty?: string
  moviesDateProperty?: string
  moviesReviewProperty?: string

  // 书架画廊设置
  booksSource?: "notion" | "weread"
  booksNotionToken?: string
  booksNotionDatabaseId?: string
  booksCoverProperty?: string
  booksTitleProperty?: string
  booksAuthorProperty?: string
  booksProgressProperty?: string
  booksRatingProperty?: string

  // 随笔/唠叨设置
  memosNotionToken?: string
  memosNotionDatabaseId?: string
  memosContentProperty?: string
  memosDateProperty?: string
  memosTagProperty?: string

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

  enableMediaCache: true,
  localFolderName: "",
  localFolderMediaCount: 0,

  showDock: true,
  enabledDockModules: [
    "home",
    "memos",
    "movies",
    "books",
    "sports"
  ],
  dockCustomLabels: {},

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

  moviesNotionToken: "",
  moviesNotionDatabaseId: "",
  moviesCoverProperty: "",
  moviesTitleProperty: "",
  moviesRatingProperty: "",
  moviesDateProperty: "",
  moviesReviewProperty: "",

  booksSource: "weread",
  booksNotionToken: "",
  booksNotionDatabaseId: "",
  booksCoverProperty: "",
  booksTitleProperty: "",
  booksAuthorProperty: "",
  booksProgressProperty: "",
  booksRatingProperty: "",

  memosNotionToken: "",
  memosNotionDatabaseId: "",
  memosContentProperty: "",
  memosDateProperty: "",
  memosTagProperty: "",

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
