import {
  AlertCircle,
  CircleHelp,
  Eye,
  EyeOff,
  FolderOpen,
  HardDrive,
  RefreshCw,
  X,
  ChevronUp,
  ChevronDown,
  RotateCcw,
  Lock
} from "lucide-react"
import React, { useEffect, useState } from "react"
import toast from "react-hot-toast"

import { fetchNotionProperties, type NotionPropertySchema } from "../lib/api"
import { pickLocalFolder } from "../lib/localFolder"
import { clearMediaCache, getMediaCacheStats } from "../lib/mediaCache"
import { clearMusicPlayerCache } from "../lib/music"
import { normalizeNotionId } from "../lib/notion"
import {
  DOCK_AVAILABLE_MODULES,
  SYSTEM_FONT_STACK,
  useNewTabSettings,
  type BackgroundFrequency,
  type BackgroundProvider,
  type BackgroundType,
  type DockModuleId,
  type NewTabSettings,
  type NotesSource,
  type NotionImageSource,
  type Theme
} from "../lib/settingsStore"

interface SettingsPanelProps {
  isOpen: boolean
  onClose: () => void
}

type NotionSchemaTarget =
  | "background"
  | "notes"
  | "music"
  | "movies"
  | "books"
  | "memos"

const fontOptions = [
  { label: "系统默认", value: SYSTEM_FONT_STACK },
  {
    label: "落霞文楷",
    value: "'LXGW WenKai Screen', 'LXGW WenKai', sans-serif"
  },
  { label: "思源黑体", value: "'Noto Sans SC', sans-serif" },
  { label: "思源宋体", value: "'Noto Serif SC', serif" },
  { label: "汇文明朝体", value: "'Huiwen-mincho', serif" },
  { label: "悠哉字体", value: "'Yozai', sans-serif" },
  { label: "得意黑", value: "'Smiley Sans Oblique', sans-serif" }
]

const fontWeightOptions = [
  { label: "细", value: "300" },
  { label: "正常", value: "400" },
  { label: "中粗", value: "500" },
  { label: "粗体", value: "700" },
  { label: "超粗", value: "800" }
]

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <div className="mt-8 mx-5 text-[15px] text-base-content/60 font-medium">
      {children}
    </div>
  )
}

function Card({ children }: { children: React.ReactNode }) {
  return (
    <div className="mt-3 mx-5 bg-base-100 dark:bg-base-100/50 rounded-2xl shadow-sm border border-base-content/5 divide-y divide-base-content/5 mb-8">
      {children}
    </div>
  )
}

function Row({
  label,
  children,
  className = ""
}: {
  label: string
  children: React.ReactNode
  className?: string
}) {
  return (
    <div
      className={`flex items-center justify-between min-h-[44px] px-4 py-2.5 gap-4 ${className}`}>
      <label className="text-[15px] font-normal text-base-content whitespace-nowrap">
        {label}
      </label>
      {children}
    </div>
  )
}

function SelectBox({
  value,
  onChange,
  children
}: {
  value: string
  onChange: (value: string) => void
  children: React.ReactNode
}) {
  return (
    <div className="bg-base-200/50 rounded-lg px-2">
      <select
        className="select select-sm w-fit max-w-[210px] text-[14px] bg-transparent focus:outline-none border-none font-normal px-1 pr-6"
        value={value}
        onChange={(e) => onChange(e.target.value)}>
        {children}
      </select>
    </div>
  )
}

function TextInput({
  value,
  onChange,
  placeholder = "",
  type = "text"
}: {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  type?: React.HTMLInputTypeAttribute
}) {
  return (
    <div className="bg-base-200/50 rounded-lg px-2 flex items-center h-8 ml-4 min-w-0">
      <input
        type={type}
        className="input input-sm w-full max-w-[210px] text-[14px] bg-transparent focus:outline-none border-none font-normal px-1 text-right placeholder-base-content/30"
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  )
}

function SecretInput({
  value,
  onChange,
  placeholder = "Token 或 Key"
}: {
  value: string
  onChange: (value: string) => void
  placeholder?: string
}) {
  const [show, setShow] = useState(false)

  return (
    <div className="bg-base-200/50 rounded-lg px-2 flex items-center h-8 ml-4 min-w-0">
      <input
        type={show ? "text" : "password"}
        className="input input-sm w-full max-w-[185px] text-[14px] bg-transparent focus:outline-none border-none font-normal px-1 text-right placeholder-base-content/30 tracking-tight"
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
      <button
        type="button"
        className="btn btn-circle btn-xs btn-ghost h-6 min-h-6 w-6 p-0 text-base-content/50 hover:text-base-content flex-shrink-0 ml-1"
        aria-label={show ? "隐藏内容" : "显示内容"}
        title={show ? "隐藏" : "显示"}
        onClick={() => setShow((v) => !v)}>
        {show ? <EyeOff size={14} /> : <Eye size={14} />}
      </button>
    </div>
  )
}

function PropertySelect({
  value,
  properties,
  onChange,
  optional = false,
  allowPageCover = false,
  filterTypes
}: {
  value: string
  properties: NotionPropertySchema[]
  onChange: (value: string) => void
  optional?: boolean
  allowPageCover?: boolean
  filterTypes?: string[]
}) {
  const filtered = filterTypes
    ? properties.filter((p) => filterTypes.includes(p.type))
    : properties

  return (
    <SelectBox value={value} onChange={onChange}>
      {optional && <option value="">不选择</option>}
      {allowPageCover && (
        <option value="__page_cover__">页面封面</option>
      )}
      {!filtered.length && !allowPageCover && (
        <option value={value}>
          {value ||
            (filterTypes
              ? properties.length > 0
                ? `未找到对应属性(库内有${properties.length}个属性)`
                : "未找到对应属性"
              : "未读取到属性")}
        </option>
      )}
      {filtered.map((property) => (
        <option key={property.name} value={property.name}>
          {property.name}
        </option>
      ))}
    </SelectBox>
  )
}

export default function SettingsPanel({ isOpen, onClose }: SettingsPanelProps) {
  const [settings, setSettings] = useNewTabSettings()
  const [clearingCache, setClearingCache] = useState(false)
  const [clearedCache, setClearedCache] = useState(false)
  const [loadingSchema, setLoadingSchema] = useState<NotionSchemaTarget | null>(
    null
  )
  const [backgroundProperties, setBackgroundProperties] = useState<
    NotionPropertySchema[]
  >([])
  const [notesProperties, setNotesProperties] = useState<
    NotionPropertySchema[]
  >([])
  const [musicProperties, setMusicProperties] = useState<
    NotionPropertySchema[]
  >([])
  const [moviesProperties, setMoviesProperties] = useState<
    NotionPropertySchema[]
  >([])
  const [booksProperties, setBooksProperties] = useState<
    NotionPropertySchema[]
  >([])
  const [memosProperties, setMemosProperties] = useState<
    NotionPropertySchema[]
  >([])

  const [schemaErrors, setSchemaErrors] = useState<
    Record<NotionSchemaTarget, string | null>
  >({
    background: null,
    notes: null,
    music: null,
    movies: null,
    books: null,
    memos: null
  })

  const [mediaStats, setMediaStats] = useState<{
    count: number
    formattedSize: string
  }>({ count: 0, formattedSize: "0 MB" })
  const [clearingMediaCache, setClearingMediaCache] = useState(false)

  const refreshMediaCacheStats = async () => {
    const stats = await getMediaCacheStats()
    setMediaStats({
      count: stats.count,
      formattedSize: stats.formattedSize
    })
  }

  useEffect(() => {
    if (isOpen) {
      void refreshMediaCacheStats()
    }
  }, [isOpen])

  if (!settings) return null

  const updateSetting = <K extends keyof NewTabSettings>(
    key: K,
    value: NewTabSettings[K]
  ) => {
    setSettings((prev) => {
      if (!prev) return prev
      const isBgKey =
        key.toString().startsWith("background") ||
        key.toString().startsWith("localFolder") ||
        key === "enableMediaCache" ||
        key === "unsplashAccessKey" ||
        key === "pixabayApiKey"
      return {
        ...prev,
        [key]: value,
        ...(isBgKey ? { backgroundRefreshTrigger: Date.now() } : {})
      }
    })
  }

  const handlePickFolder = async () => {
    try {
      const result = await pickLocalFolder()
      if (result) {
        setSettings((prev) => {
          if (!prev) return prev
          return {
            ...prev,
            localFolderName: result.name,
            localFolderMediaCount: result.count,
            backgroundProvider: "local",
            backgroundRefreshTrigger: Date.now()
          }
        })
        toast.success(
          `已绑定本地文件夹: ${result.name} (找到 ${result.count} 个媒体文件)`
        )
      }
    } catch (err: any) {
      console.warn("Pick folder failed:", err)
      toast.error(err?.message || "选择文件夹失败")
    }
  }

  const handleClearMediaCache = async () => {
    setClearingMediaCache(true)
    await clearMediaCache()
    await refreshMediaCacheStats()
    setClearingMediaCache(false)
    toast.success("已清空本地离线媒体缓存")
  }

  const handleClearCache = async () => {
    setClearingCache(true)
    const success = await clearMusicPlayerCache()
    setClearingCache(false)
    if (success) {
      setClearedCache(true)
      setTimeout(() => setClearedCache(false), 2000)
    }
  }

  const updateBackgroundType = (backgroundType: BackgroundType) => {
    setSettings((prev) => {
      if (!prev) return prev
      return {
        ...prev,
        backgroundType,
        backgroundProvider:
          backgroundType === "video"
            ? prev.backgroundProvider === "pixabay"
              ? "pixabay"
              : "apple"
            : prev.backgroundProvider === "bing"
              ? "bing"
              : "unsplash"
      }
    })
  }

  const handleDatabaseIdChange = (
    key:
      | "backgroundNotionDatabaseId"
      | "notesNotionDatabaseId"
      | "musicNotionDatabaseId"
      | "moviesNotionDatabaseId"
      | "booksNotionDatabaseId"
      | "memosNotionDatabaseId",
    rawVal: string
  ) => {
    const clean = rawVal.trim()
    if (
      clean.includes("http") ||
      clean.includes("notion.") ||
      clean.includes("?") ||
      clean.includes("#") ||
      clean.includes("-")
    ) {
      const normalized = normalizeNotionId(clean)
      updateSetting(key, normalized || clean)
    } else {
      updateSetting(key, clean)
    }
  }

  const getSchemaCredentials = (target: NotionSchemaTarget) => {
    const token =
      target === "background"
        ? settings.backgroundNotionToken
        : target === "notes"
          ? settings.notesNotionToken
          : target === "music"
            ? settings.musicNotionToken
            : target === "movies"
              ? settings.moviesNotionToken || settings.backgroundNotionToken
              : target === "books"
                ? settings.booksNotionToken || settings.backgroundNotionToken
                : settings.memosNotionToken || settings.backgroundNotionToken
    const rawDatabaseId =
      target === "background"
        ? settings.backgroundNotionDatabaseId
        : target === "notes"
          ? settings.notesNotionDatabaseId
          : target === "music"
            ? settings.musicNotionDatabaseId
            : target === "movies"
              ? settings.moviesNotionDatabaseId || ""
              : target === "books"
                ? settings.booksNotionDatabaseId || ""
                : settings.memosNotionDatabaseId || ""

    return {
      token: (token || "").trim(),
      databaseId: normalizeNotionId(rawDatabaseId)
    }
  }

  const clearProperties = (target: NotionSchemaTarget) => {
    if (target === "background") setBackgroundProperties([])
    if (target === "notes") setNotesProperties([])
    if (target === "music") setMusicProperties([])
    if (target === "movies") setMoviesProperties([])
    if (target === "books") setBooksProperties([])
    if (target === "memos") setMemosProperties([])
  }

  const loadSchema = async (target: NotionSchemaTarget, showToast = false) => {
    const { token, databaseId } = getSchemaCredentials(target)

    if (!token || !databaseId) {
      clearProperties(target)
      setSchemaErrors((prev) => ({ ...prev, [target]: null }))
      return
    }

    setLoadingSchema(target)
    setSchemaErrors((prev) => ({ ...prev, [target]: null }))
    try {
      const properties = await fetchNotionProperties(token, databaseId)
      if (target === "background") {
        setBackgroundProperties(properties)
        const fileProp = properties.find(
          (p) => p.type === "files" || p.type === "url"
        )
        if (fileProp && !settings.backgroundNotionFilesProperty) {
          updateSetting("backgroundNotionFilesProperty", fileProp.name)
        }
      }
      if (target === "notes") {
        setNotesProperties(properties)
        const contentProp = properties.find(
          (p) => p.type === "rich_text" || p.type === "title"
        )
        if (contentProp && !settings.notesContentProperty) {
          updateSetting("notesContentProperty", contentProp.name)
        }
      }
      if (target === "music") {
        setMusicProperties(properties)
        const titleProp = properties.find(
          (p) =>
            p.type === "title" ||
            p.name.includes("歌") ||
            p.name.toLowerCase().includes("title") ||
            p.name.toLowerCase().includes("name")
        )
        const audioProp = properties.find(
          (p) =>
            p.type === "files" ||
            p.name.includes("音频") ||
            p.name.toLowerCase().includes("audio") ||
            p.name.toLowerCase().includes("file")
        )
        if (titleProp && !settings.musicTitleProperty) {
          updateSetting("musicTitleProperty", titleProp.name)
        }
        if (audioProp && !settings.musicAudioProperty) {
          updateSetting("musicAudioProperty", audioProp.name)
        }
      }
      if (target === "movies") {
        setMoviesProperties(properties)
        const titleProp =
          properties.find((p) => p.type === "title") ||
          properties.find(
            (p) => p.name.includes("电影") || p.name.includes("名")
          )
        const ratingProp = properties.find(
          (p) =>
            p.name.includes("评分") ||
            p.name.includes("分") ||
            p.name.toLowerCase().includes("rating") ||
            p.name.toLowerCase().includes("score")
        )
        const dateProp = properties.find(
          (p) =>
            p.name.includes("上映") ||
            p.name.includes("观影") ||
            p.name.includes("日期") ||
            p.name.includes("时间") ||
            p.type === "date"
        )
        const reviewProp = properties.find(
          (p) =>
            p.name.includes("短评") ||
            p.name.includes("影评") ||
            p.name.includes("评价") ||
            p.name.includes("剧情")
        )
        if (titleProp && !settings.moviesTitleProperty) {
          updateSetting("moviesTitleProperty", titleProp.name)
        }
        if (ratingProp && !settings.moviesRatingProperty) {
          updateSetting("moviesRatingProperty", ratingProp.name)
        }
        if (dateProp && !settings.moviesDateProperty) {
          updateSetting("moviesDateProperty", dateProp.name)
        }
        if (reviewProp && !settings.moviesReviewProperty) {
          updateSetting("moviesReviewProperty", reviewProp.name)
        }
      }
      if (target === "books") {
        setBooksProperties(properties)
        const titleProp =
          properties.find((p) => p.type === "title") ||
          properties.find(
            (p) => p.name.includes("书") || p.name.includes("名")
          )
        const authorProp = properties.find(
          (p) =>
            p.name.includes("作") || p.name.toLowerCase().includes("author")
        )
        const progressProp = properties.find(
          (p) =>
            p.name.includes("进度") ||
            p.name.toLowerCase().includes("progress")
        )
        const ratingProp = properties.find(
          (p) =>
            p.name.includes("评分") ||
            p.name.includes("分") ||
            p.name.toLowerCase().includes("rating")
        )
        if (titleProp && !settings.booksTitleProperty) {
          updateSetting("booksTitleProperty", titleProp.name)
        }
        if (authorProp && !settings.booksAuthorProperty) {
          updateSetting("booksAuthorProperty", authorProp.name)
        }
        if (progressProp && !settings.booksProgressProperty) {
          updateSetting("booksProgressProperty", progressProp.name)
        }
        if (ratingProp && !settings.booksRatingProperty) {
          updateSetting("booksRatingProperty", ratingProp.name)
        }
      }
      if (target === "memos") {
        setMemosProperties(properties)
        const contentProp =
          properties.find((p) => p.type === "title") ||
          properties.find((p) => p.type === "rich_text") ||
          properties.find((p) => p.name.includes("内容"))
        const dateProp = properties.find(
          (p) =>
            p.type === "date" ||
            p.type === "created_time" ||
            p.name.includes("日期") ||
            p.name.includes("时间")
        )
        const tagProp = properties.find(
          (p) =>
            p.name.includes("标签") ||
            p.name.includes("tag") ||
            p.type === "multi_select" ||
            p.type === "select"
        )
        if (contentProp && !settings.memosContentProperty) {
          updateSetting("memosContentProperty", contentProp.name)
        }
        if (dateProp && !settings.memosDateProperty) {
          updateSetting("memosDateProperty", dateProp.name)
        }
        if (tagProp && !settings.memosTagProperty) {
          updateSetting("memosTagProperty", tagProp.name)
        }
      }
      if (showToast) {
        toast.success(`成功读取 ${properties.length} 个属性`)
      }
    } catch (error) {
      const errorMsg =
        error instanceof Error ? error.message : "读取 Notion 数据库失败"
      console.warn("[NotionHub Tab] Failed to load Notion schema:", error)
      clearProperties(target)
      setSchemaErrors((prev) => ({ ...prev, [target]: errorMsg }))
      if (showToast) {
        toast.error(errorMsg)
      }
    } finally {
      setLoadingSchema(null)
    }
  }

  const backgroundProvider =
    settings.backgroundType === "video"
      ? settings.backgroundProvider === "pixabay"
        ? "pixabay"
        : settings.backgroundProvider === "notion"
          ? "notion"
          : "apple"
      : ["bing", "unsplash", "pixabay", "notion"].includes(
            settings.backgroundProvider
          )
        ? settings.backgroundProvider
        : "bing"

  useEffect(() => {
    if (backgroundProvider !== "notion") {
      setBackgroundProperties([])
      return
    }

    const { token, databaseId } = getSchemaCredentials("background")
    if (!token || !databaseId) {
      setBackgroundProperties([])
      return
    }

    void loadSchema("background")
  }, [
    backgroundProvider,
    settings.backgroundNotionToken,
    settings.backgroundNotionDatabaseId
  ])

  useEffect(() => {
    if (settings.notesSource !== "notion") {
      setNotesProperties([])
      return
    }

    const { token, databaseId } = getSchemaCredentials("notes")
    if (!token || !databaseId) {
      setNotesProperties([])
      return
    }

    void loadSchema("notes")
  }, [
    settings.notesSource,
    settings.notesNotionToken,
    settings.notesNotionDatabaseId
  ])

  useEffect(() => {
    if (!settings.showMusicPlayer) {
      setMusicProperties([])
      return
    }

    const { token, databaseId } = getSchemaCredentials("music")
    if (!token || !databaseId) {
      setMusicProperties([])
      return
    }

    void loadSchema("music")
  }, [
    settings.showMusicPlayer,
    settings.musicNotionToken,
    settings.musicNotionDatabaseId
  ])

  const renderSchemaStatus = (target: NotionSchemaTarget) => {
    if (loadingSchema !== target) return null

    return (
      <Row label="字段">
        <div className="flex items-center gap-2 text-sm text-base-content/50">
          <RefreshCw size={14} className="animate-spin" />
          <span>正在读取...</span>
        </div>
      </Row>
    )
  }

  return (
    <>
      {isOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/10 backdrop-blur-sm sm:hidden transition-opacity"
          onClick={onClose}
        />
      )}

      <aside
        className={`fixed top-0 right-0 h-full w-full sm:w-[450px] bg-base-200/85 dark:bg-base-300/85 backdrop-blur-2xl shadow-2xl z-50 transform transition-transform duration-300 ease-in-out flex flex-col border-l border-base-content/5 ${isOpen ? "translate-x-0" : "translate-x-full"}`}>
        <div className="flex items-center justify-between px-5 pt-6 pb-2">
          <h2 className="text-xl font-medium tracking-tight text-base-content/90">
            Settings
          </h2>
          <button
            onClick={onClose}
            className="btn btn-ghost btn-sm btn-circle text-base-content/60 hover:text-base-content">
            <X size={20} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto pb-12 overflow-x-hidden pb-safe">
          <SectionTitle>通用</SectionTitle>
          <Card>
            <Row label="深色模式">
              <SelectBox
                value={settings.theme}
                onChange={(value) => updateSetting("theme", value as Theme)}>
                <option value="system">系统</option>
                <option value="light">浅色</option>
                <option value="dark">深色</option>
              </SelectBox>
            </Row>
          </Card>

          <SectionTitle>时间和日期</SectionTitle>
          <Card>
            <Row label="启用">
              <input
                type="checkbox"
                className="bonjourr-switch"
                checked={settings.timeEnable ?? true}
                onChange={(e) => updateSetting("timeEnable", e.target.checked)}
              />
            </Row>
            {(settings.timeEnable ?? true) && (
              <>
                <Row label="显示秒">
                  <input
                    type="checkbox"
                    className="bonjourr-switch"
                    checked={settings.timeShowSeconds ?? false}
                    onChange={(e) =>
                      updateSetting("timeShowSeconds", e.target.checked)
                    }
                  />
                </Row>
                <Row label="12 小时制">
                  <input
                    type="checkbox"
                    className="bonjourr-switch"
                    checked={settings.time12HourFormat ?? false}
                    onChange={(e) =>
                      updateSetting("time12HourFormat", e.target.checked)
                    }
                  />
                </Row>
                <Row label="时钟大小">
                  <input
                    type="range"
                    className="bonjourr-slider w-full max-w-[140px]"
                    min="0.25"
                    max="2.25"
                    step="0.125"
                    value={settings.timeClockSize ?? 1}
                    onChange={(e) =>
                      updateSetting("timeClockSize", parseFloat(e.target.value))
                    }
                  />
                </Row>
                <Row label="显示">
                  <SelectBox
                    value={settings.timeDisplay || "all"}
                    onChange={(value) => updateSetting("timeDisplay", value)}>
                    <option value="all">时钟和日期</option>
                    <option value="date">仅时钟</option>
                    <option value="clock">仅日期</option>
                  </SelectBox>
                </Row>
              </>
            )}
          </Card>

          <SectionTitle>背景</SectionTitle>
          <Card>
            <Row label="背景类型">
              <SelectBox
                value={settings.backgroundType}
                onChange={(value) =>
                  updateBackgroundType(value as BackgroundType)
                }>
                <option value="video">视频</option>
                <option value="image">图片</option>
              </SelectBox>
            </Row>
            <Row label="提供者">
              <SelectBox
                value={backgroundProvider}
                onChange={(value) =>
                  updateSetting(
                    "backgroundProvider",
                    value as BackgroundProvider
                  )
                }>
                {settings.backgroundType === "video" ? (
                  <>
                    <option value="apple">Apple</option>
                    <option value="pixabay">Pixabay</option>
                    <option value="notion">Notion</option>
                    <option value="local">📁 本地文件夹</option>
                  </>
                ) : (
                  <>
                    <option value="bing">Bing</option>
                    <option value="unsplash">Unsplash</option>
                    <option value="pixabay">Pixabay</option>
                    <option value="notion">Notion</option>
                    <option value="local">📁 本地文件夹</option>
                  </>
                )}
              </SelectBox>
            </Row>
            {backgroundProvider === "local" && (
              <>
                <Row label="本地文件夹">
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      className="btn btn-sm btn-ghost bg-base-200/60 hover:bg-base-200 font-normal px-3 flex items-center gap-1.5"
                      onClick={handlePickFolder}>
                      <FolderOpen size={15} />
                      <span className="max-w-[150px] truncate">
                        {settings.localFolderName
                          ? settings.localFolderName
                          : "选择本地文件夹"}
                      </span>
                    </button>
                  </div>
                </Row>
                {settings.localFolderName ? (
                  <div className="px-4 py-2 text-xs text-base-content/60 bg-base-200/30 flex items-center justify-between">
                    <span>
                      📂 目录内已扫描到{" "}
                      <strong>{settings.localFolderMediaCount ?? 0}</strong>{" "}
                      个支持的媒体文件
                    </span>
                    <button
                      type="button"
                      className="text-xs text-primary hover:underline"
                      onClick={handlePickFolder}>
                      更换文件夹
                    </button>
                  </div>
                ) : (
                  <div className="px-4 py-2 text-xs text-amber-500/90 bg-amber-500/10">
                    💡 请点击上方按钮选择包含视频（.mp4/.mov）或图片（.jpg/.png）的本地文件夹
                  </div>
                )}
              </>
            )}
            {["unsplash", "pixabay"].includes(backgroundProvider) && (
              <>
                <Row label="搜索关键字">
                  <TextInput
                    value={settings.backgroundSearchQuery || "wallpaper"}
                    placeholder="wallpaper"
                    onChange={(value) =>
                      updateSetting("backgroundSearchQuery", value)
                    }
                  />
                </Row>
                {backgroundProvider === "unsplash" && (
                  <>
                    <Row label="Unsplash Key">
                      <SecretInput
                        value={settings.unsplashAccessKey}
                        placeholder="Access Key"
                        onChange={(value) =>
                          updateSetting("unsplashAccessKey", value)
                        }
                      />
                    </Row>
                    {!settings.unsplashAccessKey?.trim() && (
                      <div className="px-4 py-2 text-xs text-base-content/50 bg-base-200/30">
                        💡 未填写 Access Key 时，将自动展示 Bing 每日壁纸
                      </div>
                    )}
                  </>
                )}
                {backgroundProvider === "pixabay" && (
                  <>
                    <Row label="Pixabay Key">
                      <SecretInput
                        value={settings.pixabayApiKey}
                        placeholder="API Key"
                        onChange={(value) =>
                          updateSetting("pixabayApiKey", value)
                        }
                      />
                    </Row>
                    {!settings.pixabayApiKey?.trim() && (
                      <div className="px-4 py-2 text-xs text-base-content/50 bg-base-200/30">
                        💡 未填写 API Key 时，将自动展示默认
                        {settings.backgroundType === "video" ? "视频" : "壁纸"}
                      </div>
                    )}
                  </>
                )}
              </>
            )}
            {backgroundProvider === "notion" && (
              <>
                <Row label="Notion Token">
                  <SecretInput
                    value={settings.backgroundNotionToken}
                    placeholder="ntn_..."
                    onChange={(value) =>
                      updateSetting("backgroundNotionToken", value)
                    }
                  />
                </Row>
                <Row label="数据库 ID">
                  <div className="flex items-center gap-2">
                    <TextInput
                      value={settings.backgroundNotionDatabaseId}
                      placeholder="Database ID 或 Notion 链接"
                      onChange={(value) =>
                        handleDatabaseIdChange(
                          "backgroundNotionDatabaseId",
                          value
                        )
                      }
                    />
                    <button
                      type="button"
                      className="btn btn-circle btn-xs btn-ghost h-8 min-h-8 w-8 p-0 text-base-content/60 hover:text-base-content flex-shrink-0"
                      title="读取/刷新属性结构"
                      disabled={loadingSchema === "background"}
                      onClick={() => void loadSchema("background", true)}>
                      <RefreshCw
                        size={14}
                        className={
                          loadingSchema === "background" ? "animate-spin" : ""
                        }
                      />
                    </button>
                  </div>
                </Row>
                {schemaErrors.background && (
                  <div className="mx-4 my-2 p-3 rounded-xl bg-error/10 border border-error/20 text-error text-xs flex items-start gap-2">
                    <AlertCircle size={15} className="flex-shrink-0 mt-0.5" />
                    <div className="flex-1 leading-relaxed">
                      {schemaErrors.background}
                    </div>
                  </div>
                )}
                {(!settings.backgroundNotionToken?.trim() ||
                  !settings.backgroundNotionDatabaseId?.trim()) && (
                  <div className="px-4 py-2 text-xs text-base-content/50 bg-base-200/30">
                    💡 未填写完整凭证时，将自动展示 Bing 每日壁纸
                  </div>
                )}
                <Row label="图片来源">
                  <SelectBox
                    value={settings.backgroundNotionImageSource}
                    onChange={(value) =>
                      updateSetting(
                        "backgroundNotionImageSource",
                        value as NotionImageSource
                      )
                    }>
                    <option value="cover">页面封面</option>
                    <option value="files">文件属性</option>
                  </SelectBox>
                </Row>
                {settings.backgroundNotionImageSource === "files" && (
                  <>
                    <Row label="文件">
                      <PropertySelect
                        value={settings.backgroundNotionFilesProperty}
                        properties={backgroundProperties}
                        filterTypes={["files", "url"]}
                        onChange={(value) =>
                          updateSetting(
                            "backgroundNotionFilesProperty",
                            value
                          )
                        }
                      />
                    </Row>
                    {backgroundProperties.length > 0 &&
                      !backgroundProperties.some(
                        (p) => p.type === "files" || p.type === "url"
                      ) && (
                        <div className="mx-4 my-2 p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-500 text-xs leading-relaxed">
                          💡 该数据库暂无 <strong>Files（文件与媒体）</strong> 属性。若要直接使用封面，请将「图片来源」切换为 <strong>页面封面</strong>；或在 Notion 数据库中新增一个 Files 属性并上传图片。
                        </div>
                      )}
                  </>
                )}
              </>
            )}
            <Row label="切换频率">
              <div className="flex items-center gap-2">
                <SelectBox
                  value={settings.backgroundFrequency || "hour"}
                  onChange={(value) =>
                    updateSetting(
                      "backgroundFrequency",
                      value as BackgroundFrequency
                    )
                  }>
                  <option value="tabs">每次打开</option>
                  <option value="hour">每小时</option>
                  <option value="day">每天</option>
                  <option value="pause">暂停</option>
                </SelectBox>
                <button
                  className="w-8 h-8 rounded-lg bg-base-200/50 flex items-center justify-center hover:bg-base-300 active:scale-95 transition-transform"
                  onClick={() =>
                    updateSetting("backgroundRefreshTrigger", Date.now())
                  }
                  title="刷新背景">
                  <RefreshCw size={14} />
                </button>
              </div>
            </Row>
            <Row label="静音视频">
              <input
                type="checkbox"
                className="bonjourr-switch"
                checked={settings.muteVideo}
                onChange={(e) => updateSetting("muteVideo", e.target.checked)}
              />
            </Row>
            <Row label="模糊度">
              <input
                type="range"
                className="bonjourr-slider w-full max-w-[140px]"
                min="0"
                max="100"
                value={settings.blurIntensity}
                onChange={(e) =>
                  updateSetting("blurIntensity", parseInt(e.target.value))
                }
                style={
                  {
                    "--val": `${settings.blurIntensity}%`
                  } as React.CSSProperties
                }
              />
            </Row>
            <Row label="亮度">
              <input
                type="range"
                className="bonjourr-slider w-full max-w-[140px]"
                min="0"
                max="100"
                value={settings.brightness}
                onChange={(e) =>
                  updateSetting("brightness", parseInt(e.target.value))
                }
                style={
                  { "--val": `${settings.brightness}%` } as React.CSSProperties
                }
              />
            </Row>
            <Row label="淡入时间">
              <input
                type="range"
                className="bonjourr-slider w-full max-w-[140px]"
                min="0"
                max="100"
                value={settings.fadeInTime}
                onChange={(e) =>
                  updateSetting("fadeInTime", parseInt(e.target.value))
                }
                style={
                  { "--val": `${settings.fadeInTime}%` } as React.CSSProperties
                }
              />
            </Row>
            <Row label="离线媒体缓存">
              <input
                type="checkbox"
                className="bonjourr-switch"
                checked={settings.enableMediaCache ?? true}
                onChange={(e) =>
                  updateSetting("enableMediaCache", e.target.checked)
                }
              />
            </Row>
            {(settings.enableMediaCache ?? true) && (
              <Row label="离线缓存管理">
                <div className="flex items-center gap-2.5">
                  <span className="text-xs text-base-content/50">
                    {mediaStats.count > 0
                      ? `${mediaStats.count} 个文件 (${mediaStats.formattedSize})`
                      : "暂无缓存"}
                  </span>
                  <button
                    type="button"
                    className="btn btn-xs btn-ghost text-red-500 hover:bg-red-500/10 font-normal px-2"
                    onClick={handleClearMediaCache}
                    disabled={clearingMediaCache || mediaStats.count === 0}>
                    {clearingMediaCache ? "清理中..." : "清空缓存"}
                  </button>
                </div>
              </Row>
            )}
          </Card>

          <SectionTitle>笔记</SectionTitle>
          <Card>
            <Row label="启用">
              <input
                type="checkbox"
                className="bonjourr-switch"
                checked={settings.showHighlights}
                onChange={(e) =>
                  updateSetting("showHighlights", e.target.checked)
                }
              />
            </Row>
            <Row label="来源">
              <SelectBox
                value={settings.notesSource}
                onChange={(value) =>
                  updateSetting("notesSource", value as NotesSource)
                }>
                <option value="notion">Notion</option>
                <option value="weread">微信读书</option>
              </SelectBox>
            </Row>
            {settings.notesSource === "notion" ? (
              <>
                <Row label="Notion Token">
                  <SecretInput
                    value={settings.notesNotionToken}
                    placeholder="ntn_..."
                    onChange={(value) =>
                      updateSetting("notesNotionToken", value)
                    }
                  />
                </Row>
                <Row label="数据库 ID">
                  <div className="flex items-center gap-2">
                    <TextInput
                      value={settings.notesNotionDatabaseId}
                      placeholder="Database ID 或 Notion 链接"
                      onChange={(value) =>
                        handleDatabaseIdChange("notesNotionDatabaseId", value)
                      }
                    />
                    <button
                      type="button"
                      className="btn btn-circle btn-xs btn-ghost h-8 min-h-8 w-8 p-0 text-base-content/60 hover:text-base-content flex-shrink-0"
                      title="读取/刷新属性结构"
                      disabled={loadingSchema === "notes"}
                      onClick={() => void loadSchema("notes", true)}>
                      <RefreshCw
                        size={14}
                        className={
                          loadingSchema === "notes" ? "animate-spin" : ""
                        }
                      />
                    </button>
                  </div>
                </Row>
                {schemaErrors.notes && (
                  <div className="mx-4 my-2 p-3 rounded-xl bg-error/10 border border-error/20 text-error text-xs flex items-start gap-2">
                    <AlertCircle size={15} className="flex-shrink-0 mt-0.5" />
                    <div className="flex-1 leading-relaxed">
                      {schemaErrors.notes}
                    </div>
                  </div>
                )}
                {notesProperties.length > 0 && (
                  <>
                    <Row label="内容">
                      <PropertySelect
                        value={settings.notesContentProperty}
                        properties={notesProperties}
                        filterTypes={["title", "rich_text", "formula"]}
                        onChange={(value) =>
                          updateSetting("notesContentProperty", value)
                        }
                      />
                    </Row>
                    <Row label="标题">
                      <PropertySelect
                        optional
                        value={settings.notesTitleProperty}
                        properties={notesProperties}
                        filterTypes={[
                          "title",
                          "rich_text",
                          "select",
                          "formula"
                        ]}
                        onChange={(value) =>
                          updateSetting("notesTitleProperty", value)
                        }
                      />
                    </Row>
                    <Row label="来源">
                      <PropertySelect
                        optional
                        value={settings.notesSourceProperty}
                        properties={notesProperties}
                        filterTypes={[
                          "title",
                          "rich_text",
                          "select",
                          "multi_select",
                          "relation",
                          "rollup",
                          "people",
                          "formula",
                          "url"
                        ]}
                        onChange={(value) =>
                          updateSetting("notesSourceProperty", value)
                        }
                      />
                    </Row>
                    <Row label="日期">
                      <PropertySelect
                        optional
                        value={settings.notesDateProperty}
                        properties={notesProperties}
                        filterTypes={[
                          "date",
                          "created_time",
                          "last_edited_time",
                          "formula"
                        ]}
                        onChange={(value) =>
                          updateSetting("notesDateProperty", value)
                        }
                      />
                    </Row>
                    <Row label="封面">
                      <PropertySelect
                        optional
                        allowPageCover
                        value={settings.notesCoverProperty}
                        properties={notesProperties}
                        filterTypes={["files", "url"]}
                        onChange={(value) =>
                          updateSetting("notesCoverProperty", value)
                        }
                      />
                    </Row>
                  </>
                )}
                {(!settings.notesNotionToken?.trim() ||
                  !settings.notesNotionDatabaseId?.trim() ||
                  !settings.notesContentProperty?.trim()) && (
                  <div className="px-4 py-2 text-xs text-base-content/50 bg-base-200/30">
                    💡 未填写完整 Notion 凭证与内容属性时，不会在主界面显示笔记
                  </div>
                )}
              </>
            ) : (
              <>
                <Row label="微信读书 Key">
                  <div className="flex items-center gap-2 min-w-0">
                    <SecretInput
                      value={settings.wereadApiKey}
                      placeholder="wrk-..."
                      onChange={(value) => updateSetting("wereadApiKey", value)}
                    />
                    <button
                      type="button"
                      className="btn btn-circle btn-xs btn-ghost h-8 min-h-8 w-8 p-0 text-base-content/60 hover:text-base-content"
                      aria-label="查看微信读书 Key 文档"
                      title="查看文档"
                      onClick={() =>
                        window.open(
                          "https://www.notionhub.app/docs/weread.html",
                          "_blank",
                          "noopener,noreferrer"
                        )
                      }>
                      <CircleHelp size={16} />
                    </button>
                  </div>
                </Row>
                {!settings.wereadApiKey?.trim() && (
                  <div className="px-4 py-2 text-xs text-base-content/50 bg-base-200/30">
                    💡 未填写微信读书 Key 时，不会在主界面显示划线
                  </div>
                )}
              </>
            )}
            <Row label="显示封面">
              <input
                type="checkbox"
                className="bonjourr-switch"
                checked={settings.showHighlightCover ?? true}
                onChange={(e) =>
                  updateSetting("showHighlightCover", e.target.checked)
                }
              />
            </Row>
            <Row label="显示背景">
              <input
                type="checkbox"
                className="bonjourr-switch"
                checked={settings.showHighlightBg ?? true}
                onChange={(e) =>
                  updateSetting("showHighlightBg", e.target.checked)
                }
              />
            </Row>
            <Row label="文本对齐">
              <SelectBox
                value={settings.highlightAlign}
                onChange={(value) =>
                  updateSetting("highlightAlign", value as any)
                }>
                <option value="left">左边</option>
                <option value="center">居中</option>
                <option value="right">右边</option>
              </SelectBox>
            </Row>
            <Row label="宽度">
              <input
                type="range"
                className="bonjourr-slider w-full max-w-[140px]"
                min="400"
                max="1000"
                step="10"
                value={settings.highlightWidth}
                onChange={(e) =>
                  updateSetting("highlightWidth", parseInt(e.target.value))
                }
                style={
                  {
                    "--val": `${(settings.highlightWidth - 400) / 6}%`
                  } as React.CSSProperties
                }
              />
            </Row>
            {(settings.showHighlightBg ?? true) && (
              <Row label="背景模糊度">
                <input
                  type="range"
                  className="bonjourr-slider w-full max-w-[140px]"
                  min="0"
                  max="40"
                  value={settings.highlightBgBlur ?? 24}
                  onChange={(e) =>
                    updateSetting("highlightBgBlur", parseInt(e.target.value))
                  }
                  style={
                    {
                      "--val": `${((settings.highlightBgBlur ?? 24) / 40) * 100}%`
                    } as React.CSSProperties
                  }
                />
              </Row>
            )}
          </Card>

          <SectionTitle>音乐</SectionTitle>
          <Card>
            <Row label="播放器">
              <input
                type="checkbox"
                className="bonjourr-switch"
                checked={settings.showMusicPlayer ?? false}
                onChange={(e) =>
                  updateSetting("showMusicPlayer", e.target.checked)
                }
              />
            </Row>
            {(settings.showMusicPlayer ?? false) && (
              <>
                <Row label="Notion Token">
                  <SecretInput
                    value={settings.musicNotionToken}
                    placeholder="ntn_..."
                    onChange={(value) =>
                      updateSetting("musicNotionToken", value)
                    }
                  />
                </Row>
                <Row label="数据库 ID">
                  <div className="flex items-center gap-2">
                    <TextInput
                      value={settings.musicNotionDatabaseId}
                      placeholder="Database ID 或 Notion 链接"
                      onChange={(value) =>
                        handleDatabaseIdChange("musicNotionDatabaseId", value)
                      }
                    />
                    <button
                      type="button"
                      className="btn btn-circle btn-xs btn-ghost h-8 min-h-8 w-8 p-0 text-base-content/60 hover:text-base-content flex-shrink-0"
                      title="读取/刷新属性结构"
                      disabled={loadingSchema === "music"}
                      onClick={() => void loadSchema("music", true)}>
                      <RefreshCw
                        size={14}
                        className={
                          loadingSchema === "music" ? "animate-spin" : ""
                        }
                      />
                    </button>
                  </div>
                </Row>
                {schemaErrors.music && (
                  <div className="mx-4 my-2 p-3 rounded-xl bg-error/10 border border-error/20 text-error text-xs flex items-start gap-2">
                    <AlertCircle size={15} className="flex-shrink-0 mt-0.5" />
                    <div className="flex-1 leading-relaxed">
                      {schemaErrors.music}
                    </div>
                  </div>
                )}
                {musicProperties.length > 0 && (
                  <>
                    <Row label="歌曲">
                      <PropertySelect
                        value={settings.musicTitleProperty}
                        properties={musicProperties}
                        filterTypes={[
                          "title",
                          "rich_text",
                          "formula",
                          "select"
                        ]}
                        onChange={(value) =>
                          updateSetting("musicTitleProperty", value)
                        }
                      />
                    </Row>
                    <Row label="音频">
                      <PropertySelect
                        value={settings.musicAudioProperty}
                        properties={musicProperties}
                        filterTypes={["files", "url"]}
                        onChange={(value) =>
                          updateSetting("musicAudioProperty", value)
                        }
                      />
                    </Row>
                    <Row label="歌词">
                      <PropertySelect
                        optional
                        value={settings.musicLyricsProperty}
                        properties={musicProperties}
                        filterTypes={["files", "url", "rich_text"]}
                        onChange={(value) =>
                          updateSetting("musicLyricsProperty", value)
                        }
                      />
                    </Row>
                    <Row label="封面">
                      <PropertySelect
                        optional
                        allowPageCover
                        value={settings.musicCoverProperty}
                        properties={musicProperties}
                        filterTypes={["files", "url"]}
                        onChange={(value) =>
                          updateSetting("musicCoverProperty", value)
                        }
                      />
                    </Row>
                    <Row label="歌手">
                      <PropertySelect
                        optional
                        value={settings.musicArtistProperty}
                        properties={musicProperties}
                        filterTypes={[
                          "relation",
                          "rollup",
                          "people",
                          "rich_text",
                          "title",
                          "select",
                          "multi_select",
                          "formula",
                          "status",
                          "email",
                          "phone_number"
                        ]}
                        onChange={(value) =>
                          updateSetting("musicArtistProperty", value)
                        }
                      />
                    </Row>
                  </>
                )}
                {(!settings.musicNotionToken?.trim() ||
                  !settings.musicNotionDatabaseId?.trim() ||
                  !settings.musicTitleProperty?.trim() ||
                  !settings.musicAudioProperty?.trim()) && (
                  <div className="px-4 py-2 text-xs text-base-content/50 bg-base-200/30">
                    💡 未填写完整 Notion 凭证与歌曲/音频属性时，播放器不会在主界面显示
                  </div>
                )}
                <Row label="背景模糊度">
                  <input
                    type="range"
                    className="bonjourr-slider w-full max-w-[140px]"
                    min="0"
                    max="40"
                    value={settings.musicPlayerBgBlur ?? 24}
                    onChange={(e) =>
                      updateSetting(
                        "musicPlayerBgBlur",
                        parseInt(e.target.value)
                      )
                    }
                    style={
                      {
                        "--val": `${((settings.musicPlayerBgBlur ?? 24) / 40) * 100}%`
                      } as React.CSSProperties
                    }
                  />
                </Row>
                <Row label="清理本地缓存">
                  <button
                    className="btn btn-sm btn-ghost text-red-500 hover:bg-red-500/10 font-normal px-3"
                    onClick={handleClearCache}
                    disabled={clearingCache || clearedCache}>
                    {clearingCache
                      ? "清理中..."
                      : clearedCache
                        ? "已清理"
                        : "清理缓存"}
                  </button>
                </Row>
              </>
            )}
          </Card>

          <SectionTitle>底部导航栏</SectionTitle>
          <Card>
            <Row label="显示底部 Dock">
              <input
                type="checkbox"
                className="bonjourr-switch"
                checked={settings.showDock ?? true}
                onChange={(e) => updateSetting("showDock", e.target.checked)}
              />
            </Row>
            {(settings.showDock ?? true) && (
              <div className="p-4 space-y-3 bg-base-200/20">
                <div className="flex items-center justify-between px-1">
                  <span className="text-xs font-semibold text-base-content/70">
                    模块显示与顺序排列（首页固定在第一位）：
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      updateSetting("enabledDockModules", [
                        "home",
                        "memos",
                        "movies",
                        "books",
                        "sports"
                      ])
                      toast.success("已恢复默认顺序")
                    }}
                    className="flex items-center gap-1 text-[11px] text-base-content/60 hover:text-primary transition-colors cursor-pointer"
                    title="恢复默认排序">
                    <RotateCcw size={12} />
                    恢复默认
                  </button>
                </div>

                {(() => {
                  const enabledList = settings.enabledDockModules || [
                    "home",
                    "memos",
                    "movies",
                    "books",
                    "sports"
                  ]
                  const allAvailableIds = DOCK_AVAILABLE_MODULES.map((m) => m.id)
                  const validOrdered = enabledList.filter((id) =>
                    allAvailableIds.includes(id)
                  )
                  const missing = allAvailableIds.filter(
                    (id) => !validOrdered.includes(id)
                  )
                  const withoutHome = [...validOrdered, ...missing].filter(
                    (id) => id !== "home"
                  )
                  const orderedIds: DockModuleId[] = ["home", ...withoutHome]

                  const handleMove = (index: number, direction: "up" | "down") => {
                    if (index <= 1 && direction === "up") return
                    if (index >= orderedIds.length - 1 && direction === "down") return

                    const targetIndex = direction === "up" ? index - 1 : index + 1
                    if (targetIndex < 1) return

                    const nextOrdered = [...orderedIds]
                    const temp = nextOrdered[index]
                    nextOrdered[index] = nextOrdered[targetIndex]
                    nextOrdered[targetIndex] = temp

                    const nextEnabled = nextOrdered.filter((id) =>
                      enabledList.includes(id)
                    )
                    updateSetting("enabledDockModules", nextEnabled)
                  }

                  const handleToggle = (modId: DockModuleId, checked: boolean) => {
                    if (modId === "home") return
                    let next: DockModuleId[]
                    if (checked) {
                      const tempSet = new Set([...enabledList, modId])
                      next = orderedIds.filter((id) => tempSet.has(id))
                    } else {
                      next = enabledList.filter((id) => id !== modId)
                    }
                    updateSetting("enabledDockModules", next)
                  }

                  return (
                    <div className="space-y-2">
                      {orderedIds.map((modId, index) => {
                        const mod = DOCK_AVAILABLE_MODULES.find(
                          (m) => m.id === modId
                        )
                        if (!mod) return null
                        const isHome = modId === "home"
                        const isChecked = isHome || enabledList.includes(modId)
                        const isFirstMovable = index === 1
                        const isLastMovable = index === orderedIds.length - 1

                        return (
                          <div
                            key={modId}
                            className={`flex items-center justify-between gap-3 p-2.5 rounded-xl border transition-all ${
                              isChecked
                                ? "bg-base-100 border-primary/30 shadow-xs"
                                : "bg-base-200/40 border-base-content/5 opacity-60"
                            }`}>
                            {/* 左侧勾选与信息 */}
                            <label className="flex items-center gap-3 min-w-0 flex-1 cursor-pointer">
                              <input
                                type="checkbox"
                                className="checkbox checkbox-xs checkbox-primary"
                                checked={isChecked}
                                disabled={isHome}
                                onChange={(e) =>
                                  handleToggle(modId, e.target.checked)
                                }
                              />
                              <div className="flex flex-col min-w-0">
                                <div className="flex items-center gap-1.5">
                                  <span className="text-xs font-semibold text-base-content truncate">
                                    {settings.dockCustomLabels?.[modId] || mod.name}
                                  </span>
                                  {isHome && (
                                    <span className="flex items-center gap-0.5 text-[10px] text-primary/80 bg-primary/10 px-1.5 py-0.2 rounded">
                                      <Lock size={10} />
                                      固定首位
                                    </span>
                                  )}
                                </div>
                                <span className="text-[10px] text-base-content/50 truncate">
                                  {mod.description}
                                </span>
                              </div>
                            </label>

                            {/* 右侧排序上下移动按钮 */}
                            {!isHome && (
                              <div className="flex items-center gap-1 flex-shrink-0">
                                <button
                                  type="button"
                                  disabled={isFirstMovable}
                                  onClick={() => handleMove(index, "up")}
                                  className="btn btn-ghost btn-xs h-7 w-7 min-h-7 p-0 rounded-lg text-base-content/70 hover:text-base-content hover:bg-base-200 disabled:opacity-20 cursor-pointer"
                                  title="向前移动">
                                  <ChevronUp size={15} />
                                </button>
                                <button
                                  type="button"
                                  disabled={isLastMovable}
                                  onClick={() => handleMove(index, "down")}
                                  className="btn btn-ghost btn-xs h-7 w-7 min-h-7 p-0 rounded-lg text-base-content/70 hover:text-base-content hover:bg-base-200 disabled:opacity-20 cursor-pointer"
                                  title="向后移动">
                                  <ChevronDown size={15} />
                                </button>
                              </div>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  )
                })()}
              </div>
            )}
          </Card>

          <SectionTitle>观影画廊 (Notion)</SectionTitle>
          <Card>
            <Row label="Notion Token">
              <SecretInput
                value={settings.moviesNotionToken || ""}
                placeholder="默认复用背景 Token"
                onChange={(value) => updateSetting("moviesNotionToken", value)}
              />
            </Row>
            <Row label="数据库 ID">
              <div className="flex items-center gap-2">
                <TextInput
                  value={settings.moviesNotionDatabaseId || ""}
                  placeholder="Database ID 或 Notion 链接"
                  onChange={(value) =>
                    handleDatabaseIdChange("moviesNotionDatabaseId", value)
                  }
                />
                <button
                  type="button"
                  className="btn btn-circle btn-xs btn-ghost h-8 min-h-8 w-8 p-0 text-base-content/60 hover:text-base-content flex-shrink-0"
                  title="读取/刷新属性结构"
                  disabled={loadingSchema === "movies"}
                  onClick={() => void loadSchema("movies", true)}>
                  <RefreshCw
                    size={14}
                    className={loadingSchema === "movies" ? "animate-spin" : ""}
                  />
                </button>
              </div>
            </Row>
            {moviesProperties.length > 0 && (
              <>
                <Row label="封面">
                  <PropertySelect
                    allowPageCover
                    value={settings.moviesCoverProperty || "__page_cover__"}
                    properties={moviesProperties}
                    filterTypes={["files", "url"]}
                    onChange={(value) =>
                      updateSetting("moviesCoverProperty", value)
                    }
                  />
                </Row>
                <Row label="标题">
                  <PropertySelect
                    value={settings.moviesTitleProperty || ""}
                    properties={moviesProperties}
                    filterTypes={["title", "rich_text"]}
                    onChange={(value) =>
                      updateSetting("moviesTitleProperty", value)
                    }
                  />
                </Row>
                <Row label="评分">
                  <PropertySelect
                    optional
                    value={settings.moviesRatingProperty || ""}
                    properties={moviesProperties}
                    filterTypes={["number", "select", "formula", "rich_text"]}
                    onChange={(value) =>
                      updateSetting("moviesRatingProperty", value)
                    }
                  />
                </Row>
                <Row label="观影日期">
                  <PropertySelect
                    optional
                    value={settings.moviesDateProperty || ""}
                    properties={moviesProperties}
                    filterTypes={["date", "created_time", "formula"]}
                    onChange={(value) =>
                      updateSetting("moviesDateProperty", value)
                    }
                  />
                </Row>
                <Row label="短评">
                  <PropertySelect
                    optional
                    value={settings.moviesReviewProperty || ""}
                    properties={moviesProperties}
                    filterTypes={["rich_text", "title"]}
                    onChange={(value) =>
                      updateSetting("moviesReviewProperty", value)
                    }
                  />
                </Row>
              </>
            )}
          </Card>

          <SectionTitle>书架画廊</SectionTitle>
          <Card>
            <Row label="数据来源">
              <SelectBox
                value={settings.booksSource || "weread"}
                onChange={(value) =>
                  updateSetting("booksSource", value as "notion" | "weread")
                }>
                <option value="weread">微信读书</option>
                <option value="notion">Notion 数据库</option>
              </SelectBox>
            </Row>

            {(settings.booksSource || "weread") === "weread" ? (
              <>
                <Row label="微信读书 Key">
                  <div className="flex items-center gap-2 min-w-0">
                    <SecretInput
                      value={settings.wereadApiKey || ""}
                      placeholder="wrk-..."
                      onChange={(value) => updateSetting("wereadApiKey", value)}
                    />
                    <a
                      href="https://weread.qq.com"
                      target="_blank"
                      rel="noreferrer"
                      className="btn btn-xs btn-ghost text-primary flex-shrink-0"
                      title="打开微信读书网页版获取 Key">
                      获取 Key
                    </a>
                  </div>
                </Row>
                <div className="px-4 py-2 text-xs text-base-content/60 bg-base-200/30">
                  💡 微信读书 Key 已与首页时钟金句划线配置<strong>全局通用同步</strong>，无需重复填写。
                </div>
              </>
            ) : (
              <>
                <Row label="Notion Token">
                  <SecretInput
                    value={settings.booksNotionToken || ""}
                    placeholder="默认复用背景 Token"
                    onChange={(value) => updateSetting("booksNotionToken", value)}
                  />
                </Row>
                <Row label="数据库 ID">
                  <div className="flex items-center gap-2">
                    <TextInput
                      value={settings.booksNotionDatabaseId || ""}
                      placeholder="Database ID 或 Notion 链接"
                      onChange={(value) =>
                        handleDatabaseIdChange("booksNotionDatabaseId", value)
                      }
                    />
                    <button
                      type="button"
                      className="btn btn-circle btn-xs btn-ghost h-8 min-h-8 w-8 p-0 text-base-content/60 hover:text-base-content flex-shrink-0"
                      title="读取/刷新属性结构"
                      disabled={loadingSchema === "books"}
                      onClick={() => void loadSchema("books", true)}>
                      <RefreshCw
                        size={14}
                        className={loadingSchema === "books" ? "animate-spin" : ""}
                      />
                    </button>
                  </div>
                </Row>
                {booksProperties.length > 0 && (
                  <>
                    <Row label="封面">
                      <PropertySelect
                        allowPageCover
                        value={settings.booksCoverProperty || "__page_cover__"}
                        properties={booksProperties}
                        filterTypes={["files", "url"]}
                        onChange={(value) =>
                          updateSetting("booksCoverProperty", value)
                        }
                      />
                    </Row>
                    <Row label="书名">
                      <PropertySelect
                        value={settings.booksTitleProperty || ""}
                        properties={booksProperties}
                        filterTypes={["title", "rich_text"]}
                        onChange={(value) =>
                          updateSetting("booksTitleProperty", value)
                        }
                      />
                    </Row>
                    <Row label="作者">
                      <PropertySelect
                        optional
                        value={settings.booksAuthorProperty || ""}
                        properties={booksProperties}
                        filterTypes={[
                          "rich_text",
                          "title",
                          "select",
                          "people",
                          "relation"
                        ]}
                        onChange={(value) =>
                          updateSetting("booksAuthorProperty", value)
                        }
                      />
                    </Row>
                    <Row label="阅读进度">
                      <PropertySelect
                        optional
                        value={settings.booksProgressProperty || ""}
                        properties={booksProperties}
                        filterTypes={["number", "select", "formula", "rich_text"]}
                        onChange={(value) =>
                          updateSetting("booksProgressProperty", value)
                        }
                      />
                    </Row>
                    <Row label="评分">
                      <PropertySelect
                        optional
                        value={settings.booksRatingProperty || ""}
                        properties={booksProperties}
                        filterTypes={["number", "select", "formula", "rich_text"]}
                        onChange={(value) =>
                          updateSetting("booksRatingProperty", value)
                        }
                      />
                    </Row>
                  </>
                )}
              </>
            )}
          </Card>

          <SectionTitle>随笔设置 (Notion)</SectionTitle>
          <Card>
            <Row label="Notion Token">
              <SecretInput
                value={settings.memosNotionToken || ""}
                placeholder="默认复用背景 Token"
                onChange={(value) => updateSetting("memosNotionToken", value)}
              />
            </Row>
            <Row label="数据库 ID">
              <div className="flex items-center gap-2">
                <TextInput
                  value={settings.memosNotionDatabaseId || ""}
                  placeholder="Database ID 或 Notion 链接"
                  onChange={(value) =>
                    handleDatabaseIdChange("memosNotionDatabaseId", value)
                  }
                />
                <button
                  type="button"
                  className="btn btn-circle btn-xs btn-ghost h-8 min-h-8 w-8 p-0 text-base-content/60 hover:text-base-content flex-shrink-0"
                  title="读取/刷新属性结构"
                  disabled={loadingSchema === "memos"}
                  onClick={() => void loadSchema("memos", true)}>
                  <RefreshCw
                    size={14}
                    className={loadingSchema === "memos" ? "animate-spin" : ""}
                  />
                </button>
              </div>
            </Row>
            {memosProperties.length > 0 && (
              <>
                <Row label="内容">
                  <PropertySelect
                    value={settings.memosContentProperty || ""}
                    properties={memosProperties}
                    filterTypes={["title", "rich_text"]}
                    onChange={(value) =>
                      updateSetting("memosContentProperty", value)
                    }
                  />
                </Row>
                <Row label="日期">
                  <PropertySelect
                    optional
                    value={settings.memosDateProperty || ""}
                    properties={memosProperties}
                    filterTypes={["date", "created_time", "formula"]}
                    onChange={(value) =>
                      updateSetting("memosDateProperty", value)
                    }
                  />
                </Row>
                <Row label="标签">
                  <PropertySelect
                    optional
                    value={settings.memosTagProperty || ""}
                    properties={memosProperties}
                    filterTypes={["select", "multi_select", "rich_text"]}
                    onChange={(value) =>
                      updateSetting("memosTagProperty", value)
                    }
                  />
                </Row>
              </>
            )}
          </Card>

          <SectionTitle>字体</SectionTitle>
          <Card>
            <Row label="字体系列">
              <SelectBox
                value={
                  settings.globalFontFamily ||
                  settings.highlightFont ||
                  SYSTEM_FONT_STACK
                }
                onChange={(value) => updateSetting("globalFontFamily", value)}>
                {fontOptions.map((font) => (
                  <option key={font.value} value={font.value}>
                    {font.label}
                  </option>
                ))}
              </SelectBox>
            </Row>
            <Row label="字重">
              <SelectBox
                value={settings.globalFontWeight || "300"}
                onChange={(value) => updateSetting("globalFontWeight", value)}>
                {fontWeightOptions.map((weight) => (
                  <option key={weight.value} value={weight.value}>
                    {weight.label}
                  </option>
                ))}
              </SelectBox>
            </Row>
            <Row label="大小">
              <input
                type="range"
                className="bonjourr-slider w-full max-w-[140px]"
                min="12"
                max="24"
                step="1"
                value={settings.globalFontSize || 16}
                onChange={(e) =>
                  updateSetting("globalFontSize", parseInt(e.target.value))
                }
                style={
                  {
                    "--val": `${(((settings.globalFontSize || 16) - 12) / 12) * 100}%`
                  } as React.CSSProperties
                }
              />
            </Row>
            <Row label="阴影">
              <input
                type="range"
                className="bonjourr-slider w-full max-w-[140px]"
                min="0"
                max="1"
                step="0.05"
                value={
                  settings.globalTextShadow === undefined
                    ? 0.5
                    : settings.globalTextShadow
                }
                onChange={(e) =>
                  updateSetting("globalTextShadow", parseFloat(e.target.value))
                }
                style={
                  {
                    "--val": `${((settings.globalTextShadow === undefined ? 0.5 : settings.globalTextShadow) / 1) * 100}%`
                  } as React.CSSProperties
                }
              />
            </Row>
          </Card>

          <div className="mx-5 mb-8 rounded-2xl border border-base-content/5 bg-base-100/70 px-4 py-4 text-sm leading-6 text-base-content/60">
            如果你想自动把微信读书、网易云音乐、flomo 等同步到 Notion，可以使用
            NotionHub：https://www.notionhub.app
          </div>
        </div>
      </aside>
    </>
  )
}
