import type { ComfyUINodeInfo } from '@renderer/types/comfyui'

type AnalysisResult = {
  nodes: ComfyUINodeInfo[]
}

export class WorkflowParser {
  static parseWorkflow(workflow: any): AnalysisResult {
    try {
      if (!workflow || typeof workflow !== 'object') return { nodes: [] }
      const nodes: ComfyUINodeInfo[] = []
      Object.entries(workflow).forEach(([id, node]: [string, any]) => {
        const classType = node?.class_type ?? 'Unknown'
        const inputs = (node?.inputs ?? {}) as Record<string, any>
        const title = node?._meta?.title ?? classType
        const configurableInputs = Object.keys(inputs)
        nodes.push({
          id,
          class_type: classType,
          title,
          inputs,
          configurable: configurableInputs.length > 0,
          configurableInputs
        })
      })
      return { nodes }
    } catch {
      return { nodes: [] }
    }
  }

  static inferParameterType(
    _inputField: string,
    currentValue: any
  ): 'string' | 'number' | 'boolean' | 'url' | 'json' {
    if (typeof currentValue === 'number') return 'number'
    if (typeof currentValue === 'boolean') return 'boolean'
    if (typeof currentValue === 'string') {
      const v = currentValue.trim().toLowerCase()
      if (v.startsWith('http://') || v.startsWith('https://')) return 'url'
      return 'string'
    }
    return 'json'
  }

  static generateDefaultValue(
    _inputField: string,
    currentValue: any,
    parameterType: 'string' | 'number' | 'boolean' | 'url' | 'json'
  ) {
    switch (parameterType) {
      case 'number':
        return typeof currentValue === 'number' ? currentValue : 0
      case 'boolean':
        return typeof currentValue === 'boolean' ? currentValue : false
      case 'url':
        return typeof currentValue === 'string' ? currentValue : ''
      case 'json':
        return currentValue ?? {}
      case 'string':
      default:
        return typeof currentValue === 'string' ? currentValue : ''
    }
  }
}

