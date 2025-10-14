/**
 * 组件配置相关工具函数
 */

import {
  ComponentConfig,
  ComponentParameter,
  ComponentValidationResult,
  PromptGenerationOptions
} from '@renderer/types/component'

/**
 * 验证组件配置
 */
export function validateComponentConfig(config: ComponentConfig): ComponentValidationResult {
  const errors: string[] = []
  const warnings: string[] = []

  // 基础字段验证
  if (!config.id || config.id.trim() === '') {
    errors.push('组件ID不能为空')
  }

  if (!config.name || config.name.trim() === '') {
    errors.push('组件名称不能为空')
  }

  if (!config.description || config.description.trim() === '') {
    warnings.push('建议添加组件描述')
  }

  // 参数验证
  config.parameters.forEach((param, index) => {
    if (!param.name || param.name.trim() === '') {
      errors.push(`参数 ${index + 1} 的名称不能为空`)
    }

    if (!param.description || param.description.trim() === '') {
      warnings.push(`参数 "${param.name}" 建议添加描述`)
    }

    // URL类型验证
    if (param.type === 'url' && param.validation) {
      try {
        new RegExp(param.validation)
      } catch (e) {
        errors.push(`参数 "${param.name}" 的验证规则不是有效的正则表达式`)
      }
    }
  })

  return {
    valid: errors.length === 0,
    errors,
    warnings
  }
}

/**
 * 验证参数值
 */
export function validateParameterValue(parameter: ComponentParameter, value: any): boolean {
  if (parameter.required && (value === undefined || value === null || value === '')) {
    return false
  }

  if (value === undefined || value === null || value === '') {
    return true // 非必需参数可以为空
  }

  switch (parameter.type) {
    case 'string':
      return typeof value === 'string'
    case 'number':
      return typeof value === 'number' && !isNaN(value)
    case 'boolean':
      return typeof value === 'boolean' || value === 'true' || value === 'false'
    case 'url':
      if (typeof value !== 'string') return false
      if (parameter.validation) {
        try {
          const regex = new RegExp(parameter.validation)
          return regex.test(value)
        } catch (e) {
          return false
        }
      }
      try {
        new URL(value)
        return true
      } catch (e) {
        return false
      }
    case 'json':
      if (typeof value !== 'string') return false
      try {
        JSON.parse(value)
        return true
      } catch (e) {
        return false
      }
    default:
      return true
  }
}

/**
 * 生成AI提示词
 */
export function generateAIPrompt(
  config: ComponentConfig,
  options: PromptGenerationOptions = {
    includeExamples: true,
    includeParameterDetails: true,
    language: 'zh-CN',
    format: 'markdown'
  }
): string {
  const { includeExamples, includeParameterDetails, language, format } = options
  const isZhCN = language === 'zh-CN'

  let prompt = ''

  // ȷ�������ǩ��
  const maybeConfig: any = config
  const slug =
    typeof maybeConfig?.componentName === 'string' && maybeConfig.componentName.trim().length > 0
      ? maybeConfig.componentName.trim()
      : config.id

  let componentTag = config.id
  if (config.category === 'javascript') {
    componentTag = `js-${slug}`
  } else if (config.category === 'comfyui') {
    componentTag = `comfyui-${slug}`
  } else if (config.category === 'media') {
    componentTag = `audio-${slug}`
  } else if (config.category === 'interaction') {
    componentTag = `option-${slug}`
  }

  if (format === 'markdown') {
    // Markdown格式
    prompt += `# ${config.name} ${isZhCN ? '组件使用指南' : 'Component Usage Guide'}\n\n`

    // 组件描述
    prompt += `## ${isZhCN ? '组件描述' : 'Description'}\n`
    prompt += `${config.description}\n\n`
    // ComfyUI 组件信息
    if (config.category === 'comfyui') {
      const comfyConfig = config as any
      prompt += `## ${isZhCN ? '组件信息' : 'Component Info'}\n`
      prompt += `- ${isZhCN ? '类型' : 'Type'}: ComfyUI ${isZhCN ? '动态组件' : 'Dynamic Component'}\n`
      prompt += `- ${isZhCN ? '服务端' : 'Server'}: ${new URL(comfyConfig.serverUrl).host}\n`
      let outputLabel = comfyConfig.outputType
      if (comfyConfig.outputType === 'image') {
        outputLabel = isZhCN ? '图片' : 'Image'
      } else if (comfyConfig.outputType === 'video') {
        outputLabel = isZhCN ? '视频' : 'Video'
      } else if (comfyConfig.outputType === 'text') {
        outputLabel = isZhCN ? '文本' : 'Text'
      }
      prompt += `- ${isZhCN ? '输出类型' : 'Output Type'}: ${outputLabel}\n\n`
    }


    // 使用语法
    prompt += `## ${isZhCN ? '使用语法' : 'Usage Syntax'}\n`
    prompt += '```markdown\n'
    prompt += `<${componentTag}`

    // 添加必需参数示例
    const requiredParams = config.parameters.filter((p) => p.required)
    requiredParams.forEach((param) => {
      const example = param.example || `${param.description}`
      prompt += `\n  ${param.name}="${example}"`
    })

    // 添加可选参数示例（部分）
    const optionalParams = config.parameters.filter((p) => !p.required).slice(0, 2)
    optionalParams.forEach((param) => {
      const example = param.example || param.defaultValue || `${param.description}`
      prompt += `\n  ${param.name}="${example}"`
    })

    prompt += '\n/>\n```\n\n'

    // 参数详情
    if (includeParameterDetails && config.parameters.length > 0) {
      prompt += `## ${isZhCN ? '参数说明' : 'Parameters'}\n\n`
      config.parameters.forEach((param) => {
        const required = param.required ? (isZhCN ? '（必需）' : ' (required)') : isZhCN ? '（可选）' : ' (optional)'
        const defaultVal = param.defaultValue
          ? isZhCN
            ? `，默认值：${param.defaultValue}`
            : `, default: ${param.defaultValue}`
          : ''
        prompt += `- **${param.name}**: ${param.description}${required}${defaultVal}\n`
      })
      prompt += '\n'
    }

    // 使用示例
    if (includeExamples && config.examples && config.examples.length > 0) {
      prompt += `## ${isZhCN ? '使用示例' : 'Examples'}\n\n`
      config.examples.forEach((example, index) => {
        prompt += `### ${isZhCN ? '示例' : 'Example'} ${index + 1}\n`
        prompt += '```markdown\n'
        prompt += example
        prompt += '\n```\n\n'
      })
    }
  } else {
    // 纯文本格式
    prompt += `${config.name} ${isZhCN ? '组件使用指南' : 'Component Usage Guide'}\n\n`
    prompt += `${isZhCN ? '描述：' : 'Description: '}${config.description}\n\n`

    if (includeParameterDetails) {
      prompt += `${isZhCN ? '参数：' : 'Parameters:'}\n`
      config.parameters.forEach((param) => {
        const required = param.required ? (isZhCN ? '（必需）' : ' (required)') : isZhCN ? '（可选）' : ' (optional)'
        prompt += `- ${param.name}: ${param.description}${required}\n`
      })
      prompt += '\n'
    }

    if (includeExamples && config.examples && config.examples.length > 0) {
      prompt += `${isZhCN ? '示例：' : 'Examples:'}\n`
      config.examples.forEach((example) => {
        prompt += `${example}\n`
      })
    }
  }

  return prompt.trim()
}

/**
 * 导出组件配置为JSON
 */
export function exportComponentConfig(config: ComponentConfig): string {
  return JSON.stringify(config, null, 2)
}

/**
 * 从JSON导入组件配置
 */
export function importComponentConfig(jsonString: string): ComponentConfig | null {
  try {
    const config = JSON.parse(jsonString) as ComponentConfig
    const validation = validateComponentConfig(config)
    if (validation.valid) {
      return config
    }
    return null
  } catch (e) {
    return null
  }
}

/**
 * 获取参数类型的显示名称
 */
export function getParameterTypeDisplayName(type: string, language: 'zh-CN' | 'en-US' = 'zh-CN'): string {
  const typeNames = {
    'zh-CN': {
      string: '文本',
      number: '数字',
      boolean: '布尔值',
      url: 'URL地址',
      json: 'JSON数据'
    },
    'en-US': {
      string: 'String',
      number: 'Number',
      boolean: 'Boolean',
      url: 'URL',
      json: 'JSON'
    }
  }

  return typeNames[language][type as keyof (typeof typeNames)['zh-CN']] || type
}

/**
 * 获取组件分类的显示名称
 */
export function getCategoryDisplayName(category: string, language: 'zh-CN' | 'en-US' = 'zh-CN'): string {
  const categoryNames = {
    'zh-CN': {
      media: '媒体',
      interaction: '交互',
      utility: '工具',
      layout: '布局'
    },
    'en-US': {
      media: 'Media',
      interaction: 'Interaction',
      utility: 'Utility',
      layout: 'Layout'
    }
  }

  return categoryNames[language][category as keyof (typeof categoryNames)['zh-CN']] || category
}
