import React, { useEffect, useMemo, useState } from "react"
import {
  RefreshCw,
  Settings,
  Star,
  Clapperboard,
  BookOpen,
  Library,
  PenLine,
  Flame,
  ChevronLeft,
  ChevronRight,
  X,
  Clock,
  Calendar,
  Trophy
} from "lucide-react"
import {
  fetchBooksList,
  fetchMemosList,
  fetchMoviesList,
  type BookItem,
  type MemoItem,
  type MovieItem,
  type WeReadReadingStats
} from "../lib/gallery"
import type { DockModuleId, NewTabSettings } from "../lib/settingsStore"

interface EmbeddedGalleryViewProps {
  module: DockModuleId
  settings: NewTabSettings
  onOpenSettings: () => void
}

export default function EmbeddedGalleryView({
  module,
  settings,
  onOpenSettings
}: EmbeddedGalleryViewProps) {
  const [loading, setLoading] = useState(false)
  const [loadingMore, setLoadingMore] = useState(false)
  const [hasMore, setHasMore] = useState(false)
  const [nextCursor, setNextCursor] = useState<string | null>(null)
  const [movies, setMovies] = useState<MovieItem[]>([])
  const [books, setBooks] = useState<BookItem[]>([])
  const [readingStats, setReadingStats] = useState<WeReadReadingStats | null>(null)
  const [memos, setMemos] = useState<MemoItem[]>([])
  const [error, setError] = useState<string | null>(null)
  const [selectedStatus, setSelectedStatus] = useState<string>("全部")
  const [lightbox, setLightbox] = useState<{
    isOpen: boolean
    images: string[]
    currentIndex: number
  }>({
    isOpen: false,
    images: [],
    currentIndex: 0
  })

  // Lightbox 键盘快捷键 (Esc 关闭, 左/右箭头切换)
  useEffect(() => {
    if (!lightbox.isOpen) return
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setLightbox((prev) => ({ ...prev, isOpen: false }))
      } else if (e.key === "ArrowLeft") {
        setLightbox((prev) => ({
          ...prev,
          currentIndex:
            (prev.currentIndex - 1 + prev.images.length) % prev.images.length
        }))
      } else if (e.key === "ArrowRight") {
        setLightbox((prev) => ({
          ...prev,
          currentIndex: (prev.currentIndex + 1) % prev.images.length
        }))
      }
    }
    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [lightbox.isOpen, lightbox.images.length])

  const loadData = async () => {
    setLoading(true)
    setError(null)
    setHasMore(false)
    setNextCursor(null)
    setReadingStats(null)
    try {
      if (module === "movies") {
        const res = await fetchMoviesList(settings)
        if (res.error === "missing_config") {
          setError("missing_config")
        } else if (res.error) {
          setError(res.error)
        } else {
          setMovies(res.items)
          setHasMore(res.hasMore)
          setNextCursor(res.nextCursor || null)
        }
      } else if (module === "books") {
        const res = await fetchBooksList(settings)
        if (res.error === "missing_config") {
          setError("missing_config")
        } else if (res.error) {
          setError(res.error)
        } else {
          setBooks(res.items)
          setReadingStats(res.readingStats || null)
          setHasMore(res.hasMore)
          setNextCursor(res.nextCursor || null)
        }
      } else if (module === "memos") {
        const res = await fetchMemosList(settings)
        if (res.error === "missing_config") {
          setError("missing_config")
        } else if (res.error) {
          setError(res.error)
        } else {
          setMemos(res.items)
          setHasMore(res.hasMore)
          setNextCursor(res.nextCursor || null)
        }
      }
    } catch (err: any) {
      setError(err?.message || "加载数据失败")
    } finally {
      setLoading(false)
    }
  }

  const handleLoadMore = async () => {
    if (!nextCursor || loadingMore) return
    setLoadingMore(true)
    try {
      if (module === "movies") {
        const res = await fetchMoviesList(settings, nextCursor)
        if (!res.error) {
          setMovies((prev) => [...prev, ...res.items])
          setHasMore(res.hasMore)
          setNextCursor(res.nextCursor || null)
        }
      } else if (module === "books") {
        const res = await fetchBooksList(settings, nextCursor)
        if (!res.error) {
          setBooks((prev) => [...prev, ...res.items])
          setHasMore(res.hasMore)
          setNextCursor(res.nextCursor || null)
        }
      } else if (module === "memos") {
        const res = await fetchMemosList(settings, nextCursor)
        if (!res.error) {
          setMemos((prev) => [...prev, ...res.items])
          setHasMore(res.hasMore)
          setNextCursor(res.nextCursor || null)
        }
      }
    } catch (err) {
      console.warn("Failed to load more:", err)
    } finally {
      setLoadingMore(false)
    }
  }

  useEffect(() => {
    void loadData()
  }, [module, settings])

  // 电影状态统计与过滤
  const movieStatusCounts = useMemo(() => {
    const counts: Record<string, number> = { 全部: movies.length }
    movies.forEach((m) => {
      if (m.status) {
        counts[m.status] = (counts[m.status] || 0) + 1
      }
    })
    return counts
  }, [movies])

  const filteredMovies = useMemo(() => {
    if (selectedStatus === "全部") return movies
    return movies.filter((m) => m.status === selectedStatus)
  }, [movies, selectedStatus])

  // 书架状态统计与过滤
  const bookStatusCounts = useMemo(() => {
    const counts: Record<string, number> = { 全部: books.length }
    books.forEach((b) => {
      if (b.status) {
        counts[b.status] = (counts[b.status] || 0) + 1
      }
    })
    return counts
  }, [books])

  const filteredBooks = useMemo(() => {
    if (selectedStatus === "全部") return books
    return books.filter((b) => b.status === selectedStatus)
  }, [books, selectedStatus])

  return (
    <div className="w-full max-w-5xl mx-auto flex flex-col min-h-full pb-24 pt-4 animate-in fade-in duration-300">
      {/* 观影状态筛选 Tab 栏 */}
      {module === "movies" && !error && movies.length > 0 && (
        <div className="flex items-center justify-between gap-2 mb-4 px-1 select-none">
          <div className="flex items-center gap-1.5 overflow-x-auto custom-scrollbar py-1">
            {Object.entries(movieStatusCounts).map(([status, count]) => {
              const isActive = selectedStatus === status
              return (
                <button
                  key={status}
                  type="button"
                  onClick={() => setSelectedStatus(status)}
                  className={`px-3 py-1 rounded-full text-xs font-medium transition-all ${
                    isActive
                      ? "bg-amber-500/90 text-white shadow-md shadow-amber-500/20 font-semibold"
                      : "bg-black/35 hover:bg-black/50 text-white/70 hover:text-white backdrop-blur-md"
                  }`}>
                  {status}
                  <span
                    className={`ml-1 text-[10px] ${
                      isActive ? "text-white/90" : "text-white/50"
                    }`}>
                    ({count})
                  </span>
                </button>
              )
            })}
          </div>

          <div className="flex items-center gap-2 flex-shrink-0">
            <button
              type="button"
              onClick={loadData}
              disabled={loading}
              className="flex items-center justify-center w-7 h-7 rounded-full bg-black/40 hover:bg-black/60 backdrop-blur-md text-white/70 hover:text-white transition-all hover:scale-105"
              title="刷新数据">
              <RefreshCw size={13} className={loading ? "animate-spin" : ""} />
            </button>
            <button
              type="button"
              onClick={onOpenSettings}
              className="flex items-center justify-center w-7 h-7 rounded-full bg-black/40 hover:bg-black/60 backdrop-blur-md text-white/70 hover:text-white transition-all hover:scale-105"
              title="配置数据源">
              <Settings size={13} />
            </button>
          </div>
        </div>
      )}

      {/* 📖 微信读书阅读时长与数据统计看板 */}
      {module === "books" && !error && readingStats && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3 mb-4 select-none animate-in fade-in slide-in-from-top-2 duration-300">
          {/* 本周阅读 */}
          <div className="flex items-center gap-2.5 px-3.5 py-2.5 rounded-2xl bg-white/10 dark:bg-black/35 backdrop-blur-xl border border-white/15 shadow-sm">
            <div className="flex items-center justify-center w-8 h-8 rounded-xl bg-amber-500/20 text-amber-300 flex-shrink-0">
              <Clock size={16} />
            </div>
            <div className="flex flex-col min-w-0">
              <span className="text-[10px] text-white/60">本周阅读</span>
              <div className="flex items-baseline gap-1 truncate">
                <span className="text-xs sm:text-sm font-bold text-white tracking-tight">
                  {readingStats.weeklyFormatted}
                </span>
                {readingStats.weeklyDays > 0 && (
                  <span className="text-[10px] text-white/50">
                    ({readingStats.weeklyDays}天)
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* 本月阅读 */}
          <div className="flex items-center gap-2.5 px-3.5 py-2.5 rounded-2xl bg-white/10 dark:bg-black/35 backdrop-blur-xl border border-white/15 shadow-sm">
            <div className="flex items-center justify-center w-8 h-8 rounded-xl bg-sky-500/20 text-sky-300 flex-shrink-0">
              <Calendar size={16} />
            </div>
            <div className="flex flex-col min-w-0">
              <span className="text-[10px] text-white/60">本月阅读</span>
              <div className="flex items-baseline gap-1 truncate">
                <span className="text-xs sm:text-sm font-bold text-white tracking-tight">
                  {readingStats.monthlyFormatted}
                </span>
                {readingStats.monthlyDays > 0 && (
                  <span className="text-[10px] text-white/50">
                    ({readingStats.monthlyDays}天)
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* 读书排行 */}
          {readingStats.rankText ? (
            <div className="flex items-center gap-2.5 px-3.5 py-2.5 rounded-2xl bg-white/10 dark:bg-black/35 backdrop-blur-xl border border-white/15 shadow-sm">
              <div className="flex items-center justify-center w-8 h-8 rounded-xl bg-emerald-500/20 text-emerald-300 flex-shrink-0">
                <Trophy size={16} />
              </div>
              <div className="flex flex-col min-w-0">
                <span className="text-[10px] text-white/60">读书排行</span>
                <span className="text-xs sm:text-sm font-bold text-white truncate tracking-tight">
                  {readingStats.rankText}
                </span>
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-2.5 px-3.5 py-2.5 rounded-2xl bg-white/10 dark:bg-black/35 backdrop-blur-xl border border-white/15 shadow-sm">
              <div className="flex items-center justify-center w-8 h-8 rounded-xl bg-emerald-500/20 text-emerald-300 flex-shrink-0">
                <Library size={16} />
              </div>
              <div className="flex flex-col min-w-0">
                <span className="text-[10px] text-white/60">书架藏书</span>
                <span className="text-xs sm:text-sm font-bold text-white tracking-tight">
                  {books.length} 本
                </span>
              </div>
            </div>
          )}

          {/* 笔记与藏书 */}
          <div className="flex items-center gap-2.5 px-3.5 py-2.5 rounded-2xl bg-white/10 dark:bg-black/35 backdrop-blur-xl border border-white/15 shadow-sm">
            <div className="flex items-center justify-center w-8 h-8 rounded-xl bg-purple-500/20 text-purple-300 flex-shrink-0">
              <BookOpen size={16} />
            </div>
            <div className="flex flex-col min-w-0">
              <span className="text-[10px] text-white/60">笔记与藏书</span>
              <span className="text-xs sm:text-sm font-bold text-white tracking-tight">
                {books.length} 本书籍
              </span>
            </div>
          </div>
        </div>
      )}

      {/* 书架阅读状态筛选 Tab 栏 */}
      {module === "books" && !error && books.length > 0 && (
        <div className="flex items-center justify-between gap-2 mb-4 px-1 select-none">
          <div className="flex items-center gap-1.5 overflow-x-auto custom-scrollbar py-1">
            {Object.entries(bookStatusCounts).map(([status, count]) => {
              const isActive = selectedStatus === status
              return (
                <button
                  key={status}
                  type="button"
                  onClick={() => setSelectedStatus(status)}
                  className={`px-3 py-1 rounded-full text-xs font-medium transition-all ${
                    isActive
                      ? "bg-amber-500/90 text-white shadow-md shadow-amber-500/20 font-semibold"
                      : "bg-black/35 hover:bg-black/50 text-white/70 hover:text-white backdrop-blur-md"
                  }`}>
                  {status}
                  <span
                    className={`ml-1 text-[10px] ${
                      isActive ? "text-white/90" : "text-white/50"
                    }`}>
                    ({count})
                  </span>
                </button>
              )
            })}
          </div>

          <div className="flex items-center gap-2 flex-shrink-0">
            <button
              type="button"
              onClick={loadData}
              disabled={loading}
              className="flex items-center justify-center w-7 h-7 rounded-full bg-black/40 hover:bg-black/60 backdrop-blur-md text-white/70 hover:text-white transition-all hover:scale-105"
              title="刷新数据">
              <RefreshCw size={13} className={loading ? "animate-spin" : ""} />
            </button>
            <button
              type="button"
              onClick={onOpenSettings}
              className="flex items-center justify-center w-7 h-7 rounded-full bg-black/40 hover:bg-black/60 backdrop-blur-md text-white/70 hover:text-white transition-all hover:scale-105"
              title="配置数据源">
              <Settings size={13} />
            </button>
          </div>
        </div>
      )}

      {/* 未配置提示 */}
      {error === "missing_config" && (
        <div className="flex-1 flex flex-col items-center justify-center py-20 text-center select-none">
          <div className="w-16 h-16 rounded-3xl bg-black/40 backdrop-blur-2xl border border-white/10 flex items-center justify-center text-white mb-4 shadow-xl">
            {module === "movies" && (
              <Clapperboard size={28} className="text-amber-400" />
            )}
            {module === "books" && (
              <Library size={28} className="text-sky-400" />
            )}
            {module === "memos" && (
              <PenLine size={28} className="text-emerald-400" />
            )}
          </div>
          <h3 className="text-lg font-bold text-white mb-2 drop-shadow-md">
            尚未配置数据源
          </h3>
          <p className="text-sm text-white/75 max-w-md mb-6 leading-relaxed drop-shadow">
            在设置中填入微信读书 Key 或 Notion 数据库，即可在背景壁纸上沉浸式展现
            {module === "movies"
              ? "电影海报墙"
              : module === "books"
                ? "微信读书与豆瓣书架"
                : "随笔便签流"}
            。
          </p>
          <button
            type="button"
            onClick={onOpenSettings}
            className="btn btn-sm btn-primary rounded-xl px-5 gap-2 shadow-lg">
            <Settings size={14} />
            立即配置
          </button>
        </div>
      )}

      {/* 错误提示 */}
      {error && error !== "missing_config" && (
        <div className="flex-1 flex flex-col items-center justify-center py-20 text-center">
          <div className="p-4 rounded-2xl bg-error/20 border border-error/30 backdrop-blur-xl text-white text-sm mb-4">
            {error}
          </div>
          <button
            type="button"
            onClick={loadData}
            className="btn btn-sm btn-outline btn-error rounded-xl bg-black/20">
            重试加载
          </button>
        </div>
      )}

      {/* 🍿 观影画廊：4 列精致海报网格 + 居中悬停毛玻璃信息卡片 */}
      {!error && module === "movies" && (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 sm:gap-4">
          {filteredMovies.map((movie) => {
            const hasCover = Boolean(movie.cover)

            return (
              <div
                key={movie.id}
                onClick={() =>
                  movie.notionUrl && window.open(movie.notionUrl, "_blank")
                }
                className="group relative aspect-[2/3] w-full rounded-2xl overflow-hidden bg-white/10 dark:bg-black/35 backdrop-blur-2xl border border-white/20 hover:border-white/40 shadow-lg hover:shadow-2xl transition-all duration-300 hover:-translate-y-1 cursor-pointer select-none">
                {/* 底层毛玻璃占位 (当无图或图在加载时呈现) */}
                <div className="absolute inset-0 flex flex-col items-center justify-center text-white/40 p-4 text-center select-none pointer-events-none">
                  <Clapperboard size={32} className="mb-2 opacity-50 text-white/50" />
                  <span className="text-xs text-white/60 line-clamp-2 px-2">{movie.title}</span>
                </div>

                {/* 底层海报 */}
                {hasCover && (
                  <img
                    src={movie.cover}
                    alt={movie.title}
                    className="absolute inset-0 w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                    loading="lazy"
                  />
                )}

                {/* 悬停/常驻毛玻璃信息遮罩 (所有元素绝对居中对齐) */}
                <div
                  className={`absolute inset-0 bg-black/65 dark:bg-black/75 backdrop-blur-xl p-3.5 sm:p-4 flex flex-col items-center justify-center text-center text-white transition-opacity duration-300 rounded-2xl ${
                    hasCover
                      ? "opacity-0 group-hover:opacity-100"
                      : "opacity-100"
                  }`}>
                  {/* 观看状态徽章 */}
                  {movie.status && (
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-white/15 text-white/90 border border-white/20 mb-2 shadow-xs">
                      {movie.status}
                    </span>
                  )}

                  {/* 电影标题 */}
                  <h3 className="font-bold text-sm sm:text-base tracking-wide line-clamp-2 mb-2 drop-shadow-sm text-white text-center px-1">
                    {movie.title}
                  </h3>

                  {/* 橙色星级评分 */}
                  {movie.stars ? (
                    <div className="flex items-center justify-center gap-1 text-amber-500 mb-2.5">
                      <div className="flex items-center gap-0.5">
                        {Array.from({ length: 5 }).map((_, i) => (
                          <Star
                            key={i}
                            size={12}
                            className={
                              i < movie.stars!
                                ? "fill-amber-500 text-amber-500"
                                : "text-white/20"
                            }
                          />
                        ))}
                      </div>
                      {movie.rating && (
                        <span className="text-xs text-amber-400 font-semibold ml-1">
                          {movie.rating}
                        </span>
                      )}
                    </div>
                  ) : movie.rating ? (
                    <div className="text-xs text-amber-400 font-semibold mb-2.5 text-center">
                      {movie.rating}
                    </div>
                  ) : null}

                  {/* 元数据标签 (年份 / 国家 / 类型 / 演职员) */}
                  {movie.metaInfo && (
                    <p className="text-[11px] text-white/70 leading-relaxed line-clamp-2 mb-2 font-light text-center px-1">
                      {movie.metaInfo}
                    </p>
                  )}

                  {/* 短评 */}
                  {movie.review && (
                    <p className="text-xs text-white/90 leading-relaxed line-clamp-3 mb-2.5 font-light italic text-center px-1">
                      "{movie.review}"
                    </p>
                  )}

                  {/* 观影日期 */}
                  {movie.date && (
                    <div className="text-[10px] text-white/50 pt-2 border-t border-white/10 w-full text-center mt-1">
                      <span>{movie.date}</span>
                    </div>
                  )}
                </div>
              </div>
            )
          })}
          {!loading && filteredMovies.length === 0 && (
            <div className="col-span-full py-20 text-center text-white/60 drop-shadow">
              该状态下暂无电影记录
            </div>
          )}
        </div>
      )}

      {/* 📚 书架画廊：4 列精致书架海报网格 + 居中悬停毛玻璃信息卡片 */}
      {!error && module === "books" && (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 sm:gap-4">
          {filteredBooks.map((book) => {
            const hasCover = Boolean(book.cover)

            return (
              <div
                key={book.id}
                onClick={() =>
                  book.notionUrl && window.open(book.notionUrl, "_blank")
                }
                className="group relative aspect-[2/3] w-full rounded-2xl overflow-hidden bg-white/10 dark:bg-black/35 backdrop-blur-2xl border border-white/20 hover:border-white/40 shadow-lg hover:shadow-2xl transition-all duration-300 hover:-translate-y-1 cursor-pointer select-none">
                {/* 底层毛玻璃占位 */}
                <div className="absolute inset-0 flex flex-col items-center justify-center text-white/40 p-4 text-center select-none pointer-events-none">
                  <BookOpen size={32} className="mb-2 opacity-50 text-white/50" />
                  <span className="text-xs text-white/60 line-clamp-2 px-2">{book.title}</span>
                </div>

                {/* 底层书籍封面 */}
                {hasCover && (
                  <img
                    src={book.cover}
                    alt={book.title}
                    className="absolute inset-0 w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                    loading="lazy"
                  />
                )}

                {/* 悬停/常驻毛玻璃信息遮罩 (所有元素绝对居中对齐) */}
                <div
                  className={`absolute inset-0 bg-black/65 dark:bg-black/75 backdrop-blur-xl p-3.5 sm:p-4 flex flex-col items-center justify-center text-center text-white transition-opacity duration-300 rounded-2xl ${
                    hasCover
                      ? "opacity-0 group-hover:opacity-100"
                      : "opacity-100"
                  }`}>
                  {/* 读书状态徽章 */}
                  {book.status && (
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-white/15 text-white/90 border border-white/20 mb-2 shadow-xs">
                      {book.status}
                    </span>
                  )}

                  {/* 书籍标题 */}
                  <h3 className="font-bold text-sm sm:text-base tracking-wide line-clamp-2 mb-2 drop-shadow-sm text-white text-center px-1">
                    {book.title}
                  </h3>

                  {/* 橙色星级评分 */}
                  {book.stars ? (
                    <div className="flex items-center justify-center gap-1 text-amber-500 mb-2.5">
                      <div className="flex items-center gap-0.5">
                        {Array.from({ length: 5 }).map((_, i) => (
                          <Star
                            key={i}
                            size={12}
                            className={
                              i < book.stars!
                                ? "fill-amber-500 text-amber-500"
                                : "text-white/20"
                            }
                          />
                        ))}
                      </div>
                      {book.rating && (
                        <span className="text-xs text-amber-400 font-semibold ml-1">
                          {book.rating}
                        </span>
                      )}
                    </div>
                  ) : book.rating ? (
                    <div className="text-xs text-amber-400 font-semibold mb-2.5 text-center">
                      {book.rating}
                    </div>
                  ) : null}

                  {/* 元数据标签 (作者 / 出版社 / 出版年 / 分类) */}
                  {book.metaInfo && (
                    <p className="text-[11px] text-white/70 leading-relaxed line-clamp-2 mb-2 font-light text-center px-1">
                      {book.metaInfo}
                    </p>
                  )}

                  {/* 阅读进度条 */}
                  {book.progress && (
                    <div className="my-1 w-full max-w-[130px]">
                      <div className="flex justify-between text-[10px] text-white/60 mb-1">
                        <span>阅读进度</span>
                        <span className="font-semibold text-sky-300">
                          {book.progress}
                        </span>
                      </div>
                      <div className="w-full h-1 rounded-full bg-white/20 overflow-hidden">
                        <div
                          className="h-full bg-sky-400 rounded-full"
                          style={{
                            width: book.progress.includes("%")
                              ? book.progress
                              : `${parseFloat(book.progress) || 0}%`
                          }}
                        />
                      </div>
                    </div>
                  )}

                  {/* 短评 / 书评 */}
                  {book.review && (
                    <p className="text-xs text-white/90 leading-relaxed line-clamp-3 mb-2.5 font-light italic text-center px-1">
                      "{book.review}"
                    </p>
                  )}

                  {/* 完成 / 出版日期 */}
                  {book.date && (
                    <div className="text-[10px] text-white/50 pt-2 border-t border-white/10 w-full text-center mt-1">
                      <span>{book.date}</span>
                    </div>
                  )}
                </div>
              </div>
            )
          })}
          {!loading && filteredBooks.length === 0 && (
            <div className="col-span-full py-20 text-center text-white/60 drop-shadow">
              该状态下暂无书籍记录
            </div>
          )}
        </div>
      )}

      {/* 💭 唠叨/随笔流（单列居中动态流 + 纯净正文 + 配图网格） */}
      {!error && module === "memos" && (
        <div className="w-full max-w-2xl mx-auto space-y-3.5 select-none">
          {/* 顶部工具栏 */}
          <div className="flex items-center justify-end gap-2 mb-1 px-1">
            <button
              type="button"
              onClick={loadData}
              disabled={loading}
              className="flex items-center justify-center w-7 h-7 rounded-full bg-black/40 hover:bg-black/60 backdrop-blur-md text-white/70 hover:text-white transition-all hover:scale-105"
              title="刷新数据">
              <RefreshCw size={13} className={loading ? "animate-spin" : ""} />
            </button>
            <button
              type="button"
              onClick={onOpenSettings}
              className="flex items-center justify-center w-7 h-7 rounded-full bg-black/40 hover:bg-black/60 backdrop-blur-md text-white/70 hover:text-white transition-all hover:scale-105"
              title="配置数据源">
              <Settings size={13} />
            </button>
          </div>

          {memos.map((memo) => (
            <div
              key={memo.id}
              onClick={() =>
                memo.notionUrl && window.open(memo.notionUrl, "_blank")
              }
              className="group relative rounded-2xl bg-white/95 dark:bg-[#1c1b18]/95 backdrop-blur-2xl border border-stone-200/60 dark:border-stone-800 p-5 sm:p-6 shadow-sm hover:shadow-md transition-all text-stone-800 dark:text-stone-100 cursor-pointer select-text [text-shadow:none] filter-none">
              {/* 顶部时间戳与标签 */}
              <div className="flex items-center justify-between mb-2 text-xs text-stone-400 dark:text-stone-500 font-mono tracking-wide select-none [text-shadow:none]">
                <span>{memo.date || "刚刚"}</span>
                {memo.tag && (
                  <span className="px-2 py-0.5 rounded-full bg-stone-100 dark:bg-stone-800 text-stone-600 dark:text-stone-300 text-[11px] font-sans font-medium">
                    #{memo.tag}
                  </span>
                )}
              </div>

              {/* 正文内容 (纯净无阴影、高清晰度字体) */}
              <p className="text-sm sm:text-[15px] leading-relaxed text-stone-800 dark:text-stone-100 font-normal whitespace-pre-wrap select-text [text-shadow:none] filter-none">
                {memo.content}
              </p>

              {/* 配图网格 */}
              {memo.images && memo.images.length > 0 && (
                <div
                  className={`mt-3.5 ${
                    memo.images.length === 1
                      ? "flex"
                      : memo.images.length === 2
                        ? "grid grid-cols-2 gap-2"
                        : "grid grid-cols-3 gap-2"
                  }`}>
                  {memo.images.map((imgUrl, idx) => (
                    <div
                      key={idx}
                      onClick={(e) => {
                        e.stopPropagation()
                        setLightbox({
                          isOpen: true,
                          images: memo.images!,
                          currentIndex: idx
                        })
                      }}
                      className={`relative overflow-hidden rounded-xl bg-stone-100 dark:bg-stone-800 border border-stone-200/50 dark:border-stone-700/50 cursor-pointer group/img ${
                        memo.images!.length === 1
                          ? "max-h-80 w-auto"
                          : "aspect-square w-full"
                      }`}>
                      <img
                        src={imgUrl}
                        alt="配图"
                        className="w-full h-full object-cover transition-transform duration-300 group-hover/img:scale-105"
                        loading="lazy"
                      />
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}

          {!loading && memos.length === 0 && (
            <div className="py-20 text-center text-white/60 drop-shadow">
              随笔库内暂无记录
            </div>
          )}
        </div>
      )}

      {/* 🏃 运动看板 */}
      {!error && module === "sports" && (
        <div className="flex-1 flex flex-col items-center justify-center py-20 text-center select-none">
          <div className="w-16 h-16 rounded-3xl bg-orange-500/20 border border-orange-500/30 backdrop-blur-xl flex items-center justify-center text-orange-300 mb-4 shadow-xl">
            <Flame size={32} />
          </div>
          <h3 className="text-lg font-bold text-white mb-2 drop-shadow">
            Keep 运动打卡中心
          </h3>
          <p className="text-sm text-white/80 max-w-md mb-6 leading-relaxed drop-shadow">
            连接 Notion 运动数据库后，将直接在此呈现你的每日跑步、骑行与打卡看板。
          </p>
          <button
            type="button"
            onClick={onOpenSettings}
            className="btn btn-sm btn-primary rounded-xl px-5 gap-2 shadow-lg">
            <Settings size={14} />
            配置运动数据库
          </button>
        </div>
      )}

      {/* 分页加载更多按钮 / 已加载全部提示 */}
      {!error && (module === "movies" || module === "books" || module === "memos") && (
        <div className="mt-8 mb-4 flex flex-col items-center justify-center select-none">
          {hasMore ? (
            <button
              type="button"
              onClick={handleLoadMore}
              disabled={loadingMore}
              className="px-6 py-2.5 rounded-full bg-white/10 hover:bg-white/20 dark:bg-black/40 dark:hover:bg-black/60 backdrop-blur-xl border border-white/20 hover:border-white/40 text-white text-xs font-medium transition-all shadow-lg hover:scale-105 flex items-center gap-2 cursor-pointer">
              {loadingMore ? (
                <>
                  <RefreshCw size={13} className="animate-spin" />
                  <span>加载中...</span>
                </>
              ) : (
                <span>加载更多</span>
              )}
            </button>
          ) : (
            (module === "movies"
              ? movies.length
              : module === "books"
                ? books.length
                : memos.length) > 12 && (
              <span className="text-[11px] text-white/40 font-light tracking-wider">
                · 已加载全部数据 ·
              </span>
            )
          )}
        </div>
      )}

      {/* 🖼️ 大图预览灯箱 (Lightbox) */}
      {lightbox.isOpen && lightbox.images.length > 0 && (
        <div
          onClick={() => setLightbox((prev) => ({ ...prev, isOpen: false }))}
          className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-black/85 backdrop-blur-2xl p-4 animate-in fade-in duration-200 select-none">
          {/* 左侧悬浮大切换按钮 */}
          {lightbox.images.length > 1 && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation()
                setLightbox((prev) => ({
                  ...prev,
                  currentIndex:
                    (prev.currentIndex - 1 + prev.images.length) %
                    prev.images.length
                }))
              }}
              className="fixed left-4 sm:left-8 top-1/2 -translate-y-1/2 z-50 flex items-center justify-center w-12 h-12 rounded-full bg-white/10 hover:bg-white/25 active:scale-95 text-white/85 hover:text-white backdrop-blur-xl border border-white/20 shadow-2xl transition-all hover:scale-110 cursor-pointer"
              title="上一张 (←)">
              <ChevronLeft size={24} strokeWidth={2.5} />
            </button>
          )}

          {/* 右侧悬浮大切换按钮 */}
          {lightbox.images.length > 1 && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation()
                setLightbox((prev) => ({
                  ...prev,
                  currentIndex: (prev.currentIndex + 1) % prev.images.length
                }))
              }}
              className="fixed right-4 sm:right-8 top-1/2 -translate-y-1/2 z-50 flex items-center justify-center w-12 h-12 rounded-full bg-white/10 hover:bg-white/25 active:scale-95 text-white/85 hover:text-white backdrop-blur-xl border border-white/20 shadow-2xl transition-all hover:scale-110 cursor-pointer"
              title="下一张 (→ / 点击图片)">
              <ChevronRight size={24} strokeWidth={2.5} />
            </button>
          )}

          {/* 大图展示区域 (点击图片直接切换下一张) */}
          <div
            onClick={(e) => {
              e.stopPropagation()
              if (lightbox.images.length > 1) {
                setLightbox((prev) => ({
                  ...prev,
                  currentIndex: (prev.currentIndex + 1) % prev.images.length
                }))
              }
            }}
            className={`relative max-w-5xl max-h-[82vh] flex items-center justify-center ${
              lightbox.images.length > 1 ? "cursor-pointer" : ""
            }`}
            title={lightbox.images.length > 1 ? "点击切换下一张" : undefined}>
            <img
              key={lightbox.currentIndex}
              src={lightbox.images[lightbox.currentIndex]}
              alt={`预览图 ${lightbox.currentIndex + 1}`}
              className="max-h-[82vh] max-w-[90vw] object-contain rounded-2xl shadow-2xl transition-all duration-300 animate-in fade-in zoom-in-95 duration-200"
            />
          </div>

          {/* 底部悬浮控制胶囊 */}
          <div
            onClick={(e) => e.stopPropagation()}
            className="fixed bottom-8 flex items-center gap-4 px-5 py-2.5 rounded-full bg-[#1e1d1b]/90 border border-white/15 text-white shadow-2xl backdrop-blur-xl animate-in slide-in-from-bottom-3 duration-300">
            {/* 序号计数 */}
            <span className="text-xs font-medium text-white/80 font-mono tracking-wider min-w-[36px]">
              <strong className="text-white font-bold">{lightbox.currentIndex + 1}</strong> / {lightbox.images.length}
            </span>

            {/* 上一张 / 下一张按钮 */}
            {lightbox.images.length > 1 && (
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() =>
                    setLightbox((prev) => ({
                      ...prev,
                      currentIndex:
                        (prev.currentIndex - 1 + prev.images.length) %
                        prev.images.length
                    }))
                  }
                  className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 active:scale-95 text-white/80 hover:text-white transition-all cursor-pointer"
                  title="上一张 (←)">
                  <ChevronLeft size={16} />
                </button>
                <button
                  type="button"
                  onClick={() =>
                    setLightbox((prev) => ({
                      ...prev,
                      currentIndex:
                        (prev.currentIndex + 1) % prev.images.length
                    }))
                  }
                  className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 active:scale-95 text-white/80 hover:text-white transition-all cursor-pointer"
                  title="下一张 (→)">
                  <ChevronRight size={16} />
                </button>
              </div>
            )}

            <div className="w-[1px] h-4 bg-white/15 mx-0.5" />

            {/* 关闭按钮 */}
            <button
              type="button"
              onClick={() => setLightbox((prev) => ({ ...prev, isOpen: false }))}
              className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 active:scale-95 text-white/80 hover:text-white transition-all cursor-pointer"
              title="关闭 (Esc)">
              <X size={16} />
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
