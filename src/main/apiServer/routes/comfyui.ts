import { loggerService } from '@main/services/LoggerService'
import express from 'express'
import fs from 'fs'
import path from 'path'

const logger = loggerService.withContext('ComfyUIRoutes')
const router = express.Router()

/**
 * GET /cache/:filename
 * 提供ComfyUI缓存文件的HTTP访问
 */
router.get('/cache/:filename', async (req, res) => {
  try {
    const { filename } = req.params

    // 验证文件名格式（只允许缓存键格式的文件名）
    if (!/^[a-f0-9]{32}\.(png|jpg|jpeg|gif|webp|mp4|avi|mov|txt)$/i.test(filename)) {
      logger.warn('Invalid cache filename format', { filename })
      return res.status(400).json({ error: 'Invalid filename format' })
    }

    // 导入缓存服务
    const { comfyUICacheService } = await import('@main/services/ComfyUICacheService')

    // 构建缓存文件路径
    const cacheDir = comfyUICacheService.getCacheDir()
    const filePath = path.join(cacheDir, filename)

    logger.verbose('Serving cache file', { filename, filePath })

    // 检查文件是否存在
    if (!fs.existsSync(filePath)) {
      logger.warn('Cache file not found', { filename, filePath })
      return res.status(404).json({ error: 'File not found' })
    }

    // 获取文件信息
    const stats = fs.statSync(filePath)
    const ext = path.extname(filename).toLowerCase()

    // 设置正确的Content-Type
    let contentType = 'application/octet-stream'
    switch (ext) {
      case '.png':
        contentType = 'image/png'
        break
      case '.jpg':
      case '.jpeg':
        contentType = 'image/jpeg'
        break
      case '.gif':
        contentType = 'image/gif'
        break
      case '.webp':
        contentType = 'image/webp'
        break
      case '.mp4':
        contentType = 'video/mp4'
        break
      case '.avi':
        contentType = 'video/avi'
        break
      case '.mov':
        contentType = 'video/quicktime'
        break
      case '.txt':
        contentType = 'text/plain'
        break
    }

    // 设置响应头
    res.set({
      'Content-Type': contentType,
      'Content-Length': stats.size,
      'Cache-Control': 'public, max-age=31536000', // 缓存1年
      ETag: `"${stats.mtime.getTime()}-${stats.size}"`,
      'Last-Modified': stats.mtime.toUTCString()
    })

    // 检查If-None-Match (ETag)
    const ifNoneMatch = req.get('If-None-Match')
    const etag = `"${stats.mtime.getTime()}-${stats.size}"`
    if (ifNoneMatch === etag) {
      logger.verbose('Cache file not modified (ETag match)', { filename })
      return res.status(304).end()
    }

    // 检查If-Modified-Since
    const ifModifiedSince = req.get('If-Modified-Since')
    if (ifModifiedSince && new Date(ifModifiedSince) >= stats.mtime) {
      logger.verbose('Cache file not modified (date check)', { filename })
      return res.status(304).end()
    }

    logger.info('Serving cache file successfully', {
      filename,
      contentType,
      size: stats.size
    })

    // 创建文件流并发送
    const fileStream = fs.createReadStream(filePath)
    fileStream.pipe(res)

    fileStream.on('error', (error) => {
      logger.error('Error streaming cache file', error, { filename, filePath })
      if (!res.headersSent) {
        res.status(500).json({ error: 'Error reading file' })
      }
    })

    return // 明确返回，避免TypeScript警告
  } catch (error) {
    logger.error('Error serving cache file', error as Error, { filename: req.params.filename })
    if (!res.headersSent) {
      res.status(500).json({ error: 'Internal server error' })
    }
    return // 明确返回，避免TypeScript警告
  }
})

/**
 * GET /info
 * 获取ComfyUI服务信息
 */
router.get('/info', async (_req, res) => {
  try {
    const { comfyUICacheService } = await import('@main/services/ComfyUICacheService')

    const cacheDir = comfyUICacheService.getCacheDir()
    const cacheStats = await comfyUICacheService.getCacheStats()

    res.json({
      cacheDir,
      cacheStats,
      endpoints: {
        cache: '/v1/comfyui/cache/:filename'
      }
    })
  } catch (error) {
    logger.error('Error getting ComfyUI info', error as Error)
    res.status(500).json({ error: 'Internal server error' })
  }
})

export { router as comfyUIRoutes }
