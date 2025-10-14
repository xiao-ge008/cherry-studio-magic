/**
 * ComfyUI服务 - 优化版本
 * 包含队列管理和WebSocket监听
 */

import WebSocket from 'ws'
import fetch from 'node-fetch'
import { EventEmitter } from 'events'
import { loggerService } from '@logger'
import { comfyUICacheService } from './ComfyUICacheService'
import type { ComfyUIWorkflow, ComfyUIComponentConfig } from '../../renderer/src/types/component'
import type { ComfyUIProgress } from '../../renderer/src/types/comfyui'
import { WorkflowAnalyzer } from '../utils/workflowAnalyzer'

const logger = loggerService.withContext('ComfyUIService')

// 队列项接口
interface QueueItem {
  id: string
  requestId: string
  componentConfig: ComfyUIComponentConfig
  parameters: Record<string, any>
  onProgress?: (progress: ComfyUIProgress) => void
  resolve: (value: { outputImages: string[]; duration: number }) => void
  reject: (reason?: any) => void
  enqueuedAt: number
}

// 生成进度接口
interface GenerationProgress {
  percentage: number
  status: string
  nodeId?: string
}

/**
 * ComfyUI客户端 - 基于测试代码
 */
class ComfyUIClient {
  private baseUrl: string
  private clientId: string

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl.replace(/\/$/, '') // 移除末尾斜杠
    this.clientId = this.generateClientId()
  }

  private generateClientId(): string {
    return Math.random().toString(36).substring(2, 15)
  }

  /**
   * 测试连接
   */
  async testConnection(): Promise<boolean> {
    try {
      const response = await fetch(`${this.baseUrl}/system_stats`, {
        method: 'GET',
        timeout: 5000
      })
      return response.ok
    } catch (error) {
      logger.error('ComfyUI connection test failed', error as Error)
      return false
    }
  }

  /**
   * 提交工作流到队列
   */
  async queuePrompt(workflow: ComfyUIWorkflow): Promise<{ prompt_id: string }> {
    try {
      const response = await fetch(`${this.baseUrl}/prompt`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          prompt: workflow,
          client_id: this.clientId
        })
      })

      if (!response.ok) {
        const errorText = await response.text()
        throw new Error(`HTTP ${response.status}: ${errorText}`)
      }

      const result = await response.json()

      if (result.error) {
        throw new Error(`ComfyUI error: ${JSON.stringify(result.error)}`)
      }

      return result
    } catch (error) {
      logger.error('Failed to queue prompt', error as Error)
      throw error
    }
  }

  /**
   * 获取历史记录
   */
  async getHistory(promptId: string): Promise<any> {
    try {
      const response = await fetch(`${this.baseUrl}/history/${promptId}`)

      if (!response.ok) {
        throw new Error(`Failed to get history: HTTP ${response.status}`)
      }

      return await response.json()
    } catch (error) {
      logger.error('Failed to get history', error as Error, { promptId })
      throw error
    }
  }

  /**
   * 监听工作流执行进度
   */
  async listenProgress(
    promptId: string,
    onProgress: (progress: GenerationProgress) => void,
    onComplete: (result: any) => void,
    onError: (error: string) => void
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      const wsUrl = this.baseUrl.replace(/^http/, 'ws') + `/ws?clientId=${this.clientId}`
      const ws = new WebSocket(wsUrl)

      let isComplete = false
      let isResolved = false
      let timeout: NodeJS.Timeout | null = null

      const safeResolve = () => {
        if (!isResolved) {
          isResolved = true
          if (timeout) clearTimeout(timeout)
          resolve()
        }
      }

      const safeReject = (error: Error) => {
        if (!isResolved) {
          isResolved = true
          if (timeout) clearTimeout(timeout)
          reject(error)
        }
      }

      // 5分钟超时
      timeout = setTimeout(() => {
        if (!isComplete && !isResolved) {
          logger.error(`WebSocket timeout for prompt ${promptId}`)
          const error = new Error('Timeout waiting for completion')
          onError(error.message)
          safeReject(error)
        }
      }, 300000)

      ws.on('open', () => {
        logger.info('WebSocket connected', { promptId, clientId: this.clientId })
      })

      ws.on('message', async (data: Buffer) => {
        try {
          const dataStr = data.toString('utf8')

          // 跳过非JSON数据
          if (!dataStr.trim().startsWith('{') || /[\x00-\x08\x0E-\x1F\x7F-\xFF]/.test(dataStr)) {
            return
          }

          const message = JSON.parse(dataStr)

          if (message.type === 'progress' && message.data?.prompt_id === promptId) {
            const progress: GenerationProgress = {
              percentage: Math.round(((message.data.value || 0) / (message.data.max || 100)) * 100),
              status: 'executing',
              nodeId: message.data.node
            }
            onProgress(progress)
          } else if (message.type === 'executed' && message.data?.prompt_id === promptId) {
            // 任务完成，获取结果
            isComplete = true

            try {
              const history = await this.getHistory(promptId)
              const promptData = history[promptId]

              if (promptData && promptData.outputs) {
                const outputImages: string[] = []

                for (const nodeId in promptData.outputs) {
                  const nodeOutput = promptData.outputs[nodeId]
                  if (nodeOutput.images) {
                    for (const image of nodeOutput.images) {
                      const imageUrl = `${this.baseUrl}/view?filename=${image.filename}&subfolder=${image.subfolder || ''}&type=${image.type || 'output'}`
                      outputImages.push(imageUrl)
                    }
                  }
                }

                onComplete({ outputImages })
                safeResolve()
              } else {
                onError('No outputs found in history')
                safeReject(new Error('No outputs found'))
              }
            } catch (error) {
              onError((error as Error).message)
              safeReject(error as Error)
            }
          } else if (message.type === 'execution_error' && message.data?.prompt_id === promptId) {
            onError(`Execution error: ${JSON.stringify(message.data)}`)
            safeReject(new Error('Execution error'))
          }
        } catch (err) {
          // JSON解析错误不影响任务执行
          if ((err as Error).message.includes('WebSocket') || (err as Error).message.includes('Connection')) {
            if (!isResolved) {
              onError(`WebSocket connection error: ${(err as Error).message}`)
              safeReject(err as Error)
            }
          }
        }
      })

      ws.on('error', (error) => {
        logger.error(`WebSocket error for prompt ${promptId}`, error)
        onError(error.message)
        safeReject(error)
      })

      ws.on('close', (code, reason) => {
        if (!isComplete && !isResolved) {
          const error = new Error(`WebSocket closed unexpectedly: ${code} ${reason}`)
          onError(error.message)
          safeReject(error)
        } else if (isComplete) {
          safeResolve()
        }
      })
    })
  }

  /**
   * 执行工作流
   */
  async executeWorkflow(
    workflow: ComfyUIWorkflow,
    onProgress?: (progress: GenerationProgress) => void
  ): Promise<{ outputImages: string[]; duration: number }> {
    const startTime = Date.now()

    try {
      // 1. 提交工作流
      const queueResult = await this.queuePrompt(workflow)
      const promptId = queueResult.prompt_id

      logger.info('Workflow queued', { promptId })

      // 2. 监听进度
      const result = await new Promise<{ outputImages: string[] }>((resolve, reject) => {
        this.listenProgress(
          promptId,
          (progress) => {
            if (onProgress) {
              onProgress(progress)
            }
          },
          (result) => {
            resolve(result)
          },
          (error) => {
            reject(new Error(error))
          }
        ).catch(reject)
      })

      const duration = Date.now() - startTime
      return { outputImages: result.outputImages, duration }
    } catch (error) {
      logger.error('Workflow execution failed', error as Error)
      throw error
    }
  }
}

/**
 * ComfyUI队列管理器 - 基于测试代码
 */
class ComfyQueueManager {
  private static instance: ComfyQueueManager
  private queue: QueueItem[] = []
  private active = 0
  private concurrency = 1 // 默认并发为1，防止死机
  private processing = false

  private constructor(concurrency?: number) {
    this.concurrency = concurrency || 1
  }

  static getInstance(concurrency?: number) {
    if (!this.instance) {
      this.instance = new ComfyQueueManager(concurrency)
    }
    return this.instance
  }

  setConcurrency(n: number) {
    if (Number.isFinite(n) && n > 0) {
      this.concurrency = Math.floor(n)
      this.drain()
    }
  }

  enqueue(
    componentConfig: ComfyUIComponentConfig,
    parameters: Record<string, any>,
    requestId: string,
    onProgress?: (progress: ComfyUIProgress) => void
  ) {
    return new Promise<{ outputImages: string[]; duration: number }>((resolve, reject) => {
      const item: QueueItem = {
        id: `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
        requestId,
        componentConfig,
        parameters,
        onProgress,
        resolve,
        reject,
        enqueuedAt: Date.now()
      }
      this.queue.push(item)
      this.drain()
    })
  }

  private async runItem(item: QueueItem) {
    const comfyClient = new ComfyUIClient(item.componentConfig.serverUrl)

    // 测试连接
    const isConnected = await comfyClient.testConnection()
    if (!isConnected) {
      throw new Error('ComfyUI service is not available')
    }

    // 应用参数到工作流
    const workflow = this.applyParametersToWorkflow(item.componentConfig, item.parameters)

    // 执行工作流
    return await comfyClient.executeWorkflow(workflow, (progress) => {
      try {
        if (item.onProgress) {
          const comfyProgress: ComfyUIProgress = {
            promptId: 'unknown',
            nodeId: progress.nodeId || 'unknown',
            value: progress.percentage,
            max: 100,
            percentage: progress.percentage,
            status: progress.status
          }
          item.onProgress(comfyProgress)
        }
      } catch (_) {
        // 避免回调异常影响流程
      }
    })
  }

  private applyParametersToWorkflow(
    component: ComfyUIComponentConfig,
    parameters: Record<string, any>
  ): ComfyUIWorkflow {
    try {
      const workflow =
        typeof component.workflowTemplate === 'string'
          ? JSON.parse(component.workflowTemplate)
          : component.workflowTemplate

      // 应用参数绑定
      if (component.nodeBindings) {
        component.nodeBindings.forEach((binding) => {
          const paramValue = parameters[binding.parameterName]
          if (paramValue !== undefined && workflow[binding.nodeId]) {
            let transformedValue = paramValue

            // 处理动态前缀/后缀（仅限 string 类型且启用了动态前缀/后缀）
            if (binding.enableDynamicPrefixSuffix && typeof paramValue === 'string') {
              const prefixParamName = `${binding.parameterName}_prefix`
              const suffixParamName = `${binding.parameterName}_suffix`

              const prefixValue = parameters[prefixParamName] || binding.dynamicPrefixDefault || ''
              const suffixValue = parameters[suffixParamName] || binding.dynamicSuffixDefault || ''

              // 组合前缀 + 原值 + 后缀
              transformedValue =
                `${prefixValue}${prefixValue ? ' ' : ''}${paramValue}${suffixValue ? ' ' : ''}${suffixValue}`.trim()

              logger.info('应用动态前缀/后缀', {
                parameter: binding.parameterName,
                original: paramValue,
                prefix: prefixValue,
                suffix: suffixValue,
                final: transformedValue
              })
            }

            workflow[binding.nodeId].inputs[binding.inputField] = transformedValue
          }
        })
      }

      // 注入随机种子
      return WorkflowAnalyzer.injectRandomSeeds(workflow)
    } catch (error) {
      logger.error('Failed to apply parameters to workflow', error as Error)
      throw error
    }
  }

  private drain() {
    if (this.processing) return
    this.processing = true

    const loop = async () => {
      while (this.active < this.concurrency && this.queue.length > 0) {
        const item = this.queue.shift()!
        this.active += 1

        // 超时保护，防止卡死
        const timeoutMs = 600000 // 10分钟
        const timeoutPromise = new Promise<never>((_, rej) => {
          const t = setTimeout(() => {
            clearTimeout(t)
            rej(new Error('Task timeout'))
          }, timeoutMs)
        })

        Promise.race([this.runItem(item), timeoutPromise])
          .then((result) => {
            item.resolve(result as { outputImages: string[]; duration: number })
          })
          .catch((err) => {
            logger.error(`Queue item failed`, err, { itemId: item.id, requestId: item.requestId })
            item.reject(err)
          })
          .finally(() => {
            this.active -= 1
            setImmediate(() => this.drain())
          })
      }

      this.processing = false
    }

    setImmediate(loop)
  }
}

/**
 * ComfyUI服务类
 */
export class ComfyUIService extends EventEmitter {
  private queueManager: ComfyQueueManager

  constructor() {
    super()
    this.queueManager = ComfyQueueManager.getInstance()
    this.setMaxListeners(50)
  }

  /**
   * 生成图片
   */
  async generateImage(
    component: ComfyUIComponentConfig,
    parameters: Record<string, any>,
    _clientId?: string
  ): Promise<{
    success: boolean
    imagePath?: string
    cached?: boolean
    error?: string
  }> {
    try {
      if (!component || !component.id) {
        throw new Error('Invalid component configuration')
      }

      logger.info('Starting image generation', {
        componentId: component.id,
        componentName: component.componentName,
        parameters
      })

      // 生成缓存键
      const cacheKey = comfyUICacheService.generateCacheKey(component.id, parameters)

      // 检查缓存
      const cachedPath = await comfyUICacheService.getCachedImage(cacheKey)
      if (cachedPath) {
        logger.info('Using cached image', { componentId: component.id, cacheKey })
        return {
          success: true,
          imagePath: cachedPath,
          cached: true
        }
      }

      // 添加到队列
      const requestId = `${component.id}-${Date.now()}`
      const result = await this.queueManager.enqueue(component, parameters, requestId, (progress) => {
        // 转发进度事件
        this.emit('progress', progress)
      })

      if (result.outputImages && result.outputImages.length > 0) {
        // 下载并缓存第一张图片
        const imagePath = await comfyUICacheService.downloadAndCacheImage(
          cacheKey,
          result.outputImages[0],
          requestId,
          component.id,
          parameters
        )

        // 发送完成事件
        this.emit('completed', {
          promptId: requestId,
          results: result.outputImages
        })

        return {
          success: true,
          imagePath
        }
      } else {
        throw new Error('No images generated')
      }
    } catch (error) {
      logger.error('Image generation failed', error as Error, {
        componentId: component?.id
      })

      // 发送失败事件
      this.emit('failed', {
        promptId: `${component?.id}-${Date.now()}`,
        error: (error as Error).message
      })

      return {
        success: false,
        error: (error as Error).message
      }
    }
  }

  /**
   * 设置并发数
   */
  setConcurrency(n: number) {
    this.queueManager.setConcurrency(n)
  }

  /**
   * 获取组件列表 - 兼容性方法
   */
  async getComponents(): Promise<ComfyUIComponentConfig[]> {
    // 这个方法应该从组件服务获取，这里返回空数组
    return []
  }

  /**
   * 创建组件 - 兼容性方法
   */
  async createComponent(_config: ComfyUIComponentConfig): Promise<string> {
    // 这个方法应该由组件服务处理
    throw new Error('createComponent should be handled by ComponentService')
  }

  /**
   * 更新组件 - 兼容性方法
   */
  async updateComponent(_id: string, _updates: Partial<ComfyUIComponentConfig>): Promise<void> {
    // 这个方法应该由组件服务处理
    throw new Error('updateComponent should be handled by ComponentService')
  }

  /**
   * 删除组件 - 兼容性方法
   */
  async deleteComponent(_id: string): Promise<void> {
    // 这个方法应该由组件服务处理
    throw new Error('deleteComponent should be handled by ComponentService')
  }

  /**
   * 分析工作流 - 兼容性方法
   */
  async analyzeWorkflow(
    _name: string,
    workflowJson: string,
    _description?: string,
    _serverUrl?: string,
    _apiKey?: string
  ): Promise<any> {
    // 这个方法应该由工作流分析器处理
    return WorkflowAnalyzer.analyzeWorkflow(JSON.parse(workflowJson))
  }

  /**
   * 生成图片（带缓存）- 兼容性方法
   */
  async generateWithCache(component: ComfyUIComponentConfig, parameters: Record<string, any>, clientId?: string) {
    return this.generateImage(component, parameters, clientId)
  }

  /**
   * 通过组件名生成内容
   */
  async generateByComponentName(
    componentName: string,
    parameters: Record<string, any>
  ): Promise<{
    success: boolean
    filePath?: string
    contentType?: string
    cached?: boolean
    error?: string
  }> {
    try {
      logger.info('Generating content by component name', { componentName, parameters })

      // 导入组件查找服务
      const { componentLookupService } = await import('./ComponentLookupService')

      // 查找组件配置
      const component = await componentLookupService.findComponentByName(componentName)
      if (!component) {
        return {
          success: false,
          error: `Component '${componentName}' not found or disabled`
        }
      }

      // 验证参数
      const validationResult = this.validateParameters(component, parameters)
      if (!validationResult.valid) {
        return {
          success: false,
          error: `Invalid parameters: ${validationResult.errors.join(', ')}`
        }
      }

      // 调用现有的生成方法
      const result = await this.generateImage(component, parameters)

      if (result.success && result.imagePath) {
        // 根据输出类型确定内容类型
        const contentType = this.getContentType(component.outputType, result.imagePath)

        return {
          success: true,
          filePath: result.imagePath,
          contentType,
          cached: result.cached
        }
      } else {
        return {
          success: false,
          error: result.error || 'Generation failed'
        }
      }
    } catch (error) {
      logger.error('Failed to generate by component name', error as Error, { componentName })
      return {
        success: false,
        error: (error as Error).message
      }
    }
  }

  /**
   * 验证参数
   */
  private validateParameters(
    component: ComfyUIComponentConfig,
    parameters: Record<string, any>
  ): { valid: boolean; errors: string[] } {
    const errors: string[] = []

    // 检查必需参数
    component.parameters.forEach((param) => {
      if (param.required && (parameters[param.name] === undefined || parameters[param.name] === '')) {
        errors.push(`Missing required parameter: ${param.name}`)
      }
    })

    // 检查参数类型
    Object.entries(parameters).forEach(([name, value]) => {
      const paramConfig = component.parameters.find((p) => p.name === name)
      if (paramConfig && !this.isValidParameterType(value, paramConfig.type)) {
        errors.push(`Invalid type for parameter ${name}: expected ${paramConfig.type}`)
      }
    })

    return {
      valid: errors.length === 0,
      errors
    }
  }

  /**
   * 检查参数类型是否有效
   */
  private isValidParameterType(value: any, expectedType: string): boolean {
    switch (expectedType) {
      case 'string':
        return typeof value === 'string'
      case 'number':
        return typeof value === 'number' && !isNaN(value)
      case 'boolean':
        return typeof value === 'boolean'
      case 'url':
        return typeof value === 'string' && (value.startsWith('http') || value.startsWith('file'))
      case 'json':
        try {
          if (typeof value === 'string') {
            JSON.parse(value)
          }
          return true
        } catch {
          return false
        }
      default:
        return true
    }
  }

  /**
   * 根据输出类型和文件路径确定内容类型
   */
  private getContentType(outputType: string, filePath: string): string {
    const path = require('path')
    const ext = path.extname(filePath).toLowerCase()

    switch (outputType) {
      case 'image':
        switch (ext) {
          case '.png':
            return 'image/png'
          case '.jpg':
          case '.jpeg':
            return 'image/jpeg'
          case '.gif':
            return 'image/gif'
          case '.webp':
            return 'image/webp'
          default:
            return 'image/png'
        }
      case 'video':
        switch (ext) {
          case '.mp4':
            return 'video/mp4'
          case '.webm':
            return 'video/webm'
          case '.avi':
            return 'video/avi'
          case '.mov':
            return 'video/quicktime'
          default:
            return 'video/mp4'
        }
      case 'text':
        return 'text/plain; charset=utf-8'
      default:
        return 'application/octet-stream'
    }
  }
}

// 单例实例
export const comfyUIService = new ComfyUIService()
