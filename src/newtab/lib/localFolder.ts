const FOLDER_DB_NAME = "notionhub_local_folder_db"
const FOLDER_DB_VERSION = 1
const FOLDER_STORE_NAME = "folder_handles"
const HANDLE_KEY = "current_wallpaper_dir"

const SUPPORTED_IMAGE_EXTS = new Set([
  ".jpg",
  ".jpeg",
  ".png",
  ".webp",
  ".gif",
  ".avif",
  ".bmp",
  ".svg"
])

const SUPPORTED_VIDEO_EXTS = new Set([
  ".mp4",
  ".webm",
  ".mov",
  ".m4v",
  ".ogg"
])

export interface LocalMediaItem {
  name: string
  kind: "image" | "video"
  handle: FileSystemFileHandle
}

let folderDbInstance: Promise<IDBDatabase> | null = null

function openFolderDatabase(): Promise<IDBDatabase> {
  if (folderDbInstance) return folderDbInstance

  folderDbInstance = new Promise<IDBDatabase>((resolve, reject) => {
    if (typeof window === "undefined" || !window.indexedDB) {
      reject(new Error("IndexedDB is not supported"))
      return
    }

    const request = window.indexedDB.open(FOLDER_DB_NAME, FOLDER_DB_VERSION)

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result
      if (!db.objectStoreNames.contains(FOLDER_STORE_NAME)) {
        db.createObjectStore(FOLDER_STORE_NAME)
      }
    }

    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error || new Error("Failed to open folder database"))
  })

  return folderDbInstance
}

/**
 * 从 IndexedDB 获取保存的目录 Handle
 */
export async function getLocalFolderHandle(): Promise<FileSystemDirectoryHandle | null> {
  try {
    const db = await openFolderDatabase()
    return new Promise<FileSystemDirectoryHandle | null>((resolve) => {
      const transaction = db.transaction(FOLDER_STORE_NAME, "readonly")
      const store = transaction.objectStore(FOLDER_STORE_NAME)
      const request = store.get(HANDLE_KEY)

      request.onsuccess = async () => {
        const handle = request.result as FileSystemDirectoryHandle | undefined
        if (!handle) {
          resolve(null)
          return
        }

        // 验证读取权限（如果需要，查询权限）
        try {
          const status = await (handle as any).queryPermission?.({ mode: "read" })
          if (status === "granted") {
            resolve(handle)
            return
          }
          const requestStatus = await (handle as any).requestPermission?.({ mode: "read" })
          if (requestStatus === "granted") {
            resolve(handle)
            return
          }
        } catch {
          // 部分浏览器可能不支持 queryPermission，直接返回 handle
          resolve(handle)
          return
        }
        resolve(handle)
      }

      request.onerror = () => resolve(null)
    })
  } catch {
    return null
  }
}

/**
 * 保存目录 Handle 到 IndexedDB
 */
export async function saveLocalFolderHandle(
  handle: FileSystemDirectoryHandle
): Promise<void> {
  try {
    const db = await openFolderDatabase()
    return new Promise<void>((resolve, reject) => {
      const transaction = db.transaction(FOLDER_STORE_NAME, "readwrite")
      const store = transaction.objectStore(FOLDER_STORE_NAME)
      const request = store.put(handle, HANDLE_KEY)

      request.onsuccess = () => resolve()
      request.onerror = () => reject(request.error)
    })
  } catch (error) {
    console.warn("[LocalFolder] Failed to save folder handle:", error)
  }
}

/**
 * 清除已保存的目录 Handle
 */
export async function clearLocalFolderHandle(): Promise<void> {
  try {
    const db = await openFolderDatabase()
    return new Promise<void>((resolve, reject) => {
      const transaction = db.transaction(FOLDER_STORE_NAME, "readwrite")
      const store = transaction.objectStore(FOLDER_STORE_NAME)
      const request = store.delete(HANDLE_KEY)

      request.onsuccess = () => resolve()
      request.onerror = () => reject(request.error)
    })
  } catch (error) {
    console.warn("[LocalFolder] Failed to clear folder handle:", error)
  }
}

/**
 * 扫描指定目录下的所有支持图片和视频文件
 */
export async function scanLocalFolderMedia(
  handle: FileSystemDirectoryHandle
): Promise<LocalMediaItem[]> {
  const mediaItems: LocalMediaItem[] = []

  try {
    // 遍历目录条目
    for await (const entry of (handle as any).values()) {
      if (entry.kind === "file") {
        const name = entry.name as string
        const lastDot = name.lastIndexOf(".")
        if (lastDot !== -1) {
          const ext = name.slice(lastDot).toLowerCase()
          if (SUPPORTED_VIDEO_EXTS.has(ext)) {
            mediaItems.push({
              name,
              kind: "video",
              handle: entry as FileSystemFileHandle
            })
          } else if (SUPPORTED_IMAGE_EXTS.has(ext)) {
            mediaItems.push({
              name,
              kind: "image",
              handle: entry as FileSystemFileHandle
            })
          }
        }
      }
    }
  } catch (error) {
    console.warn("[LocalFolder] Failed to scan directory entries:", error)
  }

  return mediaItems
}

/**
 * 调起浏览器系统文件夹选择器
 */
export async function pickLocalFolder(): Promise<{
  name: string
  count: number
  videoCount: number
  imageCount: number
} | null> {
  if (typeof window === "undefined" || !(window as any).showDirectoryPicker) {
    throw new Error("当前浏览器不支持文件夹选择 API（File System Access API）")
  }

  try {
    const dirHandle: FileSystemDirectoryHandle = await (window as any).showDirectoryPicker({
      mode: "read"
    })

    if (!dirHandle) return null

    await saveLocalFolderHandle(dirHandle)
    const media = await scanLocalFolderMedia(dirHandle)

    const videoCount = media.filter((m) => m.kind === "video").length
    const imageCount = media.filter((m) => m.kind === "image").length

    return {
      name: dirHandle.name,
      count: media.length,
      videoCount,
      imageCount
    }
  } catch (error: any) {
    if (error?.name === "AbortError") {
      return null // 用户主动取消了文件选择
    }
    throw error
  }
}

/**
 * 从本地文件夹获取一个壁纸（随机或根据 seed 确定）
 */
export async function getRandomLocalMedia(
  preferredType?: "image" | "video",
  seed?: string
): Promise<{
  url: string
  isVideo: boolean
  name: string
} | null> {
  const dirHandle = await getLocalFolderHandle()
  if (!dirHandle) return null

  const allMedia = await scanLocalFolderMedia(dirHandle)
  if (!allMedia.length) return null

  // 如果指定了类型偏好，优先筛选对应类型的媒体
  let candidates = allMedia
  if (preferredType) {
    const filtered = allMedia.filter((m) => m.kind === preferredType)
    if (filtered.length > 0) {
      candidates = filtered
    }
  }

  let chosen: LocalMediaItem
  if (!seed) {
    chosen = candidates[Math.floor(Math.random() * candidates.length)]
  } else {
    let hash = 0
    for (let i = 0; i < seed.length; i++) {
      hash = (hash << 5) - hash + seed.charCodeAt(i)
      hash |= 0
    }
    const idx = Math.abs(hash) % candidates.length
    chosen = candidates[idx]
  }

  try {
    const file = await chosen.handle.getFile()
    const url = URL.createObjectURL(file)
    return {
      url,
      isVideo: chosen.kind === "video",
      name: chosen.name
    }
  } catch (err) {
    console.warn("[LocalFolder] Failed to read file from handle:", err)
    return null
  }
}
