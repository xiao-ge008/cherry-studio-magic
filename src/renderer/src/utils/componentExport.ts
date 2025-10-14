import store from '@renderer/store'
import type {
  ComponentConfig,
  JSComponentConfig,
  ComfyUIComponentConfig,
  ComponentSettings
} from '@renderer/types/component'
import type { ExportType, ExportedComponent, Conflict } from '@renderer/types/componentExport'

function sanitizeFileName(name: string): string {
  return name
    .replace(/[\\/:*?"<>|]/g, '-')
    .replace(/\s+/g, '-')    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .toLowerCase()
}

function nowStamp(): string {
  const d = new Date()
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(
    d.getMinutes()
  )}${pad(d.getSeconds())}`
}

export function exportComponentToJSON(
  component: JSComponentConfig | ComfyUIComponentConfig | ComponentConfig,
  type: ExportType
): string {
  const payload: ExportedComponent = { type, component }
  return JSON.stringify(payload, null, 2)
}

export function getExportFileName(component: { id: string; name?: string; componentName?: string }): string {
  const base = sanitizeFileName(
    ((component as any).name || (component as any).componentName || component.id).toString()
  )
  const stamp = nowStamp()
  return `${base}-${component.id}-${stamp}.json`
}

export function parseImportFile(content: string): { type: ExportType; component: any } {
  const data = JSON.parse(content)
  // Wrapper format
  if (data && (data.type === 'js' || data.type === 'comfyui') && data.component) {
    return { type: data.type as ExportType, component: data.component }
  }
  // Raw component format
  if (data && typeof data === 'object') {
    const comp = data as any
    // Try infer type
    if (comp.category === 'javascript' || (comp.jsCode && comp.componentName)) {
      return { type: 'js', component: comp }
    }
    if (comp.category === 'comfyui' || (comp.workflowTemplate && comp.componentName)) {
      return { type: 'comfyui', component: comp }
    }
  }
  throw new Error('Invalid component export format')
}

export function validateImportData(importData: { type: ExportType; component: any }): {
  valid: boolean
  warnings: string[]
  errors: string[]
} {
  const errors: string[] = []
  const warnings: string[] = []
  const c = importData.component || {}
  if (!c.id || typeof c.id !== 'string') errors.push('missing id')
  if (!c.name && !c.componentName) warnings.push('missing name')
  if (!('enabled' in c)) warnings.push('missing enabled (default to true)')
  if (!c.category && importData.type === 'js') c.category = 'javascript'
  if (!c.category && importData.type === 'comfyui') c.category = 'comfyui'

  if (importData.type === 'js') {
    if (c.category !== 'javascript') errors.push('invalid category for js component')
    if (!c.componentName || typeof c.componentName !== 'string') errors.push('missing componentName')
    if (!c.jsCode || typeof c.jsCode !== 'string') errors.push('missing jsCode')
    if (!c.outputType || !['text', 'html'].includes(c.outputType)) warnings.push('missing/invalid outputType')
  } else if (importData.type === 'comfyui') {
    if (c.category !== 'comfyui') errors.push('invalid category for comfyui component')
    if (!c.componentName || typeof c.componentName !== 'string') errors.push('missing componentName')
    if (!c.serverUrl || typeof c.serverUrl !== 'string') errors.push('missing serverUrl')
    if (!c.workflowTemplate || typeof c.workflowTemplate !== 'object') errors.push('missing workflowTemplate')
    if (!Array.isArray(c.nodeBindings)) warnings.push('missing nodeBindings ([])')
    if (!c.outputType || !['image', 'video', 'text'].includes(c.outputType)) warnings.push('missing/invalid outputType')
  }
  return { valid: errors.length === 0, warnings, errors }
}

// Basic conflict checker placeholder: real implementation can compare with store
export function checkComponentConflicts(
  component: JSComponentConfig | ComfyUIComponentConfig | ComponentConfig,
  type: ExportType
): Conflict[] {
  const conflicts: Conflict[] = []
  const state = store.getState()
  const settings: ComponentSettings | undefined = state?.settings?.componentSettings
  const comps = settings?.components || {}

  const existsById = comps[component.id]
  if (existsById) {
    conflicts.push({ conflictType: 'id', componentId: component.id, componentName: (component as any).name || (component as any).componentName || component.id })
  }

  const importedName = (component as any).componentName
  if (importedName) {
    const list = Object.values(comps) as ComponentConfig[]
    const nameClash = list.find((c) =>
      (type === 'js' && c.category === 'javascript' && (c as any).componentName === importedName) ||
      (type === 'comfyui' && c.category === 'comfyui' && (c as any).componentName === importedName)
    )
    if (nameClash) {
      conflicts.push({ conflictType: 'name', componentId: nameClash.id, componentName: importedName })
    }
  }
  return conflicts
}

export function generateNewId(oldId: string): string {
  const state = store.getState()
  const comps = state?.settings?.componentSettings?.components || {}
  const base = oldId.endsWith('-copy') ? oldId : `${oldId}-copy`
  if (!comps[base]) return base
  let i = 2
  while (comps[`${oldId}-copy-${i}`]) i++
  return `${oldId}-copy-${i}`
}

export function generateNewComponentName(name: string, _type: ExportType): string {
  const state = store.getState()
  const comps: ComponentConfig[] = Object.values(state?.settings?.componentSettings?.components || {})
  const base = name.endsWith(' (copy)') ? name : `${name} (copy)`
  const used = new Set(
    comps.map((c) => ((c as any).componentName || c.name) as string)
  )
  if (!used.has(base)) return base
  let i = 2
  let candidate = `${name} (copy ${i})`
  while (used.has(candidate)) {
    i++
    candidate = `${name} (copy ${i})`
  }
  return candidate
}
