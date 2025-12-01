/**
 * ComfyUI动态组件渲染器
 * 通用的ComfyUI组件渲染器，支持参数表单生成、生成按钮和进度显示
 */

import {
  Accordion,
  AccordionItem,
  Button,
  Card,
  CardBody,
  Chip,
  Divider,
  Input,
  Spinner,
  Switch,
  Textarea
} from '@heroui/react'
import ImageViewer from '@renderer/components/ImageViewer'
import { componentService } from '@renderer/services/ComponentService'
import type { ComfyUIProgress } from '@renderer/types/comfyui'
import type { ComfyUIComponentConfig } from '@renderer/types/component'
import { ComfyUIDebugger } from '@renderer/utils/comfyuiDebugger'
import { ComfyUIParameterMapper, ParameterConverter } from '@renderer/utils/comfyuiMapper'
import React, { useEffect, useMemo, useState } from 'react'

interface ComfyUIComponentProps {
  componentName: string
  [key: string]: any
}

/**
 * ComfyUI组件渲染器
 */
export const ComfyUIComponent: React.FC<ComfyUIComponentProps> = ({ componentName, ...props }) => {
  const [component, setComponent] = useState<ComfyUIComponentConfig | null>(null)
  const [formValues, setFormValues] = useState<Record<string, any>>({})
  const [isGenerating, setIsGenerating] = useState(false)
  const [progress, setProgress] = useState<ComfyUIProgress | null>(null)
  const [results, setResults] = useState<string[]>([])
  const [error, setError] = useState<string | null>(null)
  const [diagnostics, setDiagnostics] = useState<any>(null)
  const [showDiagnostics, setShowDiagnostics] = useState(false)

  // 简化状态
  const [showSettings, setShowSettings] = useState(false)
  const [lastGeneratedParams, setLastGeneratedParams] = useState<Record<string, any>>({})

  // HeroUI 样式类定义（修复黑框问题）
  const baseInputWrapperClass = [
    '!border-1',
    '!border-default-200',
    'data-[hover=true]:!border-default-300',
    'focus-within:!border-primary-500',
    'group-data-[focus=true]:!border-primary-500',
    'group-data-[focus=true]:!border-1',
    '!shadow-none',
    'transition-colors'
  ].join(' ')
  const parameterInputWrapperClass = `${baseInputWrapperClass} bg-default-50`
  const baseFieldInputClass = '!border-0 !outline-none focus-visible:!outline-none'

  // 提取 props 的简单属性作为依赖，避免循环引用
  const propsKey = useMemo(() => {
    // 只提取简单的字符串和数字属性
    const simpleProps: Record<string, any> = {}
    for (const key in props) {
      const value = props[key]
      if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
        simpleProps[key] = value
      }
    }
    return JSON.stringify(simpleProps)
  }, [props])

  // 稳定化 props
  const stableProps = useMemo(() => props, [propsKey])

  // 自动生成逻辑
  const triggerGeneration = async (force = false) => {
    if (!component || isGenerating) return

    // 检查参数是否有变化
    const currentParamsStr = JSON.stringify(formValues)
    const lastParamsStr = JSON.stringify(lastGeneratedParams)

    if (!force && currentParamsStr === lastParamsStr && results.length > 0) {
      // 参数没有变化且已有结果，显示缓存提示
      setError('参数未变化，请修改参数或点击重新生成')
      setTimeout(() => setError(null), 2000) // 2秒后自动清除提示
      return
    }

    try {
      setIsGenerating(true)
      setError(null)
      setProgress(null)
      // 如果是强制重新生成，不清除当前结果，直到新结果生成（可选，这里保持清除以显示加载状态）
      setResults([])

      // 准备发送的参数
      const paramsToSend = { ...formValues }

      // 如果是强制重新生成，尝试更新 seed 以绕过缓存
      if (force && 'seed' in paramsToSend) {
        const newSeed = Math.floor(Math.random() * 1000000000000000)
        paramsToSend.seed = newSeed
        // 同步更新表单状态，让用户看到 seed 变了
        setFormValues((prev) => ({ ...prev, seed: newSeed }))
        console.log('🎲 强制重新生成，更新 Seed:', newSeed)
      }

      console.log('🎨 开始生成图片...', { componentId: component.id, parameters: paramsToSend })

      // 监听进度事件
      const handleProgress = (_event: any, data: any) => {
        if (data.componentId === component.id) {
          setProgress({
            promptId: data.promptId || 'unknown',
            value: data.progress,
            max: 100,
            percentage: Math.round(data.progress),
            status: data.progress >= 100 ? 'completed' : 'executing'
          })
        }
      }

      // 清理监听器函数
      const cleanupListeners = () => {
        window.api.off('comfyui:progress', handleProgress)
        window.api.off('comfyui:completed', handleCompleted)
        window.api.off('comfyui:failed', handleFailed)
      }

      const handleCompleted = (_event: any, data: any) => {
        console.log('✅ 完成事件:', data)
        if (data.componentId === component.id) {
          if (data.imagePath) {
            setResults([`file://${data.imagePath}`])
            // 保存当前参数作为最后生成的参数
            // FIX: 使用 paramsToSend 而不是闭包中的 formValues，确保 seed 更新被记录
            setLastGeneratedParams({ ...paramsToSend })
            // 如果当前在参数设置界面，自动跳转到图片展示
            if (showSettings) {
              setShowSettings(false)
            }
          }
          setIsGenerating(false)
          if (data.cached) {
            setError('使用缓存图片')
          }
          cleanupListeners() // 清理监听器
        }
      }

      const handleFailed = (_event: any, data: any) => {
        if (data.componentId === component.id) {
          setError(data.error || '生成失败')
          setIsGenerating(false)
          cleanupListeners() // 清理监听器
        }
      }

      // 注册事件监听器
      window.api.on('comfyui:progress', handleProgress)
      window.api.on('comfyui:completed', handleCompleted)
      window.api.on('comfyui:failed', handleFailed)

      // 使用正确的 IPC 调用
      const result = await window.api.comfyui.generate(component, paramsToSend)

      console.log('🎨 生成结果:', result)

      // 如果立即返回结果（缓存情况）
      if (result.success && result.imagePath) {
        setResults([`file://${result.imagePath}`])
        // 保存当前参数作为最后生成的参数
        setLastGeneratedParams({ ...formValues })
        // 如果当前在参数设置界面，自动跳转到图片展示
        if (showSettings) {
          setShowSettings(false)
        }
        setIsGenerating(false)
        if (result.cached) {
          setError('使用缓存图片')
        }
      } else if (!result.success) {
        setError(result.error || '生成失败')
        setIsGenerating(false)
      }
      // 否则等待事件回调

      // 清理事件监听器
      setTimeout(() => {
        window.api.off('comfyui:progress', handleProgress)
        window.api.off('comfyui:completed', handleCompleted)
        window.api.off('comfyui:failed', handleFailed)
      }, 30000) // 30秒后清理
    } catch (err) {
      console.error('🎨 生成错误:', err)
      setError(err instanceof Error ? err.message : '生成过程中发生错误')
      setIsGenerating(false)
    }
  }

  // 查找组件配置并进行诊断
  useEffect(() => {
    const findComponent = async () => {
      const components = componentService.getComfyUIComponents()
      const found = components.find((c) => c.componentName === componentName)

      if (found) {
        setComponent(found)
        setError(null)
        // 初始化表单值
        const defaultValues = ComfyUIParameterMapper.generateDefaultParameters(found)
        const propsValues = ParameterConverter.convertApiToFormParameters(stableProps, found)
        setFormValues({ ...defaultValues, ...propsValues })
      } else {
        // 组件未找到，进行详细诊断
        try {
          const diagnosis = await ComfyUIDebugger.diagnose(componentName)
          setDiagnostics(diagnosis)

          if (diagnosis.issues.length > 0) {
            const errorMessage = `ComfyUI组件 "${componentName}" 未找到。\n问题: ${diagnosis.issues.join(', ')}\n建议: ${diagnosis.suggestions.join(', ')}`
            setError(errorMessage)
          } else {
            setError(`ComfyUI组件 "${componentName}" 未找到`)
          }
        } catch (diagError) {
          setError(`ComfyUI组件 "${componentName}" 未找到，诊断失败: ${(diagError as Error).message}`)
        }
      }
    }

    findComponent()
  }, [componentName, stableProps])

  // 生成表单配置
  const formConfig = useMemo(() => {
    if (!component) return []
    return ComfyUIParameterMapper.generateFormConfig(component)
  }, [component])

  // 自动生成：当组件加载完成时触发
  useEffect(() => {
    if (component && !isGenerating && results.length === 0) {
      // 首次加载立即触发，无需延迟，避免界面闪烁
      triggerGeneration()
    }
  }, [component])

  // 自动关闭错误提示
  useEffect(() => {
    if (error) {
      const timer = setTimeout(() => {
        setError(null)
      }, 3000) // 3秒后自动关闭

      return () => clearTimeout(timer)
    }
    return undefined
  }, [error])

  // 处理表单值变化
  const handleFormChange = (name: string, value: any) => {
    setFormValues((prev) => ({ ...prev, [name]: value }))
  }

  // 渲染表单字段
  const renderFormField = (field: any) => {
    const value = formValues[field.name] || ''

    switch (field.type) {
      case 'string':
        if (field.options) {
          // 下拉选择
          return (
            <select
              key={field.name}
              value={value}
              onChange={(e) => handleFormChange(field.name, e.target.value)}
              className="w-full rounded border p-2">
              <option value="">请选择...</option>
              {field.options.map((option: string) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          )
        } else if (field.name.includes('text') || field.name.includes('prompt')) {
          // 多行文本
          return (
            <Textarea
              key={field.name}
              value={value}
              onChange={(e) => handleFormChange(field.name, e.target.value)}
              placeholder={field.placeholder}
              minRows={3}
              maxRows={8}
              variant="bordered"
              classNames={{
                inputWrapper: parameterInputWrapperClass,
                input: baseFieldInputClass
              }}
            />
          )
        } else {
          // 单行文本
          return (
            <Input
              key={field.name}
              value={value}
              onChange={(e) => handleFormChange(field.name, e.target.value)}
              placeholder={field.placeholder}
              variant="bordered"
              classNames={{
                inputWrapper: parameterInputWrapperClass,
                input: baseFieldInputClass
              }}
            />
          )
        }

      case 'number':
        return (
          <Input
            key={field.name}
            type="number"
            value={value}
            onChange={(e) => handleFormChange(field.name, parseFloat(e.target.value) || 0)}
            placeholder={field.placeholder}
          />
        )

      case 'boolean':
        return (
          <Switch
            key={field.name}
            isSelected={Boolean(value)}
            onValueChange={(checked) => handleFormChange(field.name, checked)}>
            {field.label}
          </Switch>
        )

      case 'json':
        return (
          <Textarea
            key={field.name}
            value={typeof value === 'object' ? JSON.stringify(value, null, 2) : value}
            onChange={(e) => {
              try {
                const parsed = JSON.parse(e.target.value)
                handleFormChange(field.name, parsed)
              } catch {
                handleFormChange(field.name, e.target.value)
              }
            }}
            placeholder={field.placeholder}
            minRows={4}
            variant="bordered"
            classNames={{
              inputWrapper: parameterInputWrapperClass,
              input: baseFieldInputClass
            }}
          />
        )

      default:
        return (
          <Input
            key={field.name}
            value={value}
            onChange={(e) => handleFormChange(field.name, e.target.value)}
            placeholder={field.placeholder}
            variant="bordered"
            classNames={{
              inputWrapper: parameterInputWrapperClass,
              input: baseFieldInputClass
            }}
          />
        )
    }
  }

  if (error && !component) {
    return (
      <Card className="border-danger">
        <CardBody className="space-y-4">
          <div className="text-center text-danger">
            <p className="font-semibold">ComfyUI组件加载失败</p>
            <p className="whitespace-pre-line text-sm">{error}</p>
          </div>

          {diagnostics && (
            <div className="space-y-3">
              <Divider />
              <div className="text-left">
                <h4 className="mb-2 font-medium text-sm">诊断信息</h4>

                {diagnostics.allComponents.length > 0 && (
                  <div className="mb-3">
                    <p className="mb-1 text-default-600 text-xs">可用的ComfyUI组件:</p>
                    <div className="flex flex-wrap gap-1">
                      {diagnostics.allComponents.map((comp: any) => (
                        <Chip
                          key={comp.componentName}
                          size="sm"
                          variant="flat"
                          color={comp.enabled ? 'success' : 'default'}>
                          {comp.componentName}
                        </Chip>
                      ))}
                    </div>
                  </div>
                )}

                <div className="space-y-2">
                  <Button size="sm" variant="flat" color="primary" onPress={() => setShowDiagnostics(!showDiagnostics)}>
                    {showDiagnostics ? '隐藏' : '显示'}详细诊断
                  </Button>

                  {showDiagnostics && (
                    <Accordion variant="light">
                      <AccordionItem key="diagnostics" title="详细诊断信息">
                        <div className="space-y-2 text-xs">
                          <div>
                            <strong>组件存在:</strong> {diagnostics.componentExists ? '是' : '否'}
                          </div>
                          <div>
                            <strong>API连接:</strong> {diagnostics.apiConnectable ? '正常' : '失败'}
                          </div>
                          {diagnostics.issues.length > 0 && (
                            <div>
                              <strong>问题列表:</strong>
                              <ul className="ml-2 list-inside list-disc">
                                {diagnostics.issues.map((issue: string, index: number) => (
                                  <li key={index}>{issue}</li>
                                ))}
                              </ul>
                            </div>
                          )}
                          {diagnostics.suggestions.length > 0 && (
                            <div>
                              <strong>修复建议:</strong>
                              <ul className="ml-2 list-inside list-disc">
                                {diagnostics.suggestions.map((suggestion: string, index: number) => (
                                  <li key={index}>{suggestion}</li>
                                ))}
                              </ul>
                            </div>
                          )}
                        </div>
                      </AccordionItem>
                    </Accordion>
                  )}
                </div>
              </div>
            </div>
          )}
        </CardBody>
      </Card>
    )
  }

  if (!component) {
    return (
      <Card>
        <CardBody>
          <div className="text-center">
            <p>正在加载组件...</p>
          </div>
        </CardBody>
      </Card>
    )
  }

  return (
    <div className="comfyui-component-wrapper my-6 flex w-full flex-col">
      <Card className="w-full border-none bg-content1 shadow-sm" radius="lg">
        <CardBody className="relative flex h-[400px] w-full flex-col overflow-hidden p-0">
          {showSettings ? (
            /* ---------------- 参数设置视图 ---------------- */
            <div className="fade-in slide-in-from-bottom-4 flex h-full w-full animate-in flex-col bg-default-50/50 backdrop-blur-md duration-300">
              {/* 标题栏 */}
              <div className="flex items-center justify-between border-default-100 border-b px-4 py-3">
                <h3 className="font-medium text-default-700">参数设置</h3>
                <Button
                  isIconOnly
                  size="sm"
                  variant="light"
                  onPress={() => setShowSettings(false)}
                  className="text-default-400 hover:text-default-700"
                  title="关闭设置">
                  ✕
                </Button>
              </div>

              {/* 滚动表单区域 */}
              <div className="custom-scrollbar flex-1 overflow-y-auto p-4">
                <div className="space-y-4">
                  <div className="grid grid-cols-1 gap-4">
                    {formConfig.map((field) => (
                      <div key={field.name} className="space-y-1.5">
                        <label className="font-medium text-default-500 text-xs">
                          {field.label}
                          {field.required && <span className="ml-1 text-danger">*</span>}
                        </label>
                        {renderFormField(field)}
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* 底部按钮栏 */}
              <div className="border-default-100 border-t bg-content1/50 p-4">
                <Button
                  color="primary"
                  className="w-full font-medium shadow-md"
                  isLoading={isGenerating}
                  onPress={() => {
                    triggerGeneration()
                    setShowSettings(false)
                  }}
                  isDisabled={!component.enabled}>
                  {isGenerating ? '生成中...' : '立即生成'}
                </Button>
              </div>
            </div>
          ) : (
            /* ---------------- 图片预览视图 ---------------- */
            <div className="fade-in relative h-full w-full animate-in bg-default-100/50 duration-300">
              {/* 错误提示 - 绝对定位在顶部 */}
              {error && (
                <div className="fade-in slide-in-from-top-2 absolute top-0 right-0 left-0 z-[60] flex animate-in justify-center p-2">
                  <div className="rounded-full border border-danger-100 bg-danger-50 px-4 py-1.5 font-medium text-danger text-xs shadow-sm backdrop-blur-md">
                    {error}
                  </div>
                </div>
              )}

              {isGenerating || (results.length === 0 && !error) ? (
                <div className="flex flex-col items-center justify-center space-y-4">
                  <Spinner size="lg" color="primary" />
                  <div className="text-center">
                    <p className="font-medium text-default-700">正在生成...</p>
                    <p className="text-default-500 text-xs">
                      {progress ? `进度: ${Math.round(progress.percentage || 0)}%` : '请稍候'}
                    </p>
                  </div>
                </div>
              ) : results.length > 0 ? (
                <div className="group relative flex h-full w-full items-center justify-center">
                  {results.map((imageUrl, index) => (
                    <ImageViewer
                      key={index}
                      src={imageUrl}
                      alt={`生成结果 ${index + 1}`}
                      preview={{ mask: false }}
                      style={{
                        maxWidth: '100%',
                        maxHeight: '100%',
                        width: 'auto',
                        height: 'auto',
                        objectFit: 'contain',
                        display: 'block'
                      }}
                    />
                  ))}

                  {/* 悬浮控制按钮 - 极高 z-index 确保可点击 */}
                  <div
                    className="absolute top-3 right-3 z-50 flex gap-2 opacity-0 transition-opacity duration-200 group-hover:opacity-100"
                    onClick={(e) => e.stopPropagation()}>
                    <Button
                      isIconOnly
                      size="sm"
                      className="bg-white/90 text-default-700 shadow-lg backdrop-blur-md hover:scale-105 hover:bg-white"
                      onPress={() => triggerGeneration(true)}
                      title="重新生成">
                      <span className="text-lg">🔄</span>
                    </Button>
                    <Button
                      isIconOnly
                      size="sm"
                      className={`bg-white/90 text-default-700 shadow-md backdrop-blur-md hover:scale-105 hover:bg-white ${showSettings ? 'bg-primary/10 text-primary' : ''}`}
                      onPress={() => setShowSettings(!showSettings)}
                      title="参数设置">
                      <span className="text-lg">⚙️</span>
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="flex h-full w-full flex-col items-center justify-center space-y-4 text-default-400">
                  <div className="text-6xl opacity-50">🎨</div>
                  <div className="text-center">
                    <p className="font-medium text-default-600 text-lg">等待生成</p>
                    <p className="text-sm">组件加载完成后将自动生成</p>
                  </div>
                  <Button color="primary" variant="flat" onPress={() => triggerGeneration()} isDisabled={isGenerating}>
                    开始生成
                  </Button>
                </div>
              )}
            </div>
          )}
        </CardBody>
      </Card>

      {/* 文字内容区域 - 位于卡片下方 */}
      {props.children && <div className="comfyui-text-content mt-4 w-full px-1">{props.children}</div>}
    </div>
  )
}

export default ComfyUIComponent
