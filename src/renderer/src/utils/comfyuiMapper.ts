/**
 * ComfyUI参数映射工具
 * 负责组件参数到工作流节点的映射和数据转换
 */

import type { ComfyUIComponentConfig, ComponentParameter } from '../types/component'
import type { ComfyUIWorkflow } from '../types/comfyui'
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
 * 参数映射器类
 */
export class ComfyUIParameterMapper {
  /**
   * 将组件参数映射到工作流节点
   */
  static mapParametersToWorkflow(component: ComfyUIComponentConfig, parameters: Record<string, any>): ComfyUIWorkflow {
    // 深拷贝工作流模板
    const workflow = JSON.parse(JSON.stringify(component.workflowTemplate))

    // 应用参数绑定
    component.nodeBindings.forEach((binding) => {
      const paramValue = parameters[binding.parameterName]
      if (paramValue !== undefined) {
        try {
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

            console.log('应用动态前缀/后缀', {
              parameter: binding.parameterName,
              original: paramValue,
              prefix: prefixValue,
              suffix: suffixValue,
              final: transformedValue
            })
          }

          // 应用数据转换
          transformedValue = this.applyTransform(transformedValue, binding.transform)

          // 设置节点参数值
          if (workflow[binding.nodeId] && workflow[binding.nodeId].inputs) {
            workflow[binding.nodeId].inputs[binding.inputField] = transformedValue
          }
        } catch (error) {
          console.warn(`参数映射失败: ${binding.parameterName}`, error)
        }
      }
    })

    return workflow
  }

  /**
   * 应用数据转换
   */
  private static applyTransform(value: any, transform?: string): any {
    if (!transform) return value

    try {
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
        case 'trim':
          return String(value).trim()
        case 'boolean':
          return Boolean(value)
        case 'json':
          return typeof value === 'string' ? JSON.parse(value) : value
        default:
          // 如果是自定义转换函数，可以在这里扩展
          return value
      }
    } catch (error) {
      console.warn(`数据转换失败: ${transform}`, error)
      return value
    }
  }

  /**
   * 验证参数值
   */
  static validateParameters(
    component: ComfyUIComponentConfig,
    parameters: Record<string, any>
  ): { valid: boolean; errors: string[] } {
    const errors: string[] = []

    // 检查必需参数
    component.parameters.forEach((param) => {
      if (param.required && (parameters[param.name] === undefined || parameters[param.name] === '')) {
        errors.push(`参数 ${param.name} 是必需的`)
      }

      // 类型验证
      const value = parameters[param.name]
      if (value !== undefined) {
        const typeError = this.validateParameterType(param, value)
        if (typeError) {
          errors.push(typeError)
        }
      }
    })

    return { valid: errors.length === 0, errors }
  }

  /**
   * 验证参数类型
   */
  private static validateParameterType(param: ComponentParameter, value: any): string | null {
    switch (param.type) {
      case 'string':
        if (typeof value !== 'string') {
          return `参数 ${param.name} 必须是字符串类型`
        }
        break
      case 'number':
        if (typeof value !== 'number' && isNaN(Number(value))) {
          return `参数 ${param.name} 必须是数字类型`
        }
        break
      case 'boolean':
        if (typeof value !== 'boolean' && value !== 'true' && value !== 'false') {
          return `参数 ${param.name} 必须是布尔类型`
        }
        break
      case 'url':
        if (typeof value === 'string') {
          try {
            new URL(value)
          } catch {
            return `参数 ${param.name} 必须是有效的URL`
          }
        }
        break
      case 'json':
        if (typeof value === 'string') {
          try {
            JSON.parse(value)
          } catch {
            return `参数 ${param.name} 必须是有效的JSON字符串`
          }
        }
        break
    }

    // 正则验证
    if (param.validation && typeof value === 'string') {
      try {
        const regex = new RegExp(param.validation)
        if (!regex.test(value)) {
          return `参数 ${param.name} 格式不正确`
        }
      } catch {
        console.warn(`无效的正则表达式: ${param.validation}`)
      }
    }

    return null
  }

  /**
   * 生成参数表单配置
   */
  static generateFormConfig(component: ComfyUIComponentConfig) {
    return component.parameters.map((param) => ({
      name: param.name,
      label: param.description || param.name,
      type: param.type,
      required: param.required,
      defaultValue: param.defaultValue,
      placeholder: param.example || '',
      validation: param.validation,
      options: this.getParameterOptions(param)
    }))
  }

  /**
   * 获取参数选项（用于下拉框等）
   */
  private static getParameterOptions(param: ComponentParameter): string[] | undefined {
    // 根据参数名称和类型推断可能的选项
    const optionsMap: Record<string, string[]> = {
      sampler_name: [
        'euler',
        'euler_ancestral',
        'heun',
        'dpm_2',
        'dpm_2_ancestral',
        'lms',
        'dpm_fast',
        'dpm_adaptive',
        'dpmpp_2s_ancestral',
        'dpmpp_sde',
        'dpmpp_2m',
        'ddim',
        'uni_pc',
        'uni_pc_bh2'
      ],
      scheduler: ['normal', 'karras', 'exponential', 'sgm_uniform', 'simple', 'ddim_uniform'],
      upscale_method: ['nearest-exact', 'bilinear', 'area', 'bicubic', 'lanczos'],
      interpolation: ['nearest', 'linear', 'bilinear', 'bicubic', 'trilinear', 'area', 'nearest-exact']
    }

    return optionsMap[param.name]
  }

  /**
   * 生成参数默认值
   */
  static generateDefaultParameters(component: ComfyUIComponentConfig): Record<string, any> {
    const defaults: Record<string, any> = {}

    component.parameters.forEach((param) => {
      if (param.defaultValue !== undefined) {
        defaults[param.name] = param.defaultValue
      } else {
        // 根据类型生成默认值
        switch (param.type) {
          case 'string':
            defaults[param.name] = ''
            break
          case 'number':
            defaults[param.name] = 0
            break
          case 'boolean':
            defaults[param.name] = false
            break
          case 'url':
            defaults[param.name] = ''
            break
          case 'json':
            defaults[param.name] = '{}'
            break
        }
      }
    })

    return defaults
  }
}

/**
 * 参数类型转换工具
 */
export class ParameterConverter {
  /**
   * 将表单值转换为API参数
   */
  static convertFormToApiParameters(
    formValues: Record<string, any>,
    component: ComfyUIComponentConfig
  ): Record<string, any> {
    const apiParameters: Record<string, any> = {}

    component.parameters.forEach((param) => {
      const value = formValues[param.name]
      if (value !== undefined && value !== '') {
        apiParameters[param.name] = this.convertValue(value, param.type)
      }
    })

    return apiParameters
  }

  /**
   * 转换单个值
   */
  private static convertValue(value: any, type: string): any {
    switch (type) {
      case 'number':
        return Number(value)
      case 'boolean':
        return value === true || value === 'true'
      case 'json': {
        if (typeof value === 'string') {
          // 使用统一的JSON解析工具
          return parseJsonSimple(value, 'comfyui-param', true)
        }
        return value
      }
      default:
        return value
    }
  }

  /**
   * 将API参数转换为表单值
   */
  static convertApiToFormParameters(
    apiParameters: Record<string, any>,
    component: ComfyUIComponentConfig
  ): Record<string, any> {
    const formValues: Record<string, any> = {}

    component.parameters.forEach((param) => {
      const value = apiParameters[param.name]
      if (value !== undefined) {
        formValues[param.name] = this.convertToFormValue(value, param.type)
      }
    })

    return formValues
  }

  /**
   * 转换为表单值
   */
  private static convertToFormValue(value: any, type: string): any {
    switch (type) {
      case 'json':
        return typeof value === 'object' ? JSON.stringify(value, null, 2) : String(value)
      case 'boolean':
        return Boolean(value)
      default:
        return String(value)
    }
  }
}
