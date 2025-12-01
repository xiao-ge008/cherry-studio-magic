/**
 * 组件相关的类型与默认配置
 */

// ==================== 基础类型 ====================

/**
 * 组件参数类型
 */
export type ComponentParameterType = 'string' | 'number' | 'boolean' | 'url' | 'json'

/**
 * 组件类别
 */
export type ComponentCategory = 'media' | 'interaction' | 'utility' | 'layout' | 'comfyui' | 'javascript'

/**
 * 单个参数配置
 */
export interface ComponentParameter {
  /** 参数名称 */
  name: string
  /** 参数类型 */
  type: ComponentParameterType
  /** 参数描述 */
  description: string
  /** 默认值 */
  defaultValue?: any
  /** 是否必填 */
  required: boolean
  /** 自定义校验正则 */
  validation?: string
  /** 示例值 */
  example?: string
}

/**
 * 组件配置
 */
export interface ComponentConfig {
  /** 组件唯一标识 */
  id: string
  /** 组件显示名称 */
  name: string
  /** 组件描述 */
  description: string
  /**
   * 自定义的组件技能 Markdown 提示词
   * 如果存在，将优先用于生成组件使用说明（ComponentMDDialog）
   */
  skillPromptMarkdown?: string
  /** 是否启用 */
  enabled: boolean
  /** 组件分类 */
  category: ComponentCategory
  /** 参数列表 */
  parameters: ComponentParameter[]
  /** 使用示例（Markdown/文本） */
  examples?: string[]
  /** 配置版本 */
  version?: string
  /** 是否为内置组件 */
  builtin: boolean
  /** TTS 服务 URL（仅 audio-message 使用） */
  url?: string
}

/**
 * 组件设置整体结构
 */
export interface ComponentSettings {
  /** 组件配置映射 */
  components: Record<string, ComponentConfig>
  /** 配置版本 */
  version: string
  /** 最后更新时间 */
  lastUpdated: number
  /**
   * 组件提示词（Markdown 格式）
   * 用作当前选中组件能力的系统提示词头部大纲。
   */
  componentsPromptMarkdown?: string
  /**
   * 智能生成提示词（Markdown 格式）
   * 用于"智能生成"功能，指导 AI 如何生成组件说明。
   */
  generationPromptMarkdown?: string
}

/**
 * 默认的组件提示词（Markdown，简体中文）
 * 用作系统提示词中组件能力说明的头部大纲。
 */
export const DEFAULT_COMPONENTS_PROMPT_MARKDOWN_ZH = `# 组件功能概览

你现在可以使用以下专业组件来增强你的能力。当用户请求与这些组件的功能相匹配时，请主动、智能地选择并使用对应的组件。

每个组件都有其适用场景和触发条件，请仔细阅读：`

/**
 * 默认的智能生成提示词（Markdown，简体中文）
 * 用于"智能生成"功能。
 */
export const DEFAULT_GENERATION_PROMPT_MARKDOWN_ZH = `你是技术文档助手。根据组件信息生成JSON格式的使用说明。

请严格遵循以下要求：
1. **组件用途**：根据组件描述概括，2-3句话。
2. **触发条件**：根据组件描述内容，总结触发该组件的条件和场景。
3. **使用方法**：
   - 必须包含详细的参数说明列表。
   - **必须**提供一个完整的、可直接渲染的组件调用示例（例如：<js-circular-progress-ring data="xxxx" />）。

参数说明格式示例：
- data (JSON 数据（必填）): 数据对象，包含progress(进度0-100)、size(尺寸)、strokeWidth(线宽)等字段
- theme (文本（可选）): 主题模式，可选light或dark，默认light，默认值：light
- options (JSON 数据（可选）): 扩展配置，支持animated(动画)、duration(动画时长)、debug等，默认值：{}

输出JSON格式：
{
  "purpose": "组件用途",
  "triggers": "触发条件",
  "usage": "使用方法（含参数详解和完整渲染示例）"
}`

// ==================== 默认 JS 组件 ====================

/**
 * JS 组件输出类型
 */
export type JSComponentOutputType = 'text' | 'html'

/**
 * JS 组件执行结果
 */
export interface JSComponentResult {
  success: boolean
  output?: string
  error?: string
  executionTime: number
  type: JSComponentOutputType
}

/**
 * JS 组件配置
 */
export interface JSComponentConfig extends ComponentConfig {
  category: 'javascript'
  /** 组件英文名（标签名） */
  componentName: string
  /** JS 代码 */
  jsCode: string
  /** 输出类型 */
  outputType: JSComponentOutputType
  /** 执行超时时间（毫秒） */
  timeout?: number
  /** 是否启用 */
  enabled: boolean
}

/**
 * 默认的 JS 组件示例
 */
export const DEFAULT_JS_COMPONENTS: Record<string, JSComponentConfig> = {
  'js-hello-world': {
    id: 'js-hello-world',
    name: 'Hello World',
    componentName: 'hello-world',
    description: '一个最简单的问候组件，演示自定义 JS 组件能力。',
    enabled: true,
    category: 'javascript',
    builtin: true,
    version: '1.0.0',
    jsCode: ` // 简单问候示例
const greeting = name ? \`Hello, \${name}!\` : 'Hello, World!'
return greeting`,
    outputType: 'text',
    timeout: 5000,
    parameters: [
      {
        name: 'name',
        type: 'string',
        description: '要问候的名字',
        required: false,
        example: 'Alice'
      }
    ],
    examples: ['<js-hello-world />', '<js-hello-world name="Alice" />']
  },
  'js-calculator': {
    id: 'js-calculator',
    name: 'Calculator',
    componentName: 'calculator',
    description: '一个简单的四则运算计算器组件示例。',
    enabled: true,
    category: 'javascript',
    builtin: true,
    version: '1.0.0',
    jsCode: ` // 简单计算器
  const a = Number(num1) || 0
  const b = Number(num2) || 0
  let result

  switch (operation) {
    case 'add':
      result = a + b
      break
    case 'subtract':
      result = a - b
      break
    case 'multiply':
      result = a * b
      break
    case 'divide':
      result = b !== 0 ? a / b : 'Error: Division by zero'
      break
    default:
      result = 'Error: Invalid operation'
  }

  return {
  type: 'html',
  content: \`
    <div style="padding: 16px; border: 1px solid #e2e8f0; border-radius: 8px; background: #f8fafc;">
      <h3 style="margin: 0 0 12px 0; color: #1e293b;">计算结果</h3>
      <div style="font-size: 18px; font-weight: bold; color: #0f172a;">
        \${a} \${operation === 'add' ? '+' : operation === 'subtract' ? '-' : operation === 'multiply' ? '×' : '÷'} \${b} = \${result}
      </div>
    </div>
  \`
}`,
    outputType: 'html',
    timeout: 5000,
    parameters: [
      {
        name: 'num1',
        type: 'number',
        description: '第一个数字',
        required: true,
        example: '10'
      },
      {
        name: 'num2',
        type: 'number',
        description: '第二个数字',
        required: true,
        example: '5'
      },
      {
        name: 'operation',
        type: 'string',
        description: '运算类型：add / subtract / multiply / divide',
        required: true,
        example: 'add'
      }
    ],
    examples: [
      '<js-calculator num1="10" num2="5" operation="add" />',
      '<js-calculator num1="20" num2="4" operation="divide" />'
    ]
  }
}

// ==================== 默认内置组件 ====================

/**
 * 默认的内置组件集合
 */
export const DEFAULT_COMPONENTS: Record<string, ComponentConfig> = {
  'audio-message': {
    id: 'audio-message',
    name: 'Audio Message',
    description: '将文本转换为语音并播放的组件，支持本地 TTS 服务。',
    enabled: true,
    category: 'media',
    builtin: true,
    version: '1.0.0',
    url: 'http://localhost:9880/',
    parameters: [
      {
        name: 'text',
        type: 'string',
        description: '要转换为语音的文本内容',
        required: true,
        example: '你好，这里是 Cherry Studio。'
      },
      {
        name: 'speaker',
        type: 'string',
        description: '说话人或音色名称',
        required: false,
        example: '小美'
      },
      {
        name: 'role',
        type: 'string',
        description: '消息角色：speech / action / narration 等',
        required: false,
        defaultValue: 'speech',
        example: 'speech'
      },
      {
        name: 'emo',
        type: 'string',
        description: '情绪标签，例如 playful / sweet / friendly 等',
        required: false,
        example: 'friendly'
      },
      {
        name: 'autoplay',
        type: 'boolean',
        description: '是否自动播放音频',
        required: false,
        defaultValue: false,
        example: 'true'
      }
    ],
    examples: [
      '<audio-message text="你好，这里是 Cherry Studio。" speaker="小美" />',
      '<audio-message role="action" text="请专注聆听接下来的提示音。" speaker="小新" />'
    ]
  },
  options: {
    id: 'options',
    name: 'Options',
    description: '通过可点击选项列表，引导用户进行下一步选择。',
    enabled: true,
    category: 'interaction',
    builtin: true,
    version: '1.0.0',
    parameters: [
      {
        name: 'data-options',
        type: 'json',
        description: '选项数据的 JSON 字符串，包含关键字与选项数组。',
        required: true,
        example: '{"keyword":"选项","options":["选项1","选项2","选项3"]}'
      }
    ],
    examples: [
      'options ["蓝色", "红色", "绿色"]',
      '请先选择你关心的内容：\noptions ["产品介绍", "使用教程", "售后支持"]'
    ]
  }
}

/**
 * 默认的组件设置
 */
export const DEFAULT_COMPONENT_SETTINGS: ComponentSettings = {
  components: { ...DEFAULT_COMPONENTS, ...DEFAULT_JS_COMPONENTS },
  version: '1.0.0',
  lastUpdated: Date.now(),
  componentsPromptMarkdown: DEFAULT_COMPONENTS_PROMPT_MARKDOWN_ZH
}

// ==================== 校验与提示类型 ====================

/**
 * 组件配置校验结果
 */
export interface ComponentValidationResult {
  valid: boolean
  errors: string[]
  warnings: string[]
}

/**
 * AI 提示词生成选项
 */
export interface PromptGenerationOptions {
  /** 是否包含示例 */
  includeExamples: boolean
  /** 是否包含参数详情 */
  includeParameterDetails: boolean
  /** 语言 */
  language: 'zh-CN' | 'en-US'
  /** 输出格式 */
  format: 'markdown' | 'plain'
}

// ==================== ComfyUI 组件类型 ====================

/**
 * ComfyUI 工作流结构
 */
export interface ComfyUIWorkflow {
  [nodeId: string]: {
    class_type: string
    inputs: Record<string, any>
    _meta?: {
      title?: string
    }
  }
}

/**
 * ComfyUI 输出类型
 */
export type ComfyUIOutputType = 'image' | 'video' | 'text'

/**
 * ComfyUI 节点参数绑定关系
 */
export interface NodeParameterBinding {
  /** 组件参数名 */
  parameterName: string
  /** 目标节点 ID */
  nodeId: string
  /** 节点输入字段名 */
  inputField: string
  /** 值转换配置（可选） */
  transform?: string
  /** 说明 */
  description?: string
  /** 前缀关键词（可选） */
  prefixKeyword?: string
  /** 后缀关键词（可选） */
  suffixKeyword?: string
  /** 是否启用动态前后缀（仅 string 类型） */
  enableDynamicPrefixSuffix?: boolean
  /** 动态前缀默认值 */
  dynamicPrefixDefault?: string
  /** 动态后缀默认值 */
  dynamicSuffixDefault?: string
}

/**
 * ComfyUI 组件配置
 */
export interface ComfyUIComponentConfig extends ComponentConfig {
  category: 'comfyui'
  /** 组件英文名（标签名） */
  componentName: string
  /** ComfyUI 服务地址 */
  serverUrl: string
  /** API Key（可选） */
  apiKey?: string
  /** 工作流 JSON 模板 */
  workflowTemplate: ComfyUIWorkflow
  /** 节点参数绑定配置 */
  nodeBindings: NodeParameterBinding[]
  /** 输出类型（默认 image） */
  outputType: ComfyUIOutputType
}
