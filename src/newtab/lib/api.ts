import {
  defaultSettings,
  newTabStorage,
  type NewTabSettings
} from "./settingsStore"

const NOTION_VERSION = "2025-09-03"
const NOTION_PAGE_SIZE = 50

export interface Highlight {
  text: string
  originalText?: string
  book: string
  bookUrl?: string
  cover?: string
  author: string
  kind: "bookmark" | "review"
  notionUrl: string
}

export interface HighlightResult {
  highlight: Highlight | null
  status: "ready" | "missing_notion" | "empty" | "error"
  targetDate?: string
  message?: string
}

export type NotionPropertySchema = {
  name: string
  type: string
}

type NotionTextFragment = {
  plain_text?: string
}

type NotionFileReference = {
  type?: "external" | "file"
  name?: string
  external?: { url?: string }
  file?: { url?: string }
}

type NotionSelectValue = {
  name?: string
}

type NotionProperty = {
  type?: string
  title?: NotionTextFragment[]
  rich_text?: NotionTextFragment[]
  files?: NotionFileReference[]
  date?: { start?: string | null }
  number?: number | null
  select?: NotionSelectValue | null
  multi_select?: NotionSelectValue[]
  formula?: {
    type?: string
    string?: string | null
    number?: number | null
    boolean?: boolean | null
    date?: { start?: string | null } | null
  }
  url?: string | null
}

export type NotionPage = {
  id: string
  url?: string
  cover?: NotionFileReference | null
  icon?: NotionFileReference | null
  properties?: Record<string, NotionProperty>
}

type NotionQueryResponse = {
  results?: NotionPage[]
  has_more?: boolean
  next_cursor?: string | null
}

type WeReadBookmark = {
  markText?: string
  review?: string
  abstract?: string
  book?: {
    title?: string
    author?: string
    cover?: string
  }
  bookId?: string
  title?: string
  author?: string
  cover?: string
}

async function getSettings(): Promise<NewTabSettings> {
  const stored = await newTabStorage.get<Partial<NewTabSettings>>(
    "notionhub_tab_settings"
  )
  return { ...defaultSettings, ...(stored || {}) }
}

function getPlainText(items?: NotionTextFragment[]): string {
  return (items ?? [])
    .map((item) => item.plain_text ?? "")
    .join("")
    .trim()
}

function getFileUrl(file?: NotionFileReference | null): string {
  if (!file) return ""
  if (file.type === "external") return file.external?.url ?? ""
  if (file.type === "file") return file.file?.url ?? ""
  return file.external?.url ?? file.file?.url ?? ""
}

export function getNotionPropertyText(property?: NotionProperty): string {
  if (!property) return ""
  const title = getPlainText(property.title)
  if (title) return title
  const richText = getPlainText(property.rich_text)
  if (richText) return richText
  if (property.select?.name) return property.select.name
  if (property.multi_select?.length) {
    return property.multi_select
      .map((item) => item.name)
      .filter(Boolean)
      .join("、")
  }
  if (property.date?.start) return property.date.start
  if (typeof property.number === "number") return String(property.number)
  if (property.url) return property.url
  if (property.formula?.type === "string") return property.formula.string ?? ""
  if (typeof property.formula?.number === "number") {
    return String(property.formula.number)
  }
  if (typeof property.formula?.boolean === "boolean") {
    return property.formula.boolean ? "true" : "false"
  }
  if (property.formula?.date?.start) return property.formula.date.start
  return ""
}

export function getNotionPropertyFileUrl(property?: NotionProperty): string {
  const file = property?.files?.[0]
  if (file) return getFileUrl(file)
  const text = getNotionPropertyText(property)
  return /^https?:\/\//i.test(text) ? text : ""
}

function getFirstTitle(properties: Record<string, NotionProperty>): string {
  for (const property of Object.values(properties)) {
    if (property.type === "title") {
      const text = getNotionPropertyText(property)
      if (text) return text
    }
  }

  return ""
}

function getPageCover(page: NotionPage): string {
  return getFileUrl(page.cover) || getFileUrl(page.icon)
}

async function notionFetch<T>(
  token: string,
  path: string,
  init?: RequestInit
): Promise<T> {
  const response = await fetch(`https://api.notion.com/v1/${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      "Notion-Version": NOTION_VERSION,
      ...(init?.headers || {})
    }
  })

  if (!response.ok) {
    throw new Error(`Notion API ${response.status}`)
  }

  return (await response.json()) as T
}

export async function queryNotionSource(
  token: string,
  sourceId: string,
  body: Record<string, unknown> = {}
): Promise<NotionQueryResponse> {
  try {
    return await notionFetch<NotionQueryResponse>(
      token,
      `data_sources/${sourceId}/query`,
      {
        method: "POST",
        body: JSON.stringify({ page_size: NOTION_PAGE_SIZE, ...body })
      }
    )
  } catch (error) {
    return await notionFetch<NotionQueryResponse>(
      token,
      `databases/${sourceId}/query`,
      {
        method: "POST",
        body: JSON.stringify({ page_size: NOTION_PAGE_SIZE, ...body })
      }
    )
  }
}

export async function fetchNotionProperties(
  token: string,
  sourceId: string
): Promise<NotionPropertySchema[]> {
  let metadata: { properties?: Record<string, { type?: string }> }

  try {
    metadata = await notionFetch(token, `data_sources/${sourceId}`)
  } catch {
    metadata = await notionFetch(token, `databases/${sourceId}`)
  }

  return Object.entries(metadata.properties || {}).map(([name, property]) => ({
    name,
    type: property.type || "unknown"
  }))
}

export async function getNotionBackgroundImage(
  token: string,
  sourceId: string,
  source: "cover" | "files",
  filesProperty?: string
): Promise<string | null> {
  const data = await queryNotionSource(token, sourceId, { page_size: 20 })

  for (const page of data.results || []) {
    if (source === "cover") {
      const cover = getPageCover(page)
      if (cover) return cover
    }

    const url = getNotionPropertyFileUrl(page.properties?.[filesProperty || ""])
    if (url) return url
  }

  return null
}

function mapNotionHighlight(
  page: NotionPage,
  settings: NewTabSettings
): Highlight | null {
  const properties = page.properties || {}
  const content = getNotionPropertyText(
    properties[settings.notesContentProperty || ""]
  )
  if (!content) return null

  const title =
    getNotionPropertyText(properties[settings.notesTitleProperty || ""]) ||
    getFirstTitle(properties) ||
    "Notion 笔记"
  const source =
    getNotionPropertyText(properties[settings.notesSourceProperty || ""]) ||
    title
  const cover =
    getNotionPropertyFileUrl(properties[settings.notesCoverProperty || ""]) ||
    getPageCover(page)

  return {
    text: content,
    book: source,
    cover: cover || undefined,
    author: "",
    kind: "bookmark",
    notionUrl: page.url || `https://www.notion.so/${page.id.replace(/-/g, "")}`
  }
}

async function getNotionHighlightResult(
  settings: NewTabSettings
): Promise<HighlightResult> {
  if (
    !settings.notesNotionToken ||
    !settings.notesNotionDatabaseId ||
    !settings.notesContentProperty
  ) {
    return {
      highlight: null,
      status: "missing_notion",
      message: "请先配置 Notion 笔记数据库和字段映射。"
    }
  }

  const sorts = settings.notesDateProperty
    ? [{ property: settings.notesDateProperty, direction: "descending" }]
    : undefined
  const data = await queryNotionSource(
    settings.notesNotionToken,
    settings.notesNotionDatabaseId,
    sorts ? { sorts } : {}
  )
  const highlights = (data.results || [])
    .map((page) => mapNotionHighlight(page, settings))
    .filter(Boolean) as Highlight[]

  if (!highlights.length) {
    return {
      highlight: null,
      status: "empty",
      message: "没有找到可展示的 Notion 笔记。"
    }
  }

  return {
    highlight: highlights[Math.floor(Math.random() * highlights.length)],
    status: "ready"
  }
}

async function fetchWeReadJson<T>(apiKey: string, path: string): Promise<T> {
  const response = await fetch(`https://i.weread.qq.com${path}`, {
    headers: {
      Authorization: `Bearer ${apiKey}`
    }
  })

  if (!response.ok) {
    throw new Error(`WeRead API ${response.status}`)
  }

  return (await response.json()) as T
}

function normalizeWeReadHighlight(item: WeReadBookmark): Highlight | null {
  const text = item.markText || item.review || item.abstract || ""
  const book = item.book?.title || item.title || "微信读书"
  if (!text) return null

  return {
    text,
    originalText: item.abstract && item.review ? item.abstract : undefined,
    book,
    bookUrl: item.bookId
      ? `https://weread.qq.com/web/reader/${item.bookId}`
      : undefined,
    cover: item.book?.cover || item.cover,
    author: item.book?.author || item.author || "",
    kind: item.review ? "review" : "bookmark",
    notionUrl: item.bookId
      ? `https://weread.qq.com/web/reader/${item.bookId}`
      : "https://weread.qq.com"
  }
}

async function getWeReadHighlightResult(
  settings: NewTabSettings
): Promise<HighlightResult> {
  if (!settings.wereadApiKey) {
    return {
      highlight: null,
      status: "missing_notion",
      message: "请先配置微信读书 Key。"
    }
  }

  const notebooks = await fetchWeReadJson<{
    books?: Array<{
      bookId?: string
      title?: string
      author?: string
      cover?: string
    }>
  }>(settings.wereadApiKey, "/web/book/bookmarklist")

  const items: Highlight[] = []
  const books = Array.isArray(notebooks.books)
    ? notebooks.books.slice(0, 8)
    : []

  for (const book of books) {
    if (!book.bookId) continue
    try {
      const data = await fetchWeReadJson<{
        updated?: WeReadBookmark[]
        chapters?: Array<{ bookmarks?: WeReadBookmark[] }>
      }>(
        settings.wereadApiKey,
        `/web/book/bookmarklist?bookId=${encodeURIComponent(book.bookId)}`
      )
      const bookmarks = [
        ...(data.updated || []),
        ...(data.chapters || []).flatMap((chapter) => chapter.bookmarks || [])
      ]
      for (const item of bookmarks) {
        const normalized = normalizeWeReadHighlight({
          ...item,
          book: item.book || book,
          bookId: item.bookId || book.bookId
        })
        if (normalized) items.push(normalized)
      }
    } catch {
      // Keep reading other books when one WeRead request fails.
    }
  }

  if (!items.length) {
    return {
      highlight: null,
      status: "empty",
      message: "没有找到可展示的微信读书划线。"
    }
  }

  return {
    highlight: items[Math.floor(Math.random() * items.length)],
    status: "ready"
  }
}

export async function getRandomHighlightResult(): Promise<HighlightResult> {
  try {
    const settings = await getSettings()
    if (!settings.showHighlights) {
      return { highlight: null, status: "empty" }
    }

    if (settings.notesSource === "weread") {
      return await getWeReadHighlightResult(settings)
    }

    return await getNotionHighlightResult(settings)
  } catch (error) {
    console.warn("[NotionHub Tab] Failed to load highlight:", error)
    return {
      highlight: null,
      status: "error",
      message: "读取笔记失败，请检查配置。"
    }
  }
}
