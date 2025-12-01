/**
 * ComfyUI 前端服务
 * 通过 IPC 与主进程通信，管理 ComfyUI 组件和图片生成
 */

import { loggerService } from '@logger'
import type { ComfyUIComponentConfig } from '@renderer/types/component'
import type { CreateComfyUIComponentRequest } from '@renderer/types/comfyui'
import { comfyUIClientService } from './ComfyUIClientService'

const logger = loggerService.withContext('ComfyUIService')

export class ComfyUIService {
  private static instance: ComfyUIService

  public static getInstance(): ComfyUIService {
    if (!ComfyUIService.instance) {
      ComfyUIService.instance = new ComfyUIService()
    }
    return ComfyUIService.instance
  }

  /**
   * 获取所有组件
   */
  async getComponents(): Promise<ComfyUIComponentConfig[]> {
    try {
      return await window.api.comfyui.getComponents()
    } catch (error: unknown) {
      const err = error instanceof Error ? error : new Error(String(error))
      logger.error('Failed to get components', err)
      return []
    }
  }

  /**
   * 创建组件
   */
  async createComponent(
    config: ComfyUIComponentConfig | CreateComfyUIComponentRequest
  ): Promise<{ id: string; componentName: string }> {
    try {
      if ('workflowJson' in config) {
        return await comfyUIClientService.createComponent(config)
      }

      const id = await window.api.comfyui.createComponent(config)
      const componentName = (config as ComfyUIComponentConfig).name || (config as any).componentName || id
      return { id, componentName }
    } catch (error: unknown) {
      const err = error instanceof Error ? error : new Error(String(error))
      logger.error('Failed to create component', err)
      throw err
    }
  }

  /**
   * 更新组件
   */
  async updateComponent(id: string, updates: Partial<ComfyUIComponentConfig>): Promise<void> {
    try {
      await window.api.comfyui.updateComponent(id, updates)
    } catch (error: unknown) {
      const err = error instanceof Error ? error : new Error(String(error))
      logger.error('Failed to update component', err)
      throw err
    }
  }

  /**
   * 删除组件
   */
  async deleteComponent(id: string): Promise<void> {
    try {
      await window.api.comfyui.deleteComponent(id)
    } catch (error: unknown) {
      const err = error instanceof Error ? error : new Error(String(error))
      logger.error('Failed to delete component', err)
      throw err
    }
  }

  /**
   * 生成图片
   */
  async generateImage(
    componentConfig: ComfyUIComponentConfig,
    parameters: Record<string, any>,
    onProgress?: (progress: number) => void
  ): Promise<{
    success: boolean
    imagePath?: string
    cached?: boolean
    error?: string
  }> {
    try {
      logger.info('Starting image generation', { componentId: componentConfig.id, parameters })

      // 生成客户端ID用于进度跟踪
      const clientId = this.generateClientId()

      // 设置进度监听
      let progressCleanup: (() => void) | null = null

      if (onProgress) {
        // 监听主进程的进度事件
        const handleProgress = (_event: any, data: any) => {
          logger.verbose('Received progress event', data)
          if (data.percentage !== undefined) {
            onProgress(data.percentage)
          }
        }

        const handleCompleted = (_event: any, data: any) => {
          logger.info('Received completed event', data)
          onProgress(100)
        }

        const handleFailed = (_event: any, data: any) => {
          logger.error('Received failed event', data)
          onProgress(100) // 设置为100%以停止进度显示
        }

        // 注册事件监听器
        window.api.on('comfyui:progress', handleProgress)
        window.api.on('comfyui:completed', handleCompleted)
        window.api.on('comfyui:failed', handleFailed)

        progressCleanup = () => {
          window.api.off('comfyui:progress', handleProgress)
          window.api.off('comfyui:completed', handleCompleted)
          window.api.off('comfyui:failed', handleFailed)
        }
      }

      try {
        // 调用主进程生成图片
        const result = await window.api.comfyui.generate(componentConfig, parameters, clientId)

        if (result.success) {
          logger.info('Image generation completed', {
            componentId: componentConfig.id,
            cached: result.cached,
            imagePath: result.imagePath
          })
        } else {
          logger.error('Image generation failed', { componentId: componentConfig.id, error: result.error })
        }

        return result
      } finally {
        // 清理进度监听器
        if (progressCleanup) {
          progressCleanup()
        }
      }
    } catch (error: unknown) {
      const err = error instanceof Error ? error : new Error(String(error))
      logger.error('Failed to generate image', err, { componentId: componentConfig.id })
      return {
        success: false,
        error: err.message
      }
    }
  }

  /**
   * 分析工作流
   */
  async analyzeWorkflow(
    name: string,
    workflowJson: string,
    description?: string,
    serverUrl?: string,
    apiKey?: string
  ): Promise<any> {
    try {
      return await window.api.comfyui.analyzeWorkflow(name, workflowJson, description, serverUrl, apiKey)
    } catch (error: unknown) {
      const err = error instanceof Error ? error : new Error(String(error))
      logger.error('Failed to analyze workflow', err)
      throw err
    }
  }

  /**
   * 生成客户端ID
   */
  private generateClientId(): string {
    return `cherry-studio-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
  }

  /**
   * 建立 WebSocket 连接用于进度监听
   */
  async connectWebSocket(
    componentId: string,
    onProgress: (data: any) => void,
    onComplete: (data: any) => void,
    onError: (error: any) => void
  ): Promise<void> {
    try {
      const clientId = this.generateClientId()

      // TODO: 实现 WebSocket 连接逻辑
      // 这里需要获取 WebSocket URL 并建立连接
      logger.info('WebSocket connection requested', { componentId, clientId })

      // 暂时使用模拟数据
      setTimeout(() => {
        onProgress({ type: 'progress', value: 50 })
      }, 1000)

      setTimeout(() => {
        onComplete({ type: 'complete', results: ['mock-image-url'] })
      }, 3000)
    } catch (error: unknown) {
      const err = error instanceof Error ? error : new Error(String(error))
      logger.error('Failed to connect WebSocket', err)
      onError(error)
    }
  }

  /**
   * 断开 WebSocket 连接
   */
  async disconnectWebSocket(clientId: string): Promise<void> {
    try {
      // TODO: 实现 WebSocket 断开逻辑
      logger.info('WebSocket disconnection requested', { clientId })
    } catch (error: unknown) {
      const err = error instanceof Error ? error : new Error(String(error))
      logger.error('Failed to disconnect WebSocket', err)
    }
  }
}

// 导出单例实例
export const comfyUIService = ComfyUIService.getInstance()
