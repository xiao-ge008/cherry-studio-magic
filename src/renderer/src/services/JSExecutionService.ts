import { JSComponentConfig, JSComponentResult, JSComponentOutputType } from '@renderer/types/component'

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

/**
 * JS组件参数解析器
 */
class JSComponentParameterParser {
  static parseParameter(value: any, type: string): any {
    switch (type) {
      case 'string':
        return String(value)
      case 'number':
        return Number(value)
      case 'boolean':
        return Boolean(value)
      case 'json': {
        // 使用统一的JSON解析工具
        return parseJsonSimple(value, 'json-param', true)
      }
      default:
        return value
    }
  }
}

/**
 * JS组件执行服务
 */
export class JSExecutionService {
  private static instance: JSExecutionService

  static getInstance(): JSExecutionService {
    if (!JSExecutionService.instance) {
      JSExecutionService.instance = new JSExecutionService()
    }
    return JSExecutionService.instance
  }

  /**
   * 执行JS组件
   */
  async executeComponent(
    componentConfig: JSComponentConfig,
    parameters: Record<string, any>
  ): Promise<JSComponentResult> {
    const startTime = Date.now()

    try {
      // 1. 解析参数
      const parsedParams = this.parseParameters(parameters, componentConfig.parameters)

      // 2. 执行JS代码
      const result = await this.executeJS(componentConfig.jsCode, parsedParams, componentConfig.timeout || 5000)

      // 3. 处理返回结果
      const processedResult = this.processResult(result, componentConfig.outputType)

      return {
        success: true,
        output: processedResult.output,
        type: processedResult.type,
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
   * 解析参数
   */
  private parseParameters(parameters: Record<string, any>, paramConfigs: any[]): Record<string, any> {
    const parsed: Record<string, any> = {}

    for (const config of paramConfigs) {
      const value = parameters[config.name]
      if (value !== undefined) {
        parsed[config.name] = JSComponentParameterParser.parseParameter(value, config.type)
      } else if (config.required) {
        throw new Error(`Required parameter missing: ${config.name}`)
      } else if (config.defaultValue !== undefined) {
        parsed[config.name] = config.defaultValue
      }
    }

    return parsed
  }

  /**
   * 安全执行JS代码
   */
  private async executeJS(jsCode: string, parameters: Record<string, any>, timeout: number): Promise<any> {
    return new Promise((resolve, reject) => {
      // 设置超时
      const timeoutId = setTimeout(() => {
        reject(new Error(`Execution timeout after ${timeout}ms`))
      }, timeout)

      try {
        // 创建安全的执行环境
        const sandbox = this.createSandbox(parameters)

        // 创建安全的执行函数
        const func = new Function(
          ...Object.keys(sandbox),
          `
          "use strict";
          try {
            ${jsCode}
          } catch (error) {
            throw error;
          }
        `
        )

        // 执行代码
        const result = func(...Object.values(sandbox))

        clearTimeout(timeoutId)
        resolve(result)
      } catch (error) {
        clearTimeout(timeoutId)
        reject(error)
      }
    })
  }

  /**
   * 创建安全的执行沙箱
   */
  private createSandbox(parameters: Record<string, any>): Record<string, any> {
    return {
      // 用户参数
      ...parameters,

      // 安全的工具函数
      JSON: JSON,
      Math: Math,
      Date: Date,
      console: {
        log: (...args: any[]) => console.log('[JS Component]', ...args),
        warn: (...args: any[]) => console.warn('[JS Component]', ...args),
        error: (...args: any[]) => console.error('[JS Component]', ...args)
      },

      // HTML工具函数
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
        }),

      // 禁用危险API
      fetch: undefined,
      XMLHttpRequest: undefined,
      eval: undefined,
      Function: undefined,
      setTimeout: undefined,
      setInterval: undefined,
      clearTimeout: undefined,
      clearInterval: undefined
    }
  }

  /**
   * 处理执行结果
   */
  private processResult(
    result: any,
    expectedType: JSComponentOutputType
  ): { output: string; type: JSComponentOutputType } {
    // 如果返回的是对象且包含type和content
    if (result && typeof result === 'object') {
      if (result.type === 'html' && result.content) {
        return {
          output: String(result.content),
          type: 'html'
        }
      }

      if (result.type === 'text' && result.content) {
        return {
          output: String(result.content),
          type: 'text'
        }
      }
    }

    // 根据期望的输出类型处理
    if (expectedType === 'html') {
      return {
        output: String(result || ''),
        type: 'html'
      }
    }

    // 默认作为文本处理
    if (typeof result === 'object') {
      return {
        output: JSON.stringify(result, null, 2),
        type: 'text'
      }
    }

    return {
      output: String(result || ''),
      type: 'text'
    }
  }

  /**
   * 验证JS代码语法
   */
  validateJSCode(jsCode: string): { valid: boolean; error?: string } {
    try {
      new Function(jsCode)
      return { valid: true }
    } catch (error) {
      return {
        valid: false,
        error: error instanceof Error ? error.message : String(error)
      }
    }
  }
}

export const jsExecutionService = JSExecutionService.getInstance()
