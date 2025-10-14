/**
 * ComfyUI 图片缓存服务
 * 负责管理生成图片的本地缓存，避免重复生成相同参数的图片
 */

import crypto from 'crypto'
import fs from 'fs-extra'
import path from 'path'
import fetch from 'node-fetch'
import { app } from 'electron'
import { loggerService } from '@logger'

const logger = loggerService.withContext('ComfyUICacheService')

interface CacheEntry {
  cacheKey: string
  imagePath: string
  promptId: string
  componentId: string
  parameters: Record<string, any>
  createdAt: number
  lastAccessed: number
}

export class ComfyUICacheService {
  private cacheDir: string
  private cacheMap: Map<string, CacheEntry> = new Map()
  private readonly maxCacheSize = 1000 // 最大缓存条目数
  private readonly maxCacheAge = 30 * 24 * 60 * 60 * 1000 // 30天

  constructor() {
    this.cacheDir = path.join(app.getPath('userData'), 'comfyui-cache')
    this.initializeCache()
  }

  /**
   * 初始化缓存目录和索引
   */
  private async initializeCache() {
    try {
      await fs.ensureDir(this.cacheDir)
      await this.loadCacheIndex()
      await this.cleanupExpiredCache()
      logger.info('ComfyUI cache service initialized', { cacheDir: this.cacheDir })
    } catch (error) {
      logger.error('Failed to initialize cache service', error as Error)
    }
  }

  /**
   * 生成缓存键
   */
  generateCacheKey(componentId: string, parameters: Record<string, any>): string {
    // 移除不稳定的参数
    const stableParams = { ...parameters }
    delete stableParams.seed
    delete stableParams.timestamp
    delete stableParams._timestamp

    // 按键排序确保一致性
    const sortedParams = Object.keys(stableParams)
      .sort()
      .reduce(
        (obj, key) => {
          obj[key] = stableParams[key]
          return obj
        },
        {} as Record<string, any>
      )

    const content = `${componentId}_${JSON.stringify(sortedParams)}`
    return crypto.createHash('md5').update(content).digest('hex')
  }

  /**
   * 检查缓存是否存在
   */
  async getCachedImage(cacheKey: string): Promise<string | null> {
    const entry = this.cacheMap.get(cacheKey)
    if (!entry) {
      return null
    }

    // 检查文件是否存在
    if (!(await fs.pathExists(entry.imagePath))) {
      this.cacheMap.delete(cacheKey)
      await this.saveCacheIndex()
      return null
    }

    // 更新访问时间
    entry.lastAccessed = Date.now()
    await this.saveCacheIndex()

    logger.verbose('Cache hit', { cacheKey, imagePath: entry.imagePath })
    return entry.imagePath
  }

  /**
   * 下载并缓存图片
   */
  async downloadAndCacheImage(
    cacheKey: string,
    imageUrl: string,
    promptId: string,
    componentId: string,
    parameters: Record<string, any>
  ): Promise<string> {
    try {
      logger.info('Downloading and caching image', { cacheKey, imageUrl })

      // 下载图片
      const response = await fetch(imageUrl)
      if (!response.ok) {
        throw new Error(`Failed to download image: ${response.statusText}`)
      }

      // 生成文件路径
      const fileExtension = this.getImageExtension(imageUrl)
      const fileName = `${cacheKey}${fileExtension}`
      const imagePath = path.join(this.cacheDir, fileName)

      // 保存图片
      const buffer = await response.buffer()
      await fs.writeFile(imagePath, buffer)

      // 添加到缓存索引
      const entry: CacheEntry = {
        cacheKey,
        imagePath,
        promptId,
        componentId,
        parameters,
        createdAt: Date.now(),
        lastAccessed: Date.now()
      }

      this.cacheMap.set(cacheKey, entry)
      await this.saveCacheIndex()

      // 清理过期缓存
      await this.cleanupCache()

      logger.info('Image cached successfully', { cacheKey, imagePath })
      return imagePath
    } catch (error) {
      logger.error('Failed to download and cache image', error as Error, { cacheKey, imageUrl })
      throw error
    }
  }

  /**
   * 获取图片文件扩展名
   */
  private getImageExtension(url: string): string {
    const urlPath = new URL(url).pathname
    const ext = path.extname(urlPath)
    return ext || '.png'
  }

  /**
   * 加载缓存索引
   */
  private async loadCacheIndex() {
    const indexPath = path.join(this.cacheDir, 'cache-index.json')
    try {
      if (await fs.pathExists(indexPath)) {
        const data = await fs.readJSON(indexPath)
        this.cacheMap = new Map(Object.entries(data))
        logger.verbose('Cache index loaded', { entries: this.cacheMap.size })
      }
    } catch (error) {
      logger.warn('Failed to load cache index', error as Error)
    }
  }

  /**
   * 保存缓存索引
   */
  private async saveCacheIndex() {
    const indexPath = path.join(this.cacheDir, 'cache-index.json')
    try {
      const data = Object.fromEntries(this.cacheMap)
      await fs.writeJSON(indexPath, data, { spaces: 2 })
    } catch (error) {
      logger.error('Failed to save cache index', error as Error)
    }
  }

  /**
   * 清理过期缓存
   */
  private async cleanupExpiredCache() {
    const now = Date.now()
    const expiredKeys: string[] = []

    for (const [key, entry] of this.cacheMap) {
      if (now - entry.createdAt > this.maxCacheAge) {
        expiredKeys.push(key)
      }
    }

    for (const key of expiredKeys) {
      await this.removeCacheEntry(key)
    }

    if (expiredKeys.length > 0) {
      logger.info('Cleaned up expired cache entries', { count: expiredKeys.length })
    }
  }

  /**
   * 清理缓存（LRU策略）
   */
  private async cleanupCache() {
    if (this.cacheMap.size <= this.maxCacheSize) {
      return
    }

    // 按最后访问时间排序，删除最旧的条目
    const entries = Array.from(this.cacheMap.entries())
    entries.sort((a, b) => a[1].lastAccessed - b[1].lastAccessed)

    const toRemove = entries.slice(0, entries.length - this.maxCacheSize)
    for (const [key] of toRemove) {
      await this.removeCacheEntry(key)
    }

    logger.info('Cache cleanup completed', {
      removed: toRemove.length,
      remaining: this.cacheMap.size
    })
  }

  /**
   * 删除缓存条目
   */
  private async removeCacheEntry(cacheKey: string) {
    const entry = this.cacheMap.get(cacheKey)
    if (entry) {
      try {
        if (await fs.pathExists(entry.imagePath)) {
          await fs.remove(entry.imagePath)
        }
      } catch (error) {
        logger.warn('Failed to remove cached file', error as Error, { imagePath: entry.imagePath })
      }
      this.cacheMap.delete(cacheKey)
    }
  }

  /**
   * 清理指定组件的所有缓存
   */
  async clearComponentCache(componentId: string): Promise<number> {
    const componentKeys: string[] = []

    for (const [key, entry] of this.cacheMap) {
      if (entry.componentId === componentId) {
        componentKeys.push(key)
      }
    }

    for (const key of componentKeys) {
      await this.removeCacheEntry(key)
    }

    await this.saveCacheIndex()
    logger.info('Component cache cleared', { componentId, deletedCount: componentKeys.length })
    return componentKeys.length
  }

  /**
   * 清空所有缓存
   */
  async clearCache(): Promise<void> {
    try {
      await fs.emptyDir(this.cacheDir)
      this.cacheMap.clear()
      await this.saveCacheIndex()
      logger.info('All cache cleared')
    } catch (error) {
      logger.error('Failed to clear cache', error as Error)
      throw error
    }
  }

  /**
   * 获取缓存目录路径
   */
  getCacheDir(): string {
    return this.cacheDir
  }

  /**
   * 获取缓存统计信息
   */
  getCacheStats(): {
    totalEntries: number
    totalSize: number
    oldestEntry: number | null
    newestEntry: number | null
  } {
    const entries = Array.from(this.cacheMap.values())
    const totalEntries = entries.length
    const oldestEntry = entries.length > 0 ? Math.min(...entries.map((e) => e.createdAt)) : null
    const newestEntry = entries.length > 0 ? Math.max(...entries.map((e) => e.createdAt)) : null

    return {
      totalEntries,
      totalSize: 0, // TODO: 计算实际文件大小
      oldestEntry,
      newestEntry
    }
  }
}

// 单例实例
export const comfyUICacheService = new ComfyUICacheService()
