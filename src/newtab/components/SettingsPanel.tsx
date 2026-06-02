import { CircleHelp, Eye, EyeOff, RefreshCw, X } from "lucide-react"
import React, { useEffect, useState } from "react"

import { fetchNotionProperties, type NotionPropertySchema } from "../lib/api"
import { clearMusicPlayerCache } from "../lib/music"
import {
  SYSTEM_FONT_STACK,
  useNewTabSettings,
  type BackgroundFrequency,
  type BackgroundProvider,
  type BackgroundType,
  type NewTabSettings,
  type NotesSource,
  type NotionImageSource,
  type Theme
} from "../lib/settingsStore"

interface SettingsPanelProps {
  isOpen: boolean
  onClose: () => void
}

type NotionSchemaTarget = "background" | "notes" | "music"

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

function PropertySelect({
  value,
  properties,
  onChange,
  optional = false
}: {
  value: string
  properties: NotionPropertySchema[]
  onChange: (value: string) => void
  optional?: boolean
}) {
  return (
    <SelectBox value={value} onChange={onChange}>
      {optional && <option value="">不选择</option>}
      {!properties.length && (
        <option value={value}>{value || "未读取到字段"}</option>
      )}
      {properties.map((property) => (
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
  const [showWereadKey, setShowWereadKey] = useState(false)
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

  if (!settings) return null

  const updateSetting = <K extends keyof NewTabSettings>(
    key: K,
    value: NewTabSettings[K]
  ) => {
    setSettings((prev) => ({ ...prev!, [key]: value }))
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

  const getSchemaCredentials = (target: NotionSchemaTarget) => {
    const token =
      target === "background"
        ? settings.backgroundNotionToken
        : target === "notes"
          ? settings.notesNotionToken
          : settings.musicNotionToken
    const databaseId =
      target === "background"
        ? settings.backgroundNotionDatabaseId
        : target === "notes"
          ? settings.notesNotionDatabaseId
          : settings.musicNotionDatabaseId

    return {
      token: token.trim(),
      databaseId: databaseId.trim()
    }
  }

  const clearProperties = (target: NotionSchemaTarget) => {
    if (target === "background") setBackgroundProperties([])
    if (target === "notes") setNotesProperties([])
    if (target === "music") setMusicProperties([])
  }

  const loadSchema = async (target: NotionSchemaTarget) => {
    const { token, databaseId } = getSchemaCredentials(target)

    if (!token || !databaseId) {
      clearProperties(target)
      return
    }

    setLoadingSchema(target)
    try {
      const properties = await fetchNotionProperties(token, databaseId)
      if (target === "background") setBackgroundProperties(properties)
      if (target === "notes") setNotesProperties(properties)
      if (target === "music") setMusicProperties(properties)
    } catch (error) {
      console.warn("[NotionHub Tab] Failed to load Notion schema:", error)
      clearProperties(target)
    } finally {
      setLoadingSchema(null)
    }
  }

  const backgroundProvider =
    settings.backgroundType === "video"
      ? settings.backgroundProvider === "pixabay"
        ? "pixabay"
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
                  </>
                ) : (
                  <>
                    <option value="bing">Bing</option>
                    <option value="unsplash">Unsplash</option>
                    <option value="pixabay">Pixabay</option>
                    <option value="notion">Notion</option>
                  </>
                )}
              </SelectBox>
            </Row>
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
                  <Row label="Unsplash Key">
                    <TextInput
                      value={settings.unsplashAccessKey}
                      placeholder="Access Key"
                      onChange={(value) =>
                        updateSetting("unsplashAccessKey", value)
                      }
                    />
                  </Row>
                )}
                {backgroundProvider === "pixabay" && (
                  <Row label="Pixabay Key">
                    <TextInput
                      value={settings.pixabayApiKey}
                      placeholder="API Key"
                      onChange={(value) =>
                        updateSetting("pixabayApiKey", value)
                      }
                    />
                  </Row>
                )}
              </>
            )}
            {backgroundProvider === "notion" && (
              <>
                <Row label="Notion Token">
                  <TextInput
                    value={settings.backgroundNotionToken}
                    placeholder="ntn_..."
                    onChange={(value) =>
                      updateSetting("backgroundNotionToken", value)
                    }
                  />
                </Row>
                <Row label="数据库 ID">
                  <TextInput
                    value={settings.backgroundNotionDatabaseId}
                    placeholder="Database ID"
                    onChange={(value) =>
                      updateSetting("backgroundNotionDatabaseId", value)
                    }
                  />
                </Row>
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
                    {renderSchemaStatus("background")}
                    {backgroundProperties.length > 0 && (
                      <Row label="文件属性">
                        <PropertySelect
                          value={settings.backgroundNotionFilesProperty}
                          properties={backgroundProperties}
                          onChange={(value) =>
                            updateSetting(
                              "backgroundNotionFilesProperty",
                              value
                            )
                          }
                        />
                      </Row>
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
                <option value="notion">Notion 数据库</option>
                <option value="weread">微信读书</option>
              </SelectBox>
            </Row>
            {settings.notesSource === "notion" ? (
              <>
                <Row label="Notion Token">
                  <TextInput
                    value={settings.notesNotionToken}
                    placeholder="ntn_..."
                    onChange={(value) =>
                      updateSetting("notesNotionToken", value)
                    }
                  />
                </Row>
                <Row label="数据库 ID">
                  <TextInput
                    value={settings.notesNotionDatabaseId}
                    placeholder="Database ID"
                    onChange={(value) =>
                      updateSetting("notesNotionDatabaseId", value)
                    }
                  />
                </Row>
                {renderSchemaStatus("notes")}
                {notesProperties.length > 0 && (
                  <>
                    <Row label="内容属性">
                      <PropertySelect
                        value={settings.notesContentProperty}
                        properties={notesProperties}
                        onChange={(value) =>
                          updateSetting("notesContentProperty", value)
                        }
                      />
                    </Row>
                    <Row label="标题属性">
                      <PropertySelect
                        optional
                        value={settings.notesTitleProperty}
                        properties={notesProperties}
                        onChange={(value) =>
                          updateSetting("notesTitleProperty", value)
                        }
                      />
                    </Row>
                    <Row label="来源属性">
                      <PropertySelect
                        optional
                        value={settings.notesSourceProperty}
                        properties={notesProperties}
                        onChange={(value) =>
                          updateSetting("notesSourceProperty", value)
                        }
                      />
                    </Row>
                    <Row label="日期属性">
                      <PropertySelect
                        optional
                        value={settings.notesDateProperty}
                        properties={notesProperties}
                        onChange={(value) =>
                          updateSetting("notesDateProperty", value)
                        }
                      />
                    </Row>
                    <Row label="封面属性">
                      <PropertySelect
                        optional
                        value={settings.notesCoverProperty}
                        properties={notesProperties}
                        onChange={(value) =>
                          updateSetting("notesCoverProperty", value)
                        }
                      />
                    </Row>
                  </>
                )}
              </>
            ) : (
              <Row label="微信读书 Key">
                <div className="flex items-center gap-2 min-w-0">
                  <TextInput
                    value={settings.wereadApiKey}
                    placeholder="wrk-..."
                    type={showWereadKey ? "text" : "password"}
                    onChange={(value) => updateSetting("wereadApiKey", value)}
                  />
                  <button
                    type="button"
                    className="btn btn-circle btn-xs btn-ghost h-8 min-h-8 w-8 p-0 text-base-content/60 hover:text-base-content"
                    aria-label={
                      showWereadKey ? "隐藏微信读书 Key" : "显示微信读书 Key"
                    }
                    title={showWereadKey ? "隐藏 Key" : "显示 Key"}
                    onClick={() => setShowWereadKey((value) => !value)}>
                    {showWereadKey ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
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
                  <TextInput
                    value={settings.musicNotionToken}
                    placeholder="ntn_..."
                    onChange={(value) =>
                      updateSetting("musicNotionToken", value)
                    }
                  />
                </Row>
                <Row label="数据库 ID">
                  <TextInput
                    value={settings.musicNotionDatabaseId}
                    placeholder="Database ID"
                    onChange={(value) =>
                      updateSetting("musicNotionDatabaseId", value)
                    }
                  />
                </Row>
                {renderSchemaStatus("music")}
                {musicProperties.length > 0 && (
                  <>
                    <Row label="歌曲属性">
                      <PropertySelect
                        value={settings.musicTitleProperty}
                        properties={musicProperties}
                        onChange={(value) =>
                          updateSetting("musicTitleProperty", value)
                        }
                      />
                    </Row>
                    <Row label="音频属性">
                      <PropertySelect
                        value={settings.musicAudioProperty}
                        properties={musicProperties}
                        onChange={(value) =>
                          updateSetting("musicAudioProperty", value)
                        }
                      />
                    </Row>
                    <Row label="歌词属性">
                      <PropertySelect
                        optional
                        value={settings.musicLyricsProperty}
                        properties={musicProperties}
                        onChange={(value) =>
                          updateSetting("musicLyricsProperty", value)
                        }
                      />
                    </Row>
                    <Row label="封面属性">
                      <PropertySelect
                        optional
                        value={settings.musicCoverProperty}
                        properties={musicProperties}
                        onChange={(value) =>
                          updateSetting("musicCoverProperty", value)
                        }
                      />
                    </Row>
                    <Row label="歌手属性">
                      <PropertySelect
                        optional
                        value={settings.musicArtistProperty}
                        properties={musicProperties}
                        onChange={(value) =>
                          updateSetting("musicArtistProperty", value)
                        }
                      />
                    </Row>
                  </>
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
