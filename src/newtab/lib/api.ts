import {
  defaultSettings,
  newTabStorage,
  type NewTabSettings
} from "./settingsStore"

const NOTION_VERSION = "2025-09-03"
const NOTION_PAGE_SIZE = 50
const WEREAD_GATEWAY_URL = "https://i.weread.qq.com/api/agent/gateway"
const WEREAD_SKILL_VERSION = "1.0.3"
const WEREAD_FALLBACK_COVER = "https://www.notion.so/icons/book_gray.svg"

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
  content?: string
  chapterUid?: number | string
  range?: string
  book?: {
    bookId?: string
    title?: string
    author?: string
    cover?: string
  }
  bookId?: string
  title?: string
  author?: string
  cover?: string
}

type WeReadNotebookBook = {
  bookId?: string
  book?: {
    bookId?: string
    title?: string
    author?: string
    cover?: string
  }
  title?: string
  author?: string
  cover?: string
}

type WeReadReviewItem = {
  review?: WeReadBookmark & {
    reviewId?: string
    bookId?: string
  }
  book?: WeReadBookmark["book"]
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

async function fetchWeReadGateway<T>(
  apiKey: string,
  apiName: string,
  params: Record<string, unknown> = {}
): Promise<T> {
  const response = await fetch(WEREAD_GATEWAY_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      api_name: apiName,
      skill_version: WEREAD_SKILL_VERSION,
      ...params
    })
  })

  if (!response.ok) {
    throw new Error(`WeRead API ${response.status}`)
  }

  const data = (await response.json()) as T & {
    errcode?: number
    errmsg?: string
    upgrade_info?: { message?: string }
  }
  if (data.upgrade_info?.message) {
    throw new Error(data.upgrade_info.message)
  }
  if (data.errcode && data.errcode !== 0) {
    throw new Error(data.errmsg || `WeRead API ${data.errcode}`)
  }

  return data
}

function normalizeWeReadHighlight(item: WeReadBookmark): Highlight | null {
  const text =
    item.markText || item.review || item.content || item.abstract || ""
  const book = item.book?.title || item.title || "微信读书"
  if (!text) return null

  return {
    text,
    originalText: item.abstract && item.review ? item.abstract : undefined,
    book,
    bookUrl: item.bookId ? getWeReadBookUrl(item.bookId) : undefined,
    cover: normalizeWeReadCover(item.book?.cover || item.cover),
    author: item.book?.author || item.author || "",
    kind: item.review ? "review" : "bookmark",
    notionUrl: getWeReadBookUrl(item.bookId)
  }
}

function normalizeWeReadCover(cover?: string): string {
  const normalized = (cover || "").replace("/s_", "/t7_").trim()
  if (!normalized || !normalized.startsWith("http")) {
    return WEREAD_FALLBACK_COVER
  }

  return normalized
}

function leftRotate(value: number, amount: number): number {
  return ((value << amount) | (value >>> (32 - amount))) >>> 0
}

function md5(input: string): string {
  const bytes = new TextEncoder().encode(input)
  const bitLength = bytes.length * 8
  const paddedLength = (((bytes.length + 8) >> 6) + 1) * 64
  const buffer = new Uint8Array(paddedLength)
  buffer.set(bytes)
  buffer[bytes.length] = 0x80

  const view = new DataView(buffer.buffer)
  view.setUint32(paddedLength - 8, bitLength >>> 0, true)
  view.setUint32(paddedLength - 4, Math.floor(bitLength / 0x100000000), true)

  let a0 = 0x67452301
  let b0 = 0xefcdab89
  let c0 = 0x98badcfe
  let d0 = 0x10325476
  const shifts = [
    7, 12, 17, 22, 7, 12, 17, 22, 7, 12, 17, 22, 7, 12, 17, 22, 5, 9, 14, 20, 5,
    9, 14, 20, 5, 9, 14, 20, 5, 9, 14, 20, 4, 11, 16, 23, 4, 11, 16, 23, 4, 11,
    16, 23, 4, 11, 16, 23, 6, 10, 15, 21, 6, 10, 15, 21, 6, 10, 15, 21, 6, 10,
    15, 21
  ]
  const constants = Array.from({ length: 64 }, (_, index) =>
    Math.floor(Math.abs(Math.sin(index + 1)) * 0x100000000)
  )

  for (let offset = 0; offset < paddedLength; offset += 64) {
    const words = Array.from({ length: 16 }, (_, index) =>
      view.getUint32(offset + index * 4, true)
    )
    let a = a0
    let b = b0
    let c = c0
    let d = d0

    for (let i = 0; i < 64; i++) {
      let f: number
      let g: number
      if (i < 16) {
        f = (b & c) | (~b & d)
        g = i
      } else if (i < 32) {
        f = (d & b) | (~d & c)
        g = (5 * i + 1) % 16
      } else if (i < 48) {
        f = b ^ c ^ d
        g = (3 * i + 5) % 16
      } else {
        f = c ^ (b | ~d)
        g = (7 * i) % 16
      }

      const next = d
      d = c
      c = b
      b =
        (b + leftRotate((a + f + constants[i] + words[g]) >>> 0, shifts[i])) >>>
        0
      a = next
    }

    a0 = (a0 + a) >>> 0
    b0 = (b0 + b) >>> 0
    c0 = (c0 + c) >>> 0
    d0 = (d0 + d) >>> 0
  }

  return [a0, b0, c0, d0]
    .map((word) =>
      [0, 8, 16, 24]
        .map((shift) => ((word >>> shift) & 0xff).toString(16).padStart(2, "0"))
        .join("")
    )
    .join("")
}

function transformWeReadBookId(bookId: string): [string, string[]] {
  if (/^\d*$/.test(bookId)) {
    const chunks: string[] = []
    for (let index = 0; index < bookId.length; index += 9) {
      chunks.push(Number(bookId.slice(index, index + 9)).toString(16))
    }
    return ["3", chunks]
  }

  const encoded = Array.from(bookId)
    .map((char) => char.codePointAt(0)?.toString(16) || "")
    .join("")
  return ["4", [encoded]]
}

function calculateWeReadBookStrId(bookId: string): string {
  const digest = md5(bookId)
  const [code, transformedIds] = transformWeReadBookId(bookId)
  let result = `${digest.slice(0, 3)}${code}2${digest.slice(-2)}`

  transformedIds.forEach((transformedId, index) => {
    result += transformedId.length.toString(16).padStart(2, "0") + transformedId
    if (index < transformedIds.length - 1) result += "g"
  })

  if (result.length < 20) {
    result += digest.slice(0, 20 - result.length)
  }

  return result + md5(result).slice(0, 3)
}

function getWeReadBookUrl(bookId?: string): string {
  if (!bookId) return "https://weread.qq.com"
  return `https://weread.qq.com/web/reader/${calculateWeReadBookStrId(bookId)}`
}

function normalizeWeReadReview(
  item: WeReadReviewItem,
  bookInfo: WeReadNotebookBook
): Highlight | null {
  const review = item.review
  if (!review?.content) return null

  return normalizeWeReadHighlight({
    ...review,
    review: review.content,
    abstract: review.abstract,
    book: item.book || bookInfo.book,
    bookId: review.bookId || bookInfo.bookId || bookInfo.book?.bookId,
    title: bookInfo.title,
    author: bookInfo.author,
    cover: bookInfo.cover || bookInfo.book?.cover
  })
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

  const notebooks = await fetchWeReadGateway<{
    books?: WeReadNotebookBook[]
  }>(settings.wereadApiKey, "/user/notebooks", { count: 20 })

  const items: Highlight[] = []
  const books = Array.isArray(notebooks.books)
    ? notebooks.books.slice(0, 8)
    : []

  for (const book of books) {
    const bookId = book.bookId || book.book?.bookId
    if (!bookId) continue
    try {
      const data = await fetchWeReadGateway<{
        updated?: WeReadBookmark[]
        chapters?: Array<{ bookmarks?: WeReadBookmark[] }>
        book?: WeReadBookmark["book"]
      }>(settings.wereadApiKey, "/book/bookmarklist", { bookId })
      const bookmarks = [
        ...(data.updated || []),
        ...(data.chapters || []).flatMap((chapter) => chapter.bookmarks || [])
      ]
      for (const item of bookmarks) {
        const normalized = normalizeWeReadHighlight({
          ...item,
          book: item.book || data.book || book.book,
          bookId: item.bookId || bookId,
          title: book.title,
          author: book.author,
          cover: book.cover || book.book?.cover
        })
        if (normalized) items.push(normalized)
      }
    } catch {
      // Keep reading other books when one WeRead request fails.
    }

    try {
      const reviews = await fetchWeReadGateway<{
        reviews?: WeReadReviewItem[]
      }>(settings.wereadApiKey, "/review/list/mine", {
        bookid: bookId,
        count: 20
      })
      for (const item of reviews.reviews || []) {
        const normalized = normalizeWeReadReview(item, book)
        if (normalized) items.push(normalized)
      }
    } catch {
      // Reviews are optional; keep showing underlines when review loading fails.
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
