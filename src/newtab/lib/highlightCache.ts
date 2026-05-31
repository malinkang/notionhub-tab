import { Storage } from "@plasmohq/storage"

import type { Highlight } from "./api"

const storage = new Storage({ area: "local" })

const HIGHLIGHT_QUEUE_KEY = "notionhub_highlight_queue"
const HIGHLIGHT_SEEN_KEY = "notionhub_highlight_seen_ids"
const HIGHLIGHT_CURSOR_KEY = "notionhub_highlight_cursors"

// Max IDs to keep in history to avoid memory leak while ensuring no recent duplicates
const MAX_SEEN_IDS = 1000

export interface HighlightCursors {
  oldestDateMs: number | null
  newestDateMs: number | null
  direction: "older" | "newer"
  lastBaselineDate: string // YYYY-MM-DD
}

export interface HighlightQueueItem {
  id: string // A unique ID for the highlight (pageId)
  highlight: Highlight
  dateMs: number // Timestamp for sorting
}

export async function getSeenIds(): Promise<Set<string>> {
  const ids = await storage.get<string[]>(HIGHLIGHT_SEEN_KEY)
  return new Set(ids || [])
}

export async function markAsSeen(id: string) {
  const ids = (await storage.get<string[]>(HIGHLIGHT_SEEN_KEY)) || []
  if (ids.includes(id)) return
  ids.push(id)
  if (ids.length > MAX_SEEN_IDS) {
    ids.splice(0, ids.length - MAX_SEEN_IDS)
  }
  await storage.set(HIGHLIGHT_SEEN_KEY, ids)
}

export async function getQueue(): Promise<HighlightQueueItem[]> {
  const queue = await storage.get<HighlightQueueItem[]>(HIGHLIGHT_QUEUE_KEY)
  return queue || []
}

export async function setQueue(queue: HighlightQueueItem[]) {
  // Sort from newest to oldest
  const sorted = [...queue].sort((a, b) => b.dateMs - a.dateMs)
  await storage.set(HIGHLIGHT_QUEUE_KEY, sorted)
}

export async function getCursors(): Promise<HighlightCursors | null> {
  const cursors = await storage.get<HighlightCursors>(HIGHLIGHT_CURSOR_KEY)
  return cursors || null
}

export async function setCursors(cursors: HighlightCursors) {
  await storage.set(HIGHLIGHT_CURSOR_KEY, cursors)
}

export async function resetAllHighlightCache() {
  await storage.remove(HIGHLIGHT_QUEUE_KEY)
  await storage.remove(HIGHLIGHT_SEEN_KEY)
  await storage.remove(HIGHLIGHT_CURSOR_KEY)
}
