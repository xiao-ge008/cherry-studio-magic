/**
 * 主进程组件查找服务
 * 提供在主进程中查找和管理ComfyUI组件配置的功能
 */

import { loggerService } from '@logger'

import type { ComfyUIComponentConfig } from '../../renderer/src/types/component'

const logger = loggerService.withContext('ComponentLookupService')

export class ComponentLookupService {
  private static instance: ComponentLookupService
  private componentsCache: Map<string, ComfyUIComponentConfig> = new Map()
  private lastCacheUpdate: number = 0
  private readonly CACHE_TTL = 30000 // 30秒缓存

  public static getInstance(): ComponentLookupService {
    if (!ComponentLookupService.instance) {
      ComponentLookupService.instance = new ComponentLookupService()
    }
    return ComponentLookupService.instance
  }

  /**
   * 通过组件名查找组件配置
   */
  async findComponentByName(componentName: string): Promise<ComfyUIComponentConfig | null> {
    try {
      // 检查缓存是否需要更新
      await this.updateCacheIfNeeded()

      // 从缓存中查找
      const component = Array.from(this.componentsCache.values()).find(
        (comp) => comp.componentName === componentName && comp.enabled
      )

      if (!component) {
        logger.warn('Component not found or disabled', { componentName })
        return null
      }

      logger.verbose('Component found', {
        componentName,
        componentId: component.id,
        outputType: component.outputType
      })

      return component
    } catch (error) {
      logger.error('Failed to find component', error as Error, { componentName })
      return null
    }
  }

  /**
   * 获取所有启用的ComfyUI组件
   */
  async getEnabledComponents(): Promise<ComfyUIComponentConfig[]> {
    try {
      await this.updateCacheIfNeeded()
      return Array.from(this.componentsCache.values()).filter((comp) => comp.enabled)
    } catch (error) {
      logger.error('Failed to get enabled components', error as Error)
      return []
    }
  }

  /**
   * 验证组件名格式
   */
  validateComponentName(componentName: string): boolean {
    // 只允许字母、数字、连字符和下划线
    const validPattern = /^[a-zA-Z0-9_-]+$/
    return validPattern.test(componentName) && componentName.length > 0 && componentName.length <= 50
  }

  /**
   * 更新组件缓存
   */
  async updateCache(): Promise<void> {
    try {
      logger.info('Starting component cache update...')

      // 这里需要从渲染进程获取组件配置
      // 由于主进程无法直接访问Redux store，我们需要通过IPC获取
      const components = await this.fetchComponentsFromRenderer()

      logger.info('Received components from renderer', {
        totalCount: components.length,
        comfyUICount: components.filter((c) => c.category === 'comfyui').length
      })

      this.componentsCache.clear()
      components.forEach((component) => {
        if (component.category === 'comfyui') {
          logger.verbose('Adding ComfyUI component to cache', {
            id: component.id,
            name: component.componentName,
            enabled: component.enabled
          })
          this.componentsCache.set(component.id, component as ComfyUIComponentConfig)
        }
      })

      this.lastCacheUpdate = Date.now()
      logger.info('Component cache updated', {
        count: this.componentsCache.size,
        components: Array.from(this.componentsCache.values()).map((c) => ({
          name: c.componentName,
          enabled: c.enabled
        }))
      })
    } catch (error) {
      logger.error('Failed to update component cache', error as Error)
    }
  }

  /**
   * 如果需要则更新缓存
   */
  private async updateCacheIfNeeded(): Promise<void> {
    const now = Date.now()
    if (now - this.lastCacheUpdate > this.CACHE_TTL || this.componentsCache.size === 0) {
      await this.updateCache()
    }
  }

  /**
   * 从渲染进程获取组件配置
   * 通过广播消息获取组件配置
   */
  private async fetchComponentsFromRenderer(): Promise<any[]> {
    try {
      logger.info('Fetching components from renderer process...')

      // 使用IPC通道获取组件
      const { ipcMain } = await import('electron')

      return new Promise((resolve) => {
        const timeout = setTimeout(() => {
          logger.error(
            '🚨 Component sync timeout after 10 seconds - this indicates IPC communication failure in production'
          )

        }, 10000) // 延长到10秒

        // 监听响应 - 使用ipcMain监听来自渲染进程的消息
        const handleResponse = (_event: any, components: any[]) => {
          clearTimeout(timeout)
          ipcMain.off('comfyui-components-response', handleResponse)

          logger.info('Received IPC response from renderer', {
            componentsReceived: components?.length || 0,
            hasVerticalPainting:
              components?.some((c) => c.category === 'comfyui' && c.componentName === 'verticalPainting') || false
          })

          resolve(components || [])
        }

        ipcMain.once('comfyui-components-response', handleResponse)

        // 发送请求到渲染进程
        logger.info('Sending comfyui-components-request to renderer...')

        // 获取主窗口并发送消息
        import('./WindowService')
          .then(({ windowService }) => {
            const mainWindow = windowService.getMainWindow()
            if (mainWindow) {
              logger.info('📤 Sending comfyui-components-request to main window', {
                windowId: mainWindow.id,
                isDestroyed: mainWindow.isDestroyed(),
                isVisible: mainWindow.isVisible(),
                webContentsId: mainWindow.webContents.id
              })
              mainWindow.webContents.send('comfyui-components-request')
            } else {
              logger.error('❌ Main window not available for component sync')
              clearTimeout(timeout)
              ipcMain.off('comfyui-components-response', handleResponse)
              resolve([])
            }
          })
          .catch((error) => {
            logger.error('Failed to get window service', error as Error)
            clearTimeout(timeout)
            ipcMain.off('comfyui-components-response', handleResponse)
            resolve([])
          })
      })
    } catch (error) {
      logger.error('Failed to fetch components from renderer', error as Error)
      return []
    }
  }

  /**
   * 清除缓存
   */
  clearCache(): void {
    this.componentsCache.clear()
    this.lastCacheUpdate = 0
    logger.info('Component cache cleared')
  }

  /**
   * 获取缓存统计信息
   */
  getCacheStats(): {
    size: number
    lastUpdate: number
    age: number
  } {
    return {
      size: this.componentsCache.size,
      lastUpdate: this.lastCacheUpdate,
      age: Date.now() - this.lastCacheUpdate
    }
  }
}

// 导出单例实例
export const componentLookupService = ComponentLookupService.getInstance()
