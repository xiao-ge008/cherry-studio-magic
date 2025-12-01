/**
 * ComfyUI工作流解析器
 * 用于分析工作流JSON，提取可配置参数，生成组件配置
 */

import { loggerService } from '@logger'
import type { ComfyUIWorkflow, NodeParameterBinding, ComponentParameter } from '../../renderer/src/types/component'
import type { ComfyUINodeInfo, WorkflowAnalysisResult } from '../../renderer/src/types/comfyui'

const logger = loggerService.withContext('WorkflowAnalyzer')

/**
 * 常见的ComfyUI节点类型及其可配置字段
 */
const CONFIGURABLE_NODE_TYPES: Record<string, string[]> = {
  // 文本编码器
  CLIPTextEncode: ['text'],
  CLIPTextEncodeSDXL: ['text_g', 'text_l'],

  // 采样器
  KSampler: ['seed', 'steps', 'cfg', 'sampler_name', 'scheduler', 'denoise'],
  KSamplerAdvanced: [
    'seed',
    'steps',
    'cfg',
    'sampler_name',
    'scheduler',
    'start_at_step',
    'end_at_step',
    'return_with_leftover_noise'
  ],

  // 图像处理
  LoadImage: ['image'],
  SaveImage: ['filename_prefix'],
  EmptyLatentImage: ['width', 'height', 'batch_size'],
  LatentUpscale: ['upscale_method', 'width', 'height', 'crop'],

  // 模型加载
  CheckpointLoaderSimple: ['ckpt_name'],
  LoraLoader: ['lora_name', 'strength_model', 'strength_clip'],

  // ControlNet
  ControlNetLoader: ['control_net_name'],
  ControlNetApply: ['strength', 'start_percent', 'end_percent'],

  // 图像调整
  ImageScale: ['upscale_method', 'width', 'height', 'crop'],
  ImageResize: ['width', 'height', 'interpolation']
}

/**
 * 参数类型推断映射
 */
const PARAMETER_TYPE_MAPPING: Record<string, 'string' | 'number' | 'boolean' | 'url' | 'json'> = {
  // 文本类型
  text: 'string',
  text_g: 'string',
  text_l: 'string',
  filename_prefix: 'string',
  ckpt_name: 'string',
  lora_name: 'string',
  control_net_name: 'string',
  sampler_name: 'string',
  scheduler: 'string',
  upscale_method: 'string',
  interpolation: 'string',

  // 数值类型
  seed: 'number',
  steps: 'number',
  cfg: 'number',
  denoise: 'number',
  width: 'number',
  height: 'number',
  batch_size: 'number',
  strength: 'number',
  strength_model: 'number',
  strength_clip: 'number',
  start_percent: 'number',
  end_percent: 'number',
  start_at_step: 'number',
  end_at_step: 'number',
  conditioning_to_strength: 'number',

  // 布尔类型
  return_with_leftover_noise: 'boolean',

  // 特殊类型
  image: 'url',
  crop: 'string'
}

/**
 * 工作流分析器类
 */
export class WorkflowAnalyzer {
  /**
   * 分析工作流JSON，提取可配置参数
   */
  static analyzeWorkflow(workflowJson: ComfyUIWorkflow): WorkflowAnalysisResult {
    try {
      logger.info('开始分析工作流', { nodeCount: Object.keys(workflowJson).length })

      const nodes: ComfyUINodeInfo[] = []
      const configurableParameters: Array<{
        nodeId: string
        inputField: string
        currentValue: any
        suggestedParameterName: string
        description: string
      }> = []

      // 遍历所有节点
      Object.entries(workflowJson).forEach(([nodeId, nodeData]) => {
        const { class_type, inputs, _meta } = nodeData
        const title = _meta?.title || class_type

        // 获取可配置的输入字段
        const configurableInputs = CONFIGURABLE_NODE_TYPES[class_type] || []
        const isConfigurable = configurableInputs.length > 0

        // 创建节点信息
        const nodeInfo: ComfyUINodeInfo = {
          id: nodeId,
          class_type,
          title,
          inputs,
          configurable: isConfigurable,
          configurableInputs
        }
        nodes.push(nodeInfo)

        // 提取可配置参数
        if (isConfigurable) {
          configurableInputs.forEach((inputField) => {
            if (inputs[inputField] !== undefined) {
              const currentValue = inputs[inputField]
              const suggestedParameterName = this.generateParameterName(class_type, inputField, nodeId)
              const description = this.generateParameterDescription(class_type, inputField, title)

              configurableParameters.push({
                nodeId,
                inputField,
                currentValue,
                suggestedParameterName,
                description
              })
            }
          })
        }
      })

      const summary = {
        totalNodes: nodes.length,
        configurableNodes: nodes.filter((n) => n.configurable).length,
        estimatedParameters: configurableParameters.length
      }

      logger.info('工作流分析完成', summary)

      return {
        nodes,
        configurableParameters,
        summary
      }
    } catch (error) {
      logger.error('工作流分析失败', error as Error)
      throw new Error(`工作流分析失败: ${(error as Error).message}`)
    }
  }

  /**
   * 根据分析结果生成组件参数配置
   */
  static generateComponentParameters(analysisResult: WorkflowAnalysisResult): ComponentParameter[] {
    const parameters: ComponentParameter[] = []

    analysisResult.configurableParameters.forEach((param) => {
      const paramType = PARAMETER_TYPE_MAPPING[param.inputField] || 'string'

      parameters.push({
        name: param.suggestedParameterName,
        type: paramType,
        description: param.description,
        required: false,
        defaultValue: param.currentValue,
        example: String(param.currentValue)
      })
    })

    return parameters
  }

  /**
   * 根据分析结果生成节点参数绑定
   */
  static generateNodeBindings(analysisResult: WorkflowAnalysisResult): NodeParameterBinding[] {
    const bindings: NodeParameterBinding[] = []

    analysisResult.configurableParameters.forEach((param) => {
      bindings.push({
        parameterName: param.suggestedParameterName,
        nodeId: param.nodeId,
        inputField: param.inputField,
        description: param.description
      })
    })

    return bindings
  }

  /**
   * 生成参数名称
   */
  private static generateParameterName(classType: string, inputField: string, _nodeId: string): string {
    // 简化类型名称
    const simplifiedType = classType
      .replace(/([A-Z])/g, '_$1')
      .toLowerCase()
      .replace(/^_/, '')
      .replace(/_+/g, '_')

    // 如果输入字段名已经很清晰，直接使用
    if (['text', 'prompt', 'seed', 'steps', 'cfg', 'width', 'height'].includes(inputField)) {
      return inputField
    }

    // 组合生成参数名
    return `${simplifiedType}_${inputField}`.replace(/_+/g, '_')
  }

  /**
   * 生成参数描述
   */
  private static generateParameterDescription(classType: string, inputField: string, nodeTitle?: string): string {
    const descriptions: Record<string, string> = {
      // 通用描述
      text: '文本提示词',
      text_g: '全局文本提示词',
      text_l: '局部文本提示词',
      seed: '随机种子，控制生成的随机性',
      steps: '采样步数，影响生成质量',
      cfg: 'CFG引导强度，控制提示词遵循程度',
      width: '图像宽度（像素）',
      height: '图像高度（像素）',
      denoise: '去噪强度，控制变化程度',
      strength: '效果强度',
      batch_size: '批次大小，一次生成的图像数量',

      // 模型相关
      ckpt_name: '检查点模型名称',
      lora_name: 'LoRA模型名称',
      control_net_name: 'ControlNet模型名称',

      // 采样器相关
      sampler_name: '采样器类型',
      scheduler: '调度器类型',

      // 图像处理
      upscale_method: '放大方法',
      interpolation: '插值方法',
      filename_prefix: '保存文件名前缀',

      // 特殊参数
      image: '输入图像',
      start_percent: '开始百分比',
      end_percent: '结束百分比'
    }

    const baseDescription = descriptions[inputField] || `${classType}节点的${inputField}参数`

    if (nodeTitle && nodeTitle !== classType) {
      return `${baseDescription} (${nodeTitle})`
    }

    return baseDescription
  }

  /**
   * 验证工作流JSON格式
   */
  static validateWorkflow(workflowJson: any): { valid: boolean; errors: string[] } {
    const errors: string[] = []

    try {
      // 检查是否为对象
      if (typeof workflowJson !== 'object' || workflowJson === null) {
        errors.push('工作流必须是一个有效的JSON对象')
        return { valid: false, errors }
      }

      // 检查是否有节点
      const nodeIds = Object.keys(workflowJson)
      if (nodeIds.length === 0) {
        errors.push('工作流不能为空')
        return { valid: false, errors }
      }

      // 验证每个节点
      nodeIds.forEach((nodeId) => {
        const node = workflowJson[nodeId]

        if (!node.class_type) {
          errors.push(`节点 ${nodeId} 缺少 class_type 字段`)
        }

        if (!node.inputs || typeof node.inputs !== 'object') {
          errors.push(`节点 ${nodeId} 缺少有效的 inputs 字段`)
        }
      })

      return { valid: errors.length === 0, errors }
    } catch (error) {
      errors.push(`工作流格式验证失败: ${(error as Error).message}`)
      return { valid: false, errors }
    }
  }

  /**
   * 生成随机种子
   */
  static generateRandomSeed(): number {
    return Math.floor(Math.random() * 1000000000)
  }

  /**
   * 为工作流中的采样器节点生成随机种子
   */
  static injectRandomSeeds(workflow: ComfyUIWorkflow): ComfyUIWorkflow {
    const updatedWorkflow = JSON.parse(JSON.stringify(workflow))

    Object.entries(updatedWorkflow).forEach(([nodeId, node]) => {
      const nodeData = node as any
      if (nodeData.class_type?.includes('Sampler') && nodeData.inputs?.seed !== undefined) {
        updatedWorkflow[nodeId].inputs.seed = this.generateRandomSeed()
      }
    })

    return updatedWorkflow
  }
}
