/**
 * ComfyUI动态组件渲染器
 * 通用的ComfyUI组件渲染器，支持参数表单生成、生成按钮和进度显示
 */

import React, { useState, useEffect, useMemo } from 'react'
import {
  Button,
  Input,
  Textarea,
  Switch,
  Progress,
  Chip,
  Image,
  Spinner,
  Divider,
  Accordion,
  AccordionItem,
  Card,
  CardBody
} from '@heroui/react'
import { componentService } from '@renderer/services/ComponentService'
import { ComfyUIParameterMapper, ParameterConverter } from '@renderer/utils/comfyuiMapper'
import { ComfyUIDebugger } from '@renderer/utils/comfyuiDebugger'
import type { ComfyUIComponentConfig } from '@renderer/types/component'
import type { ComfyUIProgress } from '@renderer/types/comfyui'

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

  // 稳定化 props 以避免无限循环
  const stableProps = useMemo(() => props, [JSON.stringify(props)])

  // 自动生成逻辑
  const triggerGeneration = async () => {
    if (!component || isGenerating) return

    // 检查参数是否有变化
    const currentParamsStr = JSON.stringify(formValues)
    const lastParamsStr = JSON.stringify(lastGeneratedParams)

    if (currentParamsStr === lastParamsStr && results.length > 0) {
      // 参数没有变化且已有结果，显示缓存提示
      setError('参数未变化，使用缓存结果')
      setTimeout(() => setError(null), 2000) // 2秒后自动清除提示
      return
    }

    try {
      setIsGenerating(true)
      setError(null)
      setProgress(null)
      setResults([])

      console.log('🎨 开始生成图片...', { componentId: component.id, parameters: formValues })

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

      const handleCompleted = (_event: any, data: any) => {
        console.log('✅ 完成事件:', data)
        if (data.componentId === component.id) {
          if (data.imagePath) {
            setResults([`file://${data.imagePath}`])
            // 保存当前参数作为最后生成的参数
            setLastGeneratedParams({ ...formValues })
            // 如果当前在参数设置界面，自动跳转到图片展示
            if (showSettings) {
              setShowSettings(false)
            }
          }
          setIsGenerating(false)
          if (data.cached) {
            setError('使用缓存图片')
          }
        }
      }

      const handleFailed = (_event: any, data: any) => {
        if (data.componentId === component.id) {
          setError(data.error || '生成失败')
          setIsGenerating(false)
        }
      }

      // 注册事件监听器
      window.api.on('comfyui:progress', handleProgress)
      window.api.on('comfyui:completed', handleCompleted)
      window.api.on('comfyui:failed', handleFailed)

      // 使用正确的 IPC 调用
      const result = await window.api.comfyui.generate(component, formValues)

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
      const timer = setTimeout(() => {
        triggerGeneration()
      }, 500) // 延迟500ms避免频繁触发

      return () => clearTimeout(timer)
    }
    return undefined
  }, [component])

  // 参数变化时自动重新生成
  useEffect(() => {
    if (component && !isGenerating && results.length > 0) {
      const timer = setTimeout(() => {
        triggerGeneration()
      }, 1000) // 参数变化后延迟1秒重新生成

      return () => clearTimeout(timer)
    }
    return undefined
  }, [formValues])

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
    <div className="w-full">
      {/* 主内容区域 - 直接显示内容，无边框无标题 */}
      <div className="relative">
        {showSettings ? (
          /* 参数设置界面 */
          <div className="rounded-lg border border-default-200 bg-default-50/30 p-4">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="font-medium text-base">参数设置</h3>
              <Button
                isIconOnly
                size="sm"
                variant="light"
                onPress={() => setShowSettings(false)}
                className="h-7 w-7 min-w-7">
                ✕
              </Button>
            </div>

            <div className="space-y-4">
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                {formConfig.map((field) => (
                  <div key={field.name} className="space-y-2">
                    <label className="font-medium text-sm">
                      {field.label}
                      {field.required && <span className="ml-1 text-danger">*</span>}
                    </label>
                    {renderFormField(field)}
                  </div>
                ))}
              </div>

              <div className="pt-4">
                <Button
                  color="primary"
                  size="lg"
                  className="w-full"
                  isLoading={isGenerating}
                  onPress={triggerGeneration}
                  isDisabled={!component.enabled}>
                  {isGenerating ? '生成中...' : '生成图片'}
                </Button>
              </div>
            </div>
          </div>
        ) : (
          /* 图片展示界面 - 悬浮按钮 */
          <div>
            {/* 结果显示区域 */}
            {isGenerating ? (
              <div className="flex flex-col items-center justify-center space-y-3 rounded-lg border-2 border-default-300 border-dashed py-12">
                <Spinner size="lg" color="primary" />
                <div className="space-y-1 text-center">
                  <p className="font-medium">正在生成中...</p>
                  {progress && (
                    <div className="w-64">
                      <Progress
                        value={progress.percentage}
                        color="primary"
                        size="sm"
                        showValueLabel={true}
                        label={`${progress.status} - ${progress.percentage}%`}
                      />
                    </div>
                  )}
                </div>
              </div>
            ) : results.length > 0 ? (
              /* 图片显示 - 悬浮控制按钮 */
              <div className="grid grid-cols-1 gap-4">
                {results.map((imageUrl, index) => (
                  <div key={index} className="group relative overflow-hidden rounded-lg">
                    <Image
                      src={imageUrl}
                      alt={`生成结果 ${index + 1}`}
                      className="w-full rounded-lg transition-all duration-300 group-hover:scale-[1.01]"
                      loading="lazy"
                    />

                    {/* 悬浮在图片右上角的控制按钮 - 始终显示 */}
                    <div className="absolute top-2 right-2 flex gap-1 opacity-90 transition-all duration-300 ease-out hover:opacity-100">
                      {/* 复制图片链接按钮 */}
                      <Button
                        isIconOnly
                        size="sm"
                        variant="solid"
                        onPress={() => {
                          try {
                            // 简单复制图片链接
                            navigator.clipboard
                              .writeText(imageUrl)
                              .then(() => {
                                window.toast?.success('图片链接已复制')
                              })
                              .catch(() => {
                                window.toast?.error('复制失败')
                              })
                          } catch (error) {
                            console.error('复制失败:', error)
                            window.toast?.error('复制失败')
                          }
                        }}
                        className="h-8 w-8 min-w-8 border border-white/20 bg-white/90 text-gray-800 shadow-lg backdrop-blur-md transition-all duration-200 hover:scale-105 hover:bg-white hover:shadow-xl"
                        title="复制链接">
                        📋
                      </Button>

                      {/* 保存图片按钮 */}
                      <Button
                        isIconOnly
                        size="sm"
                        variant="solid"
                        onPress={() => {
                          try {
                            // 简单下载图片
                            const link = document.createElement('a')
                            link.href = imageUrl
                            link.download = `comfyui-${Date.now()}.png`
                            link.style.display = 'none'
                            document.body.appendChild(link)
                            link.click()
                            document.body.removeChild(link)
                            window.toast?.success('开始下载图片')
                          } catch (error) {
                            console.error('下载失败:', error)
                            window.toast?.error('下载失败')
                          }
                        }}
                        className="h-8 w-8 min-w-8 border border-white/20 bg-white/90 text-gray-800 shadow-lg backdrop-blur-md transition-all duration-200 hover:scale-105 hover:bg-white hover:shadow-xl"
                        title="下载图片">
                        💾
                      </Button>

                      {/* 重新生成按钮 */}
                      <Button
                        isIconOnly
                        size="sm"
                        variant="solid"
                        onPress={triggerGeneration}
                        isDisabled={isGenerating}
                        className="h-8 w-8 min-w-8 border border-white/20 bg-white/90 text-gray-800 shadow-lg backdrop-blur-md transition-all duration-200 hover:scale-105 hover:bg-white hover:shadow-xl"
                        title="重新生成">
                        {isGenerating ? '⏳' : '🔄'}
                      </Button>

                      {/* 参数设置按钮 */}
                      <Button
                        isIconOnly
                        size="sm"
                        variant="solid"
                        onPress={() => setShowSettings(true)}
                        className="h-8 w-8 min-w-8 border border-white/20 bg-white/90 text-gray-800 shadow-lg backdrop-blur-md transition-all duration-200 hover:scale-105 hover:bg-white hover:shadow-xl"
                        title="参数设置">
                        ⚙️
                      </Button>
                    </div>

                    {/* 悬停时的微妙遮罩效果 */}
                    <div className="pointer-events-none absolute inset-0 rounded-lg bg-gradient-to-t from-black/0 via-transparent to-black/0 transition-all duration-300 group-hover:from-black/5 group-hover:to-black/5"></div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center space-y-4 rounded-lg border-2 border-default-300 border-dashed py-12">
                <div className="text-6xl">🎨</div>
                <div className="text-center">
                  <p className="font-medium text-lg">等待生成</p>
                  <p className="text-default-500 text-sm">组件加载完成后将自动生成</p>
                </div>
                <Button color="primary" size="md" onPress={triggerGeneration} isDisabled={isGenerating}>
                  立即生成
                </Button>
              </div>
            )}

            {/* 简化提示 */}
            {error && (
              <div
                className={`fixed top-4 right-4 z-50 max-w-sm rounded-lg px-4 py-2 text-white shadow-lg ${
                  error.includes('缓存') || error.includes('参数未变化') ? 'bg-blue-500' : 'bg-danger-500'
                }`}>
                <div className="flex items-center gap-2">
                  <span>{error.includes('缓存') || error.includes('参数未变化') ? 'ℹ️' : '⚠️'}</span>
                  <span className="text-sm">
                    {error.includes('缓存') || error.includes('参数未变化') ? error : '生成失败，请重试'}
                  </span>
                  <button onClick={() => setError(null)} className="ml-auto text-white/80 hover:text-white">
                    ✕
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

export default ComfyUIComponent
