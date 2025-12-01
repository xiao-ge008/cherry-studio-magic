export interface ComfyUIProgress {
  percent?: number
  percentage?: number
  status?: string
  current?: number
  total?: number
  promptId?: string
  [key: string]: any
}

export interface ComfyUIWorkflow {
  [key: string]: any
}

// Response for generate workflow request
export interface ComfyUIGenerateResponse {
  success: boolean
  promptId?: string
  error?: string
}

// WebSocket message payload from ComfyUI server
export interface ComfyUIWebSocketMessage {
  type: string
  data: any
}

// Server config used by main process services
export interface ComfyUIServerConfig {
  url: string
  apiKey?: string
  timeout?: number
}

// Node info used by workflow analyzer
export interface ComfyUINodeInfo {
  id: string
  class_type: string
  title?: string
  inputs: Record<string, any>
  configurable: boolean
  configurableInputs: string[]
}

export interface WorkflowAnalysisResult {
  nodes: ComfyUINodeInfo[]
  configurableParameters: Array<{
    nodeId: string
    inputField: string
    currentValue: any
    suggestedParameterName: string
    description: string
  }>
  suggestedParameters?: Array<{
    name: string
    type: string
    description?: string
    required?: boolean
    defaultValue?: any
  }>
  summary: {
    totalNodes: number
    configurableNodes: number
    estimatedParameters: number
  }
}

export interface CreateComfyUIComponentRequest {
  componentName: string
  displayName: string
  description?: string
  serverConfig: ComfyUIServerConfig
  workflowJson: string
  parameters?: Array<{
    name: string
    type: string
    description?: string
    required?: boolean
    defaultValue?: any
  }>
}
