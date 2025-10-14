// @ts-nocheck
/**
 * ComfyUI服务集成
 * 基于测试代码的正确实现，包含队列管理和正确的WebSocket监听
 */

import WebSocket from 'ws'
import fetch from 'node-fetch'
import { EventEmitter } from 'events'
import { loggerService } from '@logger'
import { comfyUICacheService } from './ComfyUICacheService'
import type { ComfyUIWorkflow, ComfyUIComponentConfig } from '../../renderer/src/types/component'
import type {
  ComfyUIGenerateResponse,
  ComfyUIProgress,
  ComfyUIWebSocketMessage,
  ComfyUIServerConfig
} from '../../renderer/src/types/comfyui'
import { WorkflowAnalyzer } from '../utils/workflowAnalyzer'

const logger = loggerService.withContext('ComfyUIService')

// 队列项接口
interface QueueItem {
  id: string
  requestId: string
  componentConfig: ComfyUIComponentConfig
  parameters: Record<string, any>
  onProgress?: (progress: ComfyUIProgress) => void
  resolve: (value: { success: boolean; imagePath?: string; cached?: boolean; error?: string }) => void
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
 * ComfyUI服务类 - 基于测试代码的正确实现
 */
export class ComfyUIService extends EventEmitter {
  private queue: QueueItem[] = []
  private active = 0
  private concurrency = 1 // 默认并发为1，防止死机
  private processing = false
  private clientId: string
  private wsConnections: Map<string, WebSocket> = new Map()
  private activePrompts: Map<string, { componentId: string; clientId: string }> = new Map()
  private components: Map<string, ComfyUIComponentConfig> = new Map()
  private cacheService = comfyUICacheService

  constructor() {
    super()
    this.clientId = this.generateClientId()
    this.setupEventHandlers()
    this.loadComponents()

    // 设置进程监听器限制，避免EventEmitter内存泄漏警告
    this.setMaxListeners(50)
  }

  /**
   * 设置事件处理器
   */
  private setupEventHandlers() {
    this.on('progress', (data: ComfyUIProgress) => {
      logger.verbose('生成进度更新', data)
    })

    this.on('completed', (data: { promptId: string; results: string[] }) => {
      logger.info('生成完成', data)
      this.activePrompts.delete(data.promptId)
    })

    this.on('failed', (data: { promptId: string; error: string }) => {
      logger.error('生成失败', new Error(data.error), data)
      this.activePrompts.delete(data.promptId)
    })
  }

  /**
   * 测试ComfyUI服务器连接
   */
  async testConnection(serverConfig: ComfyUIServerConfig): Promise<{ success: boolean; error?: string }> {
    try {
      const response = await fetch(`${serverConfig.url}/system_stats`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          ...(serverConfig.apiKey && { Authorization: `Bearer ${serverConfig.apiKey}` })
        },
        timeout: serverConfig.timeout || 10000
      })

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`)
      }

      const stats = await response.json()
      logger.info('ComfyUI连接测试成功', { url: serverConfig.url, stats })

      return { success: true }
    } catch (error) {
      const errorMessage = `ComfyUI连接失败: ${(error as Error).message}`
      logger.error(errorMessage, error as Error)
      return { success: false, error: errorMessage }
    }
  }

  /**
   * 执行工作流生成
   */
  async executeWorkflow(
    component: ComfyUIComponentConfig,
    parameters: Record<string, any>,
    clientId?: string
  ): Promise<ComfyUIGenerateResponse> {
    try {
      logger.info('开始执行工作流', {
        componentId: component.id,
        componentName: component.componentName,
        parameters
      })

      // 1. 应用参数到工作流
      const workflow = this.applyParametersToWorkflow(component, parameters)

      // 2. 生成随机种子
      const workflowWithSeeds = WorkflowAnalyzer.injectRandomSeeds(workflow)

      // 3. 建立WebSocket连接（如果需要）
      if (clientId) {
        await this.establishWebSocketConnection(component.serverUrl, clientId)
      }

      // 4. 提交工作流到ComfyUI
      const promptResponse = await this.submitPrompt(component.serverUrl, workflowWithSeeds, component.apiKey)

      if (!promptResponse.success) {
        throw new Error(promptResponse.error || '提交工作流失败')
      }

      const promptId = promptResponse.prompt_id

      // 5. 记录活动提示和组件配置
      this.activePrompts.set(promptId, { componentId: component.id, clientId })
      this.components.set(component.id, component)

      logger.info('工作流提交成功', { promptId, componentId: component.id })

      return {
        success: true,
        promptId,
        status: 'queued',
        wsUrl: clientId ? `${component.serverUrl.replace('http', 'ws')}/ws?clientId=${clientId}` : undefined
      }
    } catch (error) {
      logger.error('工作流执行失败', error as Error, { componentId: component.id })
      return {
        success: false,
        error: (error as Error).message,
        status: 'failed'
      }
    }
  }

  /**
   * 应用参数到工作流
   */
  private applyParametersToWorkflow(
    component: ComfyUIComponentConfig,
    parameters: Record<string, any>
  ): ComfyUIWorkflow {
    const workflow = JSON.parse(JSON.stringify(component.workflowTemplate))

    // 应用参数绑定
    component.nodeBindings.forEach((binding) => {
      const paramValue = parameters[binding.parameterName]
      if (paramValue !== undefined) {
        // 应用数据转换（如果有）
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

        if (binding.transform) {
          try {
            // 简单的转换函数支持
            transformedValue = this.applyTransform(transformedValue, binding.transform)
          } catch (error) {
            logger.warn('参数转换失败，使用原始值', error as Error, {
              parameter: binding.parameterName,
              transform: binding.transform
            })
          }
        }

        // 设置节点参数值
        if (workflow[binding.nodeId] && workflow[binding.nodeId].inputs) {
          workflow[binding.nodeId].inputs[binding.inputField] = transformedValue
        }
      }
    })

    return workflow
  }

  /**
   * 应用参数转换
   */
  private applyTransform(value: any, transform: string): any {
    // 支持简单的转换函数
    switch (transform) {
      case 'parseInt':
        return parseInt(String(value), 10)
      case 'parseFloat':
        return parseFloat(String(value))
      case 'toString':
        return String(value)
      case 'toUpperCase':
        return String(value).toUpperCase()
      case 'toLowerCase':
        return String(value).toLowerCase()
      default:
        // 如果是JavaScript表达式，可以考虑使用eval（注意安全性）
        return value
    }
  }

  /**
   * 提交提示到ComfyUI
   */
  private async submitPrompt(
    serverUrl: string,
    workflow: ComfyUIWorkflow,
    apiKey?: string
  ): Promise<{ success: boolean; prompt_id?: string; error?: string }> {
    try {
      const response = await fetch(`${serverUrl}/prompt`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(apiKey && { Authorization: `Bearer ${apiKey}` })
        },
        body: JSON.stringify({
          prompt: workflow,
          client_id: this.generateClientId()
        })
      })

      if (!response.ok) {
        const errorText = await response.text()
        throw new Error(`HTTP ${response.status}: ${errorText}`)
      }

      const result = await response.json()
      return { success: true, prompt_id: result.prompt_id }
    } catch (error) {
      return { success: false, error: (error as Error).message }
    }
  }

  /**
   * 建立WebSocket连接
   */
  private async establishWebSocketConnection(serverUrl: string, clientId: string): Promise<void> {
    if (this.wsConnections.has(clientId)) {
      return // 连接已存在
    }

    const wsUrl = `${serverUrl.replace('http', 'ws')}/ws?clientId=${clientId}`

    return new Promise((resolve, reject) => {
      const ws = new WebSocket(wsUrl)

      ws.on('open', () => {
        logger.info('WebSocket连接已建立', { clientId, wsUrl })
        this.wsConnections.set(clientId, ws)
        resolve()
      })

      ws.on('message', (data: WebSocket.Data) => {
        try {
          const message: ComfyUIWebSocketMessage = JSON.parse(data.toString())
          this.handleWebSocketMessage(message, clientId)
        } catch (error) {
          logger.error('WebSocket消息解析失败', error as Error, { data: data.toString() })
        }
      })

      ws.on('error', (error) => {
        logger.error('WebSocket连接错误', error, { clientId })
        this.wsConnections.delete(clientId)
        reject(error)
      })

      ws.on('close', () => {
        logger.info('WebSocket连接已关闭', { clientId })
        this.wsConnections.delete(clientId)
      })
    })
  }

  /**
   * 处理WebSocket消息
   */
  private handleWebSocketMessage(message: ComfyUIWebSocketMessage, clientId: string) {
    switch (message.type) {
      case 'progress':
        if (message.data.prompt_id) {
          const progress: ComfyUIProgress = {
            promptId: message.data.prompt_id,
            nodeId: message.data.node,
            value: message.data.value || 0,
            max: message.data.max || 100,
            percentage: Math.round(((message.data.value || 0) / (message.data.max || 100)) * 100),
            status: 'executing'
          }
          this.emit('progress', progress)
        }
        break

      case 'executed':
        if (message.data.prompt_id) {
          // 获取生成结果
          this.fetchResults(message.data.prompt_id, clientId)
        }
        break

      case 'execution_error':
        if (message.data.prompt_id) {
          this.emit('failed', {
            promptId: message.data.prompt_id,
            error: message.data.exception_message || '执行错误'
          })
        }
        break
    }
  }

  /**
   * 获取生成结果
   */
  private async fetchResults(promptId: string, _clientId: string) {
    const promptInfo = this.activePrompts.get(promptId)
    if (!promptInfo) return

    try {
      // 获取组件配置以确定服务器URL
      const component = this.components.get(promptInfo.componentId)
      if (!component) {
        throw new Error(`Component not found: ${promptInfo.componentId}`)
      }

      // 调用ComfyUI的history API获取结果
      const response = await fetch(`${component.serverUrl}/history/${promptId}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          ...(component.apiKey && { Authorization: `Bearer ${component.apiKey}` })
        }
      })

      if (!response.ok) {
        throw new Error(`Failed to fetch results: HTTP ${response.status}`)
      }

      const historyData = await response.json()
      const promptData = historyData[promptId]

      if (!promptData || !promptData.outputs) {
        throw new Error('No outputs found in history data')
      }

      // 提取图片URL
      const results: string[] = []
      for (const nodeId in promptData.outputs) {
        const nodeOutput = promptData.outputs[nodeId]
        if (nodeOutput.images) {
          for (const image of nodeOutput.images) {
            // 构建完整的图片URL
            const imageUrl = `${component.serverUrl}/view?filename=${image.filename}&subfolder=${image.subfolder || ''}&type=${image.type || 'output'}`
            results.push(imageUrl)
          }
        }
      }

      logger.info('获取生成结果成功', { promptId, resultCount: results.length })
      this.emit('completed', { promptId, results })

      // 清理活动提示和组件缓存
      this.activePrompts.delete(promptId)
      this.components.delete(promptInfo.componentId)
    } catch (error) {
      logger.error('获取生成结果失败', error as Error, { promptId })
      this.emit('failed', { promptId, error: (error as Error).message })

      // 清理活动提示和组件缓存
      this.activePrompts.delete(promptId)
      this.components.delete(promptInfo.componentId)
    }
  }

  /**
   * 生成客户端ID
   */
  private generateClientId(): string {
    return `cherry-studio-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
  }

  /**
   * 关闭WebSocket连接
   */
  closeWebSocketConnection(clientId: string) {
    const ws = this.wsConnections.get(clientId)
    if (ws) {
      ws.close()
      this.wsConnections.delete(clientId)
      logger.info('WebSocket连接已关闭', { clientId })
    }
  }

  /**
   * 关闭所有连接
   */
  closeAllConnections() {
    this.wsConnections.forEach((ws) => {
      ws.close()
    })
    this.wsConnections.clear()
    this.activePrompts.clear()
    logger.info('所有WebSocket连接已关闭')
  }

  // ==================== 组件管理方法 ====================

  /**
   * 加载组件配置
   */
  private async loadComponents() {
    // TODO: 从持久化存储加载组件配置
    // 暂时使用内存存储
    logger.info('Components loaded from memory storage')
  }

  /**
   * 获取所有组件
   */
  async getComponents(): Promise<ComfyUIComponentConfig[]> {
    return Array.from(this.components.values())
  }

  /**
   * 获取单个组件
   */
  async getComponent(id: string): Promise<ComfyUIComponentConfig | null> {
    return this.components.get(id) || null
  }

  /**
   * 创建组件
   */
  async createComponent(config: ComfyUIComponentConfig): Promise<string> {
    const id = config.id || `comfyui-${Date.now()}`
    const componentConfig = { ...config, id }

    this.components.set(id, componentConfig)
    await this.saveComponents()

    logger.info('Component created', { id, name: config.name })
    return id
  }

  /**
   * 更新组件
   */
  async updateComponent(id: string, updates: Partial<ComfyUIComponentConfig>): Promise<void> {
    const existing = this.components.get(id)
    if (!existing) {
      throw new Error(`Component not found: ${id}`)
    }

    const updated = { ...existing, ...updates, id }
    this.components.set(id, updated)
    await this.saveComponents()

    logger.info('Component updated', { id })
  }

  /**
   * 删除组件
   */
  async deleteComponent(id: string): Promise<void> {
    if (!this.components.has(id)) {
      throw new Error(`Component not found: ${id}`)
    }

    const component = this.components.get(id)!

    // 删除组件配置
    this.components.delete(id)
    await this.saveComponents()

    // 清理组件相关的缓存
    try {
      const deletedCacheCount = await this.cacheService.clearComponentCache(id)
      logger.info('Component deleted with cache cleanup', {
        id,
        componentName: component.componentName,
        deletedCacheCount
      })
    } catch (error) {
      logger.warn('Failed to clear component cache during deletion', error as Error, { id })
      // 即使缓存清理失败，组件删除仍然成功
      logger.info('Component deleted (cache cleanup failed)', { id })
    }
  }

  /**
   * 保存组件配置
   */
  private async saveComponents() {
    // TODO: 实现持久化存储
    logger.verbose('Components saved to memory storage')
  }

  /**
   * 生成图片（带缓存）
   */
  async generateWithCache(
    component: ComfyUIComponentConfig,
    parameters: Record<string, any>,
    clientId?: string
  ): Promise<{
    success: boolean
    imagePath?: string
    promptId?: string
    cached?: boolean
    error?: string
  }> {
    try {
      if (!component || !component.id) {
        logger.error('Invalid component configuration', { component })
        throw new Error('Invalid component configuration')
      }

      logger.info('Starting generation with component', {
        componentId: component.id,
        componentName: component.componentName
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

      // 执行工作流生成
      const result = await this.executeWorkflow(component, parameters, clientId)

      if (!result.success || !result.promptId) {
        return {
          success: false,
          error: result.error || 'Generation failed'
        }
      }

      // TODO: 等待生成完成并获取图片URL
      const imageUrl = await this.waitForGenerationComplete(result.promptId)

      if (imageUrl) {
        // 下载并缓存图片
        const imagePath = await comfyUICacheService.downloadAndCacheImage(
          cacheKey,
          imageUrl,
          result.promptId,
          component.id,
          parameters
        )

        return {
          success: true,
          imagePath,
          promptId: result.promptId,
          cached: false
        }
      }

      return {
        success: false,
        error: 'Failed to get generated image'
      }
    } catch (error) {
      logger.error('Generate with cache failed', error as Error, { componentId: component.id })
      return {
        success: false,
        error: (error as Error).message
      }
    }
  }

  /**
   * 等待生成完成并获取图片URL
   */
  private async waitForGenerationComplete(promptId: string): Promise<string | null> {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(
        () => {
          this.removeAllListeners(`completed-${promptId}`)
          this.removeAllListeners(`failed-${promptId}`)
          reject(new Error('Generation timeout after 5 minutes'))
        },
        5 * 60 * 1000
      ) // 5分钟超时

      // 监听完成事件
      const onCompleted = (data: { promptId: string; results: string[] }) => {
        if (data.promptId === promptId) {
          clearTimeout(timeout)
          this.removeAllListeners(`completed-${promptId}`)
          this.removeAllListeners(`failed-${promptId}`)

          // 返回第一个结果URL，如果有的话
          const imageUrl = data.results && data.results.length > 0 ? data.results[0] : null
          resolve(imageUrl)
        }
      }

      // 监听失败事件
      const onFailed = (data: { promptId: string; error: string }) => {
        if (data.promptId === promptId) {
          clearTimeout(timeout)
          this.removeAllListeners(`completed-${promptId}`)
          this.removeAllListeners(`failed-${promptId}`)
          reject(new Error(data.error))
        }
      }

      // 注册事件监听器
      this.on('completed', onCompleted)
      this.on('failed', onFailed)
    })
  }
}

// 单例实例
export const comfyUIService = new ComfyUIService()

