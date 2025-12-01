// 组件配置相关工具：校验、导入导出、以及 AI 组件技能提示词生成

import {
  ComponentConfig,
  ComponentParameter,
  ComponentValidationResult,
  PromptGenerationOptions
} from '@renderer/types/component'

// ========== 配置校验 ==========

export function validateComponentConfig(config: ComponentConfig): ComponentValidationResult {
  const errors: string[] = []
  const warnings: string[] = []

  if (!config.id || config.id.trim() === '') {
    errors.push('组件 ID 不能为空')
  }

  if (!config.name || config.name.trim() === '') {
    errors.push('组件名称不能为空')
  }

  if (!config.description || config.description.trim() === '') {
    warnings.push('组件描述为空，建议补充说明')
  }

  config.parameters.forEach((param, index) => {
    if (!param.name || param.name.trim() === '') {
      errors.push(`参数 ${index + 1} 的名称不能为空`)
    }

    if (!param.description || param.description.trim() === '') {
      warnings.push(`参数 "${param.name}" 缺少描述`)
    }

    if (param.type === 'url' && param.validation) {
      try {
        new RegExp(param.validation)
      } catch {
        errors.push(`参数 "${param.name}" 的校验规则不是有效的正则表达式`)
      }
    }
  })

  return { valid: errors.length === 0, errors, warnings }
}

export function validateParameterValue(parameter: ComponentParameter, value: any): boolean {
  if (parameter.required && (value === undefined || value === null || value === '')) {
    return false
  }

  if (value === undefined || value === null || value === '') {
    return true
  }

  switch (parameter.type) {
    case 'string':
      return typeof value === 'string'
    case 'number':
      return typeof value === 'number' && !isNaN(value)
    case 'boolean':
      return typeof value === 'boolean' || value === 'true' || value === 'false'
    case 'url': {
      if (typeof value !== 'string') return false
      if (parameter.validation) {
        try {
          const regex = new RegExp(parameter.validation)
          return regex.test(value)
        } catch {
          return false
        }
      }
      try {
        new URL(value)
        return true
      } catch {
        return false
      }
    }
    case 'json': {
      if (typeof value !== 'string') return false
      try {
        JSON.parse(value)
        return true
      } catch {
        return false
      }
    }
    default:
      return true
  }
}

// ========== 旧版 AI 用法说明（兼容保留，给设置页用） ==========

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

  const describeRequired = (required: boolean) => {
    if (required) {
      return isZhCN ? '（必填）' : ' (required)'
    }
    return isZhCN ? '（可选）' : ' (optional)'
  }

  if (format === 'markdown') {
    const lines: string[] = []

    lines.push(`# ${config.name} ${isZhCN ? '组件使用指南' : 'Component Skill'}`, '')

    lines.push(`## ${isZhCN ? '组件简介' : 'Description'}`)
    lines.push(
      config.description ||
        (isZhCN
          ? '用于在对话中渲染一个可交互的界面组件。'
          : 'Used to render an interactive UI component in the conversation.'),
      ''
    )

    lines.push(`## ${isZhCN ? '调用语法' : 'Usage Syntax'}`)
    lines.push(
      isZhCN
        ? '在回答中输出一个自闭合的组件标签，所有参数通过 HTML 属性传入，例如：'
        : 'In your answer, output a self-closing component tag and pass parameters as HTML attributes, e.g.:'
    )
    lines.push(`<${componentTag} ... />`, '')

    if (includeParameterDetails && config.parameters.length > 0) {
      lines.push(`## ${isZhCN ? '参数说明' : 'Parameters'}`, '')
      config.parameters.forEach((param) => {
        const typeName = getParameterTypeDisplayName(param.type, language)
        const defaultVal =
          param.defaultValue !== undefined && param.defaultValue !== null && param.defaultValue !== ''
            ? isZhCN
              ? `，默认值：${param.defaultValue}`
              : `, default: ${param.defaultValue}`
            : ''
        lines.push(
          `- **${param.name}** (${typeName}${describeRequired(param.required)}): ${param.description || ''}${defaultVal}`
        )
      })
      lines.push('')
    }

    if (includeExamples && config.examples && config.examples.length > 0) {
      lines.push(`## ${isZhCN ? '使用示例' : 'Examples'}`, '')
      config.examples.forEach((example, index) => {
        lines.push(`### ${isZhCN ? '示例' : 'Example'} ${index + 1}`)
        lines.push(example, '')
      })
    }

    return lines.join('\n').trim()
  }

  let prompt = `${config.name} ${isZhCN ? '组件使用指南' : 'Component Skill'}\n\n`
  prompt += `${isZhCN ? '组件简介：' : 'Description: '}${config.description}\n\n`

  if (includeParameterDetails && config.parameters.length > 0) {
    prompt += `${isZhCN ? '参数说明：' : 'Parameters:'}\n`
    config.parameters.forEach((param) => {
      const typeName = getParameterTypeDisplayName(param.type, language)
      prompt += `- ${param.name} (${typeName}${describeRequired(param.required)}): ${param.description}\n`
    })
    prompt += '\n'
  }

  if (includeExamples && config.examples && config.examples.length > 0) {
    prompt += `${isZhCN ? '示例：' : 'Examples:'}\n`
    config.examples.forEach((example) => {
      prompt += `${example}\n`
    })
  }

  return prompt.trim()
}

// ========== 导入导出 ==========

export function exportComponentConfig(config: ComponentConfig): string {
  return JSON.stringify(config, null, 2)
}

export function importComponentConfig(jsonString: string): ComponentConfig | null {
  try {
    const config = JSON.parse(jsonString) as ComponentConfig
    const validation = validateComponentConfig(config)
    if (validation.valid) {
      return config
    }
    return null
  } catch {
    return null
  }
}

// ========== 显示辅助 ==========

export function getParameterTypeDisplayName(type: string, language: 'zh-CN' | 'en-US' = 'zh-CN'): string {
  const typeNames = {
    'zh-CN': {
      string: '文本',
      number: '数字',
      boolean: '布尔值',
      url: 'URL 地址',
      json: 'JSON 数据'
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

// ========== 新版：AI 组件技能卡模板（统一 3 段结构） ==========

export function generateComponentSkillPrompt(
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

  const describeRequired = (required: boolean) => {
    if (required) {
      return isZhCN ? '（必填）' : ' (required)'
    }
    return isZhCN ? '（可选）' : ' (optional)'
  }

  // 特殊：选项组件（options）使用 text 语法
  if (config.id === 'options') {
    if (format === 'markdown') {
      const lines: string[] = []

      lines.push(`## ${isZhCN ? '组件：选项组件（Options）' : 'Component: Options'}`, '')

      // 1. 用途
      lines.push(`### ${isZhCN ? '1. 用途（What it does）' : '1. What it does'}`)
      lines.push(
        isZhCN
          ? '用于在对话中展示一组可点击的选项列表，引导用户做出选择（例如功能入口、话题分支等）。'
          : 'Displays a clickable list of options to let the user choose the next action or topic.',
        ''
      )

      // 2. 触发条件
      lines.push(`### ${isZhCN ? '2. 触发条件（When to trigger）' : '2. When to trigger'}`)
      lines.push(
        isZhCN
          ? '- 用户需要在多个明确选项中二选一 / 多选一；'
          : '- The user needs to choose among several clear options.'
      )
      lines.push(
        isZhCN
          ? '- 用户问“我可以选什么”“有什么选项/按钮”等；'
          : '- The user asks what options or buttons are available.'
      )
      lines.push(
        isZhCN
          ? '- 当前对话的下一步有 2～6 种清晰走向，可以列表展示；'
          : '- The next step of the conversation has 2–6 clear choices.'
      )
      lines.push('')

      // 3. 使用方法
      lines.push(`### ${isZhCN ? '3. 使用方法（How to use）' : '3. How to use'}`)
      lines.push(
        isZhCN
          ? '在回答中输出一行文本，使用下面的语法之一（推荐使用 `options`），不要包含代码块标记，不要在同一行追加解释：'
          : 'In your answer, output a single line in one of the following formats (options is recommended). Do NOT wrap it in code fences and do NOT add explanations on the same line:'
      )
      lines.push('')
      lines.push('options ["选项1", "选项2", "选项3"]')
      lines.push('choices ["选项1", "选项2", "选项3"]')
      lines.push('select ["选项1", "选项2", "选项3"]')
      lines.push('')

      lines.push(isZhCN ? '参数说明：' : 'Parameter notes:')
      lines.push(
        isZhCN
          ? '- "选项1"、"选项2"：显示给用户看的选项文案，使用中文或用户语言。'
          : '- "Option 1", "Option 2": text shown to the user, in the user\'s language.'
      )
      lines.push(isZhCN ? '- 建议选项数量控制在 2～6 个之间。' : '- Recommended to keep 2–6 options.')

      return lines.join('\n').trim()
    }

    // plain 模式简单说明
    let prompt = `${isZhCN ? '选项组件（Options）' : 'Options component'}\n\n`
    prompt += isZhCN
      ? '在回答中使用一行类似 `options ["选项1", "选项2"]` 的文本来展示可点击的选项列表。当用户需要在几个明确选项中做选择时使用此语法。'
      : 'Use a line like `options ["Option 1", "Option 2"]` in the answer to render a clickable options list. Use this when the user needs to choose among several clear options.'

    return prompt.trim()
  }

  // 通用组件技能卡（非 options）
  if (format === 'markdown') {
    const lines: string[] = []

    lines.push(`## ${isZhCN ? `组件：${config.name}` : `Component: ${config.name}`}`, '')

    // 1. 用途
    lines.push(`### ${isZhCN ? '1. 用途（What it does）' : '1. What it does'}`)
    lines.push(
      config.description ||
        (isZhCN
          ? '用于在对话中渲染一个可交互或可视化的界面组件。'
          : 'Used to render an interactive or visual component in the conversation.'),
      ''
    )

    // 2. 触发条件
    lines.push(`### ${isZhCN ? '2. 触发条件（When to trigger）' : '2. When to trigger'}`)
    lines.push(
      isZhCN
        ? `- 当用户需求与该组件「${config.name}」的能力直接相关时（例如：${config.description}）。`
        : `- When the user request directly relates to the capabilities of this component "${config.name}" (e.g., ${config.description}).`
    )
    lines.push(
      isZhCN
        ? '- 当该组件的展示形式（如卡片、进度条、音频、可视化等）能明显提升理解或交互体验时。'
        : "- When the component's UI (card, progress bar, audio, visualization, etc.) clearly improves understanding or interaction."
    )
    lines.push('')

    // 3. 使用方法
    lines.push(`### ${isZhCN ? '3. 使用方法（How to use）' : '3. How to use'}`)
    lines.push(
      isZhCN
        ? '在回答中输出一个自闭合的组件标签，所有参数通过 HTML 属性传入，例如：'
        : 'In your answer, output a self-closing component tag and pass all arguments as HTML attributes. For example:'
    )
    lines.push('')
    lines.push(`<${componentTag} ... />`)
    lines.push('')

    if (includeParameterDetails && config.parameters.length > 0) {
      lines.push(isZhCN ? '参数说明：' : 'Parameter details:', '')
      config.parameters.forEach((param) => {
        const typeName = getParameterTypeDisplayName(param.type, language)
        const defaultVal =
          param.defaultValue !== undefined && param.defaultValue !== null && param.defaultValue !== ''
            ? isZhCN
              ? `，默认值：${param.defaultValue}`
              : `, default: ${param.defaultValue}`
            : ''
        lines.push(
          `- ${param.name} (${typeName}${describeRequired(param.required)}): ${param.description || ''}${defaultVal}`
        )
      })
      lines.push('')
    }

    if (includeExamples && config.examples && config.examples.length > 0) {
      lines.push(`**${isZhCN ? '示例（Examples）' : 'Examples'}**`, '')
      config.examples.forEach((example, index) => {
        lines.push(`${isZhCN ? '示例' : 'Example'} ${index + 1}:`)
        lines.push(example, '')
      })
    }

    return lines.join('\n').trim()
  }

  // plain 文本模式（通用）
  let prompt = `${config.name} ${isZhCN ? '组件技能' : 'Component Skill'}\n\n`
  prompt += `${isZhCN ? '用途：' : 'What it does: '}${config.description}\n\n`
  prompt += isZhCN
    ? `使用方法：在回答中输出 <${componentTag} ... /> 形式的自闭合标签，将参数以属性形式传入。\n`
    : `How to use: output a self-closing tag like <${componentTag} ... /> in the answer and pass parameters as attributes.\n`

  if (includeParameterDetails && config.parameters.length > 0) {
    prompt += `\n${isZhCN ? '参数：' : 'Parameters:'}\n`
    config.parameters.forEach((param) => {
      const typeName = getParameterTypeDisplayName(param.type, language)
      prompt += `- ${param.name} (${typeName}${describeRequired(param.required)}): ${param.description}\n`
    })
  }

  if (includeExamples && config.examples && config.examples.length > 0) {
    prompt += `\n${isZhCN ? '示例：' : 'Examples:'}\n`
    config.examples.forEach((example) => {
      prompt += `${example}\n`
    })
  }

  return prompt.trim()
}
