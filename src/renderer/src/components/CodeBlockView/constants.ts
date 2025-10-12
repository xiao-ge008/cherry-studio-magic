import { GraphvizPreview, MermaidPreview, PlantUmlPreview, SvgPreview } from '@renderer/components/Preview'
import type React from 'react'

/**
 * 特殊视图语言列表
 */
export const SPECIAL_VIEWS = ['mermaid', 'plantuml', 'svg', 'dot', 'graphviz'] as const

/**
 * 特殊视图组件映射表
 */
export const SPECIAL_VIEW_COMPONENTS: Record<string, React.ComponentType<any>> = {
  mermaid: MermaidPreview as React.ComponentType<any>,
  plantuml: PlantUmlPreview as React.ComponentType<any>,
  svg: SvgPreview as React.ComponentType<any>,
  dot: GraphvizPreview as React.ComponentType<any>,
  graphviz: GraphvizPreview as React.ComponentType<any>
}
