import { JSComponentConfig, JSComponentResult } from '../../renderer/src/types/component'
// 内联JSON解析函数
function parseJsonSimple(value: any, paramName = 'unknown', debug = false): any {
  if (!value) return {}
  if (typeof value === 'object') return value

  if (typeof value === 'string') {
    // 1. URL解码
    try {
      const decoded = decodeURIComponent(value)
      const parsed = JSON.parse(decoded)
      if (debug) console.log(`[JSON Parser] URL解码成功 ${paramName}:`, parsed)
      return parsed
    } catch (e) {
      if (debug) console.warn(`[JSON Parser] URL解码失败 ${paramName}:`, (e as Error).message)
    }

    // 2. HTML实体解码
    try {
      const htmlDecoded = value
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'")
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&amp;/g, '&')
      const parsed = JSON.parse(htmlDecoded)
      if (debug) console.log(`[JSON Parser] HTML解码成功 ${paramName}:`, parsed)
      return parsed
    } catch (e) {
      if (debug) console.warn(`[JSON Parser] HTML解码失败 ${paramName}:`, (e as Error).message)
    }

    // 3. 直接解析
    try {
      const parsed = JSON.parse(value)
      if (debug) console.log(`[JSON Parser] 直接解析成功 ${paramName}:`, parsed)
      return parsed
    } catch (e) {
      if (debug) console.warn(`[JSON Parser] 直接解析失败 ${paramName}:`, (e as Error).message)
    }

    // 4. 单引号转换
    try {
      const fixedJson = value.replace(/'/g, '"')
      const parsed = JSON.parse(fixedJson)
      if (debug) console.log(`[JSON Parser] 单引号转换成功 ${paramName}:`, parsed)
      return parsed
    } catch (e) {
      if (debug) console.error(`[JSON Parser] 所有解析都失败 ${paramName}:`, (e as Error).message)
    }
  }

  return {}
}
import { app } from 'electron'
import path from 'path'
import fs from 'fs'

/**
 * 后端JS组件服务
 */
export class JSComponentService {
  private static instance: JSComponentService
  private componentsPath: string

  constructor() {
    this.componentsPath = path.join(app.getPath('userData'), 'js-components.json')
  }

  static getInstance(): JSComponentService {
    if (!JSComponentService.instance) {
      JSComponentService.instance = new JSComponentService()
    }
    return JSComponentService.instance
  }

  /**
   * 获取所有JS组件
   */
  async getComponents(): Promise<JSComponentConfig[]> {
    try {
      if (!fs.existsSync(this.componentsPath)) {
        return []
      }

      const data = fs.readFileSync(this.componentsPath, 'utf-8')
      const components = JSON.parse(data)
      return Array.isArray(components) ? components : []
    } catch (error) {
      console.error('Failed to load JS components:', error)
      return []
    }
  }

  /**
   * 保存JS组件
   */
  async saveComponents(components: JSComponentConfig[]): Promise<void> {
    try {
      fs.writeFileSync(this.componentsPath, JSON.stringify(components, null, 2), 'utf-8')
    } catch (error) {
      console.error('Failed to save JS components:', error)
      throw new Error('Failed to save JS components')
    }
  }

  /**
   * 创建JS组件
   */
  async createComponent(component: JSComponentConfig): Promise<JSComponentConfig> {
    const components = await this.getComponents()

    // 检查ID是否已存在
    if (components.find((c) => c.id === component.id)) {
      throw new Error(`Component with ID ${component.id} already exists`)
    }

    // 检查组件名是否已存在
    if (components.find((c) => c.componentName === component.componentName)) {
      throw new Error(`Component with name ${component.componentName} already exists`)
    }

    // 添加组件
    components.push({
      ...component,
      builtin: false,
      version: component.version || '1.0.0'
    })

    await this.saveComponents(components)
    return component
  }

  /**
   * 更新JS组件
   */
  async updateComponent(componentId: string, updates: Partial<JSComponentConfig>): Promise<JSComponentConfig> {
    const components = await this.getComponents()
    const index = components.findIndex((c) => c.id === componentId)

    if (index === -1) {
      throw new Error(`Component with ID ${componentId} not found`)
    }

    // 如果更新组件名，检查是否与其他组件冲突
    if (updates.componentName && updates.componentName !== components[index].componentName) {
      const existing = components.find((c) => c.componentName === updates.componentName && c.id !== componentId)
      if (existing) {
        throw new Error(`Component with name ${updates.componentName} already exists`)
      }
    }

    // 更新组件
    components[index] = {
      ...components[index],
      ...updates
    }

    await this.saveComponents(components)
    return components[index]
  }

  /**
   * 删除JS组件
   */
  async deleteComponent(componentId: string): Promise<void> {
    const components = await this.getComponents()
    const index = components.findIndex((c) => c.id === componentId)

    if (index === -1) {
      throw new Error(`Component with ID ${componentId} not found`)
    }

    // 不允许删除内置组件
    if (components[index].builtin) {
      throw new Error('Cannot delete builtin component')
    }

    components.splice(index, 1)
    await this.saveComponents(components)
  }

  /**
   * 根据ID获取组件
   */
  async getComponentById(componentId: string): Promise<JSComponentConfig | null> {
    const components = await this.getComponents()
    return components.find((c) => c.id === componentId) || null
  }

  /**
   * 根据组件名获取组件
   */
  async getComponentByName(componentName: string): Promise<JSComponentConfig | null> {
    const components = await this.getComponents()
    return components.find((c) => c.componentName === componentName) || null
  }

  /**
   * 执行JS组件（在主进程中执行）
   */
  async executeComponent(componentId: string, parameters: Record<string, any>): Promise<JSComponentResult> {
    const startTime = Date.now()

    try {
      const component = await this.getComponentById(componentId)
      if (!component) {
        throw new Error(`Component with ID ${componentId} not found`)
      }

      if (!component.enabled) {
        throw new Error(`Component ${componentId} is disabled`)
      }

      // 在主进程中执行JS代码（简化版本）
      const result = await this.executeJSInMainProcess(component, parameters)

      return {
        success: true,
        output: result.output,
        type: result.type,
        executionTime: Date.now() - startTime
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
        type: 'text',
        executionTime: Date.now() - startTime
      }
    }
  }

  /**
   * 在主进程中执行JS代码（简化版本）
   */
  private async executeJSInMainProcess(
    component: JSComponentConfig,
    parameters: Record<string, any>
  ): Promise<{ output: string; type: 'text' | 'html' }> {
    // 解析参数
    const parsedParams = this.parseParameters(parameters, component.parameters)

    // 创建安全的执行环境
    const sandbox = {
      ...parsedParams,
      JSON: JSON,
      Math: Math,
      Date: Date,
      console: {
        log: (...args: any[]) => console.log('[JS Component]', ...args),
        warn: (...args: any[]) => console.warn('[JS Component]', ...args),
        error: (...args: any[]) => console.error('[JS Component]', ...args)
      },
      escapeHtml: (str: string) =>
        str.replace(/[&<>"']/g, (m) => {
          const escapeMap: Record<string, string> = {
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            '"': '&quot;',
            "'": '&#39;'
          }
          return escapeMap[m] || m
        })
    }

    try {
      // 创建执行函数
      const func = new Function(
        ...Object.keys(sandbox),
        `
        "use strict";
        ${component.jsCode}
      `
      )

      // 执行代码
      const result = func(...Object.values(sandbox))

      // 处理结果
      if (result && typeof result === 'object') {
        if (result.type === 'html' && result.content) {
          return { output: String(result.content), type: 'html' }
        }
        if (result.type === 'text' && result.content) {
          return { output: String(result.content), type: 'text' }
        }
      }

      // 根据组件配置的输出类型处理
      if (component.outputType === 'html') {
        return { output: String(result || ''), type: 'html' }
      }

      // 默认作为文本处理
      if (typeof result === 'object') {
        return { output: JSON.stringify(result, null, 2), type: 'text' }
      }

      return { output: String(result || ''), type: 'text' }
    } catch (error) {
      throw new Error(`JS execution failed: ${error instanceof Error ? error.message : String(error)}`)
    }
  }

  /**
   * 解析参数
   */
  private parseParameters(parameters: Record<string, any>, paramConfigs: any[]): Record<string, any> {
    const parsed: Record<string, any> = {}

    for (const config of paramConfigs) {
      const value = parameters[config.name]
      if (value !== undefined) {
        parsed[config.name] = this.parseParameter(value, config.type)
      } else if (config.required) {
        throw new Error(`Required parameter missing: ${config.name}`)
      } else if (config.defaultValue !== undefined) {
        parsed[config.name] = config.defaultValue
      }
    }

    return parsed
  }

  /**
   * 解析单个参数
   */
  private parseParameter(value: any, type: string): any {
    switch (type) {
      case 'string':
        return String(value)
      case 'number':
        return Number(value)
      case 'boolean':
        return Boolean(value)
      case 'json': {
        // 使用统一的JSON解析工具
        const result = parseJsonSimple(value, 'json-param', true)
        return result
      }
      default:
        return value
    }
  }
}

export const jsComponentService = JSComponentService.getInstance()
