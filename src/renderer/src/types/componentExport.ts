import type { ComponentConfig, JSComponentConfig, ComfyUIComponentConfig } from './component'

export type ExportType = 'js' | 'comfyui'

export type ExportedComponent = {
  type: ExportType
  component: JSComponentConfig | ComfyUIComponentConfig | ComponentConfig
}

export type Conflict = {
  conflictType: 'id' | 'name'
  componentId: string
  componentName: string
}

export type ConflictAction = 'overwrite' | 'rename' | 'cancel'

export type ImportResult = {
  success: boolean
  imported?: JSComponentConfig | ComfyUIComponentConfig | ComponentConfig
  error?: string
  warnings?: string[]
}

