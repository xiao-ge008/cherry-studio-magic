/**
 * 组件配置相关类型定义
 */

/**
 * 组件参数类型
 */
export type ComponentParameterType = 'string' | 'number' | 'boolean' | 'url' | 'json'

/**
 * 组件分类
 */
export type ComponentCategory = 'media' | 'interaction' | 'utility' | 'layout' | 'comfyui' | 'javascript'

/**
 * 组件参数配置
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
  /** 是否必需 */
  required: boolean
  /** 验证规则（正则表达式字符串） */
  validation?: string
  /** 参数示例值 */
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
  /** 是否启用 */
  enabled: boolean
  /** 组件分类 */
  category: ComponentCategory
  /** 参数列表 */
  parameters: ComponentParameter[]
  /** 使用示例 */
  examples?: string[]
  /** 组件版本 */
  version?: string
  /** 是否为内置组件 */
  builtin: boolean
  /** TTS服务URL (仅audio-message组件使用) */
  url?: string
}

/**
 * 组件设置状态
 */
export interface ComponentSettings {
  /** 组件配置映射 */
  components: Record<string, ComponentConfig>
  /** 配置版本 */
  version: string
  /** 最后更新时间 */
  lastUpdated: number
}

/**
 * 默认的JS组件示例
 */
export const DEFAULT_JS_COMPONENTS: Record<string, JSComponentConfig> = {
  'js-hello-world': {
    id: 'js-hello-world',
    name: 'Hello World',
    componentName: 'hello-world',
    description: '简单的问候组件，支持自定义名称',
    enabled: true,
    category: 'javascript',
    builtin: true,
    version: '1.0.0',
    jsCode: `// 简单的问候组件
const greeting = name ? \`Hello, \${name}!\` : 'Hello, World!'
return greeting`,
    outputType: 'text',
    timeout: 5000,
    parameters: [
      {
        name: 'name',
        type: 'string',
        description: '要问候的名称',
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
    description: '简单的计算器组件',
    enabled: true,
    category: 'javascript',
    builtin: true,
    version: '1.0.0',
    jsCode: `// 简单计算器
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
        description: '运算类型：add, subtract, multiply, divide',
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

/**
 * 默认的内置组件配置
 */
export const DEFAULT_COMPONENTS: Record<string, ComponentConfig> = {
  'audio-message': {
    id: 'audio-message',
    name: 'Audio Message',
    description: '将文本转换为语音并播放的组件，支持TTS语音合成功能',
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
        example: '你好，我是AI助手！'
      },
      {
        name: 'speaker',
        type: 'string',
        description: '说话者名称或角色',
        required: false,
        example: '小雅'
      },

      {
        name: 'role',
        type: 'string',
        description: '消息类型：speech（对话）或action（动作描述）',
        required: false,
        defaultValue: 'speech',
        example: 'speech'
      },
      {
        name: 'emo',
        type: 'string',
        description: '情感标签，如playful、sweet、flirty等',
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
      '<audio-message text="你好，我是AI助手！" speaker="小雅" />',
      '<audio-message role="action" text="她轻轻地走过来，眼中带着调皮的光芒" speaker="旁白" />'
    ]
  },
  options: {
    id: 'options',
    name: 'Options',
    description: '显示可点击选项列表的组件，用于快速交互选择',
    enabled: true,
    category: 'interaction',
    builtin: true,
    version: '1.0.0',
    parameters: [
      {
        name: 'data-options',
        type: 'json',
        description: '选项数据的JSON字符串，包含选项列表和关键词',
        required: true,
        example: '{"keyword": "选择", "options": ["选项1", "选项2", "选项3"]}'
      }
    ],
    examples: [
      'options ["红色", "蓝色", "绿色"]',
      '请选择你想了解的内容：\noptions ["产品介绍", "使用教程", "技术支持"]'
    ]
  }
}

/**
 * 默认组件设置
 */
export const DEFAULT_COMPONENT_SETTINGS: ComponentSettings = {
  components: { ...DEFAULT_COMPONENTS, ...DEFAULT_JS_COMPONENTS },
  version: '1.0.0',
  lastUpdated: Date.now()
}

/**
 * 组件配置验证结果
 */
export interface ComponentValidationResult {
  valid: boolean
  errors: string[]
  warnings: string[]
}

/**
 * AI提示词生成选项
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

/**
 * ComfyUI工作流结构
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
 * ComfyUI组件输出类型
 */
export type ComfyUIOutputType = 'image' | 'video' | 'text'

/**
 * ComfyUI节点参数绑定
 */
export interface NodeParameterBinding {
  /** 组件参数名 */
  parameterName: string
  /** 目标节点ID */
  nodeId: string
  /** 节点输入字段名 */
  inputField: string
  /** 数据转换函数（可选） */
  transform?: string
  /** 参数描述 */
  description?: string
  /** 前置关键词（可选） */
  prefixKeyword?: string
  /** 后置关键词（可选） */
  suffixKeyword?: string
  /** 是否启用动态前缀/后缀参数（仅限 string 类型） */
  enableDynamicPrefixSuffix?: boolean
  /** 动态前缀参数的默认值 */
  dynamicPrefixDefault?: string
  /** 动态后缀参数的默认值 */
  dynamicSuffixDefault?: string
}

/**
 * ComfyUI组件配置
 */
export interface ComfyUIComponentConfig extends ComponentConfig {
  category: 'comfyui'
  /** 组件英文名（唯一标识） */
  componentName: string
  /** ComfyUI服务器URL */
  serverUrl: string
  /** API密钥（可选） */
  apiKey?: string
  /** 工作流JSON模板 */
  workflowTemplate: ComfyUIWorkflow
  /** 节点参数绑定映射 */
  nodeBindings: NodeParameterBinding[]
  /** 输出类型（默认为图片） */
  outputType: ComfyUIOutputType
}

/**
 * JS组件输出类型
 */
export type JSComponentOutputType = 'text' | 'html'

/**
 * JS组件执行结果
 */
export interface JSComponentResult {
  success: boolean
  output?: string
  error?: string
  executionTime: number
  type: JSComponentOutputType
}

/**
 * JS组件配置
 */
export interface JSComponentConfig extends ComponentConfig {
  category: 'javascript'
  /** 组件英文名（唯一标识） */
  componentName: string
  /** JS代码 */
  jsCode: string
  /** 输出类型 */
  outputType: JSComponentOutputType
  /** 执行超时时间（毫秒） */
  timeout?: number
  /** 是否启用 */
  enabled: boolean
}
