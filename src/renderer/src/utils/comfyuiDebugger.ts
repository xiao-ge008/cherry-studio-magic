/**
 * ComfyUI组件调试工具
 * 用于诊断和修复ComfyUI组件相关问题
 */

import { loggerService } from '@renderer/services/LoggerService'
import { componentService } from '@renderer/services/ComponentService'

import type { ComfyUIComponentConfig } from '@renderer/types/component'

const logger = loggerService.withContext('ComfyUIDebugger')

export class ComfyUIDebugger {
  /**
   * 诊断ComfyUI组件问题
   */
  static async diagnose(componentName: string): Promise<{
    componentExists: boolean
    componentConfig?: ComfyUIComponentConfig
    apiConnectable: boolean
    issues: string[]
    suggestions: string[]
    allComponents: Array<{ name: string; componentName: string; enabled: boolean }>
  }> {
    logger.info('开始诊断ComfyUI组件', { componentName })

    // 1. 使用ComponentService进行基础诊断
    const basicDiagnosis = await componentService.diagnoseComfyUIComponent(componentName)

    if (!basicDiagnosis.componentExists) {
      return {
        ...basicDiagnosis,
        apiConnectable: false
      }
    }

    const component = basicDiagnosis.componentConfig!
    const issues = [...basicDiagnosis.issues]
    const suggestions = [...basicDiagnosis.suggestions]

    // 2. 检查API连接
    let apiConnectable = false
    try {
      const response = await fetch('/api/v1/comfyui/components')
      if (response.ok) {
        apiConnectable = true
        logger.info('ComfyUI API连接正常')
      } else {
        issues.push(`ComfyUI API响应错误: ${response.status}`)
        suggestions.push('请检查后端服务是否正常运行')
      }
    } catch (error) {
      issues.push(`ComfyUI API连接失败: ${(error as Error).message}`)
      suggestions.push('请检查网络连接和后端服务状态')
    }

    // 3. 检查ComfyUI服务器连接（如果有服务器URL）
    if (component.serverUrl) {
      try {
        const testResult = await this.testComfyUIServer(component.serverUrl, component.apiKey)
        if (!testResult.success) {
          issues.push(`ComfyUI服务器连接失败: ${testResult.error}`)
          suggestions.push('请检查ComfyUI服务器是否运行在指定地址')
        }
      } catch (error) {
        issues.push(`ComfyUI服务器测试失败: ${(error as Error).message}`)
      }
    }

    return {
      componentExists: true,
      componentConfig: component,
      apiConnectable,
      issues,
      suggestions,
      allComponents: basicDiagnosis.allComponents
    }
  }

  /**
   * 测试ComfyUI服务器连接
   */
  private static async testComfyUIServer(
    serverUrl: string,
    apiKey?: string
  ): Promise<{
    success: boolean
    error?: string
  }> {
    try {
      const response = await fetch(`${serverUrl}/system_stats`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          ...(apiKey && { Authorization: `Bearer ${apiKey}` })
        }
      })

      if (!response.ok) {
        return { success: false, error: `HTTP ${response.status}: ${response.statusText}` }
      }

      return { success: true }
    } catch (error) {
      return { success: false, error: (error as Error).message }
    }
  }

  /**
   * 修复常见问题
   */
  static async autoFix(componentName: string): Promise<{
    success: boolean
    fixedIssues: string[]
    remainingIssues: string[]
  }> {
    const fixedIssues: string[] = []
    const remainingIssues: string[] = []

    const diagnosis = await this.diagnose(componentName)

    if (!diagnosis.componentExists) {
      remainingIssues.push('组件不存在，需要手动创建')
      return { success: false, fixedIssues, remainingIssues }
    }

    const component = diagnosis.componentConfig!

    // 尝试启用组件
    if (!component.enabled) {
      const success = componentService.setComponentEnabled(component.id, true)
      if (success) {
        fixedIssues.push('已启用组件')
      } else {
        remainingIssues.push('无法启用组件')
      }
    }

    // 其他问题需要手动修复
    diagnosis.issues.forEach((issue) => {
      if (!issue.includes('已禁用')) {
        remainingIssues.push(issue)
      }
    })

    return {
      success: fixedIssues.length > 0,
      fixedIssues,
      remainingIssues
    }
  }

  /**
   * 获取详细的组件信息
   */
  static getComponentDetails(componentName: string): {
    found: boolean
    component?: ComfyUIComponentConfig
    allComponents: Array<{ name: string; componentName: string; enabled: boolean }>
  } {
    const components = componentService.getComfyUIComponents()
    const component = components.find((c) => c.componentName === componentName)

    return {
      found: !!component,
      component,
      allComponents: components.map((c) => ({
        name: c.name,
        componentName: c.componentName,
        enabled: c.enabled
      }))
    }
  }
}

// 导出调试函数到全局，方便在控制台中使用
if (typeof window !== 'undefined') {
  ;(window as any).comfyUIDebugger = ComfyUIDebugger
}
