/**
 * ComfyUI请求拦截器
 * 拦截comfy-xxx格式的URL请求，解析参数并调用后端服务生成内容
 */

import { BrowserWindow } from 'electron'
import { loggerService } from '@logger'
import { comfyUIService } from './ComfyUIServiceOptimized'
import { componentLookupService } from './ComponentLookupService'

const logger = loggerService.withContext('ComfyUIRequestInterceptor')

export class ComfyUIRequestInterceptor {
  // 支持自定义协议格式：comfyui://componentName?params
  private static readonly COMFY_URL_PATTERN = /^comfyui:\/\/([a-zA-Z0-9_-]+)/
  private static readonly MAX_PARAMETER_LENGTH = 10000
  private static readonly REQUEST_TIMEOUT = 60000 // 60秒超时

  /**
   * 设置请求拦截器 - 使用自定义协议处理器
   */
  static setupInterceptor(mainWindow: BrowserWindow): void {
    try {
      const session = mainWindow.webContents.session

      // 注册自定义协议处理器
      session.protocol.handle('comfyui', async (request) => {
        try {
          logger.info('🎯 Handling ComfyUI protocol request', {
            url: request.url,
            method: request.method
          })

          const result = await this.handleRequest(request.url)

          if (result.success && result.filePath) {
            try {
              const fs = await import('fs')
              const path = await import('path')

              // 读取文件内容
              const fileBuffer = await fs.promises.readFile(result.filePath)

              // 获取文件扩展名并确定MIME类型
              const ext = path.extname(result.filePath).toLowerCase()
              let mimeType = 'application/octet-stream'

              switch (ext) {
                case '.png':
                  mimeType = 'image/png'
                  break
                case '.jpg':
                case '.jpeg':
                  mimeType = 'image/jpeg'
                  break
                case '.gif':
                  mimeType = 'image/gif'
                  break
                case '.webp':
                  mimeType = 'image/webp'
                  break
                case '.svg':
                  mimeType = 'image/svg+xml'
                  break
              }

              logger.info('ComfyUI protocol request successful', {
                url: request.url,
                filePath: result.filePath,
                mimeType,
                fileSize: fileBuffer.length
              })

              // 返回文件内容
              return new Response(fileBuffer, {
                status: 200,
                headers: {
                  'Content-Type': mimeType,
                  'Content-Length': fileBuffer.length.toString(),
                  'Cache-Control': 'public, max-age=31536000'
                }
              })
            } catch (error) {
              logger.error('Failed to read file', error as Error, { filePath: result.filePath })
              return new Response('File not found', { status: 404 })
            }
          } else {
            logger.warn('ComfyUI protocol request failed', {
              url: request.url,
              error: result.error,
              success: result.success,
              hasFilePath: !!result.filePath
            })

            return new Response(result.error || 'Generation failed', { status: 500 })
          }
        } catch (error) {
          logger.error('Error handling ComfyUI protocol request', error as Error, {
            url: request.url
          })
          return new Response('Internal server error', { status: 500 })
        }
      })

      logger.info('ComfyUI protocol handler setup completed')
    } catch (error) {
      logger.error('Failed to setup ComfyUI protocol handler', error as Error)
    }
  }

  /**
   * 处理ComfyUI请求
   */
  private static async handleRequest(url: string): Promise<{
    success: boolean
    filePath?: string
    contentType?: string
    error?: string
  }> {
    try {
      const parsedUrl = new URL(url)

      // 提取组件名
      const componentName = this.extractComponentName(url)
      if (!componentName) {
        return {
          success: false,
          error: 'Invalid component name format'
        }
      }

      // 验证组件名
      if (!componentLookupService.validateComponentName(componentName)) {
        logger.error('Invalid component name characters', { componentName })
        return {
          success: false,
          error: 'Invalid component name characters'
        }
      }

      // 解析参数
      const parameters = this.parseParameters(parsedUrl.searchParams)

      // 验证参数大小
      const parameterString = JSON.stringify(parameters)
      if (parameterString.length > this.MAX_PARAMETER_LENGTH) {
        return {
          success: false,
          error: 'Parameters too large'
        }
      }

      logger.info('Processing ComfyUI request', {
        componentName,
        parameterCount: Object.keys(parameters).length
      })

      // 调用生成服务
      logger.info('Calling ComfyUI service to generate image', {
        componentName,
        parameterCount: Object.keys(parameters).length
      })
      const result = await Promise.race([
        comfyUIService.generateByComponentName(componentName, parameters),
        this.createTimeoutPromise()
      ])

      logger.info('ComfyUI service returned result', {
        success: result.success,
        hasFilePath: !!(result.success && 'filePath' in result && result.filePath)
      })
      return result
    } catch (error) {
      logger.error('Failed to handle ComfyUI request', error as Error)
      return {
        success: false,
        error: (error as Error).message
      }
    }
  }

  /**
   * 从URL中提取组件名
   */
  private static extractComponentName(url: string): string | null {
    const match = url.match(this.COMFY_URL_PATTERN)
    return match ? match[1] : null
  }

  /**
   * 解析URL参数
   */
  private static parseParameters(searchParams: URLSearchParams): Record<string, any> {
    const parameters: Record<string, any> = {}

    for (const [key, value] of searchParams.entries()) {
      // 基本的参数类型推断和转换
      parameters[key] = this.convertParameterValue(value)
    }

    return parameters
  }

  /**
   * 转换参数值
   */
  private static convertParameterValue(value: string): any {
    // URL解码
    const decodedValue = decodeURIComponent(value)

    // 尝试转换为数字
    if (/^\d+(\.\d+)?$/.test(decodedValue)) {
      const numValue = parseFloat(decodedValue)
      if (!isNaN(numValue)) {
        return numValue
      }
    }

    // 尝试转换为布尔值
    if (decodedValue.toLowerCase() === 'true') {
      return true
    }
    if (decodedValue.toLowerCase() === 'false') {
      return false
    }

    // 尝试解析JSON
    if (
      (decodedValue.startsWith('{') && decodedValue.endsWith('}')) ||
      (decodedValue.startsWith('[') && decodedValue.endsWith(']'))
    ) {
      try {
        return JSON.parse(decodedValue)
      } catch {
        // 如果JSON解析失败，返回原字符串
      }
    }

    // 默认返回字符串
    return decodedValue
  }

  /**
   * 创建超时Promise
   */
  private static createTimeoutPromise(): Promise<{
    success: boolean
    error: string
  }> {
    return new Promise((_, reject) => {
      setTimeout(() => {
        reject(new Error('Request timeout'))
      }, this.REQUEST_TIMEOUT)
    })
  }

  /**
   * 获取拦截器统计信息
   */
  static getStats(): {
    interceptorActive: boolean
    maxParameterLength: number
    requestTimeout: number
  } {
    return {
      interceptorActive: true,
      maxParameterLength: this.MAX_PARAMETER_LENGTH,
      requestTimeout: this.REQUEST_TIMEOUT
    }
  }
}
