/**
 * ComfyUI前端API客户端服务
 * 负责与后端ComfyUI API通信，管理WebSocket连接，处理生成请求
 */

import type {
  ComfyUIGenerateResponse,
  ComfyUIProgress,
  CreateComfyUIComponentRequest,
  WorkflowAnalysisResult
} from '../types/comfyui'
import type { ComfyUIComponentConfig } from '../types/component'

/**
 * ComfyUI客户端服务类
 */
export class ComfyUIClientService {
  private baseUrl: string
  private wsConnections: Map<string, WebSocket> = new Map()
  private eventListeners: Map<string, Array<(data: any) => void>> = new Map()
  private apiKey: string | null = null

  constructor(baseUrl: string = 'http://localhost:23333/v1/comfyui') {
    this.baseUrl = baseUrl
    this.initApiKey()
  }

  /**
   * 初始化 API 密钥
   */
  private async initApiKey() {
    try {
      // 通过 IPC 获取 API 服务器配置
      const apiServer = (window.api as any).apiServer
      if (apiServer?.getConfig) {
        const config = await apiServer.getConfig()
        if (config?.apiKey) {
          this.apiKey = config.apiKey
        }
      }
    } catch (error) {
      console.warn('Failed to get API key:', error)
    }
  }

  /**
   * 获取认证头
   */
  private getAuthHeaders(): Record<string, string> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json'
    }

    if (this.apiKey) {
      headers['x-api-key'] = this.apiKey
    }

    return headers
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
  ): Promise<WorkflowAnalysisResult> {
    const response = await fetch(`${this.baseUrl}/workflows/analyze`, {
      method: 'POST',
      headers: this.getAuthHeaders(),
      body: JSON.stringify({
        name,
        workflowJson,
        description,
        serverUrl: serverUrl || 'http://localhost:8188',
        apiKey
      })
    })

    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.message || '工作流分析失败')
    }

    const result = await response.json()
    return result.data
  }

  /**
   * 获取组件列表
   */
  async getComponents(): Promise<ComfyUIComponentConfig[]> {
    const response = await fetch(`${this.baseUrl}/components`, {
      headers: this.getAuthHeaders()
    })

    if (!response.ok) {
      throw new Error('获取组件列表失败')
    }

    const result = await response.json()
    return result.data || []
  }

  /**
   * 创建组件
   */
  async createComponent(request: CreateComfyUIComponentRequest): Promise<{ id: string; componentName: string }> {
    const response = await fetch(`${this.baseUrl}/components`, {
      method: 'POST',
      headers: this.getAuthHeaders(),
      body: JSON.stringify(request)
    })

    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.message || '创建组件失败')
    }

    const result = await response.json()
    return result.data
  }

  /**
   * 更新组件
   */
  async updateComponent(id: string, updates: Partial<ComfyUIComponentConfig>): Promise<void> {
    const response = await fetch(`${this.baseUrl}/components/${id}`, {
      method: 'PUT',
      headers: this.getAuthHeaders(),
      body: JSON.stringify(updates)
    })

    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.message || '更新组件失败')
    }
  }

  /**
   * 删除组件
   */
  async deleteComponent(id: string): Promise<void> {
    const response = await fetch(`${this.baseUrl}/components/${id}`, {
      method: 'DELETE',
      headers: this.getAuthHeaders()
    })

    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.message || '删除组件失败')
    }
  }

  /**
   * 执行生成
   */
  async generate(
    componentId: string,
    parameters: Record<string, any>,
    onProgress?: (progress: ComfyUIProgress) => void,
    onComplete?: (results: string[]) => void,
    onError?: (error: string) => void
  ): Promise<ComfyUIGenerateResponse> {
    const clientId = this.generateClientId()

    // 建立WebSocket连接（如果有进度回调）
    if (onProgress || onComplete || onError) {
      await this.establishWebSocketConnection(componentId, clientId, {
        onProgress,
        onComplete,
        onError
      })
    }

    const response = await fetch(`${this.baseUrl}/generate/${componentId}`, {
      method: 'POST',
      headers: this.getAuthHeaders(),
      body: JSON.stringify({
        parameters,
        clientId
      })
    })

    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.message || '执行生成失败')
    }

    return await response.json()
  }

  /**
   * 建立WebSocket连接
   */
  private async establishWebSocketConnection(
    componentId: string,
    clientId: string,
    callbacks: {
      onProgress?: (progress: ComfyUIProgress) => void
      onComplete?: (results: string[]) => void
      onError?: (error: string) => void
    }
  ): Promise<void> {
    if (this.wsConnections.has(clientId)) {
      return // 连接已存在
    }

    // 先获取组件配置
    const response = await fetch(`${this.baseUrl}/components/${componentId}`, {
      headers: this.getAuthHeaders()
    })
    if (!response.ok) {
      throw new Error('无法获取组件配置')
    }

    const component = await response.json()
    const serverUrl = component.serverUrl || 'http://localhost:8188'

    // 将 http:// 转换为 ws://
    const wsUrl = serverUrl.replace(/^https?:\/\//, 'ws://') + `/ws?clientId=${clientId}`

    return new Promise((resolve, reject) => {
      try {
        const ws = new WebSocket(wsUrl)

        ws.onopen = () => {
          console.log('WebSocket连接已建立', clientId)
          this.wsConnections.set(clientId, ws)
          resolve()
        }

        ws.onmessage = (event) => {
          try {
            const message = JSON.parse(event.data)
            this.handleWebSocketMessage(message, callbacks)
          } catch (error) {
            console.error('WebSocket消息解析失败', error)
          }
        }

        ws.onerror = (error) => {
          console.error('WebSocket连接错误', error)
          this.wsConnections.delete(clientId)
          reject(error)
        }

        ws.onclose = () => {
          console.log('WebSocket连接已关闭', clientId)
          this.wsConnections.delete(clientId)
        }
      } catch (error) {
        console.error('建立WebSocket连接失败', error)
        reject(error)
      }
    })
  }

  /**
   * 处理WebSocket消息
   */
  private handleWebSocketMessage(
    message: any,
    callbacks: {
      onProgress?: (progress: ComfyUIProgress) => void
      onComplete?: (results: string[]) => void
      onError?: (error: string) => void
    }
  ) {
    switch (message.type) {
      case 'progress':
        if (callbacks.onProgress && message.data.prompt_id) {
          const progress: ComfyUIProgress = {
            promptId: message.data.prompt_id,
            nodeId: message.data.node,
            value: message.data.value || 0,
            max: message.data.max || 100,
            percentage: Math.round(((message.data.value || 0) / (message.data.max || 100)) * 100),
            status: 'executing'
          }
          callbacks.onProgress(progress)
        }
        break

      case 'completed':
        if (callbacks.onComplete) {
          callbacks.onComplete(message.data.results || [])
        }
        break

      case 'failed':
        if (callbacks.onError) {
          callbacks.onError(message.data.error || '生成失败')
        }
        break
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
    }
  }

  /**
   * 关闭所有WebSocket连接
   */
  closeAllConnections() {
    this.wsConnections.forEach((ws) => {
      ws.close()
    })
    this.wsConnections.clear()
  }

  /**
   * 添加事件监听器
   */
  addEventListener(event: string, callback: (data: any) => void) {
    if (!this.eventListeners.has(event)) {
      this.eventListeners.set(event, [])
    }
    this.eventListeners.get(event)!.push(callback)
  }

  /**
   * 移除事件监听器
   */
  removeEventListener(event: string, callback: (data: any) => void) {
    const listeners = this.eventListeners.get(event)
    if (listeners) {
      const index = listeners.indexOf(callback)
      if (index > -1) {
        listeners.splice(index, 1)
      }
    }
  }

  /**
   * 触发事件
   */
  private
  emit(event: string, data: any) {
    const listeners = this.eventListeners.get(event)
    if (listeners) {
      listeners.forEach((callback) => callback(data))
    }
  }
}

// 单例实例
export const comfyUIClientService = new ComfyUIClientService()
