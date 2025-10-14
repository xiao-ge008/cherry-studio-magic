/**
 * 组件管理服务
 */

import { loggerService } from '@logger'
import {
  ComponentConfig,
  ComponentSettings,
  DEFAULT_COMPONENT_SETTINGS,
  ComfyUIComponentConfig,
  JSComponentConfig,
  JSComponentResult
} from '@renderer/types/component'
import { generateAIPrompt, validateComponentConfig } from '@renderer/utils/componentConfig'
import { exportComponentToJSON, getExportFileName } from '@renderer/utils/componentExport'
import store from '@renderer/store'
import {
  setComponentSettings,
  setComponentEnabled,
  updateComponentConfig,
  resetComponentConfig
} from '@renderer/store/settings'

const logger = loggerService.withContext('ComponentService')

export class ComponentService {
  private static instance: ComponentService

  public static getInstance(): ComponentService {
    if (!ComponentService.instance) {
      ComponentService.instance = new ComponentService()
    }
    return ComponentService.instance
  }

  /**
   * 获取所有组件配置
   */
  getComponentSettings(): ComponentSettings {
    const state = store.getState()
    return state.settings.componentSettings || DEFAULT_COMPONENT_SETTINGS
  }

  /**
   * 更新整个组件设置（用于导入或批量操作）
   */
  updateComponentSettings(settings: ComponentSettings) {
    store.dispatch(setComponentSettings(settings))
  }

  /**
   * 获取单个组件配置
   */
  getComponentConfig(id: string): ComponentConfig | null {
    const settings = this.getComponentSettings()
    return settings.components[id] || null
  }

  /**
   * 获取启用的组件列表
   */
  getEnabledComponents(): ComponentConfig[] {
    const settings = this.getComponentSettings()
    return Object.values(settings.components).filter((component) => component.enabled)
  }

  /**
   * 设置组件启用状态
   */
  setComponentEnabled(id: string, enabled: boolean): boolean {
    try {
      const config = this.getComponentConfig(id)
      if (!config) {
        logger.warn('Component not found', { data: id })
        return false
      }

      store.dispatch(setComponentEnabled({ id, enabled }))
      logger.info('Component enabled state updated', { data: { id, enabled } })
      return true
    } catch (error: unknown) {
      const err = error instanceof Error ? error : new Error(String(error))
      logger.error('Failed to set component enabled state', err)
      return false
    }
  }

  /**
   * 更新组件配置
   */
  updateComponentConfig(id: string, config: Partial<ComponentConfig>): boolean {
    try {
      const existingConfig = this.getComponentConfig(id)
      if (!existingConfig) {
        logger.warn('Component not found', { data: id })
        return false
      }

      // 验证更新后的配置
      const updatedConfig = { ...existingConfig, ...config }
      const validation = validateComponentConfig(updatedConfig)

      if (!validation.valid) {
        logger.warn('Invalid component config', { data: validation.errors })
        return false
      }

      store.dispatch(updateComponentConfig({ id, config }))
      logger.info('Component config updated', { data: { id, config } })
      return true
    } catch (error: unknown) {
      const err = error instanceof Error ? error : new Error(String(error))
      logger.error('Failed to update component config', err)
      return false
    }
  }

  /**
   * 重置组件配置为默认值
   */
  resetComponentConfig(id: string): boolean {
    try {
      const defaultConfig = DEFAULT_COMPONENT_SETTINGS.components[id]
      if (!defaultConfig) {
        logger.warn('Default config not found for component', { data: id })
        return false
      }

      store.dispatch(resetComponentConfig(id))
      logger.info('Component config reset to default', { data: id })
      return true
    } catch (error: unknown) {
      const err = error instanceof Error ? error : new Error(String(error))
      logger.error('Failed to reset component config', err)
      return false
    }
  }

  /**
   * 生成组件的AI提示词
   */
  generateComponentPrompt(
    id: string,
    options?: {
      includeExamples?: boolean
      includeParameterDetails?: boolean
      language?: 'zh-CN' | 'en-US'
      format?: 'markdown' | 'plain'
    }
  ): string | null {
    try {
      const config = this.getComponentConfig(id)
      if (!config) {
        logger.warn('Component not found', { data: id })
        return null
      }

      const prompt = generateAIPrompt(config, {
        includeExamples: true,
        includeParameterDetails: true,
        language: 'zh-CN',
        format: 'markdown',
        ...options
      })

      logger.info('Generated AI prompt for component', { data: id })
      return prompt
    } catch (error: unknown) {
      const err = error instanceof Error ? error : new Error(String(error))
      logger.error('Failed to generate component prompt', err)
      return null
    }
  }

  /**
   * 生成所有启用组件的AI提示词
   */
  generateAllComponentsPrompt(options?: {
    includeExamples?: boolean
    includeParameterDetails?: boolean
    language?: 'zh-CN' | 'en-US'
    format?: 'markdown' | 'plain'
  }): string {
    try {
      const enabledComponents = this.getEnabledComponents()
      const language = options?.language || 'zh-CN'
      const isZhCN = language === 'zh-CN'

      let prompt = ''

      if (options?.format === 'markdown') {
        prompt += `# ${isZhCN ? 'Cherry Studio 内置组件使用指南' : 'Cherry Studio Built-in Components Guide'}\n\n`
        prompt += `${isZhCN ? '以下是可用的内置组件及其使用方法：' : 'The following built-in components are available:'}\n\n`
      } else {
        prompt += `${isZhCN ? 'Cherry Studio 内置组件使用指南' : 'Cherry Studio Built-in Components Guide'}\n\n`
      }

      enabledComponents.forEach((component, index) => {
        if (index > 0) {
          prompt += '\n---\n\n'
        }
        prompt += this.generateComponentPrompt(component.id, options) || ''
      })

      logger.info('Generated AI prompt for all enabled components')
      return prompt
    } catch (error: unknown) {
      const err = error instanceof Error ? error : new Error(String(error))
      logger.error('Failed to generate all components prompt', err)
      return ''
    }
  }

  /**
   * 导出组件配置
   */
  /**
   * 导出单个组件
   */
  async exportComponent(componentId: string, type: 'js' | 'comfyui'): Promise<boolean> {
    try {
      const component = this.getComponentConfig(componentId)
      if (!component) {
        logger.warn('Component not found:', { componentId })
        return false
      }

      const payload = exportComponentToJSON(component, type)
      const defaultFileName = getExportFileName(component)

      await window.api.file.save(defaultFileName, payload, {
        filters: [{ name: 'JSON', extensions: ['json'] }]
      })

      logger.info('Component exported successfully', { componentId, type })
      return true
    } catch (error: unknown) {
      const err = error instanceof Error ? error : new Error(String(error))
      logger.error('Failed to export component', err, { componentId, type })
      return false
    }
  }

  exportComponentSettings(): string {
    try {
      const settings = this.getComponentSettings()
      return JSON.stringify(settings, null, 2)
    } catch (error: unknown) {
      const err = error instanceof Error ? error : new Error(String(error))
      logger.error('Failed to export component settings', err)
      return ''
    }
  }

  /**
   * 导入组件配置
   */
  importComponentSettings(jsonString: string): boolean {
    try {
      const settings = JSON.parse(jsonString) as ComponentSettings

      // 基础验证
      if (!settings.components || typeof settings.components !== 'object') {
        logger.warn('Invalid component settings format')
        return false
      }

      // 验证每个组件配置
      for (const [id, config] of Object.entries(settings.components)) {
        const validation = validateComponentConfig(config)
        if (!validation.valid) {
          logger.warn('Invalid component config during import', { data: { id, errors: validation.errors } })
          return false
        }
      }

      store.dispatch(setComponentSettings(settings))
      logger.info('Component settings imported successfully')
      return true
    } catch (error: unknown) {
      const err = error instanceof Error ? error : new Error(String(error))
      logger.error('Failed to import component settings', err)
      return false
    }
  }

  /**
   * 复制文本到剪贴板
   */
  async copyToClipboard(text: string): Promise<boolean> {
    try {
      await navigator.clipboard.writeText(text)
      logger.info('Text copied to clipboard')
      return true
    } catch (error: unknown) {
      const err = error instanceof Error ? error : new Error(String(error))
      logger.error('Failed to copy to clipboard', err)
      return false
    }
  }

  /**
   * 保存文本为文件
   */
  async saveAsFile(content: string, filename: string): Promise<boolean> {
    try {
      // 使用 window.api 保存文件
      const filePath = await window.api.file.save(filename, content, {
        filters: [
          { name: 'Markdown Files', extensions: ['md'] },
          { name: 'Text Files', extensions: ['txt'] },
          { name: 'JSON Files', extensions: ['json'] },
          { name: 'All Files', extensions: ['*'] }
        ]
      })

      if (filePath) {
        logger.info('File saved successfully', { data: filePath })
        return true
      } else {
        logger.warn('File save cancelled')
        return false
      }
    } catch (error: unknown) {
      const err = error instanceof Error ? error : new Error(String(error))
      logger.error('Failed to save file', err)
      return false
    }
  }

  /**
   * 检查组件是否可用
   */
  isComponentAvailable(id: string): boolean {
    const config = this.getComponentConfig(id)
    return config ? config.enabled : false
  }

  /**
   * 获取组件统计信息
   */
  getComponentStats(): {
    total: number
    enabled: number
    disabled: number
    byCategory: Record<string, number>
  } {
    const settings = this.getComponentSettings()
    const components = Object.values(settings.components)

    const stats = {
      total: components.length,
      enabled: components.filter((c) => c.enabled).length,
      disabled: components.filter((c) => !c.enabled).length,
      byCategory: {} as Record<string, number>
    }

    components.forEach((component) => {
      stats.byCategory[component.category] = (stats.byCategory[component.category] || 0) + 1
    })

    return stats
  }

  /**
   * 注册ComfyUI组件
   */
  registerComfyUIComponent(component: ComfyUIComponentConfig): boolean {
    try {
      // 验证组件配置
      const validation = validateComponentConfig(component)
      if (!validation.valid) {
        logger.warn('Invalid ComfyUI component config', { data: validation.errors })
        return false
      }

      // 检查组件ID是否已存在
      const existingConfig = this.getComponentConfig(component.id)
      if (existingConfig) {
        logger.warn('ComfyUI component already exists', { data: component.id })
        return false
      }

      // 添加到组件配置中
      const settings = this.getComponentSettings()
      const updatedSettings: ComponentSettings = {
        ...settings,
        components: {
          ...settings.components,
          [component.id]: component
        },
        lastUpdated: Date.now()
      }

      store.dispatch(setComponentSettings(updatedSettings))
      logger.info('ComfyUI component registered successfully', { data: component.id })
      return true
    } catch (error: unknown) {
      const err = error instanceof Error ? error : new Error(String(error))
      logger.error('Failed to register ComfyUI component', err)
      return false
    }
  }

  /**
   * 获取ComfyUI组件列表
   */
  getComfyUIComponents(): ComfyUIComponentConfig[] {
    const settings = this.getComponentSettings()
    const existingComponents = Object.values(settings.components).filter(
      (component): component is ComfyUIComponentConfig => component.category === 'comfyui'
    )

    // 不再自动创建演示组件，让用户自己创建适合其环境的组件

    return existingComponents
  }

  /**
   * 创建演示用的ComfyUI组件
   */
  /**
   * 同步ComfyUI组件（从后端获取最新组件列表）
   */
  async syncComfyUIComponents(): Promise<boolean> {
    try {
      // 暂时跳过后端同步，直接返回成功
      // TODO: 实现真正的后端同步
      logger.info('ComfyUI components sync skipped (using local storage only)')
      return true
    } catch (error: unknown) {
      const err = error instanceof Error ? error : new Error(String(error))
      logger.error('Failed to sync ComfyUI components', err)
      return false
    }
  }

  /**
   * 删除ComfyUI组件
   */
  async deleteComfyUIComponent(id: string): Promise<boolean> {
    try {
      // 从后端删除
      await window.api.comfyui.deleteComponent(id)

      // 从本地配置中删除
      const settings = this.getComponentSettings()
      const updatedComponents = { ...settings.components }
      delete updatedComponents[id]

      const updatedSettings: ComponentSettings = {
        ...settings,
        components: updatedComponents,
        lastUpdated: Date.now()
      }

      store.dispatch(setComponentSettings(updatedSettings))
      logger.info('ComfyUI component deleted successfully', { data: id })
      return true
    } catch (error: unknown) {
      const err = error instanceof Error ? error : new Error(String(error))
      logger.error('Failed to delete ComfyUI component', err)
      return false
    }
  }

  /**
   * 检查组件名是否可用
   */
  isComponentNameAvailable(componentName: string): boolean {
    const components = this.getComfyUIComponents()
    return !components.some((component) => component.componentName === componentName)
  }

  /**
   * 诊断ComfyUI组件问题
   */
  async diagnoseComfyUIComponent(componentName: string): Promise<{
    componentExists: boolean
    componentConfig?: ComfyUIComponentConfig
    issues: string[]
    suggestions: string[]
    allComponents: Array<{ name: string; componentName: string; enabled: boolean }>
  }> {
    const issues: string[] = []
    const suggestions: string[] = []

    // 获取所有组件
    const components = this.getComfyUIComponents()
    const allComponents = components.map((c) => ({
      name: c.name,
      componentName: c.componentName,
      enabled: c.enabled
    }))

    // 查找指定组件
    const component = components.find((c) => c.componentName === componentName)

    if (!component) {
      issues.push(`组件 "${componentName}" 不存在`)
      suggestions.push('请检查组件名称是否正确')

      if (components.length > 0) {
        const availableNames = components.map((c) => c.componentName).join(', ')
        suggestions.push(`可用的组件: ${availableNames}`)
      } else {
        suggestions.push('当前没有可用的ComfyUI组件，请先创建组件')
      }

      return {
        componentExists: false,
        issues,
        suggestions,
        allComponents
      }
    }

    // 检查组件配置
    if (!component.enabled) {
      issues.push('组件已禁用')
      suggestions.push('请在设置中启用该组件')
    }

    if (!component.serverUrl) {
      issues.push('组件缺少服务器URL配置')
      suggestions.push('请配置ComfyUI服务器地址')
    }

    if (!component.workflowTemplate || Object.keys(component.workflowTemplate).length === 0) {
      issues.push('组件缺少工作流模板')
      suggestions.push('请上传并配置工作流JSON文件')
    }

    if (!component.parameters || component.parameters.length === 0) {
      issues.push('组件缺少参数配置')
      suggestions.push('请配置组件参数')
    }

    return {
      componentExists: true,
      componentConfig: component,
      issues,
      suggestions,
      allComponents
    }
  }

  // ==================== JS组件管理方法 ====================

  /**
   * 获取JS组件列表
   */
  getJSComponents(): JSComponentConfig[] {
    const settings = this.getComponentSettings()
    return Object.values(settings.components).filter(
      (component): component is JSComponentConfig => component.category === 'javascript'
    )
  }

  /**
   * 注册JS组件
   */
  registerJSComponent(component: JSComponentConfig): boolean {
    try {
      // 验证组件配置
      const validation = validateComponentConfig(component)
      if (!validation.valid) {
        logger.warn('Invalid JS component config', { errors: validation.errors })
        return false
      }

      // 检查组件ID是否已存在
      const existingConfig = this.getComponentConfig(component.id)
      if (existingConfig) {
        logger.warn('JS component already exists', { componentId: component.id })
        return false
      }

      // 添加到组件配置中
      const settings = this.getComponentSettings()
      const updatedSettings: ComponentSettings = {
        ...settings,
        components: {
          ...settings.components,
          [component.id]: component
        },
        lastUpdated: Date.now()
      }

      store.dispatch(setComponentSettings(updatedSettings))
      logger.info('JS component registered successfully', { componentId: component.id })
      return true
    } catch (error: unknown) {
      const err = error instanceof Error ? error : new Error(String(error))
      logger.error('Failed to register JS component', err)
      return false
    }
  }

  /**
   * 同步JS组件（从后端获取最新组件列表）
   */
  async syncJSComponents(): Promise<boolean> {
    try {
      const components = await window.api.jscomponent.getComponents()

      // 更新本地配置
      const settings = this.getComponentSettings()
      const updatedComponents = { ...settings.components }

      // 移除旧的JS组件
      Object.keys(updatedComponents).forEach((id) => {
        if (updatedComponents[id].category === 'javascript') {
          delete updatedComponents[id]
        }
      })

      // 添加新的JS组件
      components.forEach((component) => {
        updatedComponents[component.id] = component
      })

      const updatedSettings: ComponentSettings = {
        ...settings,
        components: updatedComponents,
        lastUpdated: Date.now()
      }

      store.dispatch(setComponentSettings(updatedSettings))
      logger.info('JS components synced successfully', { count: components.length })
      return true
    } catch (error: unknown) {
      const err = error instanceof Error ? error : new Error(String(error))
      logger.error('Failed to sync JS components', err)
      return false
    }
  }

  /**
   * 删除JS组件
   */
  async deleteJSComponent(id: string): Promise<boolean> {
    try {
      // 从后端删除
      await window.api.jscomponent.deleteComponent(id)

      // 从本地配置中删除
      const settings = this.getComponentSettings()
      const updatedComponents = { ...settings.components }
      delete updatedComponents[id]

      const updatedSettings: ComponentSettings = {
        ...settings,
        components: updatedComponents,
        lastUpdated: Date.now()
      }

      store.dispatch(setComponentSettings(updatedSettings))
      logger.info('JS component deleted successfully', { data: id })
      return true
    } catch (error: unknown) {
      const err = error instanceof Error ? error : new Error(String(error))
      logger.error('Failed to delete JS component', err)
      return false
    }
  }

  /**
   * 检查JS组件名是否可用
   */
  isJSComponentNameAvailable(componentName: string): boolean {
    const components = this.getJSComponents()
    return !components.some((component) => component.componentName === componentName)
  }

  /**
   * 执行JS组件
   */
  async executeJSComponent(componentId: string, parameters: Record<string, any>): Promise<JSComponentResult> {
    try {
      return await window.api.jscomponent.execute(componentId, parameters)
    } catch (error: unknown) {
      const err = error instanceof Error ? error : new Error(String(error))
      logger.error('Failed to execute JS component', err)
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
        type: 'text',
        executionTime: 0
      }
    }
  }
}

// 导出单例实例
export const componentService = ComponentService.getInstance()

// 在开发环境下暴露到全局作用域以便调试
if (import.meta.env.DEV) {
  ;(window as any).componentService = componentService
}
