const DB_NAME = "notionhub_media_cache_db"
const DB_VERSION = 1
const STORE_NAME = "media_items"

export interface CachedMediaItem {
  id: string
  blob: Blob
  mimeType: string
  size: number
  name: string
  cachedAt: number
}

export interface MediaCacheStats {
  count: number
  totalSizeBytes: number
  formattedSize: string
}

let dbInstance: Promise<IDBDatabase> | null = null

function openMediaDatabase(): Promise<IDBDatabase> {
  if (dbInstance) return dbInstance

  dbInstance = new Promise<IDBDatabase>((resolve, reject) => {
    if (typeof window === "undefined" || !window.indexedDB) {
      reject(new Error("IndexedDB is not supported in this environment"))
      return
    }

    const request = window.indexedDB.open(DB_NAME, DB_VERSION)

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: "id" })
      }
    }

    request.onsuccess = () => {
      resolve(request.result)
    }

    request.onerror = () => {
      reject(request.error || new Error("Failed to open IndexedDB"))
    }
  })

  return dbInstance
}

/**
 * 规范化媒体存储的 Key（去除可变的 AWS 临时签名 query，保留稳定的路径标识）
 */
export function normalizeMediaCacheKey(urlOrKey: string): string {
  if (!urlOrKey) return ""
  try {
    if (urlOrKey.startsWith("http://") || urlOrKey.startsWith("https://")) {
      const url = new URL(urlOrKey)
      return `${url.origin}${url.pathname}`
    }
  } catch {}
  return urlOrKey.split("?")[0].split("#")[0].trim()
}

/**
 * 从本地 IndexedDB 读取 Blob
 */
export async function getMediaBlob(urlOrKey: string): Promise<Blob | null> {
  try {
    const key = normalizeMediaCacheKey(urlOrKey)
    if (!key) return null

    const db = await openMediaDatabase()
    return new Promise<Blob | null>((resolve) => {
      const transaction = db.transaction(STORE_NAME, "readonly")
      const store = transaction.objectStore(STORE_NAME)
      const request = store.get(key)

      request.onsuccess = () => {
        const item = request.result as CachedMediaItem | undefined
        resolve(item?.blob || null)
      }

      request.onerror = () => {
        resolve(null)
      }
    })
  } catch {
    return null
  }
}

/**
 * 从本地 IndexedDB 读取并生成可直接播放/展示的 Object URL
 */
export async function getMediaBlobUrl(urlOrKey: string): Promise<string | null> {
  const blob = await getMediaBlob(urlOrKey)
  if (!blob) return null
  return URL.createObjectURL(blob)
}

/**
 * 将媒体文件 Blob 保存到本地 IndexedDB
 */
export async function saveMediaBlob(
  urlOrKey: string,
  blob: Blob,
  meta: { mimeType?: string; name?: string } = {}
): Promise<void> {
  try {
    const key = normalizeMediaCacheKey(urlOrKey)
    if (!key || !blob) return

    const db = await openMediaDatabase()
    const item: CachedMediaItem = {
      id: key,
      blob,
      mimeType: meta.mimeType || blob.type || "application/octet-stream",
      size: blob.size,
      name: meta.name || key.split("/").pop() || "media",
      cachedAt: Date.now()
    }

    return new Promise<void>((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, "readwrite")
      const store = transaction.objectStore(STORE_NAME)
      const request = store.put(item)

      request.onsuccess = () => resolve()
      request.onerror = () => reject(request.error)
    })
  } catch (error) {
    console.warn("[MediaCache] Failed to save media blob:", error)
  }
}

/**
 * 从远程下载并缓存到本地，返回本地 Object URL
 */
export async function fetchAndCacheMedia(
  url: string,
  customKey?: string
): Promise<string> {
  const key = normalizeMediaCacheKey(customKey || url)
  
  // 1. 先检查本地是否有缓存
  const existingBlob = await getMediaBlob(key)
  if (existingBlob) {
    return URL.createObjectURL(existingBlob)
  }

  // 2. 本地无缓存，发起下载
  const response = await fetch(url)
  if (!response.ok) {
    throw new Error(`Fetch media failed with status ${response.status}`)
  }

  const blob = await response.blob()
  await saveMediaBlob(key, blob, {
    mimeType: response.headers.get("Content-Type") || blob.type,
    name: url.split("?")[0].split("/").pop() || "wallpaper"
  })

  return URL.createObjectURL(blob)
}

/**
 * 获取当前离线媒体缓存的统计信息（文件数与占用体积）
 */
export async function getMediaCacheStats(): Promise<MediaCacheStats> {
  try {
    const db = await openMediaDatabase()
    return new Promise<MediaCacheStats>((resolve) => {
      const transaction = db.transaction(STORE_NAME, "readonly")
      const store = transaction.objectStore(STORE_NAME)
      const request = store.getAll()

      request.onsuccess = () => {
        const items = (request.result as CachedMediaItem[]) || []
        const count = items.length
        const totalSizeBytes = items.reduce((sum, item) => sum + (item.size || 0), 0)

        let formattedSize = "0 MB"
        if (totalSizeBytes > 1024 * 1024 * 1024) {
          formattedSize = `${(totalSizeBytes / (1024 * 1024 * 1024)).toFixed(2)} GB`
        } else if (totalSizeBytes > 1024 * 1024) {
          formattedSize = `${(totalSizeBytes / (1024 * 1024)).toFixed(1)} MB`
        } else if (totalSizeBytes > 1024) {
          formattedSize = `${(totalSizeBytes / 1024).toFixed(0)} KB`
        }

        resolve({
          count,
          totalSizeBytes,
          formattedSize
        })
      }

      request.onerror = () => {
        resolve({ count: 0, totalSizeBytes: 0, formattedSize: "0 MB" })
      }
    })
  } catch {
    return { count: 0, totalSizeBytes: 0, formattedSize: "0 MB" }
  }
}

/**
 * 清空所有离线媒体缓存
 */
export async function clearMediaCache(): Promise<void> {
  try {
    const db = await openMediaDatabase()
    return new Promise<void>((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, "readwrite")
      const store = transaction.objectStore(STORE_NAME)
      const request = store.clear()

      request.onsuccess = () => resolve()
      request.onerror = () => reject(request.error)
    })
  } catch (error) {
    console.warn("[MediaCache] Failed to clear media cache:", error)
  }
}
