import {
  fetchNotionPageBlocks,
  getFirstTitle,
  getNotionPropertyFileUrl,
  getNotionPropertyText,
  normalizeWeReadCover,
  queryNotionSource,
  type NotionPage
} from "./api"
import { normalizeNotionId } from "./notion"
import type { NewTabSettings } from "./settingsStore"

export interface MovieItem {
  id: string
  title: string
  cover?: string
  rating?: number | string
  stars?: number
  status?: string
  date?: string
  review?: string
  metaInfo?: string
  notionUrl?: string
}

export interface WeReadReadingStats {
  weeklySeconds: number
  weeklyFormatted: string
  weeklyDays: number
  monthlySeconds: number
  monthlyFormatted: string
  monthlyDays: number
  rankText?: string
}

export interface BookItem {
  id: string
  title: string
  cover?: string
  author?: string
  progress?: string
  rating?: number | string
  stars?: number
  status?: string
  date?: string
  review?: string
  metaInfo?: string
  notionUrl?: string
}

export interface MemoItem {
  id: string
  content: string
  date?: string
  rawDate?: string
  tag?: string
  images?: string[]
  notionUrl?: string
}

function getPageCover(page: NotionPage): string {
  const cover = page.cover
  if (!cover) return ""
  if (cover.type === "external") return cover.external?.url || ""
  if (cover.type === "file") return cover.file?.url || ""
  return ""
}

// ==================== 观影数据拉取 ====================
export async function fetchMoviesList(
  settings: NewTabSettings,
  cursor?: string
): Promise<{
  items: MovieItem[]
  hasMore: boolean
  nextCursor?: string | null
  error?: string
}> {
  const token = (
    settings.moviesNotionToken?.trim() ||
    settings.backgroundNotionToken?.trim() ||
    settings.notesNotionToken?.trim() ||
    settings.musicNotionToken?.trim()
  )
  const rawDatabaseId = settings.moviesNotionDatabaseId?.trim()
  const databaseId = normalizeNotionId(rawDatabaseId)

  if (!token || !databaseId) {
    return { items: [], hasMore: false, error: "missing_config" }
  }

  try {
    const response = await queryNotionSource(token, databaseId, {
      page_size: 100,
      start_cursor: cursor || undefined
    })
    const pages = response.results || []
    const items: MovieItem[] = pages.map((page) => {
      const props = page.properties || {}
      const title =
        getNotionPropertyText(props[settings.moviesTitleProperty || ""]) ||
        getFirstTitle(props) ||
        "未命名电影"

      let cover = ""
      if (settings.moviesCoverProperty === "__page_cover__") {
        cover = getPageCover(page)
      } else if (settings.moviesCoverProperty) {
        cover =
          getNotionPropertyFileUrl(props[settings.moviesCoverProperty]) ||
          getPageCover(page)
      } else {
        cover = getPageCover(page)
      }

      // 提取评分与星级
      const rawRating =
        getNotionPropertyText(props[settings.moviesRatingProperty || ""]) ||
        getNotionPropertyText(props["豆瓣评分"]) ||
        getNotionPropertyText(props["评分"])

      let stars = 0
      if (rawRating) {
        if (rawRating.includes("⭐️") || rawRating.includes("★")) {
          stars = (rawRating.match(/[⭐️★]/g) || []).length
        } else {
          const num = parseFloat(rawRating)
          if (!isNaN(num)) {
            stars = num > 5 ? Math.round(num / 2) : Math.round(num)
          }
        }
      }

      // 提取日期
      let date =
        getNotionPropertyText(props[settings.moviesDateProperty || ""]) ||
        getNotionPropertyText(props["上映日期"]) ||
        getNotionPropertyText(props["日期"])
      if (date) {
        const cleanDate = date.slice(0, 10)
        const parts = cleanDate.split("-")
        if (parts.length === 3) {
          date = `${parts[0]}年${parts[1]}月${parts[2]}日`
        }
      }

      // 提取短评
      const review =
        getNotionPropertyText(props[settings.moviesReviewProperty || ""]) ||
        getNotionPropertyText(props["短评"]) ||
        getNotionPropertyText(props["影评"]) ||
        getNotionPropertyText(props["评价"]) ||
        getNotionPropertyText(props["剧情简介"])

      // 组装元数据信息 (年份 / 国家 / 类型 / 演职员)
      const year =
        getNotionPropertyText(props["上映年份"]) ||
        getNotionPropertyText(props["年份"]) ||
        (date ? date.slice(0, 4) : "")

      const country =
        getNotionPropertyText(props["制片国家"]) ||
        getNotionPropertyText(props["国家"]) ||
        getNotionPropertyText(props["地区"])

      const genres =
        getNotionPropertyText(props["类型"]) ||
        getNotionPropertyText(props["豆瓣标签"]) ||
        getNotionPropertyText(props["分类"]) ||
        getNotionPropertyText(props["标签"])

      const director = getNotionPropertyText(props["导演"])
      const cast = getNotionPropertyText(props["演员"])
      const status =
        getNotionPropertyText(props["状态"]) ||
        getNotionPropertyText(props["观看状态"]) ||
        getNotionPropertyText(props["Status"])

      const metaParts = [year, country, genres, director, cast].filter(Boolean)
      const metaInfo = metaParts.length > 0 ? metaParts.join(" / ") : undefined

      return {
        id: page.id,
        title,
        cover: cover || undefined,
        rating: rawRating || undefined,
        stars: stars > 0 ? stars : undefined,
        status: status || undefined,
        date: date || undefined,
        review: review || undefined,
        metaInfo,
        notionUrl:
          page.url || `https://www.notion.so/${page.id.replace(/-/g, "")}`
      }
    })

    return {
      items,
      hasMore: Boolean(response.has_more),
      nextCursor: response.next_cursor
    }
  } catch (err: any) {
    return {
      items: [],
      hasMore: false,
      error: err?.message || "拉取观影数据失败"
    }
  }
}

export function formatReadingDuration(seconds?: number): string {
  if (!seconds || seconds <= 0) return "0分钟"
  const hours = Math.floor(seconds / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)

  if (hours > 0) {
    return minutes > 0 ? `${hours}小时${minutes}分钟` : `${hours}小时`
  }
  return `${minutes || 1}分钟`
}

// ==================== 微信读书书架数据拉取 ====================
export async function fetchWeReadBooksList(
  settings: NewTabSettings
): Promise<{
  items: BookItem[]
  hasMore: boolean
  nextCursor?: string | null
  readingStats?: WeReadReadingStats
  error?: string
}> {
  const apiKey = settings.wereadApiKey?.trim()
  if (!apiKey) {
    return { items: [], hasMore: false, error: "missing_config" }
  }

  try {
    const [notebooksResult, weeklyResult, monthlyResult] =
      await Promise.allSettled([
        fetch("https://i.weread.qq.com/api/agent/gateway", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${apiKey}`,
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            api_name: "/user/notebooks",
            skill_version: "1.0.4",
            count: 100
          })
        }),
        fetch("https://i.weread.qq.com/api/agent/gateway", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${apiKey}`,
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            api_name: "/readdata/detail",
            skill_version: "1.0.4",
            mode: "weekly"
          })
        }),
        fetch("https://i.weread.qq.com/api/agent/gateway", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${apiKey}`,
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            api_name: "/readdata/detail",
            skill_version: "1.0.4",
            mode: "monthly"
          })
        })
      ])

    if (notebooksResult.status !== "fulfilled" || !notebooksResult.value.ok) {
      throw new Error("微信读书笔记本服务响应异常")
    }

    const data = await notebooksResult.value.json()
    if (data.errcode && data.errcode !== 0) {
      throw new Error(data.errmsg || `微信读书接口返回错误码 ${data.errcode}`)
    }

    // 解析统计数据
    let readingStats: WeReadReadingStats | undefined
    try {
      let weeklyData: any = {}
      let monthlyData: any = {}
      if (weeklyResult.status === "fulfilled" && weeklyResult.value.ok) {
        weeklyData = await weeklyResult.value.json()
      }
      if (monthlyResult.status === "fulfilled" && monthlyResult.value.ok) {
        monthlyData = await monthlyResult.value.json()
      }

      const weeklySeconds = Number(weeklyData.totalReadTime) || 0
      const monthlySeconds = Number(monthlyData.totalReadTime) || 0
      const weeklyDays = Number(weeklyData.readDays) || 0
      const monthlyDays = Number(monthlyData.readDays) || 0
      const rankText = weeklyData.rank?.text || undefined

      if (weeklySeconds > 0 || monthlySeconds > 0 || weeklyDays > 0) {
        readingStats = {
          weeklySeconds,
          weeklyFormatted: formatReadingDuration(weeklySeconds),
          weeklyDays,
          monthlySeconds,
          monthlyFormatted: formatReadingDuration(monthlySeconds),
          monthlyDays,
          rankText
        }
      }
    } catch {
      // 忽略统计数据解析容错
    }

    const rawBooks = Array.isArray(data.books) ? data.books : []
    const items: BookItem[] = rawBooks.map((item: any) => {
      const book = item.book || {}
      const bookId = String(item.bookId || book.bookId || "")
      const title = book.title || item.title || "未命名书籍"
      const author = book.author || item.author
      const cover = normalizeWeReadCover(book.cover || item.cover, "")
      const progress =
        typeof item.readingProgress === "number"
          ? `${item.readingProgress}%`
          : undefined

      let status = "已读"
      if (item.readingProgress === 100 || item.markedStatus === 4) {
        status = "已读"
      } else if (item.readingProgress > 0 && item.readingProgress < 100) {
        status = "在读"
      } else if (item.markedStatus === 1) {
        status = "想读"
      }

      const categories = (book.categories || [])
        .map((c: any) => c.title)
        .filter(Boolean)
      const metaParts = [author, categories[0]].filter(Boolean)
      const metaInfo = metaParts.length > 0 ? metaParts.join(" / ") : undefined

      let review: string | undefined
      if (item.noteCount || item.reviewCount) {
        review = `已记录 ${item.noteCount || 0} 处划线笔记`
      }

      let date: string | undefined
      if (item.sort) {
        const d = new Date(item.sort * 1000)
        date = `${d.getFullYear()}年${String(d.getMonth() + 1).padStart(2, "0")}月${String(d.getDate()).padStart(2, "0")}日`
      }

      return {
        id: bookId,
        title,
        cover,
        author,
        progress,
        status,
        metaInfo,
        review,
        date,
        notionUrl:
          book.deepLink ||
          (bookId
            ? `https://weread.qq.com/web/reader/${bookId}`
            : "https://weread.qq.com")
      }
    })

    return {
      items,
      hasMore: false,
      readingStats
    }
  } catch (err: any) {
    return {
      items: [],
      hasMore: false,
      error: err?.message || "拉取微信读书书架失败"
    }
  }
}

// ==================== Notion 书架数据拉取 ====================
async function fetchNotionBooksList(
  settings: NewTabSettings,
  cursor?: string
): Promise<{
  items: BookItem[]
  hasMore: boolean
  nextCursor?: string | null
  error?: string
}> {
  const token =
    settings.booksNotionToken?.trim() ||
    settings.backgroundNotionToken?.trim() ||
    settings.notesNotionToken?.trim() ||
    settings.musicNotionToken?.trim()
  const rawDatabaseId = settings.booksNotionDatabaseId?.trim()
  const databaseId = normalizeNotionId(rawDatabaseId)

  if (!token || !databaseId) {
    return { items: [], hasMore: false, error: "missing_config" }
  }

  try {
    const response = await queryNotionSource(token, databaseId, {
      page_size: 100,
      start_cursor: cursor || undefined
    })
    const pages = response.results || []
    const items: BookItem[] = pages.map((page) => {
      const props = page.properties || {}
      const title =
        getNotionPropertyText(props[settings.booksTitleProperty || ""]) ||
        getFirstTitle(props) ||
        "未命名书籍"

      let cover = ""
      if (settings.booksCoverProperty === "__page_cover__") {
        cover = getPageCover(page)
      } else if (settings.booksCoverProperty) {
        cover =
          getNotionPropertyFileUrl(props[settings.booksCoverProperty]) ||
          getPageCover(page)
      } else {
        cover = getPageCover(page)
      }

      const rawRating =
        getNotionPropertyText(props[settings.booksRatingProperty || ""]) ||
        getNotionPropertyText(props["豆瓣评分"]) ||
        getNotionPropertyText(props["评分"]) ||
        getNotionPropertyText(props["我的评分"])

      let stars = 0
      if (rawRating) {
        if (rawRating.includes("⭐️") || rawRating.includes("★")) {
          stars = (rawRating.match(/[⭐️★]/g) || []).length
        } else {
          const num = parseFloat(rawRating)
          if (!isNaN(num)) {
            stars = num > 5 ? Math.round(num / 2) : Math.round(num)
          }
        }
      }

      const author =
        getNotionPropertyText(props[settings.booksAuthorProperty || ""]) ||
        getNotionPropertyText(props["作者"]) ||
        getNotionPropertyText(props["Author"])

      const progress =
        getNotionPropertyText(props[settings.booksProgressProperty || ""]) ||
        getNotionPropertyText(props["阅读进度"]) ||
        getNotionPropertyText(props["进度"]) ||
        getNotionPropertyText(props["Progress"])

      const status =
        getNotionPropertyText(props["状态"]) ||
        getNotionPropertyText(props["阅读状态"]) ||
        getNotionPropertyText(props["读书状态"]) ||
        getNotionPropertyText(props["Status"])

      // 提取日期
      let date =
        getNotionPropertyText(props["完成日期"]) ||
        getNotionPropertyText(props["阅读日期"]) ||
        getNotionPropertyText(props["出版日期"]) ||
        getNotionPropertyText(props["日期"])
      if (date) {
        const cleanDate = date.slice(0, 10)
        const parts = cleanDate.split("-")
        if (parts.length === 3) {
          date = `${parts[0]}年${parts[1]}月${parts[2]}日`
        }
      }

      // 提取短评
      const review =
        getNotionPropertyText(props["短评"]) ||
        getNotionPropertyText(props["书评"]) ||
        getNotionPropertyText(props["评价"]) ||
        getNotionPropertyText(props["简介"])

      // 组装元数据信息 (作者 / 出版社 / 出版年 / 分类)
      const publisher =
        getNotionPropertyText(props["出版社"]) ||
        getNotionPropertyText(props["出版方"])
      const pubYear =
        getNotionPropertyText(props["出版年"]) ||
        getNotionPropertyText(props["出版年份"])
      const genres =
        getNotionPropertyText(props["分类"]) ||
        getNotionPropertyText(props["标签"]) ||
        getNotionPropertyText(props["类型"])

      const metaParts = [author, publisher, pubYear, genres].filter(Boolean)
      const metaInfo = metaParts.length > 0 ? metaParts.join(" / ") : undefined

      return {
        id: page.id,
        title,
        cover: cover || undefined,
        author: author || undefined,
        progress: progress || undefined,
        rating: rawRating || undefined,
        stars: stars > 0 ? stars : undefined,
        status: status || undefined,
        date: date || undefined,
        review: review || undefined,
        metaInfo,
        notionUrl:
          page.url || `https://www.notion.so/${page.id.replace(/-/g, "")}`
      }
    })

    return {
      items,
      hasMore: Boolean(response.has_more),
      nextCursor: response.next_cursor
    }
  } catch (err: any) {
    return {
      items: [],
      hasMore: false,
      error: err?.message || "拉取 Notion 书架数据失败"
    }
  }
}

// ==================== 统一书架数据入口 (支持微信读书与 Notion) ====================
export async function fetchBooksList(
  settings: NewTabSettings,
  cursor?: string
): Promise<{
  items: BookItem[]
  hasMore: boolean
  nextCursor?: string | null
  readingStats?: WeReadReadingStats
  error?: string
}> {
  const chosenSource = settings.booksSource

  // 1. 如果用户显式选择了微信读书，或未显式指定但配置了微信读书 Key 且未配 Notion
  if (chosenSource === "weread") {
    if (settings.wereadApiKey?.trim()) {
      return fetchWeReadBooksList(settings)
    }
    // 微信读书未填 key，但配了 Notion 则智能回退
    const token =
      settings.booksNotionToken?.trim() ||
      settings.notesNotionToken?.trim() ||
      settings.backgroundNotionToken?.trim()
    if (token && settings.booksNotionDatabaseId?.trim()) {
      return fetchNotionBooksList(settings, cursor)
    }
    return { items: [], hasMore: false, error: "missing_config" }
  }

  // 2. 如果用户显式选择了 Notion
  if (chosenSource === "notion") {
    const token =
      settings.booksNotionToken?.trim() ||
      settings.notesNotionToken?.trim() ||
      settings.backgroundNotionToken?.trim()
    if (token && settings.booksNotionDatabaseId?.trim()) {
      return fetchNotionBooksList(settings, cursor)
    }
    // Notion 未配，但配了微信读书 key 则智能回退
    if (settings.wereadApiKey?.trim()) {
      return fetchWeReadBooksList(settings)
    }
    return { items: [], hasMore: false, error: "missing_config" }
  }

  // 3. 默认自动探测：优先微信读书，次选 Notion
  if (settings.wereadApiKey?.trim()) {
    return fetchWeReadBooksList(settings)
  }
  const token =
    settings.booksNotionToken?.trim() ||
    settings.notesNotionToken?.trim() ||
    settings.backgroundNotionToken?.trim()
  if (token && settings.booksNotionDatabaseId?.trim()) {
    return fetchNotionBooksList(settings, cursor)
  }

  return { items: [], hasMore: false, error: "missing_config" }
}

// ==================== 随笔/唠叨数据拉取 ====================
export async function fetchMemosList(
  settings: NewTabSettings,
  cursor?: string
): Promise<{
  items: MemoItem[]
  hasMore: boolean
  nextCursor?: string | null
  error?: string
}> {
  const token = (
    settings.memosNotionToken?.trim() ||
    settings.backgroundNotionToken?.trim() ||
    settings.notesNotionToken?.trim() ||
    settings.musicNotionToken?.trim()
  )
  const rawDatabaseId = settings.memosNotionDatabaseId?.trim()
  const databaseId = normalizeNotionId(rawDatabaseId)

  if (!token || !databaseId) {
    return { items: [], hasMore: false, error: "missing_config" }
  }

  try {
    const response = await queryNotionSource(token, databaseId, {
      page_size: 100,
      start_cursor: cursor || undefined
    })
    const pages = response.results || []
    const items: MemoItem[] = await Promise.all(
      pages.map(async (page) => {
        const props = page.properties || {}

        // 并发拉取 page 内部 blocks 正文
        const blockData = await fetchNotionPageBlocks(token, page.id)

        // 优先使用 page 内部正文内容
        let content = blockData.text.trim()
        if (!content && settings.memosContentProperty) {
          content = getNotionPropertyText(props[settings.memosContentProperty])
        }
        if (!content) {
          content =
            getNotionPropertyText(props["正文"]) ||
            getNotionPropertyText(props["内容"]) ||
            getNotionPropertyText(props["Content"]) ||
            getNotionPropertyText(props["Memo"]) ||
            getNotionPropertyText(props["Note"]) ||
            getFirstTitle(props) ||
            "无内容"
        }

        const rawDate =
          getNotionPropertyText(props[settings.memosDateProperty || ""]) ||
          getNotionPropertyText(props["日期"]) ||
          getNotionPropertyText(props["创建时间"]) ||
          page.created_time ||
          ""

        let formattedDate = ""
        if (rawDate) {
          try {
            const d = new Date(rawDate)
            if (!isNaN(d.getTime())) {
              const mm = String(d.getMonth() + 1).padStart(2, "0")
              const dd = String(d.getDate()).padStart(2, "0")
              const hh = String(d.getHours()).padStart(2, "0")
              const min = String(d.getMinutes()).padStart(2, "0")
              formattedDate = `${mm}-${dd} ${hh}:${min}`
            } else {
              formattedDate = rawDate.slice(5, 16)
            }
          } catch {
            formattedDate = rawDate.slice(5, 16)
          }
        }

        const tag =
          getNotionPropertyText(props[settings.memosTagProperty || ""]) ||
          getNotionPropertyText(props["标签"]) ||
          getNotionPropertyText(props["Tag"]) ||
          getNotionPropertyText(props["分类"])

        // 提取并合并图片 (正文 blocks 图片 + 属性文件 + 页面封面)
        const images: string[] = [...blockData.images]
        for (const prop of Object.values(props)) {
          if (prop.type === "files" && prop.files?.length) {
            for (const file of prop.files) {
              let url = ""
              if (file.type === "external") url = file.external?.url || ""
              if (file.type === "file") url = file.file?.url || ""
              if (
                url &&
                (/\.(jpg|jpeg|png|webp|gif|avif)/i.test(url) ||
                  url.includes("amazonaws.com") ||
                  url.includes("notion.so")) &&
                !images.includes(url)
              ) {
                images.push(url)
              }
            }
          }
        }
        const cover = getPageCover(page)
        if (cover && !images.includes(cover)) {
          images.unshift(cover)
        }

        return {
          id: page.id,
          content,
          date: formattedDate || undefined,
          rawDate: rawDate || undefined,
          tag: tag || undefined,
          images: images.length > 0 ? images : undefined,
          notionUrl:
            page.url || `https://www.notion.so/${page.id.replace(/-/g, "")}`
        }
      })
    )

    return {
      items,
      hasMore: Boolean(response.has_more),
      nextCursor: response.next_cursor
    }
  } catch (err: any) {
    return {
      items: [],
      hasMore: false,
      error: err?.message || "拉取随笔数据失败"
    }
  }
}
