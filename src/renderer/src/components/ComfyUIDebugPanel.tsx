/**
 * ComfyUI调试面板组件
 * 用于诊断和修复ComfyUI组件问题
 */

import React, { useState } from 'react'
import { Card, CardBody, Button, Input, Divider, Chip, Accordion, AccordionItem, Spinner } from '@heroui/react'
import { ComfyUIDebugger } from '@renderer/utils/comfyuiDebugger'
import { componentService } from '@renderer/services/ComponentService'

interface ComfyUIDebugPanelProps {
  componentName?: string
  onClose?: () => void
}

export const ComfyUIDebugPanel: React.FC<ComfyUIDebugPanelProps> = ({
  componentName: initialComponentName,
  onClose
}) => {
  const [componentName, setComponentName] = useState(initialComponentName || '')
  const [isLoading, setIsLoading] = useState(false)
  const [diagnostics, setDiagnostics] = useState<any>(null)
  const [error, setError] = useState<string | null>(null)

  const handleDiagnose = async () => {
    if (!componentName.trim()) {
      setError('请输入组件名称')
      return
    }

    setIsLoading(true)
    setError(null)
    setDiagnostics(null)

    try {
      const result = await ComfyUIDebugger.diagnose(componentName.trim())
      setDiagnostics(result)
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setIsLoading(false)
    }
  }

  const handleAutoFix = async () => {
    if (!componentName.trim()) return

    setIsLoading(true)
    try {
      const result = await ComfyUIDebugger.autoFix(componentName.trim())

      if (result.success) {
        window.toast.success(`修复完成: ${result.fixedIssues.join(', ')}`)
        // 重新诊断
        await handleDiagnose()
      } else {
        window.toast.warning('自动修复失败，请手动处理')
      }
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setIsLoading(false)
    }
  }

  const handleEnableComponent = async () => {
    if (!diagnostics?.componentConfig) return

    const success = componentService.setComponentEnabled(diagnostics.componentConfig.id, true)
    if (success) {
      window.toast.success('组件已启用')
      await handleDiagnose()
    } else {
      window.toast.error('启用组件失败')
    }
  }

  return (
    <Card className="w-full max-w-4xl">
      <CardBody className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-lg">ComfyUI组件诊断</h3>
          {onClose && (
            <Button size="sm" variant="light" onPress={onClose}>
              关闭
            </Button>
          )}
        </div>

        <div className="flex gap-2">
          <Input
            placeholder="输入组件名称 (如: verticalPainting)"
            value={componentName}
            onChange={(e) => setComponentName(e.target.value)}
            className="flex-1"
          />
          <Button color="primary" onPress={handleDiagnose} isLoading={isLoading} isDisabled={!componentName.trim()}>
            诊断
          </Button>
        </div>

        {error && (
          <div className="rounded-lg border border-danger-200 bg-danger-50 p-3">
            <p className="text-danger text-sm">{error}</p>
          </div>
        )}

        {isLoading && (
          <div className="flex items-center justify-center py-8">
            <Spinner size="lg" />
            <span className="ml-2">正在诊断...</span>
          </div>
        )}

        {diagnostics && (
          <div className="space-y-4">
            <Divider />

            {/* 基本状态 */}
            <div className="grid grid-cols-2 gap-4">
              <div className="flex items-center gap-2">
                <span className="font-medium text-sm">组件存在:</span>
                <Chip size="sm" color={diagnostics.componentExists ? 'success' : 'danger'} variant="flat">
                  {diagnostics.componentExists ? '是' : '否'}
                </Chip>
              </div>
              <div className="flex items-center gap-2">
                <span className="font-medium text-sm">API连接:</span>
                <Chip size="sm" color={diagnostics.apiConnectable ? 'success' : 'danger'} variant="flat">
                  {diagnostics.apiConnectable ? '正常' : '失败'}
                </Chip>
              </div>
            </div>

            {/* 问题和建议 */}
            {(diagnostics.issues.length > 0 || diagnostics.suggestions.length > 0) && (
              <Accordion variant="light">
                {diagnostics.issues.length > 0 ? (
                  <AccordionItem key="issues" title={`问题 (${diagnostics.issues.length})`}>
                    <ul className="list-inside list-disc space-y-1 text-sm">
                      {diagnostics.issues.map((issue: string, index: number) => (
                        <li key={index} className="text-danger">
                          {issue}
                        </li>
                      ))}
                    </ul>
                  </AccordionItem>
                ) : null}

                {diagnostics.suggestions.length > 0 ? (
                  <AccordionItem key="suggestions" title={`修复建议 (${diagnostics.suggestions.length})`}>
                    <ul className="list-inside list-disc space-y-1 text-sm">
                      {diagnostics.suggestions.map((suggestion: string, index: number) => (
                        <li key={index} className="text-primary">
                          {suggestion}
                        </li>
                      ))}
                    </ul>
                  </AccordionItem>
                ) : null}
              </Accordion>
            )}

            {/* 可用组件列表 */}
            {diagnostics.allComponents.length > 0 && (
              <div>
                <h4 className="mb-2 font-medium text-sm">可用的ComfyUI组件:</h4>
                <div className="flex flex-wrap gap-2">
                  {diagnostics.allComponents.map((comp: any) => (
                    <Chip
                      key={comp.componentName}
                      size="sm"
                      variant="flat"
                      color={comp.enabled ? 'success' : 'default'}
                      className="cursor-pointer"
                      onClick={() => setComponentName(comp.componentName)}>
                      {comp.componentName}
                    </Chip>
                  ))}
                </div>
              </div>
            )}

            {/* 快速修复按钮 */}
            {diagnostics.componentExists && diagnostics.issues.length > 0 && (
              <div className="flex gap-2">
                <Button size="sm" color="secondary" variant="flat" onPress={handleAutoFix} isLoading={isLoading}>
                  自动修复
                </Button>

                {diagnostics.componentConfig && !diagnostics.componentConfig.enabled && (
                  <Button size="sm" color="success" variant="flat" onPress={handleEnableComponent}>
                    启用组件
                  </Button>
                )}
              </div>
            )}

            {/* 组件详细信息 */}
            {diagnostics.componentConfig && (
              <Accordion variant="light">
                <AccordionItem key="details" title="组件详细信息">
                  <div className="space-y-2 text-sm">
                    <div>
                      <strong>ID:</strong> {diagnostics.componentConfig.id}
                    </div>
                    <div>
                      <strong>名称:</strong> {diagnostics.componentConfig.name}
                    </div>
                    <div>
                      <strong>描述:</strong> {diagnostics.componentConfig.description}
                    </div>
                    <div>
                      <strong>服务器URL:</strong> {diagnostics.componentConfig.serverUrl || '未配置'}
                    </div>
                    <div>
                      <strong>参数数量:</strong> {diagnostics.componentConfig.parameters?.length || 0}
                    </div>
                    <div>
                      <strong>启用状态:</strong> {diagnostics.componentConfig.enabled ? '已启用' : '已禁用'}
                    </div>
                  </div>
                </AccordionItem>
              </Accordion>
            )}
          </div>
        )}
      </CardBody>
    </Card>
  )
}

export default ComfyUIDebugPanel
