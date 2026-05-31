import { Book, ExternalLink, RefreshCw } from "lucide-react"
import React, { useEffect, useState } from "react"

import {
  getRandomHighlightResult,
  type Highlight,
  type HighlightResult
} from "../lib/api"
import { useNewTabSettings } from "../lib/settingsStore"

export default function HighlightQuote() {
  const [highlight, setHighlight] = useState<Highlight | null>(null)
  const [result, setResult] = useState<HighlightResult | null>(null)
  const [loading, setLoading] = useState(true)
  const [settings] = useNewTabSettings()

  const refreshHighlight = async () => {
    setLoading(true)
    try {
      const res = await getRandomHighlightResult()
      setResult(res)
      setHighlight(res.highlight)
    } catch (error) {
      console.warn("[NotionHub NewTab] Failed to refresh highlight:", error)
      setResult({ highlight: null, status: "error" })
      setHighlight(null)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    refreshHighlight()
  }, [])

  const openHighlight = () => {
    if (!highlight?.notionUrl) return
    window.location.href = highlight.notionUrl
  }

  if (!settings) {
    return (
      <div className="h-[168px] min-h-[168px] opacity-0 transition-opacity duration-300"></div>
    )
  }

  const showCover = settings.showHighlightCover ?? true
  const showBg = settings.showHighlightBg ?? true
  const containerBlur = Math.max(settings.highlightBgBlur ?? 24, 0)
  const hasGlassBg = showBg && containerBlur > 0
  const bgClasses = showBg
    ? hasGlassBg
      ? "border border-white/10 shadow-lg"
      : "border-transparent shadow-none"
    : "border-transparent shadow-none"
  const containerBgAlpha = Math.max(0, (containerBlur / 40) * 0.08)
  const containerBgColor = showBg
    ? `rgba(255, 255, 255, ${containerBgAlpha})`
    : "rgba(0, 0, 0, 0.001)"

  const renderStatusCard = (message: string, showSpinner = false) => {
    return (
      <div
        className={`mx-auto flex h-[168px] min-h-[168px] flex-col items-center justify-center gap-3 p-6 text-center text-white/70 rounded-2xl ${bgClasses}`}
        style={{
          width: `${settings.highlightWidth || 672}px`,
          maxWidth: "90vw",
          backgroundColor: containerBgColor,
          backdropFilter: hasGlassBg ? `blur(${containerBlur}px)` : undefined,
          WebkitBackdropFilter: hasGlassBg
            ? `blur(${containerBlur}px)`
            : undefined
        }}>
        {showSpinner && (
          <RefreshCw className="animate-spin text-white/60" size={18} />
        )}
        <p className="text-sm font-light">{message}</p>
      </div>
    )
  }

  if (loading) {
    return renderStatusCard("正在刷新笔记...", true)
  }

  if (!highlight) {
    const message =
      result?.message ||
      (result?.status === "missing_notion"
        ? "请先在设置中配置笔记来源。"
        : result?.status === "empty" && result.targetDate
          ? `未找到早于 ${result.targetDate} 的微信读书划线或笔记。`
          : result?.status === "error"
            ? "读取 Notion 划线失败，稍后再试。"
            : "配置笔记来源后，这里会显示你的笔记。")

    return renderStatusCard(message)
  }

  const align = settings.highlightAlign || "left"
  const alignClass =
    align === "center"
      ? "items-center text-center"
      : align === "right"
        ? "items-end text-right"
        : "items-start text-left"
  const textJustify =
    align === "center"
      ? "text-center"
      : align === "right"
        ? "text-right"
        : "text-left"

  return (
    <div
      className={`group relative mx-auto h-[168px] min-h-[168px] cursor-default select-none p-5 text-white transition-opacity duration-300 ease-in-out rounded-2xl flex items-stretch gap-6 ${bgClasses}`}
      style={{
        width: `${settings.highlightWidth || 672}px`,
        maxWidth: "90vw",
        backgroundColor: containerBgColor,
        backdropFilter: hasGlassBg ? `blur(${containerBlur}px)` : undefined,
        WebkitBackdropFilter: hasGlassBg
          ? `blur(${containerBlur}px)`
          : undefined
      }}>
      {/* 左侧封面 */}
      {showCover &&
        (highlight.cover ? (
          <a
            href={highlight.bookUrl || highlight.notionUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="w-[100px] flex-shrink-0 h-full rounded-lg overflow-hidden shadow-md relative block hover:opacity-90 transition-opacity cursor-pointer"
            style={{ backgroundColor: containerBgColor }}
            title={`在 Notion 中查看 ${highlight.book}`}>
            <img
              src={highlight.cover}
              alt={highlight.book}
              className="w-full h-full object-cover"
            />
          </a>
        ) : (
          <a
            href={highlight.bookUrl || highlight.notionUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="w-[100px] flex-shrink-0 h-full rounded-lg border border-white/10 flex items-center justify-center shadow-md hover:opacity-90 transition-opacity cursor-pointer"
            style={{ backgroundColor: containerBgColor }}
            title={`在 Notion 中查看 ${highlight.book}`}>
            <Book className="text-white/40" size={36} strokeWidth={1.5} />
          </a>
        ))}

      {/* 右侧内容 */}
      <div
        className={`flex-1 flex flex-col justify-between py-1 relative min-w-0 pr-2 ${alignClass}`}>
        <div
          className={`flex-1 flex flex-col justify-center w-full ${alignClass}`}>
          {highlight.kind === "review" && highlight.originalText && (
            <blockquote
              className={`mb-2 max-w-full overflow-hidden border-l-2 border-white/35 pl-3 text-xs font-light italic leading-relaxed text-white/75 ${align === "right" ? "text-right" : align === "center" ? "text-center" : "text-left"}`}
              style={{
                display: "-webkit-box",
                WebkitLineClamp: 2,
                WebkitBoxOrient: "vertical"
              }}>
              {highlight.originalText}
            </blockquote>
          )}
          <p
            className={`overflow-hidden text-base md:text-[17px] font-light leading-relaxed w-full ${textJustify}`}
            style={{
              display: "-webkit-box",
              WebkitLineClamp:
                highlight.kind === "review" && highlight.originalText ? 2 : 4,
              WebkitBoxOrient: "vertical"
            }}>
            {highlight.text}
          </p>
        </div>

        {/* 下角书名 */}
        {highlight.book && (
          <p
            className={`mt-2 text-[13px] md:text-sm font-light opacity-70 w-full ${align === "left" ? "text-right" : align === "right" ? "text-left" : "text-center"}`}>
            —{" "}
            <a
              href={highlight.bookUrl || highlight.notionUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="hover:underline hover:text-white transition-colors cursor-pointer"
              title={`在 Notion 中查看 ${highlight.book}`}>
              《{highlight.book}》
            </a>
          </p>
        )}
      </div>

      {/* 右上角操作按钮 */}
      <div className="absolute top-4 right-4 flex items-center justify-center gap-2 opacity-0 transition-opacity duration-200 group-hover:opacity-100 z-10">
        <button
          type="button"
          className="btn btn-circle btn-sm border-white/15 bg-black/25 text-white shadow-none backdrop-blur-md hover:border-white/30 hover:bg-white/20"
          onClick={refreshHighlight}
          title="换一条"
          aria-label="换一条">
          <RefreshCw size={16} />
        </button>
        <button
          type="button"
          className="btn btn-circle btn-sm border-white/15 bg-black/25 text-white shadow-none backdrop-blur-md hover:border-white/30 hover:bg-white/20"
          onClick={openHighlight}
          title="在 Notion 中打开"
          aria-label="在 Notion 中打开">
          <ExternalLink size={16} />
        </button>
      </div>
    </div>
  )
}
