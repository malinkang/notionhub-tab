export const NOTION_VERSION = "2025-09-03"

export type NotionTextFragment = {
  plain_text?: string
  text?: { content?: string }
}

export type NotionFileReference = {
  type?: "external" | "file"
  external?: { url?: string }
  file?: { url?: string }
  name?: string
}

export type NotionProperty = {
  id?: string
  type?: string
  title?: NotionTextFragment[]
  rich_text?: NotionTextFragment[]
  files?: NotionFileReference[]
  select?: { name?: string }
  multi_select?: { name?: string }[]
  date?: { start?: string }
  url?: string
  number?: number
  formula?: {
    type?: "string" | "number" | "boolean" | "date"
    string?: string
    number?: number
    date?: { start?: string }
  }
  relation?: { id?: string }[]
  created_time?: string
  last_edited_time?: string
}

export type NotionPage = {
  id: string
  url?: string
  created_time?: string
  last_edited_time?: string
  cover?: NotionFileReference | null
  icon?: NotionFileReference | null
  properties?: Record<string, NotionProperty>
}

export type NotionQueryResponse = {
  results?: NotionPage[]
  next_cursor?: string | null
  has_more?: boolean
}

export type NotionSourceSchema = {
  properties?: Record<string, { type?: string }>
}

export type PropertyOption = {
  name: string
  type: string
}

export function normalizeNotionId(value: string) {
  return value
    .trim()
    .replace(/^https?:\/\/www\.notion\.so\//, "")
    .split("?")[0]
    .split("#")[0]
    .replace(/-/g, "")
}

export function getFileUrl(file?: NotionFileReference | null): string {
  if (!file) return ""
  if (file.type === "external") return file.external?.url ?? ""
  if (file.type === "file") return file.file?.url ?? ""
  return file.external?.url ?? file.file?.url ?? ""
}

export function getFirstFileUrl(
  properties: Record<string, NotionProperty>,
  names: string[]
): string {
  for (const name of names) {
    const file = properties[name]?.files?.[0]
    const url = getFileUrl(file)
    if (url) return url
  }
  return ""
}

export function getText(property?: NotionProperty): string {
  if (!property) return ""
  const rich =
    property.title ||
    property.rich_text ||
    (property.formula?.type === "string"
      ? [{ plain_text: property.formula.string }]
      : undefined)
  if (rich?.length) {
    return rich
      .map((item) => item.plain_text ?? item.text?.content ?? "")
      .join("")
      .trim()
  }
  if (property.select?.name) return property.select.name
  if (property.multi_select?.length) {
    return property.multi_select
      .map((item) => item.name)
      .filter(Boolean)
      .join(" / ")
  }
  if (property.url) return property.url
  if (typeof property.number === "number") return String(property.number)
  if (
    property.formula?.type === "number" &&
    typeof property.formula.number === "number"
  ) {
    return String(property.formula.number)
  }
  return ""
}

export function getFirstTitle(properties: Record<string, NotionProperty>) {
  for (const property of Object.values(properties)) {
    if (property.type === "title") {
      const title = getText(property)
      if (title) return title
    }
  }
  return ""
}

export function getDateValue(property?: NotionProperty): string {
  return (
    property?.date?.start ||
    property?.created_time ||
    property?.last_edited_time ||
    property?.formula?.date?.start ||
    ""
  )
}

export function getPageUrl(page: NotionPage) {
  return page.url || `https://www.notion.so/${page.id.replace(/-/g, "")}`
}

export async function retrieveNotionSchema(
  token: string,
  sourceId: string
): Promise<NotionSourceSchema | null> {
  if (!token || !sourceId) return null
  const id = normalizeNotionId(sourceId)
  const response = await fetch(`https://api.notion.com/v1/data_sources/${id}`, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${token}`,
      "Notion-Version": NOTION_VERSION
    },
    cache: "no-store"
  })
  if (!response.ok) return null
  return (await response.json()) as NotionSourceSchema
}

export async function queryNotionPages(
  token: string,
  sourceId: string,
  body: Record<string, unknown> = {}
): Promise<NotionQueryResponse> {
  const id = normalizeNotionId(sourceId)
  const response = await fetch(
    `https://api.notion.com/v1/data_sources/${id}/query`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        "Notion-Version": NOTION_VERSION
      },
      body: JSON.stringify({ page_size: 25, ...body })
    }
  )
  if (!response.ok) throw new Error(`Notion query failed: ${response.status}`)
  return (await response.json()) as NotionQueryResponse
}

export function propertyOptions(
  schema: NotionSourceSchema | null,
  allowedTypes?: string[]
): PropertyOption[] {
  const properties = schema?.properties ?? {}
  return Object.entries(properties)
    .filter(
      ([, value]) => !allowedTypes || allowedTypes.includes(value.type || "")
    )
    .map(([name, value]) => ({ name, type: value.type || "unknown" }))
}
